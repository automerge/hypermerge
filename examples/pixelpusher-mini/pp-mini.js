const minimist = require('minimist')
const diffy = require('diffy')({fullscreen: true})
const input = require('diffy/input')()
const hyperdiscovery = require('hyperdiscovery')
const renderGrid = require('./render-grid')
const hypermerge = require('../..')

require('events').EventEmitter.prototype._maxListeners = 100

const argv = minimist(
  process.argv.slice(2),
  {
    boolean: ['debug']
  }
)

if (argv.help || !argv.name || argv._.length > 1) {
  console.log(
    'Usage: node pp-mini --name=<name> [--save=<dir>] [--debug] [--quiet] [key]\n'
  )
  process.exit(0)
}

const cursor = {x: 0, y: 0}
const debugLog = []

const opts = {debugLog: argv.debug}
if (argv._.length === 1) {
  opts.key = argv._[0]
}
let hm
if (argv.save) {
  hm = hypermerge(argv.save, opts)
} else {
  hm = hypermerge(opts)
}
hm.on('debugLog', message => debugLog.push(message))
hm.on('ready', () => {
  const userData = {
    name: argv.name
  }
  if (hm.local) {
    userData.key = hm.local.key.toString('hex')
    hm.local.on('append', r)
  }
  const sw = hyperdiscovery(hm, {
    stream: () => {
      const stream = hm.replicate({
        live: true,
        upload: true,
        download: true,
        userData: JSON.stringify(userData)
      })
      debugLog.push('New stream')
      stream.on('feed', () => { debugLog.push('New feed'); r() })
      stream.on('close', () => { debugLog.push('Stream close'); r() })
      return stream
    }
  })
  sw.on('connection', (peer, type) => {
    try {
      const userData = JSON.parse(peer.remoteUserData.toString())
      if (userData.key) {
        debugLog.push(`Connect ${userData.name} ${userData.key}`)
        hm.connectPeer(userData.key)
      }
      r()
    } catch (e) {
      console.error('Error parsing JSON', e)
      process.exit(1)
    }
  })
  sw.on('close', () => {
    debugLog.push('Close')
    r()
  })

  hm.doc.registerHandler(r)

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
      output += `Your Name: ${argv.name}\n`
      output += `${sw.connections.length} connections, ` +
        `${Object.keys(hm.peers).length + 1 + (hm.local ? 1 : 0)} actors\n\n`
      if (argv.debug) {
        {
          const feed = hm.source
          const key = hm.key.toString('hex')
          output += `${key} ${feed.length} (${feed.peers.length})\n`
        }
        if (hm.local) {
          const feed = hm.local
          const key = hm.local.key.toString('hex')
          output += `${key} ${feed.length} (${feed.peers.length})\n`
        }
        Object.keys(hm.peers).forEach(key => {
          const feed = hm.peers[key]
          output += `${key} ${feed.length} (${feed.peers.length})\n`
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
          console.error('Error parsing JSON', e)
          process.exit(1)
        }
      })
    }
    if (argv.debug && debugLog.length > 0) {
      output += '\nDebug Log:\n\n'
      const numLines = output.split('\n').length
      const maxLines = diffy.height - numLines - 2
      const start = Math.max(debugLog.length - maxLines, 0)
      debugLog.forEach((line, index) => {
        if (index >= start) {
          output += line + '\n'
        }
      })
    }
    return output
  }
  function r () { diffy.render(render) }

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
})
