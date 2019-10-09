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
const Misc_1 = require("./Misc");
const NetworkPeer_1 = __importDefault(require("./NetworkPeer"));
const MapSet_1 = __importDefault(require("./MapSet"));
const Queue_1 = __importDefault(require("./Queue"));
const PeerConnection_1 = __importDefault(require("./PeerConnection"));
class Network {
    constructor(selfId) {
        this.onConnection = (socket, details) => __awaiter(this, void 0, void 0, function* () {
            details.reconnect(false);
            console.log('onConnection', details.type, this.selfId);
            const conn = new PeerConnection_1.default(socket, {
                isClient: details.client,
                type: details.type,
            });
            conn.networkChannel.send({
                type: 'Info',
                peerId: this.selfId,
            });
            const firstMsg = yield conn.networkChannel.receiveQ.first();
            if (firstMsg.type !== 'Info')
                throw new Error('First message must be Info.');
            const { peerId } = firstMsg;
            if (peerId === this.selfId)
                throw new Error('Connected to self.');
            this.getOrCreatePeer(peerId).addConnection(conn);
        });
        this.selfId = selfId;
        this.joined = new Set();
        this.pending = new Set();
        this.peers = new Map();
        this.peerQ = new Queue_1.default('Network:peerQ');
        this.peerDiscoveryIds = new MapSet_1.default();
        this.hosts = new MapSet_1.default();
        this.joinOptions = { announce: true, lookup: true };
    }
    join(discoveryId) {
        if (this.swarm) {
            if (this.joined.has(discoveryId))
                return;
            this.joined.add(discoveryId);
            this.swarm.join(decodeId(discoveryId), this.joinOptions);
            this.pending.delete(discoveryId);
        }
        else {
            this.pending.add(discoveryId);
        }
    }
    leave(discoveryId) {
        this.pending.delete(discoveryId);
        if (!this.joined.has(discoveryId))
            return;
        if (this.swarm)
            this.swarm.leave(decodeId(discoveryId));
        this.joined.delete(discoveryId);
    }
    setSwarm(swarm, joinOptions) {
        if (this.swarm)
            throw new Error('Swarm already exists!');
        if (joinOptions)
            this.joinOptions = joinOptions;
        this.swarm = swarm;
        this.swarm.on('connection', this.onConnection);
        for (const discoveryId of this.pending) {
            this.join(discoveryId);
        }
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.peers.forEach((peer) => {
                peer.close();
            });
            return new Promise((res) => {
                this.swarm ? this.swarm.destroy(res) : res();
            });
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
}
exports.default = Network;
function decodeId(id) {
    return Base58.decode(id);
}
//# sourceMappingURL=Network.js.map