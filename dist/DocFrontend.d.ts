import { Patch, ChangeFn } from "automerge/frontend";
import { RepoFrontend } from "./RepoFrontend";
import { Clock } from "./Clock";
import { Handle } from "./Handle";
export declare type Patch = Patch;
interface Config {
    docId: string;
    actorId?: string;
}
export declare class DocFrontend<T> {
    private docId;
    actorId?: string;
    private changeQ;
    private front;
    private mode;
    private handles;
    private repo;
    private history;
    clock: Clock;
    constructor(repo: RepoFrontend, config: Config);
    handle(): Handle<T>;
    newState(): void;
    fork: () => string;
    change: (fn: ChangeFn<T>) => void;
    release: () => void;
    setActorId: (actorId: string) => void;
    init: (actorId?: string | undefined, patch?: Patch | undefined, history?: number | undefined) => void;
    private enableWrites;
    private updateClockChange;
    private updateClockPatch;
    patch: (patch: Patch, history: number) => void;
    bench(msg: string, f: () => void): void;
}
export {};
