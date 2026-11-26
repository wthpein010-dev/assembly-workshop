import { readSocial, sendSocial } from './social.js';

const pagesOrigin = 'https://wthpein010-dev.github.io';
const maxStateSize = 100 * 1024;
const maxAccounts = 500;
const maxPlayers = 60;
const maxMessages = 60;
const maxInvites = 100;
const presenceInterval = 40_000;
const presenceDuration = 5 * 60_000;
const inviteDuration = 10 * 60_000;
const encoder = new TextEncoder();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(value, headers, status = 200) {
  return Response.json(value, { status, headers });
}

function assertApi(condition, status, message) {
  if (!condition) throw new ApiError(status, message);
}

async function readBody(request, limit) {
  const reader = request.body?.getReader();
  assertApi(reader, 400, '请输入有效数据');
  const buffer = new Uint8Array(limit);
  let offset = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value.length > limit - offset) {
        await reader.cancel().catch(() => {});
        throw new ApiError(413, '数据大小超过限制');
      }
      buffer.set(value, offset);
      offset += value.length;
    }
    const result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, offset)));
    assertApi(result && typeof result === 'object' && !Array.isArray(result), 400, '请输入有效数据');
    return result;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, '请输入有效数据');
  } finally {
    reader.releaseLock();
  }
}

function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFKC')
    .replace(/\s+/gu, ' ')
    .replace(/[<>&\p{Cc}\p{Cf}]/gu, '')
    .trim();
}

function validatedState(state) {
  assertApi(state && typeof state === 'object' && !Array.isArray(state), 400, '请输入有效存档');
  const name = cleanText(state.profile?.name);
  assertApi(/^[\p{L}\p{N}·_-]{2,14}$/u.test(name), 400, '请输入 2 至 14 个字的工位昵称');
  state.profile.name = name;
  const serialized = JSON.stringify(state);
  assertApi(encoder.encode(serialized).length <= maxStateSize, 413, '存档大小超过 100 KB');
  return { name, serialized };
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashCode(code) {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(code)));
}

function savePayload(row) {
  return { id: row.id, rev: row.rev, state: JSON.parse(row.state) };
}

function query(db, sql, ...values) {
  return db.prepare(sql).bind(...values);
}

async function createAccount(db, request, headers) {
  const { state } = await readBody(request, maxStateSize + 1024);
  const { name, serialized } = validatedState(state);
  const id = crypto.randomUUID();
  const code = toHex(crypto.getRandomValues(new Uint8Array(24)));
  const result = await query(db, `
    INSERT INTO workshop_accounts (id, code_hash, name, rev, state, last_seen)
    SELECT ?, ?, ?, 1, ?, ? WHERE (SELECT count(*) FROM workshop_accounts) < ?
  `, id, await hashCode(code), name, serialized, Date.now(), maxAccounts).run();
  assertApi(result.meta.changes === 1, 429, '演示区账号名额已满');
  return json({ code, id, rev: 1, state }, headers, 201);
}

async function signedInAccount(db, request, includeState = false) {
  const match = request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{48})$/i);
  assertApi(match, 401, '请使用有效的存档码');
  const row = await query(db, `
    SELECT id, name, last_seen${includeState ? ', rev, state' : ''}
    FROM workshop_accounts WHERE code_hash = ?
  `, await hashCode(match[1].toLowerCase())).first();
  assertApi(row, 401, '该存档码无效');
  return row;
}

async function writeSave(db, request, account, headers) {
  const { rev, state } = await readBody(request, maxStateSize + 1024);
  assertApi(Number.isSafeInteger(rev) && rev > 0, 400, '存档版本无效');
  const { name, serialized } = validatedState(state);
  const result = await query(db, `
    UPDATE workshop_accounts
    SET name = ?, state = ?, rev = rev + 1, last_seen = ?
    WHERE id = ? AND rev = ?
  `, name, serialized, Date.now(), account.id, rev).run();
  if (result.meta.changes === 1) return json({ id: account.id, rev: rev + 1, state }, headers);
  const latest = await query(db, 'SELECT id, rev, state FROM workshop_accounts WHERE id = ?', account.id).first();
  return json({ ...savePayload(latest), error: '云存档已更新' }, headers, 409);
}

function currentRoom(world, id) {
  return world.rooms.find((room) => room.players.some((player) => player.id === id));
}

function publicPlayer({ id, name }) {
  return { id, name };
}

async function readWorld(db) {
  const row = await query(db, 'SELECT rev, state FROM workshop_world WHERE id = ?', 1).first();
  const world = row ? JSON.parse(row.state) : { rooms: [], invites: [], messages: [] };
  world.invites = world.invites.filter(({ expires }) => expires > Date.now());
  return { rev: row?.rev ?? 0, world };
}

async function worldPayload(db, world, account) {
  const { results: players } = await query(db, `
    SELECT id, name FROM workshop_accounts WHERE last_seen > ?
    ORDER BY last_seen DESC, id LIMIT ?
  `, Date.now() - presenceDuration, maxPlayers).all();
  const invites = world.invites
    .filter(({ to }) => to === account.id)
    .map(({ id, from, author }) => ({ id, from, author }));
  const shared = currentRoom(world, account.id);
  const room = shared ? { ...shared, actor: shared.step < 3 ? shared.players[shared.step % 2].id : null } : null;
  return { players, messages: world.messages, invites, room };
}

async function actInWorld(db, world, account, { action, target, text }) {
  const room = currentRoom(world, account.id);
  if (action === 'chat') {
    const message = cleanText(text);
    assertApi(message.length > 0 && [...message].length <= 160, 400, '请输入 1 至 160 个字的消息');
    world.messages.push({ id: crypto.randomUUID(), author: account.name, text: message });
    world.messages = world.messages.slice(-maxMessages);
    return true;
  }
  if (action === 'invite') {
    assertApi(typeof target === 'string' && target !== account.id, 400, '请选择其他玩家');
    assertApi(!room && !currentRoom(world, target), 409, '邀请双方需先退出当前小队');
    const player = await query(db, `
      SELECT id FROM workshop_accounts WHERE id = ? AND last_seen > ?
    `, target, Date.now() - presenceDuration).first();
    assertApi(player, 404, '该玩家已离线');
    if (world.invites.some(({ from, to }) => from === account.id && to === target)) return false;
    assertApi(world.invites.length < maxInvites, 429, '大厅邀请已满，请稍后再试');
    world.invites.push({
      id: crypto.randomUUID(), from: account.id, to: target, author: account.name,
      expires: Date.now() + inviteDuration,
    });
    return true;
  }
  if (action === 'accept' || action === 'decline') {
    const invite = world.invites.find(({ id, to }) => id === target && to === account.id);
    assertApi(invite, 404, '该邀请已失效');
    if (action === 'decline') {
      world.invites = world.invites.filter(({ id }) => id !== target);
      return true;
    }
    assertApi(!room && !currentRoom(world, invite.from), 409, '邀请双方需先退出当前小队');
    const inviter = await query(db, 'SELECT id, name FROM workshop_accounts WHERE id = ?', invite.from).first();
    assertApi(inviter, 404, '该玩家已离线');
    world.rooms.push({ id: crypto.randomUUID(), players: [publicPlayer(inviter), publicPlayer(account)], step: 0 });
    const members = new Set([invite.from, account.id]);
    world.invites = world.invites.filter(({ from, to }) => !members.has(from) && !members.has(to));
    return true;
  }
  if (action === 'step') {
    assertApi(room, 409, '请先加入小队');
    if (room.step >= 3) return false;
    assertApi(room.players[room.step % 2].id === account.id, 409, '请等待队友完成本步交接');
    assertApi(target === room.id + '/' + room.step, 409, '工位进度已变化，请确认当前步骤。');
    room.step += 1;
    return true;
  }
  if (action === 'leave') {
    if (!room) return false;
    world.rooms = world.rooms.filter(({ id }) => id !== room.id);
    return true;
  }
  throw new ApiError(400, '大厅操作无效');
}

async function writeWorld(db, account, action) {
  // Retrying the complete action against the latest world keeps invites and room membership atomic.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { rev, world } = await readWorld(db);
    if (!await actInWorld(db, world, account, action)) return world;
    const result = await query(db, `
      INSERT INTO workshop_world (id, rev, state) VALUES (1, 1, ?)
      ON CONFLICT(id) DO UPDATE SET rev = workshop_world.rev + 1, state = excluded.state
      WHERE workshop_world.rev = ?
    `, JSON.stringify(world), rev).run();
    if (result.meta.changes === 1) return world;
  }
  throw new ApiError(409, '大厅有其他更新，请重试');
}

async function touchPresence(db, account) {
  const now = Date.now();
  if (account.last_seen < now - presenceInterval) {
    await query(db, `
      UPDATE workshop_accounts SET last_seen = ? WHERE id = ? AND last_seen < ?
    `, now, account.id, now - presenceInterval).run();
  }
}

async function worldResponse(db, request, account, headers) {
  await touchPresence(db, account);
  const world = request.method === 'POST'
    ? await writeWorld(db, account, await readBody(request, 4096))
    : (await readWorld(db)).world;
  return json(await worldPayload(db, world, account), headers);
}

async function socialResponse(db, request, headers) {
  const posting = request.method === 'POST';
  const account = posting || request.headers.has('Authorization') ? await signedInAccount(db, request) : null;
  if (account) await touchPresence(db, account);
  if (!posting) return json(await readSocial(db, account?.id), headers);
  const action = await readBody(request, 4096);
  if (action.action === 'message') action.text = cleanText(action.text);
  const { body, status } = await sendSocial(db, account.id, action);
  return json(body, headers, status);
}

async function api(request, env, url) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  if (origin && origin !== url.origin && origin !== pagesOrigin) {
    return json({ error: '该网页来源不可用' }, headers, 403);
  }
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  if (request.method === 'OPTIONS') {
    headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    headers.set('Access-Control-Max-Age', '600');
    return new Response(null, { status: 204, headers });
  }
  try {
    const db = env.DB;
    if (url.pathname === '/api/accounts') {
      assertApi(request.method === 'POST', 405, '请求方式不支持');
      return await createAccount(db, request, headers);
    }
    if (url.pathname === '/api/save') {
      assertApi(['GET', 'PUT'].includes(request.method), 405, '请求方式不支持');
      const read = request.method === 'GET';
      const account = await signedInAccount(db, request, read);
      return read ? json(savePayload(account), headers) : await writeSave(db, request, account, headers);
    }
    if (url.pathname === '/api/world') {
      assertApi(['GET', 'POST'].includes(request.method), 405, '请求方式不支持');
      return await worldResponse(db, request, await signedInAccount(db, request), headers);
    }
    if (url.pathname === '/api/social') {
      assertApi(['GET', 'POST'].includes(request.method), 405, '请求方式不支持');
      const session = db.withSession?.('first-primary') ?? db;
      return await socialResponse(session, request, headers);
    }
    return json({ error: '接口不存在' }, headers, 404);
  } catch (error) {
    if (error instanceof ApiError) return json({ error: error.message }, headers, error.status);
    return json({ error: '服务暂时不可用，请稍后再试' }, headers, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  },
};
