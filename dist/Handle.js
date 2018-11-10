"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Handle {
    constructor(front) {
        this.value = null;
        this.counter = 0;
        this.push = (item) => {
            this.value = item;
            if (this.subscription) {
                this.subscription(item, this.counter++);
            }
        };
        this.once = (subscriber) => {
            this.subscribe((doc) => {
                subscriber(doc);
                this.close();
            });
            return this;
        };
        this.subscribe = (subscriber) => {
            if (this.subscription) {
                throw new Error("only one subscriber for a doc handle");
            }
            this.subscription = subscriber;
            if (this.value != null) {
                subscriber(this.value, this.counter++);
            }
            return this;
        };
        this.close = () => {
            this.subscription = undefined;
            this.value = null;
            this.front.releaseHandle(this);
        };
        this.change = (fn) => {
            this.front.change(fn);
            return this;
        };
        this.front = front;
    }
    get id() {
        return this.front.docId;
    }
}
exports.default = Handle;
//# sourceMappingURL=Handle.js.map