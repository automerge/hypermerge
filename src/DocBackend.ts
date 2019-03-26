import * as Backend from "automerge/backend";
import { Change, BackDoc } from "automerge/backend";
import Queue from "./Queue";
import { RepoBackend } from "./RepoBackend";
import Debug from "debug";
import { Clock, cmp, union } from "./Clock";

const log = Debug("repo:doc:back");

function _id(id: string) : string {
  return id.slice(0,4)
}

export class DocBackend {
  id: string;
  actorId?: string; // this might be easier to have as the actor object - FIXME
  clock: Clock = {};
  back?: BackDoc; // can we make this private?
  changes: Map<string, number> = new Map()
  ready = new Queue<Function>("backend:ready");
  private repo: RepoBackend;
  private remoteClock?: Clock = undefined;
  private synced : boolean = false
  private localChangeQ = new Queue<Change>("backend:localChangeQ");
  private remoteChangesQ = new Queue<Change[]>("backend:remoteChangesQ");
  private wantsActor: boolean = false;

  constructor(core: RepoBackend, id: string, back?: BackDoc) {
    this.repo = core;
    this.id = id;

    if (back) {
      this.back = back;
      this.actorId = id;
      this.ready.subscribe(f => f());
      this.synced = true
      this.subscribeToRemoteChanges();
      this.subscribeToLocalChanges();
      const history = (this.back as any).getIn(["opSet", "history"]).size;
      this.repo.toFrontend.push({
        type: "ReadyMsg",
        id: this.id,
        synced: this.synced,
        actorId: id,
        history
      });
    }
  }

  testForSync = () : void => {
    if (this.remoteClock) {
      const test = cmp(this.clock, this.remoteClock)
      this.synced = (test === "GT" || test === "EQ")
    }
  }

  target = (clock: Clock): void => {
    if (this.synced) return
    this.remoteClock = union(clock, this.remoteClock || {})
    this.testForSync()
  }

  applyRemoteChanges = (changes: Change[]): void => {
    this.remoteChangesQ.push(changes);
  };

  applyLocalChange = (change: Change): void => {
    this.localChangeQ.push(change);
  };

  release = () => {
    this.repo.releaseManager(this);
  };

  initActor = () => {
    log("initActor");
    if (this.back) {
      // if we're all setup and dont have an actor - request one
      if (!this.actorId) {
        this.actorId = this.repo.initActorFeed(this);
      }
      this.repo.toFrontend.push({
        type: "ActorIdMsg",
        id: this.id,
        actorId: this.actorId
      });
    } else {
      // remember we want one for when init happens
      this.wantsActor = true;
    }
  };

  updateClock(changes: Change[]) {
    changes.forEach(change => {
      const actor = change.actor;
      const oldSeq = this.clock[actor] || 0;
      this.clock[actor] = Math.max(oldSeq, change.seq);
    });
    if (!this.synced) this.testForSync();
  }

  init = (changes: Change[], actorId?: string) => {
    this.bench("init", () => {
      const [back, patch] = Backend.applyChanges(Backend.init(), changes);
      this.actorId = actorId;
      if (this.wantsActor && !actorId) {
        this.actorId = this.repo.initActorFeed(this);
      }
      this.back = back;
      this.updateClock(changes);
      this.synced = changes.length > 0 // override updateClock
      this.ready.subscribe(f => f());
      this.subscribeToLocalChanges();
      this.subscribeToRemoteChanges();
      const history = (this.back as any).getIn(["opSet", "history"]).size;
      this.repo.toFrontend.push({
        type: "ReadyMsg",
        id: this.id,
        synced: this.synced,
        actorId: this.actorId,
        patch,
        history
      });
    });
  };

  subscribeToRemoteChanges() {
    this.remoteChangesQ.subscribe(changes => {
      this.bench("applyRemoteChanges", () => {
        const [back, patch] = Backend.applyChanges(this.back!, changes);
        this.back = back;
        this.updateClock(changes);
        const history = (this.back as any).getIn(["opSet", "history"]).size;
        this.repo.toFrontend.push({
          type: "PatchMsg",
          id: this.id,
          synced: this.synced,
          patch,
          history
        });
      });
    });
  }

  subscribeToLocalChanges() {
    this.localChangeQ.subscribe(change => {
      this.bench(`applyLocalChange seq=${change.seq}`, () => {
        const [back, patch] = Backend.applyLocalChange(this.back!, change);
        this.back = back;
        this.updateClock([change]);
        const history = (this.back as any).getIn(["opSet", "history"]).size;
        this.repo.toFrontend.push({
          type: "PatchMsg",
          id: this.id,
          synced: this.synced,
          patch,
          history
        });
        this.repo.actor(this.actorId!)!.writeChange(change);
      });
    });
  }

  private bench(msg: string, f: () => void): void {
    const start = Date.now();
    f();
    const duration = Date.now() - start;
    log(`id=${this.id} task=${msg} time=${duration}ms`);
  }
}
