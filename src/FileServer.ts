import { Server, createServer, IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http'
import { parse } from 'url'
import fs from 'fs'
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
    // For some reason, the non-sync version doesn't work :shrugging-man:
    // fs.unlink(path, (err) => {
    //   this.http.listen(path)
    // })
    try {
      fs.unlinkSync(path)
    } catch {}
    this.http.listen(path)
  }

  isListening(): boolean {
    return this.http.listening
  }

  close(): Promise<void> {
    return new Promise((res) => {
      if (this.isListening()) {
        this.http.close(res)
      } else {
        res()
      }
    })
  }

  private onConnection = (req: IncomingMessage, res: ServerResponse) => {
    const { path } = parse(req.url!)
    const url = path!.slice(1)

    switch (url) {
      case 'upload':
        if (req.method !== 'POST') {
          res.writeHead(500, 'Must be POST')
          res.end()
          return
        }

        return this.upload(req, res)

      default:
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
    const header = await this.store.write(info.mimeType, info.bytes, req)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(header))
  }

  private async stream(url: HyperfileUrl, res: ServerResponse) {
    const header = await this.store.header(url)

    res.writeHead(200, {
      'Content-Type': header.mimeType,
      'Content-Length': header.bytes,
    })

    const stream = await this.store.read(url)
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
