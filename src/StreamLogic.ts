import { Transform, TransformCallback, Readable } from 'stream'
import { Hash, createHash } from 'crypto'

export class ChunkSizeTransform extends Transform {
  private pending: Buffer[]

  chunkSize: number
  processedBytes: number
  chunkCount: number

  constructor(chunkSize: number) {
    super({
      highWaterMark: chunkSize,
    })
    this.processedBytes = 0
    this.chunkCount = 0
    this.chunkSize = chunkSize
    this.pending = []
  }

  _transform(data: Buffer, _encoding: string, cb: TransformCallback): void {
    this.pending.push(data)

    this.pushChunks(this.readPendingChunks())

    cb()
  }

  _flush(cb: () => void) {
    const chunk = Buffer.concat(this.pending)
    this.pending = []
    this.pushChunks([chunk])
    cb()
  }

  private pushChunks(chunks: Buffer[]) {
    chunks.forEach((chunk) => {
      this.processedBytes += chunk.length
      this.chunkCount += 1
      this.push(chunk)
    })
  }

  private readPendingChunks(): Buffer[] {
    if (this.pendingLength() < this.chunkSize) return []

    const chunks: Buffer[] = []
    const full = Buffer.concat(this.pending)
    this.pending = []

    let offset = 0
    while (offset + this.chunkSize <= full.length) {
      const chunk = full.slice(offset, offset + this.chunkSize)
      offset += chunk.length
      chunks.push(chunk)
    }

    const remaining = full.slice(offset, offset + this.chunkSize)
    this.pending.push(remaining)

    return chunks
  }

  private pendingLength(): number {
    return this.pending.reduce((len, chunk) => len + chunk.length, 0)
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

export function fromBuffers(buffers: Buffer[]): Readable {
  return new Readable({
    read(_size) {
      buffers.forEach((buffer) => {
        this.push(buffer)
      })
      this.push(null)
    },
  })
}
