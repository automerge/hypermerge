import * as Backend from "automerge/backend";
import { Change, BackDoc } from "automerge/backend";
import * as Frontend from "automerge/frontend";
import Queue from "./Queue";
import { Clock } from "./Clock";
export declare type DocBackendMessage = ReadyMsg | ActorIdMsg | RemotePatchMsg | LocalPatchMsg;
interface ReadyMsg {
    type: "ReadyMsg";
    id: string;
    synced: boolean;
    actorId?: string;
    history?: number;
    patch?: Frontend.Patch;
}
interface ActorIdMsg {
    type: "ActorIdMsg";
    id: string;
    actorId: string;
}
interface RemotePatchMsg {
    type: "RemotePatchMsg";
    id: string;
    actorId?: string;
    synced: boolean;
    patch: Frontend.Patch;
    change?: Change;
    history: number;
}
interface LocalPatchMsg {
    type: "LocalPatchMsg";
    id: string;
    actorId: string;
    synced: boolean;
    patch: Frontend.Patch;
    change: Change;
    history: number;
}
export declare class DocBackend {
    id: string;
    actorId?: string;
    clock: Clock;
    back?: BackDoc;
    changes: Map<string, number>;
    ready: Queue<Function>;
    private notify;
    private remoteClock?;
    private synced;
    private localChangeQ;
    private remoteChangesQ;
    constructor(documentId: string, notify: (msg: DocBackendMessage) => void, back?: BackDoc);
    testForSync: () => void;
    target: (clock: Clock) => void;
    applyRemoteChanges: (changes: Backend.Change[]) => void;
    applyLocalChange: (change: Backend.Change) => void;
    initActor: (actorId: string) => void;
    updateClock(changes: Change[]): void;
    init: (changes: Backend.Change[], actorId?: string | undefined) => void;
    subscribeToRemoteChanges(): void;
    subscribeToLocalChanges(): void;
    private bench;
}
export {};
