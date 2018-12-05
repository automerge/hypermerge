"use strict";
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
const RepoBackend_1 = require("./RepoBackend");
const hypercore_1 = require("./hypercore");
const Queue_1 = __importDefault(require("./Queue"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const Base58 = __importStar(require("bs58"));
const debug_1 = __importDefault(require("debug"));
const log = debug_1.default("feedmgr");
class FeedMgr {
    constructor(back, keys) {
        this.changes = [];
        // FIXME - this code asssumes one doc to one feed - no longer true
        this.back = back;
        const { publicKey, secretKey } = keys;
        this.id = Base58.encode(publicKey);
        const storage = this.back.storageFn(this.id);
        const dk = hypercore_1.discoveryKey(publicKey);
        const dkString = Base58.encode(dk);
        this.feed = hypercore_1.hypercore(storage, publicKey, {
            secretKey,
        });
        const feed = this.feed;
        const q = new Queue_1.default();
        this.q = q;
        this.back.feeds.set(dkString, feed);
        this.back.feedMgrs.set(this.id, this);
        log("init feed", this.id);
        feed.ready(() => {
            this.back.meta.setWritable(this.id, feed.writable);
            this.back.meta.docsWith(this.id).forEach(docId => {
                this.back.feedPeers.get(docId).forEach(peer => {
                    this.back.message(peer, this.back.meta.forActor(this.id));
                });
            });
            feed.on("peer-remove", (peer) => {
                this.back.feedPeers.remove(this.id, peer);
            });
            feed.on("peer-add", (peer) => {
                peer.stream.on("extension", (ext, buf) => {
                    if (ext === RepoBackend_1.EXT) {
                        const blocks = JSON.parse(buf.toString());
                        log("EXT", blocks);
                        this.back.meta.addBlocks(blocks);
                        blocks.forEach(block => {
                            // getFeed -> initFeed -> join()
                            this.back.initActors([...block.actorIds]);
                        });
                    }
                });
                this.back.feedPeers.add(this.id, peer);
                this.back.message(peer, this.back.meta.forActor(this.id));
            });
            feed.on("download", (idx, data) => {
                this.changes.push(JsonBuffer.parse(data));
            });
            feed.on("sync", () => {
                this.back.syncChanges(this.id);
            });
            // read everything from disk before subscribing to the queue
            hypercore_1.readFeed(feed, datas => {
                this.changes.push(...datas.map(JsonBuffer.parse));
                this.back.join(this.id);
                q.subscribe(f => f(feed));
            });
            feed.on("close", () => {
                log("closing feed", this.id);
                //        this.back.changes.delete(this.id)
                this.back.feeds.delete(dkString);
                this.back.feedMgrs.delete(this.id);
                this.back.feedPeers.delete(this.id);
            });
        });
        //    return q
    }
    push(cb) {
        this.q.push(cb);
    }
    writeChange(change) {
        const feedLength = this.changes.length;
        const ok = feedLength + 1 === change.seq;
        log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`);
        this.changes.push(change);
        this.back.syncChanges(this.id);
        //      this.getFeed(this.id, feed => {
        this.feed.append(JsonBuffer.bufferify(change), err => {
            if (err) {
                throw new Error("failed to append to feed");
            }
        });
        //      })
    }
}
exports.FeedMgr = FeedMgr;
//# sourceMappingURL=Feed.js.map