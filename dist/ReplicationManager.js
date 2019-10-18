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
const hypercore_protocol_1 = __importDefault(require("hypercore-protocol"));
const Keys = __importStar(require("./Keys"));
const Misc_1 = require("./Misc");
const MessageRouter_1 = __importDefault(require("./MessageRouter"));
const pump_1 = __importDefault(require("pump"));
const MapSet_1 = __importDefault(require("./MapSet"));
const Queue_1 = __importDefault(require("./Queue"));
class ReplicationManager {
    constructor(feeds) {
        /**
         * Call this when a peer connects.
         */
        this.onPeer = (peer) => {
            this.replicating.set(peer, new Set());
            this.messages.listenTo(peer);
            this.getOrCreateProtocol(peer);
            if (peer.weHaveAuthority) {
                // NOTE(jeff): In the future, we should send a smaller/smarter set.
                const discoveryIds = this.feeds.info.allDiscoveryIds();
                this.messages.sendToPeer(peer, {
                    type: 'DiscoveryIds',
                    discoveryIds,
                });
            }
        };
        this.onFeedCreated = ({ discoveryId }) => {
            this.messages.sendToPeers(this.replicating.keys(), {
                type: 'DiscoveryIds',
                discoveryIds: [discoveryId],
            });
        };
        this.onMessage = ({ msg, sender }) => {
            switch (msg.type) {
                case 'DiscoveryIds': {
                    const existingShared = this.replicating.get(sender);
                    const sharedDiscoveryIds = msg.discoveryIds.filter((discoveryId) => !existingShared.has(discoveryId) && this.feeds.info.hasDiscoveryId(discoveryId));
                    this.replicateWith(sender, sharedDiscoveryIds);
                    break;
                }
            }
        };
        this.protocols = new WeakMap();
        this.replicating = new MapSet_1.default();
        this.discoveryQ = new Queue_1.default('ReplicationManager:discoveryQ');
        this.feeds = feeds;
        this.messages = new MessageRouter_1.default('ReplicationManager');
        this.feeds.info.createdQ.subscribe(this.onFeedCreated);
        this.messages.inboxQ.subscribe(this.onMessage);
    }
    getPeersWith(discoveryIds) {
        return Misc_1.joinSets(discoveryIds.map((id) => this.replicating.keysWith(id)));
    }
    close() {
        this.messages.inboxQ.unsubscribe();
    }
    replicateWith(peer, discoveryIds) {
        const protocol = this.getOrCreateProtocol(peer);
        for (const discoveryId of discoveryIds) {
            const publicId = this.feeds.info.getPublicId(discoveryId);
            this.replicating.add(peer, discoveryId);
            if (publicId) {
                // HACK(jeff): The peer has not yet been verified to have this key. They've
                // only _told_ us that they have it:
                this.discoveryQ.push({ feedId: publicId, discoveryId, peer });
                this.feeds.getFeed(publicId).then((feed) => {
                    feed.replicate(protocol, { live: true });
                });
            }
            else {
                console.log('Missing feed id required for replication', { discoveryId });
            }
        }
    }
    getOrCreateProtocol(peer) {
        return Misc_1.getOrCreate(this.protocols, peer.connection, (conn) => {
            const stream = conn.openChannel('FeedReplication');
            const protocol = new hypercore_protocol_1.default(conn.isClient, {
                encrypt: false,
                live: true,
            });
            protocol
                .once('close', () => {
                this.protocols.delete(conn);
            })
                .on('discovery-key', (discoveryKey) => {
                const discoveryId = Keys.encode(discoveryKey);
                // Hypercore verifies that the remote has the feed automatically
                this.replicateWith(peer, [discoveryId]);
            });
            pump_1.default(stream, protocol, stream);
            return protocol;
        });
    }
}
exports.default = ReplicationManager;
//# sourceMappingURL=ReplicationManager.js.map