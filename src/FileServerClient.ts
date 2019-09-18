import * as http from 'http'
import { Readable } from 'stream'
import { HyperfileUrl, streamToBuffer, toIpcPath } from './Misc'
import * as JsonBuffer from './JsonBuffer'

export default class FileServerClient {
  serverPath?: string

  setServerPath(path: string) {
    this.serverPath = toIpcPath(path)
  }

  async write(data: Readable, size: number, mimeType: string): Promise<HyperfileUrl> {
    if (!this.serverPath) throw new Error('FileServer has not been started on RepoBackend')

    const [req, response] = request({
      socketPath: this.serverPath,
      path: '/upload',
      method: 'POST',
      headers: {
        'Content-Type': mimeType,
        'Content-Length': size,
      },
    })
    data.pipe(req)
    const header = JsonBuffer.parse(await streamToBuffer(await response))

    const { url } = header
    if (!url) throw new Error('Invalid response')

    return url
  }

  async read(url: HyperfileUrl): Promise<[Readable, string, number]> {
    if (!this.serverPath) throw new Error('FileServer has not been started on RepoBackend')

    const [req, responsePromise] = request({
      socketPath: this.serverPath,
      path: '/' + url,
      method: 'GET',
    })
    req.end()

    const response = await responsePromise

    if (response.statusCode !== 200) {
      throw new Error(`Server error, code=${response.statusCode} message=${response.statusMessage}`)
    }
    const mimeType = response.headers['content-type']
    const contentLength = response.headers['content-length']

    if (!mimeType) throw new Error('Missing mimeType in FileServer response')
    if (!contentLength) throw new Error('Missing content-length in FileServer response')

    const size = parseInt(contentLength, 10)
    if (isNaN(size)) throw new Error('Invalid content-length in FileServer response')

    return [response, mimeType, size]
  }
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
