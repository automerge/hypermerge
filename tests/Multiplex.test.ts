import test from 'tape'
import Multiplex, { Channel, MsgType } from '../src/Multiplex'
import { testDuplexPair, expectStream, expect } from './misc'
import pump from 'pump'

test('Multiplex', (t) => {
  const [plexA, plexB] = testMultiplexPair()

  t.test('Channel lifecycle', (t) => {
    t.plan(1)

    const channel = new Channel(
      'mychannel',
      1 as any,
      expect(t, (...args) => args, [
        [[MsgType.Start, Buffer.from('mychannel')], 'sends Start msg'],
        [[MsgType.Data, Buffer.from('some_chunk')], 'sends Data'],
        [[MsgType.End, Buffer.alloc(0)], 'sends End msg'],
        [[MsgType.Destroy, Buffer.alloc(0)], 'sends Destroy msg'],
      ])
    )

    channel.write(Buffer.from('some_chunk'))
    channel.close().then(() => {
      t.pass('channel closes fully')
    })
    channel.push(null) // Simulate receiving End by the remote
  })

  t.test('Destroying a channel before it can drain', (t) => {
    t.plan(1)

    const channel = new Channel(
      'mychannel',
      1 as any,
      expect(t, (...args) => args, [
        [[MsgType.Start, Buffer.from('mychannel')], 'sends Start msg'],
        [[MsgType.Destroy, Buffer.alloc(0)], 'sends Destroy msg'],
      ])
    )

    channel.write(Buffer.from('dropped_chunk'))
    channel.on('close', () => {
      t.pass('channel closes after .destroy()')
    })

    channel.destroy()
  })

  t.test('Destroying a channel after data has been sent', (t) => {
    t.plan(1)

    const channel = new Channel(
      'mychannel',
      1 as any,
      expect(t, (...args) => args, [
        [[MsgType.Start, Buffer.from('mychannel')], 'sends Start msg'],
        [[MsgType.Data, Buffer.from('some_chunk')], 'sends chunk'],
        [[MsgType.Destroy, Buffer.alloc(0)], 'sends Destroy'],
      ])
    )

    channel.write(Buffer.from('some_chunk'))
    channel.on('close', () => {
      t.pass('channel closes after .destroy()')
    })

    setTimeout(() => {
      channel.destroy()
    }, 100)
  })

  t.test('open channels concurrently', (t) => {
    t.plan(5)

    const channelA = plexA.openChannel('concurrent')
    const channelB = plexB.openChannel('concurrent')

    channelA.write(Buffer.from('concurrent_from_channelA_1'))
    channelA.write(Buffer.from('concurrent_from_channelA_2'))
    channelA.close().then(() => {
      t.pass('channelA.close() promise resolves')
      t.false(plexA.isOpen('concurrent'), 'plexA sees that the channel is closed')
      t.assert(plexA.channels.get('concurrent') == null, 'plexA removed closed channel')
    })

    channelB.write(Buffer.from('concurrent_from_channelB_1'))
    channelB.write(Buffer.from('concurrent_from_channelB_2'))
    channelB.close().then(() => {
      t.pass('channelB.close() promise resolves')
      t.false(plexB.isOpen('concurrent'), 'plexB sees that the channel is closed')
    })

    expectStream(t, channelB, [
      ['data', Buffer.from('concurrent_from_channelA_1'), 'channelB gets first chunk'],
      ['data', Buffer.from('concurrent_from_channelA_2'), 'channelB gets second chunk'],
      ['end', 'channelB ends after channelA.end()'],
      ['close', 'channelB closes'],
    ])

    expectStream(t, channelA, [
      ['data', Buffer.from('concurrent_from_channelB_1'), 'channelA gets first chunk'],
      ['data', Buffer.from('concurrent_from_channelB_2'), 'channelA gets second chunk'],
      ['end', 'channelA ends after channelB.end()'],
      ['close', 'channelA closes'],
    ])
  })

  t.test('open delayed channel', (t) => {
    t.plan(0)

    const channelA = plexA.openChannel('delayed')

    channelA.write(Buffer.from('delayed_from_channelA_1'))
    channelA.write(Buffer.from('delayed_from_channelA_2'))

    setTimeout(() => {
      const channelB = plexB.openChannel('delayed')

      channelB.write(Buffer.from('delayed_from_channelB_1'))
      channelB.write(Buffer.from('delayed_from_channelB_2'))
      channelB.end()
      channelA.end()

      expectStream(t, channelB, [
        ['data', Buffer.from('delayed_from_channelA_1'), 'channelB gets first delayed chunk'],
        ['data', Buffer.from('delayed_from_channelA_2'), 'channelB gets second delayed chunk'],
        ['end', 'channelB ends'],
        ['close', 'channelB closes'],
      ])
    }, 100)
  })

  t.test('send large chunk', (t) => {
    t.plan(0)

    const channelA = plexA.openChannel('large')
    const channelB = plexB.openChannel('large')

    channelA.write(Buffer.alloc(1024 * 1024, 1))
    channelA.end()
    channelB.end()

    expectStream(t, channelB, [
      ['data', Buffer.alloc(1024 * 1024, 1), 'channelB gets large chunk'],
      ['end', 'channelA ends'],
      ['close', 'channelA closes'],
    ])
  })

  t.test('MsgType.End destroys channel if not opened locally', (t) => {
    t.plan(2)

    const channelA = plexA.openChannel('will_be_destroyed')

    channelA.write(Buffer.from('dropped_from_channelA_1'))
    channelA.write(Buffer.from('dropped_from_channelA_2'))

    channelA.close().then(() => {
      t.false(plexA.channels.has('will_be_destroyed'), 'plexA has removed will_be_destroyed')
      t.false(plexB.channels.has('will_be_destroyed'), 'plexB has removed will_be_destroyed')
    })
  })

  t.test('Closing and opening new channel with same name', (t) => {
    t.plan(3)

    const channelA = plexA.openChannel('close_and_reopen')

    channelA.write(Buffer.from('dropped_from_channelA_1'))
    channelA.write(Buffer.from('dropped_from_channelA_2'))

    channelA.close().then(() => {
      t.false(plexA.channels.has('close_and_reopen'), 'plexA has removed close_and_reopen')
      t.false(plexB.channels.has('close_and_reopen'), 'plexB has removed close_and_reopen')

      const channelA2 = plexA.openChannel('close_and_reopen')
      const channelB2 = plexB.openChannel('close_and_reopen')

      channelA2.write(Buffer.from('data_from_channelA2_1'))
      channelA2.write(Buffer.from('data_from_channelA2_2'))
      channelA2.end()

      channelB2.write(Buffer.from('data_from_channelB2_1'))
      channelB2.write(Buffer.from('data_from_channelB2_2'))
      channelB2.end()

      expectStream(t, channelB2, [
        ['data', Buffer.from('data_from_channelA2_1'), 'channelB2 gets correct first chunk'],
        ['data', Buffer.from('data_from_channelA2_2'), 'channelB2 gets correct second chunk'],
        ['end', 'channelB2 ends'],
        ['close', 'channelB2 closes'],
      ])

      expectStream(t, channelA2, [
        ['data', Buffer.from('data_from_channelB2_1'), 'channelA2 gets correct first chunk'],
        ['data', Buffer.from('data_from_channelB2_2'), 'channelA2 gets correct second chunk'],
        ['end', 'channelA2 ends'],
        ['close', 'channelA2 closes'],
      ])

      t.assert(channelA !== channelA2, 're-opening same channel name creates new channel object')
    })
  })

  t.test('closing Multiplex closes all channels', (t) => {
    t.plan(2)

    const [plexA, plexB] = testMultiplexPair()

    const channelA = plexA.openChannel('channel')
    const channelB = plexB.openChannel('channel')

    channelA.write('from_channelA')
    channelB.write('from_channelB')

    expectStream(t, channelA, [
      ['data', Buffer.from('from_channelB'), 'channelA gets chunk'],
      ['end', 'channelA ends'],
      ['close', 'channelA closes'],
    ])

    expectStream(t, channelB, [
      ['data', Buffer.from('from_channelA'), 'channelB gets chunk'],
      ['end', 'channelB ends'],
      ['close', 'channelB closes'],
    ])

    plexA.close().then(() => {
      t.pass('plexA closes')
    })
    plexB.close().then(() => {
      t.pass('plexB closes')
    })
  })

  test.onFinish(() => {
    plexA.close()
    plexB.close()
  })
})

function testMultiplexPair(): [Multiplex, Multiplex] {
  const [dupA, dupB] = testDuplexPair()
  const plexA = new Multiplex()
  const plexB = new Multiplex()

  pump(dupA, plexA, dupA)
  pump(dupB, plexB, dupB)

  return [plexA, plexB]
}
