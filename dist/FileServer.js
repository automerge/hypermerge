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
        this.onConnection = (req, res) => {
            const { path } = url_1.parse(req.url);
            const url = path.slice(1);
            switch (url) {
                case 'upload':
                    if (req.method !== 'POST') {
                        res.writeHead(500, 'Must be POST');
                        res.end();
                        return;
                    }
                    return this.upload(req, res);
                default:
                    if (FileStore_1.isHyperfileUrl(url)) {
                        return this.stream(url, res);
                    }
                    else {
                        res.writeHead(404, 'NOT FOUND');
                        res.end();
                    }
            }
        };
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
    upload(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const info = uploadInfo(req.headers);
            const header = yield this.files.write(info.mimeType, info.bytes, req);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(header));
        });
    }
    stream(url, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const header = yield this.files.header(url);
            res.writeHead(200, {
                'Content-Type': header.mimeType,
                'Content-Length': header.bytes,
            });
            const stream = yield this.files.read(url);
            stream.pipe(res);
        });
    }
}
exports.default = FileServer;
function uploadInfo(headers) {
    const mimeType = headers['content-type'];
    const length = headers['content-length'];
    if (!mimeType)
        throw new Error('Content-Type is a required header.');
    if (!length)
        throw new Error('Content-Length is a required header.');
    const bytes = parseInt(length, 10);
    return {
        mimeType,
        bytes,
    };
}
//# sourceMappingURL=FileServer.js.map