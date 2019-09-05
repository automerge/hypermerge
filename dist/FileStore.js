"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Metadata_1 = require("./Metadata");
const Keys = __importStar(require("./Keys"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const Queue_1 = __importDefault(require("./Queue"));
const KB = 1024;
// const MB = 1024 * KB
const BLOCK_SIZE = 64 * KB;
const FIRST_DATA_BLOCK = 1;
class FileStore {
    constructor(store) {
        this.store = store;
        this.writeLog = new Queue_1.default();
    }
    header(url) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.store.read(toFeedId(url), 0).then(JsonBuffer.parse);
        });
    }
    read(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const feedId = toFeedId(url);
            return this.store.stream(feedId, FIRST_DATA_BLOCK);
        });
    }
    write(mimeType, length, stream) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = Keys.create();
            const feedId = yield this.store.create(keys);
            const header = {
                type: 'File',
                url: toHyperfileUrl(feedId),
                bytes: length,
                mimeType,
            };
            yield this.store.append(feedId, JsonBuffer.bufferify(header));
            const appendStream = yield this.store.appendStream(feedId);
            return new Promise((res, rej) => {
                stream
                    .pipe(appendStream)
                    .on('error', (err) => rej(err))
                    .on('finish', () => {
                    this.writeLog.push(header);
                    res(header);
                });
            });
        });
    }
}
exports.default = FileStore;
function isHyperfileUrl(url) {
    return /^hyperfile:\/\w+$/.test(url);
}
exports.isHyperfileUrl = isHyperfileUrl;
function toHyperfileUrl(feedId) {
    return `hyperfile:/${feedId}`;
}
function toFeedId(hyperfileUrl) {
    return Metadata_1.validateFileURL(hyperfileUrl);
}
function chunkBuffer(data, blockSize) {
    const chunks = [];
    for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize);
        chunks.push(block);
    }
    return chunks;
}
//# sourceMappingURL=FileStore.js.map