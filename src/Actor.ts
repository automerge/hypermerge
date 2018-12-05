
import { RepoBackend, KeyBuffer } from "./RepoBackend"
import { readFeed, hypercore, Feed, Peer, discoveryKey } from "./hypercore"
import { Clock, Change } from "automerge/backend"
import { MetadataBlock, Metadata } from "./Metadata"
import { DocBackend } from "./DocBackend"
import Queue from "./Queue"
import * as JsonBuffer from "./JsonBuffer"
import * as Base58 from "bs58"
import * as Misc from "./Misc"
import Debug from "debug"

const log = Debug("feedmgr")

const KB = 1024
const MB = 1024 * KB

export type ActorMsg = NewMetadata | ActorSync
export type FeedHead = FileMetadata | Change

export type FeedType = "Unknown" | "Automerge" | "File"

interface FileMetadata {
  type: "File"
  bytes: number
}

interface NewMetadata {
  type: "NewMetadata"
  blocks: MetadataBlock[]
}

interface ActorSync {
  type: "ActorSync"
  actor: Actor
}

export const EXT = "hypermerge.2"

interface ActorConfig {
  keys: KeyBuffer,
  meta: Metadata,
  notify: (msg: ActorMsg) => void
  storage: (path: string) => Function
}


export class Actor {
  id: string
  dkString: string
  q: Queue<(actor: Actor) => void>
  syncQ: Queue<() => void>
  changes: Change[] = []
  feed: Feed<Uint8Array>
  peers: Set<Peer> = new Set()
  meta: Metadata
  notify: (msg: ActorMsg) => void
  type: FeedType
  data: Uint8Array[] = []
  fileMetadata? : FileMetadata

  constructor(config: ActorConfig) {
    const { publicKey, secretKey } = config.keys
    const dk = discoveryKey(publicKey)
    const id = Base58.encode(publicKey)

    this.type = "Unknown"
    this.id = id
    this.notify = config.notify
    this.meta = config.meta
    this.dkString = Base58.encode(dk)
    this.feed = hypercore(config.storage(id), publicKey, { secretKey })
    this.q = new Queue<(actor: Actor) => void>()
    this.syncQ = new Queue<() => void>()
    this.feed.ready(this.feedReady)
  }

  message(message: any, target?: Peer) {
    const peers = target ? [ target ] : [ ... this.peers ]
    const payload = Buffer.from(JSON.stringify(message))
    peers.forEach(peer => peer.stream.extension(EXT, payload))
  }

  feedReady = () => {
    log("init feed", this.id)
    const feed = this.feed

    this.meta.setWritable(this.id,feed.writable)
    this.meta.docsWith(this.id).forEach(docId => {
      this.message(this.meta.forActor(docId))
    })

    feed.on("peer-remove", this.peerRemove)
    feed.on("peer-add", this.peerAdd)
    feed.on("download", this.handleBlock)
    feed.on("sync", this.sync)

    readFeed(feed, this.init) // subscibe begins here

    feed.on("close", this.close)
  }

  handleFeedHead(head: any) { // type is FeedHead
    if (head.hasOwnProperty("type")) {
      this.type = "File"
      this.fileMetadata = head
    } else {
      this.type = "Automerge"
      this.changes.push(head)
      this.changes.push(... this.data.filter(data => data).map(data => JsonBuffer.parse(data)))
      this.data = []
    }
  }

  init = (datas:Uint8Array[]) => {
    datas.map( (data,i) => this.handleBlock(i, data))
    if (datas.length > 0) {
      this.syncQ.subscribe(f => f())
    }
    this.q.subscribe(f => f(this))
  }

  peerRemove = (peer: Peer) => {
    this.peers.delete(peer)
  }

  peerAdd = (peer: Peer) => {
    peer.stream.on("extension", (ext: string, buf: Buffer) => {
      if (ext === EXT) {
        const blocks: MetadataBlock[] = JSON.parse(buf.toString())
        this.notify({ type: "NewMetadata", blocks })
/*
        log("EXT", blocks)
        this.meta.addBlocks(blocks)
        blocks.forEach(block => {
          // getReadyActor -> initFeed -> join()
          this.back.initActors( [ ... block.actorIds! ])
        })
*/
      }
    })
    this.peers.add(peer)
    this.message(this.meta.forActor(this.id), peer)
  }

  close = () => {
    log("closing feed", this.id)
  }

  sync = () => {
    this.syncQ.once(f => f())
    this.notify({ type: "ActorSync", actor: this })
  }

  handleBlock = (idx: number, data: Uint8Array) => {
    switch (this.type) {
      case "Automerge": 
        this.changes.push(JsonBuffer.parse(data))
        break
      default: 
        if (idx === 0) {
          this.handleFeedHead(JsonBuffer.parse(data))
        } else {
          this.data[idx - 1] = data
        }
        break;
    }
  }

  push = (cb: (actor: Actor) => void) => {
    this.q.push(cb)
  }

  writeFile(data: Uint8Array) {
    this.q.push(() => {
      if (this.data.length > 0 || this.changes.length > 0) throw new Error("writeFile called on existing feed")
      const head : FileMetadata = { type: "File", bytes: data.length }
      this.append(Buffer.from(JSON.stringify(head)))
      const blockSize = 1 * MB
      for (let i = 0; i < data.length; i += blockSize) {
        const block = data.slice(i, i + blockSize)
        this.append(block)
      }
    })
  }

  readFile(cb: (data: Buffer) => void) {
    this.syncQ.push(() => {
      // could ditch .data and re-read blocks here
      console.log(`Rebuilding file from ${this.data.length} blocks`)
      const file = Buffer.concat(this.data)
      const bytes = this.fileMetadata!.bytes
      if (file.length !== bytes) {
        throw new Error(`File metadata error - file=${file.length} meta=${bytes}`)
      }
      cb(file)
    })
  }

  append(block: Uint8Array) {
    this.feed.append(block, err => {
      if (err) {
        throw new Error("failed to append to feed")
      }
    })
  }

  writeChange(change: Change) {
    const feedLength = this.changes.length
    const ok = feedLength + 1 === change.seq
    log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`)
    this.changes.push(change)
    this.sync()
    this.append(JsonBuffer.bufferify(change))
  }
}
