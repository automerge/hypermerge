const fs = require('fs')
const minimist = require('minimist')
const renderGrid = require('./render-grid')
const hypermergeMicro = require('../../hypermerge-micro')
const equal = require('deep-equal')
const input = require('diffy/input')()
const prettyHash = require('pretty-hash')

require('events').EventEmitter.prototype._maxListeners = 100

const argv = minimist(
  process.argv.slice(2),
  {
    boolean: ['debug', 'new-source', 'new-actor', 'headless']
  }
)
const diffy = argv.headless ? null : require('diffy')({fullscreen: true})

if (argv.help || !argv.name || argv._.length > 1) {
  console.log(
    'Usage: node pp-mini --name=<name> [--save=<dir>] [--debug] ' +
    '[--quiet] [--new-source] [--new-actor] [--actor=<key>] ' +
    '[--headless] [key]\n'
  )
  process.exit(0)
}

if (argv.headless) {
  console.log('Headless mode')
}

const cursor = {x: 0, y: 0}
const debugLog = []

const opts = {
  debugLog: argv.debug
}
if (argv._.length === 1) {
  opts.key = argv._[0]
}

let hm, sourceFile, localFile

if (argv.save) {
  sourceFile = `${argv.save}/source`
  let key
  if (fs.existsSync(sourceFile)) {
    key = fs.readFileSync(sourceFile, 'utf8')
  }
  if (opts.key && key && key.toString('hex') !== opts.key) {
    // If the provided source key is different than the previous
    // run, force --new-actor
    opts['new-actor'] = true
  }
  if (!opts.key && key && !argv['new-source']) {
    opts.key = key
  }
  let localKey
  localFile = `${argv.save}/local`
  if (fs.existsSync(localFile)) {
    localKey = fs.readFileSync(localFile, 'utf8')
  }
  opts.localKey = argv.actor
  if (!opts.localKey && localKey && !argv['new-actor']) {
    opts.localKey = localKey
  }
  hm = hypermergeMicro(argv.save, opts)
  hm.on('ready', _ready)
} else {
  hm = hypermergeMicro(opts)
  hm.on('ready', _ready)
}

function log (message) {
  if (argv.headless) {
    console.log(message)
    return
  }
  debugLog.push(message)
}

function _ready () {
  hm.on('debugLog', log)
  if (argv.headless) {
    log(`Source: ${hm.source.key.toString('hex')}`)
    log(`Source dk: ${hm.source.discoveryKey.toString('hex')}`)
    if (hm.local) {
      log(`Local: ${hm.local.key.toString('hex')}`)
      log(`Local dk: ${hm.local.discoveryKey.toString('hex')}`)
    }
  }
  if (sourceFile) {
    fs.writeFileSync(sourceFile, hm.source.key.toString('hex'))
  }
  const userData = {
    name: argv.name
  }
  if (hm.local) {
    userData.key = hm.local.key.toString('hex')
  }
  hm.source.on('append', r)
  if (localFile && hm.local) {
    fs.writeFileSync(localFile, hm.local.key.toString('hex'))
  }
  log('Joining swarm')
  const sw = hm.joinSwarm({
    userData: JSON.stringify(userData)
    // timeout: 1000
  })
  sw.on('connection', (peer, type) => {
    peer.on('close', () => { r(); setTimeout(r, 1000) })
    try {
      if (!peer.remoteUserData) throw new Error('No user data')
      const userData = JSON.parse(peer.remoteUserData.toString())
      if (userData.key) {
        log(`Connect ${userData.name} ${userData.key}`)
        hm.connectPeer(userData.key)
      }
      r()
    } catch (e) {
      log(`Connection with no or invalid user data`)
      // console.error('Error parsing JSON', e)
    }
    r()
  })
  sw.on('peer', peer => {
    log(`peer ${peer.id}`)
    r()
  })
  sw.on('drop', peer => {
    log(`drop ${peer.id}`)
    r()
  })
  sw.on('close', () => {
    log('Close')
    r()
  })
  hm.getMissing(r) // Do this after joining swarm

  let actorIncludedInDoc = false

  hm.doc.registerHandler(doc => {
    if (hm.findingMissingPeers) {
      log('Still finding missing peers')
      return // Still fetching dependencies
    }
    log('Doc updated')
    const actorId = hm.local ? hm.local.key.toString('hex')
      : hm.source.key.toString('hex')
    if (hm.local && !actorIncludedInDoc) {
      actorIncludedInDoc = true
      if (hm.local.length === 0) {
        hm.change(doc => {
          if (!doc.actors) {
            doc.actors = {}
            doc.actors[actorId] = {}
          }
          const seenActors = updateSeenActors(doc)
          if (seenActors) {
            doc.actors[actorId] = seenActors
          }
          // log(`Update local actors ${JSON.stringify(doc.actors)}`)
        })
        log(`Updated actors list (new actor)`)
      }
    } else {
      const seenActors = updateSeenActors(doc)
      if (seenActors) {
        hm.change(doc => {
          if (!doc.actors) {
            doc.actors = {}
          }
          doc.actors[actorId] = seenActors
        })
        log(`Updated actors list`)
      }
    }

    r()

    function updateSeenActors (doc) {
      if (!actorId) return null
      const actors = doc.actors || {}
      let prevSeenActors = actors[actorId] || {}
      if (prevSeenActors) {
        prevSeenActors = Object.keys(prevSeenActors).reduce(
          (acc, key) => {
            if (key === '_objectId') return acc
            return Object.assign({}, acc, {[key]: prevSeenActors[key]})
          },
          {}
        )
      }
      const keys = Object.keys(actors)
        .filter(key => (key !== actorId) && (key !== '_objectId'))
      // log(keys.join(','))
      const seenActors = keys.reduce(
        (acc, key) => Object.assign({}, acc, {[key]: true}),
        {}
      )
      return !equal(seenActors, prevSeenActors) ? seenActors : null
    }
  })

  if (!opts.key && hm.source.length === 0) {
    hm.change('blank canvas', doc => {
      doc.x0y0 = 'w'
      doc.x0y1 = 'w'
      doc.x1y0 = 'w'
      doc.x1y1 = 'w'
    })
  }

  function * onscreenHelp () {
    yield `Keys:`
    yield `  \u2191 \u2193 \u2190 \u2192  | Move Cursor`
    yield `  r g b w  | Set Colors`
    yield `  q        | Quit `
  }

  function render () {
    let output = ''
    if (!argv.quiet) {
      output += `Source: ${hm.source.key.toString('hex')}\n`
      if (argv.debug) {
        const dk = prettyHash(hm.multicore.archiver.changes.discoveryKey)
        output += `Archiver: ${hm.getArchiverKey().toString('hex')} ${dk}\n`
        output += `Archive Changes Length: ` +
          `${hm.multicore.archiver.changes.length}\n`
      }
      output += `Your Name: ${argv.name}\n`
      output += `${sw.connections.length} connections, ` +
        `${Object.keys(hm.peers).length + 1 + (hm.local ? 1 : 0)} actors\n\n`
      if (argv.debug) {
        {
          const feed = hm.source
          const key = hm.key.toString('hex')
          const dk = prettyHash(hm.discoveryKey)
          output += `${key} ${dk} ${feed.length} (${feed.peers.length} peers)\n`
        }
        if (hm.local) {
          const feed = hm.local
          const key = hm.local.key.toString('hex')
          const dk = prettyHash(hm.local.discoveryKey)
          output += `${key} ${dk} ${feed.length} (${feed.peers.length} peers)\n`
        }
        Object.keys(hm.peers).forEach(key => {
          const feed = hm.peers[key]
          const dk = prettyHash(feed.discoveryKey)
          output += `${key} ${dk} ${feed.length} (${feed.peers.length} peers)\n`
        })
        output += '\n'
      }
    }
    const gridRenderer = renderGrid({cursor, grid: hm.get()})
    const help = onscreenHelp()
    while (true) {
      const gridLine = gridRenderer.next()
      const helpLine = help.next()
      if (gridLine.done && helpLine.done) break
      if (argv.quiet) {
        output += gridLine.value + '\n'
      } else {
        output += `${gridLine.value}    ${helpLine.value || ''}\n`
      }
    }
    if (!argv.quiet) {
      output += '\nPeers:\n'
      sw.connections.forEach(connection => {
        try {
          const userData = JSON.parse(connection.remoteUserData.toString())
          output += `  ${userData.name}\n`
        } catch (e) {
          output += `  no user data\n`
          // console.error('Error parsing JSON', e)
        }
      })
    }
    if (argv.debug && debugLog.length > 0) {
      /*
      output += '\nActors:\n'
      output += JSON.stringify(hm.get().actors, null, 2) + '\n'
      */
      output += '\nDebug Log:\n\n'
      const numLines = output.split('\n').length
      const maxLines = diffy.height - numLines - 2
      const start = Math.max(debugLog.length - maxLines, 0)
      debugLog.forEach((line, index) => {
        if (index >= start) {
          output += line.replace(/\n/g, ' ').slice(0, diffy.width - 2) + '\n'
        }
      })
    }
    return output
  }

  function r () {
    if (argv.headless) return
    diffy.render(render)
  }

  input.on('keypress', (ch, key) => {
    if (key.sequence === 'c') {
      log(`Swarm connections ${sw.connections.length}`)
      log(`TCP connections ${sw._tcpConnections.sockets.length}`)
      for (let connection of sw.connections) {
        log(`  remoteId: ${prettyHash(connection.remoteId)} ` +
            `(${connection.feeds.length} feeds)`)
        for (let feed of connection.feeds) {
          log(`    ${prettyHash(feed.key)} ` +
              `(dk: ${prettyHash(feed.discoveryKey)})`)
        }
      }
      r()
    } else if (key.name === 'return') {
      log('')
      r()
    }
  })

  if (argv.headless) {
    input.on('keypress', (ch, key) => {
      if (key.sequence === 'C') {
        console.log('Swarm connections', sw.connections)
      /*
      } else if (key.sequence === 'p') {
        console.log('Peers', feed.peers.length)
        for (let peer of feed.peers) {
          console.log(`  remoteId: ${prettyHash(peer.remoteId)}`)
        }
      } else if (key.sequence === 'P') {
        console.log('Peers', feed.peers)
      */
      } else if (key.sequence === 'x') {
        console.log('sw._peersIds', sw._peersIds)
      } else if (key.sequence === 'q') {
        process.exit()
      } else {
        // console.log('key', key)
      }
    })
  } else {
    input.on('down', () => {
      if (cursor.y === 0) cursor.y = 1
      r()
    })
    input.on('up', () => {
      if (cursor.y === 1) cursor.y = 0
      r()
    })
    input.on('left', () => {
      if (cursor.x === 1) cursor.x = 0
      r()
    })
    input.on('right', () => {
      if (cursor.x === 0) cursor.x = 1
      r()
    })

    input.on('keypress', (ch, key) => {
      if (key.name === 'q') {
        sw.close(() => {
          process.exit(0)
        })
      }
      if ('rgbw'.indexOf(key.name) >= 0) {
        hm.change(doc => {
          doc[`x${cursor.x}y${cursor.y}`] = key.name
        })
        r()
      }
    })
    r()
  }
}
