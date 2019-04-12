import * as hypercore from "./hypercore"


export interface Address {
    host: string
    port: string
}

export interface Connection {
    type: string
    state: string
    localAddress: Address
    remoteAddress: Address
    bytesReceived: number
    bytesSent: number
}

export interface Peer {
    id: string
    sendMessage: (subject: string, payload: any) => void
    onMessage: (subject: string, callback: Function) => void
}

/**
 * This is pretty hacky, but accessing the hypercore peer connection
 * information is messy. Wrap it here.
 */
export class HypercorePeer implements Peer, Connection {
    id: string
    peer: hypercore.Peer

    constructor(peer: hypercore.Peer) {
        this.id = peer.remoteId.toString()
        this.peer = peer
    }

    valueOf() {
        return this.id
    }

    get conn() {
        return this.peer.stream.stream._readableState.pipes
    }

    get type(): 'UTP' | string {
        return this.conn._utp ? 'UTP' : this.conn._handle.constructor.name
    }

    get state(): string {
        return this.conn._utp ? true : this.conn.readyState
    }

    get localAddress(): Address {
        if (this.conn._utp) {
            const localAddress = this.conn._utp.address()
            return {
                host: localAddress.address,
                port: localAddress.port 
            }
        } else {
            return {
                host: this.conn.localAddress,
                port: this.conn.localPort
            }
        }
    }

    get remoteAddress() : Address {
        return {
            host: this.conn.remoteAddress,
            port: this.conn.remotePort
        }
    }

    get bytesReceived(): number {
        return this.conn._utp ? -1 : this.conn.bytesRead
    }

    get bytesSent(): number {
        return this.conn._utp ? -1 : this.conn.bytesWritten
    }

    sendMessage(subject: string, payload: any): void {
        this.peer.stream.extension(subject, payload)
    }

    onMessage(subject: string, callback: Function): void {
        this.peer.stream.on(subject, callback)
    }
}