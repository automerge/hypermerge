"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function parse(buffer) {
    // const decoder = new TextDecoder()
    return JSON.parse(buffer.toString());
}
exports.parse = parse;
function bufferify(value) {
    // const encoder = new TextEncoder()
    return Buffer.from(JSON.stringify(value));
}
exports.bufferify = bufferify;
//# sourceMappingURL=JsonBuffer.js.map