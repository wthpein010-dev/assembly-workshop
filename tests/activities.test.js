import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENTS, eventState, factoryTime, recordPractice, signInActivity } from '../activities.js';
import { initialState, normalizeSave, profileFrom } from '../state.js';
import { portraitLayers } from '../character-appearance.js';

const date = value => Date.parse(value);
const training = EVENTS.find(event => event.type === 'training');
const workbench = EVENTS.find(event => event.type === 'workbench');

test('factory time handles the local day boundary and summer offset', () => {
  assert.deepEqual(factoryTime(date('2026-11-27T07:59:00Z')), { date: '2026-11-26', time: '23:59', minutes: 1439 });
  assert.deepEqual(factoryTime(date('2026-11-27T08:00:00Z')), { date: '2026-11-27', time: '00:00', minutes: 0 });
  assert.equal(factoryTime(date('2026-07-22T16:00:00Z')).time, '09:00');
});

test('check-in and matching timed practices grant each small reward once per factory day', () => {
  const checkTime = date('2026-11-27T16:59:00Z');
  const state = initialState();
  assert.equal(signInActivity(state, checkTime), null);
  state.profile = profileFrom({ name: '训练工友' });
  assert.deepEqual(signInActivity(state, checkTime), { xp: 8, coins: 5 });
  assert.equal(signInActivity(state, checkTime + 30_000), null);
  assert.equal(recordPractice(state, 'training', checkTime), null);
  assert.equal(recordPractice(state, 'workbench', date('2026-11-27T17:00:00Z')), null);
  assert.equal(recordPractice(state, 'training', date('2026-11-27T17:00:00Z')), training);
  assert.equal(recordPractice(state, 'training', date('2026-11-27T18:01:00Z')), null);
  assert.equal(recordPractice(state, 'workbench', date('2026-11-28T01:00:00Z')), workbench);
  assert.equal(recordPractice(state, 'workbench', date('2026-11-28T05:00:00Z')), null);
  const stored = normalizeSave(JSON.parse(JSON.stringify(state)));
  assert.equal(eventState(workbench, stored.activities, factoryTime(date('2026-11-28T05:02:00Z'))), 'complete');
  assert.equal(stored.coins, 261);
  assert.equal(stored.xp, 38);
  assert.equal(signInActivity(stored, date('2026-11-28T08:00:00Z')).coins, 5);
});

test('appearance normalization retains expanded indices and each selection changes only its atlas layer', () => {
  const profile = profileFrom({ name: '工坊工友', gender: 'male', face: 7, hair: 3, tone: 2 });
  const original = portraitLayers(profile);
  const alternateHair = portraitLayers({ ...profile, hair: 5 });
  assert.equal(alternateHair.faceX, original.faceX);
  assert.equal(alternateHair.faceY, original.faceY);
  assert.equal(alternateHair.tone, original.tone);
  assert.notEqual(alternateHair.hairY, original.hairY);
  const alternateFace = portraitLayers({ ...profile, face: 1 });
  assert.equal(alternateFace.hairX, original.hairX);
  assert.equal(alternateFace.hairY, original.hairY);
  assert.notEqual(alternateFace.faceY, original.faceY);
  assert.deepEqual(portraitLayers({ ...profile, tone: 1 }), { ...original, tone: 1 });
});
