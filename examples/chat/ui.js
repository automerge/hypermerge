const diffy = require('diffy')({fullscreen: true})
const input = require('diffy/input')({showCursor: true})
const stripAnsi = require('strip-ansi')

let nick, channelHex, numConnections, doc

function initUI (opts) {
  nick = opts.nick
  channelHex = opts.channelHex
  numConnections = opts.numConnections
  doc = opts.doc
  render(doc)
  input.on('update', () => { render(doc) })
  input.on('enter', line => {
    doc = opts.postMessage(line)
    render(doc)
  })
  // For network connection display
  setInterval(() => { render(doc) }, 3000)
  return render
}

function render (renderDoc) {
  doc = renderDoc
  diffy.render(() => {
    let output = ''
    output += `Join: npx hm-chat ${channelHex}\n`
    output += `${numConnections} connections. `
    output += `Use Ctrl-C to exit.\n\n`
    let displayMessages = []
    let messages = doc.getIn(['messages'])
    messages = messages ? messages.toJS() : {}
    Object.keys(messages).sort().forEach(key => {
      if (key === '_objectId') return
      if (key === '_conflicts') return
      const {nick, message, joined} = messages[key]
      if (joined) {
        displayMessages.push(`${nick} has joined.`)
      } else {
        if (message) {
          displayMessages.push(`${nick}: ${message}`)
        }
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
  })
}

module.exports = initUI
