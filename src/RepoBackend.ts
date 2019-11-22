import Queue from './Queue'
import { Metadata, PublicMetadata } from './Metadata'
import { Actor, ActorMsg } from './Actor'
import * as Clock from './Clock'
import {
  ToBackendQueryMsg,
  ToBackendRepoMsg,
  ToFrontendRepoMsg,
  DocumentMsg,
  SignReplyMsg,
  SealedBoxReplyMsg,
  OpenSealedBoxReplyMsg,
  BoxReplyMsg,
  OpenBoxReplyMsg,
} from './RepoMsg'
import { Backend, Change } from 'automerge'
import * as DocBackend from './DocBackend'
import path from 'path'
import fs from 'fs'
import {
  notEmpty,
  ID,
  ActorId,
  DocId,
  RepoId,
  encodeRepoId,
  encodeDocId,
  rootActorId,
  encodeActorId,
  toDiscoveryId,
  errorMessage,
} from './Misc'
import Debug from './Debug'
import * as Keys from './Keys'
import FeedStore from './FeedStore'
import FileStore from './FileStore'
import FileServer from './FileServer'
import Network from './Network'
import NetworkPeer, { PeerId } from './NetworkPeer'
import { Swarm, JoinOptions } from './SwarmInterface'
import { PeerMsg } from './PeerMsg'
import ClockStore from './ClockStore'
import CursorStore from './CursorStore'
import * as SqlDatabase from './SqlDatabase'
import MessageRouter, { Routed } from './MessageRouter'
import ram from 'random-access-memory'
import raf from 'random-access-file'
import KeyStore from './KeyStore'
import ReplicationManager, { Discovery } from './ReplicationManager'
import * as Crypto from './Crypto'

const log = Debug('RepoBackend')

export interface FeedData {
  actorId: ActorId
  writable: Boolean
  changes: Change[]
}

export interface Options {
  path?: string
  memory?: boolean
}

export class RepoBackend {
  path?: string
  storage: Function
  feeds: FeedStore
  keys: KeyStore
  files: FileStore
  clocks: ClockStore
  cursors: CursorStore
  actors: Map<ActorId, Actor> = new Map()
  docs: Map<DocId, DocBackend.DocBackend> = new Map()
  meta: Metadata
  opts: Options
  toFrontend: Queue<ToFrontendRepoMsg> = new Queue('repo:back:toFrontend')
  id: RepoId
  network: Network
  messages: MessageRouter<PeerMsg>
  replication: ReplicationManager
  swarmKey: Buffer // TODO: Remove this once we no longer use discovery-swarm/discovery-cloud
  private db: SqlDatabase.Database
  private fileServer: FileServer

  constructor(opts: Options) {
    this.opts = opts
    this.path = opts.path || 'default'

    // initialize storage
    if (!opts.memory) {
      ensureDirectoryExists(this.path)
    }
    this.storage = opts.memory ? ram : raf
    this.db = SqlDatabase.open(path.resolve(this.path, 'hypermerge.db'), opts.memory || false)

    this.keys = new KeyStore(this.db)
    this.feeds = new FeedStore(this.db, (path: string) => this.storageFn('feeds/' + path))
    this.files = new FileStore(this.feeds)

    // init repo
    const repoKeys = this.keys.get('self.repo') || this.keys.set('self.repo', Keys.createBuffer())
    this.swarmKey = repoKeys.publicKey
    this.id = encodeRepoId(repoKeys.publicKey)

    // initialize the various stores
    this.cursors = new CursorStore(this.db)
    this.clocks = new ClockStore(this.db)
    this.fileServer = new FileServer(this.files)

    this.replication = new ReplicationManager(this.feeds)
    this.meta = new Metadata(this.storageFn)
    this.network = new Network(toPeerId(this.id))
    this.messages = new MessageRouter('HypermergeMessages')

    for (const docId of this.cursors.getAllDocumentIds(this.id)) {
      this.network.join(toDiscoveryId(docId))
    }
    this.cursors.updateQ.subscribe(([_, docId]) => {
      this.network.join(toDiscoveryId(docId))
    })
    this.files.writeLog.subscribe((header) => {
      this.meta.addFile(header.url, header.size, header.mimeType)
    })
    this.messages.inboxQ.subscribe(this.onMessage)
    this.replication.discoveryQ.subscribe(this.onDiscovery)
    this.network.peerQ.subscribe(this.onPeer)
  }

  startFileServer = (path: string) => {
    if (this.fileServer.isListening()) return

    this.fileServer.listen(path).then(() => {
      this.toFrontend.push({
        type: 'FileServerReadyMsg',
        path,
      })
    })
  }

  private create(keys: Keys.KeyBuffer): DocBackend.DocBackend {
    const docId = encodeDocId(keys.publicKey)
    log('create', docId)
    const doc = new DocBackend.DocBackend(docId, Backend.init())
    doc.updateQ.subscribe(this.documentNotify)
    // HACK: We set a clock value of zero so we have a clock in the clock store
    // TODO: This isn't right.
    this.clocks.set(this.id, doc.id, { [doc.id]: 0 })

    this.docs.set(docId, doc)

    this.cursors.addActor(this.id, doc.id, rootActorId(doc.id))

    this.initActor(keys)

    return doc
  }

  // TODO: Temporary solution to replace meta.localActorId
  // We only know if an actor is local/writable if we have already
  // opened that actor. We should be storing this information somewhere
  // more readily available - either in FeedStore or DocumentStore.
  localActorId(docId: DocId) {
    const cursor = this.cursors.get(this.id, docId)
    const actors = Clock.actors(cursor)
    return actors.find((actorId) => this.meta.isWritable(actorId))
  }

  private debug(id: DocId) {
    const doc = this.docs.get(id)
    const short = id.substr(0, 5)
    if (doc === undefined) {
      console.log(`doc:backend NOT FOUND id=${short}`)
    } else {
      console.log(`doc:backend id=${short}`)
      console.log(`doc:backend clock=${Clock.clockDebug(doc.clock)}`)
      const local = this.localActorId(id)
      const cursor = this.cursors.get(this.id, id)
      const actors = Clock.actors(cursor)
      const info = actors
        .map((actor) => {
          const nm = actor.substr(0, 5)
          return local === actor ? `*${nm}` : nm
        })
        .sort()
      console.log(`doc:backend actors=${info.join(',')}`)
    }
  }

  // private destroy(id: DocId) {
  //   this.meta.delete(id)
  //   const doc = this.docs.get(id)
  //   if (doc) {
  //     this.docs.delete(id)
  //   }
  //   const actors = this.meta.allActors()
  //   this.actors.forEach((actor, id) => {
  //     if (!actors.has(id)) {
  //       console.log('Orphaned actors - will purge', id)
  //       this.actors.delete(id)
  //       this.leave(actor.id)
  //       actor.destroy()
  //     }
  //   })
  // }

  // opening a file fucks it up
  private open(docId: DocId): DocBackend.DocBackend {
    //    log("open", docId, this.meta.forDoc(docId));
    // TODO: FileStore should answer this.
    // NOTE: This isn't guaranteed to be correct. `meta.isFile` can return an incorrect answer
    // if the metadata ledger hasn't finished loading.
    if (this.meta.isFile(docId)) {
      throw new Error('trying to open a file like a document')
    }
    let doc = this.docs.get(docId)
    if (!doc) {
      doc = new DocBackend.DocBackend(docId)
      doc.updateQ.subscribe(this.documentNotify)
    }
    if (!this.docs.has(docId)) {
      this.docs.set(docId, doc)
      // TODO: It isn't always correct to add this actor with an Infinity cursor entry.
      // If we don't have a cursor for the document, we should wait to get one from a peer.
      // For now, we're mirroring legacy behavior.
      this.cursors.addActor(this.id, docId, rootActorId(docId))
      this.loadDocument(doc)
    }
    return doc
  }

  merge(id: DocId, clock: Clock.Clock) {
    // TODO: Should we do anything additional to note a merge?
    this.cursors.update(this.id, id, clock)
    this.syncReadyActors(Clock.actors(clock))
  }

  close = () => {
    this.actors.forEach((actor) => actor.close())
    this.actors.clear()
    this.db.close()

    return Promise.all([
      this.feeds.close(),
      this.replication.close(),
      this.network.close(),
      this.fileServer.close(),
    ])
  }

  private async allReadyActors(docId: DocId): Promise<Actor[]> {
    const cursor = this.cursors.get(this.id, docId)
    const actorIds = Clock.actors(cursor)
    return Promise.all(actorIds.map(this.getReadyActor))
  }

  private async loadDocument(doc: DocBackend.DocBackend) {
    const actors = await this.allReadyActors(doc.id)
    log(`load document 2 actors=${actors.map((a) => a.id)}`)
    const changes: Change[] = []
    actors.forEach((actor) => {
      const max = this.cursors.entry(this.id, doc.id, actor.id)
      const slice = actor.changes.slice(0, max)
      doc.changes.set(actor.id, slice.length)
      log(`change actor=${ID(actor.id)} changes=0..${slice.length}`)
      changes.push(...slice)
    })
    log(`loading doc=${ID(doc.id)} changes=${changes.length}`)
    // Check to see if we already have a local actor id. If so, re-use it.
    // TODO: DocumentStore can answer this.
    const localActorId = this.localActorId(doc.id)
    const actorId = localActorId
      ? (await this.getReadyActor(localActorId)).id
      : this.initActorFeed(doc)
    doc.init(changes, actorId)
  }

  private getReadyActor = (actorId: ActorId): Promise<Actor> => {
    const publicKey = Keys.decode(actorId)
    const actor = this.actors.get(actorId) || this.initActor({ publicKey })
    const actorPromise = new Promise<Actor>((resolve, reject) => {
      try {
        actor.onReady(resolve)
      } catch (e) {
        reject(e)
      }
    })
    return actorPromise
  }

  storageFn = (path: string) => {
    return (name: string) => {
      return this.storage(this.path + '/' + path + '/' + name)
    }
  }

  initActorFeed(doc: DocBackend.DocBackend): ActorId {
    log('initActorFeed', doc.id)
    const keys = Keys.createBuffer()
    const actorId = encodeActorId(keys.publicKey)
    this.cursors.addActor(this.id, doc.id, actorId)
    this.initActor(keys)
    return actorId
  }

  actorIds(doc: DocBackend.DocBackend): ActorId[] {
    const cursor = this.cursors.get(this.id, doc.id)
    return Clock.actors(cursor)
  }

  docActors(doc: DocBackend.DocBackend): Actor[] {
    return this.actorIds(doc)
      .map((id) => this.actors.get(id))
      .filter(notEmpty)
  }

  syncReadyActors = (ids: ActorId[]) => {
    ids.forEach(async (id) => {
      const actor = await this.getReadyActor(id)
      this.syncChanges(actor)
    })
  }

  private getGoodClock(doc: DocBackend.DocBackend): Clock.Clock | undefined {
    const minimumClockSatisfied = this.clocks.has(this.id, doc.id)
    return minimumClockSatisfied
      ? doc.clock
      : this.clocks.getMaximumSatisfiedClock(doc.id, doc.clock)
  }

  private documentNotify = (msg: DocBackend.DocBackendMessage) => {
    switch (msg.type) {
      case 'ReadyMsg': {
        const doc = msg.doc
        const goodClock = this.getGoodClock(doc)
        this.toFrontend.push({
          type: 'ReadyMsg',
          id: doc.id,
          minimumClockSatisfied: !!goodClock,
          actorId: doc.actorId,
          history: msg.history,
          patch: msg.patch,
        })
        break
      }
      case 'ActorIdMsg': {
        this.toFrontend.push({
          type: 'ActorIdMsg',
          id: msg.id,
          actorId: msg.actorId,
        })
        break
      }
      case 'RemotePatchMsg': {
        const doc = msg.doc
        const goodClock = this.getGoodClock(doc)
        if (goodClock) {
          this.clocks.update(this.id, doc.id, goodClock)
        }
        this.toFrontend.push({
          type: 'PatchMsg',
          id: doc.id,
          minimumClockSatisfied: !!goodClock,
          patch: msg.patch,
          history: msg.history,
        })
        break
      }
      case 'LocalPatchMsg': {
        const doc = msg.doc
        if (!doc.actorId) return

        this.actor(doc.actorId)!.writeChange(msg.change)

        const goodClock = this.getGoodClock(doc)
        if (goodClock) {
          this.clocks.update(this.id, doc.id, goodClock)
        }

        this.toFrontend.push({
          type: 'PatchMsg',
          id: doc.id,
          minimumClockSatisfied: !!goodClock,
          patch: msg.patch,
          history: msg.history,
        })
        break
      }
      default: {
        console.log('Unknown message type', msg)
      }
    }
  }

  onPeer = (peer: NetworkPeer): void => {
    this.messages.listenTo(peer)
    this.replication.onPeer(peer)
  }

  onDiscovery = ({ feedId, peer }: Discovery) => {
    const actorId = feedId as ActorId

    const docsWithActor = this.cursors.docsWithActor(this.id, actorId)
    const cursors = docsWithActor.map((docId) => ({
      docId: docId,
      cursor: this.cursors.get(this.id, docId),
    }))
    const clocks = docsWithActor.map((docId) => ({
      docId: docId,
      clock: this.clocks.get(this.id, docId),
    }))

    this.messages.sendToPeer(peer, {
      type: 'CursorMessage',
      cursors,
      clocks,
    })
  }

  private onMessage = ({ sender, msg }: Routed<PeerMsg>) => {
    switch (msg.type) {
      case 'CursorMessage': {
        const { clocks, cursors } = msg
        // TODO: ClockStore and CursorStore will both have updateQs, but we probably want to
        // wait to act for any given doc until both the ClockStore and CursorStore are updated
        // for that doc.
        clocks.forEach((clock) => this.clocks.update(sender.id, clock.docId, clock.clock))
        cursors.forEach((cursor) => {
          // TODO: Current behavior is to always expand our own cursor with our peers' cursors.
          // In the future, we might want to be more selective.
          this.cursors.update(sender.id, cursor.docId, cursor.cursor)
          this.cursors.update(this.id, cursor.docId, cursor.cursor)
        })

        // TODO: This emulates the syncReadyActors behavior from RemotaMetadata messages,
        // but is extremely wasteful. We'll able to trim this once we have DocumentStore.
        // TODO: Use a CursorStore updateQ to manage this behavior.
        cursors.forEach(({ cursor }) => {
          const actors = Clock.actors(cursor)
          this.syncReadyActors(actors)
        })
        break
      }
      case 'DocumentMessage': {
        const { contents, id } = msg as DocumentMsg
        this.toFrontend.push({
          type: 'DocumentMessage',
          id,
          contents,
        })
        break
      }
    }
  }

  private actorNotify = (msg: ActorMsg) => {
    switch (msg.type) {
      case 'ActorFeedReady': {
        const actor = msg.actor
        // Record whether or not this actor is writable.
        // TODO: DocumentStore or FeedStore should manage this.
        this.meta.setWritable(actor.id, msg.writable)

        // Broadcast latest document information to peers.
        const docsWithActor = this.cursors.docsWithActor(this.id, actor.id)
        const cursors = docsWithActor.map((docId) => ({
          docId: docId,
          cursor: this.cursors.get(this.id, docId),
        }))
        const clocks = docsWithActor.map((docId) => ({
          docId: docId,
          clock: this.clocks.get(this.id, docId),
        }))
        const discoveryIds = docsWithActor.map(toDiscoveryId)
        const peers = this.replication.getPeersWith(discoveryIds)

        this.messages.sendToPeers(peers, {
          type: 'CursorMessage',
          cursors: cursors,
          clocks: clocks,
        })

        break
      }
      case 'ActorSync':
        log('ActorSync', msg.actor.id)
        this.syncChanges(msg.actor)
        break
      case 'Download':
        this.cursors.docsWithActor(this.id, msg.actor.id).forEach((docId) => {
          this.toFrontend.push({
            type: 'ActorBlockDownloadedMsg',
            id: docId,
            actorId: msg.actor.id,
            index: msg.index,
            size: msg.size,
            time: msg.time,
          })
        })
        break
    }
  }

  private initActor(keys: Keys.KeyBuffer): Actor {
    const actor = new Actor({
      keys,
      notify: this.actorNotify,
      store: this.feeds,
    })
    this.actors.set(actor.id, actor)
    return actor
  }

  syncChanges = (actor: Actor) => {
    const actorId = actor.id
    const docIds = this.cursors.docsWithActor(this.id, actorId)
    docIds.forEach((docId) => {
      const doc = this.docs.get(docId)
      if (doc) {
        doc.ready.push(() => {
          const max = this.cursors.entry(this.id, docId, actorId)
          const min = doc.changes.get(actorId) || 0
          const changes = []
          let i = min
          for (; i < max && actor.changes.hasOwnProperty(i); i++) {
            const change = actor.changes[i]
            log(`change found xxx id=${ID(actor.id)} seq=${change.seq}`)
            changes.push(change)
          }
          doc.changes.set(actorId, i)
          //        log(`changes found xxx doc=${ID(docId)} actor=${ID(actor.id)} n=[${min}+${changes.length}/${max}]`);
          if (changes.length > 0) {
            log(`applyremotechanges ${changes.length}`)
            doc.applyRemoteChanges(changes)
          }
        })
      }
    })
  }

  /** @deprecated Use addSwarm */
  setSwarm = (swarm: Swarm, joinOptions?: JoinOptions) => {
    this.addSwarm(swarm, joinOptions)
  }

  addSwarm = (swarm: Swarm, joinOptions?: JoinOptions) => {
    this.network.addSwarm(swarm, joinOptions)
  }

  removeSwarm = (swarm: Swarm) => {
    this.network.removeSwarm(swarm)
  }

  subscribe = (subscriber: (message: ToFrontendRepoMsg) => void) => {
    this.toFrontend.subscribe(subscriber)
  }

  handleQuery = async (id: number, query: ToBackendQueryMsg) => {
    switch (query.type) {
      case 'EncryptionKeyPairMsg': {
        const keyPair = Crypto.encodedEncryptionKeyPair()
        this.toFrontend.push({
          type: 'Reply',
          id,
          payload: { type: 'EncryptionKeyPairReplyMsg', success: true, keyPair },
        })
        break
      }
      case 'BoxMsg': {
        let payload: BoxReplyMsg
        try {
          const box = Crypto.box(
            query.senderSecretKey,
            query.recipientPublicKey,
            Buffer.from(query.message)
          )
          payload = { type: 'BoxReplyMsg', success: true, box }
        } catch (e) {
          payload = { type: 'BoxReplyMsg', success: false, error: errorMessage(e) }
        }
        this.toFrontend.push({ type: 'Reply', id, payload })
        break
      }
      case 'OpenBoxMsg': {
        let payload: OpenBoxReplyMsg
        try {
          const message = Crypto.openBox(query.senderPublicKey, query.recipientSecretKey, query.box)
          payload = { type: 'OpenBoxReplyMsg', success: true, message: message.toString() }
        } catch (e) {
          payload = { type: 'OpenBoxReplyMsg', success: false, error: errorMessage(e) }
        }
        this.toFrontend.push({ type: 'Reply', id, payload })
        break
      }
      case 'SealedBoxMsg': {
        let payload: SealedBoxReplyMsg
        try {
          const sealedBox = Crypto.sealedBox(query.publicKey, Buffer.from(query.message))
          payload = { type: 'SealedBoxReplyMsg', success: true, sealedBox }
        } catch (e) {
          payload = { type: 'SealedBoxReplyMsg', success: false, error: errorMessage(e) }
        }
        this.toFrontend.push({ type: 'Reply', id, payload })
        break
      }
      case 'OpenSealedBoxMsg': {
        let payload: OpenSealedBoxReplyMsg
        try {
          const message = Crypto.openSealedBox(query.keyPair, query.sealedBox)
          payload = { type: 'OpenSealedBoxReplyMsg', success: true, message: message.toString() }
        } catch (e) {
          payload = { type: 'OpenSealedBoxReplyMsg', success: false, error: errorMessage(e) }
        }
        this.toFrontend.push({ type: 'Reply', id, payload })
        break
      }
      case 'SignMsg': {
        let payload: SignReplyMsg
        try {
          const { signature } = await this.feeds.sign(query.docId, Buffer.from(query.message))
          payload = {
            type: 'SignReplyMsg',
            success: true,
            signedMessage: { message: query.message, signature },
          }
        } catch (e) {
          payload = { type: 'SignReplyMsg', success: false, error: errorMessage(e) }
        }
        this.toFrontend.push({
          type: 'Reply',
          id,
          payload,
        })
        break
      }
      case 'VerifyMsg': {
        let success
        try {
          const signedMessage = {
            ...query.signedMessage,
            message: Buffer.from(query.signedMessage.message),
          }
          success = this.feeds.verify(query.docId, signedMessage)
        } catch (e) {
          success = false
        }
        this.toFrontend.push({
          type: 'Reply',
          id,
          payload: {
            type: 'VerifyReplyMsg',
            success,
          },
        })
        break
      }
      case 'MetadataMsg': {
        // TODO: We're recreating the MetadataMsg which used to live in Metadata.ts
        // Its not clear if this is used or useful. It looks like the data (which is faithfully
        // represented below - empty clock and 0 history in all) is already somewhat broken.
        // NOTE: Responses to file metadata won't reply until the ledger is fully loaded. Document
        // responses will respond immediately.
        this.meta.readyQ.push(() => {
          let payload: PublicMetadata | null
          if (this.meta.isDoc(query.id)) {
            const cursor = this.cursors.get(this.id, query.id)
            const actors = Clock.actors(cursor)
            payload = {
              type: 'Document',
              clock: {},
              history: 0,
              actor: this.localActorId(query.id),
              actors,
            }
          } else if (this.meta.isFile(query.id)) {
            payload = this.meta.fileMetadata(query.id)
          } else {
            payload = null
          }
          this.toFrontend.push({
            type: 'Reply',
            id,
            payload: { type: 'MetadataReplyMsg', metadata: payload },
          })
        })
        break
      }
      case 'MaterializeMsg': {
        const doc = this.docs.get(query.id)!
        const changes = (doc.back as any)
          .getIn(['opSet', 'history'])
          .slice(0, query.history)
          .toArray()
        const [, patch] = Backend.applyChanges(Backend.init(), changes)
        this.toFrontend.push({ type: 'Reply', id, payload: { type: 'MaterializeReplyMsg', patch } })
        break
      }
    }
  }

  receive = (msg: ToBackendRepoMsg) => {
    switch (msg.type) {
      case 'NeedsActorIdMsg': {
        const doc = this.docs.get(msg.id)!
        const actorId = this.initActorFeed(doc)
        doc.initActor(actorId)
        break
      }
      case 'RequestMsg': {
        const doc = this.docs.get(msg.id)!
        doc.applyLocalChange(msg.request)
        break
      }
      case 'Query': {
        const query = msg.query
        const id = msg.id
        this.handleQuery(id, query)
        break
      }
      case 'CreateMsg': {
        this.create(Keys.decodePair(msg))
        break
      }
      case 'MergeMsg': {
        this.merge(msg.id, Clock.strs2clock(msg.actors))
        break
      }
      /*
        case "FollowMsg": {
          this.follow(msg.id, msg.target);
          break;
        }
*/
      case 'OpenMsg': {
        this.open(msg.id)
        break
      }
      case 'DocumentMessage': {
        // Note: 'id' is the document id of the document to send the message to.
        const { id, contents } = msg
        const peers = this.replication.getPeersWith([toDiscoveryId(id)])
        this.messages.sendToPeers(peers, {
          type: 'DocumentMessage',
          id,
          contents,
        })

        break
      }
      case 'DestroyMsg': {
        console.log('Destroy is a noop')
        //this.destroy(msg.id)
        break
      }
      case 'DebugMsg': {
        this.debug(msg.id)
        break
      }
      case 'CloseMsg': {
        this.close()
        break
      }
    }
  }

  actor(id: ActorId): Actor | undefined {
    return this.actors.get(id)
  }
}

function ensureDirectoryExists(path: string) {
  try {
    fs.mkdirSync(path, { recursive: true })
  } catch (e) {
    // On slightly older versions of node, this will throw if the directory already exists
  }
}

function toPeerId(repoId: RepoId): PeerId {
  return repoId as PeerId
}
