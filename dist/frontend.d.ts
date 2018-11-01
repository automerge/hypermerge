/// <reference types="node" />
import { EventEmitter } from "events";
import { Patch, ChangeFn } from "automerge/frontend";
import Handle from "./handle";
export declare type Patch = Patch;
export declare class FrontendManager<T> extends EventEmitter {
    docId: string;
    actorId?: string;
    back?: any;
    private changeQ;
    private front;
    private mode;
    constructor(docId: string, actorId?: string);
    handle(): Handle<T>;
    change: (fn: ChangeFn<T>) => void;
    release: () => void;
    setActorId: (actorId: string) => void;
    init: (actorId?: string | undefined, patch?: Patch | undefined) => void;
    private enableWrites;
    patch: (patch: Patch) => void;
    bench(msg: string, f: () => void): void;
}
