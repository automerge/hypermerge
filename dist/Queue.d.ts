export default class Queue<T> {
    push: (item: T) => void;
    name: string;
    private queue;
    private log;
    private subscription?;
    constructor(name?: string);
    first(): Promise<T>;
    drain(fn: (item: T) => void): void;
    once(subscriber: (item: T) => void): void;
    subscribe(subscriber: (item: T) => void): void;
    unsubscribe(): void;
    readonly length: number;
    private enqueue;
}
