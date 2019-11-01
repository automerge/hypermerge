import test from 'tape'
import * as Stream from '../src/StreamLogic'
import { expect, expectStream } from './misc'

test('StreamLogic', (t) => {
  t.test('fromBuffers', (t) => {
    Stream.fromBuffers([Buffer.alloc(10, 1), Buffer.alloc(10, 2), Buffer.alloc(10, 3)]).on(
      'data',
      expect(t, (x) => x, [
        [Buffer.alloc(10, 1), 'first chunk is 10 bytes'],
        [Buffer.alloc(10, 2), 'second chunk is 10 bytes'],
        [Buffer.alloc(10, 3), 'third chunk is 10 bytes'],
      ])
    )
  })

  t.test('ChunkSizeTransform', (t) => {
    t.test('stream with exact-sized chunks', (t) => {
      Stream.fromBuffers([Buffer.alloc(10, 1), Buffer.alloc(10, 2), Buffer.alloc(10, 3)])
        .pipe(new Stream.ChunkSizeTransform(10))
        .on(
          'data',
          expect(t, (x) => x, [
            [Buffer.alloc(10, 1), 'first chunk is 10 bytes'],
            [Buffer.alloc(10, 2), 'second chunk is 10 bytes'],
            [Buffer.alloc(10, 3), 'third chunk is 10 bytes'],
          ])
        )
    })

    t.test('stream with one small chunk', (t) => {
      Stream.fromBuffer(Buffer.alloc(5, 1))
        .pipe(new Stream.ChunkSizeTransform(10))
        .on('data', expect(t, (x) => x, [[Buffer.alloc(5, 1), 'only chunk is 5 bytes']]))
    })

    t.test('stream with small last chunk', (t) => {
      t.plan(2)

      const transform = new Stream.ChunkSizeTransform(10)
      Stream.fromBuffer(Buffer.alloc(39, 1))
        .pipe(transform)
        .on(
          'data',
          expect(t, (x) => x, [
            [Buffer.alloc(10, 1), 'first chunk is 10 bytes'],
            [Buffer.alloc(10, 1), 'second chunk is 10 bytes'],
            [Buffer.alloc(10, 1), 'third chunk is 10 bytes'],
            [
              Buffer.alloc(9, 1),
              'fourth chunk is 9 bytes',
              () => {
                t.equal(transform.processedBytes, 39, 'processedBytes is correct')
                t.equal(transform.chunkCount, 4, 'chunkCount is correct')
              },
            ],
          ])
        )
    })

    t.test('input stream has smaller chunks', (t) => {
      Stream.fromBuffers([Buffer.alloc(10, 1), Buffer.alloc(10, 2), Buffer.alloc(9, 3)])
        .pipe(new Stream.ChunkSizeTransform(20))
        .on(
          'data',
          expect(t, (x) => x, [
            [Buffer.concat([Buffer.alloc(10, 1), Buffer.alloc(10, 2)]), 'first chunk is 20 bytes'],
            [Buffer.alloc(9, 3), 'second chunk is 9 bytes'],
          ])
        )
    })
  })

  t.test('PrefixMatchPassThrough', (t) => {
    t.test('correct match', (t) => {
      t.plan(1)

      const prefix = Buffer.from('some_prefix.v1')
      const prefixMatch = new Stream.PrefixMatchPassThrough(prefix)
      const inputStream = Stream.fromBuffer(Buffer.concat([prefix, Buffer.alloc(10, 1)]))
      const testStream = inputStream.pipe(prefixMatch)

      expectStream(t, testStream, [
        ['data', Buffer.alloc(10, 1), 'gets data after prefix'],
        [
          'end',
          'stream ends',
          () => {
            t.assert(prefixMatch.matched, 'prefixMatch matched the prefix')
          },
        ],
      ])
    })

    t.test('failing match', (t) => {
      const prefixMatch = new Stream.PrefixMatchPassThrough(Buffer.from('some_prefix.v1'))
      const inputStream = Stream.fromBuffer(
        Buffer.concat([Buffer.from('some_prefix.v2'), Buffer.alloc(10, 1)])
      )
      const testStream = inputStream.pipe(prefixMatch)

      expectStream(t, testStream, [['error', "Invalid prefix: 'some_prefix.v2'", 'stream errors']])
    })
  })
})
