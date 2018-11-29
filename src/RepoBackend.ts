
import Queue from "./Queue"
import { MetadataBlock, Metadata } from "./Metadata"
import { clock } from "./ClockSet"
import * as JsonBuffer from "./JsonBuffer"
import * as Base58 from "bs58"
import * as crypto from "hypercore/lib/crypto"
import { readFeed, hypercore, Feed, Peer, discoveryKey } from "./hypercore"
import * as Backend from "automerge/backend"
import { Clock, Change } from "automerge/backend"
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg"
import { DocBackend } from "./DocBackend"
import Debug from "debug"

export const EXT = "hypermerge"

type FeedFn = (f: Feed<Uint8Array>) => void

interface Swarm {
  join(dk: Buffer): void
  leave(dk: Buffer): void
  on: Function
}

Debug.formatters.b = Base58.encode

const HypercoreProtocol: Function = require("hypercore-protocol")

const log = Debug("repo:backend")

export interface KeyBuffer {
  publicKey: Buffer
  secretKey?: Buffer
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

export class RepoBackend {
  path?: string
  storage: Function
  joined: Set<Buffer> = new Set()
  feeds: Map<string, Feed<Uint8Array>> = new Map()
  feedQs: Map<string, Queue<FeedFn>> = new Map()
  feedPeers: Map<string, Set<Peer>> = new Map()
  docs: Map<string, DocBackend> = new Map()
  changes: Map<string, Change[]> = new Map()
//  private docMetadata: Metadata = new Metadata()
  private meta: Metadata
  private opts: Options
  toFrontend: Queue<ToFrontendRepoMsg> = new Queue("repo:toFrontend")
  swarm?: Swarm
  id: Buffer

  constructor(opts: Options) {
    this.opts = opts
    this.path = opts.path || "default"
    this.storage = opts.storage
    const ledger : Feed<MetadataBlock> = hypercore(this.storageFn("ledger"), { valueEncoding: "json" })
    this.id = ledger.id
    this.meta = new Metadata(ledger)
  }

  private createDocBackend(keys: KeyBuffer): DocBackend {
    const docId = Base58.encode(keys.publicKey)
    log("Create", docId)
    const doc = new DocBackend(this, docId, Backend.init())

    this.docs.set(docId, doc)

    this.meta.addActor(doc.docId, doc.docId)

    this.initFeed(keys)

    return doc
  }

  private openDocBackend(docId: string): DocBackend {
    let doc = this.docs.get(docId) || new DocBackend(this, docId)
    if (!this.docs.has(docId)) {
      this.docs.set(docId, doc)
      this.meta.addActor(docId, docId)
      this.loadDocument(doc)
    }
    return doc
  }

  merge(id: string, clock: Clock) {
    this.meta.merge(id, clock)
    this.initActors(Object.keys(clock))
  }

  follow(id: string, target: string) {
    this.meta.follow(id, target)
    this.initActors([ ... this.meta.actors(id)])
  }

  replicate = (swarm: Swarm) => {
    if (this.swarm) {
      throw new Error("replicate called while already swarming")
    }
    this.swarm = swarm
    for (let dk of this.joined) {
      this.swarm.join(dk)
    }
  }

  private feedData(actorId: string): Promise<Change[]> {
    return new Promise((resolve, reject) => {
      this.getFeed(actorId, feed => {
        resolve(this.changes.get(actorId)!)
      })
    })
  }

  private allFeedData(id: string): Promise<Change[]> {
    const blank : Change[] = []
    return new Promise((resolve) => {
      this.meta.actorsAsync(id, (actors) => {
        Promise.all([... actors].map(actor => this.feedData(actor)))
        .then( changes => resolve( blank.concat( ... changes )))
      })
    })
  }

  writeChange(actorId: string, change: Change) {
    const changes = this.changes.get(actorId)!
    const feedLength = changes.length
    const ok = feedLength + 1 === change.seq
    log(`write actor=${actorId} seq=${change.seq} feed=${feedLength} ok=${ok}`)
    changes.push(change)
    this.syncChanges(actorId)
    this.getFeed(actorId, feed => {
      feed.append(JsonBuffer.bufferify(change), err => {
        if (err) {
          throw new Error("failed to append to feed")
        }
      })
    })
  }

  private loadDocument(doc: DocBackend) {
    this.allFeedData(doc.docId).then(changes => {
      const localActor = this.meta.localActor(doc.docId)
      doc.init(changes, localActor)
    })
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

  private getFeed = (actorId: string, cb: FeedFn) => {
    const publicKey = Base58.decode(actorId)
    const q = this.feedQs.get(actorId) || this.initFeed({ publicKey })
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
    this.meta.addActor(doc.docId, actorId)
    this.initFeed(keys)
    return actorId
  }

  sendToPeer(peer: Peer, data: any) {
    peer.stream.extension(EXT, Buffer.from(JSON.stringify(data)))
  }

  actorIds(doc: DocBackend): string[] {
    return [ ... this.meta.actors(doc.docId) ]
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
        ...(this.feedPeers.get(actorId) || []), ]),
    )
  }

  private closeFeed = (actorId: string) => {
    this.feed(actorId).close()
  }

  private feedDocs(actorId: string, cb: (doc: DocBackend) => void) {
    //FIXME need SEQ
    this.meta.docsWith(actorId, 0).forEach( docId => cb( this.docs.get(docId)! ))
  }

  private initActors( actors: string[] ) {
    actors.forEach( actor => { 
      this.getFeed(actor, feed => {
        this.syncChanges(actor)
      })
    })
  }

  private initFeed(keys: KeyBuffer): Queue<FeedFn> {
    // FIXME - this code asssumes one doc to one feed - no longer true
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
    const changes : Change[] = []
    this.changes.set(actorId, changes)
    this.feeds.set(dkString, feed)
    this.feedQs.set(actorId, q)
    this.feedPeers.set(actorId, peers)
    log("init feed", actorId)
    feed.ready(() => {
      this.meta.setWritable(actorId,feed.writable)
      this.meta.docsWith( actorId ).forEach( docId => {
        const peers = this.feedPeers.get(docId)!
        peers.forEach( peer => this.message(peer, this.meta.forActor(actorId) ))
      })
      feed.on("peer-remove", (peer: Peer) => {
        peers.delete(peer)
      })
      feed.on("peer-add", (peer: Peer) => {
        peer.stream.on("extension", (ext: string, buf: Buffer) => {
          if (ext === EXT) {
            const blocks: MetadataBlock[] = JSON.parse(buf.toString())
            log("EXT", blocks)
            this.meta.addBlocks(blocks)
            blocks.forEach(block => {
              // getFeed -> initFeed -> join()
              this.initActors( [ ... block.actorIds! ])
            })
          }
        })
        peers.add(peer)
        this.message(peer, this.meta.forActor(actorId))
      })

      feed.on("download", (idx, data) => {
        changes.push(JsonBuffer.parse(data))
      })

      feed.on("sync", () => {
        this.syncChanges(actorId)
      })

      // read everything from disk before subscribing to the queue
      readFeed(feed, datas => {
        changes.push( ... datas.map(JsonBuffer.parse))
        this.join(actorId)
        q.subscribe(f => f(feed))
      })


      feed.on("close", () => {
        log("closing feed", actorId)
        this.changes.delete(actorId)
        this.feeds.delete(dkString)
        this.feedQs.delete(actorId)
        this.feedPeers.delete(actorId)
      })
    })
    return q
   }

  private message(peer: Peer, message: any) {
    peer.stream.extension(EXT, Buffer.from(JSON.stringify(message)))
  }

  syncChanges(actor: string) {
    const ids = this.meta.docsWith(actor)
    ids.forEach(id => {
      const doc = this.docs.get(id)
      if (doc) { // doc may not be open... (forks and whatnot)
        const max = this.meta.clock(id)[actor] || 0
        const seq = doc.clock[actor] || 0
        if (max > seq) {
          const changes = this.changes.get(actor)!.slice(seq, max)
          log(`changes found doc=${id} n=${changes.length} seq=${seq} max=${max} length=${changes.length}`)
          doc.applyRemoteChanges(changes)
        }
      }
    })
  }

  stream = (opts: any): any => {
    const stream = HypercoreProtocol({
      live: true,
      id: this.id,
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
      case "MergeMsg": {
        this.merge(msg.id, clock(msg.actors))
        break;
      }
      case "FollowMsg": {
        this.follow(msg.id, msg.target)
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
