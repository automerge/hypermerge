declare module 'streamx' {
  export interface ReadableOptions {
    highWaterMark?: number
  }

  export class Readable extends NodeJS.EventEmitter implements NodeJS.ReadableStream {
    static isBackpressured(readable: Readable): boolean

    [Symbol.asyncIterator]: () => AsyncIterableIterator<string | Buffer>
    readable: boolean
    destroyed: boolean
    constructor(options?: ReadableOptions)

    // HACK: fake values to support NodeJS.ReadableStream
    setEncoding(encoding: string): this
    isPaused(): boolean
    unpipe(destination: NodeJS.WritableStream | undefined): this
    wrap(oldStream: NodeJS.ReadableStream): this

    _read(cb: () => void): void
    _open(cb: () => void): void
    _destroy(cb: () => void): void
    _predestroy?(cb: () => void): void

    /**
     * Push new data to the stream. Returns true if the buffer is not full and you should push more
     * data if you can.
     *
     * If you call rs.push(null) you signal to the stream that no more data will be pushed and
     * that you want to end the stream.
     */
    push(data: Buffer | null): boolean

    /**
     * Read a piece of data from the stream buffer. If the buffer is currently empty null will be
     * returned and you should wait for readable to be emitted before trying again. If the stream
     * has been ended it will also return null.
     *
     * Note that this method differs from Node.js streams in that it does not accept an optional
     * amounts of bytes to consume.
     */
    read(): Buffer | string
    unshift(data: Buffer | string): void
    destroy(error?: Error): void
    pause(): this
    resume(): this
    pipe<T extends NodeJS.WritableStream>(writableStream: T): T

    on(event: 'readable', listener: () => void): this
    on(event: 'data', listener: (data: Buffer) => void): this
    on(event: 'end', listener: () => void): this
    on(event: 'close', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this

    off(event: 'readable', listener: () => void): this
    off(event: 'data', listener: (data: Buffer) => void): this
    off(event: 'end', listener: () => void): this
    off(event: 'close', listener: () => void): this
    off(event: 'error', listener: (err: Error) => void): this
  }

  export interface WritableOptions {
    highWaterMark?: number
    mapWritable?: (value: any) => Buffer
  }

  export class Writable extends NodeJS.EventEmitter implements NodeJS.WritableStream {
    static isBackpressured(writable: Writable): boolean

    writable: boolean
    destroyed: boolean
    constructor(options?: WritableOptions)

    _write(data: Buffer, cb: () => void): void
    _writev(datas: Buffer[], cb: () => void): void
    _open(cb: () => void): void
    _destroy(cb: () => void): void
    _predestroy(cb: () => void): void
    _final(cb: () => void): void

    write(data: Buffer | string): boolean
    destroy(error?: Error): void
    end(): void

    on(event: 'finish', listener: () => void): this
    on(event: 'close', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this

    off(event: 'finish', listener: () => void): this
    off(event: 'close', listener: () => void): this
    off(event: 'error', listener: (err: Error) => void): this
  }

  interface DuplexOptions extends ReadableOptions, WritableOptions {}

  export class Duplex extends Readable implements Writable, NodeJS.ReadWriteStream {
    static isBackpressured(stream: Writable | Readable | Duplex): boolean

    writable: boolean
    destroyed: boolean
    constructor(options?: DuplexOptions)

    _write(data: Buffer, cb: () => void): void
    _writev(datas: Buffer[], cb: () => void): void
    _open(cb: () => void): void
    _destroy(cb: () => void): void
    _predestroy(cb: () => void): void
    _final(cb: () => void): void

    write(data: Buffer | string): boolean
    destroy(error?: Error): void
    end(): void

    on(event: 'readable', listener: () => void): this
    on(event: 'data', listener: (data: Buffer) => void): this
    on(event: 'end', listener: () => void): this

    on(event: 'finish', listener: () => void): this
    on(event: 'close', listener: () => void): this
    on(event: 'error', listener: (err: Error) => void): this

    off(event: 'readable', listener: () => void): this
    off(event: 'data', listener: (data: Buffer) => void): this
    off(event: 'end', listener: () => void): this

    off(event: 'finish', listener: () => void): this
    off(event: 'close', listener: () => void): this
    off(event: 'error', listener: (err: Error) => void): this
  }

  export class Transform extends Duplex {
    _transform(data: Buffer, cb: () => void): void
  }
}
