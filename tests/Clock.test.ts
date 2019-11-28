import test from 'tape'
import { union, cmp, sequenceTotal, getMax, isSatisfied } from '../src/Clock'

test('Clock compare', (t) => {
  const c1 = { a: 100, b: 100, c: 100 }
  const c2 = { a: 101, b: 101, c: 101 }
  const c3 = { a: 101, b: 100, c: 100 }
  const c4 = { a: 100, b: 100, c: 100, d: 1 }
  const c5 = { a: 101, b: 100, c: 100, d: 1 }
  const c6 = { a: 99, b: 101, c: 100, d: 1 }

  t.equal(cmp(c1, c1), 'EQ')
  t.equal(cmp(c1, c2), 'LT')
  t.equal(cmp(c2, c1), 'GT')
  t.equal(cmp(c1, c3), 'LT')
  t.equal(cmp(c3, c1), 'GT')
  t.equal(cmp(c1, c4), 'LT')
  t.equal(cmp(c4, c1), 'GT')
  t.equal(cmp(c1, c5), 'LT')
  t.equal(cmp(c5, c1), 'GT')
  t.equal(cmp(c1, c6), 'CONCUR')
  t.equal(cmp(c6, c1), 'CONCUR')
  t.end()
})

test('Clock union', (t) => {
  const c1 = { a: 100, b: 200, c: 300 }
  const c2 = { b: 10, c: 2000, d: 50 }
  const c3 = union(c1, c2)
  const c4 = union(c2, c1)
  const answer = { a: 100, b: 200, c: 2000, d: 50 }
  t.deepEqual(c3, answer, 'union test 1')
  t.deepEqual(c4, answer, 'union test 1')
  t.deepEqual(c3, c4, 'union is communitive')
  t.end()
})

test('Clock sequenceTotal', (t) => {
  const clock = { a: 1, b: 2, c: 3 }
  const total = sequenceTotal(clock)
  t.equal(total, 6)
  t.end()
})

test('Clock getMax', (t) => {
  t.test('Same actorIds', (t) => {
    const clock1 = { a: 1, b: 2 }
    const clock2 = { a: 2, b: 3 }
    const maxClock = getMax([clock1, clock2])
    t.deepEqual(maxClock, clock2)
    t.end()
  })

  t.test('Different actorIds', (t) => {
    const clock1 = { a: 1, b: 2 }
    const clock2 = { c: 2, d: 3 }
    const maxClock = getMax([clock1, clock2])
    t.deepEqual(maxClock, clock2)
    t.end()
  })

  t.test('Different number of actorIds', (t) => {
    const clock1 = { a: 1, b: 2, c: 1 }
    const clock2 = { a: 2, b: 3 }
    const maxClock = getMax([clock1, clock2])
    t.deepEqual(maxClock, clock2)
    t.end()
  })

  t.test('Equal should return first', (t) => {
    const clock1 = { a: 1, b: 2 }
    const clock2 = { c: 1, d: 2 }
    const maxClock = getMax([clock1, clock2])
    t.deepEqual(maxClock, clock1)
    t.end()
  })
})

test('Clock isSatisfied', (t) => {
  t.test('satisfied', (t) => {
    const target = { a: 1, b: 2 }
    const candidate = { a: 1, b: 2 }
    const satisfied = isSatisfied(target, candidate)
    t.equal(satisfied, true)
    t.end()
  })
  t.test('not satisfied', (t) => {
    const target = { a: 2 }
    const candidate = { a: 1, b: 2 }
    const satisfied = isSatisfied(target, candidate)
    t.equal(satisfied, false)
    t.end()
  })
  t.test('target is superset', (t) => {
    const target = { a: 1, b: 1 }
    const candidate = { a: 1 }
    const satisfied = isSatisfied(target, candidate)
    t.equal(satisfied, false)
    t.end()
  })
  t.test('candidate is superset', (t) => {
    const target = { a: 1 }
    const candidate = { a: 1, b: 1 }
    const satisfied = isSatisfied(target, candidate)
    t.equal(satisfied, true)
    t.end()
  })
  t.test('no overlap', (t) => {
    const target = { a: 1, b: 1 }
    const candidate = { c: 1, d: 4 }
    const satisfied = isSatisfied(target, candidate)
    t.equal(satisfied, false)
    t.end()
  })
})
