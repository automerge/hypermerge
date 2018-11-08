"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const tape_1 = __importDefault(require("tape"));
const src_1 = require("../src");
const ram = require("random-access-memory");
tape_1.default("Simple create doc and make a change", (t) => {
    const repo = new src_1.Repo({ storage: ram });
    const id = repo.create();
    const handle = repo.open(id);
    handle.subscribe((state, index) => {
        switch (index) {
            case 0:
                t.equal(state.foo, undefined);
                break;
            case 1:
                t.equal(state.foo, "bar");
                break;
            case 2:
                t.equal(state.foo, "bar");
                t.end();
                handle.close();
        }
    });
    handle.change(state => {
        state.foo = "bar";
    });
});
tape_1.default("Create a doc backend - then wire it up to a frontend - make a change", (t) => {
    const back = new src_1.RepoBackend({ storage: ram });
    const front = new src_1.RepoFrontend();
    back.subscribe(front.receive);
    front.subscribe(back.receive);
    const id = front.create();
    const handle = front.open(id);
    handle.subscribe((state, index) => {
        switch (index) {
            case 0:
                t.equal(state.foo, undefined);
                break;
            case 1:
                t.equal(state.foo, "bar");
                break;
            case 2:
                t.equal(state.foo, "bar");
                t.end();
                handle.close();
        }
    });
    handle.change(state => {
        state.foo = "bar";
    });
});
//# sourceMappingURL=unit.test.js.map