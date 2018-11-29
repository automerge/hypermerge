"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Handle {
    constructor(repo) {
        this.id = "";
        this.state = null;
        this.clock = null;
        this.counter = 0;
        this.push = (item, clock) => {
            this.state = item;
            this.clock = clock;
            if (this.subscription) {
                this.subscription(item, clock, this.counter++);
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
        this.close = () => {
            this.subscription = undefined;
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
        if (this.clock === null)
            throw new Error("cant fork a handle without state");
        const id = this.repo.create();
        this.repo.merge(id, this.clock);
        return id;
    }
    merge(other) {
        if (other.clock === null)
            throw new Error("cant merge a handle without state");
        this.repo.merge(this.id, other.clock);
        return this;
    }
    follow() {
        const id = this.repo.create();
        this.repo.follow(id, this.id);
        return id;
    }
    debug() {
        this.repo.debug(this.id);
    }
}
exports.default = Handle;
//# sourceMappingURL=Handle.js.map