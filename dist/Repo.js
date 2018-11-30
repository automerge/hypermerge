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
        this.create = this.front.create;
        this.open = this.front.open;
        this.follow = this.front.follow;
        this.doc = this.front.doc;
        this.fork = this.front.fork;
        this.watch = this.front.watch;
        this.merge = this.front.merge;
        this.replicate = this.back.replicate;
    }
}
exports.Repo = Repo;
//# sourceMappingURL=Repo.js.map