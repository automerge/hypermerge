"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Backend = __importStar(require("automerge/backend"));
const Queue_1 = __importDefault(require("./Queue"));
const debug_1 = __importDefault(require("debug"));
const log = debug_1.default("hypermerge:back");
class DocBackend {
    constructor(core, id, back) {
        this.clock = {};
        this.ready = new Queue_1.default("backend:ready");
        this.localChangeQ = new Queue_1.default("backend:localChangeQ");
        this.remoteChangesQ = new Queue_1.default("backend:remoteChangesQ");
        this.wantsActor = false;
        this.applyRemoteChanges = (changes) => {
            this.remoteChangesQ.push(changes);
        };
        this.applyLocalChange = (change) => {
            this.localChangeQ.push(change);
        };
        this.release = () => {
            this.repo.releaseManager(this);
        };
        this.initActor = () => {
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
            }
            else {
                // remember we want one for when init happens
                this.wantsActor = true;
            }
        };
        this.init = (changes, actorId) => {
            this.bench("init", () => {
                log(`init xxx changes=${changes.length})`);
                const [back, patch] = Backend.applyChanges(Backend.init(), changes);
                this.actorId = actorId;
                if (this.wantsActor && !actorId) {
                    this.actorId = this.repo.initActorFeed(this);
                }
                this.back = back;
                this.updateClock(changes);
                this.ready.subscribe(f => f());
                this.subscribeToLocalChanges();
                this.subscribeToRemoteChanges();
                const history = this.back.getIn(["opSet", "history"]).size;
                this.repo.toFrontend.push({
                    type: "ReadyMsg",
                    id: this.id,
                    actorId: this.actorId,
                    patch,
                    history
                });
            });
        };
        this.repo = core;
        this.id = id;
        if (back) {
            this.back = back;
            this.actorId = id;
            this.subscribeToRemoteChanges();
            this.subscribeToLocalChanges();
            const history = this.back.getIn(["opSet", "history"]).size;
            this.repo.toFrontend.push({
                type: "ReadyMsg",
                id: this.id,
                actorId: id,
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
    }
    subscribeToRemoteChanges() {
        this.remoteChangesQ.subscribe(changes => {
            this.bench("applyRemoteChanges", () => {
                log(`remote xxx changes=${changes.length})`);
                const [back, patch] = Backend.applyChanges(this.back, changes);
                this.back = back;
                this.updateClock(changes);
                const history = this.back.getIn(["opSet", "history"]).size;
                this.repo.toFrontend.push({
                    type: "PatchMsg",
                    id: this.id,
                    patch,
                    history
                });
            });
        });
    }
    subscribeToLocalChanges() {
        this.localChangeQ.subscribe(change => {
            this.bench(`applyLocalChange seq=${change.seq}`, () => {
                const [back, patch] = Backend.applyLocalChange(this.back, change);
                this.back = back;
                this.updateClock([change]);
                const history = this.back.getIn(["opSet", "history"]).size;
                this.repo.toFrontend.push({
                    type: "PatchMsg",
                    id: this.id,
                    patch,
                    history
                });
                this.repo.actor(this.actorId).writeChange(change);
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