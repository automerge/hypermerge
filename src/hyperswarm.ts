declare function require(moduleName: string): any;

let _hyperswarm = require("@hyperswarm/network");

import Debug from "debug";
import { ID } from "./Misc";
import { NetworkInterfaceBase } from "os";
const log = Debug("repo:hyperswarm");

type Key = string | Buffer;
type Storage = string | Function;
type Socket = unknown;

export interface Options {
  bootstrap?: string[];
  ephemeral: boolean;
  socket: Socket;
}

export interface JoinOptions {
    announce: boolean;
    lookup: boolean;
}

export interface ConnectionDetails {
    type: string;
    client: string;
    peer: Peer;
}

export interface Peer {
    // opaque type for now
}

export function network(options?: Options): Network
{
    return _hyperswarm(options)
}

export interface Network {
  on(event: "connection", cb: () => void): this;
  on(event: "peer", cb: () => void): this;
  on(event: "update", cb: () => void): this;
  
  join(topic: Buffer, options: JoinOptions): void;
  leave(topic: Buffer): void;

  connect(peer: Peer, cb: (err: Error, socket: Socket, details: ConnectionDetails) => void): this;
}
