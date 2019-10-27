declare module 'simple-message-channels' {
  export type Type = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15

  export interface Options {
    onmessage(channel: number, type: Type, message: Buffer): void
  }

  export default class SMC {
    constructor(options: Options)

    /**
     * Encode a channel, type, message to be sent to another person. Channel can be any number
     * and type can be any 4 bit number. Message should be a buffer.
     */
    send(channel: number, type: Type, message: Buffer): Buffer

    /**
     * Parse a payload buffer chunk. Once a full message has been parsed the
     * `smc.onmessage(channel, type, message)` handler is called.
     * Returns `true` if the chunk seemed valid and false if not. If false is returned check
     * `smc.error` to see the error it hit.
     */
    recv(payloadChunk: Buffer): boolean

    error?: Error

    /** Encodes a series of messages into a single paylaod buffer. */
    sendBatch(messages: { channel: number; type: Type; message: Buffer }[]): Buffer
  }
}
