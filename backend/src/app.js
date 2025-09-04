const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');

// Route imports
const indexRoutes = require('./routes/index');
const healthRoutes = require('./routes/health');
const emergencyRoutes = require('./routes/emergency');
const nearRoutes = require('./routes/near');

const app = express();

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Leaflet için gerekli
  contentSecurityPolicy: false // Development için basitleştirildi
}));
app.use(compression());
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost', 'http://localhost:80'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware (basit)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/', indexRoutes);
app.use('/api/health', healthRoutes);
app.use('/health', healthRoutes); // nginx health check için
app.use('/api/emergency', emergencyRoutes);
app.use('/api/near', nearRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint bulunamadı',
    path: req.originalUrl,
    method: req.method
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('❌ Sunucu hatası:', error);
  
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'İç sunucu hatası' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
});

module.exports = app;