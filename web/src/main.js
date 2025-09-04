// AfetApp - Ana JavaScript dosyası
import './styles.css';
import { initMap, showUserLocation, showNearbyPoints, clearMarkers } from './map.js';
import { api } from './api.js';

// Global state
let userLocation = null;
let isEmergencyActive = false;
let adminPanelInterval = null;

// DOM elementleri
const elements = {
  loading: document.getElementById('loading'),
  app: document.getElementById('app'),
  emergencyBtn: document.getElementById('emergency-btn'),
  showAssemblyBtn: document.getElementById('show-assembly-btn'),
  showHospitalsBtn: document.getElementById('show-hospitals-btn'),
  resultsSection: document.getElementById('results-section'),
  closeResults: document.getElementById('close-results'),
  resultsContent: document.getElementById('results-content'),
  resultsTitle: document.getElementById('results-title'),
  connectionStatus: document.getElementById('connection-status'),
  adminToggle: document.getElementById('admin-toggle'),
  adminPanel: document.getElementById('admin-panel'),
  closeAdmin: document.getElementById('close-admin'),
  adminContent: document.getElementById('admin-content'),
  notifications: document.getElementById('notifications')
};

/**
 * Uygulama başlatma
 */
async function initApp() {
  try {
    console.log('🚀 AfetApp başlatılıyor...');
    
    // Haritayı başlat
    await initMap();
    
    // Event listener'ları ekle
    setupEventListeners();
    
    // Kullanıcı konumunu al
    await getUserLocation();
    
    // Bağlantı durumunu kontrol et
    await checkConnection();
    
    // Loading ekranını gizle
    hideLoading();
    
    console.log('✅ AfetApp başarıyla başlatıldı');
    
  } catch (error) {
    console.error('❌ Uygulama başlatma hatası:', error);
    showNotification('Uygulama başlatılamadı: ' + error.message, 'error');
    hideLoading();
  }
}

/**
 * Event listener'ları ayarla
 */
function setupEventListeners() {
  // Acil durum butonu
  elements.emergencyBtn.addEventListener('click', handleEmergencyClick);
  
  // Toplanma alanları butonu
  elements.showAssemblyBtn.addEventListener('click', () => showNearby('assembly-areas'));
  
  // Hastaneler butonu
  elements.showHospitalsBtn.addEventListener('click', () => showNearby('hospitals'));
  
  // Sonuçları kapat
  elements.closeResults.addEventListener('click', hideResults);
  
  // Admin panel toggle
  elements.adminToggle.addEventListener('click', toggleAdminPanel);
  elements.closeAdmin.addEventListener('click', hideAdminPanel);
  
  // Klavye navigation
  document.addEventListener('keydown', handleKeyDown);
  
  // Online/offline durumu
  window.addEventListener('online', () => updateConnectionStatus(true));
  window.addEventListener('offline', () => updateConnectionStatus(false));
  
  // Sayfa yeniden odaklanması
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

/**
 * Kullanıcı konumunu al
 */
async function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Bu tarayıcı konum servislerini desteklemiyor'));
      return;
    }
    
    showNotification('Konum bilginiz alınıyor...', 'info', 3000);
    
    const options = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 60000 // 1 dakika cache
    };
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        userLocation = {
          lat: position.coords.latitude,
          lon: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        
        console.log('📍 Kullanıcı konumu alındı:', userLocation);
        
        // Konumu haritada göster
        showUserLocation(userLocation.lat, userLocation.lon);
        
        showNotification('Konumunuz belirlendi', 'success', 2000);
        resolve(userLocation);
      },
      (error) => {
        console.error('❌ Konum alma hatası:', error);
        
        let message = 'Konum alınamadı';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Konum izni reddedildi. Lütfen tarayıcı ayarlarından konum iznini aktifleştirin.';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Konum bilgisi mevcut değil';
            break;
          case error.TIMEOUT:
            message = 'Konum alma işlemi zaman aşımına uğradı';
            break;
        }
        
        showNotification(message, 'warning', 5000);
        
        // İstanbul merkezi varsayılan konum olarak ayarla
        userLocation = { lat: 41.0082, lon: 28.9784 };
        showUserLocation(userLocation.lat, userLocation.lon);
        
        resolve(userLocation);
      },
      options
    );
  });
}

/**
 * Acil durum butonu tıklama handler
 */
async function handleEmergencyClick() {
  if (isEmergencyActive) {
    showNotification('Acil durum zaten kaydedildi', 'warning');
    return;
  }
  
  try {
    isEmergencyActive = true;
    elements.emergencyBtn.disabled = true;
    elements.emergencyBtn.classList.add('sending');
    
    // Buton metnini güncelle
    const textElement = elements.emergencyBtn.querySelector('.text');
    const originalText = textElement.textContent;
    textElement.textContent = 'GÖNDERİLİYOR...';
    
    // Mevcut konumu al (güncel)
    if (!userLocation) {
      await getUserLocation();
    }
    
    // API çağrısı
    const response = await api.sendEmergencyCall(userLocation.lon, userLocation.lat, {
      timestamp: new Date().toISOString(),
      accuracy: userLocation.accuracy,
      user_agent: navigator.userAgent
    });
    
    console.log('🆘 Acil durum kaydı gönderildi:', response);
    
    showNotification('Acil durum kaydınız alındı! Yardım yolda...', 'success', 5000);
    
    // Otomatik olarak yakın konumları göster
    setTimeout(() => {
      showNearby('assembly-areas');
    }, 2000);
    
    // Buton durumunu sıfırla
    setTimeout(() => {
      isEmergencyActive = false;
      elements.emergencyBtn.disabled = false;
      elements.emergencyBtn.classList.remove('sending');
      textElement.textContent = originalText;
    }, 30000); // 30 saniye sonra tekrar kullanılabilir
    
  } catch (error) {
    console.error('❌ Acil durum gönderme hatası:', error);
    
    isEmergencyActive = false;
    elements.emergencyBtn.disabled = false;
    elements.emergencyBtn.classList.remove('sending');
    
    const textElement = elements.emergencyBtn.querySelector('.text');
    textElement.textContent = 'ACİL DURUM';
    
    showNotification('Acil durum kaydı gönderilemedi: ' + error.message, 'error');
  }
}

/**
 * Yakın konumları göster
 */
async function showNearby(type) {
  if (!userLocation) {
    showNotification('Önce konum bilginiz alınmalı', 'warning');
    await getUserLocation();
    return;
  }
  
  try {
    // Loading göster
    showNotification('Yakın konumlar aranıyor...', 'info', 2000);
    
    // API çağrısı
    const data = await api.getNearbyPoints(type, userLocation.lon, userLocation.lat, 5);
    
    if (!data.features || data.features.length === 0) {
      showNotification('Yakın konumda hiç ' + (type === 'assembly-areas' ? 'toplanma alanı' : 'hastane') + ' bulunamadı', 'warning');
      return;
    }
    
    console.log(`📍 ${data.features.length} ${type} bulundu`);
    
    // Haritada göster
    showNearbyPoints(data.features, type);
    
    // Liste halinde göster
    displayResults(data, type);
    
    showNotification(`${data.features.length} konum bulundu`, 'success', 2000);
    
  } catch (error) {
    console.error('❌ Yakın konum arama hatası:', error);
    showNotification('Yakın konumlar alınamadı: ' + error.message, 'error');
  }
}

/**
 * Sonuçları listede göster
 */
function displayResults(data, type) {
  const title = type === 'assembly-areas' ? 'En Yakın Toplanma Alanları' : 'En Yakın Hastaneler';
  elements.resultsTitle.textContent = title;
  
  elements.resultsContent.innerHTML = '';
  
  data.features.forEach((feature, index) => {
    const props = feature.properties;
    const resultItem = document.createElement('div');
    resultItem.className = 'result-item';
    resultItem.setAttribute('data-index', index);
    
    resultItem.innerHTML = `
      <div class="result-header">
        <h3 class="result-name">${props.name || 'İsimsiz'}</h3>
        <span class="result-distance">${props.distance_km} km</span>
      </div>
      <div class="result-details">
        <div class="result-category">${props.category}</div>
        ${props.district ? `<div class="result-district">📍 ${props.district}</div>` : ''}
        ${props.capacity ? `<div class="result-capacity">👥 Kapasite: ${props.capacity}</div>` : ''}
        ${props.bed_count ? `<div class="result-beds">🛏️ Yatak: ${props.bed_count}</div>` : ''}
        <div class="result-bearing">🧭 ${getBearingText(props.bearing_degrees)}</div>
      </div>
      <button class="result-action" onclick="focusOnMap(${index})">
        Haritada Göster
      </button>
    `;
    
    elements.resultsContent.appendChild(resultItem);
  });
  
  // Sonuç panelini göster
  elements.resultsSection.classList.add('visible');
  
  // Accessibility için focus
  elements.resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/**
 * Yön açısını metin haline çevir
 */
function getBearingText(degrees) {
  if (degrees === null || degrees === undefined) return 'Bilinmiyor';
  
  const directions = [
    'Kuzey', 'Kuzeydoğu', 'Doğu', 'Güneydoğu',
    'Güney', 'Güneybatı', 'Batı', 'Kuzeybatı'
  ];
  
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
}

/**
 * Sonuçları gizle
 */
function hideResults() {
  elements.resultsSection.classList.remove('visible');
  clearMarkers('nearby');
}

/**
 * Bağlantı durumunu kontrol et
 */
async function checkConnection() {
  try {
    const health = await api.getHealth();
    updateConnectionStatus(true, 'API Bağlantısı OK');
    console.log('✅ Backend bağlantısı aktif:', health);
  } catch (error) {
    updateConnectionStatus(false, 'API Bağlantısı Yok');
    console.warn('⚠️ Backend bağlantı sorunu:', error.message);
  }
}

/**
 * Bağlantı durumu güncelle
 */
function updateConnectionStatus(isOnline, message = '') {
  const indicator = elements.connectionStatus;
  
  if (isOnline) {
    indicator.className = 'status-indicator online';
    indicator.textContent = '🟢 Çevrimiçi' + (message ? ` (${message})` : '');
  } else {
    indicator.className = 'status-indicator offline';
    indicator.textContent = '🔴 Çevrimdışı' + (message ? ` (${message})` : '');
  }
}

/**
 * Bildirim göster
 */
function showNotification(message, type = 'info', duration = 4000) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.setAttribute('role', 'alert');
  
  const icon = {
    'info': 'ℹ️',
    'success': '✅',
    'warning': '⚠️',
    'error': '❌'
  }[type] || 'ℹ️';
  
  notification.innerHTML = `
    <span class="notification-icon">${icon}</span>
    <span class="notification-message">${message}</span>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;
  
  elements.notifications.appendChild(notification);
  
  // Otomatik kaldır
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentElement) {
        notification.remove();
      }
    }, duration);
  }
  
  // Accessibility için odakla
  notification.focus();
}

/**
 * Admin panel toggle
 */
function toggleAdminPanel() {
  if (elements.adminPanel.classList.contains('visible')) {
    hideAdminPanel();
  } else {
    showAdminPanel();
  }
}

/**
 * Admin paneli göster
 */
async function showAdminPanel() {
  elements.adminPanel.classList.add('visible');
  
  try {
    await loadAdminData();
    
    // 10 saniyede bir güncelle
    adminPanelInterval = setInterval(loadAdminData, 10000);
    
  } catch (error) {
    console.error('❌ Admin data yükleme hatası:', error);
    elements.adminContent.innerHTML = '<p>Admin verileri yüklenemedi: ' + error.message + '</p>';
  }
}

/**
 * Admin paneli gizle
 */
function hideAdminPanel() {
  elements.adminPanel.classList.remove('visible');
  
  if (adminPanelInterval) {
    clearInterval(adminPanelInterval);
    adminPanelInterval = null;
  }
}

/**
 * Admin verilerini yükle
 */
async function loadAdminData() {
  try {
    // Son SOS çağrıları
    const calls = await api.getEmergencyCalls();
    
    let html = '<div class="admin-stats">';
    html += '<h4>📊 İstatistikler</h4>';
    html += `<p>Toplam Çağrı: ${calls.pagination.total}</p>`;
    html += `<p>Son 24 Saat: ${calls.calls.filter(c => c.seconds_ago < 86400).length}</p>`;
    html += '</div>';
    
    html += '<div class="admin-calls">';
    html += '<h4>🆘 Son Çağrılar</h4>';
    
    if (calls.calls.length === 0) {
      html += '<p>Henüz çağrı yok</p>';
    } else {
      calls.calls.slice(0, 5).forEach(call => {
        const timeAgo = formatTimeAgo(call.seconds_ago);
        html += `
          <div class="admin-call">
            <div class="call-info">
              <strong>#${call.id}</strong> - ${timeAgo}
            </div>
            <div class="call-location">
              📍 ${call.coordinates.lat.toFixed(4)}, ${call.coordinates.lon.toFixed(4)}
            </div>
          </div>
        `;
      });
    }
    
    html += '</div>';
    
    elements.adminContent.innerHTML = html;
    
  } catch (error) {
    console.error('❌ Admin veri yükleme hatası:', error);
    elements.adminContent.innerHTML = '<p class="error">Veriler yüklenemedi</p>';
  }
}

/**
 * Zamanı okunabilir formata çevir
 */
function formatTimeAgo(seconds) {
  if (seconds < 60) return `${Math.floor(seconds)} saniye önce`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika önce`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat önce`;
  return `${Math.floor(seconds / 86400)} gün önce`;
}

/**
 * Klavye navigation
 */
function handleKeyDown(event) {
  // ESC tuşu ile panelleri kapat
  if (event.key === 'Escape') {
    hideResults();
    hideAdminPanel();
  }
  
  // Space tuşu ile acil durum (sadece odakta ise)
  if (event.key === ' ' && event.target === elements.emergencyBtn) {
    event.preventDefault();
    handleEmergencyClick();
  }
}

/**
 * Sayfa görünürlük değişimi
 */
function handleVisibilityChange() {
  if (document.hidden) {
    // Sayfa gizlendi, interval'ları durdur
    if (adminPanelInterval) {
      clearInterval(adminPanelInterval);
    }
  } else {
    // Sayfa tekrar göründü, interval'ları başlat
    if (elements.adminPanel.classList.contains('visible')) {
      adminPanelInterval = setInterval(loadAdminData, 10000);
    }
    
    // Bağlantıyı tekrar kontrol et
    checkConnection();
  }
}

/**
 * Loading ekranını gizle
 */
function hideLoading() {
  elements.loading.style.display = 'none';
  elements.app.classList.add('loaded');
}

/**
 * Haritada odakla (global fonksiyon)
 */
window.focusOnMap = function(index) {
  // map.js'den fonksiyon çağır
  console.log('Haritada odaklama:', index);
  // Bu fonksiyon map.js'de implement edilmeli
};

// Uygulama yüklendiğinde başlat
document.addEventListener('DOMContentLoaded', initApp);

// Global error handler
window.addEventListener('error', (event) => {
  console.error('❌ Global hata:', event.error);
  showNotification('Beklenmeyen bir hata oluştu', 'error');
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
  console.error('❌ İşlenmemiş promise hatası:', event.reason);
  showNotification('Bir işlem başarısız oldu', 'error');
});

console.log('🎯 AfetApp main.js yüklendi');