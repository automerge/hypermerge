"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
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
/**
 * Actors provide an interface over the data replication scheme.
 * For dat, this means the actor abstracts over the hypercore and its peers.
 */
const hypercore_1 = require("./hypercore");
const Misc_1 = require("./Misc");
const Queue_1 = __importDefault(require("./Queue"));
const Block = __importStar(require("./Block"));
const Keys = __importStar(require("./Keys"));
const debug_1 = __importDefault(require("debug"));
const log = debug_1.default('repo:actor');
class Actor {
    constructor(config) {
        this.changes = [];
        this.peers = new Map();
        this.getOrCreateFeed = (keys) => __awaiter(this, void 0, void 0, function* () {
            let feedId;
            if (keys.secretKey) {
                feedId = yield this.store.create(keys);
            }
            else {
                feedId = keys.publicKey;
            }
            return this.store.getFeed(feedId);
        });
        this.onFeedReady = (feed) => __awaiter(this, void 0, void 0, function* () {
            this.notify({ type: 'ActorFeedReady', actor: this, writable: feed.writable });
            feed.on('peer-remove', this.onPeerRemove);
            feed.on('peer-add', this.onPeerAdd);
            feed.on('download', this.onDownload);
            feed.on('sync', this.onSync);
            feed.on('close', this.close);
            let hasData = false;
            let sequenceNumber = 0;
            const data = yield this.store.stream(this.id);
            data.on('data', (chunk) => {
                this.parseBlock(chunk, sequenceNumber);
                sequenceNumber += 1;
                hasData = true;
            });
            data.on('end', () => {
                this.notify({ type: 'ActorInitialized', actor: this });
                this.q.subscribe((f) => f(this));
                if (hasData)
                    this.onSync();
            });
        });
        // Note: on Actor ready, not Feed!
        this.onReady = (cb) => {
            this.q.push(cb);
        };
        this.onPeerAdd = (peer) => {
            log('peer-add feed', Misc_1.ID(this.id), peer.remoteId);
            // peer-add is called multiple times. Noop if we already know about this peer.
            if (this.peers.has(peer.remoteId.toString()))
                return;
            this.peers.set(peer.remoteId.toString(), peer);
            this.notify({ type: 'PeerAdd', actor: this, peer: peer });
            this.notify({ type: 'PeerUpdate', actor: this, peers: this.peers.size });
        };
        this.onPeerRemove = (peer) => {
            this.peers.delete(peer.remoteId.toString());
            this.notify({ type: 'PeerUpdate', actor: this, peers: this.peers.size });
        };
        this.onDownload = (index, data) => {
            this.parseBlock(data, index);
            const time = Date.now();
            const size = data.byteLength;
            this.notify({ type: 'Download', actor: this, index, size, time });
        };
        this.onSync = () => {
            log('sync feed', Misc_1.ID(this.id));
            this.notify({ type: 'ActorSync', actor: this });
        };
        this.onClose = () => {
            this.close();
        };
        this.parseBlock = (data, index) => {
            const change = Block.unpack(data); // no validation of Change
            this.changes[index] = change;
            log(`block xxx idx=${index} actor=${Misc_1.ID(change.actor)} seq=${change.seq}`);
        };
        this.close = () => {
            return this.store.close(this.id);
        };
        this.destroy = () => __awaiter(this, void 0, void 0, function* () {
            yield this.close();
            this.store.destroy(this.id);
        });
        const { publicKey, secretKey } = config.keys;
        const dk = hypercore_1.discoveryKey(publicKey);
        const id = Misc_1.encodeActorId(publicKey);
        this.id = id;
        this.store = config.store;
        this.notify = config.notify;
        this.dkString = Misc_1.encodeDiscoveryId(dk);
        this.q = new Queue_1.default('repo:actor:Q' + id.slice(0, 4));
        this.getOrCreateFeed(Keys.encodePair(config.keys)).then((feed) => {
            feed.ready(() => this.onFeedReady(feed));
        });
    }
    writeChange(change) {
        const feedLength = this.changes.length;
        const ok = feedLength + 1 === change.seq;
        log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`);
        this.changes.push(change);
        this.onSync();
        this.store.append(this.id, Block.pack(change));
    }
}
exports.Actor = Actor;
//# sourceMappingURL=Actor.js.map