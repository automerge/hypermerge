import test from 'tape'
import { testStorageFn, testPeerPair, testKeyPair, testDb } from './misc'
import ReplicationManager from '../src/ReplicationManager'
import FeedStore from '../src/FeedStore'

test('ReplicationManager', (t) => {
  const [peerA, peerB] = testPeerPair()

  const feedsA = new FeedStore(testDb(), testStorageFn())
  const feedsB = new FeedStore(testDb(), testStorageFn())

  const replA = new ReplicationManager(feedsA)
  const replB = new ReplicationManager(feedsB)

  peerA.connectionQ.subscribe(() => replA.onPeer(peerA))
  peerB.connectionQ.subscribe(() => replB.onPeer(peerB))

  t.test('feed replication', async (t) => {
    t.plan(3)

    const feedId = await feedsA.create(testKeyPair())

    feedsA.append(feedId, Buffer.from('testing'))

    feedsB.read(feedId, 0).then((data) => {
      t.equal(data.toString(), 'testing', 'feedsB gets block from feedsA')
    })

    t.test('newly created feeds are replicated', async (t) => {
      t.plan(1)

      const feedId2 = await feedsB.create(testKeyPair())

      feedsB.append(feedId2, Buffer.from('testing2'))
      feedsA.read(feedId2, 0).then((data2) => {
        t.equal(data2.toString(), 'testing2', 'feedsA gets late block from feedsB')
      })
    })

    t.test('empty feeds', async (t) => {
      t.plan(2)

      const feedId = await feedsA.create(testKeyPair())
      const feed = await feedsB.getFeed(feedId)
      feed.head((err: Error | null) => {
        t.equal(err && err.message, 'feed is empty', 'gets feed is empty error')

        feedsB.head(feedId).then((block) => {
          t.deepEqual(block, Buffer.from('empty_feed_block_2'), 'gets head block')
        })

        feedsA.append(feedId, Buffer.from('empty_feed_block_1'))
        feedsA.append(feedId, Buffer.from('empty_feed_block_2'))
      })
    })
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
