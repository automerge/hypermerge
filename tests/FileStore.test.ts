import test from 'tape'
import { testStorageFn } from './misc'
import FileStore from '../src/FileStore'
import FeedStore from '../src/FeedStore'
import { streamToBuffer, bufferToStream } from '../src/Misc'

test('FileStore', (t) => {
  const feeds = new FeedStore(testStorageFn())
  const files = new FileStore(feeds)

  t.test('appendStream', async (t) => {
    t.plan(1)

    const testBuffer = Buffer.from('coolcool')
    const testStream = bufferToStream(testBuffer)
    const { url } = await files.write('application/octet-stream', testBuffer.length, testStream)
    const output = await files.read(url)
    const outputBuffer = await streamToBuffer(output)
    t.equal(testBuffer.toString(), outputBuffer.toString())
  })
})
