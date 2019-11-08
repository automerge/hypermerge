import * as Crypto from './Crypto';
import { DocUrl } from './Misc';
import { ToBackendQueryMsg } from './RepoMsg';
export declare type RequestFn = (msg: ToBackendQueryMsg, cb: (msg: any) => void) => void;
export default class CryptoClient {
    request: RequestFn;
    constructor(request: RequestFn);
    sign: (url: DocUrl, message: string) => Promise<Crypto.EncodedSignature>;
    verify: (url: DocUrl, message: string, signature: Crypto.EncodedSignature) => Promise<boolean>;
    sealedBox: (publicKey: Crypto.EncodedPublicEncryptionKey, message: string) => Promise<Crypto.EncodedSealedBox>;
    openSealedBox: (keyPair: Crypto.EncodedEncryptionKeyPair, sealedBox: Crypto.EncodedSealedBox) => Promise<string>;
    encryptionKeyPair: () => Promise<Crypto.EncodedEncryptionKeyPair>;
}
