import test from 'tape'
import { testSwarm, testDiscoveryId, testNetwork, eachCall } from './misc'
import NetworkPeer, { PeerId } from '../src/NetworkPeer'

interface TestMsg {
  senderId: PeerId
}

test('Network', (t) => {
  t.plan(5)

  const topic = testDiscoveryId()

  const netA = testNetwork()
  const netB = testNetwork()

  netA.addSwarm(testSwarm())
  netB.addSwarm(testSwarm())

  netA.peerQ.subscribe((peer) => {
    t.isEqual(peer.id, netB.selfId, 'netA finds netB')
    t.assert(netA.discovered.size === 1, 'netA records a discovery')

    peer.connection?.openBus<TestMsg>('TestMsg', (msg) => {
      t.deepEqual(msg, { senderId: netB.selfId }, 'netA gets message from netB')
    })
  })

  netB.peerQ.subscribe((peer) => {
    t.isEqual(peer.id, netA.selfId, 'netB finds netA')
    t.assert(netB.discovered.size === 1, 'netB records a discovery')

    peer.connection?.openBus<TestMsg>('TestMsg').send({ senderId: netB.selfId })
  })

  netA.join(topic)
  netB.join(topic)

  test.onFinish(() => {
    netA.close()
    netB.close()
  })
})

test('Re-connecting peers after connection broken', (t) => {
  t.plan(6)

  const topic = testDiscoveryId()

  const netA = testNetwork()
  const netB = testNetwork()

  netA.addSwarm(testSwarm())
  netB.addSwarm(testSwarm())

  netA.join(topic)
  netB.join(topic)

  netA.peerQ.subscribe(
    eachCall([
      (peerA) => {
        t.pass('peerA gets first connection')
        if (!peerA.weHaveAuthority) delayedClose(peerA)
      },
      (peerA) => {
        t.pass('peerA gets second connection')
        if (peerA.weHaveAuthority) delayedClose(peerA)
      },
      (_peerA) => {
        t.pass('peerA gets third connection')
      },
    ])
  )

  netB.peerQ.subscribe(
    eachCall([
      (peerB) => {
        t.pass('peerB gets first connection')
        if (!peerB.weHaveAuthority) delayedClose(peerB)
      },
      (peerB) => {
        t.pass('peerB gets second connection')
        if (peerB.weHaveAuthority) delayedClose(peerB)
      },
      (_peerB) => {
        t.pass('peerB gets third connection')
      },
    ])
  )

  test.onFinish(() => {
    netA.close()
    netB.close()
  })
})

function delayedClose(peer: NetworkPeer) {
  setTimeout(() => {
    peer.connection?.close()
  }, 300)
}
