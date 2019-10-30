import test from 'tape'
import { expect, testConnectionPair } from './misc'
import { assignGlobal } from '../src/Debug'

test('PeerConnection', (t) => {
  const [connA, connB] = testConnectionPair()

  assignGlobal({ connA, connB })

  t.test('channels', (t) => {
    t.plan(0)

    const channel = connA.openChannel('ConnTest')
    channel.write('from_connA_1')
    channel.write('from_connA_2')

    connB
      .openChannel('ConnTest')
      .on(
        'data',
        expect(t, String, [
          ['from_connA_1', 'connB gets first connA msg'],
          ['from_connA_2', 'connB gets second connA message'],
        ])
      )
  })

  t.test('delayed channels', (t) => {
    t.plan(0)

    const channelA = connA.openChannel('DelayedConnTest')
    assignGlobal({ channelA })
    channelA.on(
      'data',
      expect(t, String, [
        ['delayed_from_connB_1', 'connA gets delayed message from connB'],
        ['delayed_from_connB_2', 'connA gets another delayed message from connB'],
      ])
    )

    channelA.write('delayed_from_connA_1')
    channelA.write('delayed_from_connA_2')

    setTimeout(() => {
      const channelB = connB.openChannel('DelayedConnTest')
      assignGlobal({ channelB })

      channelB.on(
        'data',
        expect(t, String, [
          ['delayed_from_connA_1', 'connB gets delayed message from connA'],
          ['delayed_from_connA_2', 'connB gets another delayed message from connA'],
        ])
      )

      channelB.write('delayed_from_connB_1')
      channelB.write('delayed_from_connB_2')
    }, 500)
  })

  test.onFinish(() => {
    connA.close()
    connB.close()
  })
})
