import Hyperdiscovery from 'hyperdiscovery'
import Fs from 'fs'

import Multicore from './multicore'

// callback = (err, hyperfileId)
export function write(multicore, filePath, callback) {
  multicore.ready(() => {
    const feed = multicore.createFeed()

    Fs.readFile(filePath, (error, buffer) => {
      if (error) {
        callback(error)
        return
      }

      feed.append(buffer, (error) => {
        if (error) {
          callback(error)
          return
        }

        const hyperfileId = feed.key.toString('hex')

        Hyperdiscovery(feed)
        callback(null, hyperfileId)
      })
    })
  })
}

export function writeBuffer(multicore, buffer, callback) {
  multicore.ready(() => {
    const feed = multicore.createFeed()

    feed.append(buffer, (error) => {
      if (error) {
        callback(error)
        return
      }

      const hyperfileId = feed.key.toString('hex')

      Hyperdiscovery(feed)
      callback(null, hyperfileId)
    })
  })
}

// callback = (err, blob)
export function fetch(multicore, hyperfileId, callback) {
  multicore.ready(() => {
    const feedKey = Buffer.from(hyperfileId, 'hex')
    const feed = multicore.createFeed(feedKey)

    feed.on('error', callback)
    feed.ready(() => {
      Hyperdiscovery(feed)
      feed.get(0, null, (error, data) => {
        if (error) {
          callback(error)
          return
        }

        callback(null, data)
      })
    })
  })
}
