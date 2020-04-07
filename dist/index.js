"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flv_1 = require("./demux/flv");
const fs_1 = require("fs");
const util_1 = require("./util/util");
const serve_1 = require("./util/serve");
const argv = require('yargs')
    .alias('h', 'help')
    .alias('p', 'path')
    .alias('v', 'showVideo')
    .alias('a', 'showAudio')
    .alias('l', 'length')
    .alias('w', 'showWeb')
    .argv;
const debug = require('debug')('parse: index');
class Parse {
    constructor() {
        this.getArgs();
    }
    init(option) {
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
    getArgs() {
        let { path, showAudio, showVideo, length, help, showWeb } = argv;
        if (help) {
            console.table(Parse.codeHelp);
            return;
        }
        if (!path) {
            throw new Error('input path is required');
        }
        this.init({
            path,
            showAudio: util_1.default.checkArgs(showAudio, 'showAudio'),
            showVideo: util_1.default.checkArgs(showVideo, 'showVideo'),
            length,
            showWeb,
        });
    }
    createStream() {
        const { path } = this.state;
        const r = fs_1.createReadStream(path);
        r.on('data', (chunk) => {
            this.recieveData(chunk, r);
        });
        r.on('end', () => {
            this.onDataEnd();
        });
        r.on('error', (e) => {
            throw e;
        });
    }
    seletGre(chunk) {
        if (flv_1.default.checkVersion(chunk)) {
            debug('is flv video');
            const { showAudio, showMaxLen, showVideo } = this.state;
            return new flv_1.default({
                showAudio,
                showMaxLen,
                showVideo,
                showPrintf: !this.state.showWeb,
            });
        }
        return null;
    }
    recieveData(chunk, r) {
        r.pause();
        if (this.state.firstRecieve) {
            this.state.firstRecieve = false;
            const demuxer = this.seletGre(chunk);
            if (demuxer) {
                this.state.demuxer = demuxer;
            }
            else {
                throw new Error('unhandle video type');
            }
        }
        this.state.demuxer.recieveData(chunk);
        r.resume();
    }
    onDataEnd() {
        const { demuxer, showWeb } = this.state;
        if (demuxer) {
            if (showWeb) {
                this.createOutputServe();
            }
            else {
                demuxer.destroy();
            }
        }
    }
    createOutputServe() {
        const s = new serve_1.default({
            port: Parse.serve.port,
            onCreateError: (e) => {
                throw new Error(`create sever Error: ${e}`);
            },
            onRequestData: (path, req) => {
                switch (path) {
                    case '/getParseData':
                        return this.state.demuxer.getParseData();
                    case '/getBuffer':
                        const range = req.header('Range');
                        if (range) {
                            const match = range.match(/bytes=([0-9]+)-([0-9]+)/);
                            if (match && match.length === 3) {
                                const start = parseInt(match[1], 10);
                                const end = parseInt(match[2], 10);
                                if (!isNaN(start) && !isNaN(end)) {
                                    return fs_1.createReadStream(this.state.path, {
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
                util_1.default.openBrowser(`127.0.0.1:${Parse.serve.port}/parse`);
            },
        });
    }
}
exports.default = Parse;
Parse.codeHelp = [
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
Parse.serve = {
    port: 3000,
};
//# sourceMappingURL=index.js.map