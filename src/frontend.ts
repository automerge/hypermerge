import { EventEmitter } from "events"
import { Patch, Doc, ChangeFn } from "automerge/frontend"
import * as Frontend from "automerge/frontend"
import Queue from "./Queue"
import Handle from "./handle"
import Debug from "debug"

// TODO - i bet this can be rewritten where the Frontend allocates the actorid on write - this
// would make first writes a few ms faster

const log = Debug("hypermerge:front")

export type Patch = Patch

type Mode = "pending" | "read" | "write"

export class FrontendManager<T> extends EventEmitter {
  docId: string
  actorId?: string
  back?: any // place to put the backend if need be - not needed here int he code so didnt want to import
  private changeQ: Queue<ChangeFn<T>> = new Queue("frontend:change")
  private front: Doc<T>
  private mode: Mode = "pending"

  constructor(docId: string, actorId?: string) {
    super()

    if (actorId) {
      this.front = Frontend.init(actorId) as Doc<T>
      this.docId = docId
      this.actorId = actorId
      this.enableWrites()
    } else {
      this.front = Frontend.init({ deferActorId: true }) as Doc<T>
      this.docId = docId
    }

    this.on("newListener", (event, listener) => {
      if (event === "doc" && this.mode != "pending") {
        listener(this.front)
      }
    })
  }

  handle(): Handle<T> {
    let handle = new Handle<T>()
    handle.cleanup = () => {
      this.removeListener("doc", handle.push)
    }
    handle.change = this.change
    this.on("doc", handle.push)
    return handle
  }

  change = (fn: ChangeFn<T>) => {
    log("change", this.docId)
    if (!this.actorId) {
      log("change needsActorId", this.docId)
      this.emit("needsActorId")
    }
    this.changeQ.push(fn)
  }

  release = () => {
    this.removeAllListeners()
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
        this.emit("doc", this.front)
        this.emit("request", request)
      }
    })
  }

  patch = (patch: Patch) => {
    this.bench("patch", () => {
      this.front = Frontend.applyPatch(this.front, patch)
      if (patch.diffs.length > 0) {
        if (this.mode === "pending") this.mode = "read"
        this.emit("doc", this.front)
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
