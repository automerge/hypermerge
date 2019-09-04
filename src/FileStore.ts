import { HyperfileUrl } from './Misc'
import { Readable } from 'stream'
import FeedStore, { FeedId } from './FeedStore'
import { validateFileURL } from './Metadata'
import * as Keys from './Keys'
import * as JsonBuffer from './JsonBuffer'
import Queue from './Queue'

const KB = 1024
const MB = 1024 * KB
const BLOCK_SIZE = 1 * MB // TODO(jeff): This is likely too large.

export interface Header {
  type: 'File'
  url: HyperfileUrl
  bytes: number
  mimeType: string
  blockSize: number
}

export default class FileStore {
  private store: FeedStore
  writeLog: Queue<Header>

  constructor(store: FeedStore) {
    this.store = store
    this.writeLog = new Queue()
  }

  async header(url: HyperfileUrl): Promise<Header> {
    return this.store.read(toFeedId(url), 0).then(JsonBuffer.parse)
  }

  async write(mimeType: string, data: Buffer): Promise<Header> {
    const keys = Keys.create()
    const feedId = await this.store.create(keys)
    const header: Header = {
      type: 'File',
      url: toHyperfileUrl(feedId),
      bytes: data.length,
      mimeType,
      blockSize: BLOCK_SIZE,
    }

    await this.store.append(feedId, JsonBuffer.bufferify(header))

    await this.store.append(feedId, ...chunkBuffer(data, header.blockSize))
    this.writeLog.push(header)
    return header
  }

  async writeStream(mimeType: string, length: number, stream: Readable): Promise<Header> {
    const keys = Keys.create()
    const feedId = await this.store.create(keys)
    const header: Header = {
      type: 'File',
      url: toHyperfileUrl(feedId),
      bytes: length,
      mimeType,
      blockSize: stream.readableHighWaterMark,
    }

    await this.store.append(feedId, JsonBuffer.bufferify(header))
    const appendStream = await this.store.appendStream(feedId)

    return new Promise<Header>((res, rej) => {
      stream
        .pipe(appendStream)
        .on('error', (err) => rej(err))
        .on('finish', () => {
          this.writeLog.push(header)
          res(header)
        })
    })
  }

  async stream(url: HyperfileUrl): Promise<Readable> {
    const feedId = toFeedId(url)
    return this.store.stream(feedId, 1) // First block is Header
  }
}

export function isHyperfileUrl(url: string): url is HyperfileUrl {
  return /^hyperfile:\/\w+$/.test(url)
}

function toHyperfileUrl(feedId: FeedId): HyperfileUrl {
  return `hyperfile:/${feedId}` as HyperfileUrl
}

function toFeedId(hyperfileUrl: HyperfileUrl): FeedId {
  return (validateFileURL(hyperfileUrl) as string) as FeedId
}

function chunkBuffer(data: Buffer, blockSize: number): Buffer[] {
  const chunks = []
  for (let i = 0; i < data.length; i += blockSize) {
    const block = data.slice(i, i + blockSize)
    chunks.push(block)
  }
  return chunks
}
