const { pool } = require('../db/connection');

/**
 * Belirli bir konuma yakın noktaları bul
 * @param {Object} params - Sorgu parametreleri
 * @param {string} params.table - Tablo adı ('assembly_areas' veya 'hospitals')
 * @param {number} params.longitude - Boylam
 * @param {number} params.latitude - Enlem  
 * @param {number} params.limit - Sonuç limiti (varsayılan: 5)
 * @param {number} params.distance - Mesafe filtresi (metre, opsiyonel)
 * @returns {Array} GeoJSON Feature array
 */
async function findNearbyPoints({ table, longitude, latitude, limit = 5, distance = null }) {
  try {
    // Tablo validasyonu
    const validTables = ['assembly_areas', 'hospitals'];
    if (!validTables.includes(table)) {
      throw new Error(`Geçersiz tablo adı: ${table}. Geçerli tablolar: ${validTables.join(', ')}`);
    }
    
    const userPoint = `ST_SetSRID(ST_Point($1, $2), 4326)`;
    
    let query = `
      SELECT 
        id,
        name,
        properties,
        ST_AsGeoJSON(location)::json as geometry,
        ST_Distance(location::geography, ${userPoint}::geography) as distance_meters,
        ST_Azimuth(${userPoint}, location) * (180/PI()) as bearing_degrees
      FROM ${table} 
    `;
    
    let queryParams = [longitude, latitude];
    let whereConditions = [];
    
    // Mesafe filtresi varsa ekle
    if (distance && distance > 0) {
      whereConditions.push(`ST_DWithin(location::geography, ${userPoint}::geography, $${queryParams.length + 1})`);
      queryParams.push(distance);
    }
    
    // WHERE clause ekle
    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }
    
    // Sıralama ve limit
    query += ` ORDER BY distance_meters ASC LIMIT $${queryParams.length + 1}`;
    queryParams.push(limit);
    
    const result = await pool.query(query, queryParams);
    
    // GeoJSON Feature formatına dönüştür
    const features = result.rows.map(row => ({
      type: 'Feature',
      id: row.id,
      geometry: row.geometry,
      properties: {
        ...row.properties,
        name: row.name,
        distance_meters: Math.round(row.distance_meters),
        distance_km: parseFloat((row.distance_meters / 1000).toFixed(2)),
        bearing_degrees: row.bearing_degrees ? Math.round(row.bearing_degrees) : null,
        category: table === 'assembly_areas' ? 'Toplanma Alanı' : 'Hastane'
      }
    }));
    
    return features;
    
  } catch (error) {
    console.error(`❌ Spatial sorgu hatası (${table}):`, error);
    throw error;
  }
}

/**
 * Koordinat validasyonu yap
 * @param {number} longitude - Boylam
 * @param {number} latitude - Enlem
 * @returns {boolean} Geçerli koordinat mu?
 */
function validateCoordinates(longitude, latitude) {
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    return false;
  }
  
  if (isNaN(longitude) || isNaN(latitude)) {
    return false;
  }
  
  // Genel koordinat sınırları
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    return false;
  }
  
  return true;
}

/**
 * İstanbul sınırları içinde mi kontrol et
 * @param {number} longitude - Boylam
 * @param {number} latitude - Enlem
 * @returns {boolean} İstanbul sınırları içinde mi?
 */
function isWithinIstanbul(longitude, latitude) {
  const bounds = {
    north: 41.2,
    south: 40.8,
    east: 29.5,
    west: 28.5
  };
  
  return latitude >= bounds.south && latitude <= bounds.north && 
         longitude >= bounds.west && longitude <= bounds.east;
}

/**
 * İki koordinat arası mesafe hesapla (Haversine formülü)
 * @param {number} lat1 - İlk nokta enlemi
 * @param {number} lon1 - İlk nokta boylamı
 * @param {number} lat2 - İkinci nokta enlemi
 * @param {number} lon2 - İkinci nokta boylamı
 * @returns {number} Metre cinsinden mesafe
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Dünya yarıçapı (metre)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Yön açısı hesapla (bearing)
 * @param {number} lat1 - İlk nokta enlemi
 * @param {number} lon1 - İlk nokta boylamı
 * @param {number} lat2 - İkinci nokta enlemi
 * @param {number} lon2 - İkinci nokta boylamı
 * @returns {number} Derece cinsinden yön
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const θ = Math.atan2(y, x);

  return (θ * 180 / Math.PI + 360) % 360; // 0-360 derece arası normalize et
}

/**
 * Veritabanındaki spatial verilerin istatistiklerini al
 * @returns {Object} İstatistik bilgileri
 */
async function getSpatialStats() {
  try {
    const assemblyAreasCount = await pool.query('SELECT COUNT(*) as count FROM assembly_areas');
    const hospitalsCount = await pool.query('SELECT COUNT(*) as count FROM hospitals');
    const sosCallsCount = await pool.query('SELECT COUNT(*) as count FROM sos_calls');
    
    // En son çağrı zamanı
    const lastCallQuery = await pool.query(`
      SELECT created_at, ST_X(location) as lon, ST_Y(location) as lat 
      FROM sos_calls 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    return {
      assembly_areas: parseInt(assemblyAreasCount.rows[0].count),
      hospitals: parseInt(hospitalsCount.rows[0].count),
      sos_calls: parseInt(sosCallsCount.rows[0].count),
      last_call: lastCallQuery.rows[0] || null,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ Spatial stats hatası:', error);
    throw error;
  }
}

module.exports = {
  findNearbyPoints,
  validateCoordinates,
  isWithinIstanbul,
  calculateDistance,
  calculateBearing,
  getSpatialStats
};