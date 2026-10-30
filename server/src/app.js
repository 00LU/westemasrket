const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const authRoutes = require('./routes/auth');
const producerRoutes = require('./routes/producers');
const transporterRoutes = require('./routes/transporters');
const recipientRoutes = require('./routes/recipients');
const pickupRoutes = require('./routes/pickups');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const documentsRoutes = require('./routes/documents');
const cerRoutes = require('./routes/cer');

const app = express();

app.set('etag', false);

const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      const isLocalhostOrigin = /^(http|https):\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhostOrigin) {
        callback(null, true);
        return;
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-File-Name'],
  })
);
app.use(express.json({ limit: '2mb' }));
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'WasteMarket API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/producers', producerRoutes);
app.use('/api/transporters', transporterRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/pickups', pickupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/cer-codes', cerRoutes);

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist');
  const clientIndex = path.join(clientDist, 'index.html');
  if (!fs.existsSync(clientIndex)) {
    throw new Error('Frontend build missing. Run npm run build from the repository root before starting in production.');
  }

  app.use('/api', (_req, res) => {
    res.status(404).json({ message: 'API endpoint not found' });
  });
  app.use(express.static(clientDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path === '/socket.io' || req.path.startsWith('/socket.io/') ||
        req.path.startsWith('/assets/') || path.extname(req.path) || !req.accepts('html')) {
      next();
      return;
    }
    res.set('Cache-Control', 'no-cache');
    res.sendFile(clientIndex);
  });
}

app.use((err, _req, res, _next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
