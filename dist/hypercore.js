"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
let _hypercore = require("hypercore");
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
function readFeed(feed, cb) {
    if (feed.length > 0) {
        feed.getBatch(0, feed.length, (err, data) => {
            cb(data);
        });
    }
    else {
        cb([]);
    }
}
exports.readFeed = readFeed;
//# sourceMappingURL=hypercore.js.map