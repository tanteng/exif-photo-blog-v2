import { POSTGRES_SSL_ENABLED } from '@/app/config';
import { removeParamsFromUrl } from '@/utility/url';
import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
  ...process.env.POSTGRES_URL && {
    connectionString: removeParamsFromUrl(
      process.env.POSTGRES_URL,
      ['sslmode'],
    ),
  },
  ...POSTGRES_SSL_ENABLED && { ssl: true },
  connectionTimeoutMillis: 5000,    // 5s to establish connection
  idleTimeoutMillis: 10000,         // 10s before idle client is closed
  max: 10,                          // default pool size
});

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableError = (error: any): boolean => {
  const code = error?.code || '';
  return code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'CONNECTION_ENDED';
};

export type Primitive = string | number | boolean | undefined | null;

export const query = async <T extends QueryResultRow = any>(
  queryString: string,
  values: Primitive[] = [],
) => {
  let lastError: any;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const client = await pool.connect();
    try {
      const response = await client.query<T>(queryString, values);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES && isRetryableError(error)) {
        console.warn(
          `DB query failed (attempt ${attempt}/${MAX_RETRIES}): ${(error as any)?.code}. Retrying in ${RETRY_DELAY_MS}ms...`,
        );
        await sleep(RETRY_DELAY_MS);
      }
    } finally {
      client.release();
    }
  }
  throw lastError;
};

export const sql = <T extends QueryResultRow>(
  strings: TemplateStringsArray,
  ...values: Primitive[]
) => {
  if (!isTemplateStringsArray(strings) || !Array.isArray(values)) {
    throw new Error('Invalid template literal argument');
  }

  let result = strings[0] ?? '';

  for (let i = 1; i < strings.length; i++) {
    result += `$${i}${strings[i] ?? ''}`;
  }

  return query<T>(result, values);
};

const isTemplateStringsArray = (
  strings: unknown,
): strings is TemplateStringsArray => {
  return (
    Array.isArray(strings) && 'raw' in strings && Array.isArray(strings.raw)
  );
};

export const testDatabaseConnection = async () =>
  query('SELECt COUNT(*) FROM pg_stat_user_tables');
