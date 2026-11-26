import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import worker from '../worker/index.js';
import { SOCIAL_GIFTS } from '../social-gifts.js';

const app = 'https://workshop.example';
const pages = 'https://wthpein010-dev.github.io';

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(readFileSync(new URL('../drizzle/0000_workshop.sql', import.meta.url), 'utf8'));
  db.exec(readFileSync(new URL('../drizzle/0001_social.sql', import.meta.url), 'utf8'));
  const DB = {
    prepare(sql) {
      const stmt = db.prepare(sql);
      return { bind: (...values) => ({
        first: async () => stmt.get(...values) ?? null,
        all: async () => ({ results: stmt.all(...values) }),
        run: async () => ({ meta: { changes: Number(stmt.run(...values).changes) } }),
      }) };
    },
  };
  function raw(path, { code, method = 'GET', data, origin, headers = {} } = {}) {
    return worker.fetch(new Request(app + path, {
      method,
      headers: { ...headers, ...(code ? { Authorization: 'Bearer ' + code } : {}), ...(origin ? { Origin: origin } : {}) },
      body: data ? JSON.stringify(data) : undefined,
    }), { DB });
  }
  async function call(path, options) {
    const response = await raw(path, options);
    const body = response.status === 204 ? null : await response.json();
    return { status: response.status, headers: response.headers, body };
  }
  async function account(name, coins = 240, fields = {}) {
    const { status, body } = await call('/api/accounts', {
      method: 'POST', data: { state: { profile: { name, ...fields }, coins, privateExample: 'not public' } },
    });
    assert.equal(status, 201);
    return body;
  }
  function social(user, action) {
    return call('/api/social', { code: user?.code, method: action ? 'POST' : 'GET', data: action });
  }
  return { account, call, raw, social, db };
}

test('social guests see only public records and cannot post; CORS uses the account API allowlist', async (t) => {
  const { account, call, social } = fixture(t);
  const sender = await account('记录工友', 240, { gender: 'male', face: 3, hair: 2, tone: 1, group: 2, hidden: 'not public' });
  await account('第二名工友');
  const intro = { action: 'message', requestId: 'intro', text: '这是真人消息', from: { name: '伪造名字' } };
  assert.equal((await social(null, intro)).status, 401);
  assert.equal((await social(sender, intro)).status, 200);
  const { status, body, headers } = await call('/api/social', { origin: pages });
  assert.equal(status, 200);
  assert.equal(headers.get('Access-Control-Allow-Origin'), pages);
  assert.equal(body.me, null);
  assert.deepEqual(body.players, []);
  assert.deepEqual(body.inbox, []);
  assert.equal(body.feed[0].text, '这是真人消息');
  assert.deepEqual(body.feed[0].from, {
    id: sender.id, name: '记录工友', profile: { gender: 'male', face: 3, hair: 2, tone: 1, group: 2 },
  });
  assert.equal(JSON.stringify(body).includes('not public'), false);
  assert.equal((await call('/api/social', { origin: 'https://other.example' })).status, 403);
  assert.equal((await call('/api/social', { code: '00'.repeat(24) })).status, 401);
  const auth = await social(sender);
  assert.equal(auth.body.me.id, sender.id);
  assert.equal(auth.body.players.length, 1);
  assert.equal(auth.body.save, undefined);
});

// Two small, 144 × 144 WebP image fixtures.
const blueAvatar = 'data:image/webp;base64,UklGRmwAAABXRUJQVlA4IGAAAACQBwCdASqQAJAAPm02mUmkIqKhIGgAgA2JaW7hdUlwAAEDjVUmyYh1VJsmIdVSbJiHVUmyYh1VJsmIdVSbJiHVUmyYhvAA/v7ge//xbFIbmf+G1Vk1xSOhNMQgAAAAAAA=';
const orangeAvatar = 'data:image/webp;base64,UklGRmoAAABXRUJQVlA4IF4AAADQBwCdASqQAJAAPm02mUmkIyKhIGgAgA2JaW7hd1lwH4AAAO6HVUmyYh1VJsmIdVSbJiHVUmyYh1VJsmIdVSbJiHVUmyYgwADt//8wSvyDdqH//z0zXmD/CwAAAAAA';

test('an authenticated save publishes only a cacheable photo-avatar reference to social', async (t) => {
  const { account, call, raw, social } = fixture(t);
  const sender = await account('带头像工友', 240, { avatar: { kind: 'photo', data: blueAvatar } });
  assert.equal((await social(sender, { action: 'message', requestId: 'picture-intro', text: '刚完成报到' })).status, 200);
  const publicBoard = (await social(null)).body;
  const avatar = publicBoard.feed[0].from.profile.avatar;
  assert.equal(avatar.kind, 'remote');
  assert.equal(avatar.id, sender.id);
  assert.match(avatar.version, /^[a-f0-9]{32}$/);
  assert.equal(JSON.stringify(publicBoard).includes('data:image'), false);
  assert.equal(JSON.stringify(publicBoard).includes('privateExample'), false);

  const path = '/api/avatars/' + sender.id;
  const image = await raw(path + '?v=' + avatar.version, { origin: pages });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get('Content-Type'), 'image/webp');
  assert.equal(image.headers.get('Access-Control-Allow-Origin'), pages);
  assert.equal(image.headers.get('X-Content-Type-Options'), 'nosniff');
  assert.match(image.headers.get('Cache-Control'), /max-age=\d+/);
  assert.equal(Buffer.from(await image.arrayBuffer()).toString('base64'), blueAvatar.split(',')[1]);
  assert.equal((await raw(path, { origin: 'https://outside.example' })).status, 403);
  const head = await raw(path, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
  const unchanged = await raw(path, { headers: { 'If-None-Match': image.headers.get('ETag') } });
  assert.equal(unchanged.status, 304);

  const save = (previous, photo, coins) => call('/api/save', {
    method: 'PUT', code: sender.code, data: { rev: previous.rev, state: {
      ...previous.state, coins, profile: { ...previous.state.profile, avatar: photo ? { kind: 'photo', data: photo } : null },
    } },
  });
  const earned = await save(sender, blueAvatar, 260);
  assert.equal(earned.status, 200);
  assert.equal((await social(null)).body.feed[0].from.profile.avatar.version, avatar.version);

  const replaced = await save(earned.body, orangeAvatar, 260);
  assert.equal(replaced.status, 200);
  const refresh = (await social(null)).body.feed[0].from.profile.avatar;
  assert.notEqual(refresh.version, avatar.version);
  assert.equal((await raw(path + '?v=' + avatar.version)).status, 404);
  const current = await call('/api/save', { code: sender.code });
  assert.equal(current.body.state.profile.avatar.data, orangeAvatar);

  assert.equal((await save(replaced.body, null, 260)).status, 200);
  assert.equal((await social(null)).body.feed[0].from.profile.avatar, undefined);
  assert.equal((await raw(path)).status, 404);
});

test('account writes reject invalid avatar types, mislabeled data, and unknown preset IDs', async (t) => {
  const { call, raw } = fixture(t);
  for (const avatar of [
    { kind: 'remote', id: 'somebody-else' },
    { kind: 'preset', id: 'no-such-avatar' },
    { kind: 'photo', data: blueAvatar.replace('image/webp', 'image/jpeg') },
    { kind: 'photo', data: 'data:image/svg+xml;base64,PHN2Zz4=' },
  ]) {
    assert.equal((await call('/api/accounts', {
      method: 'POST', data: { state: { profile: { name: '头像测试', avatar }, coins: 240 } },
    })).status, 400);
  }
  assert.equal((await raw('/api/avatars/not-an-id')).status, 404);
});

test('preset avatar choices appear on rankings and replacing them keeps prior gift records', async (t) => {
  const { account, call, raw, social } = fixture(t);
  const avatar = { kind: 'preset', id: 'crew-1' };
  const recipient = await account('换装工友', 240, { avatar });
  const sender = await account('献礼工友');
  assert.equal((await social(sender, order(recipient, 'preset-gift', sender.rev))).status, 200);
  const board = (await social(null)).body;
  assert.deepEqual(board.leaderboards.received[0].profile.avatar, avatar);
  assert.deepEqual(board.feed[0].to.profile.avatar, avatar);
  assert.equal((await raw('/api/avatars/' + recipient.id)).status, 404);
  const updated = await call('/api/save', { method: 'PUT', code: recipient.code, data: {
    rev: recipient.rev,
    state: { ...recipient.state, profile: { ...recipient.state.profile, avatar: { kind: 'preset', id: 'crew-2' } } },
  } });
  assert.equal(updated.status, 200);
  const after = (await social(null)).body;
  assert.equal(after.feed[0].id, board.feed[0].id);
  assert.equal(after.leaderboards.received[0].profile.avatar.id, 'crew-2');
});

test('the online lobby resolves avatar references for present players and chat authors after they leave', async (t) => {
  const { account, call, db } = fixture(t);
  const author = await account('发言工友', 240, { avatar: { kind: 'photo', data: blueAvatar } });
  const reader = await account('阅读工友');
  assert.equal((await call('/api/world', { code: author.code, method: 'POST', data: {
    action: 'chat', text: '完成一单', authorId: reader.id,
  } })).status, 200);
  const getLobby = async () => (await call('/api/world', { code: reader.code })).body;
  const first = await getLobby();
  const playerAvatar = first.players.find(({ id }) => id === author.id).profile.avatar;
  assert.equal(playerAvatar.kind, 'remote');
  assert.deepEqual(first.messages[0].profile.avatar, playerAvatar);
  assert.equal(first.messages[0].text, '完成一单');
  assert.equal(JSON.stringify(first).includes('data:image'), false);

  const dbWorld = JSON.parse(db.prepare('SELECT state FROM workshop_world WHERE id = 1').get().state);
  const legacy = { id: 'legacy', author: '老工友', text: '交班完成' };
  dbWorld.messages.unshift(legacy);
  db.prepare('UPDATE workshop_world SET state = ? WHERE id = 1').run(JSON.stringify(dbWorld));
  db.prepare('UPDATE workshop_accounts SET last_seen = 0 WHERE id = ?').run(author.id);
  const offline = await getLobby();
  assert.equal(offline.players.some(({ id }) => id === author.id), false);
  assert.deepEqual(offline.messages[0], legacy);
  assert.deepEqual(offline.messages[1].profile.avatar, playerAvatar);
});

test('social messages reject oversized inputs and rate-limit distinct sends without counting a retry', async (t) => {
  const { account, social } = fixture(t);
  const sender = await account('交班工友');
  const message = (n, text = '交班记录 ' + n) => ({ action: 'message', requestId: 'msg-' + n, text });
  assert.equal((await social(sender, message(0, '字'.repeat(161)))).status, 400);
  assert.equal((await social(sender, message(0, '<>&'))).status, 400);
  for (let i = 1; i <= 8; i++) assert.equal((await social(sender, message(i))).status, 200);
  assert.equal((await social(sender, message(9))).status, 429);
  const replay = await social(sender, message(1));
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.feed.length, 8);
  assert.equal((await social(sender, message(1, '换掉内容'))).status, 409);
});

test('feed rows are chronological even when concurrent writes are inserted out of timestamp order', async (t) => {
  const { account, db, social } = fixture(t);
  const sender = await account('装配工友');
  await social(sender, { action: 'message', requestId: 'later', text: '时间较晚' });
  await social(sender, { action: 'message', requestId: 'earlier', text: '时间较早' });
  db.prepare('UPDATE workshop_social_events SET at = at - 1000 WHERE request_id = ?').run('earlier');
  const feed = (await social(null)).body.feed;
  assert.deepEqual(feed.map((entry) => entry.text), ['时间较早', '时间较晚']);
});

const premium = Object.values(SOCIAL_GIFTS).find((gift) => gift.featured);
const regular = Object.values(SOCIAL_GIFTS).find((gift) => !gift.featured);
const order = (target, requestId, revision, gift = regular) =>
  ({ action: 'gift', target: target.id, giftId: gift.id, requestId, revision });

test('parallel duplicate gift requests atomically debit once and expose one weighted entry and one private inbox record', async (t) => {
  const { account, call, social } = fixture(t);
  const total = premium.cost + regular.cost + 80;
  const sender = await account('送礼工友', total);
  const receiver = await account('收礼工友', 5, { gender: 'invalid', face: [3], hair: 9, tone: -2, group: 1, private: 'not public' });
  const unrelated = await account('旁观工友');
  const payload = { ...order(receiver, 'same-gift', sender.rev, premium), cost: 0, featured: false, from: unrelated.id };
  const results = await Promise.all([social(sender, payload), social(sender, payload)]);
  assert.deepEqual(results.map((result) => result.status), [200, 200]);
  assert.deepEqual(results.map(({ body }) => body.replayed).sort(), [false, true]);
  assert.equal(results[0].body.eventId, results[1].body.eventId);
  assert.equal(results[0].body.save.rev, sender.rev + 1);
  assert.equal(results[0].body.save.state.coins, total - premium.cost);
  assert.deepEqual(results[0].body.inbox, []);
  assert.equal((await social(sender, { ...payload, target: unrelated.id })).status, 409);

  const second = await social(sender, order(receiver, 'next-gift', sender.rev + 1));
  assert.equal(second.status, 200);
  assert.equal(second.body.save.state.coins, total - premium.cost - regular.cost);
  assert.equal(second.body.save.rev, sender.rev + 2);
  const publicView = (await social(null)).body;
  assert.equal(publicView.feed.length, 2);
  assert.equal(publicView.feed[0].id, results[0].body.eventId);
  assert.equal(publicView.feed[0].from.id, sender.id);
  assert.equal(publicView.feed[0].featured, true);
  assert.equal(publicView.featured.id, results[0].body.eventId);
  assert.equal(publicView.leaderboards.received[0].score, premium.cost + regular.cost);
  assert.equal(publicView.leaderboards.sent[0].score, premium.cost + regular.cost);
  assert.equal(publicView.leaderboards.featured[0].score, 1);
  assert.deepEqual(publicView.feed[0].to.profile, { gender: 'female', face: 0, hair: 0, tone: 0, group: 1 });
  assert.deepEqual(publicView.inbox, []);
  assert.deepEqual((await social(unrelated)).body.inbox, []);
  assert.deepEqual((await social(receiver)).body.inbox.map(({ giftId }) => giftId), [regular.id, premium.id]);
  const latestReceiver = await call('/api/save', { code: receiver.code });
  assert.equal(latestReceiver.body.rev, receiver.rev);
  assert.equal(latestReceiver.body.state.coins, 5);
});

test('a concurrent earning save and gift serialize on the same revision without erasing either operation', async (t) => {
  const { account, call, social } = fixture(t);
  const sender = await account('并发工友', regular.cost + 30);
  const receiver = await account('收件工友');
  const gift = order(receiver, 'race', sender.rev);
  const earn = (rev, state) => call('/api/save', {
    method: 'PUT', code: sender.code, data: { rev, state: { ...state, coins: state.coins + 50 } },
  });
  const [firstGift, firstSave] = await Promise.all([social(sender, gift), earn(sender.rev, sender.state)]);
  assert.deepEqual([firstGift.status, firstSave.status].sort(), [200, 409]);
  const updated = await call('/api/save', { code: sender.code });
  if (firstGift.status === 409) {
    assert.equal(firstGift.body.save.rev, updated.body.rev);
    assert.equal(firstGift.body.save.state.coins, sender.state.coins + 50);
    assert.equal((await social(sender, { ...gift, revision: updated.body.rev })).status, 200);
  } else {
    assert.equal(updated.body.state.coins, sender.state.coins - regular.cost);
    assert.equal((await earn(updated.body.rev, updated.body.state)).status, 200);
  }
  const replay = await social(sender, gift);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.replayed, true);
  assert.equal(replay.body.save.rev, sender.rev + 2);
  assert.equal(replay.body.save.state.coins, 80);
  assert.equal(replay.body.feed.filter(({ type }) => type === 'gift').length, 1);
});

test('unaffordable and invalid gifts leave no event, and a debit failure rolls back the event', async (t) => {
  const { account, call, db, social } = fixture(t);
  const sender = await account('余额工友', regular.cost);
  const recipient = await account('新收件人');
  assert.equal((await social(sender, order(sender, 'self', sender.rev))).status, 400);
  assert.equal((await social(sender, { ...order(recipient, 'fake', sender.rev), giftId: 'nonexistent' })).status, 400);
  db.exec(`CREATE TRIGGER test_reject_debit BEFORE UPDATE OF rev ON workshop_accounts
    BEGIN SELECT RAISE(ABORT, 'fixture rolls back debit'); END;`);
  const failed = await social(sender, order(recipient, 'retryable', sender.rev));
  assert.equal(failed.status, 500);
  assert.deepEqual((await social(null)).body.feed, []);
  assert.equal((await call('/api/save', { code: sender.code })).body.state.coins, regular.cost);
  db.exec('DROP TRIGGER test_reject_debit');
  assert.equal((await social(sender, order(recipient, 'retryable', sender.rev))).status, 200);
  const tooExpensive = await social(sender, order(recipient, 'empty', undefined));
  assert.equal(tooExpensive.status, 409);
  assert.equal(tooExpensive.body.save.state.coins, 0);
  assert.equal(tooExpensive.body.save.rev, sender.rev + 1);
  assert.equal((await social(null)).body.feed.length, 1);
});
