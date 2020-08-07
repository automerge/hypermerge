import test from 'tape'
import { Repo } from '../src'
import tmp from 'tmp'

test('Test opening more than 2048 files', (t) => {
  const numberOfFiles = 2500
  const tmpDir = tmp.dirSync({ unsafeCleanup: true })
  const repo = new Repo({ path: tmpDir.name })
  t.plan(numberOfFiles)
  times(numberOfFiles, (i) => {
    const url = repo.create({ index: i })
    repo.doc(url, (doc: { index: number }) => {
      t.pass(`Doc ${doc.index + 1}`)
    })
  })
  test.onFinish(() => {
    // This timeout is a hack - we don't have a way to safely close
    // the repo. In this case, we have a `feed.ready()` callback which
    // writes to the FeedInfoStore db. This callback throws if the database has
    // been closed. We need a way to either safely shut down (build a queue
    // and let it drain, making `repo.close()` async) - or - we should
    // implement a hard shut down which clears those queues.
    setTimeout(() => {
      repo.close()
      tmpDir.removeCallback()
    }, 10000)
  })
})

function times(n: number, fn: (index: number) => void) {
  for (let i = 0; i < n; i++) {
    fn(i)
  }
}
