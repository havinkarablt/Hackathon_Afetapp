const express = require('express');
const router = express.Router();
const { pool, testConnection } = require('../db/connection');

// Temel health check
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'up',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV || 'development'
  });
});

// Veritabanı health check
router.get('/db', async (req, res) => {
  try {
    // Bağlantı testi
    const startTime = Date.now();
    await testConnection();
    const responseTime = Date.now() - startTime;
    
    // Tablo sayısını kontrol et
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as table_count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    // PostGIS extension kontrolü
    const extensionResult = await pool.query(`
      SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'postgis') as postgis_enabled
    `);
    
    // Aktif bağlantı sayısı
    const connectionsResult = await pool.query(`
      SELECT count(*) as active_connections 
      FROM pg_stat_activity 
      WHERE datname = current_database()
    `);
    
    res.status(200).json({
      db: 'up',
      timestamp: new Date().toISOString(),
      response_time_ms: responseTime,
      tables: parseInt(tablesResult.rows[0].table_count),
      postgis_enabled: extensionResult.rows[0].postgis_enabled,
      active_connections: parseInt(connectionsResult.rows[0].active_connections),
      pool_stats: {
        total_count: pool.totalCount,
        idle_count: pool.idleCount,
        waiting_count: pool.waitingCount
      }
    });
    
  } catch (error) {
    console.error('❌ DB Health check hatası:', error);
    
    res.status(503).json({
      db: 'down',
      timestamp: new Date().toISOString(),
      error: error.message,
      code: error.code
    });
  }
});

// Detaylı sistem bilgisi (admin için)
router.get('/system', async (req, res) => {
  try {
    // Tablo kayıt sayıları
    const tableStats = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes,
        n_live_tup as live_rows
      FROM pg_stat_user_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    
    res.json({
      status: 'up',
      timestamp: new Date().toISOString(),
      system: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu_usage: process.cpuUsage()
      },
      database: {
        table_statistics: tableStats.rows
      }
    });
    
  } catch (error) {
    console.error('❌ System health check hatası:', error);
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;