import { Duplex } from 'stream'
import noise from 'noise-peer'
import Multiplex, { Channel } from './Multiplex'
import MessageBus from './MessageBus'
import { NetworkMsg } from './NetworkMsg'
import pump from 'pump'

export interface SocketInfo {
  type: 'tcp' | 'utp'
  isClient: boolean
  onClose?(): void
}

export default class PeerConnection {
  networkBus: MessageBus<NetworkMsg>
  isClient: boolean
  isConfirmed: boolean
  type: SocketInfo['type']

  private rawSocket: Duplex
  private multiplex: Multiplex
  private secureStream: Duplex
  private onClose?: () => void

  constructor(rawSocket: Duplex, info: SocketInfo) {
    this.isConfirmed = false
    this.type = info.type
    this.onClose = info.onClose
    this.isClient = info.isClient
    this.rawSocket = rawSocket
    this.secureStream = noise(rawSocket, this.isClient)
    this.multiplex = new Multiplex()

    pump(this.secureStream, this.multiplex, this.secureStream)

    this.networkBus = new MessageBus<NetworkMsg>(this.openChannel('NetworkMsg'))
  }

  get isOpen() {
    return this.rawSocket.writable
  }

  get isClosed() {
    return !this.isOpen
  }

  openChannel(name: string): Channel {
    if (this.isClosed) throw new Error('Connection is closed')

    return this.multiplex.openChannel(name)
  }

  async close(): Promise<void> {
    this.onClose && this.onClose()
    this.rawSocket.destroy()
  }
}
