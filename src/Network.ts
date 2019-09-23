import * as Base58 from 'bs58'
import { DiscoveryId, encodeDiscoveryId, getOrCreate } from './Misc'
import Peer, { PeerId, isPeerId, PeerConnection } from './NetworkPeer'
import { Swarm, JoinOptions, Socket, ConnectionDetails } from './SwarmInterface'
import { Readable, Writable } from 'stream'

export interface OnConnection {
  (connection: PeerConnection): void
}

export default class Network {
  selfId: PeerId
  joined: Map<DiscoveryId, OnConnection>
  pending: Map<DiscoveryId, OnConnection>
  peers: Map<PeerId, Peer>
  swarm?: Swarm
  joinOptions?: JoinOptions

  constructor(selfId: PeerId) {
    this.selfId = selfId
    this.joined = new Map()
    this.pending = new Map()
    this.peers = new Map()
  }

  join(discoveryId: DiscoveryId, onConnection: OnConnection): void {
    if (this.swarm) {
      if (this.joined.has(discoveryId)) return

      this.swarm.join(decodeId(discoveryId), this.joinOptions)
      this.joined.set(discoveryId, onConnection)
      this.pending.delete(discoveryId)
    } else {
      this.pending.set(discoveryId, onConnection)
    }
  }

  leave(discoveryId: DiscoveryId): void {
    this.pending.delete(discoveryId)
    if (!this.joined.has(discoveryId)) return

    if (this.swarm) this.swarm.leave(decodeId(discoveryId))
    this.joined.delete(discoveryId)
  }

  setSwarm(swarm: Swarm, joinOptions?: JoinOptions): void {
    if (this.swarm) throw new Error('Swarm already exists!')

    this.joinOptions = joinOptions
    this.swarm = swarm
    this.swarm.on('connection', this.onConnection)

    for (const [discoveryId, onConnection] of this.pending) {
      this.join(discoveryId, onConnection)
    }
  }

  getOrCreatePeer(peerId: PeerId): Peer {
    return getOrCreate(this.peers, peerId, () => new Peer(peerId))
  }

  close(): void {
    if (!this.swarm) return

    for (const peer of this.peers.values()) {
      peer.close()
    }

    this.swarm.removeAllListeners()
  }

  private onConnection = async (socket: Socket, details: ConnectionDetails) => {
    const localDiscoveryId = details.peer ? encodeDiscoveryId(details.peer.topic) : undefined

    try {
      await sendHeader(socket, {
        peerId: this.selfId,
        discoveryId: localDiscoveryId,
      })

      const { peerId, discoveryId = localDiscoveryId } = await parseHeader(socket)

      if (!discoveryId) throw new Error('discoveryId missing!')
      if (!isPeerId(peerId)) throw new Error(`Invalid PeerId: ${peerId}`)

      const onConnection = this.joined.get(discoveryId)

      if (!onConnection) throw new Error(`Connection with unexpected discoveryId: ${discoveryId}`)

      const conn = this.getOrCreatePeer(peerId).addSocket(socket, {
        type: details.type,
        discoveryId,
        isClient: details.client,
      })

      if (conn) onConnection(conn)
    } catch (e) {
      socket.destroy(e)
    }
  }
}

interface ConnectionHeader {
  peerId: PeerId
  discoveryId?: DiscoveryId
}

async function sendHeader(stream: Writable, header: ConnectionHeader): Promise<void> {
  return new Promise((res, rej) => {
    stream.write(`Header:${JSON.stringify(header)}\n\n`, 'utf8', (err) => {
      if (err) return rej(err)
      res()
    })
  })
}

async function parseHeader(stream: Readable): Promise<ConnectionHeader> {
  const [, str] = await matchStream(stream, /^Header:({.+})\n\n/m)
  return JSON.parse(str)
}

function matchStream(stream: Readable, regex: RegExp): Promise<RegExpMatchArray> {
  return new Promise((res, rej) => {
    stream.once('data', (chunk: Buffer) => {
      stream.pause()
      const match = chunk.toString('ascii').match(regex)
      if (match) {
        const len = match[0].length
        stream.unshift(chunk.slice(len))
        return res(match)
      }

      stream.unshift(chunk)
      rej(new Error('No match found in first chunk.'))
    })
  })
}

function decodeId(id: DiscoveryId): Buffer {
  return Base58.decode(id)
}
