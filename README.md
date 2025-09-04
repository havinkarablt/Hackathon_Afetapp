# AfetApp

AfetApp, İstanbul’da acil durumlarda hızlı ve güvenli iletişim sağlamak için geliştirilmiş bir web ve mobil uygulamadır. Kullanıcılar tek bir butonla yardım çağrısı yapabilir, konumlarını paylaşabilir ve en yakın toplanma alanları ile hastaneleri görüntüleyebilir.

## Özellikler

### Ana Özellikler
- Acil Durum Butonu: GPS koordinatlarını otomatik olarak alır ve acil durum merkezine gönderir.
- Yakın Konum Gösterimi: En yakın 5 toplanma alanı ve 5 hastaneyi liste ve harita üzerinde gösterir.
- Harita Desteği: Leaflet.js tabanlı, OpenStreetMap entegrasyonlu interaktif harita.
- Gerçek Zamanlı Konum: Konum bilgisi otomatik alınır ve anında işlenir.
- Responsive Tasarım: Hem mobil hem de masaüstü cihazlar için optimize edilmiştir.

### Teknik Özellikler
- Backend: Node.js, Express, PostgreSQL + PostGIS
- Frontend: Vanilla JavaScript, Leaflet.js, modern CSS
- Veritabanı: Spatial indeksli coğrafi veri depolama
- Containerization: Docker Compose ile tam stack kurulumu
- Yönetim: Basit admin paneli

## Kurulum

### Gereksinimler
- Docker ve Docker Compose
- Git
- Minimum 4GB RAM ve 2GB disk alanı

### Adımlar

1. Projeyi klonlayın:
   ```bash
   git clone [REPO_URL]
   cd afetapp
   ```

2. Docker Compose ile servisleri başlatın:
   ```bash
   docker compose up -d
   ```

3. Servislerin durumunu kontrol edin:
   ```bash
   docker compose ps
   ```

4. Uygulamayı tarayıcıdan açın:
   - Ana Uygulama: http://localhost
   - API Dokümantasyonu: http://localhost/api
   - Health Check: http://localhost/api/health/db

## İlk Kullanım

1. Tarayıcıdan http://localhost adresine gidin.
2. Konum izni verin.
3. Acil Durum butonunu test edin.
4. Toplanma alanları ve hastaneler için menüleri kullanın.

## Geliştirme

### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd web
npm install
npm run dev
```

### Veritabanı Seed
```bash
docker compose exec backend npm run seed
```

## API

| Method | Endpoint | Açıklama |
|--------|----------|-----------|
| GET    | `/api/health` | Sistem sağlık kontrolü |
| GET    | `/api/health/db` | Veritabanı sağlık kontrolü |
| POST   | `/api/emergency` | Acil durum kaydı oluştur |
| GET    | `/api/emergency` | Acil durum kayıtlarını listele |
| GET    | `/api/near/assembly-areas` | Yakın toplanma alanları |
| GET    | `/api/near/hospitals` | Yakın hastaneler |

Daha fazla detay için [API.md](./API.md) dosyasına bakın.

## Veritabanı

- `sos_calls`: Acil durum çağrıları
- `acil_durum_toplanma_alanlari`: Toplanma alanları
- `sağlık_sm_yonetim_saglik_merkezleri`: Hastaneler
- Spatial indeksler: GIST indeksleri hızlı konum sorguları için kullanılır


