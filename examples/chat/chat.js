#!/usr/bin/env node

const minimist = require('minimist')
const input = require('diffy/input')({showCursor: true})
const ram = require('random-access-memory')
const {HyperMerge} = require('../..')
const Automerge = require('automerge')
const bs58check = require('bs58check')
const stripAnsi = require('strip-ansi')

require('events').EventEmitter.prototype._maxListeners = 100

const argv = minimist(process.argv.slice(1), {
  boolean: ['debug', 'new-actor', 'new-channel']
})

argv._ = argv._.filter(arg => arg.indexOf('chat') === -1)
if (argv.help || !argv.nick || argv._.length > 1) {
  // FIXME: Prompt for nick if not supplied
  console.log(
    'Usage: hm-chat --nick=<nick> [--save=<dir>] [--debug] ' +
    '[--headless] [--new-channel] [<channel-key>]\n'
  )
  process.exit(0)
}

const diffy = argv.headless ? null : require('diffy')({fullscreen: true})

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
  if (argv.save) {
    console.log('Not implemented yet')
    process.exit(1)
  } else {
    const hm = new HyperMerge({path: ram})
    if (!channelKey) {
      hm.joinSwarm()
      hm.create({
        type: 'hm-chat',
        nick: argv.nick
      })
      hm.once('document:ready', chatDoc => {
        const myDoc = hm.update(
          Automerge.change(chatDoc, doc => {
            doc.messages = {}
            doc.people = {}
          })
        )
        _ready(hm, myDoc, myDoc)
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
          _ready(hm, channelDoc, myDoc)
        }
      })
    }
  }
}

function _ready (hm, channelDoc, myDoc) {
  let chatDoc = Automerge.initImmutable()
  chatDoc = Automerge.merge(chatDoc, channelDoc)
  chatDoc = Automerge.merge(chatDoc, myDoc)
  if (argv.headless) {
    const key = Buffer.from(hm.getHex(channelDoc), 'hex')
    console.log(`Channel Key: ${bs58check.encode(key)}`)
    console.log(`Key: ${key.toString('hex')}`)
  }
  setInterval(r, 3000)
  hm.on('document:updated', doc => {
    chatDoc = Automerge.merge(chatDoc, doc)
    r()
  })
  hm.on('document:ready', doc => {
    chatDoc = Automerge.merge(chatDoc, doc)
    r()
  })
  input.on('update', r)
  input.on('enter', postMessage)
  r()

  function render () {
    let output = ''
    const key = Buffer.from(hm.getHex(channelDoc), 'hex')
    output += `Channel Key: ${bs58check.encode(key)}\n`
    output += `${hm.swarm.connections.length} connections. `
    output += `Use Ctrl-C to exit.\n\n`
    let displayMessages = []
    let messages = chatDoc.getIn(['messages'])
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
    if (argv.headless) return
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
      chatDoc = Automerge.merge(chatDoc, myDoc)
    }
    r()
  }
}

main()
