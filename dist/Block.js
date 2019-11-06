"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const zlib = __importStar(require("zlib"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const BROTLI = 'BR';
const { BROTLI_PARAM_MODE, BROTLI_MODE_TEXT, BROTLI_PARAM_SIZE_HINT, BROTLI_PARAM_QUALITY, } = zlib.constants;
function pack(obj) {
    const blockHeader = Buffer.from(BROTLI);
    const source = JsonBuffer.bufferify(obj);
    const blockBody = Buffer.from(zlib.brotliCompressSync(source, {
        params: {
            [BROTLI_PARAM_MODE]: BROTLI_MODE_TEXT,
            [BROTLI_PARAM_SIZE_HINT]: source.length,
            [BROTLI_PARAM_QUALITY]: 11,
        },
    }));
    if (source.length < blockBody.length) {
        return source;
    }
    else {
        return Buffer.concat([blockHeader, blockBody]);
    }
}
exports.pack = pack;
function unpack(data) {
    //if (data.slice(0,2).toString() === '{"') { // an old block before we added compression
    const header = data.slice(0, 2);
    switch (header.toString()) {
        case '{"':
            return JsonBuffer.parse(data);
        case BROTLI:
            return JsonBuffer.parse(Buffer.from(zlib.brotliDecompressSync(data.slice(2))));
        default:
            throw new Error(`fail to unpack blocks - head is '${header}'`);
    }
}
exports.unpack = unpack;
//# sourceMappingURL=Block.js.map