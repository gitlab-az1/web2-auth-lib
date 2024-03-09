import type { Decrypted } from 'cryptx-sdk/symmetric/core';
import { type BufferEncoding, XBuffer } from 'cryptx-sdk/buffer';
import { hasher, deepCompare, SymmetricKey, AES } from 'cryptx-sdk';

import { SignAlgorithm, Web2Crypto } from './index';
import { Exception, NotImplementedError } from '../_internals/errors';


/** @internal*/
export class Web2NodeCrypto implements Web2Crypto {
  public sign(
    key: string | Uint8Array,
    data: string | Uint8Array,
    algorithm: SignAlgorithm
  ): Promise<Uint8Array>;

  public sign(
    key: string | Uint8Array,
    data: string | Uint8Array,
    algorithm: SignAlgorithm,
    encoding: BufferEncoding
  ): Promise<string>;

  public async sign(
    key: string | Uint8Array,
    data: string | Uint8Array,
    algorithm: SignAlgorithm,
    encoding?: BufferEncoding // eslint-disable-line comma-dangle
  ): Promise<Uint8Array | string> {
    if(algorithm.startsWith('rsa-')) {
      throw new NotImplementedError('RSA signing is not supported yet.');
    }

    const k = typeof key === 'string' ?
      XBuffer.fromString(key) :
      XBuffer.fromUint8Array(key);

    const d = typeof data === 'string' ?
      XBuffer.fromString(data) :
      XBuffer.fromUint8Array(data);

    switch(algorithm) {
      case 'hmac-sha-1': {
        const h = await hasher.hmac(d.buffer, k.buffer, 'sha1', 'buffer');
        if(!encoding) return h.buffer;

        return h.toString(encoding);
      }
      case 'hmac-sha-256': {
        const h = await hasher.hmac(d.buffer, k.buffer, 'sha256', 'buffer');
        if(!encoding) return h.buffer;

        return h.toString(encoding);
      }
      case 'hmac-sha-512': {
        const h = await hasher.hmac(d.buffer, k.buffer, 'sha512', 'buffer');
        if(!encoding) return h.buffer;

        return h.toString(encoding);
      }
      default: 
        throw new Exception(`We cannot identify the algorithm "${algorithm}" as a valid signing algorithm.`, 'ERR_UNKNOWN_ALGORITHM');
    }
  }

  public async verify(
    key: string | Uint8Array,
    data: string | Uint8Array,
    signature: string | Uint8Array,
    algorithm: SignAlgorithm // eslint-disable-line comma-dangle
  ): Promise<boolean> {
    const k = typeof key === 'string' ?
      XBuffer.fromString(key) :
      XBuffer.fromUint8Array(key);

    const d = typeof data === 'string' ?
      XBuffer.fromString(data) :
      XBuffer.fromUint8Array(data);

    const s = typeof signature === 'string' ?
      XBuffer.fromString(signature) :
      XBuffer.fromUint8Array(signature);

    const contentSign = await this.sign(k.buffer, d.buffer, algorithm);
    return deepCompare(contentSign, s.buffer);
  }

  public aesEncrypt(key: Uint8Array, data: any): Promise<Uint8Array>;
  public aesEncrypt(key: Uint8Array, data: any, encoding: BufferEncoding): Promise<string>;
  public async aesEncrypt(
    key: Uint8Array,
    data: any,
    encoding?: BufferEncoding // eslint-disable-line comma-dangle
  ): Promise<Uint8Array | string> {
    const k = new SymmetricKey(key, {
      algorithm: 'aes-256-cbc',
      usages: ['encrypt', 'decrypt', 'sign', 'verify'],
    });

    const aes = new AES(k, 'aes-256-cbc');
    const e = await aes.encrypt(data);

    if(!encoding) return e.buffer;
    return e.toString(encoding);
  }

  public aesDecrypt<T = any>(key: Uint8Array, data: string | Uint8Array): Promise<Decrypted<T>> {
    const k = new SymmetricKey(key, {
      algorithm: 'aes-256-cbc',
      usages: ['encrypt', 'decrypt', 'sign', 'verify'],
    });

    const aes = new AES(k, 'aes-256-cbc');
    return aes.decrypt(data instanceof Uint8Array ? data : Buffer.from(data));
  }
}

export default Web2NodeCrypto;
