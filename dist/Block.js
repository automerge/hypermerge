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
exports.unpack = exports.pack = void 0;
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