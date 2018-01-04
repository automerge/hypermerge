const assert = require('assert')
const Automerge = require('automerge')

describe('smoke test, no hypercore', () => {
  // https://github.com/inkandswitch/hypermerge/wiki/Smoke-Test
  let alice1, bob1
  it('1. Both Alice and Bob start with the same blank canvas. ' +
     'Both are online.', () => {
    alice1 = Automerge.change(Automerge.init('alice'), doc => {
      doc.grid = [ 'w', 'w', 'w', 'w' ]
    })
    assert.deepEqual(alice1, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'w', 'w', 'w', 'w' ]
    })
    bob1 = Automerge.merge(Automerge.init('bob'), alice1)
    assert.deepEqual(bob1, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'w', 'w', 'w', 'w' ]
    })
  })

  let alice2, bob2
  it('2. Alice makes an edit', () => {
    alice2 = Automerge.change(alice1, doc => { doc.grid[0] = 'r' })
    assert.deepEqual(alice2, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'w', 'w', 'w' ]
    })
    bob2 = bob1
  })

  let alice2a, bob2a
  it(`2a. Alice's edit gets synced over to Bob's canvas`, () => {
    const aliceChanges2a = Automerge.getChanges(alice1, alice2)
    bob2a = Automerge.applyChanges(bob2, aliceChanges2a)
    alice2a = alice2
    assert.deepEqual(bob2a, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'w', 'w', 'w' ]
    })
    assert.deepEqual(bob2a._conflicts, {})
  })

  let alice3, bob3
  it('3. Bob makes an edit', () => {
    bob3 = Automerge.change(bob2a, doc => { doc.grid[3] = 'b' })
    alice3 = alice2a
    assert.deepEqual(bob3, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'w', 'w', 'b' ]
    })
  })

  let alice3a, bob3a
  it(`3a. Bob's edit gets synced to Alice's canvas`, () => {
    const bobChanges3a = Automerge.getChanges(bob2, bob3)
    alice3a = Automerge.applyChanges(alice3, bobChanges3a)
    bob3a = bob3
    assert.deepEqual(alice3a, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'w', 'w', 'b' ]
    })
    assert.deepEqual(alice3a._conflicts, {})
  })

  let alice4, bob4
  it('4. Alice and/or Bob go offline', () => {
    alice4 = alice3a
    bob4 = bob3a
  })

  let alice5, bob5
  it('5. Both Alice and Bob make edits while offline', () => {
    alice5 = Automerge.change(alice4, doc => {
      doc.grid[1] = 'g'
      doc.grid[3] = 'r'
    })
    bob5 = Automerge.change(bob4, doc => {
      doc.grid[1] = 'g'
      doc.grid[3] = 'w'
    })
    assert.deepEqual(alice5, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'g', 'w', 'r' ]
    })
    assert.deepEqual(bob5, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'g', 'w', 'w' ]
    })
  })

  let alice6, bob6
  it('6. Alice and Bob both go back online, and re-sync', () => {
    const aliceChanges6 = Automerge.getChanges(alice3, alice5)
    const bobChanges6 = Automerge.getChanges(bob3, bob5)
    alice6 = Automerge.applyChanges(alice5, bobChanges6)
    bob6 = Automerge.applyChanges(bob5, aliceChanges6)
    // FIXME: I was trying to get a _conflicts, but I probably
    // did something wrong
    assert.deepEqual(alice6, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'g', 'w', 'w' ]
    })
    assert.deepEqual(alice6._conflicts, {})
    assert.deepEqual(bob6, {
      _objectId: '00000000-0000-0000-0000-000000000000',
      grid: [ 'r', 'g', 'w', 'w' ]
    })
    assert.deepEqual(bob6._conflicts, {})
  })
})
