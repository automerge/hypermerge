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
const MessageChannel_1 = __importDefault(require("./MessageChannel"));
class PeerConnection {
    constructor(rawSocket, info) {
        this.isConfirmed = false;
        this.channels = new Map();
        this.type = info.type;
        this.isClient = info.isClient;
        this.rawSocket = rawSocket;
        this.secureStream = noise_peer_1.default(rawSocket, this.isClient);
        this.multiplex = multiplex_1.default();
        this.multiplex.on('stream', (_stream, id) => {
            console.log('new stream', id);
        });
        // this.rawSocket.once('close', () => this.close())
        // this.multiplex.once('close', () => this.close())
        // this.secureStream.once('close', () => this.close())
        this.secureStream.pipe(this.multiplex).pipe(this.secureStream);
        this.networkChannel = new MessageChannel_1.default(this.openChannel('NetworkMsg'));
    }
    get isOpen() {
        return !this.isClosed;
    }
    get isClosed() {
        return this.rawSocket.destroyed;
    }
    openChannel(name) {
        if (this.isClosed)
            throw new Error('Connection is closed');
        if (this.channels.has(name))
            throw new Error(`Channel already exists on this connection: ${name}`);
        // NOTE(jeff): Seems to me that this should be createSharedStream(), but it doesn't always work.
        const channel = this.isClient
            ? this.multiplex.receiveStream(name)
            : this.multiplex.createStream(name);
        this.channels.set(name, channel);
        channel.once('close', () => this.channels.delete(name));
        return channel;
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([...this.channels.values()].map((channel) => new Promise((res) => {
                channel.end(() => {
                    res();
                });
            })));
            return new Promise((res) => {
                this.multiplex.end(() => {
                    this.secureStream.end(() => {
                        // this.rawSocket.destroy()
                        res();
                    });
                });
            });
        });
    }
}
exports.default = PeerConnection;
//# sourceMappingURL=PeerConnection.js.map