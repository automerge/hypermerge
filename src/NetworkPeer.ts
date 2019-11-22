import { RepoId, encodeRepoId } from './Misc'
import PeerConnection from './PeerConnection'
import Queue from './Queue'
import * as Keys from './Keys'
import WeakCache from './WeakCache'
import MessageBus from './MessageBus'

export type PeerId = RepoId & { __peerId: true }

export type Msg = ConfirmConnectionMsg

export interface ConfirmConnectionMsg {
  type: 'ConfirmConnection'
}

export default class NetworkPeer {
  selfId: PeerId
  id: PeerId
  pendingConnections: Set<PeerConnection>
  connectionQ: Queue<PeerConnection>
  closedConnectionCount: number
  busCache: WeakCache<PeerConnection, MessageBus<Msg>>
  isClosing: boolean

  connection?: PeerConnection

  constructor(selfId: PeerId, id: PeerId) {
    this.isClosing = false
    this.closedConnectionCount = 0
    this.pendingConnections = new Set()
    this.connectionQ = new Queue('NetworkPeer:connectionQ')
    this.selfId = selfId
    this.id = id
    this.busCache = new WeakCache((conn) => conn.openBus('NetworkPeer', this.onMsg(conn)))
  }

  get isConnected(): boolean {
    return this.connection?.isOpen ?? false
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
   * hold onto it and wait for a ConfirmConnection message.
   */
  addConnection(conn: PeerConnection): void {
    if (this.isClosing) return conn.close('shutdown')

    this.pendingConnections.add(conn)
    this.busCache.getOrCreate(conn)

    conn.onClose = () => this.onConnectionClosed(conn)

    if (this.isConnected) return

    if (this.weHaveAuthority) {
      this.confirmConnection(conn)
      return
    }
  }

  pickNewConnection(): void {
    if (this.isClosing) return
    if (!this.weHaveAuthority) return

    for (const conn of this.pendingConnections) {
      if (conn.isOpen) {
        this.confirmConnection(conn)
        break
      }
    }
  }

  confirmConnection(conn: PeerConnection): void {
    if (this.weHaveAuthority) this.send(conn, { type: 'ConfirmConnection' })

    this.connection = conn
    this.pendingConnections.delete(conn)
    this.connectionQ.push(conn)
  }

  closeConnection(conn: PeerConnection): void {
    this.closedConnectionCount += 1
    conn.close('shutdown')
  }

  close(): void {
    this.isClosing = true
    if (this.connection) this.closeConnection(this.connection)

    for (const pendingConn of this.pendingConnections) {
      this.closeConnection(pendingConn)
    }
  }

  private send(conn: PeerConnection, msg: Msg): void {
    this.busCache.getOrCreate(conn).send(msg)
  }

  private onMsg = (conn: PeerConnection) => (msg: ConfirmConnectionMsg) => {
    if (msg.type === 'ConfirmConnection') {
      this.confirmConnection(conn)
    }
  }

  private onConnectionClosed = (conn: PeerConnection) => {
    this.pendingConnections.delete(conn)

    if (conn === this.connection) {
      delete this.connection
      this.pickNewConnection()
    }
  }
}

export function encodePeerId(key: Keys.PublicKey): PeerId {
  return encodeRepoId(key) as PeerId
}

export function decodePeerId(id: PeerId): Keys.PublicKey {
  return Keys.decode(id)
}
