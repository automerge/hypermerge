// This *must* be the automerge used by hypermerge, otherwise the instanceof
// checks below will fail.
import { Text } from 'cambriamerge'
import { isPlainObject } from './Misc'

export const WARNING_STACK_SIZE = 2000
export interface SelectFn {
  (obj: unknown): boolean
}

// NOTE: no cycle detection. This function is intended to be used for traversing
// a single document and cycles within a document are impossible.
// TODO: type this against Doc<any>?
export function iterativeDfs<T>(select: SelectFn, root: unknown): T[] {
  const stack = [root]
  const results: T[] = []
  while (stack.length) {
    // Yell if we're traversing real deep into a document.
    if (stack.length > WARNING_STACK_SIZE) {
      console.warn(
        'Traverse.iterativeDFS large stack size warning.',
        `Stack size: ${stack.length}`,
        root
      )
      return results
    }
    const obj = stack.pop()
    // Note: Manually check for Automerge.Text and don't inspect these. This will
    // blow up the stack size (which may not actually matter, but there's no point
    // in checking Automerge.Text anyway)
    // TODO: genericize this, maybe with a skip function, e.g. `if (skip(obj)) {`
    if (obj instanceof Text) {
      // eslint-disable-next-line no-continue
      continue
    } else if (isPlainObject(obj)) {
      Object.entries(obj).forEach((entry: unknown) => stack.push(entry))
    } else if (obj && hasForEach(obj)) {
      obj.forEach((val: unknown) => stack.push(val))
    } else if (select(obj)) {
      results.push(obj as T)
    }
  }
  return results
}

// We use `.forEach` rather than `Symbol.Iterator` because strings are
// iterables that iterate through each character.
interface WithForEach<T> {
  forEach: (cb: (val: T) => void) => void
}
function hasForEach(val: unknown): val is WithForEach<unknown> {
  return !!(val as any).forEach
}
