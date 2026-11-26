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

test('a co-op handoff requires placing the right item before confirming each check', () => {
  const state = workshop();
  assert.equal(run(state, 'invite', 'lin'), true);
  assert.equal(run(state, 'choose-role', 'quality'), true);
  assert.equal(run(state, 'start-team'), false);
  assert.equal(run(state, 'ready'), true);
  assert.equal(run(state, 'start-team'), true);
  assert.equal(run(state, 'team-step', { step: 0, choice: 'measure' }), false);
  assert.equal(run(state, 'team-place', { step: 0, item: 'cable' }), false);
  assert.equal(run(state, 'team-place', { step: 0, item: 'gauge' }), true);
  assert.equal(run(state, 'team-place', { step: 0, item: 'gauge' }), false);
  assert.equal(run(state, 'team-step', { step: 0, choice: 'measure' }), true);
  assert.equal(run(state, 'team-place', { step: 0, item: 'record' }), false);
  assert.equal(run(state, 'team-place', { step: 1, item: 'record' }), true);
  assert.equal(run(state, 'team-step', { step: 1, choice: 'record' }), true);
  assert.equal(run(state, 'team-step', { step: 1, choice: 'record' }), false);
  assert.equal(state.community.teamBest.quality, 88);
  assert.equal(state.community.contribution, 2);
  assert.equal(run(state, 'equip', 'handoff'), true);
});

test('a replay of a prior role can improve the score without repeating rewards', () => {
  const state = workshop();
  assert.equal(run(state, 'invite', 'lin'), true);
  Object.assign(state.community.team, { stage: 'active', step: 1 });
  state.community.teamWins.push('assembly');
  assert.equal(run(state, 'team-place', { step: 1, item: 'record' }), true);
  assert.equal(run(state, 'team-step', { step: 1, choice: 'torque' }), true);
  assert.equal(state.coins, 240);
  assert.equal(run(state, 'team-replay'), true);
  assert.equal(state.community.team.step, 0);
  assert.equal(state.community.team.stage, 'ready');
});
