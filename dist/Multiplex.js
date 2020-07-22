"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Channel = exports.MsgType = void 0;
const streamx_1 = require("streamx");
const simple_message_channels_1 = __importDefault(require("simple-message-channels"));
const Misc_1 = require("./Misc");
var MsgType;
(function (MsgType) {
    /**
     * Send our localId -> name mapping to the other side.
     *
     * Message body should be the utf-8 channel name.
     */
    MsgType[MsgType["Start"] = 0] = "Start";
    /**
     * Send a chunk of data.
     *
     * Message body is a Buffer.
     */
    MsgType[MsgType["Data"] = 1] = "Data";
    /**
     * Signal to the other side that we won't be sending any more data.
     *
     * Message body is an empty Buffer.
     *
     * If `End` is received before we have opened the same channel locally, we call .end()
     * automatically.
     */
    MsgType[MsgType["End"] = 2] = "End";
    /**
     * Signal to the other side that we are completely closing this channel and will not read or
     * write any more data.
     *
     * Message body is an empty Buffer.
     *
     */
    MsgType[MsgType["Destroy"] = 3] = "Destroy";
})(MsgType = exports.MsgType || (exports.MsgType = {}));
/**
 * Allows many Duplex streams to be sent over a single Duplex.
 */
class Multiplex extends streamx_1.Duplex {
    constructor() {
        super();
        /**
         * Called when a remote frame is decoded by SMC.
         */
        this.onReceivedMsg = (remoteId, type, data) => {
            switch (type) {
                case MsgType.Start: {
                    const name = data.toString();
                    const channel = this.getOrCreateChannel(name);
                    this.remoteChannels.set(remoteId, channel);
                    break;
                }
                case MsgType.Data:
                    this.getChannelByRemoteId(remoteId).push(data);
                    break;
                case MsgType.End: {
                    const channel = this.getChannelByRemoteId(remoteId);
                    channel.push(null);
                    if (!this.isOpen(channel.name))
                        channel.destroy();
                    break;
                }
                case MsgType.Destroy: {
                    const channel = this.getChannelByRemoteId(remoteId);
                    this.remoteChannels.delete(remoteId);
                    channel.destroy();
                    break;
                }
                default:
                    throw new Error(`Unknown MsgType: ${type} channelId: ${remoteId}`);
            }
        };
        this.smc = new simple_message_channels_1.default({
            onmessage: this.onReceivedMsg,
        });
        this.nextId = 0;
        this.remoteChannels = new Map();
        this.channels = new Map();
        this.opened = new Set();
    }
    isOpen(name) {
        return this.opened.has(name);
    }
    /**
     * Open a new `Channel`. Every channel has a `name`, local `id`, and an associated [[RemoteId]].
     */
    openChannel(name) {
        if (this.destroyed)
            throw new Error(`Multiplex is destroyed. Cannot open channel '${name}'.`);
        if (this.isOpen(name))
            throw new Error(`Channel '${name}' is already open.`);
        this.opened.add(name);
        return this.getOrCreateChannel(name);
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            const channels = Array.from(this.channels.values());
            yield Promise.all(channels.map((ch) => ch.close()));
            yield new Promise((res) => {
                this.once('finish', () => res());
                this.end();
            });
        });
    }
    /**
     * Called when the Readable half is requesting data.
     *
     * No need to do anything here; data is pushed in by [[sendMsg]].
     */
    _read(cb) {
        cb();
    }
    _write(chunk, cb) {
        if (this.smc.recv(chunk)) {
            cb();
        }
        else {
            cb(this.smc.error);
        }
    }
    _destroy(cb) {
        for (const channel of this.channels.values()) {
            channel.destroy();
        }
        this.channels.clear();
        this.remoteChannels.clear();
        this.opened.clear();
        cb();
    }
    /**
     * Called by [[Channel]] to send a msg to the remote end.
     */
    sendMsg(localId, name, type, body) {
        switch (type) {
            case MsgType.Destroy:
                this.channels.delete(name);
                this.opened.delete(name);
                break;
        }
        const frame = this.smc.send(localId, type, body);
        this.push(frame);
    }
    getChannelByRemoteId(id) {
        const channel = this.remoteChannels.get(id);
        if (!channel)
            throw new Error(`Unknown remote channelId: ${id}`);
        return channel;
    }
    getOrCreateChannel(name) {
        return Misc_1.getOrCreate(this.channels, name, () => {
            const id = this.getNextId();
            return new Channel(name, id, (type, msg) => this.sendMsg(id, name, type, msg));
        });
    }
    getNextId() {
        return this.nextId++;
    }
}
exports.default = Multiplex;
class Channel extends streamx_1.Duplex {
    constructor(name, id, send) {
        super({
            highWaterMark: 0,
            mapWritable: (data) => (typeof data === 'string' ? Buffer.from(data) : data),
        });
        this.name = name;
        this.id = id;
        this.send = send;
        this.send(MsgType.Start, Buffer.from(this.name));
    }
    /**
     * Calls .end() and returns a promise that resolves when the channel is fully closed. Channels
     * are fully closed when both sides have called .end()
     */
    close() {
        return new Promise((res) => {
            this.once('close', () => res()).end();
        });
    }
    _open(cb) {
        cb();
    }
    /**
     * From Readable.
     *
     * Called when the Readable half of this channel is requesting more data.
     * We have no way to request more data, so it's fine to do nothing here.
     */
    _read(cb) {
        cb();
    }
    /**
     * From Writable.
     *
     * Called when .write() is called locally on this channel.
     */
    _write(chunk, cb) {
        this.send(MsgType.Data, chunk);
        cb();
    }
    /**
     * From Writable.
     *
     * Called when .end() is called locally on the writable half of this channel.
     */
    _final(cb) {
        this.send(MsgType.End, Buffer.alloc(0));
        cb();
    }
    /**
     * From Readable and Writable.
     *
     * Called when .destroy() is called locally, or after both sides have called .end().
     * We are completely done with this channel and no more data will be read or written.
     */
    _destroy(cb) {
        this.send(MsgType.Destroy, Buffer.alloc(0));
        cb();
    }
}
exports.Channel = Channel;
//# sourceMappingURL=Multiplex.js.map