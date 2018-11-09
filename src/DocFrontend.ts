import { Patch, Doc, ChangeFn } from "automerge/frontend"
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg"
import * as Frontend from "automerge/frontend"
import Queue from "./Queue"
import Handle from "./Handle"
import Debug from "debug"

// TODO - i bet this can be rewritten where the Frontend allocates the actorid on write - this
// would make first writes a few ms faster

const log = Debug("hypermerge:front")

export type Patch = Patch

type Mode = "pending" | "read" | "write"

interface Config {
  docId: string
  actorId?: string
}

export class DocFrontend<T> {
  docId: string
  actorId?: string
  toBackend: Queue<ToBackendRepoMsg>
  private changeQ = new Queue<ChangeFn<T>>("frontend:change")
  private front: Doc<T>
  private mode: Mode = "pending"
  private handles: Set<Handle<T>> = new Set()

  constructor(toBackend: Queue<ToBackendRepoMsg>, config: Config) {
    //super()

    const docId = config.docId
    const actorId = config.actorId
    this.toBackend = toBackend

    if (actorId) {
      this.front = Frontend.init(actorId) as Doc<T>
      this.docId = docId
      this.actorId = actorId
      this.enableWrites()
    } else {
      this.front = Frontend.init({ deferActorId: true }) as Doc<T>
      this.docId = docId
    }
  }

  handle(): Handle<T> {
    let handle = new Handle<T>()
    this.handles.add(handle)
    handle.cleanup = () => this.handles.delete(handle)
    handle.changeFn = this.change
    handle.id = this.docId
    if (this.mode != "pending") { handle.push(this.front) }

    return handle
  }

  newState() {
    this.handles.forEach(handle => handle.push(this.front))
  }

  change = (fn: ChangeFn<T>) => {
    log("change", this.docId)
    if (!this.actorId) {
      log("change needsActorId", this.docId)
      this.toBackend.push({ type: "NeedsActorIdMsg", id: this.docId })
    }
    this.changeQ.push(fn)
  }

  release = () => {
    // what does this do now? - FIXME
  }

  setActorId = (actorId: string) => {
    log("setActorId", this.docId, actorId, this.mode)
    this.actorId = actorId
    this.front = Frontend.setActorId(this.front, actorId)

    if (this.mode === "read") this.enableWrites() // has to be after the queue
  }

  init = (actorId?: string, patch?: Patch) => {
    log(
      `init docid=${this.docId} actorId=${actorId} patch=${!!patch} mode=${
      this.mode
      }`,
    )

    if (this.mode !== "pending") return

    if (actorId) this.setActorId(actorId) // must set before patch

    if (patch) this.patch(patch) // first patch!

    if (actorId) this.enableWrites() // must enable after patch
  }

  private enableWrites() {
    this.mode = "write"
    this.changeQ.subscribe(fn => {
      const doc = Frontend.change(this.front, fn)
      const request = Frontend.getRequests(doc).pop()
      this.front = doc
      log(`change complete doc=${this.docId} seq=${request ? request.seq : "null"}`)
      if (request) {
        this.newState()
        this.toBackend.push({ type: "RequestMsg", id: this.docId, request })
      }
    })
  }

  patch = (patch: Patch) => {
    this.bench("patch", () => {
      this.front = Frontend.applyPatch(this.front, patch)
      if (patch.diffs.length > 0) {
        if (this.mode === "pending") this.mode = "read"
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
}
