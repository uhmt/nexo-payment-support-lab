import type { Row, Store } from './store.js';

export interface SqlClient {
  query<T>(text: string, values: unknown[]): Promise<{ rows: T[] }>;
}

export function postgresStore(client: SqlClient): Store {
  return {
    async read(id) {
      const { rows } = await client.query<Row>(
        'SELECT state_json, version, csrf, updated_at::float8 AS updated_at FROM demo_sessions WHERE id = $1',
        [id],
      );
      return rows[0] ?? null;
    },
    async insert(id, row) {
      await client.query(
        'INSERT INTO demo_sessions (id, state_json, version, csrf, updated_at) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO NOTHING',
        [id, row.state_json, row.version, row.csrf, row.updated_at],
      );
    },
    async cas(id, version, state) {
      const { rows } = await client.query<{ version: number }>(
        'UPDATE demo_sessions SET state_json = $1, version = version + 1, updated_at = $2 WHERE id = $3 AND version = $4 RETURNING version',
        [JSON.stringify(state), Date.now(), id, version],
      );
      return rows.length === 1;
    },
  };
}
