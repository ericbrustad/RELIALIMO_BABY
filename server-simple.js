// Minimal static file server for RELIALIMO (no deps)
// Usage: node server-simple.js [port]

const http = require('http');
const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const port = Number(process.argv[2]) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function safeResolve(p) {
  const resolved = path.normalize(path.join(rootDir, p));
  if (!resolved.startsWith(rootDir)) return null; // prevent path traversal
  return resolved;
}

const server = http.createServer((req, res) => {
  const parsedUrl = req.url || '/';
  let pathname = decodeURIComponent(parsedUrl);
  if (pathname === '/') pathname = '/index.html';
  const filePath = safeResolve(pathname);
  if (!filePath) return send(res, 403, {'Content-Type':'text/plain'}, 'Forbidden');

  fs.stat(filePath, (err, stat) => {
    if (err) {
      return send(res, 404, {'Content-Type':'text/plain'}, 'Not Found');
    }
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      fs.readFile(indexPath, (err, data) => {
        if (err) return send(res, 403, {'Content-Type':'text/plain'}, 'Forbidden');
        send(res, 200, {'Content-Type': MIME['.html']}, data);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    fs.readFile(filePath, (err, data) => {
      if (err) return send(res, 500, {'Content-Type':'text/plain'}, 'Server Error');
      send(res, 200, {'Content-Type': type}, data);
    });
  });
});

server.listen(port, () => {
  console.log(`Static server running at http://localhost:${port}`);
  console.log(`Serving directory: ${rootDir}`);
});
