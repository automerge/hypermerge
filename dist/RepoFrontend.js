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
const Queue_1 = __importDefault(require("./Queue"));
const Base58 = __importStar(require("bs58"));
const MapSet_1 = __importDefault(require("./MapSet"));
const crypto = __importStar(require("hypercore/lib/crypto"));
const Frontend = __importStar(require("automerge/frontend"));
const DocFrontend_1 = require("./DocFrontend");
const Clock_1 = require("./Clock");
const debug_1 = __importDefault(require("debug"));
const Metadata_1 = require("./Metadata");
debug_1.default.formatters.b = Base58.encode;
const log = debug_1.default("repo:front");
let msgid = 1;
class RepoFrontend {
    constructor() {
        this.toBackend = new Queue_1.default("repo:tobackend");
        this.docs = new Map();
        this.msgcb = new Map();
        this.readFiles = new MapSet_1.default();
        this.create = (init) => {
            const keys = crypto.keyPair();
            const publicKey = Base58.encode(keys.publicKey);
            const secretKey = Base58.encode(keys.secretKey);
            const docId = publicKey;
            const actorId = publicKey;
            const doc = new DocFrontend_1.DocFrontend(this, { actorId, docId });
            this.docs.set(docId, doc);
            this.toBackend.push({ type: "CreateMsg", publicKey, secretKey });
            if (init) {
                doc.change(state => {
                    for (let key in init) {
                        state[key] = init[key];
                    }
                });
            }
            return publicKey;
        };
        this.change = (id, fn) => {
            this.open(id).change(fn);
        };
        this.meta = (id) => {
            Metadata_1.validateID(id);
            const doc = this.docs.get(id);
            console.log("META FOR ", id);
            if (!doc)
                return;
            console.log("DOC.H", doc.history);
            return {
                actor: doc.actorId,
                history: doc.history,
                clock: doc.clock
            };
        };
        this.merge = (id, target) => {
            this.doc(target, (doc, clock) => {
                const actors = Clock_1.clock2strs(clock);
                this.toBackend.push({ type: "MergeMsg", id, actors });
            });
        };
        this.writeFile = (data) => {
            const keys = crypto.keyPair();
            const publicKey = Base58.encode(keys.publicKey);
            const secretKey = Base58.encode(keys.secretKey);
            this.toBackend.push(data);
            this.toBackend.push({ type: "WriteFile", publicKey, secretKey });
            return publicKey;
        };
        this.readFile = (id, cb) => {
            Metadata_1.validateID(id);
            this.readFiles.add(id, cb);
            this.toBackend.push({ type: "ReadFile", id });
        };
        this.fork = (id) => {
            const fork = this.create();
            this.merge(fork, id);
            return fork;
        };
        this.follow = (id, target) => {
            Metadata_1.validateID(id);
            this.toBackend.push({ type: "FollowMsg", id, target });
        };
        this.watch = (id, cb) => {
            const handle = this.open(id);
            handle.subscribe(cb);
            return handle;
        };
        this.doc = (id, cb) => {
            Metadata_1.validateID(id);
            return new Promise(resolve => {
                const handle = this.open(id);
                handle.subscribe((val, clock) => {
                    resolve(val);
                    if (cb)
                        cb(val, clock);
                    handle.close();
                });
            });
        };
        this.materialize = (id, history, cb) => {
            Metadata_1.validateID(id);
            const doc = this.docs.get(id);
            if (doc === undefined) {
                throw new Error(`No such document ${id}`);
            }
            if (history < 0 && history >= doc.history) {
                throw new Error(`Invalid history ${history} for id ${id}`);
            }
            msgid += 1; // global counter
            this.msgcb.set(msgid, (patch) => {
                const doc = Frontend.init({ deferActorId: true });
                cb(Frontend.applyPatch(doc, patch));
            });
            this.toBackend.push({ type: "MaterializeMsg", history, id, msgid });
        };
        this.open = (id) => {
            Metadata_1.validateID(id);
            const doc = this.docs.get(id) || this.openDocFrontend(id);
            return doc.handle();
        };
        this.subscribe = (subscriber) => {
            this.toBackend.subscribe(subscriber);
        };
        this.receive = (msg) => {
            if (msg instanceof Uint8Array) {
                this.file = msg;
            }
            else {
                switch (msg.type) {
                    case "ReadFileReply": {
                        const doc = this.docs.get(msg.id);
                        this.readFiles.get(msg.id).forEach(cb => cb(this.file));
                        this.readFiles.delete(msg.id);
                        delete this.file;
                        break;
                    }
                    case "PatchMsg": {
                        const doc = this.docs.get(msg.id);
                        doc.patch(msg.patch, msg.history);
                        break;
                    }
                    case "MaterializeReplyMsg": {
                        const cb = this.msgcb.get(msg.msgid);
                        cb(msg.patch);
                        break;
                    }
                    case "ActorIdMsg": {
                        const doc = this.docs.get(msg.id);
                        doc.setActorId(msg.actorId);
                        break;
                    }
                    case "ReadyMsg": {
                        const doc = this.docs.get(msg.id);
                        doc.init(msg.actorId, msg.patch, msg.history);
                        break;
                    }
                }
            }
        };
    }
    debug(id) {
        Metadata_1.validateID(id);
        const doc = this.docs.get(id);
        const short = id.substr(0, 5);
        if (doc === undefined) {
            console.log(`doc:frontend undefined doc=${short}`);
        }
        else {
            console.log(`doc:frontend id=${short}`);
            console.log(`doc:frontend clock=${Clock_1.clockDebug(doc.clock)}`);
        }
        this.toBackend.push({ type: "DebugMsg", id });
    }
    openDocFrontend(id) {
        const doc = new DocFrontend_1.DocFrontend(this, { docId: id });
        this.toBackend.push({ type: "OpenMsg", id });
        this.docs.set(id, doc);
        return doc;
    }
}
exports.RepoFrontend = RepoFrontend;
//# sourceMappingURL=RepoFrontend.js.map