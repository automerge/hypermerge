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
const crypto = __importStar(require("hypercore-crypto"));
const hypercore_crypto_1 = require("hypercore-crypto");
exports.discoveryKey = hypercore_crypto_1.discoveryKey;
function create() {
    return encodePair(crypto.keyPair());
}
exports.create = create;
function createBuffer() {
    return crypto.keyPair();
}
exports.createBuffer = createBuffer;
function decodePair(keys) {
    return {
        publicKey: decode(keys.publicKey),
        secretKey: keys.secretKey ? decode(keys.secretKey) : undefined,
    };
}
exports.decodePair = decodePair;
function encodePair(keys) {
    return {
        publicKey: encode(keys.publicKey),
        secretKey: keys.secretKey ? encode(keys.secretKey) : undefined,
    };
}
exports.encodePair = encodePair;
function decode(key) {
    return Base58.decode(key);
}
exports.decode = decode;
function encode(key) {
    return Base58.encode(key);
}
exports.encode = encode;
//# sourceMappingURL=Keys.js.map