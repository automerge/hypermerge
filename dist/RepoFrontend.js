"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RepoFrontend = void 0;
const Queue_1 = __importDefault(require("./Queue"));
const MapSet_1 = __importDefault(require("./MapSet"));
const cambriamerge_1 = require("cambriamerge");
const DocFrontend_1 = require("./DocFrontend");
const Clock_1 = require("./Clock");
const Keys = __importStar(require("./Keys"));
const Metadata_1 = require("./Metadata");
const Misc_1 = require("./Misc");
const FileServerClient_1 = __importDefault(require("./FileServerClient"));
const CryptoClient_1 = require("./CryptoClient");
const Crawler_1 = require("./Crawler");
let msgid = 1;
class RepoFrontend {
    constructor() {
        this.toBackend = new Queue_1.default('repo:front:toBackendQ');
        this.docs = new Map();
        this.cb = new Map();
        this.msgcb = new Map();
        this.readFiles = new MapSet_1.default();
        this.files = new FileServerClient_1.default();
        this.create = (init, schema) => {
            const { publicKey, secretKey } = Keys.create();
            const docId = publicKey;
            const actorId = Misc_1.rootActorId(docId);
            const doc = new DocFrontend_1.DocFrontend(this, { actorId, docId, schema });
            this.docs.set(docId, doc);
            this.toBackend.push({ type: 'CreateMsg', publicKey, secretKey: secretKey, schema });
            if (init) {
                doc.change((state) => {
                    Object.assign(state, init);
                });
            }
            return Misc_1.toDocUrl(docId);
        };
        this.change = (url, fn, schema) => {
            this.open(url, true, schema).change(fn);
        };
        this.meta = (url, cb) => {
            const { id } = Metadata_1.validateURL(url);
            this.queryBackend({ type: 'MetadataMsg', id: id }, (msg) => {
                const meta = msg.metadata;
                if (meta) {
                    const doc = this.docs.get(id);
                    if (doc && meta.type === 'Document') {
                        meta.actor = doc.actorId;
                        meta.history = doc.history;
                        meta.clock = doc.clock;
                    }
                }
                cb(meta || undefined); // TODO: change this to null
            });
        };
        this.meta2 = (url) => {
            const { id } = Metadata_1.validateURL(url);
            const doc = this.docs.get(id);
            if (!doc)
                return;
            return {
                actor: doc.actorId,
                history: doc.history,
                clock: doc.clock,
            };
        };
        this.merge = (url, target, schema) => {
            const id = Metadata_1.validateDocURL(url);
            Metadata_1.validateDocURL(target);
            this.doc(target, (_doc, clock) => {
                const actors = Clock_1.clock2strs(clock);
                this.toBackend.push({ type: 'MergeMsg', id, actors });
            }, schema);
        };
        this.fork = (url, schema) => {
            Metadata_1.validateDocURL(url);
            const fork = this.create(schema);
            this.merge(fork, url, schema);
            return fork;
        };
        /*
        follow = (url: string, target: string) => {
          const id = validateDocURL(url);
          this.toBackend.push({ type: "FollowMsg", id, target });
        };
      */
        this.watch = (url, cb, schema) => {
            Metadata_1.validateDocURL(url);
            const handle = this.open(url, true, schema);
            handle.subscribe(cb);
            return handle;
        };
        this.message = (url, contents) => {
            const id = Metadata_1.validateDocURL(url);
            this.toBackend.push({ type: 'DocumentMessage', id, contents });
        };
        this.doc = (url, cb, schema) => {
            Metadata_1.validateDocURL(url);
            return new Promise((resolve) => {
                const handle = this.open(url, true, schema);
                handle.subscribe((val, clock) => {
                    resolve(val);
                    if (cb)
                        cb(val, clock);
                    handle.close();
                });
            });
        };
        this.materialize = (url, history, cb) => {
            const id = Metadata_1.validateDocURL(url);
            const doc = this.docs.get(id);
            if (doc === undefined) {
                throw new Error(`No such document ${id}`);
            }
            if (history < 0 && history >= doc.history) {
                throw new Error(`Invalid history ${history} for id ${id}`);
            }
            this.queryBackend({ type: 'MaterializeMsg', history, id }, (msg) => {
                const doc = cambriamerge_1.Frontend.init({ deferActorId: true });
                cb(cambriamerge_1.Frontend.applyPatch(doc, msg.patch));
            });
        };
        this.queryBackend = (query, cb) => {
            msgid += 1; // global counter
            const id = msgid;
            this.cb.set(id, cb);
            this.toBackend.push({ type: 'Query', id, query });
        };
        this.open = (url, crawl = true, schema) => {
            if (crawl)
                this.crawler.crawl(url);
            const id = Metadata_1.validateDocURL(url);
            const doc = this.docs.get(id) || this.openDocFrontend(id, schema);
            return doc.handle();
        };
        this.subscribe = (subscriber) => {
            this.toBackend.subscribe(subscriber);
        };
        this.close = () => {
            this.toBackend.push({ type: 'CloseMsg' });
            this.docs.forEach((doc) => doc.close());
            this.docs.clear();
            this.crawler.close();
        };
        this.destroy = (url) => {
            const id = Metadata_1.validateDocURL(url);
            this.toBackend.push({ type: 'DestroyMsg', id });
            const doc = this.docs.get(id);
            if (doc) {
                // doc.destroy()
                this.docs.delete(id);
            }
        };
        /*
        handleReply = (id: number, reply: ToFrontendReplyMsg) => {
          const cb = this.cb.get(id)!
          switch (reply.type) {
            case "MaterializeReplyMsg": {
              cb(reply.patch);
              break;
            }
          }
          this.cb.delete(id)
        }
      */
        this.receive = (msg) => {
            switch (msg.type) {
                case 'PatchMsg': {
                    const doc = this.docs.get(msg.id);
                    if (doc) {
                        doc.patch(msg.patch, msg.minimumClockSatisfied, msg.history);
                    }
                    break;
                }
                case 'Reply': {
                    const id = msg.id;
                    //          const reply = msg.reply
                    // this.handleReply(id,reply)
                    const cb = this.cb.get(id);
                    cb(msg.payload);
                    this.cb.delete(id);
                    break;
                }
                case 'ActorIdMsg': {
                    const doc = this.docs.get(msg.id);
                    if (doc) {
                        doc.setActorId(msg.actorId);
                    }
                    break;
                }
                case 'ReadyMsg': {
                    const doc = this.docs.get(msg.id);
                    if (doc) {
                        doc.init(msg.minimumClockSatisfied, msg.actorId, msg.patch, msg.history);
                    }
                    break;
                }
                case 'ActorBlockDownloadedMsg': {
                    const doc = this.docs.get(msg.id);
                    if (doc) {
                        const progressEvent = {
                            actor: msg.actorId,
                            index: msg.index,
                            size: msg.size,
                            time: msg.time,
                        };
                        doc.progress(progressEvent);
                    }
                    break;
                }
                case 'DocumentMessage': {
                    const doc = this.docs.get(msg.id);
                    if (doc) {
                        doc.messaged(msg.contents);
                    }
                    break;
                }
                case 'FileServerReadyMsg':
                    this.files.setServerPath(msg.path);
                    break;
            }
        };
        this.crypto = new CryptoClient_1.CryptoClient(this.queryBackend);
        this.crawler = new Crawler_1.Crawler(this);
    }
    registerLens(lens) {
        this.toBackend.push({ type: 'RegisterLensMsg', lens });
    }
    debug(url) {
        const id = Metadata_1.validateDocURL(url);
        const doc = this.docs.get(id);
        const short = id.substr(0, 5);
        if (doc === undefined) {
            console.log(`doc:frontend undefined doc=${short}`);
        }
        else {
            console.log(`doc:frontend id=${short}`);
            console.log(`doc:frontend clock=${Clock_1.clockDebug(doc.clock)}`);
        }
        this.toBackend.push({ type: 'DebugMsg', id });
    }
    openDocFrontend(id, schema) {
        const doc = new DocFrontend_1.DocFrontend(this, { docId: id, schema });
        this.toBackend.push({ type: 'OpenMsg', id, schema });
        this.docs.set(id, doc);
        return doc;
    }
}
exports.RepoFrontend = RepoFrontend;
//# sourceMappingURL=RepoFrontend.js.map