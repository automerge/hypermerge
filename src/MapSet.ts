
export default class MapSet<A,B> {
  private map: Map<A, Set<B>> = new Map()

  add(key: A, val: B) : boolean {
    return this.merge(key,[val])
  }

  keys() : A[] {
    return [ ... this.map.keys() ]
  }

  merge(key: A, vals: B[]) : boolean {
    const current = this.get(key)
    const change = vals.some(val => !current.has(val))
    if (change) {
      this.map.set(key, new Set([...current, ...vals]))
    }
    return change
  }

  delete(key: A) {
    this.map.delete(key)
  }

  remove(key: A, val: B) {
    this.get(key).delete(val)
  }

  get(key: A) : Set<B> {
    return this.map.get(key) || new Set()
  }

  has(key: A, val: B) : boolean {
    return this.get(key).has(val)
  }
}
