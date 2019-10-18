import test from 'tape'
import { testStorageFn, testPeerPair, testKeyPair, expect, testDb } from './misc'
import ReplicationManager from '../src/ReplicationManager'
import FeedStore from '../src/FeedStore'
import { toDiscoveryId } from '../src/Misc'

test('ReplicationManager', (t) => {
  const [peerA, peerB] = testPeerPair()

  const feedsA = new FeedStore(testDb(), testStorageFn())
  const feedsB = new FeedStore(testDb(), testStorageFn())

  const replA = new ReplicationManager(feedsA)
  const replB = new ReplicationManager(feedsB)

  t.test('feed replication', async (t) => {
    t.plan(2)

    const feedId = await feedsA.create(testKeyPair())
    const discoveryId = toDiscoveryId(feedId)

    feedsA.append(feedId, Buffer.from('testing'))

    feedsB.read(feedId, 0).then((data) => {
      t.equal(data.toString(), 'testing', 'feedsB gets block from feedsA')

      t.test('newly created feeds are replicated', async (t) => {
        t.plan(1)

        const feedId2 = await feedsB.create(testKeyPair())
        const discoveryId2 = toDiscoveryId(feedId2)

        feedsB.append(feedId2, Buffer.from('testing2'))
        feedsA.read(feedId2, 0).then((data2) => {
          t.equal(data2.toString(), 'testing2', 'feedsA gets late block from feedsB')
        })

        replA.discoveryQ.subscribe(
          expect(t, (x) => x, [
            [{ peer: peerA, feedId, discoveryId }, 'replA discovers the feed from peerA'],
            [
              { peer: peerA, feedId: feedId2, discoveryId: discoveryId2 },
              'replA discovers the second feed from peerA',
            ],
          ])
        )

        replB.discoveryQ.subscribe(
          expect(t, (x) => x, [
            [{ peer: peerB, feedId, discoveryId }, 'replB discovers the feed from peerB'],
            [
              { peer: peerB, feedId: feedId2, discoveryId: discoveryId2 },
              'replB discovers the second feed from peerB',
            ],
          ])
        )
      })
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
