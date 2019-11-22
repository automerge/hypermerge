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
Object.defineProperty(exports, "__esModule", { value: true });
const Misc_1 = require("./Misc");
const NetworkPeer_1 = __importDefault(require("./NetworkPeer"));
const Queue_1 = __importDefault(require("./Queue"));
const PeerConnection_1 = __importDefault(require("./PeerConnection"));
class Network {
    constructor(selfId) {
        this.onDiscovery = (peerInfo) => {
            const type = peerInfo.local ? 'mdns' : 'dht';
            this.discovered.add(`${type}@${peerInfo.host}:${peerInfo.port}`);
        };
        this.onConnection = (socket, details) => __awaiter(this, void 0, void 0, function* () {
            const conn = new PeerConnection_1.default(socket, {
                isClient: details.client,
                type: details.type,
            });
            conn.onClose = (reason) => {
                var _a, _b;
                if (reason === 'outdated')
                    (_b = (_a = details).ban) === null || _b === void 0 ? void 0 : _b.call(_a);
            };
            const networkBus = conn.openBus('NetworkMsg');
            networkBus.send({
                type: 'Info',
                peerId: this.selfId,
            });
            const firstMsg = yield networkBus.receiveQ.first();
            networkBus.close();
            if (firstMsg.type !== 'Info')
                throw new Error('First message must be Info.');
            const { peerId } = firstMsg;
            if (peerId === this.selfId)
                throw new Error('Connected to self.');
            this.getOrCreatePeer(peerId).addConnection(conn);
        });
        this.selfId = selfId;
        this.joined = new Set();
        this.peers = new Map();
        this.swarms = new Map();
        this.discovered = new Set();
        this.peerQ = new Queue_1.default('Network:peerQ');
    }
    join(discoveryId) {
        if (this.joined.has(discoveryId))
            return;
        this.joined.add(discoveryId);
        for (const swarm of this.swarms.keys()) {
            this.swarmJoin(swarm, discoveryId);
        }
    }
    leave(discoveryId) {
        if (!this.joined.has(discoveryId))
            return;
        this.joined.delete(discoveryId);
        for (const swarm of this.swarms.keys()) {
            this.swarmLeave(swarm, discoveryId);
        }
    }
    /** @deprecated */
    get swarm() {
        return Array.from(this.swarms.keys())[0];
    }
    /**
     * @deprecated Use `addSwarm`
     */
    setSwarm(swarm, joinOptions) {
        this.addSwarm(swarm, joinOptions);
    }
    addSwarm(swarm, joinOptions = { announce: true, lookup: true }) {
        if (this.swarms.has(swarm))
            return;
        this.swarms.set(swarm, joinOptions);
        swarm.on('connection', this.onConnection);
        swarm.on('peer', this.onDiscovery);
        for (const discoveryId of this.joined) {
            this.swarmJoin(swarm, discoveryId);
        }
    }
    removeSwarm(swarm) {
        this.swarms.delete(swarm);
        swarm.off('connection', this.onConnection);
        swarm.off('peer', this.onDiscovery);
    }
    get closedConnectionCount() {
        let count = 0;
        for (const peer of this.peers.values()) {
            count += peer.closedConnectionCount;
        }
        return count;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.peers.forEach((peer) => {
                peer.close();
            });
            yield Promise.all(Array.from(this.swarms.keys()).map((swarm) => this.closeSwarm(swarm)));
        });
    }
    getOrCreatePeer(peerId) {
        return Misc_1.getOrCreate(this.peers, peerId, () => {
            const peer = new NetworkPeer_1.default(this.selfId, peerId);
            peer.connectionQ.subscribe((_conn) => {
                this.peerQ.push(peer);
            });
            return peer;
        });
    }
    closeSwarm(swarm) {
        return new Promise((res) => {
            this.removeSwarm(swarm);
            swarm.destroy(res);
        });
    }
    swarmJoin(swarm, discoveryId) {
        swarm.join(Misc_1.decodeId(discoveryId), this.swarms.get(swarm));
    }
    swarmLeave(swarm, discoveryId) {
        swarm.leave(Misc_1.decodeId(discoveryId));
    }
}
exports.default = Network;
//# sourceMappingURL=Network.js.map