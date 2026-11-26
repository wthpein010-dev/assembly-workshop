import { isStandable, movePlayer, nearestStandable, walkLineIsClear, wrapAngle } from './factory-motion.js';

function part(id, name, description, asset, color, source) {
  return Object.freeze({ id, name, description, asset, color, source });
}

export const RECOVERY_PARTS = Object.freeze({
  memory: part('memory', '内存模块', '为工位测试器提供运行空间。', 'part-memory', '#83d7b4', '收货与仓储'),
  drive: part('drive', '固态硬盘', '保存工位测试记录。', 'part-ssd', '#8bc7eb', '质检工位'),
  harness: part('harness', '校验线束', '把监测台与工位接口连接起来。', 'part-cable', '#efb275', '包装与出货'),
  fan: part('fan', '散热风扇', '放入测试器的散热槽。', null, '#f3aa65', '装配线南通道 · 横摆搬运机'),
  sensor: part('sensor', '巡检传感器', '向监测台传送模拟读数。', null, '#79d8d2', '返修通道 · 环扫巡检机'),
  controller: part('controller', '控制模组', '让监测台能汇总和显示状态。', null, '#c6a1de', '自动化区 · 冲程送料机'),
});

function recipe(id, name, bench, parts) {
  return Object.freeze({ id, name, bench, parts: Object.freeze(parts) });
}

export const RECOVERY_RECIPES = Object.freeze({
  tester: recipe('tester', '工位测试器', 'assembly', ['memory', 'drive', 'fan']),
  monitor: recipe('monitor', '状态监测台', 'calibration', ['harness', 'sensor', 'controller']),
});

const fieldPositions = {
  memory: { x: -9.75, z: -4.33 },
  drive: { x: 10.35, z: 1.15 },
  harness: { x: 18.83, z: -6.65 },
};

const machineSpecs = [
  {
    id: 'fan-bot', type: 'sweep', name: '横摆搬运机', partId: 'fan',
    x: -4, z: 7.4, maxIntegrity: 1, range: 2.35, idle: .55, telegraph: .82, vulnerable: 1.55,
  },
  {
    id: 'sensor-bot', type: 'scan', name: '环扫巡检机', partId: 'sensor',
    x: 16.8, z: 7.2, maxIntegrity: 2, range: 2.1, idle: .9, telegraph: 1.12, vulnerable: 1.27,
  },
  {
    id: 'controller-bot', type: 'dash', name: '冲程送料机', partId: 'controller',
    x: 25.6, z: 8.7, maxIntegrity: 2, range: 1.65, idle: .7, telegraph: 1.18, vulnerable: 1.2,
  },
];

const ROBOT_RADIUS = .43;
const PICKUP_RANGE = 1.35;
const PULSE_RANGE = 5.15;
const PULSE_CONE = .58;
const ACTIVATION_RANGE = 5.45;
const FIXED_STEP = 1 / 30;
const EPSILON = 1e-8;

const validPart = id => typeof id === 'string' && Object.hasOwn(RECOVERY_PARTS, id);
const validPoint = position => position != null && Number.isFinite(position.x) && Number.isFinite(position.z);
const distance = (from, to) => Math.hypot(to.x - from.x, to.z - from.z);
const heading = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const nameAt = (collection, id) => typeof id === 'string' && Object.hasOwn(collection, id) ? collection[id] : null;

function uniqueParts(value) {
  return Array.isArray(value) ? [...new Set(value.filter(validPart))] : [];
}

export function normalizeRecovery(value) {
  const installed = uniqueParts(value?.installed);
  const collected = [...new Set([...uniqueParts(value?.collected), ...installed])];
  return { collected, installed };
}

export function collectRecoveryPart(progress, id) {
  const next = normalizeRecovery(progress);
  if (!validPart(id) || next.collected.includes(id)) return null;
  next.collected.push(id);
  return next;
}

export function installRecoveryPart(progress, recipeId, partId) {
  const project = nameAt(RECOVERY_RECIPES, recipeId);
  const next = normalizeRecovery(progress);
  if (!project?.parts.includes(partId) || !next.collected.includes(partId) || next.installed.includes(partId)) return null;
  next.installed.push(partId);
  return next;
}

function placeOnFloor(candidate, layout) {
  return isStandable(candidate, layout, ROBOT_RADIUS) ? candidate
    : nearestStandable(candidate, layout) ?? nearestStandable(layout.spawn, layout);
}

function initialRobot(spec, home) {
  return {
    id: spec.id, type: spec.type, label: spec.name, name: spec.name, partId: spec.partId,
    color: RECOVERY_PARTS[spec.partId].color, x: home.x, z: home.z, yaw: 0,
    range: spec.range, phase: 'idle', phaseElapsed: 0, phaseDuration: spec.idle,
    integrity: spec.maxIntegrity, maxIntegrity: spec.maxIntegrity,
    get hp() { return this.integrity; },
    get maxHp() { return this.maxIntegrity; },
  };
}

function setPhase(robot, phase, duration) {
  robot.phase = phase;
  robot.phaseElapsed = 0;
  robot.phaseDuration = duration;
}

function resetRobot(robot, spec, home) {
  Object.assign(robot, { x: home.x, z: home.z, yaw: 0, integrity: spec.maxIntegrity });
  setPhase(robot, 'idle', spec.idle);
}

function nearest(player, targets, range, layout, available) {
  let target = null;
  for (const entry of targets) {
    if (!available(entry)) continue;
    const next = distance(player, entry);
    if (next > range || (target && next >= range) || !walkLineIsClear(player, entry, layout)) continue;
    range = next;
    target = entry;
  }
  return target;
}

function approach(target, distances, layout) {
  const turns = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 6, -6, 7, -7, 8];
  for (const radius of distances) {
    for (const turn of turns) {
      const angle = turn * Math.PI / 8;
      const spot = { x: target.x + Math.sin(angle) * radius, z: target.z + Math.cos(angle) * radius };
      if (isStandable(spot, layout) && walkLineIsClear(spot, target, layout)) {
        return { ...spot, yaw: heading(spot, target) };
      }
    }
  }
  return null;
}

export function createRecoverySimulation(layout, initialProgress) {
  const homes = machineSpecs.map((spec) => placeOnFloor({ x: spec.x, z: spec.z }, layout));
  const robots = machineSpecs.map((spec, index) => initialRobot(spec, homes[index]));
  const drops = Object.values(RECOVERY_PARTS).map((item) => {
    const index = robots.findIndex((robot) => robot.partId === item.id);
    const source = robots[index]?.id ?? null;
    const point = source ? homes[index] : placeOnFloor(fieldPositions[item.id], layout);
    return { id: item.id, partId: item.id, name: item.name, color: item.color, source,
      x: point.x, z: point.z, yaw: 0, visible: !source, collected: false };
  });

  const state = {
    progress: normalizeRecovery(null), drops, robots,
    pulseCooldown: 0, jammed: 0, nearbyDrop: null, nearbyRobot: null,
  };
  let clock = 0;
  let lastPlayer = null;

  function syncNearby(player) {
    if (!validPoint(player)) return;
    lastPlayer = player;
    state.nearbyDrop = nearest(player, drops, PICKUP_RANGE, layout, (drop) => drop.visible);
    state.nearbyRobot = nearest(player, robots, PULSE_RANGE, layout, (robot) => robot.phase !== 'disabled');
  }

  function setProgress(progress) {
    const previous = state.progress;
    state.progress = normalizeRecovery(progress);
    const included = state.progress.collected;
    for (const [index, robot] of robots.entries()) {
      if (included.includes(robot.partId)) {
        robot.integrity = 0;
        setPhase(robot, 'disabled', 0);
      } else if (previous.collected.includes(robot.partId)) {
        resetRobot(robot, machineSpecs[index], homes[index]);
      }
    }
    for (const drop of drops) {
      drop.collected = included.includes(drop.partId);
      drop.visible = !drop.collected && (drop.source === null
        || robots.some((robot) => robot.id === drop.source && robot.phase === 'disabled'));
    }
    syncNearby(lastPlayer);
    return state.progress;
  }

  function drift(robot, target, travel) {
    const step = distance(robot, target);
    if (step < EPSILON) return;
    const scale = Math.min(1, travel / step);
    Object.assign(robot, movePlayer(robot, (target.x - robot.x) * scale, (target.z - robot.z) * scale, layout, ROBOT_RADIUS));
  }

  function warningReached(robot, player) {
    if (state.jammed > EPSILON || distance(robot, player) > robot.range || !walkLineIsClear(robot, player, layout)) return null;
    const span = robot.type === 'dash' ? .48 : .78;
    if (robot.type !== 'scan' && distance(robot, player) > .05
        && Math.abs(wrapAngle(heading(robot, player) - robot.yaw)) > span) return null;
    state.jammed = .9;
    state.pulseCooldown = Math.max(state.pulseCooldown, .28);
    return { type: 'stagger', robotId: robot.id, x: robot.x, z: robot.z, yaw: robot.yaw,
      duration: state.jammed, pattern: robot.type };
  }

  function moveDuringWarning(robot, home, step) {
    if (robot.type !== 'dash' || robot.phaseElapsed < robot.phaseDuration - .36) return;
    const stride = Math.min(step * 3.3, Math.max(0, 1.18 - distance(robot, home)));
    if (stride <= EPSILON) return;
    Object.assign(robot, movePlayer(robot, Math.sin(robot.yaw) * stride, Math.cos(robot.yaw) * stride, layout, ROBOT_RADIUS));
  }

  function advanceRobot(robot, spec, home, step, player) {
    if (robot.phase === 'disabled') return null;
    robot.phaseElapsed = Math.min(robot.phaseDuration, robot.phaseElapsed + step);

    if (robot.phase === 'idle') {
      if (robot.type === 'sweep') {
        const target = { x: home.x + 1.05 * Math.sin(clock * 1.9), z: home.z };
        const direction = Math.sign(target.x - robot.x);
        drift(robot, target, step * 1.95);
        if (direction) robot.yaw = Math.PI / 2 * direction;
      } else if (robot.type === 'scan') {
        robot.yaw = wrapAngle(robot.yaw + step * 2.4);
      } else {
        drift(robot, home, step * .95);
      }
      if (robot.phaseElapsed + EPSILON < robot.phaseDuration
          || !validPoint(player) || distance(robot, player) > ACTIVATION_RANGE || !walkLineIsClear(robot, player, layout)) return null;
      if (distance(robot, player) > .05) robot.yaw = heading(robot, player);
      setPhase(robot, 'telegraph', spec.telegraph);
      return null;
    }

    if (robot.phase === 'telegraph') moveDuringWarning(robot, home, step);
    if (robot.phaseElapsed + EPSILON < robot.phaseDuration) return null;
    if (robot.phase === 'telegraph') {
      setPhase(robot, 'vulnerable', spec.vulnerable);
      return validPoint(player) ? warningReached(robot, player) : null;
    }
    setPhase(robot, 'idle', spec.idle);
    return null;
  }

  function update(dt, player) {
    let remaining = Number.isFinite(dt) ? Math.min(Math.max(0, dt), 2) : 0;
    let feedback = null;
    while (remaining > EPSILON) {
      const step = Math.min(remaining, FIXED_STEP);
      remaining -= step;
      clock += step;
      state.pulseCooldown = Math.max(0, state.pulseCooldown - step);
      state.jammed = Math.max(0, state.jammed - step);
      for (const [index, robot] of robots.entries()) {
        const event = advanceRobot(robot, machineSpecs[index], homes[index], step, player);
        feedback ??= event;
      }
    }
    syncNearby(player);
    return feedback;
  }

  function pulse(player) {
    if (!validPoint(player) || !Number.isFinite(player.yaw)) return null;
    const event = { type: 'pulse', outcome: 'miss', x: player.x, z: player.z, yaw: player.yaw, distance: PULSE_RANGE };
    if (state.jammed > EPSILON) return { ...event, outcome: 'jammed', distance: 0 };
    if (state.pulseCooldown > EPSILON) return { ...event, outcome: 'cooldown', distance: 0 };

    state.pulseCooldown = .35;
    const target = nearest(player, robots, PULSE_RANGE, layout, (robot) =>
      robot.phase !== 'disabled' && (distance(player, robot) < .05
        || Math.abs(wrapAngle(heading(player, robot) - player.yaw)) <= PULSE_CONE));
    if (!target) return event;
    const targeted = {
      ...event, robotId: target.id, partId: target.partId, distance: distance(player, target),
      targetX: target.x, targetZ: target.z,
    };
    if (target.phase !== 'vulnerable') return { ...targeted, outcome: 'guarded' };
    target.integrity--;
    if (target.integrity > 0) {
      setPhase(target, 'recoil', .4);
      return { ...targeted, outcome: 'hit' };
    }
    setPhase(target, 'disabled', 0);
    const drop = drops.find((item) => item.partId === target.partId);
    const landing = movePlayer(target, Math.sin(target.yaw) * .48, Math.cos(target.yaw) * .48, layout, ROBOT_RADIUS);
    Object.assign(drop, { ...landing, yaw: target.yaw, visible: true });
    syncNearby(player);
    return { ...targeted, outcome: 'disabled' };
  }

  function interact(player) {
    if (!validPoint(player)) return null;
    syncNearby(player);
    const drop = state.nearbyDrop;
    if (!drop) return null;
    const progress = collectRecoveryPart(state.progress, drop.partId);
    if (!progress) return null;
    setProgress(progress);
    return { type: 'collect', id: drop.partId, partId: drop.partId, x: drop.x, z: drop.z, progress: state.progress };
  }

  function guide(id) {
    const project = nameAt(RECOVERY_RECIPES, id);
    const bench = layout.benches?.find((candidate) => candidate.id === (project?.bench ?? id));
    if (bench) {
      const spot = nearestStandable(bench, layout);
      return spot ? { ...spot, yaw: heading(spot, bench.target) } : null;
    }
    const drop = drops.find((item) => item.partId === id);
    if (drop?.collected) return null;
    if (drop?.visible) return approach(drop, [1.05, .8, .5], layout);
    const machine = robots.find((robot) => robot.id === id || robot.id === drop?.source);
    return machine && machine.phase !== 'disabled' ? approach(machine, [3.65, 3.3, 4, 2.9], layout) : null;
  }

  setProgress(initialProgress);
  return { layout, state, update, pulse, interact, guide, setProgress };
}
