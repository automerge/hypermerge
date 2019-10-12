import { Server, createServer, IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http'
import { parse } from 'url'
import fs from 'fs'
import FileStore, { isHyperfileUrl } from './FileStore'
import { HyperfileUrl, toIpcPath } from './Misc'

export default class FileServer {
  private files: FileStore
  private http: Server

  constructor(store: FileStore) {
    this.files = store
    this.http = createServer(this.onConnection)
  }

  listen(path: string) {
    const ipcPath = toIpcPath(path)
    // For some reason, the non-sync version doesn't work :shrugging-man:
    // fs.unlink(path, (err) => {
    //   this.http.listen(path)
    // })
    try {
      fs.unlinkSync(ipcPath)
    } catch {}
    this.http.listen(ipcPath)
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
    const header = await this.files.write(info.mimeType, req)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(header))
  }

  private async stream(url: HyperfileUrl, res: ServerResponse) {
    const header = await this.files.header(url)

    res.writeHead(200, {
      'Content-Type': header.mimeType,
      'Content-Length': header.bytes,
    })

    const stream = await this.files.read(url)
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
