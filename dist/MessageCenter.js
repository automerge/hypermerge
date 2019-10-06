"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MessageChannel_1 = __importDefault(require("./MessageChannel"));
const Queue_1 = __importDefault(require("./Queue"));
const Misc_1 = require("./Misc");
class MessageCenter {
    constructor(channelName, network) {
        this.channelName = channelName;
        this.network = network;
        this.channels = new WeakMap();
        this.inboxQ = new Queue_1.default('MessageCenter:inboxQ');
    }
    sendToPeer(peerId, msg) {
        const channel = this.getChannel(peerId);
        channel.send(msg);
    }
    getChannel(peerId) {
        const peer = this.network.peers.get(peerId);
        if (!peer)
            throw new Error(`Missing peer: ${peerId}`);
        return Misc_1.getOrCreate(this.channels, peer.connection, (conn) => {
            const stream = conn.openChannel(this.channelName);
            const channel = new MessageChannel_1.default(stream);
            channel.receiveQ.subscribe(this.inboxQ.push);
            return channel;
        });
    }
}
exports.default = MessageCenter;
//# sourceMappingURL=MessageCenter.js.map