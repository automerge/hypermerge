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
const Clock = __importStar(require("./Clock"));
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
const CursorStore_1 = __importDefault(require("./CursorStore"));
const SqlDatabase = __importStar(require("./SqlDatabase"));
const MessageRouter_1 = __importDefault(require("./MessageRouter"));
const random_access_memory_1 = __importDefault(require("random-access-memory"));
const random_access_file_1 = __importDefault(require("random-access-file"));
const KeyStore_1 = __importDefault(require("./KeyStore"));
const ReplicationManager_1 = __importDefault(require("./ReplicationManager"));
const Crypto = __importStar(require("./Crypto"));
debug_1.default.formatters.b = Keys.encode;
const log = debug_1.default('repo:backend');
class RepoBackend {
    constructor(opts) {
        this.actors = new Map();
        this.docs = new Map();
        this.toFrontend = new Queue_1.default('repo:back:toFrontend');
        this.startFileServer = (path) => {
            if (this.fileServer.isListening())
                return;
            this.fileServer.listen(path).then(() => {
                this.toFrontend.push({
                    type: 'FileServerReadyMsg',
                    path,
                });
            });
        };
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
        this.getReadyActor = (actorId) => {
            const publicKey = Keys.decode(actorId);
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
                    const doc = msg.doc;
                    const goodClock = this.getGoodClock(doc);
                    this.toFrontend.push({
                        type: 'ReadyMsg',
                        id: doc.id,
                        minimumClockSatisfied: !!goodClock,
                        actorId: doc.actorId,
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
                    const doc = msg.doc;
                    const goodClock = this.getGoodClock(doc);
                    if (goodClock) {
                        this.clocks.update(this.id, doc.id, goodClock);
                    }
                    this.toFrontend.push({
                        type: 'PatchMsg',
                        id: doc.id,
                        minimumClockSatisfied: !!goodClock,
                        patch: msg.patch,
                        history: msg.history,
                    });
                    break;
                }
                case 'LocalPatchMsg': {
                    const doc = msg.doc;
                    if (!doc.actorId)
                        return;
                    this.actor(doc.actorId).writeChange(msg.change);
                    const goodClock = this.getGoodClock(doc);
                    if (goodClock) {
                        this.clocks.update(this.id, doc.id, goodClock);
                    }
                    this.toFrontend.push({
                        type: 'PatchMsg',
                        id: doc.id,
                        minimumClockSatisfied: !!goodClock,
                        patch: msg.patch,
                        history: msg.history,
                    });
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
            const docsWithActor = this.cursors.docsWithActor(this.id, actorId);
            const cursors = docsWithActor.map((docId) => ({
                docId: docId,
                cursor: this.cursors.get(this.id, docId),
            }));
            const clocks = docsWithActor.map((docId) => ({
                docId: docId,
                clock: this.clocks.get(this.id, docId),
            }));
            this.messages.sendToPeer(peer, {
                type: 'CursorMessage',
                cursors,
                clocks,
            });
        };
        this.onMessage = ({ sender, msg }) => {
            switch (msg.type) {
                case 'CursorMessage': {
                    const { clocks, cursors } = msg;
                    // TODO: ClockStore and CursorStore will both have updateQs, but we probably want to
                    // wait to act for any given doc until both the ClockStore and CursorStore are updated
                    // for that doc.
                    clocks.forEach((clock) => this.clocks.update(sender.id, clock.docId, clock.clock));
                    cursors.forEach((cursor) => {
                        // TODO: Current behavior is to always expand our own cursor with our peers' cursors.
                        // In the future, we might want to be more selective.
                        this.cursors.update(sender.id, cursor.docId, cursor.cursor);
                        this.cursors.update(this.id, cursor.docId, cursor.cursor);
                    });
                    // TODO: This emulates the syncReadyActors behavior from RemotaMetadata messages,
                    // but is extremely wasteful. We'll able to trim this once we have DocumentStore.
                    // TODO: Use a CursorStore updateQ to manage this behavior.
                    cursors.forEach(({ cursor }) => {
                        const actors = Clock.actors(cursor);
                        this.syncReadyActors(actors);
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
                    // TODO: DocumentStore or FeedStore should manage this.
                    this.meta.setWritable(actor.id, msg.writable);
                    // Broadcast latest document information to peers.
                    const docsWithActor = this.cursors.docsWithActor(this.id, actor.id);
                    const cursors = docsWithActor.map((docId) => ({
                        docId: docId,
                        cursor: this.cursors.get(this.id, docId),
                    }));
                    const clocks = docsWithActor.map((docId) => ({
                        docId: docId,
                        clock: this.clocks.get(this.id, docId),
                    }));
                    const discoveryIds = docsWithActor.map(Misc_1.toDiscoveryId);
                    const peers = this.replication.getPeersWith(discoveryIds);
                    this.messages.sendToPeers(peers, {
                        type: 'CursorMessage',
                        cursors: cursors,
                        clocks: clocks,
                    });
                    break;
                }
                case 'ActorSync':
                    log('ActorSync', msg.actor.id);
                    this.syncChanges(msg.actor);
                    break;
                case 'Download':
                    this.cursors.docsWithActor(this.id, msg.actor.id).forEach((docId) => {
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
            const docIds = this.cursors.docsWithActor(this.id, actorId);
            docIds.forEach((docId) => {
                const doc = this.docs.get(docId);
                if (doc) {
                    doc.ready.push(() => {
                        const max = this.cursors.entry(this.id, docId, actorId);
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
        this.handleQuery = (id, query) => __awaiter(this, void 0, void 0, function* () {
            switch (query.type) {
                case 'EncryptionKeyPairMsg': {
                    const keyPair = Crypto.encodedEncryptionKeyPair();
                    this.toFrontend.push({
                        type: 'Reply',
                        id,
                        payload: { type: 'EncryptionKeyPairReplyMsg', success: true, keyPair },
                    });
                    break;
                }
                case 'BoxMsg': {
                    let payload;
                    try {
                        const [box, nonce] = Crypto.box(query.senderSecretKey, query.recipientPublicKey, Buffer.from(query.message));
                        payload = { type: 'BoxReplyMsg', success: true, box, nonce };
                    }
                    catch (_a) {
                        payload = { type: 'BoxReplyMsg', success: false };
                    }
                    this.toFrontend.push({ type: 'Reply', id, payload });
                    break;
                }
                case 'OpenBoxMsg': {
                    let payload;
                    try {
                        const message = Crypto.openBox(query.senderPublicKey, query.recipientSecretKey, query.box, query.nonce);
                        payload = { type: 'OpenBoxReplyMsg', success: true, message: message.toString() };
                    }
                    catch (_b) {
                        payload = { type: 'OpenBoxReplyMsg', success: false };
                    }
                    this.toFrontend.push({ type: 'Reply', id, payload });
                    break;
                }
                case 'SealedBoxMsg': {
                    let payload;
                    try {
                        const sealedBox = Crypto.sealedBox(query.publicKey, Buffer.from(query.message));
                        payload = { type: 'SealedBoxReplyMsg', success: true, sealedBox };
                    }
                    catch (_c) {
                        payload = { type: 'SealedBoxReplyMsg', success: false };
                    }
                    this.toFrontend.push({ type: 'Reply', id, payload });
                    break;
                }
                case 'OpenSealedBoxMsg': {
                    let payload;
                    try {
                        const message = Crypto.openSealedBox(query.keyPair, query.sealedBox);
                        payload = { type: 'OpenSealedBoxReplyMsg', success: true, message: message.toString() };
                    }
                    catch (_d) {
                        payload = { type: 'OpenSealedBoxReplyMsg', success: false };
                    }
                    this.toFrontend.push({ type: 'Reply', id, payload });
                    break;
                }
                case 'SignMsg': {
                    let payload;
                    try {
                        const signature = yield this.feeds.sign(query.docId, Buffer.from(query.message));
                        payload = {
                            type: 'SignReplyMsg',
                            success: true,
                            signature: signature,
                        };
                    }
                    catch (_e) {
                        payload = { type: 'SignReplyMsg', success: false };
                    }
                    this.toFrontend.push({
                        type: 'Reply',
                        id,
                        payload,
                    });
                    break;
                }
                case 'VerifyMsg': {
                    let success;
                    try {
                        success = this.feeds.verify(query.docId, Buffer.from(query.message), query.signature);
                    }
                    catch (_f) {
                        success = false;
                    }
                    this.toFrontend.push({
                        type: 'Reply',
                        id,
                        payload: {
                            type: 'VerifyReplyMsg',
                            success,
                        },
                    });
                    break;
                }
                case 'MetadataMsg': {
                    // TODO: We're recreating the MetadataMsg which used to live in Metadata.ts
                    // Its not clear if this is used or useful. It looks like the data (which is faithfully
                    // represented below - empty clock and 0 history in all) is already somewhat broken.
                    // NOTE: Responses to file metadata won't reply until the ledger is fully loaded. Document
                    // responses will respond immediately.
                    this.meta.readyQ.push(() => {
                        let payload;
                        if (this.meta.isDoc(query.id)) {
                            const cursor = this.cursors.get(this.id, query.id);
                            const actors = Clock.actors(cursor);
                            payload = {
                                type: 'Document',
                                clock: {},
                                history: 0,
                                actor: this.localActorId(query.id),
                                actors,
                            };
                        }
                        else if (this.meta.isFile(query.id)) {
                            payload = this.meta.fileMetadata(query.id);
                        }
                        else {
                            payload = null;
                        }
                        this.toFrontend.push({
                            type: 'Reply',
                            id,
                            payload: { type: 'MetadataReplyMsg', metadata: payload },
                        });
                    });
                    break;
                }
                case 'MaterializeMsg': {
                    const doc = this.docs.get(query.id);
                    const changes = doc.back
                        .getIn(['opSet', 'history'])
                        .slice(0, query.history)
                        .toArray();
                    const [, patch] = automerge_1.Backend.applyChanges(automerge_1.Backend.init(), changes);
                    this.toFrontend.push({ type: 'Reply', id, payload: { type: 'MaterializeReplyMsg', patch } });
                    break;
                }
            }
        });
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
                    this.create(Keys.decodePair(msg));
                    break;
                }
                case 'MergeMsg': {
                    this.merge(msg.id, Clock.strs2clock(msg.actors));
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
                    console.log('Destroy is a noop');
                    //this.destroy(msg.id)
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
        this.feeds = new FeedStore_1.default(this.db, (path) => this.storageFn('feeds/' + path));
        this.files = new FileStore_1.default(this.feeds);
        // init repo
        const repoKeys = this.keys.get('self.repo') || this.keys.set('self.repo', Keys.createBuffer());
        this.swarmKey = repoKeys.publicKey;
        this.id = Misc_1.encodeRepoId(repoKeys.publicKey);
        // initialize the various stores
        this.cursors = new CursorStore_1.default(this.db);
        this.clocks = new ClockStore_1.default(this.db);
        this.fileServer = new FileServer_1.default(this.files);
        this.replication = new ReplicationManager_1.default(this.feeds);
        this.meta = new Metadata_1.Metadata(this.storageFn);
        this.network = new Network_1.default(toPeerId(this.id));
        this.messages = new MessageRouter_1.default('HypermergeMessages');
        for (const docId of this.cursors.getAllDocumentIds(this.id)) {
            this.network.join(Misc_1.toDiscoveryId(docId));
        }
        this.cursors.updateQ.subscribe(([_, docId]) => {
            this.network.join(Misc_1.toDiscoveryId(docId));
        });
        this.files.writeLog.subscribe((header) => {
            this.meta.addFile(header.url, header.size, header.mimeType);
        });
        this.messages.inboxQ.subscribe(this.onMessage);
        this.replication.discoveryQ.subscribe(this.onDiscovery);
        this.network.peerQ.subscribe(this.onPeer);
    }
    create(keys) {
        const docId = Misc_1.encodeDocId(keys.publicKey);
        log('create', docId);
        const doc = new DocBackend.DocBackend(docId, automerge_1.Backend.init());
        doc.updateQ.subscribe(this.documentNotify);
        // HACK: We set a clock value of zero so we have a clock in the clock store
        // TODO: This isn't right.
        this.clocks.set(this.id, doc.id, { [doc.id]: 0 });
        this.docs.set(docId, doc);
        this.cursors.addActor(this.id, doc.id, Misc_1.rootActorId(doc.id));
        this.initActor(keys);
        return doc;
    }
    // TODO: Temporary solution to replace meta.localActorId
    // We only know if an actor is local/writable if we have already
    // opened that actor. We should be storing this information somewhere
    // more readily available - either in FeedStore or DocumentStore.
    localActorId(docId) {
        const cursor = this.cursors.get(this.id, docId);
        const actors = Clock.actors(cursor);
        return actors.find((actorId) => this.meta.isWritable(actorId));
    }
    debug(id) {
        const doc = this.docs.get(id);
        const short = id.substr(0, 5);
        if (doc === undefined) {
            console.log(`doc:backend NOT FOUND id=${short}`);
        }
        else {
            console.log(`doc:backend id=${short}`);
            console.log(`doc:backend clock=${Clock.clockDebug(doc.clock)}`);
            const local = this.localActorId(id);
            const cursor = this.cursors.get(this.id, id);
            const actors = Clock.actors(cursor);
            const info = actors
                .map((actor) => {
                const nm = actor.substr(0, 5);
                return local === actor ? `*${nm}` : nm;
            })
                .sort();
            console.log(`doc:backend actors=${info.join(',')}`);
        }
    }
    // private destroy(id: DocId) {
    //   this.meta.delete(id)
    //   const doc = this.docs.get(id)
    //   if (doc) {
    //     this.docs.delete(id)
    //   }
    //   const actors = this.meta.allActors()
    //   this.actors.forEach((actor, id) => {
    //     if (!actors.has(id)) {
    //       console.log('Orphaned actors - will purge', id)
    //       this.actors.delete(id)
    //       this.leave(actor.id)
    //       actor.destroy()
    //     }
    //   })
    // }
    // opening a file fucks it up
    open(docId) {
        //    log("open", docId, this.meta.forDoc(docId));
        // TODO: FileStore should answer this.
        // NOTE: This isn't guaranteed to be correct. `meta.isFile` can return an incorrect answer
        // if the metadata ledger hasn't finished loading.
        if (this.meta.isFile(docId)) {
            throw new Error('trying to open a file like a document');
        }
        let doc = this.docs.get(docId);
        if (!doc) {
            doc = new DocBackend.DocBackend(docId);
            doc.updateQ.subscribe(this.documentNotify);
        }
        if (!this.docs.has(docId)) {
            this.docs.set(docId, doc);
            // TODO: It isn't always correct to add this actor with an Infinity cursor entry.
            // If we don't have a cursor for the document, we should wait to get one from a peer.
            // For now, we're mirroring legacy behavior.
            this.cursors.addActor(this.id, docId, Misc_1.rootActorId(docId));
            this.loadDocument(doc);
        }
        return doc;
    }
    merge(id, clock) {
        // TODO: Should we do anything additional to note a merge?
        this.cursors.update(this.id, id, clock);
        this.syncReadyActors(Clock.actors(clock));
    }
    allReadyActors(docId) {
        return __awaiter(this, void 0, void 0, function* () {
            const cursor = this.cursors.get(this.id, docId);
            const actorIds = Clock.actors(cursor);
            return Promise.all(actorIds.map(this.getReadyActor));
        });
    }
    loadDocument(doc) {
        return __awaiter(this, void 0, void 0, function* () {
            const actors = yield this.allReadyActors(doc.id);
            log(`load document 2 actors=${actors.map((a) => a.id)}`);
            const changes = [];
            actors.forEach((actor) => {
                const max = this.cursors.entry(this.id, doc.id, actor.id);
                const slice = actor.changes.slice(0, max);
                doc.changes.set(actor.id, slice.length);
                log(`change actor=${Misc_1.ID(actor.id)} changes=0..${slice.length}`);
                changes.push(...slice);
            });
            log(`loading doc=${Misc_1.ID(doc.id)} changes=${changes.length}`);
            // Check to see if we already have a local actor id. If so, re-use it.
            // TODO: DocumentStore can answer this.
            const localActorId = this.localActorId(doc.id);
            const actorId = localActorId
                ? (yield this.getReadyActor(localActorId)).id
                : this.initActorFeed(doc);
            doc.init(changes, actorId);
        });
    }
    initActorFeed(doc) {
        log('initActorFeed', doc.id);
        const keys = Keys.createBuffer();
        const actorId = Misc_1.encodeActorId(keys.publicKey);
        this.cursors.addActor(this.id, doc.id, actorId);
        this.initActor(keys);
        return actorId;
    }
    actorIds(doc) {
        const cursor = this.cursors.get(this.id, doc.id);
        return Clock.actors(cursor);
    }
    docActors(doc) {
        return this.actorIds(doc)
            .map((id) => this.actors.get(id))
            .filter(Misc_1.notEmpty);
    }
    getGoodClock(doc) {
        const minimumClockSatisfied = this.clocks.has(this.id, doc.id);
        return minimumClockSatisfied
            ? doc.clock
            : this.clocks.getMaximumSatisfiedClock(doc.id, doc.clock);
    }
    initActor(keys) {
        const actor = new Actor_1.Actor({
            keys,
            notify: this.actorNotify,
            store: this.feeds,
        });
        this.actors.set(actor.id, actor);
        return actor;
    }
    actor(id) {
        return this.actors.get(id);
    }
}
exports.RepoBackend = RepoBackend;
function ensureDirectoryExists(path) {
    try {
        fs_1.default.mkdirSync(path, { recursive: true });
    }
    catch (e) {
        // On slightly older versions of node, this will throw if the directory already exists
    }
}
function toPeerId(repoId) {
    return repoId;
}
//# sourceMappingURL=RepoBackend.js.map