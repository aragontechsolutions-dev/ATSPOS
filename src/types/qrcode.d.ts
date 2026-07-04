declare module 'qrcode' {
  export interface QRCodeModules {
    size: number;
    data: Uint8Array | number[];
  }
  export interface QRCode {
    modules: QRCodeModules;
  }
  export function create(
    text: string,
    options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'; version?: number },
  ): QRCode;
  const _default: { create: typeof create };
  export default _default;
}
