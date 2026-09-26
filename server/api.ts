import { AppError, validate } from './domain.js';
import { session, mutate, type Store } from './store.js';
export const secureHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self' https://*.chatgpt.com https://chatgpt.com",
};
const reply = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(data, { status, headers: { ...secureHeaders, ...headers } });
export async function api(req: Request, store: Store): Promise<Response> {
  try {
    const url = new URL(req.url);
    if (url.pathname === '/api/health') return reply({ ok: true, app: 'Nexo', mode: 'simulation' });
    const match = (req.headers.get('cookie') || '').match(
      /(?:^|;\s*)nexo_session=([a-f0-9-]{36})(?:;|$)/,
    );
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const id = match?.[1] || crypto.randomUUID();
      const row = await session(store, id);
      return reply(
        { state: JSON.parse(row.state_json), version: row.version, csrf: row.csrf },
        200,
        {
          'Set-Cookie': `nexo_session=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${url.protocol === 'https:' ? '; Secure' : ''}`,
        },
      );
    }
    if (req.method === 'POST' && url.pathname === '/api/commands') {
      if (!match) throw new AppError(401, 'Primero inicia la demo.');
      const origin = req.headers.get('origin');
      if (origin && origin !== url.origin) throw new AppError(403, 'Origen no permitido.');
      if (!req.headers.get('content-type')?.includes('application/json'))
        throw new AppError(415, 'Se requiere JSON.');
      const length = Number(req.headers.get('content-length') || 0);
      if (length > 8192) throw new AppError(413, 'Solicitud demasiado grande.');
      const body = await req.text();
      if (body.length > 8192) throw new AppError(413, 'Solicitud demasiado grande.');
      const row = await store.read(match[1]);
      if (!row || req.headers.get('x-csrf-token') !== row.csrf)
        throw new AppError(403, 'La sesión cambió. Recarga la página para continuar.');
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        throw new AppError(400, 'JSON no válido.');
      }
      const result = await mutate(store, match[1], validate(parsed));
      return reply({
        state: JSON.parse(result.row.state_json),
        version: result.row.version,
        csrf: result.row.csrf,
        result: result.result,
      });
    }
    return reply({ error: 'Ruta no encontrada.' }, 404);
  } catch (error) {
    if (error instanceof AppError) return reply({ error: error.message }, error.status);
    console.error('Nexo request failed', error instanceof Error ? error.message : 'Unknown');
    return reply(
      { error: 'No pudimos completar la solicitud. Tus cambios anteriores están guardados.' },
      500,
    );
  }
}
