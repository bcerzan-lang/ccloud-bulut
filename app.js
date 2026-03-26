// ===== LOCALE-BASED BRAND NAME =====
const bookTranslations = {
  tr: "Kitap", en: "Book", de: "Buch", fr: "Livre",
  es: "Libro", pt: "Livro", it: "Libro", nl: "Boek",
  pl: "Książka", ru: "Книга", ja: "本", ko: "책",
  zh: "书", ar: "كتاب", sv: "Bok", da: "Bog",
  fi: "Kirja", no: "Bok", el: "Βιβλίο", uk: "Книга"
};

function getLocalizedBrandName() {
  const lang = (navigator.language || "en").split("-")[0].toLowerCase();
  const word = bookTranslations[lang] || "Book";
  return "Cloud" + word;
}

function applyBrandName() {
  const brand = getLocalizedBrandName();
  document.querySelectorAll(".logo-text").forEach(el => el.textContent = brand);
  document.querySelectorAll(".brand-name").forEach(el => el.textContent = brand);
  if (document.title) {
    document.title = document.title.replace(/CloudKitap|CloudManga|CloudBook/g, brand);
  }
}

// ===== SIDEBAR =====
function toggleSidebar() {
  const sb = document.getElementById("sidebar");
  const ov = document.getElementById("sidebarOverlay");
  if (sb) sb.classList.toggle("open");
  if (ov) ov.classList.toggle("active");
}

// ===== SAVE BUTTON =====
function toggleSave(btn) {
  btn.classList.toggle("saved");
  btn.textContent = btn.classList.contains("saved") ? "✓ Kitaplığımda" : "+ Kitaplığıma Ekle";
}

// ===== SEARCH =====
function handleSearch(val) {
  const cl = document.getElementById("searchClear");
  if (cl) cl.style.display = val ? "flex" : "none";
}

function clearSearch() {
  const inp = document.getElementById("searchInput");
  if (inp) { inp.value = ""; handleSearch(""); }
}

// ===== READING PROGRESS =====
function updateReadingProgress() {
  const fill = document.getElementById("progressFill");
  if (!fill) return;
  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
  const docH = document.documentElement.scrollHeight - document.documentElement.clientHeight;
  const pct = docH > 0 ? (scrollTop / docH) * 100 : 0;
  fill.style.width = pct + "%";
}
window.addEventListener("scroll", updateReadingProgress);

// ===== FONT SIZE =====
let fontSize = 17;
function changeFontSize(delta) {
  fontSize = Math.max(13, Math.min(24, fontSize + delta));
  const rt = document.querySelector(".reader-text");
  if (rt) rt.style.fontSize = fontSize + "px";
  const lbl = document.getElementById("fontSizeLabel");
  if (lbl) lbl.textContent = fontSize + "px";
}
function toggleFontPanel() {
  document.getElementById("fontPanel")?.classList.toggle("open");
}
document.addEventListener("click", function(e) {
  const panel = document.getElementById("fontPanel");
  const btn = document.getElementById("fontPanelBtn");
  if (panel && btn && !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.remove("open");
  }
});

// ===== TTS ENGINE =====
let ttsUtterance = null;
let ttsPlaying = false;
let ttsPaused = false;
let ttsChunks = [];
let ttsChunkIndex = 0;
let ttsSelectedVoice = null;

function getTTSText() {
  const el = document.getElementById("readerText");
  if (!el) return "";
  return el.innerText
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoChunks(text, size = 220) {
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const chunks = [];
  let current = "";
  for (const s of sentences) {
    if ((current + s).length > size && current.length > 0) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function pickSoothingVoice() {
  const voices = window.speechSynthesis.getVoices();
  // Önce Türkçe kadın sesi, sonra Türkçe herhangi ses, sonra en yumuşak İngilizce
  const preferred = [
    v => v.lang.startsWith("tr") && /female|woman|girl|kadin|bayan/i.test(v.name),
    v => v.lang.startsWith("tr"),
    v => v.lang === "tr-TR",
    v => v.lang.startsWith("en") && /female|woman|samantha|karen|moira|tessa|victoria|zira/i.test(v.name),
    v => v.lang.startsWith("en"),
    v => true
  ];
  for (const fn of preferred) {
    const v = voices.find(fn);
    if (v) return v;
  }
  return null;
}

function speakChunk(index) {
  if (index >= ttsChunks.length) {
    ttsPlaying = false;
    ttsPaused = false;
    updateTTSUI("stopped");
    return;
  }
  ttsChunkIndex = index;
  const utt = new SpeechSynthesisUtterance(ttsChunks[index]);
  utt.lang   = "tr-TR";
  utt.rate   = 0.82;
  utt.pitch  = 0.88;
  utt.volume = 1.0;

  if (!ttsSelectedVoice) ttsSelectedVoice = pickSoothingVoice();
  if (ttsSelectedVoice) utt.voice = ttsSelectedVoice;

  utt.onend = () => {
    if (ttsPlaying && !ttsPaused) speakChunk(index + 1);
  };
  utt.onerror = () => {
    if (ttsPlaying && !ttsPaused) speakChunk(index + 1);
  };

  ttsUtterance = utt;
  window.speechSynthesis.speak(utt);

  // Progress
  const pct = ttsChunks.length > 1 ? Math.round((index / (ttsChunks.length - 1)) * 100) : 100;
  const bar = document.getElementById("ttsProgressFill");
  if (bar) bar.style.width = pct + "%";
  const timeEl = document.getElementById("ttsTimeLeft");
  if (timeEl) {
    const remaining = ttsChunks.slice(index).join(" ").split(/\s+/).length;
    const mins = Math.ceil(remaining / (0.82 * 130));
    timeEl.textContent = mins + " dk kaldı";
  }
}

function ttsPlay() {
  if (ttsPaused && window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
    ttsPlaying = true;
    ttsPaused = false;
    updateTTSUI("playing");
    return;
  }
  window.speechSynthesis.cancel();
  ttsChunks = splitIntoChunks(getTTSText());
  ttsPlaying = true;
  ttsPaused = false;
  ttsSelectedVoice = null;

  // Ensure voices are loaded
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      ttsSelectedVoice = pickSoothingVoice();
      speakChunk(0);
    };
  } else {
    ttsSelectedVoice = pickSoothingVoice();
    speakChunk(0);
  }
  updateTTSUI("playing");
}

function ttsPause() {
  window.speechSynthesis.pause();
  ttsPlaying = false;
  ttsPaused = true;
  updateTTSUI("paused");
}

function ttsStop() {
  window.speechSynthesis.cancel();
  ttsPlaying = false;
  ttsPaused = false;
  ttsChunkIndex = 0;
  updateTTSUI("stopped");
  const bar = document.getElementById("ttsProgressFill");
  if (bar) bar.style.width = "0%";
  const timeEl = document.getElementById("ttsTimeLeft");
  if (timeEl) timeEl.textContent = "";
}

function ttsRewind() {
  window.speechSynthesis.cancel();
  const newIdx = Math.max(0, ttsChunkIndex - 3);
  if (ttsPlaying || ttsPaused) {
    ttsPlaying = true; ttsPaused = false;
    speakChunk(newIdx);
    updateTTSUI("playing");
  }
}

function updateTTSUI(state) {
  const playBtn  = document.getElementById("ttsPlayBtn");
  const pauseBtn = document.getElementById("ttsPauseBtn");
  const panel    = document.getElementById("ttsPanel");
  if (!playBtn || !pauseBtn) return;

  if (state === "playing") {
    playBtn.style.display  = "none";
    pauseBtn.style.display = "flex";
    if (panel) panel.classList.add("tts-active");
  } else {
    playBtn.style.display  = "flex";
    pauseBtn.style.display = "none";
    if (panel) panel.classList.remove("tts-active");
  }
}

// stop TTS when leaving page
window.addEventListener("beforeunload", () => window.speechSynthesis?.cancel());

// ===== BOOK CHAPTERS DATA =====
const bookData = {
  1: {
    num: "Bölüm 1", title: "Beyin",
    sub: "Melody'nin sesi yok — ama söyleyecek çok şeyi var.",
    prev: null, next: "bolum2.html",
    content: `
<p class="drop-cap">Kelimeler kafamın içinde sürekli dönüp duruyor. Bazen şarkılar gibi. Bazen sel gibi. Dışarıya çıkmak istiyor ama çıkamıyorlar. Kimse duymak için yeterince merak etmiyor zaten.</p>
<p>Adım Melody. On bir yaşındayım ve beynim bir tornado gibi çalışıyor. Her şeyi kaydediyorum. Her şeyi. Kelebeklerin kanatlarının rengini, annemin kullandığı şampuanın adını, öğretmenim Mrs. V'nin her sabah aynı mavi kazağı giydiğini. Hafızam bir video kaydedici gibi, hiçbir şeyi atlayan yok.</p>
<p>Ama konuşamıyorum.</p>
<p>Kollarımı tam olarak kontrol edemiyorum. Tekerlekli sandalyemdeyim. Spastik quadripleji deniyor buna — beyin felci. Beyin felcinin benim beynimle alakası yok aslında. Sadece kaslarımla. Ama bunu kimseye anlatamıyorum çünkü... konuşamıyorum.</p>
<div class="thought">Dünya beni bir balık gibi görüyor. Tankın içinde yüzüyor, dışarıyı izliyor ama iletişim kuramıyor. Oysa ben tankın dışındakileri izliyorum. Ve çok daha zekiyim onlardan çoğu.</div>
<p>Mrs. V — tam adı Mrs. Violet Valencia — evimizin iki blok ötesinde yaşayan yaşlı bir kadın. Bakıcım sayılır. Ama o kelimeyi sevmez. "Ben senin arkadaşınım," der her defasında. Ve inanıyorum ona. Çünkü bana farklı davranıyor. Bana aptal muamelesi yapmıyor.</p>
<p>Okul öyle değil.</p>
<p>Özel eğitim sınıfındayım. H-5. Koridorun en sonundaki oda. Camı yok. Buraya "kafes" diyorum — kimseye söylemesem de. Sınıftaki çocukların bir kısmı gerçekten ciddi zihinsel engellere sahip. Ama ben değilim. Ve bunu kanıtlamanın hiçbir yolu yok.</p>
<p>Bugün sınıfa yeni bir öğretmen geldi. Adı Mr. D. Tahtaya büyük harflerle "BUGÜN NASIL HİSSEDİYORSUNUZ?" yazdı. Sınıfa baktı.</p>
<div class="thought">Ben. Ben biliyorum nasıl hissettirdiğini. Şöyle hissediyorum: Zeki. Kafaya takmış. Sinirli. Umutsuz. Meraklı. Korkmaktan yorulmuş.</div>
<p>Mr. D her çocuğa teker teker sordu. Bana gelince, tekerlekli sandalyemi itmek için geldi yanıma, eğildi ve yüzüme baktı. Gözlerinde o 'acıma' ifadesi yok muydu ne kadar korktum. Ama yoktu.</p>
<p>"Melody," dedi. "Senin de bir cevabın var sanırım."</p>
<p>Parmaklarımla sol dizime vurdum. İki kez. Bu benim 'evet' işaretim. Annem öğretti. Mr. D bilmiyor. Yine de anladı galiba. Gülümsedi.</p>
<p>"Anlıyorum," dedi. Ve ciddiydi.</p>
<p class="scene-break">* * *</p>
<p>Eve döndüğümde annem kapıda bekliyordu. İki iş yapıyor — gündüz hastanede hemşire, akşam ev bakımevinde. Beni tekerlekli sandalyeden kucağına alıp oturma odasına taşıdı.</p>
<p>"Okul nasıldı?" diye sordu.</p>
<div class="thought">Yeni bir öğretmen geldi. Bana aptal gibi davranmadı. Bu benim için devrim niteliğinde.</div>
<p>Başımı sağa eğdim. Bu benim "iyi" ifadem. Annem anladı. Güldü. "İyi mi? Harika."</p>
<p>Gece boyunca beynimde sözcükler döndü durdu — kullanılmak için sabırsızlanan, bir çıkış arayan sözcükler. Bir gün bu sözcüklerin bir çıkış yolu bulacağına inanmak istiyorum.</p>`
  },

  2: {
    num: "Bölüm 2", title: "Ev",
    sub: "Bir ev sadece duvarlardan ibaret değildir.",
    prev: "bolum1.html", next: "bolum3.html",
    content: `
<p class="drop-cap">Evimiz küçük ama sıcak. Annem her köşeye bir şeyler koymuş — fotoğraf çerçeveleri, renkli yastıklar, çiçek saksıları. Benim odam ise özeldi. Duvarlarda kelimeler vardı. Annem her öğrendiğim yeni kavramı büyük harflerle kartona yazar ve duvara yapıştırırdı. METAMORFOZ. HİDROJEN. DEMOKRASİ. Kelimeler benim arkadaşlarımdı.</p>
<p>Penny doğduğunda her şey değişti biraz. Kız kardeşim. İki yaşında şu an. Yürüyebiliyor. Konuşabiliyor. "Melo-Melo!" diye çağırıyor beni. Bu sesi duymak istiyorum her sabah. Hayatımın en güzel sesi bu.</p>
<div class="thought">Penny beni nasıl gördüğünü hiç düşünmüyor. Benim kollarımın titremesini, sesimin çıkmamasını garip bulmuyor. Bence o dünyanın en zeki insanı.</div>
<p>Bugün Mrs. V geldi öğleden sonra. Biber ve soğan çorbası getirdi — en sevdiğim. Kaşığı tutabilmem için özel bir tutaç kullanıyorum.</p>
<p>"Sana bir şey söyleyeyim Melody," dedi yanıma oturarak. "Şu dünyada en nadir bulunan şey nedir biliyor musun? Sabır. Ve sen sabırla dolu bir çocuksun. Bu çok büyük bir güç."</p>
<div class="thought">Sabır mı? Ben sabırlı değilim. Çığlık atmak istiyorum çoğu zaman. Ama o görmüyor bunu. Belki de bu onun iyimserliği.</div>
<p>Mrs. V bana bugün büyük bir sürpriz yaptı. Bir resim kitabı getirdi — Güney Amerika kuşları üzerine. Her sayfada farklı bir kuş. Tukan, Makao, Kolibri. Renkleri o kadar canlıydı ki gözlerim kamaştı.</p>
<p>"Hangi kuş olmak isterdin?" diye sordu. Gözlerimle Makao'ya baktım. Kırmızı-mavi-sarı. Güçlü kanatlar. Yüksek sesle öten bir kuş.</p>
<p>"Makao," dedi Mrs. V. "Bilmişim ben seni."</p>
<p class="scene-break">* * *</p>
<p>Akşam baba eve geldi. Yorgun ama gülümsüyordu. Beni kucağına aldı, bir süre öylece oturduk. Konuşmadık. Konuşmamıza gerek yoktu. Bu sessizlik içinde bir şeyler anlaşılıyordu — kelimelerden daha büyük şeyler.</p>
<p>Penny koşarak geldi araya girdi. "Baba baba!" diye bağırdı. Babam onu da kucakladı. İkimizi birden tuttu. O an bir şey hissettim — bütünlük. Eksik olmama. Tam olma.</p>
<p>Gece yatmadan önce annem fısıldadı: "Melody, sen özelsin. Bunu her gün kanıtlıyorsun. Sadece sen fark etmiyorsun." Ve bu inanç, gece karanlığında küçük bir ışık gibiydi.</p>`
  },

  3: {
    num: "Bölüm 3", title: "Okul",
    sub: "Görülmek istemek, duyulmak istemekten daha zordur.",
    prev: "bolum2.html", next: "bolum4.html",
    content: `
<p class="drop-cap">Okul H-5 sınıfı. Koridorun en sonu. Kapı açık kaldığında bazen ana koridordaki sesleri duyabiliyorum — kahkahalar, loker sesleri, spor ayakkabıların gıcırtısı. Normal çocukların dünyası. Ben oraya ait değilim. En azından kimse öyle düşünmüyor.</p>
<p>Sınıfta sekiz öğrenci var. Hepsi farklı engellere sahip. Bazıları konuşabiliyor ama zihinsel gelişimleri yavaş. Bazıları hem konuşamıyor hem de nerede olduklarını bilmiyor. Ben ise konuşamıyorum ama her şeyi biliyorum. Bu fark çok önemli. Ve bu farkı kimse görmüyor.</p>
<p>Mr. D bugün ilginç bir şey denedi. Tahtaya basit matematik soruları yazdı. Üç artı beş. On dört eksi altı. Sınıfa baktı.</p>
<div class="thought">Ben. Ben biliyorum. Hepsinin cevabını biliyorum. Ve bunların çok ötesinde hesaplamalar yapabiliyorum. Ama el kaldıramıyorum. Sesim yok.</div>
<p>"Melody," dedi, "sen biliyor musun?" İki kez sol dizime vurdum. Evet. Küçük karton kartlar getirdi. Önüme koydu. "Sekizi göster bana." Elim titredi ama kartı ittirdim. Sekiz. Mr. D güldü. Gerçek bir gülümseme. "Muhteşem."</p>
<p class="scene-break">* * *</p>
<p>Okulun normale bakan koridorunda Rose adında bir kız var. Her gün aynı saatte loker açıyor. Sarı saçları var, her zaman gülüyor. Beni görünce tuhaf bakıyor — acımayla değil, merakla. Bu farklı.</p>
<p>Bugün yanımdan geçerken durdu. "Sen Melody misin? H-5'ten?" Başımı sağa eğdim. "Ben Rose. Yanındaki sınıftayım. Ee... nasılsın?" Başımı sağa eğdim yine. O güldü. "Tamam, anlıyorum. Yarın da görüşürüz belki."</p>
<p>Ve gitti. Bu küçücük konuşma — bu saniyeler — o gün aklımdan hiç çıkmadı. Birisinin bana "nasılsın" demesi. Bu kadar basit bir şey. Ve bu kadar büyük.</p>
<p>Mrs. V ile çalışırken aklımdaydı hâlâ. "Bugün bir arkadaş mı edindi gözlerim?" diye sordu. Başımı sağa eğdim. "Güzel. Çünkü sen arkadaş olmayı hak ediyorsun Melody. Her insan gibi."</p>`
  },

  4: {
    num: "Bölüm 4", title: "Teknoloji",
    sub: "Bir kelime, bazen bütün bir dünya kadar ağır olabilir.",
    prev: "bolum3.html", next: "bolum5.html",
    content: `
<p class="drop-cap">Annem bir şey getirdi eve. Büyük bir kutu. Dikkatli dikkatli taşıdı, masaya koydu. Bakışları hem heyecanlı hem temkinliydi. Babam yanında duruyordu — o da sessizce izliyordu.</p>
<p>"Melody," dedi annem, "sana bir şey aldık. Çok pahalıydı ama sen bunu hak ediyorsun."</p>
<p>Kutuyu açtılar. İçinde bir cihaz vardı. Dokunmatik ekranı olan, özel klavyeli, küçük bir bilgisayar gibi bir şey. Üzerinde simgeler vardı — mutlu yüz, üzgün yüz, ev, okul, aile, hayır, evet, teşekkür ederim... Ve alt kısımda boş bir alan. Kelimeler yazılabilecek alan.</p>
<div class="thought">Bu nedir? Bu bir sesli iletişim cihazı mı? Basmak yeterli mi? Ses çıkar mı?</div>
<p>Annem eğildi. "Dene," dedi fısıltıyla. Elim titredi. Parmağımı uzattım. Yavaşça... "TEŞEKKÜR EDERİM" simgesine bastım. Cihaz konuştu: <em>"Teşekkür ederim."</em></p>
<p>Annem ağladı. Baba öksürdü. Ben ise içimde bir şeylerin değiştiğini hissettim. Küçük bir çatlak. Bir kırık kapı açılıyor gibi. Işık sızıyor.</p>
<p class="scene-break">* * *</p>
<p>Cihazı okula götürdüm. Mr. D baktı cihaza. Sonra bana baktı. "Konuşabilecek misin şimdi?" Sesi yumuşaktı. Parmağımı uzattım: <em>"Evet."</em></p>
<p>Mr. D güldü. "O zaman sana bir şey soracağım. Hazır mısın?" <em>"Hazırım."</em> "Bugün nasıl hissediyorsun?"</p>
<p>Bir saniye durdum. Hafızamda döndü kelimeler. Bütün o haftalardır biriktirdiğim, söyleyemediğim şeyler. Ve bastım: <em>"Umutlu."</em></p>
<div class="thought">Umutlu. İlk kez bir kelime tam olarak içimdekini yansıttı. Dünyaya duyurabildiğim ilk gerçek kelime. Ve bu kelime: umutlu.</div>
<p>Mr. D başını eğdi. "Ben de."</p>
<p>Rose koridorda karşılaşınca durdu. Cihazı gördü. "Bu nedir?" Bastım: <em>"Konuşma cihazım. Sesim bu."</em> Rose bir süre sessiz kaldı. Sonra güldü. "Harika. Şimdi seni daha iyi tanıyabilirim." Ve bu cümle — o ana kadar duyduğum en güzel şeydi.</p>`
  },

  5: {
    num: "Bölüm 5", title: "Takım",
    sub: "Seçilmek, dahil edilmek — herkesin hakkıdır.",
    prev: "bolum4.html", next: "bolum6.html",
    content: `
<p class="drop-cap">Bilgi yarışması. Okulun yıllık Akademik Olimpiyat ekibine seçim yapılıyordu. Her sınıftan öğrenciler başvurabilirdi — hatta özel eğitim sınıfından da. Kural buydu. Ama kimse H-5'ten başvurmamıştı daha önce. Hiç kimse.</p>
<p>Mr. D bana baktı bir sabah. "Melody, sen bu yarışmaya katılmak ister misin?" Cihazıma bastım: <em>"Evet. Katılmak istiyorum."</em></p>
<p>Seçme sınavı olacaktı. Genel kültür, matematik, fen. Benim güçlü alanlarım. Yıllardır Mrs. V ile çalışmıştık, annem kitaplar getirmişti, kafamda bir kütüphane kurulmuştu.</p>
<p>Sınav günü annem beni erken hazırladı. Cihazımı kontrol ettik. Babam arabaya binmeden önce eğildi, alnımdan öptü. Bir şey söylemedi. Söylemesine gerek yoktu.</p>
<p class="scene-break">* * *</p>
<p>Sınav odası. Sorular sıralandıkça bir şey fark ettim: Cevapları biliyordum. Hepsini. Sadece bilmekle kalmıyordum — hızlı biliyordum. Diğerleri hâlâ düşünürken ben bastım bile.</p>
<div class="thought">Bu hissi tanımlamak zor. Güç gibi bir şey. Uzun süredir sıkıştırılmış, köşeye atılmış, görmezden gelinmiş bir gücün patlaması gibi.</div>
<p>Sonuçlar açıklandığında adım listede birinci sıradaydı.</p>
<p>Annem haberi duyunca elleriyle ağzını kapattı. Gözlerinden yaşlar aktı ama güldü aynı zamanda. Babam telefonda sadece "evet" dedi. Ama o "evet"in içinde ne kadar çok şey vardı.</p>
<p>Rose koridorda durdu. Gülümsedi. "Duydum. Tebrikler Melody." Bastım: <em>"Teşekkürler. Sen inanmıştın zaten."</em> "Elbette. Seni ilk gördüğümde hissettim — gözlerinde bir ateş vardı." Bir ateş. Evet. Yıllardır yanıyor o ateş. Sönmedi.</p>`
  },

  6: {
    num: "Bölüm 6", title: "Yarışma",
    sub: "Hazırlık bir rüya gibidir — ve rüyalar bazen gerçekleşir.",
    prev: "bolum5.html", next: "bolum7.html",
    content: `
<p class="drop-cap">Akademik Olimpiyat takımında beş kişiydik. Ben, Connor, Molly, Claire ve bir de Rodney. Connor zekiydi ve kibardi; Molly ise aksine her fırsatta bana tuhaf bakıyordu. Sanki ben orada olmamalıymışım gibi. Rodney ise umursamazdı — hem bana hem de diğerlerine eşit ilgisizlikle yaklaşıyordu.</p>
<p>Hazırlık toplantılarımız haftada iki kez yapılıyordu. Annem her seferinde beni bırakıp bekliyordu dışarıda. Cihazım ile konuşabiliyordum ama grup tartışmalarında çok yavaş kalıyordum — bir kelime yazarken diğerleri zaten üç cümle söylüyordu.</p>
<div class="thought">Adil değil bu. Düşüncelerimi onlar kadar hızlı dile getiremiyorum. Ama daha hızlı düşünüyorum. Paradoks bu. Ve bunu kimse anlamıyor.</div>
<p>Mr. D fark etti. Bir gün toplantı bittikten sonra yanıma geldi. "Melody, sana özel bir şey yapabiliriz. Sorular önceden seninle paylaşılabilir, cevaplarını hazırlayabilirsin." Bastım: <em>"Bu hile olur."</em></p>
<p>Mr. D baktı bana. Sonra güldü. "Hayır olmaz. Bu bir düzenleme. Herkes eşit fırsata sahip olsun diye yapılan bir düzenleme." Dur bir saniye. <em>"Tamam,"</em> bastım. <em>"Kabul ediyorum."</em></p>
<p class="scene-break">* * *</p>
<p>Mrs. V ile her akşam çalıştım. Coğrafya. Tarih. Fen bilimleri. Matematik. Mrs. V'nin evi bir nevi özel okula dönmüştü. Masanın üzerinde kartlar, kitaplar, renk renk kalemler.</p>
<p>"Bugün okyanus akıntılarını öğreneceğiz," dedi bir akşam. "Biliyor musun Golf Akıntısı nedir?" Cihazıma bastım: <em>"Kuzey Atlantik'teki sıcak su akıntısı. Avrupa'nın iklimini yumuşatıyor."</em></p>
<p>Mrs. V durdu. Baktı bana. Uzun uzun. Sonra yavaşça şunu dedi: "Melody, sen bir hazinesin. Ve dünya bunu henüz anlamadı. Ama anlayacak."</p>
<div class="thought">Hazine. Bu kelimeyi daha önce hiç kendim için kullanmamıştım. Belki de kullanmalıydım.</div>
<p>Yarışma tarihi yaklaşıyordu. Okulda afişler asıldı. "BÖLGE AKADEMİK OLİMPİYATI — CUMARTESİ." Koridordan geçerken o afişe baktım. Adım listede vardı. Beş isim arasında benim adım. Melody Brooks.</p>
<p>İçimde garip bir şey büyüdü. Korku değil — ya da sadece korku değil. Heyecan da vardı. İkisi birlikte, iç içe geçmiş.</p>
<p>Belki hazırdım. Belki değildim. Ama gidecektim.</p>`
  },

  7: {
    num: "Bölüm 7", title: "Uçuş",
    sub: "Bazı anlar, bir ömür boyu hatırlanır.",
    prev: "bolum6.html", next: "bolum8.html",
    content: `
<p class="drop-cap">Washington D.C. Takımın ulusal yarışmaya gitme hakkını kazandık. Molly'nin yüzünü görmeliydiniz — sevinçten değil, şaşkınlıktan. Benim de takımda olduğumu unutmuş gibiydi. Ama Mr. D'nin yüzü başkaydı. O biliyordu zaten.</p>
<p>Annem duyunca ellerini kavuşturdu ve yukarı baktı. Baba bir süre sessiz kaldı. Sonra telefonu kapattı, oturma odasına geldi, kollarıyla beni sardı. Hiçbir şey demedi. Hiçbir şeye gerek yoktu.</p>
<div class="thought">Hayatımda hiç uçakla uçmamıştım. Tekerlekli sandalyemle nasıl uçağa bineceğimi düşündüm. Uçak koltuğu, güvenlik bantları, insanların bakışları. Sonra kendimi durdurdum. Hayır. Önce uçmayı düşün. Sonrasını sonra düşün.</div>
<p>Uçak günü hava aydınlıktı. Havaalanında annem sürekli bir şeyler kontrol ediyordu — cihazın şarjı, seyahat belgelerim, ilaçlarım. Ben ise pencerelere bakıyordum. Dev uçaklar. Her biri başka bir yere uçuyor. Her biri başka bir hikaye taşıyor.</p>
<p>Güvenlik noktasında uzun süre bekledik. Görevli beni tuhaf baktı — sanki tekerlekli sandalye bir tehlikeymiş gibi. Annem kibarca her şeyi açıkladı. Ben de bastım: <em>"Merhaba. Ben Melody. Akademik yarışmaya gidiyorum."</em> Görevli donakaldı. Sonra güldü. "Başarılar Melody."</p>
<p class="scene-break">* * *</p>
<p>D.C. büyüktü. Anıtlar, müzeler, geniş caddeler. Otele yerleşirken Connor yanıma geldi. "Heyecanlı mısın?" diye sordu. Bastım: <em>"Hem heyecanlı hem korkuyorum."</em> Connor başını salladı. "Ben de. Hepimiz öyleyiz galiba."</p>
<p>O gece uyuyamadım. Tavana baktım. Kafamda sorular döndü. Tarihler, formüller, coğrafi bilgiler. Ama onların arasına başka şeyler de karıştı — Mrs. V'nin sesi, annemin gülüşü, Penny'nin "Melo-Melo!" diye koşması.</p>
<div class="thought">Burada olmak bile başlı başına bir cevap. Buraya kadar gelmek. Buraya ait olduğumu ispat etmek. Ama aynı zamanda şunu fark ettim: Ben zaten burdaydım. Her zaman. Sadece kimse görmüyordu.</div>
<p>Sabah geldi. Yarışma günü. Perdeni açtım. Güneş D.C.'nin üzerine alçaktan vuruyordu. Büyük binalar, eski taşlar, gençler koşuyor yollarda.</p>
<p>Ve ben, tekerlekli sandalyemde, pencerenin önünde, bir Makao gibi hissettim. Uçmaya hazır.</p>`
  },

  8: {
    num: "Bölüm 8", title: "Ses",
    sub: "Bir kız bir gün bütün dünyaya sesini duyurdu.",
    prev: "bolum7.html", next: "bolum9.html",
    content: `
<p class="drop-cap">Yarışma salonu büyüktü. Onlarca takım, yüzlerce öğrenci. Spotlar sahneyi aydınlatıyordu. Ben sahneye bakınca içimde bir şey gerildi — ama bu sefer iyi bir gerilmeydi. Bir yay gibi. Fırlatılmak üzere olan bir ok gibi.</p>
<p>Sunucu açıkladı kategorileri. Doğa bilimleri. Dünya tarihi. Matematik. Edebiyat. Hepsini bekliyordum. Hepsi hazırdım.</p>
<p>İlk tur başladı. Takımlar sırayla sorulara cevap verdi. Bizim takım iyi gidiyordu. Connor hızlıydı, Molly edebiyatta güçlüydü. Ama matematik sorusu geldiğinde herkes sustu. Karmaşık bir permütasyon problemi. Kimse hemen yanıt vermedi.</p>
<div class="thought">Cevabı biliyorum. Kafamda çoktan hesapladım. Ama cihazımı açıp yazmam zaman alıyor. Yetişebilir miyim?</div>
<p>Parmakları sürdüm ekrana. Hızlı. Çok hızlı. Bastım: <em>"Altı yüz kırk sekiz."</em> Cihaz sesi salonun sessizliğine yayıldı.</p>
<p>Sunucu durdu. Kağıdına baktı. Sonra mikrofona konuştu: "Doğru cevap. Melody Brooks, takımı adına."</p>
<p>Salondan bir alkış koptu. Connor bana döndü, yumruğunu kaldırdı. "Evet!" Molly bile şaşkınlıkla da olsa gülümsedi.</p>
<p class="scene-break">* * *</p>
<p>Yarışma bitti. Üçüncü olduk. Ama üçüncü olmanın önemi yoktu artık. O anın önemi vardı.</p>
<p>Annem koşarak geldi. Kucakladı beni. "Gördüm," dedi. "Her şeyi gördüm." Rose sonradan mesaj attı: "Haberlerde gördüm seni. Harikasın." Bastım: <em>"Teşekkür ederim. Hep inanmıştın."</em></p>
<p>Mrs. V'ye döndüğümde evin önünde bekliyordu. Kulağıma fısıldadı: "O Makao kuşu — sesi o kadar güçlüdür ki kilometrelerce öteden duyulur."</p>
<div class="thought">Benim de sesim var. Ekrandaki piksel büyüklüğünde bir ses. Ama gerçek. Ve artık duyuluyor.</div>
<p>O gece yattığımda kelimeler yine döndü kafamda. Ama bu sefer kelimeler çıkış yolu bulmuştu. Ve dünya... duymuştu.</p>`
  },

  9: {
    num: "Bölüm 9", title: "Yeni Yıl",
    sub: "Her yeni başlangıç bir öncekinin izini taşır.",
    prev: "bolum8.html", next: "bolum10.html",
    content: `
<p class="drop-cap">Yeni okul yılı başladı. Bu yıl farklıydı — hem ben değişmiştim hem de çevrem. Artık beni sadece "özel eğitim sınıfındaki kız" olarak görmüyorlardı. Bilgi yarışmasından sonra koridorda geçerken bazı öğrenciler gülümsüyordu. Küçük, bana özel gülümsemeler. Bunları fark ediyordum. Hepsini.</p>
<p>Cihazım artık vücudumun bir parçasıydı. Sabah kalktığımda önce cihazımı kontrol ediyordum — şarj tamam mı, kelime listem güncel mi. Annem yeni kelimeler eklemeye devam ediyordu. Geçen hafta "biyoluminesans" ve "epistemoloji" ekledik.</p>
<div class="thought">Epistemoloji. Bilginin ne olduğunu inceleyen felsefe dalı. Ben bunun tam ortasındayım. Bilgim var ama bunu aktarmanın sınırları var. Bu bir paradoks mu yoksa hayatın ta kendisi mi?</div>
<p>Mr. D bu yıl da öğretmenim. Bu haberi duyduğumda cihazımdan iki kelime bastım: <em>"Çok iyi."</em> O da güldü. "Ben de aynı şeyi düşündüm."</p>
<p>Sınıfa yeni bir öğrenci geldi. Adı Lucas. Sekiz yaşında, otizm spektrumunda. İlk gün kapıda dondu — adım atmak istemedi içeri. Herkes baktı. Ben de baktım. Sonra cihazımı açtım ve bastım: <em>"Lucas, merhaba. Ben Melody. Bu sınıf aslında fena değil."</em></p>
<p>Lucas duraksadı. Cihazın sesini duydu. Yavaşça döndü bana. Baktı. Sonra tek kelime söyledi: "Tamam."</p>
<p>Ve içeri girdi.</p>
<p class="scene-break">* * *</p>
<p>Rose ile artık düzenli konuşuyorduk. Her gün koridorda birkaç dakika. O konuşuyor, ben cihazla yanıt veriyordum. Bazen cevap vermeye gerek bile duymuyordum — dinlemek de bir diyalogdu.</p>
<p>"Anneme senden bahsettim," dedi bir gün Rose. "Yarışmada ne yaptığını anlattım." Durdu. "Annemi etkilemek zordur. Ağladı."</p>
<div class="thought">Birinin annesini ağlatmak. Bu büyük bir şey. Benim varlığım, benim sesim — bu kadar uzağa ulaşabiliyordu demek.</div>
<p>Bastım: <em>"Ona teşekkürlerimi ilet."</em></p>
<p>Rose güldü. "İletirim. Ama sen de bir gün gel anlat. Kendin."</p>
<p>Bir gün. Evet. Belki bir gün.</p>`
  },

  10: {
    num: "Bölüm 10", title: "Kütüphane",
    sub: "Kitaplar konuşamayanlara da konuşur.",
    prev: "bolum9.html", next: "bolum11.html",
    content: `
<p class="drop-cap">Okulun kütüphanesi benim için kutsal bir yerdi. Sessizdi. Kimse benden bir şey beklemiyordu. Rafların arasında tekerlekli sandalyemle gezebiliyordum. Kitapların sırtları bana bakıyordu — her biri bir davet gibiydi.</p>
<p>Kütüphaneci Mrs. Shannon beni tanırdı. Her hafta yeni kitaplar önerirdi. "Bu sefer kozmoloji," derdi. Ya da "Bu sefer Osmanlı tarihi." Ben hepsini okurdum. Hepsini hatırlardım.</p>
<p>Ama bugün kütüphanede farklı bir şey oldu. Bir kız yanıma geldi — daha önce görmediğim biri. Saçları siyah, gözlüklü, elinde kalın bir kitap tutuyordu. Bana baktı ama acımayla değil. Merakla.</p>
<p>"Sen Melody misin?" diye sordu fısıltıyla, kütüphanede bağırmamak için. Başımı sağa eğdim. "Ben Asha. Yeni taşındım. Matematik kulübüne katılmak istiyorum, Mr. D beni sana yönlendirdi."</p>
<div class="thought">Bana yönlendirdi. Bir öğrenci bana yönlendirildi. Sanki ben bir kaynak gibiyim. Bu hissi hiç bilmiyordum.</div>
<p>Cihazıma bastım: <em>"Matematik kulübü Çarşamba günleri. Ben de üyeyim. Gel."</em></p>
<p>Asha güldü — kıs kıs, kütüphane usulü. "Tamam. Teşekkürler."</p>
<p class="scene-break">* * *</p>
<p>O gece annem bana eski bir fotoğraf gösterdi. Ben daha bebekken, anneannem kucağında tutuyordu beni. Anneannem artık hayatta değil. Ama fotoğraftaki gülümsemesi...</p>
<p>"Anneanneni tanımak isterdim," dedim — cihazımdan. Annem durdu. Baktı bana. Gözlerinde o tanıdık, o karışık ifade belirdi.</p>
<p>"Tanırdı," dedi. "Ve seninle gurur duyardı."</p>
<div class="thought">Gurur. Bu kelime üzerimde farklı hissettirdi. Gurur duyulmayı hak ediyor muyum? Sanırım bu soruyu sormak bile bir cevap.</div>
<p>Mrs. V sonradan şunu söyledi: "Kitaplar bize başkalarının zihinlerinin içine girme fırsatı verir. Sen zaten başkalarının göremediği şeyleri görüyorsun Melody. Bu senin en büyük kitaplığın."</p>
<p>Kafamda döndü bu cümle. Uzun uzun.</p>`
  },

  11: {
    num: "Bölüm 11", title: "Anlaşmazlık",
    sub: "Adalet her zaman sessiz gelmez.",
    prev: "bolum10.html", next: "bolum12.html",
    content: `
<p class="drop-cap">Molly ile aramız hiç iyi olmamıştı. Ama bu sefer farklıydı. Matematik kulübü toplantısında Molly açıkça dedi: "Bu yarışma ciddi. Herkesin hızlı yanıt vermesi gerekiyor. Bazıları..." Durdu. Bakışları benim üzerimde kaldı. "...yavaş olursa takımı zorlar."</p>
<p>Sınıfta sessizlik çöktü. Asha bana baktı. Connor masaya baktı. Mr. D bir an hiçbir şey söylemedi.</p>
<p>Ben cihazımı açtım. Yazdım. Yavaş değil — hızlı yazdım, çünkü zaten hazırdım bu tür anlara. Bastım:</p>
<p><em>"Geçen yıl yarışmada en yüksek puanı kim aldı?"</em></p>
<p>Odadaki sessizlik biraz daha yoğunlaştı. Sonra Connor kıs kıs güldü. Asha da.</p>
<p>Molly kıpkırmızı oldu. Bir şey söylemedi.</p>
<p>Mr. D öne çıktı. "Melody haklı. Yarışmada performans ölçütümüz hızdır. Ve geçen yılki veriler ortada." Durakladı. "Devam edelim."</p>
<div class="thought">Bu benim için büyük bir şeydi. Molly'nin yüzündeki o ifadeyi — şaşkınlığı, utancı — ben görmüştüm. Ve bir şey için özür dilemek zorunda kalmamıştım. Sadece gerçeği söylemiştim. Bu yeterliydi.</div>
<p class="scene-break">* * *</p>
<p>Eve döndüğümde Penny bana koştu. "Melo-Melo! Bugün okul nasıldı?" diye sordu üç yaşındaki sesiyle. Cihazıma bastım: <em>"İyi geçti. Biraz mücadele ettim."</em></p>
<p>Penny bunu tam anlayamadı elbette. Ama başını saladı, ciddi ciddi. "Mücadele iyidir," dedi. "Anne öyle diyor."</p>
<p>Güldüm — içimden, sessizce. Annem ne güzel şeyler öğretmiş Penny'ye.</p>
<p>O gece yatmadan önce bir şeyi fark ettim: Artık kendimi savunabiliyordum. Sadece kelimelerle, sadece gerçeklerle. Ve bu yeterliydi. Bu, dünyayı değiştirmeye yeterliydi — en azından benim küçük dünyamı.</p>`
  },

  12: {
    num: "Bölüm 12", title: "Konser",
    sub: "Müzik, sözcüklerin yetersiz kaldığı yerde başlar.",
    prev: "bolum11.html", next: "bolum13.html",
    content: `
<p class="drop-cap">Okulun yıllık konserine bu yıl ben de davet edilmiştim. Sahne arkasında oturarak izleyecektim — bu benim için büyük bir şeydi. Normalde bu tür etkinliklere katılmazdım. Kalabalık, gürültü, insanların bakışları. Ama bu kez farklıydı.</p>
<p>Rose müzik kulübündeydi ve keman çalıyordu. "Geliyor musun?" diye sormuştu bir hafta önce. Cihazımdan bastım: <em>"Evet."</em> O gülümsemişti. "Sevinç."</p>
<p>Konserde salonun ışıkları söndü. Sahne aydınlandı. Rose sahneye çıktığında — beyaz elbisesi, kemeri omzunda — içimde bir şey gevşedi. Müzik başladığında sözcükler durdu. Sadece sesler vardı. Yükselen, alçalan, titreyerek giden sesler.</p>
<div class="thought">Müzik benim de dilim miydi? Belki. Ben konuşamıyordum ama ses duyabiliyordum. Ve bu sesler içimde bir yerlere dokunuyordu — cihazımın kelimelerinin ulaşamadığı yerlere.</div>
<p>Konser bittiğinde Rose yanıma koştu. "Nasıldı?" Cihazımı açtım. Uzun bir şey yazmak istedim ama kelimeler yetersiz geldi. Sonunda sadece bastım: <em>"Güzeldi. Çok güzeldi."</em></p>
<p>Rose güldü. "Bu yeterli."</p>
<p class="scene-break">* * *</p>
<p>Mrs. V müzik hakkında bir şey söylemişti bir keresinde: "Müzik evrensel bir dildir Melody. Ama sen zaten evrensel bir dilde konuşuyorsun — gözlerinle, ellerin hareketiyle, varlığınla." O an anlamıştım. Dil sadece seslerden ibaret değildi.</p>
<p>O gece annem saç tarıyordu. "Konser nasıldı?" diye sordu. Cihazımdan bastım: <em>"Rose harikaydı. Ben de oradaydım. Bu benim için yeterliydi."</em></p>
<p>Annem durdu. Saçımı okşadı. "Sen her yerde olmalısın Melody. Her yerde."</p>
<p>Her yerde. Bu kelimeler gece boyunca kafamda döndü. Belki haklıydı.</p>`
  },

  13: {
    num: "Bölüm 13", title: "Kayıp",
    sub: "Bazı şeyler sözle anlatılmaz, sessizlikle taşınır.",
    prev: "bolum12.html", next: "bolum14.html",
    content: `
<p class="drop-cap">Mrs. V hasta oldu. Önce hafif bir öksürük, sonra doktor ziyaretleri, sonra hastane. Annem bana söyledi sakin bir sesle, ama gözleri başka türlü konuşuyordu. Ciddi miydi? Ne kadar ciddi?</p>
<p>Cihazımı açtım. Bastım: <em>"Mrs. V'yi görmek istiyorum."</em> Annem başını salladı. "Göreceksin. Ama biraz beklemek gerekiyor."</p>
<div class="thought">Beklemek. Bu kelimeden nefret ediyorum. Hayatım zaten beklemekten ibaret gibi hissettiriyor bazen. Ama bu sefer farklı bir bekleyiş. Bu sefer korku var içinde.</div>
<p>Bir hafta geçti. Sonunda hastaneye gidebildik. Mrs. V yatakta yatıyordu — ince görünüyordu, gözaltları morlu. Ama gülümsedi. Beni görünce gerçekten gülümsedi.</p>
<p>"Benim Makao'm," dedi. Sesi kısık ama tanıdıktı. Elini uzattı. Tutamadım sıkıca ama elimi yanına koydum. Yeterliydi.</p>
<p>Bastım: <em>"Çabuk iyi ol. Okyanus akıntıları dersi yarım kaldı."</em></p>
<p>Mrs. V güldü — o güzel, derin güldüşüyle. "Bitireceğiz. Söz."</p>
<p class="scene-break">* * *</p>
<p>Hastaneden çıktığımda gökyüzü griydi. Arabada annem hiç konuşmadı. Baba direksiyon başındaydı, gözleri yolda. Penny uyumuştu koltukta, küçük başı yana düşmüş.</p>
<p>Bir şey hissettim — tarifsiz, ağır bir şey. Sevdiğim birileri kaybolabilirdi. Bu gerçekti. Kaçınılmazdı. Ve buna karşı söyleyecek bir kelimem yoktu.</p>
<div class="thought">Bazen sessizlik en dürüst cevaptır. Kelimeler yetmez. Cihaz yetmez. Sadece o anın ağırlığını taşırsın. Ben de taşıdım. Sessizce.</div>
<p>O gece uyumadan önce Mrs. V'nin her dediğini hatırladım. Sabrı. Makao'yu. "Sen bir hazinesin" cümlesini. Ve onun sesini — o sıcak, gülümseyen sesini.</p>
<p>Umarım o ses uzun süre daha benimle kalır.</p>`
  },

  14: {
    num: "Bölüm 14", title: "İlkbahar",
    sub: "Yeniden açmak — hem çiçekler için hem insanlar için.",
    prev: "bolum13.html", next: "bolum15.html",
    content: `
<p class="drop-cap">Mrs. V taburcu oldu. Doktorlar "iyileşiyor" dediler. Annem telefonu kapatır kapatmaz bana sarıldı — hiç beklemedim, ama sarıldım da ben de. Elimle sırtına vurdum. Benim gülüşüm buydu.</p>
<p>İlk ziyaret günü Mrs. V kapıda bekliyordu — saçları taranmış, üzerinde o tanıdık lacivert hirka. Sanki hiç hasta olmamıştı gibi duruyordu. Ama gözleri daha derin görünüyordu. Geçirdiği şeyler izini bırakmıştı.</p>
<p>"Okyanus akıntıları," dedi, "Golf Akıntısı'nın ikinci kısmından devam edecektik."</p>
<p>Bastım: <em>"Hazırım."</em></p>
<p>Ve devam ettik. Sanki hiç durulmamıştı gibi. Ama aslında durulmuştu — ve bu duruş ikimizi de değiştirmişti. Ben daha az şeyi sorgudan geçiriyordum şimdi. Bazı şeyleri olduğu gibi kabul etmeyi öğreniyordum.</p>
<p class="scene-break">* * *</p>
<p>Okul bahçesinde ilkbahar çiçekleri açmıştı. Rose ve ben öğle aralarında bahçeye çıkıyorduk artık. Ben güneşin yüzüme vurmasını seviyordum — sıcaklığını, ışığını.</p>
<p>"Büyüyünce ne olmak istiyorsun?" diye sordu Rose bir gün. Doğrudan bir soru. Çoğu insan bunu bana sormuyordu — sanki geleceğim olmadığını varsayıyorlardı gibi.</p>
<p>Cihazımı açtım. Düşündüm. Bastım: <em>"Bilim insanı. Ya da yazar. Ya da ikisi birden."</em></p>
<p>Rose güldü. "Neden ikisi birden olmasın ki."</p>
<div class="thought">Neden olmasın? Kafamda bilgi var. Kafamda kelimeler var. Belki bir gün onları dünyaya dökerim. Bir makale. Bir kitap. Bir şey. Bir iz.</div>
<p>Bahçede oturmuş, güneşin altında, Rose'un yanında, ilkbahar rüzgarını hissederken şunu düşündüm: Hayat küçük anlardan oluşuyor. Bu an — bu tam bu an — güzeldi. Ve ben buradaydım. Gerçekten buradaydım.</p>`
  },

  16: {
    num: "Bölüm 16", title: "Ulusal Hazırlık",
    sub: "Büyük sahneler büyük hazırlık ister.",
    prev: "bolum15.html", next: "bolum17.html",
    content: `
<p class="drop-cap">Ulusal Akademik Olimpiyat için seçildik. Tüm bölgeden sadece beş takım geçiyordu; biz geçtik. Haber okula yayıldığında koridorlarda tuhaf bir ses çıktı — bir karışım. Alkış, fısıltı, şaşkınlık.</p>
<p>Asha yanıma koştu. "Gittik!" dedi, gözleri parlaklıkla doluydu. Connor yumruğunu kaldırdı. Molly ise yüzünü döndürdü — ama tam dönmeden önce gördüm: hafif bir gülümseme. Sadece bir an. Ama vardı.</p>
<div class="thought">Belki Molly de değişiyor. Yavaş yavaş. İnsanlar bazen beklenmedik anlarda sürpriz yaparlar.</div>
<p>Hazırlık yoğunlaştı. Haftada dört gün toplanıyorduk. Mr. D bize bölge bazında çıkmış soruları çözdürüyordu. Ben hepsini cihazımdan yanıtlıyordum — bazen diğerlerinden önce, bazen eş zamanlı. Asha bir gün şunu fark etti: "Melody, sen soruyu yarım okumadan cevaplıyorsun." Bastım: <em>"Kalan yarısını zaten biliyorum."</em> Sessizlik. Sonra herkes güldü.</p>
<p>Annem geceleri beni çalıştırmaya devam ediyordu. Ama bu sefer farklıydı — artık tekrar değil, derinleşme. "Şimdi astronomiyi anlat bana," diyordu. Ve ben anlatıyordum. Cihazımdan, kelime kelime.</p>
<p class="scene-break">* * *</p>
<p>Bir akşam babam masaya oturdu. Normalde akşamları yorgun olurdu, ama o gece farklıydı. "Melody," dedi, "sana bir şey söyleyeyim." Bekledi. "Sen benim en büyük gurur kaynağımsın. Her sabah işe giderken bunu düşünüyorum."</p>
<div class="thought">Babam bunu daha önce hiç bu kadar açık söylememişti. Babalar bazen kelimelerini saklıyor. Ama bazen de açıyorlar o kasayı — ve içindekiler döküldüğünde her şeyi kaplıyor.</div>
<p>Bastım: <em>"Ben de senden gurur duyuyorum baba."</em> O güldü — sessizce, içe doğru. Ama güldü.</p>`
  },

  17: {
    num: "Bölüm 17", title: "Annenin Korkusu",
    sub: "Korku sevginin başka bir adıdır.",
    prev: "bolum16.html", next: "bolum18.html",
    content: `
<p class="drop-cap">Annem beni seyrediyordu. Fark ettim — son birkaç haftadır her hareketimi izliyordu. Yemek yerken, cihazımla yazarken, yatmadan önce. Gözlerinde bir şey vardı. Endişe değil tam olarak. Daha derin bir şey.</p>
<p>Bir gece odama geldi. Işığı açmadı. Yatağımın kenarına oturdu. Karanlıkta konuştu.</p>
<p>"Melody, ulusal yarışmaya gittiğinde... orada sana nasıl davranacaklar, bilmiyorum. İnsanlar bazen..." Durdu. "Bazen düşündüğümden farklı davranabiliyorlar."</p>
<div class="thought">Annem korkuyor. Benim için değil — beni incitecekler diye korkuyor. Başkalarından korkuyor. Bu farklı bir korku. Ve bu korkuyu taşıması onu yoruyor olmalı.</div>
<p>Cihazımı açtım, karanlıkta parlamasına izin verdim. Bastım: <em>"Anne. Ben hazırım. Hem sorulara hem insanlara."</em></p>
<p>Annem bir süre baktı ekrana. Sonra elimi tuttu. "Biliyorum," dedi. "Ama annelik bu. Hazır olsan da korkmak."</p>
<p class="scene-break">* * *</p>
<p>Mrs. V bu konuşmayı duyduğunda güldü. "Senin annen aslan gibi bir kadın. Ama aslanlar da korkuyor bazen — yavruları için." Bastım: <em>"Yavru aslan olduğum için mi korkuyor?"</em> Mrs. V güldü. "Hayır. Çünkü sen zaten büyük bir aslan oldun. O bunu görüyor. Ve bu onu hem gururlandırıyor hem ürkütuyor."</p>
<p>Büyük aslan. Bu ifade kafamda kaldı. Belki öyleydim. Belki değildim. Ama öyle hissettirmek güzeldi.</p>
<p>Geceleri artık farklı düşünüyordum. Yarışmayı değil — yarışmadan sonrasını düşünüyordum. Ne olursa olsun, kazansak da kaybetsek de, bir şey değişmişti zaten. Ben değişmiştim. Ve bu değişikliği kimse geri alamazdı.</p>`
  },

  18: {
    num: "Bölüm 18", title: "Penny'nin Dünyası",
    sub: "Küçükler bazen en büyük dersleri öğretir.",
    prev: "bolum17.html", next: "bolum19.html",
    content: `
<p class="drop-cap">Penny artık üç yaşındaydı. Konuşmayı çok seviyordu — her şeyi soruyordu. "Bu neden böyle?" "Bu ne?" "Neden gökyüzü mavi?" Annem yoruluyordu bazen. Ama ben hiç yorulmuyordum. Her sorusu benim için bir hazineydi.</p>
<p>Bir gün yanıma geldi, küçük elini koluma koydu. "Melo-Melo, sen neden o kutucuktan konuşuyorsun?" Cihazımı kastetti. Bastım: <em>"Çünkü sesim farklı çalışıyor. Bu kutucuk benim sesim."</em></p>
<p>Penny baktı. Düşündü. Küçük kaşları çatıldı. Sonra sordu: "Acıyor mu?"</p>
<div class="thought">Acıyor mu? Hiç bu şekilde sormamışlardı bana. Çoğu insan "nasılsın" sorar. Ama Penny doğrudan oraya gitti — acıya. Üç yaşında bir çocuk, en öz soruyu sordu.</div>
<p>Bastım: <em>"Bazen. Ama seninle olunca acımıyor."</em> Penny büyük bir gülümsemeyle baktı. Sonra cihaza sarıldı — tuhaf, sevimli bir sarılış. Sanki cihaz bir arkadaşmış gibi. Güldüm içimden.</p>
<p class="scene-break">* * *</p>
<p>O akşam Penny anneye şunu söyledi: "Anne, Melo-Melo çok zeki. O kutucukla her şeyi biliyor." Annem gülümsedi. "Biliyorum tatlım." "Ben de öyle olmak istiyorum." "Sen de öylesin." "Ama benim kutucuğum yok." Annem eğildi. "Senin kutucuğun burası," dedi, Penny'nin başına dokundu. "Herkesinkisi."</p>
<p>Penny bunu duyunca ciddi ciddi başını salladı. Sonra koştu odaya, kendi küçük oyuncak telefonunu getirdi, düğmelere basmaya başladı. "Ben de şimdi konuşuyorum!" diye bağırdı.</p>
<p>Annem ağlamak üzereydi — mutluluktan.</p>
<p>Ben de.</p>`
  },

  19: {
    num: "Bölüm 19", title: "Uçuş Günü",
    sub: "Kanatlar her zaman görünmez.",
    prev: "bolum18.html", next: "bolum20.html",
    content: `
<p class="drop-cap">Sabah beş buçukta kalktım. Annem zaten uyanıktı — sanki hiç uyumamış gibiydi. Bavulum hazırdı. Cihazım şarjlıydı. Yedek şarj aleti çantanın iç cebindeydi. Her şey yerli yerindeydi. Ama içim öyle değildi.</p>
<div class="thought">Heyecan ile korku aynı hissettiriyor bazen. İkisi de kalp çarptırıyor. İkisi de nefes aldırıyor derinden. Farkları şu: korku seni geri çekiyor, heyecan ise ileriye fırlatıyor.</div>
<p>Havaalanında takım bir aradaydı. Connor ve ailesi, Molly ve annesi, Asha ve babası, Rodney tek başına. Mr. D hepsini saydı. Sonra bana baktı. "Hazır mısın Melody?" Bastım: <em>"Hazırım."</em></p>
<p>Güvenlik kontrolünden geçerken bu kez görevli beni durdurdu ve kibarca eğildi. "Adın ne?" diye sordu. Bastım: <em>"Melody Brooks. Ulusal Akademik Olimpiyat'a gidiyorum."</em> Görevli doğruldu. Gülümsedi. "Başarılar Melody Brooks."</p>
<p>Uçakta pencere kenarına yerleştim. Kalkış sırasında şehir küçüldü — binalar, yollar, parklar, evler. Bir yerinde bizim evimiz vardı. Penny orada uyuyordu hâlâ. Mrs. V sabah kahvesini içiyordu belki. Babam vardiyaya gitmişti.</p>
<p class="scene-break">* * *</p>
<p>Bulutların içine girdiğimizde bir şey hissettim. Yükseklik. Ama sadece fiziksel değil. Bir şeylerin üstünde olmak gibi. Endişelerin, şüphelerin, "yapabilir misin" sorularının üstünde.</p>
<p>Cihazımı açtım. Yazdım. Bastım — kimseye değil, sadece kendime: <em>"Makao gibi uçuyorum."</em></p>
<p>Ve güldüm. Gerçekten güldüm.</p>`
  },

  20: {
    num: "Bölüm 20", title: "Büyük Sahne",
    sub: "Işıklar yanar — ve sen oradasın.",
    prev: "bolum19.html", next: "bolum21.html",
    content: `
<p class="drop-cap">Ulusal yarışma salonu bölge salonundan çok daha büyüktü. Tavan yüksek, ışıklar güçlüydü. Otuz iki takım. Onlarca öğrenci. Her birinin gözlerinde aynı karışım — heyecan ve korku.</p>
<p>Kayıt masasında görevli listeye baktı. "Eastview Orta Okulu..." Parmağını kaydırdı. "Evet. Beş kişi." Sonra bana baktı — tekerlekli sandalye, cihaz. "Özel düzenleme talebi var mıydı?" Mr. D öne çıktı. "Evet. Önceden bildirildi." Görevli başını salladı. "Her şey hazır."</p>
<div class="thought">Her şey hazır. Bu kelimeler benim için büyük anlam taşıdı. Benim için düşünülmüştü. Benim için hazırlanmıştı. Görünmezdim — ama görülüyordum.</div>
<p>İlk tur: Doğa bilimleri. Sorular zordu ama tanıdıktı. Güneş sisteminin en büyük uydusu, fotosentezin denklemleri, DNA'nın yapısı. Bastım, bastım, bastım. Her cevap doğruydu.</p>
<p>İkinci tur: Tarih. Dünya savaşları, devrimler, antlaşmalar. Yine bastım. Hızlıydım. Mrs. V'nin öğrettikleri kafamda devreye girdi — sanki bir kütüphanenin raflarından kitap çekip açıyordum.</p>
<p class="scene-break">* * *</p>
<p>Öğle arasında Connor geldi yanıma. "Melody, sen inanılmazsın." Bastım: <em>"Sen de hızlısın."</em> "Ama sen farklısın. Sanki hepsini zaten biliyorsun." Bastım: <em>"Biliyorum. Uzun zamandır biriktiriyorum."</em></p>
<p>Connor baktı. Anladı. Başını salladı. "Güzel bir kütüphanen var demek." Bastım: <em>"Kafamın içinde. Kimse alamaz."</em></p>
<p>O gülümsedi. "Kimse alamaz."</p>`
  },

  21: {
    num: "Bölüm 21", title: "Hayal Kırıklığı",
    sub: "Yıkılmak ile yenilmek aynı şey değildir.",
    prev: "bolum20.html", next: "bolum22.html",
    content: `
<p class="drop-cap">Son tur. Final sorusu. Her şey bu anda toplanmıştı. Puan durumuna göre birinci ile ikinci arasında tek soru fark vardı. O soru bize geldi.</p>
<p>Sunucu yavaşça okudu: "Hangi Rus bilim insanı periyodik tabloyu oluşturmuştur, ve kaç yılında?" Kesin biliyordum. Dmitri Mendeleev, 1869. Hızlı yazmam gerekiyordu. Parmaklarım ekrana değdi —</p>
<p>Ve cihaz dondu.</p>
<div class="thought">Hayır. Hayır hayır hayır. Şarj tamam. Bağlantı tamam. Ama ekran donmuş. Parmağım yanıt vermiyor. Yanıt vermiyor.</div>
<p>Otuz saniye geçti. Yanıt gelmeyince sunucu bir sonraki takıma geçti. Onlar doğru yanıtladı. Biz ikinci olduk.</p>
<p>Cihaz bir dakika sonra kendiliğinden düzeldi. Geç kalmıştı.</p>
<p>Salon ödül törenine geçti. Ben sahnede otururken içimde ağır bir şey vardı. Sadece ikinci olmak için değil. Çünkü kelimelerim oradaydı — tam hazırdı — ama çıkamamıştı. Bu çok tanıdık bir his. Bu benim hayatımın özeti gibiydi.</p>
<p class="scene-break">* * *</p>
<p>Annem koşarak geldi. "Melody—" Cihazımı açtım. Uzun süre baktım ekrana. Sonra bastım: <em>"Cihaz dondu. Cevabı biliyordum."</em> Annemin yüzü gerildi. Kızdı — ama bana değil. Duruma. "Bu adil değil."</p>
<p>Mr. D yanıma geldi. "Melody, sen bugün inanılmaz bir şey yaptın. Teknik bir arıza bir insanı ölçemez." Bastım: <em>"Biliyorum. Ama acıtıyor."</em> "Evet," dedi. "Acıtıyor. Ve acıması gerekiyor. Çünkü önemsiyorsun."</p>
<div class="thought">Acı, önemsemenin kanıtıydı. Bu fikir içimde bir şeyleri yumuşattı. Tamamen geçmedi. Ama yumuşadı.</div>`
  },

  22: {
    num: "Bölüm 22", title: "Gece Konuşması",
    sub: "Karanlık, dürüst konuşmaların evidir.",
    prev: "bolum21.html", next: "bolum23.html",
    content: `
<p class="drop-cap">Otelde o gece uyuyamadım. Tavana baktım. Perdelerden şehir ışıkları sızıyordu. Annem yanımda nefes alıp veriyordu — uyumuştu sonunda. Babam evdeydi, Penny ile.</p>
<p>Cihazımı açtım. Ekran parladı. Ses çıkmayacak şekilde yazdım — sadece kendim için, sadece bu gece için:</p>
<p><em>"Mendeleev, 1869. Biliyordum. Hep biliyorum. Ama bazen yeterli olmuyor. Bazen beden engel oluyor. Bazen teknoloji engel oluyor. Bazen insanlar engel oluyor. Ne zaman yetecek sadece zihin?"</em></p>
<p>Durdum. Sonra devam ettim:</p>
<p><em>"Ama yine de buradayım. Ulusal yarışmadayım. Otelim var, takımım var, cihazım var. Bir yıl önce bu bir rüyaydı. Şimdi gerçek. Belki yetmek bu."</em></p>
<div class="thought">Yetmek. Yeterli olmak. Bu kelimeler üzerime yapıştı. Ben hep daha fazlasını istedim — daha fazla kelime, daha fazla hız, daha fazla erişim. Ama belki yeterli olmak zaten büyük bir şeydi.</div>
<p class="scene-break">* * *</p>
<p>Sabah annem uyandığında benim hâlâ uyanık olduğumu gördü. "Uyumadın mı?" Bastım: <em>"Düşündüm."</em> "Ne düşündün?" <em>"Mendeleev hakkında değil."</em> Annem güldü — yorgun, şefkatli bir gülüşle. "İyi ki varsın," dedi. Bastım: <em>"Ben de iyi ki varım."</em></p>
<p>Ve bunu gerçekten hissederek yazdım.</p>`
  },

  23: {
    num: "Bölüm 23", title: "Tanınma",
    sub: "Bazen en büyük ödül, görülmektir.",
    prev: "bolum22.html", next: "bolum24.html",
    content: `
<p class="drop-cap">Kapanış töreninde beklenmedik bir şey oldu. Sunucu kürsüye çıktı ve şunu söyledi: "Bu yıl jürimiz, teknik bir engele rağmen olağanüstü performans sergileyen bir yarışmacıyı özel olarak onurlandırmak istiyor."</p>
<p>Durdum. Annem kolumu sıktı.</p>
<p>"Eastview Orta Okulu'ndan, konuşma yardımcı cihazı kullanan ve yarışma boyunca en yüksek kişisel isabet oranına sahip olan — Melody Brooks."</p>
<p>Salon alkışladı. Gerçek bir alkış. Güçlü, uzun, spontane.</p>
<div class="thought">Benim adımı söylediler. Mikrofona, salona, herkese. Ve herkes alkışladı. Ben hiçbir şey yapmadım — sadece bildiklerimi bastım. Ama bu bile yeterliydi. Bu bile görülmeye değerdi.</div>
<p>Mr. D beni sahneye götürdü. Küçük bir plaket verildi. Üzerinde yazıyordu: <em>"Mükemmellik Ödülü — Melody Brooks."</em> Tutamadım sıkıca. Ama tuttuğumu hissettim.</p>
<p>Salona döndüğümde Connor, Asha, hatta Molly bile ayaktaydı. Molly gözlerimi kaçırmadı bu kez. Doğrudan baktı. Ve başını saladı.</p>
<p>Bu, her türlü özürden daha değerliydi.</p>
<p class="scene-break">* * *</p>
<p>Uçakta eve dönerken anneme bastım: <em>"Bugün iyi bir gündü."</em> Annem güldü. "İyi bir gün mü? Harika bir gündü." Bastım: <em>"İkisi de."</em></p>`
  },

  24: {
    num: "Bölüm 24", title: "Eve Dönüş",
    sub: "Ev, nereye gidersen git, seni bekler.",
    prev: "bolum23.html", next: "bolum25.html",
    content: `
<p class="drop-cap">Havaalanında baba ve Penny bekliyordu. Penny koşarak geldi — küçük ayakları yerde çarptı. "Melo-Melo! Melo-Melo döndü!" diye bağırdı. Baba onu kaptı, ikimizi birden sardı kollarıyla.</p>
<p>Arabada Penny elimi tuttu tüm yol boyunca. Konuşmadı — bu onun için çok nadir bir şeydi. Sadece tuttu. Sanki "burada" demek istiyordu. "Seninleyim."</p>
<div class="thought">Eve dönmek garip hissettiriyor bazen. Gittiğinde bir şeyler bırakırsın, döndüğünde buluyorsun onları. Ama sen değişmişsindir. Yani aynı ev, farklı sen. Bu ikisi nasıl uyuşuyor? Belki uyuşmak zorunda değil. Belki sadece bir arada yaşarlar.</div>
<p>Mrs. V kapıda duruyordu. Elinde bir kek. Çikolatalı. En sevdiğim. "Birinciler kek yer, ikinciler de kek yer," dedi. "Çünkü gitmeyi başarmak zaten kazanmaktır."</p>
<p>Masaya oturduk. Beşimiz. Annem, babam, Penny, Mrs. V ve ben. Kimse büyük şeyler söylemedi. Sadece yedik. Sadece güldük. Sadece birlikte olduk.</p>
<p class="scene-break">* * *</p>
<p>O gece yatmadan önce plaketimi masama koydum. Işık altında parlıyordu. <em>"Mükemmellik Ödülü — Melody Brooks."</em> Uzun süre baktım. Sonra cihazımı aldım ve yazdım — bastım değil, sadece yazdım, sadece kendim için:</p>
<p><em>"Bu ödül benim değil sadece. Mrs. V'nin, annemin, babamın, Penny'nin, Mr. D'nin, Rose'un, Connor'ın ve hatta biraz Molly'nin de. Çünkü sesim onların içinde büyüdü."</em></p>
<p>Cihazı kapattım. Gözlerimi kapattım. Ve ilk kez çok uzun zamandır — gerçekten huzurla uyudum.</p>`
  },

  25: {
    num: "Bölüm 25", title: "Okul Gazetesi",
    sub: "Kelimeler, basıldığında ölümsüz olur.",
    prev: "bolum24.html", next: "bolum26.html",
    content: `
<p class="drop-cap">Okul gazetesi editörü geldi bir sabah. Adı Tyler. Uzun boylu, her zaman kalemini kulağına sıkıştırmış biri. "Melody," dedi, "senin hikayeni yazmak istiyorum. Yarışmayı, cihazını, her şeyi." Bastım: <em>"Neden?"</em> "Çünkü öğrenciler bilmeli. Çünkü sen bu okulun en ilginç hikayesisin."</em></p>
<div class="thought">İlginç hikaye. Bir zamanlar bu kelimeler beni rahatsız ederdi. "İlginç" bazen "garip" demekti. Ama Tyler'ın gözlerinde farklı bir şey gördüm. Gerçek merak. Onu itip atmak istemedim.</div>
<p>Bastım: <em>"Tamam. Ama ben kendi kelimelerimle anlatacağım. Sen sadece yazacaksın."</em> Tyler güldü. "Zaten başka türlü olmaz."</p>
<p>Üç oturum yaptık. Ben cihazımdan anlattım — başından beri. Beyin felci. H-5. Mrs. V. Cihaz. Yarışmalar. Tyler not aldı. Soru sordu. Dinledi. Gerçekten dinledi.</p>
<p>Gazete çıktığında manşet şuydu: <em>"Sesini Bulan Kız: Melody Brooks'un Hikayesi."</em></p>
<p class="scene-break">* * *</p>
<p>Gazete yayımlanan gün koridorda farklı şeyler oldu. Öğrenciler bana bakıyordu — ama bu sefer bakış farklıydı. Tuhaf değil. Tanıyan bir bakış. Rose koştu yanıma. "Okudum! Her kelimesini!" Bastım: <em>"Nasıldı?"</em> "Ağladım." Durdu. "İyi ağlama."</p>
<p>Lucas sınıfta makaleyi eline almıştı. Okuyamıyordu — henüz — ama resimlere bakıyordu. Benim fotoğrafım vardı içinde, cihazımla. Lucas işaret etti fotoğrafa, sonra bana baktı. Başını saladı. Bastım: <em>"Evet. O benim."</em> Lucas tekrar başını saladı. Ciddiydi. Kabul etti beni — tam olarak.</p>
<p>Bu benim için gazetedeki en büyük ödüldü.</p>`
  },

  26: {
    num: "Bölüm 26", title: "Mrs. V'nin Hediyesi",
    sub: "En değerli hediyeler sarılıp paketlenmez.",
    prev: "bolum25.html", next: "bolum27.html",
    content: `
<p class="drop-cap">Mrs. V bir gün elinde küçük bir kutu tutarak geldi. Kırmızı kurdeleli, el yapımı ambalajlı. "Sana bir şey yaptım," dedi. "Uzun süredir yapıyordum. Şimdi hazır."</p>
<p>Kutuyu açtım — ya da annem açtı, ben baktım. İçinde bir defter vardı. El yazısıyla dolu sayfalar. Her sayfanın üstünde bir tarih. İlk sayfa: Ben iki yaşındayken.</p>
<p>"Her öğrendiğin kelimeyi, her anladığın kavramı, her tepkini yazdım," dedi Mrs. V. "Yıllarca. Çünkü biri kaydetmeli diye düşündüm. Senin sesin kaybolmamalıydı."</p>
<div class="thought">Yıllarca. Bu kadın yıllarca beni yazmıştı. Bir deftere. Sayfa sayfa. Ben konuşamazken o yazmıştı. Ben anlatamayken o kaydetmişti. Bu dünyada benim gibi sevilen kaç kişi vardı ki?</div>
<p>Bastım: <em>"Bu... bu çok büyük bir şey."</em> Mrs. V gözlerini kısdı. "Sen büyük bir şeysin. Bu sadece kanıt."</p>
<p>Annemi baktım. Annemi ağlıyordu. Babam odanın kapısında duruyordu — ne zaman girdiğini fark etmemişim. O da ağlıyordu. Kimse özür dilemedi. Kimse saklamaya çalışmadı.</p>
<p class="scene-break">* * *</p>
<p>O gece defteri saatlerce inceledim. Annem her sayfayı okudu bana. İlk söylediğim kelimeler — aslında kelimeler değil, sesler — kaydedilmişti. İlk fark ettiğim renkler. İlk kez güldüğüm an. İlk kez ağladığım an.</p>
<p>Ben her zaman oradaydım. Kayıtlardaydım. Yok olmamıştım. Silinmemiştim.</p>
<p>Ve bu defter, bütün cihazlardan, bütün teknolojiden daha güçlü bir şeydi. Çünkü içinde sadece kelimeler değil — sevgi vardı.</p>`
  },

  27: {
    num: "Bölüm 27", title: "Melody",
    sub: "Her hikaye bir isimle başlar. Ve o isim her şeyi taşır.",
    prev: "bolum26.html", next: null,
    content: `
<p class="drop-cap">Adım Melody. Melodi. Müzik terimi. Bir ses dizisi — uyumlu, anlam taşıyan, hatırda kalan. Annem bu ismi seçti. "Bir gün bu ismin ne anlama geldiğini anlayacaksın," demişti küçükken. Şimdi anlıyordum.</p>
<p>Ben konuşamıyorum. Ama bir melodiyim.</p>
<p>Şu an on iki yaşındayım. Tekerlekli sandalyem var. Cihazım var. Ve artık bir şeyler daha var: Sesimi duyan insanlar var. Bu sayı bir yıl önce çok daha küçüktü. Şimdi büyüdü. Ve büyümeye devam edecek.</p>
<div class="thought">Eğer bu hayatı yazacak olsaydım — bir kitap olarak — hangi bölümü en çok severdim? Mrs. V ile geçirdiğim öğleden sonraları mı? Penny'nin "Melo-Melo" diye bağırması mı? Yarışmada "doğru cevap" duyulduğundaki o an mı? Rose'un "Harikasın" demesi mi?</div>
<p>Hepsini severdim. Çünkü hepsi gerçekti. Ve gerçeklik, mükemmellikten daha güzeldir.</p>
<p>Bugün okul bahçesinde güneş vardı. Rose yanımda oturuyordu. Lucas uzaktan el salladı. Connor başıyla selamladı. Asha kitabına gömülmüştü — beni gördü, güldü, tekrar gömdü. Mr. D pencereden izliyordu bizi — fark ettim, o fark ettirmedi.</p>
<p>Cihazımı açtım. Kimseye yazmak için değil. Sadece düşünce için. Bastım:</p>
<p><em>"Bugün güzel bir gün."</em></p>
<p>Cihaz okudu. Sesim yükseldi. Rose duydu. "Evet," dedi. "Güzel bir gün."</p>
<p class="scene-break">* * *</p>
<p>Mrs. V akşam bekleyecek. Annem akşam yemeği yapacak. Baba geç gelecek ama gelecek. Penny masada bağıracak, bir şeyler dökecek, güldürecek herkesi.</p>
<p>Ve ben orada olacağım. Kelimelerimi bastıracağım. Güleceğim — içimden, sesle değil ama gerçekten. Ailem beni duyacak. Çünkü artık nasıl dinlenileceğimi biliyorlar.</p>
<p>Hayat büyük, görkemli anlardan oluşmuyor sadece. Küçük anlardan oluşuyor. Bir öğleden sonra dersi. Bir kek. Bir defter. Bir "nasılsın". Bir el tutuşu.</p>
<div class="thought">Ben Melody Brooks. Beyin felcim var, sesim yok — ama bir melodiyim. Ve melodiler duyulmak için yazılır. Ben de duyuldum. Ben de duyuluyorum. Ben de duyulacağım.</div>
<p>Bu yeterliydi.</p>
<p>Bu her şeydi.</p>
<br/>
<p style="text-align:center;font-size:13px;color:var(--text3);font-family:'Inter',sans-serif;letter-spacing:2px;margin-bottom:8px;">— BİTİŞ —</p>
<p style="text-align:center;font-style:italic;color:var(--primary2);font-size:22px;font-family:'Lora',serif;margin-bottom:12px;">Melody</p>
<p style="text-align:center;font-size:12px;color:var(--text3);">Sharon M. Draper · <em>Out of My Mind</em></p>
<p style="text-align:center;font-size:12px;color:var(--text3);margin-top:4px;">Türkçe Uyarlama · CloudKitap</p>`
  },

  // ===== PLACEHOLDER ENTRY (15 — prev link güncellendi) =====
  15: {
    num: "Bölüm 15", title: "Gelecek",
    sub: "Bir hikaye bitmez — devam eder, başka sayfalarda.",
    prev: "bolum14.html", next: "bolum16.html",
    content: `
<p class="drop-cap">Yılın son günü. Koridorlar kalabalıktı, herkes vedalaşıyordu. Lokerler boşaltılıyordu. Yaz tatilinin kokusu vardı havada — hafif, serbestçe. Ben de o kokuyu alıyordum. Ben de hissediyordum.</p>
<p>Mr. D sınıfımıza geldi son kez. Tahtaya hiçbir şey yazmadı bu sefer. Sadece ayakta durdu. Bize baktı. Teker teker. Lucas'a, diğer arkadaşlarıma, bana.</p>
<p>"Bu yıl," dedi, "bir şeyler öğrendim. Hepinizden." Durdu. "Özellikle senden, Melody. Bana sesini buldurmanın sadece bir cihaz meselesi olmadığını öğrettin. Dinlemek de bir beceriymiş. Ben de öğreniyormuşum hâlâ."</p>
<div class="thought">Bir öğretmenin öğrencisinden öğrenmesi. Bu döngü güzeldi. Bu döngü gerçekti. Ve bu gerçeklik beni umutla doldurdu.</div>
<p>Bastım: <em>"Ben de sizden çok şey öğrendim. Teşekkür ederim."</em></p>
<p>O güldü. "Rica ederim, Melody Brooks."</p>
<p class="scene-break">* * *</p>
<p>Rose koridorda sarıldı bana — hafifçe, dikkatli, benim omuzlarıma dokunarak. "Yaz boyunca yazışalım," dedi. "Her şeyi anlatırsın." Bastım: <em>"Her şeyi anlatırım."</em></p>
<p>Mrs. V bahçede bekliyordu — elinde limonata bardağı, yüzünde gülümseme. "Hazır mısın Makao'm?" dedi. Bastım: <em>"Her zaman."</em></p>
<p>Baba arabayı park etmişti. Penny camdan bağırıyordu: "Melo-Melo! Hadi hadi!" Annem yanımda yürüyordu, elim tekerlekli sandalyenin kolçağında.</p>
<p>Güneş alçaktı. Hafif rüzgar esiyordu. Dünya büyüktü. Benim dünyam da büyüktü — küçük görünebilirdi dışarıdan, ama içinden bakınca uçsuz bucaksızdı.</p>
<div class="thought">Ben Melody Brooks. On bir yaşındayım. Konuşamıyorum — ama sesim var. Her zaman vardı. Artık dünya de duyuyor.</div>
<p>Ve bu yalnızca bir başlangıçtı.</p>
<p style="text-align:center;margin-top:48px;font-style:italic;color:var(--primary2);font-size:19px;font-family:'Lora',serif;">— Son —</p>
<p style="text-align:center;font-size:12px;color:var(--text3);margin-top:12px;">Sharon M. Draper · <em>Out of My Mind</em> · Türkçe Uyarlama</p>`
  }
};

// ===== ÇALIKUŞU (placeholder / summary) =====
// Not: Reşat Nuri Güntekin 1956'da vefat ettiği için (TR) telif süresi bugün itibarıyla devam ediyor olabilir.
// Bu yüzden burada kitap metni yerine kısa tanıtım/özet niteliğinde içerik kullanıldı.
const calikusuData = {
  1: {
    num: "Bölüm 1", title: "Başlangıç",
    sub: "Feride’nin hayatındaki büyük dönüşümün ilk adımı.",
    prev: null, next: "calikusu-bolum2.html",
    content: `
<p class="drop-cap">Bu sayfada, Çalıkuşu’nun temasını taşıyan <strong>özgün</strong> bir bölüm içeriği bulunur.</p>
<p>Feride, kalabalık bir evin içinde büyürken herkesten biraz farklı durduğunu hisseder: merakı hızlıdır, dili keskindir, kalbi ise bir an çok cesur, bir an çok kırılgandır. Onun “yerinde duramayan” hâli, evde bazen gülüş, bazen de azar olarak karşılık bulur.</p>
<div class="thought">Bazen bir insanı büyüten şey, alkış değil; “sen yapamazsın” cümlesine rağmen yürümektir.</div>
<p>Okul günleri, Feride’nin dünyasını genişletir. Kitaplar, defterler, sınıfın penceresinden görünen ağaçlar… Hepsi ona aynı şeyi fısıldar: <em>Hayat sandığından büyük.</em> Ama büyük olan her şey, aynı zamanda biraz ürkütücüdür. Feride’nin korkusu, karanlıktan değil; yarım kalmaktan gelir. Bir fikri tam kuramadan bölünmekten, bir cümleyi söyleyemeden yutkunmaktan, bir duyguyu anlamadan “geçti” sanmaktan.</p>
<p>Evde bazen sessizlik olur. Sessizlik, Feride’nin sevmediği bir misafir gibidir: oturur, etrafa bakar, hiçbir şey söylemez; ama herkesin neyi sakladığını bilir. O anlarda Feride kendine küçük oyunlar bulur. Evin en kuytu köşesine çekilir, bir kelimenin peşine düşer: “İnat” mesela. “Haysiyet.” “Umut.” Sonra bu kelimeleri içinden çevirip çevirip dener; sanki doğru açıdan bakarsa anlamları parlayacakmış gibi.</p>
<p class="scene-break">* * *</p>
<p>Bir gün okul çıkışı, yağmur beklenmedik bir anda bastırır. Herkes koşar; Feride yürümeyi seçer. Şemsiyesini açmaz hemen. Yağmurun sesini dinler, damlaların kaldırımda çizdiği halkaları izler. Kendini ilk kez acele etmeden, yetişmeye çalışmadan hisseder. Sonra bir pencerenin önünde durur: içeride sıcak bir ışık, dışarıda serin bir rüzgâr.</p>
<p>O pencerenin ardındaki hayat, ona “başka türlü” olabileceğini düşündürür. Başka bir ev, başka bir şehir, başka bir düzen. Bu düşünceyi hemen kovalamaz; çünkü Feride için en tehlikeli şey, güzel bir ihtimalin gerçek olma ihtimalidir. Gerçek olursa, kaybetmek de mümkündür.</p>
<p class="scene-break">* * *</p>
<p>Bir akşamüstü, küçük bir olay büyüyüp kalbine yer eder: bir bakış, bir cümle, yarım kalmış bir sohbet… Feride ilk kez şunu fark eder: İnsanların sözleri değil, sözlerinin arasındaki boşluklar can yakar.</p>
<p>Feride odasına çekildiğinde, aynaya bakar. Aynadaki yüz, tanıdık ama tamamlanmamış gibidir. “Ben böyle mi olacağım?” diye sorar kendine. Cevap gelmez. Cevap gelmeyince kendi cevabını kurar: “Nasıl olacağıma ben karar vereceğim.”</p>
<div class="thought">Bazı sözler yüksek sesle söylenmez. Söylenirse bozulur. O yüzden içte saklanır; bir gün, gerektiğinde kalkan olur.</div>
<p>Bu bölüm, onun iç sesini ve “kendini ispat” ihtiyacını kurar; sonraki sayfalarda gelecek kararların zeminini hazırlar.</p>`
  },
  2: {
    num: "Bölüm 2", title: "Yeni Sayfa",
    sub: "Hayat, küçük kararlarla bambaşka bir yola sapar.",
    prev: "calikusu-bolum1.html", next: "calikusu-bolum3.html",
    content: `
<p class="drop-cap">Feride’nin günlüğü, ona hem sığınak hem ayna olur.</p>
<p>Bir sayfaya dökülen cümleler, bir odada söylenenlerden daha cesurdur. Çünkü kâğıt, kimseye yaranmaya çalışmaz. Feride de yazarken ilk kez “iyi görünme” yükünden kurtulur.</p>
<p>Evdeki düzen, görünürde değişmez. Ama Feride’nin içinde bir şey yer değiştirir: Kendini savunmak yerine kendini anlatmayı öğrenir. Üstelik bunu bazen şakaya vurarak, bazen sessizleşerek yapar.</p>
<div class="thought">İnsan en çok, “her şey normal” denilen günlerde büyür; çünkü değişim gürültüyle değil, usulca gelir.</div>
<p>Okulda karşılaştığı bir öğretmenin cümlesi, küçük bir kapı aralar: “Yetenek, sadece bildiğin şey değildir; ısrarla dönüp baktığın şeydir.” Feride bu cümleyi cebine koyar. Belki de ilk kez bir yetişkin, onu “yaramaz” değil, “dikkatli” olarak görmüştür.</p>
<p>Günlük sayfalarında küçük başlıklar açar: “Bugün öğrendiğim şeyler”, “Bugün yuttuğum sözler”, “Bugün güldüğüm yerler”. Her başlık, onun için bir düzen kurma çabasıdır. Çünkü dışarıdaki hayat karmaşıktır; içeride bir çekmece olsun ister, her şeyi oraya koyabilsin diye.</p>
<p class="scene-break">* * *</p>
<p>Bir gece, evin içinde tartışma sesleri duyulur. Feride cümleleri seçemez; ama tonları seçer. Birinin kırıldığı, birinin üstünü örttüğü, birinin “olmamış gibi” davrandığı belli olur. Feride yatağında doğrulur, günlüğünü açar. İlk kez bir şey yazmak istemez; sadece sayfayı açık bırakır.</p>
<p>Boş sayfa, ona garip bir cesaret verir. “Bu evde herkes bir şey saklıyor,” diye düşünür. “Ben saklamayacağım.” Sonra bir kelime yazar: <em>“Kendim.”</em> Altına da şu cümleyi: “Kendim olmayı öğrendiğim gün, kimsenin gözünden korkmayacağım.”</p>
<div class="thought">İnsan bazen kendine söz verince büyür; söz tutulmasa bile, o sözün gölgesi insanı doğrultur.</div>
<p>Ertesi gün, Feride daha sakin görünür. Ama sakinlik, onun için bir geri çekiliş değildir; bir hazırlıktır. Çünkü o, ne zaman susacağını öğrenince daha iyi konuşacağını hisseder.</p>`
  },
  3: {
    num: "Bölüm 3", title: "Yolculuk",
    sub: "Yeni bir çevre, yeni sınavlar.",
    prev: "calikusu-bolum2.html", next: "calikusu-bolum4.html",
    content: `
<p class="drop-cap">Bir yerden ayrılmak, sadece valiz hazırlamak değildir.</p>
<p>Feride, tanıdığı sokaklardan uzaklaştıkça, kendini de yeniden tanımaya başlar. Yeni bir şehir, yeni yüzler, yeni kurallar… Bazıları açıkça söylenir; bazıları ise bakışlardan anlaşılır.</p>
<p>İlk günler, küçük kazalarla doludur: yanlış kapı çalmak, yanlış isim söylemek, yanlış zamanda konuşmak… Feride’nin dili hızlıdır ama bu kez hız, onu korumaz. Hız, bazen hedef olur.</p>
<p>Bir odanın kokusu bile yabancıdır. Perdeler farklı asılır, sandalye başka türlü gıcırdar, kapının kilidi başka ses çıkarır. Feride, bir süre “misafir” gibi yaşadığını fark eder. Misafirlikte insan rahat edemez; çünkü her an “ayıp olur” diye düşünür. Feride “ayıp olur” cümlesini sevmez. Ona göre asıl ayıp, kendini küçültmektir.</p>
<p class="scene-break">* * *</p>
<p>Yeni yerdeki ilk sabah, Feride uyanınca birkaç saniye “neredeyim” diye düşünür. O birkaç saniye, insanın başını döndüren bir boşluktur. Sonra odanın sınırlarını hatırlar: duvar, pencere, kapı. Kendine bir liste yapar: bugün yapılacaklar. Liste, onun için bir iptir; ipi tutunca düşmeyeceğini sanır.</p>
<p>Şehri dolaşırken iki ayrı dünya görür. Birinci dünya, herkesin bildiği: dükkânlar, kaldırımlar, kalabalıklar. İkinci dünya ise Feride’nin fark ettiği: bir çocuğun bir taşa takılıp duraksaması, yaşlı bir adamın ekmeği ikiye bölüp bir parçasını kuşa bırakması, bir kadının kapıyı kapatırken elini bir an daha tokmakta tutması. Feride bu küçük anlara bakarak insanları anlamaya çalışır.</p>
<div class="thought">Bazen karakter dediğin şey, büyük sözler değil; küçük hareketlerin toplamıdır.</div>
<p class="scene-break">* * *</p>
<p>Yolculuk boyunca yanında taşıdığı tek şey eşyalar değildir; bir de inat vardır. “Burada tutunacağım,” der kendi kendine. “Beni kimse ait olmadığım yere geri itemez.”</p>
<div class="thought">İnsanın en güçlü cümlesi, kimse duymadan kurduğu cümledir.</div>`
  },
  4: {
    num: "Bölüm 4", title: "Karşılaşmalar",
    sub: "İnsanlar ve seçimler, hikâyeyi büyütür.",
    prev: "calikusu-bolum3.html", next: "calikusu-bolum5.html",
    content: `
<p class="drop-cap">Yeni çevrede ilk tanışmalar, gerçeğin provasına benzer.</p>
<p>Feride, bir yandan mesafeli durup kendini korumaya çalışır; bir yandan da “görülmek” ister. Biri ona samimi yaklaşınca şüphelenir, sert yaklaşınca meydan okur. Her tepkinin altında aynı soru vardır: <em>Ben kimim, burada nasıl duracağım?</em></p>
<p>İnsanlar, Feride’yi önce “hikâye” sanır: sanki o bir masal kahramanı, hayata biraz fazla karışan, biraz fazla konuşan bir kızdır. Feride bu bakışa sinirlenir. Çünkü masal kahramanları, başlarına geleni seçmez. Feride seçmek ister.</p>
<p>Bir karşılaşma, diğerlerinden daha uzun sürer: kısa ama etkili bir sohbet. Feride o sohbetten sonra kendini kızgın bulur. Kızgınlığının sebebi karşısındaki değil; kendi içinde büyüyen yeni bir ihtimaldir.</p>
<p class="scene-break">* * *</p>
<p>Bu bölüm, karakterlerin birbirini “etiketlemek” yerine “tanımaya” başladığı yeri anlatır. Feride’nin mizahı, kalkan olmaktan çıkıp köprü olmaya doğru evrilir.</p>`
  },
  5: {
    num: "Bölüm 5", title: "Devam",
    sub: "Hikâye burada sürer…",
    prev: "calikusu-bolum4.html", next: "calikusu-bolum6.html",
    content: `
<p class="drop-cap">Bazı günler, bir önceki günün gölgesiyle gelir.</p>
<p>Feride, yeni hayatının içinde küçük bir düzen kurar: sabah erken kalkmak, aynı sokaktan yürümek, aynı pencereden gökyüzüne bakmak. Düzen, ona güven verir. Fakat düzenin içine bir “haber” düştüğünde, her şey yeniden sallanır.</p>
<div class="thought">Kader dediğimiz şey bazen çok yüksek sesle konuşmaz; bir mektup zarfının hışırtısı kadar sessizdir.</div>
<p>Haberin kendisi kadar, haberin doğurduğu sorular yorar onu: “Şimdi ne olacak?” “Ben ne yapacağım?” “Bunu ben mi seçtim, yoksa seçmiş gibi mi davranıyorum?” Feride’nin içindeki iki ses tartışır. Birinci ses, “kal ve sabret” der. İkinci ses, “git ve büyü” der. Feride iki sesin de haklı olduğunu anlar; ama haklılık, karar vermeyi kolaylaştırmaz.</p>
<p class="scene-break">* * *</p>
<p>O gece uzun süre uyuyamaz. Pencereyi aralar, sokaktan gelen sesleri dinler. Uzak bir köpeğin havlaması, bir kapının kapanışı, rüzgârın ince ıslığı… Hepsi, ona dünyanın “kendi kendine” aktığını hatırlatır. Kendi kendine akan bir dünyada, insanın bir yer tutması gerekir.</p>
<p>Feride masaya oturur, günlüğünü açar. Bu kez başlık atmaz. Bu kez “güzel cümle” kurmaya da çalışmaz. Sadece dürüst olur. Dürüstlük, onun en sevdiği lüks hâline gelir.</p>
<p>Bu bölümün sonunda Feride, kendine iki söz verir: İlki, kimsenin onun adına karar vermesine izin vermemek. İkincisi ise daha zor olanı: Kendi duygularını inkâr etmemek.</p>
<p style="text-align:center;margin-top:40px;color:var(--text3);font-size:12px;font-family:'Inter',sans-serif;letter-spacing:1px;">— ÖZGÜN İÇERİK —</p>`
  },

  6: {
    num: "Bölüm 6", title: "İlk Ders",
    sub: "Kendini anlatmak bazen sınıfın kapısını açmaktır.",
    prev: "calikusu-bolum5.html", next: "calikusu-bolum7.html",
    content: `
<p class="drop-cap">Feride, bir sabah “bugün” kelimesini ağzında çevirip durur.</p>
<p>Bugün, hem sıradan hem büyük olabilir. İnsan bazen aynı güne iki farklı gözle bakar: biri korkuyla, biri meydan okumayla. Feride kapının eşiğinde, iki gözün arasında kalır. Sonra adım atar.</p>
<p>İlk ders günü, sınıfın kokusu bile bir sınav gibidir: tebeşir, tahta, eski kitap. Çocukların bakışları önce hızlıdır; çünkü hızlı bakmak “ayıp” sayılmaz. Uzun bakışlar ise sorudur. Feride sorulardan kaçmak istemez ama soruların onu tanımlamasını da istemez.</p>
<p>Bir öğrenci “yeni öğretmen” diye fısıldar. Başka biri gülümser, biri kaşlarını kaldırır. Feride, gülümseyene gülümser. Kaş kaldırana da kaş kaldırır. İnce bir mizah, ortamı yumuşatır. Mizah, onun cebindeki küçük bıçak gibidir: tehlikede çıkarır, ama kimseyi kesmek için değil; kendine yol açmak için.</p>
<div class="thought">İnsanın kendine açtığı yol, başkasının izin verdiğinden daha değerlidir.</div>
<p class="scene-break">* * *</p>
<p>Derste konu basittir. Ama Feride’nin aklı, basit konuların altında yatan “neden”lere kayar. Bir çocuk bir soruyu bilemeyince utanır. Feride o utancı tanır; çünkü utanç, çoğu zaman “yanlış yaptım” değil, “yanlış görüldüm” duygusudur.</p>
<p>Ders çıkışı, Feride pencereden bahçeye bakar ve şunu düşünür: “Bu iş sadece ders anlatmak değil. Bu iş, insanın kendini tutması, kendini bırakması, doğru yerde doğru dozda var olması.”</p>
<p>Akşam günlüğüne tek bir cümle yazar: <em>“Bugün korktum ama kaçmadım.”</em></p>`
  },

  7: {
    num: "Bölüm 7", title: "Sesler ve Susuşlar",
    sub: "Her cümlenin bir gölgesi vardır.",
    prev: "calikusu-bolum6.html", next: "calikusu-bolum8.html",
    content: `
<p class="drop-cap">Feride, aynı olayı iki kişinin iki ayrı şekilde anlatabildiğini öğrenir.</p>
<p>Birinin “haklı” dediği şeye öteki “ayıp” der. Birinin “kader” dediğine öteki “seçim” der. Feride bu kelimelerin kavgasını dinlerken, aslında insanların kendi korkularını savunduğunu anlar.</p>
<p>Okulda küçük bir mesele büyür. Bir defter kaybolur. Suç, kolay bulunan bir yere konur. Feride, “kolay suç”un ne demek olduğunu ilk kez burada görür: Gücü az olana, sesi az çıkana, yalnız durana suç daha çabuk yapışır.</p>
<p>Feride araya girer. Kibar değildir; ama adildir. Adalet, bazen kibarlığı geçer. O an söyledikleri, birkaç kişiyi rahatsız eder. Rahatsızlık, Feride’ye göre iyi bir şeydir: çünkü rahatsızlık olmadan yer değişmez.</p>
<div class="thought">Sessiz bir düzende, doğru söz bile gürültü sayılır.</div>
<p class="scene-break">* * *</p>
<p>Akşamüstü yürürken, sokakların da konuştuğunu fark eder. Pencereler, kapılar, duvarlar. Her şey bir şey saklar. Feride saklanana karşı merak duyar; ama merakıyla kibri karıştırmamaya çalışır. “Ben bilirim” demek istemez. “Ben öğrenirim” demek ister.</p>
<p>Günlüğüne bu kez iki cümle yazar: <em>“Bugün birini korudum. Bugün kendimi de korudum.”</em></p>`
  },

  8: {
    num: "Bölüm 8", title: "Küçük Zafer",
    sub: "Bazen kazanmak, bir gün daha dayanabilmektir.",
    prev: "calikusu-bolum7.html", next: "calikusu-bolum9.html",
    content: `
<p class="drop-cap">Bir gün, Feride’nin yüzüne farkında olmadan bir rahatlık yerleşir.</p>
<p>Bu rahatlık, “her şey yolunda” rahatlığı değildir. Bu, “ben buradayım” rahatlığıdır. İnsan bir yere alışınca her şey kolaylaşmaz; sadece daha az şaşırır. Feride artık şaşırmayı seçer: şaşırmak yerine gözlemlemeyi.</p>
<p>Bir öğrencinin okuma hevesi uyanır. Başka bir öğrenci ilk kez sınıfta söz ister. Feride bu küçük kıpırtıları görünce içinden sevinir. Çünkü yaptığı şeyin bir işe yaradığını hisseder. İşe yaramak, insanı hayatta tutan en basit duygudur.</p>
<div class="thought">Sevilmek güzel; ama işe yaramak bazen daha sessiz, daha kalıcı bir mutluluktur.</div>
<p class="scene-break">* * *</p>
<p>O günün sonunda Feride, kendine küçük bir ödül verir: sıcak bir içecek ve uzun bir yürüyüş. Yürürken “ben bu şehirde kaybolsam da bulurum” diye düşünür. Bu cümle, bir harita değildir; ama bir omuzdur.</p>
<p>Günlüğüne yazdığı kelime sadece şudur: <em>“Devam.”</em></p>`
  },

  9: {
    num: "Bölüm 9", title: "Gölge",
    sub: "Geçmiş bazen peşinden sessizce gelir.",
    prev: "calikusu-bolum8.html", next: "calikusu-bolum10.html",
    content: `
<p class="drop-cap">Feride, bir mektup alır ya da bir haber duyar—ve içi bir an donar.</p>
<p>Haberin içeriği kadar, haberin onun içindeki yankısı büyüktür. Çünkü bazı insanlar, sadece “insan” değildir; bir dönemin kapısıdır. O kapı aralanınca, içeriden eski kokular çıkar.</p>
<p>Feride önce küçülür. Sonra büyür. Aynı dakika içinde. Bu dalgalanmayı kimse görmez; çünkü Feride’nin yüzü ustadır. Yüzünü “normal” tutmayı uzun zaman önce öğrenmiştir.</p>
<p>Yalnız kaldığında ise kendine kızar: “Neden hâlâ etkileniyorum?” Sonra daha dürüst bir soru sorar: “Etkilenmek ayıp mı?” Cevabı da kendisi verir: “Hayır. Ayıp olan, etkileniyormuş gibi yapıp inkâr etmek.”</p>
<div class="thought">Duygu, yok sayılınca kaybolmaz; sadece yön değiştirir.</div>
<p class="scene-break">* * *</p>
<p>O gece Feride, uzun zamandır ilk kez rüya görür. Rüyada bir koridor vardır: kapılar, kapılar, kapılar. Bir kapıyı açar; içeride çocukluğu vardır. Başka bir kapıyı açar; içeride susuşları. Uyanınca kalbi hızlı atar. Ama hızlı atan kalp, hâlâ yaşadığını kanıtlar.</p>`
  },

  10: {
    num: "Bölüm 10", title: "Sınır",
    sub: "İyilik, bazen “hayır” diyebilmektir.",
    prev: "calikusu-bolum9.html", next: "calikusu-bolum11.html",
    content: `
<p class="drop-cap">Feride, herkesin ondan bir şey beklediğini fark eder.</p>
<p>Beklentiler her yere sızar: “Şunu da yapar mısın?”, “Bunu da sen hallet”, “Sen zaten güçlüsün.” Güçlü olmak, bazen insanın başına dert olur. Çünkü insanlar, güçlü sandıklarına yük taşır. Feride yük taşımayı bilir; ama bunun adil olup olmadığını da bilir.</p>
<p>Bir noktada “hayır” demesi gerekir. “Hayır” derken sesi titrer; çünkü ilk kez bir düzeni bozmaktadır. Düzen bozulunca insanlar rahatsız olur. Feride rahatsızlığı taşımayı göze alır.</p>
<div class="thought">Sınır koymak, kimseyi incitmemek için değil; kendini tüketmemek içindir.</div>
<p class="scene-break">* * *</p>
<p>Hayır dedikten sonra, garip bir hafiflik hisseder. Hafiflikle birlikte bir suçluluk da gelir. Suçluluk, eski bir alışkanlıktır: “Herkesi memnun etmeliyim” alışkanlığı. Feride bu alışkanlığı kırmaya karar verir. Yavaş yavaş. İnada yakışır şekilde.</p>`
  },

  11: {
    num: "Bölüm 11", title: "Ayna",
    sub: "İnsan bazen kendini bir başkasının gözünde görür.",
    prev: "calikusu-bolum10.html", next: "calikusu-bolum12.html",
    content: `
<p class="drop-cap">Feride, bir sohbetin ortasında susar.</p>
<p>Normalde susmak ona göre değildir. Ama bu kez susuş, bir düşünme biçimidir. Karşısındaki insan, onun sandığından daha kırılgandır; ya da daha yorgun. Feride bunu fark edince kendi sertliğini ayarlar. Sertlik, her zaman cesaret değildir; bazen alışkanlıktır.</p>
<p>O gün, birisi ona “sen böyle misin gerçekten” diye sorar. Feride içinden güler: “Ben kimim gerçekten?” Cevap vermek kolay değildir. İnsan kendini tanısa bile anlatamaz bazen. Anlatsa da anlaşılmayabilir.</p>
<div class="thought">Anlaşılmamak, yalnızlık değil; bazen sadece zaman meselesidir.</div>
<p class="scene-break">* * *</p>
<p>Akşam, aynanın karşısına geçer. Kendine uzun uzun bakar. Sonra fısıldar gibi bir cümle kurar: “Ben kötü değilim. Ben zorlanıyorum.” Bu cümle, kendine verdiği en büyük şefkattir.</p>`
  },

  12: {
    num: "Bölüm 12", title: "Yol",
    sub: "Hikâye bitmez; sadece yön değiştirir.",
    prev: "calikusu-bolum11.html", next: "calikusu-bolum13.html",
    content: `
<p class="drop-cap">Feride, artık “kaçmak” ile “gitmek” arasındaki farkı bilir.</p>
<p>Kaçmak, korkudan doğar. Gitmek ise karardan. Feride karar vermeyi öğrenmiştir; ama bu, artık korkmadığı anlamına gelmez. Sadece korkuyu yanına alıp yürümeyi öğrenmiştir.</p>
<p>Bir sabah, güneş farklı vurur pencereye. Feride bunu fark eder. “Bugün başka,” der. Sonra kendine bir plan yapar: küçücük bir plan. Çünkü büyük planlar, bazen insanı felç eder. Küçük planlar yürütür.</p>
<div class="thought">İnsan yürüdükçe cesaret büyür. Cesaret büyüdükçe insan daha doğru yürür.</div>
<p class="scene-break">* * *</p>
<p>Bu bölüm, Feride’nin “kimseye benzemek zorunda değilim” duygusunu sağlamlaştırır. Herkesin hikâyesi bir yerde düğümlenir. Feride’nin düğümü de çözülmez belki; ama artık düğümden korkmaz. Çünkü düğüm, ipi koparmamıştır.</p>
<p style="text-align:center;margin-top:40px;color:var(--text3);font-size:12px;font-family:'Inter',sans-serif;letter-spacing:1px;">— 12 BÖLÜM · ÖZGÜN İÇERİK —</p>`
  },
  13: {
    num: "Bölüm 13", title: "Eşik",
    sub: "Bir karar, eski hayatla yeni hayat arasında köprü olur.",
    prev: "calikusu-bolum12.html", next: "calikusu-bolum14.html",
    content: `
<p class="drop-cap">Feride, bir eşiğin tam ortasında durduğunu hisseder.</p>
<p>Ne tam geridedir ne tam ileride. Eşik anları böyledir: insanı bir an askıda bırakır. Ama askıda kalan şey beden değil, niyettir.</p>
<div class="thought">Karar vermek, geleceği bilmek değil; belirsizliğe rağmen yön seçmektir.</div>
<p>Bu bölümde Feride, içindeki dağınık sesleri ilk kez bir plana dönüştürür.</p>`
  },
  14: {
    num: "Bölüm 14", title: "Mektup",
    sub: "Yazılan her satır, saklanan bir duyguyu açığa çıkarır.",
    prev: "calikusu-bolum13.html", next: "calikusu-bolum15.html",
    content: `
<p class="drop-cap">Bir mektup gelir; içindeki cümleler kadar susuşları da ağırdır.</p>
<p>Feride, satır aralarını okumayı iyi bilir. Kimin neyi söylemediğini, kimin neyi sakladığını daha hızlı anlar.</p>
<p>Sonunda kâğıdı katlar ve şunu düşünür: “Bazı cevaplar yazılmaz, yaşanır.”</p>`
  },
  15: {
    num: "Bölüm 15", title: "Yüzleşme",
    sub: "Kaçınılan konuşmalar bir gün kapıyı çalar.",
    prev: "calikusu-bolum14.html", next: "calikusu-bolum16.html",
    content: `
<p class="drop-cap">Feride bu kez susmaz.</p>
<p>Yıllardır yarım kalan cümleleri tamamlar; incitmeden ama geri çekilmeden konuşur. Onun için bu bir tartışma değil, kendi sınırını çizme anıdır.</p>
<div class="thought">İnsan bazen ilk kez sesini yükseltince değil, sesini netleştirince güçlü olur.</div>`
  },
  16: {
    num: "Bölüm 16", title: "Yağmur",
    sub: "Bazen hava, insanın içini birebir taklit eder.",
    prev: "calikusu-bolum15.html", next: "calikusu-bolum17.html",
    content: `
<p class="drop-cap">Gün boyu ince bir yağmur yağar.</p>
<p>Feride sokaklarda acele etmeden yürür; su birikintilerindeki yansımaları izler. Kendi yüzünün de artık değiştiğini fark eder: daha sakin, daha belirgin.</p>
<p>Yağmur dinerken içindeki düğüm de biraz gevşer.</p>`
  },
  17: {
    num: "Bölüm 17", title: "İz",
    sub: "Bırakılan her iz, bir gün geri dönüp bulunur.",
    prev: "calikusu-bolum16.html", next: "calikusu-bolum18.html",
    content: `
<p class="drop-cap">Feride, geçmişte verdiği küçük kararların bugünkü etkisini görür.</p>
<p>Bir öğrencinin teşekkür cümlesi, bir dostun beklenmedik desteği, bir yabancının tanıdığı bakış... Hepsi bir araya gelince şu gerçek ortaya çıkar: Hiçbir emek kaybolmaz.</p>
<div class="thought">İyi niyet, hemen değil ama mutlaka geri döner.</div>`
  },
  18: {
    num: "Bölüm 18", title: "Sınav",
    sub: "Hayat bazen not vermez ama öğretir.",
    prev: "calikusu-bolum17.html", next: "calikusu-bolum19.html",
    content: `
<p class="drop-cap">Bu kez sınav, okulda değil hayattadır.</p>
<p>Feride beklenmedik bir sorumluluğun altına girer. Yorulur, öfkelenir, sonra yeniden toparlanır. Çünkü artık dayanıklılığın sadece sabır değil, doğru destek istemek olduğunu da bilir.</p>
<p>Günün sonunda kendine “geçtin” demeyi öğrenir.</p>`
  },
  19: {
    num: "Bölüm 19", title: "Denge",
    sub: "Kalp ile akıl, kavga etmek yerine anlaşabilir.",
    prev: "calikusu-bolum18.html", next: "calikusu-bolum20.html",
    content: `
<p class="drop-cap">Feride ilk kez “ya hep ya hiç” yerine “denge”yi seçer.</p>
<p>Sevdiği şeylerden vazgeçmeden, kendini de yormadan ilerlemenin yollarını arar. Bu arayış ona yeni bir olgunluk getirir: kazanmak değil sürdürebilmek.</p>
<div class="thought">Uzun yolları hız değil, ritim tamamlar.</div>`
  },
  20: {
    num: "Bölüm 20", title: "Yeni Başlangıç",
    sub: "Biten her bölüm, başka bir hikâyeye kapı açar.",
    prev: "calikusu-bolum19.html", next: null,
    content: `
<p class="drop-cap">Feride geriye bakar ve gülümser.</p>
<p>Eksikleri, kırgınlıkları, cesaret ettiği anları bir bütün olarak görür. Kusursuz bir yol değildir bu; ama kendisine ait bir yol olduğu için kıymetlidir.</p>
<p>Son satırda şunu yazar: “Ben değiştim. Hikâyem de değişti. Ama yürümeyi bırakmadım.”</p>
<p style="text-align:center;margin-top:40px;color:var(--text3);font-size:12px;font-family:'Inter',sans-serif;letter-spacing:1px;">— 20 BÖLÜM · ÖZGÜN İÇERİK —</p>`
  }
};

// ===== READER =====
function loadReaderChapter(num) {
  const data = bookData[num];
  if (!data) return;

  document.title = "Karışık — " + data.num + " | " + getLocalizedBrandName();

  const ids = { readerChapterTitle: "Karışık · " + data.num, chapterNum: data.num, chapterTitle: data.title, chapterSub: data.sub };
  for (const [id, val] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  const contentEl = document.getElementById("readerText");
  if (contentEl) contentEl.innerHTML = data.content;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) { if (data.prev) { prevBtn.href = data.prev; prevBtn.classList.remove("disabled"); } else { prevBtn.href="#"; prevBtn.classList.add("disabled"); } }
  if (nextBtn) { if (data.next) { nextBtn.href = data.next; nextBtn.classList.remove("disabled"); } else { nextBtn.href="#"; nextBtn.classList.add("disabled"); } }

  const sel = document.getElementById("chapterSelect");
  if (sel) sel.value = num;

  // Estimate read time
  const wordCount = data.content.replace(/<[^>]+>/g, "").split(/\s+/).length;
  const mins = Math.ceil(wordCount / 200);
  const timeEl = document.getElementById("ttsTimeLeft");
  if (timeEl) timeEl.textContent = "~" + mins + " dk okuma";
  trackRead("karisik", 1);
}

function loadCalikusuChapter(num) {
  const data = calikusuData[num];
  if (!data) return;

  document.title = "Çalıkuşu — " + data.num + " | " + getLocalizedBrandName();

  const ids = { readerChapterTitle: "Çalıkuşu · " + data.num, chapterNum: data.num, chapterTitle: data.title, chapterSub: data.sub };
  for (const [id, val] of Object.entries(ids)) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  const contentEl = document.getElementById("readerText");
  if (contentEl) contentEl.innerHTML = data.content;

  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  if (prevBtn) { if (data.prev) { prevBtn.href = data.prev; prevBtn.classList.remove("disabled"); } else { prevBtn.href="#"; prevBtn.classList.add("disabled"); } }
  if (nextBtn) { if (data.next) { nextBtn.href = data.next; nextBtn.classList.remove("disabled"); } else { nextBtn.href="#"; nextBtn.classList.add("disabled"); } }

  const sel = document.getElementById("chapterSelect");
  if (sel) {
    // Populate chapter options dynamically (so we don't have to update every HTML file)
    const keys = Object.keys(calikusuData).map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)).sort((a,b)=>a-b);
    sel.innerHTML = keys.map(n => `<option value="${n}">Bölüm ${n}</option>`).join("");
    sel.value = num;
  }

  const wordCount = data.content.replace(/<[^>]+>/g, "").split(/\s+/).length;
  const mins = Math.ceil(wordCount / 200);
  const timeEl = document.getElementById("ttsTimeLeft");
  if (timeEl) timeEl.textContent = "~" + mins + " dk okuma";
  trackRead("calikusu", 1);
}

function getChapterNum() {
  const meta = document.getElementById("chapterNumMeta");
  return meta ? parseInt(meta.value) : 1;
}

function getBookId() {
  const meta = document.getElementById("bookIdMeta");
  return meta ? String(meta.value || "").toLowerCase() : "karisik";
}

document.addEventListener("DOMContentLoaded", function () {
  applyBrandName();
  syncUserUI();
  const num = getChapterNum();
  if (document.getElementById("readerText")) {
    const bookId = getBookId();
    if (bookId === "calikusu") loadCalikusuChapter(num);
    else loadReaderChapter(num);
  }
});

// ===== USER BOOKS (Online) =====
const API_BASE = ""; // same-origin (served by server.py)

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("ck_user") || "null");
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (!user) {
    localStorage.removeItem("ck_user");
    return;
  }
  localStorage.setItem("ck_user", JSON.stringify(user));
}

async function apiJson(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error ? String(data.error) : ("HTTP " + res.status);
    throw new Error(msg);
  }
  return data;
}

async function refreshCurrentUserProfile() {
  const user = getCurrentUser();
  if (!user?.id) return null;
  const fresh = await apiJson(`/api/users/${encodeURIComponent(user.id)}/profile`);
  setCurrentUser(fresh);
  syncUserUI();
  return fresh;
}

async function registerAccount() {
  const username = document.getElementById("accUsername")?.value?.trim() || "";
  const password = document.getElementById("accPassword")?.value?.trim() || "";
  const status = document.getElementById("accStatus");
  if (!username || !password) {
    if (status) status.textContent = "Kullanıcı adı ve şifre gir.";
    return;
  }
  if (status) status.textContent = "Kaydediliyor...";
  try {
    await apiJson("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    if (status) status.textContent = "Kayıt tamam. Şimdi giriş yapabilirsin.";
  } catch (e) {
    if (status) status.textContent = "Hata: " + e.message;
  }
}

async function loginAccount() {
  const username = document.getElementById("accUsername")?.value?.trim() || "";
  const password = document.getElementById("accPassword")?.value?.trim() || "";
  const status = document.getElementById("accStatus");
  if (!username || !password) {
    if (status) status.textContent = "Kullanıcı adı ve şifre gir.";
    return;
  }
  if (status) status.textContent = "Giriş yapılıyor...";
  try {
    const user = await apiJson("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    });
    setCurrentUser(user);
    syncUserUI();
    if (status) status.textContent = "Giriş başarılı.";
    await loadLeaderboard();
  } catch (e) {
    if (status) status.textContent = "Hata: " + e.message;
  }
}

function logoutAccount() {
  setCurrentUser(null);
  syncUserUI();
  const status = document.getElementById("accStatus");
  if (status) status.textContent = "Çıkış yapıldı.";
}

function syncUserUI() {
  const user = getCurrentUser();
  const nameEl = document.getElementById("currentUserName");
  const ptsEl = document.getElementById("currentUserPoints");
  const avatar = document.querySelector(".avatar");
  if (nameEl) nameEl.textContent = user?.username ? user.username : "Misafir";
  if (ptsEl) ptsEl.textContent = user?.points != null ? String(user.points) : "0";
  if (avatar) avatar.textContent = (user?.username?.[0] || "K").toUpperCase();
}

async function tryOpenBook(bookKey, targetUrl) {
  const user = getCurrentUser();
  if (!user?.id) {
    alert("Kitap açmak için önce hesap girişi yapmalısın.");
    location.href = "hesap.html";
    return;
  }
  try {
    await apiJson("/api/books/open", {
      method: "POST",
      body: JSON.stringify({ user_id: user.id, book_key: bookKey })
    });
    await refreshCurrentUserProfile();
    location.href = targetUrl;
  } catch (e) {
    alert(e.message);
  }
}

async function trackRead(bookKey, pagesRead = 1) {
  const user = getCurrentUser();
  if (!user?.id) return;
  const chapterNum = getChapterNum?.() || 1;
  const markKey = `ck_read_${bookKey}_${chapterNum}`;
  if (sessionStorage.getItem(markKey)) return;
  sessionStorage.setItem(markKey, "1");
  try {
    await apiJson("/api/activity/read", {
      method: "POST",
      body: JSON.stringify({
        user_id: user.id,
        book_key: bookKey,
        pages_read: pagesRead
      })
    });
  } catch {}
}

async function loadLeaderboard() {
  const table = document.getElementById("leaderboardBody");
  if (!table) return;
  table.innerHTML = `<tr><td colspan="6">Yükleniyor...</td></tr>`;
  try {
    const rows = await apiJson("/api/leaderboard");
    if (!rows.length) {
      table.innerHTML = `<tr><td colspan="6">Henüz veri yok.</td></tr>`;
      return;
    }
    table.innerHTML = rows.map(r => `
      <tr>
        <td>#${r.rank}</td>
        <td>${escapeHtml(r.username || "")}</td>
        <td>${r.read_pages || 0}</td>
        <td>${r.written_pages || 0}</td>
        <td>${r.points || 0}</td>
        <td>${r.rank_reward || 0}</td>
      </tr>
    `).join("");
  } catch (e) {
    table.innerHTML = `<tr><td colspan="6">Hata: ${escapeHtml(e.message || "yüklenemedi")}</td></tr>`;
  }
}

async function loadUserBooks() {
  const status = document.getElementById("ubStatus");
  if (status) status.textContent = "Yükleniyor…";
  try {
    const books = await apiJson("/api/books");
    window.__USER_BOOKS__ = Array.isArray(books) ? books : [];
    renderUserBooks();
    if (status) status.textContent = "";
  } catch (e) {
    if (status) status.textContent = "API çalışmıyor. `server.py` açık mı?";
  }
}

function renderUserBooks() {
  const list = document.getElementById("userBooksList");
  const count = document.getElementById("userBooksCount");
  const qEl = document.getElementById("userBookSearch");
  const cl = document.getElementById("searchClear");
  const q = (qEl?.value || "").trim().toLowerCase();
  if (cl) cl.style.display = q ? "flex" : "none";

  const all = (window.__USER_BOOKS__ || []);
  const filtered = q
    ? all.filter(b => (b.title || "").toLowerCase().includes(q) || (b.author || "").toLowerCase().includes(q))
    : all;

  if (count) count.textContent = String(all.length);
  if (!list) return;

  if (filtered.length === 0) {
    list.innerHTML = `
      <div class="list-book-item" style="opacity:0.85;">
        <div class="list-book-info">
          <div class="list-book-title">Henüz kitap yok</div>
          <div class="list-book-desc">Yukarıdan kendi kitabını ekleyebilirsin.</div>
        </div>
      </div>`;
    return;
  }

  list.innerHTML = filtered.map(b => `
    <a href="kullanici-kitap.html?id=${encodeURIComponent(b.id)}" class="list-book-item">
      <div class="list-book-cover calikusu-sm"></div>
      <div class="list-book-info">
        <div class="list-book-title">${escapeHtml(b.title || "")}</div>
        <div class="list-book-author">${escapeHtml(b.author || "")} · ${formatDate(b.created_at)}</div>
        <div class="list-book-desc">${escapeHtml(b.synopsis || "")}</div>
      </div>
      <div class="list-book-meta">
        <span class="meta-pill">Oku →</span>
      </div>
    </a>
  `).join("");
}

async function createUserBook() {
  const t = document.getElementById("ubTitle");
  const a = document.getElementById("ubAuthor");
  const s = document.getElementById("ubSynopsis");
  const c = document.getElementById("ubContent");
  const status = document.getElementById("ubStatus");
  if (status) status.textContent = "Gönderiliyor…";

  try {
    const user = getCurrentUser();
    if (!user?.id) {
      if (status) status.textContent = "Kitap yazmak için önce hesap girişi yap.";
      return;
    }
    const created = await apiJson("/api/books", {
      method: "POST",
      body: JSON.stringify({
        title: t?.value || "",
        author: a?.value || user.username || "",
        synopsis: s?.value || "",
        content: c?.value || "",
        user_id: user?.id || null
      })
    });
    if (t) t.value = "";
    if (a) a.value = "";
    if (s) s.value = "";
    if (c) c.value = "";
    if (status) status.textContent = "Yayınlandı. Açılıyor…";
    setTimeout(() => {
      location.href = `kullanici-kitap.html?id=${encodeURIComponent(created.id)}`;
    }, 350);
  } catch (e) {
    if (status) status.textContent = "Hata: " + e.message;
  }
}

async function loadUserBookDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const titleEl = document.getElementById("chapterTitle");
  const subEl = document.getElementById("chapterSub");
  const textEl = document.getElementById("readerText");

  if (!id) {
    if (titleEl) titleEl.textContent = "Kitap bulunamadı";
    return;
  }

  try {
    const book = await apiJson(`/api/books/${encodeURIComponent(id)}`);
    document.title = `${book.title} | ${getLocalizedBrandName()}`;
    const top = document.getElementById("readerChapterTitle");
    if (top) top.textContent = book.title;
    if (titleEl) titleEl.textContent = book.title;
    if (subEl) subEl.textContent = `${book.author} · ${formatDate(book.created_at)}`;
    if (textEl) textEl.innerHTML = (book.content || "").split(/\n{2,}/).map(p => `<p>${escapeHtml(p)}</p>`).join("");

    await loadComments(id);

    // read time
    const wordCount = String(book.content || "").split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(wordCount / 200));
    const timeEl = document.getElementById("ttsTimeLeft");
    if (timeEl) timeEl.textContent = "~" + mins + " dk okuma";
    trackRead(`userbook-${id}`, Math.max(1, Math.ceil(wordCount / 250)));
  } catch (e) {
    if (titleEl) titleEl.textContent = "Kitap yüklenemedi";
    if (subEl) subEl.textContent = "API çalışmıyor olabilir.";
  }
}

async function loadComments(bookId) {
  const list = document.getElementById("commentsList");
  if (list) list.innerHTML = `<div class="chapter-row" style="opacity:0.7;"><span class="ch-title">Yükleniyor…</span></div>`;
  const comments = await apiJson(`/api/books/${encodeURIComponent(bookId)}/comments`);
  renderComments(comments);
}

function renderComments(comments) {
  const list = document.getElementById("commentsList");
  if (!list) return;
  const arr = Array.isArray(comments) ? comments : [];
  if (arr.length === 0) {
    list.innerHTML = `<div class="chapter-row" style="opacity:0.7;"><span class="ch-title">Henüz yorum yok.</span></div>`;
    return;
  }
  list.innerHTML = arr.map(c => `
    <div class="chapter-row" style="align-items:flex-start;gap:12px;">
      <span class="ch-num" style="min-width:120px;">${escapeHtml(c.name || "Anonim")}</span>
      <span class="ch-title">${escapeHtml(c.body || "")}</span>
      <span class="ch-pages">${formatDate(c.created_at)}</span>
    </div>
  `).join("");
}

async function postComment() {
  const params = new URLSearchParams(location.search);
  const id = params.get("id");
  const nameEl = document.getElementById("cName");
  const bodyEl = document.getElementById("cBody");
  const status = document.getElementById("cStatus");
  if (!id) return;
  if (status) status.textContent = "Gönderiliyor…";
  try {
    await apiJson(`/api/books/${encodeURIComponent(id)}/comments`, {
      method: "POST",
      body: JSON.stringify({ name: nameEl?.value || "", body: bodyEl?.value || "" })
    });
    if (bodyEl) bodyEl.value = "";
    if (status) status.textContent = "Gönderildi.";
    await loadComments(id);
    setTimeout(() => { if (status) status.textContent = ""; }, 900);
  } catch (e) {
    if (status) status.textContent = "Hata: " + e.message;
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("tr-TR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(iso);
  }
}
