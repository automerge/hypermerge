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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Misc_1 = require("./Misc");
const Automerge = __importStar(require("automerge"));
const Keys = __importStar(require("./Keys"));
class DocumentStore {
    constructor(feeds, clocks) {
        this.docs = new Map();
        this.feeds = feeds;
        this.clocks = clocks;
    }
    // Create a writable document
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = Keys.create();
            const feedId = yield this.feeds.create(keys);
            const docId = fromFeedId(feedId);
            //const clock = this.clocks.emptyClock([feedId])
            yield this.clocks.set(docId, clock); // is this useful?
            const backend = Automerge.Backend.init();
            const doc = {
                id: docId,
                clock: clock,
                backend: backend,
            };
            this.docs.set(docId, doc);
            return docId;
        });
    }
    // Open a read-only document
    open(docId) { }
    write(docId, changes) { }
}
exports.default = DocumentStore;
function fromFeedId(feedId) {
    return Misc_1.encodeDocId(Keys.decode(feedId));
}
//# sourceMappingURL=DocumentStore.js.map