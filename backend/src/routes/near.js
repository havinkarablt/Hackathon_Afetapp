const express = require('express');
const router = express.Router();
const { findNearbyPoints } = require('../services/spatial');

// Validasyon middleware'i
function validateCoordinates(req, res, next) {
  const { lon, lat } = req.query;
  
  if (!lon || !lat) {
    return res.status(400).json({
      error: 'Koordinatlar gerekli',
      required_params: { lon: 'number', lat: 'number' },
      example: '?lon=28.9784&lat=41.0082'
    });
  }
  
  const longitude = parseFloat(lon);
  const latitude = parseFloat(lat);
  
  if (isNaN(longitude) || isNaN(latitude)) {
    return res.status(400).json({
      error: 'Geçersiz koordinat formatı',
      received: { lon, lat }
    });
  }
  
  // İstanbul sınırları kontrolü
  const bounds = {
    north: 41.2,
    south: 40.8,
    east: 29.5,
    west: 28.5
  };
  
  if (latitude < bounds.south || latitude > bounds.north || 
      longitude < bounds.west || longitude > bounds.east) {
    return res.status(400).json({
      error: 'Konum İstanbul sınırları dışında',
      bounds: bounds,
      received: { lat: latitude, lon: longitude }
    });
  }
  
  req.coordinates = { longitude, latitude };
  next();
}

// En yakın toplanma alanları
router.get('/assembly-areas', validateCoordinates, async (req, res) => {
  try {
    const { longitude, latitude } = req.coordinates;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    
    const features = await findNearbyPoints({
      table: 'assembly_areas',
      longitude,
      latitude,
      limit
    });
    
    console.log(`📍 ${features.length} toplanma alanı bulundu (${latitude}, ${longitude}) konumu için`);
    
    res.json({
      type: 'FeatureCollection',
      query: {
        coordinates: { lat: latitude, lon: longitude },
        limit: limit,
        type: 'assembly_areas'
      },
      features: features,
      metadata: {
        timestamp: new Date().toISOString(),
        count: features.length,
        source: 'İstanbul Büyükşehir Belediyesi'
      }
    });
    
  } catch (error) {
    console.error('❌ Assembly areas sorgusu hatası:', error);
    res.status(500).json({ 
      error: 'Toplanma alanları sorgulanamadı',
      message: process.env.NODE_ENV === 'production' 
        ? 'Lütfen tekrar deneyiniz' 
        : error.message
    });
  }
});

// En yakın hastaneler
router.get('/hospitals', validateCoordinates, async (req, res) => {
  try {
    const { longitude, latitude } = req.coordinates;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);
    
    const features = await findNearbyPoints({
      table: 'hospitals',
      longitude,
      latitude,
      limit
    });
    
    console.log(`🏥 ${features.length} hastane bulundu (${latitude}, ${longitude}) konumu için`);
    
    res.json({
      type: 'FeatureCollection',
      query: {
        coordinates: { lat: latitude, lon: longitude },
        limit: limit,
        type: 'hospitals'
      },
      features: features,
      metadata: {
        timestamp: new Date().toISOString(),
        count: features.length,
        source: 'İstanbul İl Sağlık Müdürlüğü'
      }
    });
    
  } catch (error) {
    console.error('❌ Hospitals sorgusu hatası:', error);
    res.status(500).json({ 
      error: 'Hastaneler sorgulanamadı',
      message: process.env.NODE_ENV === 'production' 
        ? 'Lütfen tekrar deneyiniz' 
        : error.message
    });
  }
});

// Kombinasyon sorgusu - hem toplanma alanları hem hastaneler
router.get('/all', validateCoordinates, async (req, res) => {
  try {
    const { longitude, latitude } = req.coordinates;
    const limit = Math.min(parseInt(req.query.limit) || 3, 10); // Her tip için limit
    
    const [assemblyAreas, hospitals] = await Promise.all([
      findNearbyPoints({
        table: 'assembly_areas',
        longitude,
        latitude,
        limit
      }),
      findNearbyPoints({
        table: 'hospitals',
        longitude,
        latitude,
        limit
      })
    ]);
    
    res.json({
      type: 'FeatureCollection',
      query: {
        coordinates: { lat: latitude, lon: longitude },
        limit_per_type: limit
      },
      features: [
        ...assemblyAreas.map(f => ({ ...f, category: 'assembly_area' })),
        ...hospitals.map(f => ({ ...f, category: 'hospital' }))
      ],
      summary: {
        assembly_areas_count: assemblyAreas.length,
        hospitals_count: hospitals.length,
        total_count: assemblyAreas.length + hospitals.length
      },
      metadata: {
        timestamp: new Date().toISOString(),
        source: 'İstanbul Afet Koordinasyon Merkezi'
      }
    });
    
  } catch (error) {
    console.error('❌ Combined query hatası:', error);
    res.status(500).json({ 
      error: 'Yakın konumlar sorgulanamadı' 
    });
  }
});

// Belirli bir mesafe içindeki noktalar
router.get('/within/:distance', validateCoordinates, async (req, res) => {
  try {
    const { longitude, latitude } = req.coordinates;
    const distance = Math.min(parseFloat(req.params.distance) || 1000, 10000); // metre, max 10km
    const type = req.query.type; // 'assembly_areas' veya 'hospitals'
    
    if (!type || !['assembly_areas', 'hospitals'].includes(type)) {
      return res.status(400).json({
        error: 'Geçersiz tip',
        valid_types: ['assembly_areas', 'hospitals'],
        example: '/api/near/within/1000?type=hospitals&lon=28.9784&lat=41.0082'
      });
    }
    
    const features = await findNearbyPoints({
      table: type,
      longitude,
      latitude,
      distance,
      limit: 50 // Mesafe bazlı sorgularda daha fazla sonuç
    });
    
    res.json({
      type: 'FeatureCollection',
      query: {
        coordinates: { lat: latitude, lon: longitude },
        distance_meters: distance,
        type: type
      },
      features: features,
      metadata: {
        timestamp: new Date().toISOString(),
        count: features.length
      }
    });
    
  } catch (error) {
    console.error('❌ Distance query hatası:', error);
    res.status(500).json({ 
      error: 'Mesafe bazlı sorgu başarısız' 
    });
  }
});

module.exports = router;