import { HyperfileUrl } from './Misc'
import { Readable } from 'stream'
import FeedStore, { FeedId } from './FeedStore'
import { validateFileURL } from './Metadata'
import * as Keys from './Keys'
import * as JsonBuffer from './JsonBuffer'
import Queue from './Queue'

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
    return this.feeds.head(toFeedId(url)).then(JsonBuffer.parse)
  }

  async read(url: HyperfileUrl): Promise<Readable> {
    const feedId = toFeedId(url)
    return this.feeds.stream(feedId, 0, -1)
  }

  async write(mimeType: string, stream: Readable): Promise<Header> {
    const keys = Keys.create()
    const feedId = await this.feeds.create(keys)

    const appendStream = await this.feeds.appendStream(feedId)

    return new Promise<Header>((res, rej) => {
      let bytes = 0

      stream
        .on('data', (chunk: Buffer) => {
          bytes += chunk.length
        })
        .pipe(appendStream)
        .on('error', (err) => rej(err))
        .on('finish', async () => {
          const header: Header = {
            type: 'File',
            url: toHyperfileUrl(feedId),
            bytes,
            mimeType,
          }

          await this.feeds.append(feedId, JsonBuffer.bufferify(header))
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
