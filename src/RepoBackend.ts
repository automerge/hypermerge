import Queue from "./Queue";
import { Metadata, validateMetadataMsg } from "./Metadata";
import { Actor, ActorMsg, EXT } from "./Actor";
import { strs2clock, clockDebug } from "./Clock";
import * as Base58 from "bs58";
import * as crypto from "hypercore/lib/crypto";
import { discoveryKey } from "./hypercore";
import * as Backend from "automerge/backend";
import { Clock, Change } from "automerge/backend";
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendReplyMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { DocBackend } from "./DocBackend";
import { notEmpty, ID } from "./Misc";
import Debug from "debug";

interface Swarm {
  join(dk: Buffer): void;
  leave(dk: Buffer): void;
  on: Function;
}

Debug.formatters.b = Base58.encode;

const HypercoreProtocol: Function = require("hypercore-protocol");

const log = Debug("repo:backend");

export interface KeyBuffer {
  publicKey: Buffer;
  secretKey?: Buffer;
}

export interface FeedData {
  actorId: string;
  writable: Boolean;
  changes: Change[];
}

export interface Options {
  path?: string;
  storage: Function;
}

export class RepoBackend {
  path?: string;
  storage: Function;
  joined: Set<Buffer> = new Set();
  actors: Map<string, Actor> = new Map();
  actorsDk: Map<string, Actor> = new Map();
  docs: Map<string, DocBackend> = new Map();
  meta: Metadata;
  opts: Options;
  toFrontend: Queue<ToFrontendRepoMsg> = new Queue("repo:toFrontend");
  swarm?: Swarm;
  id: Buffer;
  file?: Uint8Array;

  constructor(opts: Options) {
    this.opts = opts;
    this.path = opts.path || "default";
    this.storage = opts.storage;

    this.meta = new Metadata(this.storageFn);
    this.id = this.meta.id
  }

  private writeFile(keys: KeyBuffer, data: Uint8Array, mimeType: string) {
    const fileId = Base58.encode(keys.publicKey);

    this.meta.addFile(fileId, data.length, mimeType);

    const actor = this.initActor(keys);
    actor.writeFile(data, mimeType);
  }

  private readFile(id: string, cb: (data: Uint8Array, mimeType: string) => void) {
    log("readFile",id, this.meta.forDoc(id))
    if (this.meta.isDoc(id)) { throw new Error("trying to open a document like a file") }
    this.getReadyActor(id, actor => actor.readFile(cb));
  }

  private create(keys: KeyBuffer): DocBackend {
    const docId = Base58.encode(keys.publicKey);
    log("create", docId);
    const doc = new DocBackend(this, docId, Backend.init());

    this.docs.set(docId, doc);

    this.meta.addActor(doc.id, doc.id);

    this.initActor(keys);

    return doc;
  }

  private debug(id: string) {
    const doc = this.docs.get(id);
    const short = id.substr(0, 5);
    if (doc === undefined) {
      console.log(`doc:backend NOT FOUND id=${short}`);
    } else {
      console.log(`doc:backend id=${short}`);
      console.log(`doc:backend clock=${clockDebug(doc.clock)}`);
      const local = this.meta.localActorId(id);
      const actors = this.meta.actors(id);
      const info = actors
        .map(actor => {
          const nm = actor.substr(0, 5);
          return local === actor ? `*${nm}` : nm;
        })
        .sort();
      console.log(`doc:backend actors=${info.join(",")}`);
    }
  }

  private destroy(id: string) {
    this.meta.delete(id)
    const doc = this.docs.get(id)
    if (doc) {
      this.docs.delete(id)
    }
    const actors = Object.keys(this.meta.master)
    this.actors.forEach((actor,id) => {
      if (!actors.includes(id)) {
        console.log("Orfaned actors - will purge", id)
        this.actors.delete(id)
        actor.destroy()
      }
    })
  }

  // opening a file fucks it up
  private open(docId: string): DocBackend {
    log("open", docId, this.meta.forDoc(docId));
    if (this.meta.isFile(docId)) { throw new Error("trying to open a file like a document") }
    let doc = this.docs.get(docId) || new DocBackend(this, docId);
    if (!this.docs.has(docId)) {
      this.docs.set(docId, doc);
      this.meta.addActor(docId, docId);
      this.loadDocument(doc);
    }
    return doc;
  }

  merge(id: string, clock: Clock) {
    this.meta.merge(id, clock);
    this.syncReadyActors(Object.keys(clock));
  }

  follow(id: string, target: string) {
    this.meta.follow(id, target);
    this.syncReadyActors(this.meta.actors(id));
  }

  replicate = (swarm: Swarm) => {
    if (this.swarm) {
      throw new Error("replicate called while already swarming");
    }
    this.swarm = swarm;
    for (let dk of this.joined) {
      log("swarm.join")
      this.swarm.join(dk);
    }
  };

  private allReadyActors(docId: string, cb: (actors: Actor[]) => void) {
    const a2p = (id: string): Promise<Actor> =>
      new Promise((resolve, reject) => {
        try {
          this.getReadyActor(id, resolve)
        } catch (e) {
          reject(e)
        }
      });
    this.meta.actorsAsync(docId, ids => Promise.all(ids.map(a2p)).then(cb));
  }

  private loadDocument(doc: DocBackend) {
    this.allReadyActors(doc.id, actors => {
      log(`load document 2 actors=${actors.map((a) => a.id)}`)
      const changes: Change[] = [];
      actors.forEach(actor => {
        const max = this.meta.clock(doc.id)[actor.id] || 0;
        const slice = actor.changes.slice(0, max);
        doc.changes.set(actor.id,slice.length)
        log(`change actor=${ID(actor.id)} changes=0..${slice.length}`)
        changes.push(...slice);
      });
      log(`loading doc=${ID(doc.id)} changes=${changes.length}`)
      doc.init(changes, this.meta.localActorId(doc.id));
    });
  }

  join = (actorId: string) => {
    const dk = discoveryKey(Base58.decode(actorId));
    log("join",ID(actorId), ID(Base58.encode(dk)))
    if (this.swarm && !this.joined.has(dk)) {
      log("swarm.join",actorId)
      this.swarm.join(dk);
    }
    this.joined.add(dk);
  };

  leave = (actorId: string) => {
    const dk = discoveryKey(Base58.decode(actorId));
    if (this.swarm && this.joined.has(dk)) {
      this.swarm.leave(dk);
    }
    this.joined.delete(dk);
  };

  private getReadyActor = (actorId: string, cb: (actor: Actor) => void) => {
    const publicKey = Base58.decode(actorId);
    const actor = this.actors.get(actorId) || this.initActor({ publicKey });
    actor.push(cb);
  };

  storageFn = (path: string): Function => {
    return (name: string) => {
      return this.storage(this.path + "/" + path + "/" + name);
    };
  };

  initActorFeed(doc: DocBackend): string {
    log("initActorFeed", doc.id);
    const keys = crypto.keyPair();
    const actorId = Base58.encode(keys.publicKey);
    this.meta.addActor(doc.id, actorId);
    this.initActor(keys);
    return actorId;
  }

  actorIds(doc: DocBackend): string[] {
    return this.meta.actors(doc.id);
  }

  docActors(doc: DocBackend): Actor[] {
    return this.actorIds(doc)
      .map(id => this.actors.get(id))
      .filter(notEmpty);
  }

  syncReadyActors = (ids: string[]) => {
    ids.map(id => this.getReadyActor(id, this.syncChanges));
  };

  private actorNotify = (msg: ActorMsg) => {
    switch (msg.type) {
      case "NewMetadata":
        const blocks = validateMetadataMsg(msg.input);
        log("NewMetadata", blocks)
        this.meta.addBlocks(blocks);
        blocks.map(block => {
          if (block.actors) this.syncReadyActors(block.actors)
          if (block.merge) this.syncReadyActors(Object.keys(block.merge))
          if (block.follows) block.follows.forEach(id => this.open(id))
        });
        break;
      case "ActorSync":
        log("ActorSync", msg.actor.id)
        this.syncChanges(msg.actor);
        break;
      case "Download":
        this.meta.docsWith(msg.actor.id).forEach( (doc: string) => {
          this.toFrontend.push({
            type: "ActorBlockDownloadedMsg",
            id: doc,
            actorId: msg.actor.id,
            index: msg.index,
            size: msg.size,
            time: msg.time
          })
        })
        break;
    }
  };

  private initActor(keys: KeyBuffer): Actor {
    const meta = this.meta;
    const notify = this.actorNotify;
    const storage = this.storageFn;
    const actor = new Actor({ repo: this, keys, meta, notify, storage });
    this.actors.set(actor.id, actor);
    this.actorsDk.set(actor.dkString, actor);
    return actor;
  }

  syncChanges = (actor: Actor) => {
    const actorId = actor.id;
    const docIds = this.meta.docsWith(actorId);
    docIds.forEach(docId => {
      const doc = this.docs.get(docId);
      if (doc) {
        doc.ready.push(() => {
          const max = this.meta.clock(docId)[actorId] || 0
          const min = doc.changes.get(actorId) || 0
          const changes = []
          let i = min;
          for (; i < max && actor.changes.hasOwnProperty(i); i++) {
            const change = actor.changes[i]
            log(`change found xxx id=${ID(actor.id)} seq=${change.seq}`)
            changes.push(change)
          }
          doc.changes.set(actorId,i)
  //        log(`changes found xxx doc=${ID(docId)} actor=${ID(actor.id)} n=[${min}+${changes.length}/${max}]`);
          if (changes.length > 0) {
            log(`applyremotechanges ${changes.length}`)
            doc.applyRemoteChanges(changes);
          }
        })
      }
    });
  };

  stream = (opts: any): any => {
    const stream = HypercoreProtocol({
      live: true,
      id: this.id,
      encrypt: false,
      timeout: 10000,
      extensions: [EXT]
    });

    let add = (dk: Buffer) => {
      const actor = this.actorsDk.get(Base58.encode(dk));
      if (actor) {
        log("replicate feed!", ID(Base58.encode(dk)));
        actor.feed.replicate({
          stream,
          live: true
        })
      }
    };

    stream.on("feed", (dk: Buffer) => add(dk));

    const dk = opts.channel || opts.discoveryKey;
    if (dk) add(dk);

    return stream;
  };

  releaseManager(doc: DocBackend) {
    // FIXME - need reference count with many feeds <-> docs
  }

  subscribe = (subscriber: (message: ToFrontendRepoMsg) => void) => {
    this.toFrontend.subscribe(subscriber);
  };

  handleQuery = (id: number, query: ToBackendQueryMsg) => {
    switch (query.type) {
      case "MetadataMsg": {
        this.meta.publicMetadata(query.id, (payload) => {
          this.toFrontend.push({ type: "Reply", id, payload })
        })
        break;
      }
      case "MaterializeMsg": {
        const doc = this.docs.get(query.id)!
        const changes = (doc.back as any).getIn(['opSet', 'history']).slice(0, query.history).toArray()
        const [_, patch] = Backend.applyChanges(Backend.init(), changes);
        this.toFrontend.push({ type: "Reply", id, payload: patch})
        break;
      }
    }
  }

  receive = (msg: ToBackendRepoMsg) => {
    if (msg instanceof Uint8Array) {
      this.file = msg;
    } else {
      switch (msg.type) {
        case "NeedsActorIdMsg": {
          const doc = this.docs.get(msg.id)!;
          doc.initActor();
          break;
        }
        case "RequestMsg": {
          const doc = this.docs.get(msg.id)!;
          doc.applyLocalChange(msg.request);
          break;
        }
        case "WriteFile": {
          const keys = {
            publicKey: Base58.decode(msg.publicKey),
            secretKey: Base58.decode(msg.secretKey)
          };
          log("write file", msg.mimeType)
          this.writeFile(keys, this.file!, msg.mimeType);
          delete this.file;
          break;
        }
        case "Query": {
          const query = msg.query
          const id = msg.id
          this.handleQuery(id, query)
          break
        }
        case "ReadFile": {
          const id = msg.id;
          log("read file", id)
          this.readFile(id, (file, mimeType) => {
            log("read file done", file.length, "bytes", mimeType)
            this.toFrontend.push(file);
            this.toFrontend.push({ type: "ReadFileReply", id, mimeType });
          });
          break;
        }
        case "CreateMsg": {
          const keys = {
            publicKey: Base58.decode(msg.publicKey),
            secretKey: Base58.decode(msg.secretKey)
          };
          this.create(keys);
          break;
        }
        case "MergeMsg": {
          this.merge(msg.id, strs2clock(msg.actors));
          break;
        }
        case "FollowMsg": {
          this.follow(msg.id, msg.target);
          break;
        }
        case "OpenMsg": {
          this.open(msg.id);
          break;
        }
        case "DestroyMsg": {
          this.destroy(msg.id);
          break;
        }
        case "DebugMsg": {
          this.debug(msg.id);
          break;
        }
      }
    }
  };

  actor(id: string): Actor | undefined {
    return this.actors.get(id);
  }
}
