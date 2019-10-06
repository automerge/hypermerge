import Queue from './Queue'
import * as JsonBuffer from './JsonBuffer'
import { Duplex } from 'stream'

export default class MessageChannel<Msg> {
  stream: Duplex
  sendQ: Queue<Msg>
  receiveQ: Queue<Msg>

  constructor(stream: Duplex) {
    this.stream = stream

    this.sendQ = new Queue('MessageBus:sendQ')
    this.receiveQ = new Queue('MessageBus:receiveQ')

    this.stream.on('data', this.onData)
    this.stream.once('close', () => this.close())
    this.stream.once('error', () => this.close())

    this.sendQ.subscribe((msg) => {
      this.stream.write(JsonBuffer.bufferify(msg))
    })
  }

  onData = (data: Buffer): void => {
    this.receiveQ.push(JsonBuffer.parse(data))
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
    this.sendQ.unsubscribe()
    this.receiveQ.unsubscribe()
    this.stream.end()
  }
}
