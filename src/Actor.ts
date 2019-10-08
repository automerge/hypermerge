import { Peer, discoveryKey } from './hypercore'
import { Change } from 'automerge'
import { ID, ActorId, DiscoveryId, encodeActorId, encodeDiscoveryId } from './Misc'
import Queue from './Queue'
import * as Block from './Block'
import * as Keys from './Keys'
import Debug from 'debug'
import FeedStore, { FeedId, Feed } from './FeedStore'

const log = Debug('repo:actor')

export type ActorMsg = ActorFeedReady | ActorInitialized | ActorSync | PeerAdd | Download

interface ActorSync {
  type: 'ActorSync'
  actor: Actor
}

interface ActorFeedReady {
  type: 'ActorFeedReady'
  actor: Actor
  feed: Feed
  writable: boolean
}

interface ActorInitialized {
  type: 'ActorInitialized'
  actor: Actor
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
  store: FeedStore
}

export class Actor {
  id: ActorId
  dkString: DiscoveryId
  changes: Change[] = []
  private q: Queue<(actor: Actor) => void>
  private notify: (msg: ActorMsg) => void
  private store: FeedStore

  constructor(config: ActorConfig) {
    const { publicKey } = config.keys
    const dk = discoveryKey(publicKey)
    const id = encodeActorId(publicKey)

    this.id = id
    this.store = config.store
    this.notify = config.notify
    this.dkString = encodeDiscoveryId(dk)
    this.q = new Queue<(actor: Actor) => void>('repo:actor:Q' + id.slice(0, 4))

    this.getOrCreateFeed(Keys.encodePair(config.keys)).then((feed) => {
      feed.ready(() => this.onFeedReady(feed))
    })
  }

  // Note: on Actor ready, not Feed!
  onReady = (cb: (actor: Actor) => void) => {
    this.q.push(cb)
  }

  writeChange(change: Change) {
    const feedLength = this.changes.length
    const ok = feedLength + 1 === change.seq
    log(`write actor=${this.id} seq=${change.seq} feed=${feedLength} ok=${ok}`)
    this.changes.push(change)
    this.onSync()
    this.store.append(this.id, Block.pack(change))
  }

  close() {
    return this.store.closeFeed(this.id)
  }

  async destroy() {
    await this.close()
    this.store.destroy(this.id)
  }

  private async getOrCreateFeed(keys: Keys.KeyPair) {
    let feedId: FeedId
    if (keys.secretKey) {
      feedId = await this.store.create(keys as Required<Keys.KeyPair>)
    } else {
      feedId = keys.publicKey as FeedId
    }
    return this.store.getFeed(feedId)
  }

  private onFeedReady = async (feed: Feed) => {
    this.notify({ type: 'ActorFeedReady', actor: this, writable: feed.writable, feed })

    feed.on('peer-add', this.onPeerAdd)
    feed.on('close', this.onClose)
    if (!feed.writable) {
      feed.on('download', this.onDownload)
      feed.on('sync', this.onSync)
    }

    let hasData = false
    let sequenceNumber = 0
    const data = await this.store.stream(this.id)
    data.on('data', (chunk) => {
      this.parseBlock(chunk, sequenceNumber)
      sequenceNumber += 1
      hasData = true
    })
    data.on('end', () => {
      this.notify({ type: 'ActorInitialized', actor: this })
      this.q.subscribe((f) => f(this))
      if (hasData) this.onSync()
    })
  }

  private onPeerAdd = (peer: Peer) => {
    log('peer-add feed', ID(this.id))
    this.notify({ type: 'PeerAdd', actor: this, peer: peer })
  }

  private onDownload = (index: number, data: Uint8Array) => {
    this.parseBlock(data, index)
    const time = Date.now()
    const size = data.byteLength

    this.notify({ type: 'Download', actor: this, index, size, time })
  }

  private onSync = () => {
    log('sync feed', ID(this.id))
    this.notify({ type: 'ActorSync', actor: this })
  }

  private onClose = () => {
    this.close()
  }

  private parseBlock(data: Uint8Array, index: number) {
    const change: Change = Block.unpack(data) // no validation of Change
    this.changes[index] = change
    log(`block xxx idx=${index} actor=${ID(change.actor)} seq=${change.seq}`)
  }
}
