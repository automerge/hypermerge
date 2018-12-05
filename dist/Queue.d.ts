export default class Queue<T> {
    push: (item: T) => void;
    private queue;
    private log;
    private subscription?;
    constructor(name?: string);
    once(subscriber: (item: T) => void): void;
    subscribe(subscriber: (item: T) => void): void;
    unsubscribe(): void;
    readonly length: number;
    private enqueue;
}
