# CloudKitap - Puan Tabanlı Kitap Okuma Sistemi

## Özellikler
- ✅ Kullanıcı kayıt/giriş sistemi
- ✅ Puan tabanlı kitap açma (10 puan = 1 kitap)
- ✅ İlk kitap ücretsiz
- ✅ Okuma/yazma sıralaması
- ✅ Günlük ödül sistemi (1. 10, 2. 5, 3. 2 puan)
- ✅ Kalıcı veritabanı

## Kurulum

### 1. Python Kurulumu
Windows'ta Python kurulu değilse:
```
https://www.python.org/downloads/
```

### 2. Gerekli Paketler
```bash
py -m pip install -r requirements.txt
```

### 3. Sunucuyu Başlatma
```bash
py server.py
```

### 4. Siteye Erişim
```
http://localhost:10000
```

## Kullanım

### Giriş Yap
1. `http://localhost:10000/giris.html` adresine gidin
2. Yeni hesap oluşturun veya mevcut hesaba giriş yapın

### Kitap Açma
- İlk seçtiğiniz kitap ücretsiz
- Sonraki kitaplar için 10 puan gerekir
- Puan kazanmak için okuma/yazma aktivitesi yapın

### Sıralama Sistemi
- Günlük okuma/yazma sıralaması
- 1. 10 puan, 2. 5 puan, 3. 2 puan ödül
- `hesap.html` sayfasında görüntüleyin

## Dosya Yapısı
```
├── server.py              # Flask sunucusu
├── cloudkitap.db          # SQLite veritabanı
├── giris.html             # Giriş/kayıt sayfası
├── hesap.html             # Hesap ve sıralama
├── index.html             # Ana sayfa
├── style.css              # Stil dosyası
├── app.js                 # JavaScript kodu
└── requirements.txt       # Python paketleri
```

## Veritabanı Tabloları
- `users` - Kullanıcı bilgileri ve puanlar
- `book_unlocks` - Kitap açma kayıtları
- `user_reading` - Okuma aktiviteleri
- `user_writing` - Yazma aktiviteleri
- `reward_history` - Ödül geçmişi

## GitHub'a Yükleme
Tüm dosyaları GitHub'a yükleyebilirsiniz. Sistem her platformda çalışır.

## Not
- Veritabanı kalıcıdır, sunucu yeniden başlasa bile veriler kaybolmaz
- Çoklu kullanıcı desteği mevcuttur
- Günlük ödüller otomatik hesaplanır
