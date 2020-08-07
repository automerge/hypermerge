declare module 'random-access-file' {
  import { RandomAccessStorage } from 'random-access-storage'
  export type Options = {
    truncate?: boolean
    size?: number
    readable?: boolean
    writable?: boolean
    lock?: (fd: any) => boolean
  }

  export { RandomAccessStorage }
  export default function(filename: string, options?: Options): RandomAccessStorage
}
