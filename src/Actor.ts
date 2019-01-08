import { RepoBackend, KeyBuffer } from "./RepoBackend";
import { readFeed, hypercore, Feed, Peer, discoveryKey } from "./hypercore";
import { Change } from "automerge/backend";
import { Metadata } from "./Metadata";
import Queue from "./Queue";
import * as JsonBuffer from "./JsonBuffer";
import * as Base58 from "bs58";
import Debug from "debug";

const log = Debug("repo:actor");

const KB = 1024;
const MB = 1024 * KB;

export type ActorMsg = NewMetadata | ActorSync | PeerUpdate | Download;
export type FeedHead = FeedHeadMetadata | Change;

export type FeedType = "Unknown" | "Automerge" | "File";

interface FeedHeadMetadata {
  type: "File";
  bytes: number;
  mimeType: string;
}

interface NewMetadata {
  type: "NewMetadata";
  input: Uint8Array;
}

interface ActorSync {
  type: "ActorSync";
  actor: Actor;
}

interface PeerUpdate {
  type: "PeerUpdate";
  actor: Actor;
  peers: number;
}

interface Download {
  type: "Download";
  actor: Actor;
  time: number;
  size: number;
  index: number;
}

export const EXT = "hypermerge.2";

interface ActorConfig {
  keys: KeyBuffer;
  meta: Metadata;
  notify: (msg: ActorMsg) => void;
  storage: (path: string) => Function;
  repo: RepoBackend;
}

export class Actor {
  id: string;
  dkString: string;
  q: Queue<(actor: Actor) => void>;
  private syncQ: Queue<() => void>;
  changes: Change[] = [];
  feed: Feed<Uint8Array>;
  peers: Set<Peer> = new Set();
  meta: Metadata;
  notify: (msg: ActorMsg) => void;
  type: FeedType;
  data: Uint8Array[] = [];
  fileMetadata?: FeedHeadMetadata;
  repo: RepoBackend;

  constructor(config: ActorConfig) {
    const { publicKey, secretKey } = config.keys;
    const dk = discoveryKey(publicKey);
    const id = Base58.encode(publicKey);

    this.type = "Unknown";
    this.id = id;
    this.notify = config.notify;
    this.meta = config.meta;
    this.repo = config.repo;
    this.dkString = Base58.encode(dk);
    this.feed = hypercore(config.storage(id), publicKey, { secretKey });
    this.q = new Queue<(actor: Actor) => void>("actor:q-" + id.slice(0, 4));
    this.syncQ = new Queue<() => void>("actor:sync-" + id.slice(0, 4));
    this.feed.ready(this.feedReady);
  }

  message(message: any, target?: Peer) {
    const peers = target ? [target] : [...this.peers];
    const payload = Buffer.from(JSON.stringify(message));
    peers.forEach(peer => peer.stream.extension(EXT, payload));
  }

  feedReady = () => {
    log("init feed", this.id);
    const feed = this.feed;

    this.meta.setWritable(this.id, feed.writable);

    const meta = this.meta.forActor(this.id);
    this.meta.docsWith(this.id).forEach(docId => {
      const actor = this.repo.actor(docId);
      if (actor) actor.message(meta);
    })

    feed.on("peer-remove", this.peerRemove);
    feed.on("peer-add", this.peerAdd);
    feed.on("download", this.handleDownload);
    feed.on("sync", this.sync);

    readFeed(feed, this.init); // subscibe begins here

    feed.on("close", this.close);
  };

  handleFeedHead(head: any) {
    // type is FeedHead
    if (head.hasOwnProperty("type")) {
      this.type = "File";
      this.fileMetadata = head;
    } else {
      this.type = "Automerge";
      this.changes.push(head);
      this.changes.push(
        ...this.data.filter(data => data).map(data => JsonBuffer.parse(data))
      );
      this.data = [];
    }
  }

  init = (datas: Uint8Array[]) => {
    log("loaded blocks", this.id, datas.length);
    datas.map((data, i) => this.handleBlock(i, data));
    if (datas.length > 0) {
      this.syncQ.subscribe(f => f());
    }
    this.q.subscribe(f => f(this));
  };

  peerRemove = (peer: Peer) => {
    this.peers.delete(peer);
    this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size });
  };

  peerAdd = (peer: Peer) => {
    peer.stream.on("extension", (ext: string, input: Uint8Array) => {
      if (ext === EXT) {
        this.notify({ type: "NewMetadata", input });
      }
    });
    this.peers.add(peer);
    this.message(this.meta.forActor(this.id), peer);
    this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size });
  };

  close = () => {
    log("closing feed", this.id);
  };

  sync = () => {
    this.syncQ.once(f => f());
    this.notify({ type: "ActorSync", actor: this });
  };

  handleDownload = (index: number, data: Uint8Array) => {
    this.handleBlock(index, data);
    const time = Date.now()
    const size = data.byteLength

    this.notify({ type: "Download",
                  actor: this, 
                  index, 
                  size, 
                  time });
    this.sync();
  };
  handleBlock = (idx: number, data: Uint8Array) => {
    switch (this.type) {
      case "Automerge":
        this.changes.push(JsonBuffer.parse(data));
        break;
      default:
        if (idx === 0) {
          this.handleFeedHead(JsonBuffer.parse(data));
        } else {
          this.data[idx - 1] = data;
        }
        break;
    }
  };

  push = (cb: (actor: Actor) => void) => {
    this.q.push(cb);
  };

  writeFile(data: Uint8Array, mimeType: string) {
    log("writing file")
    this.q.push(() => {
      log("writing file", data.length , "bytes", mimeType)
      if (this.data.length > 0 || this.changes.length > 0)
        throw new Error("writeFile called on existing feed");
      this.fileMetadata = { type: "File", bytes: data.length, mimeType };
      this.append(Buffer.from(JSON.stringify(this.fileMetadata)));
      const blockSize = 1 * MB;
      for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize);
        this.data.push(block)
        const last = i + blockSize >= data.length
        this.append(block, () => {
          if (last) {
            // I dont want read's to work until its synced to disk - could speed this up
            // by returning sooner but was having issues where command line tools would
            // exit before disk syncing was done
            this.syncQ.subscribe(f => f());
          }
        })
      }
    });
  }

  readFile(cb: (data: Buffer, mimeType: string) => void) {
    log("reading file...")
    this.syncQ.push(() => {
      // could ditch .data and re-read blocks here
      log(`Rebuilding file from ${this.data.length} blocks`);
      const file = Buffer.concat(this.data);
      const bytes = this.fileMetadata!.bytes;
      const mimeType = this.fileMetadata!.mimeType;
      if (file.length !== bytes) {
        throw new Error(
          `File metadata error - file=${file.length} meta=${bytes}`
        );
      }
      cb(file, mimeType);
    });
  }

  append(block: Uint8Array, cb?: () => void) {
    this.feed.append(block, err => {
      log("Feed.append", block.length, "bytes")
      if (err) {
        throw new Error("failed to append to feed");
      }
      if (cb) cb()
    });
  }

  writeChange(change: Change) {
    const feedLength = this.changes.length;
    const ok = feedLength + 1 === change.seq;
    log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`);
    this.changes.push(change);
    this.sync();
    this.append(JsonBuffer.bufferify(change));
  }
}
