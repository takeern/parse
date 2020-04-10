import Flv from './demux/flv';
import Demux from './demux/demux';
import { ReadStream, createReadStream } from 'fs';
import Util from './util/util';
import Serve from './util/serve';
// const argv = require('yargs')
//     .alias('h', 'help')
//     .alias('p', 'path')
//     .alias('v', 'showVideo')
//     .alias('a', 'showAudio')
//     .alias('l', 'length')
//     .alias('w', 'showWeb')
//     .argv;
const debug = require('debug')('parse: index');

interface IState {
    firstRecieve: boolean;              // 首次获取
    demuxer?: Demux;                    // 解码类型
    path: string;
    showVideo: boolean;
    showAudio: boolean;
    showMaxLen: number;
    showWeb: boolean;
}

interface IOption {
    path?: string,
    showVideo?: string,
    showAudio?: string,
    length?: number,
    showWeb?: boolean,
}

export default class Parse {
    private state: IState;
    static serve = {
        port: 3000,
    };
    constructor(option: IOption) {
        // this.getArgs();
        this.init(option);
    }

    private init(option: IOption) {
        this.state = {
            firstRecieve: true,
            demuxer: null,
            path: option.path,
            showAudio: Util.checkArgs(option.showAudio, 'showAudio'),
            showVideo: Util.checkArgs(option.showVideo, 'showVideo'),
            showMaxLen: option.length,
            showWeb: option.showWeb,
        };
        this.createStream();
    }

    /**
     * 获取命令行参数
     */
    private getArgs() {
        let { path, showAudio, showVideo, length, showWeb } = argv;

        if (!path) {
            throw new Error('input path is required');
        }
        
        // this.init({
        //     path,
        //     showAudio: Util.checkArgs(showAudio, 'showAudio'),
        //     showVideo: Util.checkArgs(showVideo, 'showVideo'),
        //     length,
        //     showWeb,
        // });
    }

    private createStream() {
        const { path } = this.state;
        const r = createReadStream(path);
        r.on('data', (chunk: Buffer) => {
            this.recieveData(chunk, r);
        });
        r.on('end', () => {
            this.onDataEnd()
        });
        r.on('error', (e: Error) => {
            throw e;
        });
    }

    // 选取协议
    private seletGre(chunk: Buffer): Demux {
        if (Flv.checkVersion(chunk)) {
            debug('is flv video');
            const { showAudio, showMaxLen, showVideo } = this.state;
            return new Flv({
                showAudio,
                showMaxLen,
                showVideo,
                showPrintf: !this.state.showWeb,
            });
        }
        return null;
    }

    /**
     * 
     * @param chunk 接受数据
     * @param r 开启的 strem reder
     */
    private recieveData(chunk: Buffer, r: ReadStream) {
        r.pause();
        if (this.state.firstRecieve) {
            this.state.firstRecieve = false;
            const demuxer = this.seletGre(chunk);
            if (demuxer) {
                this.state.demuxer = demuxer;
            } else {
                throw new Error('unhandle video type');
            }
        }

        this.state.demuxer.recieveData(chunk);
        r.resume();
    }

    private onDataEnd() {
        const { demuxer, showWeb } = this.state;
        // console.log()
        if (demuxer) {
            if (showWeb) {
                this.createOutputServe();
            } else {
                demuxer.destroy();
            }
        }
    }

    private createOutputServe() {
        const s = new Serve({
            port: Parse.serve.port,
            onCreateError: (e: Error) => { 
                throw new Error(`create sever Error: ${e}`);
            },
            onRequestData: (path: string, req: any) => {
                switch (path) {
                    case '/getParseData':
                        return this.state.demuxer.getParseData();
                    case '/getBuffer':
                        const range = req.header('Range');
                        if (range) {
                            const match = range.match(/bytes=([0-9]+)-([0-9]+)/);
                            if (match && match.length  === 3) {
                                const start = parseInt(match[1], 10);
                                const end = parseInt(match[2], 10);
                                if (!isNaN(start) && !isNaN(end)) {
                                    return createReadStream(this.state.path, {
                                        start,
                                        end,
                                    });
                                }
                            }
                        }
                        
                        return 'Range 不合法';
                    default:
                        return null;
                }
            },
            onCreateSuccess: () => {
                Util.openBrowser(`127.0.0.1:${Parse.serve.port}/parse`);
            },
        })
    }
}