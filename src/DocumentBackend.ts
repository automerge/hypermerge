import { EventEmitter } from "events"
import Debug from "debug"
import * as Backend from "automerge/backend"
import { Change, BackDoc } from "automerge/backend"
import { ToBackendMsg, ToFrontendMsg } from "./DocumentMsg"
import Queue from "./Queue"
import { Peer, Feed, EXT, Repo } from "."

const log = Debug("hypermerge:back")

export class DocumentBackend extends EventEmitter {
  docId: string
  actorId?: string
  private repo: Repo
  private back?: BackDoc
  private toFrontend = new Queue<ToFrontendMsg>("backend:tofrontend")
  private localChangeQ = new Queue<Change>("backend:localChangeQ")
  private remoteChangesQ = new Queue<Change[]>("backend:remoteChangesQ")
  private wantsActor: boolean = false

  constructor(core: Repo, docId: string, back?: BackDoc) {
    super()

    this.repo = core
    this.docId = docId

    if (back) {
      this.back = back
      this.actorId = docId
      this.subscribeToRemoteChanges()
      this.subscribeToLocalChanges()
//      this.emit("ready", docId, undefined)
      this.toFrontend.push({ type: "ReadyMsg", actorId: docId })
    }

    this.on("newListener", (event, listener) => {
      if (event === "patch" && this.back) {
        const patch = Backend.getPatch(this.back)
        listener(patch)
      }
    })
  }

  applyRemoteChanges = (changes: Change[]): void => {
    this.remoteChangesQ.push(changes)
  }

  applyLocalChange = (change: Change): void => {
    this.localChangeQ.push(change)
  }

  actorIds = (): string[] => {
    return this.repo.actorIds(this)
  }

  release = () => {
    this.removeAllListeners()
    this.repo.releaseManager(this)
  }

  subscribe = (subscriber: (msg: ToFrontendMsg) => void) => {
    this.toFrontend.subscribe(subscriber)
  }

  receive = (msg: ToBackendMsg) => {
    log("receive", msg)
    switch (msg.type) {
      case "NeedsActorIdMsg": {
        this.initActor()
        break
      }
      case "RequestMsg": {
        this.applyLocalChange(msg.request)
        break
      }
    }
  }

  initActor = () => {
    log("initActor")
    if (this.back) {
      // if we're all setup and dont have an actor - request one
      if (!this.actorId) {
        this.actorId = this.repo.initActorFeed(this)
      }
//      this.emit("actorId", this.actorId)
      this.toFrontend.push({ type: "ActorIdMsg", actorId: this.actorId})
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
        this.actorId = this.repo.initActorFeed(this)
      }
      this.back = back
      this.subscribeToRemoteChanges()
//      this.emit("ready", this.actorId, patch)
      this.toFrontend.push({ type: "ReadyMsg", actorId: this.actorId, patch})
//{ type: "ReadyMsg"; actorId: string | undefined; patch: Patch; }
    })
  }

  subscribeToRemoteChanges() {
    this.remoteChangesQ.subscribe(changes => {
      this.bench("applyRemoteChanges", () => {
        const [back, patch] = Backend.applyChanges(this.back!, changes)
        this.back = back
//        this.emit("patch", patch)
        this.toFrontend.push({ type: "PatchMsg", patch })
      })
    })
  }

  subscribeToLocalChanges() {
    this.localChangeQ.subscribe(change => {
      this.bench(`applyLocalChange seq=${change.seq}`, () => {
        const [back, patch] = Backend.applyLocalChange(this.back!, change)
        this.back = back
//        this.emit("patch", patch)
        this.toFrontend.push({ type: "PatchMsg", patch })
        this.repo.writeChange(this, this.actorId!, change)
      })
    })
  }

  peers(): Peer[] {
    return this.repo.peers(this)
  }

  feeds(): Feed<Uint8Array>[] {
    return this.actorIds().map(actorId => this.repo.feed(actorId))
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
