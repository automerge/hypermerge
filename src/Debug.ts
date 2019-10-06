export const trace = (label: string) => <T>(x: T, ...args: any[]): T => {
  console.log(`${label}:`, x, ...args)
  return x
}
