\# AfetApp MVP - İstanbul Acil Durum Uygulaması



&nbsp;\*\*AfetApp\*\*, İstanbul'da yaşanan acil durumlar için geliştirilmiş bir web ve mobil uygulamasıdır. Kullanıcılar tek bir butonla acil durum bildiriminde bulunabilir, en yakın toplanma alanlarını ve hastaneleri görüntüleyebilir.



\## Özellikler



\### Ana Özellikler

\- \*\*Tek Büyük Acil Durum Butonu\*\*: GPS koordinatlarını otomatik alarak acil durum merkezi ile paylaşır

\- \*\*Yakın Konum Gösterimi\*\*: En yakın 5 toplanma alanı ve 5 hastaneyi harita ve liste olarak gösterir

\- \*\*Interaktif Harita\*\*: Leaflet.js tabanlı OpenStreetMap haritası

\- \*\*Gerçek Zamanlı\*\*: Konum bilgisi otomatik alınır ve anında işlenir

\- \*\*Responsive Tasarım\*\*: Mobil ve masaüstü cihazlarda optimize edilmiş arayüz



\### Teknik Özellikler

\- \*\*Backend\*\*: Node.js, Express, PostgreSQL + PostGIS

\- \*\*Frontend\*\*: Vanilla JavaScript, Leaflet.js, Modern CSS

\- \*\*Veritabanı\*\*: Spatial indeksli coğrafi veri depolama

\- \*\*Containerization\*\*: Docker Compose ile tam stack

\- \*\*Admin Panel\*\*: Basit yönetim arayüzü





\##  Hızlı Başlangıç



\### Gereksinimler

\- \*\*Docker\*\* ve \*\*Docker Compose\*\*

\- \*\*Git\*\*

\- En az \*\*4GB RAM\*\* ve \*\*2GB disk alanı\*\*



\### Kurulum



1\. \*\*Projeyi klonlayın\*\*:

```bash

git clone \[REPO\_URL]

cd afetapp

```



2\. \*\*Docker Compose ile başlatın\*\*:

```bash

docker compose up -d

```



3\. \*\*Servislerin durumunu kontrol edin\*\*:

```bash

docker compose ps

```



4\. \*\*Uygulamayı açın\*\*:

&nbsp;  - \*\*Ana Uygulama\*\*: http://localhost

&nbsp;  - \*\*API Dokümantasyonu\*\*: http://localhost/api

&nbsp;  - \*\*Health Check\*\*: http://localhost/api/health/db



\### İlk Kullanım



1\. Tarayıcıda http://localhost adresine gidin

2\. Konum izni verin (gerekli)

3\. \*\*ACİL DURUM\*\* butonuna tıklayarak test edin

4\. \*\*Toplanma Alanları\*\* ve \*\*Hastaneler\*\* butonlarını deneyin

&nbsp;Proje Yapısı



\## Geliştirme



\### Development Modu



```bash

\# Backend geliştirme

cd backend

npm install

npm run dev



\# Frontend geliştirme  

cd web

npm install

npm run dev

```



\### Veritabanı Seed



```bash

\# Backend container içinde

docker compose exec backend npm run seed

```



\### Test Etme



```bash

\# Health check

curl http://localhost/api/health/db



\# Acil durum testi

curl -X POST http://localhost/api/emergency \\

&nbsp; -H "Content-Type: application/json" \\

&nbsp; -d '{"lon": 28.9784, "lat": 41.0082}'



\# Yakın konumlar

curl "http://localhost/api/near/assembly-areas?lon=28.9784\&lat=41.0082\&limit=3"

```



\##  API Endpoints



| Method | Endpoint | Açıklama |

|--------|----------|-----------|

| GET | `/api/health` | Sistem sağlık kontrolü |

| GET | `/api/health/db` | Veritabanı sağlık kontrolü |

| POST | `/api/emergency` | Acil durum kaydı oluştur |

| GET | `/api/emergency` | Acil durum kayıtlarını listele |

| GET | `/api/near/assembly-areas` | Yakın toplanma alanları |

| GET | `/api/near/hospitals` | Yakın hastaneler |



Detaylı API dokümantasyonu için: \[API.md](./API.md)



\## Veritabanı Şeması



\### Ana Tablolar

\- \*\*`sos\_calls`\*\*: Acil durum çağrıları

\- \*\*`assembly\_areas`\*\*: Toplanma alanları

\- \*\*`hospitals`\*\*: Hastaneler



\### Spatial İndeksler

\- GIST indeksleri tüm konum alanlarında

\- Hızlı yakınlık sorguları için optimizasyon



\## Frontend Özellikleri



\### Responsive Tasarım

\- Mobile-first yaklaşım

\- Touch-friendly interface

\- Accessibility (WCAG 2.1 AA) uyumlu



\### Harita Özellikleri

\- \*\*Leaflet.js\*\* ile OpenStreetMap entegrasyonu

\- Özel marker'lar ve popup'lar

\- Konum odaklama ve yakınlaştırma

\- İstanbul sınırları ile kısıtlama



\### Kullanıcı Deneyimi

\- Büyük, anlaşılır butonlar

\- Gerçek zamanlı bildirimler

\- Offline durumu uyarıları

\- Klavye navigasyon desteği



\## Güvenlik



\### Backend Güvenlik

\- Helmet.js ile HTTP güvenlik başlıkları

\- CORS konfigürasyonu

\- Input validasyonu ve sanitizasyon

\- SQL injection koruması



\### Frontend Güvenlik

\- Content Security Policy

\- XSS koruması

\- Secure API iletişimi



\## Mobil Uyumluluk



\- \*\*PWA Ready\*\*: Service Worker desteği hazır

\- \*\*Responsive\*\*: Tüm ekran boyutlarında uyumlu

\- \*\*Touch Optimized\*\*: Dokunmatik cihazlar için optimize

\- \*\*Fast Loading\*\*: Optimize edilmiş asset'ler



\##  Performans



\### Backend Optimizasyon

\- Connection pooling

\- Spatial indeksler

\- Query optimizasyonu

\- Compression middleware



\### Frontend Optimizasyon  

\- Lazy loading

\- Asset bundling (Vite)

\- CSS/JS minification

\- Image optimization





