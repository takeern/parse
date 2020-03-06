import Demux from './demux';
import Util from '../util/util';
import SPS from './SPS';
const debug = require('debug')('parse: flv-demux');

interface IState {
    hasReadHeader: boolean;
    amfScriptObjEnd: boolean;
}

interface IFLVHeader {
    hasAudio: boolean;
    hasVideo: boolean;
}

interface ITagHeader {
    type: number,
    size: number,
    timestamp: number,
    timestampEx: number,
    streamid: number,
    filePostion: number,
}

interface ITag {
    filePostion: number;
    size: number;
}

interface IMetadata {
    [prop: string]: number | boolean | string;
}
export default class Flv extends Demux{
    static flv_mark = [ 0x46, 0x4c, 0x56, 0x01];
    public static checkVersion(chunk: Buffer): boolean {
        if (chunk.length < 4) {
            return false;
        }
        for (let i = 0; i < this.flv_mark.length; i ++) {
            if (chunk.readUInt8(i) !== this.flv_mark[i]) {
                return false;
            }
        }
        return true;
    }

    private state: IState;
    private header: IFLVHeader;
    private tags: ITag[];
    private tagHeaders: ITagHeader[];
    private metaData: IMetadata;

    constructor() {
        super();
        this.init();
    }

    public recieveData(chunk: Buffer): void {
        let offfset: number = 0;
        if (!this.state.hasReadHeader) {
            offfset += this.parse_header(chunk);
            this.tags.push({
                size: 0,
                filePostion: 0,
            });
        }
        offfset = this.parse_tag(chunk, offfset);
    }

    private init() {
        this.state = {
            hasReadHeader: false,
            amfScriptObjEnd: false,
        };
        this.tags = [];
        this.tagHeaders = [];
    }

    private parse_header(chunk: Buffer): number{
        if (chunk.length < 9) {
            throw new Error('not enough byte to parse');
        }

        this.header = {
            hasAudio: ((chunk[4] >>> 2) & 1) === 1,
            hasVideo: (chunk[4] & 1) === 1,
        };
        debug(this.header);
        return 9 + 4;
    }

    private parse_tag(chunk: Buffer, offset: number): number {
        let startOffset = offset;
        if (offset + 11 < chunk.length) {
            const tagfilePostion = offset;
            const d = this.parse_tag_header(chunk, offset);
            offset = d.offset;
            if (offset + d.tagHeader.size < chunk.length) {
                switch(d.tagHeader.type) {
                    case(8):
                        debug('todo handle audio');
                        break;
                    case(9):
                        offset = this.read_video_data(chunk, offset);
                        break;
                    case(18):
                        offset = this.read_script_data(chunk, offset);
                        break;
                    default:
                        throw new Error('unhandle tag type' + d.tagHeader.type);
                }
                const size = this.read_tag_size(chunk, offset);
                offset += 4;
                this.tags.push({
                    size,
                    filePostion: tagfilePostion,
                });

                if (this.tags[this.tags.length - 1].size - 11 !== this.tagHeaders[this.tagHeaders.length - 1].size) {
                    debug(this.tags, this.tagHeaders);
                    throw new Error(`tag size + header size unequeu body， tag index: ${this.tags.length - 1}`)
                }
                return this.parse_tag(chunk, offset);
            } else {
                debug('not enough tag body data');
            }
            // switch(d.tagHeader.type) {}
        } else {
            debug('not enough tag header data');
        }
        return offset;
    }

    private parse_tag_header(chunk: Buffer, offset: number) {
        const tagHeader: ITagHeader = {
            type: chunk.readUInt8(offset),
            size: chunk.readUInt32BE(offset) & 0x00ffffff,
            timestamp: chunk.readUInt32BE(offset + 3) & 0x00ffffff,
            timestampEx: chunk.readUInt8(offset + 4),
            streamid: chunk.readUInt32BE(offset + 7) & 0x00ffffff,
            filePostion: offset,
        }
        this.tagHeaders.push(tagHeader);
        if (tagHeader.streamid !== 0) {
            throw new Error('tagHeader.streamid is ' + tagHeader.streamid);
        }
        return {
            tagHeader,
            offset: offset + 11,
        };
    }

    private read_tag_size(chunk: Buffer, offset: number): number{
        const size = chunk.readUInt32BE(offset);
        return size;
    }

    private read_script_data(chunk: Buffer, offset: number): number{
        const afmType = chunk.readUInt8(offset);
        debug(afmType, offset);
        offset += 1;

        if (afmType !== 0x02) {
            debug('unhandle afmType');
            throw new Error('unhandle afmType');
        }
        const strLen = chunk.readUInt16BE(offset);
        offset += 2;

        if (Util.arr2str(chunk.slice(offset, offset + strLen)) !== 'onMetaData') {
            throw new Error('no onMetaData');
        }
        offset += strLen;

        const afm2Type = chunk.readUInt8(offset);
        offset += 1;

        if (afm2Type !== 0x08) {
            throw new Error('unhandle afm2Type');
        }
        const afm2ArrLen = chunk.readUInt32BE(offset);
        offset += 4;

        this.metaData = {};
        for (let i = 0; i < afm2ArrLen; i++) {
            const key = this.read_amf_value(2, chunk, offset);
            offset = key.offset;
            const vtype = chunk.readUInt8(offset);
            offset += 1;
            const value = this.read_amf_value(vtype, chunk, offset);
            offset = value.offset;
            this.metaData[key.data] = value.data; 
        }
        if ((chunk.readUInt32BE(offset - 1) & 0x00ffffff) !== 0x000009) {
            debug('Script Tag error: afm2 end unequeu 0x000009');
        }
        offset += 3;
        // debug(this.metaData);
        return offset;
    }

    /**
     * 解析 amf value（ps：key 为 type = 2 的 value 解析方式）
     * @param type amf type http://download.macromedia.com/f4v/video_file_format_spec_v10_1.pdf p75
     * @param chunk 
     * @param offset 
     */
    private read_amf_value(type: number, chunk: Buffer, offset: number) {
        let value: any = null;
        switch(type) {
            case 0:   // double
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
                value = Util.arr2str(chunk.slice(offset, offset + len));
                offset += len;
                break;
            case 3:
                let obj: any = {};
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
            case 9:
                this.state.amfScriptObjEnd = true;
                offset += 0;
                break;
            case 10:
                const arr = [];
                let strictArrayLength = chunk.readUInt32BE(offset);
                offset += 4;
                for (let i = 0; i < strictArrayLength; i ++) {
                    const vtype = chunk.readUInt8(offset);
                    offset += 1;
                    const d = this.read_amf_value(vtype, chunk, offset);
                    offset = d.offset;
                    arr.push(d.data);
                    value = arr;
                }
                break;
            default:
                debug(`unhandle amf value type: ${type}`);
                throw new Error(`unhandle amf value type: ${type}`);
        }
        return {
            data: value,
            offset,
        }
    }

    private read_video_data(chunk: Buffer, offset: number): number {
        debug('read_video_data------------');
        const filePostion = offset;
        const videoDesc = chunk.readUInt8(offset);
        offset += 1;
        const frameType = videoDesc >>> 4;
        const codec = videoDesc & 15;
        if (codec !== 0x07) {
            throw new Error(`unhandle codec : ${codec}`)
        }
        const avcType = chunk.readUInt8(offset);
        const cts = chunk.readInt32BE(offset);
        offset += 4;
        debug('read_avc_sps_pps', offset);
        if (avcType === 0x00) {
            this.read_avc_sps_pps(chunk, offset);
        }
        return offset;
    }

    private read_avc_sps_pps(chunk: Buffer, offset: number): number {
        if (offset + 7 > chunk.length) {
            throw new Error('not enough byte parse sps pps, byte:' + (chunk.length - offset));
        }
        const cfgVersion = chunk.readUInt8(offset);
        const avcProfile = chunk.readUInt8(offset + 1);
        const profileCompatibility = chunk.readUInt8(offset + 2);
        const avcLevel = chunk.readUInt8(offset + 3);
        const d = chunk.readUInt8(offset + 4);
        const reserved = d & 152;
        const lengthSizeMinusOne = d & 3;
        const numOfSPS = chunk.readUInt8(offset + 5) & 31;
        offset += 6;
        if (cfgVersion !== 1 || avcProfile === 0) {
            throw new Error(`parse sps,pps error, cfgVersion: ${cfgVersion}, avcProfile: ${avcProfile}`)
        }
        if (numOfSPS !== 1) {
            debug(`WARN: numof sps error, ${numOfSPS} unequeu 1`);
        }
        debug(`sps offset: ${offset}`);
        for (let i = 0; i < numOfSPS; i ++) {
            SPS.parse_sps(chunk, offset);
        }
        return offset;
    }

    /**
     * 解析 avc packet
     * @param chunk stream
     * @param offset 偏移位
     */
    private read_avc_packet(chunk: Buffer, offset: number) {
        
    }
}