declare module 'hypercore-protocol' {
  import { Duplex } from 'stream'

  interface Handlers {
    onauthenticate?(remotePublicKey: Buffer, done: () => void): void // hook to verify the remotes public key
    onhandshake?(): void // function called when the stream handshake has finished
    ondiscoverykey?(discoveryKey: Buffer): void // function called when the remote stream opens a feed you have not
  }

  interface Options extends Handlers {
    encrypt?: boolean // set to false to disable encryption if you are already piping through a encrypted stream
    timeout?: number // stream timeout. set to 0 or false to disable.
    keyPair?: { publicKey: Buffer; secretKey: Buffer } // use this keypair for the stream authentication
  }

  interface ProtocolEvents {
    ['discovery-key'](discoveryKey: Buffer): void
    timeout(): void
  }

  export default class HypercoreProtocol extends Duplex {
    static isProtocolStream(stream: any): stream is HypercoreProtocol
    static keyPair(): { publicKey: Buffer; secretKey: Buffer }

    constructor(isInitiator: boolean, options?: Options)

    on<K extends keyof ProtocolEvents>(name: K, cb: ProtocolEvents[K]): this
    off<K extends keyof ProtocolEvents>(name: K, cb: ProtocolEvents[K]): this

    setTimeout(ms: number, onTimeout: () => void): void
    setKeepAlive(ms: number): void

    open(feedKey: Buffer, handlers: Handlers): Channel
  }

  export interface Channel {}
}
