import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { api, secureHeaders } from './api.js';
import type { Store, Row } from './store.js';
mkdirSync('.data', { recursive: true });
const db = new DatabaseSync(process.env.NEXO_DATABASE || '.data/nexo.sqlite');
db.exec('PRAGMA journal_mode=WAL;');
db.exec(readFileSync('migrations/0001_sessions.sql', 'utf8'));
const store: Store = {
  read: async (id) =>
    (db.prepare('SELECT * FROM demo_sessions WHERE id = ?').get(id) as unknown as Row) || null,
  insert: async (id, row) => {
    db.prepare(
      'INSERT OR IGNORE INTO demo_sessions (id,state_json,version,csrf,updated_at) VALUES (?,?,?,?,?)',
    ).run(id, row.state_json, row.version, row.csrf, row.updated_at);
  },
  cas: async (id, version, state) =>
    db
      .prepare(
        'UPDATE demo_sessions SET state_json=?, version=version+1,updated_at=? WHERE id=? AND version=?',
      )
      .run(JSON.stringify(state), Date.now(), id, version).changes === 1,
};
const app = express();
app.disable('x-powered-by');
app.use('/api', express.text({ type: '*/*', limit: '8kb' }), async (req, res) => {
  const origin = `http://${req.headers.host}`;
  const headers = new Headers();
  Object.entries(req.headers).forEach(([k, v]) => {
    if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
  });
  const request = new Request(origin + req.originalUrl, {
    method: req.method,
    headers,
    ...(req.method === 'GET' || req.method === 'HEAD' ? {} : { body: req.body || '' }),
  });
  const response = await api(request, store);
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.status(response.status).send(await response.text());
});
app.use((_, res, next) => {
  Object.entries(secureHeaders).forEach(([k, v]) => res.setHeader(k, v));
  next();
});
app.use(express.static('dist/client'));
app.get('/', (_, res) => res.sendFile(process.cwd() + '/dist/client/index.html'));
const port = Number(process.env.PORT || 8787);
app.listen(port, '127.0.0.1', () => console.log(`Nexo ready at http://127.0.0.1:${port}`));
