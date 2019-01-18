
import fs from "fs"
import { Repo } from "../src"
import mime from "mime-types"

const raf: Function = require("random-access-file")
const file = process.argv[2]
const _path = process.argv[3]
const path = _path || ".data"

if (file === undefined) {
  console.log("Usage: cp FILE [REPO]")
  process.exit()
}

if (_path && !fs.existsSync(_path + "/ledger")) {
  console.log("No repo found: " + _path)
  process.exit()
}

if (!fs.existsSync(file)) {
  console.log("No file found: " + file)
  process.exit()
}

setTimeout(() => {}, 50000) // dont exit yet

const data = fs.readFileSync(file)
const mimeType = mime.lookup(file) || 'application/octet-stream'

const repo = new Repo({ path, storage: raf })
const url = repo.writeFile(data,mimeType)

repo.readFile(url,(data, mimeType) => {
  console.log(url)
  console.log("File Size: ", data.length)
  console.log("File Type: ", mimeType)
  process.exit()
})

