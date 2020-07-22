"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fromBuffers = exports.fromBuffer = exports.toBuffer = exports.InvalidPrefixError = exports.PrefixMatchPassThrough = exports.HashPassThrough = exports.ChunkSizeTransform = void 0;
const stream_1 = require("stream");
const crypto_1 = require("crypto");
class ChunkSizeTransform extends stream_1.Transform {
    constructor(chunkSize) {
        super({
            highWaterMark: chunkSize,
        });
        this.processedBytes = 0;
        this.chunkCount = 0;
        this.chunkSize = chunkSize;
        this.pending = [];
    }
    _transform(data, _encoding, cb) {
        this.pending.push(data);
        this.pushChunks(this.readPendingChunks());
        cb();
    }
    _flush(cb) {
        const chunk = Buffer.concat(this.pending);
        this.pending = [];
        this.pushChunks([chunk]);
        cb();
    }
    pushChunks(chunks) {
        chunks.forEach((chunk) => {
            this.processedBytes += chunk.length;
            this.chunkCount += 1;
            this.push(chunk);
        });
    }
    readPendingChunks() {
        if (this.pendingLength() < this.chunkSize)
            return [];
        const chunks = [];
        const full = Buffer.concat(this.pending);
        this.pending = [];
        let offset = 0;
        while (offset + this.chunkSize <= full.length) {
            const chunk = full.slice(offset, offset + this.chunkSize);
            offset += chunk.length;
            chunks.push(chunk);
        }
        const remaining = full.slice(offset, offset + this.chunkSize);
        this.pending.push(remaining);
        return chunks;
    }
    pendingLength() {
        return this.pending.reduce((len, chunk) => len + chunk.length, 0);
    }
}
exports.ChunkSizeTransform = ChunkSizeTransform;
class HashPassThrough extends stream_1.Transform {
    constructor(algorithm) {
        super();
        this.hash = crypto_1.createHash(algorithm);
    }
    _transform(data, _encoding, cb) {
        this.hash.update(data);
        cb(undefined, data);
    }
}
exports.HashPassThrough = HashPassThrough;
class PrefixMatchPassThrough extends stream_1.Transform {
    constructor(prefix) {
        super();
        this.prefix = prefix;
        this.matched = false;
    }
    _transform(chunk, _encoding, cb) {
        if (this.matched)
            return cb(undefined, chunk);
        const prefix = chunk.slice(0, this.prefix.length);
        if (prefix.equals(this.prefix)) {
            this.matched = true;
            const rest = chunk.slice(prefix.length);
            cb(undefined, rest);
        }
        else {
            cb(new InvalidPrefixError(prefix, this.prefix));
        }
    }
}
exports.PrefixMatchPassThrough = PrefixMatchPassThrough;
class InvalidPrefixError extends Error {
    constructor(actual, expected) {
        super(`Invalid prefix: '${actual}'`);
        this.actual = actual;
        this.expected = expected;
    }
}
exports.InvalidPrefixError = InvalidPrefixError;
function toBuffer(stream) {
    return new Promise((res, rej) => {
        const buffers = [];
        stream
            .on('data', (data) => buffers.push(data))
            .on('error', (err) => rej(err))
            .on('end', () => res(Buffer.concat(buffers)));
    });
}
exports.toBuffer = toBuffer;
function fromBuffer(buffer) {
    return new stream_1.Readable({
        read(_size) {
            this.push(buffer);
            this.push(null);
        },
    });
}
exports.fromBuffer = fromBuffer;
function fromBuffers(buffers) {
    return new stream_1.Readable({
        read(_size) {
            buffers.forEach((buffer) => {
                this.push(buffer);
            });
            this.push(null);
        },
    });
}
exports.fromBuffers = fromBuffers;
//# sourceMappingURL=StreamLogic.js.map