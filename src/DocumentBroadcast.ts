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
import * as Metadata from './Metadata'
import { DocumentMsg } from './RepoMsg'
import * as Clock from './Clock'
import { Peer } from './hypercore'
import { DocId } from './Misc'

export const EXTENSION_V2 = 'hypermerge.2'
export const EXTENSION_V3 = 'hypermerge.3'
export const SUPPORTED_EXTENSIONS = [EXTENSION_V2, EXTENSION_V3]

export type UnknownMessage = {
  type: 'UnknownMessage'
  contents: string
}

export type BroadcastMessage =
  | Metadata.RemoteMetadata
  | Metadata.NewMetadata
  | DocumentMsg
  | UnknownMessage

export function broadcast(message: BroadcastMessage, peers: Iterable<Peer>) {
  const payload = Buffer.from(JSON.stringify(message))
  for (let peer of peers) {
    peer.stream.extension(EXTENSION_V3, payload)
  }
}

export function broadcastMetadata(
  blocks: Metadata.MetadataBlock[],
  clocks: { [id: string /* ActorId */]: Clock.Clock },
  peers: Iterable<Peer>
) {
  const message: Metadata.RemoteMetadata = { type: 'RemoteMetadata', clocks, blocks }
  broadcast(message, peers)
}

export function broadcastDocumentMessage(id: DocId, contents: any, peers: Iterable<Peer>) {
  const message: DocumentMsg = { type: 'DocumentMessage', id, contents }
  broadcast(message, peers)
}

export function listen(peer: Peer, notify: Function) {
  peer.stream.on('extension', (extension: string, input: Uint8Array) =>
    notify(parseMessage(extension, input))
  )
}

// TODO: can't use constants for the argument types here?
function parseMessage(extension: 'hypermerge.2', input: Uint8Array): Metadata.NewMetadata
function parseMessage(extension: 'hypermerge.3', input: Uint8Array): BroadcastMessage
function parseMessage(extensions: string, input: Uint8Array): void
function parseMessage(extension: string, input: Uint8Array) {
  switch (extension) {
    case EXTENSION_V2: {
      return { type: 'NewMetadata', input }
    }
    case EXTENSION_V3: {
      const message = parseMessageContents(input)
      switch (message.type) {
        case 'RemoteMetadata': {
          Metadata.validateRemoteMetadata(message as Metadata.RemoteMetadata)
          break
        }
        case 'DocumentMessage': {
          // no need to edit the message, we can just pass it through
          break
        }
        default: {
          // unhandled message.
        }
      }
      return message
    }
    default: {
      // Unknown extension type, do nothing.
    }
  }
}

function parseMessageContents(input: Uint8Array): BroadcastMessage {
  try {
    const message: BroadcastMessage = JSON.parse(input.toString())
    return message
  } catch (e) {
    console.log(input.toString())
    console.log('WARNING: Metadata Msg is invalid JSON', e)
    return { type: 'UnknownMessage', contents: input.toString() } as UnknownMessage
  }
}
