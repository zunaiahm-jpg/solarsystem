// Minimal dev/prod server: serves the static site AND runs the api/*.js
// serverless-style handlers. `serve` alone cannot execute the API functions,
// which is why the register/feedback forms returned "Network error" in preview.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ktx2': 'image/ktx2',
  '.basis': 'application/octet-stream',
};

// Wrap Node's res with the Express/Vercel-style helpers the handlers expect.
function decorateResponse(res) {
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (obj) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };
  return res;
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function handleApi(req, res, routePath) {
  const file = path.join(ROOT, 'api', `${routePath}.js`);
  if (!fs.existsSync(file)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const handler = require(file);
    req.body = await readBody(req);
    await handler(req, res);
  } catch (error) {
    console.log('[v0] api handler error:', error && error.message);
    if (!res.headersSent) res.status(500).json({ error: 'Server error. Please try again.' });
  }
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);

  // Prevent path traversal outside the project root.
  if (!filePath.startsWith(ROOT)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  decorateResponse(res);
  const pathname = (req.url || '/').split('?')[0];
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname.slice('/api/'.length));
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`[v0] server listening on http://localhost:${PORT}`);
});
