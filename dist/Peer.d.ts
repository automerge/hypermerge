import * as hypercore from "./hypercore";
export interface Address {
    host: string;
    port: string;
}
export interface Connection {
    type: string;
    state: string;
    localAddress: Address;
    remoteAddress: Address;
    bytesReceived: number;
    bytesSent: number;
}
export interface Peer {
    id: string;
    sendMessage: (subject: string, payload: any) => void;
    onMessage: (subject: string, callback: Function) => void;
}
/**
 * This is pretty hacky, but accessing the hypercore peer connection
 * information is messy. Wrap it here.
 */
export declare class HypercorePeer implements Peer, Connection {
    id: string;
    peer: hypercore.Peer;
    constructor(peer: hypercore.Peer);
    valueOf(): string;
    readonly conn: any;
    readonly type: 'UTP' | string;
    readonly state: string;
    readonly localAddress: Address;
    readonly remoteAddress: Address;
    readonly bytesReceived: number;
    readonly bytesSent: number;
    sendMessage(subject: string, payload: any): void;
    onMessage(subject: string, callback: Function): void;
}
