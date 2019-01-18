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
const MapSet_1 = __importDefault(require("./MapSet"));
const Base58 = __importStar(require("bs58"));
const hypercore_1 = require("./hypercore");
const debug_1 = __importDefault(require("debug"));
const URL = __importStar(require("url"));
const log = debug_1.default("repo:metadata");
const Clock_1 = require("./Clock");
function validateMetadataMsg(input) {
    try {
        const result = JSON.parse(input.toString());
        if (result instanceof Array) {
            return filterMetadataInputs(result);
        }
        else {
            log("WARNING: Metadata Msg is not an array");
            return [];
        }
    }
    catch (e) {
        log("WARNING: Metadata Msg is invalid JSON");
        return [];
    }
}
exports.validateMetadataMsg = validateMetadataMsg;
function cleanMetadataInput(input) {
    const id = input.id || input.docId;
    if (typeof id !== "string")
        return undefined;
    const bytes = input.bytes;
    if (typeof bytes !== "undefined" && typeof bytes !== "number")
        return undefined;
    const actors = input.actors || input.actorIds;
    const follows = input.follows;
    const merge = input.merge;
    const mimeType = input.mimeType;
    const deleted = input.deleted;
    if (actors !== undefined) {
        if (!(actors instanceof Array))
            return undefined;
        if (!actors.every(isValidID))
            return undefined;
    }
    if (follows !== undefined) {
        if (!(follows instanceof Array))
            return undefined;
        if (!follows.every(isValidID))
            return undefined;
    }
    if (merge !== undefined) {
        if (typeof merge !== "object")
            return undefined;
        if (!Object.keys(merge).every(isValidID))
            return undefined;
        if (!Object.values(merge).every(isNumber))
            return undefined;
    }
    const meta = actors || follows || merge || deleted;
    if (meta === undefined && bytes === undefined)
        return undefined;
    if (meta !== undefined && bytes !== undefined)
        return undefined;
    return {
        id,
        bytes,
        mimeType,
        actors,
        follows,
        merge,
        deleted
    };
}
exports.cleanMetadataInput = cleanMetadataInput;
function filterMetadataInputs(input) {
    const metadata = [];
    input.forEach(i => {
        const cleaned = cleanMetadataInput(i);
        if (cleaned) {
            metadata.push(cleaned);
        }
        else {
            log("WARNING: Metadata Input Invalid - ignoring", i);
        }
    });
    return metadata;
}
exports.filterMetadataInputs = filterMetadataInputs;
// Can I use stuff like this to let ID's be a type other than string?
//   export function isActorId(id: string) id is ActorId { }
//   export type ActorId = string & { _: "ActorId" }
//   export type DocId = string & { _: "ActorId", _2: "DocId" }
// are try catchs as expensive as I remember?  Not sure - I wrote this logic twice
function isNumber(n) {
    return typeof n === "number";
}
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
    if (urlString.indexOf(":") === -1) {
        console.log("WARNING: `${id}` is depricated - now use `hypermerge:/${id}`");
        //    throw new Error("WARNING: open(id) is depricated - now use open(`hypermerge:/${id}`)")
        const id = urlString;
        const buffer = validateID(id);
        return { type: "hypermerge", buffer, id };
    }
    const url = URL.parse(urlString);
    if (!url.path || !url.protocol) {
        throw new Error("invalid URL: " + urlString);
    }
    const id = url.path.slice(1);
    const type = url.protocol.slice(0, -1);
    const buffer = validateID(id);
    if (type !== "hypermerge" && type != "hyperfile") {
        throw new Error(`protocol must be hypermerge or hyperfile (${type}) (${urlString})`);
    }
    return { id, buffer, type };
}
exports.validateURL = validateURL;
function validateFileURL(urlString) {
    const info = validateURL(urlString);
    if (info.type != "hyperfile") {
        throw new Error("invalid URL - protocol must be hyperfile");
    }
    return info.id;
}
exports.validateFileURL = validateFileURL;
function validateDocURL(urlString) {
    const info = validateURL(urlString);
    if (info.type != "hypermerge") {
        throw new Error("invalid URL - protocol must be hypermerge");
    }
    return info.id;
}
exports.validateDocURL = validateDocURL;
class Metadata {
    constructor(storageFn) {
        this.primaryActors = new MapSet_1.default();
        this.follows = new MapSet_1.default();
        this.files = new Map();
        this.mimeTypes = new Map();
        this.merges = new Map();
        this.readyQ = new Queue_1.default(); // FIXME - need a better api for accessing metadata
        this.clocks = new Map();
        this.master = {};
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
        this.loadLedger = (input) => {
            const data = filterMetadataInputs(input); // FIXME
            this.primaryActors = new MapSet_1.default();
            this.follows = new MapSet_1.default();
            this.files = new Map();
            this.mimeTypes = new Map();
            this.merges = new Map();
            this.ready = true;
            this.batchAdd(data);
            this.replay.map(this.writeThrough);
            this.replay = [];
            this.genClocks();
            this.readyQ.subscribe(f => f());
        };
        // write through caching strategy
        this.writeThrough = (block) => {
            log("writeThrough", block);
            if (!this.ready)
                this.replay.push(block);
            const dirty = this.addBlock(-1, block);
            if (this.ready && dirty)
                this.append(block);
            this.genClocks();
        };
        this.append = (block) => {
            this.ledger.append(block);
        };
        this.ledger = hypercore_1.hypercore(storageFn("ledger"), {
            valueEncoding: "json"
        });
        this.id = this.ledger.id;
        log("LEDGER READY (1)");
        this.ledger.ready(() => {
            log("LEDGER READY (2)", this.ledger.length);
            hypercore_1.readFeed("ledger", this.ledger, this.loadLedger);
        });
    }
    hasBlock(block) {
        return false;
    }
    batchAdd(blocks) {
        log("Batch add", blocks.length);
        blocks.forEach((block, i) => this.addBlock(i, block));
    }
    addBlock(idx, block) {
        let changedActors = false;
        let changedFollow = false;
        let changedFiles = false;
        let changedMerge = false;
        let changedDeleted = false;
        let id = block.id;
        if (block.actors !== undefined) {
            changedActors = this.primaryActors.merge(id, block.actors);
        }
        if (block.follows !== undefined) {
            changedFollow = this.follows.merge(id, block.follows);
        }
        if (block.bytes !== undefined && block.mimeType !== undefined) {
            if (this.files.get(id) !== block.bytes || this.mimeTypes.get(id) !== block.mimeType) {
                changedFiles = true;
                this.files.set(id, block.bytes);
                this.mimeTypes.set(id, block.mimeType);
            }
        }
        if (block.merge !== undefined) {
            const oldClock = this.merges.get(id) || {};
            const newClock = Clock_1.union(oldClock, block.merge);
            changedMerge = !Clock_1.equivalent(newClock, oldClock);
            if (changedMerge) {
                this.merges.set(id, newClock);
            }
        }
        if (block.deleted === true) {
            if (this.files.get(id) !== undefined || this.primaryActors.get(id) !== undefined) {
                this.files.delete(id);
                this.mimeTypes.delete(id);
                this.merges.delete(id);
                this.primaryActors.delete(id);
                this.follows.delete(id);
                changedDeleted = true;
            }
        }
        return changedActors || changedFollow || changedMerge || changedFiles || changedDeleted;
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
    actorsAsync(id, cb) {
        this.readyQ.push(() => {
            cb(this.actors(id));
        });
    }
    actors(id) {
        return this.actorsSeen(id, [], new Set());
    }
    // FIXME - i really need a hell scenario test for this
    // prevent cyclical dependancies from causing an infinite search
    actorsSeen(id, acc, seen) {
        const primaryActors = this.primaryActors.get(id);
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
    clock(id) {
        return this.clocks.get(id);
    }
    genClock(id) {
        const infinityClock = {};
        this.actors(id).forEach(actor => {
            infinityClock[actor] = Infinity;
        });
        return Clock_1.union(this.merges.get(id) || {}, infinityClock);
    }
    genClocks() {
        // dont really need to regen them all (but follow...)
        var master = {};
        const clocks = new Map();
        const docs = this.primaryActors.keys().forEach(id => {
            const clock = this.genClock(id);
            clocks.set(id, clock);
            master = Clock_1.union(clock, master);
        });
        this.clocks = clocks;
        this.master = master;
    }
    docsWith(actor, seq = 1) {
        return this.docs().filter(id => this.has(id, actor, seq));
    }
    covered(id, clock) {
        return Clock_1.intersection(this.clock(id), clock);
    }
    docs() {
        return [...this.clocks.keys()];
    }
    has(id, actor, seq) {
        if (!(seq >= 1))
            throw new Error("seq number must be 1 or greater");
        return (this.clock(id)[actor] || -1) >= seq;
    }
    merge(id, merge) {
        this.writeThrough({ id, merge });
    }
    follow(id, follow) {
        this.writeThrough({ id, follows: [follow] });
    }
    addFile(id, bytes, mimeType) {
        this.writeThrough({ id, bytes, mimeType });
    }
    delete(id) {
        this.writeThrough({ id, deleted: true });
    }
    addActor(id, actorId) {
        this.addActors(id, [actorId]);
    }
    addBlocks(blocks) {
        blocks.forEach(block => {
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
    publicMetadata(id, cb) {
        this.readyQ.push(() => {
            if (this.isDoc(id)) {
                cb({
                    type: "Document",
                    clock: {},
                    history: 0,
                    actor: this.localActorId(id),
                    actors: this.actors(id),
                    follows: [...this.follows.get(id)]
                });
            }
            else if (this.isFile(id)) {
                const bytes = this.files.get(id);
                const mimeType = this.mimeTypes.get(id);
                cb({
                    type: "File",
                    bytes,
                    mimeType
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
            follows: [...this.follows.get(id)],
            merge: this.merges.get(id) || {}
        };
    }
    forActor(actor) {
        return this.docsWith(actor).map(id => this.forDoc(id));
    }
}
exports.Metadata = Metadata;
//# sourceMappingURL=Metadata.js.map