import { Patch, ChangeFn } from "automerge/frontend";
import { ToBackendRepoMsg } from "./RepoMsg";
import Queue from "./Queue";
import Handle from "./Handle";
export declare type Patch = Patch;
interface Config {
    docId: string;
    actorId?: string;
}
export declare class Document<T> {
    docId: string;
    actorId?: string;
    back?: any;
    toBackend: Queue<ToBackendRepoMsg>;
    private changeQ;
    private front;
    private mode;
    private handles;
    constructor(config: Config);
    handle(): Handle<T>;
    newState(): void;
    change: (fn: ChangeFn<T>) => void;
    release: () => void;
    setActorId: (actorId: string) => void;
    init: (actorId?: string | undefined, patch?: Patch | undefined) => void;
    private enableWrites;
    patch: (patch: Patch) => void;
    bench(msg: string, f: () => void): void;
}
export {};
