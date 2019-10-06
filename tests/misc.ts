import test from 'tape'
import uuid from 'uuid/v4'
import { Repo } from '../src'
import Hyperswarm from 'hyperswarm'

type DocMsg = [any, string]
type DocMsgCB = [any, string, any]
type DocInfo = DocMsg | DocMsgCB

type Expected<T> = [T, string] | [T, string, Function]

export function testRepo() {
  // Note: We must pass a unique path to each test repo instance
  // to prevent in-memory collisions. If we don't pass a unique
  // path to each in-memory repo, they will all share a single
  // in-memory sqlite datbasae - which breaks the tests!
  const randomPath = uuid().toString()
  return new Repo({ path: randomPath, memory: true })
}

export function testSwarm() {
  return Hyperswarm()
}

export function expectDocs(t: test.Test, docs: DocInfo[]) {
  let i = 0

  // add to the current planned test length:
  t.plan(((<any>t)._plan || 0) + docs.length)

  return (doc: any) => {
    const tmp = docs[i++]
    if (tmp === undefined) {
      t.fail(`extrac doc emitted ${JSON.stringify(doc)}`)
    } else {
      const [expected, msg, cb] = tmp
      t.deepEqual(doc, expected, msg)
      if (cb) cb()
    }
  }
}

export function expect<T>(t: test.Test, getValue: Function, expected: Expected<T>[]) {
  let i = 0

  // add to the current planned test length:
  t.plan(((<any>t)._plan || 0) + expected.length)

  return (...args: any) => {
    const currentExpected = expected[i++]
    if (currentExpected === undefined) {
      t.fail(`Invoked more times than expected. Invoked with: ${JSON.stringify(args)}`)
    } else {
      const val = getValue(...args)
      const [expected, msg, cb] = currentExpected
      t.deepEqual(val, expected, msg)
      if (cb) cb()
    }
  }
}

export function generateServerPath() {
  const shortId = uuid()
    .toString()
    .slice(0, 4)
  return `/tmp/hypermerge-test-${shortId}.sock`
}
