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
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("http"));
const Misc_1 = require("./Misc");
const JsonBuffer = __importStar(require("./JsonBuffer"));
class FileServerClient {
    setServerPath(path) {
        this.serverPath = Misc_1.toIpcPath(path);
    }
    write(data, size, mimeType) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.serverPath)
                throw new Error('FileServer has not been started on RepoBackend');
            const [req, response] = request({
                socketPath: this.serverPath,
                path: '/upload',
                method: 'POST',
                headers: {
                    'Content-Type': mimeType,
                    'Content-Length': size,
                },
            });
            data.pipe(req);
            const header = JsonBuffer.parse(yield Misc_1.streamToBuffer(yield response));
            const { url } = header;
            if (!url)
                throw new Error('Invalid response');
            return url;
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
            if (response.statusCode !== 200) {
                throw new Error(`Server error, code=${response.statusCode} message=${response.statusMessage}`);
            }
            const mimeType = response.headers['content-type'];
            const contentLength = response.headers['content-length'];
            if (!mimeType)
                throw new Error('Missing mimeType in FileServer response');
            if (!contentLength)
                throw new Error('Missing content-length in FileServer response');
            const size = parseInt(contentLength, 10);
            if (isNaN(size))
                throw new Error('Invalid content-length in FileServer response');
            return [response, mimeType, size];
        });
    }
}
exports.default = FileServerClient;
function request(options) {
    const req = http.request(options);
    const response = new Promise((resolve, reject) => {
        req.on('response', resolve).on('error', reject);
    });
    return [req, response];
}
//# sourceMappingURL=FileServerClient.js.map