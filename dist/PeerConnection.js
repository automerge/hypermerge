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
const noise_peer_1 = __importDefault(require("noise-peer"));
const multiplex_1 = __importDefault(require("multiplex"));
const MessageBus_1 = __importDefault(require("./MessageBus"));
const pump_1 = __importDefault(require("pump"));
class PeerConnection {
    constructor(rawSocket, info) {
        this.isConfirmed = false;
        this.channels = new Map();
        this.pendingChannels = new Map();
        this.type = info.type;
        this.onClose = info.onClose;
        this.isClient = info.isClient;
        this.rawSocket = rawSocket;
        this.secureStream = noise_peer_1.default(rawSocket, this.isClient);
        this.multiplex = multiplex_1.default();
        this.multiplex.on('stream', (stream, name) => {
            this.pendingChannels.set(name, stream);
        });
        pump_1.default(this.secureStream, this.multiplex, this.secureStream);
        this.networkBus = new MessageBus_1.default(this.openChannel('NetworkMsg'));
    }
    get isOpen() {
        return this.rawSocket.writable;
    }
    get isClosed() {
        return !this.isOpen;
    }
    openChannel(name) {
        if (this.isClosed)
            throw new Error('Connection is closed');
        if (this.channels.has(name))
            throw new Error(`Channel already exists on this connection: ${name}`);
        const channel = this.multiplex.createSharedStream(name);
        const pending = this.pendingChannels.get(name);
        if (pending) {
            this.pendingChannels.delete(name);
            // NOTE(jeff): So... this is a hack. When multiplex receives a stream that
            // we haven't opened, it's not writable. So, we use this hack to connect
            // the pending stream to our newly created channel.
            channel.setReadable(pending);
        }
        this.channels.set(name, channel);
        channel.once('close', () => this.channels.delete(name));
        return channel;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            this.onClose && this.onClose();
            this.rawSocket.destroy();
        });
    }
}
exports.default = PeerConnection;
//# sourceMappingURL=PeerConnection.js.map