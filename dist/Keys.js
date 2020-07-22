"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encode = exports.decode = exports.encodePair = exports.decodePair = exports.createBuffer = exports.create = exports.discoveryKey = void 0;
const Base58 = __importStar(require("bs58"));
const crypto = __importStar(require("hypercore-crypto"));
const hypercore_crypto_1 = require("hypercore-crypto");
Object.defineProperty(exports, "discoveryKey", { enumerable: true, get: function () { return hypercore_crypto_1.discoveryKey; } });
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