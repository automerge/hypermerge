import * as http from 'http'
import { Readable } from 'stream'
import { HyperfileUrl, toIpcPath } from './Misc'
import * as Stream from './StreamLogic'
import * as JsonBuffer from './JsonBuffer'
import { Header } from './FileStore'

export default class FileServerClient {
  serverPath?: string
  agent: http.Agent

  constructor() {
    this.agent = new http.Agent({
      keepAlive: true,
    })
  }

  setServerPath(path: string) {
    this.serverPath = toIpcPath(path)
  }

  async write(stream: Readable, mimeType: string): Promise<Header> {
    if (!this.serverPath) throw new Error('FileServer has not been started on RepoBackend')

    const [req, response] = this.request({
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
      },
    })

    stream.pipe(req)

    return JsonBuffer.parse(await Stream.toBuffer(await response))
  }

  async header(url: HyperfileUrl): Promise<Header> {
    const [req, responsePromise] = this.request({
      path: '/' + url,
      method: 'HEAD',
    })
    req.end()

    const header = getHeader(url, await responsePromise)
    return header
  }

  async read(url: HyperfileUrl): Promise<[Header, Readable]> {
    if (!this.serverPath) throw new Error('FileServer has not been started on RepoBackend')

    const [req, responsePromise] = this.request({
      path: '/' + url,
      method: 'GET',
    })
    req.end()

    const response = await responsePromise
    const header = getHeader(url, response)

    return [header, response]
  }

  private request(
    options: http.RequestOptions
  ): [http.ClientRequest, Promise<http.IncomingMessage>] {
    if (!this.serverPath) throw new Error('Must call setServerPath before making requests.')

    return request({
      agent: this.agent,
      socketPath: this.serverPath,
      ...options,
    })
  }
}

function getHeader(url: HyperfileUrl, response: http.IncomingMessage): Header {
  if (response.statusCode !== 200) {
    throw new Error(`Server error, code=${response.statusCode} message=${response.statusMessage}`)
  }

  const mimeType = response.headers['content-type']
  const contentLength = response.headers['content-length']
  const blockCount = response.headers['x-block-count']
  const sha256 = response.headers['etag']

  if (!mimeType) throw new Error('Missing Content-Type in FileServer response')
  if (!contentLength) throw new Error('Missing Content-Length in FileServer response')
  if (typeof sha256 != 'string') throw new Error('Missing ETag in FileServer response')
  if (typeof blockCount != 'string') throw new Error('Missing X-Block-Count in FileServer response')

  const size = parseInt(contentLength, 10)
  const blocks = parseInt(blockCount, 10)
  if (isNaN(size)) throw new Error('Invalid Content-Length in FileServer response')
  if (isNaN(blocks)) throw new Error('Invalid X-Block-Count in FileServer response')

  const header: Header = {
    url,
    size,
    blocks,
    mimeType,
    sha256,
  }

  return header
}

function request(
  options: http.RequestOptions
): [http.ClientRequest, Promise<http.IncomingMessage>] {
  const req = http.request(options)

  const response = new Promise<http.IncomingMessage>((resolve, reject) => {
    req.on('response', resolve).on('error', reject)
  })

  return [req, response]
}
