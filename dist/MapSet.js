"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MapSet {
    constructor() {
        this.map = new Map();
    }
    add(key, val) {
        return this.merge(key, [val]);
    }
    keys() {
        return [...this.map.keys()];
    }
    merge(key, vals) {
        const current = this.get(key);
        const change = vals.some(val => !current.has(val));
        if (change) {
            this.map.set(key, new Set([...current, ...vals]));
        }
        return change;
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