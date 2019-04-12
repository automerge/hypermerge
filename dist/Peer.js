"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This is pretty hacky, but accessing the hypercore peer connection
 * information is messy. Wrap it here.
 */
class HypercorePeer {
    constructor(peer) {
        this.id = peer.remoteId.toString();
        this.peer = peer;
    }
    valueOf() {
        return this.id;
    }
    get conn() {
        return this.peer.stream.stream._readableState.pipes;
    }
    get type() {
        return this.conn._utp ? 'UTP' : this.conn._handle.constructor.name;
    }
    get state() {
        return this.conn._utp ? true : this.conn.readyState;
    }
    get localAddress() {
        if (this.conn._utp) {
            const localAddress = this.conn._utp.address();
            return {
                host: localAddress.address,
                port: localAddress.port
            };
        }
        else {
            return {
                host: this.conn.localAddress,
                port: this.conn.localPort
            };
        }
    }
    get remoteAddress() {
        return {
            host: this.conn.remoteAddress,
            port: this.conn.remotePort
        };
    }
    get bytesReceived() {
        return this.conn._utp ? -1 : this.conn.bytesRead;
    }
    get bytesSent() {
        return this.conn._utp ? -1 : this.conn.bytesWritten;
    }
    sendMessage(subject, payload) {
        this.peer.stream.extension(subject, payload);
    }
    onMessage(subject, callback) {
        this.peer.stream.on(subject, callback);
    }
}
exports.HypercorePeer = HypercorePeer;
//# sourceMappingURL=Peer.js.map