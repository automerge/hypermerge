# Hypermerge

Hypermerge is a secure, real-time distributed JSON-like data store that can be modified concurrently by different users, and merged again automatically.

It is built on top of the [Automerge](https://github.com/automerge/automerge) data structure and the [Hypercore](https://github.com/mafintosh/hypercore) distributed append-only log from the [Dat project](https://datproject.org/).

Automerge is a new Conflict-Free Replicated Data Type
  ([CRDT](https://en.wikipedia.org/wiki/Conflict-free_replicated_data_type)). It is based on [academic research on JSON CRDTs](https://arxiv.org/abs/1608.03960) (but some details are different from the paper).

``` sh
npm install --save hypermerge
```

## Features

* JSON-like data structure, ideal for application data stores
* easy peer-to-peer networking
* real-time subscriptions
* multiple writers on multiple devices
* automatic syncing and merging
* offline support
* intelligent handling of conflicts, automatic resolution
* can run entirely in memory
* optionally, storage can be persisted to disk

## Usage

## API

## LICENSE

MIT
