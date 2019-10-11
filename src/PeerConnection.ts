import { Duplex } from 'stream'
import noise from 'noise-peer'
import multiplex, { MultiplexedStream, SubStream } from 'multiplex'
import MessageBus from './MessageBus'
import { NetworkMsg } from './NetworkMsg'
import pump from 'pump'

export interface SocketInfo {
  type: 'tcp' | 'utp'
  isClient: boolean
}

export default class PeerConnection {
  networkBus: MessageBus<NetworkMsg>
  isClient: boolean
  isConfirmed: boolean
  type: SocketInfo['type']

  pendingChannels: Map<string, SubStream>
  channels: Map<string, SubStream>

  private rawSocket: Duplex
  private multiplex: MultiplexedStream
  private secureStream: Duplex

  constructor(rawSocket: Duplex, info: SocketInfo) {
    this.isConfirmed = false
    this.channels = new Map()
    this.pendingChannels = new Map()
    this.type = info.type
    this.isClient = info.isClient
    this.rawSocket = rawSocket
    this.secureStream = noise(rawSocket, this.isClient)
    this.multiplex = multiplex()

    this.multiplex.on('stream', (stream: SubStream, name: string) => {
      this.pendingChannels.set(name, stream)
    })

    pump(this.secureStream, this.multiplex, this.secureStream)

    this.networkBus = new MessageBus<NetworkMsg>(this.openChannel('NetworkMsg'))
  }

  get isOpen() {
    return this.rawSocket.writable
  }

  get isClosed() {
    return !this.isOpen
  }

  openChannel(name: string): SubStream {
    if (this.isClosed) throw new Error('Connection is closed')

    if (this.channels.has(name))
      throw new Error(`Channel already exists on this connection: ${name}`)

    const channel = this.multiplex.createSharedStream(name)

    const pending = this.pendingChannels.get(name)

    if (pending) {
      this.pendingChannels.delete(name)

      // NOTE(jeff): So... this is a hack. When multiplex receives a stream that
      // we haven't opened, it's not writable. So, we use this hack to connect
      // the pending stream to our newly created channel.
      channel.setReadable(pending)
    }

    this.channels.set(name, channel)

    channel.once('close', () => this.channels.delete(name))

    return channel
  }

  async close(): Promise<void> {
    this.rawSocket.destroy()
  }
}
