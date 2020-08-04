"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Debug_1 = __importDefault(require("./Debug"));
const noise_peer_1 = __importDefault(require("noise-peer"));
const Multiplex_1 = __importDefault(require("./Multiplex"));
const MessageBus_1 = __importDefault(require("./MessageBus"));
const pump_1 = __importDefault(require("pump"));
const uuid_1 = require("uuid");
const StreamLogic_1 = require("./StreamLogic");
const Heartbeat_1 = __importDefault(require("./Heartbeat"));
const log = Debug_1.default('PeerConnection');
const VERSION_PREFIX = Buffer.from('hypermerge.v2');
class PeerConnection {
    constructor(rawSocket, info) {
        this.onMsg = (msg) => {
            this.heartbeat.bump();
            switch (msg.type) {
                case 'Id':
                    this.id = msg.id;
                    break;
            }
        };
        this.type = info.type;
        this.isClient = info.isClient;
        this.heartbeat = new Heartbeat_1.default(2000, {
            onBeat: () => this.internalBus.send({ type: 'Heartbeat' }),
            onTimeout: () => this.close('timeout'),
        }).start();
        this.rawSocket = rawSocket;
        this.secureStream = noise_peer_1.default(rawSocket, this.isClient);
        this.multiplex = new Multiplex_1.default();
        const prefixMatch = new StreamLogic_1.PrefixMatchPassThrough(VERSION_PREFIX);
        this.secureStream.write(VERSION_PREFIX);
        pump_1.default(this.secureStream, prefixMatch, this.multiplex, this.secureStream, (err) => {
            if (err instanceof StreamLogic_1.InvalidPrefixError) {
                this.closeOutdated(err);
            }
        });
        this.internalBus = this.openBus('PeerConnection', this.onMsg);
        if (this.isClient) {
            this.id = uuid_1.v4();
            this.internalBus.send({ type: 'Id', id: this.id });
        }
    }
    get isOpen() {
        return this.rawSocket.writable;
    }
    get isClosed() {
        return !this.isOpen;
    }
    openBus(name, subscriber) {
        return new MessageBus_1.default(this.openChannel(name), subscriber);
    }
    openChannel(name) {
        if (this.isClosed)
            throw new Error('Connection is closed');
        return this.multiplex.openChannel(name);
    }
    close(reason = 'unknown') {
        var _a;
        this.log('Closing connection: %s', reason);
        this.heartbeat.stop();
        this.rawSocket.destroy();
        (_a = this.onClose) === null || _a === void 0 ? void 0 : _a.call(this, reason);
    }
    closeOutdated(err) {
        const { remoteAddress, remotePort } = this.rawSocket;
        const host = `${this.type}@${remoteAddress}:${remotePort}`;
        console.log('Closing connection to outdated peer: %s. Prefix: %s', host, err.actual);
        return this.close('outdated');
    }
    log(str, ...args) {
        log(`[${this.id}] ${str}`, ...args);
    }
}
exports.default = PeerConnection;
//# sourceMappingURL=PeerConnection.js.map