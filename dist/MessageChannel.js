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
const Queue_1 = __importDefault(require("./Queue"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
class MessageChannel {
    constructor(stream) {
        this.onData = (data) => {
            this.receiveQ.push(JsonBuffer.parse(data));
        };
        this.stream = stream;
        this.sendQ = new Queue_1.default('MessageBus:sendQ');
        this.receiveQ = new Queue_1.default('MessageBus:receiveQ');
        this.stream.on('data', this.onData);
        this.stream.once('close', () => this.close());
        this.stream.once('error', () => this.close());
        this.sendQ.subscribe((msg) => {
            this.stream.write(JsonBuffer.bufferify(msg));
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
        this.sendQ.unsubscribe();
        this.receiveQ.unsubscribe();
        this.stream.end();
    }
}
exports.default = MessageChannel;
//# sourceMappingURL=MessageChannel.js.map