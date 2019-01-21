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
const Actor_1 = require("./Actor");
const Clock_1 = require("./Clock");
const Base58 = __importStar(require("bs58"));
const crypto = __importStar(require("hypercore/lib/crypto"));
const hypercore_1 = require("./hypercore");
const Backend = __importStar(require("automerge/backend"));
const DocBackend_1 = require("./DocBackend");
const Misc_1 = require("./Misc");
const debug_1 = __importDefault(require("debug"));
debug_1.default.formatters.b = Base58.encode;
const HypercoreProtocol = require("hypercore-protocol");
const log = debug_1.default("repo:backend");
class RepoBackend {
    constructor(opts) {
        this.joined = new Set();
        this.actors = new Map();
        this.actorsDk = new Map();
        this.docs = new Map();
        this.toFrontend = new Queue_1.default("repo:toFrontend");
        this.replicate = (swarm) => {
            if (this.swarm) {
                throw new Error("replicate called while already swarming");
            }
            this.swarm = swarm;
            for (let dk of this.joined) {
                log("swarm.join");
                this.swarm.join(Base58.decode(dk));
            }
        };
        this.join = (actorId) => {
            const dkBuffer = hypercore_1.discoveryKey(Base58.decode(actorId));
            const dk = Base58.encode(dkBuffer);
            if (this.swarm && !this.joined.has(dk)) {
                log("swarm.join", Misc_1.ID(actorId), Misc_1.ID(dk));
                this.swarm.join(dkBuffer);
            }
            this.joined.add(dk);
        };
        this.leave = (actorId) => {
            const dkBuffer = hypercore_1.discoveryKey(Base58.decode(actorId));
            const dk = Base58.encode(dkBuffer);
            if (this.swarm && this.joined.has(dk)) {
                log("leave", Misc_1.ID(actorId), Misc_1.ID(dk));
                this.swarm.leave(dkBuffer);
            }
            this.joined.delete(dk);
        };
        this.getReadyActor = (actorId, cb) => {
            const publicKey = Base58.decode(actorId);
            const actor = this.actors.get(actorId) || this.initActor({ publicKey });
            actor.push(cb);
        };
        this.storageFn = (path) => {
            return (name) => {
                return this.storage(this.path + "/" + path + "/" + name);
            };
        };
        this.syncReadyActors = (ids) => {
            ids.map(id => this.getReadyActor(id, this.syncChanges));
        };
        this.actorNotify = (msg) => {
            switch (msg.type) {
                case "NewMetadata":
                    const blocks = Metadata_1.validateMetadataMsg(msg.input);
                    log("NewMetadata", blocks);
                    this.meta.addBlocks(blocks);
                    blocks.map(block => {
                        if (block.actors)
                            this.syncReadyActors(block.actors);
                        if (block.merge)
                            this.syncReadyActors(Object.keys(block.merge));
                        if (block.follows)
                            block.follows.forEach(id => this.open(id));
                    });
                    break;
                case "ActorSync":
                    log("ActorSync", msg.actor.id);
                    this.syncChanges(msg.actor);
                    break;
                case "Download":
                    this.meta.docsWith(msg.actor.id).forEach((doc) => {
                        this.toFrontend.push({
                            type: "ActorBlockDownloadedMsg",
                            id: doc,
                            actorId: msg.actor.id,
                            index: msg.index,
                            size: msg.size,
                            time: msg.time
                        });
                    });
                    break;
            }
        };
        this.syncChanges = (actor) => {
            const actorId = actor.id;
            const docIds = this.meta.docsWith(actorId);
            docIds.forEach(docId => {
                const doc = this.docs.get(docId);
                if (doc) {
                    doc.ready.push(() => {
                        const max = this.meta.clock(docId)[actorId] || 0;
                        const min = doc.changes.get(actorId) || 0;
                        const changes = [];
                        let i = min;
                        for (; i < max && actor.changes.hasOwnProperty(i); i++) {
                            const change = actor.changes[i];
                            log(`change found xxx id=${Misc_1.ID(actor.id)} seq=${change.seq}`);
                            changes.push(change);
                        }
                        doc.changes.set(actorId, i);
                        //        log(`changes found xxx doc=${ID(docId)} actor=${ID(actor.id)} n=[${min}+${changes.length}/${max}]`);
                        if (changes.length > 0) {
                            log(`applyremotechanges ${changes.length}`);
                            doc.applyRemoteChanges(changes);
                        }
                    });
                }
            });
        };
        this.stream = (opts) => {
            const stream = HypercoreProtocol({
                live: true,
                id: this.id,
                encrypt: false,
                timeout: 10000,
                extensions: [Actor_1.EXT]
            });
            let add = (dk) => {
                const actor = this.actorsDk.get(Base58.encode(dk));
                if (actor) {
                    log("replicate feed!", Misc_1.ID(Base58.encode(dk)));
                    actor.feed.replicate({
                        stream,
                        live: true
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
        this.handleQuery = (id, query) => {
            switch (query.type) {
                case "MetadataMsg": {
                    this.meta.publicMetadata(query.id, (payload) => {
                        this.toFrontend.push({ type: "Reply", id, payload });
                    });
                    break;
                }
                case "MaterializeMsg": {
                    const doc = this.docs.get(query.id);
                    const changes = doc.back.getIn(['opSet', 'history']).slice(0, query.history).toArray();
                    const [_, patch] = Backend.applyChanges(Backend.init(), changes);
                    this.toFrontend.push({ type: "Reply", id, payload: patch });
                    break;
                }
            }
        };
        this.receive = (msg) => {
            if (msg instanceof Uint8Array) {
                this.file = msg;
            }
            else {
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
                    case "WriteFile": {
                        const keys = {
                            publicKey: Base58.decode(msg.publicKey),
                            secretKey: Base58.decode(msg.secretKey)
                        };
                        log("write file", msg.mimeType);
                        this.writeFile(keys, this.file, msg.mimeType);
                        delete this.file;
                        break;
                    }
                    case "Query": {
                        const query = msg.query;
                        const id = msg.id;
                        this.handleQuery(id, query);
                        break;
                    }
                    case "ReadFile": {
                        const id = msg.id;
                        log("read file", id);
                        this.readFile(id, (file, mimeType) => {
                            log("read file done", file.length, "bytes", mimeType);
                            this.toFrontend.push(file);
                            this.toFrontend.push({ type: "ReadFileReply", id, mimeType });
                        });
                        break;
                    }
                    case "CreateMsg": {
                        const keys = {
                            publicKey: Base58.decode(msg.publicKey),
                            secretKey: Base58.decode(msg.secretKey)
                        };
                        this.create(keys);
                        break;
                    }
                    case "MergeMsg": {
                        this.merge(msg.id, Clock_1.strs2clock(msg.actors));
                        break;
                    }
                    case "FollowMsg": {
                        this.follow(msg.id, msg.target);
                        break;
                    }
                    case "OpenMsg": {
                        this.open(msg.id);
                        break;
                    }
                    case "DestroyMsg": {
                        this.destroy(msg.id);
                        break;
                    }
                    case "DebugMsg": {
                        this.debug(msg.id);
                        break;
                    }
                }
            }
        };
        this.opts = opts;
        this.path = opts.path || "default";
        this.storage = opts.storage;
        this.meta = new Metadata_1.Metadata(this.storageFn);
        this.id = this.meta.id;
    }
    writeFile(keys, data, mimeType) {
        const fileId = Base58.encode(keys.publicKey);
        this.meta.addFile(fileId, data.length, mimeType);
        const actor = this.initActor(keys);
        actor.writeFile(data, mimeType);
    }
    readFile(id, cb) {
        log("readFile", id, this.meta.forDoc(id));
        if (this.meta.isDoc(id)) {
            throw new Error("trying to open a document like a file");
        }
        this.getReadyActor(id, actor => actor.readFile(cb));
    }
    create(keys) {
        const docId = Base58.encode(keys.publicKey);
        log("create", docId);
        const doc = new DocBackend_1.DocBackend(this, docId, Backend.init());
        this.docs.set(docId, doc);
        this.meta.addActor(doc.id, doc.id);
        this.initActor(keys);
        return doc;
    }
    debug(id) {
        const doc = this.docs.get(id);
        const short = id.substr(0, 5);
        if (doc === undefined) {
            console.log(`doc:backend NOT FOUND id=${short}`);
        }
        else {
            console.log(`doc:backend id=${short}`);
            console.log(`doc:backend clock=${Clock_1.clockDebug(doc.clock)}`);
            const local = this.meta.localActorId(id);
            const actors = this.meta.actors(id);
            const info = actors
                .map(actor => {
                const nm = actor.substr(0, 5);
                return local === actor ? `*${nm}` : nm;
            })
                .sort();
            console.log(`doc:backend actors=${info.join(",")}`);
        }
    }
    destroy(id) {
        this.meta.delete(id);
        const doc = this.docs.get(id);
        if (doc) {
            this.docs.delete(id);
        }
        const actors = Object.keys(this.meta.master);
        this.actors.forEach((actor, id) => {
            if (!actors.includes(id)) {
                console.log("Orfaned actors - will purge", id);
                this.actors.delete(id);
                actor.destroy();
            }
        });
    }
    // opening a file fucks it up
    open(docId) {
        log("open", docId, this.meta.forDoc(docId));
        if (this.meta.isFile(docId)) {
            throw new Error("trying to open a file like a document");
        }
        let doc = this.docs.get(docId) || new DocBackend_1.DocBackend(this, docId);
        if (!this.docs.has(docId)) {
            this.docs.set(docId, doc);
            this.meta.addActor(docId, docId);
            this.loadDocument(doc);
        }
        return doc;
    }
    merge(id, clock) {
        this.meta.merge(id, clock);
        this.syncReadyActors(Object.keys(clock));
    }
    follow(id, target) {
        this.meta.follow(id, target);
        this.syncReadyActors(this.meta.actors(id));
    }
    allReadyActors(docId, cb) {
        const a2p = (id) => new Promise((resolve, reject) => {
            try {
                this.getReadyActor(id, resolve);
            }
            catch (e) {
                reject(e);
            }
        });
        this.meta.actorsAsync(docId, ids => Promise.all(ids.map(a2p)).then(cb));
    }
    loadDocument(doc) {
        this.allReadyActors(doc.id, actors => {
            log(`load document 2 actors=${actors.map((a) => a.id)}`);
            const changes = [];
            actors.forEach(actor => {
                const max = this.meta.clock(doc.id)[actor.id] || 0;
                const slice = actor.changes.slice(0, max);
                doc.changes.set(actor.id, slice.length);
                log(`change actor=${Misc_1.ID(actor.id)} changes=0..${slice.length}`);
                changes.push(...slice);
            });
            log(`loading doc=${Misc_1.ID(doc.id)} changes=${changes.length}`);
            doc.init(changes, this.meta.localActorId(doc.id));
        });
    }
    initActorFeed(doc) {
        log("initActorFeed", doc.id);
        const keys = crypto.keyPair();
        const actorId = Base58.encode(keys.publicKey);
        this.meta.addActor(doc.id, actorId);
        this.initActor(keys);
        return actorId;
    }
    actorIds(doc) {
        return this.meta.actors(doc.id);
    }
    docActors(doc) {
        return this.actorIds(doc)
            .map(id => this.actors.get(id))
            .filter(Misc_1.notEmpty);
    }
    initActor(keys) {
        const meta = this.meta;
        const notify = this.actorNotify;
        const storage = this.storageFn;
        const actor = new Actor_1.Actor({ repo: this, keys, meta, notify, storage });
        this.actors.set(actor.id, actor);
        this.actorsDk.set(actor.dkString, actor);
        return actor;
    }
    releaseManager(doc) {
        // FIXME - need reference count with many feeds <-> docs
    }
    actor(id) {
        return this.actors.get(id);
    }
}
exports.RepoBackend = RepoBackend;
//# sourceMappingURL=RepoBackend.js.map