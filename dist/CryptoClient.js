"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const Metadata_1 = require("./Metadata");
class CryptoClient {
    constructor(request) {
        this.request = request;
    }
    sign(url, message) {
        return new Promise((res, rej) => {
            const docId = Metadata_1.validateDocURL(url);
            this.request({ type: 'SignMsg', docId, message }, (msg) => {
                if (msg.success)
                    return res(msg.signedMessage);
                rej(msg.error);
            });
        });
    }
    verify(url, signedMessage) {
        return new Promise((res) => {
            const docId = Metadata_1.validateDocURL(url);
            this.request({
                type: 'VerifyMsg',
                docId,
                signedMessage,
            }, (msg) => {
                res(msg.success);
            });
        });
    }
    /**
     * Helper function to extract the message from a SignedMessage.
     * Verifies the signature and returns the message if valid, otherwise rejects.
     */
    verifiedMessage(url, signedMessage) {
        return __awaiter(this, void 0, void 0, function* () {
            const verified = this.verify(url, signedMessage);
            if (!verified)
                throw new Error('Could not verify signedMessage');
            return signedMessage.message;
        });
    }
    box(senderSecretKey, recipientPublicKey, message) {
        return new Promise((res, rej) => {
            this.request({ type: 'BoxMsg', senderSecretKey, recipientPublicKey, message }, (msg) => {
                if (msg.success)
                    return res(msg.box);
                rej(msg.error);
            });
        });
    }
    openBox(senderPublicKey, recipientSecretKey, box) {
        return new Promise((res, rej) => {
            this.request({ type: 'OpenBoxMsg', senderPublicKey, recipientSecretKey, box: box }, (msg) => {
                if (msg.success)
                    return res(msg.message);
                rej(msg.error);
            });
        });
    }
    sealedBox(publicKey, message) {
        return new Promise((res, rej) => {
            this.request({ type: 'SealedBoxMsg', publicKey, message }, (msg) => {
                if (msg.success)
                    return res(msg.sealedBox);
                rej(msg.error);
            });
        });
    }
    openSealedBox(keyPair, sealedBox) {
        return new Promise((res, rej) => {
            this.request({ type: 'OpenSealedBoxMsg', keyPair, sealedBox }, (msg) => {
                if (msg.success)
                    return res(msg.message);
                rej(msg.error);
            });
        });
    }
    encryptionKeyPair() {
        return new Promise((res, rej) => {
            this.request({ type: 'EncryptionKeyPairMsg' }, (msg) => {
                if (msg.success)
                    return res(msg.keyPair);
                rej(msg.error);
            });
        });
    }
}
exports.CryptoClient = CryptoClient;
//# sourceMappingURL=CryptoClient.js.map