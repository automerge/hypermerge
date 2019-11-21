/// <reference types="node" />
import Queue from './Queue';
export default class MessageBus<Msg> {
    stream: NodeJS.ReadWriteStream;
    sendQ: Queue<Msg>;
    receiveQ: Queue<Msg>;
    constructor(stream: NodeJS.ReadWriteStream, subscriber?: (msg: Msg) => void);
    onData: (data: Buffer) => void;
    send(msg: Msg): void;
    subscribe(onMsg: (msg: Msg) => void): void;
    unsubscribe(): void;
    close(): void;
}
