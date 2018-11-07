"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Handle {
    constructor() {
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
        };
        this.subscribe = (subscriber) => {
            if (this.subscription) {
                throw new Error("only one subscriber for a doc handle");
            }
            this.subscription = subscriber;
            if (this.value != null) {
                subscriber(this.value, this.counter++);
            }
        };
        this.close = () => {
            this.subscription = undefined;
            this.value = null;
            this.cleanup();
        };
        this.cleanup = () => { };
        this.change = (fn) => { };
    }
}
exports.default = Handle;
//# sourceMappingURL=Handle.js.map