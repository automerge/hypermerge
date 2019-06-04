import { Clock, Doc, ChangeFn } from "automerge/frontend";
import { RepoFrontend, ProgressEvent } from "./RepoFrontend";
export declare class Handle<T> {
    id: string;
    state: Doc<T> | null;
    clock: Clock | null;
    subscription?: (item: Doc<T>, clock?: Clock, index?: number) => void;
    progressSubscription?: (event: ProgressEvent) => void;
    messageSubscription?: (event: any) => void;
    private counter;
    private repo;
    constructor(repo: RepoFrontend);
    fork(): string;
    merge(other: Handle<T>): this;
    message: (contents: any) => this;
    push: (item: Doc<T>, clock: Clock) => void;
    pushProgress: (progress: ProgressEvent) => void;
    pushMessage: (contents: any) => void;
    once: (subscriber: (doc: Doc<T>, clock?: Clock | undefined, index?: number | undefined) => void) => this;
    subscribe: (subscriber: (doc: Doc<T>, clock?: Clock | undefined, index?: number | undefined) => void) => this;
    subscribeProgress: (subscriber: (event: ProgressEvent) => void) => this;
    subscribeMessage: (subscriber: (event: any) => void) => this;
    close: () => void;
    debug(): void;
    cleanup: () => void;
    changeFn: (fn: ChangeFn<T>) => void;
    change: (fn: ChangeFn<T>) => this;
}
