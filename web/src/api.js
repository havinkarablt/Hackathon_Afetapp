// AfetApp - API İletişim Modülü

// API base URL - production ve development ortamları için
const API_BASE_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api'
  : '/api';

/**
 * HTTP request helper fonksiyonu
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: 10000 // 10 saniye timeout
  };
  
  const requestOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };
  
  try {
    console.log(`🌐 API isteği: ${requestOptions.method || 'GET'} ${url}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);
    
    const response = await fetch(url, {
      ...requestOptions,
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new APIError(
        errorData.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData
      );
    }
    
    const data = await response.json();
    console.log(`✅ API yanıtı alındı: ${endpoint}`);
    
    return data;
    
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error('⏰ API isteği zaman aşımına uğradı:', url);
      throw new APIError('İstek zaman aşımına uğradı', 408);
    }
    
    if (error instanceof APIError) {
      throw error;
    }
    
    console.error('❌ API isteği hatası:', error);
    
    if (!navigator.onLine) {
      throw new APIError('İnternet bağlantısı yok', 0);
    }
    
    throw new APIError('Sunucuya ulaşılamadı', 0, error);
  }
}

/**
 * Özel API Error sınıfı
 */
class APIError extends Error {
  constructor(message, status = 0, data = null) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

/**
 * API fonksiyonları
 */
export const api = {
  
  /**
   * Health check - sunucu durumu kontrol
   */
  async getHealth() {
    return makeRequest('/health');
  },
  
  /**
   * Veritabanı health check
   */
  async getDBHealth() {
    return makeRequest('/health/db');
  },
  
  /**
   * Acil durum çağrısı gönder
   */
  async sendEmergencyCall(lon, lat, metadata = {}) {
    return makeRequest('/emergency', {
      method: 'POST',
      body: JSON.stringify({
        lon: parseFloat(lon),
        lat: parseFloat(lat),
        meta: {
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          screen: {
            width: screen.width,
            height: screen.height
          },
          ...metadata
        }
      })
    });
  },
  
  /**
   * Yakın toplanma alanlarını getir
   */
  async getNearbyAssemblyAreas(lon, lat, limit = 5) {
    const params = new URLSearchParams({
      lon: lon.toString(),
      lat: lat.toString(),
      limit: limit.toString()
    });
    
    return makeRequest(`/near/assembly-areas?${params}`);
  },
  
  /**
   * Yakın hastaneleri getir
   */
  async getNearbyHospitals(lon, lat, limit = 5) {
    const params = new URLSearchParams({
      lon: lon.toString(),
      lat: lat.toString(),
      limit: limit.toString()
    });
    
    return makeRequest(`/near/hospitals?${params}`);
  },
  
  /**
   * Yakın noktaları getir (genel)
   */
  async getNearbyPoints(type, lon, lat, limit = 5) {
    if (type === 'assembly-areas') {
      return this.getNearbyAssemblyAreas(lon, lat, limit);
    } else if (type === 'hospitals') {
      return this.getNearbyHospitals(lon, lat, limit);
    } else {
      throw new APIError(`Desteklenmeyen tip: ${type}`);
    }
  },
  
  /**
   * Tüm yakın konumları getir (hem toplanma alanları hem hastaneler)
   */
  async getAllNearbyPoints(lon, lat, limit = 3) {
    const params = new URLSearchParams({
      lon: lon.toString(),
      lat: lat.toString(),
      limit: limit.toString()
    });
    
    return makeRequest(`/near/all?${params}`);
  },
  
  /**
   * Belirli mesafe içindeki noktaları getir
   */
  async getPointsWithinDistance(type, lon, lat, distance = 1000) {
    const params = new URLSearchParams({
      type: type,
      lon: lon.toString(),
      lat: lat.toString()
    });
    
    return makeRequest(`/near/within/${distance}?${params}`);
  },
  
  /**
   * Acil durum çağrıları listesi (admin için)
   */
  async getEmergencyCalls(limit = 20, offset = 0) {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });
    
    return makeRequest(`/emergency?${params}`);
  },
  
  /**
   * Belirli bir acil durum çağrısının detayları
   */
  async getEmergencyCall(id) {
    return makeRequest(`/emergency/${id}`);
  },
  
  /**
   * Sistem istatistikleri (admin için)
   */
  async getSystemStats() {
    return makeRequest('/health/system');
  }
};

/**
 * API durumu kontrol fonksiyonları
 */
export const apiStatus = {
  
  /**
   * API erişilebilirliğini kontrol et
   */
  async checkAvailability() {
    try {
      await api.getHealth();
      return { available: true, message: 'API erişilebilir' };
    } catch (error) {
      return { 
        available: false, 
        message: error.message,
        status: error.status 
      };
    }
  },
  
  /**
   * Veritabanı durumunu kontrol et
   */
  async checkDatabase() {
    try {
      const result = await api.getDBHealth();
      return { 
        healthy: result.db === 'up', 
        details: result 
      };
    } catch (error) {
      return { 
        healthy: false, 
        error: error.message,
        status: error.status 
      };
    }
  },
  
  /**
   * Tam sistem kontrolü
   */
  async fullCheck() {
    const [apiCheck, dbCheck] = await Promise.allSettled([
      this.checkAvailability(),
      this.checkDatabase()
    ]);
    
    return {
      api: apiCheck.status === 'fulfilled' ? apiCheck.value : { available: false, error: apiCheck.reason.message },
      database: dbCheck.status === 'fulfilled' ? dbCheck.value : { healthy: false, error: dbCheck.reason.message },
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Koordinat validasyon helper'ı
 */
export function validateCoordinates(lon, lat) {
  const longitude = parseFloat(lon);
  const latitude = parseFloat(lat);
  
  if (isNaN(longitude) || isNaN(latitude)) {
    throw new Error('Geçersiz koordinat formatı');
  }
  
  if (longitude < -180 || longitude > 180) {
    throw new Error('Geçersiz boylam değeri (-180 ile 180 arası olmalı)');
  }
  
  if (latitude < -90 || latitude > 90) {
    throw new Error('Geçersiz enlem değeri (-90 ile 90 arası olmalı)');
  }
  
  // İstanbul sınırları kontrolü
  if (latitude < 40.5 || latitude > 41.5 || longitude < 28.0 || longitude > 30.0) {
    throw new Error('Konum İstanbul sınırları dışında');
  }
  
  return { lon: longitude, lat: latitude };
}

/**
 * Network durumunu takip et
 */
export function setupNetworkMonitoring(callback) {
  let isOnline = navigator.onLine;
  
  function updateStatus(online) {
    if (online !== isOnline) {
      isOnline = online;
      callback(online);
    }
  }
  
  window.addEventListener('online', () => updateStatus(true));
  window.addEventListener('offline', () => updateStatus(false));
  
  // İlk durum kontrolü
  callback(isOnline);
  
  return () => {
    window.removeEventListener('online', () => updateStatus(true));
    window.removeEventListener('offline', () => updateStatus(false));
  };
}

/**
 * Retry mechanism ile API çağrısı
 */
export async function apiWithRetry(apiFunction, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiFunction();
    } catch (error) {
      lastError = error;
      console.warn(`❌ API çağrısı başarısız (${attempt}/${maxRetries}):`, error.message);
      
      // Son deneme değilse bekle
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
}

/**
 * Batch API çağrıları
 */
export async function apiBatch(requests) {
  const results = await Promise.allSettled(requests);
  
  return results.map((result, index) => ({
    index,
    success: result.status === 'fulfilled',
    data: result.status === 'fulfilled' ? result.value : null,
    error: result.status === 'rejected' ? result.reason : null
  }));
}

// Export API Error sınıfı
export { APIError };

// Development modunda debug bilgileri
if (window.__DEV__) {
  window.afetAppAPI = {
    api,
    apiStatus,
    validateCoordinates,
    APIError
  };
  console.log('🛠️ AfetApp API debug modülü aktif - window.afetAppAPI kullanılabilir');
}

console.log('🌐 AfetApp API modülü yüklendi');