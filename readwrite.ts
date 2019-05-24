
import { Repo } from "./dist"

import Client from "discovery-cloud-client"

const ram: Function = require("random-access-memory")
const DiscoverySwarm = require("discovery-swarm");
const defaults = require('dat-swarm-defaults')

const repo = new Repo({ storage: ram })

const hyperswarmwrapper = new DiscoverySwarm(defaults({stream: repo.stream, id: repo.id }));

repo.replicate(hyperswarmwrapper);

const id = process.argv[2]

if (id === undefined) {
  const id = repo.create()
  console.log("ts-node readwrite.ts",id)
//  const doc = repo.open(id)
  setInterval(() => {
    repo.change(id, (state : any) => {
      state.foo = (state.foo || 0) + 1
    })
//    doc.debug()
  },1000)
  repo.watch(id, (state:any, clock) => {
    console.log("STATE",state, clock)
  })
} else {
  console.log("OPEN",id)
//  const doc = repo.open(id)
/*
  setTimeout(() => {
    console.log("forking doc")
    const followid = doc.follow()
    const forkid = doc.fork()
    const fork = repo.open(forkid)
    const follow = repo.open(followid)
    fork.subscribe((state:any) => {
      console.log(" --- FORK STATE",state)
    })
    follow.subscribe((state:any) => {
      console.log(" +++ FOLLOW STATE",state)
    })
    setInterval(() => {
      console.log("merge fork")
      fork.merge(doc)
    }, 10000)
    setInterval(() => {
      console.log("merge fork")
      follow.change((state: any) => { state.follow = (state.follow || 1000) + 1 })
      fork.change((state:any) => { state.fork = (state.fork || 0) + 1 })
    }, 3000)
  }, 3000)
*/
  setInterval(() => {
    repo.change(id, (state : any) => {
      state.bar = (state.bar || 0) + 1
    })
  },1000)
  repo.watch(id, (state:any, clock) => {
    console.log("STATE",state, clock)
  })
}
console.log(process.argv)
