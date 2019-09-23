import { DiscoveryId, encodeDiscoveryId } from './Misc'
import * as Base58 from 'bs58'
import { Socket } from 'net'
import Queue from './Queue'

export type PeerId = DiscoveryId & { peerId: true }
type HypercoreProtocol = any
export type SocketType = 'tcp' | 'utp'

export interface SocketInfo {
  type: SocketType
  discoveryId: DiscoveryId
  isClient: boolean
}

export default class NetworkPeer {
  id: PeerId
  protocol: HypercoreProtocol
  connections: Map<SocketType, PeerConnection>

  constructor(id: PeerId) {
    this.id = id
    this.connections = new Map()
  }

  addSocket(socket: Socket, info: SocketInfo): PeerConnection | null {
    const { type, discoveryId } = info
    const existing = this.connections.get(type)
    if (existing && existing.isOpen) {
      existing.discoveryQ.push(discoveryId)
      socket.destroy()
      return null
    }

    const conn = new PeerConnection(this, socket, info)

    this.connections.set(type, conn)
    return conn
  }

  close(): void {
    for (const conn of this.connections.values()) {
      conn.close()
    }
  }
}

export class PeerConnection {
  discoveryQ: Queue<DiscoveryId>
  discoveryId: DiscoveryId
  isClient: boolean
  peer: NetworkPeer
  type: SocketType
  topic: Buffer
  socket: Socket

  constructor(peer: NetworkPeer, socket: Socket, info: SocketInfo) {
    this.peer = peer
    this.type = info.type
    this.isClient = info.isClient
    this.discoveryId = info.discoveryId
    this.topic = Base58.decode(info.discoveryId)
    this.socket = socket
    this.discoveryQ = new Queue()
    this.discoveryQ.push(info.discoveryId)
  }

  get isOpen() {
    return !!this.socket.destroyed
  }

  close(): void {
    this.socket.destroy()
  }
}

export function isPeerId(str: string): str is PeerId {
  return Base58.decode(str).length === 32
}

export function encodePeerId(buffer: Buffer): PeerId {
  return encodeDiscoveryId(buffer) as PeerId
}

export function decodePeerId(id: PeerId): Buffer {
  return Base58.decode(id)
}
