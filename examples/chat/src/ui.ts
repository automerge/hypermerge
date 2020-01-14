/// <reference path="./diffy.d.ts" />

import Channel from './channel'
import Diffy from 'diffy'
import DiffyInput from 'diffy/input'
import stripAnsi from 'strip-ansi'

const diffy = Diffy({ fullscreen: true })
const input = DiffyInput({ showCursor: true })

function initUI(channel: Channel) {
  render(channel)

  input.on('enter', (line: string) => channel.addMessageToDoc(line))
  input.on('update', () => render(channel))
  channel.on('updated', (channel) => render(channel))

  // For network connection display
  setInterval(() => {
    render(channel)
  }, 3000)
}

function render(channel: Channel) {
  const nick = channel.nick
  const url = channel.url
  const doc = channel.doc

  if (doc) {
    diffy.render(() => {
      let output = ''
      output += `Join: npx hm-chat ${url}\n`
      output += `${channel.getNumConnections()} connections. `
      output += `Use Ctrl-C to exit.\n\n`
      const displayMessages: string[] = []
      let { messages } = doc
      Object.keys(messages)
        .sort()
        .forEach((key) => {
          if (key === '_objectId') return
          if (key === '_conflicts') return
          const { nick, content, joined } = messages[key]
          if (joined) {
            displayMessages.push(`${nick} has joined.`)
          } else {
            if (content) {
              displayMessages.push(`${nick}: ${content}`)
            }
          }
        })
      // Delete old messages
      const maxMessages = diffy.height - output.split('\n').length - 2
      displayMessages.splice(0, displayMessages.length - maxMessages)
      displayMessages.forEach((line) => {
        output += stripAnsi(line).substr(0, diffy.width - 2) + '\n'
      })
      for (let i = displayMessages.length; i < maxMessages; i++) {
        output += '\n'
      }
      output += `\n[${nick}] ${input.line()}`
      return output
    })
  }
}

export default initUI
