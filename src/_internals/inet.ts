import os from 'node:os';
import * as dns from 'node:dns';
import * as http2 from 'node:http2';
import { isPlainObject } from 'typesdk/utils/is';
import type { Dict, MaybeArray } from 'typesdk/types';

import { isDigit, isString } from '../_internals/util';
import { type Either, left, right } from './logic/Either';
import { InvalidIPAddressError } from '../_internals/errors';


/**
 * Represents an IP address object that can be either IPv4 or IPv6.
 */
export type IP = {
  readonly family: 'IPv4';
  readonly ip: IPv4;
} | {
  readonly family: 'IPv6';
  readonly ip: IPv6;
};


/**
 * Represents an IPv4 address.
 */
export class IPv4 {
  readonly #value: string;

  /**
   * Gets the family of the IP address, always returns 'IPv4'.
   */
  public get family(): 'IPv4' {
    return 'IPv4';
  }

  /**
   * Gets the array of octets that make up the IPv4 address.
   */
  public get octets(): number[] {
    return this.#value.split('.').map(x => parseInt(x, 10));
  }

  /**
   * Gets the string representation of the IPv4 address.
   */
  public get address(): string {
    return this.#value;
  }

  /**
   * Private constructor to create an instance of IPv4.
   * 
   * @param value - The IPv4 address as a string.
   */
  private constructor(value: string) {
    this.#value = value;
  }

  /**
   * Validates whether a given value is a valid IPv4 address.
   * 
   * @param value - The value to validate.
   * @returns A boolean indicating the validity of the IPv4 address.
   */
  public static validate(value: unknown): boolean {
    if(!value) return false;
    if(!isString(value)) return false;

    const regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(\.|$)){4}$/;
    return regex.test(value);
  }

  /**
   * Creates an instance of IPv4 from a given value.
   * 
   * @param value - The value to create an IPv4 instance from.
   * @returns Either an IPv4 instance or an error indicating invalid input.
   */
  public static from(value?: any): Either<InvalidIPAddressError, IPv4> {
    if(!value) return left(new InvalidIPAddressError('No IP address provided'));
    
    if(value instanceof IPv4) return right(value);
    if(value instanceof IPv6) return left(new InvalidIPAddressError('Cannot convert IPv6 to IPv4'));

    let result: Either<InvalidIPAddressError, IPv4>;

    if(Array.isArray(value)) {
      if(value.length !== 4) return (result = left(new InvalidIPAddressError('Invalid octet count', 422, {
        expected: 4,
        received: value.length,
      })));

      if(!value.every(isDigit)) return (result = left(new InvalidIPAddressError('Invalid octet type', 422, {
        expected: 'number',
        received: 'any',
      })));

      if(!value.every(octet => octet >= 0 && octet <= 255)) return (result = left(new InvalidIPAddressError('Invalid octet range', 422, {
        expected: '0-255',
        received: value.toString(),
      })));

      result = right(new IPv4(value.join('.')));
    } else {
      result = this.validate(value) ?
        right(new IPv4(value)) :
        left(new InvalidIPAddressError('Invalid or malformed IPv4 address'));
    }

    return result;
  }
}


/**
 * Represents an IPv6 address.
 */
export class IPv6 {
  readonly #value: string;

  /**
   * Gets the family of the IP address, always returns 'IPv6'.
   */
  public get family(): 'IPv6' {
    return 'IPv6';
  }

  /**
   * Gets the array of blocks that make up the IPv6 address.
   */
  public get blocks(): string[] {
    const arr = this.#value.split('::').map(x => x.split(':'));
    return arr.flatMap(x => x);
  }

  /**
   * Gets the array of octets that represent the hexadecimal values of the blocks.
   */
  public get octets(): number[] {
    const blocks = this.blocks;
    return blocks.map(x => parseInt(x, 16));
  }

  /**
   * Gets the string representation of the IPv6 address.
   */
  public get address(): string {
    return this.#value;
  }

  /**
   * Private constructor to create an instance of IPv6.
   * 
   * @param value - The IPv6 address as a string.
   */
  private constructor(value: string) {
    this.#value = value;
  }

  /**
   * Validates whether a given value is a valid IPv6 address.
   * 
   * @param value - The value to validate.
   * @returns A boolean indicating the validity of the IPv6 address.
   */
  public static validate(value?: unknown): boolean {
    if(!value) return false;
    if(!isString(value)) return false;

    const regex = /^(?:(?:[0-9a-fA-F]{1,4}:){6}[0-9a-fA-F]{1,4}$)|(?:[0-9a-fA-F]{1,4}::[0-9a-fA-F]{0,4}$)|(?:[0-9a-fA-F]{1,4}:(?::[0-9a-fA-F]{1,4}){1,6}$)/;
    return regex.test(value);
  }

  /**
   * Creates an instance of IPv6 from a given value.
   * 
   * @param value - The value to create an IPv6 instance from.
   * @returns Either an IPv6 instance or an error indicating invalid input.
   */
  public static from(value?: any): Either<InvalidIPAddressError, IPv6> {
    if (!value) return left(new InvalidIPAddressError('No IP address provided'));

    if (value instanceof IPv6) return right(value);
    if (value instanceof IPv4) return left(new InvalidIPAddressError('Cannot convert IPv4 to IPv6'));

    let result: Either<InvalidIPAddressError, IPv6>;

    if (Array.isArray(value)) {
      if (value.length !== 8) {
        return (result = left(
          new InvalidIPAddressError('Invalid block count', 422, {
            expected: 8,
            received: value.length,
          }),
        ));
      }

      if (!value.every(isString)) {
        return (result = left(
          new InvalidIPAddressError('Invalid block type', 422, {
            expected: 'string',
            received: 'any',
          }),
        ));
      }

      if (!value.every((block) => /^[0-9a-fA-F]{1,4}$/.test(block))) {
        return (result = left(
          new InvalidIPAddressError('Invalid block format', 422, {
            expected: '0-9a-fA-F',
            received: value.toString(),
          }),
        ));
      }

      result = right(new IPv6(value.join(':')));
    } else {
      result = this.validate(value) ? right(new IPv6(value)) : left(new InvalidIPAddressError('Invalid or malformed IPv6 address'));
    }

    return result;
  }
}


/**
 * Resolves an IP address (either IPv4 or IPv6) from a given value.
 * 
 * @param value - The value to resolve an IP address from.
 * @returns An instance of either IPv4 or IPv6.
 * @throws {InvalidIPAddressError} Throws an error if the value is not a valid IP address.
 */
export function resolveIP(value: MaybeArray<string> | number[]): IPv4 | IPv6 {
  const v4 = IPv4.from(value);
  const v6 = IPv6.from(value);

  if(v4.isRight()) return v4.value;
  if(v6.isRight()) return v6.value;

  if(v4.isLeft() && v6.isLeft()) {
    throw new InvalidIPAddressError('Invalid or malformed IP address');
  }

  if(v4.isLeft()) {
    throw v4.value;
  }

  if(v6.isLeft()) {
    throw v6.value;
  }

  throw new Error('[inet::resolveIP] Unreachable code');
}


/**
 * Represents an object that may contain request headers and a socket with a remote address.
 */
interface MaybeRequestWithHeaders {
  readonly headers: Dict<string | readonly string[]> | {
    get(name: string): string | undefined;
  } | http2.IncomingHttpHeaders;

  readonly socket?: {
    readonly remoteAddress?: string;
  };
}


/**
 * Extracts an IP address (either IPv4 or IPv6) from a given request object.
 * 
 * @param {MaybeRequestWithHeaders} request - The request object containing headers and an optional socket.
 * @returns An instance of either IPv4 or IPv6.
 * @throws {TypeError} Throws an error if the request object is malformed.
 */
export function extractIPFromRequest(request: MaybeRequestWithHeaders): IPv4 | IPv6 {
  let realIp;

  if(isPlainObject(request.headers)) {
    realIp = (request.headers as Dict<string | readonly string[]>)['cf-connecting-ip'] ||
      (request.headers as Dict<string | readonly string[]>)['x-real-ip'] ||
      (request.headers as Dict<string | readonly string[]>)[':remote-addr'] ||
      (request.headers as Dict<string | readonly string[]>)['x-forwarded-for'] ||
      (request.headers as Dict<string | readonly string[]>)['x-client-ip'] ||
      (request.headers as Dict<string | readonly string[]>)['x-cluster-client-ip'] ||
      request.socket?.remoteAddress ||
      '127.0.0.1';
  } else if(typeof request.headers?.get === 'function') {
    realIp = request.headers?.get('cf-connecting-ip') ||
      request.headers?.get('x-real-ip') ||
      request.headers?.get(':remote-addr') ||
      request.headers?.get('x-forwarded-for') ||
      request.headers?.get('x-client-ip') ||
      request.headers?.get('x-cluster-client-ip') ||
      request.socket?.remoteAddress ||
      '127.0.0.1';
  } else {
    throw new TypeError('Failed to resolve IP address from request: malformed request object');
  }

  if(Array.isArray(realIp)) {
    realIp = realIp[0];
  }

  // Localhost loopback in IPv6
  if(realIp === '::1') {
    realIp = '127.0.0.1';
  }

  // IPv4-mapped IPv6 addresses
  if(realIp.substr(0, 7) == '::ffff:') {
    realIp = realIp.substr(7);
  }

  return resolveIP(realIp);
}


/**
 * Gets the local IP address of the machine.
 * 
 * @returns {IPv4} An instance of IPv4 with the local IP address. 
 */
export function localIP(): IPv4 {
  const netifaces = os.networkInterfaces();
  let ip: string = '0.0.0.0';

  for(const iname in netifaces) {
    if(iname === 'lo') continue;
    if(ip !== '0.0.0.0') break;
    
    for(const i of (netifaces[iname] || [])) {
      if(i.internal) continue;
      if(i.family !== 'IPv4') continue;

      ip = i.address;
      break;
    }
  }

  const ipv4 = IPv4.from(ip);

  if(ipv4.isLeft()) {
    throw ipv4.value;
  }

  return ipv4.value;
}


/**
 * Resolves a domain name to an IP address.
 * 
 * @param {string} domain The domain name to resolve. 
 * @returns {Promise<IPv4 | IPv6>} A promise that resolves to an instance of either IPv4 or IPv6.
 */
export async function resolveDomain(domain: string): Promise<IPv4 | IPv6> {
  return new Promise((resolve, reject) => {
    dns.lookup(domain, (err, address, family) => {
      if(err) return reject(err);
      const ip = family === 4 ? IPv4.from(address) : IPv6.from(address);
    
      if(ip.isLeft()) return reject(ip.value);
      resolve(ip.value);
    });
  });
}


const _default = {
  IPv4,
  IPv6,
  localIP,
  resolveIP,
  resolveDomain,
  extractIPFromRequest,
};

export default Object.freeze(_default);
