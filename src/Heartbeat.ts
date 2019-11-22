export interface Handlers {
  onBeat: () => void
  onTimeout: () => void
}

export default class Heartbeat {
  interval: Interval
  timeout: Timeout
  beating: boolean

  constructor(public ms: number, { onBeat, onTimeout }: Handlers) {
    this.beating = false
    this.interval = new Interval(ms, onBeat)
    this.timeout = new Timeout(ms * 10, () => {
      this.stop()
      onTimeout()
    })
  }

  start(): this {
    if (this.beating) return this

    this.interval.start()
    this.timeout.start()
    this.beating = true

    return this
  }

  stop(): this {
    if (!this.beating) return this

    this.interval.stop()
    this.timeout.stop()
    this.beating = false

    return this
  }

  bump() {
    if (!this.beating) return

    this.timeout.bump()
  }
}

export class Interval {
  constructor(public ms: number, public onInterval: () => void) {}

  start() {
    this.stop()
    const id = setInterval(() => {
      this.onInterval()
    }, this.ms)

    this.stop = () => {
      clearInterval(id)
      delete this.stop
    }
  }

  stop() {}
}

export class Timeout {
  constructor(public ms: number, public onTimeout: () => void) {}

  start() {
    this.bump()
  }

  stop() {}

  bump() {
    this.stop()

    const id = setTimeout(() => {
      delete this.stop
      this.stop()
      this.onTimeout()
    }, this.ms)

    this.stop = () => {
      delete this.stop
      clearTimeout(id)
    }
  }
}
