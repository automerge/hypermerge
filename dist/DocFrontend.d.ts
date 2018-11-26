import { Patch, ChangeFn } from "automerge/frontend";
import { RepoFrontend } from "./RepoFrontend";
import { Clock } from "automerge/frontend";
import Handle from "./Handle";
export declare type Patch = Patch;
interface Config {
    docId: string;
    actorId?: string;
}
export declare class DocFrontend<T> {
    private docId;
    private actorId?;
    private changeQ;
    private front;
    private mode;
    private handles;
    private repo;
    clock: Clock;
    constructor(repo: RepoFrontend, config: Config);
    handle(): Handle<T>;
    newState(): void;
    fork: () => string;
    change: (fn: ChangeFn<T>) => void;
    release: () => void;
    setActorId: (actorId: string) => void;
    init: (actorId?: string | undefined, patch?: Patch | undefined) => void;
    private enableWrites;
    _clock(): Clock;
    patch: (patch: Patch) => void;
    bench(msg: string, f: () => void): void;
}
export {};
