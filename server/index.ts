import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ALLOWED_HOSTS, ALLOWED_ORIGINS, DEV, HOST, LIMITS, PORT } from './config.ts';
import { guardMiddleware } from './guard.ts';
import { hasKey } from './lib/gemini.ts';
import { UsageCounter } from './lib/usage.ts';
import { systemRoutes } from './routes/system.ts';
import { ttsRoutes } from './routes/tts.ts';
import { voiceRoutes } from './routes/voices.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = join(root, 'dist');
const sessionToken = randomBytes(32).toString('base64url');
const usage = new UsageCounter();

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const app = express();
app.disable('x-powered-by');

// Metadata-only request log (spec S11): never bodies, text, audio or headers.
app.use((req, res, next) => {
  const started = Date.now();
  // Read now, from originalUrl: routers mounted on /api rewrite req.path ("/tts") before the response
  // ends, which hid every routed request. The query string is dropped; the case check matches the guard.
  const path = req.originalUrl.split('?')[0] ?? '';
  res.on('finish', () => {
    if (path.toLowerCase().startsWith('/api/')) console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  next();
});

app.use((_req, res, next) => {
  res.set({
    'Content-Security-Policy': CSP,
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
  });
  next();
});

app.use(guardMiddleware({ allowedHosts: ALLOWED_HOSTS, allowedOrigins: ALLOWED_ORIGINS, sessionToken }));

// localhost and 127.0.0.1 are two browser origins with two separate IndexedDB stores: keep one.
app.use((req, res, next) => {
  if (req.method === 'GET' && req.hostname === 'localhost' && !req.path.toLowerCase().startsWith('/api')) {
    res.redirect(302, `http://${HOST}:${PORT}${req.originalUrl}`);
    return;
  }
  next();
});

app.use('/api', systemRoutes(sessionToken, usage));
app.use('/api', ttsRoutes(usage));
app.use('/api', voiceRoutes(usage));
app.use('/api', (_req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: 'Unknown API route.' });
});

if (existsSync(join(distDir, 'index.html'))) {
  // index.html is revalidated on every load so a rebuilt app shows at once; hashed assets never change.
  app.use(
    express.static(distDir, {
      index: 'index.html',
      setHeaders: (res, filePath) => {
        res.setHeader('Cache-Control', filePath.endsWith('.html') ? 'no-cache' : 'public, max-age=31536000, immutable');
      },
    }),
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.set('Cache-Control', 'no-cache').sendFile(join(distDir, 'index.html'));
  });
} else if (!DEV) {
  app.use((_req, res) => {
    res.status(503).type('text/plain').send('The interface is not built yet. Run "npm run build", then restart.');
  });
}

app.use((error: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (error.type === 'entity.parse.failed') {
    res.status(400).json({ code: 'BAD_JSON', message: 'Malformed JSON body.' });
    return;
  }
  if (error.type === 'entity.too.large') {
    res.status(413).json({ code: 'TOO_LARGE', message: 'Request body too large.' });
    return;
  }
  console.error('Unhandled error:', error.message);
  res.status(500).json({ code: 'INTERNAL', message: 'Internal server error.' });
});

const server = app.listen(PORT, HOST, () => {
  const url = `http://${HOST}:${PORT}`;
  console.log(`Timbre Studio server on ${url} (${DEV ? 'dev API' : 'app + API'})`);
  console.log(hasKey() ? 'Gemini API key: present' : 'Gemini API key: MISSING - add GEMINI_API_KEY to .env and restart');
  if (process.env.OPEN_BROWSER === '1' && process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
  }
});

server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use: Timbre Studio may already be running at http://${HOST}:${PORT}`);
    process.exit(1);
  }
  throw error;
});
