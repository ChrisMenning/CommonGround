'use strict';
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const layersRouter = require('./routes/layers');
const featuresRouter = require('./routes/features');
const alertsRouter = require('./routes/alerts');
const weatherRouter = require('./routes/weather');
const resourcesRouter = require('./routes/resources');

const app = express();

// Security headers — allow map tiles and worker blobs needed by MapLibre
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'https://api.weather.gov', 'https://www.airnowapi.org'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      workerSrc: ["'self'", 'blob:'],
    },
  },
}));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // allow non-browser tools (curl, etc.) and listed origins
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST'],
}));

app.use(express.json({ limit: '10kb' }));

// Rate limiting — protects against abuse; community use stays well under this
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '120'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Routes
app.use('/layers', layersRouter);
app.use('/features', featuresRouter);
app.use('/alerts', alertsRouter);
app.use('/weather', weatherRouter);
app.use('/resources', resourcesRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '1.0.0', phase: 1 });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler — never leak stack traces to clients
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? 'Internal server error' : err.message });
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`[commonground-api] listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});
