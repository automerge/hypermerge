"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const fs_1 = __importDefault(require("fs"));
const log = debug_1.default('hypermerge:Database');
const migrationsPath = path_1.default.resolve(__dirname, './migrations/0001_initial_schema.sql');
function open(storage, memory) {
    const db = new better_sqlite3_1.default(storage, { memory });
    migrate(db);
    return db;
}
exports.open = open;
function migrate(db) {
    log('migrating...');
    const migration = fs_1.default.readFileSync(migrationsPath, { encoding: 'utf-8' });
    db.exec(migration);
    log('migration complete');
}
//# sourceMappingURL=SqlDatabase.js.map