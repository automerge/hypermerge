import * as Backend from "automerge/backend";
import { Change, BackDoc } from "automerge/backend";
import { RepoBackend } from "./RepoBackend";
import { Feed, Peer } from "./hypercore";
export interface Clock {
    [actorId: string]: number;
}
export declare class DocBackend {
    docId: string;
    actorId?: string;
    clock: Clock;
    private repo;
    private back?;
    private localChangeQ;
    private remoteChangesQ;
    private wantsActor;
    constructor(core: RepoBackend, docId: string, back?: BackDoc);
    applyRemoteChanges: (changes: Backend.Change[]) => void;
    applyLocalChange: (change: Backend.Change) => void;
    actorIds: () => string[];
    release: () => void;
    initActor: () => void;
    updateClock(changes: Change[]): void;
    init: (changes: Backend.Change[], actorId?: string | undefined) => void;
    subscribeToRemoteChanges(): void;
    subscribeToLocalChanges(): void;
    peers(): Peer[];
    feeds(): Feed<Uint8Array>[];
    broadcast(message: any): void;
    message(peer: Peer, message: any): void;
    messageMetadata(peer: Peer): void;
    broadcastMetadata(): void;
    metadata(): string[];
    private bench;
}
