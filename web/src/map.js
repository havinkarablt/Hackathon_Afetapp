// AfetApp - Leaflet Harita Modülü (Sınırsız Versiyon)
let map = null;
let userMarker = null;
let nearbyMarkers = [];
let markerGroups = {
  user: null,
  nearby: null
};

// İstanbul koordinatları (sadece varsayılan merkez için)
const DEFAULT_CENTER = [41.0082, 28.9784];

/**
 * Haritayı başlat (sınırsız)
 */
export async function initMap() {
  try {
    console.log('🗺️ Harita başlatılıyor (sınırsız mod)...');
    
    // Harita container'ı kontrol et
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
      throw new Error('Harita container\'ı bulunamadı');
    }
    
    // Leaflet haritasını oluştur (sınırsız)
    map = L.map('map', {
      center: DEFAULT_CENTER,
      zoom: 2, // Dünya geneli görünümü
      minZoom: 1, // Daha fazla uzaklaşabilir
      maxZoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true,
      touchZoom: true,
      boxZoom: false,
      keyboard: true,
      // Sınırlamaları kaldırdık
      worldCopyJump: true // Dünya haritasında gezinme
    });
    
    // Tile layer ekle (OpenStreetMap)
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 18,
      tileSize: 256,
      zoomOffset: 0,
      // Performans optimizasyonu
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 2
    });
    
    tileLayer.addTo(map);
    
    // Alternatif tile layer (yedek)
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });
    
    // Layer control ekle
    const baseMaps = {
      "Sokak Haritası": tileLayer,
      "Uydu Görüntüsü": satelliteLayer
    };
    
    L.control.layers(baseMaps, null, {
      position: 'topright',
      collapsed: true
    }).addTo(map);
    
    // Marker grupları oluştur
    markerGroups.user = L.layerGroup().addTo(map);
    markerGroups.nearby = L.layerGroup().addTo(map);
    
    // Harita event listener'ları
    map.on('zoomend', onMapZoomEnd);
    map.on('moveend', onMapMoveEnd);
    map.on('click', onMapClick);
    
    // Loading indicator'ını gizle
    const mapLoading = document.getElementById('map-loading');
    if (mapLoading) {
      mapLoading.style.display = 'none';
    }
    
    console.log('✅ Harita başarıyla başlatıldı (sınırsız mod)');
    
    // Harita info kontrolü ekle
    addMapControls();
    
    return map;
    
  } catch (error) {
    console.error('❌ Harita başlatma hatası:', error);
    throw error;
  }
}

/**
 * Kullanıcı konumunu haritada göster
 */
export function showUserLocation(lat, lon, accuracy = null) {
  try {
    console.log(`📍 Kullanıcı konumu gösteriliyor: ${lat}, ${lon}`);
    
    // Mevcut kullanıcı marker'ını temizle
    markerGroups.user.clearLayers();
    
    // Kullanıcı marker'ı oluştur
    const userIcon = L.divIcon({
      className: 'user-marker',
      html: '<div class="user-marker-inner">📱</div>',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
    
    userMarker = L.marker([lat, lon], {
      icon: userIcon,
      title: 'Konumunuz'
    });
    
    userMarker.bindPopup(`
      <div class="popup-content user-popup">
        <h3>📱 Konumunuz</h3>
        <p><strong>Koordinat:</strong> ${lat.toFixed(4)}, ${lon.toFixed(4)}</p>
        ${accuracy ? `<p><strong>Doğruluk:</strong> ±${Math.round(accuracy)}m</p>` : ''}
        <p><small>Acil durum durumunda bu konum paylaşılır</small></p>
      </div>
    `);
    
    // Doğruluk çemberi ekle (varsa)
    if (accuracy && accuracy < 1000) {
      const accuracyCircle = L.circle([lat, lon], {
        radius: accuracy,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.1,
        weight: 2,
        opacity: 0.6
      });
      
      markerGroups.user.addLayer(accuracyCircle);
    }
    
    markerGroups.user.addLayer(userMarker);
    
    // Haritayı konuma odakla
    map.setView([lat, lon], 14, {
      animate: true,
      duration: 1
    });
    
  } catch (error) {
    console.error('❌ Kullanıcı konumu gösterme hatası:', error);
  }
}

/**
 * Yakın noktaları haritada göster
 */
export function showNearbyPoints(features, type) {
  try {
    console.log(`🎯 ${features.length} ${type} noktası gösteriliyor`);
    
    // Mevcut yakın nokta marker'larını temizle
    markerGroups.nearby.clearLayers();
    nearbyMarkers = [];
    
    features.forEach((feature, index) => {
      const coords = feature.geometry.coordinates;
      const props = feature.properties;
      
      // Marker icon'u seç
      const markerIcon = getMarkerIcon(type, index);
      
      // Marker oluştur
      const marker = L.marker([coords[1], coords[0]], {
        icon: markerIcon,
        title: props.name || 'İsimsiz'
      });
      
      // Popup içeriği
      const popupContent = createPopupContent(props, type, index);
      marker.bindPopup(popupContent);
      
      // Marker'ı gruba ekle
      markerGroups.nearby.addLayer(marker);
      nearbyMarkers.push(marker);
      
      // Click event
      marker.on('click', () => {
        console.log(`Marker tıklandı: ${props.name} (${index})`);
      });
    });
    
    // Tüm marker'ları görünür hale getir
    if (nearbyMarkers.length > 0) {
      const group = new L.featureGroup(nearbyMarkers);
      map.fitBounds(group.getBounds().pad(0.1), {
        animate: true,
        duration: 1
      });
    }
    
  } catch (error) {
    console.error('❌ Yakın noktalar gösterme hatası:', error);
  }
}

/**
 * Marker icon'u oluştur
 */
function getMarkerIcon(type, index) {
  let emoji = '📍';
  let className = 'nearby-marker';
  
  if (type === 'assembly-areas') {
    emoji = '🏟️';
    className += ' assembly-marker';
  } else if (type === 'hospitals') {
    emoji = '🏥';
    className += ' hospital-marker';
  }
  
  return L.divIcon({
    className: className,
    html: `
      <div class="marker-inner">
        <span class="marker-icon">${emoji}</span>
        <span class="marker-number">${index + 1}</span>
      </div>
    `,
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35]
  });
}

/**
 * Popup içeriği oluştur
 */
function createPopupContent(props, type, index) {
  const isAssemblyArea = type === 'assembly-areas';
  const category = isAssemblyArea ? 'Toplanma Alanı' : 'Hastane';
  const icon = isAssemblyArea ? '🏟️' : '🏥';
  
  let content = `
    <div class="popup-content ${type}-popup">
      <div class="popup-header">
        <h3>${icon} ${props.name || 'İsimsiz'}</h3>
        <span class="popup-number">#${index + 1}</span>
      </div>
      <div class="popup-details">
        <p><strong>Kategori:</strong> ${category}</p>
        <p><strong>Mesafe:</strong> ${props.distance_km} km (${props.distance_meters}m)</p>
        ${props.district ? `<p><strong>İlçe:</strong> ${props.district}</p>` : ''}
        ${props.bearing_degrees !== null ? `<p><strong>Yön:</strong> ${getBearingText(props.bearing_degrees)}</p>` : ''}
  `;
  
  // Toplanma alanı özel bilgileri
  if (isAssemblyArea) {
    if (props.capacity) {
      content += `<p><strong>Kapasite:</strong> 👥 ${props.capacity} kişi</p>`;
    }
    if (props.area_m2) {
      content += `<p><strong>Alan:</strong> 📏 ${props.area_m2} m²</p>`;
    }
  }
  
  // Hastane özel bilgileri
  if (!isAssemblyArea) {
    if (props.bed_count) {
      content += `<p><strong>Yatak Sayısı:</strong> 🛏️ ${props.bed_count}</p>`;
    }
    if (props.hospital_type) {
      content += `<p><strong>Tip:</strong> ${props.hospital_type}</p>`;
    }
    if (props.emergency_service) {
      content += `<p><strong>Acil Servis:</strong> ✅ Mevcut</p>`;
    }
  }
  
  content += `
      </div>
      <div class="popup-actions">
        <button onclick="navigateToPoint(${props.coordinates ? props.coordinates[1] : 0}, ${props.coordinates ? props.coordinates[0] : 0})" class="popup-btn navigate">
          🧭 Yol Tarifi
        </button>
        <button onclick="focusMarker(${index})" class="popup-btn focus">
          🎯 Odakla
        </button>
      </div>
    </div>
  `;
  
  return content;
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
  return directions[index] + ` (${Math.round(degrees)}°)`;
}

/**
 * Marker'ları temizle
 */
export function clearMarkers(type = 'all') {
  try {
    if (type === 'all' || type === 'user') {
      markerGroups.user.clearLayers();
      userMarker = null;
    }
    
    if (type === 'all' || type === 'nearby') {
      markerGroups.nearby.clearLayers();
      nearbyMarkers = [];
    }
    
    console.log(`🧹 ${type} marker'ları temizlendi`);
    
  } catch (error) {
    console.error('❌ Marker temizleme hatası:', error);
  }
}

/**
 * Harita kontrolleri ekle
 */
function addMapControls() {
  // Konum butonu
  const locationControl = L.Control.extend({
    options: {
      position: 'bottomright'
    },
    
    onAdd: function(map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
      
      container.innerHTML = `
        <a href="#" title="Konumumu Göster" role="button" aria-label="Konumumu Göster">
          <span class="control-icon">📍</span>
        </a>
      `;
      
      container.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        recenterToUser();
      };
      
      return container;
    }
  });
  
  // Varsayılan görünüm butonu (İstanbul yerine dünya)
  const resetZoomControl = L.Control.extend({
    options: {
      position: 'bottomright'
    },
    
    onAdd: function(map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom');
      
      container.innerHTML = `
        <a href="#" title="Varsayılan Görünüm" role="button" aria-label="Varsayılan Görünüm">
          <span class="control-icon">🌍</span>
        </a>
      `;
      
      container.onclick = function(e) {
        e.preventDefault();
        e.stopPropagation();
        resetToDefault();
      };
      
      return container;
    }
  });
  
  // Kontrolleri haritaya ekle
  new locationControl().addTo(map);
  new resetZoomControl().addTo(map);
  
  // Scale kontrolü ekle
  L.control.scale({
    position: 'bottomleft',
    metric: true,
    imperial: false
  }).addTo(map);
}

/**
 * Kullanıcı konumuna odakla
 */
function recenterToUser() {
  if (userMarker) {
    const userLatLng = userMarker.getLatLng();
    map.setView(userLatLng, 15, {
      animate: true,
      duration: 1
    });
    userMarker.openPopup();
  } else {
    console.warn('⚠️ Kullanıcı konumu bulunamadı');
  }
}

/**
 * Varsayılan görünüme dön (dünya geneli)
 */
function resetToDefault() {
  map.setView(DEFAULT_CENTER, 2, {
    animate: true,
    duration: 1.5
  });
}

/**
 * Belirli marker'a odakla
 */
export function focusOnMarker(index) {
  if (nearbyMarkers && nearbyMarkers[index]) {
    const marker = nearbyMarkers[index];
    const markerLatLng = marker.getLatLng();
    
    map.setView(markerLatLng, 16, {
      animate: true,
      duration: 1
    });
    
    marker.openPopup();
    
    // Marker'ı geçici olarak vurgula
    highlightMarker(marker);
  }
}

/**
 * Marker'ı geçici olarak vurgula
 */
function highlightMarker(marker) {
  const originalIcon = marker.getIcon();
  
  // Vurgu efekti için geçici icon
  const highlightIcon = L.divIcon({
    className: 'nearby-marker highlight',
    html: originalIcon.options.html,
    iconSize: [45, 45],
    iconAnchor: [22, 45],
    popupAnchor: [0, -45]
  });
  
  marker.setIcon(highlightIcon);
  
  // 2 saniye sonra normal haline döndür
  setTimeout(() => {
    marker.setIcon(originalIcon);
  }, 2000);
}

/**
 * Harita event handler'ları
 */
function onMapZoomEnd() {
  const zoom = map.getZoom();
  console.log('🔍 Harita zoom seviyesi:', zoom);
  
  // Zoom seviyesine göre marker boyutlarını ayarla
  adjustMarkerSizes(zoom);
}

function onMapMoveEnd() {
  const center = map.getCenter();
  console.log('🗺️ Harita merkezi:', center.lat.toFixed(4), center.lng.toFixed(4));
  
  // Sınırlama kaldırıldı - artık her yere gidebilir
}

function onMapClick(e) {
  console.log('👆 Harita tıklandı:', e.latlng.lat.toFixed(4), e.latlng.lng.toFixed(4));
  
  // Debug için koordinat göster (development modunda)
  if (window.__DEV__) {
    L.popup()
      .setLatLng(e.latlng)
      .setContent(`
        <div class="debug-popup">
          <strong>Debug Koordinat</strong><br>
          Enlem: ${e.latlng.lat.toFixed(6)}<br>
          Boylam: ${e.latlng.lng.toFixed(6)}
        </div>
      `)
      .openOn(map);
  }
}

/**
 * Zoom seviyesine göre marker boyutlarını ayarla
 */
function adjustMarkerSizes(zoom) {
  const scale = Math.min(Math.max(zoom / 12, 0.7), 1.5);
  
  // CSS custom property ile boyut ayarla
  document.documentElement.style.setProperty('--marker-scale', scale);
}


window.focusMarker = function(index) {
  focusOnMarker(index);
};

// Export edilen fonksiyon alias'ları
export { focusOnMarker as focusOnMap };

console.log('🗺️ Harita modülü yüklendi (sınırsız mod)');