"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Misc_1 = require("./Misc");
class WeakCache extends WeakMap {
    constructor(create) {
        super();
        this.create = create;
    }
    getOrCreate(key) {
        return Misc_1.getOrCreate(this, key, this.create);
    }
}
exports.default = WeakCache;
//# sourceMappingURL=WeakCache.js.map