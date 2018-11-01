declare module "bs58" {
  function encode(buffer: Buffer | Array<number>): string
  function decode(str: string): Buffer
}
