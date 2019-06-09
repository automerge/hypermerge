import { Patch, ChangeFn } from "automerge";
import { RepoFrontend, ProgressEvent } from "./RepoFrontend";
import { Clock } from "./Clock";
import { Handle } from "./Handle";
export declare type Patch = Patch;
interface Config {
    docId: string;
    actorId?: string;
}
export declare class DocFrontend<T> {
    private docId;
    ready: boolean;
    actorId?: string;
    history: number;
    private changeQ;
    private front;
    private mode;
    private handles;
    private repo;
    clock: Clock;
    constructor(repo: RepoFrontend<T>, config: Config);
    handle(): Handle<T>;
    newState(): void;
    progress(progressEvent: ProgressEvent): void;
    fork: () => string;
    change: (fn: ChangeFn<T>) => void;
    release: () => void;
    setActorId: (actorId: string) => void;
    init: (synced: boolean, actorId?: string | undefined, patch?: Patch | undefined, history?: number | undefined) => void;
    private enableWrites;
    private updateClockChange;
    private updateClockPatch;
    patch: (patch: Patch, synced: boolean, history: number) => void;
    bench(msg: string, f: () => void): void;
    close(): void;
}
export {};
