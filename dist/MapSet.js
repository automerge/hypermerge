"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class MapSet {
    constructor() {
        this.map = new Map();
    }
    add(key, val) {
        this.merge(key, [val]);
    }
    merge(key, vals) {
        this.map.set(key, new Set([...this.get(key), ...vals]));
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