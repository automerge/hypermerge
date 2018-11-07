/// <reference types="node" />
import { EventEmitter } from "events";
import * as Backend from "automerge/backend";
import { BackDoc } from "automerge/backend";
import { ToBackendMsg, ToFrontendMsg } from "./DocumentMsg";
import { Peer, Feed, Repo } from ".";
export declare class DocumentBackend extends EventEmitter {
    docId: string;
    actorId?: string;
    private repo;
    private back?;
    private toFrontend;
    private localChangeQ;
    private remoteChangesQ;
    private wantsActor;
    constructor(core: Repo, docId: string, back?: BackDoc);
    applyRemoteChanges: (changes: Backend.Change[]) => void;
    applyLocalChange: (change: Backend.Change) => void;
    actorIds: () => string[];
    release: () => void;
    subscribe: (subscriber: (msg: ToFrontendMsg) => void) => void;
    receive: (msg: ToBackendMsg) => void;
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
