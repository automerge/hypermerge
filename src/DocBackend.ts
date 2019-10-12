import { Backend, Change, BackendState as BackDoc, Patch } from 'automerge'
import Queue from './Queue'
import Debug from 'debug'
import { Clock } from './Clock'
import { ActorId, DocId, rootActorId } from './Misc'

const log = Debug('repo:doc:back')

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

  private localChangeQ = new Queue<Change>('doc:back:localChangeQ')
  private remoteChangesQ = new Queue<Change[]>('doc:back:remoteChangesQ')

  constructor(documentId: DocId, back?: BackDoc) {
    this.id = documentId

    if (back) {
      this.back = back
      this.actorId = rootActorId(documentId)
      this.ready.subscribe((f) => f())
      this.subscribeToRemoteChanges()
      this.subscribeToLocalChanges()
      const history = (this.back as any).getIn(['opSet', 'history']).size
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

  applyLocalChange = (change: Change): void => {
    this.localChangeQ.push(change)
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
      const [back, patch] = Backend.applyChanges(Backend.init(), changes)
      this.actorId = this.actorId || actorId
      this.back = back
      this.updateClock(changes)
      //console.log("INIT SYNCED", this.synced, changes.length)
      this.ready.subscribe((f) => f())
      this.subscribeToLocalChanges()
      this.subscribeToRemoteChanges()
      const history = (this.back as any).getIn(['opSet', 'history']).size
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
        const history = (this.back as any).getIn(['opSet', 'history']).size
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
    this.localChangeQ.subscribe((change) => {
      this.bench(`applyLocalChange seq=${change.seq}`, () => {
        const [back, patch] = Backend.applyLocalChange(this.back!, change)
        this.back = back
        this.updateClock([change])
        const history = (this.back as any).getIn(['opSet', 'history']).size
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
