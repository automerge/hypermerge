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
const debug_1 = __importDefault(require("debug"));
const Backend = __importStar(require("automerge/backend"));
const Queue_1 = __importDefault(require("./Queue"));
const RepoBackend_1 = require("./RepoBackend");
const log = debug_1.default("hypermerge:back");
class DocBackend {
    constructor(core, docId, back) {
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
            this.repo.releaseManager(this);
        };
        this.initActor = () => {
            log("initActor");
            if (this.back) {
                // if we're all setup and dont have an actor - request one
                if (!this.actorId) {
                    this.actorId = this.repo.initActorFeed(this);
                }
                this.repo.toFrontend.push({ type: "ActorIdMsg", id: this.docId, actorId: this.actorId });
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
                this.subscribeToLocalChanges();
                this.subscribeToRemoteChanges();
                this.repo.toFrontend.push({ type: "ReadyMsg", id: this.docId, actorId: this.actorId, patch });
            });
        };
        this.repo = core;
        this.docId = docId;
        if (back) {
            this.back = back;
            this.actorId = docId;
            this.subscribeToRemoteChanges();
            this.subscribeToLocalChanges();
            this.repo.toFrontend.push({ type: "ReadyMsg", id: this.docId, actorId: docId });
        }
    }
    subscribeToRemoteChanges() {
        this.remoteChangesQ.subscribe(changes => {
            this.bench("applyRemoteChanges", () => {
                const [back, patch] = Backend.applyChanges(this.back, changes);
                this.back = back;
                this.repo.toFrontend.push({ type: "PatchMsg", id: this.docId, patch });
            });
        });
    }
    subscribeToLocalChanges() {
        this.localChangeQ.subscribe(change => {
            this.bench(`applyLocalChange seq=${change.seq}`, () => {
                const [back, patch] = Backend.applyLocalChange(this.back, change);
                this.back = back;
                this.repo.toFrontend.push({ type: "PatchMsg", id: this.docId, patch });
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
        peer.stream.extension(RepoBackend_1.EXT, Buffer.from(JSON.stringify(message)));
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
exports.DocBackend = DocBackend;
//# sourceMappingURL=DocBackend.js.map