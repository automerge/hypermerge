import { Backend, Change, BackendState as BackDoc, Patch, Request, RegisteredLens } from 'cambriamerge'
import Queue from './Queue'
import Debug from './Debug'
import { Clock } from './Clock'
import { ActorId, DocId, rootActorId } from './Misc'

const log = Debug('DocBackend')

export type DocBackendMessage = ReadyMsg | ActorIdMsg | RemotePatchMsg | LocalPatchMsg

interface ReadyMsg {
  type: 'ReadyMsg'
  doc: DocBackend
  history?: number
  patch?: Patch
}

interface ActorIdMsg {
  type: 'ActorIdMsg'
  id: DocId
  actorId: ActorId
}

interface RemotePatchMsg {
  type: 'RemotePatchMsg'
  doc: DocBackend
  patch: Patch
  change?: Change
  history: number
}

interface LocalPatchMsg {
  type: 'LocalPatchMsg'
  doc: DocBackend
  patch: Patch
  change: Change
  history: number
}

export class DocBackend {
  id: DocId
  actorId?: ActorId // this might be easier to have as the actor object - FIXME
  clock: Clock = {}
  back?: BackDoc // can we make this private?
  changes: Map<string, number> = new Map()
  ready = new Queue<Function>('doc:back:readyQ')
  updateQ = new Queue<DocBackendMessage>('doc:back:updateQ')

  schema: string
  lenses: RegisteredLens[]
  private requestQ = new Queue<Request>('doc:back:requestQ')
  private remoteChangesQ = new Queue<Change[]>('doc:back:remoteChangesQ')

  constructor(documentId: DocId, schema: string, lenses: RegisteredLens[], back?: BackDoc) {
    this.id = documentId
    this.schema = schema
    this.lenses = lenses

    if (back) {
      this.back = back
      this.actorId = rootActorId(documentId)
      this.ready.subscribe((f) => f())
      this.subscribeToRemoteChanges()
      this.subscribeToLocalChanges()
      const history = (this.back as BackDoc).history.length
      this.updateQ.push({
        type: 'ReadyMsg',
        doc: this,
        history,
      })
    }
  }

  applyRemoteChanges = (changes: Change[]): void => {
    this.remoteChangesQ.push(changes)
  }

  applyLocalChange = (request: Request): void => {
    this.requestQ.push(request)
  }

  initActor = (actorId: ActorId) => {
    log('initActor')
    if (this.back) {
      this.actorId = this.actorId || actorId
      this.updateQ.push({
        type: 'ActorIdMsg',
        id: this.id,
        actorId: this.actorId,
      })
    }
  }

  updateClock(changes: Change[]) {
    changes.forEach((change) => {
      const actor = change.actor
      const oldSeq = this.clock[actor] || 0
      this.clock[actor] = Math.max(oldSeq, change.seq)
    })
  }

  init = (changes: Change[], actorId?: ActorId) => {
    this.bench('init', () => {
      //console.log("CHANGES MAX",changes[changes.length - 1])
      //changes.forEach( (c,i) => console.log("CHANGES", i, c.actor, c.seq))
      const schema = this.schema
      const lenses = this.lenses
      const [back, patch] = Backend.applyChanges(Backend.init({schema, lenses}), changes)
      this.actorId = this.actorId || actorId
      this.back = back
      this.updateClock(changes)
      //console.log("INIT SYNCED", this.synced, changes.length)
      this.ready.subscribe((f) => f())
      this.subscribeToLocalChanges()
      this.subscribeToRemoteChanges()
      const history = (this.back as BackDoc).history.length
      this.updateQ.push({
        type: 'ReadyMsg',
        doc: this,
        patch,
        history,
      })
    })
  }

  subscribeToRemoteChanges() {
    this.remoteChangesQ.subscribe((changes) => {
      this.bench('applyRemoteChanges', () => {
        const [back, patch] = Backend.applyChanges(this.back!, changes)
        this.back = back
        this.updateClock(changes)
        const history = (this.back as BackDoc).history.length
        this.updateQ.push({
          type: 'RemotePatchMsg',
          doc: this,
          patch,
          history,
        })
      })
    })
  }

  subscribeToLocalChanges() {
    this.requestQ.subscribe((request) => {
      this.bench(`applyLocalChange seq=${request.seq}`, () => {
        const [back, patch, change] = Backend.applyLocalChange(this.back!, request)
        this.back = back
        this.updateClock([change])
        const history = (this.back as BackDoc).history.length
        this.updateQ.push({
          type: 'LocalPatchMsg',
          doc: this,
          change,
          patch,
          history,
        })
      })
    })
  }

  private bench(msg: string, f: () => void): void {
    const start = Date.now()
    f()
    const duration = Date.now() - start
    log(`id=${this.id} task=${msg} time=${duration}ms`)
  }
}
