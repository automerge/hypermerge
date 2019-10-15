"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class KeyStore {
    constructor(db) {
        this.db = db;
        this.preparedGet = this.db.prepare(`SELECT * FROM Keys WHERE name=?`);
        this.preparedSet = this.db.prepare(`
        INSERT INTO Keys (name, publicKey, secretKey) VALUES (?, ?, ?)
        ON CONFLICT (name) DO UPDATE SET publicKey=excluded.publicKey, secretKey=excluded.secretKey`);
        this.preparedClear = this.db.prepare(`DELETE FROM Keys WHERE name=?`);
    }
    get(name) {
        const res = this.preparedGet.get(name);
        return res ? { publicKey: res.publicKey, secretKey: res.secretKey } : undefined;
    }
    set(name, keyPair) {
        this.preparedSet.run(name, keyPair.publicKey, keyPair.secretKey);
        return keyPair;
    }
    clear(name) {
        this.preparedClear.run(name);
    }
}
exports.default = KeyStore;
//# sourceMappingURL=KeyStore.js.map