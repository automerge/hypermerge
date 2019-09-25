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
Object.defineProperty(exports, "__esModule", { value: true });
const SQLStore_1 = require("./SQLStore");
const Clock_1 = require("./Clock");
const Queue_1 = __importDefault(require("./Queue"));
// Note: We store clocks as serialized JSON. This has several downsides compared to a more
// traditional m2m schema, but has the upside of allowing us to easily set the entire
// clock.
class ClockStore {
    constructor(store) {
        this.updateLog = new Queue_1.default();
        this.store = store;
    }
    get(documentId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield this.store.get(SQLStore_1.SQL `SELECT clock FROM DocumentClock WHERE documentId=${documentId}`);
            return result ? parseClock(result.clock) : undefined;
        });
    }
    getMultiple(documentIds) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = SQLStore_1.SQL `SELECT * FROM DocumentClock WHERE documentId IN (`;
            query.append(SQLStore_1.joinStatements(documentIds.map((docId) => SQLStore_1.SQL `${docId}`), ', '));
            query.append(SQLStore_1.SQL `)`);
            const result = yield this.store.all(query);
            return result.reduce((clockMap, row) => {
                clockMap[row.documentId] = parseClock(row.clock);
                return clockMap;
            }, {});
        });
    }
    set(documentId, clock) {
        return __awaiter(this, void 0, void 0, function* () {
            const clockValue = serializeClock(clock);
            const sql = SQLStore_1.SQL `INSERT INTO DocumentClock (documentId, clock) VALUES (${documentId}, ${clockValue}) ON CONFLICT (documentId) DO UPDATE SET clock=excluded.clock`;
            yield this.store.run(sql);
            const update = [documentId, clock];
            this.updateLog.push(update);
            return update;
        });
    }
    // If using the more normalized schema, we can use ON CONFLICT UPDATE to only update the row
    // if the new clock value is greater than the old clock value. This avoids the traditional
    // read-write cycle.
    merge(documentId, clock) {
        return __awaiter(this, void 0, void 0, function* () {
            const existingClock = yield this.get(documentId);
            if (!existingClock) {
                return this.set(documentId, clock);
            }
            const mergedClock = Clock_1.union(existingClock, clock);
            return this.set(documentId, mergedClock);
        });
    }
}
exports.default = ClockStore;
function serializeClock(clock) {
    return JSON.stringify(clock);
}
function parseClock(clockVal) {
    return JSON.parse(clockVal);
}
//# sourceMappingURL=ClockStore.js.map