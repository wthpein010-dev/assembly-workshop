import * as THREE from './vendor/three/three.module.min.js';
import { RECOVERY_RECIPES } from './factory-recovery.js';

const FLOOR = .039;
const SIGNAL_BLUE = 0x66c9f5;
const EQUIPMENT_ORANGE = 0xef8a4d;
const AMBER = 0xffb65b;
const GREEN = 0x76f593;
const palettes = {
  sweep: { width: .93, length: .83, eye: .77, top: .94, offset: .21 },
  scan: { width: .75, length: .70, eye: 1.16, top: 1.37, offset: .14 },
  dash: { width: .84, length: 1.02, eye: .87, top: 1.06, offset: .29 },
};

const limit = (value, low, high) => Math.max(low, Math.min(high, value));
const partId = part => typeof part === 'string' ? part : part?.id;

function createKit() {
  const box = new THREE.BoxGeometry();
  const shape = new THREE.Shape();
  [[-.44, -.36], [-.36, -.44], [.36, -.44], [.44, -.36], [.44, .36], [.36, .44], [-.36, .44], [-.44, .36]]
    .forEach(([x, y], index) => index ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const shell = new THREE.ExtrudeGeometry(shape, {
    depth: .88, bevelEnabled: true, bevelSize: .06, bevelThickness: .06, bevelSegments: 2, steps: 1,
  }).translate(0, 0, -.44);
  const cylinder = new THREE.CylinderGeometry(.5, .5, 1, 16);
  const hex = new THREE.CylinderGeometry(.5, .5, 1, 6);
  const ring = new THREE.RingGeometry(.86, 1, 48);
  const disk = new THREE.PlaneGeometry(1, 1);
  const metal = (color, metalness = 0, roughness = .58) => new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const led = (color, strength = 1) => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: strength, roughness: .29, metalness: .13,
  });
  const glow = (color, opacity) => new THREE.MeshBasicMaterial({
    color, opacity, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide,
  });
  const materials = {
    frame: metal(0x313e50, .32), runner: metal(0x161f2b, .1, .72), dark: metal(0x232f42, .24),
    panel: metal(0x516b83, .35, .47), steel: metal(0xa7b2be, .63, .38), graphite: metal(0x586776, .52),
    stripe: metal(EQUIPMENT_ORANGE, .19, .39), painted: metal(0x426f94, .26, .42), circuit: metal(0x318067, .13),
    gold: metal(0xdc8645, .48, .38), pearl: metal(0xe4e0d6, .24), amber: led(AMBER, .39),
    signal: led(SIGNAL_BLUE, .61), ready: led(GREEN, .85),
  };
  function mesh(group, material, x, y, z, w, h, d, geometry = box) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    part.scale.set(w, h, d);
    part.receiveShadow = material.isMeshStandardMaterial;
    group.add(part);
    return part;
  }
  function flat(group, material, y, size, geometry = ring) {
    const mark = mesh(group, material, 0, y, 0, size, size, 1, geometry);
    mark.rotation.x = -Math.PI / 2;
    mark.renderOrder = 2;
    return mark;
  }
  const shadow = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 coord; void main(){coord=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'varying vec2 coord; void main(){float f=length((coord-.5)*2.); gl_FragColor=vec4(.02,.035,.03,(1.-smoothstep(.16,1.,f))*.60);}',
  });
  function contact(group, width, depth, y = FLOOR - .011) {
    const shade = flat(group, shadow, y, 1, disk);
    shade.scale.set(width, depth, 1);
    return shade;
  }
  return { shell, cylinder, hex, materials, led, glow, mesh, flat, contact };
}

function label(group, doc, name, tint, y, width = .88) {
  const image = doc?.createElement?.('canvas');
  if (!image) return null;
  image.width = 256;
  image.height = 72;
  const draw = image.getContext('2d');
  if (!draw) return null;
  draw.fillStyle = '#172d45';
  draw.fillRect(2, 7, 252, 58);
  draw.strokeStyle = '#6e8eac';
  draw.lineWidth = 2;
  draw.strokeRect(3, 8, 250, 56);
  draw.fillStyle = new THREE.Color(tint).getStyle();
  draw.fillRect(7, 13, 5, 46);
  draw.fillStyle = '#eff6ff';
  draw.font = '600 35px "Microsoft YaHei", system-ui, sans-serif';
  draw.textAlign = 'center';
  draw.textBaseline = 'middle';
  draw.fillText(name, 132, 37, 224);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, toneMapped: false }));
  sprite.position.y = y;
  sprite.scale.set(width, width * 72 / 256, 1);
  group.add(sprite);
  return sprite;
}

function robotModel(bot, kit, doc) {
  const { mesh, flat, contact, shell, cylinder, hex, materials: m, glow, led } = kit;
  const shape = palettes[bot.type] || palettes.sweep;
  const { width, length, eye: eyeY, top, offset } = shape;
  const root = new THREE.Group();
  root.name = `fault-robot-${bot.id}`;
  contact(root, width * 1.48, length * 1.54);

  const body = new THREE.Group();
  root.add(body);
  mesh(body, m.runner, 0, .23, 0, width * .76, .31, length * .88, shell);
  mesh(body, m.frame, 0, .46, -.045, width * .79, .40, length * .74, shell);
  mesh(body, m.painted, 0, .57, length * .19, width * .69, .12, .24, shell);
  const wheelPods = [];
  for (const side of [-1, 1]) {
    const pod = new THREE.Group();
    pod.position.x = side * width * .38;
    root.add(pod);
    wheelPods.push(pod);
    mesh(pod, m.runner, 0, .155, 0, .247, .315, length, shell);
    mesh(pod, m.panel, side * .11, .155, 0, .045, .17, length * .77, shell);
    for (const z of [-1, 1]) {
      const rim = mesh(pod, m.graphite, side * .137, .151, z * length * .25, .181, .044, .181, cylinder);
      rim.rotation.z = Math.PI / 2;
    }
    mesh(body, m.stripe, side * width * .36, .48, .015, .153, .223, length * .55, shell)
      .rotation.z = side * -.24;
  }

  if (bot.type === 'scan') {
    mesh(body, m.steel, 0, .78, -.075, .29, .63, .27, shell);
    mesh(body, m.painted, 0, .865, .032, .36, .26, .256, shell);
    mesh(body, m.stripe, .13, top + .07, -.18, .025, .235, .028, cylinder).rotation.z = -.22;
    mesh(body, m.amber, .15, top + .18, -.18, .067, .07, .067, hex);
  } else if (bot.type === 'dash') {
    for (const side of [-1, 1]) {
      mesh(body, m.stripe, .22 * side, .32, .42, .29, .22, .262, shell).rotation.y = .32 * side;
      mesh(body, m.panel, .255 * side, .66, -.34, .19, .575, .28, shell).rotation.x = -.22;
    }
    mesh(body, m.gold, 0, .56, -.34, .44, .1, .125, shell);
  } else {
    const roller = mesh(body, m.steel, 0, .272, .43, .16, .61, .16, cylinder);
    roller.rotation.z = Math.PI / 2;
    for (const x of [-.21, 0, .21]) {
      mesh(body, m.painted, x, .272, .43, .198, .074, .198, cylinder).rotation.z = Math.PI / 2;
    }
  }

  const head = new THREE.Group();
  head.position.set(0, eyeY, bot.type === 'scan' ? .09 : -.022);
  body.add(head);
  const nose = bot.type === 'dash' ? .32 : .265;
  const span = bot.type === 'scan' ? .48 : width * .77;
  mesh(head, m.stripe, 0, .038, -.026, span, .32, .46, shell).rotation.x = -.14;
  mesh(head, m.dark, 0, -.015, nose - .074, span * .83, .184, .171, shell);
  const eye = led(SIGNAL_BLUE, .91);
  const optic = mesh(head, eye, -offset * .68, -.011, nose + .01, .132, .058, .122, hex);
  optic.rotation.x = Math.PI / 2;
  mesh(head, m.steel, -offset * .68, -.011, nose + .044, .054, .012, .054, cylinder).rotation.x = Math.PI / 2;
  mesh(head, eye, offset * .74, -.013, nose + .014, .119, .028, .026, shell).rotation.z = -.10;
  mesh(head, m.pearl, 0, .108, .119, span * .59, .028, .108, shell);
  mesh(body, m.dark, 0, .519, length * .451, .289, .143, .039, shell);
  const core = led(SIGNAL_BLUE, .92);
  mesh(body, core, 0, .515, length * .475, .104, .068, .12, hex).rotation.x = Math.PI / 2;
  for (const x of [-.145, .145]) mesh(body, m.steel, x, .515, length * .481, .025, .069, .018, shell);

  const field = new THREE.Group();
  field.name = 'shield';
  field.position.set(0, eyeY - .14, length * .52 + .065);
  root.add(field);
  const shield = glow(SIGNAL_BLUE, .14);
  const edge = glow(SIGNAL_BLUE, .48);
  const spanField = width * .94;
  mesh(field, shield, 0, .015, .024, spanField, .53, .036, shell);
  for (const side of [-1, 1]) {
    mesh(field, edge, side * spanField * .443, .026, .049, .023, .37, .024, shell).rotation.z = side * .21;
    mesh(field, shield, side * spanField * .50, .015, -.027, .21, .365, .024, shell).rotation.y = side * .63;
  }
  mesh(field, edge, 0, .264, .039, spanField * .60, .02, .022, shell);
  mesh(field, edge, 0, -.223, .039, spanField * .60, .02, .022, shell);

  const warning = new THREE.Group();
  warning.name = 'telegraph';
  root.add(warning);
  const warningMat = glow(AMBER, .38);
  const warningFill = glow(AMBER, .12);
  const attackRange = limit(bot.range || 1.65, 1.2, 2.75);
  const arc = bot.type === 'scan' ? Math.PI : bot.type === 'dash' ? .48 : .78;
  const start = Math.PI * 1.5 - arc;
  flat(warning, warningMat, FLOOR + .003, attackRange, new THREE.RingGeometry(.94, 1, 40, 1, start, arc * 2));
  flat(warning, warningFill, FLOOR + .002, attackRange, new THREE.RingGeometry(.22, .94, 40, 1, start, arc * 2));
  if (bot.type !== 'scan') {
    const arrow = new THREE.Group();
    arrow.position.set(0, FLOOR + .01, attackRange * .82);
    warning.add(arrow);
    for (const side of [-1, 1]) {
      mesh(arrow, warningMat, side * .103, 0, .015, .05, .011, .28).rotation.y = side * -.67;
    }
  }
  const exposed = flat(root, glow(SIGNAL_BLUE, .68), FLOOR + .006, width * .79);
  exposed.name = 'exposed';
  const tag = label(root, doc, bot.name, SIGNAL_BLUE, top + .36, 1.05);
  return { root, body, head, wheelPods, field, shield, edge, eye, core, warning, warningMat, warningFill, exposed, tag,
    signature: '', kick: 0, guarded: false };
}

function partModel(id, root, kit) {
  const { mesh, shell, cylinder, hex, materials: m } = kit;
  if (id === 'memory') {
    mesh(root, m.circuit, 0, 0, 0, .54, .177, .053, shell);
    mesh(root, m.steel, 0, .071, .029, .491, .028, .023, shell);
    for (let index = 0; index < 4; index++) mesh(root, m.runner, -.162 + index * .109, .012, .037, .073, .067, .024, shell);
    mesh(root, m.gold, -.123, -.072, .033, .22, .028, .017);
    mesh(root, m.gold, .139, -.072, .033, .192, .028, .017);
  } else if (id === 'drive') {
    mesh(root, m.panel, 0, 0, 0, .36, .283, .077, shell);
    mesh(root, m.steel, 0, .006, .049, .345, .24, .041, shell);
    mesh(root, m.dark, .018, -.01, .075, .218, .115, .025, shell);
    mesh(root, m.gold, -.091, -.119, .045, .118, .047, .026, shell);
    mesh(root, m.signal, .062, .021, .094, .068, .022, .016, shell);
  } else if (id === 'harness') {
    for (const [index, material] of [m.painted, m.gold, m.runner].entries()) {
      const r = index * .037;
      const path = new THREE.CatmullRomCurve3([
        [-.21, -.09, .02], [-.21 + r, .099, .012], [-.09 + r, .166 - r, 0], [.064, .154 - r, .022],
        [.171 - r, .034, .051], [.18 - r, -.121, .023],
      ].map(values => new THREE.Vector3(...values)));
      mesh(root, material, 0, 0, 0, 1, 1, 1, new THREE.TubeGeometry(path, 20, .018, 6, false));
    }
    mesh(root, m.pearl, -.171, -.104, .021, .143, .092, .101, shell);
    mesh(root, m.dark, .14, -.128, .021, .162, .096, .113, shell);
  } else if (id === 'fan') {
    mesh(root, m.dark, 0, 0, 0, .427, .427, .096, shell);
    mesh(root, m.steel, 0, 0, .048, .351, .023, .351, cylinder).rotation.x = Math.PI / 2;
    mesh(root, m.runner, 0, 0, .063, .318, .026, .318, cylinder).rotation.x = Math.PI / 2;
    for (let index = 0; index < 5; index++) {
      const hub = new THREE.Group();
      hub.rotation.z = index * Math.PI * .4;
      root.add(hub);
      mesh(hub, m.painted, .029, .092, .075, .083, .156, .025, shell).rotation.z = .38;
    }
    mesh(root, m.steel, 0, 0, .099, .119, .046, .119, hex).rotation.x = Math.PI / 2;
  } else if (id === 'sensor') {
    mesh(root, m.stripe, 0, -.098, -.018, .36, .093, .22, shell);
    mesh(root, m.dark, 0, .014, -.009, .265, .192, .249, shell);
    mesh(root, m.steel, 0, .026, .126, .185, .138, .185, hex).rotation.x = Math.PI / 2;
    mesh(root, m.signal, 0, .026, .191, .123, .035, .123, cylinder).rotation.x = Math.PI / 2;
    mesh(root, m.amber, .129, .086, .124, .04, .022, .038, shell);
  } else {
    mesh(root, m.pearl, 0, 0, 0, .387, .268, .14, shell);
    mesh(root, m.dark, .018, .032, .076, .228, .132, .029, shell);
    mesh(root, m.signal, -.029, .058, .096, .034, .023, .014, shell);
    mesh(root, m.amber, .024, .058, .096, .034, .023, .014, shell);
    for (const x of [-.136, -.068, 0, .068, .136]) mesh(root, m.painted, x, -.089, .084, .05, .068, .045, shell);
  }
}

function dropModel(drop, kit, doc) {
  const tint = new THREE.Color(drop.color ?? SIGNAL_BLUE);
  const root = new THREE.Group();
  root.name = `recovery-part-${drop.partId}`;
  kit.contact(root, .95, .91);
  const halo = kit.glow(tint, .66);
  const ring = kit.flat(root, halo, FLOOR + .008, .485);
  const inner = kit.flat(root, kit.glow(tint, .29), FLOOR + .013, .31);
  const pivot = new THREE.Group();
  root.add(pivot);
  partModel(drop.partId, pivot, kit);
  const tag = label(root, doc, drop.name, tint, 1.13, .92);
  return { root, halo, ring, inner, pivot, tag };
}

function projectModel(recipe, bench, kit) {
  const { mesh, contact, shell, cylinder, materials: m } = kit;
  const root = new THREE.Group();
  root.name = `installed-project-${recipe.id}`;
  const yaw = Math.atan2(bench.x - bench.target.x, bench.z - bench.target.z);
  const offset = recipe.id === 'tester' ? -.51 : .56;
  root.position.set(bench.target.x + Math.cos(yaw) * offset, bench.target.y + .022,
    bench.target.z - Math.sin(yaw) * offset + .02);
  root.rotation.y = yaw;
  contact(root, .72, .62, .002);

  mesh(root, m.runner, 0, .048, 0, .49, .086, .37, shell);
  mesh(root, m.steel, 0, .097, .015, .465, .025, .327, shell);
  if (recipe.id === 'tester') {
    mesh(root, m.frame, .019, .353, -.018, .384, .485, .268, shell);
    mesh(root, m.painted, .018, .33, .121, .339, .369, .052, shell);
    mesh(root, m.runner, .014, .43, .154, .274, .16, .025, shell);
    for (const x of [-.065, .003, .071]) mesh(root, m.ready, x, .421, .176, .033, .048, .013, shell);
    for (const y of [.204, .237, .27]) mesh(root, m.dark, .048, y, .148, .207, .014, .017);
    mesh(root, m.gold, -.103, .239, .148, .075, .098, .022, shell);
  } else {
    mesh(root, m.panel, 0, .249, -.04, .47, .308, .245, shell);
    const face = mesh(root, m.dark, 0, .303, .103, .391, .203, .032, shell);
    face.rotation.x = -.42;
    const screen = mesh(root, m.painted, -.013, .319, .121, .254, .139, .025, shell);
    screen.rotation.x = face.rotation.x;
    for (const [index, height] of [.035, .056, .042, .075].entries()) {
      mesh(root, m.ready, -.101 + index * .052, .277 + height / 2, .142, .018, height, .018);
    }
    mesh(root, m.gold, .153, .275, .147, .026, .047, .021, shell);
  }
  const indicator = mesh(root, m.ready, 0, .149, .186, .072, .02, .058, cylinder);
  indicator.rotation.x = Math.PI / 2;
  root.visible = false;
  return root;
}

function effectPool(root, kit) {
  const wave = new THREE.RingGeometry(.84, 1, 36, 1, Math.PI * 1.5 - .58, 1.16);
  const slots = Array.from({ length: 4 }, () => {
    const group = new THREE.Group();
    group.visible = false;
    const mat = kit.glow(SIGNAL_BLUE, .65);
    const arc = kit.flat(group, mat, FLOOR + .021, 1, wave);
    const ring = kit.flat(group, mat, FLOOR + .019, 1);
    const sparks = Array.from({ length: 4 }, () => kit.mesh(group, mat, 0, 0, 0, .042, .075, .042, kit.hex));
    root.add(group);
    return { group, mat, arc, ring, sparks, time: 0 };
  });
  let slotIndex = 0;
  return {
    burst({ x, z, yaw = 0, distance = 1, tint = SIGNAL_BLUE, kind = 'wave' }) {
      const slot = slots[slotIndex];
      slotIndex = (slotIndex + 1) % slots.length;
      Object.assign(slot, { kind, distance, time: 0 });
      slot.group.visible = true;
      slot.group.position.set(x, 0, z);
      slot.group.rotation.y = yaw;
      slot.mat.color.set(tint);
    },
    update(delta, reducedMotion) {
      let changed = false;
      for (const slot of slots) {
        if (!slot.group.visible) continue;
        changed = true;
        const t = slot.time / (slot.kind === 'wave' ? .28 : .35);
        slot.time += delta;
        if (t >= 1) {
          slot.group.visible = false;
          continue;
        }
        const progress = reducedMotion ? .33 : 1 - (1 - t) ** 3;
        const isWave = slot.kind === 'wave';
        slot.mat.opacity = .76 * (1 - t) ** 1.25;
        slot.arc.visible = isWave;
        slot.ring.visible = !isWave;
        slot.arc.scale.setScalar(.40 + progress * slot.distance);
        slot.ring.scale.setScalar(.17 + progress * .59);
        slot.sparks.forEach((spark, index) => {
          spark.visible = !isWave;
          if (isWave) return;
          const angle = index * Math.PI / 2 + .46;
          const radius = .07 + progress * .38;
          spark.position.set(Math.sin(angle) * radius, (slot.kind === 'hit' ? .54 : .33) + progress * .37,
            Math.cos(angle) * radius);
          spark.rotation.set(progress * 2, angle, -.6);
        });
      }
      return changed;
    },
  };
}

function robotPose(model, bot, delta, time, player, reducedMotion) {
  const disabled = bot.phase === 'disabled';
  const telegraph = bot.phase === 'telegraph';
  const exposed = bot.phase === 'vulnerable' || bot.phase === 'recoil';
  const near = Math.hypot(player.x - bot.x, player.z - bot.z) < 4.1;
  const progress = limit(bot.phaseElapsed / (bot.phaseDuration || 1), 0, 1);
  const phaseTone = disabled ? 0x344244 : telegraph || model.guarded && model.kick > 0 ? AMBER : SIGNAL_BLUE;
  const signature = `${bot.phase}/${bot.x}/${bot.z}/${bot.yaw}/${near}/${model.kick > 0}`;
  const changed = model.signature !== signature;
  model.signature = signature;
  model.root.position.set(bot.x, 0, bot.z);
  model.root.rotation.y = bot.yaw || 0;
  model.kick = Math.max(0, model.kick - delta * 3.6);
  const kick = reducedMotion ? 0 : model.kick * Math.sin((1 - model.kick) * 6.1);
  const idle = !reducedMotion && !disabled ? Math.sin(time * 2.15 + bot.x) : 0;
  const windup = !reducedMotion && telegraph ? progress ** 1.35 : 0;
  model.body.position.set(-kick * .05, disabled ? -.072 : idle * .018 - windup * .041, -kick * .22 - windup * .063);
  model.body.scale.y = disabled ? .77 : 1 + kick * .07 - windup * .04;
  model.body.rotation.set(disabled ? .11 : kick * -.36 - windup * .16, idle * .012, disabled ? -.075 : kick * .19);
  model.head.rotation.y = disabled ? -.19 : idle * .11;
  model.wheelPods.forEach((pod, i) => { pod.rotation.z = kick * (i ? .055 : -.055); });
  model.eye.color.set(phaseTone);
  model.eye.emissive.set(disabled ? 0 : phaseTone);
  model.eye.emissiveIntensity = telegraph ? .82 + windup * .74 : .88 + model.kick * .45;
  model.core.color.set(disabled ? 0x3f554e : exposed ? 0x9affdd : 0x388677);
  model.core.emissive.set(disabled ? 0 : SIGNAL_BLUE);
  model.core.emissiveIntensity = exposed ? 1.43 + idle * .28 : .23;
  model.field.visible = !disabled && !exposed;
  model.shield.color.set(phaseTone);
  model.edge.color.set(phaseTone);
  model.shield.opacity = telegraph ? .18 + windup * .075 : .11 + model.kick * .21;
  model.edge.opacity = telegraph ? .62 : .42 + model.kick * .31;
  model.warning.visible = telegraph;
  model.warningMat.opacity = telegraph ? .31 + windup * .5 : 0;
  model.warningFill.opacity = telegraph ? .09 + windup * .16 : 0;
  model.exposed.visible = exposed;
  model.exposed.material.opacity = .66 + idle * .15;
  if (model.tag) model.tag.visible = !disabled && near;
  return changed || model.kick > 0 || !reducedMotion && !disabled;
}

export function createRecoveryVisuals(scene, simulation, { document: doc, reducedMotion = false, layout = simulation.layout } = {}) {
  const root = new THREE.Group();
  root.name = 'factory-recovery-visuals';
  scene.add(root);
  const kit = createKit();
  const robots = new Map();
  const drops = new Map();
  const projects = new Map();
  const effects = effectPool(root, kit);
  let time = 0;

  for (const recipe of Object.values(RECOVERY_RECIPES)) {
    const bench = layout?.benches?.find(item => item.id === recipe.bench);
    if (!bench) continue;
    const model = projectModel(recipe, bench, kit);
    root.add(model);
    projects.set(recipe.id, model);
  }

  function update(dt = 0, player = { x: Infinity, z: Infinity }) {
    const delta = limit(dt, 0, .10);
    time += delta;
    const { state } = simulation;
    let changed = effects.update(delta, reducedMotion);
    for (const bot of state.robots) {
      if (!robots.has(bot.id)) {
        const model = robotModel(bot, kit, doc);
        root.add(model.root);
        robots.set(bot.id, model);
      }
      changed = robotPose(robots.get(bot.id), bot, delta, time, player, reducedMotion) || changed;
    }
    for (const drop of state.drops) {
      if (!drops.has(drop.id)) {
        const model = dropModel(drop, kit, doc);
        root.add(model.root);
        drops.set(drop.id, model);
      }
      const model = drops.get(drop.id);
      const visible = Boolean(drop.visible && !drop.collected);
      changed ||= model.root.visible !== visible;
      model.root.visible = visible;
      if (!visible) continue;
      const near = Math.hypot(player.x - drop.x, player.z - drop.z) < 4.7;
      const selected = partId(state.nearbyDrop) === drop.id;
      const yaw = drop.yaw || 0;
      const bob = reducedMotion ? 0 : Math.sin(time * 2.68 + drop.x) * .076;
      changed ||= model.root.position.x !== drop.x || model.root.position.z !== drop.z || model.selected !== selected ||
        (model.tag && model.tag.visible !== near) || !reducedMotion;
      model.selected = selected;
      model.root.position.set(drop.x, 0, drop.z);
      model.halo.opacity = selected ? .98 : .66 + bob;
      model.ring.scale.setScalar(selected ? .55 : .485);
      model.inner.scale.setScalar(.31 + Math.abs(bob) * .6);
      model.pivot.position.y = .65 + bob;
      model.pivot.rotation.set(-.12, yaw + (reducedMotion ? 0 : time * .72), -.10);
      if (model.tag) model.tag.visible = near;
    }
    for (const [id, project] of projects) {
      const visible = RECOVERY_RECIPES[id].parts.every(part => state.progress.installed.includes(part));
      if (project.visible !== visible) changed = true;
      project.visible = visible;
    }
    return Boolean(changed);
  }

  function feedback(event) {
    if (!event) return;
    if (event.type === 'pulse' && ['hit', 'disabled', 'guarded', 'miss'].includes(event.outcome)) {
      const guarded = event.outcome === 'guarded';
      effects.burst({ ...event, distance: limit(event.distance || 2.1, .3, 5.15), tint: guarded ? AMBER : SIGNAL_BLUE });
      const bot = simulation.state.robots.find(item => item.id === event.robotId);
      const model = robots.get(event.robotId);
      if (model && bot) {
        model.kick = guarded ? .65 : 1;
        model.guarded = guarded;
        effects.burst({ x: bot.x, z: bot.z, kind: 'hit', tint: guarded ? AMBER : SIGNAL_BLUE });
      }
    } else if (event.type === 'collect') {
      effects.burst({ x: event.x, z: event.z, kind: 'pickup', tint: GREEN });
    } else if (event.type === 'stagger') {
      effects.burst({ x: event.x, z: event.z, kind: 'hit', tint: AMBER });
    }
    effects.update(0, reducedMotion);
  }

  update();
  return { root, update, feedback };
}
