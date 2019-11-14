import { RepoId } from './Misc';
import PeerConnection from './PeerConnection';
import Queue from './Queue';
import * as Keys from './Keys';
export declare type PeerId = RepoId & {
    __peerId: true;
};
export default class NetworkPeer {
    selfId: PeerId;
    id: PeerId;
    pendingConnections: Set<PeerConnection>;
    connectionQ: Queue<PeerConnection>;
    closedConnectionCount: number;
    connection: PeerConnection;
    constructor(selfId: PeerId, id: PeerId);
    get isConnected(): boolean;
    /**
     * Determines if we are the authority on which connection to use when
     * duplicate connections are created.
     *
     * @remarks
     * We need to ensure that two peers don't close the other's incoming
     * connection. Comparing our ids ensures only one of the two peers decides
     * which connection to close.
     */
    get weHaveAuthority(): boolean;
    /**
     * Attempts to add a connection to this peer.
     * If this connection is a duplicate of an existing connection, we close it.
     * If we aren't the authority, and we don't have a confirmed connection, we
     * add hold onto it and wait for a ConfirmConnection message.
     */
    addConnection(conn: PeerConnection): void;
    confirmConnection(conn: PeerConnection): void;
    closeConnection(conn: PeerConnection): void;
    close(): void;
}
export declare function encodePeerId(key: Keys.PublicKey): PeerId;
export declare function decodePeerId(id: PeerId): Keys.PublicKey;
