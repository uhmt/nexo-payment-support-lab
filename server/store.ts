import type { State, Command, Envelope } from '../src/types.js';
import { seed, execute, AppError } from './domain.js';
export interface Row {
  state_json: string;
  version: number;
  csrf: string;
  updated_at: number;
}
export interface Store {
  read(id: string): Promise<Row | null>;
  insert(id: string, row: Row): Promise<void>;
  cas(id: string, version: number, state: State): Promise<boolean>;
}
export async function session(store: Store, id: string): Promise<Row> {
  let row = await store.read(id);
  if (row) return row;
  row = {
    state_json: JSON.stringify(seed()),
    version: 1,
    csrf: crypto.randomUUID(),
    updated_at: Date.now(),
  };
  await store.insert(id, row);
  return (await store.read(id))!;
}
export async function mutate(
  store: Store,
  id: string,
  command: Command,
): Promise<{ row: Row; result: Envelope['result'] }> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await store.read(id);
    if (!row) throw new AppError(401, 'La sesión expiró. Recarga la página.');
    const { state, result } = execute(JSON.parse(row.state_json), command);
    if (await store.cas(id, row.version, state))
      return {
        row: { ...row, state_json: JSON.stringify(state), version: row.version + 1 },
        result,
      };
  }
  throw new AppError(409, 'Otro cambio ocurrió al mismo tiempo. Inténtalo de nuevo.');
}
export interface D1 {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T>(): Promise<T | null>;
      run(): Promise<{ meta: { changes: number } }>;
    };
    run(): Promise<unknown>;
  };
}
export function d1Store(db: D1): Store {
  return {
    read: async (id) =>
      db
        .prepare('SELECT state_json, version, csrf, updated_at FROM demo_sessions WHERE id = ?')
        .bind(id)
        .first<Row>(),
    insert: async (id, row) => {
      await db
        .prepare(
          'INSERT OR IGNORE INTO demo_sessions (id,state_json,version,csrf,updated_at) VALUES (?,?,?,?,?)',
        )
        .bind(id, row.state_json, row.version, row.csrf, row.updated_at)
        .run();
    },
    cas: async (id, version, state) => {
      const r = await db
        .prepare(
          'UPDATE demo_sessions SET state_json = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?',
        )
        .bind(JSON.stringify(state), Date.now(), id, version)
        .run();
      return r.meta.changes === 1;
    },
  };
}
