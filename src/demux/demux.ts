export default abstract class Demux {
    abstract recieveData(chunk: Buffer): void;
}