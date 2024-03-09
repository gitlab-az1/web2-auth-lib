import { jsonSafeStringify } from 'typesdk/safe-json';
import { type Block, BlockCipher, SymmetricKey } from 'cryptx-sdk';
import { type DateTimeString, parseTimeString } from 'typesdk/datetime';

import Entity from '../domain/entity';
import { createCrypto } from '../../crypto';
import { Environment } from '../../auth/env';
import { uuidWithoutSlashes } from '../id';
import { type IP, IPv4, IPv6 } from '../inet';
import { connect, ensureTables } from '../database';
import type { Dict, LooseAutocomplete } from '../types';
import { Exception, ExpiredError, InvalidSignatureError } from '../errors';



export type SessionDocument<T> = {
  readonly payload: T;
  readonly headers: {
    readonly [key: string]: string | number;
    readonly length: number;
  };
  readonly signature: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly ip?: {
    readonly family: 'IPv4' | 'IPv6';
    readonly address: string;
  };
  readonly userId?: string;
  readonly sessionId: string;
}

type SessionProps<T> = {
  payload: T;
  userId?: string;
  createdAt?: string;
  signature?: string;
  headers?: Dict<any>;
  ipAddress?: string | IPv4 | IPv6;
  expires: LooseAutocomplete<DateTimeString>;
}

export class Session<T extends Record<string, any>> extends Entity<SessionProps<T>> {
  readonly #env: Environment;

  public get payload(): T {
    return this.props.payload;
  }

  public get headers(): Dict<string | number> & { readonly length: number } {
    if(!this.props.headers || 
      !Object.prototype.hasOwnProperty.call(this.props.headers, 'length')) return { length: 0 };

    return this.props.headers as unknown as Dict<string | number> & { readonly length: number };
  }

  public get signature(): string {
    return this.props.signature!;
  }

  public get createdAt(): Date {
    return new Date(this.props.createdAt!);
  }

  public get expiresAt(): Date {
    if(/^(\d+)([smhdwMy])$/.test(this.props.expires as string)) return parseTimeString(this.props.expires as DateTimeString);
    return new Date(this.props.expires as string);
  }

  public get ip(): IP | null {
    if(!this.props.ipAddress) return null;
    
    if(this.props.ipAddress instanceof IPv4) return {
      family: 'IPv4',
      ip: this.props.ipAddress,
    };

    if(this.props.ipAddress instanceof IPv6) return {
      family: 'IPv6',
      ip: this.props.ipAddress,
    };

    const parseIpv6 = (ip: string): IP => {
      // const [address, scopeId] = ip.split('%');
      const i = IPv6.from(ip);

      if(i.isLeft()) {
        throw i.value;
      }

      return {
        family: 'IPv6',
        ip: i.value,
      };
    };

    const parseIpv4 = (ip: string): IP => {
      const i = IPv4.from(ip);
    
      if(i.isLeft()) {
        throw i.value;
      }
    
      return {
        family: 'IPv4',
        ip: i.value,
      };
    };

    if(this.props.ipAddress.indexOf(':') > -1) return parseIpv6(this.props.ipAddress);
    return parseIpv4(this.props.ipAddress);
  }

  public get userId(): string | null {
    return this.props.userId ?? null;
  }

  public get sessionId(): string {
    return this._id;
  }

  private constructor(props: SessionProps<T>, env: Environment, id?: string) {
    super(props, id);
    this.#env = env;
  }

  private _destroy(): void {
    this.props.payload = null!;
    this.props.headers = null!;
    this.props.signature = null!;
    this.props.createdAt = null!;
    this.props.expires = null!;
    this.props.ipAddress = null!;
    this.props.userId = null!;
  }

  public doc(): SessionDocument<T> {
    return Object.freeze({
      payload: this.payload,
      headers: this.headers,
      signature: this.signature,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      userId: this.userId ?? undefined,
      sessionId: this._id,
      ip: this.ip ? {
        family: this.ip.family,
        address: this.ip.ip.address,
      } : undefined,
    } satisfies SessionDocument<T>);
  }

  public async erase(): Promise<void> {
    const database = await connect(this.#env);

    try {
      await database.query(`DELETE FROM ${this.#env.sessionsTable} WHERE session_id = $1`, {
        values: [this._id],
      });

      this._destroy();
    } finally {
      await database.close();
    }
  }

  public static async create<T extends Record<string, any>>(env: Environment, props: SessionProps<T>): Promise<Session<T>> {
    let query = `INSERT INTO ${env.sessionsTable} (session_id,
      headers,
      created_at,
      expires_at,
      payload_hash,
      signature`;

    if(props.ipAddress) {
      query += ', ip_address';
    }

    if(props.userId) {
      query += ', user_id';
    }

    query += ') VALUES ($1, $2, $3, $4, $5, $6';

    if(props.ipAddress && props.userId) {
      query += ', $7, $8)';
    } else if(props.ipAddress || props.userId) {
      query += ', $7)';
    } else {
      query += ')';
    }

    query += ' RETURNING *';

    try {
      JSON.stringify(props.payload);
    } catch {
      throw new Exception('Failed to serialize session payload', 'ERR_PAYLOAD_UNSERIALIZABLE');
    }

    const key = env.getVariable('WEB2_CRYPTO_KEY');

    if(!key) {
      throw new Exception('The `WEB2_CRYPTO_KEY` environment variable is required', 'ERR_MISSING_ENVIRONMENT_VARIABLE');
    }

    const k = new SymmetricKey(Buffer.from(key), {
      algorithm: 'aes-256-cbc',
      usages: ['encrypt', 'decrypt', 'sign', 'verify'],
    });

    if(!k.hmacKey) {
      throw new Exception('Key `WEB2_CRYPTO_KEY` is too short', 'ERR_KEY_LENGTH_REQUIRED');
    }

    const c = createCrypto();

    const sign = await c.sign(k.hmacKey,
      Buffer.from(JSON.stringify(props.payload)), 'hmac-sha-512');

    const cipher = new BlockCipher(k, { blockSize: 512 });
    const e = await cipher.encrypt(props.payload);

    const h = jsonSafeStringify({
      ...props.headers,
      length: Buffer.from(jsonSafeStringify(props.payload) ?? '{}').byteLength,
    }) || '{}';

    const values = [
      uuidWithoutSlashes(),
      h,
      new Date().toISOString(),
      parseTimeString(props.expires as DateTimeString).toISOString(),
      e.checksum,
      Buffer.from(sign).toString('base64'),
    ];

    if(props.ipAddress) {
      const ip = await c.aesEncrypt(k.key, typeof props.ipAddress === 'string' ?
        props.ipAddress : 
        props.ipAddress.address, 'base64');

      values.push(ip);
    }

    if(props.userId) {
      values.push(props.userId);
    }

    await ensureTables(env);
    const database = await connect(env);

    try {
      const results = await database.transaction(async client => {
        const { rows } = await client.query({
          text: query,
          values,
        });

        for(const block of e.blocks) {
          await client.query({
            text: `INSERT INTO ${env.sessionsTable}_payload_chunks (session_id,
              chunk_index,
              chunk_hash,
              chunk_value) VALUES ($1, $2, $3, $4)`,
            values: [
              rows[0].session_id,
              block.index,
              block.hash,
              block.data,
            ],
          });
        }

        return rows[0];
      });

      return new Session({
        payload: props.payload,
        userId: props.userId,
        createdAt: results.created_at,
        signature: results.signature,
        headers: results.headers,
        ipAddress: props.ipAddress,
        expires: results.expires_at,
      }, env, results.session_id);
    } finally {
      await database.close();
    }
  }

  public static async find<T extends Record<string, any>>(env: Environment, sessionId: string): Promise<Session<T> | null> {
    const lookupQuery = `SELECT
      s.*,
      (SELECT json_agg(sp.*) FROM ${env.sessionsTable}_payload_chunks sp WHERE sp.session_id = s.session_id) AS payload_chunks
    FROM
      ${env.sessionsTable} s
    WHERE
      s.session_id = $1;`;
    
    const database = await connect(env);

    try {
      const results = await database.query(lookupQuery, { values: [sessionId] });
      if(results.rows.length !== 1) return null;

      if(new Date(results.rows[0].expires_at) < new Date()) {
        await database.query(`DELETE FROM ${env.sessionsTable} WHERE session_id = $1`, {
          values: [sessionId],
        });

        await database.close();

        throw new ExpiredError(`[${results.rows[0].session_id}] Session has expired`,
          new Date(results.rows[0].expires_at));
      }

      const blocks: Block[] = results.rows[0].payload_chunks.map((item: any) => ({
        index: item.chunk_index,
        hash: item.chunk_hash,
        data: item.chunk_value,
      }));

      const key = env.getVariable('WEB2_CRYPTO_KEY');

      if(!key) {
        throw new Exception('The `WEB2_CRYPTO_KEY` environment variable is required', 'ERR_MISSING_ENVIRONMENT_VARIABLE');
      }

      const k = new SymmetricKey(Buffer.from(key), {
        algorithm: 'aes-256-cbc',
        usages: ['encrypt', 'decrypt', 'sign', 'verify'],
      });

      if(!k.hmacKey) {
        throw new Exception('Key `WEB2_CRYPTO_KEY` is too short', 'ERR_KEY_LENGTH_REQUIRED');
      }

      const cipher = new BlockCipher(k, { blockSize: 512 });
      const d = await cipher.decrypt<T>({
        blocks,
        checksum: results.rows[0].payload_hash,
      });

      const serializedPayload = jsonSafeStringify(d.payload) || '{}';
      const c = createCrypto();

      const isSignatureValid = await c.verify(k.hmacKey,
        serializedPayload, Buffer.from(results.rows[0].signature, 'base64'), 'hmac-sha-512');

      if(!isSignatureValid) {
        await database.query(`DELETE FROM ${env.sessionsTable} WHERE session_id = $1`, {
          values: [sessionId],
        });

        await database.close();

        throw new InvalidSignatureError(`[${results.rows[0].session_id}] Session signature is invalid`,
          results.rows[0].signature, 'unknown');
      }

      const s: SessionProps<T> = {
        expires: results.rows[0].expires_at,
        payload: d.payload,
        createdAt: results.rows[0].created_at,
        headers: results.rows[0].headers,
        signature: results.rows[0].signature,
        userId: results.rows[0].user_id,
      };

      if(results.rows[0].ip_address) {
        const ip = await c.aesDecrypt<string>(k.key, Buffer.from(results.rows[0].ip_address, 'base64'));
        s.ipAddress = ip.payload;
      }

      return new Session<T>(s, env, results.rows[0].session_id);
    } finally {
      await database.close();
    }
  }

  public static async count(env: Environment): Promise<number> {
    const database = await connect(env);

    try {
      const results = await database.query(`SELECT COUNT(*) FROM ${env.sessionsTable}`);
      return parseInt(results.rows[0].count, 10);
    } finally {
      await database.close();
    }
  }
}

export default Session;
