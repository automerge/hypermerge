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
const Queue_1 = __importDefault(require("./Queue"));
const Base58 = __importStar(require("bs58"));
const hypercore_1 = __importDefault(require("hypercore"));
const hypercore_2 = require("./hypercore");
const debug_1 = __importDefault(require("debug"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const URL = __importStar(require("url"));
const Misc_1 = require("./Misc");
const log = debug_1.default('repo:metadata');
const Misc_2 = require("./Misc");
const Keys = __importStar(require("./Keys"));
function cleanMetadataInput(input) {
    const id = input.id || input.docId;
    if (typeof id !== 'string')
        return undefined;
    const bytes = input.bytes;
    if (typeof bytes !== 'undefined' && typeof bytes !== 'number')
        return undefined;
    const mimeType = input.mimeType;
    if (bytes === undefined)
        return undefined;
    return {
        id,
        bytes,
        mimeType,
    };
}
exports.cleanMetadataInput = cleanMetadataInput;
function filterMetadataInputs(input) {
    const metadata = [];
    input.forEach((i) => {
        const cleaned = cleanMetadataInput(i);
        if (cleaned) {
            metadata.push(cleaned);
        }
        else {
            log('WARNING: Metadata Input Invalid - ignoring', i);
        }
    });
    return metadata;
}
exports.filterMetadataInputs = filterMetadataInputs;
function isFileBlock(block) {
    return 'mimeType' in block && typeof block.mimeType === 'string' && block.bytes != undefined;
}
// are try catchs as expensive as I remember?  Not sure - I wrote this logic twice
function isValidID(id) {
    try {
        const buffer = Base58.decode(id);
        return buffer.length === 32;
    }
    catch (e) {
        return false;
    }
}
exports.isValidID = isValidID;
function validateID(id) {
    log(`id '${id}'`);
    const buffer = Keys.decode(id);
    if (buffer.length !== 32) {
        throw new Error(`invalid id ${id}`);
    }
    return buffer;
}
function validateURL(urlString) {
    if (!Misc_2.isBaseUrl(urlString)) {
        //    disabled this warning because internal APIs are currently inconsistent in their use
        //    so it's throwing warnings just, like, all the time in normal usage.
        //    console.log("WARNING: `${id}` is deprecated - now use `hypermerge:/${id}`")
        //    throw new Error("WARNING: open(id) is depricated - now use open(`hypermerge:/${id}`)")
        const id = urlString;
        const buffer = validateID(id);
        return { type: 'hypermerge', buffer, id };
    }
    const url = URL.parse(urlString);
    if (!url.path || !url.protocol) {
        throw new Error('invalid URL: ' + urlString);
    }
    const id = url.path.slice(1);
    const type = url.protocol.slice(0, -1);
    const buffer = validateID(id);
    if (type !== 'hypermerge' && type != 'hyperfile') {
        throw new Error(`protocol must be hypermerge or hyperfile (${type}) (${urlString})`);
    }
    return { id, buffer, type };
}
exports.validateURL = validateURL;
function validateFileURL(urlString) {
    const info = validateURL(urlString);
    if (info.type != 'hyperfile') {
        throw new Error('invalid URL - protocol must be hyperfile');
    }
    return info.id;
}
exports.validateFileURL = validateFileURL;
function validateDocURL(urlString) {
    const info = validateURL(urlString);
    if (info.type != 'hypermerge') {
        throw new Error('invalid URL - protocol must be hypermerge');
    }
    return info.id;
}
exports.validateDocURL = validateDocURL;
var _benchTotal = {};
class Metadata {
    constructor(storageFn, joinFn) {
        this.files = new Map();
        this.mimeTypes = new Map();
        this.readyQ = new Queue_1.default('repo:metadata:readyQ'); // FIXME - need a better api for accessing metadata
        this.writable = new Map();
        // whats up with this ready/replay thing
        // there is a situation where someone opens a new document before the ledger is done readying
        // one option would be to make every single function in hypermerge async or run with a promise
        // this complexity here allows the whole library to remain syncronous
        // writes to metadata before the ledger is done being read is saved temporaily and then
        // erased and replayed when the load is complete
        // this lets us know if the edits change the state of the metadata and need to be written
        // to the ledger
        // ( an alternate (but bad) fix would be to write to the ledger always in these cases
        // but this would cause the ledger to have potientially massive amounts of redundant data in it
        this.ready = false;
        this.replay = [];
        this.loadLedger = (buffers) => {
            const input = JsonBuffer.parseAllValid(buffers);
            const data = filterMetadataInputs(input); // FIXME
            this.files = new Map();
            this.mimeTypes = new Map();
            this.ready = true;
            this.batchAdd(data);
            this.replay.map(this.writeThrough);
            this.replay = [];
            this.readyQ.subscribe((f) => f());
        };
        // write through caching strategy
        this.writeThrough = (block) => {
            log('writeThrough', block);
            if (!this.ready)
                this.replay.push(block);
            const dirty = this.addBlock(-1, block);
            if (this.ready && dirty) {
                this.append(block);
                if (isFileBlock(block)) {
                    // TODO: Manage this elsewhere - either through FileStore, FeedStore, or not at all!
                    this.join(Misc_1.hyperfileActorId(block.id));
                }
            }
        };
        this.append = (block) => {
            this.ledger.append(JsonBuffer.bufferify(block), (err) => {
                if (err)
                    console.log('APPEND ERROR', err);
            });
        };
        this.ledger = hypercore_1.default(storageFn('ledger'), {});
        this.join = joinFn;
        log('LEDGER READY (1)');
        this.ledger.ready(() => {
            log('LEDGER READY (2)', this.ledger.length);
            hypercore_2.readFeed('ledger', this.ledger, this.loadLedger);
        });
    }
    batchAdd(blocks) {
        log('Batch add', blocks.length);
        blocks.forEach((block, i) => this.addBlock(i, block));
    }
    addBlock(_idx, block) {
        let changedFiles = false;
        if (isFileBlock(block)) {
            if (this.files.get(block.id) !== block.bytes ||
                this.mimeTypes.get(block.id) !== block.mimeType) {
                changedFiles = true;
                this.files.set(block.id, block.bytes);
                this.mimeTypes.set(block.id, block.mimeType);
            }
        }
        return changedFiles;
    }
    isWritable(actorId) {
        return this.writable.get(actorId) || false;
    }
    setWritable(actor, writable) {
        this.writable.set(actor, writable);
    }
    addFile(hyperfileUrl, bytes, mimeType) {
        const id = validateFileURL(hyperfileUrl);
        this.writeThrough({ id, bytes, mimeType });
    }
    addBlocks(blocks) {
        blocks.forEach((block) => {
            this.writeThrough(block);
        });
    }
    isFile(id) {
        return this.files.get(id) !== undefined;
    }
    isDoc(id) {
        return !this.isFile(id);
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        const total = (_benchTotal[msg] || 0) + duration;
        _benchTotal[msg] = total;
        log(`metadata task=${msg} time=${duration}ms total=${total}ms`);
    }
    fileMetadata(id) {
        const bytes = this.files.get(id);
        const mimeType = this.mimeTypes.get(id);
        return {
            type: 'File',
            bytes,
            mimeType,
        };
    }
}
exports.Metadata = Metadata;
//# sourceMappingURL=Metadata.js.map