import { Doc, ChangeFn } from "automerge/frontend"
import { DocFrontend } from "./DocFrontend";

export default class Handle<T> {
  value: Doc<T> | null = null
  front: DocFrontend<T>
  subscription?: (item: Doc<T>, index?: number) => void
  private counter: number = 0

  constructor(front: DocFrontend<T>) {
    this.front = front
  }

  get id() {
    return this.front.docId
  }

  push = (item: Doc<T>) => {
    this.value = item
    if (this.subscription) {
      this.subscription(item, this.counter++)
    }
  }

  once = (subscriber: (doc: Doc<T>) => void): this => {
    this.subscribe((doc: Doc<T>) => {
      subscriber(doc)
      this.close()
    })
    return this
  }

  subscribe = (subscriber: (doc: Doc<T>, index?: number) => void): this => {
    if (this.subscription) {
      throw new Error("only one subscriber for a doc handle")
    }

    this.subscription = subscriber

    if (this.value != null) {
      subscriber(this.value, this.counter++)
    }
    return this
  }

  close = (): void => {
    this.subscription = undefined
    this.value = null
    this.front.releaseHandle(this)
  }

  change = (fn: ChangeFn<T>): this => {
    this.front.change(fn)
    return this
  }
}
