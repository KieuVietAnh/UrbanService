import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import morgan from 'morgan';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(morgan('dev'));

// Allow any origin to talk to this proxy (dev-only)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

const API_TARGET = process.env.TARGET_API || 'https://api.urbanservice.me';

app.use(
  '/api',
  createProxyMiddleware({
    target: API_TARGET,
    changeOrigin: true,
    secure: true,
    pathRewrite: {
      '^/api': '/api',
    },
    onProxyReq(proxyReq, req, res) {
      // forward original host header if needed
      proxyReq.setHeader('X-Forwarded-Host', req.headers.host || 'localhost');
    },
    onError(err, req, res) {
      console.error('Proxy error', err);
      res.status(502).json({ error: 'Proxy error' });
    },
  }),
);

app.get('/', (req, res) => res.send('UrbanService dev proxy running'));

app.listen(PORT, () => {
  console.log(`Dev proxy listening on http://localhost:${PORT} -> ${API_TARGET}`);
});
