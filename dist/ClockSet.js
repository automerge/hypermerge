"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// core actors 
// dependant docs / dependant actors
function clock(input) {
    if (typeof input === 'string') {
        return { [input]: Infinity };
    }
    else {
        let ids = input;
        let clock = {};
        ids.map(str => str.split(":")).forEach(([id, max]) => {
            clock[id] = max ? parseInt(max) : Infinity;
        });
        return clock;
    }
}
exports.clock = clock;
function clock2strs(clock) {
    let ids = [];
    for (let id in clock) {
        const max = clock[id];
        if (max === Infinity) {
            ids.push(id);
        }
        else {
            ids.push(id + ":" + max);
        }
    }
    return ids;
}
exports.clock2strs = clock2strs;
function merge(c1, c2) {
    const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
    let tmp = {};
    actors.forEach(actor => {
        tmp[actor] = Math.max(c1[actor] || 0, c2[actor] || 0);
    });
    return tmp;
}
class ClockSet {
    constructor() {
        this.docActorSeq = new Map();
        this.actorDocSeq = new Map();
    }
    add(doc, val) {
        const updates = merge(this.clock(doc), val);
        this.docActorSeq.set(doc, updates);
        for (let actor in updates) {
            const seq = updates[actor];
            this.actorDocSeq.set(actor, Object.assign({}, this.docMap(actor), { [doc]: seq }));
        }
    }
    seq(doc, actor) {
        return this.clock(doc)[actor] || 0;
    }
    docSeq(actor, doc) {
        return this.docMap(actor)[doc] || 0;
    }
    docsWith(actor, seq) {
        const docSeq = this.docMap(actor);
        const docIds = Object.keys(docSeq);
        return docIds.filter(id => (seq <= docSeq[id]));
    }
    clock(doc) {
        return this.docActorSeq.get(doc) || {};
    }
    docMap(actor) {
        return this.actorDocSeq.get(actor) || {};
    }
    has(doc, clock) {
        for (let actor in clock) {
            const seq = clock[actor];
            if ((this.clock(doc)[actor] || 0) < seq) {
                return false;
            }
        }
        return true;
    }
}
exports.ClockSet = ClockSet;
//# sourceMappingURL=ClockSet.js.map