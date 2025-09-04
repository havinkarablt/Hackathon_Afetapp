\# AfetApp API Dokümantasyonu



Bu doküman, AfetApp backend API'sinin tüm endpoint'lerini ve kullanımını detaylandırır.



\## Base URL



```

Production: https://afetapp.example.com/api

Development: http://localhost:3000/api

Local Docker: http://localhost/api

```



\## İçindekiler



1\. \[Genel Bilgiler](#genel-bilgiler)

2\. \[Authentication](#authentication)

3\. \[Health Endpoints](#health-endpoints)

4\. \[Emergency Endpoints](#emergency-endpoints)  

5\. \[Near Location Endpoints](#near-location-endpoints)

6\. \[Error Handling](#error-handling)

7\. \[Rate Limiting](#rate-limiting)

8\. \[Examples](#examples)



\##  Genel Bilgiler



\### Headers

Tüm isteklerde şu header'lar kullanılmalıdır:



```http

Content-Type: application/json

Accept: application/json

```



\### Koordinat Sistemi

\- \*\*EPSG:4326\*\* (WGS84) koordinat sistemi kullanılır

\- \*\*Boylam (longitude)\*\*: -180 ile 180 arası

\- \*\*Enlem (latitude)\*\*: -90 ile 90 arası

\- \*\*İstanbul sınırları\*\*: ~28.5-29.5 boylam, ~40.8-41.2 enlem



\### Response Format

Tüm yanıtlar JSON formatındadır:



```json

{

&nbsp; "success": true,

&nbsp; "data": {},

&nbsp; "message": "İşlem başarılı",

&nbsp; "timestamp": "2025-01-15T10:30:00Z"

}

```



\# Authentication



Şu an için authentication bulunmamaktadır. Gelecek versiyonlarda API key sistemi eklenecektir.



\##  Health Endpoints



\### GET /health

Temel sistem sağlık kontrolü



```http

GET /api/health

```



\*\*Response:\*\*

```json

{

&nbsp; "status": "up",

&nbsp; "timestamp": "2025-01-15T10:30:00Z",

&nbsp; "uptime": 3600.5,

&nbsp; "memory": {

&nbsp;   "rss": 45678592,

&nbsp;   "heapTotal": 18874368,

&nbsp;   "heapUsed": 15234560,

&nbsp;   "external": 1089024

&nbsp; },

&nbsp; "env": "development"

}

```



\### GET /health/db

Veritabanı sağlık kontrolü



```http

GET /api/health/db

```



\*\*Response (Başarılı):\*\*

```json

{

&nbsp; "db": "up",

&nbsp; "timestamp": "2025-01-15T10:30:00Z",

&nbsp; "response\_time\_ms": 25,

&nbsp; "tables": 4,

&nbsp; "postgis\_enabled": true,

&nbsp; "active\_connections": 3,

&nbsp; "pool\_stats": {

&nbsp;   "total\_count": 20,

&nbsp;   "idle\_count": 17,

&nbsp;   "waiting\_count": 0

&nbsp; }

}

```



\*\*Response (Hata):\*\*

```json

{

&nbsp; "db": "down",

&nbsp; "timestamp": "2025-01-15T10:30:00Z",

&nbsp; "error": "Connection refused",

&nbsp; "code": "ECONNREFUSED"

}

```



\### GET /health/system

Detaylı sistem bilgileri (admin için)



```http

GET /api/health/system

```



\*\*Response:\*\*

```json

{

&nbsp; "status": "up",

&nbsp; "timestamp": "2025-01-15T10:30:00Z",

&nbsp; "system": {

&nbsp;   "node\_version": "v18.19.0",

&nbsp;   "platform": "linux",

&nbsp;   "arch": "x64",

&nbsp;   "uptime": 3600.5,

&nbsp;   "memory": { /\* memory stats \*/ },

&nbsp;   "cpu\_usage": { "user": 1234, "system": 5678 }

&nbsp; },

&nbsp; "database": {

&nbsp;   "table\_statistics": \[

&nbsp;     {

&nbsp;       "tablename": "sos\_calls",

&nbsp;       "live\_rows": "15",

&nbsp;       "inserts": "18",

&nbsp;       "updates": "2",

&nbsp;       "deletes": "1"

&nbsp;     }

&nbsp;   ]

&nbsp; }

}

```



\##  Emergency Endpoints



\### POST /emergency

Yeni acil durum kaydı oluştur



```http

POST /api/emergency

Content-Type: application/json

```



\*\*Request Body:\*\*

```json

{

&nbsp; "lon": 28.9784,

&nbsp; "lat": 41.0082,

&nbsp; "meta": {

&nbsp;   "timestamp": "2025-01-15T10:30:00Z",

&nbsp;   "user\_agent": "Mozilla/5.0...",

&nbsp;   "accuracy": 10,

&nbsp;   "custom\_field": "value"

&nbsp; }

}

```



\*\*Parametreler:\*\*

\- `lon` (required): Boylam (-180 ile 180)

\- `lat` (required): Enlem (-90 ile 90)

\- `meta` (optional): Ek metadata object'i



\*\*Response (201 Created):\*\*

```json

{

&nbsp; "success": true,

&nbsp; "message": "Acil durum kaydı oluşturuldu",

&nbsp; "call": {

&nbsp;   "id": 123,

&nbsp;   "coordinates": {

&nbsp;     "lat": 41.0082,

&nbsp;     "lon": 28.9784

&nbsp;   },

&nbsp;   "timestamp": "2025-01-15T10:30:00Z",

&nbsp;   "metadata": { /\* user metadata \*/ }

&nbsp; },

&nbsp; "next\_steps": \[

&nbsp;   "En yakın toplanma alanlarını görmek için: GET /api/near/assembly-areas",

&nbsp;   "En yakın hastaneleri görmek için: GET /api/near/hospitals"

&nbsp; ]

}

```



\*\*Errors:\*\*

\- `400`: Geçersiz koordinatlar

\- `400`: İstanbul sınırları dışında



\### GET /emergency

Acil durum kayıtları listesi (admin için)



```http

GET /api/emergency?limit=20\&offset=0

```



\*\*Query Parameters:\*\*

\- `limit` (optional): Kayıt limiti (varsayılan: 50, max: 100)

\- `offset` (optional): Başlangıç offset'i (varsayılan: 0)



\*\*Response:\*\*

```json

{

&nbsp; "calls": \[

&nbsp;   {

&nbsp;     "id": 123,

&nbsp;     "coordinates": {

&nbsp;       "lat": 41.0082,

&nbsp;       "lon": 28.9784

&nbsp;     },

&nbsp;     "metadata": { /\* metadata \*/ },

&nbsp;     "created\_at": "2025-01-15T10:30:00Z",

&nbsp;     "seconds\_ago": 1800

&nbsp;   }

&nbsp; ],

&nbsp; "pagination": {

&nbsp;   "total": 150,

&nbsp;   "limit": 20,

&nbsp;   "offset": 0,

&nbsp;   "has\_more": true

&nbsp; }

}

```



\### GET /emergency/:id

Belirli acil durum kaydının detayları



```http

GET /api/emergency/123

```



\*\*Response:\*\*

```json

{

&nbsp; "call": {

&nbsp;   "id": 123,

&nbsp;   "coordinates": {

&nbsp;     "lat": 41.0082,

&nbsp;     "lon": 28.9784

&nbsp;   },

&nbsp;   "metadata": { /\* full metadata \*/ },

&nbsp;   "created\_at": "2025-01-15T10:30:00Z"

&nbsp; }

}

```



\*\*Errors:\*\*

\- `404`: Kayıt bulunamadı



\## Near Location Endpoints



\### GET /near/assembly-areas

En yakın toplanma alanları



```http

GET /api/near/assembly-areas?lon=28.9784\&lat=41.0082\&limit=5

```



\*\*Query Parameters:\*\*

\- `lon` (required): Boylam

\- `lat` (required): Enlem  

\- `limit` (optional): Sonuç limiti (varsayılan: 5, max: 20)



\*\*Response (GeoJSON FeatureCollection):\*\*

```json

{

&nbsp; "type": "FeatureCollection",

&nbsp; "query": {

&nbsp;   "coordinates": {

&nbsp;     "lat": 41.0082,

&nbsp;     "lon": 28.9784

&nbsp;   },

&nbsp;   "limit": 5,

&nbsp;   "type": "assembly\_areas"

&nbsp; },

&nbsp; "features": \[

&nbsp;   {

&nbsp;     "type": "Feature",

&nbsp;     "id": 1,

&nbsp;     "geometry": {

&nbsp;       "type": "Point",

&nbsp;       "coordinates": \[28.9866, 41.0369]

&nbsp;     },

&nbsp;     "properties": {

&nbsp;       "name": "Taksim Meydanı",

&nbsp;       "distance\_meters": 823,

&nbsp;       "distance\_km": 0.82,

&nbsp;       "bearing\_degrees": 45,

&nbsp;       "category": "Toplanma Alanı",

&nbsp;       "district": "Beyoğlu",

&nbsp;       "capacity": 5000,

&nbsp;       "area\_m2": 12000

&nbsp;     }

&nbsp;   }

&nbsp; ],

&nbsp; "metadata": {

&nbsp;   "timestamp": "2025-01-15T10:30:00Z",

&nbsp;   "count": 5,

&nbsp;   "source": "İstanbul Büyükşehir Belediyesi"

&nbsp; }

}

```



\### GET /near/hospitals

En yakın hastaneler



```http

GET /api/near/hospitals?lon=28.9784\&lat=41.0082\&limit=5

```



\*\*Query Parameters:\*\*

\- `lon` (required): Boylam

\- `lat` (required): Enlem

\- `limit` (optional): Sonuç limiti (varsayılan: 5, max: 20)



\*\*Response (GeoJSON FeatureCollection):\*\*

```json

{

&nbsp; "type": "FeatureCollection",

&nbsp; "query": {

&nbsp;   "coordinates": {

&nbsp;     "lat": 41.0082,

&nbsp;     "lon": 28.9784

&nbsp;   },

&nbsp;   "limit": 5,

&nbsp;   "type": "hospitals"

&nbsp; },

&nbsp; "features": \[

&nbsp;   {

&nbsp;     "type": "Feature",

&nbsp;     "id": 1,

&nbsp;     "geometry": {

&nbsp;       "type": "Point",

&nbsp;       "coordinates": \[28.9494, 41.0188]

&nbsp;     },

&nbsp;     "properties": {

&nbsp;       "name": "İstanbul Üniversitesi İstanbul Tıp Fakültesi",

&nbsp;       "distance\_meters": 1250,

&nbsp;       "distance\_km": 1.25,

&nbsp;       "bearing\_degrees": 315,

&nbsp;       "category": "Hastane",

&nbsp;       "district": "Fatih",

&nbsp;       "hospital\_type": "üniversite",

&nbsp;       "bed\_count": 1200,

&nbsp;       "emergency\_service": true

&nbsp;     }

&nbsp;   }

&nbsp; ],

&nbsp; "metadata": {

&nbsp;   "timestamp": "2025-01-15T10:30:00Z",

&nbsp;   "count": 5,

&nbsp;   "source": "İstanbul İl Sağlık Müdürlüğü"

&nbsp; }

}

```



\### GET /near/all

Hem toplanma alanları hem hastaneler



```http

GET /api/near/all?lon=28.9784\&lat=41.0082\&limit=3

```



\*\*Query Parameters:\*\*

\- `lon` (required): Boylam

\- `lat` (required): Enlem

\- `limit\_per\_type` (optional): Her tip için limit (varsayılan: 3, max: 10)



\*\*Response:\*\*

```json

{

&nbsp; "type": "FeatureCollection",

&nbsp; "query": {

&nbsp;   "coordinates": {

&nbsp;     "lat": 41.0082,

&nbsp;     "lon": 28.9784

&nbsp;   },

&nbsp;   "limit\_per\_type": 3

&nbsp; },

&nbsp; "features": \[

&nbsp;   /\* assembly areas with category: 'assembly\_area' \*/,

&nbsp;   /\* hospitals with category: 'hospital' \*/

&nbsp; ],

&nbsp; "summary": {

&nbsp;   "assembly\_areas\_count": 3,

&nbsp;   "hospitals\_count": 3,

&nbsp;   "total\_count": 6

&nbsp; },

&nbsp; "metadata": {

&nbsp;   "timestamp": "2025-01-15T10:30:00Z",

&nbsp;   "source": "İstanbul Afet Koordinasyon Merkezi"

&nbsp; }

}

```



\### GET /near/within/:distance

Belirli mesafe içindeki noktalar



```http

GET /api/near/within/1000?type=hospitals\&lon=28.9784\&lat=41.0082

```



\*\*Path Parameters:\*\*

\- `distance`: Metre cinsinden mesafe (max: 10000)



\*\*Query Parameters:\*\*

\- `type` (required): 'assembly\_areas' veya 'hospitals'

\- `lon` (required): Boylam

\- `lat` (required): Enlem



\*\*Response:\*\*

```json

{

&nbsp; "type": "FeatureCollection",

&nbsp; "query": {

&nbsp;   "coordinates": {

&nbsp;     "lat": 41.0082,

&nbsp;     "lon": 28.9784

&nbsp;   },

&nbsp;   "distance\_meters": 1000,

&nbsp;   "type": "hospitals"

&nbsp; },

&nbsp; "features": \[

&nbsp;   /\* all hospitals within 1km \*/

&nbsp; ],

&nbsp; "metadata": {

&nbsp;   "timestamp": "2025-01-15T10:30:00Z",

&nbsp;   "count": 2

&nbsp; }

}

```



\##  Error Handling



\### Error Response Format

```json

{

&nbsp; "error": "Hata mesajı",

&nbsp; "message": "Detaylı açıklama",

&nbsp; "code": "ERROR\_CODE",

&nbsp; "status": 400,

&nbsp; "timestamp": "2025-01-15T10:30:00Z",

&nbsp; "path": "/api/emergency",

&nbsp; "method": "POST"

}

```



\### HTTP Status Codes

\- `200`: Başarılı istek

\- `201`: Kaynak oluşturuldu

\- `400`: Geçersiz istek

\- `404`: Kaynak bulunamadı

\- `500`: Sunucu hatası

\- `503`: Servis kullanılamaz



\### Common Errors



\*\*Koordinat Hataları:\*\*

```json

{

&nbsp; "error": "Koordinatlar gerekli",

&nbsp; "required": { "lon": "number", "lat": "number" },

&nbsp; "received": { "lon": null, "lat": null }

}

```



```json

{

&nbsp; "error": "Konum İstanbul sınırları dışında",

&nbsp; "bounds": {

&nbsp;   "north": 41.2,

&nbsp;   "south": 40.8,

&nbsp;   "east": 29.5,

&nbsp;   "west": 28.5

&nbsp; },

&nbsp; "received": { "lat": 40.7, "lon": 29.0 }

}

```



\*\*Veritabanı Hataları:\*\*

```json

{

&nbsp; "error": "Veritabanı bağlantısı kurulamadı",

&nbsp; "code": "ECONNREFUSED",

&nbsp; "status": 503

}

```




\##  Examples



\### JavaScript/Fetch Example



```javascript

// Acil durum kaydı oluştur

async function sendEmergency(lon, lat) {

&nbsp; try {

&nbsp;   const response = await fetch('/api/emergency', {

&nbsp;     method: 'POST',

&nbsp;     headers: {

&nbsp;       'Content-Type': 'application/json',

&nbsp;     },

&nbsp;     body: JSON.stringify({

&nbsp;       lon: lon,

&nbsp;       lat: lat,

&nbsp;       meta: {

&nbsp;         timestamp: new Date().toISOString(),

&nbsp;         user\_agent: navigator.userAgent

&nbsp;       }

&nbsp;     })

&nbsp;   });

&nbsp;   

&nbsp;   if (!response.ok) {

&nbsp;     throw new Error(`HTTP ${response.status}`);

&nbsp;   }

&nbsp;   

&nbsp;   const data = await response.json();

&nbsp;   console.log('Acil durum kaydı:', data.call.id);

&nbsp;   return data;

&nbsp; } catch (error) {

&nbsp;   console.error('Hata:', error);

&nbsp;   throw error;

&nbsp; }

}



// Yakın hastaneleri getir

async function getNearbyHospitals(lon, lat, limit = 5) {

&nbsp; const params = new URLSearchParams({

&nbsp;   lon: lon.toString(),

&nbsp;   lat: lat.toString(),

&nbsp;   limit: limit.toString()

&nbsp; });

&nbsp; 

&nbsp; const response = await fetch(`/api/near/hospitals?${params}`);

&nbsp; const data = await response.json();

&nbsp; 

&nbsp; return data.features;

}

```



\### cURL Examples



```bash

\# Health check

curl http://localhost/api/health/db



\# Acil durum kaydı

curl -X POST http://localhost/api/emergency \\

&nbsp; -H "Content-Type: application/json" \\

&nbsp; -d '{

&nbsp;   "lon": 28.9784,

&nbsp;   "lat": 41.0082,

&nbsp;   "meta": {

&nbsp;     "test": true,

&nbsp;     "timestamp": "2025-01-15T10:30:00Z"

&nbsp;   }

&nbsp; }'



\# Yakın toplanma alanları

curl "http://localhost/api/near/assembly-areas?lon=28.9784\&lat=41.0082\&limit=3"



\# Yakın hastaneler

curl "http://localhost/api/near/hospitals?lon=28.9784\&lat=41.0082\&limit=3"



\# 1km içindeki tüm hastaneler

curl "http://localhost/api/near/within/1000?type=hospitals\&lon=28.9784\&lat=41.0082"

```



\### Python Example



```python

import requests

import json



\# API base URL

API\_BASE = "http://localhost/api"



def send\_emergency(lon, lat, metadata=None):

&nbsp;   """Acil durum kaydı gönder"""

&nbsp;   url = f"{API\_BASE}/emergency"

&nbsp;   payload = {

&nbsp;       "lon": lon,

&nbsp;       "lat": lat,

&nbsp;       "meta": metadata or {}

&nbsp;   }

&nbsp;   

&nbsp;   response = requests.post(url, json=payload)

&nbsp;   response.raise\_for\_status()

&nbsp;   

&nbsp;   return response.json()



def get\_nearby\_locations(location\_type, lon, lat, limit=5):

&nbsp;   """Yakın konumları getir"""

&nbsp;   url = f"{API\_BASE}/near/{location\_type}"

&nbsp;   params = {

&nbsp;       "lon": lon,

&nbsp;       "lat": lat,

&nbsp;       "limit": limit

&nbsp;   }

&nbsp;   

&nbsp;   response = requests.get(url, params=params)

&nbsp;   response.raise\_for\_status()

&nbsp;   

&nbsp;   return response.json()



\# Kullanım örneği

if \_\_name\_\_ == "\_\_main\_\_":

&nbsp;   # İstanbul merkez koordinatları

&nbsp;   istanbul\_center = (28.9784, 41.0082)

&nbsp;   

&nbsp;   # Acil durum gönder

&nbsp;   emergency = send\_emergency(

&nbsp;       lon=istanbul\_center\[0], 

&nbsp;       lat=istanbul\_center\[1],

&nbsp;       metadata={"source": "python\_test"}

&nbsp;   )

&nbsp;   print(f"Acil durum ID: {emergency\['call']\['id']}")

&nbsp;   

&nbsp;   # Yakın hastaneleri getir

&nbsp;   hospitals = get\_nearby\_locations("hospitals", \*istanbul\_center)

&nbsp;   print(f"{len(hospitals\['features'])} hastane bulundu")

&nbsp;   

&nbsp;   for hospital in hospitals\['features']:

&nbsp;       props = hospital\['properties']

&nbsp;       print(f"- {props\['name']} ({props\['distance\_km']} km)")

```






\## Related



\- \[Frontend Uygulaması](../web/README.md)

\- \[Database Schema](../backend/src/db/schema.sql)

\- \[Docker Setup](../ops/docker-compose.yml)



---




