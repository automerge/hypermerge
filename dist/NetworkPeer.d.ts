/// <reference types="node" />
import { DiscoveryId } from './Misc';
export declare type PeerId = DiscoveryId & {
    peerId: true;
};
declare type HypercoreProtocol = any;
export default class NetworkPeer {
    id: PeerId;
    protocol: HypercoreProtocol;
    constructor(id: PeerId);
}
export declare function encodePeerId(buffer: Buffer): PeerId;
export declare function decodePeerId(id: PeerId): Buffer;
export {};
