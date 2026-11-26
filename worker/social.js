import { SOCIAL_GIFTS } from '../social-gifts.js';

const feedLimit = 60;
const playerLimit = 60;
const rankingLimit = 24;
const inboxLimit = 40;
const minute = 60_000;
const activeFor = 5 * minute;
const recentFor = 7 * 24 * 60 * minute;
const messageRate = 8;
const giftRate = 6;
const requestPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/;
const accountPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const maxInteger = Number.MAX_SAFE_INTEGER;

function query(db, sql, ...params) {
  return db.prepare(sql).bind(...params);
}

function avatarSql(alias) {
  const numeric = (key, last) => `CASE
    WHEN json_type(${alias}.state, '$.profile.${key}') = 'integer'
      AND json_extract(${alias}.state, '$.profile.${key}') BETWEEN 0 AND ${last}
    THEN json_extract(${alias}.state, '$.profile.${key}')
    ELSE 0 END`;
  return `json_object(
    'gender', CASE json_extract(${alias}.state, '$.profile.gender') WHEN 'male' THEN 'male' ELSE 'female' END,
    'face', ${numeric('face', 3)},
    'hair', ${numeric('hair', 2)},
    'tone', ${numeric('tone', 2)},
    'group', ${numeric('group', 2)}
  )`;
}

function player(row) {
  return { id: row.id, name: row.name, profile: JSON.parse(row.profile) };
}

function event(row) {
  const base = {
    id: row.id, type: row.type, at: row.at,
    from: player({ id: row.from_id, name: row.from_name, profile: row.from_profile }),
  };
  if (row.type === 'message') return { ...base, text: row.text };
  return {
    ...base, to: player({ id: row.to_id, name: row.to_name, profile: row.to_profile }),
    giftId: row.gift_id, featured: row.featured === 1,
  };
}

const eventColumns = `
  e.id, e.type, e.at, e.from_id, e.to_id, e.text, e.gift_id, e.featured,
  sender.name AS from_name, ${avatarSql('sender')} AS from_profile,
  receiver.name AS to_name, ${avatarSql('receiver')} AS to_profile
`;
const eventTables = `workshop_social_events e
  JOIN workshop_accounts sender ON sender.id = e.from_id
  LEFT JOIN workshop_accounts receiver ON receiver.id = e.to_id`;

async function events(db, where, params, limit) {
  const { results } = await query(db,
    `SELECT ${eventColumns} FROM ${eventTables} ${where} ORDER BY e.at DESC, e.seq DESC LIMIT ?`, ...params, limit).all();
  return results.map(event);
}

async function ranking(db, mode) {
  const idColumn = mode === 'sent' ? 'from_id' : 'to_id';
  const amount = mode === 'featured' ? 'count(*)' : 'sum(gift_cost)';
  const premium = mode === 'featured' ? 'AND featured = 1' : '';
  const { results } = await query(db, `
    SELECT a.id, a.name, ${avatarSql('a')} AS profile, totals.score
    FROM (
      SELECT ${idColumn} AS player_id, ${amount} AS score
      FROM workshop_social_events WHERE type = 'gift' ${premium}
      GROUP BY ${idColumn}
    ) totals
    JOIN workshop_accounts a ON a.id = totals.player_id
    ORDER BY totals.score DESC, a.id ASC LIMIT ?
  `, rankingLimit).all();
  return results.map((row) => ({ ...player(row), score: row.score }));
}

async function findPlayer(db, id) {
  const row = await query(db, `
    SELECT a.id, a.name, ${avatarSql('a')} AS profile FROM workshop_accounts a WHERE a.id = ?
  `, id).first();
  return row ? player(row) : null;
}

async function activePlayers(db, ownId) {
  const now = Date.now();
  const { results } = await query(db, `
    SELECT a.id, a.name, ${avatarSql('a')} AS profile
    FROM workshop_accounts a
    LEFT JOIN (
      SELECT to_id, max(at) AS recent_gift FROM workshop_social_events
      WHERE type = 'gift' AND at > ? GROUP BY to_id
    ) g ON g.to_id = a.id
    WHERE a.id <> ? AND (a.last_seen > ? OR g.recent_gift IS NOT NULL)
    ORDER BY (a.last_seen > ?) DESC, max(a.last_seen, coalesce(g.recent_gift, 0)) DESC, a.id LIMIT ?
  `, now - recentFor, ownId, now - activeFor, now - activeFor, playerLimit).all();
  return results.map(player);
}

export async function readSocial(db, accountId = null) {
  const [feed, premium, received, sent, featured, me, players, inbox] = await Promise.all([
    events(db, '', [], feedLimit),
    events(db, "WHERE e.type = 'gift' AND e.featured = 1", [], 1),
    ranking(db, 'received'), ranking(db, 'sent'), ranking(db, 'featured'),
    accountId ? findPlayer(db, accountId) : null,
    accountId ? activePlayers(db, accountId) : [],
    accountId ? events(db, "WHERE e.type = 'gift' AND e.to_id = ?", [accountId], inboxLimit) : [],
  ]);
  return { feed: feed.reverse(), me, players, featured: premium[0] ?? null, inbox, leaderboards: { received, sent, featured } };
}

function fail(status, error, save) {
  return { status, body: save ? { error, save } : { error } };
}

async function currentSave(db, id) {
  const { rev, state } = await query(db, 'SELECT rev, state FROM workshop_accounts WHERE id = ?', id).first();
  return { id, rev, state: JSON.parse(state) };
}

async function priorRequest(db, ownId, requestId) {
  return query(db, `
    SELECT id, type, text, gift_id, to_id FROM workshop_social_events WHERE from_id = ? AND request_id = ?
  `, ownId, requestId).first();
}

function matches(prior, command) {
  return prior.type === command.action && (command.action === 'message'
    ? prior.text === command.text : prior.gift_id === command.giftId && prior.to_id === command.target);
}

async function result(db, ownId, event, replayed) {
  const [snapshot, save] = await Promise.all([readSocial(db, ownId), currentSave(db, ownId)]);
  return { status: 200, body: { ...snapshot, eventId: event.id, replayed, save } };
}

async function insertMessage(db, ownId, command, id, now) {
  await query(db, `
    INSERT INTO workshop_social_events (id, type, at, from_id, request_id, text)
    SELECT ?, 'message', ?, ?, ?, ?
    WHERE (SELECT count(*) FROM workshop_social_events
           WHERE from_id = ? AND type = 'message' AND at > ?) < ?
    ON CONFLICT(from_id, request_id) DO NOTHING
  `, id, now, ownId, command.requestId, command.text, ownId, now - minute, messageRate).run();
}

async function insertGift(db, ownId, command, gift, revision, id, now) {
  // The AFTER INSERT trigger debits this exact revision in the same SQLite statement.
  await query(db, `
    INSERT INTO workshop_social_events (id, type, at, from_id, to_id, request_id, gift_id, gift_cost, featured, save_rev)
    SELECT ?, 'gift', ?, a.id, recipient.id, ?, ?, ?, ?, a.rev
    FROM workshop_accounts a
    JOIN workshop_accounts recipient ON recipient.id = ?
    WHERE a.id = ? AND a.id <> recipient.id AND (? IS NULL OR a.rev = ?)
      AND a.rev < ?
      AND json_type(a.state, '$.coins') = 'integer'
      AND json_extract(a.state, '$.coins') BETWEEN ? AND ?
      AND (SELECT count(*) FROM workshop_social_events
           WHERE from_id = a.id AND type = 'gift' AND at > ?) < ?
    ON CONFLICT(from_id, request_id) DO NOTHING
  `, id, now, command.requestId, gift.id, gift.cost, Number(gift.featured),
  command.target, ownId, revision, revision, maxInteger, gift.cost, maxInteger, now - minute, giftRate).run();
}

export async function sendSocial(db, ownId, command) {
  const { action, requestId } = command;
  if (typeof requestId !== 'string' || !requestPattern.test(requestId)) return fail(400, '请求编号无效');
  if (action !== 'message' && action !== 'gift') return fail(400, '工友频道操作无效');
  if (action === 'message' && (typeof command.text !== 'string' || !command.text || [...command.text].length > 160)) {
    return fail(400, '请输入 1 至 160 个字的消息');
  }
  const revision = command.revision ?? command.rev ?? null;
  if (action === 'gift' && revision !== null && (!Number.isSafeInteger(revision) || revision < 1)) {
    return fail(400, '存档版本无效');
  }

  const prior = await priorRequest(db, ownId, requestId);
  if (prior) return matches(prior, command) ? result(db, ownId, prior, true) : fail(409, '该请求编号已使用');

  const id = crypto.randomUUID();
  const now = Date.now();
  if (action === 'message') {
    await insertMessage(db, ownId, command, id, now);
  } else {
    if (typeof command.target !== 'string' || !accountPattern.test(command.target) || command.target === ownId) {
      return fail(400, '请选择其他工友');
    }
    const gift = typeof command.giftId === 'string' && Object.hasOwn(SOCIAL_GIFTS, command.giftId)
      ? SOCIAL_GIFTS[command.giftId] : null;
    if (!gift) return fail(400, '请选择有效的礼物');
    const recipient = await query(db, 'SELECT id FROM workshop_accounts WHERE id = ?', command.target).first();
    if (!recipient) return fail(404, '找不到这位工友');
    await insertGift(db, ownId, command, gift, revision, id, now);
  }

  const stored = await priorRequest(db, ownId, requestId);
  if (stored) return matches(stored, command) ? result(db, ownId, stored, stored.id !== id) : fail(409, '该请求编号已使用');
  if (action === 'gift') {
    const save = await currentSave(db, ownId);
    if (revision !== null && save.rev !== revision) return fail(409, '云存档已更新，请核对积分后重试', save);
    const { coins } = save.state;
    if (!Number.isSafeInteger(coins) || coins < SOCIAL_GIFTS[command.giftId].cost) return fail(409, '积分不足', save);
  }
  return fail(429, '操作太频繁，请稍后再试');
}
