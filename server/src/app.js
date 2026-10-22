const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const producerRoutes = require('./routes/producers');
const transporterRoutes = require('./routes/transporters');
const recipientRoutes = require('./routes/recipients');
const pickupRoutes = require('./routes/pickups');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
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
app.use('/api/pickups', pickupRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);

app.use((err, _req, res, _next) => {
  if (!err.status) console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

module.exports = app;
