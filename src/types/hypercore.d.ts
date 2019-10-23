declare module 'hypercore' {
  import { Readable, Writable } from 'stream'
  import { PublicKey, DiscoveryKey, SecretKey } from 'hypercore-crypto'

  export default hypercore

  const hypercore: Hypercore

  export interface Options {
    /** create a new hypercore key pair if none was present in storage. Default: true */
    createIfMissing?: boolean

    /** overwrite any old hypercore that might already exist. Default: false */
    overwrite?: boolean

    /** defaults to binary */
    valueEncoding?: 'json' | 'utf-8' | 'binary'

    /** do not mark the entire feed to be downloaded */
    sparse?: false

    /**
     * always fetch the latest update that is advertised.
     * Default: false in sparse mode, otherwise true
     */
    eagerUpdate?: boolean

    /** optionally pass the corresponding secret key yourself */
    secretKey?: SecretKey

    /** if false, will not save the secret key. Default: true */
    storeSecretKey?: boolean

    /** the # of entries to keep in the storage system's LRU cache (false or 0 to disable). Default: 65536 */
    storageCacheSize?: number

    /**
     * optional hook called before data is written after being verified.
     * (remember to call cb() at the end of your handler)
     */
    onwrite?(index: number, data: Buffer, peer: any, cb: () => void): void

    /** collect network-related statistics. Default: true */
    stats?: boolean

    /** Optionally use custom cryptography for signatures */
    crypto?: {
      sign(
        data: Buffer,
        secretKey: SecretKey,
        cb: (err: Error | null, signature: Buffer) => void
      ): void
      verify(
        signature: Buffer,
        data: Buffer,
        key: PublicKey,
        cb: (err: Error | null, valid: boolean) => void
      ): void
    }

    /** set a static key pair to use for Noise authentication when replicating */
    noiseKeyPair?: { publicKey: Buffer; secretKey: Buffer }
  }

  interface Hypercore {
    /**
     * Create a new hypercore feed.
     * `storage` should be set to a directory where you want to store the data and feed metadata.
     *
     * ```js
     * var feed = hypercore('./directory') // store data in ./directory
     * ```
     *
     * Alternatively you can pass a function instead that is called with every filename hypercore
     * needs to function and return your own random-access instance that is used to store the data.
     */
    <T>(storage: Storage, options?: Options): Feed<T>
    <T>(storage: Storage, key: PublicKey, options?: Options): Feed<T>

    discoveryKey(publicKey: PublicKey): DiscoveryKey
  }

  export type Storage = string | ((filename: string) => any)

  export interface FeedEvents<T> {
    ready(): void
    close(): void
    sync(): void
    error(err: Error): void
    download(index: number, data: Buffer): void
    upload(index: number, data: T): void
    data(idx: number, data: T): void
    extension(name: string, msg: Buffer, peer: Peer): void
    ['peer-add'](peer: Peer): void
    ['peer-remove'](peer: Peer): void
  }

  export interface GetOptions {
    /** wait for index to be downloaded. Default: true */
    wait?: boolean

    /** wait at max some milliseconds (0 means no timeout). Default: 0 */
    timeout?: number

    /** defaults to the feed's valueEncoding */
    valueEncoding?: 'json' | 'utf-8' | 'binary'
  }

  export interface ReadStreamOptions {
    /** read from this index. Default: 0 */
    start?: number

    /** read until this index. Default: feed.length */
    end?: number

    /** if set to false it will update `end` to `feed.length` on every read. Default: true */
    snapshot?: boolean

    /** sets `start` to `feed.length`. Default: false */
    tail?: boolean

    /** set to true to keep reading forever. Default: false */
    live?: boolean

    /** timeout for each data event (0 means no timeout). Default: 0 */
    timeout?: number

    /** wait for data to be downloaded. Default: true */
    wait?: boolean
  }

  export interface HeadOptions extends GetOptions {
    /** Wait for feed length update. Default: false */
    update?: boolean

    /** When `update: true`, wait for this length */
    minLength?: number
  }

  export interface Feed<T> {
    peers: Peer[]
    replicate: Function
    writable: boolean
    discoveryKey: DiscoveryKey
    key: PublicKey
    length: number
    ready: Function
    readonly extensions: string[]

    on<K extends keyof FeedEvents<T>>(event: K, cb: FeedEvents<T>[K]): this
    off<K extends keyof FeedEvents<T>>(event: K, cb: FeedEvents<T>[K]): this

    /**
     * Append a block of data to the feed.
     *
     * Callback is called with (err, seq) when all data has been written at the returned seq number
     * or error will be not null.
     */
    append(data: T, cb?: (err: Error | null, seq: number) => void): void

    clear(index: number, cb: () => void): void
    clear(start: number, end: number, cb: () => void): void

    downloaded(start?: number, end?: number): number

    has(start: number, end?: number): boolean

    signature(cb: (err: any, sig: any) => void): void
    signature(index: number, cb: (err: any, sig: any) => void): void

    verify(index: number, sig: Buffer, cb: (err: any, roots: any) => void): void

    close(cb: (err: Error) => void): void

    get(index: number, cb: (err: Error, data: T) => void): void
    get(index: number, options: GetOptions, cb: (err: Error, data: T) => void): void

    getBatch(start: number, end: number, cb: (Err: any, data: T[]) => void): void
    getBatch(
      start: number,
      end: number,
      options: GetOptions,
      cb: (Err: any, data: T[]) => void
    ): void

    /**
     * Get the block of data at the tip of the feed. This will be the most recently appended block.
     */
    head(options: HeadOptions, cb: (err: Error | null, data: T) => void): void
    head(cb: (err: Error | null, data: T) => void): void

    createReadStream(opts?: ReadStreamOptions): Readable
    createWriteStream(): Writable

    extension(name: string, msg: Buffer): void
  }

  export interface Peer {
    feed: any
    stream: any
    onextension: any
    remoteId: Buffer
    extension: any
    extensions: string[]
  }
}
