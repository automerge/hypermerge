export default class MapSet<A, B> {
    private map;
    add(key: A, val: B): boolean;
    set(key: A, val: Set<B>): void;
    values(): Set<B>[];
    union(): Set<B>;
    keys(): A[];
    merge(key: A, vals: B[]): boolean;
    delete(key: A): Set<B>;
    remove(key: A, val: B): void;
    keysWith(val: B): Set<A>;
    get(key: A): Set<B>;
    has(key: A, val: B): boolean;
}
