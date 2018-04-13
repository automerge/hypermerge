# Hypermerge

Hypermerge is a Node.js library for building p2p collaborative applications without any server infrastructure.
It combines [Automerge][automerge], a CRDT, with [hypercore][hypercore], a distributed append-only log.

## Example Usage

See [examples/chat/channel.js][chat-model] for example usage.

## API

You can also view the [generated API docs][api-docs].

### `var hm = new Hypermerge([options])`

Creates a new Hypermerge instance that manages a set of documents.
All previously opened documents are automatically re-opened.

`options`:

```
{
  path: string, // directory where the documents should be stored
  immutableApi: false, // whether to use Automerge Immutable.js documents
  defaultMetadata: {} // default metadata that should be written for created documents. Can be set later with `hypermergeInstance.defaultMetadata = {}`
}
```

### `hm.joinSwarm([options])`

Joins the network swarm for all documents managed by this Hypermerge instance. Must be called after `'ready'` has been emitted. `options` are passed to [`discovery-swarm`][discovery-swarm].

### `var doc = hm.create([metadata])`

Creates a new document (and hypercore) tracked by the hypermerge instance.
If an object is passed, it will be associated with the newly created document. Some metadata properties are assigned automatically by hypermerge:

```js
docId // An id for this document. Forking a document creates a new docId.
groupId // An id for this group of documents. Forking a document keeps the groupId.
```

### `hm.open(docId)`

Opens the document specified by `docId`. Will download the document over the network if `hm.joinSwarm()` was called. The document is opened asynchronously; listen for the `'document:ready'` event to get the document when it has finished opening.

### `hm.update(doc)`

Records any local changes made to the document (via [`Automerge.change`][automerge-change]).

### `var newDoc = hm.change(doc, changeFn)`

Shorthand for `hm.update(Automerge.change(doc, changeFn))`.

### `var doc = hm.fork(parentId, [metadata])`

Creates a new document based on the document referenced by `parentId`.
The metadata of the new document will contain a `parentId` property.

### `var mergedDoc = hm.merge(destDocId, sourceDocId)`

Merges changes from the document referenced by `sourceDocId` into the document referenced by `destDocId`. Returns the merged document.

The source and destination docs must have come from the same root document.
e.g. The source doc was a `.fork()` of the destination doc, or visa-versa.

### `hm.find(docId)`

Returns the document for the given docId. Throws if the document has not been opened yet.

### `hm.getId(doc)`

Returns the `docId` for the given `doc`.

### `hm.metadatas(docId)`

Returns the list of metadata objects corresponding to the list of actors that have edited this document.

### `hm.has(docId)`

Returns `true` if `docId` has been opened.

### `hm.any([function])`

Returns `true` if any docs satisfy the given function. If a function is not passed, returns true if any docs exist.

### `hm.isMissingDeps(docId)`

Returns `true` if the document specified by `docId` is missing changes from other actors. They may still be downloading from the network.

## Events

`hm.on('ready', hm)`

Emitted when all document metadata has been loaded from storage, and the hypermerge instance is ready for use. Documents will continue loading from storage and the network. Required before `.create()`, `.open()`, etc. can be used.

`hm.on('document:ready', docId, doc)`

Emitted when a document has been fully loaded.

`hm.on('document:updated', docId, doc, prevDoc)`

Emitted when a document has been updated via changes received over the network. Not emitted after local calls to `.update()` or `.change()`.

`hm.on('peer:joined', actorId, peer)`

Emitted when a network peer has connected.

`hm.on('peer:left', actorId, peer)`

Emitted when a network peer has disconnected.

[automerge]: https://github.com/automerge/automerge
[hypercore]: https://github.com/mafintosh/hypercore
[automerge-change]: https://github.com/automerge/automerge#manipulating-and-inspecting-state
[chat-model]: https://github.com/automerge/hypermerge/blob/master/examples/chat/channel.js
[api-docs]: https://automerge.github.io/hypermerge/
[discovery-swarm]: https://github.com/mafintosh/discovery-swarm
