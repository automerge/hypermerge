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

  private onConnection = async (req: IncomingMessage, res: ServerResponse) => {
    const { method } = req
    const { path } = parse(req.url!)
    const url = path!.slice(1)

    if (!method) return this.sendCode(res, 400, 'Bad Request')

    switch (req.method) {
      case 'POST':
        return this.upload(req, res)

      case 'HEAD':
      case 'GET':
        if (!isHyperfileUrl(url)) return this.sendCode(res, 404, 'Not Found')

        await this.writeHeaders(url, res)

        if (method === 'GET') {
          const stream = await this.files.read(url)
          stream.pipe(res)
        } else {
          res.end()
        }
        return

      default:
    }
  }

  private sendCode(res: ServerResponse, code: number, reason: string): void {
    res.writeHead(code, reason)
    res.end()
  }

  private async upload(req: IncomingMessage, res: ServerResponse) {
    const mimeType = getMimeType(req.headers)
    const header = await this.files.write(req, mimeType)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(header))
  }

  private async writeHeaders(url: HyperfileUrl, res: ServerResponse) {
    const header = await this.files.header(url)

    res.writeHead(200, {
      'Content-Type': header.mimeType,
      'Content-Length': header.size,
    })
  }
}

function getMimeType(headers: IncomingHttpHeaders): string {
  const mimeType = headers['content-type']

  if (!mimeType) throw new Error('Content-Type is a required header.')
  return mimeType
}
