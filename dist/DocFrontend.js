"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocFrontend = void 0;
const cambriamerge_1 = require("cambriamerge");
const Clock_1 = require("./Clock");
const Queue_1 = __importDefault(require("./Queue"));
const Handle_1 = require("./Handle");
const Debug_1 = __importDefault(require("./Debug"));
const Misc_1 = require("./Misc");
// TODO - i bet this can be rewritten where the Frontend allocates the actorid on write - this
// would make first writes a few ms faster
const log = Debug_1.default('DocFrontend');
class DocFrontend {
    constructor(repo, config) {
        //super()
        this.ready = false; // do I need ready? -- covered my state !== pending?
        this.history = 0;
        //  private toBackend: Queue<ToBackendRepoMsg>
        this.changeQ = new Queue_1.default('repo:front:changeQ');
        this.mode = 'pending';
        this.handles = new Set();
        this.fork = () => {
            return '';
        };
        this.change = (fn) => {
            log('change', this.docId);
            if (!this.actorId) {
                log('change needsActorId', this.docId);
                this.repo.toBackend.push({ type: 'NeedsActorIdMsg', id: this.docId });
            }
            this.changeQ.push(fn);
        };
        this.release = () => {
            // what does this do now? - FIXME
        };
        this.setActorId = (actorId) => {
            log('setActorId', this.docId, actorId, this.mode);
            this.actorId = actorId;
            this.front = cambriamerge_1.Frontend.setActorId(this.front, actorId);
            if (this.mode === 'read') {
                this.mode = 'write';
                this.enableWrites(); // has to be after the queue
            }
        };
        this.init = (minimumClockSatisfied, actorId, patch, history) => {
            log(`init docid=${this.docId} actorId=${actorId} patch=${!!patch} history=${history} mode=${this.mode}`);
            if (this.mode !== 'pending')
                return;
            if (actorId)
                this.setActorId(actorId); // must set before patch
            if (patch)
                this.patch(patch, minimumClockSatisfied, history); // first patch!
        };
        this.patch = (patch, minimumClockSatisfied, history) => {
            this.bench('patch', () => {
                this.history = history;
                this.front = cambriamerge_1.Frontend.applyPatch(this.front, patch);
                this.updateClockPatch(patch);
                if (patch.diffs.length > 0 && minimumClockSatisfied) {
                    if (this.mode === 'pending') {
                        this.mode = 'read';
                        if (this.actorId) {
                            this.mode = 'write';
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
        this.schema = config.schema;
        this.clock = {};
        this.docId = docId;
        this.docUrl = Misc_1.toDocUrl(docId);
        //    this.toBackend = toBackend
        if (actorId) {
            this.front = cambriamerge_1.Frontend.init(actorId);
            this.actorId = actorId;
            this.ready = true;
            this.mode = 'write';
            this.enableWrites();
        }
        else {
            this.front = cambriamerge_1.Frontend.init({ deferActorId: true });
        }
    }
    handle() {
        let handle = new Handle_1.Handle(this.repo, this.docUrl, this.schema);
        this.handles.add(handle);
        handle.cleanup = () => this.handles.delete(handle);
        handle.changeFn = this.change;
        if (this.ready) {
            handle.push(this.front, this.clock);
        }
        return handle;
    }
    newState() {
        if (this.ready) {
            this.handles.forEach((handle) => {
                handle.push(this.front, this.clock);
            });
        }
    }
    progress(progressEvent) {
        this.handles.forEach((handle) => {
            handle.receiveProgressEvent(progressEvent);
        });
    }
    messaged(contents) {
        this.handles.forEach((handle) => {
            handle.receiveDocumentMessage(contents);
        });
    }
    enableWrites() {
        this.changeQ.subscribe((fn) => {
            const [doc, request] = cambriamerge_1.Frontend.change(this.front, fn);
            this.front = doc;
            log(`change complete doc=${this.docId} seq=${request ? request.seq : 'null'}`);
            if (request) {
                this.updateClockChange(request);
                this.newState();
                this.repo.toBackend.push({
                    type: 'RequestMsg',
                    id: this.docId,
                    request,
                });
            }
        });
    }
    updateClockChange(request) {
        const oldSeq = this.clock[request.actor] || 0;
        this.clock[request.actor] = Math.max(request.seq, oldSeq);
    }
    updateClockPatch(patch) {
        if (patch.clock)
            this.clock = Clock_1.union(this.clock, patch.clock); // dont know which is better - use both??...
        if (patch.deps)
            this.clock = Clock_1.union(this.clock, patch.deps);
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        log(`docId=${this.docId} task=${msg} time=${duration}ms`);
    }
    close() {
        this.handles.forEach((handle) => handle.close());
        this.handles.clear();
    }
}
exports.DocFrontend = DocFrontend;
//# sourceMappingURL=DocFrontend.js.map