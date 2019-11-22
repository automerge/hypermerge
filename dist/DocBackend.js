"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const automerge_1 = require("automerge");
const Queue_1 = __importDefault(require("./Queue"));
const Debug_1 = __importDefault(require("./Debug"));
const Misc_1 = require("./Misc");
const log = Debug_1.default('DocBackend');
class DocBackend {
    constructor(documentId, back) {
        this.clock = {};
        this.changes = new Map();
        this.ready = new Queue_1.default('doc:back:readyQ');
        this.updateQ = new Queue_1.default('doc:back:updateQ');
        this.localChangeQ = new Queue_1.default('doc:back:localChangeQ');
        this.remoteChangesQ = new Queue_1.default('doc:back:remoteChangesQ');
        this.applyRemoteChanges = (changes) => {
            this.remoteChangesQ.push(changes);
        };
        this.applyLocalChange = (change) => {
            this.localChangeQ.push(change);
        };
        this.initActor = (actorId) => {
            log('initActor');
            if (this.back) {
                this.actorId = this.actorId || actorId;
                this.updateQ.push({
                    type: 'ActorIdMsg',
                    id: this.id,
                    actorId: this.actorId,
                });
            }
        };
        this.init = (changes, actorId) => {
            this.bench('init', () => {
                //console.log("CHANGES MAX",changes[changes.length - 1])
                //changes.forEach( (c,i) => console.log("CHANGES", i, c.actor, c.seq))
                const [back, patch] = automerge_1.Backend.applyChanges(automerge_1.Backend.init(), changes);
                this.actorId = this.actorId || actorId;
                this.back = back;
                this.updateClock(changes);
                //console.log("INIT SYNCED", this.synced, changes.length)
                this.ready.subscribe((f) => f());
                this.subscribeToLocalChanges();
                this.subscribeToRemoteChanges();
                const history = this.back.getIn(['opSet', 'history']).size;
                this.updateQ.push({
                    type: 'ReadyMsg',
                    doc: this,
                    patch,
                    history,
                });
            });
        };
        this.id = documentId;
        if (back) {
            this.back = back;
            this.actorId = Misc_1.rootActorId(documentId);
            this.ready.subscribe((f) => f());
            this.subscribeToRemoteChanges();
            this.subscribeToLocalChanges();
            const history = this.back.getIn(['opSet', 'history']).size;
            this.updateQ.push({
                type: 'ReadyMsg',
                doc: this,
                history,
            });
        }
    }
    updateClock(changes) {
        changes.forEach((change) => {
            const actor = change.actor;
            const oldSeq = this.clock[actor] || 0;
            this.clock[actor] = Math.max(oldSeq, change.seq);
        });
    }
    subscribeToRemoteChanges() {
        this.remoteChangesQ.subscribe((changes) => {
            this.bench('applyRemoteChanges', () => {
                const [back, patch] = automerge_1.Backend.applyChanges(this.back, changes);
                this.back = back;
                this.updateClock(changes);
                const history = this.back.getIn(['opSet', 'history']).size;
                this.updateQ.push({
                    type: 'RemotePatchMsg',
                    doc: this,
                    patch,
                    history,
                });
            });
        });
    }
    subscribeToLocalChanges() {
        this.localChangeQ.subscribe((change) => {
            this.bench(`applyLocalChange seq=${change.seq}`, () => {
                const [back, patch] = automerge_1.Backend.applyLocalChange(this.back, change);
                this.back = back;
                this.updateClock([change]);
                const history = this.back.getIn(['opSet', 'history']).size;
                this.updateQ.push({
                    type: 'LocalPatchMsg',
                    doc: this,
                    change,
                    patch,
                    history,
                });
            });
        });
    }
    bench(msg, f) {
        const start = Date.now();
        f();
        const duration = Date.now() - start;
        log(`id=${this.id} task=${msg} time=${duration}ms`);
    }
}
exports.DocBackend = DocBackend;
//# sourceMappingURL=DocBackend.js.map