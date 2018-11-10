import { Doc, ChangeFn } from "automerge/frontend";
import { DocFrontend } from "./DocFrontend";
export default class Handle<T> {
    value: Doc<T> | null;
    front: DocFrontend<T>;
    subscription?: (item: Doc<T>, index?: number) => void;
    private counter;
    constructor(front: DocFrontend<T>);
    readonly id: string;
    push: (item: Doc<T>) => void;
    once: (subscriber: (doc: Doc<T>) => void) => this;
    subscribe: (subscriber: (doc: Doc<T>, index?: number | undefined) => void) => this;
    close: () => void;
    change: (fn: ChangeFn<T>) => this;
}
