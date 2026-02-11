const fs = require('fs');
const path = require('path');
const http = require('http');

const host = '0.0.0.0';
const port = Number(process.env.PORT || 3000);
const root = __dirname;
const indexPath = path.join(root, 'index.html');

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};

const sendFile = (res, filePath) => {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end();
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = contentTypes[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': type });
    res.end(data);
  });
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || '0.0.0.0'}`);

  if (requestUrl.pathname.startsWith('/service/')) {
    const encoded = requestUrl.pathname.slice('/service/'.length);

    let destination = '';
    try {
      destination = decodeURIComponent(encoded);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }

    if (!/^https?:\/\//i.test(destination)) {
      res.writeHead(400);
      res.end();
      return;
    }

    res.writeHead(302, { Location: destination });
    res.end();
    return;
  }

  const requestedPath = decodeURIComponent(requestUrl.pathname);
  const safePath = path.normalize(requestedPath).replace(/^\/+/, '');
  const fullPath = path.join(root, safePath);

  if (safePath && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    sendFile(res, fullPath);
    return;
  }

  sendFile(res, indexPath);
});

server.listen(port, host);
