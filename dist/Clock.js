"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function equivalent(c1, c2) {
    const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
    for (let actor of actors) {
        if (c1[actor] != c2[actor]) {
            return false;
        }
    }
    return true;
}
exports.equivalent = equivalent;
function union(c1, c2) {
    const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
    let tmp = {};
    actors.forEach(actor => {
        tmp[actor] = Math.max(c1[actor] || 0, c2[actor] || 0);
    });
    return tmp;
}
exports.union = union;
function intersection(c1, c2) {
    const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
    let tmp = {};
    actors.forEach(actor => {
        const val = Math.min(c1[actor] || 0, c2[actor] || 0);
        if (val > 0) {
            tmp[actor] = val;
        }
    });
    return tmp;
}
exports.intersection = intersection;
//# sourceMappingURL=Clock.js.map