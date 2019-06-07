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
  | ActorFeedReady
  | ActorInitialized
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

interface ActorFeedReady {
  type: "ActorFeedReady"
  actor: Actor
  writable: boolean
}

interface ActorInitialized {
  type: "ActorInitialized"
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
  changes: Change[] = []
  feed: Feed<Uint8Array>
  peers: Set<Peer> = new Set()
  type: FeedType
  private q: Queue<(actor: Actor) => void>
  private notify: (msg: ActorMsg) => void
  private storage: any
  private data: Uint8Array[] = []
  private pending: Uint8Array[] = []
  private fileMetadata?: FeedHeadMetadata

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
    this.q = new Queue<(actor: Actor) => void>("repo:actor:Q" + id.slice(0, 4))
    this.feed.ready(this.onFeedReady)
  }

  onFeedReady = () => {
    const feed = this.feed

    this.notify({ type: "ActorFeedReady", actor: this, writable: feed.writable })

    feed.on("peer-remove", this.onPeerRemove)
    feed.on("peer-add", this.onPeerAdd)
    feed.on("download", this.onDownload)
    feed.on("sync", this.onSync)

    readFeed(this.id, feed, this.init) // onReady subscribe begins here

    feed.on("close", this.close)
  }

  init = (rawBlocks: Uint8Array[]) => {
    log("loaded blocks", ID(this.id), rawBlocks.length)
    rawBlocks.map(this.parseBlock)

    if (rawBlocks.length > 0) {
      this.onSync()
    }

    this.notify({ type: "ActorInitialized", actor: this })
    this.q.subscribe(f => f(this))
  }

  // Note: on Actor ready, not Feed!
  onReady = (cb: (actor: Actor) => void) => {
    this.q.push(cb)
  }

  onPeerAdd = (peer: Peer) => {
    log("peer-add feed", ID(this.id))
    this.peers.add(peer)
    this.notify({ type: "PeerAdd", actor: this, peer: peer})
    this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size })
  }

  onPeerRemove = (peer: Peer) => {
    this.peers.delete(peer)
    this.notify({ type: "PeerUpdate", actor: this, peers: this.peers.size })
  }

  onDownload = (index: number, data: Uint8Array) => {
    this.parseBlock(data, index)
    const time = Date.now()
    const size = data.byteLength

    this.notify({ type: "Download", actor: this, index, size, time })
  }

  onSync = () => {
    log("sync feed", ID(this.id))
    this.notify({ type: "ActorSync", actor: this })
  }

  onClose = () => {
    this.close()
  }

  parseBlock = (data: Uint8Array, index: number) => {
    if (this.type === "Unknown") {
      if (index === 0) {
        this.parseHeaderBlock(data)
      } else {
        this.pending[index] = data
      }
    } else {
      this.parseDataBlock(data, index)
    }
  }

  parseHeaderBlock(data: Uint8Array) {
    const header = Block.unpack(data) // no validation of head
    if (header.hasOwnProperty("type")) {
      this.type = "File"
      this.fileMetadata = header
    } else {
      this.type = "Automerge"
      this.parseBlock(data, 0)
      this.pending.map(this.parseBlock)
      this.pending = []
    }
  }

  parseDataBlock(data: Uint8Array, index: number) {
    switch (this.type) {
      case "Automerge":
        const change: Change = Block.unpack(data) // no validation of Change
        this.changes[index] = change
        log(`block xxx idx=${index} actor=${ID(change.actor)} seq=${change.seq}`)
        break
      case "File":
        this.data[index - 1] = data
        break
      default:
        throw new Error("cant handle block if we don't know the type")
        break
    }
  }

  writeChange(change: Change) {
    const feedLength = this.changes.length
    const ok = feedLength + 1 === change.seq
    log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`)
    this.changes.push(change)
    this.onSync()
    this.append(Block.pack(change))
  }

  writeFile(data: Uint8Array, mimeType: string) {
    log("writing file")
    this.onReady(() => {
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

  private append(block: Uint8Array) {
    this.feed.append(block, err => {
      log("Feed.append", block.length, "bytes")
      if (err) {
        throw new Error("failed to append to feed")
      }
    })
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
        fs.rename(filename, newName, (err: Error) => {
        })
      }
    })
  }

}
