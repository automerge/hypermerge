import * as Backend from "automerge/backend";
import { Change, BackDoc } from "automerge/backend";
import Queue from "./Queue";
import { RepoBackend } from "./RepoBackend";
export interface Clock {
    [actorId: string]: number;
}
export declare class DocBackend {
    id: string;
    actorId?: string;
    clock: Clock;
    back?: BackDoc;
    private repo;
    ready: Queue<Function>;
    private localChangeQ;
    private remoteChangesQ;
    private wantsActor;
    constructor(core: RepoBackend, id: string, back?: BackDoc);
    applyRemoteChanges: (changes: Backend.Change[]) => void;
    applyLocalChange: (change: Backend.Change) => void;
    release: () => void;
    initActor: () => void;
    updateClock(changes: Change[]): void;
    init: (changes: Backend.Change[], actorId?: string | undefined) => void;
    subscribeToRemoteChanges(): void;
    subscribeToLocalChanges(): void;
    private bench;
}
