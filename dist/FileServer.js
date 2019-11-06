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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const fs_1 = __importDefault(require("fs"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const FileStore_1 = require("./FileStore");
const Misc_1 = require("./Misc");
class FileServer {
    constructor(store) {
        this.onConnection = (req, res) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.onConnectionUnsafe(req, res);
            }
            catch (err) {
                if (err instanceof FileServerError) {
                    res.writeHead(err.code, err.reason);
                    res.end();
                }
                else {
                    res.writeHead(500, 'Internal Server Error', {
                        'Content-Type': 'application/json',
                    });
                    const details = {
                        error: { name: err.name, message: err.message, stack: err.stack },
                    };
                    res.end(JsonBuffer.bufferify(details));
                }
            }
        });
        /**
         * Handles incoming connections, and can respond by throwing FileServerError.
         */
        this.onConnectionUnsafe = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { method } = req;
            const { path } = url_1.parse(req.url);
            const url = path.slice(1);
            if (!method)
                throw new FileServerError(400, 'Bad Request');
            switch (req.method) {
                case 'POST':
                    return this.upload(req, res);
                case 'HEAD':
                    if (!FileStore_1.isHyperfileUrl(url))
                        throw new NotFoundError();
                    yield this.sendHeaders(url, res);
                    res.end();
                    return;
                case 'GET':
                    if (!FileStore_1.isHyperfileUrl(url))
                        throw new NotFoundError();
                    yield this.sendHeaders(url, res);
                    const stream = yield this.files.read(url);
                    stream.pipe(res);
                    return;
                default:
                    throw new FileServerError(405, 'Method Not Allowed');
            }
        });
        this.files = store;
        this.http = http_1.createServer(this.onConnection);
        this.http.setTimeout(0);
    }
    listen(pathOrAddress) {
        if (typeof pathOrAddress === 'string') {
            const ipcPath = Misc_1.toIpcPath(pathOrAddress);
            // For some reason, the non-sync version doesn't work :shrugging-man:
            // fs.unlink(path, (err) => {
            //   this.http.listen(path)
            // })
            try {
                fs_1.default.unlinkSync(ipcPath);
            }
            catch (_a) { }
            this.http.listen(ipcPath);
        }
        else {
            this.http.listen(pathOrAddress);
        }
    }
    isListening() {
        return this.http.listening;
    }
    close() {
        return new Promise((res) => {
            if (this.isListening()) {
                this.http.close(() => res());
            }
            else {
                res();
            }
        });
    }
    upload(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const mimeType = getMimeType(req.headers);
            const header = yield this.files.write(req, mimeType);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JsonBuffer.bufferify(header));
        });
    }
    sendHeaders(url, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const header = yield this.files.header(url);
            res.writeHead(200, {
                ETag: header.sha256,
                'Content-Type': header.mimeType,
                'Content-Length': header.size,
                'X-Block-Count': header.blocks,
            });
        });
    }
}
exports.default = FileServer;
function getMimeType(headers) {
    const mimeType = headers['content-type'];
    if (!mimeType)
        throw new Error('Content-Type is a required header.');
    return mimeType;
}
class FileServerError extends Error {
    constructor(code, reason) {
        super();
        this.code = code;
        this.reason = reason;
    }
}
class NotFoundError extends FileServerError {
    constructor() {
        super(404, 'Not Found');
    }
}
//# sourceMappingURL=FileServer.js.map