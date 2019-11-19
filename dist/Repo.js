"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RepoBackend_1 = require("./RepoBackend");
const RepoFrontend_1 = require("./RepoFrontend");
class Repo {
    constructor(opts) {
        this.back = new RepoBackend_1.RepoBackend(opts);
        this.front = new RepoFrontend_1.RepoFrontend();
        this.front.subscribe(this.back.receive);
        this.back.subscribe(this.front.receive);
        this.id = this.back.id;
        this.create = this.front.create;
        this.open = this.front.open;
        this.message = this.front.message;
        this.destroy = this.front.destroy;
        this.meta = this.front.meta;
        this.doc = this.front.doc;
        this.fork = this.front.fork;
        this.close = this.front.close;
        this.change = this.front.change;
        this.files = this.front.files;
        this.watch = this.front.watch;
        this.merge = this.front.merge;
        this.setSwarm = this.back.setSwarm;
        this.addSwarm = this.back.addSwarm;
        this.removeSwarm = this.back.removeSwarm;
        this.startFileServer = this.back.startFileServer;
        this.materialize = this.front.materialize;
        this.crypto = this.front.crypto;
    }
}
exports.Repo = Repo;
//# sourceMappingURL=Repo.js.map