const diffy = require('diffy')({fullscreen: true})
const input = require('diffy/input')({showCursor: true})
const stripAnsi = require('strip-ansi')

let nick, channelHex, connections, myDoc

function initUI (opts) {
  nick = opts.nick
  channelHex = opts.channelHex
  connections = opts.connections
  myDoc = opts.doc
  render(myDoc)
  input.on('update', () => { render(myDoc) })
  input.on('enter', line => {
    myDoc = opts.postMessage(myDoc, line)
    render(myDoc)
  })
  // For network connection display
  setInterval(() => { render(myDoc) }, 3000)
}

function doRender () {
  let output = ''
  output += `Join: npx hm-chat ${channelHex}\n`
  output += `${connections.length} connections. `
  output += `Use Ctrl-C to exit.\n\n`
  let displayMessages = []
  let messages = myDoc.getIn(['messages'])
  messages = messages ? messages.toJS() : {}
  Object.keys(messages).sort().forEach(key => {
    if (key === '_objectId') return
    if (key === '_conflicts') return
    const {nick, message, joined} = messages[key]
    if (joined) {
      displayMessages.push(`${nick} has joined.`)
    } else {
      displayMessages.push(`${nick}: ${message}`)
    }
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
  output += `\n[${nick}] ${input.line()}`
  return output
}

function render (doc) {
  myDoc = doc
  diffy.render(doRender)
}

module.exports = {initUI, render}
