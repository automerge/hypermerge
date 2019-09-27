import { DiscoveryId, encodeDiscoveryId } from './Misc'
import * as Base58 from 'bs58'
import { Socket } from 'net'
import Queue from './Queue'
import { ConnectionDetails } from './SwarmInterface'
import HypercoreProtocol from 'hypercore-protocol'
import { discoveryKey } from './hypercore'
import * as JsonBuffer from './JsonBuffer'

export type PeerId = DiscoveryId & { peerId: true }
export type SocketType = 'tcp' | 'utp'

export interface SocketInfo {
  type: SocketType
  selfId: PeerId
  peerId: PeerId
  isClient: boolean
}

export interface InfoMsg {
  type: 'Info'
  peerId: PeerId
}

export default class NetworkPeer<Msg> {
  selfId: PeerId
  id: PeerId
  connection?: PeerConnection<Msg>

  constructor(selfId: PeerId, id: PeerId) {
    this.selfId = selfId
    this.id = id
  }

  get isConnected(): boolean {
    if (!this.connection) return false
    return this.connection.isOpen
  }

  /**
   * Attempts to add a connection to this peer.
   * If this connection is a duplicate of an existing connection, we close it
   * and return `false`.
   */
  addConnection(conn: PeerConnection<Msg>): boolean {
    const existing = this.connection

    if (existing) {
      if (!this.shouldUseNewConnection(existing, conn)) {
        existing.addDiscoveryIds(conn.discoveryIds)
        conn.close()
        return false
      }

      conn.addDiscoveryIds(existing.discoveryIds)
      existing.close()
    }

    this.connection = conn

    return true
  }

  shouldUseNewConnection(existing: PeerConnection<Msg>, other: PeerConnection<Msg>): boolean {
    if (existing.isClosed) return true
    if (existing.type === 'utp' && other.type === 'tcp') return true

    // We need to ensure that two peers don't close the other's incoming
    // connection. Comparing the initiator's id ensures both peers keep
    // the same connection.
    return existing.initiatorId > other.initiatorId
  }

  close(): void {
    if (this.connection) this.connection.close()
  }
}

export class PeerConnection<Msg> {
  isClient: boolean
  selfId: PeerId
  peerId: PeerId
  type: SocketType

  socket: Socket
  protocol: HypercoreProtocol
  networkMessages: MessageBus<InfoMsg>
  messages: MessageBus<Msg>

  discoveryIds: Set<DiscoveryId>
  discoveryQ: Queue<DiscoveryId>

  static async fromSocket<Msg>(
    socket: Socket,
    selfId: PeerId,
    details: ConnectionDetails
  ): Promise<PeerConnection<Msg>> {
    details.reconnect(false)

    const protocol = new HypercoreProtocol(details.client, {
      encrypt: true,
      timeout: 10000,
    })

    socket.pipe(protocol).pipe(socket)

    const networkBus = new MessageBus<InfoMsg>(protocol, NETWORK_MESSAGE_BUS_KEY)

    networkBus.send({
      type: 'Info',
      peerId: selfId,
    })

    const info = await networkBus.receiveQ.first()

    if (info.type !== 'Info') throw new Error('First message must be InfoMsg.')

    const { peerId } = info

    const conn = new PeerConnection<Msg>(socket, networkBus, {
      type: details.type,
      peerId,
      selfId,
      isClient: details.client,
    })

    if (details.peer) {
      conn.addDiscoveryId(encodeDiscoveryId(details.peer.topic))
    }

    return conn
  }

  constructor(socket: Socket, networkMessages: MessageBus<InfoMsg>, info: SocketInfo) {
    this.selfId = info.selfId
    this.peerId = info.peerId
    this.type = info.type
    this.isClient = info.isClient
    this.protocol = networkMessages.protocol
    this.networkMessages = networkMessages // For messages internal to Network
    this.messages = new MessageBus<Msg>(this.protocol, GENERIC_MESSAGE_BUS_KEY)
    this.socket = socket
    this.discoveryIds = new Set()
    this.discoveryQ = new Queue('PeerConnection:discoveryQ')

    this.protocol.on('discovery-key', (dk: Buffer) => {
      const discoveryId = encodeDiscoveryId(dk)
      if (discoveryId === this.messages.discoveryId) return
      this.addDiscoveryId(discoveryId)
    })
  }

  get isOpen() {
    return !this.isClosed
  }

  get isClosed() {
    return this.socket.destroyed
  }

  get initiatorId(): PeerId {
    return this.isClient ? this.peerId : this.selfId
  }

  addDiscoveryIds(ids: Iterable<DiscoveryId>): void {
    for (const id of ids) {
      this.addDiscoveryId(id)
    }
  }

  addDiscoveryId(discoveryId: DiscoveryId): void {
    if (this.discoveryIds.has(discoveryId)) return

    this.discoveryIds.add(discoveryId)
    this.discoveryQ.push(discoveryId)
  }

  close(): void {
    this.protocol.finalize()
    // this.socket.destroy()
  }
}

export const NETWORK_MESSAGE_BUS_KEY = Buffer.alloc(32, 1)
export const GENERIC_MESSAGE_BUS_KEY = Buffer.alloc(32, 2)

export class MessageBus<Msg> {
  key: Buffer
  discoveryId: DiscoveryId
  protocol: HypercoreProtocol
  channel: any // HypercoreProtocol.Channel
  sendQ: Queue<Msg>
  receiveQ: Queue<Msg>

  constructor(protocol: HypercoreProtocol, key: Buffer) {
    this.key = key
    this.discoveryId = encodeDiscoveryId(discoveryKey(key))
    this.sendQ = new Queue('MessageBus:sendQ')
    this.receiveQ = new Queue('MessageBus:receiveQ')
    this.protocol = protocol
    this.channel = protocol.open(this.key, {
      onextension: (_ext: 0, data: Buffer) => {
        this.receiveQ.push(JsonBuffer.parse(data))
      },
    })

    this.channel.options({
      extensions: ['hypermerge-message-bus'],
      ack: false,
    })

    this.sendQ.subscribe((msg) => {
      this.channel.extension(0, JsonBuffer.bufferify(msg))
    })
  }

  send(msg: Msg): void {
    this.sendQ.push(msg)
  }

  subscribe(onMsg: (msg: Msg) => void): void {
    this.receiveQ.subscribe(onMsg)
  }

  unsubscribe(): void {
    this.receiveQ.unsubscribe()
  }

  close(): void {
    this.protocol.close(this.key)
    this.receiveQ.unsubscribe()
    this.sendQ.unsubscribe()
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
