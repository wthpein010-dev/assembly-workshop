import test from 'node:test';
import assert from 'node:assert/strict';
import { initialState, normalizeSave, profileFrom, validName, escapeHtml, levelAt, loadSave, persistSave } from '../state.js';

test('role validation covers Chinese, short input and HTML', () => {
  assert.equal(validName(' 林小满 '), true);
  assert.equal(validName('林'), false);
  assert.equal(validName('<林>'), false);
  assert.deepEqual(profileFrom({ name: '员工01', face: 2, gender: 'male', hair: 99 }),
    { name: '员工01', gender: 'male', face: 2, hair: 0, tone: 0, group: 0 });
  assert.equal(escapeHtml('<拾> & "车间"'), '&lt;拾&gt; &amp; &quot;车间&quot;');
});

test('state keeps training and economy after reload, with safe defaults for invalid saves', () => {
  const map = new Map();
  const storage = { getItem: key => map.get(key), setItem: (key, val) => map.set(key, val) };
  const player = { ...initialState(), profile: profileFrom({ name: '练习班员' }), xp: 140, coins: 65, track: { active: 'memory' } };
  assert.equal(persistSave(storage, player), true);
  assert.deepEqual(loadSave(storage), player);
  assert.deepEqual(levelAt(player.xp), { level: 2, current: 20, max: 120 });
  assert.deepEqual(normalizeSave({ version: 2 }), initialState());
});
