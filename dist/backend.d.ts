/// <reference types="node" />
import { EventEmitter } from "events";
import * as Backend from "automerge/backend";
import { BackDoc } from "automerge/backend";
import { Peer, Feed, Hypermerge } from ".";
export declare class BackendManager extends EventEmitter {
    docId: string;
    actorId?: string;
    private hypermerge;
    private back?;
    private localChangeQ;
    private remoteChangesQ;
    private wantsActor;
    constructor(core: Hypermerge, docId: string, back?: BackDoc);
    applyRemoteChanges: (changes: Backend.Change[]) => void;
    applyLocalChange: (change: Backend.Change) => void;
    actorIds: () => string[];
    release: () => void;
    initActor: () => void;
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
