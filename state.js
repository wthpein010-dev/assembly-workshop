import { normalizeRecovery } from './factory-recovery.js';
import { normalizeAvatar } from './avatar-catalog.js?v=pc1';
import { normalizeActivities } from './activities.js';
import { FACE_LABELS, HAIR_LABELS, TONES } from './character-appearance.js';
export { FACE_LABELS, HAIR_LABELS, TONES };

export const SAVE_KEY = 'assembly-workshop.progress.v1';
export const WORK_GROUPS = ['装配一组', '质检二组', '设备支持组'];

export function initialState() {
  return {
    version: 1, profile: null, xp: 0, coins: 240,
    skills: { assembly: 0, quality: 0, repair: 0 },
    track: null, community: null, recovery: normalizeRecovery(), onlineCompleted: [], activities: normalizeActivities(),
  };
}

export function validName(name) {
  return typeof name === 'string' && /^[\p{L}\p{N}·_-]{2,14}$/u.test(name.trim());
}

export function profileFrom(fields) {
  const index = (value, choices) =>
    Number.isInteger(value) && value >= 0 && value < choices.length ? value : 0;
  const avatar = normalizeAvatar(fields.avatar);
  return {
    name: validName(fields.name) ? fields.name.trim() : '新人工友',
    gender: fields.gender === 'male' ? 'male' : 'female',
    face: index(fields.face, FACE_LABELS),
    hair: index(fields.hair, HAIR_LABELS),
    tone: index(fields.tone, TONES),
    group: index(fields.group, WORK_GROUPS),
    ...(avatar ? { avatar } : {}),
  };
}

export function normalizeSave(value) {
  if (!value || value.version !== 1) return initialState();
  const count = (value, fallback = 0) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
  const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  return {
    version: 1,
    profile: object(value.profile) ? profileFrom(value.profile) : null,
    xp: count(value.xp),
    coins: count(value.coins, 240),
    skills: Object.fromEntries(['assembly', 'quality', 'repair'].map(key => [key, count(value.skills?.[key])])),
    track: object(value.track),
    community: object(value.community),
    recovery: normalizeRecovery(value.recovery),
    activities: normalizeActivities(value.activities),
    onlineCompleted: Array.isArray(value.onlineCompleted) ? value.onlineCompleted.filter(id => typeof id === 'string').slice(-80) : [],
  };
}

export function loadSave(storage) {
  try { return normalizeSave(JSON.parse(storage.getItem(SAVE_KEY))); }
  catch { return initialState(); }
}

export function persistSave(storage, value) {
  try { storage.setItem(SAVE_KEY, JSON.stringify(value)); return true; }
  catch { return false; }
}

export function levelAt(xp) {
  return { level: 1 + Math.floor(xp / 120), current: xp % 120, max: 120 };
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}
