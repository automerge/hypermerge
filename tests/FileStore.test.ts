import test from 'tape'
import { testStorageFn } from './misc'
import FileStore, { Header } from '../src/FileStore'
import FeedStore from '../src/FeedStore'
import { streamToBuffer, bufferToStream } from '../src/Misc'

test('FileStore', (t) => {
  const feeds = new FeedStore(testStorageFn())
  const files = new FileStore(feeds)

  t.test('writing and reading streams', async (t) => {
    t.plan(2)

    const testBuffer = Buffer.from('coolcool')
    const testStream = bufferToStream(testBuffer)
    const header = await files.write('application/octet-stream', testStream)

    const expectedHeader: Header = {
      type: 'File',
      bytes: testBuffer.length,
      mimeType: 'application/octet-stream',
      url: header.url,
    }

    t.deepEqual(header, expectedHeader, 'reads the expected header')

    const output = await files.read(header.url)
    const outputBuffer = await streamToBuffer(output)

    t.equal(outputBuffer.toString(), testBuffer.toString(), 'reads the written buffer')
  })
})
