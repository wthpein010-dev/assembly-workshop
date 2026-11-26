import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import {
  EYE_HEIGHT, clamp, movementVector, movePlayer, nearestStandable,
  sampleCameraTransition, wrapAngle,
} from './factory-motion.js';

const WALK_FOV = 66;
const OVERVIEW_FOV = 37;
const WALK_SPEED = 3.25;
const INTERACTION_RANGE = 2.0;
const FACTORY_AZIMUTH = Math.atan2(30, 42);
const WALK_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const ASSETS = ['factory.glb', 'worker-hero.glb', 'factory-layout.json'];

// Layout headings follow Three's initial view toward -Z. The worker model faces +Z.
const layoutHeading = yaw => wrapAngle(Math.PI - (yaw || 0));

function validateLayout(layout) {
  const rectangle = box => box && [box.minX, box.maxX, box.minZ, box.maxZ].every(Number.isFinite) &&
    box.minX < box.maxX && box.minZ < box.maxZ;
  const coordinate = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
  if (!rectangle(layout?.bounds) || !coordinate(layout.spawn) ||
      !Array.isArray(layout.obstacles) || !layout.obstacles.every(rectangle) ||
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
    if (object.geometry) geometries.add(object.geometry);
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

function addLighting(scene) {
  scene.background = new THREE.Color(0x223b3c);
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x81989a, 2.1));
  const key = new THREE.DirectionalLight(0xffedcf, 2.45);
  key.position.set(12, 27, 16);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -27, right: 27, top: 23, bottom: -23, near: 0.5, far: 62 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.normalBias = 0.065;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 2.0;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xc9e5ff, 1.0);
  fill.position.set(-13, 14, -11);
  scene.add(fill);

  const stage = new THREE.Mesh(new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0x314d4a, roughness: 0.96 }));
  stage.rotation.x = -Math.PI / 2;
  stage.position.y = -1.39;
  stage.receiveShadow = true;
  scene.add(stage);
}

function addHeroShadow(scene) {
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexShader: 'varying vec2 coord; void main() {coord = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);}',
    fragmentShader: 'varying vec2 coord; void main() {float d = length((coord - vec2(0.5)) * 2.0); gl_FragColor = vec4(0.03, 0.06, 0.05, (1.0 - smoothstep(0.03, 1.0, d)) * 0.34);}',
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.03, 0.83), material);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.013;
  scene.add(shadow);
  return shadow;
}

function createWayfinding(layout, scene) {
  const rings = new THREE.Group();
  const geometry = new THREE.RingGeometry(0.36, 0.415, 32);
  const neutral = new THREE.Color(0x72bca5);
  const selected = new THREE.Color(0xffc979);
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
  const guideMaterial = new THREE.MeshBasicMaterial({ color: 0xa2dbc0, transparent: true, opacity: 0.78, depthWrite: false });
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

  return (point, showRoute) => {
    for (const ring of rings.children) {
      const highlighted = ring.userData.pointId === point?.id;
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

function addInteriorEnvelope(scene) {
  const shell = new THREE.Group();
  const make = (color, emission = 0) => new THREE.MeshStandardMaterial({
    color, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0,
    depthWrite: false, emissive: color, emissiveIntensity: emission,
  });
  const ceiling = make(0x637771);
  const beam = make(0x365353);
  const wall = make(0x78948d);
  const lamp = make(0xe1eedd, 0.75);
  const materials = [ceiling, beam, wall, lamp];
  function part(mat, x, y, z, w, h, d) {
    const item = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    item.position.set(x, y, z);
    shell.add(item);
  }
  part(ceiling, 0, 4.67, 0, 39.72, 0.16, 24.57);
  part(wall, 19.73, 2.63, 0, 0.31, 3.91, 24.34);
  part(wall, -18.52, 2.45, 12.28, 2.85, 4.26, 0.30);
  part(wall, 2.93, 2.45, 12.28, 33.78, 4.26, 0.30);
  part(beam, -15.64, 3.73, 12.29, 2.92, 1.81, 0.30);
  for (const z of [-9, -3, 3, 9]) {
    part(beam, 0, 4.37, z, 39.40, 0.31, 0.24);
    for (const x of [-14.5, -5, 4.5, 14]) {
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
    assetUrl = name => `./assets/${name}`,
    onProgress, onReady, onMode, onZone, onStatus, onInteract,
  } = options;
  const doc = canvas.ownerDocument;
  const win = doc.defaultView;
  const abort = new AbortController();
  const controls = new AbortController();
  const reducedMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const keys = new Set();
  const tabIndex = canvas.getAttribute('tabindex');
  const savedTouchAction = canvas.style.touchAction;
  const scene = new THREE.Scene();
  const revealInterior = addInteriorEnvelope(scene);
  const camera = new THREE.PerspectiveCamera(OVERVIEW_FOV, 1, 0.045, 280);
  const lookTarget = new THREE.Vector3();
  let renderer, resizeObserver, layout, player, hero, heroShadow, updateWayfinding;
  let mode = 'overview';
  let previewPoint = null;
  let activeZone = null;
  let currentPose, transition, frameId;
  let lastFrame = 0;
  let dirty = true;
  let destroyed = false;
  let aspect = 1;
  let pitch = 0;
  let touchX = 0;
  let touchY = 0;
  let drag = null;
  let lockPending = false;
  let lockFailed = false;
  let locked = false;
  let heroYaw = FACTORY_AZIMUTH * 0.66;

  function overviewPose(point = previewPoint) {
    const { bounds } = layout;
    const x = point?.x ?? (bounds.minX + bounds.maxX) / 2;
    const y = point ? 0.78 : -0.35;
    const z = point?.z ?? (bounds.minZ + bounds.maxZ) / 2;
    const elevation = Math.PI / 4;
    const sx = Math.sin(FACTORY_AZIMUTH);
    const sz = Math.cos(FACTORY_AZIMUTH);
    const inward = { x: sx * Math.cos(elevation), y: Math.sin(elevation), z: sz * Math.cos(elevation) };
    const halfWidth = point ? 4 : (bounds.maxX - bounds.minX) / 2 + 1.45;
    const halfDepth = point ? 3 : (bounds.maxZ - bounds.minZ) / 2 + 1.65;
    const fovTangent = Math.tan(OVERVIEW_FOV * Math.PI / 360);
    let distance = 9;
    for (const dx of [-halfWidth, halfWidth]) {
      for (const dz of [-halfDepth, halfDepth]) {
        for (const dy of [-2.7, point ? 2.0 : 3.5]) {
          const along = inward.x * dx + inward.y * dy + inward.z * dz;
          const right = sz * dx - sx * dz;
          const up = -sx * inward.y * dx + Math.cos(elevation) * dy - sz * inward.y * dz;
          distance = Math.max(distance, along + Math.max(Math.abs(up) / fovTangent,
            Math.abs(right) / (fovTangent * Math.max(0.2, aspect))));
        }
      }
    }
    return {
      x: x + inward.x * distance, y: y + inward.y * distance, z: z + inward.z * distance,
      yaw: wrapAngle(FACTORY_AZIMUTH + Math.PI), pitch: -elevation, fov: OVERVIEW_FOV,
    };
  }

  function walkPose() {
    return { x: player.x, y: EYE_HEIGHT, z: player.z, yaw: player.yaw, pitch, fov: WALK_FOV };
  }

  function setZone(point) {
    if (activeZone?.id === point?.id) return;
    activeZone = point;
    updateWayfinding?.(point, mode === 'overview');
    dirty = true;
    onZone?.(point);
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
    dirty = true;
  }

  function finishTransition() {
    transition = null;
    setZone(mode === 'overview' ? previewPoint : nearestZone());
    onMode?.(mode, false);
  }

  function flyTo(getTarget, milliseconds, lift, travelInset = 0) {
    const target = getTarget();
    if (reducedMotion?.matches) {
      applyPose(target);
      finishTransition();
      return;
    }
    transition = { start: win.performance.now(), from: currentPose, getTarget, milliseconds, lift, travelInset };
    onMode?.(mode, true);
  }

  function flyToWalkingPoint(distance) {
    // Rise above nearby benches before the horizontal leg of a longer reposition.
    const clearance = distance > 2;
    const lift = clearance ? clamp(distance * 0.23, 3.7, 6.3) : Math.min(1, distance * 0.35);
    flyTo(walkPose, clamp(640 + distance * 25, 680, 1500), lift, clearance ? 0.24 : 0);
  }

  function clearInput() {
    keys.clear();
    touchX = 0;
    touchY = 0;
  }

  function endDrag() {
    const id = drag?.id;
    drag = null;
    if (id !== undefined && canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
  }

  function setMode(next) {
    if (destroyed || (next !== 'overview' && next !== 'walk') || next === mode) return false;
    mode = next;
    if (!layout) return true;
    clearInput();
    setZone(null);
    previewPoint = null;
    if (mode === 'overview') {
      endDrag();
      if (doc.pointerLockElement === canvas) doc.exitPointerLock?.();
    }
    flyTo(mode === 'overview' ? overviewPose : walkPose, 1220, 3.8);
    return true;
  }

  function toggleMode() {
    return setMode(mode === 'overview' ? 'walk' : 'overview');
  }

  function jumpTo(id) {
    if (!layout || destroyed) return false;
    const point = layout.points.find(candidate => candidate.id === id);
    if (!point) return false;

    if (mode === 'overview') {
      previewPoint = point;
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
    if (!layout || destroyed) return false;
    player = { ...nearestStandable(layout.spawn, layout), yaw: layoutHeading(layout.spawn.yaw) };
    previewPoint = null;
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
    if (destroyed) return;
    touchX = Number.isFinite(x) ? clamp(x, -1, 1) : 0;
    touchY = Number.isFinite(y) ? clamp(y, -1, 1) : 0;
  }

  function lookTouch(dx, dy) {
    if (!layout || destroyed || mode !== 'walk' || transition || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    player.yaw = wrapAngle(player.yaw - dx * 0.0028);
    pitch = clamp(pitch - dy * 0.0028, -Math.PI * 0.46, Math.PI * 0.46);
    applyPose(walkPose());
  }

  function interact() {
    if (!layout || destroyed || transition) return false;
    const point = mode === 'walk' ? nearestZone() : previewPoint;
    if (!point) return false;
    onInteract?.(point);
    return true;
  }

  function updatePlayer(delta) {
    const hasKey = (one, two) => Number(keys.has(one) || keys.has(two));
    const strafe = hasKey('KeyD', 'ArrowRight') - hasKey('KeyA', 'ArrowLeft') + touchX;
    const forward = hasKey('KeyW', 'ArrowUp') - hasKey('KeyS', 'ArrowDown') - touchY;
    if (!(strafe || forward)) return;
    const vector = movementVector(player.yaw, strafe, forward);
    const next = movePlayer(player, vector.x * delta * WALK_SPEED, vector.z * delta * WALK_SPEED, layout);
    if (next.x === player.x && next.z === player.z) return;
    Object.assign(player, next);
    heroYaw = player.yaw;
    placeHero();
    applyPose(walkPose());
    setZone(nearestZone());
  }

  function resize() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!renderer || !width || !height) return;
    aspect = width / height;
    const pixelRatio = Math.min(win.devicePixelRatio || 1, 1.65);
    if (renderer.getPixelRatio() !== pixelRatio) renderer.setPixelRatio(pixelRatio);
    renderer.setSize(Math.round(width), Math.round(height), false);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    if (layout && mode === 'overview' && !transition && currentPose) applyPose(overviewPose());
    dirty = true;
  }

  function step(now) {
    if (destroyed) return;
    const delta = clamp((now - lastFrame) / 1000, 0, 0.05);
    lastFrame = now;
    if (transition) {
      const { start, from, getTarget, milliseconds, lift, travelInset } = transition;
      const progress = reducedMotion?.matches ? 1 : (now - start) / milliseconds;
      applyPose(sampleCameraTransition(from, getTarget(), progress, lift, travelInset));
      if (progress >= 1) finishTransition();
    } else if (mode === 'walk') {
      updatePlayer(delta);
    }
    if (dirty && !doc.hidden) {
      renderer.render(scene, camera);
      dirty = false;
    }
    if (!destroyed) frameId = win.requestAnimationFrame(step);
  }

  function onKeyDown(event) {
    if (!layout || (doc.activeElement !== canvas && doc.pointerLockElement !== canvas) || event.defaultPrevented ||
        event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return;
    if (event.code === 'KeyV' || event.code === 'KeyE') {
      event.preventDefault();
      if (!event.repeat) {
        if (event.code === 'KeyV') toggleMode();
        else interact();
      }
    } else if (mode === 'walk' && WALK_KEYS.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
  }

  function useDrag() {
    if (!lockPending || destroyed) return;
    lockPending = false;
    lockFailed = true;
    if (mode === 'walk') onStatus?.('拖动场景可以转动视角。');
  }

  function pointerDown(event) {
    if (event.button !== 0 || event.pointerType === 'touch' || !layout) return;
    canvas.focus({ preventScroll: true });
    if (mode !== 'walk' || transition || locked) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    canvas.setPointerCapture?.(event.pointerId);
    if (event.pointerType !== 'mouse' || lockFailed || lockPending || !canvas.requestPointerLock) return;
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
    if (locked && mode !== 'walk') {
      doc.exitPointerLock?.();
      return;
    }
    if (locked) {
      endDrag();
      onStatus?.('鼠标控制视角，按 Esc 释放。');
    } else if (hadLock) {
      clearInput();
      if (mode === 'walk') onStatus?.('点击场景继续走动。');
    }
  }

  function installControls() {
    if (tabIndex === null) canvas.tabIndex = 0;
    canvas.style.touchAction = 'none';
    const listen = (target, event, listener) => target.addEventListener(event, listener, { signal: controls.signal });
    listen(doc, 'keydown', onKeyDown);
    listen(doc, 'keyup', event => keys.delete(event.code));
    listen(canvas, 'blur', clearInput);
    listen(win, 'blur', clearInput);
    listen(doc, 'visibilitychange', () => {
      if (doc.hidden) clearInput();
      else dirty = true;
    });
    listen(canvas, 'pointerdown', pointerDown);
    listen(canvas, 'pointermove', event => {
      if (drag?.id !== event.pointerId || locked) return;
      lookTouch(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      listen(canvas, event, pointer => { if (drag?.id === pointer.pointerId) endDrag(); });
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
    if (win.ResizeObserver) {
      resizeObserver = new win.ResizeObserver(resize);
      resizeObserver.observe(canvas);
    } else {
      listen(win, 'resize', resize);
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    abort.abort();
    controls.abort();
    if (frameId !== undefined) win.cancelAnimationFrame(frameId);
    resizeObserver?.disconnect();
    endDrag();
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
    addLighting(scene);
    installControls();
    resize();
    onProgress?.(0);

    const urls = ASSETS.map(assetUrl);
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
    player = { ...spawn, yaw: layoutHeading(layout.spawn.yaw) };
    const factory = models[0].value.scene;
    factory.traverse(object => {
      if (object.isMesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
    hero = models[1].value.scene;
    hero.traverse(object => { if (object.isMesh) object.receiveShadow = true; });
    heroShadow = addHeroShadow(scene);
    scene.add(factory, hero);
    updateWayfinding = createWayfinding(layout, scene);
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

  return { ready, setMode, toggleMode, jumpTo, reset, moveTouch, lookTouch, interact, destroy };
}
