import { Clock, Doc, ChangeFn } from "automerge/frontend";
import { RepoFrontend } from "./RepoFrontend";
export declare class Handle<T> {
    id: string;
    state: Doc<T> | null;
    clock: Clock | null;
    subscription?: (item: Doc<T>, clock?: Clock, index?: number) => void;
    private counter;
    private repo;
    constructor(repo: RepoFrontend);
    fork(): string;
    follow(): string;
    merge(other: Handle<T>): this;
    push: (item: Doc<T>, clock: Clock) => void;
    once: (subscriber: (doc: Doc<T>, clock?: Clock | undefined, index?: number | undefined) => void) => this;
    subscribe: (subscriber: (doc: Doc<T>, clock?: Clock | undefined, index?: number | undefined) => void) => this;
    close: () => void;
    debug(): void;
    cleanup: () => void;
    changeFn: (fn: ChangeFn<T>) => void;
    change: (fn: ChangeFn<T>) => this;
}
