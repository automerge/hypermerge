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
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("http");
const url_1 = require("url");
const fs_1 = __importDefault(require("fs"));
const FileStore_1 = require("./FileStore");
const Misc_1 = require("./Misc");
class FileServer {
    constructor(store) {
        this.onConnection = (req, res) => __awaiter(this, void 0, void 0, function* () {
            const { method } = req;
            const { path } = url_1.parse(req.url);
            const url = path.slice(1);
            if (!method)
                return this.sendCode(res, 400, 'Bad Request');
            switch (req.method) {
                case 'POST':
                    return this.upload(req, res);
                case 'HEAD':
                case 'GET':
                    if (!FileStore_1.isHyperfileUrl(url))
                        return this.sendCode(res, 404, 'Not Found');
                    yield this.writeHeaders(url, res);
                    if (method === 'GET') {
                        const stream = yield this.files.read(url);
                        stream.pipe(res);
                    }
                    else {
                        res.end();
                    }
                    return;
                default:
                    return this.sendCode(res, 405, 'Method Not Allowed');
            }
        });
        this.files = store;
        this.http = http_1.createServer(this.onConnection);
    }
    listen(path) {
        const ipcPath = Misc_1.toIpcPath(path);
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
    isListening() {
        return this.http.listening;
    }
    close() {
        return new Promise((res) => {
            if (this.isListening()) {
                this.http.close(res);
            }
            else {
                res();
            }
        });
    }
    sendCode(res, code, reason) {
        res.writeHead(code, reason);
        res.end();
    }
    upload(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const mimeType = getMimeType(req.headers);
            const header = yield this.files.write(req, mimeType);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(header));
        });
    }
    writeHeaders(url, res) {
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
//# sourceMappingURL=FileServer.js.map