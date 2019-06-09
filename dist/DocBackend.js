"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const automerge_1 = require("automerge");
const Queue_1 = __importDefault(require("./Queue"));
const debug_1 = __importDefault(require("debug"));
const Clock_1 = require("./Clock");
const log = debug_1.default("repo:doc:back");
function _id(id) {
    return id.slice(0, 4);
}
//export interface Clock {
//  [actorId: string]: number;
//}
class DocBackend {
    constructor(documentId, notify, back) {
        this.clock = {};
        this.changes = new Map();
        this.ready = new Queue_1.default("backend:ready");
        this.remoteClock = undefined;
        this.synced = false;
        this.localChangeQ = new Queue_1.default("backend:localChangeQ");
        this.remoteChangesQ = new Queue_1.default("backend:remoteChangesQ");
        this.testForSync = () => {
            if (this.remoteClock) {
                const test = Clock_1.cmp(this.clock, this.remoteClock);
                this.synced = (test === "GT" || test === "EQ");
                //      console.log("TARGET CLOCK", this.id, this.synced)
                //      console.log("this.clock",this.clock)
                //      console.log("this.remoteClock",this.remoteClock)
                //    } else {
                //      console.log("TARGET CLOCK NOT SET", this.id, this.synced)
            }
        };
        this.target = (clock) => {
            //    console.log("Target", clock)
            if (this.synced)
                return;
            this.remoteClock = Clock_1.union(clock, this.remoteClock || {});
            this.testForSync();
        };
        this.applyRemoteChanges = (changes) => {
            this.remoteChangesQ.push(changes);
        };
        this.applyLocalChange = (change) => {
            this.localChangeQ.push(change);
        };
        this.initActor = (actorId) => {
            log("initActor");
            if (this.back) {
                this.actorId = this.actorId || actorId;
                this.notify({
                    type: "ActorIdMsg",
                    id: this.id,
                    actorId: this.actorId
                });
            }
        };
        this.init = (changes, actorId) => {
            this.bench("init", () => {
                //console.log("CHANGES MAX",changes[changes.length - 1])
                //changes.forEach( (c,i) => console.log("CHANGES", i, c.actor, c.seq))
                const [back, patch] = automerge_1.Backend.applyChanges(automerge_1.Backend.init(), changes);
                this.actorId = this.actorId || actorId;
                this.back = back;
                this.updateClock(changes);
                this.synced = changes.length > 0; // override updateClock
                //console.log("INIT SYNCED", this.synced, changes.length)
                this.ready.subscribe(f => f());
                this.subscribeToLocalChanges();
                this.subscribeToRemoteChanges();
                const history = this.back.getIn(["opSet", "history"]).size;
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
        this.id = documentId;
        this.notify = notify;
        if (back) {
            this.back = back;
            this.actorId = documentId;
            this.ready.subscribe(f => f());
            this.synced = true;
            this.subscribeToRemoteChanges();
            this.subscribeToLocalChanges();
            const history = this.back.getIn(["opSet", "history"]).size;
            this.notify({
                type: "ReadyMsg",
                id: this.id,
                synced: this.synced,
                actorId: documentId,
                history
            });
        }
    }
    updateClock(changes) {
        changes.forEach(change => {
            const actor = change.actor;
            const oldSeq = this.clock[actor] || 0;
            this.clock[actor] = Math.max(oldSeq, change.seq);
        });
        if (!this.synced)
            this.testForSync();
    }
    subscribeToRemoteChanges() {
        this.remoteChangesQ.subscribe(changes => {
            this.bench("applyRemoteChanges", () => {
                const [back, patch] = automerge_1.Backend.applyChanges(this.back, changes);
                this.back = back;
                this.updateClock(changes);
                const history = this.back.getIn(["opSet", "history"]).size;
                this.notify({
                    type: "RemotePatchMsg",
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
                const [back, patch] = automerge_1.Backend.applyLocalChange(this.back, change);
                this.back = back;
                this.updateClock([change]);
                const history = this.back.getIn(["opSet", "history"]).size;
                this.notify({
                    type: "LocalPatchMsg",
                    id: this.id,
                    actorId: this.actorId,
                    synced: this.synced,
                    change: change,
                    patch,
                    history
                });
            });
        });
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        log(`id=${this.id} task=${msg} time=${duration}ms`);
    }
}
exports.DocBackend = DocBackend;
//# sourceMappingURL=DocBackend.js.map