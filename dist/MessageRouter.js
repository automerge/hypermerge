"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Queue_1 = __importDefault(require("./Queue"));
const Misc_1 = require("./Misc");
class MessageRouter {
    constructor(channelName) {
        this.channelName = channelName;
        this.buses = new WeakMap();
        this.inboxQ = new Queue_1.default('MessageCenter:inboxQ');
    }
    listenTo(peer) {
        this.getBus(peer);
    }
    sendToPeers(peers, msg) {
        for (const peer of peers) {
            this.sendToPeer(peer, msg);
        }
    }
    sendToPeer(peer, msg) {
        var _a;
        const bus = this.getBus(peer);
        (_a = bus) === null || _a === void 0 ? void 0 : _a.send(msg);
    }
    getBus(peer) {
        if (!peer.connection)
            return;
        return Misc_1.getOrCreate(this.buses, peer.connection, (conn) => {
            const bus = conn.openBus(this.channelName);
            bus.receiveQ.subscribe((msg) => {
                this.inboxQ.push({
                    sender: peer,
                    channelName: this.channelName,
                    msg,
                });
            });
            return bus;
        });
    }
}
exports.default = MessageRouter;
//# sourceMappingURL=MessageRouter.js.map