
import Queue from "./Queue"
import { MetadataBlock, Metadata, validateMetadataMsg } from "./Metadata"
import { Actor, ActorMsg, EXT } from "./Actor"
import MapSet from "./MapSet"
import { strs2clock, clockDebug } from "./Clock"
import * as JsonBuffer from "./JsonBuffer"
import * as Base58 from "bs58"
import * as crypto from "hypercore/lib/crypto"
import { readFeed, hypercore, Feed, Peer, discoveryKey } from "./hypercore"
import * as Backend from "automerge/backend"
import { Clock, Change } from "automerge/backend"
import { ToBackendRepoMsg, ToFrontendRepoMsg } from "./RepoMsg"
import { DocBackend } from "./DocBackend"
import * as Misc from "./Misc"
import Debug from "debug"

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
  actors: Map<string, Actor> = new Map()
  actorsDk: Map<string, Actor> = new Map()
  docs: Map<string, DocBackend> = new Map()
  meta: Metadata
  opts: Options
  toFrontend: Queue<ToFrontendRepoMsg> = new Queue("repo:toFrontend")
  swarm?: Swarm
  id: Buffer
  file?: Uint8Array

  constructor(opts: Options) {
    console.log("REPO BACKEND")
    this.opts = opts
    this.path = opts.path || "default"
    this.storage = opts.storage
    const ledger: Feed<MetadataBlock> = hypercore(this.storageFn("ledger"), { valueEncoding: "json" })
    this.id = ledger.id
    this.meta = new Metadata(ledger)
  }

  private writeFile(keys: KeyBuffer, data: Uint8Array) {
    const fileId = Base58.encode(keys.publicKey)

    this.meta.addFile(fileId, data.length)

    const actor = this.initActor(keys)
    actor.writeFile(data)
  }

  private readFile(id: string, cb: ( data: Uint8Array ) => void) {
    this.getReadyActor(id, actor => actor.readFile(cb))
  }

  private create(keys: KeyBuffer): DocBackend {
    const docId = Base58.encode(keys.publicKey)
    log("Create", docId)
    const doc = new DocBackend(this, docId, Backend.init())

    this.docs.set(docId, doc)

    this.meta.addActor(doc.id, doc.id)

    this.initActor(keys)

    return doc
  }

  private debug(id: string) {
    const doc = this.docs.get(id)
    const short = id.substr(0, 5)
    if (doc === undefined) {
      console.log(`doc:backend NOT FOUND id=${short}`)
    } else {
      console.log(`doc:backend id=${short}`)
      console.log(`doc:backend clock=${clockDebug(doc.clock)}`)
      const local = this.meta.localActorId(id)
      const actors = this.meta.actors(id)
      const info = actors.map(actor => {
        const nm = actor.substr(0, 5)
        return local === actor ? `*${nm}` : nm
      }).sort()
      console.log(`doc:backend actors=${info.join(',')}`)
    }
  }

  private open(docId: string): DocBackend {
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
    this.syncReadyActors(Object.keys(clock))
  }

  follow(id: string, target: string) {
    this.meta.follow(id, target)
    this.syncReadyActors(this.meta.actors(id))
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

  private allReadyActors(docId: string, cb: (actors: Actor[]) => void) {
    const a2p = (id: string) : Promise<Actor> =>
      (new Promise(resolve => this.getReadyActor(id, resolve)))
    this.meta.actorsAsync(docId, ids => Promise.all(ids.map(a2p)).then(cb))
  }

  private loadDocument(doc: DocBackend) {
    this.allReadyActors(doc.id , (actors) => {
      const changes : Change[] = []
      actors.forEach(actor => {
        const max = this.meta.clock(doc.id)[actor.id] || 0
        const slice = actor.changes.slice(0, max)
        changes.push( ...  slice )
      })
      doc.init(changes, this.meta.localActorId(doc.id))
    })
  }

  join = (actorId: string) => {
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

  private getReadyActor = (actorId: string, cb: (actor: Actor) => void) => {
    console.log("GET READY ACTOR", actorId)
    const publicKey = Base58.decode(actorId)
    const actor = this.actors.get(actorId) || this.initActor({ publicKey })
    actor.push(cb)
  }

  storageFn = (path: string): Function => {
    return (name: string) => {
      return this.storage(this.path + "/" + path + "/" + name)
    }
  }

  initActorFeed(doc: DocBackend): string {
    log("initActorFeed", doc.id)
    const keys = crypto.keyPair()
    const actorId = Base58.encode(keys.publicKey)
    this.meta.addActor(doc.id, actorId)
    this.initActor(keys)
    return actorId
  }

/*
  sendToPeer(peer: Peer, data: any) {
    peer.stream.extension(EXT, Buffer.from(JSON.stringify(data)))
  }
*/

  actorIds(doc: DocBackend): string[] {
    return this.meta.actors(doc.id)
  }

  docActors(doc: DocBackend): Actor[] {
    return this.actorIds(doc).map(id => this.actors.get(id)).filter(Misc.notEmpty)
  }

  syncReadyActors = (ids: string[]) => {
    ids.map(id => this.getReadyActor(id, this.syncChanges))
  }

  private actorNotify = (msg: ActorMsg) => {
    switch(msg.type) {
      case "NewMetadata":
        const blocks = validateMetadataMsg(msg.input)
        this.meta.addBlocks(blocks)
        blocks.map(block => this.syncReadyActors(block.actors || []))
        break;
      case "ActorSync":
        this.syncChanges(msg.actor)
        break;
    }
  }

  private initActor(keys: KeyBuffer): Actor {
    const meta = this.meta
    const notify = this.actorNotify
    const storage = this.storageFn
    const actor = new Actor({ keys, meta, notify, storage })
    this.actors.set(actor.id, actor)
    this.actorsDk.set(actor.dkString, actor)
    actor.push(() => { this.join(actor.id) })
    return actor
  }

  syncChanges = (actor: Actor) => {
    const actorId = actor.id
    const docIds = this.meta.docsWith(actorId)
    docIds.forEach(docId => {
      const doc = this.docs.get(docId)
      if (doc) { // doc may not be open... (forks and whatnot)
        const max = this.meta.clock(docId)[actorId] || 0
        const seq = doc.clock[actorId] || 0
        if (max > seq) {
          const changes = actor.changes.slice(seq, max)
          log(`changes found doc=${docId} n=${changes.length} seq=${seq} max=${max} length=${changes.length}`)
          if (changes.length > 0) {
            doc.applyRemoteChanges(changes)
          }
        }
      }
    })
  }

  stream = (opts: any): any => {
    console.log("STREAM", opts)
    const stream = HypercoreProtocol({
      live: true,
      id: this.id,
      encrypt: false,
      timeout: 10000,
      extensions: [EXT],
    })

    let add = (dk: Buffer) => {
      const actor = this.actorsDk.get(Base58.encode(dk))
      if (actor) {
        log("replicate feed!", Base58.encode(dk))
        actor.feed.replicate({
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
    // FIXME - need reference count with many feeds <-> docs
  }

  subscribe = (subscriber: (message: ToFrontendRepoMsg) => void) => {
    this.toFrontend.subscribe(subscriber)
  }

  receive = (msg: ToBackendRepoMsg) => {
    if (msg instanceof Uint8Array) {
      this.file = msg
    } else {
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
        case "WriteFile": {
          const keys = {
            publicKey: Base58.decode(msg.publicKey),
            secretKey: Base58.decode(msg.secretKey)
          }
          this.writeFile(keys, this.file!)
          delete this.file
          break;
        }
        case "ReadFile": {
          const id = msg.id
          this.readFile(id, (file) => {
            this.toFrontend.push(file)
            this.toFrontend.push({ type: "ReadFileReply", id })
          })
          break;
        }
        case "CreateMsg": {
          const keys = {
            publicKey: Base58.decode(msg.publicKey),
            secretKey: Base58.decode(msg.secretKey)
          }
          this.create(keys)
          break;
        }
        case "MergeMsg": {
          this.merge(msg.id, strs2clock(msg.actors))
          break;
        }
        case "FollowMsg": {
          this.follow(msg.id, msg.target)
          break;
        }
        case "OpenMsg": {
          this.open(msg.id)
          break
        }
        case "DebugMsg": {
          this.debug(msg.id)
          break
        }

      }
    }
  }

  actor(id: string) : Actor | undefined {
    return this.actors.get(id)
  }

}
