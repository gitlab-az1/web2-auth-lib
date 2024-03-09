import type { BufferEncoding } from 'cryptx-sdk/buffer';
import type { Decrypted } from 'cryptx-sdk/symmetric/core';

import Web2NodeCrypto from './node';
import Web2BrowserCrypto from './browser';



export type SignAlgorithm = 
  | 'hmac-sha-1'
  | 'hmac-sha-256'
  | 'hmac-sha-512'
  | 'rsa-sha-256'
  | 'rsa-sha-512';

export const signAlgorithms = [
  'hmac-sha-1',
  'hmac-sha-256',
  'hmac-sha-512',
  'rsa-sha-256',
  'rsa-sha-512',
] as const;

export interface Web2Crypto {
  sign(key: string | Uint8Array, data: string | Uint8Array, algorithm: SignAlgorithm): Promise<Uint8Array>;
  sign(key: string | Uint8Array, data: string | Uint8Array, algorithm: SignAlgorithm, encoding: BufferEncoding): Promise<string>;
  verify(key: string | Uint8Array, data: string | Uint8Array, signature: string | Uint8Array, algorithm: SignAlgorithm): Promise<boolean>;

  aesEncrypt(key: Uint8Array, data: any): Promise<Uint8Array>;
  aesEncrypt(key: Uint8Array, data: any, encoding: BufferEncoding): Promise<string>;
  aesDecrypt<T = any>(key: Uint8Array, data: string | Uint8Array): Promise<Decrypted<T>>
}


export function createCrypto(): Web2Crypto {
  if(!hasBrowserCrypto()) return new Web2NodeCrypto();
  return new Web2BrowserCrypto();
}


export function hasBrowserCrypto() {
  return (
    typeof window !== 'undefined' &&
    typeof window.crypto !== 'undefined' &&
    typeof window.crypto.subtle !== 'undefined'
  );
}

/**
 * Converts an ArrayBuffer to a hexadecimal string.
 * 
 * @param arrayBuffer The ArrayBuffer to convert to hexadecimal string.
 * @return The hexadecimal encoding of the ArrayBuffer.
 */
export function fromArrayBufferToHex(arrayBuffer: ArrayBuffer): string {
  // Convert buffer to byte array.
  const byteArray = Array.from(new Uint8Array(arrayBuffer));

  // Convert bytes to hex string.
  return byteArray.map(byte => {
    return byte.toString(16).padStart(2, '0');
  }).join('');
}
