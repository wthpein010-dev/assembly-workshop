import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { createFactoryActivity } from './factory-activity.js';
import { createRecoverySimulation } from './factory-recovery.js';
import { createRecoveryVisuals } from './factory-recovery-view.js';
import {
  BENCH_RANGE, EYE_HEIGHT, benchCameraPose, clamp, dampOverview, movementVector, movePlayer,
  nearbyBench, nearestStandable, overviewDistance, sampleCameraTransition, shiftOverview,
  spreadBadgePositions, walkLineIsClear, wrapAngle,
} from './factory-motion.js';

const WALK_FOV = 66;
const OVERVIEW_FOV = 37;
const WALK_SPEED = 3.25;
const INTERACTION_RANGE = 2.0;
const FACTORY_AZIMUTH = Math.atan2(30, 42);
const CLOSE_OVERVIEW = 0.29;
const FAR_OVERVIEW = 1.24;
const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const ASSETS = ['factory.glb', 'worker-hero.glb', 'factory-layout.json'];

// Layout headings follow Three's initial view toward -Z. The worker model faces +Z.
const layoutHeading = yaw => wrapAngle(Math.PI - (yaw || 0));

function validateLayout(layout) {
  const rectangle = box => box && [box.minX, box.maxX, box.minZ, box.maxZ].every(Number.isFinite) &&
    box.minX < box.maxX && box.minZ < box.maxZ;
  const coordinate = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
  const bench = item => coordinate(item) && typeof item.id === 'string' && typeof item.label === 'string' &&
    typeof item.zone === 'string' && coordinate(item.target) && Number.isFinite(item.target.y);
  if (!rectangle(layout?.bounds) || !coordinate(layout.spawn) ||
      !Array.isArray(layout.obstacles) || !layout.obstacles.every(rectangle) ||
      (layout.benches !== undefined && (!Array.isArray(layout.benches) || !layout.benches.every(bench))) ||
      !Array.isArray(layout.points) || !layout.points.every(point => coordinate(point) &&
        typeof point.id === 'string' && (point.path === undefined ||
          (Array.isArray(point.path) && point.path.every(coordinate))))) {
    throw new Error('车间地图数据无法读取。');
  }
  return layout;
}

async function fetchAsset(url, signal, progress) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`无法加载车间资源（${response.status}）`);
  const length = Number(response.headers.get('content-length'));
  if (!response.body || !(length > 0)) {
    const bytes = await response.arrayBuffer();
    progress(1);
    return bytes;
  }

  const parts = [];
  let loaded = 0;
  const reader = response.body.getReader();
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      parts.push(chunk.value);
      loaded += chunk.value.byteLength;
      progress(Math.min(0.98, loaded / length));
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  progress(1);
  return bytes.buffer;
}

function disposeScene(root) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  root.traverse(object => {
    if (object.geometry && !object.isSprite) geometries.add(object.geometry);
    if (object.shadow) object.shadow.dispose();
    if (object.material) {
      for (const material of [].concat(object.material)) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value?.isTexture) textures.add(value);
        }
      }
    }
  });
  for (const texture of textures) {
    texture.source?.data?.close?.();
    texture.dispose();
  }
  for (const material of materials) material.dispose();
  for (const geometry of geometries) geometry.dispose();
}

function addLighting(scene, bounds) {
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  scene.background = new THREE.Color(0x050912);
  scene.add(new THREE.HemisphereLight(0xf0f6ff, 0xb5aaa0, 2.05));
  const key = new THREE.DirectionalLight(0xfff2df, 2.25);
  key.position.set(centerX + 12, 27, centerZ + 16);
  key.target.position.set(centerX, 0, centerZ);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const span = width * 0.55 + depth * 0.28;
  Object.assign(key.shadow.camera, { left: -span, right: span, top: span * 0.78, bottom: -span * 0.78, near: 0.5, far: 76 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.065;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 2.0;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0xd8eaff, 0.95);
  fill.position.set(centerX - 13, 14, centerZ - 11);
  fill.target.position.set(centerX, 0, centerZ);
  scene.add(fill, fill.target);

  const surface = new THREE.MeshStandardMaterial({ color: 0x202c3a, roughness: 1 });
  surface.onBeforeCompile = shader => {
    shader.uniforms.groundHalfSize = { value: new THREE.Vector2(width / 2 + 0.46, depth / 2 + 0.46) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 stagePosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nstagePosition = position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 stagePosition;\nuniform vec2 groundHalfSize;')
      .replace('#include <opaque_fragment>', `
        vec2 distanceToEdge = abs(stagePosition) - groundHalfSize;
        float outside = length(max(distanceToEdge, 0.0)) + min(max(distanceToEdge.x, distanceToEdge.y), 0.0);
        float mist = 0.52 * sin(stagePosition.x * 0.34 + sin(stagePosition.y * 0.61))
                   + 0.29 * sin(stagePosition.y * 0.41 - stagePosition.x * 0.19);
        outgoingLight *= 1.0 - smoothstep(-0.32, 6.1, outside + mist);
        #include <opaque_fragment>
      `);
  };
  const stage = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), surface);
  stage.rotation.x = -Math.PI / 2;
  stage.position.set(centerX, -1.39, centerZ);
  stage.receiveShadow = true;
  scene.add(stage);
}

function addHeroShadow(scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: 'varying vec2 coord; void main() {coord = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);}',
    fragmentShader: 'varying vec2 coord; void main() {float d = length((coord - vec2(0.5)) * 2.0); gl_FragColor = vec4(0.03, 0.05, 0.08, (1.0 - smoothstep(0.03, 1.0, d)) * 0.34);}',
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.03, 0.83), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.013;
  scene.add(shadow);
  return shadow;
}

function styleWorker(model, profile) {
  const jacketColors = [0x314c65, 0x426985, 0x343e4e];
  const trouserColors = [0x414854, 0x3b5263, 0x484d54];
  const skinColors = [undefined, 0xc99167, 0x795442];
  const skinDetails = [undefined, 0xb17258, 0x623d35];
  const colors = {
    'worker.jacket': jacketColors[profile?.group],
    'worker.trousers': trouserColors[profile?.group],
    'worker.skin': skinColors[profile?.tone],
    'worker.skin-detail': skinDetails[profile?.tone],
  };
  model.traverse(object => {
    if (!object.isMesh) return;
    object.receiveShadow = true;
    for (const material of [object.material].flat()) {
      const tint = colors[material?.name];
      if (tint !== undefined) material.color?.setHex(tint);
    }
  });
}

function createWayfinding(layout, scene) {
  const rings = new THREE.Group();
  const geometry = new THREE.RingGeometry(0.36, 0.415, 32);
  const neutral = new THREE.Color(0x77b3d8);
  const selected = new THREE.Color(0xffad64);
  for (const point of layout.points) {
    const ring = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: neutral }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.x, 0.036, point.z);
    ring.userData.pointId = point.id;
    rings.add(ring);
  }
  if (!layout.points.length) geometry.dispose();
  scene.add(rings);

  const guide = new THREE.Group();
  const guideMaterial = new THREE.MeshBasicMaterial({ color: 0x9dc8e5, transparent: true, opacity: 0.78, depthWrite: false });
  const segmentGeometry = new THREE.PlaneGeometry(1, 1);
  // Keep complete ownership of the reusable path assets even with no selected destination.
  const segments = layout.points.reduce((maximum, point) => Math.max(maximum, point.path?.length || 0), 0);
  for (let index = 0; index < segments; index++) {
    const segment = new THREE.Mesh(segmentGeometry, guideMaterial);
    segment.rotation.x = -Math.PI / 2;
    segment.visible = false;
    guide.add(segment);
  }
  if (segments) scene.add(guide);
  else {
    segmentGeometry.dispose();
    guideMaterial.dispose();
  }

  return (point, showRoute, hideSelectedRing) => {
    for (const ring of rings.children) {
      const highlighted = ring.userData.pointId === point?.id;
      ring.visible = !highlighted || !hideSelectedRing;
      ring.material.color.copy(highlighted ? selected : neutral);
      ring.scale.setScalar(highlighted ? 1.23 : 1);
    }
    const waypoints = showRoute && Array.isArray(point?.path) ? [layout.spawn, ...point.path] : [];
    guide.children.forEach((segment, index) => {
      const start = waypoints[index];
      const end = waypoints[index + 1];
      const length = start && end ? Math.hypot(end.x - start.x, end.z - start.z) : 0;
      segment.visible = length > 0.01;
      if (segment.visible) {
        segment.position.set((start.x + end.x) / 2, 0.029, (start.z + end.z) / 2);
        segment.rotation.set(-Math.PI / 2, 0, -Math.atan2(end.z - start.z, end.x - start.x));
        segment.scale.set(length + 0.05, 0.075, 1);
      }
    });
  };
}

function benchBadgeTexture(doc, number) {
  const image = doc.createElement('canvas');
  image.width = image.height = 128;
  const draw = image.getContext('2d');
  if (!draw) return null;
  draw.beginPath();
  draw.moveTo(28, 16);
  draw.lineTo(100, 16);
  draw.lineTo(113, 29);
  draw.lineTo(113, 86);
  draw.lineTo(100, 99);
  draw.lineTo(74, 99);
  draw.lineTo(64, 111);
  draw.lineTo(54, 99);
  draw.lineTo(28, 99);
  draw.lineTo(15, 86);
  draw.lineTo(15, 29);
  draw.closePath();
  draw.lineJoin = 'round';
  draw.strokeStyle = '#101a2a';
  draw.lineWidth = 11;
  draw.stroke();
  draw.fillStyle = '#1b334b';
  draw.fill();
  draw.strokeStyle = '#d0e0ec';
  draw.lineWidth = 4;
  draw.stroke();
  draw.fillStyle = '#f6faff';
  draw.font = '700 53px system-ui, sans-serif';
  draw.textAlign = 'center';
  draw.textBaseline = 'middle';
  draw.fillText(String(number).padStart(2, '0'), 64, 60);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createBenchMarkers(scene, benches, doc) {
  const group = new THREE.Group();
  group.name = 'workbench-markers';
  const ringGeometry = benches.length ? new THREE.RingGeometry(0.28, 0.325, 24) : null;
  const benchMarkers = benches.map((bench, index) => {
    const material = new THREE.SpriteMaterial({
      map: benchBadgeTexture(doc, index + 1), color: 0xc3def1, sizeAttenuation: false,
      transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    const badge = new THREE.Sprite(material);
    badge.name = `workbench-marker-${bench.id}`;
    badge.userData.bench = bench;
    const anchor = new THREE.Vector3(bench.target.x, bench.target.y + 0.68, bench.target.z);
    badge.position.copy(anchor);
    badge.renderOrder = 7;
    const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
      color: 0x91bbd8, transparent: true, opacity: 0.76, depthWrite: false,
    }));
    ring.position.set(bench.x, 0.044, bench.z);
    ring.rotation.x = -Math.PI / 2;
    group.add(badge, ring);
    return { bench, badge, ring, anchor, projected: new THREE.Vector3() };
  });
  scene.add(group);

  return {
    badges: benchMarkers.map(marker => marker.badge),
    update({ mode, player, nearest, hidden, camera, height }) {
      const width = height * camera.aspect;
      const viewSize = 2 * Math.tan(camera.fov * Math.PI / 360) / height;
      const size = mode === 'overview' ? clamp(width * 0.091, 30, 43) : 43;
      const overheadBadges = [];
      if (mode === 'overview' && !hidden) camera.updateMatrixWorld();
      for (const { bench, badge, ring, anchor, projected } of benchMarkers) {
        const distance = Math.hypot(player.x - bench.x, player.z - bench.z);
        const active = nearest?.id === bench.id;
        badge.visible = !hidden && (mode === 'overview' || distance < 8.0);
        ring.visible = !hidden && (mode === 'overview' || distance < 9.0);
        badge.material.color.setHex(active ? 0xffbd85 : 0xc3def1);
        badge.scale.setScalar(viewSize * (active ? 54 : size));
        badge.position.copy(anchor);
        ring.material.color.setHex(active ? 0xffad64 : 0x91bbd8);
        ring.scale.setScalar(active ? 1.23 : 1);
        if (mode !== 'overview' || hidden) continue;
        projected.copy(anchor).project(camera);
        if (projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.08 && Math.abs(projected.y) < 1.08) {
          overheadBadges.push({ badge, projected });
        }
      }
      const anchors = overheadBadges.map(({ projected }) => ({
        x: (projected.x + 1) * width / 2, y: (1 - projected.y) * height / 2,
      }));
      const separated = spreadBadgePositions(anchors, size * 0.88 + 3, size * 0.64);
      overheadBadges.forEach(({ badge, projected }, index) => {
        const { x, y } = separated[index];
        if (x !== anchors[index].x || y !== anchors[index].y) {
          badge.position.set(x / width * 2 - 1, 1 - y / height * 2, projected.z).unproject(camera);
        }
      });
    },
  };
}

function addInteriorEnvelope(scene, { bounds, spawn }) {
  const shell = new THREE.Group();
  const make = (color, emission = 0) => new THREE.MeshStandardMaterial({
    color, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0,
    depthWrite: false, emissive: color, emissiveIntensity: emission,
  });
  const ceiling = make(0xb5b5b1);
  const beam = make(0x46576b);
  const wall = make(0xc8c7bc);
  const lamp = make(0xf5f0e7, 0.67);
  const materials = [ceiling, beam, wall, lamp];
  function part(mat, x, y, z, w, h, d) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    item.position.set(x, y, z);
    shell.add(item);
  }
  const west = bounds.minX - 0.18;
  const east = bounds.maxX + 0.20;
  const north = bounds.minZ - 0.16;
  const south = bounds.maxZ + 0.16;
  const centerX = (west + east) / 2;
  const centerZ = (north + south) / 2;
  const width = east - west;
  const depth = south - north;
  const openingHalf = 1.46;
  const entranceX = clamp(spawn.x, west + openingHalf, east - openingHalf);
  const openingWest = entranceX - openingHalf;
  const openingEast = entranceX + openingHalf;

  part(ceiling, centerX, 4.67, centerZ, width + 0.16, 0.16, depth + 0.07);
  part(wall, east, 2.63, centerZ, 0.31, 3.91, depth);
  if (openingWest > west) part(wall, (west + openingWest) / 2, 2.45, south, openingWest - west, 4.26, 0.30);
  if (openingEast < east) part(wall, (openingEast + east) / 2, 2.45, south, east - openingEast, 4.26, 0.30);
  part(beam, entranceX, 3.73, south, openingHalf * 2, 1.81, 0.30);
  for (let z = north + 3; z < south - 1; z += 6) {
    part(beam, centerX, 4.37, z, width, 0.31, 0.24);
    for (let x = west + 5.25; x < east - 1.7; x += 9.5) {
      part(beam, x, 4.18, z, 2.55, 0.12, 0.31);
      part(lamp, x, 4.108, z, 2.36, 0.035, 0.24);
    }
  }
  shell.visible = false;
  scene.add(shell);
  return height => {
    // Keep the upper structure outside the cutaway and reveal it after the eye enters.
    const t = clamp((4.23 - height) / 1.32, 0, 1);
    shell.visible = t > 0;
    for (const material of materials) {
      material.opacity = t * t * (3 - 2 * t);
      material.depthWrite = t >= 0.995;
    }
  };
}

export function createFactoryScene(canvas, options = {}) {
  const {
    assetUrl = name => `./assets/${name}${name.endsWith('.glb') ? '?v=ca1' : ''}`,
    onProgress, onReady, onMode, onZone, onStatus, onInteract,
    onBenchNearby, onBench, recovery: initialRecovery, onRecovery, onRecoveryView, workerProfile,
  } = options;
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const abort = new AbortController();
  const controls = new AbortController();
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const keys = new Set();
  const tabIndex = canvas.getAttribute('tabindex');
  const savedTouchAction = canvas.style.touchAction;
  const savedCursor = canvas.style.cursor;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(OVERVIEW_FOV, 1, 0.045, 280);
  const lookTarget = new THREE.Vector3();
  const badgeRay = new THREE.Raycaster();
  const badgePointer = new THREE.Vector2();
  const badgeScreen = new THREE.Vector3();
  let renderer, resizeObserver, layout, player, hero, heroShadow, updateWayfinding, revealInterior, activity;
  let benchMarkers, benchSession;
  let recoverySimulation, recoveryVisuals, recoveryViewKey;
  let recoveryProgress = initialRecovery;
  let closestBench = null;
  let badgePress = null;
  let visibilityObserver;
  let resizePending = false;
  let canvasVisible = true;
  let overviewView, overviewTarget;
  let mode = 'overview';
  let previewPoint = null;
  let activeZone = null;
  let hideZoneRing = false;
  let currentPose, transition, frameId;
  let lastFrame = 0;
  let dirty = true;
  let destroyed = false;
  let aspect = 1;
  let viewportHeight = 1;
  let pitch = 0;
  let touchX = 0;
  let touchY = 0;
  let drag = null;
  let lockPending = false;
  let lockFailed = false;
  let locked = false;
  let heroYaw = FACTORY_AZIMUTH * 0.66;

  function centerOverview() {
    const { bounds } = layout;
    overviewView = overviewTarget = { x: (bounds.minX + bounds.maxX) / 2, z: (bounds.minZ + bounds.maxZ) / 2, zoom: 1 };
  }

  function overviewRadius() {
    return overviewDistance(layout.bounds, aspect, FACTORY_AZIMUTH, OVERVIEW_FOV) * overviewView.zoom;
  }

  function overviewPose() {
    const diagonal = overviewRadius() * Math.SQRT1_2;
    const targetY = 0.30 + (1 - Math.min(overviewView.zoom, 1)) * 0.78;
    return {
      x: overviewView.x + Math.sin(FACTORY_AZIMUTH) * diagonal,
      y: targetY + diagonal,
      z: overviewView.z + Math.cos(FACTORY_AZIMUTH) * diagonal,
      yaw: wrapAngle(FACTORY_AZIMUTH + Math.PI), pitch: -Math.PI / 4, fov: OVERVIEW_FOV,
    };
  }

  function walkPose() {
    return { x: player.x, y: EYE_HEIGHT, z: player.z, yaw: player.yaw, pitch, fov: WALK_FOV };
  }

  function setZone(point) {
    if (activeZone?.id === point?.id) return;
    activeZone = point;
    syncWayfinding();
    onZone?.(point);
  }

  function syncWayfinding() {
    updateWayfinding?.(activeZone, mode === 'overview', hideZoneRing);
    dirty = true;
  }

  function nearestZone() {
    let nearest = null;
    let distance = INTERACTION_RANGE;
    for (const point of layout.points) {
      const length = Math.hypot(player.x - point.x, player.z - point.z);
      if (length < distance) {
        distance = length;
        nearest = point;
      }
    }
    return nearest;
  }

  function updateBenchMarkers() {
    benchMarkers?.update({ mode, player, nearest: closestBench, hidden: Boolean(benchSession),
      camera, height: viewportHeight });
  }

  function setNearbyBench(bench) {
    if (closestBench?.id === bench?.id) return;
    closestBench = bench;
    updateBenchMarkers();
    dirty = true;
    onBenchNearby?.(bench);
  }

  function syncNearbyBench() {
    setNearbyBench(mode === 'walk' && !transition && !benchSession ? nearbyBench(player, layout) : null);
  }

  function freeRecoveryWalk() {
    return recoverySimulation && !destroyed && mode === 'walk' && !transition && !benchSession;
  }

  function syncRecoveryView() {
    if (!recoverySimulation || destroyed) return;
    const active = Boolean(freeRecoveryWalk());
    const { nearbyDrop, nearbyRobot, pulseCooldown, jammed } = recoverySimulation.state;
    const hideRing = active && Boolean(nearbyDrop);
    if (hideRing !== hideZoneRing) {
      hideZoneRing = hideRing;
      syncWayfinding();
    }
    if (!onRecoveryView) return;
    const snapshot = {
      active,
      nearbyDrop: active ? nearbyDrop : null,
      nearbyRobot: active ? nearbyRobot : null,
      pulseCooldown: Math.ceil(pulseCooldown * 10) / 10,
      jammed: Math.ceil(jammed * 10) / 10,
    };
    const robot = snapshot.nearbyRobot;
    const key = [active, snapshot.nearbyDrop?.id, robot?.id, robot?.phase, robot?.integrity,
      snapshot.pulseCooldown, snapshot.jammed].join('|');
    if (recoveryViewKey === key) return;
    recoveryViewKey = key;
    onRecoveryView(snapshot);
  }

  function reportRecovery(event) {
    if (!event) return false;
    recoveryVisuals?.feedback(event);
    dirty = true;
    onRecovery?.(event);
    return true;
  }

  function updateRecovery(delta = 0) {
    if (freeRecoveryWalk()) reportRecovery(recoverySimulation.update(delta, player));
    syncRecoveryView();
  }

  function benchUnderPointer(clientX, clientY) {
    if (!benchMarkers?.badges.length || benchSession || transition || locked) return null;
    const { left, top, width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return null;
    badgePointer.set((clientX - left) / width * 2 - 1, 1 - (clientY - top) / height * 2);
    if (Math.abs(badgePointer.x) > 1 || Math.abs(badgePointer.y) > 1) return null;
    camera.updateMatrixWorld();
    badgeRay.setFromCamera(badgePointer, camera);
    const visibleBadges = benchMarkers.badges.filter(badge => badge.visible);
    for (const badge of visibleBadges) badge.updateWorldMatrix(true, false);
    let nearest = null;
    let nearestDistance = Infinity;
    for (const hit of badgeRay.intersectObjects(visibleBadges, false)) {
      const bench = hit.object.userData.bench;
      if (mode === 'walk' && (Math.hypot(bench.x - player.x, bench.z - player.z) >= BENCH_RANGE ||
          !walkLineIsClear(player, bench, layout))) continue;
      badgeScreen.setFromMatrixPosition(hit.object.matrixWorld).project(camera);
      const distance = Math.hypot((badgeScreen.x - badgePointer.x) * width, (badgeScreen.y - badgePointer.y) * height);
      if (distance < nearestDistance) {
        nearest = bench;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  function placeHero() {
    hero.position.set(player.x, 0, player.z);
    hero.rotation.y = heroYaw;
    heroShadow.position.x = player.x;
    heroShadow.position.z = player.z;
  }

  function applyPose(pose) {
    currentPose = pose;
    camera.position.set(pose.x, pose.y, pose.z);
    const flat = Math.cos(pose.pitch);
    lookTarget.set(Math.sin(pose.yaw) * flat, Math.sin(pose.pitch), Math.cos(pose.yaw) * flat).add(camera.position);
    camera.lookAt(lookTarget);
    if (camera.fov !== pose.fov) {
      camera.fov = pose.fov;
      camera.updateProjectionMatrix();
    }
    hero.visible = pose.y > 2.21 || Math.hypot(pose.x - player.x, pose.z - player.z) > 0.72;
    heroShadow.visible = hero.visible;
    revealInterior(pose.y);
    updateBenchMarkers();
    dirty = true;
  }

  function finishTransition() {
    const onFinish = transition?.onFinish;
    transition = null;
    onMode?.(mode, false);
    if (destroyed || transition) return;
    onFinish?.();
    if (destroyed || transition) return;
    if (!benchSession) setZone(mode === 'overview' ? previewPoint : nearestZone());
    syncNearbyBench();
    updateBenchMarkers();
    updateRecovery();
  }

  function flyTo(getTarget, milliseconds, lift, travelInset = 0, { onStart, onFinish } = {}) {
    const next = { start: win.performance.now(), from: currentPose, getTarget, milliseconds, lift, travelInset, onFinish };
    transition = next;
    canvas.style.cursor = savedCursor;
    setNearbyBench(null);
    onMode?.(mode, true);
    if (destroyed || transition !== next) return;
    syncRecoveryView();
    if (destroyed || transition !== next) return;
    onStart?.();
    if (destroyed || transition !== next) return;
    if (reducedMotion?.matches) {
      applyPose(getTarget());
      finishTransition();
    }
  }

  function flyToWalkingPoint(distance, target = walkPose, events, clearance = distance > 2) {
    // Rise above nearby benches before the horizontal leg of a longer reposition.
    const lift = clearance ? clamp(distance * 0.23, 3.7, 6.3) : Math.min(1, distance * 0.35);
    flyTo(target, clamp(640 + distance * 25, 680, 1500), lift, clearance ? 0.24 : 0, events);
  }

  function clearInput() {
    keys.clear();
    touchX = 0;
    touchY = 0;
    badgePress = null;
    canvas.style.cursor = savedCursor;
    endDrag();
  }

  function endDrag() {
    const id = drag?.id;
    drag = null;
    if (id !== undefined && canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
  }

  function setMode(next) {
    if (destroyed || benchSession || (next !== 'overview' && next !== 'walk') || next === mode) return false;
    mode = next;
    if (!layout) return true;
    clearInput();
    setZone(null);
    if (mode === 'overview') {
      if (doc.pointerLockElement === canvas) doc.exitPointerLock?.();
    }
    flyTo(mode === 'overview' ? overviewPose : walkPose, 1220, 3.8, 0.24);
    return true;
  }

  function toggleMode() {
    return setMode(mode === 'overview' ? 'walk' : 'overview');
  }

  function jumpTo(id) {
    if (!layout || destroyed || benchSession) return false;
    const point = layout.points.find(candidate => candidate.id === id);
    if (!point) return false;

    if (mode === 'overview') {
      previewPoint = point;
      overviewView = overviewTarget = shiftOverview({ x: point.x, z: point.z, zoom: CLOSE_OVERVIEW + 0.05 },
        layout.bounds, FACTORY_AZIMUTH, 0, 0);
      setZone(point);
      flyTo(overviewPose, 900, 1.35);
    } else {
      const landing = nearestStandable(point, layout);
      if (!landing) return false;
      const distance = Math.hypot(landing.x - currentPose.x, landing.z - currentPose.z);
      player = { ...landing, yaw: layoutHeading(point.yaw) };
      pitch = 0;
      heroYaw = player.yaw;
      clearInput();
      setZone(null);
      placeHero();
      flyToWalkingPoint(distance);
    }
    return true;
  }

  function reset() {
    if (!layout || destroyed || benchSession) return false;
    player = { ...nearestStandable(layout.spawn, layout), yaw: layoutHeading(layout.spawn.yaw) };
    previewPoint = null;
    centerOverview();
    pitch = 0;
    heroYaw = FACTORY_AZIMUTH * 0.66;
    clearInput();
    setZone(null);
    placeHero();
    const distance = Math.hypot(player.x - currentPose.x, player.z - currentPose.z);
    if (mode === 'walk') flyToWalkingPoint(distance);
    else flyTo(overviewPose, 950, 1.35);
    return true;
  }

  function moveTouch(x, y) {
    if (destroyed || benchSession) return;
    touchX = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
    touchY = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
  }

  function lookTouch(dx, dy) {
    if (!layout || destroyed || transition || benchSession || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    if (mode === 'overview') {
      const metersPerPixel = 2 * overviewRadius() * Math.tan(OVERVIEW_FOV * Math.PI / 360) / viewportHeight;
      panOverview(-dx * metersPerPixel, dy * metersPerPixel * Math.SQRT2);
      return;
    }
    player.yaw = wrapAngle(player.yaw - dx * 0.0028);
    pitch = clamp(pitch - dy * 0.0028, -Math.PI * 0.46, Math.PI * 0.46);
    applyPose(walkPose());
  }

  function interact() {
    if (!layout || destroyed || transition || benchSession) return false;
    if (freeRecoveryWalk() && reportRecovery(recoverySimulation.interact(player))) {
      updateRecovery();
      return true;
    }
    const bench = mode === 'walk' && nearbyBench(player, layout);
    if (bench) return focusBench(bench.id);
    const point = mode === 'walk' ? nearestZone() : previewPoint;
    if (!point) return false;
    onInteract?.(point);
    return true;
  }

  function goRecovery(id) {
    if (!recoverySimulation || destroyed || benchSession) return false;
    const guide = recoverySimulation.guide(id);
    if (!guide) return false;
    const { x, z, yaw } = guide;
    const { drops, robots } = recoverySimulation.state;
    const drop = drops.find(item => item.visible && (item.id === id || item.source === id));
    const target = drop ?? robots.find(item => item.id === id || item.partId === id);
    const distance = Math.hypot(x - currentPose.x, z - currentPose.z);
    const clearance = mode === 'overview' || distance > 2 || !walkLineIsClear(currentPose, guide, layout);
    mode = 'walk';
    player = { x, z, yaw };
    pitch = target ? Math.atan2((drop ? 0.65 : 0.92) - EYE_HEIGHT, Math.hypot(target.x - x, target.z - z)) : -0.18;
    heroYaw = yaw;
    clearInput();
    setZone(null);
    placeHero();
    flyToWalkingPoint(distance, walkPose, { onFinish: () => canvas.focus({ preventScroll: true }) }, clearance);
    return true;
  }

  function pulseRecovery() {
    if (!freeRecoveryWalk()) return false;
    const acted = reportRecovery(recoverySimulation.pulse(player));
    updateRecovery();
    return acted;
  }

  function setRecoveryProgress(progress) {
    if (destroyed) return;
    recoveryProgress = progress;
    if (!recoverySimulation) return;
    recoverySimulation.setProgress(progress);
    updateRecovery();
    dirty = true;
  }

  function focusBench(id) {
    if (!layout || destroyed || benchSession) return false;
    const bench = (layout.benches || []).find(candidate => candidate.id === id);
    if (!bench) return false;
    const pose = benchCameraPose(bench, layout);
    if (!pose) return false;

    const landing = { x: pose.x, z: pose.z, yaw: pose.yaw };
    const fromNearby = mode === 'walk' && !transition && Math.hypot(bench.x - player.x, bench.z - player.z) < BENCH_RANGE &&
      walkLineIsClear(player, bench, layout);
    const resume = fromNearby ? { player, pitch, heroYaw } : { player: landing, pitch: -0.1, heroYaw: pose.yaw };
    const distance = Math.hypot(pose.x - currentPose.x, pose.z - currentPose.z);
    const clearance = distance > 2 || !walkLineIsClear(currentPose, pose, layout);
    benchSession = { bench, resume, phase: 'focusing' };
    mode = 'walk';
    player = { ...landing };
    pitch = pose.pitch;
    heroYaw = pose.yaw;
    clearInput();
    if (doc.pointerLockElement === canvas) doc.exitPointerLock?.();
    onStatus?.('');
    setZone(null);
    placeHero();
    updateBenchMarkers();
    flyToWalkingPoint(distance, () => pose, {
      onStart: () => onBench?.(bench, 'focusing'),
      onFinish: () => {
        benchSession.phase = 'ready';
        onBench?.(bench, 'ready');
      },
    }, clearance);
    return true;
  }

  function exitBench() {
    if (!benchSession || destroyed || benchSession.phase === 'leaving') return false;
    const { bench, resume } = benchSession;
    benchSession.phase = 'leaving';
    player = resume.player;
    pitch = resume.pitch;
    heroYaw = resume.heroYaw;
    clearInput();
    placeHero();
    const distance = Math.hypot(player.x - currentPose.x, player.z - currentPose.z);
    const clearance = distance > 2 || !walkLineIsClear(currentPose, player, layout);
    flyToWalkingPoint(distance, walkPose, {
      onStart: () => onBench?.(bench, 'leaving'),
      onFinish: () => {
        benchSession = null;
        onBench?.(bench, 'closed');
      },
    }, clearance);
    return true;
  }

  function directionInput() {
    const hasKey = (one, two) => Number(keys.has(one) || keys.has(two));
    return {
      strafe: hasKey('KeyD', 'ArrowRight') - hasKey('KeyA', 'ArrowLeft') + touchX,
      forward: hasKey('KeyW', 'ArrowUp') - hasKey('KeyS', 'ArrowDown') - touchY,
    };
  }

  function updatePlayer(delta) {
    const { strafe, forward } = directionInput();
    if (!(strafe || forward)) return;
    const vector = movementVector(player.yaw, strafe, forward);
    const next = movePlayer(player, vector.x * delta * WALK_SPEED, vector.z * delta * WALK_SPEED, layout);
    if (next.x === player.x && next.z === player.z) return;
    Object.assign(player, next);
    heroYaw = player.yaw;
    placeHero();
    applyPose(walkPose());
    setZone(nearestZone());
    syncNearbyBench();
  }

  function panOverview(right, forward) {
    overviewTarget = shiftOverview(overviewTarget, layout.bounds, FACTORY_AZIMUTH, right, forward);
  }

  function updateOverview(delta) {
    const { strafe, forward } = directionInput();
    if (strafe || forward) {
      const step = overviewRadius() * 0.31 * delta / Math.max(1, Math.hypot(strafe, forward));
      panOverview(strafe * step, forward * step);
    }
    if (overviewView === overviewTarget) return;
    overviewView = reducedMotion?.matches ? overviewTarget : dampOverview(overviewView, overviewTarget, delta);
    applyPose(overviewPose());
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!renderer || !width || !height) return;
    aspect = width / height;
    viewportHeight = height;
    const pixelRatio = Math.min(win.devicePixelRatio || 1, 1.65);
    if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
    renderer.setSize(Math.round(width), Math.round(height), false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (layout && mode === 'overview' && !transition && currentPose) applyPose(overviewPose());
    else updateBenchMarkers();
    dirty = true;
  }

  function step(now) {
    if (destroyed) return;
    const canRender = canvasVisible && !doc.hidden;
    if (resizePending && canRender) {
      resizePending = false;
      resize();
    }
    const delta = clamp((now - lastFrame) / 1000, 0, 0.05);
    lastFrame = now;
    if (transition) {
      const { start, from, getTarget, milliseconds, lift, travelInset } = transition;
      const progress = reducedMotion?.matches ? 1 : (now - start) / milliseconds;
      applyPose(sampleCameraTransition(from, getTarget(), progress, lift, travelInset));
      if (progress >= 1) finishTransition();
    } else if (mode === 'walk') {
      if (!benchSession) updatePlayer(delta);
    } else {
      updateOverview(delta);
    }
    if (canRender) {
      updateRecovery(delta);
      if (destroyed) return;
      if (recoveryVisuals?.update(delta, player)) dirty = true;
    }
    if (activity?.active && canRender) {
      activity.update(delta);
      dirty = true;
    }
    if (dirty && canRender) {
      renderer.render(scene, camera);
      dirty = false;
    }
    if (!destroyed) frameId = win.requestAnimationFrame(step);
  }

  function onKeyDown(event) {
    if (!layout || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    if (benchSession && (event.code === 'Escape' || event.key === 'Escape') && !doc.fullscreenElement &&
        !event.target?.isContentEditable && !event.target?.closest?.('input, textarea, select')) {
      event.preventDefault();
      if (!event.repeat) exitBench();
      return;
    }
    if (doc.activeElement !== canvas && doc.pointerLockElement !== canvas) return;
    if (benchSession) {
      if (WALK_KEYS.has(event.code) || event.code === 'KeyV' || event.code === 'KeyE') event.preventDefault();
      return;
    }
    if (event.code === 'KeyF' && freeRecoveryWalk()) {
      event.preventDefault();
      if (!event.repeat) pulseRecovery();
    } else if (event.code === 'KeyV' || event.code === 'KeyE') {
      event.preventDefault();
      if (!event.repeat) {
        if (event.code === 'KeyV') toggleMode();
        else interact();
      }
    } else if (WALK_KEYS.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }

  function useDrag() {
    if (!lockPending || destroyed) return;
    lockPending = false;
    lockFailed = true;
    if (mode === 'walk' && !benchSession) onStatus?.('拖动场景可以转动视角。');
  }

  function pointerDown(event) {
    if (!layout || benchSession || (event.button !== 0 && event.button !== 2)) return;
    if (event.button === 0 && !badgePress) {
      const bench = benchUnderPointer(event.clientX, event.clientY);
      if (bench) badgePress = { id: event.pointerId, x: event.clientX, y: event.clientY, bench };
    }
    if (mode === 'walk' && (event.pointerType !== 'mouse' || event.button !== 0)) return;
    canvas.focus({ preventScroll: true });
    if (transition || locked || drag) return;
    if (mode === 'walk' && badgePress) return;
    if (mode === 'overview' && event.pointerType !== 'touch' && event.button !== 2) return;
    event.preventDefault();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    if (mode !== 'walk' || event.pointerType !== 'mouse' || lockFailed || lockPending || !canvas.requestPointerLock) return;
    lockPending = true;
    try {
      canvas.requestPointerLock()?.then(() => {
        if (destroyed && doc.pointerLockElement === canvas) doc.exitPointerLock?.();
      }, useDrag);
    } catch {
      useDrag();
    }
  }

  function pointerLockChanged() {
    const hadLock = locked;
    locked = doc.pointerLockElement === canvas;
    if (locked || hadLock) lockPending = false;
    if (locked && (mode !== 'walk' || benchSession)) {
      doc.exitPointerLock?.();
      return;
    }
    if (locked) {
      endDrag();
      onStatus?.('鼠标控制视角，按 Esc 释放。');
    } else if (hadLock) {
      clearInput();
      if (mode === 'walk' && !benchSession) onStatus?.('点击场景继续走动。');
    }
  }

  function installControls() {
    if (tabIndex === null) canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    const listen = (target, event, listener, options) => target.addEventListener(event, listener, { ...options, signal: controls.signal });
    listen(doc, 'keydown', onKeyDown);
    listen(doc, 'keyup', event => keys.delete(event.code));
    listen(canvas, 'blur', clearInput);
    listen(win, 'blur', clearInput);
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) clearInput();
      else dirty = true;
    });
    listen(canvas, 'pointerdown', pointerDown);
    listen(canvas, 'contextmenu', event => { if (layout && mode === 'overview') event.preventDefault(); });
    listen(canvas, 'wheel', event => {
      if (!layout || mode !== 'overview' || transition || event.ctrlKey) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewportHeight : 1;
      const change = clamp(event.deltaY * multiplier, -360, 360);
      const zoom = clamp(overviewTarget.zoom * Math.exp(change * 0.0014), CLOSE_OVERVIEW, FAR_OVERVIEW);
      overviewTarget = { ...overviewTarget, zoom };
    }, { passive: false });
    listen(canvas, 'pointermove', event => {
      if (drag?.id === event.pointerId && !locked) {
        lookTouch(event.clientX - drag.x, event.clientY - drag.y);
        drag.x = event.clientX;
        drag.y = event.clientY;
      } else if (event.pointerType === 'mouse') {
        canvas.style.cursor = benchUnderPointer(event.clientX, event.clientY) ? 'pointer' : savedCursor;
      }
    });
    listen(canvas, 'pointerleave', () => {
      canvas.style.cursor = savedCursor;
      if (!drag) badgePress = null;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(canvas, event, pointer => {
        const press = badgePress?.id === pointer.pointerId ? badgePress : null;
        if (press) badgePress = null;
        if (drag?.id === pointer.pointerId) endDrag();
        if (event === 'pointerup' && press && Math.hypot(pointer.clientX - press.x, pointer.clientY - press.y) <= 9 &&
            benchUnderPointer(pointer.clientX, pointer.clientY)?.id === press.bench.id) focusBench(press.bench.id);
      });
    }
    listen(doc, 'mousemove', event => { if (locked) lookTouch(event.movementX, event.movementY); });
    listen(doc, 'pointerlockchange', pointerLockChanged);
    listen(doc, 'pointerlockerror', useDrag);
    listen(canvas, 'webglcontextlost', event => {
      event.preventDefault();
      onStatus?.('三维绘图暂停，等待设备恢复。');
    });
    listen(canvas, 'webglcontextrestored', () => {
      renderer.shadowMap.needsUpdate = true;
      dirty = true;
      onStatus?.('三维车间已恢复。');
    });
    // Resizing the drawing buffer clears it. Do it in the same frame as rendering.
    const requestResize = () => { resizePending = true; };
    if (win.ResizeObserver) {
      resizeObserver = new win.ResizeObserver(requestResize);
      resizeObserver.observe(canvas);
    } else {
      listen(win, 'resize', requestResize);
    }
    if (win.IntersectionObserver) {
      visibilityObserver = new win.IntersectionObserver(([entry]) => { canvasVisible = entry.isIntersecting; });
      visibilityObserver.observe(canvas);
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    abort.abort();
    controls.abort();
    if (frameId !== undefined) win.cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    visibilityObserver?.disconnect();
    clearInput();
    if (doc.pointerLockElement === canvas) doc.exitPointerLock?.();
    canvas.style.touchAction = savedTouchAction;
    if (tabIndex === null && canvas.getAttribute('tabindex') === '0') canvas.removeAttribute('tabindex');
    disposeScene(scene);
    renderer?.dispose();
    queueMicrotask(() => { if (!canvas.isConnected) renderer?.forceContextLoss(); });
  }

  async function initialize() {
    if (destroyed) return null;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.06;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.shadowMap.autoUpdate = false;
    installControls();
    resize();
    onProgress?.(0);

    const urls = ASSETS.map((name, index) => assetUrl(index === 1 && workerProfile?.gender === 'female' ? 'worker-hero-female.glb' : name));
    const weights = [0.85, 0.12, 0.03];
    const progress = [0, 0, 0];
    const [factoryBytes, heroBytes, layoutBytes] = await Promise.all(urls.map((url, index) =>
      fetchAsset(url, abort.signal, value => {
        progress[index] = value;
        if (!destroyed) onProgress?.(0.94 * progress.reduce((total, part, piece) => total + part * weights[piece], 0));
      })));
    if (destroyed) return null;
    const map = validateLayout(JSON.parse(new TextDecoder().decode(layoutBytes)));
    const spawn = nearestStandable(map.spawn, map);
    if (!spawn) throw new Error('员工入口缺少可站立位置。');

    const loader = new GLTFLoader();
    const sourcePath = index => new URL('.', new URL(urls[index], doc.baseURI)).href;
    const models = await Promise.allSettled([
      loader.parseAsync(factoryBytes, sourcePath(0)), loader.parseAsync(heroBytes, sourcePath(1)),
    ]);
    const failed = models.find(model => model.status === 'rejected');
    if (destroyed || failed) {
      for (const model of models) if (model.status === 'fulfilled') disposeScene(model.value.scene);
      if (destroyed) return null;
      throw failed.reason;
    }

    layout = map;
    centerOverview();
    addLighting(scene, layout.bounds);
    revealInterior = addInteriorEnvelope(scene, layout);
    player = { ...spawn, yaw: layoutHeading(layout.spawn.yaw) };
    const factory = models[0].value.scene;
    factory.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    hero = models[1].value.scene;
    styleWorker(hero, workerProfile);
    heroShadow = addHeroShadow(scene);
    scene.add(factory, hero);
    updateWayfinding = createWayfinding(layout, scene);
    benchMarkers = createBenchMarkers(scene, layout.benches || [], doc);
    activity = createFactoryActivity(scene, layout, { reducedMotion: reducedMotion?.matches });
    recoverySimulation = createRecoverySimulation(layout, recoveryProgress);
    recoveryVisuals = createRecoveryVisuals(scene, recoverySimulation, { document: doc, layout, reducedMotion: reducedMotion?.matches });
    recoveryVisuals.update(0, player);
    placeHero();
    applyPose(mode === 'overview' ? overviewPose() : walkPose());
    renderer.shadowMap.needsUpdate = true;
    renderer.render(scene, camera);
    dirty = false;
    lastFrame = win.performance.now();
    frameId = win.requestAnimationFrame(step);
    onProgress?.(1);
    if (!destroyed) onReady?.(layout);
    if (!destroyed && !transition) finishTransition();
    return layout;
  }

  const ready = Promise.resolve().then(initialize).catch(error => {
    if (destroyed) return null;
    destroy();
    onStatus?.('三维车间暂时无法加载。');
    throw error;
  });
  ready.catch(() => {});

  return { ready, setMode, toggleMode, jumpTo, reset, moveTouch, lookTouch, interact, focusBench, exitBench,
    goRecovery, pulseRecovery, setRecoveryProgress, destroy };
}
