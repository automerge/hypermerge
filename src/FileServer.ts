import { Server, createServer, IncomingMessage, ServerResponse, IncomingHttpHeaders } from 'http'
import { parse } from 'url'
import fs from 'fs'
import * as JsonBuffer from './JsonBuffer'
import FileStore, { isHyperfileUrl } from './FileStore'
import { HyperfileUrl, toIpcPath } from './Misc'

export interface HostAndPort {
  host: string
  port: number
}

export default class FileServer {
  private files: FileStore
  private http: Server

  constructor(store: FileStore) {
    this.files = store
    this.http = createServer(this.onConnection)
    this.http.setTimeout(0)
  }

  listen(pathOrAddress: string | HostAndPort): Promise<void> {
    return new Promise((res) => {
      if (typeof pathOrAddress === 'string') {
        const ipcPath = toIpcPath(pathOrAddress)
        // For some reason, the non-sync version doesn't work :shrugging-man:
        // fs.unlink(path, (err) => {
        //   this.http.listen(path)
        // })
        try {
          fs.unlinkSync(ipcPath)
        } catch {}
        this.http.listen(ipcPath, () => res())
      } else {
        this.http.listen(pathOrAddress, () => res())
      }
    })
  }

  isListening(): boolean {
    return this.http.listening
  }

  close(): Promise<void> {
    return new Promise((res) => {
      if (this.isListening()) {
        this.http.close(() => res())
      } else {
        res()
      }
    })
  }

  private onConnection = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      await this.onConnectionUnsafe(req, res)
    } catch (err) {
      if (err instanceof FileServerError) {
        res.writeHead(err.code, err.reason)
        res.end()
      } else {
        res.writeHead(500, 'Internal Server Error', {
          'Content-Type': 'application/json',
        })

        const details = {
          error: { name: err.name, message: err.message, stack: err.stack },
        }

        res.end(JsonBuffer.bufferify(details))
      }
    }
  }

  /**
   * Handles incoming connections, and can respond by throwing FileServerError.
   */
  private onConnectionUnsafe = async (req: IncomingMessage, res: ServerResponse) => {
    const { method } = req
    const { path } = parse(req.url!)
    const url = path!.slice(1)

    if (!method) throw new FileServerError(400, 'Bad Request')

    switch (req.method) {
      case 'POST':
        return this.upload(req, res)

      case 'HEAD':
        if (!isHyperfileUrl(url)) throw new NotFoundError()
        await this.sendHeaders(url, res)
        res.end()
        return

      case 'GET':
        if (!isHyperfileUrl(url)) throw new NotFoundError()

        await this.sendHeaders(url, res)
        const stream = await this.files.read(url)
        stream.pipe(res)
        return

      default:
        throw new FileServerError(405, 'Method Not Allowed')
    }
  }

  private async upload(req: IncomingMessage, res: ServerResponse) {
    const mimeType = getMimeType(req.headers)
    const header = await this.files.write(req, mimeType)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JsonBuffer.bufferify(header))
  }

  private async sendHeaders(url: HyperfileUrl, res: ServerResponse) {
    const header = await this.files.header(url)

    res.writeHead(200, {
      ETag: header.sha256,
      'Content-Type': header.mimeType,
      'Content-Length': header.size,
      'X-Block-Count': header.blocks,
    })
  }
}

function getMimeType(headers: IncomingHttpHeaders): string {
  const mimeType = headers['content-type']

  if (!mimeType) throw new Error('Content-Type is a required header.')
  return mimeType
}

class FileServerError extends Error {
  constructor(public code: number, public reason: string) {
    super()
  }
}

class NotFoundError extends FileServerError {
  constructor() {
    super(404, 'Not Found')
  }
}
