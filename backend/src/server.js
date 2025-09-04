require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'up', timestamp: new Date().toISOString() });
});

app.get('/api/health/db', (req, res) => {
  res.json({ db: 'up', timestamp: new Date().toISOString() });
});

app.post('/api/emergency', (req, res) => {
  const { lon, lat } = req.body;
  console.log(`Emergency call: ${lat}, ${lon}`);
  res.status(201).json({ 
    success: true, 
    call: { id: Math.floor(Math.random() * 1000), coordinates: { lat, lon } }
  });
});

app.get('/api/near/:type', (req, res) => {
  const { type } = req.params;
  const { lon, lat } = req.query;
  
  res.json({
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { 
          name: `Test ${type}`, 
          distance_km: 0.5,
          category: type === 'assembly-areas' ? 'Toplanma Alanı' : 'Hastane'
        },
        geometry: { type: 'Point', coordinates: [parseFloat(lon) + 0.001, parseFloat(lat) + 0.001] }
      }
    ]
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});