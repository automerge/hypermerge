import { Socket } from 'net'
import { Duplex } from 'stream'
import noise from 'noise-peer'
import multiplex, { MultiplexedStream, SubStream } from 'multiplex'
import MessageChannel from './MessageChannel'
import { NetworkMsg } from './NetworkMsg'

export interface SocketInfo {
  type: 'tcp' | 'utp'
  isClient: boolean
}

export default class PeerConnection {
  networkChannel: MessageChannel<NetworkMsg>
  isClient: boolean
  isConfirmed: boolean
  type: SocketInfo['type']

  private channels: Map<string, SubStream>
  private rawSocket: Socket
  private multiplex: MultiplexedStream
  private secureStream: Duplex

  constructor(rawSocket: Socket, info: SocketInfo) {
    this.isConfirmed = false
    this.channels = new Map()
    this.type = info.type
    this.isClient = info.isClient
    this.rawSocket = rawSocket
    this.secureStream = noise(rawSocket, this.isClient)
    this.multiplex = multiplex()

    this.multiplex.on('stream', (_stream: unknown, id: string) => {
      console.log('new stream', id)
    })
    // this.rawSocket.once('close', () => this.close())
    // this.multiplex.once('close', () => this.close())
    // this.secureStream.once('close', () => this.close())

    this.secureStream.pipe(this.multiplex).pipe(this.secureStream)

    this.networkChannel = new MessageChannel<NetworkMsg>(this.openChannel('NetworkMsg'))
  }

  get isOpen() {
    return !this.isClosed
  }

  get isClosed() {
    return this.rawSocket.destroyed
  }

  openChannel(name: string): SubStream {
    if (this.isClosed) throw new Error('Connection is closed')

    if (this.channels.has(name))
      throw new Error(`Channel already exists on this connection: ${name}`)

    // NOTE(jeff): Seems to me that this should be createSharedStream(), but it doesn't always work.
    const channel = this.isClient
      ? this.multiplex.receiveStream(name)
      : this.multiplex.createStream(name)
    this.channels.set(name, channel)
    channel.once('close', () => this.channels.delete(name))

    return channel
  }

  async close(): Promise<void> {
    await Promise.all(
      [...this.channels.values()].map(
        (channel) =>
          new Promise((res) => {
            channel.end(() => {
              res()
            })
          })
      )
    )

    return new Promise((res) => {
      this.multiplex.end(() => {
        this.secureStream.end(() => {
          // this.rawSocket.destroy()
          res()
        })
      })
    })
  }
}
