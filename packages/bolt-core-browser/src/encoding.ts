import tweetnacl_util from 'tweetnacl-util';
const { encodeBase64, decodeBase64 } = tweetnacl_util;

/** Encode a Uint8Array to a base64 string */
export function toBase64(data: Uint8Array): string {
  return encodeBase64(data);
}

/** Decode a base64 string to a Uint8Array */
export function fromBase64(base64: string): Uint8Array {
  return decodeBase64(base64);
}
