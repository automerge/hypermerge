"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function parse(buffer) {
    return JSON.parse(buffer.toString());
}
exports.parse = parse;
function bufferify(value) {
    return Buffer.from(JSON.stringify(value));
}
exports.bufferify = bufferify;
function parseAllValid(buffers) {
    const out = [];
    for (let i = 0; i < buffers.length; i++) {
        try {
            out.push(parse(buffers[i]));
        }
        catch (e) {
            console.warn(`Found invalid JSON in buffer ${i}`, e);
            continue;
        }
    }
    return out;
}
exports.parseAllValid = parseAllValid;
//# sourceMappingURL=JsonBuffer.js.map