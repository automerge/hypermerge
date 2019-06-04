"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Handle {
    constructor(repo) {
        this.id = "";
        this.state = null;
        this.clock = null;
        this.counter = 0;
        this.message = (contents) => {
            this.repo.message(this.id, contents);
            return this;
        };
        this.push = (item, clock) => {
            this.state = item;
            this.clock = clock;
            if (this.subscription) {
                this.subscription(item, clock, this.counter++);
            }
        };
        this.pushProgress = (progress) => {
            if (this.progressSubscription) {
                this.progressSubscription(progress);
            }
        };
        this.pushMessage = (contents) => {
            if (this.messageSubscription) {
                this.messageSubscription(contents);
            }
        };
        this.once = (subscriber) => {
            this.subscribe((doc, clock, index) => {
                subscriber(doc, clock, index);
                this.close();
            });
            return this;
        };
        this.subscribe = (subscriber) => {
            if (this.subscription) {
                throw new Error("only one subscriber for a doc handle");
            }
            this.subscription = subscriber;
            if (this.state != null && this.clock != null) {
                subscriber(this.state, this.clock, this.counter++);
            }
            return this;
        };
        this.subscribeProgress = (subscriber) => {
            if (this.progressSubscription) {
                throw new Error("only one progress subscriber for a doc handle");
            }
            this.progressSubscription = subscriber;
            return this;
        };
        this.subscribeMessage = (subscriber) => {
            if (this.messageSubscription) {
                throw new Error("only one progress subscriber for a doc handle");
            }
            this.messageSubscription = subscriber;
            return this;
        };
        this.close = () => {
            this.subscription = undefined;
            this.messageSubscription = undefined;
            this.progressSubscription = undefined;
            this.state = null;
            this.cleanup();
        };
        this.cleanup = () => { };
        this.changeFn = (fn) => { };
        this.change = (fn) => {
            this.changeFn(fn);
            return this;
        };
        this.repo = repo;
    }
    fork() {
        return this.repo.fork(this.id);
    }
    /*
      follow() {
        const id = this.repo.create();
        this.repo.follow(id, this.id);
        return id;
      }
    */
    merge(other) {
        this.repo.merge(this.id, other.id);
        return this;
    }
    debug() {
        this.repo.debug(this.id);
    }
}
exports.Handle = Handle;
//# sourceMappingURL=Handle.js.map