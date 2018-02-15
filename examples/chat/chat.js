#!/usr/bin/env node

const minimist = require('minimist')
const argv = minimist(process.argv.slice(2))
if (argv.help || argv._.length > 1) {
  console.log('Usage: hm-chat [--nick=<nick>] [<channel-key>]\n')
  process.exit(0)
}

let nick = argv.nick
if (!argv.nick) {
  const prompt = require('prompt-sync')()
  nick = prompt('Enter your nickname: ')
}

const channelHex = argv._[0]

const setupModel = require('./model')
setupModel(channelHex, nick, onReady)

function onReady ({doc, channelHex, connections, addMessageToDoc}) {
  const initUI = require('./ui')
  const render = initUI({
    nick,
    channelHex,
    connections,
    doc,
    postMessage: line => addMessageToDoc(line)
  })
  return render
}
