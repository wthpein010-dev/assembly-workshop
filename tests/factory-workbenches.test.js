import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorkbenchRun, performWorkbenchAction } from '../factory-workbenches.js';

const act = (run, type, options = {}) => performWorkbenchAction(run, { type, step: run.step, ...options });
const move = (run, item, target) => act(run, 'move', { item, target });

test('a recognized wrong material is retried in place, while unknown, stale and duplicate actions cannot progress', () => {
  const run = createWorkbenchRun('materials');
  assert.equal(act(run, 'scan', { item: 'fake' }), false);
  assert.equal(act(run, 'scan', { item: 'ram8' }), true);
  assert.equal(run.mistakes, 1);
  assert.equal(run.step, 0);
  assert.equal(act(run, 'scan', { item: 'ram16' }), false);
  assert.equal(act(run, 'retry'), true);
  assert.equal(act(run, 'scan', { item: 'ram16' }), true);
  assert.equal(performWorkbenchAction(run, { type: 'scan', step: 0, item: 'ram16' }), false);
  assert.equal(move(run, 'ram16', 'kit-basket'), true);
  assert.equal(move(run, 'lead', 'kit-basket'), true);
  assert.equal(run.result.score, 90);
  assert.equal(run.result.steps, 3);
  assert.equal(move(run, 'lead', 'kit-basket'), false);
  assert.equal(run.mistakes, 1);
});

test('inspection changes its disposition on replay according to the measured sample', () => {
  for (const [attempt, destination] of [[1, 'reject'], [2, 'pass']]) {
    const run = createWorkbenchRun('inspection', attempt);
    assert.equal(move(run, 'sample', destination), false);
    assert.equal(act(run, 'command', { item: 'power' }), true);
    assert.equal(act(run, 'scan', { item: 'meter' }), true);
    assert.ok(run.readout.includes(attempt === 1 ? '18' : '10'));
    assert.equal(move(run, 'sample', destination), true);
    assert.equal(run.result.attempts, attempt);
    assert.equal(run.result.score, 100);
  }
});

test('calibration bounds movement and preserves an adjustment after a failed validation', () => {
  const run = createWorkbenchRun('calibration');
  assert.equal(act(run, 'nudge', { axis: 'z', delta: 1 }), false);
  for (let i = 0; i < 3; i++) assert.equal(act(run, 'nudge', { axis: 'x', delta: 1 }), true);
  assert.equal(act(run, 'nudge', { axis: 'x', delta: 1 }), false);
  assert.equal(act(run, 'command', { item: 'validate' }), true);
  assert.equal(run.result, null);
  assert.equal(run.mistakes, 1);
  assert.equal(act(run, 'retry'), true);
  assert.deepEqual(run.position, { x: 3, y: 0 });
  assert.equal(act(run, 'nudge', { axis: 'x', delta: -1 }), true);
  assert.equal(act(run, 'nudge', { axis: 'y', delta: -1 }), true);
  assert.equal(act(run, 'command', { item: 'validate' }), true);
  assert.equal(run.result.score, 90);
});

test('assembly, wiring, repair and packing enforce distinct ordered fixtures', () => {
  const cases = {
    assembly: [['move', 'ram16', 'dimm'], ['move', 'ssd', 'ssd-bay'], ['move', 'screw', 'mount']],
    wiring: [['move', 'fan-line', 'fan'], ['move', 'data-line', 'data'], ['command', 'continuity']],
    repair: [['move', 'probe', 'diagnostic-port'], ['move', 'bad-ssd', 'isolation'], ['move', 'new-ssd', 'ssd-bay'], ['command', 'retest']],
    packing: [['move', 'sample', 'carton'], ['move', 'seal', 'flap'], ['scan', 'matched-label']],
  };
  for (const [id, sequence] of Object.entries(cases)) {
    const run = createWorkbenchRun(id);
    const [lastType, lastItem, lastTarget] = sequence.at(-1);
    assert.equal(act(run, lastType, { item: lastItem, target: lastTarget }), false, id);
    for (const [type, item, target] of sequence) assert.equal(act(run, type, { item, target }), true, id);
    assert.equal(run.result.id, id);
    assert.equal(run.result.score, 100);
  }
  assert.equal(createWorkbenchRun('unknown'), null);
});
