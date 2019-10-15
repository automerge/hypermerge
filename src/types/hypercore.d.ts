declare module 'hypercore/lib/crypto' {
  function keyPair(): any
}

declare module 'hypercore' {
  import { Readable, Writable } from 'stream'

  export default hypercore

  const hypercore: Hypercore

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
    <T>(storage: Storage, key: Key, options?: Options): Feed<T>

    discoveryKey(publicKey: Buffer): Buffer
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

  export interface Feed<T> {
    peers: Peer[]
    replicate: Function
    writable: boolean
    discoveryKey: Buffer
    key: Buffer
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
    head(options: GetOptions, cb: (err: Error | null, data: T) => void): void
    head(cb: (err: Error | null, data: T) => void): void

    createReadStream(opts?: ReadStreamOptions): Readable
    createWriteStream(): Writable

    extension(name: string, msg: Buffer): void
  }
}
