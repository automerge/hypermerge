import { Repo } from "hypermerge"

interface MyDoc {
    numbers: number[],
    foo?: string,
    bar?: string
}

const storage = require("random-access-memory")

const repoA = new Repo({ storage })
const repoB = new Repo({ storage })

// DAT's discovery swarm or truly serverless discovery
const DiscoverySwarm = require("discovery-swarm");
const defaults = require('dat-swarm-defaults')
const discoveryA = new DiscoverySwarm(defaults({stream: repoA.stream, id: repoA.id }));
const discoveryB= new DiscoverySwarm(defaults({stream: repoB.stream, id: repoB.id }));

repoA.replicate(discoveryA)
repoB.replicate(discoveryB)

const docUrl = repoA.create({ numbers: [ 2,3,4 ]})

// this will block until the state has replicated to machine B

repoA.watch<MyDoc>(docUrl, state => {
  console.log("RepoA", state)
  // { numbers: [2,3,4] } 
  // { numbers: [2,3,4,5], foo: "bar" }
  // { numbers: [2,3,4,5], foo: "bar" } // (local changes repeat)
  // { numbers: [1,2,3,4,5], foo: "bar", bar: "foo" }
})

repoB.watch<MyDoc>(docUrl, state => {
  console.log("RepoB", state)
  // { numbers: [1,2,3,4,5], foo: "bar", bar: "foo" }
  if (state.numbers.length == 5) {
    process.exit()
  }
})

repoA.change<MyDoc>(docUrl, (state:MyDoc) => {
  state.numbers.push(5)
  state.foo = "bar"
})

repoB.change<MyDoc>(docUrl, (state:MyDoc) => {
  state.numbers.unshift(1)
  state.bar = "foo"
})

