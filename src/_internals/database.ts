import { Database } from 'typesdk/database/postgres';

import { Exception } from './errors';
import { Environment } from '../auth/env';



declare global {
  // eslint-disable-next-line no-var
  var db: Database | undefined;
}

export async function connect(env: Environment): Promise<Database> {
  if(typeof process === 'undefined') {
    throw new Error('Cannot connect to database in a browser environment');
  }

  const url = env.getVariable('POSTGRES_URL');

  if(!url) {
    throw new Exception('Database connection error: missing variable `POSTGRES_URL`', 'ERR_MISSING_ENVIRONMENT_VARIABLE');
  }

  if(env.isProduction()) return new Database(url);

  if(!globalThis.db ||
    !(await globalThis.db.isOnline())) {
    globalThis.db = new Database(url);
  }

  return globalThis.db;
}


export async function ensureTables(env: Environment): Promise<void> {
  const database = await connect(env);

  try {
    await database.transaction(async client => {
      const sessionsQuery = RAW_SCHEMAS.SESSIONS
        .replaceAll('%s', env.sessionsTable)
        .replaceAll('%u', env.usersTable)
        .replaceAll('%i', env.userIdColumn);

      const sessionChunksQuery = RAW_SCHEMAS.SESSION_PAYLOAD_CHUNKS
        .replaceAll('%n', `${env.sessionsTable}_payload_chunks`)
        .replaceAll('%s', env.sessionsTable);

      let query = sessionsQuery.endsWith(';') ? sessionsQuery : `${sessionsQuery};`;
      query += sessionChunksQuery.endsWith(';') ? sessionChunksQuery : `${sessionChunksQuery};`;

      await client.query({ text: query });
    });
  } finally {
    await database.close();
  }
}



export const RAW_SCHEMAS = {
  SESSIONS: `CREATE TABLE IF NOT EXISTS %s (
    session_id VARCHAR(128) NOT NULL UNIQUE PRIMARY KEY,
    user_id VARCHAR(128) NULL,
    headers JSON NOT NULL DEFAULT '{}'::JSON,
    payload_hash VARCHAR(512) NOT NULL,
    signature TEXT NOT NULL,
    ip_address TEXT NULL,
    created_at VARCHAR(64) NOT NULL,
    expires_at VARCHAR(64) NULL,
    FOREIGN KEY (user_id) REFERENCES %u(%i) ON DELETE CASCADE
  );`,
  SESSION_PAYLOAD_CHUNKS: `CREATE TABLE IF NOT EXISTS %n (
    session_payload_chunks_row_id SERIAL NOT NULL PRIMARY KEY,
    session_id VARCHAR(128) NOT NULL,
    chunk_index BIGINT NOT NULL,
    chunk_hash TEXT NOT NULL,
    chunk_value TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES %s(session_id) ON DELETE CASCADE
  );`,
} as const;
