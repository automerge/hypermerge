/// <reference types="node" />
import { Duplex } from 'stream';
import { Channel } from './Multiplex';
import MessageBus from './MessageBus';
declare type CloseReason = 'outdated' | 'timeout' | 'error' | 'shutdown' | 'self-connection' | 'unknown';
export interface SocketInfo {
    type: string;
    isClient: boolean;
}
export default class PeerConnection {
    isClient: boolean;
    type: SocketInfo['type'];
    id?: string;
    onClose?: (reason: CloseReason) => void;
    private heartbeat;
    private rawSocket;
    private multiplex;
    private secureStream;
    private internalBus;
    constructor(rawSocket: Duplex, info: SocketInfo);
    get isOpen(): boolean;
    get isClosed(): boolean;
    openBus<M>(name: string, subscriber?: (msg: M) => void): MessageBus<M>;
    openChannel(name: string): Channel;
    close(reason?: CloseReason): void;
    private onMsg;
    private closeOutdated;
    private log;
}
export {};
