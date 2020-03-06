export default class Util {
    static arr2str(buf: Buffer): string{
        const arr = Array.from(buf);
        const str = String.fromCharCode.apply(null, arr);
        return String.fromCharCode.apply(null, Array.from(buf));
    }
}