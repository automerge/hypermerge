declare module 'hypercore-protocol' {
  import { Duplex } from 'stream'

  interface Handlers {
    /** hook to verify the remotes public key */
    onauthenticate?(remotePublicKey: Buffer, done: () => void): void

    /** function called when the stream handshake has finished */
    onhandshake?(): void

    /** function called when the remote stream opens a feed you have not */
    ondiscoverykey?(discoveryKey: Buffer): void
  }

  interface Options extends Handlers {
    /** set to false to disable encryption if you are already piping through a encrypted stream */
    encrypt?: boolean

    /** stream timeout. set to 0 or false to disable. */
    timeout?: number

    /** use this keypair for the stream authentication */
    keyPair?: { publicKey: Buffer; secretKey: Buffer }
  }

  interface ProtocolEvents {
    /**
     * Emitted when the remote opens a feed you have not opened.
     * Also calls `stream.handlers.ondiscoverykey(discoveryKey)`
     */
    ['discovery-key'](discoveryKey: Buffer): void

    /**
     * Emitted when the stream times out. Per default a timeout triggers a
     * destruction of the stream, unless you disable timeout handling in the
     * constructor.
     */
    timeout(): void

    // Stream events
    close(): void
    error(err: Error): void

    // Readable events
    data(chunk: any): void
    end(): void
    readable(): void

    // Writable events
    drain(): void
    finish(): void
    pipe(src: Readable): void
    unpipe(src: Readable): void
  }

  /**
   * Stream that implements the hypercore protocol
   */
  export default class HypercoreProtocol extends Duplex {
    static isProtocolStream(stream: any): stream is HypercoreProtocol
    static keyPair(): { publicKey: Buffer; secretKey: Buffer }

    /** Create a new protocol duplex stream. */
    constructor(isInitiator: boolean, options?: Options)

    on<K extends keyof ProtocolEvents>(name: K, cb: ProtocolEvents[K]): this
    off<K extends keyof ProtocolEvents>(name: K, cb: ProtocolEvents[K]): this

    /** Set a stream timeout. */
    setTimeout(ms: number, onTimeout: () => void): void

    /**
     * Send a keep alive ping every ms, if no other message has been sent. This
     * is enabled per default every timeout / 2 ms unless you disable timeout
     * handling in the constructor.
     */
    setKeepAlive(ms: number): void

    /**
     * Returns true if the remote sent a valid capability for the key when they
     * opened the channel. Use this in ondiscoverykey to check that the remote
     * has the key corresponding to the discovery key.
     */
    remoteVerified(feedKey: Buffer): boolean

    /**
     * Signal the other end that you want to share a hypercore feed.
     *
     * The feed key will be hashed and sent as the "discovery key" which
     * protects the feed key from being learned by a remote peer who does not
     * already possess it. Also includes a cryptographic proof that the local
     * possesses the feed key, which can be implicitly verified using the above
     * remoteVerified api.
     */
    open(feedKey: Buffer, handlers: Handlers): Channel

    /**
     * You can call this method to signal to the other side that you do not
     * have the key corresponding to the discoveryKey. Normally you would use
     * this together with the ondiscoverykey hook.
     */
    close(discoveryKey: Buffer): void
  }

  export interface Channel {}
}
