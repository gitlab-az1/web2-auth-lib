import { randomBytes, keyd } from 'cryptx-sdk';
import jwt, { type Secret, type JwtPayload, JsonWebTokenError } from 'jsonwebtoken';

import { uuid } from '../../_internals/id';
import { Exception } from '../../_internals/errors';
import { convertUint8ArrayToHex } from '../../_internals/util';
import { type Either, left, right } from '../../_internals/logic/Either';


/**
 * A JSON Web Token (JWT) is a compact, URL-safe means of representing claims to be transferred between two parties.
 */
export type Token<TData> = {

  /**
   * The payload of the token.
   */
  readonly payload: TData;

  /**
   * The issuer of the token.
   */
  readonly iss?: string;

  /**
   * The subject of the token.
   */
  readonly sub?: string;

  /**
   * The audience of the token.
   */
  readonly aud?: string | string[];

  /**
   * The time when the token expires.
   */
  readonly exp?: number;

  /**
   * The time before which the token must not be accepted for processing.
   */
  readonly nbf?: number;

  /**
   * The time at which the token was issued.
   */
  readonly iat?: number;

  /**
   * The unique identifier for the token.
   */
  readonly jti?: string;
}


/**
 * Some options for the token signature.
 */
export type TokenOptions = Partial<Omit<Token<never>, 'payload'>>;


/**
 * A JSON Web Token (JWT) is a compact, URL-safe means of representing claims to be transferred between two parties.
 */
export class JsonWebToken<TData = any> {
  readonly #data: Omit<Token<never>, 'payload'> & { data: TData };
  readonly #ks?: string;
  readonly #sk: Secret;

  private constructor(t: Omit<Token<never>, 'payload'> & { data: TData }, key: Secret, salt?: string) {
    this.#data = t;
    this.#sk = key;
    this.#ks = salt;
  }

  /**
   * Gets the payload of the token.
   */
  public get payload(): TData {
    return this.#data.data;
  }

  /**
   * Gets the issuer of the token.
   */
  public get iss(): string | undefined {
    return this.#data.iss;
  }

  /**
   * Gets the subject of the token.
   */
  public get sub(): string | undefined {
    return this.#data.sub;
  }

  /**
   * Gets the audience of the token.
   */
  public get aud(): string | string[] | undefined {
    return this.#data.aud;
  }

  /**
   * Gets the time when the token expires.
   */
  public get exp(): number | undefined {
    return this.#data.exp;
  }

  /**
   * Gets the time before which the token must not be accepted for processing.
   */
  public get nbf(): number | undefined {
    return this.#data.nbf;
  }

  /**
   * Gets the time at which the token was issued.
   */
  public get iat(): number | undefined {
    return this.#data.iat;
  }

  /**
   * Gets the unique identifier for the token.
   */
  public get jti(): string | undefined {
    return this.#data.jti;
  }

  /**
   * Return a plain object representation of the token.
   * @returns {Token<TData>} A plain object representation of the token.
   */
  public toObject(): Token<TData> {
    return Object.freeze({
      payload: this.#data.data,
      iss: this.#data.iss,
      sub: this.#data.sub,
      aud: this.#data.aud,
      exp: this.#data.exp,
      nbf: this.#data.nbf,
      iat: this.#data.iat,
      jti: this.#data.jti,
    });
  }

  /**
   * Return the string representation of the token.
   * 
   * @param {Secret} key The secret key used to sign the token. 
   * @param {number|string} exp The time when the token expires. 
   * @returns {string} The string representation of the token.
   */
  public async reencode(key?: Secret, exp?: number | `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'M'}`, salt?: string): Promise<string> {
    const o: Record<string, any> = {
      issuer: this.#data.iss,
      subject: this.#data.sub,
      audience: this.#data.aud,
      expiresIn: exp ?? this.#data.exp,
      notBefore: this.#data.nbf,
    };

    for(const prop in o) {
      if(!Object.prototype.hasOwnProperty.call(o, prop)) continue;
      
      if(!o[prop]) {
        delete o[prop];
      }
    }

    if(!key) {
      key = this.#sk;
    }

    if(typeof key !== 'string') {
      throw new Exception('The key must be a string',
        'ERR_INVALID_ARG_TYPE',
        { expected: 'string', received: typeof key });
    }

    const s = salt ?? this.#ks;
    const derivedKey = s ? await JsonWebToken.#deriveKey(key, s) : undefined;

    return jwt.sign({
      data: this.#data.data,
    }, s && derivedKey ? derivedKey : key, o);
  }

  /**
   * Encode a new token
   * 
   * @param payload 
   * @param options 
   * @returns 
   */
  public static async encode<T>(payload: T, options: Omit<TokenOptions, 'jti' | 'iat' | 'exp'> & { key: Secret; __unsafe_NoDeriveKey?: boolean; salt?: string; expires?: null | number | `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'M'}` }): Promise<{ readonly object: JsonWebToken<T>; readonly token: string; }> {
    const { key, expires = null, ...o } = options ?? {};

    const so: Record<string, any> = {
      audience: Object.prototype.hasOwnProperty.call(options, 'aud') ? o.aud : undefined,
      issuer: Object.prototype.hasOwnProperty.call(options, 'iss') ? o.iss : undefined,
      notBefore: Object.prototype.hasOwnProperty.call(options, 'nbf') ? o.nbf : undefined,
      subject: Object.prototype.hasOwnProperty.call(options, 'sub') ? o.sub : undefined,
      jwtid: uuid(),
      expiresIn: expires ?? undefined,
    };

    for(const prop in so) {
      if(!Object.prototype.hasOwnProperty.call(so, prop)) continue;

      if(!so[prop]) {
        delete so[prop];
      }
    }

    if(key && typeof key !== 'string') {
      throw new Exception('The key must be a string',
        'ERR_INVALID_ARG_TYPE',
        { expected: 'string', received: typeof key });
    }

    const derivedKey = options.salt && !options.__unsafe_NoDeriveKey ?
      await this.#deriveKey(key, options.salt)
      : undefined;

    const token = jwt.sign({ data: payload }, 
      options.__unsafe_NoDeriveKey === true || !derivedKey ? 
        key :
        derivedKey,
      so);
      
    const decoded = jwt.verify(token, options.__unsafe_NoDeriveKey === true || !derivedKey ? 
      key :
      derivedKey) as JwtPayload;

    return Promise.resolve(Object.freeze({
      object: new JsonWebToken({ ...options, iat: decoded.iat, jti: so.jwtid, data: payload }, key),
      token,
    }));
  }

  static async #deriveKey(key: string, salt?: string): Promise<string> {
    if(!salt) {
      salt = convertUint8ArrayToHex((await randomBytes(64)));
    }

    return keyd.pbkdf2(key, salt, 'sha512', 100000, 'hex');
  }

  /**
   * Decode a token
   * 
   * @param token 
   * @param key 
   * @returns 
   */
  public static async decode<T>(token: string, key: Secret, salt?: string): Promise<Either<JsonWebTokenError | Exception, JsonWebToken<T>>> {
    if(typeof key !== 'string') {
      throw new Exception('The key must be a string', 
        'ERR_INVALID_ARG_TYPE',
        { expected: 'string', received: typeof key });
    }

    const derivedKey = await this.#deriveKey(key, salt);

    try {
      const d = jwt.verify(token, salt ? derivedKey : key) as JwtPayload;
      return right(new JsonWebToken({ ...d, data: d.data as T }, key));
    } catch (err: any) {
      if(err instanceof JsonWebTokenError) return left(err);

      return left(new Exception(err.message,
        err.cause ?? err.reason ?? err.code ?? 'ERR_UNRECOGNIZED_EXCEPTION'));
    }
  }
}

export default JsonWebToken;
