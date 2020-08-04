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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Crawler = void 0;
const Debug_1 = __importDefault(require("./Debug"));
const Misc_1 = require("./Misc");
const FileStore_1 = require("./FileStore");
const TraverseLogic = __importStar(require("./TraverseLogic"));
const log = Debug_1.default('Crawler');
class Crawler {
    constructor(repo) {
        this.seen = new Set();
        this.handles = new Map();
        this.onUrl = (urlVal) => {
            const url = Misc_1.withoutQuery(urlVal);
            if (this.seen.has(url))
                return;
            log(`Crawling ${url}`);
            if (Misc_1.isDocUrl(url)) {
                const handle = this.repo.open(url, undefined, false);
                this.seen.add(url);
                this.handles.set(url, handle);
                setImmediate(() => handle.subscribe(this.onDocumentUpdate));
            }
            else if (FileStore_1.isHyperfileUrl(url)) {
                this.seen.add(url);
                setImmediate(() => this.repo.files.header(url));
            }
        };
        this.onDocumentUpdate = (doc) => {
            const urls = TraverseLogic.iterativeDfs(isHypermergeUrl, doc);
            urls.forEach(this.onUrl);
        };
        this.repo = repo;
    }
    crawl(url) {
        log(`Crawling from root ${url}`);
        this.onUrl(url);
    }
    close() {
        this.handles.forEach((handle) => handle.close());
        this.handles.clear();
        this.seen.clear();
    }
}
exports.Crawler = Crawler;
function isHypermergeUrl(val) {
    if (!Misc_1.isString(val))
        return false;
    return Misc_1.isDocUrl(val) || FileStore_1.isHyperfileUrl(val);
}
//# sourceMappingURL=Crawler.js.map