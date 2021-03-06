const child_process = require('child_process');

export default class Util {
    static arr2str(buf: Buffer): string{
        const arr = Array.from(buf);
        const str = String.fromCharCode.apply(null, arr);
        return String.fromCharCode.apply(null, Array.from(buf));
    }
    static openBrowser(url: string): void {
        if (url.indexOf('http') === -1) {
            url = 'http://' + url;
        }
        let cmd;
        if (process.platform === 'win32') {
            cmd = 'start "%ProgramFiles%\Internet Explorer\iexplore.exe"';
        } else if (process.platform === 'linux') {
            cmd = 'xdg-open';
        } else if (process.platform === 'darwin') {
            cmd = 'open';
        }
        child_process.exec(`${cmd} "${url}"`);
    }

    static checkArgs(c: string, name: string) {
        let v;
        if (c === undefined) {
            return undefined;
        }
        if (c === 'true') {
            v = true;
        } else if (c === 'false') {
            v = false;
        } else {
            throw new Error(`${name} option require as bool`);
        }
        return v;
    }
}