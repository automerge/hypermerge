import { RepoId, encodeRepoId } from './Misc'
import * as Base58 from 'bs58'
import PeerConnection from './PeerConnection'
import Queue from './Queue'

export type PeerId = RepoId & { peerId: true }

export default class NetworkPeer {
  selfId: PeerId
  id: PeerId
  pendingConnections: Set<PeerConnection>
  connectionQ: Queue<PeerConnection>
  closedConnectionCount: number

  // A peer always has a connection once it's emitted out of Network.
  // TODO(jeff): Find a less lazy way to type this that isn't annoying.
  connection!: PeerConnection

  constructor(selfId: PeerId, id: PeerId) {
    this.closedConnectionCount = 0
    this.pendingConnections = new Set()
    this.connectionQ = new Queue('NetworkPeer:connectionQ')
    this.selfId = selfId
    this.id = id
  }

  get isConnected(): boolean {
    if (!this.connection) return false
    return this.connection.isOpen && this.connection.isConfirmed
  }

  /**
   * Determines if we are the authority on which connection to use when
   * duplicate connections are created.
   *
   * @remarks
   * We need to ensure that two peers don't close the other's incoming
   * connection. Comparing our ids ensures only one of the two peers decides
   * which connection to close.
   */
  get weHaveAuthority(): boolean {
    return this.selfId > this.id
  }

  /**
   * Attempts to add a connection to this peer.
   * If this connection is a duplicate of an existing connection, we close it.
   * If we aren't the authority, and we don't have a confirmed connection, we
   * add hold onto it and wait for a ConfirmConnection message.
   */
  addConnection(conn: PeerConnection): void {
    if (this.isConnected) {
      this.closeConnection(conn)
      return
    }

    if (this.weHaveAuthority) {
      conn.networkChannel.send({ type: 'ConfirmConnection' })
      this.confirmConnection(conn)
      return
    }

    this.pendingConnections.add(conn)

    conn.networkChannel.subscribe((msg) => {
      if (msg.type === 'ConfirmConnection') {
        this.confirmConnection(conn)
      }
    })
  }

  confirmConnection(conn: PeerConnection): void {
    conn.isConfirmed = true
    this.connection = conn
    this.pendingConnections.delete(conn)

    for (const pendingConn of this.pendingConnections) {
      this.closeConnection(pendingConn)
    }

    this.pendingConnections.clear()

    this.connectionQ.push(conn)
  }

  closeConnection(conn: PeerConnection): void {
    conn.close()
    this.closedConnectionCount += 1
  }

  close(): void {
    this.connection && this.closeConnection(this.connection)

    for (const pendingConn of this.pendingConnections) {
      this.closeConnection(pendingConn)
    }
  }
}

export function isPeerId(str: string): str is PeerId {
  return Base58.decode(str).length === 32
}

export function encodePeerId(buffer: Buffer): PeerId {
  return encodeRepoId(buffer) as PeerId
}

export function decodePeerId(id: PeerId): Buffer {
  return Base58.decode(id)
}
