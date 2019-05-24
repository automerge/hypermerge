
import fs from "fs"
import { Repo } from "../src"
const raf: Function = require("random-access-file")
const id = process.argv[2]
const _path = process.argv[3]
const path = _path || ".data"

if (path === undefined || id === undefined) {
  console.log("Usage: meta ID [REPO]")
  process.exit()
}

if (_path && !fs.existsSync(_path + "/ledger")) {
  console.log("No repo found: " + _path)
  process.exit()
}

setTimeout(() => {}, 50000)

const repo = new Repo({ path, storage: raf })
repo.meta(id,(meta) => {
  console.log(meta)
  process.exit()
})
