import * as Backend from "automerge/backend";
import { Change, BackDoc } from "automerge/backend";
import * as Frontend from "automerge/frontend"
import Queue from "./Queue";
import { RepoBackend } from "./RepoBackend";
import Debug from "debug";
import { Clock, cmp, union } from "./Clock";

const log = Debug("repo:doc:back");

function _id(id: string) : string {
  return id.slice(0,4)
}

export type DocBackendMessage
  = ReadyMsg
  | ActorIdMsg
  | PatchMsg

interface ReadyMsg {
  type: "ReadyMsg"
  id: string
  synced: boolean
  actorId?: string
  history?: number
  patch?: Frontend.Patch
}

interface ActorIdMsg {
  type: "ActorIdMsg"
  id: string
  actorId: string
}

interface PatchMsg {
  type: "PatchMsg"
  id: string
  synced: boolean
  patch: Frontend.Patch
  history: number
}

//export interface Clock {
//  [actorId: string]: number;
//}

export class DocBackend {
  id: string;
  actorId?: string; // this might be easier to have as the actor object - FIXME
  clock: Clock = {};
  back?: BackDoc; // can we make this private?
  changes: Map<string, number> = new Map()
  ready = new Queue<Function>("backend:ready");
  private notify: (msg: DocBackendMessage) => void
  private repo: RepoBackend;
  private remoteClock?: Clock = undefined;
  private synced : boolean = false
  private localChangeQ = new Queue<Change>("backend:localChangeQ");
  private remoteChangesQ = new Queue<Change[]>("backend:remoteChangesQ");
  private wantsActor: boolean = false;

  constructor(core: RepoBackend, id: string, notify: (msg: DocBackendMessage) => void, back?: BackDoc) {
    this.repo = core;
    this.id = id;
    this.notify = notify

    if (back) {
      this.back = back;
      this.actorId = id;
      this.ready.subscribe(f => f());
      this.synced = true
      this.subscribeToRemoteChanges();
      this.subscribeToLocalChanges();
      const history = (this.back as any).getIn(["opSet", "history"]).size;
      this.notify({
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
//      console.log("TARGET CLOCK", this.id, this.synced)
//      console.log("this.clock",this.clock)
//      console.log("this.remoteClock",this.remoteClock)
//    } else {
//      console.log("TARGET CLOCK NOT SET", this.id, this.synced)
    }
  }

  target = (clock: Clock): void => {
//    console.log("Target", clock)
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

  initActor = () => {
    log("initActor");
    if (this.back) {
      // if we're all setup and dont have an actor - request one
      if (!this.actorId) {
        this.actorId = this.repo.initActorFeed(this);
      }
      this.notify({
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
      //console.log("CHANGES MAX",changes[changes.length - 1])
      //changes.forEach( (c,i) => console.log("CHANGES", i, c.actor, c.seq))
      const [back, patch] = Backend.applyChanges(Backend.init(), changes);
      this.actorId = actorId;
      if (this.wantsActor && !actorId) {
        this.actorId = this.repo.initActorFeed(this);
      }
      this.back = back;
      this.updateClock(changes);
      this.synced = changes.length > 0 // override updateClock
      //console.log("INIT SYNCED", this.synced, changes.length)
      this.ready.subscribe(f => f());
      this.subscribeToLocalChanges();
      this.subscribeToRemoteChanges();
      const history = (this.back as any).getIn(["opSet", "history"]).size;
      this.notify({
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
        this.notify({
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
        this.notify({
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
