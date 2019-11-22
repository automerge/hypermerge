"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Keys = __importStar(require("./Keys"));
const debug_1 = __importDefault(require("debug"));
debug_1.default.formatters.b = Keys.encode;
exports.log = debug_1.default('hypermerge');
exports.default = (namespace) => exports.log.extend(namespace);
exports.trace = (label) => (x, ...args) => {
    console.log(`${label}:`, x, ...args);
    return x;
};
function assignGlobal(objs) {
    Object.assign(global, objs);
}
exports.assignGlobal = assignGlobal;
//# sourceMappingURL=Debug.js.map