import { Readable, Writable } from 'stream'
import { KeyPair, decodePair, decode } from './Keys'
import * as Base58 from 'bs58'
import { hypercore, Feed, discoveryKey } from './hypercore'
import { BaseId, DiscoveryId } from './Misc'

export type FeedId = BaseId & { feedId: true }
export type Block = Uint8Array

export interface ReplicateOptions {
  stream(): void
}

interface FeedStorageFn {
  (feedId: FeedId): (filename: string) => unknown
}

export default class FeedStore {
  private storage: FeedStorageFn
  private feeds: Map<FeedId, Feed<Block>> = new Map()

  constructor(storageFn: FeedStorageFn) {
    this.storage = storageFn
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

  // Junk method used to bridge to Network
  async getFeed(feedId: FeedId): Promise<Feed<Block>> {
    return this.open(feedId)
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
        return hypercore(this.storage(feedId), publicKey, { secretKey })
      })

      feed.ready(() => res([feedId, feed]))
    })
  }
}

export function discoveryId(feedId: FeedId): DiscoveryId {
  const decoded = Base58.decode(feedId)
  return Base58.encode(discoveryKey(decoded)) as DiscoveryId
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

function getOrCreate<K, V>(map: Map<K, V>, key: K, create: (key: K) => V): V {
  const existing = map.get(key)
  if (existing) return existing

  const created = create(key)
  map.set(key, created)
  return created
}

// function encodeFeedId(key: Buffer): FeedId {
//   return Keys.
// }
