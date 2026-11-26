import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Scene, Vector3 } from '../vendor/three/three.module.min.js';
import { isStandable, wrapAngle } from '../factory-motion.js';
import { createFactoryActivity } from '../factory-activity.js';

const layout = JSON.parse(readFileSync(new URL('../assets/factory-layout.json', import.meta.url), 'utf8'));

test('factory workers follow safe paths with continuous turns and grounded boots', () => {
  const scene = new Scene();
  const { active, update } = createFactoryActivity(scene, layout);
  const workers = scene.getObjectByName('Factory crew').children;
  assert.equal(active, true);
  assert.ok(workers.length >= 3 && workers.length <= 5);
  const start = workers.map(worker => worker.position.clone());
  const lastAngles = workers.map(worker => worker.rotation.y);
  const lastPositions = start.map(point => point.clone());
  const distance = workers.map(() => 0);
  let lift = 0;
  const world = new Vector3();
  for (let frame = 0; frame < 540; frame += 1) {
    update(.05);
    workers.forEach((worker, index) => {
      assert.ok(isStandable(worker.position, layout, .35), worker.name);
      assert.ok(Math.abs(wrapAngle(worker.rotation.y - lastAngles[index])) < .35, 'turns at a walkable pace');
      const step = worker.position.distanceTo(lastPositions[index]);
      assert.ok(step < .15, 'continuous movement without jumps');
      distance[index] += step;
      lastPositions[index].copy(worker.position);
      lastAngles[index] = worker.rotation.y;
      for (const side of ['left', 'right']) {
        const boot = worker.getObjectByName(`Boot ${side}`);
        boot.getWorldPosition(world);
        assert.ok(world.y >= boot.scale.y / 2 - .001, 'boot stays over the floor');
        lift = Math.max(lift, world.y - boot.scale.y / 2);
      }
    });
  }
  assert.ok(distance.every(length => length > 3), 'each worker actually patrols');
  assert.ok(lift > .08, 'the swing foot lifts clear of the ground');
});

test('the automation cells move articulated arms and carry parcels only on the two belt lanes', () => {
  const scene = new Scene();
  const { update } = createFactoryActivity(scene, layout);
  const automation = scene.getObjectByName('Factory automation');
  assert.equal(automation.children.length, 2);
  const cells = automation.children;
  const initial = cells.map(cell => cell.getObjectByName('Arm upper link').position.clone());
  const initialX = cells.map(cell => cell.getObjectByName('Belt parcel 1').position.x);
  let articulated = false;
  let lifted = false;
  let changed = false;
  for (let frame = 0; frame < 310; frame += 1) {
    update(.05);
    cells.forEach((cell, index) => {
      articulated ||= cell.getObjectByName('Arm upper link').position.distanceTo(initial[index]) > .18;
      const parcel = cell.getObjectByName('Belt parcel 1');
      assert.equal(parcel.position.z, index ? .4 : -5.7);
      assert.ok(parcel.position.x >= 23 && parcel.position.x <= 29);
      assert.ok(parcel.position.y >= .95);
      lifted ||= parcel.position.y >= 1.07;
      changed ||= Math.abs(parcel.position.x - initialX[index]) >= 1;
    });
  }
  assert.ok(articulated && lifted && changed);
});

test('reduced motion retains the factory details with static workers, belts, and arms', () => {
  const scene = new Scene();
  const { active, update } = createFactoryActivity(scene, layout, { reducedMotion: true });
  assert.equal(active, false);
  const tree = scene.toJSON();
  update(.06);
  update(45);
  assert.deepEqual(scene.toJSON(), tree);
  assert.ok(scene.getObjectByName('Factory crew').children.length >= 3);
  assert.equal(scene.getObjectByName('Factory automation').children.length, 2);
});
