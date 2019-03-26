export function parse(buffer: ArrayBuffer | ArrayBufferView): any {
  return JSON.parse(buffer.toString())
}

export function bufferify(value: any): Buffer {
  return Buffer.from(JSON.stringify(value))
}

export function parseAllValid(buffers: Uint8Array[]): any[] {
  const out = []
  for (let i = 0; i < buffers.length; i++) {
    try {
      out.push(parse(buffers[i]))
    } catch (e) {
      console.warn(`Found invalid JSON in buffer ${i}`, e)
      continue
    }
  }
  return out
}
