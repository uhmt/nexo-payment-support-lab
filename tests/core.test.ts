import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { seed, execute, validate, AppError } from '../server/domain.js';
import { api } from '../server/api.js';
import { mutate, type Store, type Row } from '../server/store.js';
import type { Command, State } from '../src/types.js';
const rid = () => crypto.randomUUID();
const command = (s: State, c: Record<string, unknown>) =>
  execute(s, validate({ ...c, requestId: rid() }));
function database() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync('migrations/0001_sessions.sql', 'utf8'));
  const store: Store = {
    read: async (id) =>
      (db.prepare('SELECT * FROM demo_sessions WHERE id=?').get(id) as unknown as Row) || null,
    insert: async (id, r) => {
      db.prepare('INSERT OR IGNORE INTO demo_sessions VALUES (?,?,?,?,?)').run(
        id,
        r.state_json,
        r.version,
        r.csrf,
        r.updated_at,
      );
    },
    cas: async (id, v, s) =>
      db
        .prepare('UPDATE demo_sessions SET state_json=?,version=version+1 WHERE id=? AND version=?')
        .run(JSON.stringify(s), id, v).changes === 1,
  };
  return { db, store };
}
test('four scenarios have correct payment and order states', () => {
  for (const scenario of ['approved', 'declined', 'delayed', 'duplicate']) {
    const { state, result } = command(seed(), { type: 'simulate', scenario, amount: 12345 });
    const o = state.orders.find((o) => o.id === result.orderId)!;
    assert.equal(o.amount, 12345);
    assert.equal(
      o.status,
      scenario === 'declined' ? 'failed' : scenario === 'delayed' ? 'pending' : 'confirmed',
    );
    assert.equal(o.captures, scenario === 'declined' || scenario === 'delayed' ? 0 : 1);
    if (scenario === 'duplicate')
      assert.equal(
        state.deliveries.filter((d) => d.orderId === o.id && d.result === 'ignored').length,
        1,
      );
  }
});
test('delayed event recovers without another payment and 25 duplicates never repeat its effect', () => {
  let s = seed();
  const o = s.orders.find((o) => o.scenario === 'delayed')!;
  s = command(s, { type: 'retry', orderId: o.id }).state;
  for (let i = 0; i < 25; i++) s = command(s, { type: 'duplicate', orderId: o.id }).state;
  assert.equal(s.orders.find((x) => x.id === o.id)!.captures, 1);
  assert.equal(s.orders.find((x) => x.id === o.id)!.eventId, o.eventId);
  assert.equal(
    s.deliveries.filter((d) => d.orderId === o.id && d.result === 'processed').length,
    1,
  );
});
test('new payment after rejection preserves rejected event', () => {
  let s = seed();
  const o = s.orders.find((o) => o.scenario === 'declined')!;
  const old = o.eventId;
  s = command(s, { type: 'retry', orderId: o.id }).state;
  assert.notEqual(s.orders.find((x) => x.id === o.id)!.eventId, old);
  assert.equal(
    (s.deliveries.find((d) => d.eventId === old)!.payload.data as { status: string }).status,
    'declined',
  );
  assert.equal(s.orders.find((x) => x.id === o.id)!.captures, 1);
});
test('retry requests return the same result, including incident identifier', () => {
  let s = seed();
  const c = validate({
    type: 'incident',
    orderId: s.orders[0].id,
    title: 'Revisión de prueba',
    severity: 'low',
    requestId: rid(),
  });
  const first = execute(s, c);
  const second = execute(first.state, c);
  assert.deepEqual(second.result, first.result);
  assert.deepEqual(second.state, first.state);
});
test('incident resolution requires documentation and a nonpending order', () => {
  let s = seed();
  const i = s.incidents.find((i) => i.severity === 'high')!;
  assert.throws(
    () => command(s, { type: 'status', incidentId: i.id, status: 'resolved' }),
    AppError,
  );
  s = command(s, { type: 'note', incidentId: i.id, text: 'Se investigó el error 503.' }).state;
  assert.throws(
    () => command(s, { type: 'status', incidentId: i.id, status: 'resolved' }),
    AppError,
  );
  s = command(s, { type: 'retry', orderId: i.orderId }).state;
  s = command(s, { type: 'status', incidentId: i.id, status: 'resolved' }).state;
  assert.equal(s.incidents.find((x) => x.id === i.id)!.status, 'resolved');
  s = command(s, { type: 'status', incidentId: i.id, status: 'investigating' }).state;
  assert.equal(s.incidents.find((x) => x.id === i.id)!.status, 'investigating');
});
test('invalid money, actions and prototype names are handled safely', () => {
  for (const amount of [-1, 0, 1.2, Infinity, 100000001, '100'])
    assert.throws(
      () => validate({ type: 'simulate', scenario: 'approved', amount, requestId: rid() }),
      AppError,
    );
  assert.throws(() => validate({ type: 'delete', requestId: rid() }), AppError);
  for (const requestId of ['constructor', '__proto__']) {
    const c = validate({ type: 'simulate', scenario: 'approved', requestId });
    const first = execute(seed(), c);
    assert.equal(execute(first.state, c).state.orders.length, 13);
  }
});
test('API isolates sessions and checks CSRF, origin, JSON and persistence', async () => {
  const { db, store } = database();
  try {
    const a = await api(new Request('https://nexo.test/api/state'), store);
    const cookie = a.headers.get('set-cookie')!.split(';')[0];
    const body = (await a.json()) as { csrf: string; state: State };
    const b = await api(new Request('https://nexo.test/api/state'), store);
    assert.notEqual(cookie, b.headers.get('set-cookie')!.split(';')[0]);
    const send = (headers: Record<string, string>, payload: string) =>
      api(
        new Request('https://nexo.test/api/commands', {
          method: 'POST',
          headers: { cookie, 'content-type': 'application/json', ...headers },
          body: payload,
        }),
        store,
      );
    const c = JSON.stringify({ type: 'simulate', scenario: 'approved', requestId: rid() });
    assert.equal((await send({}, c)).status, 403);
    assert.equal(
      (await send({ 'x-csrf-token': body.csrf, origin: 'https://evil.test' }, c)).status,
      403,
    );
    assert.equal((await send({ 'x-csrf-token': body.csrf }, '{bad')).status, 400);
    assert.equal(
      (await send({ 'x-csrf-token': body.csrf, 'content-type': 'text/plain' }, c)).status,
      415,
    );
    assert.equal((await send({ 'x-csrf-token': body.csrf }, c)).status, 200);
    assert.equal((await send({ 'x-csrf-token': body.csrf }, c)).status, 200);
    const persisted = (await (
      await api(new Request('https://nexo.test/api/state', { headers: { cookie } }), store)
    ).json()) as { state: State };
    assert.equal(persisted.state.orders.length, 13);
    const other = (await (
      await api(
        new Request('https://nexo.test/api/state', {
          headers: { cookie: b.headers.get('set-cookie')!.split(';')[0] },
        }),
        store,
      )
    ).json()) as { state: State };
    assert.equal(other.state.orders.length, 12);
  } finally {
    db.close();
  }
});
test('concurrent writes use compare-and-swap and duplicate requests add only one order', async () => {
  const { db, store } = database();
  try {
    const response = await api(new Request('https://nexo.test/api/state'), store);
    const sid = response.headers.get('set-cookie')!.split(';')[0].split('=')[1];
    const c: Command = { type: 'simulate', scenario: 'duplicate', requestId: rid() };
    await Promise.all([
      mutate(store, sid, c),
      mutate(store, sid, c),
      mutate(store, sid, { type: 'simulate', scenario: 'approved', requestId: rid() }),
    ]);
    const s = JSON.parse((await store.read(sid))!.state_json) as State;
    assert.equal(s.orders.length, 14);
    assert.ok(s.orders.every((o) => o.captures <= 1));
  } finally {
    db.close();
  }
});
