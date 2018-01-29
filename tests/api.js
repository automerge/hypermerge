const test = require('tape')
const {HyperMerge} = require('..')
const tmp = require('tmp')

// Snippets of code from pixelpusher (multicore branch)
//
// https://github.com/inkandswitch/pixelpusher/blob/multicore/src/store/sync.js

// constructor

/*
const sync = global.sync = new HyperMerge({
	peerInfo: store.getState().present.peerInfo.toJS(),
	port: 3282 + clientId,
	path: `./.data/pixelpusher-v7/client-${clientId}`,
}).once('ready', _syncReady)
*/

test('constructor', t => {
  t.plan(1)

  const tmpdir = tmp.dirSync({unsafeCleanup: true})
  const hm = new HyperMerge({
    path: tmpdir.name
  })
  t.ok(hm, 'is truthy')
  hm.core.ready(() => {
    hm.swarm.close()
    tmpdir.removeCallback()
  })
})

/**
 * .openAll()
 *
 * Loads all the hypercore feeds from the storage directory (one per actor)
 * and/or the network swarm, and builds automerge documents for each
 * hypercore/actor.
 */

/*
sync.openAll()
*/

/**
 * .any()
 *
 * Have any automerge documents been built?
 */

/*
if (!sync.any()) {
	dispatch({type: 'NEW_PROJECT_CLICKED'})
}
*/

/**
 * .isWritable(hex)
 *
 * Is the hypercore writable?
 */

/**
 * .update(doc)
 *
 * Finds any new changes for the submitted doc for the actor,
 * and appends the changes to the actor's hypercore feed
 */

/*
whenChanged(store, getProject, project => {
	if (sync.isWritable(project._actorId)) sync.update(project)
})
*/

/**
 * .peerInfo = ...
 *
 * Just stores peerInfo in the object. Not really part of the API.
 */

/*
whenChanged(store, state => state.peerInfo, info => {
	sync.peerInfo = info.toJS()
})
*/

/**
 * .create()
 *
 * Creates a new hypercore feed for a new actor and returns a new
 * automerge document
 */

/*
whenChanged(store, state => state.createdProjectCount, shouldCreate => {
	if (!shouldCreate) return

	const project = Init.project(sync.create())

	dispatch({type: "PROJECT_CREATED", project})
})
*/

/**
 * .delete(hex)
 *
 * Removes hypercore feed for an actor and automerge doc.
 *
 * Should leave the network swarm. Doesn't remove files from disk.
/*

whenChanged(store, state => state.deletingProjectId, id => {
	if (!id) return

	sync.delete(id)
	dispatch({type: 'PROJECT_DELETED', id})
})
*/

/**
 * .fork(hex)
 *
 * Creates a new actor hypercore feed and automerge document, with
 * an empty change that depends on the document for another actor
/*

whenChanged(store, state => state.clonedProjectId, id => {
	if (!id) return

	const project = sync.fork(id)
	dispatch({type: 'PROJECT_CLONED', project})
})
*/

/**
 * .merge(hex, hex2)
 *
 * Takes all the changes from another actor (hex2) and adds them to
 * the automerge doc.
 */

/*
whenChanged(store, state => state.mergingProjectId, id => {
	if (!id) return

	const currentId = store.getState().present.currentProjectId

	const project = sync.merge(currentId, id)
	dispatch({type: 'PROJECT_MERGED', project})
})
*/

/**
 * .open(hex)
 *
 * Loads a single hypercore feed from the storage directory for a single actor
 * and/or the network swarm, and builds an automerge document.
 */ 

/*
whenChanged(store, state => state.openingProjectId, id => {
	if (!id) return
	sync.open(id)
})
*/

/**
 * Event: 'document:ready'
 *   Args: doc
 *
 * Emitted when all the data from a hypercore feed has been downloaded.
/*

sync.on('document:ready', project => {
	if (!project.get('relativeId')) return
	dispatch({type: "REMOTE_PROJECT_OPENED", project})
})
*/

/**
 * Event: 'document:updated'
 *   Args: doc
 *
 * Emitted when changes have been applied to an automerge document for an actor
 */

/*
sync.on('document:updated', project => {
	if (!project.get('relativeId')) return
	dispatch({type: "REMOTE_PROJECT_UPDATED", project})
})
*/

/**
 * Event: 'merge:listening'
 *   Args: merge
 *
 * Not implemented? 
 */

/*
sync.on('merge:listening', merge => {
	const key = merge.key.toString('hex')
	const id = (merge.local || merge.source).id.toString('hex')

	dispatch({type: 'SELF_CONNECTED', key, id})
})
*/

/**
 * Event: 'merge:joined'
 *   Args: merge
 *
 * Not implemented? 
 */

/*
sync.on('merge:joined', (merge, {id, info}) => {
	const key = merge.key.toString('hex')
	dispatch({type: 'PEER_CONNECTED', key, id, info})

	const {avatarKey} = info.peerInfo || {}
	if (avatarKey) sync.openDocument(avatarKey)
})
*/

/**
 * Event: 'merge:left'
 *   Args: merge
 *
 * Not implemented? 
 */

/*
sync.on('merge:left', (merge, {id}) => {
	const key = merge.key.toString('hex')
	dispatch({type: 'PEER_DISCONNECTED', key, id})
})
*/



