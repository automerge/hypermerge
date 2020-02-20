declare module 'lru' {
  export type LRUOptions =
    | number
    | {
        max: number
        maxAgeInMilliseconds: number
      }

  export default class LRU<a> {
    constructor(options: LRUOptions)
    length: number
    keys(): string[]
    set(string, a): void
    get(string):?a
    peek(string):?a
    remove(string):void
    clear():void
    on(type:"evict", callback:({key:string, value:a}) => any):void
  }
}
