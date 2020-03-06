import Flv from './demux/flv';
import Demux from './demux/demux';
import { ReadStream, createReadStream } from 'fs';
const debug = require('debug')('parse: index');

interface IState {
    firstRecieve: boolean;              // 首次获取
    demuxer?: Demux;                    // 解码类型
}

export default class Parse {
    private state: IState;
    constructor() {
        this.init();
    }

    private init() {
        this.state = {
            firstRecieve: true,
            demuxer: null,
        };
        const r = createReadStream('/Users/takeern/work/biliPlayer/parse/sei_test2.flv');
        r.on('data', (chunk: Buffer) => {
            this.recieveData(chunk, r);
        });
    }

    // 选取协议
    public seletGre(chunk: Buffer): Demux {
        if (Flv.checkVersion(chunk)) {
            debug('is flv video');
            return new Flv();
        }
        return null;
    }

    /**
     * 
     * @param chunk 接受数据
     * @param r 开启的 strem reder
     */
    public recieveData(chunk: Buffer, r: ReadStream) {
        r.pause();
        debug(chunk);
        if (this.state.firstRecieve) {
            this.state.firstRecieve = false;
            const demuxer = this.seletGre(chunk);
            if (demuxer) {
                this.state.demuxer = demuxer;
            } else {
                debug('unhandle video');
                // todo send error
                return;
            }
        }

        this.state.demuxer.recieveData(chunk);
        // r.resume();
    }
}

const p = new Parse();