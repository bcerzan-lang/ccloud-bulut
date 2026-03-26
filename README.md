# CloudManga - Puan Tabanlı Manga Okuma Sistemi

## Özellikler
- ✅ Kullanıcı kayıt/giriş sistemi
- ✅ Puan tabanlı manga açma (10 puan = 1 manga)
- ✅ İlk manga ücretsiz
- ✅ Okuma/yazma sıralaması
- ✅ Günlük ödül sistemi (1. 10, 2. 5, 3. 2 puan)
- ✅ Kalıcı veritabanı
- ✅ Popüler mangalar (Naruto, One Piece, Attack on Titan, Demon Slayer, My Hero Academia, Death Note)

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

### Manga Okuma
- `http://localhost:10000/manga.html` adresinden manga seçin
- İlk seçtiğiniz manga ücretsiz
- Sonraki mangalar için 10 puan gerekir
- Puan kazanmak için okuma aktivitesi yapın

### Mevcut Mangalar
- 🍥 **Naruto** - 700+ bölüm
- 🏴‍☠️ **One Piece** - 1100+ bölüm  
- ⚔️ **Attack on Titan** - 139 bölüm
- 🗡️ **Demon Slayer** - 205 bölüm
- 🦸 **My Hero Academia** - 410+ bölüm
- 📓 **Death Note** - 108 bölüm

### Sıralama Sistemi
- Günlük okuma/yazma sıralaması
- 1. 10 puan, 2. 5 puan, 3. 2 puan ödül
- `hesap.html` sayfasında görüntüleyin

## Dosya Yapısı
```
├── server.py              # Flask sunucusu
├── cloudmanga.db          # SQLite veritabanı
├── giris.html             # Giriş/kayıt sayfası
├── hesap.html             # Hesap ve sıralama
├── manga.html             # Manga listesi
├── index.html             # Ana sayfa
├── naruto-bolum1.html     # Naruto Bölüm 1
├── naruto-bolum2.html     # Naruto Bölüm 2
├── onepiece-bolum1.html  # One Piece Bölüm 1
├── style.css              # Stil dosyası
├── app.js                 # JavaScript kodu
└── requirements.txt       # Python paketleri
```

## Veritabanı Tabloları
- `users` - Kullanıcı bilgileri ve puanlar
- `book_unlocks` - Manga açma kayıtları
- `user_reading` - Okuma aktiviteleri
- `user_writing` - Yazma aktiviteleri
- `reward_history` - Ödül geçmişi

## GitHub'a Yükleme
Tüm dosyaları GitHub'a yükleyebilirsiniz. Sistem her platformda çalışır.

## Not
- Veritabanı kalıcıdır, sunucu yeniden başlasa bile veriler kaybolmaz
- Çoklu kullanıcı desteği mevcuttur
- Günlük ödüller otomatik hesaplanır
- CloudKitap yerine CloudManga markası kullanılır
