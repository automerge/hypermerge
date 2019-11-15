import test from 'tape'
import * as TraverseLogic from '../src/TraverseLogic'
import * as Automerge from 'automerge'

test('Test TraverseLogic', (t) => {
  t.test('Test arrays', (t) => {
    t.plan(1)
    const val = [1, 2, 3, 4, 3, 2, 1]
    const select = (val: unknown) => val === 2
    const results = TraverseLogic.iterativeDfs(select, val)
    t.deepEqual(results, [2, 2])
  })

  t.test('Test objects', (t) => {
    t.plan(1)
    const val = { foo: { bar: 'baz' } }
    const select = (val: unknown) => val === 'baz'
    const results = TraverseLogic.iterativeDfs(select, val)
    t.deepEqual(results, ['baz'])
  })

  t.test('Test does not iterate strings', (t) => {
    t.plan(1)
    const val = 'helloooooo'
    const select = (val: unknown) => val === 'o'
    const results = TraverseLogic.iterativeDfs(select, val)
    t.deepEqual(results, [])
  })

  t.test('Test selects keys', (t) => {
    t.plan(1)
    const val = { foo: [{ bar: 'baz' }] }
    const select = (val: unknown) => val === 'bar'
    const results = TraverseLogic.iterativeDfs(select, val)
    t.deepEqual(results, ['bar'])
  })

  t.test("Test Automerge.Text isn't traversed", function(t) {
    t.plan(1)
    const doc = Automerge.change(Automerge.init(), function(doc: any) {
      doc.text = new Automerge.Text()
      doc.text.insertAt(0, 't', 'e', 's', 't')
    })
    const results = TraverseLogic.iterativeDfs((val: any) => val === 't', doc)
    t.equals(results.length, 0)
  })
})
