"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const stream_1 = require("stream");
const crypto_1 = require("crypto");
class MaxChunkSizeTransform extends stream_1.Transform {
    constructor(maxChunkSize) {
        super({
            highWaterMark: maxChunkSize,
        });
        this.processedBytes = 0;
        this.chunkCount = 0;
        this.maxChunkSize = maxChunkSize;
    }
    _transform(data, _encoding, cb) {
        let offset = 0;
        do {
            const chunk = data.slice(offset, offset + this.maxChunkSize);
            offset += chunk.length;
            this.processedBytes += chunk.length;
            this.chunkCount += 1;
            this.push(chunk);
        } while (offset < data.length);
        cb();
    }
}
exports.MaxChunkSizeTransform = MaxChunkSizeTransform;
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
//# sourceMappingURL=StreamLogic.js.map