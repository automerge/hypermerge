import { Transform, TransformCallback, Readable } from 'stream'
import { Hash, createHash } from 'crypto'

export class MaxChunkSizeTransform extends Transform {
  maxChunkSize: number
  processedBytes: number
  chunkCount: number

  constructor(maxChunkSize: number) {
    super({
      highWaterMark: maxChunkSize,
    })
    this.processedBytes = 0
    this.chunkCount = 0
    this.maxChunkSize = maxChunkSize
  }

  _transform(data: Buffer, _encoding: string, cb: TransformCallback): void {
    let offset = 0
    do {
      const chunk = data.slice(offset, offset + this.maxChunkSize)
      offset += chunk.length
      this.processedBytes += chunk.length
      this.chunkCount += 1
      this.push(chunk)
    } while (offset < data.length)

    cb()
  }
}

export class HashPassThrough extends Transform {
  readonly hash: Hash

  constructor(algorithm: string) {
    super()
    this.hash = createHash(algorithm)
  }

  _transform(data: Buffer, _encoding: string, cb: TransformCallback): void {
    this.hash.update(data)
    cb(undefined, data)
  }
}

export function toBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((res, rej) => {
    const buffers: Buffer[] = []
    stream
      .on('data', (data: Buffer) => buffers.push(data))
      .on('error', (err: any) => rej(err))
      .on('end', () => res(Buffer.concat(buffers)))
  })
}

export function fromBuffer(buffer: Buffer): Readable {
  return new Readable({
    read(_size) {
      this.push(buffer)
      this.push(null)
    },
  })
}
