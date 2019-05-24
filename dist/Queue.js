"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const debug_1 = __importDefault(require("debug"));
class Queue {
    constructor(name = "unknown") {
        this.queue = [];
        this.enqueue = (item) => {
            this.log("queued", item);
            this.queue.push(item);
        };
        this.log = debug_1.default(`queue:${name}`);
        this.push = this.enqueue;
    }
    once(subscriber) {
        if (this.subscription === undefined) {
            this.subscribe(subscriber);
        }
    }
    subscribe(subscriber) {
        if (this.subscription) {
            throw new Error("only one subscriber at a time to a queue");
        }
        this.log("subscribe");
        this.subscription = subscriber;
        // this is so push(), unsubscribe(), re-subscribe() will processing the backlog
        while (this.subscription === subscriber) {
            const item = this.queue.shift();
            if (item === undefined) {
                this.push = subscriber;
                break;
            }
            subscriber(item);
        }
    }
    unsubscribe() {
        this.log("unsubscribe");
        this.subscription = undefined;
        this.push = this.enqueue;
    }
    get length() {
        return this.queue.length;
    }
}
exports.default = Queue;
//# sourceMappingURL=Queue.js.map