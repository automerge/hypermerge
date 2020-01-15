declare module 'diffy' {
  function DiffyConstructor(options?: Options): Diffy
  export default DiffyConstructor
  export interface Options {
    fullscreen?: boolean
  }

  export interface Diffy {
    render(cb: () => string)
    width: number
    height: number
  }
}

declare module 'diffy/input' {
  function DiffyConstructor(options?: InputOptions): DiffyInput
  export default DiffyConstructor

  export interface InputOptions {
    showCursor?: boolean
  }
  export interface DiffyInput {
    on(event: string, cb: any): void
    line(): string
  }
}
