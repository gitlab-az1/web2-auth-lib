import { deepCompare, keyd } from 'cryptx-sdk';

import { Environment } from '../../auth/env';
import { Either, left, right } from '../logic/Either';
import { ValidationError } from '../../_internals/errors';


export class Password {
  readonly #salt: string;
  #algorithm: 'pbkdf2' | 'argon2' = 'pbkdf2';

  private readonly _password: string;
  private readonly _hashed: boolean;

  private constructor(env: Environment, password: string, hashed: boolean, salt?: string) {
    this._password = password;
    this._hashed = hashed;

    this.#salt = salt && typeof salt === 'string' && salt.trim().length > 16 ? salt : env.getVariable('HMAC_KEY')!;
  }

  public get algorithm(): 'pbkdf2' | 'argon2' {
    return this.#algorithm;
  }

  public set algorithm(value: 'pbkdf2' | 'argon2') {
    if(typeof value !== 'string' ||
      !['pbkdf2', 'argon2'].includes(value)) return;

    this.#algorithm = value;
  }

  public static validate(password: string): boolean {
    if(
      !password ||
      password.trim().length < 6 ||
      password.trim().length > 255
    ) return false;

    return true;
  }

  public async getHashedValue(): Promise<string> {
    if(this._hashed) return Promise.resolve(this._password);
    
    switch(this.#algorithm) {
      case 'argon2': {
        const buffer = await keyd.argon2(this._password, this.#salt, 100000, 2048, 4, 'buffer');
        return buffer.toString('hex');
        break;
      }
      case 'pbkdf2': {
        const buffer = await keyd.pbkdf2(this._password, this.#salt, 'sha512', 100000, 'buffer');
        return buffer.toString('hex');
        break;
      }
      default:
        throw new TypeError(`Invalid hashing algorithm: ${this.#algorithm}`);
    }
  }

  public async compare(plainTextPassword: string): Promise<boolean> {
    if(!this._hashed) return deepCompare(Buffer.from(plainTextPassword),
      Buffer.from(this._password));
    
    let calculatedHash: Uint8Array;
    
    switch(this.#algorithm) {
      case 'argon2':
        calculatedHash = await keyd.argon2(plainTextPassword, this.#salt, 100000, 2048, 4, 'bytearray');
        break;
      case 'pbkdf2':
        calculatedHash = await keyd.pbkdf2(plainTextPassword, this.#salt, 'sha512', 100000, 'bytearray');
        break;
      default:
        throw new TypeError(`Invalid hashing algorithm: ${this.#algorithm}`);
    }

    return deepCompare(
      calculatedHash,
      Buffer.from(this._password, 'hex') // eslint-disable-line comma-dangle
    );
  }

  public toByteArray(): Uint8Array {
    if(!this._hashed) return Buffer.from(this._password);
    return Buffer.from(this._password, 'hex');
  }

  public static create(env: Environment, password: string, hashed?: boolean, salt?: string): Either<ValidationError, Password> {
    if(!hashed && !this.validate(password)) return left(new ValidationError('Invalid password', 'Check if the password is valid'));

    return right(new Password(env, password,
      typeof hashed === 'boolean' ?
        hashed :
        false, salt));
  }
}

export default Password;
