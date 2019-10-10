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
const stream_1 = require("stream");
function encodeRepoId(repoKey) {
    return Base58.encode(repoKey);
}
exports.encodeRepoId = encodeRepoId;
function encodeDocId(actorKey) {
    return Base58.encode(actorKey);
}
exports.encodeDocId = encodeDocId;
function encodeActorId(actorKey) {
    return Base58.encode(actorKey);
}
exports.encodeActorId = encodeActorId;
function encodeDiscoveryId(discoveryKey) {
    return Base58.encode(discoveryKey);
}
exports.encodeDiscoveryId = encodeDiscoveryId;
function encodeHyperfileId(hyperfileKey) {
    return Base58.encode(hyperfileKey);
}
exports.encodeHyperfileId = encodeHyperfileId;
function toDocUrl(docId) {
    return `hypermerge:/${docId}`;
}
exports.toDocUrl = toDocUrl;
function toHyperfileUrl(hyperfileId) {
    return `hyperfile:/${hyperfileId}`;
}
exports.toHyperfileUrl = toHyperfileUrl;
function rootActorId(docId) {
    return docId;
}
exports.rootActorId = rootActorId;
function hyperfileActorId(hyperfileId) {
    return hyperfileId;
}
exports.hyperfileActorId = hyperfileActorId;
function isBaseUrl(str) {
    return str.includes(':');
}
exports.isBaseUrl = isBaseUrl;
function joinSets(sets) {
    const total = [].concat(...sets.map((a) => [...a]));
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
function streamToBuffer(stream) {
    return new Promise((res, rej) => {
        const buffers = [];
        stream
            .on('data', (data) => buffers.push(data))
            .on('error', (err) => rej(err))
            .on('end', () => res(Buffer.concat(buffers)));
    });
}
exports.streamToBuffer = streamToBuffer;
function bufferToStream(buffer) {
    return new stream_1.Readable({
        read() {
            this.push(buffer);
            this.push(null);
        },
    });
}
exports.bufferToStream = bufferToStream;
// Windows uses named pipes:
// https://nodejs.org/api/net.html#net_identifying_paths_for_ipc_connections
function toIpcPath(path) {
    return process.platform === 'win32' ? toWindowsNamedPipe(path) : path;
}
exports.toIpcPath = toIpcPath;
// Inspired by node-ipc
// https://github.com/RIAEvangelist/node-ipc/blob/70e03c119b4902d3e74de1f683ab39dd2f634807/dao/socketServer.js#L309
function toWindowsNamedPipe(path) {
    const sanitizedPath = path.replace(/^\//, '').replace(/\//g, '-');
    return `\\\\.\\pipe\\${sanitizedPath}`;
}
//# sourceMappingURL=Misc.js.map