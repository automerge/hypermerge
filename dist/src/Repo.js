"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RepoBackend_1 = require("./RepoBackend");
const RepoFrontend_1 = require("./RepoFrontend");
class Repo {
    constructor(opts) {
        this.front = new RepoFrontend_1.RepoFrontend();
        this.back = new RepoBackend_1.RepoBackend(opts);
        this.front.subscribe(this.back.receive);
        this.back.subscribe(this.front.receive);
        this.id = this.back.id;
        this.stream = this.back.stream;
    }
    create() {
        return this.front.create();
    }
    open(id) {
        return this.front.open(id);
    }
    replicate(swarm) {
        return this.back.replicate(swarm);
    }
}
exports.Repo = Repo;
//# sourceMappingURL=Repo.js.map