import test from 'tape'
import { testStorageFn, testPeerPair, testKeyPair, expect } from './misc'
import ReplicationManager from '../src/ReplicationManager'
import FeedStore from '../src/FeedStore'
import { toDiscoveryId } from '../src/Misc'

test('ReplicationManager', (t) => {
  const [peerA, peerB] = testPeerPair()

  const feedsA = new FeedStore(testStorageFn())
  const feedsB = new FeedStore(testStorageFn())

  const replA = new ReplicationManager(feedsA)
  const replB = new ReplicationManager(feedsB)

  feedsA.feedIdQ.subscribe((id) => replA.addFeedIds([id]))
  feedsB.feedIdQ.subscribe((id) => replB.addFeedIds([id]))

  t.test('feed replication', async (t) => {
    t.plan(1)

    const feedId = await feedsA.create(testKeyPair())
    const discoveryId = toDiscoveryId(feedId)

    replA.discoveryQ.subscribe(
      expect(t, (x) => x, [
        [{ peer: peerA, feedId, discoveryId }, 'replA discovers the feed from peerA'],
      ])
    )

    replB.discoveryQ.subscribe(
      expect(t, (x) => x, [
        [{ peer: peerB, feedId, discoveryId }, 'replB discovers the feed from peerB'],
      ])
    )

    feedsA.append(feedId, Buffer.from('testing'))

    feedsB.read(feedId, 0).then((data) => {
      t.equal(data.toString(), 'testing', 'feedsB gets block from feedsA')
    })

    peerA.connectionQ.subscribe(() => replA.onPeer(peerA))
    peerB.connectionQ.subscribe(() => replB.onPeer(peerB))
  })

  test.onFinish(async () => {
    replA.close()
    replB.close()

    feedsA.close()
    feedsB.close()

    peerA.close()
    peerB.close()
  })
})
