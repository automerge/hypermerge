import { Options, RepoBackend } from './RepoBackend'
import { RepoFrontend } from './RepoFrontend'
import { Handle } from './Handle'
import { PublicMetadata } from './Metadata'
import { Clock } from './Clock'
import { DocUrl, HyperfileUrl, RepoId } from './Misc'
import FileServerClient from './FileServerClient'
import { Swarm, JoinOptions } from './SwarmInterface'
import { Doc, Proxy } from 'automerge'
import CryptoClient from './CryptoClient'

export class Repo {
  front: RepoFrontend
  back: RepoBackend

  id: RepoId
  create: <T>(init?: T) => DocUrl
  open: <T>(id: DocUrl) => Handle<T>
  destroy: (id: DocUrl) => void
  //follow: (id: string, target: string) => void;
  /** @deprecated Use addSwarm */
  setSwarm: (swarm: Swarm, joinOptions?: JoinOptions) => void

  addSwarm: (swarm: Swarm, joinOptions?: JoinOptions) => void
  removeSwarm: (swarm: Swarm, joinOptions?: JoinOptions) => void

  message: (url: DocUrl, message: any) => void

  crypto: CryptoClient

  files: FileServerClient
  startFileServer: (fileServerPath: string) => void

  fork: (url: DocUrl) => DocUrl
  watch: <T>(url: DocUrl, cb: (val: Doc<T>, clock?: Clock, index?: number) => void) => Handle<T>
  doc: <T>(url: DocUrl, cb?: (val: Doc<T>, clock?: Clock) => void) => Promise<Doc<T>>
  merge: (url: DocUrl, target: DocUrl) => void
  change: <T>(url: DocUrl, fn: (state: Proxy<T>) => void) => void
  materialize: <T>(url: DocUrl, seq: number, cb: (val: Doc<T>) => void) => void
  meta: (url: DocUrl | HyperfileUrl, cb: (meta: PublicMetadata | undefined) => void) => void
  close: () => void

  constructor(opts: Options) {
    this.back = new RepoBackend(opts)
    this.front = new RepoFrontend()
    this.front.subscribe(this.back.receive)
    this.back.subscribe(this.front.receive)
    this.id = this.back.id
    this.create = this.front.create
    this.open = this.front.open
    this.message = this.front.message
    this.destroy = this.front.destroy
    this.meta = this.front.meta
    this.doc = this.front.doc
    this.fork = this.front.fork
    this.close = this.front.close
    this.change = this.front.change
    this.files = this.front.files
    this.watch = this.front.watch
    this.merge = this.front.merge
    this.setSwarm = this.back.setSwarm
    this.addSwarm = this.back.addSwarm
    this.removeSwarm = this.back.removeSwarm
    this.startFileServer = this.back.startFileServer
    this.materialize = this.front.materialize
    this.crypto = this.front.crypto
  }
}
