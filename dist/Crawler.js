"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Misc_1 = require("./Misc");
const FileStore_1 = require("./FileStore");
const TraverseLogic = __importStar(require("./TraverseLogic"));
const log = require('debug')('hypermerge-crawler');
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
                const handle = this.repo.open(url);
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