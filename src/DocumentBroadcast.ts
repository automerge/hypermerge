/**
 * Communicate document information required to replicate documents and their actors.
 * 
 * TODO: Rename. Discover? Advertise?
 * 
 * TODO: Clean up dependency on Metadata. The extension should know its own format and
 * translate that to something metadata can use.
 * 
 * TODO: Move more of the logic for which peers to send messages to into this module. Will require
 * a data structure representing the actor/peers/document relationships which this module can operate on.
 */
import * as Metadata from "./Metadata"
import * as Clock from "./Clock"
import * as Peer from "./Peer"


export const EXTENSION_V2 = "hypermerge.2"
export const EXTENSION_V3 = "hypermerge.3"
export const SUPPORTED_EXTENSIONS = [EXTENSION_V2, EXTENSION_V3]

export type BroadcastMessage =
    | Metadata.RemoteMetadata
    | Metadata.NewMetadata


export function broadcast(
    blocks: Metadata.MetadataBlock[],
    clocks: { [id: string]: Clock.Clock },
    peers: Iterable<Peer.Peer>
  ) {
    const message: Metadata.RemoteMetadata = { type: "RemoteMetadata", clocks, blocks }
    const payload = Buffer.from(JSON.stringify(message))
    for (let peer of peers) {
        peer.sendMessage(EXTENSION_V3, payload)
    }
}

export function listen(peer: Peer.Peer, notify: Function) {
    peer.onMessage(
        "extension",
        (extension: string, input: Uint8Array) => notify(parseMessage(extension, input))
    )
}

// TODO: can't use constants for the argument types here?
function parseMessage(extension: "hypermerge.2", input: Uint8Array): Metadata.NewMetadata
function parseMessage(extension: "hypermerge.3", input: Uint8Array): Metadata.RemoteMetadata
function parseMessage(extensions: string, input: Uint8Array): void
function parseMessage(extension: string, input: Uint8Array) {
    switch (extension) {
        case EXTENSION_V2: {
            return { type: "NewMetadata", input }
        }
        case EXTENSION_V3: {
            const message = Metadata.validateRemoteMetadata(input)
            return message
        }
        default: {
            // Unknown extension type, do nothing.
        }
    }
}