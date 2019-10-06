import Debug from 'debug'

export default class Queue<T> {
  push: (item: T) => void
  name: string
  private queue: T[] = []
  private log: Debug.IDebugger
  private subscription?: (item: T) => void

  constructor(name: string = 'unknown') {
    this.name = name
    this.log = Debug(`queue:${name}`)
    this.push = this.enqueue
  }

  first(): Promise<T> {
    return new Promise((res) => {
      this.once(res)
    })
  }

  drain(fn: (item: T) => void): void {
    while (this.queue.length) {
      const item = this.queue.shift()
      if (item !== undefined) fn(item)
    }
  }

  once(subscriber: (item: T) => void) {
    if (this.subscription === undefined) {
      this.subscribe((item) => {
        this.unsubscribe()
        subscriber(item)
      })
    }
  }

  subscribe(subscriber: (item: T) => void) {
    if (this.subscription) {
      throw new Error(`${this.name}: only one subscriber at a time to a queue`)
    }

    this.log('subscribe')

    this.subscription = subscriber

    // this is so push(), unsubscribe(), re-subscribe() will processing the backlog

    while (this.subscription === subscriber) {
      const item = this.queue.shift()
      if (item === undefined) {
        this.push = subscriber
        break
      }
      subscriber(item)
    }
  }

  unsubscribe() {
    this.log('unsubscribe')
    this.subscription = undefined
    this.push = this.enqueue
  }

  get length() {
    return this.queue.length
  }

  private enqueue = (item: T) => {
    this.log('queued', item)
    this.queue.push(item)
  }
}
