import { PeerId } from './NetworkPeer';
export declare type NetworkMsg = InfoMsg | ConfirmConnectionMsg;
export interface InfoMsg {
    type: 'Info';
    peerId: PeerId;
}
export interface ConfirmConnectionMsg {
    type: 'ConfirmConnection';
}
