/// <reference types="node" />
import { Duplex } from 'stream';
import { SubStream } from 'multiplex';
import MessageBus from './MessageBus';
import { NetworkMsg } from './NetworkMsg';
export interface SocketInfo {
    type: 'tcp' | 'utp';
    isClient: boolean;
    onClose?(): void;
}
export default class PeerConnection {
    networkBus: MessageBus<NetworkMsg>;
    isClient: boolean;
    isConfirmed: boolean;
    type: SocketInfo['type'];
    pendingChannels: Map<string, SubStream>;
    channels: Map<string, SubStream>;
    private rawSocket;
    private multiplex;
    private secureStream;
    private onClose?;
    constructor(rawSocket: Duplex, info: SocketInfo);
    readonly isOpen: boolean;
    readonly isClosed: boolean;
    openChannel(name: string): SubStream;
    close(): Promise<void>;
}
