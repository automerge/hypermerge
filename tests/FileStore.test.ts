import test from 'tape'
import { createHash } from 'crypto'
import { testStorageFn, testDb } from './misc'
import FileStore, { Header } from '../src/FileStore'
import FeedStore from '../src/FeedStore'
import * as Stream from '../src/StreamLogic'

test('FileStore', (t) => {
  const feeds = new FeedStore(testDb(), testStorageFn())
  const files = new FileStore(feeds)

  t.test('writing and reading 1MB file', async (t) => {
    t.plan(2)

    const testBuffer = Buffer.alloc(1024 * 1024, 1)
    const testStream = Stream.fromBuffer(testBuffer)
    const header = await files.write(testStream, 'application/octet-stream')
    const sha256 = createHash('sha256')
      .update(testBuffer)
      .digest('hex')

    const expectedHeader: Header = {
      size: testBuffer.length,
      mimeType: 'application/octet-stream',
      sha256,
      blocks: 17,
      url: header.url,
    }

    t.deepEqual(header, expectedHeader, 'reads the expected header')

    const output = await files.read(header.url)
    const outputBuffer = await Stream.toBuffer(output)

    t.deepEqual(outputBuffer, testBuffer, 'reads the written buffer')
  })

  t.test('writing and reading stream of small chunks', async (t) => {
    t.plan(2)

    const testBuffers = [
      Buffer.alloc(30 * 1024, 1),
      Buffer.alloc(30 * 1024, 2),
      Buffer.alloc(30 * 1024, 3),
      Buffer.alloc(30 * 1024, 4),
      Buffer.alloc(30 * 1024, 5),
    ]

    const testBuffer = Buffer.concat(testBuffers)
    const testStream = Stream.fromBuffers(testBuffers)
    const header = await files.write(testStream, 'application/octet-stream')
    const sha256 = createHash('sha256')
      .update(testBuffer)
      .digest('hex')

    const expectedHeader: Header = {
      size: testBuffer.length,
      mimeType: 'application/octet-stream',
      sha256,
      blocks: 3,
      url: header.url,
    }

    t.deepEqual(header, expectedHeader, 'reads the expected header')

    const output = await files.read(header.url)
    const outputBuffer = await Stream.toBuffer(output)

    t.deepEqual(outputBuffer, testBuffer, 'reads the written buffer')
  })
})
