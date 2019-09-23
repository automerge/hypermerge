import { Socket } from 'net'

export { Socket }
export type SocketType = 'tcp' | 'utp'

export interface Swarm {
  join(dk: Buffer, options?: JoinOptions): void
  leave(dk: Buffer): void
  on<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
  off<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
  removeAllListeners(): void
}

export interface SwarmEvents {
  connection(socket: Socket, details: ConnectionDetails): void
  disconnection(socket: Socket, details: ConnectionDetails): void
  peer(peer: PeerInfo): void
  updated(info: { key: Buffer }): void
}

export interface JoinOptions {
  announce?: boolean
  lookup?: boolean
}

export interface InitiatedConnectionDetails {
  // Connection initiated by this node
  type: SocketType
  client: true
  peer: PeerInfo
}

export interface ReceivedConnectionDetails {
  // Connection not initiated by this node
  type: SocketType
  client: false
  peer: null
}

export type ConnectionDetails = InitiatedConnectionDetails | ReceivedConnectionDetails

export interface PeerInfo {
  port: number
  host: string // IP of peer
  local: boolean // Is the peer on the LAN?
  topic: Buffer // The identifier which this peer was discovered under.
  referrer: null | {
    // Info about the node that informed us of the peer.
    port: number
    host: string // IP of referrer
    id: Buffer
  }
}
