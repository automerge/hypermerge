"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
/**
 * Actors provide an interface over the data replication scheme.
 * For dat, this means the actor abstracts over the hypercore and its peers.
 */
const hypercore_1 = require("./hypercore");
const Misc_1 = require("./Misc");
const Queue_1 = __importDefault(require("./Queue"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const Base58 = __importStar(require("bs58"));
const Block = __importStar(require("./Block"));
const debug_1 = __importDefault(require("debug"));
const fs = require("fs");
const log = debug_1.default("repo:actor");
const KB = 1024;
const MB = 1024 * KB;
class Actor {
    constructor(config) {
        this.changes = [];
        this.peers = new Set();
        this.data = [];
        this.pending = [];
        this.onFeedReady = () => {
            const feed = this.feed;
            this.notify({ type: "ActorFeedReady", actor: this, writable: feed.writable });
            feed.on("peer-remove", this.onPeerRemove);
            feed.on("peer-add", this.onPeerAdd);
            feed.on("download", this.onDownload);
            feed.on("sync", this.onSync);
            hypercore_1.readFeed(this.id, feed, this.init); // onReady subscribe begins here
            feed.on("close", this.close);
        };
        this.init = (rawBlocks) => {
            log("loaded blocks", Misc_1.ID(this.id), rawBlocks.length);
            rawBlocks.map(this.parseBlock);
            if (rawBlocks.length > 0) {
                this.onSync();
            }
            this.notify({ type: "ActorInitialized", actor: this });
            this.q.subscribe(f => f(this));
        };
        // Note: on Actor ready, not Feed!
        this.onReady = (cb) => {
            this.q.push(cb);
        };
        this.onPeerAdd = (peer) => {
            log("peer-add feed", Misc_1.ID(this.id));
            this.peers.add(peer);
            this.notify({ type: "PeerAdd", actor: this, peer: peer });
            this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size });
        };
        this.onPeerRemove = (peer) => {
            this.peers.delete(peer);
            this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size });
        };
        this.onDownload = (index, data) => {
            this.parseBlock(data, index);
            const time = Date.now();
            const size = data.byteLength;
            this.notify({ type: "Download", actor: this, index, size, time });
        };
        this.onSync = () => {
            log("sync feed", Misc_1.ID(this.id));
            this.notify({ type: "ActorSync", actor: this });
        };
        this.onClose = () => {
            this.close();
        };
        this.parseBlock = (data, index) => {
            if (this.type === "Unknown") {
                if (index === 0) {
                    this.parseHeaderBlock(data);
                }
                else {
                    this.pending[index] = data;
                }
            }
            else {
                this.parseDataBlock(data, index);
            }
        };
        this.close = () => {
            log("closing feed", this.id);
            try {
                this.feed.close((err) => { });
            }
            catch (error) { }
        };
        this.destroy = () => {
            this.feed.close((err) => {
                const filename = this.storage("").filename;
                if (filename) {
                    const newName = filename.slice(0, -1) + `_${Date.now()}_DEL`;
                    fs.rename(filename, newName, (err) => {
                    });
                }
            });
        };
        const { publicKey, secretKey } = config.keys;
        const dk = hypercore_1.discoveryKey(publicKey);
        const id = Base58.encode(publicKey);
        this.type = "Unknown";
        this.id = id;
        this.storage = config.storage(id);
        this.notify = config.notify;
        this.dkString = Base58.encode(dk);
        this.feed = hypercore_1.hypercore(this.storage, publicKey, { secretKey });
        this.q = new Queue_1.default("actor:q-" + id.slice(0, 4));
        this.feed.ready(this.onFeedReady);
    }
    parseHeaderBlock(data) {
        const header = Block.unpack(data); // no validation of head
        if (header.hasOwnProperty("type")) {
            this.type = "File";
            this.fileMetadata = header;
        }
        else {
            this.type = "Automerge";
            this.parseBlock(data, 0);
            this.pending.map(this.parseBlock);
            this.pending = [];
        }
    }
    parseDataBlock(data, index) {
        switch (this.type) {
            case "Automerge":
                const change = Block.unpack(data); // no validation of Change
                this.changes[index] = change;
                log(`block xxx idx=${index} actor=${Misc_1.ID(change.actor)} seq=${change.seq}`);
                break;
            case "File":
                this.data[index - 1] = data;
                break;
            default:
                throw new Error("cant handle block if we don't know the type");
                break;
        }
    }
    writeChange(change) {
        const feedLength = this.changes.length;
        const ok = feedLength + 1 === change.seq;
        log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`);
        this.changes.push(change);
        this.onSync();
        this.append(Block.pack(change));
    }
    writeFile(data, mimeType) {
        log("writing file");
        this.onReady(() => {
            log("writing file", data.length, "bytes", mimeType);
            if (this.data.length > 0 || this.changes.length > 0)
                throw new Error("writeFile called on existing feed");
            const blockSize = 1 * MB;
            this.fileMetadata = {
                type: "File",
                bytes: data.length,
                mimeType,
                blockSize,
            };
            this.append(Buffer.from(JSON.stringify(this.fileMetadata)));
            for (let i = 0; i < data.length; i += blockSize) {
                const block = data.slice(i, i + blockSize);
                this.data.push(block);
                this.append(block);
            }
        });
    }
    readFile() {
        return __awaiter(this, void 0, void 0, function* () {
            log("reading file...");
            const head = yield this.fileHead();
            const body = yield this.fileBody(head);
            return {
                body,
                mimeType: head.mimeType
            };
        });
    }
    fileHead() {
        return new Promise((resolve, reject) => {
            if (this.fileMetadata) {
                resolve(this.fileMetadata);
            }
            else {
                this.feed.get(0, { wait: true }, (err, data) => {
                    if (err)
                        reject(new Error(`error reading feed head ${this.id}`));
                    const head = JsonBuffer.parse(data);
                    this.fileMetadata = head; //Yikes
                    resolve(head);
                });
            }
        });
    }
    fileBody(head) {
        return new Promise((resolve, reject) => {
            const blockSize = head.blockSize || 1 * MB; // old feeds dont have this
            const blocks = Math.ceil(head.bytes / blockSize);
            const file = Buffer.concat(this.data);
            if (file.length === head.bytes) {
                resolve(file);
            }
            else {
                if (blocks === 1) {
                    this.feed.get(1, { wait: true }, (err, file) => {
                        if (err)
                            reject(new Error(`error reading feed body ${this.id}`));
                        this.data = [file];
                        resolve(file);
                    });
                }
                else {
                    this.feed.getBatch(1, blocks, { wait: true }, (err, data) => {
                        if (err)
                            reject(new Error(`error reading feed body ${this.id}`));
                        this.data = data;
                        const file = Buffer.concat(this.data);
                        resolve(file);
                    });
                }
            }
        });
    }
    append(block) {
        this.feed.append(block, err => {
            log("Feed.append", block.length, "bytes");
            if (err) {
                throw new Error("failed to append to feed");
            }
        });
    }
}
exports.Actor = Actor;
//# sourceMappingURL=Actor.js.map