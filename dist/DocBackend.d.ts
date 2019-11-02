import { Change, BackendState as BackDoc, Patch } from 'automerge';
import Queue from './Queue';
import { Clock } from './Clock';
import { ActorId, DocId } from './Misc';
export declare type DocBackendMessage = ReadyMsg | ActorIdMsg | RemotePatchMsg | LocalPatchMsg;
interface ReadyMsg {
    type: 'ReadyMsg';
    doc: DocBackend;
    history?: number;
    patch?: Patch;
}
interface ActorIdMsg {
    type: 'ActorIdMsg';
    id: DocId;
    actorId: ActorId;
}
interface RemotePatchMsg {
    type: 'RemotePatchMsg';
    doc: DocBackend;
    patch: Patch;
    change?: Change;
    history: number;
}
interface LocalPatchMsg {
    type: 'LocalPatchMsg';
    doc: DocBackend;
    patch: Patch;
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
    updateQ: Queue<DocBackendMessage>;
    private localChangeQ;
    private remoteChangesQ;
    constructor(documentId: DocId, back?: BackDoc);
    applyRemoteChanges: (changes: Change[]) => void;
    applyLocalChange: (change: Change) => void;
    initActor: (actorId: ActorId) => void;
    updateClock(changes: Change[]): void;
    init: (changes: Change[], actorId?: ActorId | undefined) => void;
    subscribeToRemoteChanges(): void;
    subscribeToLocalChanges(): void;
    private bench;
}
export {};
