const minimist = require('minimist')
const diffy = require('diffy')({fullscreen: true})
const input = require('diffy/input')()
const chalk = require('chalk')
const hyperdiscovery = require('hyperdiscovery')
const renderGrid = require('./render-grid')
const hypermerge = require('../..')
const {min, max} = Math

const argv = minimist(process.argv.slice(2))

if (argv.help || !argv.name || argv._.length > 1) {
  console.log(
    'Usage: node pp-mini --name=<name> [key]\n'
  )
  process.exit(0)
}

const cursor = {x: 0, y: 0}
const debugLog = []

const opts = {}
if (argv._.length === 1) {
  opts.key = argv._[0]
}
const hm = hypermerge(opts)
hm.on('ready', () => {
  const userData = {
    name: argv.name
  }
  if (hm.local) {
    userData.key = hm.local.key.toString('hex')
  }
  const sw = hyperdiscovery(hm, {
    stream: () => hm.replicate({
      live: true,
      upload: true,
      download: true,
      userData: JSON.stringify(userData)
    })
  })
  sw.on('connection', (peer, type) => {
    try {
      const userData = JSON.parse(peer.remoteUserData.toString())
      if (userData.key) {
        hm.connectPeer(userData.key)
      }
      r()
    } catch (e) {
      console.error('Error parsing JSON', e)
      process.exit(1)
    }
  })

  hm.doc.registerHandler(() => {
    r()
  })

  if (!opts.key) {
    hm.change('blank canvas', doc => {
      doc.x0y0 = 'w'
      doc.x0y1 = 'w'
      doc.x1y0 = 'w'
      doc.x1y1 = 'w'
    })
  }

  function *onscreenHelp () {
    yield `Keys:`
    yield `  \u2191 \u2193 \u2190 \u2192  | Move Cursor`
    yield `  r g b w  | Set Colors`
    yield `  q        | Quit `
  }

  function render () {
    let output = ''
    output += `Source: ${hm.source.key.toString('hex')}\n`
    output += `Your Name: ${argv.name}\n`
    output += `Connected to ${sw.connections.length} peers\n\n`
    const gridRenderer = renderGrid({cursor, grid: hm.get()})
    const help = onscreenHelp()
    while (true) {
      const gridLine = gridRenderer.next()
      const helpLine = help.next()
      if (gridLine.done && helpLine.done) break
      output += `${gridLine.value}    ${helpLine.value || ''}\n`
    }
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
    if (debugLog.length > 0) {
      output +='\nDebug Log:\n'
      debugLog.forEach(line => { output += line + '\n' })
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

  const colorKeys = ['r', 'g', 'b', 'w']
  input.on('keypress', (ch, key) => {
    if (key.name === 'q') process.exit(0)
    if ('rgbw'.indexOf(key.name) >= 0) {
      hm.change(doc => {
        doc[`x${cursor.x}y${cursor.y}`] = key.name
      })
      r()
    }
  })

  r()
})
