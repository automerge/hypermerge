"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Base58 = __importStar(require("bs58"));
function decode(key) {
    return Base58.decode(key);
}
exports.decode = decode;
function encode(key) {
    return Base58.encode(key);
}
exports.encode = encode;
//# sourceMappingURL=Keys.js.map