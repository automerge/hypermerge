import test from 'tape'
import * as Stream from '../src/StreamLogic'
import { expect } from './misc'

test('StreamLogic', (t) => {
  t.test('ChunkSizeTransform', (t) => {
    t.test('stream with one small chunk', (t) => {
      Stream.fromBuffer(Buffer.alloc(5, 1))
        .pipe(new Stream.MaxChunkSizeTransform(10))
        .on('data', expect(t, (x) => x, [[Buffer.alloc(5, 1), 'only chunk is 5 bytes']]))
    })

    t.test('stream with small last chunk', (t) => {
      Stream.fromBuffer(Buffer.alloc(39, 1))
        .pipe(new Stream.MaxChunkSizeTransform(10))
        .on(
          'data',
          expect(t, (x) => x, [
            [Buffer.alloc(10, 1), 'first chunk is 10 bytes'],
            [Buffer.alloc(10, 1), 'second chunk is 10 bytes'],
            [Buffer.alloc(10, 1), 'third chunk is 10 bytes'],
            [Buffer.alloc(9, 1), 'fourth chunk is 9 bytes'],
          ])
        )
    })

    t.test('input stream has smaller chunks', (t) => {
      Stream.fromBuffer(Buffer.alloc(39, 1))
        .pipe(new Stream.MaxChunkSizeTransform(10))
        .pipe(new Stream.MaxChunkSizeTransform(20))
        .on(
          'data',
          expect(t, (x) => x, [
            [Buffer.alloc(10, 1), 'first chunk is 10 bytes'],
            [Buffer.alloc(10, 1), 'second chunk is 10 bytes'],
            [Buffer.alloc(10, 1), 'third chunk is 10 bytes'],
            [Buffer.alloc(9, 1), 'fourth chunk is 9 bytes'],
          ])
        )
    })
  })
})
