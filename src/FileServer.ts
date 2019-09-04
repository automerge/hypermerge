import { Server, createServer, IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http'
import { parse } from 'url'
import { Readable } from 'stream'
import FileStore, { isHyperfileUrl } from './FileStore'
import { HyperfileUrl } from './Misc'

export default class FileServer {
  private store: FileStore
  private http: Server

  constructor(store: FileStore) {
    this.store = store
    this.http = createServer(this.onConnection)
  }

  listen(path: string) {
    this.http.listen(path)
  }

  isListening(): boolean {
    return this.http.listening
  }

  private onConnection = (req: IncomingMessage, res: ServerResponse) => {
    const { path } = parse(req.url!)
    const url = path!.slice(1)

    switch (url) {
      case 'upload':
        return this.upload(req, res)
      default:
        console.log('handling url', url)
        if (isHyperfileUrl(url)) {
          return this.stream(url, res)
        } else {
          res.writeHead(404, 'NOT FOUND')
          res.end()
        }
    }
  }

  private async upload(req: IncomingMessage, res: ServerResponse) {
    const info = uploadInfo(req.headers)
    const data = await streamToBuffer(req)
    const header = await this.store.write(info.mimeType, data)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(header))
  }

  private async stream(url: HyperfileUrl, res: ServerResponse) {
    console.log('streaming', url)

    const header = await this.store.header(url)

    res.writeHead(200, {
      'Content-Type': header.mimeType,
      'Content-Length': header.bytes,
    })

    const stream = await this.store.stream(url)
    stream.pipe(res)
  }
}

interface UploadInfo {
  mimeType: string
  bytes: number
}

function uploadInfo(headers: IncomingHttpHeaders): UploadInfo {
  const mimeType = headers['content-type']
  const length = headers['content-length']

  if (!mimeType) throw new Error('Content-Type is a required header.')
  if (!length) throw new Error('Content-Length is a required header.')

  const bytes = parseInt(length, 10)

  return {
    mimeType,
    bytes,
  }
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((res, rej) => {
    const buffers: Buffer[] = []
    stream
      .on('data', (data) => buffers.push(data))
      .on('error', (err) => rej(err))
      .on('end', () => res(Buffer.concat(buffers)))
  })
}
