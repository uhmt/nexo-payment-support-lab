import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { postgresStore } from '../server/postgres.js';
import { session, mutate } from '../server/store.js';
import { api } from '../server/api.js';

test('Postgres migration, persistent sessions, isolation and concurrent writes', async () => {
  const db = new PGlite();
  try {
    const migration = await readFile('netlify/database/migrations/0001_sessions.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    const store = postgresStore(db);
    const id = crypto.randomUUID();
    const initial = await session(store, id);
    const command = { type: 'simulate' as const, scenario: 'approved' as const, requestId: crypto.randomUUID() };
    await Promise.all([mutate(store, id, command), mutate(store, id, command)]);
    const saved = await session(postgresStore(db), id);
    assert.equal(JSON.parse(saved.state_json).orders.length, JSON.parse(initial.state_json).orders.length + 1);
    assert.equal(saved.csrf, initial.csrf);
    assert.equal(typeof saved.updated_at, 'number');
    assert.equal(await store.cas(id, initial.version, JSON.parse(initial.state_json)), false);
    const other = await session(store, crypto.randomUUID());
    assert.equal(JSON.parse(other.state_json).orders.length, JSON.parse(initial.state_json).orders.length);
    assert.notEqual(other.csrf, initial.csrf);
    const req = new Request('https://nexo.test/api/state', { headers: { cookie: `nexo_session=${id}` } });
    const res = await api(req, postgresStore(db));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).state.orders.length, JSON.parse(saved.state_json).orders.length);
  } finally {
    await db.close();
  }
});
