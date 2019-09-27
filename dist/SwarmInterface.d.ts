/// <reference types="node" />
import { Socket } from 'net';
export { Socket };
export declare type SocketType = 'tcp' | 'utp';
export interface Swarm {
    join(dk: Buffer, options?: JoinOptions): void;
    leave(dk: Buffer): void;
    on<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this;
    off<K extends keyof SwarmEvents>(name: K, cb: SwarmEvents[K]): this;
    removeAllListeners(): void;
    destroy(cb: () => void): void;
}
export interface SwarmEvents {
    connection(socket: Socket, details: ConnectionDetails): void;
    disconnection(socket: Socket, details: ConnectionDetails): void;
    peer(peer: PeerInfo): void;
    updated(info: {
        key: Buffer;
    }): void;
}
export interface JoinOptions {
    announce?: boolean;
    lookup?: boolean;
}
export interface BaseConnectionDetails {
    type: SocketType;
    reconnect(shouldReconnect: boolean): void;
}
export interface InitiatedConnectionDetails extends BaseConnectionDetails {
    client: true;
    peer: PeerInfo;
}
export interface ReceivedConnectionDetails extends BaseConnectionDetails {
    client: false;
    peer: null;
}
export declare type ConnectionDetails = InitiatedConnectionDetails | ReceivedConnectionDetails;
export interface PeerInfo {
    port: number;
    host: string;
    local: boolean;
    topic: Buffer;
    referrer: null | {
        port: number;
        host: string;
        id: Buffer;
    };
}
