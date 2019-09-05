"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) if (e.indexOf(p[i]) < 0)
            t[p[i]] = s[p[i]];
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
const RepoBackend_1 = require("./RepoBackend");
const RepoFrontend_1 = require("./RepoFrontend");
class Repo {
    constructor(opts) {
        const { serverPath } = opts, backendOptions = __rest(opts, ["serverPath"]);
        this.back = new RepoBackend_1.RepoBackend(backendOptions);
        this.back.startFileServer(serverPath);
        this.front = new RepoFrontend_1.RepoFrontend();
        this.front.subscribe(this.back.receive);
        this.back.subscribe(this.front.receive);
        this.id = this.back.id;
        this.stream = this.back.stream;
        this.create = this.front.create;
        this.open = this.front.open;
        this.message = this.front.message;
        this.destroy = this.front.destroy;
        this.meta = this.front.meta;
        //    this.follow = this.front.follow;
        this.doc = this.front.doc;
        this.fork = this.front.fork;
        this.close = this.front.close;
        this.change = this.front.change;
        this.files = this.front.files;
        this.watch = this.front.watch;
        this.merge = this.front.merge;
        this.setSwarm = this.back.setSwarm;
        this.materialize = this.front.materialize;
    }
}
exports.Repo = Repo;
//# sourceMappingURL=Repo.js.map