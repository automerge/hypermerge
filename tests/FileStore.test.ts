import test from 'tape'
import { testStorageFn } from './misc'
import FileStore, { Header } from '../src/FileStore'
import FeedStore from '../src/FeedStore'
import * as Stream from '../src/StreamLogic'

test('FileStore', (t) => {
  const feeds = new FeedStore(testStorageFn())
  const files = new FileStore(feeds)

  t.test('writing and reading 1MB file', async (t) => {
    t.plan(2)

    const testBuffer = Buffer.alloc(1024 * 1024, 1)
    const testStream = Stream.fromBuffer(testBuffer)
    const header = await files.write(testStream, 'application/octet-stream')

    const expectedHeader: Header = {
      size: testBuffer.length,
      mimeType: 'application/octet-stream',
      blocks: 17,
      url: header.url,
    }

    t.deepEqual(header, expectedHeader, 'reads the expected header')

    const output = await files.read(header.url)
    const outputBuffer = await Stream.toBuffer(output)

    t.deepEqual(outputBuffer, testBuffer, 'reads the written buffer')
  })
})
