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
class BackendManager extends events_1.EventEmitter {
    constructor(core, docId, back) {
        super();
        this.backLocalQ = new Queue_1.default("backLocalQ");
        this.backRemoteQ = new Queue_1.default("backRemoteQ");
        this.wantsActor = false;
        this.applyRemoteChanges = (changes) => {
            this.backRemoteQ.push(() => {
                this.bench("applyRemoteChanges", () => {
                    const [back, patch] = Backend.applyChanges(this.back, changes);
                    this.back = back;
                    this.emit("patch", patch);
                });
            });
        };
        this.applyLocalChange = (change) => {
            this.backLocalQ.push(() => {
                this.bench(`applyLocalChange seq=${change.seq}`, () => {
                    const [back, patch] = Backend.applyLocalChange(this.back, change);
                    this.back = back;
                    this.emit("patch", patch);
                    this.hypermerge.writeChange(this, this.actorId, change);
                });
            });
        };
        this.actorIds = () => {
            return this.hypermerge.docMetadata.get(this.docId) || [];
        };
        this.release = () => {
            this.removeAllListeners();
            this.hypermerge.releaseHandle(this);
        };
        this.initActor = () => {
            log("initActor");
            if (this.back) {
                // if we're all setup and dont have an actor - request one
                if (!this.actorId) {
                    this.actorId = this.hypermerge.initActorFeed(this);
                }
                this.emit("actorId", this.actorId);
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
                    this.actorId = this.hypermerge.initActorFeed(this);
                }
                this.back = back;
                this.backLocalQ.subscribe(f => f());
                this.backRemoteQ.subscribe(f => f());
                this.emit("ready", this.actorId, patch);
            });
        };
        this.hypermerge = core;
        this.docId = docId;
        if (back) {
            this.back = back;
            this.actorId = docId;
            this.backLocalQ.subscribe(f => f());
            this.backRemoteQ.subscribe(f => f());
            this.emit("ready", docId, undefined);
        }
        this.on("newListener", (event, listener) => {
            if (event === "patch" && this.back) {
                const patch = Backend.getPatch(this.back);
                listener(patch);
            }
        });
    }
    peers() {
        return this.hypermerge.peers(this);
    }
    feeds() {
        return this.actorIds().map(actorId => this.hypermerge.feed(actorId));
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
exports.BackendManager = BackendManager;
//# sourceMappingURL=backend.js.map