#!/usr/bin/env node

const minimist = require('minimist')
const Model = require('./model')
const {initUI, render} = require('./ui')

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

const model = new Model({channelHex, nick})
model.once('ready', ({doc, channelHex}) => {
  initUI({
    nick,
    channelHex,
    getNumConnections: model.getNumConnections.bind(model),
    doc,
    postMessage: (line) => model.addMessageToDoc(line)
  })
})
model.on('updated', doc => render(
  model.nick,
  model.channelHex,
  doc))
