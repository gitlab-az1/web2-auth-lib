import type { Dict } from './types';



export type ExceptionContextParams = [
  context?: Dict<any>
];


export class Stacktrace {
  public static create(stack?: string): Stacktrace {
    if(typeof stack !== 'string') return new Stacktrace(new Error().stack ?? '');
    return new Stacktrace((stack ?? new Error().stack) ?? '');
  }

  private constructor(
    public readonly value: string // eslint-disable-line comma-dangle
  ) { }

  public print(): void {
    // logger.warn(this.value.split('\n').slice(2).join('\n'));
  }

  public toString(): string {
    return this.value.split('\n').slice(2).join('\n');
  }

  public [Symbol.toStringTag]() {
    return '[object Stacktrace]';
  }
}

export class Exception extends Error {
  public override readonly name: string = 'Exception' as const;
  public readonly code: string;
  public readonly context: Dict<any>;
  public readonly stacktrace: Stacktrace;

  constructor(message: string, code: string, ...params: ExceptionContextParams) {
    super(message);

    this.code = code;
    this.context = params[0] ?? {};
    this.stacktrace = Stacktrace.create(this.stack);
  }

  public override [Symbol.toStringTag]() {
    return '[object Exception]';
  }
}


export class NotImplementedError extends Exception {
  public override readonly name: 'NotImplementedError' = 'NotImplementedError' as const;

  constructor(message: string, isMethod: boolean = false, ...params: ExceptionContextParams) {
    super(message,
      `ERR_${isMethod ? 'METHOD_' : ''}NOT_IMPLEMENTED`,
      ...params);
  }

  public override [Symbol.toStringTag]() {
    return '[object NotImplementedError]';
  }
}


export class ValidationError extends Exception {
  public override readonly name: 'ValidationError' = 'ValidationError' as const;
  public override readonly message: string;
  public readonly action?: string;

  constructor(message: string, action?: string, ...params: ExceptionContextParams) {
    const context = params[0] ?? {};

    if(!context.statusCode) {
      context.statusCode = 400;
    }

    super(message,
      'ERR_VALIDATION_FAILED',
      // @ts-expect-error - TS doesn't understand the spread operator here
      ...[context, ...params.slice(1)]);

    this.message = message;
    this.action = action;
  }
}

export class InvalidSignatureError extends Exception {
  public override readonly name: 'InvalidSignatureError' = 'InvalidSignatureError' as const;
  public readonly expected: string;
  public readonly received: string;
    
  constructor(message: string, expected: string, received: string, ...params: ExceptionContextParams) {
    const context = params[0] ?? {};

    if(!context.statusCode) {
      context.statusCode = 403;
    }

    super(message,
      'ERR_INVALID_SIGNATURE',
      // @ts-expect-error - TS doesn't understand the spread operator here
      ...[context, ...params.slice(1)]);

    this.expected = expected;
    this.received = received;
  }
}


export class InvalidIPAddressError extends Exception {
  public override readonly name: 'InvalidIPAddressError' = 'InvalidIPAddressError' as const;

  constructor(message: string, status?: number, ...params: ExceptionContextParams) {
    const context = params[0] ?? {};

    if(!context.statusCode) {
      context.statusCode = status ?? 422;
    }

    super(message,
      'ERR_INVALID_IP_ADDRESS',
      // @ts-expect-error - TS doesn't understand the spread operator here
      ...[context, ...params]);
  }
}


export class ExpiredError extends Exception {
  public override readonly name: 'ExpiredError' = 'ExpiredError' as const;
  public readonly expiredAt: Date;

  constructor(message: string, expiredAt: Date, ...params: ExceptionContextParams) {
    const context = params[0] ?? {};
    
    if(!context.statusCode) {
      context.statusCode = 403;
    }

    if(!(expiredAt instanceof Date)) {
      throw new TypeError('ExpiredError: expiredAt must be a Date object');
    }
    
    super(message,
      'ERR_EXPIRED',
      // @ts-expect-error - TS doesn't understand the spread operator here
      ...[context, ...params.slice(1)]);
    
    this.expiredAt = expiredAt;
  }
}
