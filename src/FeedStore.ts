import { Readable, Writable } from 'stream'
import hypercore, { Feed as HypercoreFeed } from 'hypercore'
import { KeyPair, decodePair, PublicId, DiscoveryId } from './Keys'
import { getOrCreate, toDiscoveryId, createMultiPromise } from './Misc'
import Queue from './Queue'
import { Database, Statement } from './SqlDatabase'
import * as Crypto from './Crypto'

export type Feed = HypercoreFeed<Block>
export type FeedId = PublicId
export type Block = Uint8Array

interface StorageFn {
  (path: string): (filename: string) => unknown
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
  private storage: (discoveryId: DiscoveryId) => (filename: string) => unknown
  private loaded: Map<PublicId, Feed> = new Map()
  info: FeedInfoStore

  constructor(db: Database, storageFn: StorageFn) {
    this.info = new FeedInfoStore(db)
    this.storage = (discoveryId) => storageFn(`${discoveryId.slice(0, 2)}/${discoveryId.slice(2)}`)
  }

  /**
   * Create a brand-new writable feed using the given key pair.
   * Promises the FeedId.
   */
  async create(keys: Required<KeyPair>): Promise<FeedId> {
    await this.openOrCreateFeed(keys)
    return keys.publicKey as FeedId
  }

  async sign(feedId: FeedId, message: Buffer): Promise<Crypto.EncodedSignature> {
    const feed = await this.open(feedId)
    if (!feed || !feed.secretKey) {
      throw new Error(`Can't sign with feed ${feedId}`)
    }
    const signature = Crypto.sign(Crypto.encode(feed.secretKey), message)
    return signature
  }

  verify(feedId: FeedId, message: Buffer, signature: Crypto.EncodedSignature): boolean {
    return Crypto.verify(feedId, message, signature)
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
    const feed = await this.getFeed(feedId)
    return feed.createWriteStream()
  }

  async read(feedId: FeedId, seq: number): Promise<Block> {
    const feed = await this.getFeed(feedId)
    return new Promise((res, rej) => {
      feed.get(seq, (err, data) => {
        if (err) return rej(err)
        res(data)
      })
    })
  }

  async head(feedId: FeedId): Promise<Block> {
    const feed = await this.getFeed(feedId)
    return new Promise((res, rej) => {
      feed.head({ update: true, minLength: 1 }, (err, data) => {
        if (err) return rej(err)

        res(data)
      })
    })
  }

  async stream(feedId: FeedId, start = 0, end?: number): Promise<Readable> {
    const feed = await this.open(feedId)
    if (end != null && end < 0) end = feed.length + end
    return feed.createReadStream({ start, end })
  }

  closeFeed(feedId: FeedId): Promise<FeedId> {
    const feed = this.loaded.get(feedId)
    if (!feed) return Promise.reject(new Error(`Can't close feed ${feedId}, feed not open`))

    return new Promise((res, rej) => {
      feed.close((err) => {
        if (err) return rej(err)
        res(feedId)
      })
    })
  }

  async close(): Promise<void> {
    await Promise.all([...this.loaded.keys()].map((feedId) => this.closeFeed(feedId)))
  }

  async getFeed(feedId: FeedId): Promise<Feed> {
    return this.open(feedId)
  }

  private async open(publicId: PublicId) {
    return await this.openOrCreateFeed({ publicKey: publicId })
  }

  private openOrCreateFeed(keys: KeyPair): Promise<Feed> {
    return new Promise((res, _rej) => {
      const publicId = keys.publicKey as FeedId

      const feed = getOrCreate(this.loaded, publicId, () => {
        const discoveryId = toDiscoveryId(publicId)
        const { publicKey, secretKey } = decodePair(keys)

        const feed = hypercore<Block>(this.storage(discoveryId), publicKey, {
          storageCacheSize: 0,
          secretKey,
        })

        feed.ready(() => {
          this.info.save({
            publicId,
            discoveryId,
            isWritable: feed.writable ? 1 : 0,
          })
        })

        return feed
      })

      feed.ready(() => res(feed))
    })
  }
}
export interface FeedInfo {
  publicId: PublicId
  discoveryId: DiscoveryId
  isWritable: 0 | 1
}

export class FeedInfoStore {
  createdQ: Queue<FeedInfo>
  private prepared: {
    insert: Statement<[FeedInfo]>
    byPublicId: Statement<[PublicId]>
    byDiscoveryId: Statement<[DiscoveryId]>
    publicIds: Statement<[]>
    discoveryIds: Statement<[]>
  }

  constructor(db: Database) {
    this.createdQ = new Queue('FeedStore:createdQ')
    this.prepared = {
      insert: db.prepare(
        `INSERT INTO Feeds (publicId, discoveryId, isWritable)
          VALUES (@publicId, @discoveryId, @isWritable)`
      ),
      byPublicId: db.prepare(`SELECT * FROM Feeds WHERE publicId = ? LIMIT 1`),
      byDiscoveryId: db.prepare(`SELECT * FROM Feeds WHERE discoveryId = ? LIMIT 1`),
      publicIds: db.prepare('SELECT publicId FROM Feeds').pluck(),
      discoveryIds: db.prepare('SELECT discoveryId FROM Feeds').pluck(),
    }
  }

  save(info: FeedInfo) {
    if (!this.hasDiscoveryId(info.discoveryId)) {
      this.prepared.insert.run(info)
      this.createdQ.push(info)
    }
  }

  getPublicId(discoveryId: DiscoveryId): PublicId | undefined {
    const info = this.byDiscoveryId(discoveryId)
    return info && info.publicId
  }

  hasDiscoveryId(discoveryId: DiscoveryId): boolean {
    return !!this.byDiscoveryId(discoveryId)
  }

  byPublicId(publicId: PublicId): FeedInfo | undefined {
    return this.prepared.byPublicId.get(publicId)
  }

  byDiscoveryId(discoveryId: DiscoveryId): FeedInfo | undefined {
    return this.prepared.byDiscoveryId.get(discoveryId)
  }

  allPublicIds(): PublicId[] {
    return this.prepared.publicIds.all()
  }

  allDiscoveryIds(): DiscoveryId[] {
    return this.prepared.discoveryIds.all()
  }
}
