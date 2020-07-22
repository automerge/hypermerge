import { Clock, Doc, ChangeFn } from 'automerge';
import { RepoFrontend, ProgressEvent } from './RepoFrontend';
import { DocUrl } from './Misc';
export declare class Handle<T> {
    url: DocUrl;
    state: Doc<T> | null;
    clock: Clock | null;
    subscription?: (item: Doc<T>, clock?: Clock, index?: number) => void;
    progressSubscription?: (event: ProgressEvent) => void;
    messageSubscription?: (event: any) => void;
    private counter;
    private repo;
    constructor(repo: RepoFrontend, url: DocUrl);
    fork(): DocUrl;
    merge(other: Handle<T>): this;
    message: (contents: any) => this;
    push: (item: Doc<T>, clock: Clock) => void;
    receiveProgressEvent: (progress: ProgressEvent) => void;
    receiveDocumentMessage: (contents: any) => void;
    once: (subscriber: (doc: Doc<T>, clock?: Clock | undefined, index?: number | undefined) => void) => this;
    subscribe: (subscriber: (doc: Doc<T>, clock?: Clock | undefined, index?: number | undefined) => void) => this;
    subscribeProgress: (subscriber: (event: ProgressEvent) => void) => this;
    subscribeMessage: (subscriber: (event: any) => void) => this;
    close: () => void;
    debug(): void;
    cleanup: () => void;
    changeFn: (_fn: ChangeFn<T>) => void;
    change: (fn: ChangeFn<T>) => this;
}
