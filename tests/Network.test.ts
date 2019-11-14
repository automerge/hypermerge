import test from 'tape'
import { testSwarm, testDiscoveryId, testNetwork } from './misc'
import { PeerId } from '../src/NetworkPeer'
import MessageBus from '../src/MessageBus'

interface TestMsg {
  senderId: PeerId
}

test('Network', (t) => {
  t.plan(5)

  const topic = testDiscoveryId()

  const netA = testNetwork()
  const netB = testNetwork()

  netA.setSwarm(testSwarm())
  netB.setSwarm(testSwarm())

  netA.peerQ.subscribe((peer) => {
    t.isEqual(peer.id, netB.selfId, 'netA finds netB')
    t.assert(netA.discovered.size === 1, 'netA records a discovery')

    const bus = new MessageBus<TestMsg>(peer.connection.openChannel('TestMsg'))

    bus.receiveQ.subscribe((msg) => {
      t.deepEqual(msg, { senderId: netB.selfId }, 'netA gets message from netB')
    })
  })

  netB.peerQ.subscribe((peer) => {
    t.isEqual(peer.id, netA.selfId, 'netB finds netA')
    t.assert(netB.discovered.size === 1, 'netB records a discovery')

    const bus = new MessageBus<TestMsg>(peer.connection.openChannel('TestMsg'))
    bus.send({ senderId: netB.selfId })
  })

  netA.join(topic)
  netB.join(topic)

  test.onFinish(() => {
    netA.close()
    netB.close()
  })
})
