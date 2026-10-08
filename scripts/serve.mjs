import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + sep) || !types[extname(file)] || pathname.split('/').some(s => s.startsWith('.'))) { res.writeHead(403).end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)], 'Cache-Control': 'no-store' }).end(body);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(5173, '127.0.0.1', () => console.log('MTR Live: http://127.0.0.1:5173'));
