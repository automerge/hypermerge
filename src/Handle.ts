import { Clock, Doc, ChangeFn } from "automerge/frontend"
import { RepoFrontend } from "./RepoFrontend"

export default class Handle<T> {
  id: string = ""
  state: Doc<T> | null = null
  clock: Clock | null = null
  subscription?: (item: Doc<T>, clock?: Clock, index?: number) => void
  private counter: number = 0
  private repo: RepoFrontend

  constructor( repo: RepoFrontend ) {
    this.repo = repo
  }

  fork() : string {
    if (this.clock === null) throw new Error("cant fork a handle without state")
    const id = this.repo.create()
    this.repo.merge(id, this.clock)
    return id
  } 

  merge(other: Handle<T>) : this {
    if (other.clock === null) throw new Error("cant merge a handle without state")
    this.repo.merge(this.id, other.clock)
    return this
  }

  branch() : string {
    const id = this.repo.create()
    this.repo.follow(id, this.id)
    return id
  }

  push = (item: Doc<T>, clock: Clock) => {
    this.state = item
    this.clock = clock
    if (this.subscription) {
      this.subscription(item, clock, this.counter++)
    }
  }

  once = (subscriber: (doc: Doc<T>, clock?: Clock, index?: number) => void) : this  => {
    this.subscribe((doc: Doc<T>, clock?: Clock, index?: number) => {
      subscriber(doc, clock, index)
      this.close()
    })
    return this
  }

  subscribe = (subscriber: (doc: Doc<T>, clock?: Clock, index?: number) => void) : this => {
    if (this.subscription) {
      throw new Error("only one subscriber for a doc handle")
    }

    this.subscription = subscriber

    if (this.state != null && this.clock != null) {
      subscriber(this.state, this.clock, this.counter++)
    }
    return this
  }

  close = () => {
    this.subscription = undefined
    this.state = null
    this.cleanup()
  }

  cleanup = () => {}

  changeFn = (fn: ChangeFn<T>) => {}

  change = (fn: ChangeFn<T>) : this => {
    this.changeFn(fn)
    return this
  }
}
