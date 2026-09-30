/* ==========================================================================
   HanziMaster (学中文) Application Engine
   Features: HSK 1-5 Vocab, Flashcards 3D, Quiz Arena, Custom Vocab Maker,
   Hanzi Writing Canvas, Tone Ear Trainer, Web Audio & Web Speech Synthesis
   ========================================================================== */

// --- State Management ---
const STATE = {
  currentTab: 'vocab',
  selectedHsk: 'all',
  searchQuery: '',
  filterBookmarkOnly: false,
  filterLearnedOnly: false,
  dictSearchQuery: '',
  dictCategory: 'all',
  dictAlpha: 'ALL',
  flashcardIndex: 0,
  flashcardDeck: [],
  activeQuiz: null,
  bookmarks: JSON.parse(localStorage.getItem('hz_bookmarks') || '[]'),
  learned: JSON.parse(localStorage.getItem('hz_learned') || '[]'),
  customVocab: JSON.parse(localStorage.getItem('hz_custom_vocab') || '[]'),
  stats: JSON.parse(localStorage.getItem('hz_stats') || JSON.stringify({
    xp: 0,
    quizzesCompleted: 0,
    perfectScores: 0,
    streak: 1,
    lastActiveDate: new Date().toDateString()
  })),
  canvasStrokeHanzi: '你',
  showGhostHanzi: true
};

// --- Web Audio Synthesizer for UI SFX ---
const SFX = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  },
  playTone(freq, type, duration, gainVal = 0.15) {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  },
  correct() {
    this.playTone(523.25, 'sine', 0.15, 0.2); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.2), 120); // E5
    setTimeout(() => this.playTone(783.99, 'sine', 0.35, 0.2), 240); // G5
  },
  wrong() {
    this.playTone(280, 'sawtooth', 0.2, 0.15);
    setTimeout(() => this.playTone(220, 'sawtooth', 0.3, 0.15), 180);
  },
  click() {
    this.playTone(800, 'sine', 0.05, 0.05);
  },
  levelUp() {
    [440, 554.37, 659.25, 880].forEach((freq, idx) => {
      setTimeout(() => this.playTone(freq, 'triangle', 0.25, 0.25), idx * 100);
    });
  }
};

// --- Speech Synthesis (TTS Mandarin) ---
function speakMandarin(text, rate = 0.85) {
  if (!('speechSynthesis' in window)) {
    showToast('Browser tidak mendukung Speech Synthesis.', 'error');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = rate;
  utterance.pitch = 1.0;

  // Try to pick a Chinese voice if available
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find(v => v.lang.includes('zh') || v.lang.includes('cmn') || v.name.includes('Chinese'));
  if (zhVoice) {
    utterance.voice = zhVoice;
  }

  window.speechSynthesis.speak(utterance);
}

// Ensure voices are loaded
if ('speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// --- Persistence Helpers ---
function saveState() {
  localStorage.setItem('hz_bookmarks', JSON.stringify(STATE.bookmarks));
  localStorage.setItem('hz_learned', JSON.stringify(STATE.learned));
  localStorage.setItem('hz_custom_vocab', JSON.stringify(STATE.customVocab));
  localStorage.setItem('hz_stats', JSON.stringify(STATE.stats));
  updateStatsDisplay();

  // Auto-sync to Firebase if logged in
  if (typeof syncToCloud === 'function' && typeof FIREBASE_APP_STATE !== 'undefined' && FIREBASE_APP_STATE.currentUser) {
    syncToCloud();
  }
}

function checkDailyStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (STATE.stats.lastActiveDate === yesterday) {
    STATE.stats.streak += 1;
  } else if (STATE.stats.lastActiveDate !== today) {
    STATE.stats.streak = 1;
  }
  STATE.stats.lastActiveDate = today;
  saveState();
}

function addXP(amount) {
  STATE.stats.xp += amount;
  saveState();
}

function getRankTitle(xp) {
  if (xp >= 2000) return { title: '一代宗师 (Grandmaster)', icon: '👑' };
  if (xp >= 1200) return { title: '状元 (Top Scholar)', icon: '🥇' };
  if (xp >= 700) return { title: '榜眼 (Master)', icon: '🥈' };
  if (xp >= 400) return { title: '探花 (Scholar)', icon: '🥉' };
  if (xp >= 200) return { title: '进士 (Adept)', icon: '📜' };
  if (xp >= 80) return { title: '举人 (Practitioner)', icon: '🎋' };
  return { title: '秀才 (Novice)', icon: '🌱' };
}

function updateStatsDisplay() {
  const totalWordsLearned = STATE.learned.length;
  const rank = getRankTitle(STATE.stats.xp);

  const elWords = document.getElementById('statTotalLearned');
  const elQuiz = document.getElementById('statTotalQuiz');
  const elRank = document.getElementById('statUserRank');
  const elStreak = document.getElementById('streakDisplay');

  if (elWords) elWords.textContent = totalWordsLearned;
  if (elQuiz) elQuiz.textContent = STATE.stats.quizzesCompleted;
  if (elRank) elRank.textContent = rank.title.split(' ')[0];
  if (elStreak) elStreak.textContent = `${STATE.stats.streak} Hari`;

  // Update counts on HSK filter pills
  const counts = {
    all: getAllVocab().length + STATE.customVocab.length,
    1: HSK_DATABASE.hsk1.length,
    2: HSK_DATABASE.hsk2.length,
    3: HSK_DATABASE.hsk3.length,
    4: HSK_DATABASE.hsk4.length,
    5: HSK_DATABASE.hsk5.length,
    custom: STATE.customVocab.length
  };

  document.querySelectorAll('.hsk-pill[data-hsk]').forEach(pill => {
    const hsk = pill.getAttribute('data-hsk');
    const badge = pill.querySelector('.badge-count');
    if (badge && counts[hsk] !== undefined) {
      badge.textContent = counts[hsk];
    }
  });

  const dictCountEl = document.getElementById('dictTotalWords');
  if (dictCountEl) {
    dictCountEl.textContent = getAllVocab().length + STATE.customVocab.length;
  }
}

// --- Dictionary Explorer Logic ---
function getFilteredDictionaryList() {
  let list = [...getAllVocab(), ...STATE.customVocab];

  // Category or Level Filter
  if (STATE.dictCategory !== 'all') {
    if (['1', '2', '3', '4', '5'].includes(STATE.dictCategory)) {
      list = list.filter(item => String(item.level) === STATE.dictCategory);
    } else {
      list = list.filter(item => item.pos && item.pos.toLowerCase().includes(STATE.dictCategory.toLowerCase()));
    }
  }

  // Alphabet Pinyin Initial Filter
  if (STATE.dictAlpha !== 'ALL') {
    list = list.filter(item => {
      const pinyinFirst = (item.pinyin || '').trim().toUpperCase().charAt(0);
      return pinyinFirst === STATE.dictAlpha;
    });
  }

  // Search Filter
  if (STATE.dictSearchQuery.trim()) {
    const q = STATE.dictSearchQuery.trim().toLowerCase();
    list = list.filter(item =>
      item.hanzi.toLowerCase().includes(q) ||
      item.pinyin.toLowerCase().includes(q) ||
      (item.meaning_id && item.meaning_id.toLowerCase().includes(q)) ||
      (item.meaning_en && item.meaning_en.toLowerCase().includes(q)) ||
      (item.pos && item.pos.toLowerCase().includes(q))
    );
  }

  return list;
}

function renderDictionary() {
  const container = document.getElementById('dictionaryResultsContainer');
  if (!container) return;

  const items = getFilteredDictionaryList();
  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.4;"></i>
        <h3>Tidak ditemukan kata dalam kamus</h3>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Coba cari dengan kata kunci lain atau pilih abjad 'SEMUA'.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const isFav = STATE.bookmarks.includes(item.id);
    const isLearned = STATE.learned.includes(item.id);
    const levelClass = item.level ? `hsk${item.level}` : 'custom';
    const levelLabel = item.level ? `HSK ${item.level}` : (item.pos || 'Kamus');

    return `
      <div class="vocab-card" id="dict-${item.id}">
        <div class="card-top">
          <span class="hsk-level-tag ${levelClass}">${levelLabel}</span>
          <div class="card-quick-actions">
            <button class="card-btn" title="Dengarkan Suara" onclick="speakMandarin('${item.hanzi}')">
              <i class="fas fa-volume-up"></i>
            </button>
            <button class="card-btn ${isFav ? 'favorited' : ''}" title="Simpan Bookmark" onclick="toggleBookmark('${item.id}')">
              <i class="${isFav ? 'fas fa-heart' : 'far fa-heart'}"></i>
            </button>
            <button class="card-btn ${isLearned ? 'learned' : ''}" title="Tandai Sudah Hafal" onclick="toggleLearned('${item.id}')">
              <i class="${isLearned ? 'fas fa-check-circle' : 'far fa-check-circle'}"></i>
            </button>
          </div>
        </div>

        <div class="card-main">
          <div class="card-hanzi">${item.hanzi}</div>
          <div class="card-pinyin">${item.pinyin}</div>
          <div class="card-meaning-id">${item.meaning_id}</div>
          ${item.meaning_en ? `<div class="card-meaning-en">${item.meaning_en}</div>` : ''}
          ${item.pos ? `<span class="card-pos">${item.pos}</span>` : ''}
        </div>

        ${item.example_cn ? `
          <div class="card-example">
            <div class="example-cn">${item.example_cn}</div>
            <div class="example-py">${item.example_py || ''}</div>
            <div class="example-id">${item.example_id || ''}</div>
          </div>
        ` : ''}

        <div class="card-footer">
          <button class="practice-btn" onclick="openPracticeCanvas('${item.hanzi}')">
            <i class="fas fa-pen-nib"></i> Latihan Tulis
          </button>
          <button class="practice-btn" onclick="openFlashcardForWord('${item.id}')">
            <i class="fas fa-clone"></i> Flashcard
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterDictByAlpha(alpha) {
  SFX.click();
  STATE.dictAlpha = alpha;
  document.querySelectorAll('#dictAlphaBar .dict-alpha-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.trim() === alpha || (alpha === 'ALL' && btn.textContent.trim() === 'SEMUA'));
  });
  renderDictionary();
}

// --- Toast Notifications ---
function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'fa-info-circle';
  if (type === 'success') icon = 'fa-check-circle';
  if (type === 'error') icon = 'fa-exclamation-circle';
  toast.innerHTML = `<i class="fas ${icon}"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// --- Vocabulary List Generation & Filtering ---
function getFilteredVocabList() {
  let list = [];
  if (STATE.selectedHsk === 'all') {
    list = [...getAllVocab(), ...STATE.customVocab];
  } else if (STATE.selectedHsk === 'custom') {
    list = [...STATE.customVocab];
  } else {
    const levelKey = `hsk${STATE.selectedHsk}`;
    list = HSK_DATABASE[levelKey] ? [...HSK_DATABASE[levelKey]] : [];
  }

  // Filter Search
  if (STATE.searchQuery.trim()) {
    const q = STATE.searchQuery.trim().toLowerCase();
    list = list.filter(item =>
      item.hanzi.toLowerCase().includes(q) ||
      item.pinyin.toLowerCase().includes(q) ||
      (item.meaning_id && item.meaning_id.toLowerCase().includes(q)) ||
      (item.meaning_en && item.meaning_en.toLowerCase().includes(q))
    );
  }

  // Filter Bookmarks
  if (STATE.filterBookmarkOnly) {
    list = list.filter(item => STATE.bookmarks.includes(item.id));
  }

  // Filter Learned
  if (STATE.filterLearnedOnly) {
    list = list.filter(item => STATE.learned.includes(item.id));
  }

  return list;
}

function renderVocabCards() {
  const container = document.getElementById('vocabGrid');
  if (!container) return;

  const items = getFilteredVocabList();
  if (items.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-muted);">
        <i class="fas fa-search" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.4;"></i>
        <h3>Tidak ada kosakata yang cocok</h3>
        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Coba ubah kata kunci pencarian atau ganti filter HSK.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => {
    const isFav = STATE.bookmarks.includes(item.id);
    const isLearned = STATE.learned.includes(item.id);
    const levelClass = item.level ? `hsk${item.level}` : 'custom';
    const levelLabel = item.level ? `HSK ${item.level}` : 'CUSTOM';

    return `
      <div class="vocab-card" id="card-${item.id}">
        <div class="card-top">
          <span class="hsk-level-tag ${levelClass}">${levelLabel}</span>
          <div class="card-quick-actions">
            <button class="card-btn" title="Dengarkan Suara" onclick="speakMandarin('${item.hanzi}')">
              <i class="fas fa-volume-up"></i>
            </button>
            <button class="card-btn ${isFav ? 'favorited' : ''}" title="Simpan Bookmark" onclick="toggleBookmark('${item.id}')">
              <i class="${isFav ? 'fas fa-heart' : 'far fa-heart'}"></i>
            </button>
            <button class="card-btn ${isLearned ? 'learned' : ''}" title="Tandai Sudah Hafal" onclick="toggleLearned('${item.id}')">
              <i class="${isLearned ? 'fas fa-check-circle' : 'far fa-check-circle'}"></i>
            </button>
          </div>
        </div>

        <div class="card-main">
          <div class="card-hanzi">${item.hanzi}</div>
          <div class="card-pinyin">${item.pinyin}</div>
          <div class="card-meaning-id">${item.meaning_id}</div>
          ${item.meaning_en ? `<div class="card-meaning-en">${item.meaning_en}</div>` : ''}
          ${item.pos ? `<span class="card-pos">${item.pos}</span>` : ''}
        </div>

        ${item.example_cn ? `
          <div class="card-example">
            <div class="example-cn">${item.example_cn}</div>
            <div class="example-py">${item.example_py || ''}</div>
            <div class="example-id">${item.example_id || ''}</div>
          </div>
        ` : ''}

        <div class="card-footer">
          <button class="practice-btn" onclick="openPracticeCanvas('${item.hanzi}')">
            <i class="fas fa-pen-nib"></i> Latihan Tulis
          </button>
          <button class="practice-btn" onclick="openFlashcardForWord('${item.id}')">
            <i class="fas fa-clone"></i> Flashcard
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function toggleBookmark(id) {
  SFX.click();
  const index = STATE.bookmarks.indexOf(id);
  if (index > -1) {
    STATE.bookmarks.splice(index, 1);
    showToast('Dihapus dari Bookmark', 'info');
  } else {
    STATE.bookmarks.push(id);
    showToast('Disimpan ke Bookmark!', 'success');
  }
  saveState();
  renderVocabCards();
}

function toggleLearned(id) {
  SFX.click();
  const index = STATE.learned.indexOf(id);
  if (index > -1) {
    STATE.learned.splice(index, 1);
    showToast('Status hafal dihapus', 'info');
  } else {
    STATE.learned.push(id);
    addXP(10);
    showToast('Hebat! +10 XP berhasil dipelajari', 'success');
  }
  saveState();
  renderVocabCards();
}

// --- Flashcard 3D Interactive Mode ---
function initFlashcardMode() {
  STATE.flashcardDeck = getFilteredVocabList();
  if (STATE.flashcardDeck.length === 0) {
    STATE.flashcardDeck = getAllVocab();
  }
  STATE.flashcardIndex = 0;
  renderFlashcard();
}

function openFlashcardForWord(id) {
  switchTab('flashcards');
  STATE.flashcardDeck = getFilteredVocabList();
  const foundIdx = STATE.flashcardDeck.findIndex(i => i.id === id);
  if (foundIdx !== -1) {
    STATE.flashcardIndex = foundIdx;
  }
  renderFlashcard();
}

function renderFlashcard() {
  const box = document.getElementById('flashcardBox');
  const card = STATE.flashcardDeck[STATE.flashcardIndex];
  if (!box || !card) return;

  box.classList.remove('flipped');

  const frontHanzi = document.getElementById('fcFrontHanzi');
  const frontLevel = document.getElementById('fcFrontLevel');
  const frontHint = document.getElementById('fcFrontHint');

  const backHanzi = document.getElementById('fcBackHanzi');
  const backPinyin = document.getElementById('fcBackPinyin');
  const backMeaning = document.getElementById('fcBackMeaning');
  const backExample = document.getElementById('fcBackExample');
  const progressText = document.getElementById('fcProgressText');

  if (frontHanzi) frontHanzi.textContent = card.hanzi;
  if (frontLevel) frontLevel.textContent = card.level ? `HSK ${card.level}` : 'CUSTOM';
  if (frontHint) frontHint.textContent = card.pos ? `Jenis Kata: ${card.pos}` : 'Klik untuk membalik kartu';

  if (backHanzi) backHanzi.textContent = card.hanzi;
  if (backPinyin) backPinyin.textContent = card.pinyin;
  if (backMeaning) backMeaning.textContent = card.meaning_id;
  if (backExample) {
    if (card.example_cn) {
      backExample.innerHTML = `
        <div style="font-size:0.95rem; color:var(--text-primary); margin-bottom:0.25rem;">${card.example_cn}</div>
        <div style="font-size:0.85rem; color:var(--gold-400); margin-bottom:0.25rem;">${card.example_py || ''}</div>
        <div style="font-size:0.85rem; color:var(--text-muted);">${card.example_id || ''}</div>
      `;
    } else {
      backExample.innerHTML = '';
    }
  }

  if (progressText) {
    progressText.textContent = `${STATE.flashcardIndex + 1} / ${STATE.flashcardDeck.length}`;
  }
}

function flipFlashcard() {
  SFX.click();
  const box = document.getElementById('flashcardBox');
  if (box) box.classList.toggle('flipped');
}

function nextFlashcard() {
  if (STATE.flashcardIndex < STATE.flashcardDeck.length - 1) {
    STATE.flashcardIndex++;
  } else {
    STATE.flashcardIndex = 0; // Loop back
  }
  renderFlashcard();
}

function prevFlashcard() {
  if (STATE.flashcardIndex > 0) {
    STATE.flashcardIndex--;
  } else {
    STATE.flashcardIndex = STATE.flashcardDeck.length - 1;
  }
  renderFlashcard();
}

function shuffleFlashcard() {
  SFX.click();
  STATE.flashcardDeck = [...STATE.flashcardDeck].sort(() => Math.random() - 0.5);
  STATE.flashcardIndex = 0;
  renderFlashcard();
  showToast('Flashcard berhasil diacak!', 'info');
}

// --- Quiz Engine & Quiz Maker ---
const QUIZ_ENGINE = {
  config: {
    level: 'all',
    mode: 'hanzi_to_meaning', // 'hanzi_to_meaning', 'pinyin_to_hanzi', 'meaning_to_hanzi', 'listening'
    questionCount: 10,
    timerSeconds: 15
  },
  questions: [],
  currentIndex: 0,
  score: 0,
  timerInterval: null,
  timeLeft: 0,
  userAnswers: [],

  generateQuestions() {
    let pool = [];
    if (this.config.level === 'all') {
      pool = getAllVocab();
    } else if (this.config.level === 'custom') {
      pool = STATE.customVocab.length > 0 ? STATE.customVocab : getAllVocab();
    } else {
      const levelKey = `hsk${this.config.level}`;
      pool = HSK_DATABASE[levelKey] || getAllVocab();
    }

    if (pool.length < 4) {
      pool = getAllVocab();
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const count = Math.min(this.config.questionCount, shuffled.length);
    const selected = shuffled.slice(0, count);

    this.questions = selected.map(item => {
      // Pick 3 distractors from the whole database
      const distractors = getAllVocab()
        .filter(v => v.id !== item.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);

      const options = [item, ...distractors].sort(() => Math.random() - 0.5);

      return {
        target: item,
        options: options,
        mode: this.config.mode
      };
    });

    this.currentIndex = 0;
    this.score = 0;
    this.userAnswers = [];
  },

  start() {
    this.generateQuestions();
    document.getElementById('quizSetupCard').style.display = 'none';
    document.getElementById('quizPlayCard').style.display = 'flex';
    document.getElementById('quizResultCard').style.display = 'none';
    this.renderQuestion();
  },

  renderQuestion() {
    clearInterval(this.timerInterval);
    const q = this.questions[this.currentIndex];
    if (!q) {
      this.finish();
      return;
    }

    // Progress Bar
    const progressPct = ((this.currentIndex) / this.questions.length) * 100;
    document.getElementById('quizProgressBar').style.width = `${progressPct}%`;
    document.getElementById('quizCountDisplay').textContent = `Soal ${this.currentIndex + 1} dari ${this.questions.length}`;

    // Prompt content based on mode
    const promptSub = document.getElementById('quizPromptSub');
    const promptMain = document.getElementById('quizPromptMain');
    const promptPinyin = document.getElementById('quizPromptPinyin');
    const audioBtn = document.getElementById('quizAudioBtn');

    audioBtn.style.display = 'none';

    if (q.mode === 'hanzi_to_meaning') {
      promptSub.textContent = 'Pilihlah arti bahasa Indonesia yang benar:';
      promptMain.textContent = q.target.hanzi;
      promptPinyin.textContent = q.target.pinyin;
    } else if (q.mode === 'pinyin_to_hanzi') {
      promptSub.textContent = 'Pilihlah karakter Hanzi yang sesuai dengan Pinyin:';
      promptMain.textContent = q.target.pinyin;
      promptPinyin.textContent = `Arti: ${q.target.meaning_id}`;
    } else if (q.mode === 'meaning_to_hanzi') {
      promptSub.textContent = 'Pilihlah karakter Hanzi & Pinyin untuk arti berikut:';
      promptMain.textContent = q.target.meaning_id;
      promptPinyin.textContent = q.target.pos ? `[${q.target.pos}]` : '';
    } else if (q.mode === 'listening') {
      promptSub.textContent = 'Dengarkan audio dan pilih karakter Hanzi yang tepat:';
      promptMain.textContent = '🔊';
      promptPinyin.textContent = 'Klik tombol untuk memutar ulang audio';
      audioBtn.style.display = 'inline-flex';
      speakMandarin(q.target.hanzi);
    }

    // Render Options
    const optionsContainer = document.getElementById('quizOptionsGrid');
    const letters = ['A', 'B', 'C', 'D'];

    optionsContainer.innerHTML = q.options.map((opt, idx) => {
      let labelText = '';
      if (q.mode === 'hanzi_to_meaning') {
        labelText = opt.meaning_id;
      } else if (q.mode === 'pinyin_to_hanzi' || q.mode === 'listening') {
        labelText = `${opt.hanzi} (${opt.pinyin})`;
      } else if (q.mode === 'meaning_to_hanzi') {
        labelText = `${opt.hanzi} [${opt.pinyin}]`;
      }

      return `
        <button class="quiz-option-btn" onclick="QUIZ_ENGINE.chooseAnswer('${opt.id}', this)">
          <span class="quiz-option-letter">${letters[idx]}</span>
          <span style="flex:1;">${labelText}</span>
        </button>
      `;
    }).join('');

    // Start Countdown Timer
    this.timeLeft = this.config.timerSeconds;
    this.updateTimerDisplay();
    this.timerInterval = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();
      if (this.timeLeft <= 0) {
        clearInterval(this.timerInterval);
        this.handleTimeout();
      }
    }, 1000);
  },

  updateTimerDisplay() {
    const el = document.getElementById('quizTimerDisplay');
    if (el) el.innerHTML = `<i class="fas fa-clock"></i> ${this.timeLeft}s`;
  },

  chooseAnswer(selectedId, buttonEl) {
    clearInterval(this.timerInterval);
    const q = this.questions[this.currentIndex];
    const isCorrect = selectedId === q.target.id;

    // Disable all options
    document.querySelectorAll('.quiz-option-btn').forEach(btn => {
      btn.classList.add('disabled');
      btn.style.pointerEvents = 'none';
    });

    if (isCorrect) {
      SFX.correct();
      buttonEl.classList.add('correct');
      this.score++;
    } else {
      SFX.wrong();
      buttonEl.classList.add('wrong');
      // Highlight the correct one
      document.querySelectorAll('.quiz-option-btn').forEach((btn, idx) => {
        if (q.options[idx].id === q.target.id) {
          btn.classList.add('correct');
        }
      });
    }

    this.userAnswers.push({
      question: q,
      selectedId: selectedId,
      isCorrect: isCorrect
    });

    setTimeout(() => {
      this.currentIndex++;
      this.renderQuestion();
    }, 1200);
  },

  handleTimeout() {
    SFX.wrong();
    const q = this.questions[this.currentIndex];
    document.querySelectorAll('.quiz-option-btn').forEach((btn, idx) => {
      btn.classList.add('disabled');
      btn.style.pointerEvents = 'none';
      if (q.options[idx].id === q.target.id) {
        btn.classList.add('correct');
      }
    });

    this.userAnswers.push({
      question: q,
      selectedId: null,
      isCorrect: false
    });

    showToast('Waktu habis!', 'error');

    setTimeout(() => {
      this.currentIndex++;
      this.renderQuestion();
    }, 1200);
  },

  finish() {
    clearInterval(this.timerInterval);
    document.getElementById('quizPlayCard').style.display = 'none';
    document.getElementById('quizResultCard').style.display = 'block';

    const total = this.questions.length;
    const accuracy = Math.round((this.score / total) * 100);
    const xpGained = this.score * 15 + (accuracy === 100 ? 50 : 0);

    STATE.stats.quizzesCompleted++;
    if (accuracy === 100) STATE.stats.perfectScores++;
    addXP(xpGained);

    if (accuracy >= 80) SFX.levelUp();

    document.getElementById('resultScoreDisplay').textContent = `${this.score} / ${total}`;
    document.getElementById('resultAccuracyDisplay').textContent = `${accuracy}%`;
    document.getElementById('resultXpDisplay').textContent = `+${xpGained} XP`;

    // Render Review Breakdown
    const breakdownEl = document.getElementById('quizBreakdownList');
    if (breakdownEl) {
      breakdownEl.innerHTML = this.userAnswers.map((ans, i) => {
        const item = ans.question.target;
        return `
          <div style="background:var(--bg-secondary); border-radius:var(--radius-sm); padding:0.85rem; margin-bottom:0.6rem; border-left: 4px solid ${ans.isCorrect ? 'var(--jade-400)' : 'var(--crimson-500)'}; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span style="font-weight:700; font-size:1.1rem; color:var(--text-primary); font-family:var(--font-hanzi);">${item.hanzi}</span>
              <span style="color:var(--gold-400); margin-left:0.5rem; font-size:0.9rem;">${item.pinyin}</span>
              <div style="color:var(--text-secondary); font-size:0.85rem; margin-top:0.2rem;">${item.meaning_id}</div>
            </div>
            <span style="font-size:1.2rem; color:${ans.isCorrect ? 'var(--jade-400)' : 'var(--crimson-500)'};">
              ${ans.isCorrect ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>'}
            </span>
          </div>
        `;
      }).join('');
    }
  },

  restart() {
    document.getElementById('quizSetupCard').style.display = 'block';
    document.getElementById('quizPlayCard').style.display = 'none';
    document.getElementById('quizResultCard').style.display = 'none';
  }
};

// --- Hanzi Stroke Practice Canvas ---
let canvas, ctx, isDrawing = false;

function initCanvas() {
  canvas = document.getElementById('hanziCanvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  // Set crisp resolution
  canvas.width = 320;
  canvas.height = 320;

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#be123c';
  ctx.lineWidth = 10;

  // Mouse Events
  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDraw);
  canvas.addEventListener('mouseleave', stopDraw);

  // Touch Events for Mobile / Tablet
  canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    isDrawing = true;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  }, { passive: false });

  canvas.addEventListener('touchend', stopDraw);
}

function startDraw(e) {
  isDrawing = true;
  ctx.beginPath();
  const rect = canvas.getBoundingClientRect();
  ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
}

function draw(e) {
  if (!isDrawing) return;
  const rect = canvas.getBoundingClientRect();
  ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
  ctx.stroke();
}

function stopDraw() {
  if (isDrawing) {
    ctx.closePath();
    isDrawing = false;
  }
}

function clearCanvas() {
  SFX.click();
  if (ctx && canvas) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function setCanvasStrokeHanzi(char) {
  STATE.canvasStrokeHanzi = char;
  const ghost = document.getElementById('canvasGhostChar');
  const targetLabel = document.getElementById('canvasTargetLabel');
  if (ghost) ghost.textContent = char;
  if (targetLabel) targetLabel.textContent = char;
  clearCanvas();
}

function toggleGhostHanzi() {
  SFX.click();
  STATE.showGhostHanzi = !STATE.showGhostHanzi;
  const ghost = document.getElementById('canvasGhostChar');
  if (ghost) ghost.style.opacity = STATE.showGhostHanzi ? '0.15' : '0';
}

function openPracticeCanvas(char) {
  switchTab('practice');
  setCanvasStrokeHanzi(char[0] || '你');
}

// --- Custom Vocab Maker Management ---
function handleAddCustomVocab(e) {
  e.preventDefault();
  const hanzi = document.getElementById('customHanzi').value.trim();
  const pinyin = document.getElementById('customPinyin').value.trim();
  const meaningId = document.getElementById('customMeaningId').value.trim();
  const meaningEn = document.getElementById('customMeaningEn').value.trim();
  const pos = document.getElementById('customPos').value.trim();
  const exCn = document.getElementById('customExCn').value.trim();
  const exPy = document.getElementById('customExPy').value.trim();
  const exId = document.getElementById('customExId').value.trim();
  const level = parseInt(document.getElementById('customLevelSelect').value, 10);

  if (!hanzi || !pinyin || !meaningId) {
    showToast('Harap isi Hanzi, Pinyin, dan Arti!', 'error');
    return;
  }

  const newWord = {
    id: `custom_${Date.now()}`,
    hanzi,
    pinyin,
    meaning_id: meaningId,
    meaning_en: meaningEn || '',
    pos: pos || 'Umum',
    level: level,
    example_cn: exCn || '',
    example_py: exPy || '',
    example_id: exId || ''
  };

  STATE.customVocab.unshift(newWord);
  saveState();
  showToast(`Kosakata "${hanzi}" berhasil ditambahkan!`, 'success');
  SFX.correct();

  // Reset form
  document.getElementById('customVocabForm').reset();
  renderCustomVocabList();
  renderVocabCards();
}

function deleteCustomVocab(id) {
  SFX.click();
  if (confirm('Yakin ingin menghapus kosakata ini?')) {
    STATE.customVocab = STATE.customVocab.filter(v => v.id !== id);
    saveState();
    showToast('Kosakata berhasil dihapus', 'info');
    renderCustomVocabList();
    renderVocabCards();
  }
}

function renderCustomVocabList() {
  const container = document.getElementById('customVocabTableBody');
  if (!container) return;

  if (STATE.customVocab.length === 0) {
    container.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; color:var(--text-muted); padding:2rem;">
          Belum ada kosakata kustom. Buat kosakata baru menggunakan formulir di sebelah kiri!
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = STATE.customVocab.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td style="font-family:var(--font-hanzi); font-size:1.3rem; font-weight:700;">${item.hanzi}</td>
      <td style="color:var(--gold-400);">${item.pinyin}</td>
      <td>${item.meaning_id}</td>
      <td>
        <button class="card-btn" title="Dengarkan" onclick="speakMandarin('${item.hanzi}')"><i class="fas fa-volume-up"></i></button>
        <button class="card-btn" title="Hapus" style="color:var(--crimson-500);" onclick="deleteCustomVocab('${item.id}')"><i class="fas fa-trash-alt"></i></button>
      </td>
    </tr>
  `).join('');
}

function exportCustomVocabJSON() {
  SFX.click();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(STATE.customVocab, null, 2));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", `hanzimaster_custom_vocab_${new Date().toISOString().slice(0,10)}.json`);
  dlAnchor.click();
  showToast('Daftar kosakata kustom berhasil diunduh!', 'success');
}

function importCustomVocabJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        STATE.customVocab = [...imported, ...STATE.customVocab];
        saveState();
        renderCustomVocabList();
        renderVocabCards();
        showToast(`Berhasil mengimpor ${imported.length} kosakata!`, 'success');
      } else {
        showToast('Format JSON tidak valid!', 'error');
      }
    } catch (err) {
      showToast('Gagal membaca file JSON!', 'error');
    }
  };
  reader.readAsText(file);
}

// --- Tone Ear Trainer ---
const TONE_SAMPLES = [
  { tone: 1, name: 'Nada 1 (mā)', symbol: 'ˉ', desc: 'Tinggi & Datar (5-5)', pinyin: 'mā', hanzi: '妈 (Ibu)' },
  { tone: 2, name: 'Nada 2 (má)', symbol: 'ˊ', desc: 'Naik Sedang ke Tinggi (3-5)', pinyin: 'má', hanzi: '麻 (Rami)' },
  { tone: 3, name: 'Nada 3 (mǎ)', symbol: 'ˇ', desc: 'Turun lalu Naik (2-1-4)', pinyin: 'mǎ', hanzi: '马 (Kuda)' },
  { tone: 4, name: 'Nada 4 (mà)', symbol: 'ˋ', desc: 'Tinggi jatuh Tajam (5-1)', pinyin: 'mà', hanzi: '骂 (Memarahi)' }
];

function playToneSample(toneNum) {
  const sample = TONE_SAMPLES.find(t => t.tone === toneNum);
  if (sample) {
    speakMandarin(sample.pinyin);
    showToast(`Memutar ${sample.name} - ${sample.desc}`, 'info');
  }
}

// --- Tab Switching ---
function switchTab(tabId) {
  SFX.click();
  STATE.currentTab = tabId;

  // Update Navigation Active State
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Switch View Sections
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.remove('active');
  });

  const activeSec = document.getElementById(`view-${tabId}`);
  if (activeSec) activeSec.classList.add('active');

  // Trigger tab-specific initialization
  if (tabId === 'vocab') {
    renderVocabCards();
  } else if (tabId === 'dictionary') {
    renderDictionary();
  } else if (tabId === 'dialogues') {
    renderDialogues();
  } else if (tabId === 'radicals') {
    renderRadicals();
  } else if (tabId === 'flashcards') {
    initFlashcardMode();
  } else if (tabId === 'practice') {
    initCanvas();
  } else if (tabId === 'leaderboard') {
    if (typeof fetchGlobalLeaderboard === 'function') fetchGlobalLeaderboard();
  } else if (tabId === 'maker') {
    renderCustomVocabList();
  }
}

// ==========================================
// SITUATIONAL DIALOGUES LOGIC
// ==========================================
let currentDialogueId = "dia_01";

function renderDialogues() {
  const tabsContainer = document.getElementById('dialogueTabsContainer');
  const activeContainer = document.getElementById('activeDialogueContainer');
  if (!tabsContainer || !activeContainer || typeof SITUATIONAL_DIALOGUES === 'undefined') return;

  // Render Tabs
  tabsContainer.innerHTML = SITUATIONAL_DIALOGUES.map(dia => `
    <button class="hsk-pill ${dia.id === currentDialogueId ? 'active' : ''}" onclick="selectDialogue('${dia.id}')">
      <i class="fas ${dia.icon || 'fa-comments'}"></i> <span>${dia.title}</span>
    </button>
  `).join('');

  const activeDia = SITUATIONAL_DIALOGUES.find(d => d.id === currentDialogueId) || SITUATIONAL_DIALOGUES[0];
  if (!activeDia) return;

  activeContainer.innerHTML = `
    <div class="maker-form-card" style="margin-bottom:1.5rem;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; border-bottom:1px solid var(--border-color); padding-bottom:0.75rem;">
        <h3 style="font-size:1.3rem; font-weight:800; color:var(--text-primary);">
          <i class="fas ${activeDia.icon}" style="color:var(--crimson-500); margin-right:0.4rem;"></i> ${activeDia.title}
        </h3>
        <button class="btn-primary" onclick="playFullDialogue('${activeDia.id}')">
          <i class="fas fa-play"></i> Putar Seluruh Dialog
        </button>
      </div>

      <div style="display:flex; flex-direction:column; gap:1rem;">
        ${activeDia.lines.map((line, idx) => `
          <div style="background:var(--bg-secondary); border-radius:var(--radius-md); padding:1rem 1.25rem; border:1px solid var(--border-color); border-left:4px solid ${idx % 2 === 0 ? 'var(--crimson-500)' : 'var(--jade-400)'}; display:flex; justify-content:space-between; align-items:flex-start; gap:1rem;">
            <div style="flex:1;">
              <div style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.3rem;">${line.speaker}</div>
              <div style="font-family:var(--font-hanzi); font-size:1.35rem; font-weight:700; color:var(--text-primary); margin-bottom:0.25rem;">${line.cn}</div>
              <div style="font-size:0.92rem; color:var(--gold-400); font-weight:600; margin-bottom:0.25rem;">${line.py}</div>
              <div style="font-size:0.85rem; color:var(--text-secondary);">${line.id}</div>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.4rem;">
              <button class="card-btn" onclick="speakMandarin('${line.cn}')" title="Dengarkan Baris Ini">
                <i class="fas fa-volume-up"></i>
              </button>
              <button class="card-btn" onclick="testVoicePronunciation('${line.cn}')" title="Latihan Bicara (Voice Check)" style="color:var(--indigo-500);">
                <i class="fas fa-microphone"></i>
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function selectDialogue(id) {
  SFX.click();
  currentDialogueId = id;
  renderDialogues();
}

function playFullDialogue(id) {
  const dia = SITUATIONAL_DIALOGUES.find(d => d.id === id);
  if (!dia) return;

  showToast('Memutar audio percakapan lengkap...', 'info');
  dia.lines.forEach((line, idx) => {
    setTimeout(() => {
      speakMandarin(line.cn);
    }, idx * 3500);
  });
}

// ==========================================
// CHINESE RADICALS LOGIC
// ==========================================
function renderRadicals() {
  const container = document.getElementById('radicalsGridContainer');
  if (!container || typeof MANDARIN_RADICALS === 'undefined') return;

  container.innerHTML = MANDARIN_RADICALS.map(rad => `
    <div class="vocab-card">
      <div class="card-top">
        <span class="hsk-level-tag hsk1">${rad.pinyin}</span>
        <button class="card-btn" onclick="speakMandarin('${rad.radical.split(' ')[0]}')" title="Dengarkan"><i class="fas fa-volume-up"></i></button>
      </div>

      <div class="card-main">
        <div class="card-hanzi" style="font-size:2.8rem; color:var(--crimson-500);">${rad.radical}</div>
        <div style="font-weight:700; font-size:1.05rem; color:var(--text-primary); margin-bottom:0.25rem;">${rad.name}</div>
        <div style="font-size:0.85rem; color:var(--text-secondary);">${rad.meaning_id}</div>
      </div>

      <div style="background:var(--bg-secondary); border-radius:var(--radius-sm); padding:0.75rem; border-top:1px solid var(--border-color);">
        <div style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:0.4rem;">Contoh Karakter Turunan:</div>
        <div style="display:flex; flex-wrap:wrap; gap:0.4rem;">
          ${rad.examples.map(ex => `
            <span onclick="openPracticeCanvas('${ex.char}')" style="background:var(--bg-tertiary); padding:0.25rem 0.6rem; border-radius:6px; font-size:0.82rem; cursor:pointer; transition:all 0.2s ease;" title="${ex.pinyin}: ${ex.meaning} (Klik untuk tulis)">
              <strong style="font-family:var(--font-hanzi); font-size:1rem; color:var(--text-primary);">${ex.char}</strong>
              <span style="color:var(--gold-400); margin-left:0.2rem;">${ex.pinyin}</span>
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ==========================================
// SPEECH RECOGNITION (VOICE PRONUNCIATION CHECK)
// ==========================================
function testVoicePronunciation(targetText) {
  SFX.click();
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec) {
    showToast('Browser ini belum mendukung Web Speech Recognition. Coba gunakan Google Chrome!', 'error');
    return;
  }

  showToast(`Silakan ucapkan: "${targetText}" ke mikrofon... 🎙️`, 'info');

  const recognition = new SpeechRec();
  recognition.lang = 'zh-CN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const spokenText = event.results[0][0].transcript;
    const isClose = spokenText.includes(targetText) || targetText.includes(spokenText);

    if (isClose) {
      SFX.correct();
      addXP(25);
      showToast(`Luar biasa! Pengucapan Anda tepat: "${spokenText}" (+25 XP) 🎉`, 'success');
    } else {
      SFX.wrong();
      showToast(`Terdengar: "${spokenText}". Coba ulangi lagi lebih jelas!`, 'error');
    }
  };

  recognition.onerror = (event) => {
    console.warn("Speech error:", event.error);
    showToast(`Gagal mendeteksi suara: ${event.error}`, 'error');
  };

  recognition.start();
}

// --- Theme Toggle ---
function toggleTheme() {
  SFX.click();
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('hz_theme', newTheme);

  const themeIcon = document.getElementById('themeToggleIcon');
  if (themeIcon) {
    themeIcon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
  }
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // Restore Theme
  const savedTheme = localStorage.getItem('hz_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeIcon = document.getElementById('themeToggleIcon');
  if (themeIcon) themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';

  // Initialize Firebase Cloud Connection
  if (typeof initFirebase === 'function') {
    initFirebase();
  }

  checkDailyStreak();
  updateStatsDisplay();
  renderVocabCards();
  renderDictionary();

  // Navigation Tabs Event Listeners
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Dictionary Search Input & Category Dropdown
  const dictSearchInput = document.getElementById('dictSearchInput');
  if (dictSearchInput) {
    dictSearchInput.addEventListener('input', (e) => {
      STATE.dictSearchQuery = e.target.value;
      renderDictionary();
    });
  }

  const dictCategorySelect = document.getElementById('dictCategorySelect');
  if (dictCategorySelect) {
    dictCategorySelect.addEventListener('change', (e) => {
      STATE.dictCategory = e.target.value;
      renderDictionary();
    });
  }

  // HSK Level Pills Event Listeners
  document.querySelectorAll('.hsk-pill[data-hsk]').forEach(pill => {
    pill.addEventListener('click', () => {
      SFX.click();
      document.querySelectorAll('.hsk-pill[data-hsk]').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      STATE.selectedHsk = pill.getAttribute('data-hsk');
      renderVocabCards();
    });
  });

  // Search Input
  const searchInput = document.getElementById('vocabSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      STATE.searchQuery = e.target.value;
      renderVocabCards();
    });
  }

  // Filter Bookmarks & Learned Toggles
  const btnFilterFav = document.getElementById('filterFavBtn');
  if (btnFilterFav) {
    btnFilterFav.addEventListener('click', () => {
      SFX.click();
      STATE.filterBookmarkOnly = !STATE.filterBookmarkOnly;
      btnFilterFav.classList.toggle('active', STATE.filterBookmarkOnly);
      renderVocabCards();
    });
  }

  const btnFilterLearned = document.getElementById('filterLearnedBtn');
  if (btnFilterLearned) {
    btnFilterLearned.addEventListener('click', () => {
      SFX.click();
      STATE.filterLearnedOnly = !STATE.filterLearnedOnly;
      btnFilterLearned.classList.toggle('active', STATE.filterLearnedOnly);
      renderVocabCards();
    });
  }

  // Quiz Config Buttons
  document.querySelectorAll('.config-option-btn[data-cfg-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      SFX.click();
      const type = btn.getAttribute('data-cfg-type');
      const val = btn.getAttribute('data-cfg-val');

      // Unselect siblings
      btn.parentElement.querySelectorAll('.config-option-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (type === 'level') QUIZ_ENGINE.config.level = val;
      if (type === 'mode') QUIZ_ENGINE.config.mode = val;
      if (type === 'count') QUIZ_ENGINE.config.questionCount = parseInt(val, 10);
      if (type === 'timer') QUIZ_ENGINE.config.timerSeconds = parseInt(val, 10);
    });
  });

  // Custom Vocab Form
  const customForm = document.getElementById('customVocabForm');
  if (customForm) {
    customForm.addEventListener('submit', handleAddCustomVocab);
  }

  // File Import listener
  const importInput = document.getElementById('importVocabInput');
  if (importInput) {
    importInput.addEventListener('change', importCustomVocabJSON);
  }
});
