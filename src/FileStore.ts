import { HyperfileUrl } from './Misc'
import { Readable } from 'stream'
import FeedStore, { FeedId } from './FeedStore'
import { validateFileURL } from './Metadata'
import * as Keys from './Keys'
import * as JsonBuffer from './JsonBuffer'
import Queue from './Queue'

// const KB = 1024
// const MB = 1024 * KB
// const BLOCK_SIZE = 64 * KB
const FIRST_DATA_BLOCK = 1

export interface Header {
  type: 'File'
  url: HyperfileUrl
  bytes: number
  mimeType: string
}

export default class FileStore {
  private feeds: FeedStore
  writeLog: Queue<Header>

  constructor(store: FeedStore) {
    this.feeds = store
    this.writeLog = new Queue('FileStore:writeLog')
  }

  async header(url: HyperfileUrl): Promise<Header> {
    return this.feeds.read(toFeedId(url), 0).then(JsonBuffer.parse)
  }

  async read(url: HyperfileUrl): Promise<Readable> {
    const feedId = toFeedId(url)
    return this.feeds.stream(feedId, FIRST_DATA_BLOCK)
  }

  async write(mimeType: string, length: number, stream: Readable): Promise<Header> {
    const keys = Keys.create()
    const feedId = await this.feeds.create(keys)
    const header: Header = {
      type: 'File',
      url: toHyperfileUrl(feedId),
      bytes: length,
      mimeType,
    }

    await this.feeds.append(feedId, JsonBuffer.bufferify(header))
    const appendStream = await this.feeds.appendStream(feedId)

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
