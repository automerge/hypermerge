import fs from 'fs'
import { Readable, Writable } from 'stream'
import hypercore, { Feed } from 'hypercore'
import { KeyPair, decodePair } from './Keys'
import { BaseId, getOrCreate } from './Misc'
import Queue from './Queue'

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
  feedIdQ: Queue<FeedId>

  constructor(storageFn: FeedStorageFn) {
    this.storage = storageFn
    this.feedIdQ = new Queue('FeedStore:idQ')
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

  async stream(feedId: FeedId, start = 0): Promise<Readable> {
    const feed = await this.open(feedId)
    return feed.createReadStream({ start })
  }

  closeFeed(feedId: FeedId): Promise<FeedId> {
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

  async close(): Promise<void> {
    await Promise.all([...this.feeds.keys()].map((feedId) => this.closeFeed(feedId)))
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

        this.feedIdQ.push(feedId)

        return hypercore(this.storage(feedId), publicKey, {
          secretKey,
        })
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
