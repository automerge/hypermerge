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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const Misc_1 = require("./Misc");
const Stream = __importStar(require("./StreamLogic"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
class FileServerClient {
    constructor() {
        this.agent = new http.Agent({
            keepAlive: true,
        });
        this.serverPath = new Promise((res) => {
            this.setServerPath = (path) => res(Misc_1.toIpcPath(path));
        });
    }
    write(stream, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            const [req, response] = yield this.request({
                path: '/',
                method: 'POST',
                headers: {
                    'Content-Type': mimeType,
                },
            });
            stream.pipe(req);
            return JsonBuffer.parse(yield Stream.toBuffer(yield response));
        });
    }
    header(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const [req, responsePromise] = yield this.request({
                path: '/' + url,
                method: 'HEAD',
            });
            req.end();
            const header = getHeader(url, yield responsePromise);
            return header;
        });
    }
    read(url) {
        return __awaiter(this, void 0, void 0, function* () {
            const [req, responsePromise] = yield this.request({
                path: '/' + url,
                method: 'GET',
            });
            req.end();
            const response = yield responsePromise;
            const header = getHeader(url, response);
            return [header, response];
        });
    }
    request(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const socketPath = yield this.serverPath;
            return request(Object.assign({ agent: this.agent, socketPath }, options));
        });
    }
}
exports.default = FileServerClient;
function getHeader(url, response) {
    if (response.statusCode !== 200) {
        throw new Error(`Server error, code=${response.statusCode} message=${response.statusMessage}`);
    }
    const mimeType = response.headers['content-type'];
    const contentLength = response.headers['content-length'];
    const blockCount = response.headers['x-block-count'];
    const sha256 = response.headers['etag'];
    if (!mimeType)
        throw new Error('Missing Content-Type in FileServer response');
    if (!contentLength)
        throw new Error('Missing Content-Length in FileServer response');
    if (typeof sha256 != 'string')
        throw new Error('Missing ETag in FileServer response');
    if (typeof blockCount != 'string')
        throw new Error('Missing X-Block-Count in FileServer response');
    const size = parseInt(contentLength, 10);
    const blocks = parseInt(blockCount, 10);
    if (isNaN(size))
        throw new Error('Invalid Content-Length in FileServer response');
    if (isNaN(blocks))
        throw new Error('Invalid X-Block-Count in FileServer response');
    const header = {
        url,
        size,
        blocks,
        mimeType,
        sha256,
    };
    return header;
}
function request(options) {
    const req = http.request(options);
    const response = new Promise((resolve, reject) => {
        req.on('response', resolve).on('error', reject);
    });
    return [req, response];
}
//# sourceMappingURL=FileServerClient.js.map