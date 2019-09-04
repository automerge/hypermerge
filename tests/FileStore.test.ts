import test from 'tape'
import { Repo } from '../src'
import Client from 'discovery-cloud-client'
import { expectDocs } from './misc'
import FileStore from '../src/FileStore'
import FeedStore from '../src/FeedStore'
import { Readable } from 'stream'

const ram: any = require('random-access-memory')

test('FileStore', (t) => {
  t.plan(1)

  const feeds = new FeedStore(ram)
  const files = new FileStore(feeds)

  t.test('appendStream', async (t) => {
    const stream = fakeReadable(1024)
    const { url } = await files.writeStream('application/octet-stream', 1024, stream)
    const output = await files.stream(url)
  })
})

function fakeReadable(length: number) {
  const buffer = Buffer.alloc(length, 1)
  const stream = new Readable()
  stream.push(buffer)
  stream.push(buffer)
  stream.push(null)
  return stream
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((res, rej) => {
    const buffers: Buffer[] = []
    stream
      .on('data', (data) => buffers.push(data))
      .on('error', (err) => rej(err))
      .on('end', () => res(Buffer.concat(buffers)))
  })
}
