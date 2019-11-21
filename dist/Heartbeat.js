"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Heartbeat {
    constructor(ms, { onBeat, onTimeout }) {
        this.ms = ms;
        this.beating = false;
        this.interval = new Interval(ms, onBeat);
        this.timeout = new Timeout(ms * 10, () => {
            this.stop();
            onTimeout();
        });
    }
    start() {
        if (this.beating)
            return this;
        this.interval.start();
        this.timeout.start();
        this.beating = true;
        return this;
    }
    stop() {
        if (!this.beating)
            return this;
        this.interval.stop();
        this.timeout.stop();
        this.beating = false;
        return this;
    }
    bump() {
        if (!this.beating)
            return;
        this.timeout.bump();
    }
}
exports.default = Heartbeat;
class Interval {
    constructor(ms, onInterval) {
        this.ms = ms;
        this.onInterval = onInterval;
    }
    start() {
        this.stop();
        const id = setInterval(() => {
            this.onInterval();
        }, this.ms);
        this.stop = () => {
            clearInterval(id);
            delete this.stop;
        };
    }
    stop() { }
}
exports.Interval = Interval;
class Timeout {
    constructor(ms, onTimeout) {
        this.ms = ms;
        this.onTimeout = onTimeout;
    }
    start() {
        this.bump();
    }
    stop() { }
    bump() {
        this.stop();
        const id = setTimeout(() => {
            delete this.stop;
            this.stop();
            this.onTimeout();
        }, this.ms);
        this.stop = () => {
            delete this.stop;
            clearTimeout(id);
        };
    }
}
exports.Timeout = Timeout;
//# sourceMappingURL=Heartbeat.js.map