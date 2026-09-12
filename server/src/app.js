const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const producerRoutes = require('./routes/producers');
const transporterRoutes = require('./routes/transporters');
const recipientRoutes = require('./routes/recipients');
const auctionRoutes = require('./routes/auctions');
const bidRoutes = require('./routes/bids');
const adminRoutes = require('./routes/admin');
const documentsRoutes = require('./routes/documents');
const cerRoutes = require('./routes/cer');

const app = express();

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
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'WasteMarket API' });
});

app.use('/api/auth', authRoutes);
app.use('/api/producers', producerRoutes);
app.use('/api/transporters', transporterRoutes);
app.use('/api/recipients', recipientRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/bids', bidRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/cer-codes', cerRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
