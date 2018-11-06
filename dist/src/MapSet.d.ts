export default class MapSet<A, B> {
    private map;
    add(key: A, val: B): void;
    merge(key: A, vals: B[]): void;
    get(key: A): Set<B>;
    has(key: A, val: B): Boolean;
}
