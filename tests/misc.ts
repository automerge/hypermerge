import test from 'tape'
import uuid from 'uuid/v4'

type DocMsg = [any, string]
type DocMsgCB = [any, string, any]
type DocInfo = DocMsg | DocMsgCB

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

export function generateServerPath() {
  const shortId = uuid()
    .toString()
    .slice(0, 4)
  return `/tmp/hypermerge-test-${shortId}.sock`
}
