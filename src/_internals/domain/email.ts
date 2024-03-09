import { isString } from 'typesdk/utils/is';

import { ValidationError } from '../errors';
import { type Either, left, right } from '../logic/Either';


export class Email {
  private readonly _email: string;

  public get value(): string {
    return this._email;
  }

  private constructor(value: string) {
    this._email = value;
  }

  public static validate(email: string): boolean {
    if(!email) return false;
    if(!isString(email)) return false;

    const regex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return regex.test(email.toLowerCase());
  }

  public static format(email: string) {
    return email.trim().toLowerCase();
  }

  public static create(email: string): Either<ValidationError, Email> {
    if(!this.validate(email)) return left(new ValidationError('Invalid email', 'Check if the email is valid'));
    return right(new Email(this.format(email)));
  }
}

export default Email;
