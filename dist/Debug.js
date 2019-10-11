"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trace = (label) => (x, ...args) => {
    console.log(`${label}:`, x, ...args);
    return x;
};
function assignGlobal(objs) {
    Object.assign(global, objs);
}
exports.assignGlobal = assignGlobal;
//# sourceMappingURL=Debug.js.map