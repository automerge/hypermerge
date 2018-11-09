import { Doc, ChangeFn } from "automerge/frontend"

export default class Handle<T> {
  id: string = ""
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

  once = (subscriber: (doc: Doc<T>) => void) : this  => {
    this.subscribe((doc: Doc<T>) => {
      subscriber(doc)
      this.close()
    })
    return this
  }

  subscribe = (subscriber: (doc: Doc<T>, index?: number) => void) : this => {
    if (this.subscription) {
      throw new Error("only one subscriber for a doc handle")
    }

    this.subscription = subscriber

    if (this.value != null) {
      subscriber(this.value, this.counter++)
    }
    return this
  }

  close = () => {
    this.subscription = undefined
    this.value = null
    this.cleanup()
  }

  cleanup = () => {}

  changeFn = (fn: ChangeFn<T>) => {}

  change = (fn: ChangeFn<T>) : this => {
    this.changeFn(fn)
    return this
  }
}
