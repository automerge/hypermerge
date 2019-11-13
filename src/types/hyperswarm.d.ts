declare module 'hyperswarm' {
  import { Socket } from 'net'

  export { Socket }
  export type SocketType = 'tcp' | 'utp'

  export interface Options {
    /** Optionally overwrite the default set of bootstrap servers */
    bootstrap?: string[]

    /**
     * Set to false if this is a long running instance on a server
     * When running in ephemeral mode (default) you don't join the
     * DHT but just query it instead.
     * Default: true
     */
    ephemeral?: boolean

    /** Total amount of peers that this peer will connect to. Default: 24 */
    maxPeers?: number

    /**
     * set to a number to restrict the amount of server socket based peer connections,
     * unrestricted by default. Setting to 0 is the same as Infinity, to disallow server
     * connections set to -1.
     * Default: Infinity
     */
    maxServerSockets?: number

    /**
     * set to a number to restrict the amount of client sockets based peer connections,
     * unrestricted by default.
     * Default: Infinity
     */
    maxClientSockets?: number

    /** configure peer management behaviour */
    queue?: {
      /**
       * an array of backoff times, in millieconds every time a failing peer connection is retried
       * it will wait for specified milliseconds based on the retry count, until it reaches the end
       * of the requeue array at which time the peer is considered unresponsive and retry attempts
       * cease.
       */
      requeue?: number[]

      /**
       * configure when to forget certain peer characteristics and treat them as fresh
       * peer connections again.
       */
      forget?: {
        /** how long to wait before forgetting that a peer has become unresponsive. Default: 7500 */
        unresponsive?: number

        /** how long to wait before fogetting that a peer has been banned. Default: Infinity */
        banned?: number

        /**
         * attempt to reuse existing connections between peers across multiple topics.
         * Default: false
         */
        multiplex?: boolean
      }
    }
  }

  export default class Hyperswarm {
    constructor(options?: Options)

    join(dk: Buffer, options?: JoinOptions): void
    leave(dk: Buffer): void
    on<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
    off<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
    removeAllListeners(): void
    destroy(cb: () => void): void
  }

  export interface SwarmEvents {
    connection(socket: Socket, details: ConnectionDetails): void
    disconnection(socket: Socket, details: ConnectionDetails): void
    peer(peer: PeerInfo): void
    updated(info: { key: Buffer }): void
    listening(): void
  }

  export interface JoinOptions {
    announce?: boolean
    lookup?: boolean
  }

  export interface BaseConnectionDetails {
    type: SocketType
    reconnect(shouldReconnect: boolean): void
    ban(): void
  }

  export interface InitiatedConnectionDetails extends BaseConnectionDetails {
    // Connection initiated by this node
    client: true
    peer: PeerInfo
  }

  export interface ReceivedConnectionDetails extends BaseConnectionDetails {
    // Connection not initiated by this node
    client: false
    peer: null
  }

  export type ConnectionDetails = InitiatedConnectionDetails | ReceivedConnectionDetails

  export interface PeerInfo {
    port: number
    host: string // IP of peer
    local: boolean // Is the peer on the LAN?
    topic?: Buffer // The identifier which this peer was discovered under.
    referrer: null | {
      // Info about the node that informed us of the peer.
      port: number
      host: string // IP of referrer
      id: Buffer
    }
  }
}
