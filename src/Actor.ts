/**
 * Actors provide an interface over the data replication scheme.
 * For dat, this means the actor abstracts over the hypercore and its peers.
 */
import { readFeed, hypercore, Feed, Peer, discoveryKey } from "./hypercore"
import { Change } from "automerge/backend"
import { ID } from "./Misc"
import Queue from "./Queue"
import * as JsonBuffer from "./JsonBuffer"
import * as Base58 from "bs58"
import * as Block from "./Block"
import * as Keys from "./Keys"
import Debug from "debug"

const fs: any = require("fs")

const log = Debug("repo:actor")

const KB = 1024
const MB = 1024 * KB

export type FeedHead = FeedHeadMetadata | Change

export type FeedType = "Unknown" | "Automerge" | "File"

export type ActorMsg =
  | ActorInit
  | ActorFeedRead
  | ActorSync
  | PeerUpdate
  | PeerAdd
  | Download

interface FeedHeadMetadata {
  type: "File"
  bytes: number
  mimeType: string
  blockSize: number
}

interface ActorSync {
  type: "ActorSync"
  actor: Actor
}

interface ActorInit {
  type: "ActorInit"
  actor: Actor
  writable: boolean
}

interface ActorFeedRead {
  type: "ActorFeedRead"
  actor: Actor
}

interface PeerUpdate {
  type: "PeerUpdate"
  actor: Actor
  peers: number
}

interface PeerAdd {
  type: "PeerAdd"
  actor: Actor
  peer: Peer
}

interface Download {
  type: "Download"
  actor: Actor
  time: number
  size: number
  index: number
}

interface ActorConfig {
  keys: Keys.KeyBuffer
  notify: (msg: ActorMsg) => void
  storage: (path: string) => Function
}

export class Actor {
  id: string
  dkString: string
  q: Queue<(actor: Actor) => void>
  changes: Change[] = []
  feed: Feed<Uint8Array>
  peers: Set<Peer> = new Set()
  notify: (msg: ActorMsg) => void
  storage: any
  type: FeedType
  data: Uint8Array[] = []
  pending: Uint8Array[] = []
  fileMetadata?: FeedHeadMetadata

  constructor(config: ActorConfig) {
    const { publicKey, secretKey } = config.keys
    const dk = discoveryKey(publicKey)
    const id = Base58.encode(publicKey)

    this.type = "Unknown"
    this.id = id
    this.storage = config.storage(id)
    this.notify = config.notify
    this.dkString = Base58.encode(dk)
    this.feed = hypercore(this.storage, publicKey, { secretKey })
    this.q = new Queue<(actor: Actor) => void>("actor:q-" + id.slice(0, 4))
    this.feed.ready(this.feedReady)
  }

  feedReady = () => {
    const feed = this.feed

    this.notify({ type: "ActorInit", actor: this, writable: feed.writable })

    feed.on("peer-remove", this.peerRemove)
    feed.on("peer-add", this.peerAdd)
    feed.on("download", this.handleDownload)
    feed.on("sync", this.sync)

    readFeed(this.id, feed, this.init) // subscibe begins here

    feed.on("close", this.close)
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
    this.notify({ type: "ActorFeedRead", actor: this })
    this.q.subscribe(f => f(this))
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


  close = () => {
    log("closing feed", this.id)
    try {
      this.feed.close((err: Error) => {})
    } catch (error) {}
  }

  destroy = () => {
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
    this.peers.add(peer)
    this.notify({ type: "PeerAdd", actor: this, peer: peer})
    this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size })
  }

  sync = () => {
    log("sync feed", ID(this.id))
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
        this.append(block)
      }
    })
  }

  async readFile(): Promise<{body: Uint8Array, mimeType: string}> {
    log("reading file...")
    const head = await this.fileHead()
    const body = await this.fileBody(head)
    return {
      body,
      mimeType: head.mimeType
    }
  }

  fileHead(): Promise<FeedHeadMetadata> {
    return new Promise((resolve, reject) => {
      if (this.fileMetadata) {
        resolve(this.fileMetadata)
      } else {
        this.feed.get(0, { wait: true }, (err, data) => {
          if (err) reject(new Error(`error reading feed head ${this.id}`))
          const head: FeedHeadMetadata = JsonBuffer.parse(data)
          this.fileMetadata = head //Yikes
          resolve(head)
        })
      }
    })
  }

  fileBody(head: FeedHeadMetadata): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const blockSize = head.blockSize || 1 * MB // old feeds dont have this
      const blocks = Math.ceil(head.bytes / blockSize)
      const file = Buffer.concat(this.data)
      if (file.length === head.bytes) {
        resolve(file)
      } else {
        if (blocks === 1) {
          this.feed.get(1, { wait: true }, (err, file) => {
            if (err) reject(new Error(`error reading feed body ${this.id}`))
            this.data = [file]
            resolve(file)
          })
        } else {
          this.feed.getBatch(1, blocks, { wait: true }, (err, data) => {
            if (err) reject(new Error(`error reading feed body ${this.id}`))
            this.data = data
            const file = Buffer.concat(this.data)
            resolve(file)
          })
        }
      }
    })
  }


  append(block: Uint8Array) {
    this.feed.append(block, err => {
      log("Feed.append", block.length, "bytes")
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
    this.append(Block.pack(change))
  }
}
