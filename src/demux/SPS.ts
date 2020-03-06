const debug = require('debug')('parse: SPS');

export default class SPS {
    public static parse_sps(chunk: Buffer, offset: number) {
        const spsLength = chunk.readUInt16BE(offset);
        offset += 3;
        const profileIdc = chunk.readUInt8(offset);
        offset += 1;
        const d = chunk.readUInt8(offset);
        offset += 1;
        const set0Flag = d & 128;
        const set1Flag = d & 64;
        const set2Flag = d & 32;
        const reserved_zero = d & 63;
        if (reserved_zero !== 0) {
            debug(`WARN: reserved_zero ${reserved_zero} uneqeue 0`);
        }
        const levelIdc = chunk.readUInt8(offset);
        debug(spsLength, profileIdc, levelIdc);
    }
}