import { EventEmitter } from "events"
import Debug from "debug"
import * as Backend from "automerge/backend"
import { Change, BackDoc } from "automerge/backend"
import Queue from "./Queue"
import { Peer, Feed, EXT, Hypermerge } from "."

const log = Debug("hypermerge:back")

export class BackendManager extends EventEmitter {
  docId: string
  actorId?: string
  private hypermerge: Hypermerge
  private back?: BackDoc
  private backLocalQ: Queue<() => void> = new Queue("backLocalQ")
  private backRemoteQ: Queue<() => void> = new Queue("backRemoteQ")
  private wantsActor: boolean = false

  constructor(core: Hypermerge, docId: string, back?: BackDoc) {
    super()

    this.hypermerge = core
    this.docId = docId

    if (back) {
      this.back = back
      this.actorId = docId
      this.backLocalQ.subscribe(f => f())
      this.backRemoteQ.subscribe(f => f())
      this.emit("ready", docId, undefined)
    }

    this.on("newListener", (event, listener) => {
      if (event === "patch" && this.back) {
        const patch = Backend.getPatch(this.back)
        listener(patch)
      }
    })
  }

  applyRemoteChanges = (changes: Change[]): void => {
    this.backRemoteQ.push(() => {
      this.bench("applyRemoteChanges", () => {
        const [back, patch] = Backend.applyChanges(this.back!, changes)
        this.back = back
        this.emit("patch", patch)
      })
    })
  }

  applyLocalChange = (change: Change): void => {
    this.backLocalQ.push(() => {
      this.bench(`applyLocalChange seq=${change.seq}`, () => {
        const [back, patch] = Backend.applyLocalChange(this.back!, change)
        this.back = back
        this.emit("patch", patch)
        this.hypermerge.writeChange(this, this.actorId!, change)
      })
    })
  }

  actorIds = (): string[] => {
    return this.hypermerge.docMetadata.get(this.docId) || []
  }

  release = () => {
    this.removeAllListeners()
    this.hypermerge.releaseHandle(this)
  }

  initActor = () => {
    log("initActor")
    if (this.back) {
      // if we're all setup and dont have an actor - request one
      if (!this.actorId) {
        this.actorId = this.hypermerge.initActorFeed(this)
      }
      this.emit("actorId", this.actorId)
    } else {
      // remember we want one for when init happens
      this.wantsActor = true
    }
  }

  init = (changes: Change[], actorId?: string) => {
    this.bench("init", () => {
      const [back, patch] = Backend.applyChanges(Backend.init(), changes)
      this.actorId = actorId
      if (this.wantsActor && !actorId) {
        this.actorId = this.hypermerge.initActorFeed(this)
      }
      this.back = back
      this.backLocalQ.subscribe(f => f())
      this.backRemoteQ.subscribe(f => f())
      this.emit("ready", this.actorId, patch)
    })
  }

  peers(): Peer[] {
    return this.hypermerge.peers(this)
  }

  feeds(): Feed<Uint8Array>[] {
    return this.actorIds().map(actorId => this.hypermerge.feed(actorId))
  }

  broadcast(message: any) {
    this.peers().forEach(peer => this.message(peer, message))
  }

  message(peer: Peer, message: any) {
    peer.stream.extension(EXT, Buffer.from(JSON.stringify(message)))
  }

  messageMetadata(peer: Peer) {
    this.message(peer, this.metadata())
  }

  broadcastMetadata() {
    this.broadcast(this.actorIds())
  }

  metadata(): string[] {
    return this.actorIds()
  }

  private bench(msg: string, f: () => void): void {
    const start = Date.now()
    f()
    const duration = Date.now() - start
    log(`docId=${this.docId} task=${msg} time=${duration}ms`)
  }
}
