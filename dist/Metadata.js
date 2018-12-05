"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Queue_1 = __importDefault(require("./Queue"));
const MapSet_1 = __importDefault(require("./MapSet"));
const hypercore_1 = require("./hypercore");
const Clock_1 = require("./Clock");
/*
export function isMetadataBlock(block: any): block is MetadataBlock {
  // TODO: this isn't perfect, but good enough for now
  return typeof block === "object"
    && block != null
    && typeof block.docId === "string"
}
*/
class MetadataState {
}
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
        this.loadLedger = (data) => {
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
        let id = block.id || block.docId || block.id; // olds feeds have block.docId
        if (block.actorIds !== undefined) {
            changedActors = this.primaryActors.merge(id, block.actorIds);
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
    addActors(id, actorIds) {
        this.writeThrough({ id, actorIds });
    }
    forDoc(id) {
        return {
            id,
            actorIds: [...this.primaryActors.get(id)],
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