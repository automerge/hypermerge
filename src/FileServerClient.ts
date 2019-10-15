import * as http from 'http'
import { Readable } from 'stream'
import { HyperfileUrl, toIpcPath } from './Misc'
import * as Stream from './StreamLogic'
import * as JsonBuffer from './JsonBuffer'
import { Header } from './FileStore'

export default class FileServerClient {
  serverPath?: string

  setServerPath(path: string) {
    this.serverPath = toIpcPath(path)
  }

  async write(stream: Readable, mimeType: string): Promise<Header> {
    if (!this.serverPath) throw new Error('FileServer has not been started on RepoBackend')

    const [req, response] = request({
      socketPath: this.serverPath,
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
    const [req, responsePromise] = request({
      socketPath: this.serverPath,
      path: '/' + url,
      method: 'HEAD',
    })
    req.end()

    const header = getHeader(url, await responsePromise)
    return header
  }

  async read(url: HyperfileUrl): Promise<[Header, Readable]> {
    if (!this.serverPath) throw new Error('FileServer has not been started on RepoBackend')

    const [req, responsePromise] = request({
      socketPath: this.serverPath,
      path: '/' + url,
      method: 'GET',
    })
    req.end()

    const response = await responsePromise
    const header = getHeader(url, response)

    return [header, response]
  }
}

function getHeader(url: HyperfileUrl, response: http.IncomingMessage): Header {
  if (response.statusCode !== 200) {
    throw new Error(`Server error, code=${response.statusCode} message=${response.statusMessage}`)
  }

  const mimeType = response.headers['content-type']
  const contentLength = response.headers['content-length']
  const blockCount = response.headers['x-block-count']

  if (!mimeType) throw new Error('Missing mimeType in FileServer response')
  if (!contentLength) throw new Error('Missing content-length in FileServer response')
  if (typeof blockCount != 'string') throw new Error('Missing x-block-count in FileServer response')

  const size = parseInt(contentLength, 10)
  const blocks = parseInt(blockCount, 10)
  if (isNaN(size)) throw new Error('Invalid content-length in FileServer response')
  if (isNaN(blocks)) throw new Error('Invalid x-block-count in FileServer response')

  const header: Header = {
    url,
    size,
    blocks,
    mimeType,
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
