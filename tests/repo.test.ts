import test from 'tape'
import { RepoBackend, RepoFrontend } from '../src'
import { expect, expectDocs, generateServerPath, testRepo } from './misc'
import { validateDocURL } from '../src/Metadata'
import * as Stream from '../src/StreamLogic'

test('Simple create doc and make a change', (t) => {
  const repo = testRepo()
  const url = repo.create()
  repo.watch<any>(
    url,
    expectDocs(t, [
      [{}, 'blank started doc'],
      [{ foo: 'bar' }, 'change preview'],
      [{ foo: 'bar' }, 'change final'],
    ])
  )

  repo.change<any>(url, (state: any) => {
    state.foo = 'bar'
  })

  test.onFinish(() => repo.close())
})

test('Create a doc backend - then wire it up to a frontend - make a change', (t) => {
  const back = new RepoBackend({ memory: true })
  const front = new RepoFrontend()
  back.subscribe(front.receive)
  front.subscribe(back.receive)
  const url = front.create()
  front.watch<any>(
    url,
    expectDocs(t, [
      [{}, 'blank started doc'],
      [{ foo: 'bar' }, 'change preview'],
      [{ foo: 'bar' }, 'change final'],
    ])
  )
  front.change<any>(url, (state) => {
    state.foo = 'bar'
  })
  test.onFinish(() => front.close())
})

test('Test document forking...', (t) => {
  t.plan(0)
  const repo = testRepo()
  const id = repo.create({ foo: 'bar' })
  repo.watch<any>(id, expectDocs(t, [[{ foo: 'bar' }, 'init val']]))
  const id2 = repo.fork(id)
  repo.watch<any>(
    id2,
    expectDocs(t, [
      [{}, 'hmm'],
      [
        { foo: 'bar' },
        'init val',
        () => {
          repo.change<any>(id2, (state: any) => {
            state.bar = 'foo'
          })
        },
      ],
      [{ foo: 'bar', bar: 'foo' }, 'changed val'],
      [{ foo: 'bar', bar: 'foo' }, 'changed val echo'],
    ])
  )
  test.onFinish(() => repo.close())
})

test('Test materialize...', (t) => {
  t.plan(1)
  const repo = testRepo()
  const url = repo.create({ foo: 'bar0' })
  repo.watch<any>(
    url,
    expectDocs(t, [
      [{ foo: 'bar0' }, 'init val'],
      [{ foo: 'bar1' }, 'changed val'],
      [{ foo: 'bar1' }, 'changed val echo'],
      [{ foo: 'bar2' }, 'changed val'],
      [{ foo: 'bar2' }, 'changed val echo'],
      [{ foo: 'bar3' }, 'changed val'],
      [
        { foo: 'bar3' },
        'changed val echo',
        () => {
          repo.materialize<any>(url, 2, (state) => {
            t.equal(state.foo, 'bar1')
          })
        },
      ],
    ])
  )

  repo.change<any>(url, (state: any) => {
    state.foo = 'bar1'
  })
  repo.change<any>(url, (state: any) => {
    state.foo = 'bar2'
  })
  repo.change<any>(url, (state: any) => {
    state.foo = 'bar3'
  })
  test.onFinish(() => repo.close())
})

test('Test meta...', (t) => {
  t.plan(2)
  const repo = testRepo()
  const id = repo.create({ foo: 'bar0' })
  repo.watch<any>(id, (_state, _clock, index) => {
    repo.meta(id, (meta) => {
      if (meta && meta.type === 'Document') {
        if (index === 1) {
          const actor = meta.actor!
          const seq = meta.clock[actor]
          t.equal(seq, 3)
        }
        if (index === 3) {
          const actor = meta.actor!
          const seq = meta.clock[actor]
          t.equal(seq, 3)
          t.end()
        }
      }
    })
  })

  repo.change<any>(id, (state: any) => {
    state.foo = 'bar1'
  })

  repo.change<any>(id, (state: any) => {
    state.foo = 'bar2'
  })

  test.onFinish(() => repo.close())
})

test('Writing and reading files works', async (t) => {
  t.plan(1)

  const repo = testRepo()
  repo.startFileServer(generateServerPath())

  const pseudoFile = Buffer.alloc(1024 * 1024, 1)
  const { url } = await repo.files.write(Stream.fromBuffer(pseudoFile), 'application/octet-stream')
  const [, readable] = await repo.files.read(url)
  const buffer = await Stream.toBuffer(readable)

  t.deepEqual(pseudoFile, buffer)

  repo.close()
})

test('Changing a document updates the clock store', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const url = repo.create()
  const docId = validateDocURL(url)

  // We'll make one change
  const expectedClock = { [docId]: 1 }

  // Clock passed to `watch` matches expected clock.
  repo.watch<any>(
    url,
    expect(t, arg2, [
      [{}, 'empty state'],
      [expectedClock, 'change preview'],
      [expectedClock, 'change final'],
    ])
  )

  repo.change<any>(url, (state: any) => {
    state.foo = 'bar'
  })

  // Note: the interface of repo.change doesn't guarantee this
  // won't race - but it doesn't. We should change this test such
  // that a race can't be introduced.
  t.deepEqual(expectedClock, repo.back.clocks.get(repo.id, docId))
  // Clock is stored in ClockStore and matches expected value
  // NOTE: this will fire twice because we have a bug which
  // applies change twice.
  // repo.back.clocks.updateLog.subscribe(([docId, clock]) => {
  //   t.deepEqual(expectedClock, clock)
  // })
})

function arg2<T>(_arg1: unknown, arg2: T): T {
  return arg2
}
