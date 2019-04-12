"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Communicate document information required to replicate documents and their actors.
 *
 * TODO: Rename. Discover? Advertise?
 *
 * TODO: Clean up dependency on Metadata. The extension should know its own format and
 * translate that to something metadata can use.
 *
 * TODO: Move more of the logic for which peers to send messages to into this module. Will require
 * a data structure representing the actor/peers/document relationships which this module can operate on.
 */
const Metadata = __importStar(require("./Metadata"));
exports.EXTENSION_V2 = "hypermerge.2";
exports.EXTENSION_V3 = "hypermerge.3";
exports.SUPPORTED_EXTENSIONS = [exports.EXTENSION_V2, exports.EXTENSION_V3];
function broadcast(blocks, clocks, peers) {
    const message = { type: "RemoteMetadata", clocks, blocks };
    const payload = Buffer.from(JSON.stringify(message));
    for (let peer of peers) {
        peer.sendMessage(exports.EXTENSION_V3, payload);
    }
}
exports.broadcast = broadcast;
function listen(peer, notify) {
    peer.onMessage("extension", (extension, input) => notify(parseMessage(extension, input)));
}
exports.listen = listen;
function parseMessage(extension, input) {
    switch (extension) {
        case exports.EXTENSION_V2: {
            return { type: "NewMetadata", input };
        }
        case exports.EXTENSION_V3: {
            const message = Metadata.validateRemoteMetadata(input);
            return message;
        }
        default: {
            // Unknown extension type, do nothing.
        }
    }
}
//# sourceMappingURL=DocumentBroadcast.js.map