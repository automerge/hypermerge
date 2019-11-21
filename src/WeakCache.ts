import { getOrCreate } from './Misc'

export interface Create<K, V> {
  (key: K): V
}

export default class WeakCache<K extends object, V> extends WeakMap<K, V> {
  constructor(private create: Create<K, V>) {
    super()
  }

  getOrCreate(key: K): V {
    return getOrCreate(this, key, this.create)
  }
}
