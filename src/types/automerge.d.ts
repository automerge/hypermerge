declare module "automerge/backend" {
  export interface Clock {
    [actorId: string]: number
  }

  export interface Patch {
    clock: Clock
    deps: Clock
    canUndo: boolean
    canRedo: boolean
    diffs: Diff[]
  }

  export interface Change {
    requestType?: string
    actor: string
    seq: number
    deps: Clock
    ops: Op[]
  }

  export type BackDoc = string & { _: "BackDoc" }
  export type Op = string & { _: "Op" }
  export type Diff = string & { _: "Diff" }

  function init(): BackDoc
  function applyChanges(doc: BackDoc, changes: Change[]): [BackDoc, Patch]
  function applyLocalChange(doc: BackDoc, changes: Change): [BackDoc, Patch]
  function getPatch(doc: BackDoc): Patch
  function getChanges(doc1: BackDoc, doc2: BackDoc): Change[]
  function getChangesForActor(doc: BackDoc, actorId: string): Change[]
  function getMissingChanges(doc: BackDoc, clock: Clock): Change[]
  function getMissingDeps(doc: BackDoc): Clock
  function merge(doc1: BackDoc, doc2: BackDoc): BackDoc
}

declare module "automerge/frontend" {
  export interface Clock {
    [actorId: string]: number
  }

  export type Op = string & { _: "Op" }
  export type Diff = string & { _: "Diff" }


  export interface Patch {
    clock: Clock
    deps: Clock
    canUndo: boolean
    canRedo: boolean
    diffs: Diff[]
  }

  export interface Change {
    requestType?: string
    actor: string
    seq: number
    deps: Clock
    ops: Op[]
  }

  function init(actorId?: string): Doc<{}>
  function init(any): Doc<{}>

  function setActorId<T>(doc: Doc<T>, actorId: string): Doc<T>
  function change<T>(doc: Doc<T>, msg: string, cb: ChangeFn<T>): [ Doc<T>, Change | null ]
  function change<T>(doc: Doc<T>, cb: ChangeFn<T>): [ Doc<T>, Change | null ]
  function applyPatch<T>(doc: Doc<T>, patch: Patch): Doc<T>

  function emptyChange<T>(doc: Doc<T>, msg: string): [ Doc<T>, Change | null ]
  function emptyChange<T>(doc: Doc<T>): [ Doc<T>, Change | null ]
  const Text: TextConstructor

  /// Readonly document types:

  type Value = null | string | number | boolean | Object | ValueList

  // A homogeneous list of Values
  interface List<T> extends ReadonlyArray<T & Value> { }

  // A heterogeneous list of Values
  interface ValueList extends List<Value> { }

  interface TextConstructor {
    new(): Text
  }

  interface Text extends List<string> { }

  interface Object {
    readonly [key: string]: Readonly<Value>
  }

  interface AnyDoc extends Object { }

  // includes _actorId and any properties in T, all other keys are 'unknown'
  type Doc<T> = AnyDoc & T

  /// Editable document types:

  // A homogeneous list of EditValues
  interface EditList<T extends EditValue> extends Array<T> { }

  // A heterogeneous list of EditValues
  interface EditValueList extends EditList<EditValue> { }

  type EditText = EditList<string>

  type EditValue = null | string | number | boolean | EditObject | EditValueList

  interface EditObject {
    // // TODO: These values don't exist currently:
    // readonly _objectId: string
    // [key: string]: EditValue
    [key: string]: unknown
  }

  interface AnyEditDoc extends EditObject {
    // // TODO: This value doesn't exist currently:
    // readonly _actorId: string
  }

  // includes _actorId and any properties in T, all other keys are 'unknown'
  type EditDoc<T> = AnyEditDoc & T

  interface ChangeFn<T> {
    (doc: EditDoc<T>): void
  }
}
