
import { Options, RepoBackend } from "./RepoBackend"
import { RepoFrontend } from "./RepoFrontend"
import Handle from "./Handle"

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
  create: () => string
  open: <T>(id: string) => Handle<T>
  replicate:  (swarm: Swarm) => void

  constructor(opts: Options) {
    this.front = new RepoFrontend()
    this.back = new RepoBackend(opts)
    this.front.subscribe(this.back.receive)
    this.back.subscribe(this.front.receive)
    this.id = this.back.id
    this.stream = this.back.stream
    this.create = this.front.create
    this.open = this.front.open
    this.replicate = this.back.replicate
  }
}
