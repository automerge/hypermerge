class DocHandle {
  constructor (hm, docId) {
    this.hm = hm
    this.id = docId
    this._cb = () => {}
  }

  get () {
    if (this.hm.readyIndex[this.id]) {
      return this.hm.find(this.id)
    }
    return null
  }

  /* make a change to a document through the handle */
  change (cb) {
    const doc = this.hm.find(this.id)
    this.hm.change(doc, cb)
    return this.hm.find(this.id)
  }

  /* register the function you'd like called when the document is updated */
  onChange (cb) {
    this._cb = cb
    if (this.hm.readyIndex[this.id]) {
      const doc = this.hm.find(this.id)
      cb(doc)
    }
    return this
  }

  message (message) {
    if (this.hm.readyIndex[this.id]) {
      this.hm.message(this.id, message)
    }
  }

  /* register the function you'd like called when you receive a message from a peer */
  onMessage (cb) {
    this._messageCb = cb
    return this
  }

  release () {
    this.hm.releaseHandle(this)
  }

  _message ({ peer, msg }) {
    if (this._messageCb) {
      this._messageCb({ peer, msg })
    }
  }

  _update (doc) {
    this._cb(doc)
  }

  _ready (doc) {
    this._cb(doc)
  }
}

module.exports = DocHandle
