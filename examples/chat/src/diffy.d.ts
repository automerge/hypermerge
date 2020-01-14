declare module 'diffy' {
  export default (options?: Options) => Diffy
  export interface Options {
    fullscreen?: boolean
  }

  export interface Diffy {
    render(cb: () => string[])
  }
}

declare module 'diffy/input' {
  export default (options?: InputOptions) => DiffyInput

  export interface InputOptions {
    showCursor?: boolean
  }
  export interface DiffyInput {
    on(event: string, cb: any): void
    line(): string
  }
}
