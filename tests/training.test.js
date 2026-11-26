import assert from 'node:assert/strict';
import test from 'node:test';
import { applyTraining } from '../training.js';

const fresh = () => ({ xp: 0, coins: 0, skills: { assembly: 0, quality: 0, repair: 0 }, track: null });
const correctAnswers = {
  memory: ['inspect', 'align', 'seat', 'check'],
  assembly: ['order', 'verify-bench', 'fit', 'run'],
  quality: ['review-log', 'evidence', 'hold'],
  fault: ['isolate', 'compare', 'escalate'],
  cert: ['sign-in', 'follow-plan', 'report', 'hand-off'],
};

function finish(state, mission) {
  assert.equal(applyTraining(state, 'start', mission), true);
  for (const [step, option] of correctAnswers[mission].entries()) {
    assert.equal(applyTraining(state, 'answer', mission, option, step), true);
    assert.equal(applyTraining(state, 'next', mission), true);
  }
}

test('guided training gates independent assembly and rewards a successful mission only once', () => {
  const state = fresh();
  assert.equal(applyTraining(state, 'start', 'assembly'), false);
  assert.equal(applyTraining(state, 'start', 'cert'), false);

  finish(state, 'memory');
  const firstReward = { xp: state.xp, coins: state.coins, assembly: state.skills.assembly };
  assert.ok(firstReward.xp > 0 && firstReward.coins > 0 && firstReward.assembly > 0);
  assert.equal(state.track.runs.memory.best, 100);
  assert.equal(applyTraining(state, 'start', 'assembly'), true);
  assert.equal(applyTraining(state, 'start', 'quality'), false);

  finish(state, 'memory');
  assert.deepEqual({ xp: state.xp, coins: state.coins, assembly: state.skills.assembly }, firstReward);
  assert.equal(state.track.runs.memory.attempts, 2);
});

test('a wrong drop must be retried at the same step and duplicate or stale actions cannot advance it', () => {
  const state = fresh();
  assert.equal(applyTraining(state, 'start', 'memory'), true);
  assert.equal(applyTraining(state, 'answer', 'memory', 'inspect', 0), true);
  assert.equal(applyTraining(state, 'next', 'memory'), true);
  assert.equal(applyTraining(state, 'answer', 'memory', 'inspect', 0), false);
  assert.equal(applyTraining(state, 'answer', 'memory', 'reverse', 1), true);
  assert.equal(applyTraining(state, 'next', 'memory'), false);
  assert.equal(applyTraining(state, 'answer', 'memory', 'align', 1), false);
  assert.equal(state.track.runs.memory.step, 1);
  assert.equal(applyTraining(state, 'retry', 'memory'), true);
  assert.equal(applyTraining(state, 'answer', 'memory', 'align', 1), true);
  assert.equal(applyTraining(state, 'answer', 'memory', 'align', 1), false);
  assert.equal(applyTraining(state, 'next', 'memory'), true);
  assert.equal(applyTraining(state, 'next', 'memory'), false);
  assert.equal(state.track.runs.memory.mistakes, 1);
  assert.equal(state.xp, 0);
});

test('simulation certification remains pending till review and can issue only after a passing run', () => {
  const state = fresh();
  for (const mission of ['memory', 'assembly', 'quality', 'fault']) finish(state, mission);
  assert.equal(applyTraining(state, 'review', 'cert'), false);
  assert.equal(applyTraining(state, 'start', 'cert'), true);
  assert.equal(applyTraining(state, 'answer', 'cert', 'skip', 0), true);
  assert.equal(applyTraining(state, 'retry', 'cert'), true);
  assert.equal(applyTraining(state, 'answer', 'cert', 'skip', 0), true);
  assert.equal(applyTraining(state, 'retry', 'cert'), true);
  for (const [step, option] of correctAnswers.cert.entries()) {
    assert.equal(applyTraining(state, 'answer', 'cert', option, step), true);
    assert.equal(applyTraining(state, 'next', 'cert'), true);
  }
  assert.equal(state.track.runs.cert.status, 'failed');
  assert.equal(applyTraining(state, 'review', 'cert'), false);
  finish(state, 'cert');
  assert.equal(state.track.cert, 'pending');
  assert.equal(applyTraining(state, 'review', 'cert'), true);
  const reward = state.xp;
  assert.equal(state.track.cert, 'issued');
  assert.equal(applyTraining(state, 'review', 'cert'), false);

  finish(state, 'cert');
  assert.equal(state.track.cert, 'issued');
  assert.equal(state.xp, reward);
});

test('guided hints toggle per step and result metrics reflect scored actions and elapsed time', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1000 });
  const state = fresh();
  applyTraining(state, 'start', 'memory');
  assert.equal(applyTraining(state, 'hint', 'memory'), true);
  assert.equal(state.track.runs.memory.hint, true);
  assert.equal(applyTraining(state, 'hint', 'memory'), true);
  assert.equal(state.track.runs.memory.hint, false);
  applyTraining(state, 'hint', 'memory');
  applyTraining(state, 'answer', 'memory', 'skip-inspect', 0);
  applyTraining(state, 'retry', 'memory');
  applyTraining(state, 'answer', 'memory', 'inspect', 0);
  applyTraining(state, 'next', 'memory');
  assert.equal(state.track.runs.memory.hint, false);
  t.mock.timers.tick(64200);
  for (const [offset, option] of correctAnswers.memory.slice(1).entries()) {
    applyTraining(state, 'answer', 'memory', option, offset + 1);
    applyTraining(state, 'next', 'memory');
  }
  assert.equal(state.track.runs.memory.elapsed, 64);
  assert.equal(state.track.runs.memory.accuracy, 80);
  assert.equal(state.xp, 40);
});

test('moving a part validates its station, tool, target and orientation before it can snap', () => {
  const state = fresh();
  applyTraining(state, 'start', 'memory');
  assert.equal(applyTraining(state, 'manipulate', 'memory', { kind: 'inspect', target: 'inspect' }, 0), true);
  assert.equal(applyTraining(state, 'next', 'memory'), true);
  const drop = (item, target, step = 1) => applyTraining(state, 'manipulate', 'memory', { kind: 'drop', item, target }, step);
  assert.equal(drop('wire', 'slot-b'), false);
  assert.equal(drop('dimm', 'invalid-slot'), false);
  assert.equal(drop('dimm', 'slot-b', 0), false);
  assert.equal(drop('dimm', 'slot-b'), true);
  assert.equal(state.track.runs.memory.feedback, 'wrong');
  assert.equal(applyTraining(state, 'retry', 'memory'), true);
  assert.equal(applyTraining(state, 'rotate', 'memory', undefined, 1), true);
  assert.equal(drop('dimm', 'slot-b'), true);
  assert.equal(state.track.runs.memory.feedback, 'correct');
  assert.deepEqual(state.track.runs.memory.placement, { kind: 'drop', item: 'dimm', target: 'slot-b' });
  assert.equal(drop('dimm', 'slot-b'), false);
  assert.equal(applyTraining(state, 'next', 'memory'), true);
  assert.equal(state.track.runs.memory.orientation, 0);
  assert.equal(applyTraining(state, 'manipulate', 'memory', { kind: 'inspect', target: 'seat' }, 2), false);
  assert.equal(applyTraining(state, 'manipulate', 'memory', { kind: 'press', target: 'seat' }, 2), true);
});

test('workbench manipulations can finish assembly and classify a failed quality sample', () => {
  const state = fresh();
  finish(state, 'memory');
  const assembly = [
    { kind: 'drop', item: 'b16', target: 'manifest' },
    { kind: 'inspect', target: 'verify-bench' },
    { kind: 'drop', item: 'ssd', target: 'ssd-bay' },
    { kind: 'press', target: 'run' },
  ];
  const quality = [
    { kind: 'inspect', target: 'review-log' },
    { kind: 'drop', item: 'log', target: 'evidence-tray' },
    { kind: 'drop', item: 'hold-tag', target: 'a17' },
  ];
  for (const [mission, actions] of [['assembly', assembly], ['quality', quality]]) {
    assert.equal(applyTraining(state, 'start', mission), true);
    for (const [index, action] of actions.entries()) {
      assert.equal(applyTraining(state, 'manipulate', mission, action, index), true);
      assert.equal(applyTraining(state, 'next', mission), true);
    }
    assert.equal(state.track.runs[mission].best, 100);
  }
  assert.equal(applyTraining(state, 'start', 'fault'), true);
});
