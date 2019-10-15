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
const hypercore_1 = __importDefault(require("hypercore"));
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
    constructor(storageFn) {
        this.opened = new Map();
        this.storage = (discoveryId) => storageFn(`${discoveryId.slice(0, 2)}/${discoveryId.slice(2)}`);
        this.feedIdQ = new Queue_1.default('FeedStore:idQ');
    }
    /**
     * Create a brand-new writable feed using the given key pair.
     * Promises the FeedId.
     */
    create(keys) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.openOrCreateFeed(keys);
            return keys.publicKey;
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
            const feed = yield this.getFeed(feedId);
            return feed.createWriteStream();
        });
    }
    read(feedId, seq) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.getFeed(feedId);
            return new Promise((res, rej) => {
                feed.get(seq, (err, data) => {
                    if (err)
                        return rej(err);
                    res(data);
                });
            });
        });
    }
    head(feedId) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.getFeed(feedId);
            return new Promise((res, rej) => {
                feed.head((err, data) => {
                    if (err)
                        return rej(err);
                    res(data);
                });
            });
        });
    }
    stream(feedId, start = 0, end) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.open(feedId);
            if (end != null && end < 0)
                end = feed.length + end;
            return feed.createReadStream({ start, end });
        });
    }
    closeFeed(feedId) {
        const feed = this.opened.get(feedId);
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
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            yield Promise.all([...this.opened.keys()].map((feedId) => this.closeFeed(feedId)));
        });
    }
    getFeed(feedId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.open(feedId);
        });
    }
    open(feedId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.openOrCreateFeed({ publicKey: feedId });
        });
    }
    openOrCreateFeed(keys) {
        return new Promise((res, _rej) => {
            const feedId = keys.publicKey;
            const feed = Misc_1.getOrCreate(this.opened, feedId, () => {
                const { publicKey, secretKey } = Keys_1.decodePair(keys);
                this.feedIdQ.push(feedId);
                return hypercore_1.default(this.storage(Misc_1.toDiscoveryId(feedId)), publicKey, {
                    secretKey,
                });
            });
            feed.ready(() => res(feed));
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