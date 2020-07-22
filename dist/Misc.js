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
exports.errorMessage = exports.toIpcPath = exports.createMultiPromise = exports.getOrCreate = exports.notEmpty = exports.ID = exports.joinSets = exports.isPlainObject = exports.isString = exports.withoutQuery = exports.isDocUrl = exports.isBaseUrl = exports.hyperfileActorId = exports.rootActorId = exports.toDiscoveryKey = exports.toDiscoveryId = exports.toHyperfileUrl = exports.toDocUrl = exports.encodeHyperfileId = exports.encodeActorId = exports.encodeDocId = exports.encodeRepoId = exports.decodeId = void 0;
const Url = __importStar(require("url"));
const Keys = __importStar(require("./Keys"));
function decodeId(id) {
    return Keys.decode(id);
}
exports.decodeId = decodeId;
function encodeRepoId(repoKey) {
    return Keys.encode(repoKey);
}
exports.encodeRepoId = encodeRepoId;
function encodeDocId(actorKey) {
    return Keys.encode(actorKey);
}
exports.encodeDocId = encodeDocId;
function encodeActorId(actorKey) {
    return Keys.encode(actorKey);
}
exports.encodeActorId = encodeActorId;
function encodeHyperfileId(hyperfileKey) {
    return Keys.encode(hyperfileKey);
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
function toDiscoveryId(id) {
    return Keys.encode(toDiscoveryKey(id));
}
exports.toDiscoveryId = toDiscoveryId;
function toDiscoveryKey(id) {
    return Keys.discoveryKey(Keys.decode(id));
}
exports.toDiscoveryKey = toDiscoveryKey;
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
function isDocUrl(str) {
    return Url.parse(str).protocol === 'hypermerge:';
}
exports.isDocUrl = isDocUrl;
function withoutQuery(url) {
    return url.split('?')[0];
}
exports.withoutQuery = withoutQuery;
function isString(val) {
    return typeof val === 'string';
}
exports.isString = isString;
function isPlainObject(val) {
    return val.constructor === Object.prototype.constructor;
}
exports.isPlainObject = isPlainObject;
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
function getOrCreate(map, key, create) {
    const existing = map.get(key);
    if (existing)
        return existing;
    const created = create(key);
    map.set(key, created);
    return created;
}
exports.getOrCreate = getOrCreate;
/**
 * The returned promise resolves after the `resolver` fn is called `n` times.
 * Promises the last value passed to the resolver.
 */
function createMultiPromise(n, factory) {
    return new Promise((resolve, reject) => {
        const res = (value) => {
            n -= 1;
            if (n === 0)
                resolve(value);
        };
        const rej = (err) => {
            n = -1; // Ensure we never resolve
            reject(err);
        };
        factory(res, rej);
    });
}
exports.createMultiPromise = createMultiPromise;
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
function errorMessage(e) {
    return `${e.name}: ${e.message}`;
}
exports.errorMessage = errorMessage;
//# sourceMappingURL=Misc.js.map