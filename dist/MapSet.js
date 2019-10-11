"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MapSet {
    constructor() {
        this.map = new Map();
    }
    add(key, val) {
        return this.merge(key, [val]);
    }
    values() {
        return [...this.map.values()];
    }
    union() {
        const acc = [];
        for (const set of this.map.values()) {
            acc.push(...set);
        }
        return new Set(acc);
    }
    keys() {
        return [...this.map.keys()];
    }
    merge(key, vals) {
        const current = this.get(key);
        const change = vals.some((val) => !current.has(val));
        if (change) {
            this.map.set(key, new Set([...current, ...vals]));
        }
        return change;
    }
    delete(key) {
        const old = this.get(key);
        this.map.delete(key);
        return old;
    }
    remove(key, val) {
        this.get(key).delete(val);
    }
    keysWith(val) {
        const keys = new Set();
        this.map.forEach((vals, key) => {
            if (vals.has(val)) {
                keys.add(key);
            }
        });
        return keys;
    }
    get(key) {
        return this.map.get(key) || new Set();
    }
    has(key, val) {
        return this.get(key).has(val);
    }
}
exports.default = MapSet;
//# sourceMappingURL=MapSet.js.map