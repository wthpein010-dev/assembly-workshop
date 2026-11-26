import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = dirname(dirname(fileURLToPath(import.meta.url)));
const { default: worker } = await import(pathToFileURL(join(project, 'dist/server/index.js')));
const sql = new DatabaseSync(':memory:');
sql.exec(await readFile(join(project, 'drizzle/0000_workshop.sql'), 'utf8'));

function statement(query, params = []) {
  const stmt = sql.prepare(query);
  return {
    bind: (...next) => statement(query, next),
    run: async () => ({ success: true, meta: stmt.run(...params) }),
    all: async () => ({ success: true, results: stmt.all(...params) }),
    first: async () => stmt.get(...params) ?? null,
  };
}
const env = { DB: { prepare: statement } };
const port = Number(process.env.WORKSHOP_PORT || 4178);
const origin = 'http://127.0.0.1:' + port;

createServer(async (req, res) => {
  try {
    const hasBody = !['GET', 'HEAD'].includes(req.method);
    const request = new Request(new URL(req.url, origin), {
      method: req.method, headers: req.headers,
      ...(hasBody ? { body: req, duplex: 'half' } : {}),
    });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('本地服务暂时无法处理请求。');
  }
}).listen(port, '127.0.0.1', () => console.log('Local workshop: ' + origin));
