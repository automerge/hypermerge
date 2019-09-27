"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const log = debug_1.default('hypermerge:SqlStore');
exports.IN_MEMORY_DB = ':memory:';
const migrationsPath = path_1.default.resolve(__dirname, './migrations/0001_initial_schema.sql');
// TODO: more robust migrations
class SqlStore {
    constructor(storage) {
        this.db = better_sqlite3_1.default(storage, { memory: storage === exports.IN_MEMORY_DB });
        this.migrate();
    }
    migrate() {
        log('migrating...');
        const migration = fs_1.default.readFileSync(migrationsPath, { encoding: 'utf-8' });
        this.db.exec(migration);
        log('migration complete');
    }
    close() {
        this.db.close();
    }
}
exports.default = SqlStore;
//# sourceMappingURL=SqlStore.js.map