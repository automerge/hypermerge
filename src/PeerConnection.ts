import { Duplex } from 'stream'
import noise from 'noise-peer'
import Multiplex, { Channel } from './Multiplex'
import MessageBus from './MessageBus'
import pump from 'pump'
import uuid from 'uuid'
import { PrefixMatchPassThrough, InvalidPrefixError } from './StreamLogic'
import Heartbeat from './Heartbeat'

const VERSION_PREFIX = Buffer.from('hypermerge.v1')

export interface SocketInfo {
  type: string
  isClient: boolean
}

export default class PeerConnection {
  isClient: boolean
  type: SocketInfo['type']
  id?: string
  onClose?: () => void

  private heartbeat: Heartbeat
  private rawSocket: Duplex
  private multiplex: Multiplex
  private secureStream: Duplex
  private internalBus: MessageBus<Msg>

  constructor(rawSocket: Duplex, info: SocketInfo) {
    this.type = info.type
    this.isClient = info.isClient
    this.heartbeat = new Heartbeat(2000, {
      onBeat: () => this.internalBus.send({ type: 'Heartbeat' }),
      onTimeout: () => this.close(),
    }).start()

    this.rawSocket = rawSocket
    this.secureStream = noise(rawSocket, this.isClient)
    this.multiplex = new Multiplex()

    const prefixMatch = new PrefixMatchPassThrough(VERSION_PREFIX)
    this.secureStream.write(VERSION_PREFIX)

    pump(this.secureStream, prefixMatch, this.multiplex, this.secureStream, (err) => {
      if (err instanceof InvalidPrefixError) {
        this.closeOutdated(err)
      }
    })

    this.internalBus = this.openBus('PeerConnection', this.onMsg)

    if (this.isClient) {
      this.id = uuid()
      this.internalBus.send({ type: 'Id', id: this.id })
    }
  }

  get isOpen() {
    return this.rawSocket.writable
  }

  get isClosed() {
    return !this.isOpen
  }

  openBus<M>(name: string, subscriber?: (msg: M) => void): MessageBus<M> {
    return new MessageBus(this.openChannel(name), subscriber)
  }

  openChannel(name: string): Channel {
    if (this.isClosed) throw new Error('Connection is closed')

    return this.multiplex.openChannel(name)
  }

  close(): void {
    this.heartbeat.stop()
    this.rawSocket.destroy()
    this.onClose?.()
  }

  private onMsg = (msg: Msg) => {
    this.heartbeat.bump()

    switch (msg.type) {
      case 'Id':
        this.id = msg.id
        break
    }
  }

  private closeOutdated(err: InvalidPrefixError): void {
    const { remoteAddress, remotePort } = this.rawSocket as any
    const host = `${this.type}@${remoteAddress}:${remotePort}`
    console.log('Closing connection to outdated peer: %s. Prefix: %s', host, err.actual)
    return this.close()
  }
}

type Msg = IdMsg | HeartbeatMsg

interface IdMsg {
  type: 'Id'
  id: string
}

interface HeartbeatMsg {
  type: 'Heartbeat'
}
