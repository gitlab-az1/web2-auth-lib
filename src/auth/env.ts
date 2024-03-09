import { isThenable } from 'not-synchronous/core';
import { assertString } from 'typesdk/utils/assertions';

import { Exception } from '../_internals/errors';
import type { LooseAutocomplete } from '../_internals/types';



export type AuthEnvironemtnOptions = {
  database: {
    dialect: 'postgres';
    tablePrefix?: string;
    connection: string | {
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
    };
    refs: {
      users: {
        tableName: string;
        userIdentifier: string;
        forceTableNameWithoutPrefix?: boolean;
      };
    };
  };
}

export interface EnvironmentVariables {
  POSTGRES_URL: string;
  POSTGRES_DB: string;
  WEB2_CRYPTO_KEY: string;
}

type BaseVariableGetterOptions<T> = {
  rewrite?: (value: string) => T;
};

type VariableGetterWithFallback<T> = BaseVariableGetterOptions<T> & { fallback: string };
type VariableGetterWithoutFallback<T> = BaseVariableGetterOptions<T> & { fallback?: never };

export class Environment {
  public static readonly VARIABLE_LHS = '${';
  public static readonly VARIABLE_REGEXP = /\$\{(.*?)\}/g;

  readonly #o: AuthEnvironemtnOptions;
  readonly #variables: Map<string, string> = new Map();

  public constructor(props: AuthEnvironemtnOptions) {
    if(!props.database) {
      throw new TypeError('The `database` property is required');
    }

    if(props.database.dialect !== 'postgres') {
      throw new TypeError('The `dialect` property must be `postgres`');
    }

    if(!props.database.connection) {
      throw new TypeError('The `connection` property is required');
    }

    if(!props.database.refs) {
      throw new TypeError('The `refs` property is required');
    }

    if(!props.database.refs.users) {
      throw new TypeError('The `refs.users` property is required');
    }

    if(!props.database.refs.users.tableName) {
      throw new TypeError('The `refs.users.tableName` property is required');
    }

    if(!/^[a-zA-Z_]+$/.test(props.database.refs.users.tableName)) {
      throw new TypeError('The `refs.users.tableName` property must be a valid SQL table name');
    }

    if(!props.database.refs.users.userIdentifier) {
      throw new TypeError('The `refs.users.userIdentifier` property is required');
    }

    if(!/^[a-zA-Z_]+$/.test(props.database.refs.users.userIdentifier)) {
      throw new TypeError('The `refs.users.userIdentifier` property must be a valid SQL column name');
    }

    if(!!props.database.tablePrefix && 
      !/^[a-zA-Z_]+$/.test(props.database.tablePrefix)) {
      throw new TypeError('The `tablePrefix` property must be a valid SQL table prefix');
    }

    if(typeof props.database.connection === 'string') {
      this.setInternalVariable('POSTGRES_URL', props.database.connection);
    } else {
      const url = new URL(`postgres://${props.database.connection.host}:${props.database.connection.port}`);
      url.username = props.database.connection.username;
      url.password = props.database.connection.password;
      url.pathname = props.database.connection.database;

      this.setInternalVariable('POSTGRES_URL', url.toString());
    }

    if(!this.getVariable('WEB2_CRYPTO_KEY')) {
      throw new Exception('The `WEB2_CRYPTO_KEY` environment variable is required', 'ERR_MISSING_ENVIRONMENT_VARIABLE');
    }

    this.#o = props;
  }

  public get sessionsTable(): string {
    return this.#o.database.tablePrefix ?
      `${this.#o.database.tablePrefix.endsWith('_') ? this.#o.database.tablePrefix : `${this.#o.database.tablePrefix}_`}sessions` :
      'sessions';
  }

  public get usersTable(): string {
    if(!this.#o.database.tablePrefix) return this.#o.database.refs.users.tableName;
    if(this.#o.database.refs.users.forceTableNameWithoutPrefix === true) return this.#o.database.refs.users.tableName;

    return `${this.#o.database.tablePrefix.endsWith('_') ? this.#o.database.tablePrefix : `${this.#o.database.tablePrefix}_`}${this.#o.database.refs.users.tableName}`;
  }

  public get userIdColumn(): string {
    return this.#o.database.refs.users.userIdentifier;
  }

  public get runtimeEnvironment(): 'production' | 'test' | 'edge' | 'development' {
    return (
      this.isProduction() ? 'production' :
        this.isTest() ? 'test' :
          this.isEdge() ? 'edge' :
            'development'
    );
  }

  public setVariable<K extends keyof EnvironmentVariables>(key: LooseAutocomplete<K>, value: string, override: boolean = true): void {
    assertString(key);

    if(typeof process !== 'undefined') {
      if(!Object.prototype.hasOwnProperty.call(process.env, key) ||
        override === true) {
        process.env[key] = value;
      }
    }
  }

  public getVariable<K extends keyof EnvironmentVariables>(key: LooseAutocomplete<K>): string | null;
  public getVariable<K extends keyof EnvironmentVariables, T = string>(key: LooseAutocomplete<K>, options: VariableGetterWithFallback<T>): T;
  public getVariable<K extends keyof EnvironmentVariables, T = string>(key: LooseAutocomplete<K>, options: VariableGetterWithoutFallback<T>): T | null;
  public getVariable<K extends keyof EnvironmentVariables, T = string>(key: LooseAutocomplete<K>, options?: VariableGetterWithFallback<T> | VariableGetterWithoutFallback<T>): T | null {
    assertString(key);
    let value: string | undefined;

    if(typeof process !== 'undefined') {
      value = process.env[key] ?? options?.fallback;
    }
    
    if(!value) return null;

    const match = Environment.VARIABLE_REGEXP.exec(value);
    
    if(match) {
      const variableValue = this.getVariable(match[1]);
      value = value.replace(match[0], variableValue || '');
    }

    if(!options?.rewrite || typeof options.rewrite !== 'function') return value as T;
    let output: T;

    if(isThenable((output = options.rewrite(value!)))) {
      throw new Exception('The rewrite function must be synchronous', 'ERR_ASYNC_REWRITE_FUNCTION');
    }

    return output;
  }

  public deleteVariable<K extends keyof EnvironmentVariables>(key: LooseAutocomplete<K>): void {
    assertString(key);

    if(typeof process !== 'undefined') {
      if(Object.prototype.hasOwnProperty.call(process.env, key)) {
        delete process.env[key];
      }
    }
  }

  public setInternalVariable(key: string, value: string): void {
    this.#variables.set(key, value);
  }

  public getInternalVariable(key: string): string | null {
    return this.#variables.get(key) ?? null;
  }

  public deleteInternalVariable(key: string): void {
    if(this.#variables.has(key)) {
      this.#variables.delete(key);
    }
  }

  public isProduction(): boolean {
    if(typeof process === 'undefined') return false;
    
    return (
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_NODE_ENV === 'production'
    );
  }

  public isTest(): boolean {
    if(typeof process === 'undefined') return false;
    
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.NEXT_PUBLIC_NODE_ENV === 'test'
    );
  }

  public isEdge(): boolean {
    if(typeof process === 'undefined') return false;
    
    return (
      process.env.NODE_ENV === 'edge' ||
      process.env.NEXT_PUBLIC_NODE_ENV === 'edge' ||
      process.env.VERCEL_ENV === 'edge' ||
      process.env.NEXT_PUBLIC_VERCEL_ENV === 'edge'
    );
  }

  public isDevelopment(): boolean {
    return (
      !this.isTest() &&
      !this.isEdge() &&
      !this.isProduction()
    );
  }

  public is(env: 'production' | 'test' | 'edge' | 'development'): boolean {
    if(env === 'production') return this.isProduction();
    if(env === 'test') return this.isTest();
    if(env === 'edge') return this.isEdge();
    if(env === 'development') return this.isDevelopment();

    return false;
  }
}
