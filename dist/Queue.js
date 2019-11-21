"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Debug_1 = __importDefault(require("./Debug"));
class Queue {
    constructor(name = 'unknown') {
        this.queue = [];
        this.enqueue = (item) => {
            this.log('queued', item);
            this.queue.push(item);
        };
        this.name = name;
        this.log = Debug_1.default(`Queue:${name}`);
        this.push = this.enqueue;
    }
    first() {
        return new Promise((res) => {
            this.once(res);
        });
    }
    drain(fn) {
        while (this.queue.length) {
            const item = this.queue.shift();
            if (item !== undefined)
                fn(item);
        }
    }
    once(subscriber) {
        if (this.subscription === undefined) {
            this.subscribe((item) => {
                this.unsubscribe();
                subscriber(item);
            });
        }
    }
    subscribe(subscriber) {
        if (this.subscription) {
            throw new Error(`${this.name}: only one subscriber at a time to a queue`);
        }
        this.log('subscribe');
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
        this.log('unsubscribe');
        this.subscription = undefined;
        this.push = this.enqueue;
    }
    get length() {
        return this.queue.length;
    }
}
exports.default = Queue;
//# sourceMappingURL=Queue.js.map