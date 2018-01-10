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

const opts = {}
if (argv._.length === 1) {
  opts.key = argv._[0]
}
const hm = hypermerge(opts)
hm.on('ready', () => {
  const sw = hyperdiscovery(hm, {live: true})
  sw.on('connection', r)

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

  function render () {
    let output = ''
    output += `Source: ${hm.source.key.toString('hex')}\n`
    output += `Your Name: ${argv.name}\n`
    output += `Connected to ${sw.connections.length} peers\n\n`
    const gridRenderer = renderGrid({cursor, grid: hm.get()})
    for (line of gridRenderer) { output += line + '\n' }
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
