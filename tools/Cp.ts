
import fs from "fs"
import { Repo } from "../src"
import mime from "mime-types"

const raf: Function = require("random-access-file")
const file = process.argv[2]
const path = process.argv[3]

if (path === undefined || file === undefined) {
  console.log("Usage: cp FILE REPO")
  process.exit()
}

if (!fs.existsSync(path + "/ledger")) {
  console.log("No repo found: " + path)
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
const id = repo.writeFile(data,mimeType)

repo.readFile(id,(data, mimeType) => {
  console.log("hyperfile://" + id)
  console.log("File Size: ", data.length)
  console.log("File Type: ", mimeType)
  process.exit()
})

