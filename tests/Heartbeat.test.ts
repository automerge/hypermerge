import test from 'tape'
import Heartbeat, { Interval } from '../src/Heartbeat'

test('Interval', (t) => {
  t.test('recurs', (t) => {
    t.plan(3)
    var i = 0
    var failure = setTimeout(() => {
      t.fail('timed out without cancelation')
    }, 150)

    const interval = new Interval(10, () => {
      i += 1
      t.pass(`interval occurred ${i} times`)
      if (i >= 3) {
        interval.stop()
        clearTimeout(failure)
        t.end()
      }
    })
    interval.start()
  })
})

test('Heartbeat', (t) => {
  t.test('beats', (t) => {
    t.plan(1)
    const heartbeat = new Heartbeat(10, {
      onBeat: () => {
        t.pass('heartbeat occurred')
        heartbeat.stop()
        t.end()
      },
      onTimeout: () => {
        t.fail('timed out')
      },
    })
    heartbeat.start()
  })

  t.test('times out', (t) => {
    t.plan(1)
    const heartbeat = new Heartbeat(10, {
      onBeat: () => {},
      onTimeout: () => {
        t.pass('heartbeat occurred')
        heartbeat.stop()
        t.end()
      },
    })
    heartbeat.start()
  })

  t.test('bumps', (t) => {
    t.plan(1)

    setTimeout(() => {
      t.pass("didn't time out after 500ms despite a standard timeout of ~100ms")
      heartbeat.stop()
      t.end()
    }, 250)
    const heartbeat = new Heartbeat(10, {
      onBeat: () => {
        heartbeat.bump()
      },
      onTimeout: () => {
        t.fail('timeout occurred')
      },
    })
    heartbeat.start()
  })
})
