"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
const automerge_1 = require("automerge");
const DocBackend = __importStar(require("./DocBackend"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const Misc_1 = require("./Misc");
const debug_1 = __importDefault(require("debug"));
const Keys = __importStar(require("./Keys"));
const FeedStore_1 = __importDefault(require("./FeedStore"));
const FileStore_1 = __importDefault(require("./FileStore"));
const FileServer_1 = __importDefault(require("./FileServer"));
const Network_1 = __importDefault(require("./Network"));
const ClockStore_1 = __importDefault(require("./ClockStore"));
const SqlDatabase = __importStar(require("./SqlDatabase"));
const MessageCenter_1 = __importDefault(require("./MessageCenter"));
const random_access_memory_1 = __importDefault(require("random-access-memory"));
const random_access_file_1 = __importDefault(require("random-access-file"));
const KeyStore_1 = __importDefault(require("./KeyStore"));
const ReplicationManager_1 = __importDefault(require("./ReplicationManager"));
debug_1.default.formatters.b = Base58.encode;
const log = debug_1.default('repo:backend');
class RepoBackend {
    constructor(opts) {
        this.actors = new Map();
        this.docs = new Map();
        this.toFrontend = new Queue_1.default('repo:back:toFrontend');
        this.startFileServer = (path) => {
            if (this.fileServer.isListening())
                return;
            this.fileServer.listen(path);
            this.toFrontend.push({
                type: 'FileServerReadyMsg',
                path,
            });
        };
        /*
        follow(id: string, target: string) {
          this.meta.follow(id, target);
          this.syncReadyActors(this.meta.actors(id));
        }
      */
        this.close = () => {
            this.actors.forEach((actor) => actor.close());
            this.actors.clear();
            this.db.close();
            return Promise.all([
                this.feeds.close(),
                this.replication.close(),
                this.network.close(),
                this.fileServer.close(),
            ]);
        };
        this.join = (actorId) => {
            this.network.join(Misc_1.toDiscoveryId(actorId));
        };
        this.leave = (actorId) => {
            this.network.leave(Misc_1.toDiscoveryId(actorId));
        };
        this.getReadyActor = (actorId) => {
            const publicKey = Base58.decode(actorId);
            const actor = this.actors.get(actorId) || this.initActor({ publicKey });
            const actorPromise = new Promise((resolve, reject) => {
                try {
                    actor.onReady(resolve);
                }
                catch (e) {
                    reject(e);
                }
            });
            return actorPromise;
        };
        this.storageFn = (path) => {
            return (name) => {
                return this.storage(this.path + '/' + path + '/' + name);
            };
        };
        this.syncReadyActors = (ids) => {
            ids.forEach((id) => __awaiter(this, void 0, void 0, function* () {
                const actor = yield this.getReadyActor(id);
                this.syncChanges(actor);
            }));
        };
        this.documentNotify = (msg) => {
            switch (msg.type) {
                case 'ReadyMsg': {
                    this.toFrontend.push({
                        type: 'ReadyMsg',
                        id: msg.id,
                        minimumClockSatisfied: msg.minimumClockSatisfied,
                        actorId: msg.actorId,
                        history: msg.history,
                        patch: msg.patch,
                    });
                    break;
                }
                case 'ActorIdMsg': {
                    this.toFrontend.push({
                        type: 'ActorIdMsg',
                        id: msg.id,
                        actorId: msg.actorId,
                    });
                    break;
                }
                case 'RemotePatchMsg': {
                    this.toFrontend.push({
                        type: 'PatchMsg',
                        id: msg.id,
                        minimumClockSatisfied: msg.minimumClockSatisfied,
                        patch: msg.patch,
                        history: msg.history,
                    });
                    const doc = this.docs.get(msg.id);
                    if (doc && msg.minimumClockSatisfied) {
                        this.clocks.update(this.id, msg.id, doc.clock);
                    }
                    break;
                }
                case 'LocalPatchMsg': {
                    this.toFrontend.push({
                        type: 'PatchMsg',
                        id: msg.id,
                        minimumClockSatisfied: msg.minimumClockSatisfied,
                        patch: msg.patch,
                        history: msg.history,
                    });
                    this.actor(msg.actorId).writeChange(msg.change);
                    const doc = this.docs.get(msg.id);
                    if (doc && msg.minimumClockSatisfied) {
                        this.clocks.update(this.id, msg.id, doc.clock);
                    }
                    break;
                }
                default: {
                    console.log('Unknown message type', msg);
                }
            }
        };
        this.onPeer = (peer) => {
            this.messages.listenTo(peer);
            this.replication.onPeer(peer);
        };
        this.onDiscovery = ({ feedId, peer }) => {
            const actorId = feedId;
            const blocks = this.meta.forActor(actorId);
            const docs = this.meta.docsWith(actorId);
            const clocks = this.clocks.getMultiple(this.id, docs);
            this.messages.sendToPeer(peer, {
                type: 'RemoteMetadata',
                clocks,
                blocks,
            });
        };
        this.onMessage = ({ msg }) => {
            switch (msg.type) {
                case 'RemoteMetadata': {
                    const { blocks, clocks } = Metadata_1.sanitizeRemoteMetadata(msg);
                    for (let docId in clocks) {
                        const clock = clocks[docId];
                        const doc = this.docs.get(docId);
                        if (clock && doc) {
                            doc.updateMinimumClock(clock);
                        }
                    }
                    this.meta.addBlocks(blocks);
                    blocks.map((block) => {
                        if ('actors' in block && block.actors)
                            this.syncReadyActors(block.actors);
                        if ('merge' in block && block.merge)
                            this.syncReadyActors(Clock_1.clockActorIds(block.merge));
                        // if (block.follows) block.follows.forEach(id => this.open(id))
                    });
                    break;
                }
                case 'DocumentMessage': {
                    const { contents, id } = msg;
                    this.toFrontend.push({
                        type: 'DocumentMessage',
                        id,
                        contents,
                    });
                    break;
                }
            }
        };
        this.actorNotify = (msg) => {
            switch (msg.type) {
                case 'ActorFeedReady': {
                    const actor = msg.actor;
                    // Record whether or not this actor is writable.
                    this.meta.setWritable(actor.id, msg.writable);
                    // Broadcast latest document information to peers.
                    const blocks = this.meta.forActor(actor.id);
                    const docs = this.meta.docsWith(actor.id);
                    const clocks = this.clocks.getMultiple(this.id, docs);
                    const discoveryIds = this.meta.docsWith(actor.id).map(Misc_1.toDiscoveryId);
                    const peers = this.replication.getPeersWith(discoveryIds);
                    this.messages.sendToPeers(peers, {
                        type: 'RemoteMetadata',
                        blocks,
                        clocks,
                    });
                    this.join(actor.id);
                    break;
                }
                case 'ActorInitialized': {
                    // Swarm on the actor's feed.
                    this.join(msg.actor.id);
                    break;
                }
                case 'ActorSync':
                    log('ActorSync', msg.actor.id);
                    this.syncChanges(msg.actor);
                    break;
                case 'Download':
                    this.meta.docsWith(msg.actor.id).forEach((docId) => {
                        this.toFrontend.push({
                            type: 'ActorBlockDownloadedMsg',
                            id: docId,
                            actorId: msg.actor.id,
                            index: msg.index,
                            size: msg.size,
                            time: msg.time,
                        });
                    });
                    break;
            }
        };
        this.syncChanges = (actor) => {
            const actorId = actor.id;
            const docIds = this.meta.docsWith(actorId);
            docIds.forEach((docId) => {
                const doc = this.docs.get(docId);
                if (doc) {
                    doc.ready.push(() => {
                        const max = this.meta.clockAt(docId, actorId);
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
        this.setSwarm = (swarm, joinOptions) => {
            this.network.setSwarm(swarm, joinOptions);
        };
        this.subscribe = (subscriber) => {
            this.toFrontend.subscribe(subscriber);
        };
        this.handleQuery = (id, query) => {
            switch (query.type) {
                case 'MetadataMsg': {
                    this.meta.publicMetadata(query.id, (payload) => {
                        this.toFrontend.push({ type: 'Reply', id, payload });
                    });
                    break;
                }
                case 'MaterializeMsg': {
                    const doc = this.docs.get(query.id);
                    const changes = doc.back
                        .getIn(['opSet', 'history'])
                        .slice(0, query.history)
                        .toArray();
                    const [_, patch] = automerge_1.Backend.applyChanges(automerge_1.Backend.init(), changes);
                    this.toFrontend.push({ type: 'Reply', id, payload: patch });
                    break;
                }
            }
        };
        this.receive = (msg) => {
            switch (msg.type) {
                case 'NeedsActorIdMsg': {
                    const doc = this.docs.get(msg.id);
                    const actorId = this.initActorFeed(doc);
                    doc.initActor(actorId);
                    break;
                }
                case 'RequestMsg': {
                    const doc = this.docs.get(msg.id);
                    doc.applyLocalChange(msg.request);
                    break;
                }
                case 'Query': {
                    const query = msg.query;
                    const id = msg.id;
                    this.handleQuery(id, query);
                    break;
                }
                case 'CreateMsg': {
                    const keys = {
                        publicKey: Keys.decode(msg.publicKey),
                        secretKey: Keys.decode(msg.secretKey),
                    };
                    this.create(keys);
                    break;
                }
                case 'MergeMsg': {
                    this.merge(msg.id, Clock_1.strs2clock(msg.actors));
                    break;
                }
                /*
                  case "FollowMsg": {
                    this.follow(msg.id, msg.target);
                    break;
                  }
          */
                case 'OpenMsg': {
                    this.open(msg.id);
                    break;
                }
                case 'DocumentMessage': {
                    // Note: 'id' is the document id of the document to send the message to.
                    const { id, contents } = msg;
                    const peers = this.replication.getPeersWith([Misc_1.toDiscoveryId(id)]);
                    this.messages.sendToPeers(peers, {
                        type: 'DocumentMessage',
                        id,
                        contents,
                    });
                    break;
                }
                case 'DestroyMsg': {
                    this.destroy(msg.id);
                    break;
                }
                case 'DebugMsg': {
                    this.debug(msg.id);
                    break;
                }
                case 'CloseMsg': {
                    this.close();
                    break;
                }
            }
        };
        this.opts = opts;
        this.path = opts.path || 'default';
        // initialize storage
        if (!opts.memory) {
            ensureDirectoryExists(this.path);
        }
        this.storage = opts.memory ? random_access_memory_1.default : random_access_file_1.default;
        this.db = SqlDatabase.open(path_1.default.resolve(this.path, 'hypermerge.db'), opts.memory || false);
        this.keys = new KeyStore_1.default(this.db);
        this.feeds = new FeedStore_1.default(this.storageFn);
        this.files = new FileStore_1.default(this.feeds);
        // init repo
        const repoKeys = this.keys.get('self.repo') || this.keys.set('self.repo', Keys.createBuffer());
        this.swarmKey = repoKeys.publicKey;
        this.id = Misc_1.encodeRepoId(repoKeys.publicKey);
        // initialize the various stores
        this.clocks = new ClockStore_1.default(this.db);
        this.files.writeLog.subscribe((header) => {
            this.meta.addFile(header.url, header.bytes, header.mimeType);
        });
        this.fileServer = new FileServer_1.default(this.files);
        this.replication = new ReplicationManager_1.default(this.feeds);
        this.meta = new Metadata_1.Metadata(this.storageFn, this.join, this.leave);
        this.network = new Network_1.default(toPeerId(this.id));
        this.messages = new MessageCenter_1.default('HypermergeMessages');
        this.messages.inboxQ.subscribe(this.onMessage);
        this.replication.discoveryQ.subscribe(this.onDiscovery);
        this.network.peerQ.subscribe(this.onPeer);
        this.feeds.feedIdQ.subscribe((feedId) => {
            this.replication.addFeedIds([feedId]);
        });
    }
    create(keys) {
        const docId = Misc_1.encodeDocId(keys.publicKey);
        log('create', docId);
        const doc = new DocBackend.DocBackend(docId, this.documentNotify, automerge_1.Backend.init());
        this.docs.set(docId, doc);
        this.meta.addActor(doc.id, Misc_1.rootActorId(doc.id));
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
                .map((actor) => {
                const nm = actor.substr(0, 5);
                return local === actor ? `*${nm}` : nm;
            })
                .sort();
            console.log(`doc:backend actors=${info.join(',')}`);
        }
    }
    destroy(id) {
        this.meta.delete(id);
        const doc = this.docs.get(id);
        if (doc) {
            this.docs.delete(id);
        }
        const actors = this.meta.allActors();
        this.actors.forEach((actor, id) => {
            if (!actors.has(id)) {
                console.log('Orphaned actors - will purge', id);
                this.actors.delete(id);
                this.leave(actor.id);
                actor.destroy();
            }
        });
    }
    // opening a file fucks it up
    open(docId) {
        //    log("open", docId, this.meta.forDoc(docId));
        if (this.meta.isFile(docId)) {
            throw new Error('trying to open a file like a document');
        }
        let doc = this.docs.get(docId) || new DocBackend.DocBackend(docId, this.documentNotify);
        if (!this.docs.has(docId)) {
            this.docs.set(docId, doc);
            this.meta.addActor(docId, Misc_1.rootActorId(docId));
            this.loadDocument(doc);
        }
        return doc;
    }
    merge(id, clock) {
        this.meta.merge(id, clock);
        this.syncReadyActors(Clock_1.clockActorIds(clock));
    }
    allReadyActors(docId) {
        return __awaiter(this, void 0, void 0, function* () {
            const actorIds = yield this.meta.actorsAsync(docId);
            return Promise.all(actorIds.map(this.getReadyActor));
        });
    }
    loadDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            const actors = yield this.allReadyActors(doc.id);
            log(`load document 2 actors=${actors.map((a) => a.id)}`);
            const changes = [];
            actors.forEach((actor) => {
                const max = this.meta.clockAt(doc.id, actor.id);
                const slice = actor.changes.slice(0, max);
                doc.changes.set(actor.id, slice.length);
                log(`change actor=${Misc_1.ID(actor.id)} changes=0..${slice.length}`);
                changes.push(...slice);
            });
            log(`loading doc=${Misc_1.ID(doc.id)} changes=${changes.length}`);
            // Check to see if we already have a local actor id. If so, re-use it.
            const localActorId = this.meta.localActorId(doc.id);
            const actorId = localActorId
                ? (yield this.getReadyActor(localActorId)).id
                : this.initActorFeed(doc);
            doc.init(changes, actorId);
        });
    }
    initActorFeed(doc) {
        log('initActorFeed', doc.id);
        const keys = crypto.keyPair();
        const actorId = Misc_1.encodeActorId(keys.publicKey);
        this.meta.addActor(doc.id, actorId);
        this.initActor(keys);
        return actorId;
    }
    actorIds(doc) {
        return this.meta.actors(doc.id);
    }
    docActors(doc) {
        return this.actorIds(doc)
            .map((id) => this.actors.get(id))
            .filter(Misc_1.notEmpty);
    }
    initActor(keys) {
        const actor = new Actor_1.Actor({
            keys,
            notify: this.actorNotify,
            store: this.feeds,
        });
        this.actors.set(actor.id, actor);
        this.replication.addFeedIds([actor.id]);
        return actor;
    }
    actor(id) {
        return this.actors.get(id);
    }
}
exports.RepoBackend = RepoBackend;
function ensureDirectoryExists(path) {
    fs_1.default.mkdirSync(path, { recursive: true });
}
function toPeerId(repoId) {
    return repoId;
}
//# sourceMappingURL=RepoBackend.js.map