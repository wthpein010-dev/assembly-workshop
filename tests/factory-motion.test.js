import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EYE_HEIGHT, PLAYER_RADIUS, movementVector, movePlayer, nearestStandable,
  isStandable, sampleCameraTransition, wrapAngle, overviewDistance, shiftOverview, dampOverview,
  benchCameraPose, nearbyBench, spreadBadgePositions,
} from '../factory-motion.js';

const layout = {
  bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
  obstacles: [{ minX: 2, maxX: 2.03, minZ: -1, maxZ: 1 }],
};

const close = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} ≈ ${expected}`);

test('movement follows the camera and preserves analog stick magnitude', () => {
  const forward = movementVector(Math.PI / 2, 0, 0.4);
  close(forward.x, 0.4);
  close(forward.z, 0);
  const right = movementVector(0, 1, 0);
  close(right.x, -1);
  close(right.z, 0);
});

test('diagonal movement never exceeds straight movement speed', () => {
  const vector = movementVector(0, 1, 1);
  close(Math.hypot(vector.x, vector.z), 1);
  assert.ok(vector.x < 0 && vector.z > 0);
});

test('large movement cannot tunnel through narrow equipment', () => {
  const result = movePlayer({ x: 0, z: 0 }, 4, 0, layout);
  close(result.x, 2 - PLAYER_RADIUS);
  close(result.z, 0);
});

test('movement slides along the side of equipment and clamps to the hull', () => {
  const result = movePlayer({ x: 2 - PLAYER_RADIUS, z: 0 }, 0.7, 0.8, layout);
  close(result.x, 2 - PLAYER_RADIUS);
  close(result.z, 0.8);
  const edge = movePlayer({ x: -4, z: -4 }, -2, -2, layout);
  close(edge.x, -5 + PLAYER_RADIUS);
  close(edge.z, -5 + PLAYER_RADIUS);
});

test('a waypoint inside equipment resolves to nearby walkable space', () => {
  const point = { x: 2.02, z: 0 };
  assert.equal(isStandable(point, layout), false);
  const landing = nearestStandable(point, layout);
  assert.ok(landing);
  assert.ok(isStandable(landing, layout));
  assert.ok(Math.hypot(landing.x - point.x, landing.z - point.z) < 0.65);
});

test('transition endpoints keep the exact camera pose and walking eye height', () => {
  const overhead = { x: 30, y: 30, z: 23, yaw: -2.2, pitch: -Math.PI / 4, fov: 40 };
  const eye = { x: -2, y: EYE_HEIGHT, z: 3, yaw: 0.8, pitch: 0, fov: 66 };
  assert.deepEqual(sampleCameraTransition(overhead, eye, -0.1, 4), overhead);
  assert.deepEqual(sampleCameraTransition(overhead, eye, 1.2, 4), eye);
  close(EYE_HEIGHT, 1.62);
  assert.ok(sampleCameraTransition(overhead, eye, 0.5, 4).y > (overhead.y + eye.y) / 2);
});

test('camera turns take the shortest path across the angle seam', () => {
  const from = { x: 2, y: 7, z: 4, yaw: 179 * Math.PI / 180, pitch: -0.7, fov: 45 };
  const to = { ...from, yaw: -179 * Math.PI / 180 };
  const mid = sampleCameraTransition(from, to, 0.5);
  close(Math.abs(mid.yaw), Math.PI);
  close(wrapAngle(3 * Math.PI / 2), -Math.PI / 2);
});

test('long waypoint flights take off and land before moving through nearby equipment', () => {
  const from = { x: -3, y: EYE_HEIGHT, z: -2, yaw: 0, pitch: 0, fov: 66 };
  const to = { ...from, x: 7, z: 8 };
  const takeoff = sampleCameraTransition(from, to, 0.25, 4.0, 0.24);
  assert.equal(takeoff.x, from.x);
  assert.equal(takeoff.z, from.z);
  assert.ok(takeoff.y > EYE_HEIGHT);
  const landing = sampleCameraTransition(from, to, 0.75, 4.0, 0.24);
  assert.equal(landing.x, to.x);
  assert.equal(landing.z, to.z);
  assert.ok(landing.y > EYE_HEIGHT);
});

const factoryBounds = { minX: -19.57, maxX: 29.55, minZ: -12.1, maxZ: 12.12 };

test('overview fills a desktop viewport and accepts side crops on narrow screens', () => {
  const azimuth = Math.atan2(30, 42);
  const desktop = overviewDistance(factoryBounds, 1.6, azimuth, 37);
  const narrow = overviewDistance(factoryBounds, 0.62, azimuth, 37);
  assert.ok(desktop > 42 && desktop < 58, `desktop distance ${desktop}`);
  assert.ok(narrow >= desktop && narrow < desktop * 1.25, `narrow distance ${narrow}`);
});

test('overhead panning moves in view directions and stays in factory bounds', () => {
  const start = { x: 0, z: 0, zoom: 0.7 };
  assert.deepEqual(shiftOverview(start, factoryBounds, 0, 4, 3), { x: 4, z: -3, zoom: 0.7 });
  const edge = shiftOverview(start, factoryBounds, 0, 300, 300);
  assert.ok(edge.x <= factoryBounds.maxX && edge.z >= factoryBounds.minZ);
  assert.ok(edge.x > 25 && edge.z < -10);
});

test('overview easing preserves similar movement at different frame rates', () => {
  const start = { x: 0, z: 0, zoom: 1 };
  const target = { x: 12, z: -6, zoom: 0.55 };
  const short = dampOverview(dampOverview(start, target, 1 / 60), target, 1 / 60);
  const long = dampOverview(start, target, 1 / 30);
  close(short.x, long.x);
  close(short.z, long.z);
  close(short.zoom, long.zoom);
  assert.ok(long.x > 0 && long.x < target.x && long.zoom < start.zoom && long.zoom > target.zoom);
});

test('nearby interaction takes the nearest reachable bench from this side of equipment', () => {
  const blocked = { id: 'behind', x: 2.45, z: 0 };
  const reachable = { id: 'front', x: 1.2, z: 1.15 };
  const farther = { id: 'far', x: 1.6, z: -1.9 };
  const workroom = { ...layout, benches: [blocked, reachable, farther] };
  assert.equal(nearbyBench({ x: 1.6, z: 0 }, workroom), reachable);
  assert.equal(nearbyBench({ x: -2, z: 0 }, workroom), null);
});

test('bench camera stays at natural eye height and sights the worktop from a legal aisle', () => {
  const bench = { x: 0, z: 2, target: { x: 0.16, y: 1.04, z: 1.14 } };
  const pose = benchCameraPose(bench, layout);
  assert.ok(isStandable(pose, layout));
  close(pose.y, EYE_HEIGHT);
  const rise = Math.tan(pose.pitch) * Math.hypot(bench.target.x - pose.x, bench.target.z - pose.z);
  close(pose.y + rise, bench.target.y);
  close(pose.x + Math.sin(pose.yaw) * Math.hypot(bench.target.x - pose.x, bench.target.z - pose.z), bench.target.x);
  assert.ok(pose.pitch < -0.1 && pose.pitch > -0.48);
  assert.ok(pose.fov >= 44 && pose.fov <= 53);
});

test('bench camera gives up extra retreat before crossing a wall', () => {
  const bench = { x: 0, z: 4.65, target: { x: 0, y: 1.05, z: 3.9 } };
  const pose = benchCameraPose(bench, layout);
  assert.ok(isStandable(pose, layout));
  close(pose.z, layout.bounds.maxZ - PLAYER_RADIUS);
});

test('crowded overhead badges separate while staying close to their worktops', () => {
  const anchors = [{ x: 74, y: 49 }, { x: 81, y: 52 }, { x: 173, y: 126 }];
  const badges = spreadBadgePositions(anchors, 34, 20);
  assert.ok(Math.hypot(badges[1].x - badges[0].x, badges[1].y - badges[0].y) >= 33.9);
  assert.deepEqual(badges[2], anchors[2]);
  assert.ok(Math.hypot(badges[0].x - anchors[0].x, badges[0].y - anchors[0].y) <= 20);
});
