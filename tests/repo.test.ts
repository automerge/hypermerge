import test from 'tape'
import { Repo, RepoBackend, RepoFrontend } from '../src'
import { Clock, union, cmp, gte } from '../src/Clock'
import { expectDocs } from './misc'

const ram: Function = require('random-access-memory')

test('Simple create doc and make a change', (t) => {
  const repo = new Repo({ storage: ram })
  const url = repo.create()
  repo.watch<any>(
    url,
    expectDocs(t, [
      [{}, 'blank started doc'],
      [{ foo: 'bar' }, 'change preview'],
      [{ foo: 'bar' }, 'change final'],
    ])
  )
  repo.change<any>(url, (state) => {
    state.foo = 'bar'
  })
  test.onFinish(() => repo.close())
})

test('Create a doc backend - then wire it up to a frontend - make a change', (t) => {
  const back = new RepoBackend({ storage: ram })
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
  const repo = new Repo({ storage: ram })
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
          repo.change<any>(id2, (state) => {
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
  const repo = new Repo({ storage: ram })
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
  repo.change<any>(url, (state) => {
    state.foo = 'bar1'
  })
  repo.change<any>(url, (state) => {
    state.foo = 'bar2'
  })
  repo.change<any>(url, (state) => {
    state.foo = 'bar3'
  })
  test.onFinish(() => repo.close())
})

test('Test meta...', (t) => {
  t.plan(2)
  const repo = new Repo({ storage: ram })
  const id = repo.create({ foo: 'bar0' })
  repo.watch<any>(id, (state, clock, index) => {
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

  repo.change<any>(id, (state) => {
    state.foo = 'bar1'
  })

  repo.change<any>(id, (state) => {
    state.foo = 'bar2'
  })

  test.onFinish(() => repo.close())
})
