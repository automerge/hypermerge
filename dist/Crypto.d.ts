/// <reference types="node" />
import sodium from 'sodium-native';
export declare type EncodedPublicKey = string & {
    __encodedPublicKey: true;
};
export declare type EncodedSecretKey = string & {
    __encodedSecretKey: true;
};
export interface EncodedKeyPair {
    publicKey: EncodedPublicKey;
    secretKey: EncodedSecretKey;
}
export declare type EncodedPublicSigningKey = EncodedPublicKey & {
    __encodedPublicSigningKey: true;
};
export declare type EncodedSecretSigningKey = EncodedSecretKey & {
    __encodedSecretSigningKey: true;
};
export interface EncodedSigningKeyPair extends EncodedKeyPair {
    publicKey: EncodedPublicSigningKey;
    secretKey: EncodedSecretSigningKey;
}
export declare type EncodedPublicEncryptionKey = EncodedPublicKey & {
    __encodedPublicEncryptionKey: true;
};
export declare type EncodedSecretEncryptionKey = EncodedSecretKey & {
    __encodedSecretEncryptionKey: true;
};
export interface EncodedEncryptionKeyPair extends EncodedKeyPair {
    publicKey: EncodedPublicEncryptionKey;
    secretKey: EncodedSecretEncryptionKey;
}
export declare type EncodedSignature = string & {
    __encodedSignature: true;
};
export declare type EncodedSealedBox = string & {
    __encodedSealedBox: true;
};
export declare type EncodedBox = string & {
    __encodedBox: true;
};
export declare function encodedSigningKeyPair(): EncodedSigningKeyPair;
export declare function signingKeyPair(): sodium.SigningKeyPair;
export declare function encodedEncryptionKeyPair(): EncodedEncryptionKeyPair;
export declare function encryptionKeyPair(): sodium.EncryptionKeyPair;
export declare function sign(secretKey: EncodedSecretSigningKey, message: Buffer): EncodedSignature;
export declare function verify(publicKey: EncodedPublicSigningKey, message: Buffer, signature: EncodedSignature): boolean;
export declare function sealedBox(publicKey: EncodedPublicEncryptionKey, message: Buffer): EncodedSealedBox;
export declare function openSealedBox(keyPair: EncodedEncryptionKeyPair, sealedBox: EncodedSealedBox): Buffer;
export declare function encode(val: sodium.PublicSigningKey): EncodedPublicSigningKey;
export declare function encode(val: sodium.SecretSigningKey): EncodedSecretSigningKey;
export declare function encode(val: sodium.PublicEncryptionKey): EncodedPublicEncryptionKey;
export declare function encode(val: sodium.SecretEncryptionKey): EncodedSecretSigningKey;
export declare function encode(val: sodium.Signature): EncodedSignature;
export declare function encode(val: sodium.SealedBox): EncodedSealedBox;
export declare function encode(val: Buffer): string;
export declare function decode(val: EncodedPublicSigningKey): sodium.PublicSigningKey;
export declare function decode(val: EncodedSecretSigningKey): sodium.SecretSigningKey;
export declare function decode(val: EncodedPublicEncryptionKey): sodium.PublicEncryptionKey;
export declare function decode(val: EncodedSecretEncryptionKey): sodium.SecretSigningKey;
export declare function decode(val: EncodedSignature): sodium.Signature;
export declare function decode(val: EncodedSealedBox): sodium.SealedBox;
export declare function decode(val: string): Buffer;
export declare function decodePair(pair: EncodedEncryptionKeyPair): sodium.EncryptionKeyPair;
export declare function decodePair(pair: EncodedSigningKeyPair): sodium.SigningKeyPair;
export declare function decodePair(pair: EncodedKeyPair): sodium.KeyPair;
export declare function encodePair(pair: sodium.EncryptionKeyPair): EncodedEncryptionKeyPair;
export declare function encodePair(pair: sodium.SigningKeyPair): EncodedSigningKeyPair;
export declare function encodePair(pair: sodium.KeyPair): EncodedKeyPair;
