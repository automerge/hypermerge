declare function require(moduleName: string): any

import * as JsonBuffer from "./JsonBuffer"
let _hypercore = require("hypercore")
let _crypto = require("hypercore/lib/crypto")
const EXT = "hypermerge"

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
  options: Options
): Feed<T>
export function hypercore<T>(storage: Storage, arg2: any, arg3?: any): Feed<T> {
  if (arg3) {
    return _hypercore(storage, arg2, arg3)
  } else {
    return _hypercore(storage, arg2)
  }
}

export interface HypercoreFeed<T> {
  on(event: "ready", cb: () => void): this
  on(event: "close", cb: () => void): this
  on(event: "sync", cb: () => void): this
  on(event: "error", cb: (err: Error) => void): this
  on(event: "download", cb: (index: number, data: Buffer) => void): this
  on(event: "upload", cb: (index: number, data: T) => void): this
  on(event: "data", cb: (idx: number, data: T) => void): this
  on(event: "peer-add", cb: (peer: HypercorePeer) => void): this
  on(event: "peer-remove", cb: (peer: HypercorePeer) => void): this
  on(event: "extension", cb: (a: any, b: any) => void): this

  peers: Peer[]
  replicate: Function
  writable: Boolean
  ready: Function
  append(data: T): void
  append(data: T, cb: (err: Error | null) => void): void
  close(): void
  get(index: number, cb: (data: T) => void): void
  getBatch(start: number, end: number, cb: (Err: any, data: T[]) => void): void
  discoveryKey: Buffer
  id: Buffer
  length: number
}

interface HypercorePeer {
  feed: any
  stream: any

  $hypemerge$onmessage: void | ((data: Buffer) => void)
  $hypemerge$onclose: void | (() => void)
}

export interface KeyBuffer {
  publicKey: Buffer
  secretKey?: Buffer
}

export interface KeyPair {
  publicKey: Buffer
  secretKey: Buffer
}

export function keyPair(): KeyPair {
  return _crypto.keyPair()
}

export interface Peer {
  send(data: Buffer): void
  onclose: void | (() => void)
  onmessage: void | ((data: Buffer) => void)
}

export interface Feed<T> {
  id: Buffer
  ready: Promise<void>
  writable: Boolean
  closed: Promise<void>
  length: number
  ondata?: (chunks: T[]) => void
  onpeer?: (peer: Peer) => void

  append(data: T): Promise<void>
  slice(start: number): Promise<T[]>
  slice(start: number, end: number): Promise<T[]>
  close(): void
}

class HyperPeer implements Peer {
  core: HypercorePeer
  constructor(core: HypercorePeer) {
    this.core = core
  }
  set onmessage(onmessage: void | ((message: Buffer) => void)) {
    this.core.$hypemerge$onmessage = onmessage
  }
  get onmessage() {
    return this.core.$hypemerge$onmessage
  }
  set onclose(onclose: void | (() => void)) {
    this.core.$hypemerge$onclose = onclose
  }
  get onclose() {
    return this.core.$hypemerge$onclose
  }
  send(data: Buffer): void {
    this.core.stream.extension(EXT, data)
  }
}

export class HyperFeed<T> implements Feed<T> {
  core: HypercoreFeed<T>
  id: Buffer
  ready: Promise<void>
  closed: Promise<void>
  ondata?: (chunks: T[]) => void
  onpeer?: (peer: Peer) => void
  dataQ: T[]
  constructor(core: HypercoreFeed<T>) {
    this.core = core
    this.id = core.id
    this.ready = new Promise(resolve => core.on("ready", resolve))
    this.closed = new Promise(resolve => core.on("close", resolve))
    this.dataQ = []
    core.on("download", (idx, data) => {
      this.dataQ.push(JsonBuffer.parse(data))
    })
    core.on("sync", () => {
      if (this.ondata) {
        this.ondata(this.dataQ.splice(0))
      }
    })

    core.on("peer-add", (core: HypercorePeer) => {
      core.stream.on("extension", (ext: string, buffer: Buffer) => {
        if (ext === EXT && core.$hypemerge$onmessage) {
          core.$hypemerge$onmessage(buffer)
        }
      })

      const peer = new HyperPeer(core)
      if (this.onpeer) {
        this.onpeer(peer)
      }
    })

    core.on("peer-remove", (peer: HypercorePeer) => {
      if (peer.$hypemerge$onclose) {
        peer.$hypemerge$onclose()
      }
    })
  }
  get length() {
    return this.core.length
  }
  get writable() {
    return this.core.writable
  }
  append(data: T): Promise<void> {
    return new Promise((resolve, reject) => {
      this.core.append(data, error => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }
  slice(start: number, end: number = this.length): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.core.getBatch(start, end, (error, data) => {
        if (error) {
          reject(error)
        } else {
          resolve(data)
        }
      })
    })
  }
  close(): void {
    this.core.close()
  }
}
