/// <reference types="node" />
import { DiscoveryId } from './Misc';
import { Socket } from 'net';
import Queue from './Queue';
import { ConnectionDetails } from './SwarmInterface';
import HypercoreProtocol from 'hypercore-protocol';
export declare type PeerId = DiscoveryId & {
    peerId: true;
};
export declare type SocketType = 'tcp' | 'utp';
export interface SocketInfo {
    type: SocketType;
    selfId: PeerId;
    peerId: PeerId;
    isClient: boolean;
}
export interface InfoMsg {
    type: 'Info';
    peerId: PeerId;
}
export default class NetworkPeer<Msg> {
    selfId: PeerId;
    id: PeerId;
    connection?: PeerConnection<Msg>;
    constructor(selfId: PeerId, id: PeerId);
    readonly isConnected: boolean;
    /**
     * Attempts to add a connection to this peer.
     * If this connection is a duplicate of an existing connection, we close it
     * and return `false`.
     */
    addConnection(conn: PeerConnection<Msg>): boolean;
    shouldUseNewConnection(existing: PeerConnection<Msg>, other: PeerConnection<Msg>): boolean;
    close(): void;
}
export declare class PeerConnection<Msg> {
    isClient: boolean;
    selfId: PeerId;
    peerId: PeerId;
    type: SocketType;
    socket: Socket;
    protocol: HypercoreProtocol;
    networkMessages: MessageBus<InfoMsg>;
    messages: MessageBus<Msg>;
    discoveryIds: Set<DiscoveryId>;
    discoveryQ: Queue<DiscoveryId>;
    static fromSocket<Msg>(socket: Socket, selfId: PeerId, details: ConnectionDetails): Promise<PeerConnection<Msg>>;
    constructor(socket: Socket, networkMessages: MessageBus<InfoMsg>, info: SocketInfo);
    readonly isOpen: boolean;
    readonly isClosed: boolean;
    readonly initiatorId: PeerId;
    addDiscoveryIds(ids: Iterable<DiscoveryId>): void;
    addDiscoveryId(discoveryId: DiscoveryId): void;
    close(): void;
}
export declare const NETWORK_MESSAGE_BUS_KEY: Buffer;
export declare const GENERIC_MESSAGE_BUS_KEY: Buffer;
export declare class MessageBus<Msg> {
    key: Buffer;
    discoveryId: DiscoveryId;
    protocol: HypercoreProtocol;
    channel: any;
    sendQ: Queue<Msg>;
    receiveQ: Queue<Msg>;
    constructor(protocol: HypercoreProtocol, key: Buffer);
    send(msg: Msg): void;
    subscribe(onMsg: (msg: Msg) => void): void;
    unsubscribe(): void;
    close(): void;
}
export declare function isPeerId(str: string): str is PeerId;
export declare function encodePeerId(buffer: Buffer): PeerId;
export declare function decodePeerId(id: PeerId): Buffer;
