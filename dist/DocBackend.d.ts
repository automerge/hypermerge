import { Change, Patch } from "automerge";
import Queue from "./Queue";
import { Clock } from "./Clock";
export declare type DocBackendMessage<T> = ReadyMsg | ActorIdMsg | RemotePatchMsg<T> | LocalPatchMsg<T>;
interface ReadyMsg {
    type: "ReadyMsg";
    id: string;
    synced: boolean;
    actorId?: string;
    history?: number;
    patch?: Patch;
}
interface ActorIdMsg {
    type: "ActorIdMsg";
    id: string;
    actorId: string;
}
interface RemotePatchMsg<T> {
    type: "RemotePatchMsg";
    id: string;
    actorId?: string;
    synced: boolean;
    patch: Patch;
    change?: Change<T>;
    history: number;
}
interface LocalPatchMsg<T> {
    type: "LocalPatchMsg";
    id: string;
    actorId: string;
    synced: boolean;
    patch: Patch;
    change: Change<T>;
    history: number;
}
export declare class DocBackend<T> {
    id: string;
    actorId?: string;
    clock: Clock;
    back?: T;
    changes: Map<string, number>;
    ready: Queue<Function>;
    private notify;
    private remoteClock?;
    private synced;
    private localChangeQ;
    private remoteChangesQ;
    constructor(documentId: string, notify: (msg: DocBackendMessage<T>) => void, back?: T);
    testForSync: () => void;
    target: (clock: Clock) => void;
    applyRemoteChanges: (changes: Change<T>[]) => void;
    applyLocalChange: (change: Change<T>) => void;
    initActor: (actorId: string) => void;
    updateClock(changes: Change<T>[]): void;
    init: (changes: Change<T>[], actorId?: string | undefined) => void;
    subscribeToRemoteChanges(): void;
    subscribeToLocalChanges(): void;
    private bench;
}
export {};
