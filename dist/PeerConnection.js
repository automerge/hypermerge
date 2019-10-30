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
const Multiplex_1 = __importDefault(require("./Multiplex"));
const MessageBus_1 = __importDefault(require("./MessageBus"));
const pump_1 = __importDefault(require("pump"));
class PeerConnection {
    constructor(rawSocket, info) {
        this.isConfirmed = false;
        this.type = info.type;
        this.onClose = info.onClose;
        this.isClient = info.isClient;
        this.rawSocket = rawSocket;
        this.secureStream = noise_peer_1.default(rawSocket, this.isClient);
        this.multiplex = new Multiplex_1.default();
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
        return this.multiplex.openChannel(name);
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