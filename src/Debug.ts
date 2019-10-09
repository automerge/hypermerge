export const trace = (label: string) => <T>(x: T, ...args: any[]): T => {
  console.log(`${label}:`, x, ...args)
  return x
}

export function assignGlobal(objs: { [name: string]: any }) {
  Object.assign(global, objs)
}
