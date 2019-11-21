import test from 'tape'
import { testPeerPair } from './misc'

test('NetworkPeer', (t) => {
  const [peerA, peerB] = testPeerPair()

  t.test('peer connections', async (t) => {
    t.plan(4)

    peerA.connectionQ.subscribe((conn) => {
      t.assert(peerA.connection === conn, 'peerA gets confirmed connection')
      t.assert(peerA.isConnected, 'peerA is connected')
    })

    peerB.connectionQ.subscribe((conn) => {
      t.assert(peerB.connection === conn, 'peerB gets confirmed connection')
      t.assert(peerB.isConnected, 'peerB is connected')
    })
  })

  test.onFinish(() => {
    peerA.close()
    peerB.close()
  })
})
