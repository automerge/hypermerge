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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const sqlite_1 = __importDefault(require("sqlite"));
const path_1 = __importDefault(require("path"));
const debug_1 = __importDefault(require("debug"));
var sql_template_strings_1 = require("sql-template-strings");
exports.SQL = sql_template_strings_1.default;
const log = debug_1.default('hypermerge:SQLStore');
// Sqlite accepts ':memory:' as a filename and will create an in-memory database.
exports.IN_MEMORY_DB = ':memory:';
// Migration path will default to the INIT_CWD/migrations, which will
// not be what we want when using hypermerge as a dependency of another
// project.
const migrationsPath = path_1.default.resolve(__dirname, '../migrations');
class SQLStore {
    constructor(storage) {
        this.dbPromise = Promise.resolve()
            .then(() => {
            log('opening database...');
            return sqlite_1.default.open(storage);
        })
            .then((db) => {
            log('migrating database...');
            return db.migrate({ force: 'last', migrationsPath });
        })
            .then(effect(() => log('database ready')));
    }
    get(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.dbPromise;
            return db.get(sql);
        });
    }
    run(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.dbPromise;
            return db.run(sql);
        });
    }
    all(sql) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.dbPromise;
            return db.all(sql);
        });
    }
    close() {
        return __awaiter(this, void 0, void 0, function* () {
            const db = yield this.dbPromise;
            yield db.close();
            log('database closed');
        });
    }
}
exports.default = SQLStore;
// Join multiple statements with a delimiter.
function joinStatements(statements, delimiter) {
    return statements.reduce((stmt, curr) => stmt.append(delimiter).append(curr));
}
exports.joinStatements = joinStatements;
function effect(effectFn) {
    // TODO: multiple args!
    return function (arg) {
        effectFn();
        return arg;
    };
}
//# sourceMappingURL=SQLStore.js.map