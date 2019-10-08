import test from 'tape'
import { testPeerPair, expect } from './misc'

test('NetworkPeer', (t) => {
  const [peerA, peerB] = testPeerPair()

  t.test('peer connections', async (t) => {
    t.plan(5)

    peerA.connectionQ.subscribe((conn) => {
      t.assert(conn.isConfirmed, 'peerA gets confirmed connection')
      t.assert(peerA.isConnected, 'peerA is connected')

      const channel = conn.openChannel('PeerTest')
      channel.write(Buffer.from('testing1'))
      channel.write(Buffer.from('testing2'))

      setTimeout(() => {
        conn.openChannel('DelayedPeerTest').on('data', (data: Buffer) => {
          t.equal(data.toString(), 'delayed-testing', 'peerA receives delayed data from peerB')
        })
      }, 50)
    })

    peerB.connectionQ.subscribe((conn) => {
      t.assert(conn.isConfirmed, 'peerB gets confirmed connection')
      t.assert(peerB.isConnected, 'peerB is connected')

      conn
        .openChannel('PeerTest')
        .on(
          'data',
          expect(t, (data: Buffer) => data.toString(), [
            ['testing1', 'peerB gets first peerA msg'],
            ['testing2', 'peerB gets second peerA message'],
          ])
        )

      conn.openChannel('DelayedPeerTest').write(Buffer.from('delayed-testing'))
    })
  })

  test.onFinish(() => {
    peerA.close()
    peerB.close()
  })
})
