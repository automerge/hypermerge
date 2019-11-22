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
const Misc_1 = require("./Misc");
const Queue_1 = __importDefault(require("./Queue"));
const Keys = __importStar(require("./Keys"));
const WeakCache_1 = __importDefault(require("./WeakCache"));
class NetworkPeer {
    constructor(selfId, id) {
        this.onMsg = (conn) => (msg) => {
            if (msg.type === 'ConfirmConnection') {
                this.confirmConnection(conn);
            }
        };
        this.onConnectionClosed = (conn) => {
            this.pendingConnections.delete(conn);
            if (conn === this.connection) {
                delete this.connection;
                this.pickNewConnection();
            }
        };
        this.isClosing = false;
        this.closedConnectionCount = 0;
        this.pendingConnections = new Set();
        this.connectionQ = new Queue_1.default('NetworkPeer:connectionQ');
        this.selfId = selfId;
        this.id = id;
        this.busCache = new WeakCache_1.default((conn) => conn.openBus('NetworkPeer', this.onMsg(conn)));
    }
    get isConnected() {
        var _a, _b;
        return _b = (_a = this.connection) === null || _a === void 0 ? void 0 : _a.isOpen, (_b !== null && _b !== void 0 ? _b : false);
    }
    /**
     * Determines if we are the authority on which connection to use when
     * duplicate connections are created.
     *
     * @remarks
     * We need to ensure that two peers don't close the other's incoming
     * connection. Comparing our ids ensures only one of the two peers decides
     * which connection to close.
     */
    get weHaveAuthority() {
        return this.selfId > this.id;
    }
    /**
     * Attempts to add a connection to this peer.
     * If this connection is a duplicate of an existing connection, we close it.
     * If we aren't the authority, and we don't have a confirmed connection, we
     * hold onto it and wait for a ConfirmConnection message.
     */
    addConnection(conn) {
        if (this.isClosing)
            return conn.close('shutdown');
        this.pendingConnections.add(conn);
        this.busCache.getOrCreate(conn);
        conn.onClose = () => this.onConnectionClosed(conn);
        if (this.isConnected)
            return;
        if (this.weHaveAuthority) {
            this.confirmConnection(conn);
            return;
        }
    }
    pickNewConnection() {
        if (this.isClosing)
            return;
        if (!this.weHaveAuthority)
            return;
        for (const conn of this.pendingConnections) {
            if (conn.isOpen) {
                this.confirmConnection(conn);
                break;
            }
        }
    }
    confirmConnection(conn) {
        if (this.weHaveAuthority)
            this.send(conn, { type: 'ConfirmConnection' });
        this.connection = conn;
        this.pendingConnections.delete(conn);
        this.connectionQ.push(conn);
    }
    closeConnection(conn) {
        this.closedConnectionCount += 1;
        conn.close('shutdown');
    }
    close() {
        this.isClosing = true;
        if (this.connection)
            this.closeConnection(this.connection);
        for (const pendingConn of this.pendingConnections) {
            this.closeConnection(pendingConn);
        }
    }
    send(conn, msg) {
        this.busCache.getOrCreate(conn).send(msg);
    }
}
exports.default = NetworkPeer;
function encodePeerId(key) {
    return Misc_1.encodeRepoId(key);
}
exports.encodePeerId = encodePeerId;
function decodePeerId(id) {
    return Keys.decode(id);
}
exports.decodePeerId = decodePeerId;
//# sourceMappingURL=NetworkPeer.js.map