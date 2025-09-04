const express = require('express');
const router = express.Router();
const { pool } = require('../db/connection');

// Acil durum çağrısı kaydet
router.post('/', async (req, res) => {
  try {
    const { lon, lat, meta = {} } = req.body;
    
    // Koordinat validasyonu
    if (!lon || !lat) {
      return res.status(400).json({
        error: 'Koordinatlar gerekli',
        required: { lon: 'number', lat: 'number' },
        received: { lon, lat }
      });
    }
    
    // Sayı validasyonu
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
    
    // Meta data hazırlama
    const metadata = {
      user_agent: req.get('User-Agent'),
      ip_address: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString(),
      ...meta
    };
    
    // Veritabanına kaydet
    const query = `
      INSERT INTO sos_calls (location, metadata, created_at)
      VALUES (ST_SetSRID(ST_Point($1, $2), 4326), $3, NOW())
      RETURNING 
        id, 
        ST_X(location) as longitude, 
        ST_Y(location) as latitude,
        metadata,
        created_at
    `;
    
    const result = await pool.query(query, [longitude, latitude, JSON.stringify(metadata)]);
    const record = result.rows[0];
    
    console.log(`🆘 Yeni acil durum kaydı: ID=${record.id}, Konum=(${record.latitude}, ${record.longitude})`);
    
    res.status(201).json({
      success: true,
      message: 'Acil durum kaydı oluşturuldu',
      call: {
        id: record.id,
        coordinates: {
          lat: record.latitude,
          lon: record.longitude
        },
        timestamp: record.created_at,
        metadata: record.metadata
      },
      next_steps: [
        'En yakın toplanma alanlarını görmek için: GET /api/near/assembly-areas',
        'En yakın hastaneleri görmek için: GET /api/near/hospitals'
      ]
    });
    
  } catch (error) {
    console.error('❌ Emergency kayıt hatası:', error);
    
    res.status(500).json({
      error: 'Acil durum kaydı sırasında hata',
      message: process.env.NODE_ENV === 'production' 
        ? 'Lütfen tekrar deneyiniz' 
        : error.message
    });
  }
});

// Son acil çağrıları listele (admin için)
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const query = `
      SELECT 
        id,
        ST_X(location) as longitude,
        ST_Y(location) as latitude,
        metadata,
        created_at,
        EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_ago
      FROM sos_calls 
      ORDER BY created_at DESC 
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, [limit, offset]);
    const totalQuery = await pool.query('SELECT COUNT(*) as total FROM sos_calls');
    
    res.json({
      calls: result.rows.map(row => ({
        id: row.id,
        coordinates: {
          lat: row.latitude,
          lon: row.longitude
        },
        metadata: row.metadata,
        created_at: row.created_at,
        seconds_ago: Math.round(row.seconds_ago)
      })),
      pagination: {
        total: parseInt(totalQuery.rows[0].total),
        limit,
        offset,
        has_more: (offset + limit) < parseInt(totalQuery.rows[0].total)
      }
    });
    
  } catch (error) {
    console.error('❌ Emergency listesi hatası:', error);
    res.status(500).json({ error: 'Acil durum kayıtları alınamadı' });
  }
});

// Belirli bir çağrının detayları
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        id,
        ST_X(location) as longitude,
        ST_Y(location) as latitude,
        metadata,
        created_at
      FROM sos_calls 
      WHERE id = $1
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Acil durum kaydı bulunamadı',
        id: id
      });
    }
    
    const record = result.rows[0];
    
    res.json({
      call: {
        id: record.id,
        coordinates: {
          lat: record.latitude,
          lon: record.longitude
        },
        metadata: record.metadata,
        created_at: record.created_at
      }
    });
    
  } catch (error) {
    console.error('❌ Emergency detay hatası:', error);
    res.status(500).json({ error: 'Acil durum kaydı detayı alınamadı' });
  }
});

module.exports = router;