-- AfetApp PostgreSQL + PostGIS Schema
-- İstanbul Acil Durum Yönetim Sistemi

-- PostGIS extension'ını etkinleştir
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Koordinat sistemi bilgisi (WGS84 - EPSG:4326)
-- İstanbul için tipik koordinatlar: 28.5-29.5 boylam, 40.8-41.2 enlem

-- 1. SOS Çağrıları Tablosu
CREATE TABLE IF NOT EXISTS sos_calls (
    id SERIAL PRIMARY KEY,
    location GEOMETRY(Point, 4326) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Toplanma Alanları Tablosu  
CREATE TABLE IF NOT EXISTS assembly_areas (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    properties JSONB DEFAULT '{}',
    capacity INTEGER,
    area_m2 FLOAT,
    district VARCHAR(100),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Hastaneler Tablosu
CREATE TABLE IF NOT EXISTS hospitals (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location GEOMETRY(Point, 4326) NOT NULL,
    properties JSONB DEFAULT '{}',
    hospital_type VARCHAR(50), -- 'devlet', 'özel', 'üniversite'
    bed_count INTEGER,
    emergency_service BOOLEAN DEFAULT true,
    phone VARCHAR(20),
    district VARCHAR(100),
    address TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. İstanbul İlçeleri (opsiyonel - istatistik için)
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    geometry GEOMETRY(MultiPolygon, 4326),
    population INTEGER,
    area_km2 FLOAT,
    properties JSONB DEFAULT '{}'
);

-- SPATIAL INDEXler (GiST)
-- Bu indeksler spatial sorguları hızlandırır

-- SOS çağrıları için spatial index
CREATE INDEX IF NOT EXISTS idx_sos_calls_location 
ON sos_calls USING GIST (location);

-- Toplanma alanları için spatial index
CREATE INDEX IF NOT EXISTS idx_assembly_areas_location 
ON assembly_areas USING GIST (location);

-- Hastaneler için spatial index
CREATE INDEX IF NOT EXISTS idx_hospitals_location 
ON hospitals USING GIST (location);

-- İlçeler için spatial index
CREATE INDEX IF NOT EXISTS idx_districts_geometry 
ON districts USING GIST (geometry);

-- NORMAL INDEXler
-- Performans optimizasyonu için

-- Zaman bazlı sorgular için
CREATE INDEX IF NOT EXISTS idx_sos_calls_created_at 
ON sos_calls (created_at DESC);

-- Aktif kayıtlar için
CREATE INDEX IF NOT EXISTS idx_assembly_areas_active 
ON assembly_areas (is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_hospitals_active 
ON hospitals (is_active) WHERE is_active = true;

-- İlçe bazlı sorgular için
CREATE INDEX IF NOT EXISTS idx_assembly_areas_district 
ON assembly_areas (district);

CREATE INDEX IF NOT EXISTS idx_hospitals_district 
ON hospitals (district);

-- Hastane türü için
CREATE INDEX IF NOT EXISTS idx_hospitals_type 
ON hospitals (hospital_type);

-- JSONB alanlar için GIN index (meta veriler)
CREATE INDEX IF NOT EXISTS idx_sos_calls_metadata 
ON sos_calls USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_assembly_areas_properties 
ON assembly_areas USING GIN (properties);

CREATE INDEX IF NOT EXISTS idx_hospitals_properties 
ON hospitals USING GIN (properties);

-- CONSTRAINT'ler
-- Veri bütünlüğü için

-- İstanbul koordinat sınırları kontrolü (kabaca)
-- Enlem: 40.8 - 41.2, Boylam: 28.5 - 29.5
ALTER TABLE sos_calls ADD CONSTRAINT check_sos_calls_istanbul_bounds
CHECK (
    ST_X(location) BETWEEN 28.0 AND 30.0 AND 
    ST_Y(location) BETWEEN 40.5 AND 41.5
);

ALTER TABLE assembly_areas ADD CONSTRAINT check_assembly_areas_istanbul_bounds
CHECK (
    ST_X(location) BETWEEN 28.0 AND 30.0 AND 
    ST_Y(location) BETWEEN 40.5 AND 41.5
);

ALTER TABLE hospitals ADD CONSTRAINT check_hospitals_istanbul_bounds
CHECK (
    ST_X(location) BETWEEN 28.0 AND 30.0 AND 
    ST_Y(location) BETWEEN 40.5 AND 41.5
);

-- Pozitif değerler için constraint'ler
ALTER TABLE assembly_areas ADD CONSTRAINT check_capacity_positive
CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE assembly_areas ADD CONSTRAINT check_area_positive
CHECK (area_m2 IS NULL OR area_m2 > 0);

ALTER TABLE hospitals ADD CONSTRAINT check_bed_count_positive
CHECK (bed_count IS NULL OR bed_count > 0);

-- TRIGGER'lar
-- Otomatik timestamp güncelleme

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Updated_at trigger'ları
CREATE TRIGGER update_sos_calls_updated_at 
    BEFORE UPDATE ON sos_calls 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assembly_areas_updated_at 
    BEFORE UPDATE ON assembly_areas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospitals_updated_at 
    BEFORE UPDATE ON hospitals 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- VIEWs
-- Sık kullanılan sorgular için

-- Aktif toplanma alanları view
CREATE OR REPLACE VIEW active_assembly_areas AS
SELECT 
    id, name, location, properties, capacity, area_m2, 
    district, address, created_at,
    ST_X(location) as longitude,
    ST_Y(location) as latitude
FROM assembly_areas 
WHERE is_active = true;

-- Aktif hastaneler view  
CREATE OR REPLACE VIEW active_hospitals AS
SELECT 
    id, name, location, properties, hospital_type, bed_count,
    emergency_service, phone, district, address, created_at,
    ST_X(location) as longitude,
    ST_Y(location) as latitude
FROM hospitals 
WHERE is_active = true;

-- Son 24 saat SOS çağrıları view
CREATE OR REPLACE VIEW recent_sos_calls AS
SELECT 
    id, location, metadata, created_at,
    ST_X(location) as longitude,
    ST_Y(location) as latitude,
    EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_ago
FROM sos_calls 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- FUNCTION'lar
-- Sık kullanılan spatial işlemler için

-- En yakın N noktayı bul
CREATE OR REPLACE FUNCTION find_nearest_points(
    target_lon FLOAT,
    target_lat FLOAT, 
    table_name TEXT,
    point_limit INTEGER DEFAULT 5
)
RETURNS TABLE(
    id INTEGER,
    name VARCHAR(255),
    distance_meters FLOAT,
    longitude FLOAT,
    latitude FLOAT
) AS $$
BEGIN
    RETURN QUERY EXECUTE format('
        SELECT 
            t.id,
            t.name,
            ST_Distance(t.location::geography, ST_SetSRID(ST_Point(%s, %s), 4326)::geography) as distance_meters,
            ST_X(t.location) as longitude,
            ST_Y(t.location) as latitude
        FROM %I t
        WHERE t.is_active = true
        ORDER BY t.location <-> ST_SetSRID(ST_Point(%s, %s), 4326)
        LIMIT %s
    ', target_lon, target_lat, table_name, target_lon, target_lat, point_limit);
END;
$$ LANGUAGE plpgsql;

-- İstatistik fonksiyonu
CREATE OR REPLACE FUNCTION get_emergency_stats()
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'total_assembly_areas', (SELECT COUNT(*) FROM assembly_areas WHERE is_active = true),
        'total_hospitals', (SELECT COUNT(*) FROM hospitals WHERE is_active = true),
        'total_sos_calls', (SELECT COUNT(*) FROM sos_calls),
        'calls_last_24h', (SELECT COUNT(*) FROM sos_calls WHERE created_at > NOW() - INTERVAL '24 hours'),
        'calls_last_hour', (SELECT COUNT(*) FROM sos_calls WHERE created_at > NOW() - INTERVAL '1 hour'),
        'timestamp', NOW()
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql;

-- SAMPLE DATA (Minimal test data)
-- Gerçek veriler GeoJSON dosyalarından yüklenecek

-- Test toplanma alanı (Taksim Meydanı)
INSERT INTO assembly_areas (name, location, properties, capacity, district) 
VALUES (
    'Taksim Meydanı Test Alanı',
    ST_SetSRID(ST_Point(28.9866, 41.0369), 4326),
    '{"type": "meydan", "facilities": ["wc", "su"], "emergency_level": "A"}',
    5000,
    'Beyoğlu'
) ON CONFLICT DO NOTHING;

-- Test hastanesi (Okmeydanı Hastanesi)
INSERT INTO hospitals (name, location, properties, hospital_type, bed_count, district) 
VALUES (
    'Okmeydanı Eğitim ve Araştırma Hastanesi',
    ST_SetSRID(ST_Point(28.9515, 41.0603), 4326),
    '{"services": ["acil", "ameliyathane", "yogun_bakim"], "24_saat": true}',
    'devlet',
    800,
    'Beyoğlu'
) ON CONFLICT DO NOTHING;

-- Performans analizi için ANALYZE
ANALYZE sos_calls;
ANALYZE assembly_areas;
ANALYZE hospitals;

-- Schema versiyonu (migration tracking için)
CREATE TABLE IF NOT EXISTS schema_version (
    version VARCHAR(20) PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    description TEXT
);

INSERT INTO schema_version (version, description) 
VALUES ('1.0.0', 'Initial AfetApp schema with PostGIS support') 
ON CONFLICT (version) DO NOTHING;

-- Son yapılandırma mesajı
SELECT 'AfetApp Database Schema başarıyla oluşturuldu! 🎉' as status;