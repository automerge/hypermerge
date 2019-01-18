import Queue from "./Queue";
import * as Base58 from "bs58";
import MapSet from "./MapSet";
import * as crypto from "hypercore/lib/crypto";
import { ToFrontendReplyMsg, ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { Handle } from "./Handle";
import { ChangeFn, Doc, Patch } from "automerge/frontend";
import * as Frontend from "automerge/frontend";
import { DocFrontend } from "./DocFrontend";
import { clock2strs, Clock, clockDebug } from "./Clock";
import Debug from "debug";
import { PublicMetadata, validateDocURL, validateFileURL, validateURL } from "./Metadata";
import mime from "mime-types";

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
  cb: Map<number, (reply: any) => void> = new Map();
  msgcb: Map<number, (patch: Patch) => void> = new Map();
  readFiles: MapSet<string, (data: Uint8Array, mimeType: string) => void> = new MapSet();
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
    return `hypermerge:/${docId}`;
  };

  change = <T>(id: string, fn: ChangeFn<T>) => {
    this.open<T>(id).change(fn);
  };

  meta = (url: string, cb:(meta: PublicMetadata | undefined) => void): void => {
    const {id , type} = validateURL(url);
    this.queryBackend({ type: "MetadataMsg", id }, (meta: PublicMetadata | undefined) => {
      if (meta) {
      const doc = this.docs.get(id);
        if (doc && meta.type === "Document") {
          meta.actor = doc.actorId
          meta.history = doc.history
          meta.clock = doc.clock
        }
      }
      cb(meta)
    })
  }

  meta2 = (url: string): DocMetadata | undefined => {
    const {id , type} = validateURL(url);
    const doc = this.docs.get(id);
    if (!doc) return;
    return {
      actor: doc.actorId,
      history: doc.history,
      clock: doc.clock
    };
  };

  merge = (url: string, target: string) => {
    const id = validateDocURL(url);
    validateDocURL(target);
    this.doc(target, (doc, clock) => {
      const actors = clock2strs(clock!);
      this.toBackend.push({ type: "MergeMsg", id, actors });
    });
  };

  writeFile = <T>(data: Uint8Array, mimeType: string): string => {
    const keys = crypto.keyPair();
    const publicKey = Base58.encode(keys.publicKey);
    const secretKey = Base58.encode(keys.secretKey);
    if (mime.extensions[mimeType] === undefined) {
      throw new Error(`invalid mime type ${mimeType}`)
    }
    this.toBackend.push(data);
    this.toBackend.push({ type: "WriteFile", publicKey, secretKey, mimeType });
    return `hyperfile:/${publicKey}`;
  };

  readFile = <T>(url: string, cb: (data: Uint8Array, mimeType: string) => void): void => {
    const id = validateFileURL(url);
    this.readFiles.add(id, cb);
    this.toBackend.push({ type: "ReadFile", id });
  };

  fork = (url: string): string => {
    validateDocURL(url);
    const fork = this.create();
    this.merge(fork, url);
    return fork;
  };

  follow = (url: string, target: string) => {
    const id = validateDocURL(url);
    this.toBackend.push({ type: "FollowMsg", id, target });
  };

  watch = <T>( url: string, cb: (val: T, clock?: Clock, index?: number) => void): Handle<T> => {
    validateDocURL(url);
    const handle = this.open<T>(url);
    handle.subscribe(cb);
    return handle;
  };

  doc = <T>(url: string, cb?: (val: T, clock?: Clock) => void): Promise<T> => {
    validateDocURL(url);
    return new Promise(resolve => {
      const handle = this.open<T>(url);
      handle.subscribe((val, clock) => {
        resolve(val);
        if (cb) cb(val, clock);
        handle.close();
      });
    });
  };

  materialize = <T>(url: string, history: number, cb: (val: T) => void) => {
    const id = validateDocURL(url);
    const doc = this.docs.get(id);
    if (doc === undefined) { throw new Error(`No such document ${id}`) }
    if (history < 0 && history >= doc.history) { throw new Error(`Invalid history ${history} for id ${id}`) }
    this.queryBackend({ type: "MaterializeMsg", history, id }, (patch: Patch) => {
      const doc = Frontend.init({ deferActorId: true }) as Doc<T>;
      cb(Frontend.applyPatch(doc, patch));
    });
  }

  queryBackend( query: ToBackendQueryMsg, cb: (arg: any) => void ) {
    msgid += 1 // global counter
    const id = msgid
    this.cb.set(id,cb)
    this.toBackend.push({type: "Query", id, query})
  }

  open = <T>(url: string): Handle<T> => {
    const id = validateDocURL(url);
    const doc: DocFrontend<T> = this.docs.get(id) || this.openDocFrontend(id);
    return doc.handle();
  }

  debug(url: string) {
    const id = validateDocURL(url);
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

  destroy = (url: string) : void => {
    const { id } = validateURL(url);
    this.toBackend.push({ type: "DestroyMsg", id });
    const doc = this.docs.get(id);
    if (doc) {
      // doc.destroy()
      this.docs.delete(id)
    }
  }

/*
  handleReply = (id: number, reply: ToFrontendReplyMsg) => {
    const cb = this.cb.get(id)!
    switch (reply.type) {
      case "MaterializeReplyMsg": {
        cb(reply.patch);
        break;
      }
    }
    this.cb.delete(id)
  }
*/

  receive = (msg: ToFrontendRepoMsg) => {
    if (msg instanceof Uint8Array) {
      this.file = msg;
    } else {
      switch (msg.type) {
        case "ReadFileReply": {
          const doc = this.docs.get(msg.id)!;
          this.readFiles.get(msg.id).forEach(cb => cb(this.file!, msg.mimeType));
          this.readFiles.delete(msg.id);
          delete this.file;
          break;
        }
        case "PatchMsg": {
          const doc = this.docs.get(msg.id)!;
          doc.patch(msg.patch, msg.history);
          break;
        }
        case "Reply": {
          const id = msg.id
//          const reply = msg.reply
         // this.handleReply(id,reply)
          const cb = this.cb.get(id)!
          cb(msg.payload)
          this.cb.delete(id)!
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
          const doc = this.docs.get(msg.id);
          if (doc) {
            const progressEvent = {
              actor: msg.actorId,
              index: msg.index,
              size: msg.size,
              time: msg.time
            }
            doc.progress(progressEvent)
          }
          break;
        }
      }
    }
  };
}
