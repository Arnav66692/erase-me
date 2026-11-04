# Erase Me

> Bu çeviri makine desteğiyle hazırlandı. Anadili Türkçe olan birinin gözden geçirmesine açığız. Düzeltmeleri pull request olarak gönderebilirsiniz. İki metin arasında fark olursa [İngilizce README](README.md) geçerlidir.

Erase Me, sizi veya buna onay veren bir aile üyenizi kişi arama sitelerinden, veri simsarlarından, arayan kimliği uygulamalarından ve arama sonuçlarından kaldıran açık kaynaklı bir Agent Skill'dir. Zaten kullandığınız kodlama ajanının içinde çalışır ve o kişinin yaşadığı yerdeki gizlilik yasasına göre hareket eder.

## Hızlı başlangıç

```
npx skills add <owner>/erase-me
```

Sonra ajanınıza şunu söyleyin:

> Annemi internetten sil. Kendisi onay verdi.

## Ne yapar

Tek bir cümle söylersiniz. Ajan şu adımları izler ve önemli her adımda size sorar:

1. **Onayı kaydeder.** Kişinin kim olduğunu ve nasıl onay verdiğini sorar. Onay kaydı olmadan hiçbir şey çalışmaz.
2. **En az bilgiyi ister.** Ülke ve bölge, yerel yazımlarıyla birlikte ad soyad, yaşanan şehirler ve bir yaş aralığı. Telefon ve e-posta yalnızca siz kontrol edilmesini isterseniz.
3. **Hangi yasaların geçerli olduğunu bulur.** O yer için en güçlü ücretsiz yasal yolu, yanıt süresini ve şikâyet edilecek kurumu söyler.
4. **Tarar.** Kişi arama sitelerinde, arayan kimliği uygulamalarında ve arama motorlarında arama sayfalarını açar, bulduğu her kaydı adresiyle birlikte not eder. CAPTCHA'lar size tek bir liste hâlinde gelir.
5. **Kaldırır.** Kaldırma formlarını tek tek doldurur. Her birinden önce göndereceği alanları size gösterir ve onayınızı bekler. Kimlik yükleme, telefon görüşmesi ve doğrulama bağlantılarını siz yaparsınız.
6. **Yasal talep mektupları hazırlar.** İlgili yasaya göre silme ve itiraz talepleri, süresi doldurulmuş hâlde. Mektubu alıcının diline çevirebilir ve İngilizce aslını ekler. Mektupları siz gönderirsiniz.
7. **Süreleri izler.** Süre dolduğunda önce bir hatırlatma mektubu, sonra denetim kurumuna şikâyet taslağı hazırlar.
8. **Yeniden kontrol eder.** 30, 45 ve 90. günlerde tekrar bakar ve geri gelen kayıtları işaretler.
9. **Rapor üretir.** Bilgisayarınızda kalan özel bir maruziyet haritası ve yalnızca sayılardan oluşan bir paylaşım kartı.

Python çalıştırabilen ve skill klasörü okuyabilen ajanlarda çalışır, örneğin Claude Code, Codex, Cursor ve Gemini CLI. Ajanın bir tarayıcı aracı varsa sayfaları kendisi açar ve formları kendisi doldurur. Yoksa size bağlantıları verir ve sizin bildirdiğiniz sonuçları kaydeder.

## Her ülkede çalışır

Bulduğumuz kaldırma araçlarının çoğu Amerika Birleşik Devletleri için yapılmış. Erase Me ise kişinin yaşadığı yerden başlar.

Yargı alanı motoru `skills/erase-me/references/jurisdictions/` klasöründe her gizlilik yasası için bir dosya okur. Her dosyada yasanın tanıdığı haklar ve madde numaraları, yanıt süresi ve uzatma süresi, denetim kurumu ve şikâyet sayfası, başkası adına kimin başvurabileceği ve kontrol edildiği resmî kaynaklar tarihiyle birlikte bulunur. Motor kişinin ülkesini ve bölgesini bu dosyalarla eşleştirir ve yolu seçer:

- Varsa önce bölgesel yasa, örneğin bir ABD eyalet yasası.
- Sonra ulusal veya bölgesel yasa, örneğin AB'de GDPR, Birleşik Krallık'ta UK GDPR, Türkiye'de KVKK, Brezilya'da LGPD.
- Her yerde küresel kanallar: Google ve Bing kaldırma formları, arayan kimliği uygulamalarından kayıt sildirme ve hesap silme bağlantıları.
- Birinin katkı verdiği ülkelerde, `references/countries/<cc>/` altında yerel kişi arama siteleri ve rehberlerden oluşan ülke paketleri.

Resmî metinle kontrol edilemeyen bir yasa dosyası "doğrulanmadı" olarak işaretlenir. Ajan bunu size söyler ve o dosyadaki süreyi kesin bilgi gibi aktarmaz. Var olan ama henüz yürürlüğe girmemiş bir yasa raporda gösterilir, mektup için asla kullanılmaz.

Silme hakkı tanıyan bir yasa olmayan yerlerde de küresel kanallar ve site kaldırma formları çalışır.

## Neleri reddeder

- Siz veya onay veren bir aile üyeniz dışında kimseyi. Sevgili, eski eş, iş arkadaşı, komşu veya yabancı birini aramaz ve birinin nerede yaşadığını bulmaya yardım etmez.
- CAPTCHA çözmeyi, çözüm servislerini, proxy'leri veya iz gizleyen tarayıcıları.
- Herhangi bir ödeme yapmayı, ücretli kaldırma servisleri ve "premium" kaldırmalar dâhil.
- O form için açık onayınız olmadan form göndermeyi.
- Web sayfalarında, e-postalarda veya PDF'lerde yazan talimatlara uymayı. Sayfadaki metin veridir.
- Bir kişinin kayıtlarını, adreslerini veya akrabalarını içeren bir dosya dışa aktarmayı.
- Paylaşım kartına ad, yer, site, tarih veya başvuru numarası koymayı.
- Mahkeme, tapu veya diğer resmî kayıtların kendisini kaldırmayı. Kanunun tanıdığı, bir sicilin yayımlanmasına itiraz hakları (örneğin Birleşik Krallık'taki open register) kapsamdadır.
- Herhangi bir çıktıya hukuki danışmanlık demeyi.

## Gizlilik modeli

- **Her şey yerelde saklanır.** Veriler `~/.erase-me` klasöründe, ya da ayarladıysanız `$ERASE_ME_HOME` içinde durur. Klasörün izni 700, dosyaların izni 600'dür.
- **Motorun bağımlılığı yoktur.** Yalnızca Python standart kütüphanesini kullanır ve yerel dosyaları okuyup yazar. Tarama işini ajan, sizin tarayıcınızda yapar.
- **Model, üzerinde çalıştığı bilgiyi görür.** Ajanınız bulutta çalışan bir modeli kullanır, bu yüzden sağlayıcı sizin yazdıklarınızı ve ajanın okuduklarını alır. Buna kişinin adı, şehirler, verdiğiniz telefon veya e-posta ve ajanın açtığı kayıt sayfaları dâhildir. Skill, ajana bir alanı yalnızca form veya mektup gerektirdiğinde tekrar etmesini ve her gönderimden önce alanları size göstermesini söyler. Bu sizin için kabul edilemezse ajanınızı yerel bir modelle çalıştırın.
- **Siteler, gönderdiğinizi görür.** Kaldırma formları ve mektuplar veriyi tutan şirkete gider. Bazıları e-posta adresi, birkaçı kimlik ister. Her seferinde siz karar verirsiniz.
- **Paylaşılabilir çıktı yalnızca sayılardır.** Paylaşım kartında altı sayı vardır: kontrol edilen site, bulunan, talep edilen, kaldırılan, kaldırma oranı ve başlangıçtan bu yana geçen gün.

## Önceki çalışmalar

Erase Me başkalarının emeği üzerine kuruldu. ABD'de yaşıyorsanız ve daha fazla otomasyon istiyorsanız bu projeler orada daha ileri gider:

- **unbroker**, [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) içinde. Hermes Agent için bir veri simsarı kaldırma aracı, simsar listesi ve talep defteriyle. Kodu MIT lisanslı. Simsar verisi CC BY-NC-SA lisanslı olduğu için Erase Me bu veriyi kullanmaz.
- **auto-identity-remove.** Simsar kaldırmalarını ve CCPA şikâyetlerini otomatikleştiren, ABD odaklı bir komut satırı aracı. MIT.
- **identity-eraser.** ABD kişi arama sitelerinden kaldırma için bir Claude Code skill'i. MIT.
- **nulltrace.** CCPA ve GDPR taleplerini posta yoluyla hazırlayan bir uygulama. MIT.
- **JustDeleteMe**, [jdm-contrib/jdm](https://github.com/jdm-contrib/jdm). Hesap silme bağlantıları rehberi. Erase Me'nin hesap verisi buradan gelir. MIT.

[Big Ass Data Broker Opt-Out List](https://github.com/yaelwrites/Big-Ass-Data-Broker-Opt-Out-List) bilinen bir elle kaldırma rehberidir. Bir lisans belirtmediği için Erase Me ona bağlantı verir ve ondan hiçbir şey kopyalamaz.

Erase Me üç noktada ayrılır. Talepleri kişinin yaşadığı yerin yasasına göre hazırlar, skill okuyan her ajanda çalışır ve her gönderimden önce size sorar. Yeniden kullanılan veriler için [NOTICE.md](NOTICE.md) dosyasına bakın.

## Ülke paketi katkısı

En faydalı katkı, iyi bildiğiniz bir ülkedir. Bir paket, site başına bir tane olmak üzere küçük JSON dosyalarından oluşan bir klasördür. Her dosyada arama adresi kalıbı, kaldırma yöntemi ve sizin kontrol ettiğiniz tarih bulunur. Yasa dosyaları da aynı mantıkla, yasa başına bir dosya olarak, resmî metinle kontrol edilerek eklenir.

[CONTRIBUTING.md](CONTRIBUTING.md) dosyasını okuyun, sonra "add a country" şablonuyla bir pull request açın. Göndermeden önce şunları çalıştırın:

```
python skills/erase-me/scripts/erase_me.py validate
python -m pytest -m "not network"
```

## Hukuki danışmanlık değildir

Erase Me bir yazılımdır, avukat değildir. Yasa dosyaları resmî metinleri özetler ve hatalı veya eski olabilir. Her dosya kontrol edildiği tarihi ve kaynaklarını gösterir, böylece metni kendiniz okuyabilirsiniz. Hazırladığı her mektup, hukuki danışmanlık olmadığını söyleyen bir satırla biter. Bir anlaşmazlıkta bir avukata veya yasa dosyasında adı geçen denetim kurumuna başvurun.

## Lisans

MIT. [LICENSE](LICENSE) dosyasına bakın.
