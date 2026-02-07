declare module "heic-decode" {
  export type HeicDecodeResult = {
    width: number;
    height: number;
    data: Uint8ClampedArray;
  };

  export type HeicDecode = (args: { buffer: Uint8Array }) => Promise<HeicDecodeResult>;

  const heicDecode: HeicDecode;
  export default heicDecode;
}

