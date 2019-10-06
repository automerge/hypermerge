/// <reference types="node" />
import { Socket } from 'net';
import { SubStream } from 'multiplex';
import MessageChannel from './MessageChannel';
import { NetworkMsg } from './NetworkMsg';
export interface SocketInfo {
    type: 'tcp' | 'utp';
    isClient: boolean;
}
export default class PeerConnection {
    networkChannel: MessageChannel<NetworkMsg>;
    isClient: boolean;
    isConfirmed: boolean;
    type: SocketInfo['type'];
    private channels;
    private rawSocket;
    private multiplex;
    private secureStream;
    constructor(rawSocket: Socket, info: SocketInfo);
    readonly isOpen: boolean;
    readonly isClosed: boolean;
    openChannel(name: string): SubStream;
    close(): Promise<void>;
}
