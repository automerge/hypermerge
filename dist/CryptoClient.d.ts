import * as Crypto from './Crypto';
import { DocUrl } from './Misc';
import { ToBackendQueryMsg } from './RepoMsg';
export declare type RequestFn = (msg: ToBackendQueryMsg, cb: (msg: any) => void) => void;
export interface SignedValue<T extends string> {
    value: T;
    signature: Crypto.EncodedSignature;
}
export default class CryptoClient {
    request: RequestFn;
    constructor(request: RequestFn);
    sign<T extends string>(url: DocUrl, value: T): Promise<SignedValue<T>>;
    verify<T extends string>(url: DocUrl, signedValue: SignedValue<T>): Promise<boolean>;
    box(senderSecretKey: Crypto.EncodedSecretEncryptionKey, recipientPublicKey: Crypto.EncodedPublicEncryptionKey, message: string): Promise<[Crypto.EncodedBox, Crypto.EncodedBoxNonce]>;
    openBox(senderPublicKey: Crypto.EncodedPublicEncryptionKey, recipientSecretKey: Crypto.EncodedSecretEncryptionKey, box: Crypto.EncodedBox, nonce: Crypto.EncodedBoxNonce): Promise<string>;
    sealedBox(publicKey: Crypto.EncodedPublicEncryptionKey, message: string): Promise<Crypto.EncodedSealedBox>;
    openSealedBox(keyPair: Crypto.EncodedEncryptionKeyPair, sealedBox: Crypto.EncodedSealedBox): Promise<string>;
    encryptionKeyPair(): Promise<Crypto.EncodedEncryptionKeyPair>;
}
