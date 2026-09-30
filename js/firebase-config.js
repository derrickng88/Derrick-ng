/* ==========================================================================
   FIREBASE INTEGRATION & CLOUD SYNC MODULE
   HanziMaster (学中文)
   Features:
   - Firebase Auth (Email/Password, Google Sign-In, Anonymous Guest)
   - Cloud Firestore (Sync learned words, bookmarks, custom vocab, quiz history)
   - Global Leaderboard (Live rankings with Firestore)
   - LocalStorage auto-fallback & Config Settings Manager
   ========================================================================== */

const FIREBASE_APP_STATE = {
  isInitialized: false,
  currentUser: null,
  isCloudSynced: false,
  config: JSON.parse(localStorage.getItem('hz_firebase_config') || 'null') || {
    apiKey: "AIzaSyDummyKey_myhanzimaster_app",
    authDomain: "myhanzimaster.firebaseapp.com",
    projectId: "myhanzimaster",
    storageBucket: "myhanzimaster.appspot.com",
    messagingSenderId: "109876543210",
    appId: "1:109876543210:web:abcdef1234567890"
  },
  auth: null,
  db: null
};

// Initialize Firebase SDK
function initFirebase() {
  try {
    if (typeof firebase !== 'undefined' && firebase.apps) {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_APP_STATE.config);
      }
      FIREBASE_APP_STATE.auth = firebase.auth();
      FIREBASE_APP_STATE.db = firebase.firestore();
      FIREBASE_APP_STATE.isInitialized = true;

      // Listen for Auth changes
      FIREBASE_APP_STATE.auth.onAuthStateChanged((user) => {
        if (user) {
          FIREBASE_APP_STATE.currentUser = user;
          updateAuthUI(user);
          syncFromCloud();
          showToast(`Masuk sebagai: ${user.displayName || user.email || 'Pengguna Anonim'}`, 'success');
        } else {
          FIREBASE_APP_STATE.currentUser = null;
          updateAuthUI(null);
        }
      });

      updateCloudStatusBadge(true);
      console.log("Firebase initialized successfully.");
    } else {
      console.warn("Firebase SDK not loaded, running in offline fallback mode.");
      updateCloudStatusBadge(false);
    }
  } catch (err) {
    console.warn("Firebase init error (offline mode active):", err);
    updateCloudStatusBadge(false);
  }
}

// Update Header UI based on Auth State
function updateAuthUI(user) {
  const userBtn = document.getElementById('authProfileBtn');
  const userText = document.getElementById('authProfileName');
  const userAvatar = document.getElementById('authProfileAvatar');

  if (user) {
    if (userText) userText.textContent = user.displayName || (user.email ? user.email.split('@')[0] : 'Member');
    if (userAvatar) {
      if (user.photoURL) {
        userAvatar.innerHTML = `<img src="${user.photoURL}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;" alt="Avatar">`;
      } else {
        userAvatar.innerHTML = `<i class="fas fa-user-check"></i>`;
      }
    }
    if (userBtn) userBtn.title = "Klik untuk membuka profil / keluar";
  } else {
    if (userText) userText.textContent = "Masuk / Akun";
    if (userAvatar) userAvatar.innerHTML = `<i class="fas fa-user-circle"></i>`;
    if (userBtn) userBtn.title = "Masuk untuk sinkronisasi cloud";
  }
}

// Update Cloud Status Indicator
function updateCloudStatusBadge(isOnline) {
  const badge = document.getElementById('cloudSyncStatusBadge');
  if (!badge) return;

  if (FIREBASE_APP_STATE.currentUser && isOnline) {
    badge.className = 'cloud-badge online';
    badge.innerHTML = `<i class="fas fa-cloud"></i> <span>Tersinkron Cloud</span>`;
    badge.title = "Data kemajuan belajar tersimpan aman di Cloud Firestore";
  } else {
    badge.className = 'cloud-badge offline';
    badge.innerHTML = `<i class="fas fa-database"></i> <span>Lokal (Offline)</span>`;
    badge.title = "Menggunakan penyimpanan lokal browser";
  }
}

// ==================== AUTHENTICATION ACTIONS ====================

// 1. Google Sign-In
async function signInWithGoogle() {
  SFX.click();
  if (!FIREBASE_APP_STATE.auth) {
    showToast('Firebase belum terhubung. Silakan atur konfigurasi.', 'error');
    return;
  }
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await FIREBASE_APP_STATE.auth.signInWithPopup(provider);
    closeAuthModal();
  } catch (err) {
    console.error("Google Auth Error:", err);
    showToast(`Gagal masuk Google: ${err.message}`, 'error');
  }
}

// 2. Email & Password Sign-In / Register
async function handleEmailAuth(isRegister = false) {
  SFX.click();
  const email = document.getElementById('authEmailInput').value.trim();
  const password = document.getElementById('authPasswordInput').value.trim();

  if (!email || !password) {
    showToast('Harap masukkan email dan kata sandi!', 'error');
    return;
  }

  if (!FIREBASE_APP_STATE.auth) {
    showToast('Firebase SDK tidak tersedia.', 'error');
    return;
  }

  try {
    if (isRegister) {
      await FIREBASE_APP_STATE.auth.createUserWithEmailAndPassword(email, password);
      showToast('Registrasi berhasil!', 'success');
    } else {
      await FIREBASE_APP_STATE.auth.signInWithEmailAndPassword(email, password);
      showToast('Berhasil masuk!', 'success');
    }
    closeAuthModal();
  } catch (err) {
    console.error("Auth Error:", err);
    showToast(`Error: ${err.message}`, 'error');
  }
}

// 3. Anonymous Guest Login
async function signInAnonymously() {
  SFX.click();
  if (!FIREBASE_APP_STATE.auth) {
    showToast('Firebase belum terhubung.', 'error');
    return;
  }
  try {
    await FIREBASE_APP_STATE.auth.signInAnonymously();
    closeAuthModal();
    showToast('Masuk sebagai Tamu Cloud!', 'success');
  } catch (err) {
    showToast(`Gagal masuk: ${err.message}`, 'error');
  }
}

// 4. Sign Out
async function signOutUser() {
  SFX.click();
  if (FIREBASE_APP_STATE.auth) {
    await FIREBASE_APP_STATE.auth.signOut();
    showToast('Berhasil keluar dari akun.', 'info');
    closeAuthModal();
  }
}

// ==================== CLOUD FIRESTORE DATA SYNC ====================

// Sync Current State to Firestore
async function syncToCloud() {
  if (!FIREBASE_APP_STATE.db || !FIREBASE_APP_STATE.currentUser) {
    saveState();
    return;
  }

  try {
    const uid = FIREBASE_APP_STATE.currentUser.uid;
    const userDocRef = FIREBASE_APP_STATE.db.collection('users').doc(uid);

    const payload = {
      displayName: FIREBASE_APP_STATE.currentUser.displayName || FIREBASE_APP_STATE.currentUser.email || 'Pelajar Mandarin',
      email: FIREBASE_APP_STATE.currentUser.email || '',
      stats: STATE.stats,
      bookmarks: STATE.bookmarks,
      learned: STATE.learned,
      customVocab: STATE.customVocab,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await userDocRef.set(payload, { merge: true });

    // Also update leaderboard collection
    await FIREBASE_APP_STATE.db.collection('leaderboard').doc(uid).set({
      name: payload.displayName,
      xp: STATE.stats.xp,
      quizzesCompleted: STATE.stats.quizzesCompleted,
      streak: STATE.stats.streak,
      rankTitle: getRankTitle(STATE.stats.xp).title,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    showToast('Kemajuan berhasil disinkronkan ke Cloud Firestore! ☁️', 'success');
    updateCloudStatusBadge(true);
  } catch (err) {
    console.warn("Sync to cloud error:", err);
    updateCloudStatusBadge(false);
  }
}

// Sync from Firestore to local
async function syncFromCloud() {
  if (!FIREBASE_APP_STATE.db || !FIREBASE_APP_STATE.currentUser) return;

  try {
    const uid = FIREBASE_APP_STATE.currentUser.uid;
    const doc = await FIREBASE_APP_STATE.db.collection('users').doc(uid).get();

    if (doc.exists) {
      const cloudData = doc.data();
      if (cloudData.stats) STATE.stats = { ...STATE.stats, ...cloudData.stats };
      if (cloudData.bookmarks) STATE.bookmarks = Array.from(new Set([...STATE.bookmarks, ...cloudData.bookmarks]));
      if (cloudData.learned) STATE.learned = Array.from(new Set([...STATE.learned, ...cloudData.learned]));
      if (cloudData.customVocab && cloudData.customVocab.length > 0) {
        STATE.customVocab = cloudData.customVocab;
      }

      saveState();
      updateStatsDisplay();
      renderVocabCards();
      renderCustomVocabList();
      showToast('Data akun berhasil dimuat dari Cloud!', 'success');
    } else {
      // First time user, push local data to cloud
      syncToCloud();
    }
  } catch (err) {
    console.warn("Sync from cloud error:", err);
  }
}

// Fetch Global Leaderboard from Firestore
async function fetchGlobalLeaderboard() {
  const container = document.getElementById('leaderboardTableBody');
  if (!container) return;

  container.innerHTML = `
    <tr>
      <td colspan="5" style="text-align:center; padding:2rem; color:var(--text-muted);">
        <i class="fas fa-spinner fa-spin" style="font-size:1.5rem; margin-bottom:0.5rem; display:block;"></i>
        Memuat peringkat global dari Cloud Firestore...
      </td>
    </tr>
  `;

  if (!FIREBASE_APP_STATE.db) {
    // Render offline simulated leaderboard
    renderMockLeaderboard();
    return;
  }

  try {
    const snapshot = await FIREBASE_APP_STATE.db.collection('leaderboard')
      .orderBy('xp', 'desc')
      .limit(20)
      .get();

    if (snapshot.empty) {
      renderMockLeaderboard();
      return;
    }

    let rank = 1;
    let rowsHtml = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      const isMe = FIREBASE_APP_STATE.currentUser && doc.id === FIREBASE_APP_STATE.currentUser.uid;
      const rankBadge = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : (rank === 3 ? '🥉' : `#${rank}`));

      rowsHtml += `
        <tr style="${isMe ? 'background:rgba(225,29,72,0.15); font-weight:700;' : ''}">
          <td style="font-size:1.1rem; text-align:center;">${rankBadge}</td>
          <td>
            <div style="display:flex; align-items:center; gap:0.5rem;">
              <span style="color:var(--text-primary);">${data.name || 'Pelajar'}</span>
              ${isMe ? '<span style="font-size:0.7rem; background:var(--crimson-500); color:#fff; padding:0.1rem 0.4rem; border-radius:4px;">Kamu</span>' : ''}
            </div>
          </td>
          <td style="color:var(--gold-400); font-weight:700;">${data.xp || 0} XP</td>
          <td>${data.streak || 1} Hari 🔥</td>
          <td><span class="hsk-level-tag hsk1">${data.rankTitle || '秀才'}</span></td>
        </tr>
      `;
      rank++;
    });

    container.innerHTML = rowsHtml;
  } catch (err) {
    console.warn("Leaderboard error, using fallback:", err);
    renderMockLeaderboard();
  }
}

function renderMockLeaderboard() {
  const container = document.getElementById('leaderboardTableBody');
  if (!container) return;

  const samplePlayers = [
    { rank: 1, name: 'Derrick Ng (状元)', xp: Math.max(STATE.stats.xp + 500, 2450), streak: 28, title: '一代宗师' },
    { rank: 2, name: 'Chen Wei (陈伟)', xp: Math.max(STATE.stats.xp + 200, 1850), streak: 19, title: '状元' },
    { rank: 3, name: 'Siti Rahma (拉赫玛)', xp: Math.max(STATE.stats.xp + 50, 1420), streak: 14, title: '榜眼' },
    { rank: 4, name: (FIREBASE_APP_STATE.currentUser ? (FIREBASE_APP_STATE.currentUser.displayName || 'Kamu') : 'Kamu (Akun Lokal)'), xp: STATE.stats.xp, streak: STATE.stats.streak, title: getRankTitle(STATE.stats.xp).title, isMe: true },
    { rank: 5, name: 'Budi Santoso (布迪)', xp: 620, streak: 7, title: '进士' },
    { rank: 6, name: 'Michael Tan (陈先生)', xp: 480, streak: 5, title: '探花' }
  ].sort((a, b) => b.xp - a.xp);

  container.innerHTML = samplePlayers.map((p, idx) => {
    const rankNum = idx + 1;
    const rankBadge = rankNum === 1 ? '🥇' : (rankNum === 2 ? '🥈' : (rankNum === 3 ? '🥉' : `#${rankNum}`));
    return `
      <tr style="${p.isMe ? 'background:rgba(225,29,72,0.15); font-weight:700;' : ''}">
        <td style="font-size:1.1rem; text-align:center;">${rankBadge}</td>
        <td>
          <div style="display:flex; align-items:center; gap:0.5rem;">
            <span style="color:var(--text-primary);">${p.name}</span>
            ${p.isMe ? '<span style="font-size:0.7rem; background:var(--crimson-500); color:#fff; padding:0.1rem 0.4rem; border-radius:4px;">Kamu</span>' : ''}
          </div>
        </td>
        <td style="color:var(--gold-400); font-weight:700;">${p.xp} XP</td>
        <td>${p.streak} Hari 🔥</td>
        <td><span class="hsk-level-tag hsk1">${p.title}</span></td>
      </tr>
    `;
  }).join('');
}

// ==================== FIREBASE CONFIG MODAL & SETUP ====================

function openFirebaseConfigModal() {
  SFX.click();
  const modal = document.getElementById('firebaseConfigModal');
  if (!modal) return;

  const currentCfg = FIREBASE_APP_STATE.config;
  document.getElementById('cfgApiKey').value = currentCfg.apiKey || '';
  document.getElementById('cfgAuthDomain').value = currentCfg.authDomain || '';
  document.getElementById('cfgProjectId').value = currentCfg.projectId || '';
  document.getElementById('cfgStorageBucket').value = currentCfg.storageBucket || '';
  document.getElementById('cfgMessagingSenderId').value = currentCfg.messagingSenderId || '';
  document.getElementById('cfgAppId').value = currentCfg.appId || '';

  modal.classList.add('active');
}

function closeFirebaseConfigModal() {
  const modal = document.getElementById('firebaseConfigModal');
  if (modal) modal.classList.remove('active');
}

function saveFirebaseConfig(e) {
  e.preventDefault();
  const newConfig = {
    apiKey: document.getElementById('cfgApiKey').value.trim(),
    authDomain: document.getElementById('cfgAuthDomain').value.trim(),
    projectId: document.getElementById('cfgProjectId').value.trim(),
    storageBucket: document.getElementById('cfgStorageBucket').value.trim(),
    messagingSenderId: document.getElementById('cfgMessagingSenderId').value.trim(),
    appId: document.getElementById('cfgAppId').value.trim()
  };

  localStorage.setItem('hz_firebase_config', JSON.stringify(newConfig));
  FIREBASE_APP_STATE.config = newConfig;

  showToast('Konfigurasi Firebase berhasil disimpan! Memuat ulang...', 'success');
  closeFirebaseConfigModal();
  setTimeout(() => {
    window.location.reload();
  }, 1000);
}

// Auth Modal Open / Close
function openAuthModal() {
  SFX.click();
  const modal = document.getElementById('authModal');
  if (!modal) return;

  const loggedInView = document.getElementById('authLoggedInSection');
  const loggedOutView = document.getElementById('authLoggedOutSection');

  if (FIREBASE_APP_STATE.currentUser) {
    if (loggedInView) loggedInView.style.display = 'block';
    if (loggedOutView) loggedOutView.style.display = 'none';

    document.getElementById('profileEmailDisplay').textContent = FIREBASE_APP_STATE.currentUser.email || 'Pengguna Anonim / Tamu';
    document.getElementById('profileUidDisplay').textContent = FIREBASE_APP_STATE.currentUser.uid;
  } else {
    if (loggedInView) loggedInView.style.display = 'none';
    if (loggedOutView) loggedOutView.style.display = 'block';
  }

  modal.classList.add('active');
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (modal) modal.classList.remove('active');
}
