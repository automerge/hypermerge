declare function require(moduleName: string): any

let _hypercore = require('hypercore')

import Debug from 'debug'
import { ID, ActorId } from './Misc'
import { Readable, Writable } from 'stream'
const log = Debug('repo:hypermerge')

type Key = string | Buffer
type Storage = string | Function

export interface Options {
  secretKey?: Key
  valueEncoding?: string
  extensions?: string[]
}

export interface ReadOpts {
  wait?: boolean
  timeout?: number
  valueEncoding?: string
}

export function discoveryKey(buf: Buffer): Buffer {
  return _hypercore.discoveryKey(buf)
}

export function hypercore<T>(storage: Storage, options: Options): Feed<T>
export function hypercore<T>(storage: Storage, key: Key, options: Options): Feed<T>
export function hypercore<T>(storage: Storage, arg2: any, arg3?: any): Feed<T> {
  if (arg3) {
    return _hypercore(storage, arg2, arg3)
  } else {
    return _hypercore(storage, arg2)
  }
}

export interface Peer {
  feed: any
  stream: any
  onextension: any
  remoteId: Buffer
  extension: any
  extensions: string[]
}

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

  append(data: T): void
  append(data: T, cb: (err: Error | null, seq: number) => void): void
  clear(index: number, cb: () => void): void
  clear(start: number, end: number, cb: () => void): void
  downloaded(): number
  downloaded(start: number): number
  downloaded(start: number, end: number): number
  has(index: number): boolean
  has(start: number, end: number): boolean
  signature(cb: (err: any, sig: any) => void): void
  signature(index: number, cb: (err: any, sig: any) => void): void
  verify(index: number, sig: Buffer, cb: (err: any, roots: any) => void): void
  close(cb: (err: Error) => void): void
  get(index: number, cb: (err: Error, data: T) => void): void
  get(index: number, config: any, cb: (err: Error, data: T) => void): void
  getBatch(start: number, end: number, cb: (Err: any, data: T[]) => void): void
  getBatch(start: number, end: number, config: any, cb: (Err: any, data: T[]) => void): void
  createReadStream(opts: any): Readable
  createWriteStream(): Writable

  extension(name: string, msg: Buffer): void
}

function readFeedN<T>(
  id: ActorId | 'ledger',
  feed: Feed<T>,
  index: number,
  cb: (data: T[]) => void
) {
  log(`readFeedN id=${ID(id)} (0..${index})`)

  if (index === 0) {
    feed.get(0, { wait: false }, (err, data) => {
      if (err) log(`feed.get() error id=${ID(id)}`, err)
      if (err) throw err
      cb([data])
    })
  } else {
    feed.getBatch(0, index, { wait: false }, (err, data) => {
      if (err) log(`feed.getBatch error id=${ID(id)}`, err)
      if (err) throw err
      cb(data)
    })
  }
}

export function readFeed<T>(id: ActorId | 'ledger', feed: Feed<T>, cb: (data: T[]) => void) {
  //  const id = feed.id.toString('hex').slice(0,4)
  const length = feed.downloaded()

  log(`readFeed ${ID(id)} downloaded=${length} feed.length=${feed.length}`)

  if (length === 0) return cb([])
  if (feed.has(0, length)) return readFeedN(id, feed, length, cb)

  for (let i = 0; i < length; i++) {
    if (!feed.has(i)) {
      feed.clear(i, feed.length, () => {
        log(`post clear -- readFeedN id=${ID(id)} n=${i - 1}`)
        readFeedN(id, feed, i - 1, cb)
      })
      break
    }
  }
}
