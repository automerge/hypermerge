"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignGlobal = exports.trace = exports.log = void 0;
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