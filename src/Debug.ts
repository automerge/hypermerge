import * as Keys from './Keys'
import Debug, { IDebugger } from 'debug'

Debug.formatters.b = Keys.encode

export { IDebugger }
export const log = Debug('hypermerge')

export default (namespace: string) => log.extend(namespace)

export const trace = (label: string) => <T>(x: T, ...args: any[]): T => {
  console.log(`${label}:`, x, ...args)
  return x
}

export function assignGlobal(objs: { [name: string]: any }) {
  Object.assign(global, objs)
}
