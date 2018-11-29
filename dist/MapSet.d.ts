export default class MapSet<A, B> {
    private map;
    add(key: A, val: B): boolean;
    keys(): A[];
    merge(key: A, vals: B[]): boolean;
    get(key: A): Set<B>;
    has(key: A, val: B): boolean;
}
