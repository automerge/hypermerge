import { Patch, ChangeFn } from 'cambria-automerge';
import { RepoFrontend, ProgressEvent } from './RepoFrontend';
import { Clock } from './Clock';
import { Handle } from './Handle';
import { ActorId, DocId } from './Misc';
export { Patch };
interface Config {
    docId: DocId;
    schema?: string;
    actorId?: ActorId;
}
export declare class DocFrontend<T> {
    private docId;
    private docUrl;
    schema?: string;
    ready: boolean;
    actorId?: ActorId;
    history: number;
    private changeQ;
    private front;
    private mode;
    private handles;
    private repo;
    clock: Clock;
    constructor(repo: RepoFrontend, config: Config);
    handle(): Handle<T>;
    newState(): void;
    progress(progressEvent: ProgressEvent): void;
    messaged(contents: any): void;
    fork: () => string;
    change: (fn: ChangeFn<T>) => void;
    release: () => void;
    setActorId: (actorId: ActorId) => void;
    init: (minimumClockSatisfied: boolean, actorId?: ActorId | undefined, patch?: Patch | undefined, history?: number | undefined) => void;
    private enableWrites;
    private updateClockChange;
    private updateClockPatch;
    patch: (patch: Patch, minimumClockSatisfied: boolean, history: number) => void;
    bench(msg: string, f: () => void): void;
    close(): void;
}
