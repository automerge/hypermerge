import * as Backend from 'automerge/backend';
import { Change, BackDoc } from 'automerge/backend';
import * as Frontend from 'automerge/frontend';
import Queue from './Queue';
import { Clock } from './Clock';
import { ActorId, DocId } from './Misc';
export declare type DocBackendMessage = ReadyMsg | ActorIdMsg | RemotePatchMsg | LocalPatchMsg;
interface ReadyMsg {
    type: 'ReadyMsg';
    id: DocId;
    synced: boolean;
    actorId?: ActorId;
    history?: number;
    patch?: Frontend.Patch;
}
interface ActorIdMsg {
    type: 'ActorIdMsg';
    id: DocId;
    actorId: ActorId;
}
interface RemotePatchMsg {
    type: 'RemotePatchMsg';
    id: DocId;
    actorId?: ActorId;
    synced: boolean;
    patch: Frontend.Patch;
    change?: Change;
    history: number;
}
interface LocalPatchMsg {
    type: 'LocalPatchMsg';
    id: DocId;
    actorId: ActorId;
    synced: boolean;
    patch: Frontend.Patch;
    change: Change;
    history: number;
}
export declare class DocBackend {
    id: DocId;
    actorId?: ActorId;
    clock: Clock;
    back?: BackDoc;
    changes: Map<string, number>;
    ready: Queue<Function>;
    private notify;
    private remoteClock?;
    private synced;
    private localChangeQ;
    private remoteChangesQ;
    constructor(documentId: DocId, notify: (msg: DocBackendMessage) => void, back?: BackDoc);
    testForSync: () => void;
    target: (clock: Clock) => void;
    applyRemoteChanges: (changes: Backend.Change[]) => void;
    applyLocalChange: (change: Backend.Change) => void;
    initActor: (actorId: ActorId) => void;
    updateClock(changes: Change[]): void;
    init: (changes: Backend.Change[], actorId?: ActorId | undefined) => void;
    subscribeToRemoteChanges(): void;
    subscribeToLocalChanges(): void;
    private bench;
}
export {};
