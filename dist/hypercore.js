"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
let _hypercore = require("hypercore");
const debug_1 = __importDefault(require("debug"));
const log = debug_1.default("repo:hypermerge");
function discoveryKey(buf) {
    return _hypercore.discoveryKey(buf);
}
exports.discoveryKey = discoveryKey;
function hypercore(storage, arg2, arg3) {
    if (arg3) {
        return _hypercore(storage, arg2, arg3);
    }
    else {
        return _hypercore(storage, arg2);
    }
}
exports.hypercore = hypercore;
function readFeedN(feed, index, cb) {
    const id = feed.id.toString('hex').slice(0, 4);
    log("readFeed.getBatch", 0, index);
    feed.getBatch(0, index, { wait: false }, (err, data) => {
        if (err)
            throw err;
        log("readFeed.getBatch calling cb", data.length);
        cb(data);
    });
}
function readFeed(feed, cb) {
    const id = feed.id.toString('hex').slice(0, 4);
    const length = feed.downloaded();
    log("readFeed", id, `downloaded=${length}`, `feed.length=${feed.length}`);
    if (length === 0)
        return cb([]);
    if (feed.has(0, length))
        return readFeedN(feed, length, cb);
    for (let i = 0; i < length; i++) {
        if (!feed.has(i)) {
            log("readFeed.clear", i, length);
            feed.clear(i, feed.length, () => {
                readFeedN(feed, i - 1, cb);
            });
            break;
        }
    }
}
exports.readFeed = readFeed;
//# sourceMappingURL=hypercore.js.map