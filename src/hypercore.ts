declare function require(moduleName: string): any

let _hypercore = require("hypercore")

type Key = string | Buffer
type Storage = string | Function

export interface Options {
  secretKey?: Key
  valueEncoding?: string
}

export function discoveryKey(buf: Buffer): Buffer {
  return _hypercore.discoveryKey(buf)
}

export function hypercore<T>(storage: Storage, options: Options): Feed<T>
export function hypercore<T>(
  storage: Storage,
  key: Key,
  options: Options,
): Feed<T>
export function hypercore<T>(storage: Storage, arg2: any, arg3?: any): Feed<T> {
  if (arg3) {
    return _hypercore(storage, arg2, arg3)
  } else {
    return _hypercore(storage, arg2)
  }
}

export interface Feed<T> {
  on(event: "ready", cb: () => void): this
  on(event: "close", cb: () => void): this
  on(event: "sync", cb: () => void): this
  on(event: "error", cb: (err: Error) => void): this
  on(event: "download", cb: (index: number, data: Buffer) => void): this
  on(event: "upload", cb: (index: number, data: T) => void): this
  on(event: "data", cb: (idx: number, data: T) => void): this
  on(event: "peer-add", cb: (peer: Peer) => void): this
  on(event: "peer-remove", cb: (peer: Peer) => void): this
  on(event: "extension", cb: (a: any, b: any) => void): this

  peers: Peer[]
  replicate: Function
  writable: Boolean
  ready: Function
  append(data: T): void
  append(data: T, cb: (err: Error | null) => void): void
  close() : void
  get(index: number, cb: (data: T) => void): void
  getBatch(start: number, end: number, cb: (Err: any, data: T[]) => void): void
  discoveryKey: Buffer
  id: Buffer
  length: number
}

export interface Peer {
  feed: any
  stream: any
  onextension: any
}
