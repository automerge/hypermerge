#!/usr/bin/env node

const minimist = require('minimist')
const diffy = require('diffy')({fullscreen: true})
const input = require('diffy/input')({showCursor: true})
const ram = require('random-access-memory')
const {HyperMerge} = require('hypermerge')
const Automerge = require('automerge')
const bs58check = require('bs58check')
const stripAnsi = require('strip-ansi')

require('events').EventEmitter.prototype._maxListeners = 100

const argv = minimist(process.argv.slice(1))

argv._ = argv._.filter(arg => arg.indexOf('chat.js') === -1)
if (argv.help || !argv.nick || argv._.length > 1) {
  console.log('Usage: hm-chat --nick=<nick> [<channel-key>]\n')
  process.exit(0)
}

function main () {
  let channelKey
  if (argv._.length > 0) {
    try {
      channelKey = bs58check.decode(argv._[0])
    } catch (e) {
      console.error('Error decoding channel key', e.message)
      process.exit(1)
    }
  }
  const hm = new HyperMerge({path: ram})
  if (!channelKey) {
    hm.joinSwarm()
    hm.create({
      type: 'hm-chat',
      nick: argv.nick
    })
    hm.once('document:ready', newDoc => {
      const myDoc = hm.update(
        Automerge.change(newDoc, doc => {
          doc.messages = {}
        })
      )
      const myHex = hm.getHex(myDoc)
      _ready(hm, myHex, myDoc)
    })
  } else {
    const channelHex = channelKey.toString('hex')
    console.log('Searching for chat channel on network...')
    hm.joinSwarm()
    let channelDoc = hm.open(channelHex)
    hm.once('document:updated', doc => {
      channelDoc = doc
      let myDoc = hm.fork(channelHex, {
        type: 'hm-chat',
        nick: argv.nick
      })
      const myHex = hm.getHex(myDoc)
      hm.share(myHex, channelHex)
      hm.on('document:ready', watchForDoc)
      function watchForDoc (doc) {
        if (doc._actorId !== myHex) {
          channelDoc = doc
          return
        }
        hm.removeListener('document:ready', watchForDoc)
        myDoc = doc
        myDoc = Automerge.merge(myDoc, channelDoc)
        _ready(hm, channelHex, myDoc)
      }
    })
  }
}

function _ready (hm, channelHex, myDoc) {
  let newPerson = false
  setInterval(r, 3000) // For network connection display
  hm.on('document:updated', mergeDoc)
  hm.on('document:ready', mergeDoc)
  function mergeDoc (doc) {
    myDoc = Automerge.merge(myDoc, doc)
    if (newPerson) {
      myDoc = hm.update(Automerge.change(myDoc, doc => {}))
      newPerson = false
    }
    r()
  }
  hm.on('peer:joined', () => {
    newPerson = true
  })
  input.on('update', r)
  input.on('enter', postMessage)
  r()

  function render () {
    let output = ''
    const key = Buffer.from(channelHex, 'hex')
    output += `Channel Key: ${bs58check.encode(key)}\n`
    output += `${hm.swarm.connections.length} connections. `
    output += `Use Ctrl-C to exit.\n\n`
    let displayMessages = []
    let messages = myDoc.getIn(['messages'])
    messages = messages ? messages.toJS() : {}
    Object.keys(messages).sort().forEach(key => {
      if (key === '_objectId') return
      if (key === '_conflicts') return
      const {nick, message} = messages[key]
      displayMessages.push(`${nick}: ${message}`)
    })
    // Delete old messages
    const maxMessages = diffy.height - output.split('\n').length - 2
    displayMessages.splice(0, displayMessages.length - maxMessages)
    displayMessages.forEach(line => {
      output += stripAnsi(line).substr(0, diffy.width - 2) + '\n'
    })
    for (let i = displayMessages.length; i < maxMessages; i++) {
      output += '\n'
    }
    output += `\n[${argv.nick}] ${input.line()}`
    return output
  }

  function r () {
    diffy.render(render)
  }

  function postMessage (line) {
    const message = line.trim()
    if (message.length > 0) {
      myDoc = hm.update(
        Automerge.change(myDoc, doc => {
          doc.messages[Date.now()] = {
            nick: argv.nick,
            message: line
          }
        })
      )
    }
    r()
  }
}

main()
