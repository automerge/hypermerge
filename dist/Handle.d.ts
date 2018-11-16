import { Doc, ChangeFn } from "automerge/frontend";
export default class Handle<T> {
    id: string;
    value: Doc<T> | null;
    subscription?: (item: Doc<T>, index?: number) => void;
    private counter;
    constructor();
    push: (item: Doc<T>) => void;
    once: (subscriber: (doc: Doc<T>) => void) => this;
    subscribe: (subscriber: (doc: Doc<T>, index?: number | undefined) => void) => this;
    close: () => void;
    cleanup: () => void;
    changeFn: (fn: ChangeFn<T>) => void;
    change: (fn: ChangeFn<T>) => this;
}
