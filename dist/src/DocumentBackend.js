"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const debug_1 = __importDefault(require("debug"));
const Backend = __importStar(require("automerge/backend"));
const Queue_1 = __importDefault(require("./Queue"));
const _1 = require(".");
const log = debug_1.default("hypermerge:back");
class DocumentBackend extends events_1.EventEmitter {
    constructor(core, docId, back) {
        super();
        this.toFrontend = new Queue_1.default("backend:tofrontend");
        this.localChangeQ = new Queue_1.default("backend:localChangeQ");
        this.remoteChangesQ = new Queue_1.default("backend:remoteChangesQ");
        this.wantsActor = false;
        this.applyRemoteChanges = (changes) => {
            this.remoteChangesQ.push(changes);
        };
        this.applyLocalChange = (change) => {
            this.localChangeQ.push(change);
        };
        this.actorIds = () => {
            return this.repo.actorIds(this);
        };
        this.release = () => {
            this.removeAllListeners();
            this.repo.releaseManager(this);
        };
        this.subscribe = (subscriber) => {
            this.toFrontend.subscribe(subscriber);
        };
        this.receive = (msg) => {
            log("receive", msg);
            switch (msg.type) {
                case "NeedsActorIdMsg": {
                    this.initActor();
                    break;
                }
                case "RequestMsg": {
                    this.applyLocalChange(msg.request);
                    break;
                }
            }
        };
        this.initActor = () => {
            log("initActor");
            if (this.back) {
                // if we're all setup and dont have an actor - request one
                if (!this.actorId) {
                    this.actorId = this.repo.initActorFeed(this);
                }
                //      this.emit("actorId", this.actorId)
                this.toFrontend.push({ type: "ActorIdMsg", actorId: this.actorId });
            }
            else {
                // remember we want one for when init happens
                this.wantsActor = true;
            }
        };
        this.init = (changes, actorId) => {
            this.bench("init", () => {
                const [back, patch] = Backend.applyChanges(Backend.init(), changes);
                this.actorId = actorId;
                if (this.wantsActor && !actorId) {
                    this.actorId = this.repo.initActorFeed(this);
                }
                this.back = back;
                this.subscribeToRemoteChanges();
                //      this.emit("ready", this.actorId, patch)
                this.toFrontend.push({ type: "ReadyMsg", actorId: this.actorId, patch });
                //{ type: "ReadyMsg"; actorId: string | undefined; patch: Patch; }
            });
        };
        this.repo = core;
        this.docId = docId;
        if (back) {
            this.back = back;
            this.actorId = docId;
            this.subscribeToRemoteChanges();
            this.subscribeToLocalChanges();
            //      this.emit("ready", docId, undefined)
            this.toFrontend.push({ type: "ReadyMsg", actorId: docId });
        }
        this.on("newListener", (event, listener) => {
            if (event === "patch" && this.back) {
                const patch = Backend.getPatch(this.back);
                listener(patch);
            }
        });
    }
    subscribeToRemoteChanges() {
        this.remoteChangesQ.subscribe(changes => {
            this.bench("applyRemoteChanges", () => {
                const [back, patch] = Backend.applyChanges(this.back, changes);
                this.back = back;
                //        this.emit("patch", patch)
                this.toFrontend.push({ type: "PatchMsg", patch });
            });
        });
    }
    subscribeToLocalChanges() {
        this.localChangeQ.subscribe(change => {
            this.bench(`applyLocalChange seq=${change.seq}`, () => {
                const [back, patch] = Backend.applyLocalChange(this.back, change);
                this.back = back;
                //        this.emit("patch", patch)
                this.toFrontend.push({ type: "PatchMsg", patch });
                this.repo.writeChange(this, this.actorId, change);
            });
        });
    }
    peers() {
        return this.repo.peers(this);
    }
    feeds() {
        return this.actorIds().map(actorId => this.repo.feed(actorId));
    }
    broadcast(message) {
        this.peers().forEach(peer => this.message(peer, message));
    }
    message(peer, message) {
        peer.stream.extension(_1.EXT, Buffer.from(JSON.stringify(message)));
    }
    messageMetadata(peer) {
        this.message(peer, this.metadata());
    }
    broadcastMetadata() {
        this.broadcast(this.actorIds());
    }
    metadata() {
        return this.actorIds();
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        log(`docId=${this.docId} task=${msg} time=${duration}ms`);
    }
}
exports.DocumentBackend = DocumentBackend;
//# sourceMappingURL=DocumentBackend.js.map