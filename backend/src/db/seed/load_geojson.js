const fs = require('fs');
const path = require('path');
const { pool } = require('../connection');

/**
 * GeoJSON dosyasını veritabanına yükle
 * @param {string} filePath - GeoJSON dosya yolu
 * @param {string} tableName - Hedef tablo adı
 * @returns {Promise<number>} Yüklenen kayıt sayısı
 */
async function loadGeoJSONFile(filePath, tableName) {
  try {
    console.log(`📂 ${filePath} dosyası okunuyor...`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Dosya bulunamadı: ${filePath}`);
    }
    
    const rawData = fs.readFileSync(filePath, 'utf8');
    const geoData = JSON.parse(rawData);
    
    if (!geoData.type || geoData.type !== 'FeatureCollection') {
      throw new Error('Geçersiz GeoJSON formatı - FeatureCollection bekleniyor');
    }
    
    if (!geoData.features || !Array.isArray(geoData.features)) {
      throw new Error('GeoJSON features dizisi bulunamadı');
    }
    
    console.log(`📊 ${geoData.features.length} feature bulundu`);
    
    let insertedCount = 0;
    let skippedCount = 0;
    
    // Her feature için insert işlemi
    for (const feature of geoData.features) {
      try {
        await insertFeature(feature, tableName);
        insertedCount++;
        
        if (insertedCount % 10 === 0) {
          console.log(`✅ ${insertedCount} kayıt işlendi...`);
        }
        
      } catch (error) {
        skippedCount++;
        console.warn(`⚠️ Feature atlandı:`, error.message);
      }
    }
    
    console.log(`🎉 ${tableName} tablosuna ${insertedCount} kayıt yüklendi (${skippedCount} atlandı)`);
    return insertedCount;
    
  } catch (error) {
    console.error(`❌ GeoJSON yükleme hatası (${tableName}):`, error);
    throw error;
  }
}

/**
 * Tek bir feature'ı veritabanına ekle
 * @param {Object} feature - GeoJSON Feature
 * @param {string} tableName - Hedef tablo
 */
async function insertFeature(feature, tableName) {
  if (!feature.geometry || !feature.geometry.coordinates) {
    throw new Error('Feature geometry bulunamadı');
  }
  
  if (feature.geometry.type !== 'Point') {
    throw new Error(`Desteklenmeyen geometry tipi: ${feature.geometry.type}`);
  }
  
  const [longitude, latitude] = feature.geometry.coordinates;
  
  // Koordinat validasyonu
  if (typeof longitude !== 'number' || typeof latitude !== 'number') {
    throw new Error('Geçersiz koordinat değerleri');
  }
  
  // İstanbul sınırları kontrolü (gevşek)
  if (longitude < 28.0 || longitude > 30.0 || latitude < 40.5 || latitude > 41.5) {
    throw new Error(`İstanbul sınırları dışında: ${latitude}, ${longitude}`);
  }
  
  const properties = feature.properties || {};
  const name = properties.name || properties.NAME || properties.ad || 'İsimsiz';
  
  if (tableName === 'assembly_areas') {
    await insertAssemblyArea(longitude, latitude, name, properties);
  } else if (tableName === 'hospitals') {
    await insertHospital(longitude, latitude, name, properties);
  } else {
    throw new Error(`Desteklenmeyen tablo: ${tableName}`);
  }
}

/**
 * Toplanma alanı ekle
 */
async function insertAssemblyArea(longitude, latitude, name, properties) {
  const query = `
    INSERT INTO assembly_areas (name, location, properties, capacity, district, address)
    VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, $6, $7)
    ON CONFLICT DO NOTHING
  `;
  
  const params = [
    name,
    longitude,
    latitude,
    JSON.stringify(properties),
    properties.capacity || properties.CAPACITY || null,
    properties.district || properties.DISTRICT || properties.ilce || null,
    properties.address || properties.ADDRESS || properties.adres || null
  ];
  
  await pool.query(query, params);
}

/**
 * Hastane ekle
 */
async function insertHospital(longitude, latitude, name, properties) {
  const query = `
    INSERT INTO hospitals (name, location, properties, hospital_type, bed_count, phone, district, address)
    VALUES ($1, ST_SetSRID(ST_Point($2, $3), 4326), $4, $5, $6, $7, $8, $9)
    ON CONFLICT DO NOTHING
  `;
  
  const params = [
    name,
    longitude,
    latitude,
    JSON.stringify(properties),
    properties.type || properties.TYPE || properties.turu || 'devlet',
    properties.bed_count || properties.BEDS || properties.yatak_sayisi || null,
    properties.phone || properties.PHONE || properties.telefon || null,
    properties.district || properties.DISTRICT || properties.ilce || null,
    properties.address || properties.ADDRESS || properties.adres || null
  ];
  
  await pool.query(query, params);
}

/**
 * Ana seed fonksiyonu
 */
async function seedDatabase() {
  try {
    console.log('🌱 AfetApp veritabanı seed işlemi başlıyor...');
    
    const dataDir = path.resolve(__dirname, '../../../data');
    console.log(`📁 Data dizini: ${dataDir}`);
    
    let totalInserted = 0;
    
    // Toplanma alanlarını yükle
    const assemblyAreasFile = path.join(dataDir, 'istanbul_toplanma_alanlari.geojson');
    if (fs.existsSync(assemblyAreasFile)) {
      const count = await loadGeoJSONFile(assemblyAreasFile, 'assembly_areas');
      totalInserted += count;
    } else {
      console.warn(`⚠️ Toplanma alanları dosyası bulunamadı: ${assemblyAreasFile}`);
      console.log('🔧 Test verisi ekleniyor...');
      await addTestAssemblyAreas();
    }
    
    // Hastaneleri yükle
    const hospitalsFile = path.join(dataDir, 'istanbul_hastaneler.geojson');
    if (fs.existsSync(hospitalsFile)) {
      const count = await loadGeoJSONFile(hospitalsFile, 'hospitals');
      totalInserted += count;
    } else {
      console.warn(`⚠️ Hastaneler dosyası bulunamadı: ${hospitalsFile}`);
      console.log('🔧 Test verisi ekleniyor...');
      await addTestHospitals();
    }
    
    // İstatistikleri güncelle
    await pool.query('ANALYZE assembly_areas');
    await pool.query('ANALYZE hospitals');
    
    console.log(`🎉 Seed işlemi tamamlandı! Toplam ${totalInserted} kayıt yüklendi.`);
    
    // Özet bilgileri
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM assembly_areas) as assembly_areas_count,
        (SELECT COUNT(*) FROM hospitals) as hospitals_count
    `);
    
    const { assembly_areas_count, hospitals_count } = stats.rows[0];
    console.log(`📊 Veritabanı durumu: ${assembly_areas_count} toplanma alanı, ${hospitals_count} hastane`);
    
  } catch (error) {
    console.error('❌ Seed işlemi hatası:', error);
    throw error;
  }
}

/**
 * Test toplanma alanları ekle
 */
async function addTestAssemblyAreas() {
  const testAreas = [
    {
      name: 'Emirgan Korusu',
      lon: 29.0533, lat: 41.1089,
      district: 'Sarıyer',
      capacity: 2000
    },
    {
      name: 'Maçka Parkı',
      lon: 28.9947, lat: 41.0438,
      district: 'Şişli',
      capacity: 1500
    },
    {
      name: 'Yıldız Parkı',
      lon: 28.9897, lat: 41.0486,
      district: 'Beşiktaş',
      capacity: 3000
    },
    {
      name: 'Fenerbahçe Parkı',
      lon: 29.0392, lat: 40.9636,
      district: 'Kadıköy',
      capacity: 1000
    },
    {
      name: 'Beyazıt Meydanı',
      lon: 28.9637, lat: 41.0106,
      district: 'Fatih',
      capacity: 2500
    }
  ];
  
  for (const area of testAreas) {
    await insertAssemblyArea(area.lon, area.lat, area.name, {
      district: area.district,
      capacity: area.capacity,
      source: 'test_data'
    });
  }
  
  console.log(`✅ ${testAreas.length} test toplanma alanı eklendi`);
}

/**
 * Test hastaneleri ekle
 */
async function addTestHospitals() {
  const testHospitals = [
    {
      name: 'İstanbul Üniversitesi İstanbul Tıp Fakültesi',
      lon: 28.9494, lat: 41.0188,
      district: 'Fatih',
      type: 'üniversite',
      beds: 1200
    },
    {
      name: 'Acıbadem Maslak Hastanesi',
      lon: 29.0175, lat: 41.1069,
      district: 'Sarıyer',
      type: 'özel',
      beds: 230
    },
    {
      name: 'Şişli Hamidiye Etfal Eğitim ve Araştırma Hastanesi',
      lon: 28.9802, lat: 41.0608,
      district: 'Şişli',
      type: 'devlet',
      beds: 400
    },
    {
      name: 'Kartal Dr. Lütfi Kırdar Şehir Hastanesi',
      lon: 29.1836, lat: 40.9067,
      district: 'Kartal',
      type: 'devlet',
      beds: 1545
    },
    {
      name: 'Memorial Bahçelievler Hastanesi',
      lon: 28.8589, lat: 41.0031,
      district: 'Bahçelievler',
      type: 'özel',
      beds: 170
    }
  ];
  
  for (const hospital of testHospitals) {
    await insertHospital(hospital.lon, hospital.lat, hospital.name, {
      district: hospital.district,
      hospital_type: hospital.type,
      bed_count: hospital.beds,
      emergency_service: true,
      source: 'test_data'
    });
  }
  
  console.log(`✅ ${testHospitals.length} test hastanesi eklendi`);
}

// Script olarak çalıştırılırsa seed işlemini başlat
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🏁 Seed script tamamlandı');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seed script hatası:', error);
      process.exit(1);
    });
}

module.exports = {
  seedDatabase,
  loadGeoJSONFile
};