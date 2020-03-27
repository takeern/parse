export default abstract class Demux {
    abstract recieveData(chunk: Buffer): void;
    abstract getParseData(): any;
    abstract destroy(): void;
}