import { test } from 'node:test';
import assert from 'node:assert/strict';
import { communityTitle, updateCommunity } from '../community.js';
import { SHOP_CATALOG, SHOP_ITEMS, getShopOrders, isShopRedeemed, listShopProducts } from '../shop-catalog.js';

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

test('the shop catalog filters by category and search and sorts without changing the featured order', () => {
  assert.ok(SHOP_CATALOG.length >= 20 && SHOP_CATALOG.length <= 24);
  assert.equal(new Set(SHOP_CATALOG.map(({ id }) => id)).size, SHOP_CATALOG.length);
  assert.equal(listShopProducts({ query: ' 扭矩 ' })[0].id, 'pin');
  assert.deepEqual(new Set(SHOP_CATALOG.map(({ category }) => category)), new Set(['physical', 'wearables', 'desk', 'gifts']));
  const ascending = listShopProducts({ category: 'physical', sort: 'price-asc' });
  assert.ok(ascending.length > 1 && ascending.every((item, i) => i === 0 || ascending[i - 1].price <= item.price));
  assert.ok(ascending.every((item) => item.kind === 'physical' && !item.giftable && !item.equipable));
  assert.equal(listShopProducts()[0], SHOP_CATALOG[0]);
});

test('a physical exchange creates one simulated redemption record and stays out of the bag', () => {
  const state = workshop(500);
  assert.equal(run(state, 'buy', 'reward-thermos'), true);
  const [order] = getShopOrders(state.community);
  assert.equal(order.item, 'reward-thermos');
  assert.equal(order.status, 'pending');
  assert.equal(order.spent, SHOP_ITEMS['reward-thermos'].price);
  assert.equal(state.coins, 500 - order.spent);
  assert.equal(state.community.owned.includes('reward-thermos'), false);
  assert.equal(isShopRedeemed(state.community, 'reward-thermos'), true);
  assert.equal(run(state, 'buy', 'reward-thermos'), false);
  assert.equal(run(state, 'equip', 'reward-thermos'), false);
  assert.equal(getShopOrders(state.community).length, 1);
});

test('an old bag keeps its equipped reward and shows a legacy record when a new item is exchanged', () => {
  const state = workshop(240);
  assert.equal(run(state, 'buy', 'cap'), true);
  assert.equal(run(state, 'equip', 'cap'), true);
  delete state.community.shopOrders;
  assert.equal(run(state, 'buy', 'cap'), false);
  assert.equal(run(state, 'buy', 'pin'), true);
  assert.equal(communityTitle(state), '夜班安全帽');
  assert.deepEqual(getShopOrders(state.community).map(({ item, status, spent }) => [item, status, spent]),
    [['pin', 'received', 60], ['cap', 'legacy', null]]);
});

test('gifts are one-time simulated transfers to known friends and only allow fixed messages', () => {
  const state = workshop(500);
  assert.equal(run(state, 'friend', 'lin'), true);
  state.community.friends.push('unknown-player');
  assert.equal(run(state, 'send-gift', { to: 'unknown-player', item: 'pin' }), false);
  assert.equal(run(state, 'send-gift', { to: 'lin', item: 'reward-thermos' }), false);
  assert.equal(run(state, 'send-gift', { to: 'lin', item: 'pin', note: 'bad-note' }), false);
  assert.equal(state.coins, 500);
  assert.equal(run(state, 'send-gift', { to: 'lin', item: 'pin', note: 'thank-you' }), true);
  assert.equal(state.coins, 440);
  assert.equal(state.community.gifts[0].note, 'thank-you');
  assert.equal(run(state, 'send-gift', { to: 'lin', item: 'pin' }), false);
  assert.equal(state.coins, 440);
});
