import Flv from './demux/flv';
import Demux from './demux/demux';
import { ReadStream, createReadStream } from 'fs';
import Util from './util/util';
import Serve from './util/serve';
const argv = require('yargs')
    .alias('h', 'help')
    .alias('p', 'path')
    .alias('v', 'showVideo')
    .alias('a', 'showAudio')
    .alias('l', 'length')
    .alias('w', 'showWeb')
    .argv;
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

export default class Parse {
    private state: IState;
    static codeHelp = [
        {
            code: '--path -p',
            desc: 'input parse video local path',
            example: '--path=../test.flv , -p ../test.flv'
        },
        {
            code: '--showVideo -v',
            desc: 'input parse video local path',
            example: '--showVideo=false , -v false'
        },
        {
            code: '--showAudio -a',
            desc: 'input parse Audio local path',
            example: '--showAudio=false , -a false'
        },
        {
            code: '--length -l',
            desc: 'show flv tag max length',
            example: '--length=100 , -v 100'
        },
        {
            code: '--help -h',
            desc: 'help example',
            example: ''
        },
        {
            code: '--showWeb -w',
            desc: 'show parse data in web',
            example: '--showWeb=true, -w=true'
        },
    ];
    static serve = {
        port: 3000,
    };
    constructor() {
        this.getArgs();
    }

    private init(option: {
        path: string,
        showAudio: boolean,
        showVideo: boolean,
        length: number,
        showWeb: boolean,
    }) {
        this.state = {
            firstRecieve: true,
            demuxer: null,
            path: option.path,
            showVideo: option.showVideo,
            showAudio: option.showAudio,
            showMaxLen: option.length,
            showWeb: option.showWeb,
        };
        this.createStream();
    }

    /**
     * 获取命令行参数
     */
    private getArgs() {
        let { path, showAudio, showVideo, length, help, showWeb } = argv;
        if (help) {
            console.table(Parse.codeHelp);
            return;
        }

        path = '../sei_test1.flv';
        if (!path) {
            throw new Error('input path is required');
        }
        
        this.init({
            path,
            showAudio: Util.checkArgs(showAudio, 'showAudio'),
            showVideo: Util.checkArgs(showVideo, 'showVideo'),
            length,
            showWeb,
        });
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
        console.log(Parse.serve);
        const s = new Serve({
            port: Parse.serve.port,
            onCreateError: (e: Error) => { 
                throw new Error(`create sever Error: ${e}`);
            },
            onRequestData: (path: string, req: any) => {
                switch (path) {
                    case '/getParseData':
                        return this.state.demuxer.getParseData();
                    default:
                        return null;
                }
            },
            onCreateSuccess: () => {
                Util.openBrowser(`127.0.0.1:${Parse.serve.port}/getParseData`);
            },
        })
    }
}

const p = new Parse();