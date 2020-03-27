"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process = require('child_process');
class Util {
    static arr2str(buf) {
        const arr = Array.from(buf);
        const str = String.fromCharCode.apply(null, arr);
        return String.fromCharCode.apply(null, Array.from(buf));
    }
    static openBrowser(url) {
        if (url.indexOf('http') === -1) {
            url = 'http://' + url;
        }
        let cmd;
        if (process.platform === 'win32') {
            cmd = 'start "%ProgramFiles%\Internet Explorer\iexplore.exe"';
        }
        else if (process.platform === 'linux') {
            cmd = 'xdg-open';
        }
        else if (process.platform === 'darwin') {
            cmd = 'open';
        }
        child_process.exec(`${cmd} "${url}"`);
    }
    static checkArgs(c, name) {
        let v;
        if (c === undefined) {
            return undefined;
        }
        if (c === 'true') {
            v = true;
        }
        else if (c === 'false') {
            v = false;
        }
        else {
            throw new Error(`${name} option require as bool`);
        }
        return v;
    }
}
exports.default = Util;
//# sourceMappingURL=util.js.map