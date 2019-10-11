/// <reference types="node" />
import Queue from './Queue';
import { Duplex } from 'stream';
export default class MessageBus<Msg> {
    stream: Duplex;
    sendQ: Queue<Msg>;
    receiveQ: Queue<Msg>;
    constructor(stream: Duplex);
    onData: (data: Buffer) => void;
    send(msg: Msg): void;
    subscribe(onMsg: (msg: Msg) => void): void;
    unsubscribe(): void;
    close(): void;
}
