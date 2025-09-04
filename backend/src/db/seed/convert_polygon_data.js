const fs = require('fs');
const path = require('path');
const { pool } = require('../connection');

/**
 * Polygon verilerini Point'e çevir ve veritabanına yükle
 */
async function convertAndLoadPolygonData() {
  try {
    console.log('🔄 Polygon verilerini Point verilerine dönüştürüyor...');
    
    const dataDir = path.resolve(__dirname, '../../../data');
    
    // Dosyaları oku
    const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.geojson') || f.endsWith('.json'));
    console.log('📁 Bulunan dosyalar:', files);
    
    for (const fileName of files) {
      const filePath = path.join(dataDir, fileName);
      console.log(`\n📂 ${fileName} işleniyor...`);
      
      const rawData = fs.readFileSync(filePath, 'utf8');
      const geoData = JSON.parse(rawData);
      
      if (!geoData.features || !Array.isArray(geoData.features)) {
        console.log('❌ GeoJSON features bulunamadı');
        continue;
      }
      
      console.log(`📊 ${geoData.features.length} feature bulundu`);
      
      let processedCount = 0;
      let insertedCount = 0;
      
      for (const feature of geoData.features) {
        try {
          // Polygon'un merkez noktasını hesapla
          const centerPoint = calculatePolygonCenter(feature.geometry);
          
          if (!centerPoint) {
            console.log(`⚠️ Merkez nokta hesaplanamadı: ${feature.properties.ad || 'İsimsiz'}`);
            continue;
          }
          
          // İstanbul sınırları kontrolü (gevşek)
          if (!isInIstanbulRegion(centerPoint[1], centerPoint[0])) {
            console.log(`📍 İstanbul bölgesi dışında: ${feature.properties.ad} (${centerPoint[1]}, ${centerPoint[0]})`);
            continue;
          }
          
          // Veritabanına ekle
          await insertFeature(centerPoint, feature.properties, fileName);
          insertedCount++;
          processedCount++;
          
          if (processedCount % 10 === 0) {
            console.log(`✅ ${processedCount} kayıt işlendi...`);
          }
          
        } catch (error) {
          console.warn(`⚠️ Feature atlandı: ${error.message}`);
        }
      }
      
      console.log(`🎉 ${fileName}: ${insertedCount} kayıt başarıyla eklendi`);
    }
    
    // Özet bilgileri
    const stats = await getTableStats();
    console.log('\n📊 Veritabanı durumu:');
    console.log(`- Toplanma alanları: ${stats.assembly_areas}`);
    console.log(`- Hastaneler: ${stats.hospitals}`);
    console.log(`- SOS çağrıları: ${stats.sos_calls}`);
    
  } catch (error) {
    console.error('❌ Dönüştürme hatası:', error);
    throw error;
  }
}

/**
 * Polygon'un merkez noktasını hesapla (basit centroid)
 */
function calculatePolygonCenter(geometry) {
  if (!geometry || geometry.type !== 'Polygon') {
    return null;
  }
  
  const coordinates = geometry.coordinates[0]; // Dış ring
  if (!coordinates || coordinates.length < 3) {
    return null;
  }
  
  let sumLat = 0;
  let sumLon = 0;
  let count = coordinates.length - 1; // Son nokta ilkle aynı
  
  for (let i = 0; i < count; i++) {
    sumLon += coordinates[i][0];
    sumLat += coordinates[i][1];
  }
  
  return [sumLon / count, sumLat / count];
}

/**
 * İstanbul bölgesi kontrolü (geniş sınırlar)
 */
function isInIstanbulRegion(lat, lon) {
  // İstanbul ve çevre illeri kapsayacak geniş sınırlar
  return lat >= 40.5 && lat <= 41.5 && lon >= 27.5 && lon <= 30.5;
}

/**
 * Feature'ı veritabanına ekle
 */
async function insertFeature(centerPoint, properties, fileName) {
  const [longitude, latitude] = centerPoint;
  const name = properties.ad || properties.name || properties.NAME || 'İsimsiz';
  
  // Dosya adına göre tablo belirle
  let tableName = 'assembly_areas'; // varsayılan
  
  if (fileName.toLowerCase().includes('hastane') || 
      fileName.toLowerCase().includes('hospital') ||
      name.toLowerCase().includes('hastane') ||
      name.toLowerCase().includes('hospital')) {
    tableName = 'hospitals';
  }
  
  if (tableName === 'assembly_areas') {
    await insertAssemblyArea(longitude, latitude, name, properties);
  } else {
    await insertHospital(longitude, latitude, name, properties);
  }
}

/**
 * Toplanma alanı ekle
 */
async function insertAssemblyArea(longitude, latitude, name, properties) {
  const query = `
    INSERT INTO assembly_areas (name, location, properties, district, address)
    VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, $6)
    ON CONFLICT DO NOTHING
  `;
  
  const params = [
    name,
    longitude,
    latitude,
    JSON.stringify({
      original_properties: properties,
      source: 'converted_polygon',
      aciklama: properties.aciklama,
      kategori_id: properties.kategori_i
    }),
    properties.neighbourh || null,
    properties.aciklama || null
  ];
  
  await pool.query(query, params);
}

/**
 * Hastane ekle
 */
async function insertHospital(longitude, latitude, name, properties) {
  const query = `
    INSERT INTO hospitals (name, location, properties, hospital_type, district, address)
    VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, $6, $7)
    ON CONFLICT DO NOTHING
  `;
  
  const params = [
    name,
    longitude,
    latitude,
    JSON.stringify({
      original_properties: properties,
      source: 'converted_polygon',
      aciklama: properties.aciklama,
      kategori_id: properties.kategori_i
    }),
    'devlet', // varsayılan tip
    properties.neighbourh || null,
    properties.aciklama || null
  ];
  
  await pool.query(query, params);
}

/**
 * Tablo istatistiklerini al
 */
async function getTableStats() {
  const assemblyResult = await pool.query('SELECT COUNT(*) as count FROM assembly_areas');
  const hospitalsResult = await pool.query('SELECT COUNT(*) as count FROM hospitals');
  const sosResult = await pool.query('SELECT COUNT(*) as count FROM sos_calls');
  
  return {
    assembly_areas: parseInt(assemblyResult.rows[0].count),
    hospitals: parseInt(hospitalsResult.rows[0].count),
    sos_calls: parseInt(sosResult.rows[0].count)
  };
}

// Script olarak çalıştırılırsa
if (require.main === module) {
  convertAndLoadPolygonData()
    .then(() => {
      console.log('🏁 Dönüştürme işlemi tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Dönüştürme hatası:', error);
      process.exit(1);
    });
}

module.exports = { convertAndLoadPolygonData };