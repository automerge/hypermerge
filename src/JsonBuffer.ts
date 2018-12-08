export function parse(buffer: ArrayBuffer | ArrayBufferView): any {
  // const decoder = new TextDecoder()
  return JSON.parse(buffer.toString());
}

export function bufferify(value: any): Uint8Array {
  // const encoder = new TextEncoder()
  return Buffer.from(JSON.stringify(value));
}
