"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trace = (label) => (x, ...args) => {
    console.log(`${label}:`, x, ...args);
    return x;
};
//# sourceMappingURL=Debug.js.map