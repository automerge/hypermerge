"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Base58 = __importStar(require("bs58"));
const hypercore_protocol_1 = __importDefault(require("hypercore-protocol"));
const Misc_1 = require("./Misc");
const NetworkPeer_1 = require("./NetworkPeer");
const DocumentBroadcast = __importStar(require("./DocumentBroadcast"));
const FeedStore_1 = require("./FeedStore");
class Network {
    constructor(selfId, store) {
        this.onConnect = (peerInfo) => {
            const protocol = hypercore_protocol_1.default({
                live: true,
                id: NetworkPeer_1.decodePeerId(this.selfId),
                encrypt: false,
                timeout: 10000,
                extensions: DocumentBroadcast.SUPPORTED_EXTENSIONS,
            });
            const onFeedRequested = (discoveryKey) => {
                const discoveryId = Misc_1.encodeDiscoveryId(discoveryKey);
                const feedId = this.joined.get(discoveryId);
                if (!feedId)
                    throw new Error(`Unknown feed: ${discoveryId}`);
                this.store.getFeed(feedId).then((feed) => {
                    feed.replicate({
                        stream: protocol,
                        live: true,
                    });
                });
            };
            protocol.on('feed', onFeedRequested);
            const discoveryKey = peerInfo.channel || peerInfo.discoveryKey;
            if (discoveryKey)
                onFeedRequested(discoveryKey);
            return protocol;
        };
        this.selfId = selfId;
        this.store = store;
        this.joined = new Map();
        this.peers = new Map();
    }
    join(feedId) {
        const id = FeedStore_1.discoveryId(feedId);
        if (this.joined.has(id))
            return;
        if (this.swarm)
            this.swarm.join(decodeId(id));
        this.joined.set(id, feedId);
    }
    leave(feedId) {
        const id = FeedStore_1.discoveryId(feedId);
        if (!this.joined.has(id))
            return;
        if (this.swarm)
            this.swarm.leave(decodeId(id));
        this.joined.delete(id);
    }
    setSwarm(swarm) {
        if (this.swarm)
            throw new Error('Swarm already exists!');
        this.swarm = swarm;
        for (let id of this.joined.keys()) {
            this.swarm.join(decodeId(id));
        }
    }
    close() {
        return new Promise((res) => {
            if (!this.swarm)
                return res();
            this.swarm.discovery.removeAllListeners();
            this.swarm.discovery.close();
            this.swarm.peers.forEach((p) => p.connections.forEach((con) => con.destroy()));
            this.swarm.removeAllListeners();
            res();
        });
    }
}
exports.default = Network;
function decodeId(id) {
    return Base58.decode(id);
}
//# sourceMappingURL=Network.js.map