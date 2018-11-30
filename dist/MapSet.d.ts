export default class MapSet<A, B> {
    private map;
    add(key: A, val: B): boolean;
    keys(): A[];
    merge(key: A, vals: B[]): boolean;
    delete(key: A): void;
    remove(key: A, val: B): void;
    get(key: A): Set<B>;
    has(key: A, val: B): boolean;
}
