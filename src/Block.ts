const brotli = require('iltorb')
const BROTLI = 'BR'
const BROTLI_MODE_TEXT = 1
import * as JsonBuffer from './JsonBuffer'

export function pack(obj: Object): Buffer {
  const blockHeader = Buffer.from(BROTLI)
  const source = JsonBuffer.bufferify(obj)
  const blockBody = Buffer.from(brotli.compressSync(source, { mode: BROTLI_MODE_TEXT }))
  if (source.length < blockBody.length) {
    // TODO: log when this happens
    return source
  } else {
    return Buffer.concat([blockHeader, blockBody])
  }
}

export function unpack(data: Uint8Array): any {
  //if (data.slice(0,2).toString() === '{"') { // an old block before we added compression
  const header = data.slice(0, 2)
  switch (header.toString()) {
    case '{"':
      return JsonBuffer.parse(data)
    case BROTLI:
      return JsonBuffer.parse(Buffer.from(brotli.decompressSync(data.slice(2))))
    default:
      throw new Error(`fail to unpack blocks - head is '${header}'`)
  }
}
