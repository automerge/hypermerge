import { Duplex } from 'stream'

export type SocketType = 'tcp' | 'utp' | 'cloud'

export interface Swarm {
  join(dk: Buffer, options?: JoinOptions): void
  leave(dk: Buffer): void
  on<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
  off<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this
  destroy(cb: () => void): void
}

export interface SwarmEvents {
  connection(socket: Duplex, details: ConnectionDetails): void
  peer(peer: PeerInfo): void
}

export interface JoinOptions {
  announce?: boolean
  lookup?: boolean
}

export interface ConnectionDetails {
  type: SocketType
  reconnect?(shouldReconnect: boolean): void
  ban?(): void
  client: boolean
  peer: PeerInfo | null
}

export interface PeerInfo {
  port: number
  host: string // IP of peer
  local: boolean // Is the peer on the LAN?
}
