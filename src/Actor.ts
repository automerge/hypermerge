/**
 * Actors provide an interface over the data replication scheme.
 * For dat, this means the actor abstracts over the hypercore and its peers.
 */
import { readFeed, hypercore, Feed, Peer, discoveryKey } from './hypercore'
import { Change } from 'automerge/backend'
import { ID, ActorId, DiscoveryId, encodeActorId, encodeDiscoveryId } from './Misc'
import Queue from './Queue'
import * as Block from './Block'
import * as Keys from './Keys'
import Debug from 'debug'

const fs: any = require('fs')

const log = Debug('repo:actor')

const KB = 1024
const MB = 1024 * KB

export type ActorMsg =
  | ActorFeedReady
  | ActorInitialized
  | ActorSync
  | PeerUpdate
  | PeerAdd
  | Download

interface ActorSync {
  type: 'ActorSync'
  actor: Actor
}

interface ActorFeedReady {
  type: 'ActorFeedReady'
  actor: Actor
  writable: boolean
}

interface ActorInitialized {
  type: 'ActorInitialized'
  actor: Actor
}

interface PeerUpdate {
  type: 'PeerUpdate'
  actor: Actor
  peers: number
}

interface PeerAdd {
  type: 'PeerAdd'
  actor: Actor
  peer: Peer
}

interface Download {
  type: 'Download'
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
  id: ActorId
  dkString: DiscoveryId
  changes: Change[] = []
  feed: Feed<Uint8Array>
  peers: Map<string, Peer> = new Map()
  private q: Queue<(actor: Actor) => void>
  private notify: (msg: ActorMsg) => void
  private storage: any

  constructor(config: ActorConfig) {
    const { publicKey, secretKey } = config.keys
    const dk = discoveryKey(publicKey)
    const id = encodeActorId(publicKey)

    this.id = id
    this.storage = config.storage(id)
    this.notify = config.notify
    this.dkString = encodeDiscoveryId(dk)
    this.feed = hypercore(this.storage, publicKey, { secretKey })
    this.q = new Queue<(actor: Actor) => void>('repo:actor:Q' + id.slice(0, 4))
    this.feed.ready(this.onFeedReady)
  }

  onFeedReady = () => {
    const feed = this.feed

    this.notify({ type: 'ActorFeedReady', actor: this, writable: feed.writable })

    feed.on('peer-remove', this.onPeerRemove)
    feed.on('peer-add', this.onPeerAdd)
    feed.on('download', this.onDownload)
    feed.on('sync', this.onSync)

    readFeed(this.id, feed, this.init) // onReady subscribe begins here

    feed.on('close', this.close)
  }

  init = (rawBlocks: Uint8Array[]) => {
    log('loaded blocks', ID(this.id), rawBlocks.length)
    rawBlocks.map(this.parseBlock)

    if (rawBlocks.length > 0) {
      this.onSync()
    }

    this.notify({ type: 'ActorInitialized', actor: this })
    this.q.subscribe((f) => f(this))
  }

  // Note: on Actor ready, not Feed!
  onReady = (cb: (actor: Actor) => void) => {
    this.q.push(cb)
  }

  onPeerAdd = (peer: Peer) => {
    log('peer-add feed', ID(this.id), peer.remoteId)
    // peer-add is called multiple times. Noop if we already know about this peer.
    if (this.peers.has(peer.remoteId.toString())) return

    this.peers.set(peer.remoteId.toString(), peer)
    this.notify({ type: 'PeerAdd', actor: this, peer: peer })
    this.notify({ type: 'PeerUpdate', actor: this, peers: this.peers.size })
  }

  onPeerRemove = (peer: Peer) => {
    this.peers.delete(peer.remoteId.toString())
    this.notify({ type: 'PeerUpdate', actor: this, peers: this.peers.size })
  }

  onDownload = (index: number, data: Uint8Array) => {
    this.parseBlock(data, index)
    const time = Date.now()
    const size = data.byteLength

    this.notify({ type: 'Download', actor: this, index, size, time })
  }

  onSync = () => {
    log('sync feed', ID(this.id))
    this.notify({ type: 'ActorSync', actor: this })
  }

  onClose = () => {
    this.close()
  }

  parseBlock = (data: Uint8Array, index: number) => {
    const change: Change = Block.unpack(data) // no validation of Change
    this.changes[index] = change
    log(`block xxx idx=${index} actor=${ID(change.actor)} seq=${change.seq}`)
  }

  writeChange(change: Change) {
    const feedLength = this.changes.length
    const ok = feedLength + 1 === change.seq
    log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`)
    this.changes.push(change)
    this.onSync()
    this.append(Block.pack(change))
  }

  private append(block: Uint8Array) {
    this.feed.append(block, (err) => {
      log('Feed.append', block.length, 'bytes')
      if (err) {
        throw new Error('failed to append to feed')
      }
    })
  }

  close = () => {
    log('closing feed', this.id)
    try {
      this.feed.close((err: Error) => {})
    } catch (error) {}
  }

  destroy = () => {
    this.feed.close((err: Error) => {
      const filename = this.storage('').filename
      if (filename) {
        const newName = filename.slice(0, -1) + `_${Date.now()}_DEL`
        fs.rename(filename, newName, (err: Error) => {})
      }
    })
  }
}
