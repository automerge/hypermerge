/// <reference types="node" />
import { Duplex } from 'streamx';
export declare enum MsgType {
    /**
     * Send our localId -> name mapping to the other side.
     *
     * Message body should be the utf-8 channel name.
     */
    Start = 0,
    /**
     * Send a chunk of data.
     *
     * Message body is a Buffer.
     */
    Data = 1,
    /**
     * Signal to the other side that we won't be sending any more data.
     *
     * Message body is an empty Buffer.
     *
     * If `End` is received before we have opened the same channel locally, we call .end()
     * automatically.
     */
    End = 2,
    /**
     * Signal to the other side that we are completely closing this channel and will not read or
     * write any more data.
     *
     * Message body is an empty Buffer.
     *
     */
    Destroy = 3
}
declare type RemoteId = number & {
    __remoteChannelId: true;
};
declare type LocalId = number & {
    __localChannelId: true;
};
/**
 * Allows many Duplex streams to be sent over a single Duplex.
 */
export default class Multiplex extends Duplex {
    /** Which channels the remote Multiplex has opened. */
    remoteChannels: Map<RemoteId, Channel>;
    /**
     * Map of channels by name. Are currently open locally, remotely, or both.
     */
    channels: Map<string, Channel>;
    /**
     * Which channels have been explicitly opened locally. Used to ensure that each channel is
     * only opened once.
     */
    opened: Set<string>;
    private nextId;
    private smc;
    constructor();
    isOpen(name: string): boolean;
    /**
     * Open a new `Channel`. Every channel has a `name`, local `id`, and an associated [[RemoteId]].
     */
    openChannel(name: string): Channel;
    close(): Promise<void>;
    /**
     * Called when the Readable half is requesting data.
     *
     * No need to do anything here; data is pushed in by [[sendMsg]].
     */
    _read(cb: () => void): void;
    _write(chunk: Buffer, cb: (err?: Error) => void): void;
    _destroy(cb: () => void): void;
    /**
     * Called by [[Channel]] to send a msg to the remote end.
     */
    private sendMsg;
    /**
     * Called when a remote frame is decoded by SMC.
     */
    private onReceivedMsg;
    private getChannelByRemoteId;
    private getOrCreateChannel;
    private getNextId;
}
export declare class Channel extends Duplex {
    name: string;
    id: LocalId;
    private send;
    constructor(name: string, id: LocalId, send: (type: MsgType, body: Buffer) => void);
    /**
     * Calls .end() and returns a promise that resolves when the channel is fully closed. Channels
     * are fully closed when both sides have called .end()
     */
    close(): Promise<void>;
    _open(cb: () => void): void;
    /**
     * From Readable.
     *
     * Called when the Readable half of this channel is requesting more data.
     * We have no way to request more data, so it's fine to do nothing here.
     */
    _read(cb: () => void): void;
    /**
     * From Writable.
     *
     * Called when .write() is called locally on this channel.
     */
    _write(chunk: Buffer, cb: () => void): void;
    /**
     * From Writable.
     *
     * Called when .end() is called locally on the writable half of this channel.
     */
    _final(cb: (err?: Error) => void): void;
    /**
     * From Readable and Writable.
     *
     * Called when .destroy() is called locally, or after both sides have called .end().
     * We are completely done with this channel and no more data will be read or written.
     */
    _destroy(cb: (err?: Error) => void): void;
}
export {};
