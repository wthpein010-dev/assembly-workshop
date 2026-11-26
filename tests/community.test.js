import { test } from 'node:test';
import assert from 'node:assert/strict';
import { communityTitle, updateCommunity } from '../community.js';

const workshop = (coins = 240) => ({ community: null, coins, xp: 0 });
const run = (state, action, value) => updateCommunity(state, action, value).ok;

test('an exchange deducts once and rejects purchases above the balance', () => {
  const state = workshop(60);
  assert.equal(run(state, 'buy', 'pin'), true);
  assert.equal(state.coins, 0);
  assert.equal(run(state, 'buy', 'pin'), false);
  assert.equal(run(state, 'buy', 'cap'), false);
  assert.equal(state.coins, 0);
  assert.equal(run(state, 'equip', 'cap'), false);
  assert.equal(run(state, 'equip', 'pin'), true);
  assert.equal(communityTitle(state), '扭矩校准章');
});

test('the welcome gift moves from inbox to bag once', () => {
  const state = workshop();
  assert.equal(run(state, 'accept-gift', 'welcome'), true);
  assert.equal(run(state, 'accept-gift', 'welcome'), false);
  assert.equal(run(state, 'equip', 'newcomer'), true);
  assert.equal(state.coins, 240);
});

test('a help ticket must be claimed before resolving and contributes once', () => {
  const state = workshop();
  assert.equal(run(state, 'resolve-ticket', { id: 'bearing', reply: '已更换' }), false);
  assert.equal(run(state, 'claim-ticket', 'bearing'), true);
  assert.equal(run(state, 'resolve-ticket', { id: 'bearing', reply: ' ' }), false);
  assert.equal(run(state, 'resolve-ticket', { id: 'bearing', reply: '已复测轴承间隙' }), true);
  const earned = state.coins;
  assert.equal(run(state, 'resolve-ticket', { id: 'bearing', reply: '重复' }), false);
  assert.equal(state.coins, earned);
  assert.equal(state.community.contribution, 1);
});

test('a co-op handoff requires a ready team and both role checks in order', () => {
  const state = workshop();
  assert.equal(run(state, 'invite', 'lin'), true);
  assert.equal(run(state, 'choose-role', 'quality'), true);
  assert.equal(run(state, 'start-team'), false);
  assert.equal(run(state, 'ready'), true);
  assert.equal(run(state, 'start-team'), true);
  assert.equal(run(state, 'team-step', 'record'), false);
  assert.equal(run(state, 'team-step', 'measure'), true);
  assert.equal(run(state, 'team-step', 'measure'), false);
  assert.equal(run(state, 'team-step', 'record'), true);
  assert.equal(run(state, 'team-step', 'record'), false);
  assert.equal(state.community.contribution, 2);
  assert.equal(run(state, 'equip', 'handoff'), true);
});
