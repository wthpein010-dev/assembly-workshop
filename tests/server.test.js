import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../worker/index.js';

const appOrigin = 'https://workshop.example';
const pagesOrigin = 'https://wthpein010-dev.github.io';
const schema = new URL('../drizzle/0000_workshop.sql', import.meta.url);

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(schema, 'utf8'));
  const DB = {
    prepare(sql) {
      const statement = db.prepare(sql);
      return {
        bind(...values) {
          return {
            async first() { return statement.get(...values) ?? null; },
            async all() { return { results: statement.all(...values) }; },
            async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
          };
        },
      };
    },
  };
  async function request(path, { method = 'GET', code, data, origin } = {}) {
    const headers = new Headers();
    if (code) headers.set('Authorization', `Bearer ${code}`);
    if (origin) headers.set('Origin', origin);
    if (data) headers.set('Content-Type', 'application/json');
    const response = await worker.fetch(new Request(appOrigin + path, {
      method, headers, body: data ? JSON.stringify(data) : undefined,
    }), { DB });
    const body = response.headers.get('content-type')?.includes('application/json') ? await response.json() : null;
    return { status: response.status, body, headers: response.headers };
  }
  async function account(name) {
    const { status, body } = await request('/api/accounts', {
      method: 'POST', data: { state: { profile: { name }, coins: 20 } },
    });
    assert.equal(status, 201);
    return body;
  }
  function world(player, data) {
    return request('/api/world', { code: player.code, method: data ? 'POST' : 'GET', data });
  }
  return { db, request, account, world };
}

test('a second client can load the save using only its account code', async (t) => {
  const { db, request, account } = fixture(t);
  const created = await account('  装配员一  ');
  assert.match(created.code, /^[a-f0-9]{48}$/);
  const stored = db.prepare('SELECT code_hash, state FROM workshop_accounts').get();
  assert.notEqual(stored.code_hash, created.code);
  assert.equal(stored.state.includes(created.code), false);
  assert.equal((await request('/api/save')).status, 401);

  const result = await request('/api/save', { code: created.code });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    id: created.id, rev: 1, state: { profile: { name: '装配员一' }, coins: 20 },
  });
});

test('two writes against one save revision produce one success and one recoverable conflict', async (t) => {
  const { request, account } = fixture(t);
  const created = await account('质检员一');
  const update = (coins) => request('/api/save', {
    code: created.code, method: 'PUT',
    data: { rev: created.rev, state: { profile: { name: '质检员一' }, coins } },
  });
  const results = await Promise.all([update(37), update(60)]);
  const success = results.find((result) => result.status === 200);
  const conflict = results.find((result) => result.status === 409);
  assert.equal(success?.body.rev, 2);
  assert.equal(conflict?.body.rev, 2);
  assert.equal(conflict.body.state.coins, success.body.state.coins);
  assert.equal(typeof conflict.body.error, 'string');
  assert.equal((await request('/api/save', { code: created.code })).body.state.coins, success.body.state.coins);
});

test('invalid profile names and oversized demo states are rejected', async (t) => {
  const { request } = fixture(t);
  const create = (state) => request('/api/accounts', { method: 'POST', data: { state } });
  assert.equal((await create({ profile: { name: '  ' } })).status, 400);
  assert.equal((await create({ profile: { name: '一' } })).status, 400);
  assert.equal((await create({ profile: { name: '工位·甲'.repeat(4) } })).status, 400);
  assert.equal((await create({ profile: { name: '质检' }, notes: '自检'.repeat(20_000) })).status, 413);
});

test('lobby chat is visible to another client with the server-selected author', async (t) => {
  const { account, world } = fixture(t);
  const first = await account('班组甲');
  const second = await account('班组乙');
  assert.equal((await world(first, { action: 'chat', text: '  工位已复核  ', author: '他人' })).status, 200);
  const lobby = (await world(second)).body;
  assert.ok(lobby.players.some(({ id, name }) => id === first.id && name === '班组甲'));
  assert.deepEqual(lobby.messages.map(({ author, text }) => [author, text]), [['班组甲', '工位已复核']]);
});

test('only the invite recipient can accept and the room keeps all three ordered handoffs', async (t) => {
  const { account, world } = fixture(t);
  const first = await account('装配甲');
  const second = await account('装配乙');
  const third = await account('装配丙');
  assert.equal((await world(first, { action: 'invite', target: second.id })).status, 200);
  const [invite] = (await world(second)).body.invites;
  assert.equal(invite.from, first.id);
  assert.equal((await world(third, { action: 'accept', target: invite.id })).status, 404);
  const accepted = (await world(second, { action: 'accept', target: invite.id })).body.room;
  assert.equal(accepted.step, 0);
  assert.equal(accepted.actor, first.id);
  const handoff = (player, step) => world(player, { action: 'step', target: accepted.id + '/' + step });
  assert.equal((await handoff(second, 0)).status, 409);
  assert.equal((await handoff(first, 0)).body.room.step, 1);
  assert.equal((await handoff(first, 1)).status, 409);
  assert.equal((await handoff(second, 1)).body.room.step, 2);
  assert.equal((await handoff(first, 0)).status, 409);
  assert.equal((await world(first)).body.room.step, 2);
  assert.equal((await handoff(first, 2)).body.room.step, 3);
  const completed = (await world(second)).body.room;
  assert.equal(completed.step, 3);
  assert.equal(completed.actor, null);
  assert.equal((await world(first, { action: 'leave' })).body.room, null);
  assert.equal((await world(second)).body.room, null);
});

test('simultaneous accepts cannot give one user two rooms', async (t) => {
  const { account, world } = fixture(t);
  const first = await account('装配甲');
  const second = await account('装配乙');
  const third = await account('装配丙');
  await world(first, { action: 'invite', target: third.id });
  await world(second, { action: 'invite', target: third.id });
  const invites = (await world(third)).body.invites;
  assert.equal(invites.length, 2);
  const results = await Promise.all(invites.map(({ id }) => world(third, { action: 'accept', target: id })));
  assert.equal(results.filter(({ status }) => status === 200).length, 1);
  assert.equal((await world(third)).body.room.players.length, 2);
});

test('API CORS allows GitHub Pages and rejects other web origins', async (t) => {
  const { request } = fixture(t);
  const preflight = await request('/api/save', { method: 'OPTIONS', origin: pagesOrigin });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), pagesOrigin);
  const rejected = await request('/api/accounts', {
    method: 'POST', origin: 'https://other.example', data: { state: { profile: { name: '装配' } } },
  });
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.get('access-control-allow-origin'), null);
});
