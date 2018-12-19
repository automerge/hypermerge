import Queue from "./Queue";
import * as Base58 from "bs58";
import MapSet from "./MapSet";
import * as crypto from "hypercore/lib/crypto";
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { Handle } from "./Handle";
import { ChangeFn, Doc, Patch } from "automerge/frontend";
import * as Frontend from "automerge/frontend";
import { DocFrontend } from "./DocFrontend";
import { clock2strs, Clock, clockDebug } from "./Clock";
import Debug from "debug";
import { validateID } from "./Metadata";

Debug.formatters.b = Base58.encode;

const log = Debug("repo:front");

export interface DocMetadata {
  clock: Clock;
  history: number;
  actor?: string;
}
export interface ProgressEvent {
  actor: string;
  index: number;
  size: number;
  time: number;
}

let msgid = 1

export class RepoFrontend {
  toBackend: Queue<ToBackendRepoMsg> = new Queue("repo:tobackend");
  docs: Map<string, DocFrontend<any>> = new Map();
  msgcb: Map<number, (patch: Patch) => void> = new Map();
  readFiles: MapSet<string, (data: Uint8Array) => void> = new MapSet();
  file?: Uint8Array;

  create = (init?: any): string => {
    const keys = crypto.keyPair();
    const publicKey = Base58.encode(keys.publicKey);
    const secretKey = Base58.encode(keys.secretKey);
    const docId = publicKey;
    const actorId = publicKey;
    const doc = new DocFrontend(this, { actorId, docId });
    this.docs.set(docId, doc);
    this.toBackend.push({ type: "CreateMsg", publicKey, secretKey });
    if (init) {
      doc.change(state => {
        for (let key in init) {
          state[key] = init[key];
        }
      });
    }
    return publicKey;
  };

  change = <T>(id: string, fn: ChangeFn<T>) => {
    this.open<T>(id).change(fn);
  };

  meta = (id: string): DocMetadata | undefined => {
    validateID(id);
    const doc = this.docs.get(id);
    if (!doc) return;
    return {
      actor: doc.actorId,
      history: doc.history,
      clock: doc.clock
    };
  };

  merge = (id: string, target: string) => {
    this.doc(target, (doc, clock) => {
      const actors = clock2strs(clock!);
      this.toBackend.push({ type: "MergeMsg", id, actors });
    });
  };

  writeFile = <T>(data: Uint8Array): string => {
    const keys = crypto.keyPair();
    const publicKey = Base58.encode(keys.publicKey);
    const secretKey = Base58.encode(keys.secretKey);
    this.toBackend.push(data);
    this.toBackend.push({ type: "WriteFile", publicKey, secretKey });
    return publicKey;
  };

  readFile = <T>(id: string, cb: (data: Uint8Array) => void): void => {
    validateID(id);
    this.readFiles.add(id, cb);
    this.toBackend.push({ type: "ReadFile", id });
  };

  fork = (id: string): string => {
    const fork = this.create();
    this.merge(fork, id);
    return fork;
  };

  follow = (id: string, target: string) => {
    validateID(id);
    this.toBackend.push({ type: "FollowMsg", id, target });
  };

  watch = <T>(
    id: string,
    cb: (val: T, clock?: Clock, index?: number) => void
  ): Handle<T> => {
    const handle = this.open<T>(id);
    handle.subscribe(cb);
    return handle;
  };

  doc = <T>(id: string, cb?: (val: T, clock?: Clock) => void): Promise<T> => {
    validateID(id);
    return new Promise(resolve => {
      const handle = this.open<T>(id);
      handle.subscribe((val, clock) => {
        resolve(val);
        if (cb) cb(val, clock);
        handle.close();
      });
    });
  };

  materialize = <T>(id: string, history: number, cb: (val: T) => void) => {
    validateID(id);
    const doc = this.docs.get(id);
    if (doc === undefined) { throw new Error(`No such document ${id}`) }
    if (history < 0 && history >= doc.history) { throw new Error(`Invalid history ${history} for id ${id}`) }

    msgid += 1 // global counter

    this.msgcb.set(msgid, (patch: Patch) => {
      const doc = Frontend.init({ deferActorId: true }) as Doc<T>;
      cb(Frontend.applyPatch(doc, patch));
    });
    this.toBackend.push({ type: "MaterializeMsg", history, id, msgid });
  };

  open = <T>(id: string): Handle<T> => {
    validateID(id);
    const doc: DocFrontend<T> = this.docs.get(id) || this.openDocFrontend(id);
    return doc.handle();
  };

  debug(id: string) {
    validateID(id);
    const doc = this.docs.get(id);
    const short = id.substr(0, 5);
    if (doc === undefined) {
      console.log(`doc:frontend undefined doc=${short}`);
    } else {
      console.log(`doc:frontend id=${short}`);
      console.log(`doc:frontend clock=${clockDebug(doc.clock)}`);
    }

    this.toBackend.push({ type: "DebugMsg", id });
  }

  private openDocFrontend<T>(id: string): DocFrontend<T> {
    const doc: DocFrontend<T> = new DocFrontend(this, { docId: id });
    this.toBackend.push({ type: "OpenMsg", id });
    this.docs.set(id, doc);
    return doc;
  }

  subscribe = (subscriber: (message: ToBackendRepoMsg) => void) => {
    this.toBackend.subscribe(subscriber);
  };

  receive = (msg: ToFrontendRepoMsg) => {
    if (msg instanceof Uint8Array) {
      this.file = msg;
    } else {
      switch (msg.type) {
        case "ReadFileReply": {
          const doc = this.docs.get(msg.id)!;
          this.readFiles.get(msg.id).forEach(cb => cb(this.file!));
          this.readFiles.delete(msg.id);
          delete this.file;
          break;
        }
        case "PatchMsg": {
          const doc = this.docs.get(msg.id)!;
          doc.patch(msg.patch, msg.history);
          break;
        }
        case "MaterializeReplyMsg": {
          const cb = this.msgcb.get(msg.msgid)!;
          cb(msg.patch);
          break;
        }
        case "ActorIdMsg": {
          const doc = this.docs.get(msg.id)!;
          doc.setActorId(msg.actorId);
          break;
        }
        case "ReadyMsg": {
          const doc = this.docs.get(msg.id)!;
          doc.init(msg.actorId, msg.patch, msg.history);
          break;
        }
        case "ActorBlockDownloadedMsg": {
          const doc = this.docs.get(msg.id)!;
          const progressEvent = {
            actor: msg.actorId,
            index: msg.index,
            size: msg.size,
            time: msg.time
          }
          doc.progress(progressEvent)
          break;
        }
      }
    }
  };
}
