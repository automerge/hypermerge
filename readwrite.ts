
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
  setInterval(() => {
    repo.change(id, (state : any) => {
      state.foo = (state.foo || 0) + 1
    })
  },1000)
  repo.watch(id, (state:any, clock) => {
    console.log("STATE",state, clock)
  })
} else {
  console.log("OPEN",id)
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
