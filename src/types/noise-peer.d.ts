declare module 'noise-peer' {
  import { Duplex } from 'stream'

  const noisePeer: NoisePeer
  export default noisePeer
  // export function keyGen():

  export interface NoisePeer {
    (rawStream: Duplex, isInitiator: boolean, noiseOpts?: NoiseOptions): SecureStream
  }

  interface SecureStream extends Duplex {
    /**
     * Boolean indicating whether the stream is a client/initiator or a server/responder,
     * as given by the isInitiator constructor argument.
     */
    initiator: boolean

    /** Access to the rawStream passed in the constructor */
    rawStream: Duplex
  }

  interface NoiseOptions {}
}
