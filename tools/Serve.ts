
import fs from "fs"
import { Repo } from "../src"
import mime from "mime-types"

const raf: Function = require("random-access-file")
const id = process.argv[2]
const _path = process.argv[3]
const path = _path || ".data"


if (id === undefined) {
  console.log("Usage: serve ID [REPO]")
  process.exit()
}

if (_path && !fs.existsSync(_path + "/ledger")) {
  console.log("No repo found: " + _path)
  process.exit()
}

const repo = new Repo({ path, storage: raf })

import Client from "discovery-cloud-client"
const discovery = new Client({
  url: "wss://discovery-cloud.herokuapp.com",
  id: repo.id,
  stream: repo.stream,
})

repo.replicate(discovery)

repo.meta(id,(meta) => {
  console.log(meta)
  if (meta === undefined) { throw new Error("No object in store:" + id) }
  if (meta.type === "File") {
    repo.readFile(id, (file,mimeType) => {
      console.log("FILE",file.length,mimeType)
    })
  } else {
    repo.watch(id, val => {
      console.log("DOC",val)
    })
  }
})
