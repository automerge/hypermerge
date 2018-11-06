"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tape_1 = __importDefault(require("tape"));
const src_1 = require("../src");
tape_1.default("Math test", (t) => {
    const repo = new src_1.Repo();
    const doc = repo.createDocument();
    let i = 0;
    doc.on("doc", (d) => {
        console.log("DOC", d);
        i += 1;
        if (i == 3) {
            t.equal(d.foo, "bar");
            t.end();
        }
    });
    doc.change(doc => {
        doc.foo = "bar";
    });
});
//# sourceMappingURL=unit.test.js.map