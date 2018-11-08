
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


  constructor(opts: Options) {
    this.front = new RepoFrontend()
    this.back = new RepoBackend(opts)
    this.front.subscribe(this.back.receive)
    this.back.subscribe(this.front.receive)
    this.id = this.back.id
    this.stream = this.back.stream
  }

  create() : string {
    return this.front.create()
  }

  open<T>(id: string) : Handle<T> {
    return this.front.open(id)
  }

  replicate(swarm: Swarm) {
    return this.back.replicate(swarm)
  }
}
