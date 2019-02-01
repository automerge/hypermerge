import { RepoBackend, KeyBuffer } from "./RepoBackend"
import { readFeed, hypercore, Feed, Peer, discoveryKey } from "./hypercore"
import { Change } from "automerge/backend"
import {
  Metadata,
  MetadataBlock,
  RemoteMetadata,
  validateMetadataMsg2,
} from "./Metadata"
import { ID } from "./Misc"
import { Clock } from "./Clock"
import Queue from "./Queue"
import * as JsonBuffer from "./JsonBuffer"
import * as Base58 from "bs58"
import * as Block from "./Block"
import Debug from "debug"

const fs: any = require("fs")

const log = Debug("repo:actor")

const KB = 1024
const MB = 1024 * KB

export type ActorMsg =
  | RemoteMetadata
  | NewMetadata
  | ActorSync
  | PeerUpdate
  | Download
export type FeedHead = FeedHeadMetadata | Change

export type FeedType = "Unknown" | "Automerge" | "File"

interface FeedHeadMetadata {
  type: "File"
  bytes: number
  mimeType: string
  blockSize: number
}

interface NewMetadata {
  type: "NewMetadata"
  input: Uint8Array
}

/*
interface RemoteMetadata {
  type: "RemoteMetadata";
  clocks: { [id:string] : Clock };
  blocks: MetadataBlock[];
}
*/

interface ActorSync {
  type: "ActorSync"
  actor: Actor
}

interface PeerUpdate {
  type: "PeerUpdate"
  actor: Actor
  peers: number
}

interface Download {
  type: "Download"
  actor: Actor
  time: number
  size: number
  index: number
}

export const EXT = "hypermerge.2"
export const EXT2 = "hypermerge.3"

interface ActorConfig {
  keys: KeyBuffer
  meta: Metadata
  notify: (msg: ActorMsg) => void
  storage: (path: string) => Function
  repo: RepoBackend
}

export class Actor {
  id: string
  dkString: string
  q: Queue<(actor: Actor) => void>
  private syncQ: Queue<() => void>
  changes: Change[] = []
  feed: Feed<Uint8Array>
  peers: Set<Peer> = new Set()
  meta: Metadata
  notify: (msg: ActorMsg) => void
  storage: any
  type: FeedType
  data: Uint8Array[] = []
  pending: Uint8Array[] = []
  fileMetadata?: FeedHeadMetadata
  repo: RepoBackend

  constructor(config: ActorConfig) {
    const { publicKey, secretKey } = config.keys
    const dk = discoveryKey(publicKey)
    const id = Base58.encode(publicKey)

    this.type = "Unknown"
    this.id = id
    this.storage = config.storage(id)
    this.notify = config.notify
    this.meta = config.meta
    this.repo = config.repo
    this.dkString = Base58.encode(dk)
    this.feed = hypercore(this.storage, publicKey, { secretKey })
    this.q = new Queue<(actor: Actor) => void>("actor:q-" + id.slice(0, 4))
    this.syncQ = new Queue<() => void>("actor:sync-" + id.slice(0, 4))
    this.feed.ready(this.feedReady)
  }

  /*
  message(message: any, target?: Peer) {
    const peers = target ? [target] : [...this.peers];
    const payload = Buffer.from(JSON.stringify(message));
    peers.forEach(peer => peer.stream.extension(EXT, payload));
  }
*/

  message2(
    blocks: MetadataBlock[],
    clocks: { [id: string]: Clock },
    target?: Peer,
  ) {
    const peers = target ? [target] : [...this.peers]
    const message = { type: "RemoteMetadata", clocks, blocks }
    const payload = Buffer.from(JSON.stringify(message))
    //    target.stream.extension(EXT2, payload)
    peers.forEach(peer => peer.stream.extension(EXT2, payload))
  }

  feedReady = () => {
    const feed = this.feed

    this.meta.setWritable(this.id, feed.writable)

    const meta = this.meta.forActor(this.id)
    this.meta.docsWith(this.id).forEach(docId => {
      const actor = this.repo.actor(docId)
      const clocks = this.allClocks()
      if (actor) {
        actor.message2(meta, clocks)
        //        actor.message(meta);
      }
    })

    feed.on("peer-remove", this.peerRemove)
    feed.on("peer-add", this.peerAdd)
    feed.on("download", this.handleDownload)
    feed.on("sync", this.sync)

    readFeed(this.id, feed, this.init) // subscibe begins here

    feed.on("close", this.close)
  }

  handleFeedHead(data: Uint8Array) {
    const head = Block.unpack(data) // no validation of head
    if (head.hasOwnProperty("type")) {
      this.type = "File"
      this.fileMetadata = head
    } else {
      this.type = "Automerge"
      this.handleBlock(data, 0)
      this.pending.map(this.handleBlock)
      this.pending = []
    }
  }

  init = (datas: Uint8Array[]) => {
    log("loaded blocks", ID(this.id), datas.length)
    datas.map((data, i) => {
      if (i === 0) this.handleFeedHead(data)
      else this.handleBlock(data, i)
    })
    if (datas.length > 0) {
      this.sync()
    }
    this.repo.join(this.id)
    this.q.subscribe(f => f(this))
  }

  close = () => {
    log("closing feed", this.id)
    try {
      this.feed.close((err: Error) => {})
    } catch (error) {}
  }

  destroy = () => {
    this.repo.leave(this.id)
    this.feed.close((err: Error) => {
      const filename = this.storage("").filename
      if (filename) {
        const newName = filename.slice(0, -1) + `_${Date.now()}_DEL`
        //console.log("RENAME", filename, newName)
        fs.rename(filename, newName, (err: Error) => {
          //console.log("DONE", err)
        })
      }
    })
  }

  peerRemove = (peer: Peer) => {
    this.peers.delete(peer)
    this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size })
  }

  peerAdd = (peer: Peer) => {
    log("peer-add feed", ID(this.id))
    peer.stream.on("extension", (ext: string, input: Uint8Array) => {
      if (ext === EXT) {
        this.notify({ type: "NewMetadata", input })
      }
      if (ext === EXT2) {
        //        const clocks = JSON.parse(input.toString()); // FIXME - validate
        const msg = validateMetadataMsg2(input)
        //        this.notify({ type: "RemoteMetadata", clocks });
        this.notify(msg)
      }
    })
    this.peers.add(peer)
    const metadata = this.meta.forActor(this.id)
    const clocks = this.allClocks()
    this.message2(metadata, clocks, peer)
    //    this.message(metadata, peer);
    this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size })
  }

  allClocks(): { [id: string]: Clock } {
    const clocks: { [id: string]: Clock } = {}
    this.meta.docsWith(this.id).forEach(id => {
      const doc = this.repo.docs.get(id)
      if (doc) {
        clocks[id] = doc.clock
      }
    })
    return clocks
  }

  sync = () => {
    log("sync feed", ID(this.id))
    this.syncQ.once(f => f())
    this.notify({ type: "ActorSync", actor: this })
  }

  handleDownload = (index: number, data: Uint8Array) => {
    if (this.type === "Unknown") {
      if (index === 0) {
        this.handleFeedHead(data)
      } else {
        this.pending[index] = data
      }
    } else {
      this.handleBlock(data, index)
    }
    const time = Date.now()
    const size = data.byteLength

    this.notify({ type: "Download", actor: this, index, size, time })
    //    this.sync();
  }

  handleBlock = (data: Uint8Array, idx: number) => {
    switch (this.type) {
      case "Automerge":
        const change: Change = Block.unpack(data) // no validation of Change
        this.changes[idx] = change
        log(`block xxx idx=${idx} actor=${ID(change.actor)} seq=${change.seq}`)
        break
      case "File":
        this.data[idx - 1] = data
        break
      default:
        throw new Error("cant handle block if we don't know the type")
        break
    }
  }

  push = (cb: (actor: Actor) => void) => {
    this.q.push(cb)
  }

  writeFile(data: Uint8Array, mimeType: string) {
    log("writing file")
    this.q.push(() => {
      log("writing file", data.length, "bytes", mimeType)
      if (this.data.length > 0 || this.changes.length > 0)
        throw new Error("writeFile called on existing feed")
      const blockSize = 1 * MB
      this.fileMetadata = {
        type: "File",
        bytes: data.length,
        mimeType,
        blockSize,
      }
      this.append(Buffer.from(JSON.stringify(this.fileMetadata)))
      for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize)
        this.data.push(block)
        const last = i + blockSize >= data.length
        this.append(block, () => {
          if (last) {
            // I dont want read's to work until its synced to disk - could speed this up
            // by returning sooner but was having issues where command line tools would
            // exit before disk syncing was done
            this.syncQ.subscribe(f => f())
          }
        })
      }
    })
  }

  fileHead(cb: (head: FeedHeadMetadata) => void) {
    if (this.fileMetadata) {
      cb(this.fileMetadata)
    } else {
      this.feed.get(0, { wait: true }, (err, data) => {
        if (err) throw new Error(`error reading feed head ${this.id}`)
        const head: any = JsonBuffer.parse(data)
        this.fileMetadata = head
        cb(head)
      })
    }
  }

  fileBody(head: FeedHeadMetadata, cb: (body: Uint8Array) => void) {
    const blockSize = head.blockSize || 1 * MB // old feeds dont have this
    const blocks = Math.ceil(head.bytes / blockSize)
    const file = Buffer.concat(this.data)
    if (file.length === head.bytes) {
      cb(file)
    } else {
      if (blocks === 1) {
        this.feed.get(1, { wait: true }, (err, file) => {
          if (err) throw new Error(`error reading feed body ${this.id}`)
          this.data = [file]
          cb(file)
        })
      } else {
        this.feed.getBatch(1, blocks, { wait: true }, (err, data) => {
          if (err) throw new Error(`error reading feed body ${this.id}`)
          this.data = data
          const file = Buffer.concat(this.data)
          cb(file)
        })
      }
    }
  }

  readFile(cb: (data: Uint8Array, mimeType: string) => void) {
    log("reading file...")
    this.fileHead(head => {
      const { bytes, mimeType } = head
      this.fileBody(head, body => {
        cb(body, head.mimeType)
      })
    })
  }

  append(block: Uint8Array, cb?: () => void) {
    this.feed.append(block, err => {
      log("Feed.append", block.length, "bytes")
      if (err) {
        throw new Error("failed to append to feed")
      }
      if (cb) cb()
    })
  }

  writeChange(change: Change) {
    const feedLength = this.changes.length
    const ok = feedLength + 1 === change.seq
    log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`)
    this.changes.push(change)
    this.sync()
    this.append(Block.pack(change))
  }
}
