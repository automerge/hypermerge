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
exports.FeedInfoStore = void 0;
const hypercore_1 = __importDefault(require("hypercore"));
const Keys_1 = require("./Keys");
const Misc_1 = require("./Misc");
const Queue_1 = __importDefault(require("./Queue"));
const Crypto = __importStar(require("./Crypto"));
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
    constructor(db, storageFn) {
        this.loaded = new Map();
        this.info = new FeedInfoStore(db);
        this.storage = (discoveryId) => storageFn(`${discoveryId.slice(0, 2)}/${discoveryId.slice(2)}`);
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
    sign(feedId, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.open(feedId);
            if (!feed || !feed.secretKey) {
                throw new Error(`Can't sign with feed ${feedId}`);
            }
            const signature = Crypto.sign(Crypto.encode(feed.secretKey), message);
            return signature;
        });
    }
    verify(feedId, signedMessage) {
        return Crypto.verify(feedId, signedMessage);
    }
    append(feedId, ...blocks) {
        return __awaiter(this, void 0, void 0, function* () {
            const feed = yield this.open(feedId);
            return Misc_1.createMultiPromise(blocks.length, (res, rej) => {
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
                feed.head({ update: true, minLength: 1 }, (err, data) => {
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
        const feed = this.loaded.get(feedId);
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
            yield Promise.all([...this.loaded.keys()].map((feedId) => this.closeFeed(feedId)));
        });
    }
    getFeed(feedId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.open(feedId);
        });
    }
    open(publicId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.openOrCreateFeed({ publicKey: publicId });
        });
    }
    openOrCreateFeed(keys) {
        return new Promise((res, _rej) => {
            const publicId = keys.publicKey;
            const feed = Misc_1.getOrCreate(this.loaded, publicId, () => {
                const discoveryId = Misc_1.toDiscoveryId(publicId);
                const { publicKey, secretKey } = Keys_1.decodePair(keys);
                const feed = hypercore_1.default(this.storage(discoveryId), publicKey, {
                    storageCacheSize: 0,
                    secretKey,
                });
                feed.ready(() => {
                    this.info.save({
                        publicId,
                        discoveryId,
                        isWritable: feed.writable ? 1 : 0,
                    });
                });
                return feed;
            });
            feed.ready(() => res(feed));
        });
    }
}
exports.default = FeedStore;
class FeedInfoStore {
    constructor(db) {
        this.createdQ = new Queue_1.default('FeedStore:createdQ');
        this.prepared = {
            insert: db.prepare(`INSERT INTO Feeds (publicId, discoveryId, isWritable)
          VALUES (@publicId, @discoveryId, @isWritable)`),
            byPublicId: db.prepare(`SELECT * FROM Feeds WHERE publicId = ? LIMIT 1`),
            byDiscoveryId: db.prepare(`SELECT * FROM Feeds WHERE discoveryId = ? LIMIT 1`),
            publicIds: db.prepare('SELECT publicId FROM Feeds').pluck(),
            discoveryIds: db.prepare('SELECT discoveryId FROM Feeds').pluck(),
        };
    }
    save(info) {
        if (!this.hasDiscoveryId(info.discoveryId)) {
            this.prepared.insert.run(info);
            this.createdQ.push(info);
        }
    }
    getPublicId(discoveryId) {
        const info = this.byDiscoveryId(discoveryId);
        return info && info.publicId;
    }
    hasDiscoveryId(discoveryId) {
        return !!this.byDiscoveryId(discoveryId);
    }
    byPublicId(publicId) {
        return this.prepared.byPublicId.get(publicId);
    }
    byDiscoveryId(discoveryId) {
        return this.prepared.byDiscoveryId.get(discoveryId);
    }
    allPublicIds() {
        return this.prepared.publicIds.all();
    }
    allDiscoveryIds() {
        return this.prepared.discoveryIds.all();
    }
}
exports.FeedInfoStore = FeedInfoStore;
//# sourceMappingURL=FeedStore.js.map