import test from 'tape'
import { testStorageFn, testPeerPair, testKeyPair } from './misc'
import ReplicationManager from '../src/ReplicationManager'
import FeedStore from '../src/FeedStore'

test('ReplicationManager', (t) => {
  const [peerA, peerB] = testPeerPair()

  const feedsA = new FeedStore(testStorageFn())
  const feedsB = new FeedStore(testStorageFn())

  const replA = new ReplicationManager(feedsA)
  const replB = new ReplicationManager(feedsB)

  t.test('feed replication', async (t) => {
    t.plan(1)

    const feedId = await feedsA.create(testKeyPair())

    replA.addFeedId(feedId)
    replB.addFeedId(feedId)

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
