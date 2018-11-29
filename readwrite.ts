
import { Repo } from "./dist"

import Client from "discovery-cloud-client"

const ram: Function = require("random-access-memory")

const repo = new Repo({ storage: ram })

const discovery = new Client({
  url: "wss://discovery-cloud.herokuapp.com",
  id: repo.id,
  stream: repo.stream,
})

repo.replicate(discovery)

const id = process.argv[2]

if (id === undefined) {
  const id = repo.create()
  console.log("ID",id)
  const doc = repo.open(id)
  setInterval(() => {
    doc.change((state : any) => {
      state.foo = (state.foo || 0) + 1
    })
  },1000)
  doc.subscribe((state:any) => {
    console.log("STATE",state)
  })
} else {
  console.log("OPEN",id)
  const doc = repo.open(id)
  setTimeout(() => {
    console.log("forking doc")
    const followid = doc.branch()
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
    }, 1000)
  },3000)
  setInterval(() => {
    doc.change((state : any) => {
      state.bar = (state.bar || 0) + 1
    })
  },1000)
  doc.subscribe((state:any) => {
    console.log("STATE",state)
  })
}
console.log(process.argv)
console.log("replicate...")
