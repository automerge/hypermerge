import Debug from "debug"
import * as Backend from "automerge/backend"
import { Change, BackDoc } from "automerge/backend"
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg"
import Queue from "./Queue"
import { EXT, RepoBackend } from "./RepoBackend"
import { Feed, Peer } from "./hypercore"

const log = Debug("hypermerge:back")

export interface Clock {
  [actorId: string]: number
}

export class DocBackend {
  id: string
  actorId?: string // this might be easier to have as the actor object - FIXME
  clock: Clock = {}
  private repo: RepoBackend
  private back?: BackDoc
  private localChangeQ = new Queue<Change>("backend:localChangeQ")
  private remoteChangesQ = new Queue<Change[]>("backend:remoteChangesQ")
  private wantsActor: boolean = false

  constructor(core: RepoBackend, id: string, back?: BackDoc) {
    this.repo = core
    this.id = id

    if (back) {
      this.back = back
      this.actorId = id
      this.subscribeToRemoteChanges()
      this.subscribeToLocalChanges()
      this.repo.toFrontend.push({ type: "ReadyMsg", id: this.id, actorId: id })
    }
  }

  applyRemoteChanges = (changes: Change[]): void => {
    this.remoteChangesQ.push(changes)
  }

  applyLocalChange = (change: Change): void => {
    this.localChangeQ.push(change)
  }

  release = () => {
    this.repo.releaseManager(this)
  }

  initActor = () => {
    log("initActor")
    if (this.back) {
      // if we're all setup and dont have an actor - request one
      if (!this.actorId) {
        this.actorId = this.repo.initActorFeed(this)
      }
      this.repo.toFrontend.push({ type: "ActorIdMsg", id: this.id, actorId: this.actorId})
    } else {
      // remember we want one for when init happens
      this.wantsActor = true
    }
  }

  updateClock( changes: Change[] ) {
    changes.forEach((change) => {
      const actor = change.actor
      const oldSeq = this.clock[actor] || 0
      this.clock[actor] = Math.max(oldSeq, change.seq)
    })
  }

  init = (changes: Change[], actorId?: string) => {
    this.bench("init", () => {
      const [back, patch] = Backend.applyChanges(Backend.init(), changes)
      this.actorId = actorId
      if (this.wantsActor && !actorId) {
        this.actorId = this.repo.initActorFeed(this)
      }
      this.back = back
      this.updateClock(changes)
      this.subscribeToLocalChanges()
      this.subscribeToRemoteChanges()
      this.repo.toFrontend.push({ type: "ReadyMsg", id: this.id, actorId: this.actorId, patch})
    })
  }

  subscribeToRemoteChanges() {
    this.remoteChangesQ.subscribe(changes => {
      this.bench("applyRemoteChanges", () => {
        const [back, patch] = Backend.applyChanges(this.back!, changes)
        this.back = back
        this.updateClock(changes)
        this.repo.toFrontend.push({ type: "PatchMsg", id: this.id, patch })
      })
    })
  }

  subscribeToLocalChanges() {
    this.localChangeQ.subscribe(change => {
      this.bench(`applyLocalChange seq=${change.seq}`, () => {
        const [back, patch] = Backend.applyLocalChange(this.back!, change)
        this.back = back
        this.updateClock([ change ])
        this.repo.toFrontend.push({ type: "PatchMsg", id: this.id, patch })
        this.repo.actor(this.actorId!)!.writeChange(change)
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
