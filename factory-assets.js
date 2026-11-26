const files = ['factory.glb', 'worker-hero.glb', 'factory-layout.json'];
const weights = [0.85, 0.12, 0.03];
const urlFor = name => `./assets/${name}${name.endsWith('.glb') ? '?v=ca1' : ''}`;

async function fetchAsset(url, signal, progress, priority) {
  const response = await fetch(url, { signal, priority });
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

export async function loadFactoryAssets(workerProfile, signal, onProgress, assetUrl = urlFor) {
  const urls = files.map((name, index) => assetUrl(index === 1 && workerProfile?.gender === 'female' ? 'worker-hero-female.glb' : name));
  const progress = [0, 0, 0];
  const bytes = await Promise.all(urls.map((url, index) => fetchAsset(url, signal, value => {
    progress[index] = value;
    if (!signal.aborted) onProgress?.(0.94 * progress.reduce((total, part, piece) => total + part * weights[piece], 0));
  }, index === 0 ? 'high' : 'auto')));
  return { urls, bytes };
}
