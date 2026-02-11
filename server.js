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

const defaultRedirectMap = {
  home: 'https://example.com',
  docs: 'https://example.com/docs'
};

const loadRedirectMap = () => {
  const raw = process.env.REDIRECT_MAP;
  if (!raw) {
    return defaultRedirectMap;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return defaultRedirectMap;
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && /^https?:\/\//i.test(value)) {
        cleaned[key] = value;
      }
    }

    return Object.keys(cleaned).length > 0 ? cleaned : defaultRedirectMap;
  } catch {
    return defaultRedirectMap;
  }
};

const redirectMap = loadRedirectMap();

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

const sendStatus = (res, statusCode, message = '') => {
  res.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(message);
};

const escapeHtml = (value) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const renderInterstitial = (destination, sourceLabel = 'custom link') => {
  const safeDestination = escapeHtml(destination);
  const safeSourceLabel = escapeHtml(sourceLabel);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Continue</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
      }

      main {
        width: min(640px, calc(100vw - 32px));
        margin: 40px auto;
        padding: 16px;
      }

      .destination {
        margin: 12px 0;
        overflow-wrap: anywhere;
      }

      .actions {
        display: flex;
        gap: 10px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Leaving this app</h1>
      <p>Source: ${safeSourceLabel}</p>
      <p>Destination:</p>
      <p class="destination">${safeDestination}</p>
      <div class="actions">
        <a href="${safeDestination}" rel="noopener noreferrer">Continue</a>
        <a href="/">Cancel</a>
      </div>
    </main>
  </body>
</html>`;
};

const server = http.createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || '0.0.0.0'}`);

  if (requestUrl.pathname.startsWith('/service/')) {
    const encoded = requestUrl.pathname.slice('/service/'.length);

    let destination = '';
    try {
      destination = decodeURIComponent(encoded);
    } catch {
      sendStatus(res, 400, 'Invalid destination encoding');
      return;
    }

    if (!/^https?:\/\//i.test(destination)) {
      sendStatus(res, 400, 'Destination must begin with http:// or https://');
      return;
    }

    const html = renderInterstitial(destination, 'service redirect');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  if (requestUrl.pathname.startsWith('/go/')) {
    const id = requestUrl.pathname.slice('/go/'.length).trim();
    const destination = redirectMap[id];

    if (!id || !destination) {
      sendStatus(res, 404, 'Unknown short link ID');
      return;
    }

    const html = renderInterstitial(destination, `go/${id}`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
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
