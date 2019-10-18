import NetworkPeer from './NetworkPeer'
import HypercoreProtocol from 'hypercore-protocol'
import FeedStore, { FeedId, FeedInfo } from './FeedStore'
import PeerConnection from './PeerConnection'
import * as Keys from './Keys'
import { getOrCreate, DiscoveryId, joinSets } from './Misc'
import MessageRouter, { Routed } from './MessageRouter'
import pump from 'pump'
import MapSet from './MapSet'
import Queue from './Queue'

type ReplicationMsg = DiscoveryIdsMsg

interface DiscoveryIdsMsg {
  type: 'DiscoveryIds'
  discoveryIds: DiscoveryId[]
}

export interface Discovery {
  feedId: FeedId
  discoveryId: DiscoveryId
  peer: NetworkPeer
}

export default class ReplicationManager {
  private protocols: WeakMap<PeerConnection, HypercoreProtocol>
  private feeds: FeedStore

  messages: MessageRouter<ReplicationMsg>
  replicating: MapSet<NetworkPeer, DiscoveryId>

  discoveryQ: Queue<Discovery>

  constructor(feeds: FeedStore) {
    this.protocols = new WeakMap()
    this.replicating = new MapSet()
    this.discoveryQ = new Queue('ReplicationManager:discoveryQ')
    this.feeds = feeds
    this.messages = new MessageRouter('ReplicationManager')

    this.feeds.info.createdQ.subscribe(this.onFeedCreated)
    this.messages.inboxQ.subscribe(this.onMessage)
  }

  getPeersWith(discoveryIds: DiscoveryId[]): Set<NetworkPeer> {
    return joinSets(discoveryIds.map((id) => this.replicating.keysWith(id)))
  }

  close(): void {
    this.messages.inboxQ.unsubscribe()
  }

  /**
   * Call this when a peer connects.
   */
  onPeer = (peer: NetworkPeer): void => {
    this.replicating.set(peer, new Set())
    this.messages.listenTo(peer)
    this.getOrCreateProtocol(peer)

    if (peer.weHaveAuthority) {
      // NOTE(jeff): In the future, we should send a smaller/smarter set.
      const discoveryIds = this.feeds.info.allDiscoveryIds()
      this.messages.sendToPeer(peer, {
        type: 'DiscoveryIds',
        discoveryIds,
      })
    }
  }

  private replicateWith(peer: NetworkPeer, discoveryIds: DiscoveryId[]): void {
    const protocol = this.getOrCreateProtocol(peer)
    for (const discoveryId of discoveryIds) {
      const publicId = this.feeds.info.getPublicId(discoveryId)
      this.replicating.add(peer, discoveryId)

      if (publicId) {
        // HACK(jeff): The peer has not yet been verified to have this key. They've
        // only _told_ us that they have it:
        this.discoveryQ.push({ feedId: publicId, discoveryId, peer })

        this.feeds.getFeed(publicId).then((feed) => {
          feed.replicate(protocol, { live: true })
        })
      } else {
        console.log('Missing feed id required for replication', { discoveryId })
      }
    }
  }

  private onFeedCreated = ({ discoveryId }: FeedInfo) => {
    this.messages.sendToPeers(this.replicating.keys(), {
      type: 'DiscoveryIds',
      discoveryIds: [discoveryId],
    })
  }

  private onMessage = ({ msg, sender }: Routed<ReplicationMsg>) => {
    switch (msg.type) {
      case 'DiscoveryIds': {
        const existingShared = this.replicating.get(sender)

        const sharedDiscoveryIds = msg.discoveryIds.filter(
          (discoveryId) =>
            !existingShared.has(discoveryId) && this.feeds.info.hasDiscoveryId(discoveryId)
        )

        this.replicateWith(sender, sharedDiscoveryIds)
        break
      }
    }
  }

  private getOrCreateProtocol(peer: NetworkPeer): HypercoreProtocol {
    return getOrCreate(this.protocols, peer.connection, (conn) => {
      const stream = conn.openChannel('FeedReplication')
      const protocol = new HypercoreProtocol(conn.isClient, {
        encrypt: false,
        live: true,
      })

      protocol
        .once('close', () => {
          this.protocols.delete(conn)
        })
        .on('discovery-key', (discoveryKey) => {
          const discoveryId = Keys.encode(discoveryKey)
          // Hypercore verifies that the remote has the feed automatically
          this.replicateWith(peer, [discoveryId])
        })

      pump(stream, protocol, stream)

      return protocol
    })
  }
}
