import * as zlib from 'zlib'
import * as JsonBuffer from './JsonBuffer'

const BROTLI = 'BR'

const {
  BROTLI_PARAM_MODE,
  BROTLI_MODE_TEXT,
  BROTLI_PARAM_SIZE_HINT,
  BROTLI_PARAM_QUALITY,
} = zlib.constants

export function pack(obj: Object): Buffer {
  const blockHeader = Buffer.from(BROTLI)
  const source = JsonBuffer.bufferify(obj)
  const blockBody = Buffer.from(
    zlib.brotliCompressSync(source, {
      params: {
        [BROTLI_PARAM_MODE]: BROTLI_MODE_TEXT,
        [BROTLI_PARAM_SIZE_HINT]: source.length,
        [BROTLI_PARAM_QUALITY]: 11, // 11 is default
      },
    })
  )
  if (source.length < blockBody.length) {
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
      return JsonBuffer.parse(Buffer.from(zlib.brotliDecompressSync(data.slice(2))))

    default:
      throw new Error(`fail to unpack blocks - head is '${header}'`)
  }
}
