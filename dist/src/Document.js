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
const Frontend = __importStar(require("automerge/frontend"));
const Queue_1 = __importDefault(require("./Queue"));
const Handle_1 = __importDefault(require("./Handle"));
const debug_1 = __importDefault(require("debug"));
// TODO - i bet this can be rewritten where the Frontend allocates the actorid on write - this
// would make first writes a few ms faster
const log = debug_1.default("hypermerge:front");
class Document {
    constructor(config) {
        //super()
        this.toBackend = new Queue_1.default();
        this.changeQ = new Queue_1.default("frontend:change");
        this.mode = "pending";
        this.handles = new Set();
        this.change = (fn) => {
            log("change", this.docId);
            if (!this.actorId) {
                log("change needsActorId", this.docId);
                this.toBackend.push({ type: "NeedsActorIdMsg", id: this.docId });
            }
            this.changeQ.push(fn);
        };
        this.release = () => {
            // what does this do now? - FIXME
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
                    this.newState();
                }
            });
        };
        const docId = config.docId;
        const actorId = config.actorId;
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
    }
    /*
      subscribe = (subscriber: (message: ToBackendMsg) => void) => {
        this.toBackend.subscribe(subscriber)
      }
    
      receive = (msg: ToFrontendMsg) => {
        log("receive", msg)
        switch (msg.type) {
          case "PatchMsg": {
            this.patch(msg.patch)
            break
          }
          case "ActorIdMsg": {
            this.setActorId(msg.actorId)
            break
          }
          case "ReadyMsg": {
            this.init(msg.actorId, msg.patch)
            break
          }
        }
      }
    */
    handle() {
        let handle = new Handle_1.default();
        this.handles.add(handle);
        handle.cleanup = () => this.handles.delete(handle);
        handle.change = this.change;
        if (this.mode != "pending") {
            handle.push(this.front);
        }
        return handle;
    }
    newState() {
        this.handles.forEach(handle => handle.push(this.front));
    }
    enableWrites() {
        this.mode = "write";
        this.changeQ.subscribe(fn => {
            const doc = Frontend.change(this.front, fn);
            const request = Frontend.getRequests(doc).pop();
            this.front = doc;
            log(`change complete doc=${this.docId} seq=${request ? request.seq : "null"}`);
            if (request) {
                this.newState();
                this.toBackend.push({ type: "RequestMsg", id: this.docId, request });
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