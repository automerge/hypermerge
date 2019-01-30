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
const Clock_1 = require("./Clock");
const Queue_1 = __importDefault(require("./Queue"));
const Handle_1 = require("./Handle");
const debug_1 = __importDefault(require("debug"));
// TODO - i bet this can be rewritten where the Frontend allocates the actorid on write - this
// would make first writes a few ms faster
const log = debug_1.default("hypermerge:front");
class DocFrontend {
    constructor(repo, config) {
        //super()
        this.ready = false; // do I need ready? -- covered my state !== pending?
        this.history = 0;
        //  private toBackend: Queue<ToBackendRepoMsg>
        this.changeQ = new Queue_1.default("frontend:change");
        this.mode = "pending";
        this.handles = new Set();
        this.fork = () => {
            return "";
        };
        this.change = (fn) => {
            log("change", this.docId);
            if (!this.actorId) {
                log("change needsActorId", this.docId);
                this.repo.toBackend.push({ type: "NeedsActorIdMsg", id: this.docId });
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
        this.init = (synced, actorId, patch, history) => {
            log(`init docid=${this.docId} actorId=${actorId} patch=${!!patch} history=${history} mode=${this.mode}`);
            if (this.mode !== "pending")
                return;
            if (actorId)
                this.setActorId(actorId); // must set before patch
            if (patch)
                this.patch(patch, synced, history); // first patch!
        };
        this.patch = (patch, synced, history) => {
            this.bench("patch", () => {
                this.history = history;
                this.front = Frontend.applyPatch(this.front, patch);
                this.updateClockPatch(patch);
                if (patch.diffs.length > 0 && synced) {
                    if (this.mode === "pending") {
                        this.mode = "read";
                        if (this.actorId) {
                            this.mode = "write";
                            this.enableWrites();
                        }
                        this.ready = true;
                    }
                    this.newState();
                }
            });
        };
        const docId = config.docId;
        const actorId = config.actorId;
        this.repo = repo;
        this.clock = {};
        //    this.toBackend = toBackend
        if (actorId) {
            this.front = Frontend.init(actorId);
            this.docId = docId;
            this.actorId = actorId;
            this.ready = true;
            this.mode = "write";
            this.enableWrites();
        }
        else {
            this.front = Frontend.init({ deferActorId: true });
            this.docId = docId;
        }
    }
    handle() {
        let handle = new Handle_1.Handle(this.repo);
        this.handles.add(handle);
        handle.cleanup = () => this.handles.delete(handle);
        handle.changeFn = this.change;
        handle.id = this.docId;
        if (this.ready) {
            handle.push(this.front, this.clock);
        }
        return handle;
    }
    newState() {
        if (this.ready) {
            this.handles.forEach(handle => {
                handle.push(this.front, this.clock);
            });
        }
    }
    progress(progressEvent) {
        this.handles.forEach(handle => {
            handle.pushProgress(progressEvent);
        });
    }
    enableWrites() {
        this.changeQ.subscribe(fn => {
            const [doc, request] = Frontend.change(this.front, fn);
            this.front = doc;
            log(`change complete doc=${this.docId} seq=${request ? request.seq : "null"}`);
            if (request) {
                this.updateClockChange(request);
                this.newState();
                this.repo.toBackend.push({
                    type: "RequestMsg",
                    id: this.docId,
                    request
                });
            }
        });
    }
    updateClockChange(change) {
        const oldSeq = this.clock[change.actor] || 0;
        this.clock[change.actor] = Math.max(change.seq, oldSeq);
    }
    updateClockPatch(patch) {
        this.clock = Clock_1.union(this.clock, patch.clock); // dont know which is better - use both??...
        this.clock = Clock_1.union(this.clock, patch.deps);
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        log(`docId=${this.docId} task=${msg} time=${duration}ms`);
    }
    close() {
        this.handles.forEach(handle => handle.close());
        this.handles.clear();
    }
}
exports.DocFrontend = DocFrontend;
//# sourceMappingURL=DocFrontend.js.map