import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isStandable, walkLineIsClear } from '../factory-motion.js';
import {
  RECOVERY_PARTS, RECOVERY_RECIPES, collectRecoveryPart, createRecoverySimulation,
  installRecoveryPart, normalizeRecovery,
} from '../factory-recovery.js';

const layout = JSON.parse(readFileSync(new URL('../assets/factory-layout.json', import.meta.url), 'utf8'));
const aimAt = (player, target) => ({ ...player, yaw: Math.atan2(target.x - player.x, target.z - player.z) });
const getBot = (sim, id) => sim.state.robots.find((bot) => bot.id === id);
const getPart = (sim, id) => sim.state.drops.find((part) => part.partId === id);

function waitForPhase(sim, robot, phase, player) {
  for (let i = 0; i < 280 && robot.phase !== phase; i++) sim.update(.05, player);
  assert.equal(robot.phase, phase);
}

test('empty old saves normalize safely and valid installed parts preserve the collected invariant', () => {
  assert.deepEqual(normalizeRecovery(null), { collected: [], installed: [] });
  const existing = { collected: ['fan', 'invalid', 'fan'], installed: ['drive', 'drive', 'nope'] };
  assert.deepEqual(normalizeRecovery(existing), { collected: ['fan', 'drive'], installed: ['drive'] });
  assert.deepEqual(existing.collected, ['fan', 'invalid', 'fan']);
});

test('a unique part may be collected once and installed only on its matching bench recipe', () => {
  assert.deepEqual(RECOVERY_RECIPES.tester.parts, ['memory', 'drive', 'fan']);
  assert.deepEqual(RECOVERY_RECIPES.monitor.parts, ['harness', 'sensor', 'controller']);
  assert.equal(installRecoveryPart(null, 'tester', 'memory'), null);
  const collected = collectRecoveryPart(null, 'memory');
  assert.equal(collectRecoveryPart(collected, 'memory'), null);
  assert.equal(installRecoveryPart(collected, 'monitor', 'memory'), null);
  const installed = installRecoveryPart(collected, 'tester', 'memory');
  assert.deepEqual(installed, { collected: ['memory'], installed: ['memory'] });
  assert.equal(installRecoveryPart(installed, 'tester', 'memory'), null);
  assert.deepEqual(collected.installed, []);
});

test('actual layout pickup guides lead to reachable floor drops, with no remote or duplicate interaction', () => {
  const sim = createRecoverySimulation(layout);
  assert.equal(sim.state.drops.length, 6);
  assert.equal(sim.state.robots.length, 3);
  assert.deepEqual(sim.state.drops.filter((drop) => drop.visible).map((drop) => drop.partId), ['memory', 'drive', 'harness']);
  const warehouse = layout.points.find(({ id }) => id === 'warehouse');
  const memory = getPart(sim, 'memory');
  assert.ok(Math.hypot(memory.x - warehouse.x, memory.z - warehouse.z) >= 1.1, 'pickup marker has its own floor space');
  assert.equal(sim.interact(layout.spawn), null);
  for (const id of ['memory', 'drive', 'harness']) {
    const landing = sim.guide(id);
    assert.ok(isStandable(landing, layout));
    assert.ok(walkLineIsClear(landing, getPart(sim, id), layout));
    sim.update(0, landing);
    assert.equal(sim.state.nearbyDrop.partId, id);
    const event = sim.interact(landing);
    assert.equal(event.type, 'collect');
    assert.equal(event.partId, id);
    assert.equal(getPart(sim, id).visible, false);
    assert.equal(sim.interact(landing), null);
    assert.equal(sim.guide(id), null);
  }
  for (const id of ['tester', 'monitor', 'fan', 'sensor', 'controller']) assert.ok(isStandable(sim.guide(id), layout));
  assert.equal(sim.guide('invalid-item'), null);
});

test('pulse requires aiming and a vulnerability window and only spawns one drop after deactivation', () => {
  const sim = createRecoverySimulation(layout);
  const robot = getBot(sim, 'fan-bot');
  const spot = sim.guide(robot.id);
  const facing = () => aimAt(spot, robot);
  assert.equal(sim.pulse({ ...facing(), yaw: facing().yaw + Math.PI }).outcome, 'miss');
  assert.equal(sim.pulse(facing()).outcome, 'cooldown');
  sim.update(.5, spot);
  assert.equal(sim.pulse(facing()).outcome, 'guarded');
  waitForPhase(sim, robot, 'vulnerable', spot);
  assert.equal(sim.state.jammed, 0);
  const result = sim.pulse(facing());
  assert.equal(result.outcome, 'disabled');
  assert.equal(robot.phase, 'disabled');
  assert.equal(getPart(sim, 'fan').visible, true);
  const collection = sim.guide('fan');
  assert.equal(sim.interact(collection).partId, 'fan');
  assert.equal(sim.interact(collection), null);
  sim.setProgress(sim.state.progress);
  assert.equal(robot.phase, 'disabled');
  assert.equal(getPart(sim, 'fan').visible, false);
});

test('scan punishes standing inside its warning while dash moves along a safe visible lane', () => {
  const sim = createRecoverySimulation(layout);
  const scan = getBot(sim, 'sensor-bot');
  const dash = getBot(sim, 'controller-bot');
  assert.notEqual(scan.type, dash.type);
  const inside = { x: scan.x, z: scan.z, yaw: 0 };
  waitForPhase(sim, scan, 'telegraph', inside);
  let penalty;
  for (let i = 0; i < 90 && !penalty; i++) penalty = sim.update(.05, inside);
  assert.equal(penalty?.type, 'stagger');
  assert.equal(penalty.robotId, 'sensor-bot');
  assert.equal(sim.pulse(inside).outcome, 'jammed');

  const spot = sim.guide('controller');
  waitForPhase(sim, dash, 'telegraph', spot);
  const origin = { x: dash.x, z: dash.z };
  for (let i = 0; i < 100; i++) {
    sim.update(.05, spot);
    for (const bot of sim.state.robots) assert.ok(isStandable(bot, layout), bot.id);
  }
  assert.ok(Math.hypot(dash.x - origin.x, dash.z - origin.z) > .15);
});

test('loaded robot parts hide their drop and disable bot without another interaction', () => {
  const sim = createRecoverySimulation(layout, { installed: ['fan'], collected: ['fan', 'sensor'] });
  assert.equal(RECOVERY_PARTS.fan.name, '散热风扇');
  assert.equal(getBot(sim, 'fan-bot').phase, 'disabled');
  assert.equal(getPart(sim, 'fan').visible, false);
  assert.equal(sim.guide('sensor'), null);
  assert.equal(sim.guide('sensor-bot'), null);
  sim.setProgress(null);
  assert.equal(getBot(sim, 'fan-bot').phase, 'idle');
  assert.ok(isStandable(sim.guide('fan'), layout));
});

test('two-hit machines require separate vulnerability windows and both assemblies consume unique parts', () => {
  const sim = createRecoverySimulation(layout);
  for (const id of ['memory', 'drive', 'harness']) assert.equal(sim.interact(sim.guide(id)).partId, id);
  for (const [id, expectedHits] of [['fan', 1], ['sensor', 2], ['controller', 2]]) {
    const bot = getBot(sim, id + '-bot');
    const spot = sim.guide(id);
    for (let hit = 1; hit <= expectedHits; hit++) {
      waitForPhase(sim, bot, 'vulnerable', spot);
      const strike = sim.pulse(aimAt(spot, bot));
      assert.equal(strike.outcome, hit < expectedHits ? 'hit' : 'disabled');
      assert.equal(bot.hp, expectedHits - hit);
      if (hit < expectedHits) {
        assert.equal(bot.phase, 'recoil');
        assert.equal(getPart(sim, id).visible, false);
        assert.equal(sim.pulse(aimAt(spot, bot)).outcome, 'cooldown');
      }
    }
    assert.equal(sim.interact(sim.guide(id)).id, id);
  }
  for (const project of Object.values(RECOVERY_RECIPES)) {
    for (const part of project.parts) sim.setProgress(installRecoveryPart(sim.state.progress, project.id, part));
  }
  assert.equal(sim.state.progress.installed.length, 6);
  assert.equal(sim.state.progress.collected.length, 6);
  assert.equal(sim.state.drops.some((drop) => drop.visible), false);
});

function segmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSquared = dx * dx + dz * dz;
  const projected = lengthSquared ? ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared : 0;
  const fraction = Math.max(0, Math.min(1, projected));
  return Math.hypot(point.x - start.x - fraction * dx, point.z - start.z - fraction * dz);
}

test('robot lanes and default sightlines remain clear of the factory patrol paths', () => {
  const segments = layout.points.flatMap(({ path = [] }) => path.slice(1).map((end, index) => [path[index], end]));
  const patrolDistance = (point) => Math.min(...segments.map(([start, end]) => segmentDistance(point, start, end)));
  for (const id of ['fan-bot', 'sensor-bot', 'controller-bot']) {
    const sim = createRecoverySimulation(layout);
    const robot = getBot(sim, id);
    const landing = sim.guide(id);
    assert.ok(isStandable(landing, layout), id);
    for (let frame = 0; frame < 260; frame++) {
      sim.update(.05, landing);
      assert.ok(isStandable(robot, layout, .43), id);
      assert.ok(walkLineIsClear(landing, robot, layout), id);
      const sightLength = Math.hypot(landing.x - robot.x, landing.z - robot.z);
      const samples = Math.ceil(sightLength / .1);
      for (let index = 0; index <= samples; index++) {
        const t = index / samples;
        const glance = { x: landing.x + (robot.x - landing.x) * t, z: landing.z + (robot.z - landing.z) * t };
        assert.ok(patrolDistance(glance) >= 1.2, id + ' shares an NPC path at ' + JSON.stringify(glance));
      }
    }
  }
});
