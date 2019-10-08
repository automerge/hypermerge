import NetworkPeer from './NetworkPeer'
import HypercoreProtocol from 'hypercore-protocol'
import FeedStore, { FeedId } from './FeedStore'
import PeerConnection from './PeerConnection'
import { getOrCreate, encodeDiscoveryId, DiscoveryId, toDiscoveryId, decodeId } from './Misc'
import MessageCenter, { Routed } from './MessageCenter'
import pump from 'pump'
import MapSet from './MapSet'

type ReplicationMsg = AllDiscoveryIdsMsg

interface AllDiscoveryIdsMsg {
  type: 'AllDiscoveryIds'
  discoveryIds: DiscoveryId[]
}

export default class ReplicationManager {
  private discoveryIds: Map<DiscoveryId, FeedId>
  private messages: MessageCenter<ReplicationMsg>
  private peers: MapSet<DiscoveryId, NetworkPeer>

  feeds: FeedStore
  protocols: WeakMap<PeerConnection, HypercoreProtocol>

  constructor(feeds: FeedStore) {
    this.discoveryIds = new Map()
    this.protocols = new WeakMap()
    this.peers = new MapSet()
    this.feeds = feeds
    this.messages = new MessageCenter('ReplicationManager')
    this.messages.inboxQ.subscribe(this.onMessage)
  }

  addFeedIds(feedIds: FeedId[]): void {
    feedIds.forEach((id) => this.addFeedId(id))
  }

  addFeedId(feedId: FeedId): void {
    this.discoveryIds.set(toDiscoveryId(feedId), feedId)
  }

  getFeedId(discoveryId: DiscoveryId): FeedId | undefined {
    return this.discoveryIds.get(discoveryId)
  }

  close(): void {
    this.messages.inboxQ.unsubscribe()
  }

  onPeer = (peer: NetworkPeer): void => {
    this.messages.listenTo(peer)
    this.getOrCreateProtocol(peer)

    if (peer.weHaveAuthority) {
      // NOTE(jeff): In the future, we should send a smaller/smarter set.
      const discoveryIds = Array.from(this.discoveryIds.keys())

      this.messages.sendToPeer(peer, {
        type: 'AllDiscoveryIds',
        discoveryIds,
      })
    }
  }

  private replicateWith(peer: NetworkPeer, discoveryIds: DiscoveryId[]): void {
    const protocol = this.getOrCreateProtocol(peer)
    for (const discoveryId of discoveryIds) {
      const feedId = this.getFeedId(discoveryId)
      if (feedId) {
        this.feeds.getFeed(feedId).then((feed) => {
          feed.replicate(protocol, { live: true })
        })
      }
    }
  }

  private onMessage = ({ msg, sender }: Routed<ReplicationMsg>) => {
    switch (msg.type) {
      case 'AllDiscoveryIds': {
        const sharedDiscoveryIds = msg.discoveryIds.filter((discoveryId) =>
          this.discoveryIds.has(discoveryId)
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
      })

      protocol.on('discovery-key', (discoveryKey) => {
        const discoveryId = encodeDiscoveryId(discoveryKey)
        const feedId = this.getFeedId(discoveryId)

        if (feedId && protocol.remoteVerified(decodeId(feedId))) {
          this.replicateWith(peer, [discoveryId])
        } else {
          protocol.close(discoveryKey)
        }
      })

      pump(stream, protocol, stream)

      return protocol
    })
  }
}
