import fs from 'fs'
import { Readable, Writable } from 'stream'
import { KeyPair, decodePair, decode } from './Keys'
import { hypercore, Feed, discoveryKey } from './hypercore'
import { BaseId, getOrCreate, DiscoveryId, toDiscoveryId, encodeDiscoveryId } from './Misc'
import { PeerConnection } from './NetworkPeer'
import HypercoreProtocol from 'hypercore-protocol'

export type Feed = Feed<Block>
export type FeedId = BaseId & { feedId: true }
export type Block = Uint8Array

export interface ReplicateOptions {
  stream(): void
}

interface FeedStorageFn {
  (feedId: FeedId): (filename: string) => unknown
}

/**
 * Note:
 * FeedId should really be the discovery key. The public key should be
 * PublicId. Reading and writing to existing hypercores does not require the
 * public key; it's saved to disk. In a future refactor, we plan to remove the
 * reliance on public keys, and instead only provide the public key when
 * creating a new hypercore, or opening an unknown hypercore. The ledger keeps
 * track of which hypercores have already been opened.
 */

export default class FeedStore {
  private storage: FeedStorageFn
  private feeds: Map<FeedId, Feed<Block>> = new Map()
  private discoveryIds: Map<DiscoveryId, FeedId>

  constructor(storageFn: FeedStorageFn) {
    this.storage = storageFn
    this.discoveryIds = new Map()
  }

  /**
   * Create a brand-new writable feed using the given key pair.
   * Promises the FeedId.
   */
  async create(keys: Required<KeyPair>): Promise<FeedId> {
    const [feedId] = await this.openOrCreateFeed(keys)
    return feedId
  }

  async append(feedId: FeedId, ...blocks: Block[]): Promise<number> {
    const feed = await this.open(feedId)
    return createMultiPromise<number>(blocks.length, (res, rej) => {
      blocks.forEach((block) => {
        feed.append(block, (err, seq) => {
          if (err) {
            return rej(err)
          }

          res(seq)
        })
      })
    })
  }

  async appendStream(feedId: FeedId): Promise<Writable> {
    const feed = await this.open(feedId)
    return feed.createWriteStream()
  }

  async read(feedId: FeedId, seq: number): Promise<any> {
    const feed = await this.open(feedId)
    return new Promise((res, rej) => {
      feed.get(seq, (err, data) => {
        if (err) return rej(err)
        res(data)
      })
    })
  }

  async stream(feedId: FeedId, start = 0, end = -1): Promise<Readable> {
    const feed = await this.open(feedId)
    return feed.createReadStream({ start })
  }

  close(feedId: FeedId): Promise<FeedId> {
    const feed = this.feeds.get(feedId)
    if (!feed) return Promise.reject(new Error(`Can't close feed ${feedId}, feed not open`))

    return new Promise((res, rej) => {
      feed.close((err) => {
        if (err) return rej(err)
        res(feedId)
      })
    })
  }

  destroy(feedId: FeedId): Promise<FeedId> {
    return new Promise((res, rej) => {
      const filename = (this.storage(feedId)('') as any).filename
      const newName = filename.slice(0, -1) + `_${Date.now()}_DEL`
      fs.rename(filename, newName, (err: Error) => {
        if (err) return rej(err)
        res(feedId)
      })
    })
  }

  onConnection = (conn: PeerConnection): void => {
    const protocol = new HypercoreProtocol(conn.isClient, {
      timeout: 10000,
      ondiscoverykey: (key: Buffer) => {
        console.log('ondiscoverykey', key)
      },
      // extensions: DocumentBroadcast.SUPPORTED_EXTENSIONS,
    })

    conn.socket.pipe(protocol)
    protocol.pipe(conn.socket)
    const busKey = Buffer.from('deadbeefdeadbeefdeadbeefdeadbeef', 'hex')
    const busDiscoveryId = encodeDiscoveryId(discoveryKey(busKey))
    const bus = protocol.open(busKey, {
      onextension: (ext: 0, data: Buffer) => {
        console.log(data.toString())
      },
    })

    bus.options({
      extensions: ['hypermerge-network'],
      ack: false,
    })

    bus.extension(0, Buffer.from('hi there'))

    const onFeedRequested = async (discoveryId: DiscoveryId) => {
      if (discoveryId === busDiscoveryId) return

      const feedId = this.getFeedId(discoveryId)
      const feed = await this.getFeed(feedId)

      feed.replicate(protocol, {
        live: true,
      })
    }

    protocol.on('discovery-key', (discoveryKey: Buffer) =>
      onFeedRequested(encodeDiscoveryId(discoveryKey))
    )

    conn.discoveryQ.subscribe(onFeedRequested)
  }

  // Junk method used to bridge to Network
  async getFeed(feedId: FeedId): Promise<Feed<Block>> {
    return this.open(feedId)
  }

  private getFeedId(discoveryId: DiscoveryId): FeedId {
    const feedId = this.discoveryIds.get(discoveryId)
    if (!feedId) throw new Error(`Unknown feed: ${discoveryId}`)
    return feedId
  }

  private async open(feedId: FeedId) {
    const [, feed] = await this.openOrCreateFeed({ publicKey: feedId })
    return feed
  }

  private openOrCreateFeed(keys: KeyPair): Promise<[FeedId, Feed<Block>]> {
    return new Promise((res, _rej) => {
      const feedId = keys.publicKey as FeedId

      const feed = getOrCreate(this.feeds, feedId, () => {
        const { publicKey, secretKey } = decodePair(keys)

        // TODO: Use DiscoveryId as FeedId:
        const discoveryId = toDiscoveryId(feedId)
        this.discoveryIds.set(discoveryId, feedId)

        return hypercore(this.storage(feedId), publicKey, { secretKey })
      })

      feed.ready(() => res([feedId, feed]))
    })
  }
}

/**
 * The returned promise resolves after the `resolver` fn is called `n` times.
 * Promises the last value passed to the resolver.
 */
function createMultiPromise<T>(
  n: number,
  factory: (resolver: (value: T) => void, rejector: (err: Error) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const res = (value: T) => {
      n -= 1
      if (n === 0) resolve(value)
    }

    const rej = (err: Error) => {
      n = -1 // Ensure we never resolve
      reject(err)
    }

    factory(res, rej)
  })
}
