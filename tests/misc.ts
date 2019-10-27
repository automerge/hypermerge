import test from 'tape'
import { Duplex } from 'stream'
import uuid from 'uuid/v4'
import ram from 'random-access-memory'
import { Repo } from '../src'
import Hyperswarm from 'hyperswarm'
import Network from '../src/Network'
import { DiscoveryId, toDiscoveryId } from '../src/Misc'
import * as Keys from '../src/Keys'
import * as SqlDatabase from '../src/SqlDatabase'
import NetworkPeer, { PeerId } from '../src/NetworkPeer'
import PeerConnection from '../src/PeerConnection'

type DocMsg = [any, string]
type DocMsgCB = [any, string, any]
type DocInfo = DocMsg | DocMsgCB

type Expected<T> = [T, string] | [T, string, Function]

export function testRepo() {
  // Note: We must pass a unique path to each test repo instance
  // to prevent in-memory collisions. If we don't pass a unique
  // path to each in-memory repo, they will all share a single
  // in-memory sqlite datbasae - which breaks the tests!
  const randomPath = uuid().toString()
  return new Repo({ path: randomPath, memory: true })
}

export function testDb(): SqlDatabase.Database {
  const randomPath = uuid().toString()
  return SqlDatabase.open(`${randomPath}/test.db`, true)
}

export function testSwarm() {
  return Hyperswarm()
}

export function testDiscoveryId(): DiscoveryId {
  return toDiscoveryId(Keys.create().publicKey)
}

export function testNetwork(): Network {
  return new Network(testPeerId())
}

export function testPeerPair(): [NetworkPeer, NetworkPeer] {
  const idA = testPeerId()
  const idB = testPeerId()

  const peerA = new NetworkPeer(idA, idB)
  const peerB = new NetworkPeer(idB, idA)

  const [connA, connB] = testConnectionPair()

  peerA.addConnection(connA)
  peerB.addConnection(connB)

  return [peerA, peerB]
}

export function testConnectionPair(): [PeerConnection, PeerConnection] {
  const [duplexA, duplexB] = testDuplexPair()

  const connA = new PeerConnection(duplexA, { isClient: true, type: 'tcp' })
  const connB = new PeerConnection(duplexB, { isClient: false, type: 'tcp' })

  return [connA, connB]
}

export function testDuplexPair(): [Duplex, Duplex] {
  const allowExit = preventExit()

  const duplexA = new Duplex({
    read(size) {
      const chunk = duplexB.read(size)
      if (chunk) this.push(chunk)
    },
    write(chunk, encoding, cb) {
      // Push async to avoid sync race conditions:
      setImmediate(() => {
        duplexB.push(chunk, encoding)
        cb()
      })
    },
  })

  const duplexB = new Duplex({
    read(size) {
      const data = duplexA.read(size)
      if (data) this.push(data)
    },
    write(chunk, encoding, cb) {
      // Push async to avoid sync race conditions:
      setImmediate(() => {
        duplexA.push(chunk, encoding)
        cb()
      })
    },
  })

  duplexA.on('close', () => {
    allowExit()
    duplexB.destroy()
  })

  duplexB.on('close', () => {
    allowExit()
    duplexA.destroy()
  })

  return [duplexA, duplexB]
}

export function testKeyPair(): Required<Keys.KeyPair> {
  return Keys.create()
}

export function testPeerId(): PeerId {
  return Keys.create().publicKey as PeerId
}

export function testStorageFn() {
  const root = uuid()
  return (path: string) => (name: string) => ram(root + path + name)
}

export function preventExit(): () => void {
  const interval = setInterval(() => {}, 999999)
  return () => clearInterval(interval)
}

type StreamExpectations =
  | ['end', string]
  | ['end', string, () => void]
  | ['close', string]
  | ['data', Buffer, string]
  | ['error', string, string]

export function expectStream(
  t: test.Test,
  stream: NodeJS.ReadableStream,
  expected: StreamExpectations[]
) {
  const onEvent = expect(
    t,
    (x) => x,
    expected.map(([event, arg1, arg2]): any => {
      switch (event) {
        case 'data':
          return [['data', arg1], arg2 || 'stream gets data']
        case 'end':
          return [['end'], arg1 || 'stream ends', arg2]
        case 'close':
          return [['close'], arg1 || 'stream closes']
        case 'error':
          return [['error', arg1], arg2 || 'stream errors']
      }
    })
  )

  stream
    .on('end', () => onEvent(['end']))
    .on('data', (data) => onEvent(['data', data]))
    .on('error', (err) => onEvent(['error', err.message]))
    .on('close', () => onEvent(['close']))
}

export function expectDocs(t: test.Test, docs: DocInfo[]) {
  let i = 0

  // add to the current planned test length:
  t.plan(((<any>t)._plan || 0) + docs.length)

  return (doc: any) => {
    const tmp = docs[i++]
    if (tmp === undefined) {
      t.fail(`extrac doc emitted ${JSON.stringify(doc)}`)
    } else {
      const [expected, msg, cb] = tmp
      t.deepEqual(doc, expected, msg)
      if (cb) cb()
    }
  }
}

export function expect<T, Args extends any[]>(
  t: test.Test,
  getValue: (...args: Args) => T,
  expected: Expected<T>[]
) {
  let i = 0

  // add to the current planned test length:
  t.plan(((<any>t)._plan || 0) + expected.length)

  return (...args: Args) => {
    const currentExpected = expected[i++]
    if (currentExpected === undefined) {
      t.fail(`Invoked more times than expected. Invoked with: ${JSON.stringify(args)}`)
    } else {
      const val = getValue(...args)
      const [expected, msg, cb] = currentExpected
      t.deepEqual(val, expected, msg)
      if (cb) cb()
    }
  }
}

export function generateServerPath() {
  const shortId = uuid()
    .toString()
    .slice(0, 4)
  return `/tmp/hypermerge-test-${shortId}.sock`
}
