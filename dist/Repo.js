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
exports.EXT = "hypermerge";
const Queue_1 = __importDefault(require("./Queue"));
const MapSet_1 = __importDefault(require("./MapSet"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const Base58 = __importStar(require("bs58"));
const crypto = __importStar(require("hypercore/lib/crypto"));
const hypercore_1 = require("./hypercore");
const Backend = __importStar(require("automerge/backend"));
const backend_1 = require("./backend");
const frontend_1 = require("./frontend");
const debug_1 = __importDefault(require("debug"));
debug_1.default.formatters.b = Base58.encode;
const HypercoreProtocol = require("hypercore-protocol");
const ram = require("random-access-memory");
const raf = require("random-access-file");
const log = debug_1.default("hypermerge");
class Repo {
    constructor(opts) {
        this.joined = new Set();
        this.feeds = new Map();
        this.feedQs = new Map();
        this.feedPeers = new Map();
        this.docs = new Map();
        this.feedSeq = new Map();
        this.ledgerMetadata = new MapSet_1.default();
        this.docMetadata = new MapSet_1.default();
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
        this.getFeed = (doc, actorId, cb) => {
            const publicKey = Base58.decode(actorId);
            const dk = hypercore_1.discoveryKey(publicKey);
            const dkString = Base58.encode(dk);
            const q = this.feedQs.get(dkString) || this.initFeed(doc, { publicKey });
            q.push(cb);
        };
        this.closeFeed = (actorId) => {
            this.feed(actorId).close();
        };
        this.stream = (opts) => {
            const stream = HypercoreProtocol({
                live: true,
                id: this.ledger.id,
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
        this.path = opts.path || "default";
        this.storage = opts.storage || (opts.path ? raf : ram);
        this.ledger = hypercore_1.hypercore(this.storageFn("ledger"), { valueEncoding: "json" });
        this.id = this.ledger.id;
        this.ready = new Promise((resolve, reject) => {
            this.ledger.ready(() => {
                log("Ledger ready: size", this.ledger.length);
                if (this.ledger.length > 0) {
                    this.ledger.getBatch(0, this.ledger.length, (err, data) => {
                        data.forEach(d => {
                            this.docMetadata.merge(d.docId, d.actorIds);
                            this.ledgerMetadata.merge(d.docId, d.actorIds);
                        });
                        resolve();
                    });
                }
                else {
                    resolve();
                }
            });
        });
    }
    createDocumentFrontend(keys) {
        const back = this.createDocument(keys);
        const front = new frontend_1.FrontendManager(back.docId, back.docId);
        front.back = back;
        front.on("request", back.applyLocalChange);
        back.on("patch", front.patch);
        return front;
    }
    createDocument(keys) {
        const docId = Base58.encode(keys.publicKey);
        log("Create", docId);
        const doc = new backend_1.BackendManager(this, docId, Backend.init());
        this.docs.set(docId, doc);
        this.initFeed(doc, keys);
        return doc;
    }
    addMetadata(docId, actorId) {
        this.docMetadata.add(docId, actorId);
        this.ready.then(() => {
            if (!this.ledgerMetadata.has(docId, actorId)) {
                this.ledgerMetadata.add(docId, actorId);
                this.ledger.append({ docId: docId, actorIds: [actorId] });
            }
        });
    }
    openDocument(docId) {
        let doc = this.docs.get(docId) || new backend_1.BackendManager(this, docId);
        if (!this.docs.has(docId)) {
            this.docs.set(docId, doc);
            this.addMetadata(docId, docId);
            this.loadDocument(doc);
            this.join(docId);
        }
        return doc;
    }
    openDocumentFrontend(docId) {
        const back = this.openDocument(docId);
        const front = new frontend_1.FrontendManager(back.docId);
        front.back = back;
        front.once("needsActorId", back.initActor);
        front.on("request", back.applyLocalChange);
        back.on("actorId", front.setActorId);
        back.on("ready", front.init);
        back.on("patch", front.patch);
        return front;
    }
    joinSwarm(swarm) {
        if (this.swarm) {
            throw new Error("joinSwarm called while already swarming");
        }
        this.swarm = swarm;
        for (let dk of this.joined) {
            this.swarm.join(dk);
        }
    }
    feedData(doc, actorId) {
        return new Promise((resolve, reject) => {
            this.getFeed(doc, actorId, feed => {
                const writable = feed.writable;
                if (feed.length > 0) {
                    feed.getBatch(0, feed.length, (err, datas) => {
                        const changes = datas.map(JsonBuffer.parse);
                        if (err) {
                            reject(err);
                        }
                        this.feedSeq.set(actorId, datas.length);
                        resolve({ actorId, writable, changes });
                    });
                }
                else {
                    resolve({ actorId, writable, changes: [] });
                }
            });
        });
    }
    allFeedData(doc) {
        return Promise.all(doc.actorIds().map(key => this.feedData(doc, key)));
    }
    writeChange(doc, actorId, change) {
        const feedLength = this.feedSeq.get(actorId) || 0;
        const ok = feedLength + 1 === change.seq;
        log(`write actor=${actorId} seq=${change.seq} feed=${feedLength} ok=${ok}`);
        this.feedSeq.set(actorId, feedLength + 1);
        this.getFeed(doc, actorId, feed => {
            feed.append(JsonBuffer.bufferify(change), err => {
                if (err) {
                    throw new Error("failed to append to feed");
                }
            });
        });
    }
    loadDocument(doc) {
        return this.ready.then(() => this.allFeedData(doc).then(feedData => {
            const writer = feedData
                .filter(f => f.writable)
                .map(f => f.actorId)
                .shift();
            const changes = [].concat(...feedData.map(f => f.changes));
            doc.init(changes, writer);
        }));
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
        this.initFeed(doc, keys);
        return actorId;
    }
    sendToPeer(peer, data) {
        peer.stream.extension(exports.EXT, Buffer.from(JSON.stringify(data)));
    }
    actorIds(doc) {
        return [...this.docMetadata.get(doc.docId)];
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
    initFeed(doc, keys) {
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
        this.feeds.set(dkString, feed);
        this.feedQs.set(dkString, q);
        this.feedPeers.set(actorId, peers);
        this.addMetadata(doc.docId, actorId);
        log("init feed", actorId);
        feed.ready(() => {
            this.feedSeq.set(actorId, 0);
            doc.broadcastMetadata();
            this.join(actorId);
            feed.on("peer-remove", (peer) => {
                peers.delete(peer);
                doc.emit("peer-remove", peer);
            });
            feed.on("peer-add", (peer) => {
                peer.stream.on("extension", (ext, buf) => {
                    if (ext === exports.EXT) {
                        const msg = JSON.parse(buf.toString());
                        log("EXT", msg);
                        // getFeed -> initFeed -> join()
                        msg.forEach(actorId => this.getFeed(doc, actorId, _ => { }));
                    }
                });
                peers.add(peer);
                doc.messageMetadata(peer);
                doc.emit("peer-add", peer);
            });
            let remoteChanges = [];
            feed.on("download", (idx, data) => {
                remoteChanges.push(JsonBuffer.parse(data));
            });
            feed.on("sync", () => {
                doc.applyRemoteChanges(remoteChanges);
                remoteChanges = [];
            });
            this.feedQs.get(dkString).subscribe(f => f(feed));
            feed.on("close", () => {
                log("closing feed", actorId);
                this.feeds.delete(dkString);
                this.feedQs.delete(dkString);
                this.feedPeers.delete(actorId);
                this.feedSeq.delete(actorId);
            });
            doc.emit("feed", feed);
        });
        return q;
    }
    releaseManager(doc) {
        const actorIds = doc.actorIds();
        this.docs.delete(doc.docId);
        actorIds.map(this.leave);
        actorIds.map(this.closeFeed);
    }
}
exports.Repo = Repo;
//# sourceMappingURL=Repo.js.map