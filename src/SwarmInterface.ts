import { Socket } from 'net'

export { Socket }
export type SocketType = 'tcp' | 'utp' | 'cloud'

export interface Swarm {
  join(dk: Buffer, options?: JoinOptions): void
  leave(dk: Buffer): void
  on<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
  off<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
  destroy(cb: () => void): void
}

export interface SwarmEvents {
  connection(socket: Socket, details: ConnectionDetails): void
  peer(peer: PeerInfo): void
}

export interface JoinOptions {
  announce?: boolean
  lookup?: boolean
}

export interface BaseConnectionDetails {
  type: SocketType
  reconnect?(shouldReconnect: boolean): void
  ban?(): void
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
