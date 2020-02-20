import { RandomAccessStorage, Options } from 'random-access-file'
import LRU, { LRUOptions } from 'lru'

type RandomAccessFactory = (path: string, options?: Options) => RandomAccessStorage

class ManagedRandomAccess implements RandomAccessStorage {
  path: string
  storage: RandomAccessStorage
  lru: LRU<ManagedRandomAccess>
  evicted: boolean
  constructor(path: string, storage: RandomAccessStorage, lru: LRU<ManagedRandomAccess>) {
    this.path = path
    this.storage = storage
    this.lru = lru
    this.evicted = false
  }
  open(callback: (error: null | Error) => any) {
    this.storage.open((error: null | Error) => {
      if (error) {
        callback(error)
      } else {
        this.lru.set(this.path, this)
        callback(error)
      }
    })
  }
  ensure(task: () => void) {
    if (this.evicted) {
      this.storage.open((error: null | Error) => {
        if (!error) {
          this.lru.set(this.path, this)
          task()
        }
      })
    } else {
      task()
    }
  }
  read(offset: number, length: number, callback: (error: null | Error, buffer: Buffer) => any) {
    this.ensure(() => this.storage.read(offset, length, callback))
  }
  write(offset: number, buffer: Buffer, callback: (error: null | Error) => any) {
    this.ensure(() => this.storage.write(offset, buffer, callback))
  }
  del(offset: number, length: number, callback: (error: null | Error) => any) {
    this.ensure(() => this.storage.del(offset, length, callback))
  }
  stat(callback: (error: null | Error, stat: { size: number }) => any) {
    this.ensure(() => this.storage.stat(callback))
  }
  close(callback: (error: null | Error) => any) {
    this.lru.remove(this.path)
    this.storage.close(callback)
  }
  destroy(callback: (error: null | Error) => any) {
    this.lru.remove(this.path)
    this.storage.destroy(callback)
  }
  evict() {
    this.storage.close(() => {})
  }
}

export default (options: LRUOptions, randomAccess: RandomAccessFactory): RandomAccessFactory => {
  const cache: LRU<ManagedRandomAccess> = new LRU(options)
  // Use single event listener to avoid multiple calls.
  cache.on('evict', ({ value }: { key: string; value: ManagedRandomAccess }) => value.evict())
  return (path: string, options?: Options) =>
    new ManagedRandomAccess(path, randomAccess(path, options), cache)
}
