import { Doc, ChangeFn } from "automerge/frontend"

export default class Handle<T> {
  value: Doc<T> | null = null
  subscription?: (item: Doc<T>, index?: number) => void
  private counter: number = 0

  constructor() {}

  push = (item: Doc<T>) => {
    this.value = item
    if (this.subscription) {
      this.subscription(item, this.counter++)
    }
  }

  once = (subscriber: (doc: Doc<T>) => void) => {
    this.subscribe((doc: Doc<T>) => {
      subscriber(doc)
      this.close()
    })
  }

  subscribe = (subscriber: (doc: Doc<T>, index?: number) => void) => {
    if (this.subscription) {
      throw new Error("only one subscriber for a doc handle")
    }

    this.subscription = subscriber

    if (this.value != null) {
      subscriber(this.value, this.counter++)
    }
  }

  close = () => {
    this.subscription = undefined
    this.value = null
    this.cleanup()
  }

  cleanup = () => {}

  change = (fn: ChangeFn<T>) => {}
}
