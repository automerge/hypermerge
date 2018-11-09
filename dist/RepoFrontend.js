"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const Queue_1 = __importDefault(require("./Queue"));
const Base58 = __importStar(require("bs58"));
const crypto = __importStar(require("hypercore/lib/crypto"));
const DocFrontend_1 = require("./DocFrontend");
const debug_1 = __importDefault(require("debug"));
debug_1.default.formatters.b = Base58.encode;
const log = debug_1.default("repo:front");
class RepoFrontend {
    constructor() {
        this.toBackend = new Queue_1.default("repo:tobackend");
        this.docs = new Map();
        this.subscribe = (subscriber) => {
            this.toBackend.subscribe(subscriber);
        };
        this.receive = (msg) => {
            const doc = this.docs.get(msg.id);
            switch (msg.type) {
                case "PatchMsg": {
                    doc.patch(msg.patch);
                    break;
                }
                case "ActorIdMsg": {
                    doc.setActorId(msg.actorId);
                    break;
                }
                case "ReadyMsg": {
                    doc.init(msg.actorId, msg.patch);
                    break;
                }
            }
        };
    }
    create() {
        const keys = crypto.keyPair();
        const publicKey = Base58.encode(keys.publicKey);
        const secretKey = Base58.encode(keys.secretKey);
        const docId = publicKey;
        const actorId = publicKey;
        const doc = new DocFrontend_1.DocFrontend(this.toBackend, { actorId, docId });
        this.docs.set(docId, doc);
        this.toBackend.push({ type: "CreateMsg", publicKey, secretKey });
        return publicKey;
    }
    open(id) {
        const doc = this.docs.get(id) || this.openDocFrontend(id);
        return doc.handle();
    }
    openDocFrontend(id) {
        const doc = new DocFrontend_1.DocFrontend(this.toBackend, { docId: id });
        this.toBackend.push({ type: "OpenMsg", id });
        this.docs.set(id, doc);
        return doc;
    }
}
exports.RepoFrontend = RepoFrontend;
//# sourceMappingURL=RepoFrontend.js.map