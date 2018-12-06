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
const log = debug_1.default("metadata");
const Clock_1 = require("./Clock");
//const blocks = validateMetadataMsg(: MetadataBlock[] = JSON.parse(msg.input.toString())
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
    console.log("CLEAN", input);
    const id = input.id || input.docId;
    if (typeof id !== 'string')
        return undefined;
    const bytes = input.bytes;
    if (typeof bytes !== 'undefined' && typeof bytes !== 'number')
        return undefined;
    const actors = input.actors || input.actorIds;
    const follows = input.follows;
    const merge = input.merge;
    if (actors !== undefined) {
        if (!(actors instanceof Array))
            return undefined;
        if (!actors.every(isValidID))
            return undefined;
    }
    if (follows !== undefined) {
        if (!(follows instanceof Array))
            return undefined;
        if (follows.every(isValidID))
            return undefined;
    }
    if (merge !== undefined) {
        if (typeof merge !== 'object')
            return undefined;
        if (!Object.keys(merge).every(isValidID))
            return undefined;
        if (!Object.values(merge).every(isNumber))
            return undefined;
    }
    const meta = actors || follows || merge;
    if (meta === undefined && bytes === undefined)
        return undefined;
    if (meta !== undefined && bytes !== undefined)
        return undefined;
    return {
        id,
        bytes,
        actors,
        follows,
        merge
    };
}
exports.cleanMetadataInput = cleanMetadataInput;
function filterMetadataInputs(input) {
    const metadata = [];
    input.forEach(i => {
        const cleaned = cleanMetadataInput(i);
        if (cleaned !== undefined) {
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
    return typeof n === 'number';
}
function isValidID(id) {
    try {
        const buffer = Base58.decode(id);
        return (buffer.length === 32);
    }
    catch (e) {
        return false;
    }
}
exports.isValidID = isValidID;
function validateID(id) {
    const buffer = Base58.decode(id);
    if (buffer.length !== 32) {
        throw new Error(`invalid id ${id}`);
    }
}
exports.validateID = validateID;
function isMetadataBlock(block) {
    // TODO: this isn't perfect, but good enough for now
    return typeof block === "object"
        && block != null
        && typeof block.id === "string";
}
exports.isMetadataBlock = isMetadataBlock;
class Metadata {
    constructor(ledger) {
        this.primaryActors = new MapSet_1.default();
        this.follows = new MapSet_1.default();
        this.merges = new Map();
        this.readyQ = new Queue_1.default();
        this.clocks = new Map();
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
            if (!this.ready)
                this.replay.push(block);
            const dirty = this.addBlock(block);
            if (this.ready && dirty)
                this.ledger.append(block);
            this.genClocks();
        };
        this.ledger = ledger;
        this.ledger.ready(() => {
            hypercore_1.readFeed(this.ledger, this.loadLedger);
        });
    }
    hasBlock(block) {
        return false;
    }
    batchAdd(blocks) {
        blocks.forEach(block => this.addBlock(block));
    }
    addBlock(block) {
        let changedActors = false;
        let changedFollow = false;
        let changedMerge = false;
        let id = block.id;
        if (block.actors !== undefined) {
            changedActors = this.primaryActors.merge(id, block.actors);
        }
        if (block.follows !== undefined) {
            changedFollow = this.follows.merge(id, block.follows);
        }
        if (block.merge !== undefined) {
            const oldClock = this.merges.get(id) || {};
            const newClock = Clock_1.union(oldClock, block.merge);
            changedMerge = !Clock_1.equivalent(newClock, oldClock);
            if (changedMerge) {
                this.merges.set(id, newClock);
            }
        }
        return changedActors || changedFollow || changedMerge;
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
        const mergeActors = Object.keys((this.merges.get(id) || {}));
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
        const clocks = new Map();
        const docs = this.primaryActors.keys().forEach(id => {
            clocks.set(id, this.genClock(id));
        });
        this.clocks = clocks;
    }
    docsWith(actor, seq = 0) {
        return this.docs().filter(id => this.has(id, actor, seq));
    }
    covered(id, clock) {
        return Clock_1.intersection(this.clock(id), clock);
    }
    docs() {
        return [...this.clocks.keys()];
    }
    has(id, actor, seq) {
        return (this.clock(id)[actor] || 0) >= seq;
    }
    merge(id, merge) {
        this.writeThrough({ id, merge });
    }
    follow(id, follow) {
        this.writeThrough({ id, follows: [follow] });
    }
    addFile(id, bytes) {
        this.writeThrough({ id, bytes });
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
    forDoc(id) {
        return {
            id,
            actors: [...this.primaryActors.get(id)],
            follows: [...this.follows.get(id)],
            merge: this.merges.get(id) || {}
        };
    }
    forActor(actor) {
        return this.docsWith(actor, 0).map(id => this.forDoc(id));
    }
}
exports.Metadata = Metadata;
//# sourceMappingURL=Metadata.js.map