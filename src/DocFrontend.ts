import { Patch, Doc, Change, ChangeFn } from 'automerge/frontend'
import { RepoFrontend, ProgressEvent } from './RepoFrontend'
import * as Frontend from 'automerge/frontend'
import { Clock, union } from './Clock'
import Queue from './Queue'
import { Handle } from './Handle'
import Debug from 'debug'
import { ActorId, DocId, DocUrl, toDocUrl } from './Misc'

// TODO - i bet this can be rewritten where the Frontend allocates the actorid on write - this
// would make first writes a few ms faster

const log = Debug('hypermerge:front')

export type Patch = Patch

type Mode = 'pending' | 'read' | 'write'

interface Config {
  docId: DocId
  actorId?: ActorId
}

export class DocFrontend<T> {
  private docId: DocId
  private docUrl: DocUrl
  ready: boolean = false // do I need ready? -- covered my state !== pending?
  actorId?: ActorId
  history: number = 0
  //  private toBackend: Queue<ToBackendRepoMsg>
  private changeQ = new Queue<ChangeFn<T>>('repo:front:changeQ')
  private front: Doc<T>
  private mode: Mode = 'pending'
  private handles: Set<Handle<T>> = new Set()
  private repo: RepoFrontend

  clock: Clock

  constructor(repo: RepoFrontend, config: Config) {
    //super()

    const docId = config.docId
    const actorId = config.actorId
    this.repo = repo
    this.clock = {}
    this.docId = docId
    this.docUrl = toDocUrl(docId)

    //    this.toBackend = toBackend

    if (actorId) {
      this.front = Frontend.init(actorId) as Doc<T>
      this.actorId = actorId
      this.ready = true
      this.mode = 'write'
      this.enableWrites()
    } else {
      this.front = Frontend.init({ deferActorId: true }) as Doc<T>
    }
  }

  handle(): Handle<T> {
    let handle = new Handle<T>(this.repo, this.docUrl)
    this.handles.add(handle)
    handle.cleanup = () => this.handles.delete(handle)
    handle.changeFn = this.change
    if (this.ready) {
      handle.push(this.front, this.clock)
    }

    return handle
  }

  newState() {
    if (this.ready) {
      this.handles.forEach((handle) => {
        handle.push(this.front, this.clock)
      })
    }
  }

  progress(progressEvent: ProgressEvent) {
    this.handles.forEach((handle) => {
      handle.receiveProgressEvent(progressEvent)
    })
  }

  messaged(contents: any) {
    this.handles.forEach((handle) => {
      handle.receiveDocumentMessage(contents)
    })
  }

  fork = (): string => {
    return ''
  }

  change = (fn: ChangeFn<T>) => {
    log('change', this.docId)
    if (!this.actorId) {
      log('change needsActorId', this.docId)
      this.repo.toBackend.push({ type: 'NeedsActorIdMsg', id: this.docId })
    }
    this.changeQ.push(fn)
  }

  release = () => {
    // what does this do now? - FIXME
  }

  setActorId = (actorId: ActorId) => {
    log('setActorId', this.docId, actorId, this.mode)
    this.actorId = actorId
    this.front = Frontend.setActorId(this.front, actorId)

    if (this.mode === 'read') {
      this.mode = 'write'
      this.enableWrites() // has to be after the queue
    }
  }

  init = (synced: boolean, actorId?: ActorId, patch?: Patch, history?: number) => {
    log(
      `init docid=${this.docId} actorId=${actorId} patch=${!!patch} history=${history} mode=${
        this.mode
      }`
    )

    if (this.mode !== 'pending') return

    if (actorId) this.setActorId(actorId) // must set before patch

    if (patch) this.patch(patch, synced, history!) // first patch!
  }

  private enableWrites() {
    this.changeQ.subscribe((fn) => {
      const [doc, request] = Frontend.change(this.front, fn)
      this.front = doc
      log(`change complete doc=${this.docId} seq=${request ? request.seq : 'null'}`)
      if (request) {
        this.updateClockChange(request)
        this.newState()
        this.repo.toBackend.push({
          type: 'RequestMsg',
          id: this.docId,
          request,
        })
      }
    })
  }

  private updateClockChange(change: Change) {
    const oldSeq = this.clock[change.actor] || 0
    this.clock[change.actor] = Math.max(change.seq, oldSeq)
  }

  private updateClockPatch(patch: Patch) {
    this.clock = union(this.clock, patch.clock) // dont know which is better - use both??...
    this.clock = union(this.clock, patch.deps)
  }

  patch = (patch: Patch, synced: boolean, history: number) => {
    this.bench('patch', () => {
      this.history = history
      this.front = Frontend.applyPatch(this.front, patch)
      this.updateClockPatch(patch)
      if (patch.diffs.length > 0 && synced) {
        if (this.mode === 'pending') {
          this.mode = 'read'
          if (this.actorId) {
            this.mode = 'write'
            this.enableWrites()
          }
          this.ready = true
        }
        this.newState()
      }
    })
  }

  bench(msg: string, f: () => void): void {
    const start = Date.now()
    f()
    const duration = Date.now() - start
    log(`docId=${this.docId} task=${msg} time=${duration}ms`)
  }

  close() {
    this.handles.forEach((handle) => handle.close())
    this.handles.clear()
  }
}
