/* ================================
   Wavr Music App — music.js
   页面切换 · 状态栏同步 · 播放器交互
================================ */

/* ================================
   状态栏时间 & 灵动岛（与 index 同步）
================================ */
function updateStatusBar() {
  const timeEl = document.getElementById('statusTime');
  const batPct = document.getElementById('batPct');
  const batInner = document.getElementById('batInner');

  // 同步时间
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  if (timeEl) timeEl.textContent = `${h}:${m}`;

  // 同步电量（读 localStorage，与 index 保持一致）
  let bat = parseInt(localStorage.getItem('luna_battery') || '76');
  if (batPct) batPct.textContent = bat;
  if (batInner) {
    batInner.style.width = bat + '%';
    if (bat <= 20) {
      batInner.style.background = 'linear-gradient(90deg, #f87171, #ef4444)';
    } else {
      batInner.style.background = 'linear-gradient(90deg, #22d3ee, #14b8a6)';
    }
  }
}

// 注入灵动岛（音乐播放状态 — 频谱样式）
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if (!el) return;

  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };

  el.innerHTML = styleMap[style] || styleMap.minimal;

  clearInterval(window._siClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));

  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 3);
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
      });
      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch(e) {}
  }

  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const colorRule  = style.color ? `color: ${style.color} !important;` : '';
  const sizeRule   = style.size  ? `font-size: ${style.size}px !important;` : '';
  const familyRule = name        ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent  = `* { ${familyRule} }`;
}

// ================================
//   页面切换
// ================================
let currentPage = 'home';

function switchPage(page) {
  if (page === currentPage) return;

  const oldPage = document.getElementById('page' + capitalize(currentPage));
  if (oldPage) oldPage.classList.remove('active');

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navEl = document.getElementById('nav' + capitalize(page));
  if (navEl) navEl.classList.add('active');

  currentPage = page;

  requestAnimationFrame(() => {
    const newPage = document.getElementById('page' + capitalize(page));
    if (newPage) {
      newPage.classList.add('active');
      newPage.scrollTop = 0;
    }
    if (page === 'player') setTimeout(drawWaveform, 80);
  });
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// 从其他地方跳到播放器
function goToPlayer() {
  switchPage('player');
}

// ================================
//   播放器交互
// ================================
let isPlaying = false;

// 播放模式：order=顺序 repeat=单曲循环 shuffle=随机
let _playMode = 'order';

function initPlayer() {
  const playBtn  = document.getElementById('ctrlPlay');
  const vinylDisc = document.getElementById('vinylDisc');
  const tonearm  = document.getElementById('tonearmWrap');
  const likeBtn  = document.getElementById('playerLikeBtn');

  // 播放/暂停
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      const iconPlay  = playBtn.querySelector('.icon-play');
      const iconPause = playBtn.querySelector('.icon-pause');
      if (isPlaying) {
        iconPlay.style.display  = 'none';
        iconPause.style.display = 'block';
        vinylDisc && vinylDisc.classList.add('spinning');
        tonearm   && tonearm.classList.add('playing');
        startProgress();
      } else {
        iconPlay.style.display  = 'block';
        iconPause.style.display = 'none';
        vinylDisc && vinylDisc.classList.remove('spinning');
        tonearm   && tonearm.classList.remove('playing');
        stopProgress();
      }
    });
  }

  // 喜欢
  if (likeBtn) {
    likeBtn.addEventListener('click', () => {
      likeBtn.classList.toggle('liked');
      likeBtn.style.transform = 'scale(1.3)';
      setTimeout(() => { likeBtn.style.transform = ''; }, 200);
    });
  }

  // 播放模式三合一（顺序 → 单曲循环 → 随机 → 顺序...）
  const modeBtn = document.getElementById('ctrlPlayMode');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => {
      const modes = ['order', 'repeat', 'shuffle'];
      const next  = modes[(modes.indexOf(_playMode) + 1) % 3];
      _playMode   = next;
      modeBtn.querySelector('.pm-order').style.display   = next === 'order'   ? 'block' : 'none';
      modeBtn.querySelector('.pm-repeat').style.display  = next === 'repeat'  ? 'block' : 'none';
      modeBtn.querySelector('.pm-shuffle').style.display = next === 'shuffle' ? 'block' : 'none';
      modeBtn.classList.toggle('mode-active', next !== 'order');
      const labels = { order: '顺序播放', repeat: '单曲循环', shuffle: '随机播放' };
      modeBtn.title = labels[next];
    });
  }

  // 歌词按钮 → 打开歌词弹窗
  const ctrlLyric = document.getElementById('ctrlLyric');
  if (ctrlLyric) {
    ctrlLyric.addEventListener('click', () => {
      openLyricPanel();
    });
  }

  // 播放列表按钮
  const openQueueBtn = document.getElementById('openQueuePanel');
  if (openQueueBtn) {
    openQueueBtn.addEventListener('click', () => {
      renderQueueList();
      document.getElementById('queueOverlay').classList.add('show');
      document.getElementById('queuePanel').classList.add('show');
    });
  }
  const closeQueueBtn = document.getElementById('closeQueuePanel');
  if (closeQueueBtn) {
    closeQueueBtn.addEventListener('click', () => {
      document.getElementById('queueOverlay').classList.remove('show');
      document.getElementById('queuePanel').classList.remove('show');
    });
  }
  document.getElementById('queueOverlay')?.addEventListener('click', () => {
    document.getElementById('queueOverlay').classList.remove('show');
    document.getElementById('queuePanel').classList.remove('show');
  });
}

// 渲染播放队列
function renderQueueList() {
  const el = document.getElementById('queueTrackList');
  if (!el) return;
  if (_tracks.length === 0) {
    el.innerHTML = '<div class="pd-empty">NO TRACKS IN LIBRARY</div>';
    return;
  }
  el.innerHTML = _tracks.map((t, i) => `
    <div class="queue-track-item ${_currentTrackIdx === i ? 'playing-now' : ''}" onclick="playTrack(${i}); document.getElementById('queueOverlay').classList.remove('show'); document.getElementById('queuePanel').classList.remove('show');">
      <div class="queue-track-cover">
        ${t.cover ? `<img src="${t.cover}"/>` : ''}
      </div>
      <div class="queue-track-info">
        <div class="queue-track-name">${t.name}</div>
        <div class="queue-track-artist">${t.artist}</div>
      </div>
      ${_currentTrackIdx === i ? '<div class="queue-now-tag">PLAYING</div>' : ''}
    </div>
  `).join('');
}

// ================================
//   进度条（波形播放指示线）
// ================================
let progressInterval = null;
let progressPct = 0; // 初始进度 0%
const TOTAL_DURATION = 258; // 4:18 in seconds

function startProgress() {
  stopProgress();
  progressInterval = setInterval(() => {
    progressPct += 1 / TOTAL_DURATION;
    if (progressPct >= 1) {
      progressPct = 0;
      isPlaying = false;
      stopProgress();
    }
    updateProgressUI();
  }, 1000);
}

function stopProgress() {
  if (progressInterval) {
    clearInterval(progressInterval);
    progressInterval = null;
  }
}

function updateProgressUI() {
  const line    = document.getElementById('waveProgressLine');
  const elapsed = document.getElementById('wtElapsed');
  const total   = document.getElementById('wtTotal');

  if (line) line.style.left = (progressPct * 100) + '%';

  const currentSec = progressPct * TOTAL_DURATION;

  if (elapsed) {
    const secs = Math.floor(currentSec);
    const m = Math.floor(secs / 60);
    const s = (secs % 60).toString().padStart(2, '0');
    elapsed.textContent = `${m}:${s}`;
  }

  if (total) {
    const m = Math.floor(TOTAL_DURATION / 60);
    const s = (TOTAL_DURATION % 60).toString().padStart(2, '0');
    total.textContent = `${m}:${s}`;
  }

  // 同步歌词高亮滚动
  if (_currentTrackIdx >= 0 && _tracks[_currentTrackIdx]) {
    syncLyric(_tracks[_currentTrackIdx].id, currentSec);
  }

  drawWaveform();
}

// ================================
//   波形绘制
// ================================
function drawWaveform() {
  const canvas = document.getElementById('waveCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth;
  const H = canvas.height;
  canvas.width = W;

  ctx.clearRect(0, 0, W, H);

  const bars = 80;
  const barW = W / bars * 0.6;
  const gap  = W / bars * 0.4;
  const midY = H / 2;

  // 随机种子波形（固定感）
  const heights = [];
  let seed = 42;
  for (let i = 0; i < bars; i++) {
    seed = (seed * 1664525 + 1013904223) & 0xffffffff;
    const h = 4 + Math.abs((seed & 0xff) / 255) * (H * 0.72);
    heights.push(h);
  }

  // 平滑处理
  for (let i = 1; i < bars - 1; i++) {
    heights[i] = (heights[i-1] + heights[i] * 2 + heights[i+1]) / 4;
  }

  for (let i = 0; i < bars; i++) {
    const x = i * (barW + gap);
    const h = heights[i];
    const isPast = (i / bars) < progressPct;

    // 渐变颜色
    const grad = ctx.createLinearGradient(0, midY - h/2, 0, midY + h/2);
    if (isPast) {
      grad.addColorStop(0, 'rgba(6,182,212,0.9)');
      grad.addColorStop(1, 'rgba(20,184,166,0.7)');
    } else {
      grad.addColorStop(0, 'rgba(6,182,212,0.22)');
      grad.addColorStop(1, 'rgba(20,184,166,0.12)');
    }

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect
      ? ctx.roundRect(x, midY - h/2, barW, h, barW/2)
      : ctx.rect(x, midY - h/2, barW, h);
    ctx.fill();
  }
}

// ================================
//   音量滑块
// ================================
function initVolume() {
  const track = document.getElementById('volumeTrack');
  const fill  = document.getElementById('volumeFill');
  const thumb = document.getElementById('volumeThumb');
  if (!track) return;

  let dragging = false;

  function setVolume(x) {
    const rect = track.getBoundingClientRect();
    let pct = (x - rect.left) / rect.width;
    pct = Math.max(0, Math.min(1, pct));
    fill.style.width = (pct * 100) + '%';
    thumb.style.left = (pct * 100) + '%';
  }

  track.addEventListener('mousedown', e => { dragging = true; setVolume(e.clientX); });
  track.addEventListener('touchstart', e => { dragging = true; setVolume(e.touches[0].clientX); }, { passive: true });

  document.addEventListener('mousemove', e => { if (dragging) setVolume(e.clientX); });
  document.addEventListener('touchmove', e => { if (dragging) setVolume(e.touches[0].clientX); }, { passive: true });
  document.addEventListener('mouseup',  () => { dragging = false; });
  document.addEventListener('touchend', () => { dragging = false; });
}

// ================================
//   主页搜索栏
// ================================
function initSearch() {
  const btn = document.getElementById('homeSearchBtn');
  if (!btn) return;

  // 创建搜索覆盖层
  const overlay = document.createElement('div');
  overlay.className = 'search-overlay';
  overlay.id = 'searchOverlay';
  overlay.innerHTML = `
    <div class="search-input-wrap">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8"/>
        <path d="M15.5 15.5L20 20" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
      <input class="search-input" type="text" placeholder="Search songs, artists, playlists..." autofocus />
    </div>
    <div class="search-cancel" id="searchCancel">Cancel</div>
  `;

  document.querySelector('.luna-frame').appendChild(overlay);

  btn.addEventListener('click', () => {
    overlay.classList.add('open');
    setTimeout(() => overlay.querySelector('input')?.focus(), 100);
  });

  document.getElementById('searchCancel')?.addEventListener('click', () => {
    overlay.classList.remove('open');
  });
}

// ================================
//   波形点击跳转
// ================================
function initWaveformClick() {
  const track = document.getElementById('waveformTrack');
  if (!track) return;

  track.addEventListener('click', e => {
    const rect = track.getBoundingClientRect();
    progressPct = (e.clientX - rect.left) / rect.width;
    progressPct = Math.max(0, Math.min(1, progressPct));
    updateProgressUI();
  });

  track.addEventListener('touchend', e => {
    const rect = track.getBoundingClientRect();
    progressPct = (e.changedTouches[0].clientX - rect.left) / rect.width;
    progressPct = Math.max(0, Math.min(1, progressPct));
    updateProgressUI();
  });
}

// ================================
//   类型筛选点击
// ================================
function initGenreChips() {
  document.querySelectorAll('.genre-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.genre-chip').forEach(c => c.classList.remove('active-chip'));
      chip.classList.add('active-chip');
    });
  });
}

// ================================
//   滚动时导航栏微妙动效
// ================================
function initScrollEffect() {
  const pages = document.querySelectorAll('.page');
  const navBar = document.getElementById('navBar');

  pages.forEach(page => {
    page.addEventListener('scroll', () => {
      const scrollY = page.scrollTop;
      if (navBar) {
        // 轻微收缩阴影
        const opacity = Math.min(1, scrollY / 60);
        navBar.querySelector('.nav-liquid-bg').style.boxShadow
          = `0 -${4 + opacity * 4}px ${24 + opacity * 16}px rgba(6,182,212,${0.07 + opacity * 0.06}), 0 -1px 8px rgba(0,0,0,${0.04 + opacity * 0.04})`;
      }
    });
  });
}

// ================================
//   初始化
// ================================
document.addEventListener('DOMContentLoaded', async () => {
  // 状态栏
  updateStatusBar();
  setInterval(updateStatusBar, 30000);

  applyIsland();        // ← 改这里
  applyGlobalFont();

  // 激活首页
  document.getElementById('pageHome')?.classList.add('active');

  // 播放器
  initPlayer();
  initVolume();
  initWaveformClick();
  initGenreChips();
  initSearch();
  initScrollEffect();

  // 首次绘制波形（预绘）
  setTimeout(drawWaveform, 300);

  // 播放器返回按钮
  const playerBack = document.getElementById('playerBack');
  if (playerBack) {
    playerBack.addEventListener('click', () => {
      switchPage('home');
      document.getElementById('navHome')?.classList.add('active');
      document.getElementById('navPlayer')?.classList.remove('active');
    });
  }

  // ✅ 从 IndexedDB 加载已保存的歌曲
  _tracks = await dbGetAllTracks();
  renderTrackLibrary();
  renderPlaylistList();
});

// 窗口 resize 重绘波形
window.addEventListener('resize', () => {
  if (currentPage === 'player') drawWaveform();
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update') applyIsland();
});

/* ================================
   数据存储（内存，刷新不丢失用IndexedDB可升级）
================================ */
let _tracks   = [];
let _playlists= JSON.parse(localStorage.getItem('wavr_playlists')|| '[]');
let _currentPlaylistId = null;
let _selectedTrackIds  = new Set();

// IndexedDB 存音频和封面大数据
let _waveDB = null;
function openWaveDB() {
  return new Promise((res, rej) => {
    if (_waveDB) return res(_waveDB);
    const req = indexedDB.open('WavrMusicDB', 2);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('tracks', { keyPath: 'id' });
    };
    req.onsuccess = e => { _waveDB = e.target.result; res(_waveDB); };
    req.onerror = () => rej();
  });
}
async function dbSaveTrack(track) {
  const db = await openWaveDB();
  return new Promise((res, rej) => {
    const req = db.transaction('tracks','readwrite').objectStore('tracks').put(track);
    req.onsuccess = () => res();
    req.onerror = () => rej();
  });
}
async function dbGetAllTracks() {
  const db = await openWaveDB();
  return new Promise(res => {
    const req = db.transaction('tracks').objectStore('tracks').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
}
async function saveTracks() {
  // 元数据仍存localStorage（不含大数据），方便快速读取歌名歌手
  const meta = _tracks.map(t => ({ id: t.id, name: t.name, artist: t.artist }));
  localStorage.setItem('wavr_tracks_meta', JSON.stringify(meta));
}
function savePlaylists() { localStorage.setItem('wavr_playlists', JSON.stringify(_playlists)); }

/* ================================
   返回 index.html
================================ */
document.getElementById('backToIndex')?.addEventListener('click', () => {
  const mask = document.getElementById('appTransMask');
  if (mask) {
    mask.style.transition = 'opacity 0.32s';
    mask.style.opacity = '1';
    mask.style.pointerEvents = 'all';
  }
  setTimeout(() => { window.location.href = 'index.html'; }, 300);
});

/* ================================
   渲染歌曲库
================================ */
function renderTrackLibrary() {
  const el = document.getElementById('trackLibrary');
  if (!el) return;
  if (_tracks.length === 0) {
    el.innerHTML = '<div class="lib-empty">NO TRACKS YET<br>TAP + TO ADD YOUR FIRST TRACK</div>';
    return;
  }
  el.innerHTML = _tracks.map((t, i) => `
    <div class="lib-track-item" onclick="playTrack(${i})">
      <div class="lib-track-cover">
        ${t.cover ? `<img src="${t.cover}"/>` : ''}
      </div>
      <div class="lib-track-info">
        <div class="lib-track-name">${t.name}</div>
        <div class="lib-track-artist">${t.artist}</div>
      </div>
      <div class="lib-track-play">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
      </div>
    </div>
  `).join('');
}

/* ================================
   渲染歌单列表
================================ */
function renderPlaylistList() {
  const el = document.getElementById('playlistList');
  if (!el) return;
  if (_playlists.length === 0) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = _playlists.map((pl, i) => `
    <div class="playlist-card" onclick="openPlaylistDetail(${i})">
      <div class="pl-card-cover">
        ${pl.cover ? `<img src="${pl.cover}"/>` : ''}
      </div>
      <div class="pl-card-info">
        <div class="pl-card-name">${pl.name}</div>
        <div class="pl-card-count">${pl.trackIds.length} TRACKS</div>
      </div>
      <div class="pl-card-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  `).join('');
}

/* ================================
   弹窗开关通用
================================ */
function openModal(panelId) {
  document.getElementById('modalOverlay').classList.add('show');
  document.getElementById(panelId).classList.add('show');
}
function closeModal(panelId) {
  document.getElementById('modalOverlay').classList.remove('show');
  document.getElementById(panelId).classList.remove('show');
}

/* ================================
   添加歌曲弹窗
================================ */
let _songCoverData = null;
let _songFileData  = null;

document.getElementById('openAddSong')?.addEventListener('click', () => openModal('addSongPanel'));
document.getElementById('closeAddSong')?.addEventListener('click', () => closeModal('addSongPanel'));

document.getElementById('songCoverInput')?.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _songCoverData = e.target.result;
    document.getElementById('songCoverImg').src = _songCoverData;
    document.getElementById('songCoverImg').style.display = 'block';
    document.querySelector('#songCoverPreview .cover-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

document.getElementById('songFileInput')?.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _songFileData = e.target.result;
    document.getElementById('fileDropLabel').textContent = file.name;
  };
  reader.readAsDataURL(file);
});

function switchUploadTab(type) {
  document.getElementById('uploadFileArea').style.display = type === 'file' ? 'block' : 'none';
  document.getElementById('uploadUrlArea').style.display  = type === 'url'  ? 'block' : 'none';
  document.getElementById('tabFile').classList.toggle('active', type === 'file');
  document.getElementById('tabUrl').classList.toggle('active',  type === 'url');
}

document.getElementById('saveSongBtn')?.addEventListener('click', async () => {
  const name   = document.getElementById('songNameInput').value.trim();
  const artist = document.getElementById('songArtistInput').value.trim();
  const url    = document.getElementById('songUrlInput')?.value.trim();

  if (!name) { alert('Please enter a track name'); return; }

  // 解析网易云链接
  let audioSrc = _songFileData || url || '';
  if (url && url.includes('music.163.com')) {
    const m = url.match(/id=(\d+)/);
    if (m) audioSrc = `https://music.163.com/song/media/outer/url?id=${m[1]}`;
  }

  const newTrack = { id: Date.now(), name, artist: artist || 'Unknown', cover: _songCoverData || null, src: audioSrc };
  _tracks.push(newTrack);
  await dbSaveTrack(newTrack);
  await saveTracks();
  renderTrackLibrary();
  closeModal('addSongPanel');

  // 重置
  document.getElementById('songNameInput').value = '';
  document.getElementById('songArtistInput').value = '';
  document.getElementById('songUrlInput').value = '';
  document.getElementById('fileDropLabel').textContent = 'CLICK TO SELECT AUDIO FILE';
  document.getElementById('songCoverImg').style.display = 'none';
  document.querySelector('#songCoverPreview .cover-placeholder').style.display = 'flex';
  _songCoverData = null;
  _songFileData  = null;
});

/* ================================
   创建歌单弹窗
================================ */
let _plCoverData = null;

document.getElementById('openCreatePlaylist')?.addEventListener('click', () => openModal('createPlaylistPanel'));
document.getElementById('closeCreatePlaylist')?.addEventListener('click', () => closeModal('createPlaylistPanel'));

document.getElementById('plCoverInput')?.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _plCoverData = e.target.result;
    document.getElementById('plCoverImg').src = _plCoverData;
    document.getElementById('plCoverImg').style.display = 'block';
    document.querySelector('#plCoverPreview .cover-placeholder').style.display = 'none';
  };
  reader.readAsDataURL(file);
});

document.getElementById('savePlaylistBtn')?.addEventListener('click', () => {
  const name = document.getElementById('plNameInput').value.trim();
  const desc = document.getElementById('plDescInput').value.trim();
  if (!name) { alert('Please enter a playlist name'); return; }

  _playlists.push({ id: Date.now(), name, desc, cover: _plCoverData || null, trackIds: [] });
  savePlaylists();
  renderPlaylistList();
  closeModal('createPlaylistPanel');

  document.getElementById('plNameInput').value = '';
  document.getElementById('plDescInput').value = '';
  document.getElementById('plCoverImg').style.display = 'none';
  document.querySelector('#plCoverPreview .cover-placeholder').style.display = 'flex';
  _plCoverData = null;
});

// 点击遮罩关闭所有弹窗
document.getElementById('modalOverlay')?.addEventListener('click', () => {
  ['addSongPanel','createPlaylistPanel','addToPlaylistPanel'].forEach(id => closeModal(id));
});

/* ================================
   歌单详情页
================================ */
function openPlaylistDetail(idx) {
  _currentPlaylistId = idx;
  const pl = _playlists[idx];
  const detail = document.getElementById('playlistDetail');

  document.getElementById('pdTitle').textContent = pl.name.toUpperCase();
  document.getElementById('pdName').textContent  = pl.name;
  document.getElementById('pdDesc').textContent  = pl.desc || '';
  document.getElementById('pdCount').textContent = pl.trackIds.length + ' TRACKS';

  const cover = document.getElementById('pdCover');
  cover.innerHTML = pl.cover ? `<img src="${pl.cover}" style="width:100%;height:100%;object-fit:cover;"/>` : '';

  renderPlaylistTracks();
  detail.style.display = 'block';
  requestAnimationFrame(() => detail.style.opacity = '1');
}

function renderPlaylistTracks() {
  const pl  = _playlists[_currentPlaylistId];
  const el  = document.getElementById('pdTrackList');
  if (!el) return;

  if (pl.trackIds.length === 0) {
    el.innerHTML = '<div class="pd-empty">NO TRACKS IN THIS PLAYLIST<br>TAP "ADD TRACKS" TO GET STARTED</div>';
    return;
  }
  const tracks = pl.trackIds.map(id => _tracks.find(t => t.id === id)).filter(Boolean);
  el.innerHTML = tracks.map((t, i) => `
    <div class="lib-track-item" onclick="playTrack(${_tracks.indexOf(t)})">
      <div class="lib-track-cover">
        ${t.cover ? `<img src="${t.cover}"/>` : ''}
      </div>
      <div class="lib-track-info">
        <div class="lib-track-name">${t.name}</div>
        <div class="lib-track-artist">${t.artist}</div>
      </div>
      <div class="lib-track-play">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
      </div>
    </div>
  `).join('');
}

document.getElementById('closePlaylistDetail')?.addEventListener('click', () => {
  document.getElementById('playlistDetail').style.display = 'none';
  _currentPlaylistId = null;
});

/* ================================
   从歌库选歌加入歌单
================================ */
document.getElementById('openAddToPlaylist')?.addEventListener('click', () => {
  _selectedTrackIds = new Set(_playlists[_currentPlaylistId].trackIds);
  renderSelectTrackList();
  openModal('addToPlaylistPanel');
});
document.getElementById('closeAddToPlaylist')?.addEventListener('click', () => closeModal('addToPlaylistPanel'));

function renderSelectTrackList() {
  const el = document.getElementById('selectTrackList');
  if (!el) return;
  if (_tracks.length === 0) {
    el.innerHTML = '<div class="pd-empty">NO TRACKS IN LIBRARY YET</div>';
    return;
  }
  el.innerHTML = _tracks.map(t => {
    const sel = _selectedTrackIds.has(t.id);
    return `
      <div class="sel-track-item ${sel ? 'selected' : ''}" onclick="toggleSelectTrack(${t.id}, this)">
        <div class="sel-track-cover">
          ${t.cover ? `<img src="${t.cover}"/>` : ''}
        </div>
        <div class="sel-track-info">
          <div class="sel-track-name">${t.name}</div>
          <div class="sel-track-artist">${t.artist}</div>
        </div>
        <div class="sel-track-check">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      </div>
    `;
  }).join('');
}

function toggleSelectTrack(id, el) {
  if (_selectedTrackIds.has(id)) {
    _selectedTrackIds.delete(id);
    el.classList.remove('selected');
  } else {
    _selectedTrackIds.add(id);
    el.classList.add('selected');
  }
}

document.getElementById('confirmAddToPlaylist')?.addEventListener('click', () => {
  _playlists[_currentPlaylistId].trackIds = Array.from(_selectedTrackIds);
  savePlaylists();
  renderPlaylistTracks();
  document.getElementById('pdCount').textContent = _playlists[_currentPlaylistId].trackIds.length + ' TRACKS';
  closeModal('addToPlaylistPanel');
});

/* ================================
   播放歌曲
================================ */
function playTrack(idx) {
  const t = _tracks[idx];
  if (!t || !t.src) { alert('No audio source for this track'); return; }
  const audio = document.getElementById('audioPlayer');
  if (!audio) return;
  _currentTrackIdx = idx;
  audio.src = t.src;
  audio.play().catch(() => {});
  goToPlayer();
  const titleEl  = document.getElementById('playerSongTitle');
  const artistEl = document.getElementById('playerSongArtist');
  if (titleEl)  titleEl.textContent  = t.name;
  if (artistEl) artistEl.textContent = t.artist;
  // 加载该歌曲的歌词
  renderLyricArea(t.id);
}

/* ================================
   当前播放曲目索引
================================ */
let _currentTrackIdx = -1;

/* ================================
   歌词系统
================================ */
// 格式：{ trackId: [ {time: 秒数, text: '歌词'}, ... ] }
let _lyricsDB = JSON.parse(localStorage.getItem('wavr_lyrics') || '{}');
let _lyricTimer = null;

function parseLrc(lrcText) {
  const lines = lrcText.split('\n');
  const result = [];
  const timeReg = /\[(\d+):(\d+)\.(\d+)\]/g;
  lines.forEach(line => {
    let m;
    timeReg.lastIndex = 0;
    const text = line.replace(/\[\d+:\d+\.\d+\]/g, '').trim();
    if (!text) return;
    while ((m = timeReg.exec(line)) !== null) {
      const secs = parseInt(m[1]) * 60 + parseInt(m[2]) + parseInt(m[3]) / 100;
      result.push({ time: secs, text });
    }
  });
  return result.sort((a, b) => a.time - b.time);
}

function saveLyrics(trackId, lrcText) {
  _lyricsDB[trackId] = parseLrc(lrcText);
  localStorage.setItem('wavr_lyrics', JSON.stringify(_lyricsDB));
}

function renderLyricArea(trackId) {
  const lyrics = _lyricsDB[trackId];
  const emptyEl = document.getElementById('lyricEmpty');
  const linesEl = document.getElementById('lyricLines');
  if (!lyrics || lyrics.length === 0) {
    emptyEl && (emptyEl.style.display = 'flex');
    linesEl && (linesEl.style.display = 'none');
    return;
  }
  emptyEl && (emptyEl.style.display = 'none');
  linesEl && (linesEl.style.display = 'flex');
  linesEl.innerHTML = lyrics.map((l, i) =>
    `<div class="lyric-line" data-idx="${i}">${l.text}</div>`
  ).join('');
}

function syncLyric(trackId, currentSec) {
  const lyrics = _lyricsDB[trackId];
  if (!lyrics || lyrics.length === 0) return;
  let activeIdx = 0;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentSec >= lyrics[i].time) activeIdx = i;
  }
  const linesEl = document.getElementById('lyricLines');
  if (!linesEl) return;
  linesEl.querySelectorAll('.lyric-line').forEach((el, i) => {
    el.classList.toggle('active', i === activeIdx);
  });
  // 自动滚动到当前歌词
  const activeLine = linesEl.querySelector('.lyric-line.active');
  if (activeLine) activeLine.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// 歌词弹窗开关
function openLyricPanel() {
  document.getElementById('lyricOverlay').classList.add('show');
  document.getElementById('lyricPanel').classList.add('show');
}
function closeLyricPanel() {
  document.getElementById('lyricOverlay').classList.remove('show');
  document.getElementById('lyricPanel').classList.remove('show');
}

document.getElementById('closeLyricPanel')?.addEventListener('click', closeLyricPanel);
document.getElementById('lyricOverlay')?.addEventListener('click', closeLyricPanel);
document.getElementById('openLyricPanel')?.addEventListener('click', openLyricPanel);

// 歌词Tab切换
function switchLyricTab(type) {
  document.getElementById('lyricUploadArea').style.display = type === 'upload' ? 'block' : 'none';
  document.getElementById('lyricManualArea').style.display = type === 'manual' ? 'block' : 'none';
  document.getElementById('ltabUpload').classList.toggle('active', type === 'upload');
  document.getElementById('ltabManual').classList.toggle('active', type === 'manual');
}

// 上传 .lrc 文件
let _lyricFileContent = '';
document.getElementById('lyricFileInput')?.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _lyricFileContent = e.target.result;
    document.getElementById('lyricFileLabel').textContent = file.name;
  };
  reader.readAsText(file, 'UTF-8');
});

// 保存歌词
document.getElementById('saveLyricBtn')?.addEventListener('click', () => {
  if (_currentTrackIdx < 0) { alert('Please play a track first'); return; }
  const track = _tracks[_currentTrackIdx];
  const manualText = document.getElementById('lyricManualInput')?.value.trim();
  const content = manualText || _lyricFileContent;
  if (!content) { alert('Please upload a file or enter lyrics manually'); return; }
  saveLyrics(track.id, content);
  renderLyricArea(track.id);
  closeLyricPanel();
  _lyricFileContent = '';
  document.getElementById('lyricFileLabel').textContent = 'CLICK TO SELECT .LRC FILE';
  document.getElementById('lyricManualInput').value = '';
});

/* ================================
   一起听功能
================================ */
let _ltSelectedChar = null;
let _ltUserAvatar   = null;
let _ltUserNickname = '';
let _ltUserRelation = '';
let _ltChatHistory  = [];

// 打开一起听弹窗
document.getElementById('ctrlListenTogether')?.addEventListener('click', () => {
  openLtModal();
});

async function openLtModal() {
  // 读取角色库
  const chars = await loadCharsFromDB();
  renderLtCharList(chars);
  document.getElementById('ltOverlay').classList.add('show');
  document.getElementById('ltModal').classList.add('show');
  document.getElementById('ltInviting').style.display = 'none';
  document.getElementById('ltCharList').style.display = 'flex';
}

function closeLtModal() {
  document.getElementById('ltOverlay').classList.remove('show');
  document.getElementById('ltModal').classList.remove('show');
}

document.getElementById('ltModalClose')?.addEventListener('click', closeLtModal);
document.getElementById('ltOverlay')?.addEventListener('click', closeLtModal);

// 从 LunaCharDB 读取角色
function loadCharsFromDB() {
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB', 2);
    req.onsuccess = e => {
      const db  = e.target.result;
      if (!db.objectStoreNames.contains('chars')) return res([]);
      const r   = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

// 渲染角色选择列表
function renderLtCharList(chars) {
  const el = document.getElementById('ltCharList');
  if (!chars || chars.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:30px 0;font-family:var(--font-title);font-size:10px;letter-spacing:2px;color:var(--slate-500);">NO CHARACTERS FOUND<br><span style="font-size:9px;opacity:0.6;">请先在角色档案中创建角色</span></div>';
    return;
  }
  el.innerHTML = chars.map(c => `
    <div class="lt-char-item" onclick="selectLtChar(${c.id})">
      <div class="lt-char-avatar">
        ${c.avatar ? `<img src="${c.avatar}"/>` : (c.name || '?')[0].toUpperCase()}
      </div>
      <div class="lt-char-info">
        <div class="lt-char-name">${c.name || '未命名'}</div>
        <div class="lt-char-role">${c.role || ''} ${c.gender ? '· ' + c.gender : ''}</div>
      </div>
      <div class="lt-char-arrow">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>
      </div>
    </div>
  `).join('');
  // 保存到全局供后续使用
  window._ltChars = chars;
}

// 选择角色后进入邀请动画
async function selectLtChar(charId) {
  const chars = window._ltChars || await loadCharsFromDB();
  _ltSelectedChar = chars.find(c => c.id === charId);
  if (!_ltSelectedChar) return;

  // 切换到邀请动画
  document.getElementById('ltCharList').style.display = 'none';
  document.getElementById('ltInviting').style.display = 'flex';

  const avatarEl = document.getElementById('ltInviteAvatar');
  if (_ltSelectedChar.avatar) {
    avatarEl.innerHTML = `<img src="${_ltSelectedChar.avatar}"/>`;
  } else {
    avatarEl.textContent = (_ltSelectedChar.name || '?')[0].toUpperCase();
  }
  document.getElementById('ltInviteName').textContent = _ltSelectedChar.name || '未命名';

  // 1.8秒后关闭弹窗，打开用户信息弹窗
  setTimeout(() => {
    closeLtModal();
    openLtUserModal();
  }, 1800);
}

// 打开用户信息设置弹窗
function openLtUserModal() {
  document.getElementById('ltUserOverlay').classList.add('show');
  const modal = document.getElementById('ltUserModal');
  modal.style.display = 'block';
  requestAnimationFrame(() => modal.classList.add('show'));
}
function closeLtUserModal() {
  document.getElementById('ltUserOverlay').classList.remove('show');
  document.getElementById('ltUserModal').classList.remove('show');
  setTimeout(() => { document.getElementById('ltUserModal').style.display = 'none'; }, 420);
}

document.getElementById('ltUserModalClose')?.addEventListener('click', closeLtUserModal);
document.getElementById('ltUserOverlay')?.addEventListener('click', closeLtUserModal);

// 上传用户头像
document.getElementById('ltUserAvatarInput')?.addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    _ltUserAvatar = e.target.result;
    const preview = document.getElementById('ltUserAvatarPreview');
    preview.innerHTML = `<img src="${_ltUserAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;"/>`;
  };
  reader.readAsDataURL(file);
});

// 确认进入聊天
document.getElementById('ltUserConfirm')?.addEventListener('click', () => {
  _ltUserNickname = document.getElementById('ltUserNickname').value.trim() || '你';
  _ltUserRelation = document.getElementById('ltUserRelation').value.trim() || '朋友';
  closeLtUserModal();
  openLtChatPage();
});

// 打开聊天页
function openLtChatPage() {
  const chatPage = document.getElementById('ltChatPage');
  chatPage.style.display = 'flex';
  requestAnimationFrame(() => { chatPage.style.opacity = '1'; });

  // 设置顶部角色头像
  const charAvatarEl = document.getElementById('ltChatAvatarChar');
  if (_ltSelectedChar?.avatar) {
    charAvatarEl.innerHTML = `<img src="${_ltSelectedChar.avatar}"/>`;
  } else {
    charAvatarEl.innerHTML = `<div class="lt-chat-avatar-placeholder" style="font-family:var(--font-display);font-size:16px;color:var(--cyan-600)">${(_ltSelectedChar?.name||'?')[0].toUpperCase()}</div>`;
  }

  // 设置用户头像
  const meAvatarEl = document.getElementById('ltChatAvatarMe');
  if (_ltUserAvatar) {
    meAvatarEl.innerHTML = `<img src="${_ltUserAvatar}"/>`;
  }

  document.getElementById('ltChatCharName').textContent = _ltSelectedChar?.name || '—';

  // 正在播放歌曲标题
  const titleEl = document.getElementById('playerSongTitle');
  document.getElementById('ltNpbTitle').textContent = titleEl?.textContent || '—';

  // 清空消息（开场白不加入历史记录，不触发AI）
  _ltChatHistory = [];
  document.getElementById('ltChatMessages').innerHTML = '';

  // 开场白由 AI 生成，每次不一样
  setTimeout(() => { generateLtGreeting(); }, 600);

  // 同步聊天页状态栏
  updateLtChatStatusBar();
  clearInterval(window._ltStatusTimer);
  window._ltStatusTimer = setInterval(updateLtChatStatusBar, 30000);

  // 设置悬浮球头像
  const floatAvatar = document.getElementById('ltFloatAvatar');
  if (floatAvatar) {
    if (_ltSelectedChar?.avatar) {
      floatAvatar.innerHTML = `<img src="${_ltSelectedChar.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    } else {
      floatAvatar.textContent = (_ltSelectedChar?.name || '?')[0].toUpperCase();
    }
  }
}

// 同步聊天页状态栏（时间+电量+灵动岛）
function updateLtChatStatusBar() {
  const timeEl = document.getElementById('ltStatusTime');
  const batPct  = document.getElementById('ltBatPct');
  const batInner = document.getElementById('ltBatInner');
  const islandEl = document.getElementById('ltStatusIsland');

  // 时间
  const now = new Date();
  const h = now.getHours().toString().padStart(2,'0');
  const m = now.getMinutes().toString().padStart(2,'0');
  if (timeEl) timeEl.textContent = `${h}:${m}`;

  // 电量
  let bat = parseInt(localStorage.getItem('luna_battery') || '76');
  if (batPct) batPct.textContent = bat;
  if (batInner) {
    batInner.style.width = bat + '%';
    batInner.style.background = bat <= 20
      ? 'linear-gradient(90deg,#f87171,#ef4444)'
      : 'linear-gradient(90deg,#22d3ee,#14b8a6)';
  }

  // 灵动岛
  if (islandEl) {
    const enabled = localStorage.getItem('luna_island_enabled') === 'true';
    const style   = localStorage.getItem('luna_island_style') || 'minimal';
    if (!enabled) { islandEl.innerHTML = ''; return; }
    const styleMap = {
      minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
      glow:   `<div class="si-glow"><div class="si-capsule"></div></div>`,
      clock:  `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">${h}:${m}</span></div></div>`,
      pulse:  `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
      ripple: `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
      rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
      music:  `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
      scan:   `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
    };
    islandEl.innerHTML = styleMap[style] || styleMap.minimal;
  }
}

// 仅展示消息（不加入AI历史，用于开场白）
function appendLtMsgDisplay(side, text) {
  const el = document.getElementById('ltChatMessages');
  const isRight = side === 'user';
  const name  = isRight ? _ltUserNickname : (_ltSelectedChar?.name || '角色');
  const avatar = isRight
    ? (_ltUserAvatar ? `<img src="${_ltUserAvatar}"/>` : `<div class="lt-chat-avatar-placeholder"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>`)
    : (_ltSelectedChar?.avatar ? `<img src="${_ltSelectedChar.avatar}"/>` : `<span style="font-family:var(--font-display);font-size:13px;color:var(--cyan-700)">${(_ltSelectedChar?.name||'?')[0]}</span>`);
  const div = document.createElement('div');
  div.className = `lt-msg ${isRight ? 'lt-msg-right' : ''}`;
  div.innerHTML = `
    <div class="lt-msg-avatar">${avatar}</div>
    <div class="lt-msg-content">
      <div class="lt-msg-name">${name.toUpperCase()}</div>
      <div class="lt-msg-bubble">${text}</div>
    </div>
  `;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  // 不推送到 _ltChatHistory
}

// 返回按钮 → 聊天页收起，悬浮球出现
document.getElementById('ltChatBack')?.addEventListener('click', () => {
  const chatPage  = document.getElementById('ltChatPage');
  const floatBall = document.getElementById('ltFloatBall');
  chatPage.style.transition = 'opacity 0.28s ease, transform 0.28s cubic-bezier(0.32,0.72,0,1)';
  chatPage.style.opacity = '0';
  chatPage.style.transform = 'scale(0.88)';
  setTimeout(() => {
    chatPage.style.display = 'none';
    chatPage.style.transform = '';
    chatPage.style.transition = '';
    if (floatBall) {
      floatBall.style.opacity = '0';
      floatBall.style.transform = 'scale(0)';
      floatBall.style.display = 'flex';
      requestAnimationFrame(() => {
        floatBall.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
        floatBall.style.opacity = '1';
        floatBall.style.transform = 'scale(1)';
      });
    }
  }, 280);
});

// 点击悬浮球 → 重新展开聊天页
document.getElementById('ltFloatBall')?.addEventListener('click', () => {
  const floatBall = document.getElementById('ltFloatBall');
  const chatPage  = document.getElementById('ltChatPage');
  floatBall.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
  floatBall.style.opacity = '0';
  floatBall.style.transform = 'scale(0)';
  setTimeout(() => {
    floatBall.style.display = 'none';
    floatBall.style.transition = '';
    chatPage.style.opacity = '0';
    chatPage.style.transform = 'scale(0.92)';
    chatPage.style.display = 'flex';
    requestAnimationFrame(() => {
      chatPage.style.transition = 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)';
      chatPage.style.opacity = '1';
      chatPage.style.transform = 'scale(1)';
    });
    updateLtChatStatusBar();
  }, 200);
});

// 添加消息气泡（加入AI历史）
function appendLtMsg(side, text) {
  const el = document.getElementById('ltChatMessages');
  const isRight = side === 'user';
  const name  = isRight ? _ltUserNickname : (_ltSelectedChar?.name || '角色');
  const avatar = isRight
    ? (_ltUserAvatar ? `<img src="${_ltUserAvatar}"/>` : `<div class="lt-chat-avatar-placeholder"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg></div>`)
    : (_ltSelectedChar?.avatar ? `<img src="${_ltSelectedChar.avatar}"/>` : `<span style="font-family:var(--font-display);font-size:13px;color:var(--cyan-700)">${(_ltSelectedChar?.name||'?')[0]}</span>`);

  const div = document.createElement('div');
  div.className = `lt-msg ${isRight ? 'lt-msg-right' : ''}`;
  div.innerHTML = `
    <div class="lt-msg-avatar">${avatar}</div>
    <div class="lt-msg-content">
      <div class="lt-msg-name">${name.toUpperCase()}</div>
      <div class="lt-msg-bubble">${text}</div>
    </div>
  `;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
  _ltChatHistory.push({ role: isRight ? 'user' : 'assistant', content: text });
}

// 显示打字中气泡
function showLtTyping() {
  const el  = document.getElementById('ltChatMessages');
  const div = document.createElement('div');
  div.className = 'lt-msg lt-typing';
  div.id = 'ltTypingBubble';
  const avatar = _ltSelectedChar?.avatar
    ? `<img src="${_ltSelectedChar.avatar}"/>`
    : `<span style="font-family:var(--font-display);font-size:13px;color:var(--cyan-700)">${(_ltSelectedChar?.name||'?')[0]}</span>`;
  div.innerHTML = `
    <div class="lt-msg-avatar">${avatar}</div>
    <div class="lt-msg-content">
      <div class="lt-msg-name">${(_ltSelectedChar?.name||'角色').toUpperCase()}</div>
      <div class="lt-msg-bubble"><div class="lt-typing-dots"><span></span><span></span><span></span></div></div>
    </div>
  `;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}
function hideLtTyping() {
  document.getElementById('ltTypingBubble')?.remove();
}

// 获取API配置（从设置页存储的 luna_api_current + luna_api_model）
function getLtApiConfig() {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || 'claude-sonnet-4-20250514';
  return { baseUrl: cur.baseUrl || '', apiKey: cur.apiKey || '', model };
}

// 构建角色人设核心描述（供所有 AI 调用复用）
function buildCharProfile() {
  const songTitle  = document.getElementById('playerSongTitle')?.textContent || '这首歌';
  const songArtist = document.getElementById('playerSongArtist')?.textContent || '';
  const c = _ltSelectedChar || {};
  return `你扮演「${c.name || '角色'}」，${c.role || ''}，性别${c.gender || '未知'}，性格：${(c.traits||[]).join('、')||'温柔自然'}。
你现在正和你的${_ltUserRelation}「${_ltUserNickname}」一起听歌，当前歌曲：《${songTitle}》${songArtist ? ' - ' + songArtist : ''}。

【核心规则，必须严格遵守】
1. 完全代入角色，用角色的口吻、习惯用语和性格说话，不能出戏。
2. 禁止任何括号内容，包括动作描写（微笑）、心理描写（心想）、旁白等，只说话。
3. 每次回复拆成1~3条短消息，用换行符\\n分隔，每条10~25字，像真人发微信一样自然分段。
4. 不要一次说完所有想说的，留有余地，让对话继续下去。
5. 可以主动问对方问题、分享感受、聊歌曲、聊当下心情，保持话题活跃。
6. 如果对话沉默或者对方只说了很短的话，主动发起新话题或追问。
7. 回复内容要接着上下文来，不能答非所问。
8. 禁止用"哈哈哈哈哈"堆砌，情绪要真实克制。`;
}

// 调用 AI 的核心函数（通用）
async function callLtAI(messages, extraInstruction = '') {
  const { baseUrl, apiKey, model } = getLtApiConfig();
  if (!apiKey || !model) return null;

  const systemPrompt = buildCharProfile() + (extraInstruction ? '\n' + extraInstruction : '');
  const endpoint = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}/chat/completions`
    : 'https://api-d-anthropic-d-com-s-cld.v.tuangouai.com/v1/messages';
  const isAnthropic = !baseUrl;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };
  if (isAnthropic) headers['x-api-key'] = apiKey;

  const body = isAnthropic
    ? JSON.stringify({ model, max_tokens: 300, system: systemPrompt, messages })
    : JSON.stringify({ model, max_tokens: 300, messages: [{ role: 'system', content: systemPrompt }, ...messages] });

  const resp = await fetch(endpoint, { method: 'POST', headers, body });
  const data = await resp.json();
  return isAnthropic
    ? (data?.content?.[0]?.text || null)
    : (data?.choices?.[0]?.message?.content || null);
}

// 把 AI 返回的文本按 \n 拆成多条气泡，逐条延迟发送
async function sendMultiBubbles(text, side) {
  const parts = text.split('\n').map(s => s.trim()).filter(s => s.length > 0);
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      hideLtTyping(); // 先把第一个打字泡干掉
    } else {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      hideLtTyping(); // 每条发之前先清掉打字泡
    }
    appendLtMsg(side, parts[i]);
    // 如果后面还有内容，发完这条再显示打字泡
    if (i < parts.length - 1) {
      await new Promise(r => setTimeout(r, 80));
      showLtTyping();
    }
  }
  hideLtTyping(); // 兜底：确保最终一定清掉
}

// 生成 AI 开场白（每次不一样）
async function generateLtGreeting() {
  const { apiKey, model } = getLtApiConfig();
  // 没配置 API 就用固定开场白
  if (!apiKey || !model) {
    appendLtMsgDisplay('char', `嘿，${_ltUserNickname}～ 这首歌好好听，一起聊聊吧！`);
    return;
  }
  showLtTyping();
  try {
    const songTitle = document.getElementById('playerSongTitle')?.textContent || '这首歌';
    const result = await callLtAI([{
      role: 'user',
      content: `你刚刚邀请${_ltUserNickname}一起听《${songTitle}》，现在发第一条消息打招呼，自然随意，像真人发微信，用\\n拆成1~2条短句，不要括号动作描写。`
    }]);
    hideLtTyping();
    if (result) {
      await sendMultiBubbles(result, 'char');
    } else {
      appendLtMsgDisplay('char', `${_ltUserNickname}，这首歌你有没有听过？`);
    }
  } catch(e) {
    hideLtTyping();
    appendLtMsgDisplay('char', `${_ltUserNickname}，快来听这首歌！`);
  }
}

// 发送消息（用户手动发送，不触发AI）
async function sendLtMessage() {
  const input = document.getElementById('ltChatInput');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  appendLtMsg('user', text);
}

// AI 回复按钮
async function triggerAiReply() {
  if (_ltChatHistory.length === 0) return;
  const btn = document.getElementById('ltAiReplyBtn');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.5'; }
  showLtTyping();

  try {
    const messages = _ltChatHistory.slice(-10);
    const lastUserMsg = [..._ltChatHistory].reverse().find(m => m.role === 'user');
    // 如果用户最后一条很短或者聊了超过4轮没主动问问题，提示AI主动带话题
    const shouldDriveTopic = !lastUserMsg || lastUserMsg.content.length < 6 || _ltChatHistory.length % 5 === 0;
    const extra = shouldDriveTopic
      ? '\n当前对话需要你主动带动话题，问对方一个有趣的问题或分享你的感受，不要只是简单回应。'
      : '';

    const result = await callLtAI(messages, extra);
    hideLtTyping();
    if (result) {
      await sendMultiBubbles(result, 'char');
    } else {
      appendLtMsg('char', '...');
    }
  } catch(e) {
    hideLtTyping();
    appendLtMsg('char', '网络好像有点问题，稍后再试试～');
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ''; }
  }
}

document.getElementById('ltChatSend')?.addEventListener('click', sendLtMessage);
document.getElementById('ltChatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendLtMessage();
});
document.getElementById('ltAiReplyBtn')?.addEventListener('click', triggerAiReply);

/* ================================
   Community 页 — 好友广场
================================ */

// IndexedDB 操作（帖子存储）
const FEED_DB_NAME = 'WavrFeedDB';
const FEED_STORE   = 'posts';

function openFeedDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(FEED_DB_NAME, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(FEED_STORE)) {
        db.createObjectStore(FEED_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej();
  });
}

async function feedDbGetAll() {
  const db = await openFeedDB();
  return new Promise(res => {
    const r = db.transaction(FEED_STORE).objectStore(FEED_STORE).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror   = () => res([]);
  });
}

async function feedDbClear() {
  const db = await openFeedDB();
  return new Promise(res => {
    const tx = db.transaction(FEED_STORE, 'readwrite');
    tx.objectStore(FEED_STORE).clear();
    tx.oncomplete = () => res();
  });
}

async function feedDbAddMany(posts) {
  const db = await openFeedDB();
  return new Promise(res => {
    const tx    = db.transaction(FEED_STORE, 'readwrite');
    const store = tx.objectStore(FEED_STORE);
    posts.forEach(p => store.add(p));
    tx.oncomplete = () => res();
  });
}

// 渲染好友头像行
async function renderCommFriends() {
  const el = document.getElementById('commFriendsList');
  if (!el) return;
  const chars = await loadCharsFromDB();
  if (!chars.length) { el.innerHTML = '<div style="padding:10px 20px;font-size:12px;color:var(--slate-400);font-family:var(--font-body);opacity:0.5;">暂无角色，先去创建吧</div>'; return; }
  const colors = ['ins-av-c0','ins-av-c1','ins-av-c2','ins-av-c3','ins-av-c4','ins-av-c5','ins-av-c6'];
  el.innerHTML = chars.map((c, i) => `
    <div class="lf-item">
      <div class="lf-avatar ${colors[i % colors.length]}" style="display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:18px;font-weight:700;color:#fff;position:relative;">
        ${c.avatar ? `<img src="${c.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>` : (c.name||'?')[0].toUpperCase()}
        <div class="lf-live-ring"></div>
      </div>
      <div class="lf-name">${c.name||'未命名'}</div>
      <div class="lf-track">${c.role||''}</div>
    </div>
  `).join('');
}

// 渲染帖子列表
function renderFeedPosts(posts) {
  const el      = document.getElementById('commFeedList');
  const emptyEl = document.getElementById('commEmpty');
  if (!el) return;

  if (!posts || posts.length === 0) {
    el.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  const colors  = ['ins-av-c0','ins-av-c1','ins-av-c2','ins-av-c3','ins-av-c4','ins-av-c5','ins-av-c6'];
  const imgCls  = ['ins-img-0','ins-img-1','ins-img-2','ins-img-3','ins-img-4','ins-img-5'];
  const tagMap  = {
    rec:    ['ins-tag-rec',    '🎵 推荐'],
    review: ['ins-tag-review', '✦ 测评'],
    mood:   ['ins-tag-mood',   '💭 心情'],
    story:  ['ins-tag-story',  '📖 故事'],
  };
  const times = ['刚刚','2分钟前','5分钟前','8分钟前','13分钟前','刚刚','3分钟前','10分钟前','6分钟前','刚刚'];

  el.innerHTML = posts.map((p, i) => {
    const [tagCls, tagLabel] = tagMap[p.tag] || tagMap.rec;
    const colorCls = colors[i % colors.length];
    const imgCl    = imgCls[i % imgCls.length];
    const hasImage = p.hasImage;
    const avatarHtml = p.avatar
      ? `<img src="${p.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`
      : (p.authorInitial || '?');
    const likeCount = p.likes || Math.floor(Math.random() * 200 + 8);
    const cmtCount  = p.comments || Math.floor(Math.random() * 30 + 1);

    return `
      <div class="ins-card" data-id="${i}">
        <div class="ins-card-header">
          <div class="ins-avatar ${colorCls}">${avatarHtml}</div>
          <div class="ins-user-info">
            <div class="ins-username">${p.authorName}</div>
            <div class="ins-handle">@${p.handle} · ${times[i % times.length]}</div>
          </div>
          <div class="ins-more-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </div>
        </div>
        <div class="ins-post-tag ${tagCls}">${tagLabel}</div>
        <div class="ins-post-body">${p.body}</div>
        ${p.tag === 'rec' && p.trackName ? `
          <div class="ins-track-bar">
            <div class="ins-track-art ${imgCl}"></div>
            <div class="ins-track-info">
              <div class="ins-track-title">${p.trackName}</div>
              <div class="ins-track-artist">${p.trackArtist || 'Wavr · 未知艺术家'}</div>
            </div>
            <div class="ins-track-play">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
            </div>
          </div>` : (hasImage ? `<div class="ins-image-block ${imgCl}"><div class="ins-image-label">${p.imageLabel||'NOW PLAYING'}</div></div>` : '')}
        <div class="ins-actions">
          <div class="ins-action-btn" onclick="toggleFeedLike(this,${i})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l7.78 7.78 7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span>${likeCount}</span>
          </div>
          <div class="ins-action-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>${cmtCount}</span>
          </div>
          <div class="ins-action-btn">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            <span>分享</span>
          </div>
          <div class="ins-timestamp">${times[i % times.length]}</div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleFeedLike(btn, idx) {
  btn.classList.toggle('liked');
  const span = btn.querySelector('span');
  const n = parseInt(span.textContent);
  span.textContent = btn.classList.contains('liked') ? n + 1 : n - 1;
}

// 生成帖子（调用AI）
async function generateFeedPosts() {
  const btn = document.getElementById('commGenBtn');
  const genEl  = document.getElementById('commGenerating');
  const emptyEl = document.getElementById('commEmpty');

  if (btn) btn.disabled = true;
  if (genEl)  { genEl.style.display  = 'flex'; }
  if (emptyEl){ emptyEl.style.display = 'none'; }
  document.getElementById('commFeedList').innerHTML = '';

  const { baseUrl, apiKey, model } = getLtApiConfig();
  if (!apiKey || !model) {
    if (genEl) genEl.style.display = 'none';
    if (btn)   btn.disabled = false;
    document.getElementById('commFeedList').innerHTML =
      '<div style="padding:24px;text-align:center;font-size:12px;color:var(--slate-400);font-family:var(--font-body);">请先在设置中配置 AI 模型</div>';
    return;
  }

  // 获取角色列表
  const chars = await loadCharsFromDB();
  const charDesc = chars.length
    ? chars.map(c => `${c.name}（${c.role||''}，${c.gender||''}，性格：${(c.traits||[]).join('、')||'温柔'}）`).join('；')
    : '一些虚构角色';

  const prompt = `你是一个社交媒体内容生成器。请根据以下角色信息，生成5条真实感极强、有网感的社交帖子。

角色列表：${charDesc}

要求：
1. 每条帖子由不同角色发布，从角色列表中选，或者生成新的博主名字（不一定要用角色列表里的，可以自由发挥创建新的网友账号）
2. 帖子类型随机分配：推荐歌曲(rec)、音乐测评(review)、心情碎片(mood)、故事感叙述(story)
3. 正文要有真实网感，可以有语气词、emoji、不完整句子、突然换行，像真人在发小红书/微博
4. 正文字数：每条120~200字，有内容有料，不能太短
5. 禁止括号动作描写，就是正常发帖内容
6. tag为rec的帖子必须填trackName（歌名）和trackArtist（歌手），其他类型帖子可以带配图（hasImage:true），配图标签用氛围词
7. handle是英文小写ID，有个性

请严格按以下JSON格式返回，不要有任何其他文字，不要markdown代码块：
[
  {
    "authorName": "发帖人名字",
    "handle": "英文id",
    "tag": "rec|review|mood|story",
    "body": "帖子正文，可以有emoji和换行\\n",
    "hasImage": true或false,
    "imageLabel": "配图标签（hasImage为true时填）",
    "trackName": "推荐的歌曲名（tag为rec时必填）",
    "trackArtist": "歌手名（tag为rec时必填）",
    "avatar": null
  }
]`;

  try {
    const endpoint = baseUrl
      ? `${baseUrl.replace(/\/$/, '')}/chat/completions`
      : 'https://api-d-anthropic-d-com-s-cld.v.tuangouai.com/v1/messages';
    const isAnthropic = !baseUrl;

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
    if (isAnthropic) headers['x-api-key'] = apiKey;

    const body = isAnthropic
      ? JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] })
      : JSON.stringify({ model, max_tokens: 2000, messages: [{ role: 'user', content: prompt }] });

    const resp = await fetch(endpoint, { method: 'POST', headers, body });
    const data = await resp.json();
    const raw  = isAnthropic
      ? (data?.content?.[0]?.text || '[]')
      : (data?.choices?.[0]?.message?.content || '[]');

    // 解析 JSON（去掉可能的 markdown 围栏）
    const cleaned = raw.replace(/```json|```/g, '').trim();
    let posts = [];
    try { posts = JSON.parse(cleaned); } catch(e) { posts = []; }

    // 补充角色头像（如果角色列表里有同名的）
    posts = posts.map(p => {
      const match = chars.find(c => c.name === p.authorName);
      if (match?.avatar) p.avatar = match.avatar;
      p.authorInitial = (p.authorName || '?')[0].toUpperCase();
      return p;
    });

    // 存入 DB
    await feedDbClear();
    await feedDbAddMany(posts);

    if (genEl) genEl.style.display = 'none';
    renderFeedPosts(posts);

  } catch(e) {
    if (genEl) genEl.style.display = 'none';
    document.getElementById('commFeedList').innerHTML =
      '<div style="padding:24px;text-align:center;font-size:12px;color:var(--slate-400);font-family:var(--font-body);">生成失败，请重试</div>';
  } finally {
    if (btn) btn.disabled = false;
  }
}

// 页面初始化：读取 DB 渲染，没有就显示空状态
async function initCommunityPage() {
  await renderCommFriends();
  const posts = await feedDbGetAll();
  renderFeedPosts(posts);
}

// 监听切换到 community 页时初始化
const _origSwitchPage = switchPage;
// 在 DOMContentLoaded 后挂载
document.addEventListener('DOMContentLoaded', () => {
  initCommunityPage();
});