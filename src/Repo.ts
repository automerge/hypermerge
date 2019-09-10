import { Options, RepoBackend } from './RepoBackend'
import { RepoFrontend } from './RepoFrontend'
import { Handle } from './Handle'
import { PublicMetadata } from './Metadata'
import { Clock } from './Clock'
import { DocUrl, HyperfileUrl } from './Misc'
import { Doc, Proxy } from 'automerge'

interface Swarm {
  join(dk: Buffer): void
  leave(dk: Buffer): void
  on: Function
}

export class Repo {
  front: RepoFrontend
  back: RepoBackend
  id: Buffer
  stream: (opts: any) => any
  create: <T>(init?: T) => DocUrl
  open: <T>(id: DocUrl) => Handle<T>
  destroy: (id: DocUrl) => void
  //follow: (id: string, target: string) => void;
  replicate: (swarm: Swarm) => void

  message: (url: DocUrl, message: any) => void

  fork: (url: DocUrl) => DocUrl
  watch: <T>(url: DocUrl, cb: (val: Doc<T>, clock?: Clock, index?: number) => void) => Handle<T>
  doc: <T>(url: DocUrl, cb?: (val: Doc<T>, clock?: Clock) => void) => Promise<Doc<T>>
  merge: (url: DocUrl, target: DocUrl) => void
  change: <T>(url: DocUrl, fn: (state: Proxy<T>) => void) => void
  writeFile: (data: Uint8Array, mimeType: string) => HyperfileUrl
  readFile: (url: HyperfileUrl, cb: (data: Uint8Array, mimeType: string) => void) => void
  materialize: <T>(url: DocUrl, seq: number, cb: (val: Doc<T>) => void) => void
  meta: (url: DocUrl | HyperfileUrl, cb: (meta: PublicMetadata | undefined) => void) => void
  close: () => void

  constructor(opts: Options) {
    this.front = new RepoFrontend()
    this.back = new RepoBackend(opts)
    this.front.subscribe(this.back.receive)
    this.back.subscribe(this.front.receive)
    this.id = this.back.id
    this.stream = this.back.stream
    this.create = this.front.create
    this.open = this.front.open
    this.message = this.front.message
    this.destroy = this.front.destroy
    this.meta = this.front.meta
    //    this.follow = this.front.follow;
    this.doc = this.front.doc
    this.fork = this.front.fork
    this.close = this.front.close
    this.change = this.front.change
    this.readFile = this.front.readFile
    this.writeFile = this.front.writeFile
    this.watch = this.front.watch
    this.merge = this.front.merge
    this.replicate = this.back.replicate
    this.materialize = this.front.materialize
  }
}
