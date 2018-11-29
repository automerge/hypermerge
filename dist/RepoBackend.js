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
const Metadata_1 = require("./Metadata");
//import { ClockSet, clock, clock2strs } from "./ClockSet"
const JsonBuffer = __importStar(require("./JsonBuffer"));
const Base58 = __importStar(require("bs58"));
const crypto = __importStar(require("hypercore/lib/crypto"));
const hypercore_1 = require("./hypercore");
const Backend = __importStar(require("automerge/backend"));
const DocBackend_1 = require("./DocBackend");
const debug_1 = __importDefault(require("debug"));
exports.EXT = "hypermerge";
debug_1.default.formatters.b = Base58.encode;
const HypercoreProtocol = require("hypercore-protocol");
const log = debug_1.default("repo:backend");
class RepoBackend {
    constructor(opts) {
        this.joined = new Set();
        this.feeds = new Map();
        this.feedQs = new Map();
        this.feedPeers = new Map();
        this.docs = new Map();
        this.changes = new Map();
        this.toFrontend = new Queue_1.default("repo:toFrontend");
        this.replicate = (swarm) => {
            if (this.swarm) {
                throw new Error("replicate called while already swarming");
            }
            this.swarm = swarm;
            for (let dk of this.joined) {
                this.swarm.join(dk);
            }
        };
        this.join = (actorId) => {
            const dk = hypercore_1.discoveryKey(Base58.decode(actorId));
            if (this.swarm && !this.joined.has(dk)) {
                this.swarm.join(dk);
            }
            this.joined.add(dk);
        };
        this.leave = (actorId) => {
            const dk = hypercore_1.discoveryKey(Base58.decode(actorId));
            if (this.swarm && this.joined.has(dk)) {
                this.swarm.leave(dk);
            }
            this.joined.delete(dk);
        };
        this.getFeed = (actorId, cb) => {
            const publicKey = Base58.decode(actorId);
            const q = this.feedQs.get(actorId) || this.initFeed({ publicKey });
            q.push(cb);
        };
        this.closeFeed = (actorId) => {
            this.feed(actorId).close();
        };
        this.stream = (opts) => {
            const stream = HypercoreProtocol({
                live: true,
                id: this.id,
                encrypt: false,
                timeout: 10000,
                extensions: [exports.EXT],
            });
            let add = (dk) => {
                const feed = this.feeds.get(Base58.encode(dk));
                if (feed) {
                    log("replicate feed!", Base58.encode(dk));
                    feed.replicate({
                        stream,
                        live: true,
                    });
                }
            };
            stream.on("feed", (dk) => add(dk));
            const dk = opts.channel || opts.discoveryKey;
            if (dk)
                add(dk);
            return stream;
        };
        this.subscribe = (subscriber) => {
            this.toFrontend.subscribe(subscriber);
        };
        this.receive = (msg) => {
            switch (msg.type) {
                case "NeedsActorIdMsg": {
                    const doc = this.docs.get(msg.id);
                    doc.initActor();
                    break;
                }
                case "RequestMsg": {
                    const doc = this.docs.get(msg.id);
                    doc.applyLocalChange(msg.request);
                    break;
                }
                case "CreateMsg": {
                    const keys = {
                        publicKey: Base58.decode(msg.publicKey),
                        secretKey: Base58.decode(msg.secretKey)
                    };
                    this.createDocBackend(keys);
                    break;
                }
                case "MergeMsg": {
                    //        this.merge(msg.id, clock(msg.actors))
                    break;
                }
                case "OpenMsg": {
                    this.openDocBackend(msg.id);
                    break;
                }
            }
            //export type ToBackendMsg = NeedsActorIdMsg | RequestMsg | CreateMsg | OpenMsg
        };
        this.opts = opts;
        this.path = opts.path || "default";
        this.storage = opts.storage;
        const ledger = hypercore_1.hypercore(this.storageFn("ledger"), { valueEncoding: "json" });
        this.id = ledger.id;
        this.meta = new Metadata_1.Metadata(ledger);
    }
    createDocBackend(keys) {
        const docId = Base58.encode(keys.publicKey);
        log("Create", docId);
        const doc = new DocBackend_1.DocBackend(this, docId, Backend.init());
        this.docs.set(docId, doc);
        this.meta.addActor(doc.docId, doc.docId);
        this.initFeed(keys);
        return doc;
    }
    openDocBackend(docId) {
        let doc = this.docs.get(docId) || new DocBackend_1.DocBackend(this, docId);
        if (!this.docs.has(docId)) {
            this.docs.set(docId, doc);
            this.meta.addActor(docId, docId);
            this.loadDocument(doc);
        }
        return doc;
    }
    merge(id, clock) {
        this.merge(id, clock);
        // FIXME get all blocks inside this clock currently missing
    }
    feedData(actorId) {
        return new Promise((resolve, reject) => {
            this.getFeed(actorId, feed => {
                resolve(this.changes.get(actorId));
            });
        });
    }
    allFeedData(id) {
        const blank = [];
        return new Promise((resolve) => {
            this.meta.actorsAsync(id, (actors) => {
                Promise.all([...actors].map(actor => this.feedData(actor)))
                    .then(changes => resolve(blank.concat(...changes)));
            });
        });
    }
    writeChange(actorId, change) {
        const changes = this.changes.get(actorId);
        const feedLength = changes.length;
        const ok = feedLength + 1 === change.seq;
        log(`write actor=${actorId} seq=${change.seq} feed=${feedLength} ok=${ok}`);
        changes.push(change);
        this.syncChanges(actorId);
        this.getFeed(actorId, feed => {
            feed.append(JsonBuffer.bufferify(change), err => {
                if (err) {
                    throw new Error("failed to append to feed");
                }
            });
        });
    }
    loadDocument(doc) {
        this.allFeedData(doc.docId).then(changes => {
            const localActor = this.meta.localActor(doc.docId);
            doc.init(changes, localActor);
        });
    }
    storageFn(path) {
        return (name) => {
            return this.storage(this.path + "/" + path + "/" + name);
        };
    }
    initActorFeed(doc) {
        log("initActorFeed", doc.docId);
        const keys = crypto.keyPair();
        const actorId = Base58.encode(keys.publicKey);
        this.meta.addActor(doc.docId, actorId);
        this.initFeed(keys);
        return actorId;
    }
    sendToPeer(peer, data) {
        peer.stream.extension(exports.EXT, Buffer.from(JSON.stringify(data)));
    }
    actorIds(doc) {
        return [...this.meta.actors(doc.docId)];
    }
    feed(actorId) {
        const publicKey = Base58.decode(actorId);
        const dk = hypercore_1.discoveryKey(publicKey);
        const dkString = Base58.encode(dk);
        return this.feeds.get(dkString);
    }
    peers(doc) {
        return [].concat(...this.actorIds(doc).map(actorId => [
            ...(this.feedPeers.get(actorId) || []),
        ]));
    }
    feedDocs(actorId, cb) {
        //FIXME need SEQ
        this.meta.docsWith(actorId, 0).forEach(docId => cb(this.docs.get(docId)));
    }
    initFeed(keys) {
        // FIXME - this code asssumes one doc to one feed - no longer true
        const { publicKey, secretKey } = keys;
        const actorId = Base58.encode(publicKey);
        const storage = this.storageFn(actorId);
        const dk = hypercore_1.discoveryKey(publicKey);
        const dkString = Base58.encode(dk);
        const feed = hypercore_1.hypercore(storage, publicKey, {
            secretKey,
        });
        const q = new Queue_1.default();
        const peers = new Set();
        const changes = [];
        this.changes.set(actorId, changes);
        this.feeds.set(dkString, feed);
        this.feedQs.set(actorId, q);
        this.feedPeers.set(actorId, peers);
        log("init feed", actorId);
        feed.ready(() => {
            this.meta.setWritable(actorId, feed.writable);
            this.meta.docsWith(actorId).forEach(docId => {
                const peers = this.feedPeers.get(docId);
                peers.forEach(peer => this.message(peer, this.meta.forActor(actorId)));
            });
            feed.on("peer-remove", (peer) => {
                peers.delete(peer);
            });
            feed.on("peer-add", (peer) => {
                peer.stream.on("extension", (ext, buf) => {
                    if (ext === exports.EXT) {
                        const blocks = JSON.parse(buf.toString());
                        log("EXT", blocks);
                        this.meta.addBlocks(blocks);
                        blocks.forEach(block => {
                            // getFeed -> initFeed -> join()
                            block.actorIds.forEach(actor => this.getFeed(actor, _ => { }));
                        });
                    }
                });
                peers.add(peer);
                this.message(peer, this.meta.forActor(actorId));
            });
            feed.on("download", (idx, data) => {
                changes.push(JsonBuffer.parse(data));
            });
            feed.on("sync", () => {
                this.syncChanges(actorId);
            });
            // read everything from disk before subscribing to the queue
            hypercore_1.readFeed(feed, datas => {
                changes.push(...datas.map(JsonBuffer.parse));
                this.join(actorId);
                q.subscribe(f => f(feed));
            });
            feed.on("close", () => {
                log("closing feed", actorId);
                this.changes.delete(actorId);
                this.feeds.delete(dkString);
                this.feedQs.delete(actorId);
                this.feedPeers.delete(actorId);
            });
        });
        return q;
    }
    message(peer, message) {
        peer.stream.extension(exports.EXT, Buffer.from(JSON.stringify(message)));
    }
    syncChanges(actor) {
        log(`sycing changes for actor=${actor}`);
        const ids = this.meta.docsWith(actor, 0);
        ids.forEach(id => {
            const doc = this.docs.get(id);
            const max = this.meta.clock(id)[actor] || 0;
            const seq = doc.clock[actor] || 0;
            if (max > seq) {
                const changes = this.changes.get(actor).slice(seq, max);
                log(`changes found doc=${id} n=${changes.length} seq=${seq} max=${max} length=${changes.length}`);
                doc.applyRemoteChanges(changes);
            }
        });
    }
    releaseManager(doc) {
        const actorIds = doc.actorIds();
        this.docs.delete(doc.docId);
        actorIds.map(this.leave);
        actorIds.map(this.closeFeed);
    }
}
exports.RepoBackend = RepoBackend;
//# sourceMappingURL=RepoBackend.js.map