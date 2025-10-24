declare module 'gif-encoder-2' {
  export default class GIFEncoder {
    constructor(width: number, height: number);
    setRepeat(repeat: number): void;
    setDelay(delay: number): void;
    setQuality(quality: number): void;
    start(): void;
    addFrame(data: Uint8ClampedArray): void;
    finish(): void;
    out: {
      getData(): Uint8Array;
    };
  }
}
