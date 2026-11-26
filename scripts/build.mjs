import { mkdir, readFile, readdir, writeFile, copyFile } from 'node:fs/promises';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(project, 'dist', 'server');
const safe = await readdir(join(project, 'assets'));
const entries = [
  'index.html', 'app.js', 'state.js', 'config.js', 'cloud.js', 'styles.css',
  'training.js', 'training.css', 'community.js', 'community.css', 'community-play.css', 'online-play.css',
  'factory-page.js', 'factory-page.css', 'factory-view.js', 'factory-motion.js', 'factory-activity.js', 'assets/factory-layout.json',
  ...safe.filter(name => name.endsWith('.webp') || name === 'icon.png').map(name => 'assets/' + name),
];
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webp': 'image/webp', '.png': 'image/png',
};
const staticFiles = Object.fromEntries(await Promise.all(entries.map(async file => {
  const content = await readFile(join(project, file));
  return ['/' + file, [mime[extname(file)], content.toString('base64')]];
})));
// Large scene data and the unchanged Three.js package are served by the public static mirror.
const external = [
  '/assets/factory.glb', '/assets/worker-hero.glb',
  '/vendor/three/three.core.min.js', '/vendor/three/three.module.min.js',
  '/vendor/three/addons/loaders/GLTFLoader.js', '/vendor/three/addons/utils/BufferGeometryUtils.js',
];
await Promise.all(external.map(file => readFile(join(project, file.slice(1)))));
await mkdir(dist, { recursive: true });
await copyFile(join(project, 'worker', 'index.js'), join(dist, 'api.js'));
await writeFile(join(dist, 'index.js'), [
  "import api from './api.js';",
  'const assets = ' + JSON.stringify(staticFiles) + ';',
  'const external = new Set(' + JSON.stringify(external) + ');',
  "export default { async fetch(request, env) {",
  "  const url = new URL(request.url);",
  "  const path = url.pathname;",
  "  if (path.startsWith('/api/')) return api.fetch(request, env);",
  "  if (external.has(path) && ['GET','HEAD'].includes(request.method)) {",
  "    if (env.LOCAL_ASSETS) return env.LOCAL_ASSETS.fetch(request);",
  "    return Response.redirect('https://wthpein010-dev.github.io/assembly-workshop' + path + url.search, 302);",
  "  }",
  "  const file = assets[path === '/' ? '/index.html' : path];",
  "  if (!file || !['GET','HEAD'].includes(request.method)) return new Response('Not found', { status: 404 });",
  "  const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(file[1]), char => char.charCodeAt(0));",
  "  return new Response(body, { headers: { 'Content-Type': file[0], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': file[0].startsWith('image') ? 'public, max-age=3600' : 'no-cache' } });",
  "} };",
].join('\n'));
console.log('Worker built with ' + entries.length + ' embedded browser files.');
