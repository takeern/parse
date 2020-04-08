"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const demux_1 = require("./demux");
const util_1 = require("../util/util");
const Rgsp_1 = require("./Rgsp");
const debug = require('debug')('parse: flv-demux');
class Flv extends demux_1.default {
    constructor(p) {
        super();
        this.init();
        p = p || {};
        this.props = {
            showAudio: p.showAudio === undefined ? true : p.showAudio,
            showVideo: p.showVideo === undefined ? true : p.showVideo,
            showMaxLen: p.showMaxLen === undefined ? -1 : p.showMaxLen,
            showPrintf: p.showPrintf === undefined ? true : p.showPrintf,
        };
        if (this.props.showPrintf) {
            console.log(`    type   filePostion        size          dts           pts      keyframe   duration   unitType`);
        }
    }
    static checkVersion(chunk) {
        if (chunk.length < 4) {
            return false;
        }
        for (let i = 0; i < this.flv_mark.length; i++) {
            if (chunk.readUInt8(i) !== this.flv_mark[i]) {
                return false;
            }
        }
        return true;
    }
    recieveData(chunk) {
        let offfset = 0;
        if (!this.state.hasReadHeader) {
            offfset += this.parse_header(chunk);
            this.tags.push({
                size: 0,
                filePostion: 0,
            });
        }
        if (this.lastBuf && this.lastBuf.length !== 0) {
            chunk = Buffer.concat([this.lastBuf, chunk], this.lastBuf.length + chunk.length);
        }
        offfset = this.parse_tag(chunk, offfset);
    }
    getParseData() {
        const { header, tags, tagHeaders, audioAcc, audioTags, metaData, spsConfig, avcPackets, naluLength, } = this;
        return {
            header,
            tags,
            tagHeaders,
            audioAcc,
            audioTags,
            metaData,
            spsConfig,
            avcPackets,
            naluLength,
        };
    }
    destroy() {
        this.init();
        this.header = null;
        this.metaData = null;
        this.audioAcc = null;
        this.spsConfig = null;
        this.naluLength = null;
    }
    init() {
        this.state = {
            hasReadHeader: false,
            amfScriptObjEnd: false,
            showLen: 0,
            useOffset: 0,
        };
        this.tags = [];
        this.tagHeaders = [];
        this.audioTags = [];
        this.avcPackets = [];
        this.lastBuf = null;
    }
    parse_header(chunk) {
        if (chunk.length < 9) {
            throw new Error('not enough byte to parse');
        }
        this.header = {
            hasAudio: ((chunk[4] >>> 2) & 1) === 1,
            hasVideo: (chunk[4] & 1) === 1,
        };
        this.state.hasReadHeader = true;
        return 9 + 4;
    }
    parse_tag(chunk, offset) {
        let startOffset = offset;
        if (offset + 11 < chunk.length) {
            const tagfilePostion = offset;
            const d = this.parse_tag_header(chunk, offset);
            offset = d.offset;
            if (offset + d.tagHeader.size < chunk.length - 4) {
                switch (d.tagHeader.type) {
                    case (8):
                        this.read_audio(chunk, offset, d.tagHeader.size, d.tagHeader.timestamp);
                        break;
                    case (9):
                        this.read_video_data(chunk, offset, d.tagHeader.size, d.tagHeader.timestamp);
                        break;
                    case (18):
                        this.read_script_data(chunk, offset, d.tagHeader.size);
                        break;
                    default:
                        throw new Error('unhandle tag type' + d.tagHeader.type);
                }
                offset += d.tagHeader.size;
                const size = this.read_tag_size(chunk, offset);
                offset += 4;
                this.tagHeaders.push(d.tagHeader);
                this.tags.push({
                    size,
                    filePostion: tagfilePostion + this.state.useOffset,
                });
                if (this.tags[this.tags.length - 1].size - 11 !== this.tagHeaders[this.tagHeaders.length - 1].size) {
                    throw new Error(`tag size + header size unequeu body， tag index: ${this.tags.length - 1}`);
                }
                return this.parse_tag(chunk, offset);
            }
            else {
                this.lastBuf = chunk.slice(startOffset);
                this.state.useOffset += startOffset;
            }
        }
        else {
            this.lastBuf = chunk.slice(startOffset);
            this.state.useOffset += startOffset;
        }
        return offset;
    }
    parse_tag_header(chunk, offset) {
        const tagHeader = {
            type: chunk.readUInt8(offset),
            size: chunk.readUInt32BE(offset) & 0x00ffffff,
            timestamp: chunk.readUInt32BE(offset + 3) & 0x00ffffff,
            timestampEx: chunk.readUInt8(offset + 4),
            streamid: chunk.readUInt32BE(offset + 7) & 0x00ffffff,
            filePostion: offset + this.state.useOffset,
        };
        if (tagHeader.timestamp > 0xFFFFFF) {
            tagHeader.timestamp += (tagHeader.timestampEx << 24);
        }
        if (tagHeader.streamid !== 0) {
            throw new Error('tagHeader.streamid is ' + tagHeader.streamid);
        }
        return {
            tagHeader,
            offset: offset + 11,
        };
    }
    read_tag_size(chunk, offset) {
        const size = chunk.readUInt32BE(offset);
        return size;
    }
    read_script_data(chunk, offset, size) {
        const afmType = chunk.readUInt8(offset);
        offset += 1;
        if (afmType !== 0x02) {
            throw new Error(`unhandle afmType: ${afmType}`);
        }
        const strLen = chunk.readUInt16BE(offset);
        offset += 2;
        if (util_1.default.arr2str(chunk.slice(offset, offset + strLen)) !== 'onMetaData') {
            throw new Error('no onMetaData');
        }
        offset += strLen;
        const afm2Type = chunk.readUInt8(offset);
        offset += 1;
        const d = this.read_amf_value(afm2Type, chunk, offset);
        this.metaData = Object.assign({}, d.data);
        return offset;
    }
    read_amf_value(type, chunk, offset) {
        let value = null;
        let obj = {};
        switch (type) {
            case 0:
                value = chunk.readDoubleBE(offset);
                offset += 8;
                break;
            case 1:
                value = chunk.readUInt8(offset) ? true : false;
                offset += 1;
                break;
            case 2:
                const len = chunk.readUInt16BE(offset);
                offset += 2;
                value = util_1.default.arr2str(chunk.slice(offset, offset + len));
                offset += len;
                break;
            case 3:
                while (!this.state.amfScriptObjEnd) {
                    const d = this.read_amf_value(2, chunk, offset);
                    offset = d.offset;
                    const vtype = chunk.readUInt8(offset);
                    offset += 1;
                    const value = this.read_amf_value(vtype, chunk, offset);
                    offset = value.offset;
                    if (value.data !== null) {
                        obj[d.data] = value.data;
                    }
                }
                value = obj;
                break;
            case 8:
                const afm2ArrLen = chunk.readUInt32BE(offset);
                offset += 4;
                for (let i = 0; i < afm2ArrLen; i++) {
                    const key = this.read_amf_value(2, chunk, offset);
                    offset = key.offset;
                    const vtype = chunk.readUInt8(offset);
                    offset += 1;
                    const value = this.read_amf_value(vtype, chunk, offset);
                    offset = value.offset;
                    obj[key.data] = value.data;
                }
                value = obj;
            case 9:
                this.state.amfScriptObjEnd = true;
                offset += 0;
                break;
            case 10:
                const arr = [];
                let strictArrayLength = chunk.readUInt32BE(offset);
                offset += 4;
                for (let i = 0; i < strictArrayLength; i++) {
                    const vtype = chunk.readUInt8(offset);
                    offset += 1;
                    const d = this.read_amf_value(vtype, chunk, offset);
                    offset = d.offset;
                    arr.push(d.data);
                    value = arr;
                }
                break;
            default:
                throw new Error(`unhandle amf value type: ${type}`);
        }
        return {
            data: value,
            offset,
        };
    }
    read_video_data(chunk, offset, size, timestamp) {
        const filePostion = offset;
        const videoDesc = chunk.readUInt8(offset);
        offset += 1;
        const frameType = videoDesc >>> 4;
        const codec = videoDesc & 15;
        if (codec !== 0x07) {
            throw new Error(`unhandle codec : ${codec}`);
        }
        const avcType = chunk.readUInt8(offset);
        const cts = chunk.readInt32BE(offset) & 0x00FFFFFF;
        let nalus = [];
        offset += 4;
        if (avcType === 0x00) {
            const d = this.read_avc_sps_pps(chunk, offset, size);
        }
        else if (avcType === 0x01) {
            nalus = this.read_avc_packet(chunk, offset, size);
        }
        if (nalus.length !== 0) {
            this.avcPackets.push({
                dts: timestamp,
                cts,
                nalus,
                filePostion: filePostion + this.state.useOffset,
                size,
                frameType,
            });
        }
        if (this.avcPackets.length > 1) {
            const len = this.avcPackets.length;
            const index = len - 2;
            const { size, dts, cts, filePostion, frameType, nalus } = this.avcPackets[index];
            const unitType = nalus.map((i) => i.unitType).join('|');
            const pts = dts + cts;
            const keyframe = frameType === 1;
            const duration = this.avcPackets[index + 1].dts - dts;
            this.printf('video', filePostion, size, dts, pts, keyframe, duration, unitType);
        }
        return offset;
    }
    read_avc_sps_pps(chunk, offset, size) {
        const end = offset + size;
        if (offset + 7 > chunk.length) {
            throw new Error('not enough byte parse sps pps, byte:' + (chunk.length - offset));
        }
        const cfgVersion = chunk.readUInt8(offset);
        const avcProfile = chunk.readUInt8(offset + 1);
        const profileCompatibility = chunk.readUInt8(offset + 2);
        const avcLevel = chunk.readUInt8(offset + 3);
        const d = chunk.readUInt8(offset + 4);
        const reserved = d & 152;
        this.naluLength = d & 3 + 1;
        const numOfSPS = chunk.readUInt8(offset + 5) & 31;
        offset += 6;
        if (cfgVersion !== 1 || avcProfile === 0) {
            throw new Error(`parse sps,pps error, cfgVersion: ${cfgVersion}, avcProfile: ${avcProfile}`);
        }
        if (numOfSPS !== 1) {
            debug(`WARN: numof sps error, ${numOfSPS} unequeu 1`);
        }
        for (let i = 0; i < numOfSPS; i++) {
            const sps_length = chunk.readUInt16BE(offset);
            offset += 2;
            const naluHeader = this.read_nalu_header(chunk, offset);
            if (naluHeader.forbidden_zero_bit !== 0 || naluHeader.unitType !== 7) {
                debug(`Warn: sps nalu error, ${naluHeader.forbidden_zero_bit}, type: ${naluHeader.unitType}`);
            }
            this.spsConfig = Rgsp_1.default.parse_sps(chunk, offset + 1, sps_length);
            offset += sps_length;
        }
        const numOfPPS = chunk.readUInt8(offset);
        offset += 1;
        if (numOfPPS !== 1) {
            debug(`WARN: numof pps error, ${numOfPPS} unequeu 1`);
        }
        for (let i = 0; i < numOfSPS; i++) {
            const pps_length = chunk.readUInt16BE(offset);
            offset += 2;
            let pps_config = Rgsp_1.default.parse_pps(chunk, offset, pps_length);
            offset += pps_length;
        }
        return offset;
    }
    read_avc_packet(chunk, offset, size) {
        const nalus = [];
        const endFilePostion = offset + size;
        while (offset < endFilePostion) {
            const naluFilePostion = offset;
            const naluSize = chunk.readUInt32BE(offset);
            if (naluSize > endFilePostion - 4) {
                debug(`Error: not enough buffer parse nalu`);
            }
            const naluHeader = this.read_nalu_header(chunk, offset + 4);
            offset = offset + naluSize + 4;
            nalus.push({
                size: naluSize,
                unitType: naluHeader.unitType,
                filePostion: naluFilePostion + this.state.useOffset,
            });
        }
        return nalus;
    }
    read_audio(chunk, offset, size, dts) {
        const startOffset = offset;
        if (offset + 1 > chunk.length) {
            throw new Error('audio data error, length < 1');
        }
        const d = chunk.readUInt8(offset);
        let len = size;
        offset += 1;
        const soundFormat = d >>> 4;
        const SoundRate = (d & 12) >>> 2;
        const soundSize = (d & 2) >>> 1;
        const soundType = d & 1;
        if (soundFormat !== 2 && soundFormat !== 10) {
            debug(`unhandle soundFormat type: ${soundFormat}`);
            return;
        }
        if (soundFormat === 2) {
            debug('tod: handle read_mp3_packet');
            len -= (offset - startOffset);
        }
        else if (soundFormat === 10) {
            const aacType = chunk.readUInt8(offset);
            offset += 1;
            if (aacType === 0) {
                return this.read_audio_aac(chunk, offset);
            }
            else if (aacType === 1) {
                len -= (offset - startOffset);
            }
            else {
                throw new Error(`error accType: ${aacType},`);
            }
        }
        else {
            debug(`unhandle soundFormat type: ${soundFormat}`);
            return;
        }
        this.audioTags.push({
            soundFormat,
            SoundRate,
            soundSize,
            soundType,
            dts,
            length: len,
            pts: dts,
            filePostion: startOffset + this.state.useOffset,
        });
        if (this.audioTags.length > 1) {
            const len = this.audioTags.length;
            const index = len - 2;
            const { pts, dts, filePostion, length } = this.audioTags[index];
            const sampleDuration = (1024 * 1000 / this.audioAcc.samplingFrequency).toFixed(2);
            const duration = `${this.audioTags[len - 1].dts - dts}|${sampleDuration}`;
            this.printf('audio', filePostion, length, dts, pts, '-', duration, '-');
        }
    }
    read_mp3_packet(chunk, offset) { }
    read_audio_aac(chunk, offset) {
        const audioObjectType = chunk.readUInt8(offset) >>> 3;
        let extensionSamplingIndex = null;
        let audioExtensionObjectType = null;
        const samplingIndex = ((chunk.readUInt8(offset) & 0x07) << 1) | (chunk.readUInt8(offset + 1) >>> 7);
        offset += 1;
        const samplingFrequency = Flv.mpegSamplingRates[samplingIndex];
        const channelConfiguration = (chunk.readUInt8(offset) & 0x78) >>> 3;
        if (audioObjectType === 5) {
            extensionSamplingIndex = ((chunk.readUInt8(offset) & 0x07) << 1) | (chunk.readUInt8(offset + 1) >>> 7);
            audioExtensionObjectType = (chunk.readUInt8(offset + 1) & 0x7C) >>> 2;
        }
        this.audioAcc = {
            codec: 'mp4a.40.' + audioObjectType,
            channelConfiguration,
            samplingFrequency,
            extensionSamplingIndex,
            audioExtensionObjectType,
        };
    }
    read_nalu_header(chunk, offset) {
        const d = chunk.readUInt8(offset);
        const forbidden_zero_bit = d >>> 7 & 1;
        const nal_ref_idc = d >>> 6 & 1;
        const nal_unit_type = d & 0b11111;
        if (forbidden_zero_bit !== 0) {
            debug('warn: NALU header forbidden_zero_bit error');
        }
        return {
            forbidden_zero_bit,
            refIdc: nal_ref_idc,
            unitType: nal_unit_type,
        };
    }
    printf(...arg) {
        const type = arg[0];
        if (!this.props.showPrintf ||
            (this.props.showMaxLen > 0 &&
                this.state.showLen >= this.props.showMaxLen)) {
            return;
        }
        if ((type === 'audio' && this.props.showAudio)
            || (type === 'video' && this.props.showVideo)) {
            const filePostion = arg[1].toString().padStart(11);
            const size = arg[2].toString().padStart(6);
            const dts = arg[3].toString().padStart(8);
            const pts = arg[4].toString().padStart(8);
            const keyframe = arg[5].toString().padStart(5);
            const duration = arg[6].toString().padStart(3);
            const unitType = arg[7].toString().padStart(8);
            console.log(`   ${type}   ${filePostion}      ${size}     ${dts}      ${pts}      ${keyframe}      ${duration}     ${unitType}`);
            this.state.showLen++;
        }
    }
}
exports.default = Flv;
Flv.flv_mark = [0x46, 0x4c, 0x56, 0x01];
Flv.mpegSamplingRates = [
    96000, 88200, 64000, 48000, 44100, 32000,
    24000, 22050, 16000, 12000, 11025, 8000, 7350
];
//# sourceMappingURL=flv.js.map