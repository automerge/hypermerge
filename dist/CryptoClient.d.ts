import * as Crypto from './Crypto';
import { DocUrl } from './Misc';
import { ToBackendQueryMsg } from './RepoMsg';
export declare type RequestFn = (msg: ToBackendQueryMsg, cb: (msg: any) => void) => void;
export default class CryptoClient {
    request: RequestFn;
    constructor(request: RequestFn);
    sign(url: DocUrl, message: string): Promise<Crypto.SignedMessage<string>>;
    verify(url: DocUrl, signedMessage: Crypto.SignedMessage<string>): Promise<boolean>;
    box(senderSecretKey: Crypto.EncodedSecretEncryptionKey, recipientPublicKey: Crypto.EncodedPublicEncryptionKey, message: string): Promise<Crypto.Box>;
    openBox(senderPublicKey: Crypto.EncodedPublicEncryptionKey, recipientSecretKey: Crypto.EncodedSecretEncryptionKey, box: Crypto.Box): Promise<string>;
    sealedBox(publicKey: Crypto.EncodedPublicEncryptionKey, message: string): Promise<Crypto.EncodedSealedBoxCiphertext>;
    openSealedBox(keyPair: Crypto.EncodedEncryptionKeyPair, sealedBox: Crypto.EncodedSealedBoxCiphertext): Promise<string>;
    encryptionKeyPair(): Promise<Crypto.EncodedEncryptionKeyPair>;
}
