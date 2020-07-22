"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Queue_1 = __importDefault(require("./Queue"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
class MessageBus {
    constructor(stream, subscriber) {
        this.onData = (data) => {
            this.receiveQ.push(JsonBuffer.parse(data));
        };
        this.stream = stream;
        this.sendQ = new Queue_1.default('MessageBus:sendQ');
        this.receiveQ = new Queue_1.default('MessageBus:receiveQ');
        this.stream
            .on('data', this.onData)
            .once('close', () => this.close())
            .once('error', () => this.close());
        this.sendQ.subscribe((msg) => {
            this.stream.write(JsonBuffer.bufferify(msg));
        });
        if (subscriber)
            this.subscribe(subscriber);
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
exports.default = MessageBus;
//# sourceMappingURL=MessageBus.js.map