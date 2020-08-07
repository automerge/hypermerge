declare module 'random-access-storage' {
  export interface RandomAccessStorage {
    open(callback: (error: null | Error) => any): void
    read(
      offset: number,
      length: number,
      callback: (error: null | Error, buffer: Buffer) => any
    ): void
    write(offset: number, buffer: Buffer, callback: (error: null | Error) => any): void
    del(offset: number, length: number, callback: (error: null | Error) => any): void
    stat(callback: (error: null | Error, stat: { size: number }) => any): void
    close(callback: (error: null | Error) => any): void
    destroy(callback: (error: null | Error) => any): void
  }
}
