/// <reference types="../../../src/types/hyperswarm" />
import { Repo } from "hypermerge"
import Hyperswarm from 'hyperswarm'

const uuid = require('uuid/v4')
const raf: Function = require("random-access-file")

interface MyDoc {
    numbers: number[],
    foo?: string,
    bar?: string,
    status?: string 
}

// Repos are created on disk at location "dbName"
function myRepos(dbName: string) {
  return new Repo({path: dbName, memory: false}) 
}

// Repos will connect through the swarm
function getSwarm() {
  return Hyperswarm({
    queue: {
      multiplex: true,
    },
  }
  )
}

const repoA = myRepos("repo-a")
const repoB = myRepos("repo-b")

repoA.addSwarm(getSwarm(),{announce: true})
repoB.addSwarm(getSwarm(), {announce: true})

// Create single test document
const docUrl = repoA.create({ numbers: [ 2,3,4 ], status: "Create"})

console.log(docUrl)

//Repo callbacks to watch for changes on the shared document
repoB.watch<MyDoc>(docUrl, state => {
  console.log("RepoB: -> ", state)
})

repoA.watch<MyDoc>(docUrl, state => {
  console.log("RepoA: ->", state)
})

// Make changes to the single test document from RepoA and RepoB
repoA.change<MyDoc>(docUrl, state => {
  state.numbers.push(5)
  state.foo = "bar"
})

repoB.change<MyDoc>(docUrl, state => {
   state.numbers.push(6)
   state.status = "Updated" 
})

const sm = sign()

async function sign() {
  const message = 'test message'
  const signedMessage = await repoA.crypto.sign(docUrl, message)
  const success = await repoA.crypto.verify(docUrl, signedMessage)
  console.log(signedMessage, success ? "Message verified" : "Message NOT verified")
}

