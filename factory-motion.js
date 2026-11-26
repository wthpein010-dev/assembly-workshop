export const EYE_HEIGHT = 1.62;
export const PLAYER_RADIUS = 0.28;

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function overviewDistance(bounds, aspect, azimuth, fov) {
  const width = bounds.maxX - bounds.minX;
  const depth = bounds.maxZ - bounds.minZ;
  const sin = Math.abs(Math.sin(azimuth));
  const cos = Math.abs(Math.cos(azimuth));
  const projectedHeight = Math.SQRT1_2 * (width * sin + depth * cos) + 3.2;
  const projectedWidth = width * cos + depth * sin;
  // Allow narrow displays to crop the sides while keeping the floor useful at its center.
  const frameHeight = Math.max(projectedHeight * 0.94, projectedWidth * 0.93 / Math.max(1.25, aspect));
  return frameHeight / (2 * Math.tan(fov * Math.PI / 360));
}

export function shiftOverview(view, bounds, azimuth, right, forward) {
  const sin = Math.sin(azimuth);
  const cos = Math.cos(azimuth);
  const insetX = Math.min(0.75, (bounds.maxX - bounds.minX) / 4);
  const insetZ = Math.min(0.75, (bounds.maxZ - bounds.minZ) / 4);
  return {
    x: clamp(view.x + cos * right - sin * forward, bounds.minX + insetX, bounds.maxX - insetX),
    z: clamp(view.z - sin * right - cos * forward, bounds.minZ + insetZ, bounds.maxZ - insetZ),
    zoom: view.zoom,
  };
}

export function dampOverview(current, target, elapsed) {
  if (Math.abs(current.x - target.x) < 0.001 && Math.abs(current.z - target.z) < 0.001 &&
      Math.abs(current.zoom - target.zoom) < 0.00005) return target;
  const weight = 1 - Math.exp(-13 * elapsed);
  return {
    x: current.x + (target.x - current.x) * weight,
    z: current.z + (target.z - current.z) * weight,
    zoom: current.zoom + (target.zoom - current.zoom) * weight,
  };
}

export function movementVector(yaw, strafe, forward) {
  const scale = Math.max(1, Math.hypot(strafe, forward));
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return {
    x: (sin * forward - cos * strafe) / scale,
    z: (cos * forward + sin * strafe) / scale,
  };
}

export function isStandable({ x, z }, { bounds, obstacles }, radius = PLAYER_RADIUS) {
  return x >= bounds.minX + radius && x <= bounds.maxX - radius &&
    z >= bounds.minZ + radius && z <= bounds.maxZ - radius &&
    !obstacles.some(box => x > box.minX - radius && x < box.maxX + radius &&
      z > box.minZ - radius && z < box.maxZ + radius);
}

export function nearestStandable(point, layout) {
  const { bounds } = layout;
  const x = clamp(point.x, bounds.minX + PLAYER_RADIUS, bounds.maxX - PLAYER_RADIUS);
  const z = clamp(point.z, bounds.minZ + PLAYER_RADIUS, bounds.maxZ - PLAYER_RADIUS);
  if (isStandable({ x, z }, layout)) return { x, z };

  for (let distance = 0.25; distance <= 4; distance += 0.25) {
    for (let index = 0; index < 24; index++) {
      const angle = index * Math.PI / 12;
      const candidate = { x: x + Math.sin(angle) * distance, z: z + Math.cos(angle) * distance };
      if (isStandable(candidate, layout)) return candidate;
    }
  }
  return null;
}

function sweepAxis(position, cross, delta, lower, upper, obstacles, acrossLower, acrossUpper, radius) {
  let end = position + delta;
  for (const box of obstacles) {
    if (cross <= box[acrossLower] - radius || cross >= box[acrossUpper] + radius) continue;
    const edge = delta > 0 ? box[lower] - radius : box[upper] + radius;
    if (delta > 0 && position <= edge) end = Math.min(end, edge);
    if (delta < 0 && position >= edge) end = Math.max(end, edge);
  }
  return end;
}

export function movePlayer({ x, z }, dx, dz, { bounds, obstacles }, radius = PLAYER_RADIUS) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.15));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  for (let index = 0; index < steps; index++) {
    x = clamp(sweepAxis(x, z, stepX, 'minX', 'maxX', obstacles, 'minZ', 'maxZ', radius),
      bounds.minX + radius, bounds.maxX - radius);
    z = clamp(sweepAxis(z, x, stepZ, 'minZ', 'maxZ', obstacles, 'minX', 'maxX', radius),
      bounds.minZ + radius, bounds.maxZ - radius);
  }
  return { x, z };
}

export function sampleCameraTransition(from, to, progress, lift = 0, travelInset = 0) {
  if (progress <= 0) return from;
  if (progress >= 1) return to;

  const ease = value => value * value * (3 - 2 * value);
  const phase = ease(progress);
  const travel = travelInset ? ease(clamp((phase - travelInset) / (1 - 2 * travelInset), 0, 1)) : phase;
  const blend = (start, end) => start + (end - start) * phase;
  const radiansPerHalfDegree = Math.PI / 360;
  return {
    x: from.x + (to.x - from.x) * travel,
    y: blend(from.y, to.y) + lift * Math.sin(Math.PI * phase) ** 2,
    z: from.z + (to.z - from.z) * travel,
    yaw: wrapAngle(from.yaw + wrapAngle(to.yaw - from.yaw) * phase),
    pitch: blend(from.pitch, to.pitch),
    fov: Math.atan(blend(Math.tan(from.fov * radiansPerHalfDegree),
      Math.tan(to.fov * radiansPerHalfDegree))) / radiansPerHalfDegree,
  };
}
