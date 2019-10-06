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
const Misc_1 = require("./Misc");
const Base58 = __importStar(require("bs58"));
const Queue_1 = __importDefault(require("./Queue"));
const hypercore_protocol_1 = __importDefault(require("hypercore-protocol"));
const hypercore_1 = require("./hypercore");
const JsonBuffer = __importStar(require("./JsonBuffer"));
class NetworkPeer {
    constructor(selfId, id) {
        this.selfId = selfId;
        this.id = id;
    }
    get isConnected() {
        if (!this.connection)
            return false;
        return this.connection.isOpen;
    }
    /**
     * Attempts to add a connection to this peer.
     * If this connection is a duplicate of an existing connection, we close it
     * and return `false`.
     */
    addConnection(conn) {
        const existing = this.connection;
        if (existing) {
            if (!this.shouldUseNewConnection(existing, conn)) {
                existing.addDiscoveryIds(conn.discoveryIds);
                conn.close();
                return false;
            }
            conn.addDiscoveryIds(existing.discoveryIds);
            existing.close();
        }
        this.connection = conn;
        return true;
    }
    shouldUseNewConnection(existing, other) {
        if (existing.isClosed)
            return true;
        if (existing.type === 'utp' && other.type === 'tcp')
            return true;
        // We need to ensure that two peers don't close the other's incoming
        // connection. Comparing the initiator's id ensures both peers keep
        // the same connection.
        return existing.initiatorId > other.initiatorId;
    }
    close() {
        if (this.connection)
            this.connection.close();
    }
}
exports.default = NetworkPeer;
class PeerConnection {
    constructor(socket, networkMessages, info) {
        this.selfId = info.selfId;
        this.peerId = info.peerId;
        this.type = info.type;
        this.isClient = info.isClient;
        this.protocol = networkMessages.protocol;
        this.networkMessages = networkMessages; // For messages internal to Network
        this.messages = new MessageBus(this.protocol, exports.GENERIC_MESSAGE_BUS_KEY);
        this.socket = socket;
        this.discoveryIds = new Set();
        this.discoveryQ = new Queue_1.default('PeerConnection:discoveryQ');
        this.protocol.on('discovery-key', (dk) => {
            const discoveryId = Misc_1.encodeDiscoveryId(dk);
            if (discoveryId === this.messages.discoveryId)
                return;
            if (discoveryId === this.networkMessages.discoveryId)
                return;
            this.addDiscoveryId(discoveryId);
        });
    }
    static fromSocket(socket, selfId, details) {
        return __awaiter(this, void 0, void 0, function* () {
            details.reconnect(false);
            const protocol = new hypercore_protocol_1.default(details.client, {
                encrypt: true,
                timeout: 10000,
            });
            socket.pipe(protocol).pipe(socket);
            const networkBus = new MessageBus(protocol, exports.NETWORK_MESSAGE_BUS_KEY);
            networkBus.send({
                type: 'Info',
                peerId: selfId,
            });
            const info = yield networkBus.receiveQ.first();
            if (info.type !== 'Info')
                throw new Error('First message must be InfoMsg.');
            const { peerId } = info;
            const conn = new PeerConnection(socket, networkBus, {
                type: details.type,
                peerId,
                selfId,
                isClient: details.client,
            });
            if (details.peer && details.peer.topic) {
                conn.addDiscoveryId(Misc_1.encodeDiscoveryId(details.peer.topic));
            }
            return conn;
        });
    }
    get isOpen() {
        return !this.isClosed;
    }
    get isClosed() {
        return this.socket.destroyed;
    }
    get initiatorId() {
        return this.isClient ? this.peerId : this.selfId;
    }
    addDiscoveryIds(ids) {
        for (const id of ids) {
            this.addDiscoveryId(id);
        }
    }
    addDiscoveryId(discoveryId) {
        if (this.discoveryIds.has(discoveryId))
            return;
        this.discoveryIds.add(discoveryId);
        this.discoveryQ.push(discoveryId);
    }
    close() {
        this.networkMessages.close();
        this.messages.close();
        this.protocol.finalize();
        // this.socket.destroy()
    }
}
exports.PeerConnection = PeerConnection;
exports.NETWORK_MESSAGE_BUS_KEY = Buffer.alloc(32, 1);
exports.GENERIC_MESSAGE_BUS_KEY = Buffer.alloc(32, 2);
class MessageBus {
    constructor(protocol, key) {
        this.key = key;
        this.discoveryId = Misc_1.encodeDiscoveryId(hypercore_1.discoveryKey(key));
        this.sendQ = new Queue_1.default('MessageBus:sendQ');
        this.receiveQ = new Queue_1.default('MessageBus:receiveQ');
        this.protocol = protocol;
        this.channel = protocol.open(this.key, {
            onextension: (_ext, data) => {
                this.receiveQ.push(JsonBuffer.parse(data));
            },
        });
        this.channel.options({
            extensions: ['hypermerge-message-bus'],
            ack: false,
        });
        this.sendQ.subscribe((msg) => {
            this.channel.extension(0, JsonBuffer.bufferify(msg));
        });
    }
    send(msg) {
        this.sendQ.push(msg);
    }
    subscribe(onMsg) {
        this.receiveQ.subscribe(onMsg);
    }
    unsubscribe() {
        this.receiveQ.unsubscribe();
    }
    close() {
        this.protocol.close(this.key);
        this.receiveQ.unsubscribe();
        this.sendQ.unsubscribe();
    }
}
exports.MessageBus = MessageBus;
function isPeerId(str) {
    return Base58.decode(str).length === 32;
}
exports.isPeerId = isPeerId;
function encodePeerId(buffer) {
    return Misc_1.encodeDiscoveryId(buffer);
}
exports.encodePeerId = encodePeerId;
function decodePeerId(id) {
    return Base58.decode(id);
}
exports.decodePeerId = decodePeerId;
//# sourceMappingURL=NetworkPeer.js.map