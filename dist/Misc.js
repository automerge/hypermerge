"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function joinSets(sets) {
    const total = [].concat(...sets.map(a => [...a]));
    return new Set(total);
}
exports.joinSets = joinSets;
function ID(_id) {
    return _id.slice(0, 4);
}
exports.ID = ID;
function notEmpty(value) {
    return value !== null && value !== undefined;
}
exports.notEmpty = notEmpty;
//# sourceMappingURL=Misc.js.map