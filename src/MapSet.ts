
export default class MapSet<A,B> {
  private map: Map<A, Set<B>> = new Map()

  add(key: A, val: B) {
    this.merge(key,[val])
  }

  merge(key: A, vals: B[]) {
    this.map.set(key, new Set([...this.get(key), ...vals]))
  }

  get(key: A) : Set<B> {
    return this.map.get(key) || new Set()
  }

  has(key: A, val: B) : Boolean {
    return this.get(key).has(val)
  }
}
