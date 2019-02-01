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
const hypercore_1 = require("./hypercore");
const Metadata_1 = require("./Metadata");
const Misc_1 = require("./Misc");
const Queue_1 = __importDefault(require("./Queue"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const Base58 = __importStar(require("bs58"));
const debug_1 = __importDefault(require("debug"));
const fs = require("fs");
const log = debug_1.default("repo:actor");
const KB = 1024;
const MB = 1024 * KB;
exports.EXT = "hypermerge.2";
exports.EXT2 = "hypermerge.3";
const brotli = require('iltorb');
const BROTLI = "BR";
const BROTLI_MODE_TEXT = 1;
function packBlock(obj) {
    const blockHeader = Buffer.from(BROTLI);
    const blockBody = Buffer.from(brotli.compressSync(JsonBuffer.bufferify(obj), { mode: BROTLI_MODE_TEXT }));
    return Buffer.concat([blockHeader, blockBody]);
}
function unpackBlock(data) {
    //if (data.slice(0,2).toString() === '{"') { // an old block before we added compression
    const header = data.slice(0, 2);
    switch (header.toString()) {
        case '{"':
            return JsonBuffer.parse(data);
        case BROTLI:
            return JsonBuffer.parse(Buffer.from(brotli.decompressSync(data.slice(2))));
        default:
            throw new Error(`fail to unpack blocks - head is '${header}'`);
    }
}
class Actor {
    constructor(config) {
        this.changes = [];
        this.peers = new Set();
        this.data = [];
        this.pending = [];
        this.feedReady = () => {
            const feed = this.feed;
            this.meta.setWritable(this.id, feed.writable);
            const meta = this.meta.forActor(this.id);
            this.meta.docsWith(this.id).forEach(docId => {
                const actor = this.repo.actor(docId);
                const clocks = this.allClocks();
                if (actor) {
                    actor.message2(meta, clocks);
                    //        actor.message(meta);
                }
            });
            feed.on("peer-remove", this.peerRemove);
            feed.on("peer-add", this.peerAdd);
            feed.on("download", this.handleDownload);
            feed.on("sync", this.sync);
            hypercore_1.readFeed(this.id, feed, this.init); // subscibe begins here
            feed.on("close", this.close);
        };
        this.init = (datas) => {
            log("loaded blocks", Misc_1.ID(this.id), datas.length);
            datas.map((data, i) => {
                if (i === 0)
                    this.handleFeedHead(data);
                else
                    this.handleBlock(data, i);
            });
            if (datas.length > 0) {
                this.sync();
            }
            this.repo.join(this.id);
            this.q.subscribe(f => f(this));
        };
        this.close = () => {
            log("closing feed", this.id);
            try {
                this.feed.close((err) => { });
            }
            catch (error) { }
        };
        this.destroy = () => {
            this.repo.leave(this.id);
            this.feed.close((err) => {
                const filename = this.storage("").filename;
                if (filename) {
                    const newName = filename.slice(0, -1) + `_${Date.now()}_DEL`;
                    //console.log("RENAME", filename, newName)
                    fs.rename(filename, newName, (err) => {
                        //console.log("DONE", err)
                    });
                }
            });
        };
        this.peerRemove = (peer) => {
            this.peers.delete(peer);
            this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size });
        };
        this.peerAdd = (peer) => {
            log("peer-add feed", Misc_1.ID(this.id));
            peer.stream.on("extension", (ext, input) => {
                if (ext === exports.EXT) {
                    this.notify({ type: "NewMetadata", input });
                }
                if (ext === exports.EXT2) {
                    //        const clocks = JSON.parse(input.toString()); // FIXME - validate
                    const msg = Metadata_1.validateMetadataMsg2(input);
                    //        this.notify({ type: "RemoteMetadata", clocks });
                    this.notify(msg);
                }
            });
            this.peers.add(peer);
            const metadata = this.meta.forActor(this.id);
            const clocks = this.allClocks();
            this.message2(metadata, clocks, peer);
            //    this.message(metadata, peer);
            this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size });
        };
        this.sync = () => {
            log("sync feed", Misc_1.ID(this.id));
            this.syncQ.once(f => f());
            this.notify({ type: "ActorSync", actor: this });
        };
        this.handleDownload = (index, data) => {
            if (this.type === "Unknown") {
                if (index === 0) {
                    this.handleFeedHead(data);
                }
                else {
                    this.pending[index] = data;
                }
            }
            else {
                this.handleBlock(data, index);
            }
            const time = Date.now();
            const size = data.byteLength;
            this.notify({ type: "Download",
                actor: this,
                index,
                size,
                time });
            //    this.sync();
        };
        this.handleBlock = (data, idx) => {
            switch (this.type) {
                case "Automerge":
                    const change = unpackBlock(data); // no validation of Change
                    this.changes[idx] = change;
                    log(`block xxx idx=${idx} actor=${Misc_1.ID(change.actor)} seq=${change.seq}`);
                    break;
                case "File":
                    this.data[idx - 1] = data;
                    break;
                default:
                    throw new Error("cant handle block if we don't know the type");
                    break;
            }
        };
        this.push = (cb) => {
            this.q.push(cb);
        };
        const { publicKey, secretKey } = config.keys;
        const dk = hypercore_1.discoveryKey(publicKey);
        const id = Base58.encode(publicKey);
        this.type = "Unknown";
        this.id = id;
        this.storage = config.storage(id);
        this.notify = config.notify;
        this.meta = config.meta;
        this.repo = config.repo;
        this.dkString = Base58.encode(dk);
        this.feed = hypercore_1.hypercore(this.storage, publicKey, { secretKey });
        this.q = new Queue_1.default("actor:q-" + id.slice(0, 4));
        this.syncQ = new Queue_1.default("actor:sync-" + id.slice(0, 4));
        this.feed.ready(this.feedReady);
    }
    /*
      message(message: any, target?: Peer) {
        const peers = target ? [target] : [...this.peers];
        const payload = Buffer.from(JSON.stringify(message));
        peers.forEach(peer => peer.stream.extension(EXT, payload));
      }
    */
    message2(blocks, clocks, target) {
        const peers = target ? [target] : [...this.peers];
        const message = { type: "RemoteMetadata", clocks, blocks };
        const payload = Buffer.from(JSON.stringify(message));
        //    target.stream.extension(EXT2, payload)
        peers.forEach(peer => peer.stream.extension(exports.EXT2, payload));
    }
    handleFeedHead(data) {
        const head = unpackBlock(data); // no validation of head
        if (head.hasOwnProperty("type")) {
            this.type = "File";
            this.fileMetadata = head;
        }
        else {
            this.type = "Automerge";
            this.handleBlock(data, 0);
            this.pending.map(this.handleBlock);
            this.pending = [];
        }
    }
    allClocks() {
        const clocks = {};
        this.meta.docsWith(this.id).forEach(id => {
            const doc = this.repo.docs.get(id);
            if (doc) {
                clocks[id] = doc.clock;
            }
        });
        return clocks;
    }
    writeFile(data, mimeType) {
        log("writing file");
        this.q.push(() => {
            log("writing file", data.length, "bytes", mimeType);
            if (this.data.length > 0 || this.changes.length > 0)
                throw new Error("writeFile called on existing feed");
            const blockSize = 1 * MB;
            this.fileMetadata = { type: "File", bytes: data.length, mimeType, blockSize };
            this.append(Buffer.from(JSON.stringify(this.fileMetadata)));
            for (let i = 0; i < data.length; i += blockSize) {
                const block = data.slice(i, i + blockSize);
                this.data.push(block);
                const last = i + blockSize >= data.length;
                this.append(block, () => {
                    if (last) {
                        // I dont want read's to work until its synced to disk - could speed this up
                        // by returning sooner but was having issues where command line tools would
                        // exit before disk syncing was done
                        this.syncQ.subscribe(f => f());
                    }
                });
            }
        });
    }
    fileHead(cb) {
        if (this.fileMetadata) {
            cb(this.fileMetadata);
        }
        else {
            this.feed.get(0, { wait: true }, (err, data) => {
                if (err)
                    throw new Error(`error reading feed head ${this.id}`);
                const head = JsonBuffer.parse(data);
                this.fileMetadata = head;
                cb(head);
            });
        }
    }
    fileBody(head, cb) {
        const blockSize = head.blockSize || (1 * MB); // old feeds dont have this
        const blocks = Math.ceil(head.bytes / blockSize);
        const file = Buffer.concat(this.data);
        if (file.length === head.bytes) {
            cb(file);
        }
        else {
            if (blocks === 1) {
                this.feed.get(1, { wait: true }, (err, file) => {
                    if (err)
                        throw new Error(`error reading feed body ${this.id}`);
                    this.data = [file];
                    cb(file);
                });
            }
            else {
                this.feed.getBatch(1, blocks, { wait: true }, (err, data) => {
                    if (err)
                        throw new Error(`error reading feed body ${this.id}`);
                    this.data = data;
                    const file = Buffer.concat(this.data);
                    cb(file);
                });
            }
        }
    }
    readFile(cb) {
        log("reading file...");
        this.fileHead((head) => {
            const { bytes, mimeType } = head;
            this.fileBody(head, (body) => {
                cb(body, head.mimeType);
            });
        });
    }
    append(block, cb) {
        this.feed.append(block, err => {
            log("Feed.append", block.length, "bytes");
            if (err) {
                throw new Error("failed to append to feed");
            }
            if (cb)
                cb();
        });
    }
    writeChange(change) {
        const feedLength = this.changes.length;
        const ok = feedLength + 1 === change.seq;
        log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`);
        this.changes.push(change);
        this.sync();
        this.append(packBlock(change));
    }
}
exports.Actor = Actor;
//# sourceMappingURL=Actor.js.map