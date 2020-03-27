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
        path = '/Users/takeern/Library/Containers/com.tencent.WeWorkMac/Data/Library/Application\ Support/WXWork/Data/1688850815341128/Cache/File/2020-03/out.flv';
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
                    default:
                        return null;
                }
            },
            onCreateSuccess: () => {
                util_1.default.openBrowser(`127.0.0.1:${Parse.serve.port}/getParseData`);
            },
        });
    }
}
exports.default = Parse;
const p = new Parse();
//# sourceMappingURL=index.js.map