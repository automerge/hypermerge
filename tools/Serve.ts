
import { Repo } from "../src"
const raf: Function = require("random-access-file")
const ram: Function = require("random-access-memory")
const DiscoverySwarm = require("discovery-swarm");
const defaults = require('dat-swarm-defaults')
const id = process.argv[2]
const _path = process.argv[3]
const path = _path || ".data"

if (id === undefined) {
  console.log("Usage: watch DOC_ID [REPO]")
  process.exit()
}

const storage = raf
const repo = new Repo({ path, storage })

const url = "wss://discovery-cloud.herokuapp.com" 

const discovery = new DiscoverySwarm(defaults({stream: repo.stream, id: repo.id }));

repo.replicate(discovery);

repo.meta(id,(meta) => {
  console.log("META", meta)
  if (meta && meta.type === "File") {
    repo.readFile(id, (file,mimeType) => {
      console.log("FILE",file.length,mimeType)
    })
  } else {
    repo.watch(id, (val,c) => {
      console.log("CLOCK",c)
      console.log(val)
    })
  }
})

