import test from 'tape'
import { Repo } from '../src'
import Client from 'discovery-cloud-client'
import { expectDocs } from './misc'
import FileStore from '../src/FileStore'
import FeedStore from '../src/FeedStore'
import { Readable } from 'stream'
import { streamToBuffer, bufferToStream } from '../src/Misc'

const ram: any = require('random-access-memory')
const storageFn = (storage: any) => (path: string) => (name: string) =>
  storage(`test/${path}/${name}`)

test('FileStore', (t) => {
  const feeds = new FeedStore(storageFn(ram))
  const files = new FileStore(feeds)

  t.test('appendStream', async (t) => {
    t.plan(1)

    const testBuffer = Buffer.from('coolcool')
    const testStream = bufferToStream(testBuffer)
    const { url } = await files.writeStream(
      'application/octet-stream',
      testBuffer.length,
      testStream
    )
    const output = await files.stream(url)
    const outputBuffer = await streamToBuffer(output)
    t.equal(testBuffer.toString(), outputBuffer.toString())
  })
})
