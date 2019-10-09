declare module 'multiplex' {
  import { Duplex, Readable, Writable } from 'stream'

  const multiplex: Multiplex
  export default multiplex

  /**
   * A binary stream multiplexer. Stream multiple streams of binary data over a single binary stream.
   */
  interface Multiplex {
    (options?: Options, onStream?: (stream: Multiplex, id: string) => void): MultiplexedStream
  }

  export interface StreamOptions {
    /** Enables chunked mode on all streams (message framing not guaranteed) */
    chunked?: boolean

    /** Make channels support half open mode meaning that they can be readable but not writable and vice versa */
    halfOpen?: boolean //
  }

  /** Any other options set in options are used as defaults options when creating sub streams. */
  export interface Options extends StreamOptions {
    /** Set the max allowed message size. default is no maximum */
    limit?: number
  }

  export interface MultiplexedStream extends Duplex {
    /**
     * Create a shared stream. If both ends create a shared stream with the same
     * id, writing data on one end will emit the same data on the other end.
     */
    createSharedStream(id?: string, options?: StreamOptions): SharedSubStream

    /**
     * Creates a new sub-stream with an optional whole string id (default is the stream channel id).
     * Sub-streams are duplex streams.
     */
    createStream(id?: string, options?: StreamOptions): SubStream

    /**
     * Explicitly receive an incoming stream.
     * This is useful if you have a function that accepts an instance of multiplex and you want to receive a substream.
     */
    receiveStream(id: string, options?: StreamOptions): SubStream
  }

  export interface SubStream extends Duplex {}

  export interface SharedSubStream extends Duplex {
    setReadable(readable: Readable): void
    setWritable(writable: Writable): void
  }
}
