"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
let _hypercore = require("hypercore");
const debug_1 = __importDefault(require("debug"));
const Misc_1 = require("./Misc");
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
function readFeedN(id, feed, index, cb) {
    log(`readFeedN id=${Misc_1.ID(id)} (0..${index})`);
    if (index === 0) {
        feed.get(0, { wait: false }, (err, data) => {
            if (err)
                log(`feed.get() error id=${Misc_1.ID(id)}`, err);
            if (err)
                throw err;
            cb([data]);
        });
    }
    else {
        feed.getBatch(0, index, { wait: false }, (err, data) => {
            if (err)
                log(`feed.getBatch error id=${Misc_1.ID(id)}`, err);
            if (err)
                throw err;
            cb(data);
        });
    }
}
function readFeed(id, feed, cb) {
    const length = feed.downloaded();
    log(`readFeed ${Misc_1.ID(id)} downloaded=${length} feed.length=${feed.length}`);
    if (length === 0)
        return cb([]);
    if (feed.has(0, length))
        return readFeedN(id, feed, length, cb);
    for (let i = 0; i < length; i++) {
        if (!feed.has(i)) {
            feed.clear(i, feed.length, () => {
                log(`post clear -- readFeedN id=${Misc_1.ID(id)} n=${i - 1}`);
                readFeedN(id, feed, i - 1, cb);
            });
            break;
        }
    }
}
exports.readFeed = readFeed;
//# sourceMappingURL=hypercore.js.map