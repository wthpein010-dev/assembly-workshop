import { CLOUD_ORIGIN } from './config.js';
import { SOCIAL_GIFTS } from './social-gifts.js';

const metaKey = 'assembly-workshop.cloud.v1';
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/)/.test(location.href);
const apiOrigin = local ? location.origin : CLOUD_ORIGIN;
const endpoint = path => apiOrigin + '/api/' + path;

async function request(path, code, method = 'GET', body) {
  const response = await fetch(endpoint(path), {
    method, headers: {
      ...(code ? { Authorization: 'Bearer ' + code } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || '服务暂未连接，请稍后再试。');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function cachedMeta() {
  try {
    const item = JSON.parse(localStorage.getItem(metaKey));
    return item?.code ? item : null;
  } catch { return null; }
}

export function makeCloud({ current, restore, applyGiftBalance, signal }) {
  let meta = cachedMeta();
  let status = meta ? 'connecting' : 'local';
  let timer;
  let flushing;
  let trading = false;
  let conflict = null;

  function emit(next) { status = next; signal(next); }
  function store(next) {
    meta = next;
    try {
      if (next) localStorage.setItem(metaKey, JSON.stringify(next));
      else localStorage.removeItem(metaKey);
    } catch { /* Continue this session if browser storage is disabled. */ }
  }
  function attach(code, snapshot, dirty = false) {
    store({ code, id: snapshot.id, rev: snapshot.rev, dirty });
    conflict = null;
  }
  async function resume() {
    if (!meta || trading) return;
    const { code, rev } = meta;
    try {
      const remote = await request('save', code);
      if (meta?.code !== code || meta.rev !== rev || trading) return;
      if (meta.dirty && meta.rev !== remote.rev) {
        conflict = remote;
        emit('conflict');
      } else if (meta.dirty) {
        await flush();
      } else {
        attach(code, remote);
        restore(remote.state);
        emit('ready');
      }
    } catch (error) {
      if (meta?.code !== code || meta.rev !== rev || trading) return;
      if (error.status === 401) {
        store(null); emit('local');
      } else emit('offline');
    }
  }
  async function create() {
    const snapshot = await request('accounts', '', 'POST', { state: current() });
    attach(snapshot.code, snapshot);
    emit('ready');
  }
  async function signIn(code) {
    const valid = code.trim();
    const snapshot = await request('save', valid);
    attach(valid, snapshot);
    restore(snapshot.state);
    emit('ready');
  }
  function goLocal() {
    clearTimeout(timer);
    store(null);
    conflict = null;
    emit('local');
  }
  function useRemote() {
    if (!conflict || !meta) return;
    restore(conflict.state);
    attach(meta.code, conflict);
    emit('ready');
  }
  function queue() {
    if (!meta) return;
    store({ ...meta, dirty: true });
    if (conflict || trading) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 320);
  }
  function flush() {
    if (flushing) return flushing;
    if (!meta?.dirty || conflict || trading) return Promise.resolve();
    flushing = flushSave().finally(() => { flushing = undefined; });
    return flushing;
  }
  async function flushSave() {
    const { code, rev } = meta;
    const before = JSON.stringify(current());
    emit('saving');
    try {
      const saved = await request('save', code, 'PUT', { rev, state: JSON.parse(before) });
      if (meta?.code !== code) return;
      const changed = before !== JSON.stringify(current());
      attach(code, saved, changed);
      emit(changed ? 'saving' : 'ready');
      if (changed) timer = setTimeout(flush, 100);
    } catch (error) {
      if (meta?.code !== code) return;
      if (error.status === 409 && error.data.state) { conflict = error.data; emit('conflict'); }
      else emit('offline');
    }
  }
  async function socialGift({ target, giftId, requestId }) {
    const gift = Object.hasOwn(SOCIAL_GIFTS, giftId) ? SOCIAL_GIFTS[giftId] : null;
    if (!gift) throw new Error('请选择一份礼物。');
    const code = meta?.code;
    if (!code) throw new Error('请先连接游玩码。');
    for (let attempt = 0; meta?.code === code && meta.dirty && !conflict && attempt < 3; attempt++) await flush();
    if (meta?.code !== code) throw new Error('账号已切换，请重新选择收礼人。');
    if (conflict || meta.dirty) throw new Error('请先处理或同步角色页的云存档。');
    const baseline = current().coins;
    const payload = { action: 'gift', target, giftId, requestId, revision: meta.rev };
    clearTimeout(timer);
    trading = true;
    try {
      let result;
      try { result = await request('social', code, 'POST', payload); }
      catch (error) {
        if (error.status && error.status < 500) throw error;
        result = await request('social', code, 'POST', payload);
      }
      if (meta?.code !== code) throw new Error('账号已切换，请刷新社交广场。');
      const saved = result.save;
      if (saved?.id !== meta.id || !Number.isSafeInteger(saved?.rev) || !Number.isSafeInteger(saved?.state?.coins)) {
        throw new Error('云存档返回异常，请刷新后重试。');
      }
      const changed = meta.dirty;
      applyGiftBalance(saved.state.coins + current().coins - baseline);
      attach(code, saved, changed);
      emit(changed ? 'saving' : 'ready');
      return result;
    } catch (error) {
      const saved = error.data?.save;
      if (meta?.code === code && error.status === 409 && saved?.id === meta.id) {
        if (meta.dirty) {
          conflict = saved;
          emit('conflict');
        } else {
          attach(code, saved);
          restore(saved.state, { renderPage: false });
          emit('ready');
        }
      }
      throw error;
    } finally {
      trading = false;
      if (meta?.code === code && meta.dirty && !conflict) timer = setTimeout(flush, 100);
    }
  }
  return {
    resume, create, signIn, goLocal, useRemote, queue, flush,
    meta: () => meta,
    status: () => status,
    world: (action, data = {}) => request('world', meta?.code, action ? 'POST' : 'GET', action ? { action, ...data } : undefined),
    social: () => request('social', meta?.code),
    socialMessage: ({ text, requestId }) => request('social', meta?.code, 'POST', { action: 'message', text, requestId }),
    socialGift,
  };
}
