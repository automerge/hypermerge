"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const Misc_1 = require("./Misc");
const Stream = __importStar(require("./StreamLogic"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
class FileServerClient {
    setServerPath(path) {
        this.serverPath = Misc_1.toIpcPath(path);
    }
    write(stream, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.serverPath)
                throw new Error('FileServer has not been started on RepoBackend');
            const [req, response] = request({
                socketPath: this.serverPath,
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
            const [req, responsePromise] = request({
                socketPath: this.serverPath,
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
            if (!this.serverPath)
                throw new Error('FileServer has not been started on RepoBackend');
            const [req, responsePromise] = request({
                socketPath: this.serverPath,
                path: '/' + url,
                method: 'GET',
            });
            req.end();
            const response = yield responsePromise;
            const header = getHeader(url, response);
            return [header, response];
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