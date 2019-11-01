import { Duplex } from 'streamx'
import SMC from 'simple-message-channels'
import { getOrCreate } from './Misc'

export enum MsgType {
  /**
   * Send our localId -> name mapping to the other side.
   *
   * Message body should be the utf-8 channel name.
   */
  Start = 0,

  /**
   * Send a chunk of data.
   *
   * Message body is a Buffer.
   */
  Data = 1,

  /**
   * Signal to the other side that we won't be sending any more data.
   *
   * Message body is an empty Buffer.
   *
   * If `End` is received before we have opened the same channel locally, we call .end()
   * automatically.
   */
  End = 2,

  /**
   * Signal to the other side that we are completely closing this channel and will not read or
   * write any more data.
   *
   * Message body is an empty Buffer.
   *
   */
  Destroy = 3,
}

type RemoteId = number & { __remoteChannelId: true }
type LocalId = number & { __localChannelId: true }

/**
 * Allows many Duplex streams to be sent over a single Duplex.
 */
export default class Multiplex extends Duplex {
  /** Which channels the remote Multiplex has opened. */
  remoteChannels: Map<RemoteId, Channel>

  /**
   * Map of channels by name. Are currently open locally, remotely, or both.
   */
  channels: Map<string, Channel>

  /**
   * Which channels have been explicitly opened locally. Used to ensure that each channel is
   * only opened once.
   */
  opened: Set<string>

  private nextId: LocalId
  private smc: SMC

  constructor() {
    super()
    this.smc = new SMC({
      onmessage: this.onReceivedMsg,
    })
    this.nextId = 0 as LocalId
    this.remoteChannels = new Map()
    this.channels = new Map()
    this.opened = new Set()
  }

  isOpen(name: string): boolean {
    return this.opened.has(name)
  }

  /**
   * Open a new `Channel`. Every channel has a `name`, local `id`, and an associated [[RemoteId]].
   */
  openChannel(name: string): Channel {
    if (this.destroyed) throw new Error(`Multiplex is destroyed. Cannot open channel '${name}'.`)
    if (this.isOpen(name)) throw new Error(`Channel '${name}' is already open.`)
    this.opened.add(name)
    return this.getOrCreateChannel(name)
  }

  async close(): Promise<void> {
    const channels = Array.from(this.channels.values())
    await Promise.all(channels.map((ch) => ch.close()))
    await new Promise((res) => {
      this.once('finish', () => res())
      this.end()
    })
  }

  /**
   * Called when the Readable half is requesting data.
   *
   * No need to do anything here; data is pushed in by [[sendMsg]].
   */
  _read(cb: () => void) {
    cb()
  }

  _write(chunk: Buffer, cb: (err?: Error) => void) {
    if (this.smc.recv(chunk)) {
      cb()
    } else {
      cb(this.smc.error)
    }
  }

  _destroy(cb: () => void): void {
    for (const channel of this.channels.values()) {
      channel.destroy()
    }
    this.channels.clear()
    this.remoteChannels.clear()
    this.opened.clear()
    cb()
  }

  /**
   * Called by [[Channel]] to send a msg to the remote end.
   */
  private sendMsg(localId: LocalId, name: string, type: MsgType, body: Buffer): void {
    switch (type) {
      case MsgType.Destroy:
        this.channels.delete(name)
        this.opened.delete(name)
        break
    }

    const frame = this.smc.send(localId, type, body)
    this.push(frame)
  }

  /**
   * Called when a remote frame is decoded by SMC.
   */
  private onReceivedMsg = (remoteId: RemoteId, type: MsgType, data: Buffer) => {
    switch (type) {
      case MsgType.Start: {
        const name = data.toString()
        const channel = this.getOrCreateChannel(name)
        this.remoteChannels.set(remoteId, channel)
        break
      }

      case MsgType.Data:
        this.getChannelByRemoteId(remoteId).push(data)
        break

      case MsgType.End: {
        const channel = this.getChannelByRemoteId(remoteId)
        channel.push(null)
        if (!this.isOpen(channel.name)) channel.destroy()
        break
      }

      case MsgType.Destroy: {
        const channel = this.getChannelByRemoteId(remoteId)
        this.remoteChannels.delete(remoteId)
        channel.destroy()
        break
      }

      default:
        throw new Error(`Unknown MsgType: ${type} channelId: ${remoteId}`)
    }
  }

  private getChannelByRemoteId(id: RemoteId): Channel {
    const channel = this.remoteChannels.get(id)
    if (!channel) throw new Error(`Unknown remote channelId: ${id}`)
    return channel
  }

  private getOrCreateChannel(name: string): Channel {
    return getOrCreate(this.channels, name, () => {
      const id = this.getNextId()
      return new Channel(name, id, (type, msg) => this.sendMsg(id, name, type, msg))
    })
  }

  private getNextId(): LocalId {
    return this.nextId++ as LocalId
  }
}

export class Channel extends Duplex {
  name: string
  id: LocalId

  private send: (type: MsgType, body: Buffer) => void

  constructor(name: string, id: LocalId, send: (type: MsgType, body: Buffer) => void) {
    super({
      highWaterMark: 0,
      mapWritable: (data: Buffer | string) => (typeof data === 'string' ? Buffer.from(data) : data),
    })
    this.name = name
    this.id = id
    this.send = send
    this.send(MsgType.Start, Buffer.from(this.name))
  }

  /**
   * Calls .end() and returns a promise that resolves when the channel is fully closed. Channels
   * are fully closed when both sides have called .end()
   */
  close(): Promise<void> {
    return new Promise((res) => {
      this.once('close', () => res()).end()
    })
  }

  _open(cb: () => void) {
    cb()
  }

  /**
   * From Readable.
   *
   * Called when the Readable half of this channel is requesting more data.
   * We have no way to request more data, so it's fine to do nothing here.
   */
  _read(cb: () => void) {
    cb()
  }

  /**
   * From Writable.
   *
   * Called when .write() is called locally on this channel.
   */
  _write(chunk: Buffer, cb: () => void) {
    this.send(MsgType.Data, chunk)
    cb()
  }

  /**
   * From Writable.
   *
   * Called when .end() is called locally on the writable half of this channel.
   */
  _final(cb: (err?: Error) => void) {
    this.send(MsgType.End, Buffer.alloc(0))
    cb()
  }

  /**
   * From Readable and Writable.
   *
   * Called when .destroy() is called locally, or after both sides have called .end().
   * We are completely done with this channel and no more data will be read or written.
   */
  _destroy(cb: (err?: Error) => void) {
    this.send(MsgType.Destroy, Buffer.alloc(0))
    cb()
  }
}
