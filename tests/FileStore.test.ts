import test from 'tape'
import { testStorageFn } from './misc'
import FileStore, { Header } from '../src/FileStore'
import FeedStore from '../src/FeedStore'
import * as Stream from '../src/StreamLogic'

test('FileStore', (t) => {
  const feeds = new FeedStore(testStorageFn())
  const files = new FileStore(feeds)

  t.test('writing and reading streams', async (t) => {
    t.plan(3)

    const testBuffer = Buffer.alloc(1024 * 1024, 1)
    const testStream = Stream.fromBuffer(testBuffer)
    const header = await files.write(testStream, 'application/octet-stream')

    const blockCount = await files.blockCount(header.url)
    t.equal(blockCount, 17, 'feed contains correct block count')

    const expectedHeader: Header = {
      size: testBuffer.length,
      mimeType: 'application/octet-stream',
      url: header.url,
    }

    t.deepEqual(header, expectedHeader, 'reads the expected header')

    const output = await files.read(header.url)
    const outputBuffer = await Stream.toBuffer(output)

    t.deepEqual(outputBuffer, testBuffer, 'reads the written buffer')
  })
})
