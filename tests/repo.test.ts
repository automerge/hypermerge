import test from 'tape'
import { RepoBackend, RepoFrontend } from '../src'
import { expect, expectDocs, generateServerPath, testRepo } from './misc'
import { validateDocURL } from '../src/Metadata'
import { INFINITY_SEQ } from '../src/CursorStore'
import * as Stream from '../src/StreamLogic'
import * as Crypto from '../src/Crypto'

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

test('Test document merging', (t) => {
  t.plan(5)
  const repo = testRepo()
  const url1 = repo.create({ foo: 'bar' })
  const url2 = repo.create({ baz: 'bah' })

  const id = validateDocURL(url1)
  const id2 = validateDocURL(url2)
  repo.watch<any>(
    url1,
    expectDocs(t, [
      [
        { foo: 'bar' },
        'initial value',
        () => {
          const clock = repo.back.cursors.get(repo.back.id, id)
          t.deepEqual(clock, { [id]: INFINITY_SEQ })
        },
      ],
      [
        { foo: 'bar', baz: 'bah' },
        'merged value',
        () => {
          const clock = repo.back.cursors.get(repo.back.id, id)
          const clock2 = repo.back.cursors.get(repo.back.id, id2)
          t.deepEqual(clock, { [id]: INFINITY_SEQ, [id2]: 1 })
          t.deepEqual(clock2, { [id2]: INFINITY_SEQ })
        },
      ],
    ])
  )

  repo.watch(
    url2,
    expectDocs(t, [
      [{ baz: 'bah' }, 'initial value'],
      [{ baz: 'boo' }, 'change value'],
      [
        { baz: 'boo' },
        'change value echo',
        () => {
          const clock1 = repo.back.cursors.get(repo.back.id, id)
          const clock2 = repo.back.cursors.get(repo.back.id, id2)
          t.deepEqual(clock1, { [id]: INFINITY_SEQ, [id2]: 1 })
          t.deepEqual(clock2, { [id2]: INFINITY_SEQ })
        },
      ],
    ])
  )

  repo.merge(url1, url2)
  repo.change(url2, (doc: any) => {
    doc.baz = 'boo'
  })
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

test('Test signing and verifying', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const url = repo.create({ foo: 'bar0' })
  const message = 'test message'
  const signature = await repo.crypto.sign(url, message)
  const success = await repo.crypto.verify(url, message, signature)
  t.true(success)
  test.onFinish(() => repo.close())
})

test("Test verifying garbage returns false and doesn't throw", async (t) => {
  t.plan(1)
  const repo = testRepo()
  const url = repo.create({ foo: 'bar0' })
  const message = 'test message'
  await repo.crypto.sign(url, message)
  const success = await repo.crypto.verify(
    url,
    message,
    'thisisnotasignature' as Crypto.EncodedSignature
  )
  t.false(success)
  test.onFinish(() => repo.close())
})

test('Test verifying with wrong signature fails', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const url1 = repo.create({ foo: 'bar0' })
  const url2 = repo.create({ foo2: 'bar1' })
  const message = 'test message'
  const signature2 = await repo.crypto.sign(url2, message)
  const success = await repo.crypto.verify(url1, message, signature2)
  t.false(success)
  test.onFinish(() => repo.close())
})

test('Test signing as document from another repo', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const repo2 = testRepo()
  const url = repo.create({ foo: 'bar0' })
  const message = 'test message'
  repo2.crypto
    .sign(url, message)
    .then(() => t.fail('sign() promise should reject'), () => t.pass('Should reject'))
  test.onFinish(() => {
    repo.close()
    repo2.close()
  })
})

test('Test verifying a signature from another repo succeeds', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const repo2 = testRepo()
  const url = repo.create({ foo: 'bar0' })
  const message = 'test message'
  const signature = await repo.crypto.sign(url, message)
  const success = await repo2.crypto.verify(url, message, signature)
  t.true(success)
  test.onFinish(() => {
    repo.close()
    repo2.close()
  })
})

test('Test sealedBox and openSealedBox', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const keyPair = Crypto.encodedEncryptionKeyPair()
  const message = 'test message'
  const sealedBox = await repo.crypto.sealedBox(keyPair.publicKey, message)
  const openedMessage = await repo.crypto.openSealedBox(keyPair, sealedBox)
  t.equal(openedMessage, message)
  test.onFinish(() => {
    repo.close()
  })
})

test('Test open sealed box in another repo', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const repo2 = testRepo()
  const keyPair = Crypto.encodedEncryptionKeyPair()
  const message = 'test message'
  const sealedBox = await repo.crypto.sealedBox(keyPair.publicKey, message)
  const openedMessage = await repo2.crypto.openSealedBox(keyPair, sealedBox)
  t.equal(openedMessage, message)
  test.onFinish(() => {
    repo.close()
    repo2.close()
  })
})

test('Test fails with wrong keypair', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const keyPair = Crypto.encodedEncryptionKeyPair()
  const keyPair2 = Crypto.encodedEncryptionKeyPair()
  const message = 'test message'
  const sealedBox = await repo.crypto.sealedBox(keyPair.publicKey, message)
  repo.crypto
    .openSealedBox(keyPair2, sealedBox)
    .then(() => t.fail('openSealedBox should reject'), () => t.pass('Should reject'))
  test.onFinish(() => {
    repo.close()
  })
})

test('Test encryption key pair', async (t) => {
  t.plan(1)
  const repo = testRepo()
  const keyPair = await repo.crypto.encryptionKeyPair()
  const message = 'test message'
  const sealedBox = await repo.crypto.sealedBox(keyPair.publicKey, message)
  const openedMessage = await repo.crypto.openSealedBox(keyPair, sealedBox)
  t.equal(openedMessage, message)
  test.onFinish(() => {
    repo.close()
  })
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
