declare module 'gifenc' {
  export interface GIFEncoderOptions {
    palette?: number[][];
    delay?: number;
    repeat?: number;
    transparent?: boolean;
    dispose?: number;
  }

  export interface GIFEncoderInstance {
    writeFrame(
      data: Uint8Array | Uint8ClampedArray,
      width: number,
      height: number,
      options?: GIFEncoderOptions
    ): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(): GIFEncoderInstance;
  
  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: any
  ): number[][];
  
  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: number[][],
    format?: any
  ): Uint8Array;
}