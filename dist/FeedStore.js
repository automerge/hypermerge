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
const fs_1 = __importDefault(require("fs"));
const hypercore_1 = require("./hypercore");
const Keys_1 = require("./Keys");
const Misc_1 = require("./Misc");
const Queue_1 = __importDefault(require("./Queue"));
/**
 * Note:
 * FeedId should really be the discovery key. The public key should be
 * PublicId. Reading and writing to existing hypercores does not require the
 * public key; it's saved to disk. In a future refactor, we plan to remove the
 * reliance on public keys, and instead only provide the public key when
 * creating a new hypercore, or opening an unknown hypercore. The ledger keeps
 * track of which hypercores have already been opened.
 */
class FeedStore {
    constructor(storageFn, config = {}) {
        this.feeds = new Map();
        this.storage = storageFn;
        this.config = config;
        this.discoveryIds = new Map();
        this.feedIdQ = new Queue_1.default('FeedStore:idQ');
    }
    /**
     * Create a brand-new writable feed using the given key pair.
     * Promises the FeedId.
     */
    create(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            const [feedId] = yield this.openOrCreateFeed(keys);
            return feedId;
        });
    }
    append(feedId, ...blocks) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.open(feedId);
            return createMultiPromise(blocks.length, (res, rej) => {
                blocks.forEach((block) => {
                    feed.append(block, (err, seq) => {
                        if (err) {
                            return rej(err);
                        }
                        res(seq);
                    });
                });
            });
        });
    }
    appendStream(feedId) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.open(feedId);
            return feed.createWriteStream();
        });
    }
    read(feedId, seq) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.open(feedId);
            return new Promise((res, rej) => {
                feed.get(seq, (err, data) => {
                    if (err)
                        return rej(err);
                    res(data);
                });
            });
        });
    }
    stream(feedId, start = 0) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.open(feedId);
            return feed.createReadStream({ start });
        });
    }
    close(feedId) {
        const feed = this.feeds.get(feedId);
        if (!feed)
            return Promise.reject(new Error(`Can't close feed ${feedId}, feed not open`));
        return new Promise((res, rej) => {
            feed.close((err) => {
                if (err)
                    return rej(err);
                res(feedId);
            });
        });
    }
    destroy(feedId) {
        return new Promise((res, rej) => {
            const filename = this.storage(feedId)('').filename;
            const newName = filename.slice(0, -1) + `_${Date.now()}_DEL`;
            fs_1.default.rename(filename, newName, (err) => {
                if (err)
                    return rej(err);
                res(feedId);
            });
        });
    }
    // Only needed until FeedId == DiscoveryId:
    addFeedId(feedId) {
        const discoveryId = Misc_1.toDiscoveryId(feedId);
        if (this.discoveryIds.has(discoveryId))
            return;
        this.discoveryIds.set(discoveryId, feedId);
        this.feedIdQ.push(feedId);
    }
    // Only needed until FeedId == DiscoveryId:
    getFeedId(discoveryId) {
        return this.discoveryIds.get(discoveryId);
    }
    // Junk method used to bridge to Network
    getFeed(feedId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.open(feedId);
        });
    }
    open(feedId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [, feed] = yield this.openOrCreateFeed({ publicKey: feedId });
            return feed;
        });
    }
    openOrCreateFeed(keys) {
        return new Promise((res, _rej) => {
            const feedId = keys.publicKey;
            const feed = Misc_1.getOrCreate(this.feeds, feedId, () => {
                const { publicKey, secretKey } = Keys_1.decodePair(keys);
                this.addFeedId(feedId);
                return hypercore_1.hypercore(this.storage(feedId), publicKey, {
                    secretKey,
                    extensions: this.config.extensions,
                });
            });
            feed.ready(() => res([feedId, feed]));
        });
    }
}
exports.default = FeedStore;
/**
 * The returned promise resolves after the `resolver` fn is called `n` times.
 * Promises the last value passed to the resolver.
 */
function createMultiPromise(n, factory) {
    return new Promise((resolve, reject) => {
        const res = (value) => {
            n -= 1;
            if (n === 0)
                resolve(value);
        };
        const rej = (err) => {
            n = -1; // Ensure we never resolve
            reject(err);
        };
        factory(res, rej);
    });
}
//# sourceMappingURL=FeedStore.js.map