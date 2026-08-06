/* ================================================================
   Luna Gallery — gallery.js
   职责：
   1) 状态栏（时间 / 电量 / 灵动岛）与 index.html 主页保持一致的读写逻辑
   2) 三个面板（我的相册 / Char 相册 / 动态）的切换与墨迹指示器动画
   3) 返回按钮 → 回到 index.html
================================================================ */

(function () {
  'use strict';

  /* ---------------------------------------------------------
     状态栏：时间 —— 一比一复刻 index.html / secret.js 的逻辑，
     读取 localStorage 里的 luna_tz，保证跨页时区显示一致
  --------------------------------------------------------- */
  function glUpdateTime() {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const timeStr = new Date().toLocaleTimeString('zh-CN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    });
    const el = document.getElementById('statusTime');
    if (el) el.textContent = timeStr;
  }

  /* ---------------------------------------------------------
     状态栏：电量 —— 读取 luna_battery，规则与主页完全一致
     （<=20% 时切换为警示红色渐变）
  --------------------------------------------------------- */
  function glUpdateBattery() {
    const pctEl = document.getElementById('batPct');
    const innerEl = document.getElementById('batInner');
    const pct = parseInt(localStorage.getItem('luna_battery') || '76', 10);
    if (pctEl) pctEl.textContent = pct;
    if (innerEl) {
      innerEl.style.width = pct + '%';
      innerEl.style.background = pct <= 20
        ? 'linear-gradient(90deg, #f87171, #ef4444)'
        : 'var(--ink-0, #0b0b0c)';
    }
  }

  /* ---------------------------------------------------------
     状态栏：灵动岛 —— 复刻 index.html 的 applyIsland 样式映射，
     保证从主页跳转进来后灵动岛的开关 / 样式视觉一致
  --------------------------------------------------------- */
  function glApplyIsland() {
    const enabled = localStorage.getItem('luna_island_enabled') === 'true';
    const style = localStorage.getItem('luna_island_style') || 'minimal';
    const el = document.getElementById('statusIsland');
    if (!el) return;
    if (!enabled) { el.innerHTML = ''; return; }
    const styleMap = {
      minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
      glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
      clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="glSiClockText">--:--</span></div></div>`,
      pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
      ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
      rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
      music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
      scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
    };
    el.innerHTML = styleMap[style] || styleMap.minimal;
    clearInterval(window._glSiClockTimer);
    if (style === 'clock') {
      const tick = () => {
        const t = document.getElementById('glSiClockText');
        if (!t) return;
        const now = new Date();
        t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
      };
      tick();
      window._glSiClockTimer = setInterval(tick, 10000);
    }
  }

  glUpdateTime();
  glUpdateBattery();
  glApplyIsland();
  setInterval(glUpdateTime, 10000);
  setInterval(glUpdateBattery, 10000);

  /* 跨标签页 / 跨页面同步：主页在设置里改了电量、时区、灵动岛时实时联动 */
  window.addEventListener('storage', (e) => {
    if (e.key === 'luna_battery') glUpdateBattery();
    if (e.key === 'luna_tz' || e.key === 'luna_tz_update') glUpdateTime();
    if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') glApplyIsland();
  });

  /* ---------------------------------------------------------
     返回主屏
  --------------------------------------------------------- */
  const backBtn = document.getElementById('glBack');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const mask = document.createElement('div');
      mask.style.cssText = 'position:fixed;inset:0;background:rgba(248,247,245,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
      document.body.appendChild(mask);
      requestAnimationFrame(() => { mask.style.opacity = '1'; });
      setTimeout(() => { window.location.href = 'index.html'; }, 260);
    });
  }

  /* ---------------------------------------------------------
     Dock 面板切换 + 滑行光轨（v3）
     光轨用 translateX 精确移动到激活刻度区正下方，
     激活项本身的图标/文字变化完全由 CSS .is-active 驱动。
  --------------------------------------------------------- */
  const PANEL_ORDER = ['mine', 'char', 'feed'];
  const PANEL_TITLES = { mine: '我的相册', char: 'Char 相册', feed: '动态' };
  const dock = document.getElementById('glDock');
  const seals = dock ? Array.from(dock.querySelectorAll('.gl-seal')) : [];
  const panels = Array.from(document.querySelectorAll('.gl-panel'));
  const titleEl = document.getElementById('glPageTitle');
  const track = document.getElementById('glTrack');

  let currentIndex = 0;

  function moveTrack(idx) {
    if (!track) return;
    track.style.transform = `translateX(${idx * 100}%)`;
  }

  function setActive(targetKey, opts) {
    opts = opts || {};
    const idx = PANEL_ORDER.indexOf(targetKey);
    if (idx === -1) return;

    seals.forEach((seal) => {
      seal.classList.toggle('is-active', seal.dataset.target === targetKey);
    });

    panels.forEach((panel) => {
      panel.classList.toggle('is-active', panel.dataset.panel === targetKey);
    });

    if (titleEl && PANEL_TITLES[targetKey]) {
      if (opts.silent) {
        titleEl.textContent = PANEL_TITLES[targetKey];
      } else {
        titleEl.style.opacity = '0';
        setTimeout(() => {
          titleEl.textContent = PANEL_TITLES[targetKey];
          titleEl.style.opacity = '1';
        }, 160);
      }
    }

    moveTrack(idx);
    currentIndex = idx;
  }

  seals.forEach((seal) => {
    seal.addEventListener('click', () => {
      const target = seal.dataset.target;
      if (seal.classList.contains('is-active')) return;
      setActive(target);
      if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
    });
  });

  // 初始状态：直接定位到第一个印玺，不做过渡动画
  setActive('mine', { silent: true });

  /* 简单的左右滑动切换手势（可选增强，不影响点击）
     排除 Char 面板内部的封面滑动区域，避免与其自身的
     角色切换手势冲突（一次滑动被两层逻辑同时响应） */
  let touchStartX = null;
  const mainEl = document.querySelector('.gl-main');
  if (mainEl) {
    mainEl.addEventListener('touchstart', (e) => {
      if (e.target.closest('#charCoverStage') || e.target.closest('.cd-pager')) {
        touchStartX = null;
        return;
      }
      touchStartX = e.touches[0].clientX;
    }, { passive: true });
    mainEl.addEventListener('touchend', (e) => {
      if (touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(dx) < 60) return;
      let nextIdx = currentIndex + (dx < 0 ? 1 : -1);
      nextIdx = Math.max(0, Math.min(PANEL_ORDER.length - 1, nextIdx));
      if (nextIdx !== currentIndex) setActive(PANEL_ORDER[nextIdx]);
    }, { passive: true });
  }

})();


/* ================================================================
   我的相册 — MY ARCHIVE 功能模块
   职责：
   1) 照片批量上传（本地内存态，读取为 dataURL，不做持久化存储）
   2) 时光卷视图：按日期分组网格 + 批量选择 + 删除 + 加入相册集
   3) 相册集视图：新建 / 列表 / 详情 / 添加照片 / 移除照片
   4) 单张照片全屏查看器：左右切换、底部胶片小样条、加入相册集、删除
================================================================ */
(function () {
  'use strict';

  const root = document.getElementById('mineRoot');
  if (!root) return; // 该面板不存在则跳过（安全防御）

  /* ---------------------------------------------------------
     数据态（内存 + 持久化到 IndexedDB，跨刷新/跨会话保留）：
     photos: [{ id, src, name, addedAt }]
     albums: [{ id, name, photoIds: [], createdAt }]

     选用 IndexedDB 而非 localStorage 的原因：
     - localStorage 通常只有 5-10MB 上限，照片存成 base64 很容易超限
     - IndexedDB 通常有几百MB到几个GB 的可用空间（取决于设备磁盘），
       且原生支持存储较大的字符串/二进制数据，适合存图片
     - 纯浏览器端能力，不需要任何后端服务器
  --------------------------------------------------------- */
  let photos = [];
  let albums = [];
  let uidSeed = 1;
  const uid = (p) => p + '_' + (uidSeed++) + '_' + Math.random().toString(36).slice(2, 7);

  const DB_NAME = 'luna-gallery-db';
  const DB_VERSION = 1;
  const STORE_PHOTOS = 'photos';
  const STORE_ALBUMS = 'albums';
  const STORE_META = 'meta';

  let dbInstance = null;
  let dataLoaded = false;
  let savePhotosTimer = null;
  let saveAlbumsTimer = null;

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('当前浏览器不支持 IndexedDB')); return; }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_ALBUMS)) db.createObjectStore(STORE_ALBUMS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_META)) db.createObjectStore(STORE_META, { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGetAll(storeName) {
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function idbClearAndPutAll(storeName, records) {
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      store.clear();
      records.forEach((r) => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function idbPutMeta(key, value) {
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(STORE_META, 'readwrite');
      tx.objectStore(STORE_META).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function idbGetMeta(key) {
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction(STORE_META, 'readonly');
      const req = tx.objectStore(STORE_META).get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  }

  // 照片和相册集分开防抖保存：照片改动频繁但体积大，相册集改动少但也可能同时变化
  function savePhotos() {
    if (!dataLoaded || !dbInstance) return;
    clearTimeout(savePhotosTimer);
    savePhotosTimer = setTimeout(() => {
      idbClearAndPutAll(STORE_PHOTOS, photos).catch((err) => {
        console.error('照片保存失败（可能是磁盘空间不足）：', err);
      });
      idbPutMeta('uidSeed', uidSeed).catch(() => {});
    }, 200);
  }
  function saveAlbums() {
    if (!dataLoaded || !dbInstance) return;
    clearTimeout(saveAlbumsTimer);
    saveAlbumsTimer = setTimeout(() => {
      idbClearAndPutAll(STORE_ALBUMS, albums).catch((err) => {
        console.error('相册集保存失败：', err);
      });
    }, 200);
  }
  // 兼容旧调用：一次性保存两者（渲染函数改动较大时会两者都触发）
  function saveData() { savePhotos(); saveAlbums(); }

  async function loadData() {
    try {
      dbInstance = await openDB();
      const [savedPhotos, savedAlbums, savedSeed] = await Promise.all([
        idbGetAll(STORE_PHOTOS),
        idbGetAll(STORE_ALBUMS),
        idbGetMeta('uidSeed')
      ]);
      photos = Array.isArray(savedPhotos) ? savedPhotos : [];
      albums = Array.isArray(savedAlbums) ? savedAlbums : [];
      if (typeof savedSeed === 'number') uidSeed = savedSeed;
    } catch (err) {
      console.error('相册数据读取失败，将以空相册启动：', err);
      photos = [];
      albums = [];
    } finally {
      dataLoaded = true;
    }
  }

  let currentView = 'stream';           // 'stream' | 'albums'
  let isSelecting = false;
  let selectedIds = new Set();
  let selectContext = 'stream';         // 'stream' | 'album-detail'
  let openAlbumId = null;               // 当前打开的相册集详情
  let viewerList = [];                  // 当前查看器内可滑动的照片数组
  let viewerIndex = 0;
  let sheetMode = null;                 // 'create' | 'pick'
  let pickTargetPhotoIds = [];          // 打开"选择相册集"面板时，要加入的照片 id 列表

  /* ---------------------------------------------------------
     DOM 引用
  --------------------------------------------------------- */
  const mineViews = document.getElementById('mineViews');
  const mvUnderline = document.getElementById('mvUnderline');
  const mvCountStream = document.getElementById('mvCountStream');
  const mvCountAlbums = document.getElementById('mvCountAlbums');

  const viewStream = document.getElementById('view-stream');
  const viewAlbums = document.getElementById('view-albums');
  const streamGroups = document.getElementById('streamGroups');
  const streamEmpty = document.getElementById('streamEmpty');
  const streamEmptyCta = document.getElementById('streamEmptyCta');

  const albumsGrid = document.getElementById('albumsGrid');
  const albumsEmpty = document.getElementById('albumsEmpty');
  const albumNewCard = document.getElementById('albumNewCard');

  const mineUploadBtn = document.getElementById('mineUploadBtn');
  const mineFileInput = document.getElementById('mineFileInput');
  const mineSelectBtn = document.getElementById('mineSelectBtn');

  const selectBar = document.getElementById('selectBar');
  const sbCount = document.getElementById('sbCount');
  const sbAddToAlbum = document.getElementById('sbAddToAlbum');
  const sbDelete = document.getElementById('sbDelete');
  const sbDone = document.getElementById('sbDone');

  const albumDetail = document.getElementById('albumDetail');
  const adBack = document.getElementById('adBack');
  const adTitle = document.getElementById('adTitle');
  const adCount = document.getElementById('adCount');
  const adGrid = document.getElementById('adGrid');
  const adEmpty = document.getElementById('adEmpty');
  const adAddBtn = document.getElementById('adAddBtn');
  const adMenu = document.getElementById('adMenu');

  const photoViewer = document.getElementById('photoViewer');
  const pvImg = document.getElementById('pvImg');
  const pvDate = document.getElementById('pvDate');
  const pvIndex = document.getElementById('pvIndex');
  const pvClose = document.getElementById('pvClose');
  const pvPrev = document.getElementById('pvPrev');
  const pvNext = document.getElementById('pvNext');
  const pvFilmstrip = document.getElementById('pvFilmstrip');
  const pvAddToAlbum = document.getElementById('pvAddToAlbum');
  const pvDelete = document.getElementById('pvDelete');
  const pvMore = document.getElementById('pvMore');

  const mineSheet = document.getElementById('mineSheet');
  const msScrim = document.getElementById('msScrim');
  const msEyebrow = document.getElementById('msEyebrow');
  const msTitle = document.getElementById('msTitle');
  const msBodyCreate = document.getElementById('msBodyCreate');
  const msBodyPick = document.getElementById('msBodyPick');
  const msNameInput = document.getElementById('msNameInput');
  const msCreateConfirm = document.getElementById('msCreateConfirm');
  const msCreateCancel = document.getElementById('msCreateCancel');
  const msPickList = document.getElementById('msPickList');
  const msPickNewAlbum = document.getElementById('msPickNewAlbum');
  const msPickCancel = document.getElementById('msPickCancel');

  /* ---------------------------------------------------------
     工具函数
  --------------------------------------------------------- */
  function formatGroupDate(d) {
    const now = new Date();
    const isSameDay = d.toDateString() === now.toDateString();
    const y = new Date(now); y.setDate(now.getDate() - 1);
    const isYesterday = d.toDateString() === y.toDateString();
    if (isSameDay) return '今天';
    if (isYesterday) return '昨天';
    const sameYear = d.getFullYear() === now.getFullYear();
    return sameYear
      ? `${d.getMonth() + 1}月${d.getDate()}日`
      : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  }

  function groupPhotosByDate(list) {
    const map = new Map();
    // 最新的在前
    const sorted = [...list].sort((a, b) => b.addedAt - a.addedAt);
    sorted.forEach((p) => {
      const key = new Date(p.addedAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return Array.from(map.entries()).map(([key, items]) => ({
      key, date: new Date(key), items
    }));
  }

  function getPhotoById(id) { return photos.find((p) => p.id === id); }
  function getAlbumById(id) { return albums.find((a) => a.id === id); }

  /* ---------------------------------------------------------
     视图切换：时光卷 / 相册集
  --------------------------------------------------------- */
  function setView(view) {
    currentView = view;
    const items = mineViews.querySelectorAll('.mv-item');
    items.forEach((it) => it.classList.toggle('is-active', it.dataset.view === view));
    viewStream.classList.toggle('is-active', view === 'stream');
    viewAlbums.classList.toggle('is-active', view === 'albums');

    const idx = view === 'stream' ? 0 : 1;
    const target = items[idx];
    if (target && mvUnderline) {
      const w = target.querySelector('.mv-text').offsetWidth;
      mvUnderline.style.width = w + 'px';
      mvUnderline.style.transform = `translateX(${target.offsetLeft}px)`;
    }

    // 切视图时如仍在选择模式，退出选择，避免语义混乱
    if (isSelecting) exitSelectMode();
  }

  if (mineViews) {
    mineViews.querySelectorAll('.mv-item').forEach((btn) => {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    });
  }

  /* ---------------------------------------------------------
     上传照片：批量选择 → 读取为 dataURL → 加入 photos → 重渲染
  --------------------------------------------------------- */
  function handleFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith('image/'));
    if (!files.length) return;

    let pending = files.length;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        photos.push({
          id: uid('photo'),
          src: e.target.result,
          name: file.name || '未命名照片',
          addedAt: Date.now()
        });
        pending -= 1;
        if (pending === 0) {
          renderStream();
          renderAlbumsGrid();
          if (navigator.vibrate) { try { navigator.vibrate(8); } catch (err) {} }
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (mineUploadBtn && mineFileInput) {
    mineUploadBtn.addEventListener('click', () => mineFileInput.click());
  }
  if (streamEmptyCta && mineFileInput) {
    streamEmptyCta.addEventListener('click', () => mineFileInput.click());
  }
  if (mineFileInput) {
    mineFileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
      mineFileInput.value = '';
    });
  }

  /* ---------------------------------------------------------
     选择模式：开启 / 退出 / 计数更新
  --------------------------------------------------------- */
  function enterSelectMode(context) {
    isSelecting = true;
    selectContext = context || 'stream';
    selectedIds.clear();
    root.classList.add('is-selecting');
    if (mineSelectBtn) {
      mineSelectBtn.classList.add('is-active');
      mineSelectBtn.textContent = '取消';
    }
    selectBar.classList.add('is-active');
    selectBar.setAttribute('aria-hidden', 'false');
    updateSelectCount();
  }

  function exitSelectMode() {
    isSelecting = false;
    selectedIds.clear();
    root.classList.remove('is-selecting');
    if (mineSelectBtn) {
      mineSelectBtn.classList.remove('is-active');
      mineSelectBtn.textContent = '选择';
    }
    selectBar.classList.remove('is-active');
    selectBar.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.photo-cell.is-picked').forEach((c) => c.classList.remove('is-picked'));
  }

  function updateSelectCount() {
    sbCount.textContent = `已选 ${selectedIds.size} 张`;
  }

  function togglePick(id, cellEl) {
    if (selectedIds.has(id)) {
      selectedIds.delete(id);
      cellEl.classList.remove('is-picked');
    } else {
      selectedIds.add(id);
      cellEl.classList.add('is-picked');
    }
    updateSelectCount();
  }

  if (mineSelectBtn) {
    mineSelectBtn.addEventListener('click', () => {
      if (isSelecting) exitSelectMode();
      else enterSelectMode('stream');
    });
  }
  if (sbDone) sbDone.addEventListener('click', exitSelectMode);

  sbDelete.addEventListener('click', () => {
    if (!selectedIds.size) return;
    if (selectContext === 'album-detail' && openAlbumId) {
      // 在相册集详情内删除 = 从相册集移除
      const album = getAlbumById(openAlbumId);
      if (album) album.photoIds = album.photoIds.filter((id) => !selectedIds.has(id));
      renderAlbumDetail();
      renderAlbumsGrid();
    } else {
      photos = photos.filter((p) => !selectedIds.has(p.id));
      albums.forEach((a) => { a.photoIds = a.photoIds.filter((id) => !selectedIds.has(id)); });
      renderStream();
      renderAlbumsGrid();
    }
    exitSelectMode();
  });

  sbAddToAlbum.addEventListener('click', () => {
    if (!selectedIds.size) return;
    openPickSheet(Array.from(selectedIds));
  });

  /* ---------------------------------------------------------
     渲染：时光卷网格
  --------------------------------------------------------- */
  function renderPhotoCell(photo) {
    const cell = document.createElement('div');
    cell.className = 'photo-cell';
    cell.dataset.id = photo.id;
    cell.innerHTML = `
      <img src="${photo.src}" alt="${photo.name}" loading="lazy" />
      <span class="cell-check"></span>
    `;
    cell.addEventListener('click', () => {
      if (isSelecting) {
        togglePick(photo.id, cell);
      } else {
        openViewer(photos.slice().sort((a, b) => b.addedAt - a.addedAt), photo.id);
      }
    });
    return cell;
  }

  function renderStream() {
    saveData();
    mvCountStream.textContent = String(photos.length);
    streamEmpty.hidden = photos.length > 0;
    streamGroups.innerHTML = '';
    if (!photos.length) return;

    const groups = groupPhotosByDate(photos);
    groups.forEach((g) => {
      const wrap = document.createElement('div');
      wrap.className = 'stream-group';

      const head = document.createElement('div');
      head.className = 'stream-group-head';
      head.innerHTML = `
        <span class="sg-date">${formatGroupDate(g.date)}</span>
        <span class="sg-rule"></span>
        <span class="sg-count">${g.items.length} 张</span>
      `;
      wrap.appendChild(head);

      const grid = document.createElement('div');
      grid.className = 'stream-grid';
      g.items.forEach((p) => grid.appendChild(renderPhotoCell(p)));
      wrap.appendChild(grid);

      streamGroups.appendChild(wrap);
    });
  }

  /* ---------------------------------------------------------
     渲染：相册集网格
  --------------------------------------------------------- */
  function albumCoverSrc(album) {
    if (!album.photoIds.length) return null;
    const p = getPhotoById(album.photoIds[album.photoIds.length - 1]);
    return p ? p.src : null;
  }

  function renderAlbumsGrid() {
    saveData();
    mvCountAlbums.textContent = String(albums.length);
    albumsEmpty.hidden = albums.length > 0;
    albumsGrid.innerHTML = '';

    albums.forEach((album) => {
      const cover = albumCoverSrc(album);
      const card = document.createElement('div');
      card.className = 'album-card';
      card.dataset.id = album.id;
      card.innerHTML = `
        <div class="ac-stack">
          <div class="ac-cover">
            ${cover
              ? `<img src="${cover}" alt="${album.name}" loading="lazy" />`
              : `<div class="ac-cover-empty"><svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" stroke-width="1.3"/><circle cx="9" cy="10.5" r="1.6" stroke="currentColor" stroke-width="1.1"/><path d="M6 16l4.5-4.5L14 15l2-2 2.5 2.5" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`
            }
          </div>
        </div>
        <div class="ac-meta">
          <div class="ac-name">${album.name}</div>
          <div class="ac-count">${album.photoIds.length} 张</div>
        </div>
      `;
      card.addEventListener('click', () => openAlbumDetail(album.id));
      albumsGrid.appendChild(card);
    });
  }

  if (albumNewCard) {
    albumNewCard.addEventListener('click', () => openCreateSheet());
  }

  /* ---------------------------------------------------------
     相册集详情
  --------------------------------------------------------- */
  function openAlbumDetail(albumId) {
    openAlbumId = albumId;
    renderAlbumDetail();
    albumDetail.classList.add('is-open');
    albumDetail.setAttribute('aria-hidden', 'false');
  }
  function closeAlbumDetail() {
    if (isSelecting && selectContext === 'album-detail') exitSelectMode();
    albumDetail.classList.remove('is-open');
    albumDetail.setAttribute('aria-hidden', 'true');
    openAlbumId = null;
  }

  function renderAlbumDetail() {
    const album = getAlbumById(openAlbumId);
    if (!album) return;
    adTitle.textContent = album.name;
    const list = album.photoIds.map(getPhotoById).filter(Boolean);
    adCount.textContent = `${list.length} 张影像`;
    adEmpty.hidden = list.length > 0;
    adGrid.innerHTML = '';
    list.slice().sort((a, b) => b.addedAt - a.addedAt).forEach((p) => {
      const cell = document.createElement('div');
      cell.className = 'photo-cell';
      cell.dataset.id = p.id;
      cell.innerHTML = `<img src="${p.src}" alt="${p.name}" loading="lazy" /><span class="cell-check"></span>`;
      cell.addEventListener('click', () => {
        if (isSelecting) {
          togglePick(p.id, cell);
        } else {
          openViewer(list.slice().sort((a, b) => b.addedAt - a.addedAt), p.id);
        }
      });
      adGrid.appendChild(cell);
    });
  }

  if (adBack) adBack.addEventListener('click', closeAlbumDetail);
  if (adMenu) {
    adMenu.addEventListener('click', () => {
      if (!openAlbumId) return;
      enterSelectMode('album-detail');
    });
  }
  if (adAddBtn) {
    adAddBtn.addEventListener('click', () => {
      // 添加照片：直接打开系统选择器，选中的照片会加入 photos，并自动追加进当前相册集
      const tempHandler = (e) => {
        const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
        let pending = files.length;
        if (!pending) return;
        files.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const p = { id: uid('photo'), src: ev.target.result, name: file.name || '未命名照片', addedAt: Date.now() };
            photos.push(p);
            const album = getAlbumById(openAlbumId);
            if (album) album.photoIds.push(p.id);
            pending -= 1;
            if (pending === 0) {
              renderStream();
              renderAlbumsGrid();
              renderAlbumDetail();
            }
          };
          reader.readAsDataURL(file);
        });
        mineFileInput.removeEventListener('change', tempHandler);
      };
      mineFileInput.addEventListener('change', tempHandler);
      mineFileInput.click();
    });
  }

  /* ---------------------------------------------------------
     全屏照片查看器
  --------------------------------------------------------- */
  function openViewer(list, focusId) {
    viewerList = list;
    viewerIndex = Math.max(0, list.findIndex((p) => p.id === focusId));
    renderViewer();
    photoViewer.classList.add('is-open');
    photoViewer.setAttribute('aria-hidden', 'false');
  }
  function closeViewer() {
    photoViewer.classList.remove('is-open');
    photoViewer.setAttribute('aria-hidden', 'true');
  }

  function renderViewer() {
    if (!viewerList.length) { closeViewer(); return; }
    const photo = viewerList[viewerIndex];
    if (!photo) { closeViewer(); return; }
    pvImg.src = photo.src;
    pvImg.alt = photo.name;
    const d = new Date(photo.addedAt);
    pvDate.textContent = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    pvIndex.textContent = `${viewerIndex + 1} / ${viewerList.length}`;
    pvPrev.disabled = viewerIndex === 0;
    pvNext.disabled = viewerIndex === viewerList.length - 1;

    pvFilmstrip.innerHTML = '';
    viewerList.forEach((p, i) => {
      const th = document.createElement('div');
      th.className = 'pv-thumb' + (i === viewerIndex ? ' is-active' : '');
      th.innerHTML = `<img src="${p.src}" alt="" loading="lazy" />`;
      th.addEventListener('click', () => { viewerIndex = i; renderViewer(); });
      pvFilmstrip.appendChild(th);
    });
    const activeThumb = pvFilmstrip.querySelector('.is-active');
    if (activeThumb) activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  function viewerStep(dir) {
    const next = viewerIndex + dir;
    if (next < 0 || next >= viewerList.length) return;
    viewerIndex = next;
    renderViewer();
  }

  if (pvClose) pvClose.addEventListener('click', closeViewer);
  if (pvPrev) pvPrev.addEventListener('click', () => viewerStep(-1));
  if (pvNext) pvNext.addEventListener('click', () => viewerStep(1));

  if (pvDelete) {
    pvDelete.addEventListener('click', () => {
      const photo = viewerList[viewerIndex];
      if (!photo) return;
      photos = photos.filter((p) => p.id !== photo.id);
      albums.forEach((a) => { a.photoIds = a.photoIds.filter((id) => id !== photo.id); });
      viewerList = viewerList.filter((p) => p.id !== photo.id);
      renderStream();
      renderAlbumsGrid();
      if (openAlbumId) renderAlbumDetail();
      if (!viewerList.length) { closeViewer(); return; }
      viewerIndex = Math.min(viewerIndex, viewerList.length - 1);
      renderViewer();
    });
  }
  if (pvAddToAlbum) {
    pvAddToAlbum.addEventListener('click', () => {
      const photo = viewerList[viewerIndex];
      if (!photo) return;
      openPickSheet([photo.id]);
    });
  }
  if (pvMore) {
    pvMore.addEventListener('click', () => {
      const photo = viewerList[viewerIndex];
      if (!photo) return;
      openPickSheet([photo.id]);
    });
  }

  // 查看器内左右滑动手势
  (function bindViewerSwipe() {
    const stage = document.getElementById('pvStage');
    if (!stage) return;
    let startX = null, startY = null;
    stage.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    }, { passive: true });
    stage.addEventListener('touchend', (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null; startY = null;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy > 90) closeViewer(); // 下滑关闭
        return;
      }
      if (Math.abs(dx) < 55) return;
      viewerStep(dx < 0 ? 1 : -1);
    }, { passive: true });
  })();

  /* ---------------------------------------------------------
     底部弹层：新建相册集 / 选择相册集加入
  --------------------------------------------------------- */
  function openCreateSheet() {
    sheetMode = 'create';
    msEyebrow.textContent = 'NEW COLLECTION';
    msTitle.textContent = '新建相册集';
    msBodyCreate.hidden = false;
    msBodyPick.hidden = true;
    msNameInput.value = '';
    mineSheet.classList.add('is-open');
    mineSheet.setAttribute('aria-hidden', 'false');
    setTimeout(() => msNameInput.focus(), 260);
  }

  function openPickSheet(photoIds) {
    pickTargetPhotoIds = photoIds;
    sheetMode = 'pick';
    msEyebrow.textContent = 'ADD TO COLLECTION';
    msTitle.textContent = '加入相册集';
    msBodyCreate.hidden = true;
    msBodyPick.hidden = false;
    renderPickList();
    mineSheet.classList.add('is-open');
    mineSheet.setAttribute('aria-hidden', 'false');
  }

  function closeSheet() {
    mineSheet.classList.remove('is-open');
    mineSheet.setAttribute('aria-hidden', 'true');
    sheetMode = null;
  }

  function renderPickList() {
    msPickList.innerHTML = '';
    if (!albums.length) {
      const hint = document.createElement('p');
      hint.className = 'me-desc';
      hint.style.textAlign = 'center';
      hint.style.margin = '6px 0 16px';
      hint.textContent = '暂无相册集，先新建一个吧';
      msPickList.appendChild(hint);
      return;
    }
    albums.forEach((album) => {
      const allIn = pickTargetPhotoIds.every((id) => album.photoIds.includes(id));
      const cover = albumCoverSrc(album);
      const row = document.createElement('div');
      row.className = 'ms-pick-row' + (allIn ? ' is-in' : '');
      row.innerHTML = `
        <div class="ms-pick-cover">
          ${cover ? `<img src="${cover}" alt="" />` : `<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" stroke-width="1.2"/></svg>`}
        </div>
        <div class="ms-pick-info">
          <div class="ms-pick-name">${album.name}</div>
          <div class="ms-pick-count">${album.photoIds.length} 张</div>
        </div>
        <span class="ms-pick-check"></span>
      `;
      row.addEventListener('click', () => {
        const nowIn = row.classList.toggle('is-in');
        pickTargetPhotoIds.forEach((id) => {
          if (nowIn) {
            if (!album.photoIds.includes(id)) album.photoIds.push(id);
          } else {
            album.photoIds = album.photoIds.filter((pid) => pid !== id);
          }
        });
        row.querySelector('.ms-pick-count').textContent = `${album.photoIds.length} 张`;
        renderAlbumsGrid();
        if (openAlbumId === album.id) renderAlbumDetail();
      });
      msPickList.appendChild(row);
    });
  }

  function createAlbum(name, initialPhotoIds) {
    const album = {
      id: uid('album'),
      name: name && name.trim() ? name.trim() : `新相册集 ${albums.length + 1}`,
      photoIds: initialPhotoIds ? [...initialPhotoIds] : [],
      createdAt: Date.now()
    };
    albums.push(album);
    renderAlbumsGrid();
    return album;
  }

  if (msCreateConfirm) {
    msCreateConfirm.addEventListener('click', () => {
      createAlbum(msNameInput.value, []);
      closeSheet();
      setView('albums');
    });
  }
  if (msCreateCancel) msCreateCancel.addEventListener('click', closeSheet);
  if (msPickCancel) msPickCancel.addEventListener('click', closeSheet);
  if (msPickNewAlbum) {
    msPickNewAlbum.addEventListener('click', () => {
      const album = createAlbum(`新相册集 ${albums.length + 1}`, pickTargetPhotoIds);
      renderAlbumsGrid();
      if (openAlbumId) renderAlbumDetail();
      closeSheet();
    });
  }
  if (msScrim) msScrim.addEventListener('click', closeSheet);

  /* ---------------------------------------------------------
     初始化：先从 window.storage 读取历史数据，再渲染，
     避免刷新页面后闪现空状态、或用空数组覆盖已保存的数据
  --------------------------------------------------------- */
  (async function init() {
    setView('stream');
    await loadData();
    renderStream();
    renderAlbumsGrid();
  })();

  // 视图切换下划线在首次布局后需要重新计算一次位置（等待字体加载）
  window.addEventListener('load', () => setView(currentView));

})();


/* ================================================================================================
   Char 相册 — CHARACTER ARCHIVE
   职责：
   1) 直接读取 characters.js 写入的同一份 IndexedDB（LunaCharDB / chars store），
      与「角色档案」页面完全同步，此页不产生任何独立数据副本
   2) 先展示「每个角色一本相册」的封面网格（封面图 + 角色名字）
   3) 点击某个角色封面 → 打开该角色的专属相册详情覆盖层（照片网格）
      —— 图片来源暂未设计，此处先展示空态，留好网格结构以便后续接入
================================================================================================ */
(function () {
  'use strict';

  const root = document.getElementById('charRoot');
  if (!root) return;

  const emptyEl     = document.getElementById('charEmpty');
  const countEl     = document.getElementById('charCount');

  const coverStage  = document.getElementById('charCoverStage');
  const ccsTrack    = document.getElementById('ccsTrack');
  const ccsTicks    = document.getElementById('ccsTicks');
  const ccsPrev     = document.getElementById('ccsPrev');
  const ccsNext     = document.getElementById('ccsNext');
  const styleSwitch = document.getElementById('charStyleSwitch');

  const charDetail    = document.getElementById('charDetail');
  const cdScrim       = charDetail ? charDetail.querySelector('.cd-scrim') : null;
  const cdBack        = document.getElementById('cdBack');
  const cdProfileLink = document.getElementById('cdProfileLink');
  const cdTitle          = document.getElementById('cdTitle');
  const cdCount          = document.getElementById('cdCount');
  const cdPageIndicator  = document.getElementById('cdPageIndicator');
  const cdEmpty          = document.getElementById('cdEmpty');
  const cdPager          = document.getElementById('cdPager');
  const cdPagerTrack     = document.getElementById('cdPagerTrack');
  const cdPagerTicks     = document.getElementById('cdPagerTicks');
  const cdPrev           = document.getElementById('cdPrev');
  const cdNext           = document.getElementById('cdNext');

  let chars = [];
  let openCharId = null;

  // 顶层封面滑动视图的当前索引（一次只显示一位角色的整版封面）
  let coverIndex = 0;

  // 打开某位角色相册后，其内部单页画册的状态
  let pagePhotos = [];      // [{ src, corner }]
  let pageIndex = 0;

  /* -----------------------------------------------------------
     确定性随机数生成器（基于字符串种子），用于给同一角色的
     照片顺序 / 取景角标做「看似随机但每次刷新保持一致」的分配，
     避免每次打开相册排布都跳变、体验不稳定
  ----------------------------------------------------------- */
  function seededRandom(seedStr) {
    let h = 1779033703 ^ seedStr.length;
    for (let i = 0; i < seedStr.length; i++) {
      h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }
  function shuffleWithRng(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* -----------------------------------------------------------
     从角色数据中收集可用于相册的影像来源：
     角色档案里能拿到的图像字段（头像 / 卡片背景图 / 角色自带的
     gallery 数组，如果 characters.js 未来提供的话）都会被汇总，
     再用该角色 id 作种子做确定性乱序，一次只展示一张，翻页切换
  ----------------------------------------------------------- */
  function collectCharPhotos(c) {
    const pool = [];
    const pushIf = (src) => { if (src && !pool.includes(src)) pool.push(src); };

    // 角色档案可能提供的独立相册数组（预留字段名，兼容多种可能命名）
    const galleryFields = [c.gallery, c.photos, c.images, c.album];
    galleryFields.forEach((field) => {
      if (Array.isArray(field)) {
        field.forEach((item) => {
          if (typeof item === 'string') pushIf(item);
          else if (item && typeof item === 'object') pushIf(item.src || item.url || item.image);
        });
      }
    });

    // 兜底：至少把头像与卡片背景图纳入这本相册
    pushIf(c.cardBg);
    pushIf(c.avatar);

    if (pool.length === 0) return [];

    const rng = seededRandom('char-gallery-' + String(c.id));
    const shuffled = shuffleWithRng(pool, rng);
    const corners = ['pos-tl', 'pos-tr', 'pos-bl', 'pos-br'];
    return shuffled.map((src) => ({
      src,
      corner: corners[Math.floor(rng() * corners.length)],
    }));
  }

  /* -----------------------------------------------------------
     读取 LunaCharDB —— 与 characters.js 的 openCharDB 逻辑对齐：
     先探测当前版本再打开，不主动升级，避免与角色档案页抢版本号
  ----------------------------------------------------------- */
  function openCharDBReadOnly() {
    return new Promise((resolve) => {
      const probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = (e) => {
        const cur = e.target.result;
        const ver = cur.version;
        const hasChars = cur.objectStoreNames.contains('chars');
        cur.close();
        if (!hasChars) { resolve(null); return; }
        const req = indexedDB.open('LunaCharDB', ver);
        req.onsuccess = (e2) => resolve(e2.target.result);
        req.onerror   = () => resolve(null);
      };
      probe.onerror = () => resolve(null);
      probe.onupgradeneeded = (e) => {
        // 全新数据库（角色档案从未打开过）：无需创建 store，直接判空
        e.target.transaction.abort();
        resolve(null);
      };
    });
  }

  async function getAllCharsFromDB() {
    const db = await openCharDBReadOnly().catch(() => null);
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx = db.transaction('chars', 'readonly');
        const req = tx.objectStore('chars').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      } catch (e) { resolve([]); }
    });
  }

  function escHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function getCharById(id) {
    return chars.find((c) => String(c.id) === String(id)) || null;
  }

  /* -----------------------------------------------------------
     封面滑动视图渲染 —— 一次只呈现一位角色的整版封面，
     所有角色的封面 slide 预先渲染好并叠放，靠 is-active/is-prev 切换
  ----------------------------------------------------------- */
  function renderCoverStage() {
    countEl.textContent = String(chars.length).padStart(2, '0');
    emptyEl.hidden = chars.length > 0;
    coverStage.hidden = chars.length === 0;
    ccsTrack.innerHTML = '';
    ccsTicks.innerHTML = '';

    if (chars.length === 0) return;

    if (coverIndex >= chars.length) coverIndex = chars.length - 1;
    if (coverIndex < 0) coverIndex = 0;

    chars.forEach((c, i) => {
      const cover = c.cardBg || c.avatar || '';
      const letter = (c.name || '?').trim()[0] ? (c.name || '?').trim()[0].toUpperCase() : '?';
      const photoCount = collectCharPhotos(c).length;
      const indexTag = String(i + 1).padStart(2, '0');
      const totalTag = String(chars.length).padStart(2, '0');

      const slide = document.createElement('div');
      slide.className = 'ccs-slide';
      slide.dataset.i = i;
      // 拍立得风格的固定歪斜角度：用角色 id 做种子，保证每次渲染都一致
      const tiltRng = seededRandom('char-tilt-' + String(c.id));
      const tiltDeg = (tiltRng() * 6 - 3).toFixed(2);
      slide.style.setProperty('--tilt', tiltDeg + 'deg');
      slide.innerHTML = `
        <div class="ccs-card" data-id="${escHtml(String(c.id))}">
          ${cover
            ? `<div class="ccs-portrait" style="background-image:url('${cover}')"></div>`
            : `<div class="ccs-portrait-fallback">
                 <div class="ccs-fallback-frame"><span class="ccs-fallback-letter">${escHtml(letter)}</span></div>
                 <div class="ccs-fallback-tag">NO IMAGE</div>
               </div>`
          }
          <div class="ccs-grid-lines"></div>
          <div class="ccs-corner tl"></div>
          <div class="ccs-corner tr"></div>
          <div class="ccs-bottom-fade"></div>
          <div class="ccs-topline">
            <span class="ccs-tag">PERSONA</span>
            <span class="ccs-index">${indexTag} / ${totalTag}</span>
          </div>
          <div class="ccs-info">
            <div class="ccs-name">${escHtml(c.name || '未命名')}</div>
            <div class="ccs-meta-row"><span class="ccs-count">${photoCount} 张影像 · 点击查看相册</span></div>
          </div>
        </div>
      `;
      slide.querySelector('.ccs-card').addEventListener('click', () => openCharAlbum(c.id));
      ccsTrack.appendChild(slide);

      const tick = document.createElement('span');
      tick.className = 'cct-tick';
      tick.dataset.i = i;
      tick.addEventListener('click', () => goToCover(i));
      ccsTicks.appendChild(tick);
    });

    updateCoverStagePositions();
  }

  function updateCoverStagePositions() {
    const slides = Array.from(ccsTrack.children);
    slides.forEach((el, i) => {
      el.classList.toggle('is-active', i === coverIndex);
      el.classList.toggle('is-prev', i < coverIndex);
      el.classList.toggle('is-next-peek', i === coverIndex + 1);
    });
    const ticks = Array.from(ccsTicks.children);
    ticks.forEach((el, i) => {
      el.classList.toggle('is-active', i === coverIndex);
    });
    if (ccsPrev) ccsPrev.disabled = coverIndex <= 0;
    if (ccsNext) ccsNext.disabled = coverIndex >= chars.length - 1;
  }

  function goToCover(idx) {
    if (idx < 0 || idx >= chars.length) return;
    coverIndex = idx;
    updateCoverStagePositions();
    if (navigator.vibrate) { try { navigator.vibrate(4); } catch (e) {} }
  }

  if (ccsPrev) ccsPrev.addEventListener('click', () => goToCover(coverIndex - 1));
  if (ccsNext) ccsNext.addEventListener('click', () => goToCover(coverIndex + 1));

  /* -----------------------------------------------------------
     封面风格切换（叠影 / 拍立得 / 灯箱）—— 三种视觉方案共用同一套
     DOM 与交互，仅切换 data-style 驱动 CSS 外观；选择记忆在
     localStorage，跨刷新保留用户偏好
  ----------------------------------------------------------- */
  (function bindStyleSwitch() {
    if (!styleSwitch || !coverStage) return;
    const items = Array.from(styleSwitch.querySelectorAll('.css-item'));
    const saved = localStorage.getItem('luna_char_cover_style');
    if (saved && items.some((el) => el.dataset.style === saved)) {
      coverStage.dataset.style = saved;
      items.forEach((el) => el.classList.toggle('is-active', el.dataset.style === saved));
    }
    items.forEach((el) => {
      el.addEventListener('click', () => {
        const s = el.dataset.style;
        coverStage.dataset.style = s;
        items.forEach((it) => it.classList.toggle('is-active', it === el));
        localStorage.setItem('luna_char_cover_style', s);
        if (navigator.vibrate) { try { navigator.vibrate(4); } catch (e) {} }
      });
    });
  })();

  /* 左右滑动切换封面（触屏手势） */
  (function bindCoverSwipe() {
    if (!ccsTrack) return;
    let startX = null, startY = null, dragging = false;
    ccsTrack.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
    }, { passive: true });
    ccsTrack.addEventListener('touchend', (e) => {
      if (!dragging || startX === null) return;
      dragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null; startY = null;
      if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) goToCover(coverIndex + 1);
      else goToCover(coverIndex - 1);
    }, { passive: true });
  })();

  // 键盘左右方向键切换封面（桌面端预览时的便利性增强）
  document.addEventListener('keydown', (e) => {
    if (charDetail.classList.contains('is-open')) return; // 相册详情打开时交给内部翻页监听
    const charPanelActive = document.querySelector('.gl-panel[data-panel="char"]');
    if (!charPanelActive || !charPanelActive.classList.contains('is-active')) return;
    if (e.key === 'ArrowRight') goToCover(coverIndex + 1);
    if (e.key === 'ArrowLeft') goToCover(coverIndex - 1);
  });

  /* -----------------------------------------------------------
     角色专属相册详情 —— 单页画册视图，一次只展示一张，左右翻页
  ----------------------------------------------------------- */
  function renderPagerTicks() {
    cdPagerTicks.innerHTML = '';
    pagePhotos.forEach((_, i) => {
      const tick = document.createElement('span');
      tick.className = 'cd-tick' + (i === pageIndex ? ' is-active' : '');
      tick.dataset.i = i;
      cdPagerTicks.appendChild(tick);
    });
  }

  function renderPagerPages() {
    cdPagerTrack.innerHTML = '';
    const c = getCharById(openCharId);
    const name = c ? (c.name || '未命名角色') : '';

    pagePhotos.forEach((p, i) => {
      const page = document.createElement('div');
      page.className = 'cd-page';
      page.dataset.i = i;
      page.innerHTML = `
        <div class="cd-page-frame">
          <div class="cd-page-photo">
            <img src="${p.src}" alt="${escHtml(name)}" draggable="false" />
            <div class="cd-page-corner ${p.corner}"></div>
          </div>
          <div class="cd-page-caption">
            <div class="cd-page-cap-left">
              <div class="cd-page-cap-title">${escHtml(name)}</div>
              <div class="cd-page-cap-sub">PERSONA ARCHIVE</div>
            </div>
            <div class="cd-page-cap-num">${String(i + 1).padStart(2, '0')} / ${String(pagePhotos.length).padStart(2, '0')}</div>
          </div>
        </div>
      `;
      cdPagerTrack.appendChild(page);
    });

    updatePagerPositions();
  }

  function updatePagerPositions() {
    const pages = Array.from(cdPagerTrack.children);
    pages.forEach((el, i) => {
      el.classList.toggle('is-active', i === pageIndex);
      el.classList.toggle('is-prev', i < pageIndex);
    });
    renderPagerTicks();
    if (cdPageIndicator) {
      cdPageIndicator.textContent = `${String(pageIndex + 1).padStart(2, '0')} / ${String(pagePhotos.length).padStart(2, '0')}`;
    }
    if (cdPrev) cdPrev.disabled = pageIndex <= 0;
    if (cdNext) cdNext.disabled = pageIndex >= pagePhotos.length - 1;
  }

  function goToPage(idx) {
    if (idx < 0 || idx >= pagePhotos.length) return;
    pageIndex = idx;
    updatePagerPositions();
    if (navigator.vibrate) { try { navigator.vibrate(4); } catch (e) {} }
  }

  function openCharAlbum(charId) {
    const c = getCharById(charId);
    if (!c) return;
    openCharId = charId;
    cdTitle.textContent = c.name || '未命名角色';

    pagePhotos = collectCharPhotos(c);
    pageIndex = 0;

    const hasPhotos = pagePhotos.length > 0;
    cdCount.textContent = `${pagePhotos.length} 张影像`;
    cdEmpty.hidden = hasPhotos;
    cdPager.hidden = !hasPhotos;
    if (cdPageIndicator) {
      cdPageIndicator.textContent = hasPhotos
        ? `01 / ${String(pagePhotos.length).padStart(2, '0')}`
        : '00 / 00';
    }

    if (hasPhotos) renderPagerPages();
    else cdPagerTrack.innerHTML = '';

    charDetail.classList.add('is-open');
    charDetail.setAttribute('aria-hidden', 'false');
  }
  function closeCharAlbum() {
    charDetail.classList.remove('is-open');
    charDetail.setAttribute('aria-hidden', 'true');
    openCharId = null;
  }

  if (cdBack) cdBack.addEventListener('click', closeCharAlbum);
  if (cdScrim) cdScrim.addEventListener('click', closeCharAlbum);

  if (cdPrev) cdPrev.addEventListener('click', () => goToPage(pageIndex - 1));
  if (cdNext) cdNext.addEventListener('click', () => goToPage(pageIndex + 1));

  if (cdPagerTicks) {
    cdPagerTicks.addEventListener('click', (e) => {
      const tick = e.target.closest('.cd-tick');
      if (!tick) return;
      goToPage(parseInt(tick.dataset.i, 10));
    });
  }

  /* 左右滑动翻页手势（触屏），与相册集详情页的手感保持一致 */
  (function bindPagerSwipe() {
    if (!cdPagerTrack) return;
    let startX = null, startY = null, dragging = false;
    cdPagerTrack.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
    }, { passive: true });
    cdPagerTrack.addEventListener('touchend', (e) => {
      if (!dragging || startX === null) return;
      dragging = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      startX = null; startY = null;
      if (Math.abs(dx) < 46 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) goToPage(pageIndex + 1);
      else goToPage(pageIndex - 1);
    }, { passive: true });
  })();

  // 键盘左右方向键翻页（桌面端浏览预览时的便利性增强）
  document.addEventListener('keydown', (e) => {
    if (!charDetail.classList.contains('is-open')) return;
    if (e.key === 'ArrowRight') goToPage(pageIndex + 1);
    if (e.key === 'ArrowLeft') goToPage(pageIndex - 1);
  });
  if (cdProfileLink) {
    cdProfileLink.addEventListener('click', () => {
      if (!openCharId) return;
      window.location.href = 'characters.html?open=' + encodeURIComponent(openCharId);
    });
  }

  /* -----------------------------------------------------------
     数据加载与刷新
  ----------------------------------------------------------- */
  async function loadChars() {
    chars = await getAllCharsFromDB();
    renderCoverStage();
    // 若详情覆盖层正打开，且对应角色已被删除，则自动关闭
    if (openCharId && !getCharById(openCharId)) closeCharAlbum();
  }

  loadChars();

  // 每次切到 Char 面板时刷新一次（保证从角色档案页编辑返回后数据最新）
  document.querySelectorAll('.gl-seal[data-target="char"]').forEach((seal) => {
    seal.addEventListener('click', () => loadChars());
  });

  // 角色档案页在增删改角色后会写入这些 key，跨标签页/回退时同步刷新
  window.addEventListener('storage', (e) => {
    if (e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated') loadChars();
  });
  window.addEventListener('focus', () => loadChars());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadChars();
  });

})();