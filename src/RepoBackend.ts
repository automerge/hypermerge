
export const EXT = "hypermerge"

type FeedFn = (f: Feed<Uint8Array>) => void

interface Swarm {
  join(dk: Buffer): void
  leave(dk: Buffer): void
  on: Function
}

import Queue from "./Queue"
import MapSet from "./MapSet"
import * as JsonBuffer from "./JsonBuffer"
import * as Base58 from "bs58"
import * as crypto from "hypercore/lib/crypto"
import { hypercore, Feed, Peer, discoveryKey } from "./hypercore"
import * as Backend from "automerge/backend"
import { Change } from "automerge/backend"
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg"
import { DocBackend } from "./DocBackend"
import Debug from "debug"

Debug.formatters.b = Base58.encode

const HypercoreProtocol: Function = require("hypercore-protocol")
const ram: Function = require("random-access-memory")
const raf: Function = require("random-access-file")

const log = Debug("repo:backend")

export function keyPair(docId?: string) : Keys {
  if (docId) {
    return {
      docId: docId,
      publicKey: Base58.decode(docId)
    }
  }
  const keys = crypto.keyPair()
  return {
      publicKey: keys.publicKey,
      secretKey: keys.secretKey,
      docId: Base58.encode(keys.publicKey),
      actorId: Base58.encode(keys.publicKey)
  }
}

export interface KeyBuffer {
  publicKey: Buffer
  secretKey?: Buffer
}

export interface Keys {
  publicKey: Buffer
  secretKey?: Buffer
  docId: string
  actorId?: string
}

export interface FeedData {
  actorId: string
  writable: Boolean
  changes: Change[]
}

export interface Options {
  path?: string
  storage: Function
}

export interface LedgerData {
  docId: string
  actorIds: string[]
}

export class RepoBackend {
  path?: string
  storage: Function
  ready: Promise<undefined>
  joined: Set<Buffer> = new Set()
  feeds: Map<string, Feed<Uint8Array>> = new Map()
  feedQs: Map<string, Queue<FeedFn>> = new Map()
  feedPeers: Map<string, Set<Peer>> = new Map()
  docs: Map<string, DocBackend> = new Map()
  feedSeq: Map<string, number> = new Map()
  ledger: Feed<LedgerData>
  private ledgerMetadata: MapSet<string, string> = new MapSet()
  private docMetadata: MapSet<string, string> = new MapSet()
  private opts : Options
  toFrontend: Queue<ToFrontendRepoMsg> = new Queue()
  swarm?: Swarm
  id: Buffer

  constructor(opts: Options) {
    this.opts = opts
    this.path = opts.path || "default"
    this.storage = opts.storage
    this.ledger = hypercore(this.storageFn("ledger"), { valueEncoding: "json" })
    this.id = this.ledger.id
    this.ready = new Promise((resolve, reject) => {
      this.ledger.ready(() => {
        log("Ledger ready: size", this.ledger.length)
        if (this.ledger.length > 0) {
          this.ledger.getBatch(0, this.ledger.length, (err, data) => {
            data.forEach(d => {
              this.docMetadata.merge(d.docId, d.actorIds)
              this.ledgerMetadata.merge(d.docId,d.actorIds)
            })
            resolve()
          })
        } else {
          resolve()
        }
      })
    })
  }

  createDocBackend(keys: KeyBuffer): DocBackend {
    const docId = Base58.encode(keys.publicKey)
    log("Create", docId)
    const doc = new DocBackend(this, docId, Backend.init())

    this.docs.set(docId, doc)

    this.initFeed(doc, keys)

    return doc
  }

  private addMetadata(docId: string, actorId: string) {
    this.docMetadata.add(docId, actorId)
    this.ready.then(() => {
      if (!this.ledgerMetadata.has(docId, actorId)) {
        this.ledgerMetadata.add(docId, actorId)
        this.ledger.append({ docId: docId, actorIds: [actorId] })
      }
    })
  }

  openDocBackend(docId: string): DocBackend {
    let doc = this.docs.get(docId) || new DocBackend(this, docId)
    if (!this.docs.has(docId)) {
      this.docs.set(docId, doc)
      this.addMetadata(docId, docId)
      this.loadDocument(doc)
      this.join(docId)
    }
    return doc
  }

  replicate(swarm: Swarm) {
    if (this.swarm) {
      throw new Error("replicate called while already swarming")
    }
    this.swarm = swarm
    for (let dk of this.joined) {
      this.swarm.join(dk)
    }
  }

  private feedData(doc: DocBackend, actorId: string): Promise<FeedData> {
    return new Promise((resolve, reject) => {
      this.getFeed(doc, actorId, feed => {
        const writable = feed.writable
        if (feed.length > 0) {
          feed.getBatch(0, feed.length, (err, datas) => {
            const changes = datas.map(JsonBuffer.parse)

            if (err) {
              reject(err)
            }

            this.feedSeq.set(actorId, datas.length)

            resolve({ actorId, writable, changes })
          })
        } else {
          resolve({ actorId, writable, changes: [] })
        }
      })
    })
  }

  private allFeedData(doc: DocBackend): Promise<FeedData[]> {
    return Promise.all(doc.actorIds().map(key => this.feedData(doc, key)))
  }

  writeChange(doc: DocBackend, actorId: string, change: Change) {
    const feedLength = this.feedSeq.get(actorId) || 0
    const ok = feedLength + 1 === change.seq
    log(`write actor=${actorId} seq=${change.seq} feed=${feedLength} ok=${ok}`)
    this.feedSeq.set(actorId, feedLength + 1)
    this.getFeed(doc, actorId, feed => {
      feed.append(JsonBuffer.bufferify(change), err => {
        if (err) {
          throw new Error("failed to append to feed")
        }
      })
    })
  }

  private loadDocument(doc: DocBackend) {
    return this.ready.then(() =>
      this.allFeedData(doc).then(feedData => {
        const writer = feedData
          .filter(f => f.writable)
          .map(f => f.actorId)
          .shift()
        const changes = ([] as Change[]).concat(...feedData.map(f => f.changes))
        doc.init(changes, writer)
      }),
    )
  }

  private join = (actorId: string) => {
    const dk = discoveryKey(Base58.decode(actorId))
    if (this.swarm && !this.joined.has(dk)) {
      this.swarm.join(dk)
    }
    this.joined.add(dk)
  }

  private leave = (actorId: string) => {
    const dk = discoveryKey(Base58.decode(actorId))
    if (this.swarm && this.joined.has(dk)) {
      this.swarm.leave(dk)
    }
    this.joined.delete(dk)
  }

  private getFeed = (doc: DocBackend, actorId: string, cb: FeedFn) => {
    const publicKey = Base58.decode(actorId)
    const dk = discoveryKey(publicKey)
    const dkString = Base58.encode(dk)
    const q = this.feedQs.get(dkString) || this.initFeed(doc, { publicKey })
    q.push(cb)
  }

  private storageFn(path: string): Function {
    return (name: string) => {
      return this.storage(this.path + "/" + path + "/" + name)
    }
  }

  initActorFeed(doc: DocBackend): string {
    log("initActorFeed", doc.docId)
    const keys = crypto.keyPair()
    const actorId = Base58.encode(keys.publicKey)
    this.initFeed(doc, keys)
    return actorId
  }

  sendToPeer(peer: Peer, data: any) {
    peer.stream.extension(EXT, Buffer.from(JSON.stringify(data)))
  }

  actorIds(doc: DocBackend): string[] {
    return [... this.docMetadata.get(doc.docId)]
  }

  feed(actorId: string): Feed<Uint8Array> {
    const publicKey = Base58.decode(actorId)
    const dk = discoveryKey(publicKey)
    const dkString = Base58.encode(dk)
    return this.feeds.get(dkString)!
  }

  peers(doc: DocBackend): Peer[] {
    return ([] as Peer[]).concat(
      ...this.actorIds(doc).map(actorId => [
        ...(this.feedPeers.get(actorId) || []),
      ]),
    )
  }

  private closeFeed = (actorId: string) => {
    this.feed(actorId).close()
  }

  private initFeed(doc: DocBackend, keys: KeyBuffer): Queue<FeedFn> {
    const { publicKey, secretKey } = keys
    const actorId = Base58.encode(publicKey)
    const storage = this.storageFn(actorId)
    const dk = discoveryKey(publicKey)
    const dkString = Base58.encode(dk)
    const feed: Feed<Uint8Array> = hypercore(storage, publicKey, {
      secretKey,
    })
    const q = new Queue<FeedFn>()
    const peers = new Set()
    this.feeds.set(dkString, feed)
    this.feedQs.set(dkString, q)
    this.feedPeers.set(actorId, peers)
    this.addMetadata(doc.docId, actorId)
    log("init feed", actorId)
    feed.ready(() => {
      this.feedSeq.set(actorId, 0)
      doc.broadcastMetadata()
      this.join(actorId)
      feed.on("peer-remove", (peer: Peer) => {
        peers.delete(peer)
      })
      feed.on("peer-add", (peer: Peer) => {
        peer.stream.on("extension", (ext: string, buf: Buffer) => {
          if (ext === EXT) {
            const msg: string[] = JSON.parse(buf.toString())
            log("EXT", msg)
            // getFeed -> initFeed -> join()
            msg.forEach(actorId => this.getFeed(doc, actorId, _ => { }))
          }
        })
        peers.add(peer)
        doc.messageMetadata(peer)
      })

      let remoteChanges: Change[] = []
      feed.on("download", (idx, data) => {
        remoteChanges.push(JsonBuffer.parse(data))
      })
      feed.on("sync", () => {
        doc.applyRemoteChanges(remoteChanges)
        remoteChanges = []
      })

      this.feedQs.get(dkString)!.subscribe(f => f(feed))

      feed.on("close", () => {
        log("closing feed", actorId)
        this.feeds.delete(dkString)
        this.feedQs.delete(dkString)
        this.feedPeers.delete(actorId)
        this.feedSeq.delete(actorId)
      })
    })
    return q
  }

  stream = (opts: any): any => {
    const stream = HypercoreProtocol({
      live: true,
      id: this.ledger.id,
      encrypt: false,
      timeout: 10000,
      extensions: [EXT],
    })

    let add = (dk: Buffer) => {
      const feed = this.feeds.get(Base58.encode(dk))
      if (feed) {
        log("replicate feed!", Base58.encode(dk))
        feed.replicate({
          stream,
          live: true,
        })
      }
    }


    stream.on("feed", (dk: Buffer) => add(dk))

    const dk = opts.channel || opts.discoveryKey
    if (dk) add(dk)

    return stream
  }

  releaseManager(doc: DocBackend) {
    const actorIds = doc.actorIds()
    this.docs.delete(doc.docId)
    actorIds.map(this.leave)
    actorIds.map(this.closeFeed)
  }

  subscribe = (subscriber: (message: ToFrontendRepoMsg) => void) => {
    this.toFrontend.subscribe(subscriber)
  }

  receive = (msg: ToBackendRepoMsg) => {
    switch (msg.type) {
      case "NeedsActorIdMsg": {
        const doc = this.docs.get(msg.id)!
        doc.initActor()
        break
      }
      case "RequestMsg": {
        const doc = this.docs.get(msg.id)!
        doc.applyLocalChange(msg.request)
        break
      }
      case "CreateMsg": {
        const keys = {
          publicKey: Base58.decode(msg.publicKey),
          secretKey: Base58.decode(msg.secretKey)
        }
        this.createDocBackend(keys)
        break;
      }
      case "OpenMsg": {
        this.openDocBackend(msg.id)
        break
      }

    }
    //export type ToBackendMsg = NeedsActorIdMsg | RequestMsg | CreateMsg | OpenMsg
  }
}
