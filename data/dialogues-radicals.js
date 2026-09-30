/* ==========================================================================
   CHINESE RADICALS (部首) & SITUATIONAL DIALOGUES (情景对话)
   HanziMaster (学中文)
   ========================================================================== */

// 30 Core Chinese Radicals with Meanings & Composite Characters
const MANDARIN_RADICALS = [
  {
    radical: "氵 (水)",
    name: "Tiga Titik Air (三点水)",
    meaning_id: "Berhubungan dengan air / cairan / sungai / laut",
    pinyin: "sān diǎn shuǐ",
    examples: [
      { char: "河", pinyin: "hé", meaning: "Sungai" },
      { char: "海", pinyin: "hǎi", meaning: "Laut" },
      { char: "洗", pinyin: "xǐ", meaning: "Mencuci" },
      { char: "渴", pinyin: "kě", meaning: "Haus" },
      { char: "波", pinyin: "bō", meaning: "Gelombang" }
    ]
  },
  {
    radical: "亻 (人)",
    name: "Orang Berdiri (单人旁)",
    meaning_id: "Berhubungan dengan manusia / orang / perilaku manusia",
    pinyin: "dān rén páng",
    examples: [
      { char: "你", pinyin: "nǐ", meaning: "Kamu" },
      { char: "他", pinyin: "tā", meaning: "Dia (laki-laki)" },
      { char: "休", pinyin: "xiū", meaning: "Istirahat" },
      { char: "体", pinyin: "tǐ", meaning: "Tubuh" },
      { char: "做", pinyin: "zuò", meaning: "Melakukan" }
    ]
  },
  {
    radical: "讠 (言)",
    name: "Bahasa / Ucapan (言字旁)",
    meaning_id: "Berhubungan dengan perkataan / bicara / bahasa / kata",
    pinyin: "yán zì páng",
    examples: [
      { char: "说", pinyin: "shuō", meaning: "Berbicara" },
      { char: "话", pinyin: "huà", meaning: "Ucapan / Perkataan" },
      { char: "请", pinyin: "qǐng", meaning: "Silakan / Memohon" },
      { char: "读", pinyin: "dú", meaning: "Membaca" },
      { char: "语", pinyin: "yǔ", meaning: "Bahasa" }
    ]
  },
  {
    radical: "木 (木)",
    name: "Kayu / Pohon (木字旁)",
    meaning_id: "Berhubungan dengan pohon / kayu / hutan / tanaman berkayu",
    pinyin: "mù zì páng",
    examples: [
      { char: "林", pinyin: "lín", meaning: "Hutan kecil" },
      { char: "树", pinyin: "shù", meaning: "Pohon" },
      { char: "桌", pinyin: "zhuō", meaning: "Meja" },
      { char: "椅", pinyin: "yǐ", meaning: "Kursi" },
      { char: "本", pinyin: "běn", meaning: "Akar / Buku" }
    ]
  },
  {
    radical: "忄/ 心 (心)",
    name: "Hati / Perasaan (竖心旁)",
    meaning_id: "Berhubungan dengan emosi / suasana hati / pikiran batin",
    pinyin: "shù xīn páng",
    examples: [
      { char: "情", pinyin: "qíng", meaning: "Perasaan / Emosi" },
      { char: "快", pinyin: "kuài", meaning: "Cepat / Gembira" },
      { char: "忙", pinyin: "máng", meaning: "Sibuk" },
      { char: "想", pinyin: "xiǎng", meaning: "Berpikir / Rindu" },
      { char: "思", pinyin: "sī", meaning: "Merenung" }
    ]
  },
  {
    radical: "口 (口)",
    name: "Mulut (口字旁)",
    meaning_id: "Berhubungan dengan mulut / makan / minum / berbicara / suara",
    pinyin: "kǒu zì páng",
    examples: [
      { char: "吃", pinyin: "chī", meaning: "Makan" },
      { char: "喝", pinyin: "hē", meaning: "Minum" },
      { char: "叫", pinyin: "jiào", meaning: "Memanggil / Bernama" },
      { char: "唱", pinyin: "chàng", meaning: "Bernyanyi" },
      { char: "听", pinyin: "tīng", meaning: "Mendengar" }
    ]
  },
  {
    radical: "扌 (手)",
    name: "Tangan (提手旁)",
    meaning_id: "Berhubungan dengan gerakan tangan / memegang / mendorong",
    pinyin: "tí shǒu páng",
    examples: [
      { char: "打", pinyin: "dǎ", meaning: "Memukul / Bermain bola" },
      { char: "找", pinyin: "zhǎo", meaning: "Mencari" },
      { char: "持", pinyin: "chí", meaning: "Memegang / Bertahan" },
      { char: "按", pinyin: "àn", meaning: "Menekan / Sesuai" },
      { char: "抓", pinyin: "zhuā", meaning: "Menangkap" }
    ]
  },
  {
    radical: "火 / 灬 (火)",
    name: "Api / Panas (火字旁 / 四点底)",
    meaning_id: "Berhubungan dengan api / panas / memasak / cahaya",
    pinyin: "huǒ zì páng",
    examples: [
      { char: "热", pinyin: "rè", meaning: "Panas" },
      { char: "烤", pinyin: "kǎo", meaning: "Memanggang" },
      { char: "点", pinyin: "diǎn", meaning: "Menyalakan / Titik" },
      { char: "烟", pinyin: "yān", meaning: "Asap / Rokok" },
      { char: "黑", pinyin: "hēi", meaning: "Hitam (hangus)" }
    ]
  },
  {
    radical: "饣/ 食 (食)",
    name: "Makanan (食字旁)",
    meaning_id: "Berhubungan dengan makanan / santapan / kelaparan / kenyang",
    pinyin: "shí zì páng",
    examples: [
      { char: "饭", pinyin: "fàn", meaning: "Nasi / Makanan" },
      { char: "饱", pinyin: "bǎo", meaning: "Kenyang" },
      { char: "饿", pinyin: "è", meaning: "Lapar" },
      { char: "饮", pinyin: "yǐn", meaning: "Minuman" },
      { char: "馆", pinyin: "guǎn", meaning: "Restoran / Gedung" }
    ]
  },
  {
    radical: "女 (女)",
    name: "Wanita (女字旁)",
    meaning_id: "Berhubungan dengan perempuan / hubungan keluarga wanita",
    pinyin: "nǚ zì páng",
    examples: [
      { char: "妈", pinyin: "mā", meaning: "Ibu" },
      { char: "姐", pinyin: "jiě", meaning: "Kakak perempuan" },
      { char: "妹", pinyin: "mèi", meaning: "Adik perempuan" },
      { char: "奶", pinyin: "nǎi", meaning: "Nenek" },
      { char: "好", pinyin: "hǎo", meaning: "Bagus / Baik" }
    ]
  }
];

// Situational Dialogues (Percakapan Sehari-hari)
const SITUATIONAL_DIALOGUES = [
  {
    id: "dia_01",
    title: "Di Restoran (在餐厅点餐)",
    category: "Makanan & Restoran",
    icon: "fa-utensils",
    lines: [
      { speaker: "Pelayan (服务员)", cn: "您好，请问几位？", py: "Nǐn hǎo, qǐngwèn jǐ wèi?", id: "Halo, untuk berapa orang?" },
      { speaker: "Kamu (你)", cn: "两位，请给我们靠窗的座位。", py: "Liǎng wèi, qǐng gěi wǒmen kào chuāng de zuòwèi.", id: "Dua orang, tolong beri kami meja di dekat jendela." },
      { speaker: "Pelayan (服务员)", cn: "好的，这是菜单。请问想喝点什么？", py: "Hǎo de, zhè shì càidān. Qǐngwèn xiǎng hē diǎn shénme?", id: "Baik, ini buku menunya. Ingin minum apa?" },
      { speaker: "Kamu (你)", cn: "来一杯热绿茶和一杯冰水，谢谢！", py: "Lái yī bēi rè lǜchá hé yī bēi bīng shuǐ, xièxie!", id: "Minta secangkir teh hijau hangat dan segelas air es, terima kasih!" },
      { speaker: "Pelayan (服务员)", cn: "好的，马上为您准备。", py: "Hǎo de, mǎshàng wèi nín zhǔnbèi.", id: "Baik, segera kami persiapkan untuk Anda." }
    ]
  },
  {
    id: "dia_02",
    title: "Belanja & Menawar Harga (在商场买衣服)",
    category: "Belanja & Pasar",
    icon: "fa-shopping-bag",
    lines: [
      { speaker: "Penjual (老板)", cn: "帅哥/美女，看看这件衣服，很适合你！", py: "Shuàigē/Měinǚ, kànkan zhè jiàn yīfu, hěn shìhé nǐ!", id: "Kak, lihat baju ini, sangat cocok untukmu!" },
      { speaker: "Kamu (你)", cn: "请问这件衣服多少钱？", py: "Qǐngwèn zhè jiàn yīfu duōshao qián?", id: "Numpang tanya, baju ini harganya berapa?" },
      { speaker: "Penjual (老板)", cn: "原价两百块，今天给你打折，一百八！", py: "Yuánjià liǎngbǎi kuài, jīntiān gěi nǐ dǎzhé, yībǎi bā!", id: "Harga aslinya 200 yuan, hari ini diskon untukmu jadi 180!" },
      { speaker: "Kamu (你)", cn: "有点贵，一百五可以吗？如果可以我就买。", py: "Yǒudiǎn guì, yībǎi wǔ kěyǐ ma? Rúguǒ kěyǐ wǒ jiù mǎi.", id: "Agak mahal, apakah 150 boleh? Kalau boleh saya ambil." },
      { speaker: "Penjual (老板)", cn: "行吧行吧，交个朋友，给你打包！", py: "Xíng ba xíng ba, jiāo gè péngyou, gěi nǐ dǎbāo!", id: "Bolehlah, hitung-hitung teman baru, saya bungkuskan!" }
    ]
  },
  {
    id: "dia_03",
    title: "Bertanya Arah Jalan (问路)",
    category: "Transportasi & Arah",
    icon: "fa-map-marked-alt",
    lines: [
      { speaker: "Kamu (你)", cn: "请问，去最近的地铁站怎么走？", py: "Qǐngwèn, qù zuìjìn de dìtiězhàn zěnme zǒu?", id: "Permisi, bagaimana jalan menuju stasiun MRT terdekat?" },
      { speaker: "Pejalan Kaki (路人)", cn: "一直往前走，在第二个路口向左拐。", py: "Yīzhí wǎng qián zǒu, zài dì-èr gè lùkǒu xiàng zuǒ guǎi.", id: "Jalan lurus terus ke depan, di perempatan kedua belok ke kiri." },
      { speaker: "Kamu (你)", cn: "大概需要走多长时间？", py: "Dàgài xūyào zǒu duō cháng shíjiān?", id: "Kira-kira perlu jalan kaki berapa lama?" },
      { speaker: "Pejalan Kaki (路人)", cn: "大概五分钟就能看到进站口了。", py: "Dàgài wǔ fēnzhōng jiù néng kàndào jìnzhànkǒu le.", id: "Kira-kira 5 menit sudah bisa melihat pintu masuk stasiunnya." },
      { speaker: "Kamu (你)", cn: "太感谢你了！祝你今天愉快！", py: "Tài gǎnxiè nǐ le! Zhù nǐ jīntiān yúkuài!", id: "Terima kasih banyak! Semoga harimu menyenangkan!" }
    ]
  }
];
