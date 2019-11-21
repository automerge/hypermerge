export interface Create<K, V> {
    (key: K): V;
}
export default class WeakCache<K extends object, V> extends WeakMap<K, V> {
    private create;
    constructor(create: Create<K, V>);
    getOrCreate(key: K): V;
}
