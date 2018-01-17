const archiver = require('hypercore-archiver')
// const hypercore = require('hypercore')

class Multicore {
  constructor (storage) {
    this.archiver = archiver(storage)
  }
}

module.exports = Multicore
