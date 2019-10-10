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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Queue_1 = __importDefault(require("./Queue"));
const MapSet_1 = __importDefault(require("./MapSet"));
const Base58 = __importStar(require("bs58"));
const hypercore_1 = require("./hypercore");
const debug_1 = __importDefault(require("debug"));
const JsonBuffer = __importStar(require("./JsonBuffer"));
const URL = __importStar(require("url"));
const Misc_1 = require("./Misc");
const log = debug_1.default('repo:metadata');
const Clock_1 = require("./Clock");
const Misc_2 = require("./Misc");
function validateRemoteMetadata(message) {
    const result = { type: 'RemoteMetadata', clocks: {}, blocks: [] };
    if (message instanceof Object &&
        message.blocks instanceof Array &&
        message.clocks instanceof Object) {
        result.blocks = filterMetadataInputs(message.blocks);
        result.clocks = message.clocks;
        return result;
    }
    else {
        console.log('WARNING: Metadata Msg is not a well formed object', message);
        return result;
    }
}
exports.validateRemoteMetadata = validateRemoteMetadata;
function cleanMetadataInput(input) {
    const id = input.id || input.docId;
    if (typeof id !== 'string')
        return undefined;
    const bytes = input.bytes;
    if (typeof bytes !== 'undefined' && typeof bytes !== 'number')
        return undefined;
    const actors = input.actors || input.actorIds;
    //  const follows = input.follows;
    const merge = input.merge;
    const mimeType = input.mimeType;
    const deleted = input.deleted;
    if (actors !== undefined) {
        if (!(actors instanceof Array))
            return undefined;
        if (!actors.every(isValidID))
            return undefined;
    }
    //  if (follows !== undefined) {
    //    if (!(follows instanceof Array)) return undefined;
    //    if (!follows.every(isValidID)) return undefined;
    //  }
    if (merge !== undefined) {
        if (typeof merge !== 'object')
            return undefined;
        if (!Object.keys(merge).every((id) => isValidID(id)))
            return undefined;
        if (!Object.values(merge).every(isNumber))
            return undefined;
    }
    const meta = actors || deleted || merge; // || follows;
    if (meta === undefined && bytes === undefined)
        return undefined;
    if (meta !== undefined && bytes !== undefined)
        return undefined;
    // XXX(jeff): This is not technically returning a valid MetadataBlock. It's
    // returning a union of all possible sub-types, which is a valid type, but not
    // a valid value.
    return {
        id,
        bytes,
        mimeType,
        actors,
        //    follows,
        merge,
        deleted,
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
function isDeletedBlock(block) {
    return 'deleted' in block && block.deleted;
}
function isNumber(n) {
    return typeof n === 'number';
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
    const buffer = Base58.decode(id);
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
    constructor(storageFn, joinFn, leaveFn) {
        this.docs = new Set();
        this.primaryActors = new MapSet_1.default();
        //  private follows: MapSet<string, string> = new MapSet();
        this.files = new Map();
        this.mimeTypes = new Map();
        this.merges = new Map();
        this.readyQ = new Queue_1.default('repo:metadata:readyQ'); // FIXME - need a better api for accessing metadata
        this._clocks = {};
        this._docsWith = new Map();
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
            this.primaryActors = new MapSet_1.default();
            //    this.follows = new MapSet();
            this.files = new Map();
            this.mimeTypes = new Map();
            this.merges = new Map();
            this.ready = true;
            this.batchAdd(data);
            this.replay.map(this.writeThrough);
            this.replay = [];
            this._clocks = {};
            this._docsWith = new Map();
            this.allActors().forEach((actorId) => this.join(actorId));
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
                this._clocks = {};
                this._docsWith.clear();
                if (isFileBlock(block)) {
                    this.join(Misc_1.hyperfileActorId(block.id));
                }
                else if (isDeletedBlock(block)) {
                    this.actors(block.id).forEach(this.leave);
                }
                else {
                    this.actors(block.id).forEach(this.join);
                }
            }
        };
        this.append = (block) => {
            this.ledger.append(JsonBuffer.bufferify(block), (err) => {
                if (err)
                    console.log('APPEND ERROR', err);
            });
        };
        this.ledger = hypercore_1.hypercore(storageFn('ledger'), {});
        this.join = joinFn;
        this.leave = leaveFn;
        log('LEDGER READY (1)');
        this.ledger.ready(() => {
            log('LEDGER READY (2)', this.ledger.length);
            hypercore_1.readFeed('ledger', this.ledger, this.loadLedger);
        });
    }
    hasBlock(block) {
        return false;
    }
    batchAdd(blocks) {
        log('Batch add', blocks.length);
        blocks.forEach((block, i) => this.addBlock(i, block));
    }
    addBlock(idx, block) {
        let changedDocs = false;
        let changedActors = false;
        //    let changedFollow = false;
        let changedFiles = false;
        let changedMerge = false;
        let id = block.id;
        if ('actors' in block && block.actors !== undefined) {
            changedActors = this.primaryActors.merge(block.id, block.actors);
        }
        //    if (block.follows !== undefined) {
        //      changedFollow = this.follows.merge(id, block.follows);
        //    }
        if (isFileBlock(block)) {
            if (this.files.get(block.id) !== block.bytes ||
                this.mimeTypes.get(block.id) !== block.mimeType) {
                changedFiles = true;
                this.files.set(block.id, block.bytes);
                this.mimeTypes.set(block.id, block.mimeType);
            }
        }
        if ('merge' in block && block.merge !== undefined) {
            const oldClock = this.merges.get(block.id) || {};
            const newClock = Clock_1.union(oldClock, block.merge);
            changedMerge = !Clock_1.equivalent(newClock, oldClock);
            if (changedMerge) {
                this.merges.set(block.id, newClock);
            }
        }
        // shit - bug - rethink the whole remote people deleted something
        // i dont care of they deleted it
        if ('deleted' in block && block.deleted) {
            if (this.docs.has(block.id)) {
                this.docs.delete(block.id);
                changedDocs = true;
            }
        }
        else {
            // XXX(jeff): I don't think this logic can be correct. This branch will be run
            // for FileBlocks. That seems bad, but I'm not sure how to fix it.
            const brokenId = block.id; // HACK: This type not matching is part of why I think it's incorrect
            if (!this.docs.has(brokenId)) {
                this.docs.add(brokenId);
                changedDocs = true;
            }
        }
        return changedActors || changedMerge || changedFiles || changedDocs; // || changedFollow;
    }
    allActors() {
        return new Set([...this.primaryActors.union(), ...this.files.keys()]);
    }
    setWritable(actor, writable) {
        this.writable.set(actor, writable);
    }
    localActorId(id) {
        for (let actor of this.primaryActors.get(id)) {
            if (this.writable.get(actor) === true) {
                return actor;
            }
        }
        return undefined;
    }
    actorsAsync(id) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.readyQ.push(() => {
                    resolve(this.actors(id));
                });
            });
        });
    }
    actors(id) {
        return Object.keys(this.clock(id));
    }
    /*
    private actorsSeen(id: string, acc: string[], seen: Set<string>): string[] {
      const primaryActors = this.primaryActors.get(id)!;
      const mergeActors = Object.keys(this.merges.get(id) || {});
      acc.push(...primaryActors);
      acc.push(...mergeActors);
      seen.add(id);
      this.follows.get(id).forEach(follow => {
        if (!seen.has(follow)) {
          this.actorsSeen(follow, acc, seen);
        }
      });
      return acc;
    }
  */
    clockAt(id, actor) {
        return this.clock(id)[actor] || 0;
    }
    clock(id) {
        if (this._clocks[id])
            return this._clocks[id];
        const clock = { [id]: Infinity }; // this also covers the clock for files
        const actors = this.primaryActors.get(id);
        const merges = this.merges.get(id);
        if (actors)
            actors.forEach((actor) => (clock[actor] = Infinity));
        if (merges)
            Clock_1.addTo(clock, merges);
        this._clocks[id] = clock;
        return clock;
    }
    docsWith(actor, seq = 1) {
        // this is probably unnecessary
        const key = `${actor}-${seq}`;
        if (!this._docsWith.has(key)) {
            const docs = [...this.docs].filter((id) => this.has(id, actor, seq));
            this._docsWith.set(key, docs);
        }
        return this._docsWith.get(key);
    }
    has(id, actor, seq) {
        if (!(seq >= 1))
            throw new Error('seq number must be 1 or greater');
        return this.clockAt(id, actor) >= seq;
    }
    merge(id, merge) {
        this.writeThrough({ id, merge });
    }
    addFile(hyperfileUrl, bytes, mimeType) {
        const id = validateFileURL(hyperfileUrl);
        this.writeThrough({ id, bytes, mimeType });
    }
    delete(id) {
        this.writeThrough({ id, deleted: true });
    }
    addActor(id, actorId) {
        this.addActors(id, [actorId]);
    }
    addBlocks(blocks) {
        blocks.forEach((block) => {
            this.writeThrough(block);
        });
    }
    addActors(id, actors) {
        this.writeThrough({ id, actors });
    }
    isFile(id) {
        return this.files.get(id) !== undefined;
    }
    isKnown(id) {
        return this.isFile(id) || this.isDoc(id);
    }
    isDoc(id) {
        return this.primaryActors.get(id).size > 0;
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        const total = (_benchTotal[msg] || 0) + duration;
        _benchTotal[msg] = total;
        log(`metadata task=${msg} time=${duration}ms total=${total}ms`);
    }
    publicMetadata(id, cb) {
        this.readyQ.push(() => {
            if (this.isDoc(id)) {
                cb({
                    type: 'Document',
                    clock: {},
                    history: 0,
                    actor: this.localActorId(id),
                    actors: this.actors(id),
                });
            }
            else if (this.isFile(id)) {
                const bytes = this.files.get(id);
                const mimeType = this.mimeTypes.get(id);
                cb({
                    type: 'File',
                    bytes,
                    mimeType,
                });
            }
            else {
                cb(null);
            }
        });
    }
    forDoc(id) {
        return {
            id,
            actors: [...this.primaryActors.get(id)],
            //      follows: [...this.follows.get(id)],
            merge: this.merges.get(id) || {},
        };
    }
    forActor(actor) {
        return this.docsWith(actor).map((id) => this.forDoc(id));
    }
}
exports.Metadata = Metadata;
//# sourceMappingURL=Metadata.js.map