const express = require('express');
const router = express.Router();

// Ana endpoint
router.get('/', (req, res) => {
  res.json({
    app: 'AfetApp MVP',
    version: '1.0.0',
    description: 'İstanbul Acil Durum Yönetim Sistemi',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      db_health: '/api/health/db',
      emergency: 'POST /api/emergency',
      near_assembly: 'GET /api/near/assembly-areas?lon=X&lat=Y&limit=5',
      near_hospitals: 'GET /api/near/hospitals?lon=X&lat=Y&limit=5'
    },
    location: 'İstanbul, Türkiye',
    coordinates: {
      bounds: {
        north: 41.2,
        south: 40.8,
        east: 29.5,
        west: 28.5
      },
      center: {
        lat: 41.0082,
        lon: 28.9784
      }
    }
  });
});

// API info
router.get('/api', (req, res) => {
  res.json({
    api: 'AfetApp API',
    version: 'v1',
    documentation: '/docs/API.md',
    base_url: `${req.protocol}://${req.get('host')}/api`
  });
});

module.exports = router;