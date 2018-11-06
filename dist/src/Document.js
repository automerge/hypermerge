"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const Frontend = __importStar(require("automerge/frontend"));
const Queue_1 = __importDefault(require("./Queue"));
const handle_1 = __importDefault(require("./handle"));
const debug_1 = __importDefault(require("debug"));
// TODO - i bet this can be rewritten where the Frontend allocates the actorid on write - this
// would make first writes a few ms faster
const log = debug_1.default("hypermerge:front");
class Document extends events_1.EventEmitter {
    constructor(docId, actorId) {
        super();
        this.changeQ = new Queue_1.default("frontend:change");
        this.mode = "pending";
        this.change = (fn) => {
            log("change", this.docId);
            if (!this.actorId) {
                log("change needsActorId", this.docId);
                this.emit("needsActorId");
            }
            this.changeQ.push(fn);
        };
        this.release = () => {
            this.removeAllListeners();
        };
        this.setActorId = (actorId) => {
            log("setActorId", this.docId, actorId, this.mode);
            this.actorId = actorId;
            this.front = Frontend.setActorId(this.front, actorId);
            if (this.mode === "read")
                this.enableWrites(); // has to be after the queue
        };
        this.init = (actorId, patch) => {
            log(`init docid=${this.docId} actorId=${actorId} patch=${!!patch} mode=${this.mode}`);
            if (this.mode !== "pending")
                return;
            if (actorId)
                this.setActorId(actorId); // must set before patch
            if (patch)
                this.patch(patch); // first patch!
            if (actorId)
                this.enableWrites(); // must enable after patch
        };
        this.patch = (patch) => {
            this.bench("patch", () => {
                this.front = Frontend.applyPatch(this.front, patch);
                if (patch.diffs.length > 0) {
                    if (this.mode === "pending")
                        this.mode = "read";
                    this.emit("doc", this.front);
                }
            });
        };
        if (actorId) {
            this.front = Frontend.init(actorId);
            this.docId = docId;
            this.actorId = actorId;
            this.enableWrites();
        }
        else {
            this.front = Frontend.init({ deferActorId: true });
            this.docId = docId;
        }
        this.on("newListener", (event, listener) => {
            if (event === "doc" && this.mode != "pending") {
                listener(this.front);
            }
        });
    }
    handle() {
        let handle = new handle_1.default();
        handle.cleanup = () => {
            this.removeListener("doc", handle.push);
        };
        handle.change = this.change;
        this.on("doc", handle.push);
        return handle;
    }
    enableWrites() {
        this.mode = "write";
        this.changeQ.subscribe(fn => {
            const doc = Frontend.change(this.front, fn);
            const request = Frontend.getRequests(doc).pop();
            this.front = doc;
            log(`change complete doc=${this.docId} seq=${request ? request.seq : "null"}`);
            if (request) {
                this.emit("doc", this.front);
                this.emit("request", request);
            }
        });
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        log(`docId=${this.docId} task=${msg} time=${duration}ms`);
    }
}
exports.Document = Document;
//# sourceMappingURL=Document.js.map