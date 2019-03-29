/**
 * TODO: Confirm behavior change in `initActor` and `init` for the `wantsActor` behavior
 * doesn't have any bugs/issues.
 */
import * as Backend from "automerge/backend";
import { Change, BackDoc } from "automerge/backend";
import * as Frontend from "automerge/frontend"
import Queue from "./Queue";
import Debug from "debug";
import { Clock, cmp, union } from "./Clock";
import * as Actor from "./Actor"

const log = Debug("repo:doc:back");

function _id(id: string) : string {
  return id.slice(0,4)
}

//export interface Clock {
//  [actorId: string]: number;
//}

export type Message
  = Ready
  | ActorId
  | Patch

interface Ready {
  type: "Ready"
  id: string
  synced: boolean
  actorId?: string
  history?: number
  patch?: Frontend.Patch
}

interface ActorId {
  type: "ActorId"
  id: string
  actorId: string
}

interface Patch {
  type: "Patch"
  id: string
  synced: boolean
  patch: Frontend.Patch
  history: number
}


export class DocBackend {
  id: string;
  actor?: Actor.Actor;
  clock: Clock = {};
  back?: BackDoc; // can we make this private?
  changes: Map<string, number> = new Map()
  ready = new Queue<Function>("backend:ready");
  private notify: (message: Message) => void
  private remoteClock?: Clock = undefined;
  private synced : boolean = false
  private localChangeQ = new Queue<Change>("backend:localChangeQ");
  private remoteChangesQ = new Queue<Change[]>("backend:remoteChangesQ");

  constructor(id: string, notify: (message: Message) => void, back?: BackDoc, actor?: Actor.Actor) {
    this.id = id;
    this.notify = notify

    if (back) {
      this.back = back;
      this.actor = actor
      this.ready.subscribe(f => f());
      this.synced = true
      this.subscribeToRemoteChanges();
      this.subscribeToLocalChanges();
      this.notify({
        type: "Ready",
        id: this.id,
        synced: this.synced,
        actorId: this.actor ? this.actor.id : undefined,
        history: this.history
      })
    }
  }

  get history(): number {
    return (this.back as any).getIn(["opSet", "history"]).size;
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

  initActor = (actor: Actor.Actor) => {
    if (!this.actor) {
      this.actor = actor
    }
    if (this.back) {
      this.notify({
        type: "ActorId",
        id: this.id,
        actorId: this.actor.id
      })
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

  init = (changes: Change[], actor?: Actor.Actor) => {
    this.bench("init", () => {
      const [back, patch] = Backend.applyChanges(Backend.init(), changes);
      this.actor = this.actor || actor;
      this.back = back;
      this.updateClock(changes);
      this.synced = changes.length > 0 // override updateClock
      this.ready.subscribe(f => f());
      this.subscribeToLocalChanges();
      this.subscribeToRemoteChanges();
      this.notify({
        type: "Ready",
        id: this.id,
        synced: this.synced,
        actorId: this.actor ? this.actor.id : undefined,
        patch,
        history: this.history
      });
    });
  };

  subscribeToRemoteChanges() {
    this.remoteChangesQ.subscribe(changes => {
      this.bench("applyRemoteChanges", () => {
        const [back, patch] = Backend.applyChanges(this.back!, changes);
        this.back = back;
        this.updateClock(changes);
        this.notify({
          type: "Patch",
          id: this.id,
          synced: this.synced,
          patch,
          history: this.history
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
        this.notify({
          type: "Patch",
          id: this.id,
          synced: this.synced,
          patch,
          history: this.history
        });
        // TODO: move this write out of DocBackend
        this.actor!.writeChange(change)
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
