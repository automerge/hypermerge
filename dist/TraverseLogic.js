"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// This *must* be the automerge used by hypermerge, otherwise the instanceof
// checks below will fail.
const automerge_1 = __importDefault(require("automerge"));
const Misc_1 = require("./Misc");
exports.WARNING_STACK_SIZE = 2000;
// NOTE: no cycle detection. This function is intended to be used for traversing
// a single document and cycles within a document are impossible.
// TODO: type this against Doc<any>?
function iterativeDfs(select, root) {
    const stack = [root];
    const results = [];
    while (stack.length) {
        // Yell if we're traversing real deep into a document.
        if (stack.length > exports.WARNING_STACK_SIZE) {
            console.warn('Traverse.iterativeDFS large stack size warning.', `Stack size: ${stack.length}`, root);
            return results;
        }
        const obj = stack.pop();
        // Note: Manually check for Automerge.Text and don't inspect these. This will
        // blow up the stack size (which may not actually matter, but there's no point
        // in checking Automerge.Text anyway)
        // TODO: genericize this, maybe with a skip function, e.g. `if (skip(obj)) {`
        if (obj instanceof automerge_1.default.Text) {
            // eslint-disable-next-line no-continue
            continue;
        }
        else if (Misc_1.isPlainObject(obj)) {
            Object.entries(obj).forEach((entry) => stack.push(entry));
        }
        else if (obj && hasForEach(obj)) {
            obj.forEach((val) => stack.push(val));
        }
        else if (select(obj)) {
            results.push(obj);
        }
    }
    return results;
}
exports.iterativeDfs = iterativeDfs;
function hasForEach(val) {
    return !!val.forEach;
}
//# sourceMappingURL=TraverseLogic.js.map