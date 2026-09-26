import { getDatabase } from '@netlify/database';
import type { Config } from '@netlify/functions';
import { api, secureHeaders } from '../../server/api.js';
import { postgresStore } from '../../server/postgres.js';

export default async function handler(request: Request): Promise<Response> {
  try {
    const db = getDatabase();
    const store = postgresStore({
      async query<T>(text: string, values: unknown[]) {
        const rows = await db.sql.unsafe(text, values);
        return { rows: rows as T[] };
      },
    });
    return await api(request, store);
  } catch {
    return Response.json(
      { error: 'El almacenamiento no está disponible. Inténtalo de nuevo en unos momentos.' },
      { status: 503, headers: secureHeaders },
    );
  }
}

export const config: Config = { path: '/api/*' };
