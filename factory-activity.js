import * as THREE from './vendor/three/three.module.min.js';
import { clamp, isStandable, wrapAngle } from './factory-motion.js';

const floor = .005;
const beltTop = .95;
const armBase = .015;
const workerPaths = [
  ['warehouse', .86], ['assembly', .78], ['inspection', .93], ['repair', .72], ['automation', .82],
];
const lanes = [
  { belt: -5.7, mount: -7.1, offset: .65 },
  { belt: .4, mount: -1, offset: 2.15 },
];

const ease = value => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};

function patrolFor(path, layout, speed) {
  if (!path || path.length < 2) return null;
  const track = [...path, ...path.slice(0, -1).reverse()];
  const legs = [];
  for (let index = 1; index < track.length; index += 1) {
    const from = track[index - 1];
    const to = track[index];
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    if (distance === 0) continue;
    const samples = Math.ceil(distance / .14);
    for (let s = 0; s <= samples; s += 1) {
      const x = from.x + dx * s / samples;
      const z = from.z + dz * s / samples;
      if (!isStandable({ x, z }, layout, .4)) return null;
    }
    const ramp = Math.min(.36, distance / speed / 2);
    legs.push({ from, to, dx, dz, distance, yaw: Math.atan2(dx, dz), ramp, walk: distance / speed + ramp });
  }
  if (!legs.length) return null;
  for (const [index, leg] of legs.entries()) {
    leg.turn = wrapAngle(legs[(index + 1) % legs.length].yaw - leg.yaw);
    leg.wait = .54 + Math.abs(leg.turn) * .19;
  }
  return { legs, seconds: legs.reduce((sum, leg) => sum + leg.walk + leg.wait, 0), speed };
}

function posePatrol(route, time, pose) {
  let local = time % route.seconds;
  for (const leg of route.legs) {
    if (local < leg.walk) {
      const { ramp, walk } = leg;
      let pacedTime = local - ramp / 2;
      if (local < ramp) pacedTime = local ** 2 / (2 * ramp);
      else if (local > walk - ramp) pacedTime = walk - ramp - (walk - local) ** 2 / (2 * ramp);
      const walked = pacedTime * route.speed;
      const fraction = walked / leg.distance;
      pose.x = leg.from.x + leg.dx * fraction;
      pose.z = leg.from.z + leg.dz * fraction;
      pose.yaw = leg.yaw;
      pose.stride = walked / .86;
      pose.motion = ease(Math.min(local, walk - local) / ramp);
      return;
    }
    if (local < leg.walk + leg.wait) {
      pose.x = leg.to.x;
      pose.z = leg.to.z;
      pose.yaw = leg.yaw + leg.turn * ease((local - leg.walk) / leg.wait);
      pose.motion = 0;
      return;
    }
    local -= leg.walk + leg.wait;
  }
}

export function createFactoryActivity(scene, layout, { reducedMotion = false } = {}) {
  const cube = new THREE.BoxGeometry(1, 1, 1);
  const cylinder = new THREE.CylinderGeometry(.5, .5, 1, 12);
  const bevel = new THREE.CylinderGeometry(.41, .5, 1, 12);
  const shape = new THREE.SphereGeometry(.5, 10, 6);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const axle = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  const axis = new THREE.Vector3();
  const elbow = new THREE.Vector3();
  const shoulder = new THREE.Vector3();
  const hand = new THREE.Vector3();
  const knee = new THREE.Vector3();
  const ankle = new THREE.Vector3();
  const material = (color, metalness = 0, roughness = .72) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const trousers = material(0x344252);
  const jacket = material(0x344e6d);
  const teamLead = material(0x4c6784);
  const orange = material(0xd68451);
  const seam = material(0x283743);
  const reflection = material(0xd9e4e6, .14, .5);
  const skin = [0xbc7c60, 0xe8ad82, 0xb77b59, 0xdba780, 0xcd916e].map(color => material(color));
  const boot = material(0x232933);
  const metal = material(0x9ca9b7, .46, .43);
  const motor = material(0x435265, .58, .43);
  const armEnamel = material(0xc8ced0, .27, .36);
  const gasket = material(0x242e35, .1, .61);
  const safetyOrange = material(0xdc773b, .2, .45);
  const lensGlass = material(0x184558, .23, .2);
  const cardboard = material(0xab814e);
  const tape = material(0xe0c899);
  const crate = material(0x65839e);
  const foundation = new THREE.CylinderGeometry(.45, .5, 1, 8);
  const bolt = new THREE.CylinderGeometry(.5, .5, 1, 6);
  const housing = new THREE.LatheGeometry([
    [0, -.5], [.35, -.5], [.44, -.44], [.49, -.28], [.47, .28],
    [.42, .46], [.32, .5], [0, .5],
  ].map(([radius, height]) => new THREE.Vector2(radius, height)), 12);
  const linkShell = new THREE.LatheGeometry([
    [0, -.5], [.32, -.5], [.47, -.41], [.49, -.22], [.36, .24],
    [.38, .41], [.30, .5], [0, .5],
  ].map(([radius, height]) => new THREE.Vector2(radius, height)), 10);
  const harness = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(.141, -.45, .03), new THREE.Vector3(.203, -.29, .033),
    new THREE.Vector3(.193, .18, .03), new THREE.Vector3(.125, .44, .052),
  ]), 10, .016, 5, false);
  const fixtureTransform = new THREE.Matrix4();
  const fixturePosition = new THREE.Vector3();
  const fixtureScale = new THREE.Vector3(.064, .035, .064);
  const identity = new THREE.Quaternion();

  function group(parent, name, x = 0, y = 0, z = 0) {
    const object = new THREE.Group();
    object.name = name;
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  }

  function mesh(parent, name, x, y, z, width, height, depth, finish, geometry = cube) {
    const part = new THREE.Mesh(geometry, finish);
    part.name = name;
    part.position.set(x, y, z);
    part.scale.set(width, height, depth);
    parent.add(part);
    return part;
  }

  function link(part, from, to, width, depth) {
    axis.subVectors(to, from);
    part.position.copy(from).addScaledVector(axis, .5);
    part.scale.set(width, axis.length(), depth);
    part.quaternion.setFromUnitVectors(yAxis, axis.normalize());
  }

  function fasteners(parent) {
    const hardware = new THREE.InstancedMesh(bolt, metal, 4);
    hardware.name = 'Base anchor bolts';
    let index = 0;
    for (const x of [-.28, .28]) {
      for (const z of [-.24, .24]) {
        fixturePosition.set(x, .09, z);
        hardware.setMatrixAt(index++, fixtureTransform.compose(fixturePosition, identity, fixtureScale));
      }
    }
    parent.add(hardware);
  }

  function servo(parent, name, diameter, span) {
    const joint = group(parent, name);
    mesh(joint, 'Sealed servo barrel', 0, 0, 0, diameter, span, diameter, motor, cylinder);
    mesh(joint, 'Encoder cover', 0, span / 2, 0, diameter * .87, .083, diameter * .87, safetyOrange, housing);
    mesh(joint, 'Bearing plate', 0, -span / 2, 0, diameter * .78, .05, diameter * .78, safetyOrange, housing);
    return joint;
  }

  function armLink(parent, name, width, depth) {
    const assembly = group(parent, name);
    mesh(assembly, 'Tapered cast shell', 0, 0, 0, width, .90, depth, armEnamel, linkShell);
    mesh(assembly, 'Graphite seam', 0, -.20, 0, width * 1.014, .043, depth * 1.014, gasket, cylinder);
    mesh(assembly, 'Shielded cable loom', 0, 0, 0, 1, 1, 1, gasket, harness);
    return assembly;
  }

  const crew = group(scene, 'Factory crew');
  const workers = [];
  for (const [index, [id, speed]] of workerPaths.entries()) {
    const point = layout.points.find(zone => zone.id === id);
    const route = patrolFor(point?.path, layout, speed);
    if (!route) continue;
    const root = group(crew, `Factory worker ${id}`, 0, floor);
    const body = group(root, 'Worker body');
    const workwear = index % 2 ? teamLead : jacket;
    mesh(body, 'Jacket body', 0, 1.19, 0, .35, .54, .245, workwear);
    mesh(body, 'Cotton work jacket', 0, 1.275, .013, .38, .40, .245, workwear, bevel);
    mesh(body, 'Reflective band', 0, 1.18, .022, .382, .036, .247, reflection, cylinder);
    mesh(body, 'Jacket zipper', 0, 1.27, .143, .018, .24, .015, seam);
    mesh(body, 'Role patch', -.10, 1.336, .145, .079, .042, .013, reflection);
    mesh(body, 'Role patch accent', -.123, 1.336, .152, .014, .032, .008, orange);
    mesh(body, 'Belt', 0, .967, 0, .35, .075, .247, seam);
    mesh(body, 'Neck', 0, 1.475, 0, .11, .15, .11, skin[index], cylinder);
    mesh(body, 'Worker head', 0, 1.592, .008, .218, .252, .224, skin[index], shape);
    const cap = index === 0 ? orange : workwear;
    mesh(body, 'Protective cap', 0, 1.716, 0, .285, .176, .30, cap, shape);
    mesh(body, 'Cap brim', 0, 1.668, .019, .297, .031, .324, cap, cylinder);
    for (const eye of [-.044, .044]) mesh(body, 'Eye', eye, 1.605, .112, .016, .015, .008, seam);

    const limbs = [-1, 1].map(side => {
      const sideName = side < 0 ? 'left' : 'right';
      const arm = group(body, `Arm ${sideName}`, side * .237, 1.407, 0);
      mesh(arm, 'Upper sleeve', 0, -.146, 0, .125, .312, .132, workwear, bevel);
      const forearm = group(arm, 'Elbow pivot', 0, -.286);
      mesh(forearm, 'Forearm sleeve', 0, -.137, 0, .106, .288, .111, workwear, bevel);
      mesh(forearm, 'Work glove', 0, -.288, 0, .102, .132, .106, seam, shape);
      const upper = mesh(root, 'Upper trouser leg', 0, 0, 0, .144, .4, .157, trousers);
      const lower = mesh(root, 'Lower trouser leg', 0, 0, 0, .124, .4, .132, trousers);
      const shoe = mesh(root, `Boot ${sideName}`, 0, .047, 0, .138, .094, .268, boot);
      return { side, arm, forearm, upper, lower, shoe };
    });
    workers.push({
      root, body, route, limbs,
      offset: (index + 1) * 1.87,
      pose: { x: 0, z: 0, yaw: 0, stride: 0, motion: 0 },
    });
  }

  function applyWorker(worker, time) {
    const { root, body, pose, route, offset, limbs } = worker;
    posePatrol(route, offset + time, pose);
    const strength = reducedMotion ? 0 : pose.motion;
    const phase = pose.stride * Math.PI * 2;
    const bob = (1 - Math.cos(phase * 2)) * .011 * strength;
    root.position.set(pose.x, floor, pose.z);
    root.rotation.y = pose.yaw;
    body.position.y = bob;
    body.rotation.y = Math.sin(phase) * .06 * strength;
    for (const { side, arm, forearm, upper, lower, shoe } of limbs) {
      const cycle = (pose.stride + (side < 0 ? .5 : 0)) % 1;
      const stance = .58;
      const reach = .86 * stance;
      const swing = Math.max(0, (cycle - stance) / (1 - stance));
      const forward = cycle < stance ? reach / 2 - .86 * cycle : reach * (ease(swing) - .5);
      const rise = Math.sin(Math.PI * swing) ** 2 * .15 * strength;
      const x = side * .105;
      const y = .094 + rise;
      const z = forward * strength;
      shoe.position.set(x, .047 + rise, z + .061);
      shoulder.set(x, .888 + bob, 0);
      ankle.set(x, y, z);
      const kneeBend = Math.sqrt(Math.max(0, .428 ** 2 - shoulder.distanceToSquared(ankle) / 4));
      const length = shoulder.distanceTo(ankle);
      knee.copy(shoulder).lerp(ankle, .5);
      knee.y += z * kneeBend / length;
      knee.z += (shoulder.y - y) * kneeBend / length;
      link(upper, shoulder, knee, .145, .156);
      link(lower, knee, ankle, .127, .138);
      const opposite = Math.sin(phase + (side < 0 ? Math.PI : 0));
      arm.rotation.set(.44 * strength * opposite, 0, side * .12);
      forearm.rotation.x = -.11 - Math.max(0, opposite) * .25 * strength;
    }
  }

  const automation = group(scene, 'Factory automation');
  const cells = lanes.map((lane, index) => {
    const cell = group(automation, `Automation cell ${index + 1}`);
    const root = group(cell, 'Robot pedestal', 26.1, armBase, lane.mount);
    mesh(root, 'Beveled base plate', 0, .04, 0, .92, .08, .81, motor, foundation);
    fasteners(root);
    mesh(root, 'Stationary drive enclosure', 0, .20, 0, .66, .27, .62, motor, housing);
    mesh(root, 'Turntable bearing', 0, .33, 0, .58, .071, .56, gasket, cylinder);
    const turret = group(root, 'Robot turret');
    mesh(turret, 'Shoulder saddle', 0, .48, 0, .405, .32, .50, armEnamel, housing);
    const shoulderMotor = servo(root, 'Shoulder joint', .44, .43);
    const elbowMotor = servo(root, 'Elbow joint', .34, .36);
    const upper = armLink(root, 'Arm upper link', .44, .36);
    const forearm = armLink(root, 'Arm forearm', .33, .30);
    const tool = group(root, 'Tool head');
    const wrist = servo(tool, 'Wrist joint', .23, .24);
    wrist.rotation.z = Math.PI / 2;
    wrist.position.y = .102;
    mesh(tool, 'Tool flange', 0, .029, 0, .235, .052, .235, metal, cylinder);
    mesh(tool, 'Gripper actuator', 0, -.027, 0, .258, .087, .66, motor);
    mesh(tool, 'Jaw guide rail', 0, -.063, 0, .17, .036, .71, metal);
    const camera = group(tool, 'Package inspection camera', .181, -.016, .087);
    mesh(camera, 'Camera enclosure', 0, 0, 0, .111, .10, .122, gasket);
    mesh(camera, 'Optical glass', 0, -.048, 0, .081, .023, .081, lensGlass, cylinder);
    const opticalLight = new THREE.MeshStandardMaterial({ color: 0x79e0dd, emissive: 0x39c9ca, emissiveIntensity: .16 });
    mesh(camera, 'Vision status lamp', .054, .02, .037, .012, .018, .021, opticalLight);
    const jaws = [-1, 1].map(side => {
      const jaw = group(tool, 'Pallet gripper jaw');
      mesh(jaw, 'Jaw carrier', 0, -.063, -side * .055, .103, .06, .178, metal);
      mesh(jaw, 'Jaw finger', 0, -.135, .012 * side, .105, .154, .054, metal);
      mesh(jaw, 'Jaw pad', 0, -.142, -.021 * side, .092, .11, .029, gasket);
      return jaw;
    });
    const lamp = new THREE.MeshStandardMaterial({ color: 0x80aabf, emissive: 0x527d9a, emissiveIntensity: .29 });
    mesh(root, 'Status beacon mount', -.31, .206, -.235, .096, .245, .096, motor, cylinder);
    mesh(root, 'Status beacon lens', -.31, .355, -.235, .098, .092, .098, lamp, bevel);
    mesh(root, 'Safety stop button', .292, .175, .241, .084, .058, .084, safetyOrange, cylinder);

    const parcels = [0, 1].map(parcelIndex => {
      const parcel = group(cell, `Belt parcel ${parcelIndex + 1}`, 0, beltTop, lane.belt);
      const packaged = (parcelIndex + index) % 2 === 0;
      mesh(parcel, 'Parcel body', 0, .155, 0, .65, .31, .56, packaged ? cardboard : crate);
      mesh(parcel, 'Parcel top strip', 0, .312, 0, .091, .006, .557, packaged ? tape : metal);
      mesh(parcel, 'Parcel label', .16, .315, .09, .131, .004, .105, reflection);
      return parcel;
    });
    return { lane, root, turret, shoulderMotor, elbowMotor, upper, forearm, tool, jaws, lamp, opticalLight, parcels };
  });

  function applyAutomation(cell, time) {
    const { lane, root, turret, shoulderMotor, elbowMotor, upper, forearm, tool, jaws, lamp, opticalLight, parcels } = cell;
    let tracking = 0;
    let lowered = 0;
    let grip = 0;
    let lift = 0;
    let workingX = root.position.x;
    for (const [index, parcel] of parcels.entries()) {
      const offset = (time * .69 + lane.offset + index * 2.75) % 5.5;
      const x = 23.25 + offset;
      const approach = ease((x - 24.65) / .67) * ease((27.36 - x) / .65);
      const transfer = clamp((x - 25.65) / 1.0, 0, 1);
      const rise = Math.sin(transfer * Math.PI) ** 2 * .24;
      if (approach > tracking) {
        workingX = x;
        tracking = approach;
        lowered = ease((x - 25.13) / .42) * ease((27.03 - x) / .34);
        // Close before the lift window and open only after the workpiece is down.
        grip = ease((x - 25.35) / .27) * ease((26.95 - x) / .29);
        lift = rise;
      }
      parcel.position.set(x, beltTop + rise, lane.belt);
      const envelope = ease(offset / .24) * ease((5.5 - offset) / .24);
      parcel.scale.setScalar(Math.max(.01, envelope));
      parcel.visible = envelope > .015;
    }

    const shoulderHeight = .63;
    const travel = lane.belt - lane.mount;
    const targetX = .22 * (1 - tracking) + (workingX - root.position.x) * tracking;
    const targetY = 1.82 * (1 - lowered) + (beltTop + .42 + lift - armBase) * lowered;
    const targetZ = .95 * (1 - tracking) + travel * tracking;
    const reach = Math.hypot(targetX, targetZ);
    const yaw = Math.atan2(targetX, targetZ);
    const dy = targetY - shoulderHeight;
    const distance = Math.hypot(reach, dy);
    const upperLength = 1.03;
    const forearmLength = 1.15;
    const guess = (upperLength ** 2 + distance ** 2 - forearmLength ** 2) / (2 * upperLength * distance);
    const pitch = Math.atan2(dy, reach) + Math.acos(clamp(guess, -1, 1));
    const horizontal = Math.cos(pitch) * upperLength;
    shoulder.set(0, shoulderHeight, 0);
    elbow.set(Math.sin(yaw) * horizontal, shoulderHeight + Math.sin(pitch) * upperLength, Math.cos(yaw) * horizontal);
    hand.set(targetX, targetY, targetZ);

    turret.rotation.y = yaw;
    shoulderMotor.position.copy(shoulder);
    elbowMotor.position.copy(elbow);
    shoulderMotor.quaternion.setFromAxisAngle(yAxis, yaw).multiply(axle);
    elbowMotor.quaternion.copy(shoulderMotor.quaternion);
    link(upper, shoulder, elbow, 1, 1);
    link(forearm, elbow, hand, 1, 1);
    tool.position.copy(hand);
    tool.rotation.set(-.17 * (1 - lowered), yaw * (1 - tracking) * .65, 0, 'YXZ');
    const spread = .432 - .117 * grip;
    jaws[0].position.z = -spread;
    jaws[1].position.z = spread;
    const scanning = tracking > .13 && grip < .98;
    const transferring = grip >= .98;
    const statusColor = transferring ? 0x75e5a1 : scanning ? 0xffad56 : 0x78aed1;
    lamp.color.setHex(statusColor);
    lamp.emissive.copy(lamp.color);
    lamp.emissiveIntensity = transferring ? .60 : scanning ? .51 : .24;
    opticalLight.emissiveIntensity = scanning ? .86 : .15;
  }

  let seconds = 0;
  function renderFrame() {
    for (const worker of workers) applyWorker(worker, seconds);
    for (const cell of cells) applyAutomation(cell, seconds);
  }
  renderFrame();

  return {
    active: !reducedMotion,
    update(deltaSeconds) {
      if (reducedMotion || !Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return;
      seconds += Math.min(deltaSeconds, .10);
      renderFrame();
    },
  };
}
