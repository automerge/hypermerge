"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MessageChannel_1 = __importDefault(require("./MessageChannel"));
const Queue_1 = __importDefault(require("./Queue"));
const Misc_1 = require("./Misc");
class MessageCenter {
    constructor(channelName) {
        this.channelName = channelName;
        this.channels = new WeakMap();
        this.inboxQ = new Queue_1.default('MessageCenter:inboxQ');
    }
    listenTo(peer) {
        this.getChannel(peer);
    }
    sendToPeers(peers, msg) {
        for (const peer of peers) {
            this.sendToPeer(peer, msg);
        }
    }
    sendToPeer(peer, msg) {
        const channel = this.getChannel(peer);
        channel.send(msg);
    }
    getChannel(peer) {
        return Misc_1.getOrCreate(this.channels, peer.connection, (conn) => {
            const channel = new MessageChannel_1.default(conn.openChannel(this.channelName));
            channel.receiveQ.subscribe((msg) => {
                this.inboxQ.push({
                    sender: peer,
                    channelName: this.channelName,
                    msg,
                });
            });
            return channel;
        });
    }
}
exports.default = MessageCenter;
//# sourceMappingURL=MessageCenter.js.map