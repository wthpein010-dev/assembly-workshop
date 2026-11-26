import { CLOUD_ORIGIN } from './config.js';

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

export function makeCloud({ current, restore, signal }) {
  let meta = cachedMeta();
  let status = meta ? 'connecting' : 'local';
  let timer;
  let flushing = false;
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
    if (!meta) return;
    const code = meta.code;
    try {
      const remote = await request('save', code);
      if (meta?.code !== code) return;
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
      if (meta?.code !== code) return;
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
    if (conflict) return;
    clearTimeout(timer);
    timer = setTimeout(flush, 320);
  }
  async function flush() {
    if (!meta || !meta.dirty || flushing || conflict) return;
    const { code, rev } = meta;
    const before = JSON.stringify(current());
    flushing = true;
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
    } finally { flushing = false; }
  }
  return {
    resume, create, signIn, goLocal, useRemote, queue, flush,
    meta: () => meta,
    status: () => status,
    world: (action, data = {}) => request('world', meta?.code, action ? 'POST' : 'GET', action ? { action, ...data } : undefined),
  };
}
