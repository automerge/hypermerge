"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Misc_1 = require("./Misc");
const Base58 = __importStar(require("bs58"));
class NetworkPeer {
    constructor(id) {
        this.id = id;
    }
}
exports.default = NetworkPeer;
function encodePeerId(buffer) {
    return Misc_1.encodeDiscoveryId(buffer);
}
exports.encodePeerId = encodePeerId;
function decodePeerId(id) {
    return Base58.decode(id);
}
exports.decodePeerId = decodePeerId;
//# sourceMappingURL=NetworkPeer.js.map