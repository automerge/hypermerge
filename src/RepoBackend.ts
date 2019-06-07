import Queue from "./Queue";
import { Metadata } from "./Metadata";
import { Actor, ActorMsg } from "./Actor";
import { strs2clock, clockDebug } from "./Clock";
import * as Base58 from "bs58";
import * as crypto from "hypercore/lib/crypto";
import { discoveryKey } from "./hypercore";
import { Backend, Clock, Change } from "automerge";
import { ToBackendQueryMsg, ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg";
import { DocBackend, DocBackendMessage } from "./DocBackend"
import { notEmpty, ID } from "./Misc";
import Debug from "debug";
import * as DocumentBroadcast from "./DocumentBroadcast"
import * as Keys from "./Keys"

interface Swarm {
  join(dk: Buffer): void;
  leave(dk: Buffer): void;
  on: Function;
}

Debug.formatters.b = Base58.encode;

const HypercoreProtocol: Function = require("hypercore-protocol");

const log = Debug("repo:backend");

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
  joined: Set<string> = new Set();
  actors: Map<string, Actor> = new Map();
  actorsDk: Map<string, Actor> = new Map();
  docs: Map<string, DocBackend.DocBackend> = new Map();
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

    this.meta = new Metadata(this.storageFn, this.join, this.leave);
    this.id = this.meta.id
  }

  private writeFile(keys: Keys.KeyBuffer, data: Uint8Array, mimeType: string) {
    const fileId = Keys.encode(keys.publicKey);

    this.meta.addFile(fileId, data.length, mimeType);

    const actor = this.initActor(keys);
    actor.writeFile(data, mimeType);
  }

  private async readFile(id: string): Promise<{body: Uint8Array, mimeType: string}> {
//    log("readFile",id, this.meta.forDoc(id))
    if (this.meta.isDoc(id)) { throw new Error("trying to open a document like a file") }
    const actor = await this.getReadyActor(id)
    return actor.readFile()
  }

  private create(keys: Keys.KeyBuffer): DocBackend.DocBackend {
    const docId = Keys.encode(keys.publicKey);
    log("create", docId);
    const doc = new DocBackend.DocBackend(docId, this.documentNotify, Backend.init());

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
    const actors = this.meta.allActors()
    this.actors.forEach((actor,id) => {
      if (!actors.has(id)) {
        console.log("Orphaned actors - will purge", id)
        this.actors.delete(id)
        this.leave(actor.id)
        actor.destroy()
      }
    })
  }

  // opening a file fucks it up
  private open(docId: string): DocBackend.DocBackend {
//    log("open", docId, this.meta.forDoc(docId));
    if (this.meta.isFile(docId)) { throw new Error("trying to open a file like a document") }
    let doc = this.docs.get(docId) || new DocBackend.DocBackend(docId, this.documentNotify);
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

/*
  follow(id: string, target: string) {
    this.meta.follow(id, target);
    this.syncReadyActors(this.meta.actors(id));
  }
*/

  close = () => {
    this.actors.forEach(actor => actor.close())
    this.actors.clear()

    const swarm : any = this.swarm // FIXME - any is bad
    if (swarm) {
      try {
        swarm.discovery.removeAllListeners()
        swarm.discovery.close()
        swarm.peers.forEach((p : any) => p.connections.forEach((con:any) => con.destroy()))
        swarm.removeAllListeners()
      } catch (error) {}
    }
  }

  replicate = (swarm: Swarm) => {
    if (this.swarm) {
      throw new Error("replicate called while already swarming");
    }
    this.swarm = swarm;
    for (let dk of this.joined) {
      log("swarm.join")
      this.swarm.join(Base58.decode(dk));
    }
  };

  private async allReadyActors(docId: string): Promise<Actor[]> {
    const actorIds = await this.meta.actorsAsync(docId)
    return Promise.all(actorIds.map(this.getReadyActor))
  }

  private async loadDocument(doc: DocBackend.DocBackend) {
    const actors = await this.allReadyActors(doc.id)
    log(`load document 2 actors=${actors.map((a) => a.id)}`)
    const changes: Change[] = [];
    actors.forEach(actor => {
      const max = this.meta.clockAt(doc.id,actor.id);
      const slice = actor.changes.slice(0, max);
      doc.changes.set(actor.id,slice.length)
      log(`change actor=${ID(actor.id)} changes=0..${slice.length}`)
      changes.push(...slice);
    });
    log(`loading doc=${ID(doc.id)} changes=${changes.length}`)
    // Check to see if we already have a local actor id. If so, re-use it.
    const localActorId = this.meta.localActorId(doc.id)
    const actorId = localActorId ? (await this.getReadyActor(localActorId)).id : this.initActorFeed(doc)
    doc.init(changes, actorId);
  }

  join = (actorId: string) => {
    const dkBuffer = discoveryKey(Base58.decode(actorId))
    const dk = Base58.encode(dkBuffer)
    if (this.swarm && !this.joined.has(dk)) {
      log("swarm.join",ID(actorId), ID(dk)) 
      this.swarm.join(dkBuffer);
    }
    this.joined.add(dk);
  };

  leave = (actorId: string) => {
    const dkBuffer = discoveryKey(Base58.decode(actorId));
    const dk = Base58.encode(dkBuffer);
    if (this.swarm && this.joined.has(dk)) {
      log("leave",ID(actorId), ID(dk))
      this.swarm.leave(dkBuffer);
    }
    this.joined.delete(dk);
  };

  private getReadyActor = (actorId: string): Promise<Actor> => {
    const publicKey = Base58.decode(actorId);
    const actor = this.actors.get(actorId) || this.initActor({ publicKey });
    const actorPromise = new Promise<Actor>((resolve, reject) => {
      try {
      actor.onReady(resolve)
      } catch (e) {
        reject(e)
      }
    })
    return actorPromise
  };

  storageFn = (path: string): Function => {
    return (name: string) => {
      return this.storage(this.path + "/" + path + "/" + name);
    };
  };

  initActorFeed(doc: DocBackend.DocBackend): string {
    log("initActorFeed", doc.id);
    const keys = crypto.keyPair();
    const actorId = Keys.encode(keys.publicKey);
    this.meta.addActor(doc.id, actorId);
    this.initActor(keys);
    return actorId;
  }

  actorIds(doc: DocBackend.DocBackend): string[] {
    return this.meta.actors(doc.id);
  }

  docActors(doc: DocBackend.DocBackend): Actor[] {
    return this.actorIds(doc)
      .map(id => this.actors.get(id))
      .filter(notEmpty);
  }

  syncReadyActors = (ids: string[]) => {
    ids.forEach(async id => {
      const actor = await this.getReadyActor(id)
      this.syncChanges(actor)
    })
  };

  allClocks(actorId: string): { [id: string]: Clock } {
    const clocks: { [id: string]: Clock } = {}
    this.meta.docsWith(actorId).forEach(documentId => {
      const doc = this.docs.get(documentId)
      if (doc) {
        clocks[documentId] = doc.clock
      }
    })
    return clocks
  }

  private documentNotify = (msg: DocBackend.DocBackendMessage) => {
    switch (msg.type) {
      case "ReadyMsg": {
        this.toFrontend.push({
          type: "ReadyMsg",
          id: msg.id,
          synced: msg.synced,
          actorId: msg.actorId,
          history: msg.history,
          patch: msg.patch
        });
        break
      }
      case "ActorIdMsg": {
        this.toFrontend.push({
          type: "ActorIdMsg",
          id: msg.id,
          actorId: msg.actorId
        })
        break
      }
      case "RemotePatchMsg": {
        this.toFrontend.push({
          type: "PatchMsg",
          id: msg.id,
          synced: msg.synced,
          patch: msg.patch,
          history: msg.history
        })
        break
      }
      case "LocalPatchMsg": {
        this.toFrontend.push({
          type: "PatchMsg",
          id: msg.id,
          synced: msg.synced,
          patch: msg.patch,
          history: msg.history
        })
        this.actor(msg.actorId)!.writeChange(msg.change);
        break
      }
      default: {
        console.log("Unknown message type", msg)
      }
    }

  }

  private broadcastNotify = (msg: DocumentBroadcast.BroadcastMessage) => {
    switch (msg.type) {
      case "RemoteMetadata": {
        for (let id in msg.clocks) {
          const clock = msg.clocks[id]
          const doc = this.docs.get(id)
          if (clock && doc) {
            doc.target(clock)
          }
        }
        const _blocks = msg.blocks;
        this.meta.addBlocks(_blocks);
        _blocks.map(block => {
          if (block.actors) this.syncReadyActors(block.actors)
          if (block.merge) this.syncReadyActors(Object.keys(block.merge))
          // if (block.follows) block.follows.forEach(id => this.open(id))
        });
        break
      }
      case "NewMetadata": {
        // TODO: Warn better than this!
        console.log("Legacy Metadata message received - better upgrade")
        break;
      }
    }
  }

  private actorNotify = (msg: ActorMsg) => {
    switch (msg.type) {
      case "ActorFeedReady": {
        const actor = msg.actor
        // Record whether or not this actor is writable.
        this.meta.setWritable(actor.id, msg.writable)
        // Broadcast latest document information to peers.
        const metadata = this.meta.forActor(actor.id)
        const clocks = this.allClocks(actor.id)
        this.meta.docsWith(actor.id).forEach(documentId => {
          const documentActor = this.actor(documentId)
          if (documentActor) {
            DocumentBroadcast.broadcast(metadata, clocks, documentActor.peers)
          }
        })

        this.join(actor.id)
        break
      }
      case "ActorInitialized": {
        // Swarm on the actor's feed.
        this.join(msg.actor.id)
        break
      }
      case "PeerAdd": {
        // Listen for hypermerge extension broadcasts.
        DocumentBroadcast.listen(msg.peer, this.broadcastNotify)

        // Broadcast the latest document information to the new peer
        const metadata = this.meta.forActor(msg.actor.id)
        const clocks = this.allClocks(msg.actor.id)
        DocumentBroadcast.broadcast(metadata, clocks, [msg.peer])
        break
      }
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

  private initActor(keys: Keys.KeyBuffer): Actor {
    const notify = this.actorNotify;
    const storage = this.storageFn;
    const actor = new Actor({ keys, notify, storage });
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
          const max = this.meta.clockAt(docId,actorId)
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
      extensions: DocumentBroadcast.SUPPORTED_EXTENSIONS
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
          const actorId = this.initActorFeed(doc)
          doc.initActor(actorId);
          break;
        }
        case "RequestMsg": {
          const doc = this.docs.get(msg.id)!;
          doc.applyLocalChange(msg.request);
          break;
        }
        case "WriteFile": {
          const keys = {
            publicKey: Keys.decode(msg.publicKey),
            secretKey: Keys.decode(msg.secretKey)
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
          this.readFile(id).then(file => {
            this.toFrontend.push(file.body)
            this.toFrontend.push({ type: "ReadFileReply", id, mimeType: file.mimeType })
          })
          break;
        }
        case "CreateMsg": {
          const keys = {
            publicKey: Keys.decode(msg.publicKey),
            secretKey: Keys.decode(msg.secretKey)
          };
          this.create(keys);
          break;
        }
        case "MergeMsg": {
          this.merge(msg.id, strs2clock(msg.actors));
          break;
        }
/*
        case "FollowMsg": {
          this.follow(msg.id, msg.target);
          break;
        }
*/
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
        case "CloseMsg": {
          this.close();
          break;
        }
      }
    }
  };

  actor(id: string): Actor | undefined {
    return this.actors.get(id);
  }
}
