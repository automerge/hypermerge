"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function actors(clock) {
    return Object.keys(clock);
}
exports.actors = actors;
function gte(a, b) {
    for (let id in a) {
        if (a[id] < (b[id] || 0))
            return false;
    }
    for (let id in b) {
        if (b[id] > (a[id] || 0))
            return false;
    }
    return true;
}
exports.gte = gte;
function equal(a, b) {
    return cmp(a, b) === 'EQ';
}
exports.equal = equal;
function cmp(a, b) {
    const aGTE = gte(a, b);
    const bGTE = gte(b, a);
    if (aGTE && bGTE) {
        return 'EQ';
    }
    else if (aGTE && !bGTE) {
        return 'GT';
    }
    else if (!aGTE && bGTE) {
        return 'LT';
    }
    return 'CONCUR';
}
exports.cmp = cmp;
function strs2clock(input) {
    if (typeof input === 'string') {
        return { [input]: Infinity };
    }
    else {
        let ids = input;
        let clock = {};
        ids
            .map((str) => str.split(':'))
            .forEach(([id, max]) => {
            clock[id] = max ? parseInt(max) : Infinity;
        });
        return clock;
    }
}
exports.strs2clock = strs2clock;
function clock2strs(clock) {
    let ids = [];
    for (let id in clock) {
        const max = clock[id];
        if (max === Infinity) {
            ids.push(id);
        }
        else {
            ids.push(id + ':' + max);
        }
    }
    return ids;
}
exports.clock2strs = clock2strs;
function clockDebug(c) {
    const d = {};
    Object.keys(c).forEach((actor) => {
        const short = actor.substr(0, 5);
        d[short] = c[actor];
    });
    return JSON.stringify(d);
}
exports.clockDebug = clockDebug;
function equivalent(c1, c2) {
    const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
    for (let actor of actors) {
        if (c1[actor] != c2[actor]) {
            return false;
        }
    }
    return true;
}
exports.equivalent = equivalent;
function union(c1, c2) {
    let acc = Object.assign({}, c1);
    for (let id in c2) {
        acc[id] = Math.max(acc[id] || 0, c2[id]);
    }
    return acc;
}
exports.union = union;
function addTo(acc, clock) {
    for (let actor in clock) {
        acc[actor] = Math.max(acc[actor] || 0, clock[actor]);
    }
}
exports.addTo = addTo;
function intersection(c1, c2) {
    const actors = new Set([...Object.keys(c1), ...Object.keys(c2)]);
    let tmp = {};
    actors.forEach((actor) => {
        const val = Math.min(c1[actor] || 0, c2[actor] || 0);
        if (val > 0) {
            tmp[actor] = val;
        }
    });
    return tmp;
}
exports.intersection = intersection;
//# sourceMappingURL=Clock.js.map