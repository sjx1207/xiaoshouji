/* ============================================================
   SUINIAN · 碎念 — app.js
   页面切换 / 导航交互 / 分类与标签指示条
============================================================ */

(function () {
  'use strict';

  /* ---------------- 状态栏：实时时间（与 index.html 主界面同步） ---------------- */
  function updateStatusTime() {
    const el = document.getElementById('snStatusTime');
    if (!el) return;
    const now = new Date();
    el.textContent = now.toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }
  updateStatusTime();
  setInterval(updateStatusTime, 15000);

  /* ---------------- 底部导航：页面切换 + 滑动指示条 ---------------- */
  const navItems = Array.from(document.querySelectorAll('.sn-nav-item'));
  const navIndicator = document.getElementById('snNavIndicator');
  const pages = Array.from(document.querySelectorAll('.sn-page'));

  function activatePage(pageId) {
    pages.forEach(p => p.classList.toggle('active', p.id === pageId));
  }

  function setNavActive(index) {
    navItems.forEach((item, i) => item.classList.toggle('active', i === index));
    if (navIndicator) {
      navIndicator.style.transform = `translateX(${index * 100}%)`;
    }
  }

  navItems.forEach((item, index) => {
    item.addEventListener('click', () => {
      setNavActive(index);
      activatePage(item.dataset.page);
      // 切页时信息流回到顶部，体验更整洁
      const target = document.getElementById(item.dataset.page);
      if (target) target.scrollTop = 0;
    });
  });

  /* ---------------- 个人中心：作品/收藏/赞过 标签 ---------------- */
  const ptabs = Array.from(document.querySelectorAll('.sn-ptab'));
  const ptabIndicator = document.getElementById('snPtabIndicator');

  ptabs.forEach((tab, index) => {
    tab.addEventListener('click', () => {
      ptabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      if (ptabIndicator) {
        ptabIndicator.style.transform = `translateX(${index * 100}%)`;
      }
      // 预留：根据 tab.dataset.ptab 切换网格数据源（作品 / 收藏 / 赞过）
    });
  });

  /* ---------------- 私信列表：点击后取消未读状态 ---------------- */
  document.querySelectorAll('.sn-dm-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.remove('unread');
      const badge = item.querySelector('.sn-dm-badge');
      if (badge) badge.remove();
    });
  });

  /* ---------------- 顶部搜索 / 通知按钮（占位交互） ---------------- */
  const btnSearch = document.getElementById('btnSearch');
  if (btnSearch) {
    btnSearch.addEventListener('click', () => {
      // 预留：展开搜索输入层
    });
  }

  const btnNotif = document.getElementById('btnNotif');
  if (btnNotif) {
    btnNotif.addEventListener('click', () => {
      const dot = btnNotif.querySelector('.sn-dot');
      if (dot) dot.style.display = 'none';
      // 预留：展开通知列表
    });
  }

  /* ============================================================
     角色环 — 同步 characters.js 的 LunaCharDB 数据（仅展示，不可点击）
  ============================================================ */
  const COLOR_MAP = {
    warm:  { ring: 'conic-gradient(from 180deg, #b8a47a, #e8ddd0, #b8a47a)' },
    cool:  { ring: 'conic-gradient(from 90deg, #607d85, #cfe0e3, #607d85)' },
    gold:  { ring: 'conic-gradient(from 40deg, #927d50, #e4d9c4, #927d50)' },
    ash:   { ring: 'conic-gradient(from 220deg, #707070, #dedede, #707070)' },
    mist:  { ring: 'conic-gradient(from 300deg, #7a8e72, #d5e2d0, #7a8e72)' },
    blush: { ring: 'conic-gradient(from 150deg, #9e7870, #e4d5d2, #9e7870)' },
  };
  const DEFAULT_RING = 'conic-gradient(from 180deg, #1a1a1a, #8a8a8a, #1a1a1a)';

  function openCharDBReadOnly() {
    return new Promise((res, rej) => {
      const probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chars')) { db.close(); return res(null); }
        res(db);
      };
      probe.onerror = () => res(null);
      // 只读同步：不在此处创建 store，避免与 characters.js 的建库逻辑冲突
      probe.onupgradeneeded = e => { e.target.transaction.abort(); };
    });
  }

  async function getAllCharsReadOnly() {
    const db = await openCharDBReadOnly().catch(() => null);
    if (!db) return [];
    return new Promise(res => {
      try {
        const tx = db.transaction('chars', 'readonly');
        const req = tx.objectStore('chars').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
      } catch (e) { res([]); }
    });
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  async function renderCharacterRing() {
    const wrap = document.getElementById('snStories');
    if (!wrap) return;
    // 清除除"上传"按钮以外的所有节点
    Array.from(wrap.querySelectorAll('.sn-story:not(.sn-story-add)')).forEach(n => n.remove());

    const chars = await getAllCharsReadOnly();
    const activeId = parseInt(localStorage.getItem('luna_active_char')) || null;

    chars.forEach(c => {
      const col = COLOR_MAP[c.color] || null;
      const ringBg = col ? col.ring : DEFAULT_RING;
      const isActive = c.id === activeId;
      const letter = (c.name || '?')[0].toUpperCase();

      const el = document.createElement('div');
      el.className = 'sn-story';
      el.title = c.name || '';
      el.innerHTML = `
        <div class="sn-story-ring${isActive ? ' sn-story-active' : ''}" style="background:${ringBg}">
          ${c.avatar
            ? `<img class="sn-story-avatar-img" src="${c.avatar}" alt="${escHtml(c.name||'')}"/>`
            : `<div class="sn-story-avatar" style="display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#5a5a5a;">${escHtml(letter)}</div>`
          }
        </div>
        <span>${escHtml(c.name || '未命名')}</span>
      `;
      // 仅展示，不绑定点击事件
      wrap.appendChild(el);
    });
  }

  renderCharacterRing();

  // 跨页同步：characters.html 编辑/新增/删除/应用角色后会写入这些 key
  window.addEventListener('storage', (e) => {
    if (e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated' || e.key === 'luna_active_char') {
      renderCharacterRing();
    }
  });
  // 每次切回首页 tab 时也刷新一次，兜底同源页面间 storage 事件不触发的情况
  document.querySelectorAll('.sn-nav-item[data-page="pageHome"]').forEach(btn => {
    btn.addEventListener('click', renderCharacterRing);
  });

  /* ============================================================
     世界观面板 — IndexedDB 存档 + 自定义 chip 选择器
  ============================================================ */
  let _wdDB = null;
  function openWorldDB() {
    if (_wdDB) return Promise.resolve(_wdDB);
    return new Promise((res, rej) => {
      const req = indexedDB.open('LunaWorldDB', 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('worlds')) {
          db.createObjectStore('worlds', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = e => { _wdDB = e.target.result; res(_wdDB); };
      req.onerror = e => rej(e.target.error);
    });
  }
  async function getAllWorlds() {
    const db = await openWorldDB().catch(() => null);
    if (!db) return [];
    return new Promise(res => {
      const req = db.transaction('worlds', 'readonly').objectStore('worlds').getAll();
      req.onsuccess = () => res((req.result || []).sort((a,b) => (b.updatedAt||0)-(a.updatedAt||0)));
      req.onerror = () => res([]);
    });
  }
  async function saveWorld(data) {
    const db = await openWorldDB().catch(() => null);
    if (!db) return null;
    return new Promise(res => {
      const tx = db.transaction('worlds', 'readwrite');
      const store = tx.objectStore('worlds');
      const req = data.id ? store.put(data) : store.add(data);
      req.onsuccess = () => res(req.result);
      req.onerror = () => res(null);
    });
  }
  async function deleteWorld(id) {
    const db = await openWorldDB().catch(() => null);
    if (!db) return;
    return new Promise(res => {
      const tx = db.transaction('worlds', 'readwrite');
      tx.objectStore('worlds').delete(id);
      tx.oncomplete = res;
    });
  }

  // ---- 选择状态 ----
  let _wdEditingId = null;
  let _wdActiveId = parseInt(localStorage.getItem('luna_active_world')) || null;
  const _wdSelections = {
    theme: new Set(),
    duration: null,
    pov: new Set(),
    mood: new Set(),
    era: null,
  };
  const _wdCustomTags = { theme: [], duration: [], pov: [], mood: [], era: [] };

  const wdOverlay = document.getElementById('wdOverlay');
  const wdModal = document.getElementById('wdModal');
  const wdCloseBtn = document.getElementById('wdCloseBtn');
  const btnWorldPanel = document.getElementById('btnWorldPanel');

  function openWorldPanel() {
    if (!wdOverlay || !wdModal) return;
    wdOverlay.classList.add('show');
    wdModal.classList.add('show');
    renderSavedWorlds();
  }
  function closeWorldPanel() {
    if (!wdOverlay || !wdModal) return;
    wdOverlay.classList.remove('show');
    wdModal.classList.remove('show');
  }
  if (btnWorldPanel) btnWorldPanel.addEventListener('click', () => { resetWorldForm(false); openWorldPanel(); });
  if (wdCloseBtn) wdCloseBtn.addEventListener('click', closeWorldPanel);
  if (wdOverlay) wdOverlay.addEventListener('click', closeWorldPanel);

  // ---- chip 组交互（自定义选择器，非原生 select） ----
  function setupChipGroup(groupId, key) {
    const group = document.getElementById(groupId);
    if (!group) return;
    const isMulti = group.dataset.multi === 'true';
    group.addEventListener('click', (e) => {
      const chip = e.target.closest('.wd-chip');
      if (!chip || !group.contains(chip)) return;
      const val = chip.dataset.value;
      if (isMulti) {
        if (_wdSelections[key].has(val)) {
          _wdSelections[key].delete(val);
          chip.classList.remove('wd-chip-selected');
        } else {
          _wdSelections[key].add(val);
          chip.classList.add('wd-chip-selected');
        }
      } else {
        if (_wdSelections[key] === val) {
          _wdSelections[key] = null;
          chip.classList.remove('wd-chip-selected');
        } else {
          _wdSelections[key] = val;
          Array.from(group.querySelectorAll('.wd-chip')).forEach(c => c.classList.remove('wd-chip-selected'));
          chip.classList.add('wd-chip-selected');
        }
      }
    });
  }
  setupChipGroup('wdThemeChips', 'theme');
  setupChipGroup('wdDurationChips', 'duration');
  setupChipGroup('wdPovChips', 'pov');
  setupChipGroup('wdMoodChips', 'mood');
  setupChipGroup('wdEraChips', 'era');

  // ---- 自定义输入：回车添加为新 chip ----
  function setupCustomInput(inputId, groupId, key) {
    const input = document.getElementById(inputId);
    const group = document.getElementById(groupId);
    if (!input || !group) return;
    const isMulti = group.dataset.multi === 'true';
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      // 已存在则不重复添加
      const exists = Array.from(group.querySelectorAll('.wd-chip')).some(c => c.dataset.value === val);
      if (!exists) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'wd-chip wd-chip-custom';
        chip.dataset.value = val;
        chip.textContent = val;
        group.appendChild(chip);
        _wdCustomTags[key].push(val);
      }
      // 选中它
      if (isMulti) {
        _wdSelections[key].add(val);
        const chipEl = Array.from(group.querySelectorAll('.wd-chip')).find(c => c.dataset.value === val);
        if (chipEl) chipEl.classList.add('wd-chip-selected');
      } else {
        _wdSelections[key] = val;
        Array.from(group.querySelectorAll('.wd-chip')).forEach(c => c.classList.remove('wd-chip-selected'));
        const chipEl = Array.from(group.querySelectorAll('.wd-chip')).find(c => c.dataset.value === val);
        if (chipEl) chipEl.classList.add('wd-chip-selected');
      }
      input.value = '';
    });
  }
  setupCustomInput('wdThemeCustom', 'wdThemeChips', 'theme');
  setupCustomInput('wdDurationCustom', 'wdDurationChips', 'duration');
  setupCustomInput('wdPovCustom', 'wdPovChips', 'pov');
  setupCustomInput('wdMoodCustom', 'wdMoodChips', 'mood');
  setupCustomInput('wdEraCustom', 'wdEraChips', 'era');

  // 描述字数统计
  const wdDesc = document.getElementById('wdDesc');
  const wdDescCount = document.getElementById('wdDescCount');
  if (wdDesc && wdDescCount) {
    wdDesc.addEventListener('input', () => { wdDescCount.textContent = wdDesc.value.length; });
  }

  function resetWorldForm(clearEditingId = true) {
    if (clearEditingId) _wdEditingId = null;
    document.getElementById('wdName').value = '';
    document.getElementById('wdDesc').value = '';
    wdDescCount.textContent = '0';
    _wdSelections.theme = new Set();
    _wdSelections.duration = null;
    _wdSelections.pov = new Set();
    _wdSelections.mood = new Set();
    _wdSelections.era = null;
    ['wdThemeChips','wdDurationChips','wdPovChips','wdMoodChips','wdEraChips'].forEach(id => {
      const group = document.getElementById(id);
      if (!group) return;
      // 移除动态添加的自定义 chip，恢复内置选项
      Array.from(group.querySelectorAll('.wd-chip-custom')).forEach(c => c.remove());
      Array.from(group.querySelectorAll('.wd-chip')).forEach(c => c.classList.remove('wd-chip-selected'));
    });
  }

  const wdResetBtn = document.getElementById('wdResetBtn');
  if (wdResetBtn) wdResetBtn.addEventListener('click', () => resetWorldForm(true));

  function fillWorldForm(w) {
    _wdEditingId = w.id;
    document.getElementById('wdName').value = w.name || '';
    document.getElementById('wdDesc').value = w.desc || '';
    wdDescCount.textContent = (w.desc || '').length;

    const groupMap = { theme: 'wdThemeChips', duration: 'wdDurationChips', pov: 'wdPovChips', mood: 'wdMoodChips', era: 'wdEraChips' };
    const multiKeys = ['theme', 'mood', 'pov'];

    // 多选字段（theme / mood / pov）统一存 Set，单选字段（duration / era）存字符串
    _wdSelections.theme = new Set(w.theme || []);
    _wdSelections.mood = new Set(w.mood || []);
    _wdSelections.pov = new Set(w.pov || []);
    _wdSelections.duration = w.duration || null;
    _wdSelections.era = w.era || null;

    Object.entries(groupMap).forEach(([key, groupId]) => {
      const group = document.getElementById(groupId);
      if (!group) return;
      Array.from(group.querySelectorAll('.wd-chip-custom')).forEach(c => c.remove());
      const selectedVals = multiKeys.includes(key)
        ? Array.from(_wdSelections[key])
        : (_wdSelections[key] ? [_wdSelections[key]] : []);

      selectedVals.forEach(val => {
        let chip = Array.from(group.querySelectorAll('.wd-chip')).find(c => c.dataset.value === val);
        if (!chip) {
          chip = document.createElement('button');
          chip.type = 'button';
          chip.className = 'wd-chip wd-chip-custom';
          chip.dataset.value = val;
          chip.textContent = val;
          group.appendChild(chip);
        }
      });
      Array.from(group.querySelectorAll('.wd-chip')).forEach(c => {
        c.classList.toggle('wd-chip-selected', selectedVals.includes(c.dataset.value));
      });
    });
  }

  async function renderSavedWorlds() {
    const row = document.getElementById('wdSavedRow');
    if (!row) return;
    const worlds = await getAllWorlds();
    row.innerHTML = '';
    worlds.forEach(w => {
      const card = document.createElement('div');
      card.className = 'wd-saved-card' + (w.id === _wdActiveId ? ' wd-saved-active' : '');
      const themeStr = (w.theme || []).slice(0,2).join(' · ') || '未分类';
      card.innerHTML = `
        <div class="wd-saved-card-name">${escHtml(w.name || '未命名世界观')}</div>
        <div class="wd-saved-card-meta">${escHtml(themeStr)}</div>
        <div class="wd-saved-card-del" data-del="${w.id}">删除</div>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-del]')) return;
        _wdActiveId = w.id;
        localStorage.setItem('luna_active_world', w.id);
        localStorage.setItem('luna_world_name', w.name || '');
        updateWorldEntryDisplay(w);
        fillWorldForm(w);
        renderSavedWorlds();
      });
      const delBtn = card.querySelector('[data-del]');
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteWorld(w.id);
        if (_wdActiveId === w.id) {
          _wdActiveId = null;
          localStorage.removeItem('luna_active_world');
          localStorage.removeItem('luna_world_name');
          updateWorldEntryDisplay(null);
        }
        renderSavedWorlds();
      });
      row.appendChild(card);
    });
  }

  function updateWorldEntryDisplay(w) {
    const titleEl = document.getElementById('worldEntryTitle');
    const subEl = document.getElementById('worldEntrySub');
    if (!titleEl || !subEl) return;
    if (w) {
      titleEl.textContent = w.name || '专属世界观';
      const bits = [];
      if ((w.theme||[]).length) bits.push(w.theme.slice(0,2).join('/'));
      if (w.duration) bits.push(w.duration);
      if (w.pov && w.pov.length) bits.push(w.pov.slice(0,2).join('/'));
      subEl.textContent = bits.length ? bits.join(' · ') : '已设定 · 点击查看或编辑';
    } else {
      titleEl.textContent = '专属世界观';
      subEl.textContent = '点击设定你的叙事宇宙';
    }
  }

  const wdSaveBtn = document.getElementById('wdSaveBtn');
  if (wdSaveBtn) {
    wdSaveBtn.addEventListener('click', async () => {
      const name = document.getElementById('wdName').value.trim();
      if (!name) { document.getElementById('wdName').focus(); return; }
      const desc = document.getElementById('wdDesc').value.trim();
      const data = {
        name,
        desc,
        theme: Array.from(_wdSelections.theme),
        duration: _wdSelections.duration,
        pov: Array.from(_wdSelections.pov),
        mood: Array.from(_wdSelections.mood),
        era: _wdSelections.era,
        updatedAt: Date.now(),
      };
      if (_wdEditingId) data.id = _wdEditingId;
      const id = await saveWorld(data);
      const savedId = _wdEditingId || id;
      _wdActiveId = savedId;
      localStorage.setItem('luna_active_world', savedId);
      localStorage.setItem('luna_world_name', name);
      data.id = savedId;
      updateWorldEntryDisplay(data);
      await renderSavedWorlds();
      closeWorldPanel();
    });
  }

  // 初始化：读取上次激活的世界观显示在入口条上
  (async function initWorldEntry() {
    if (!_wdActiveId) return;
    const worlds = await getAllWorlds();
    const w = worlds.find(x => x.id === _wdActiveId);
    if (w) updateWorldEntryDisplay(w);
  })();

  /* ============================================================
     AI 生成 — 按世界观 + 贯穿角色 生成一批"伪视频"卡片
     数据来源：
       - AI 接口配置：settings.js 写入的 localStorage
         luna_api_current = { baseUrl, apiKey } / luna_api_model
       - 世界观：LunaWorldDB（本文件上方已定义 getAllWorlds）
       - 贯穿角色：LunaCharDB（本文件上方已定义 getAllCharsReadOnly）
  ============================================================ */

  // ---- 伪视频存档：IndexedDB，按世界观 id 归档，刷新/切页不丢 ----
  const FEED_DB_NAME = 'LunaFeedDB';
  const FEED_STORE = 'posts';
  let _feedDB = null;
  function openFeedDB() {
    if (_feedDB) return Promise.resolve(_feedDB);
    return new Promise((res, rej) => {
      const req = indexedDB.open(FEED_DB_NAME, 1);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(FEED_STORE)) {
          const store = db.createObjectStore(FEED_STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('worldId', 'worldId', { unique: false });
        }
      };
      req.onsuccess = e => { _feedDB = e.target.result; res(_feedDB); };
      req.onerror = e => rej(e.target.error);
    });
  }
  async function getPostsByWorld(worldId) {
    const db = await openFeedDB().catch(() => null);
    if (!db) return [];
    return new Promise(res => {
      try {
        const tx = db.transaction(FEED_STORE, 'readonly');
        const idx = tx.objectStore(FEED_STORE).index('worldId');
        const req = idx.getAll(IDBKeyRange.only(worldId));
        req.onsuccess = () => res((req.result || []).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
        req.onerror = () => res([]);
      } catch (e) { res([]); }
    });
  }
  function addPosts(posts) {
    return openFeedDB().then(db => new Promise(res => {
      const tx = db.transaction(FEED_STORE, 'readwrite');
      const store = tx.objectStore(FEED_STORE);
      const withIds = [];
      posts.forEach(p => {
        const req = store.add(p);
        req.onsuccess = () => { p.id = req.result; withIds.push(p); };
      });
      tx.oncomplete = () => res(withIds);
      tx.onerror = () => res(withIds);
    })).catch(() => []);
  }
  function updatePost(post) {
    return openFeedDB().then(db => new Promise(res => {
      const tx = db.transaction(FEED_STORE, 'readwrite');
      tx.objectStore(FEED_STORE).put(post);
      tx.oncomplete = () => res(true);
      tx.onerror = () => res(false);
    })).catch(() => false);
  }
  function getPostById(id) {
    return openFeedDB().then(db => new Promise(res => {
      const tx = db.transaction(FEED_STORE, 'readonly');
      const req = tx.objectStore(FEED_STORE).get(id);
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    })).catch(() => null);
  }

  // ---- 封面色块（没有真实视频素材，用色块+文案模拟"影像感"） ----
  const COVER_PALETTES = [
    'linear-gradient(160deg,#8a8a72,#3d3d33)',
    'linear-gradient(160deg,#6b7f8a,#22303a)',
    'linear-gradient(160deg,#9e7f70,#3a2a24)',
    'linear-gradient(160deg,#7a8a72,#2a3324)',
    'linear-gradient(160deg,#8a7290,#2e2438)',
    'linear-gradient(160deg,#7a7a7a,#232323)',
    'linear-gradient(160deg,#a08a5a,#332c1a)',
  ];
  function pickPalette(seed) {
    let h = 0;
    const s = String(seed || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return COVER_PALETTES[h % COVER_PALETTES.length];
  }

  // ---- AI 接口配置（读取 settings.js 保存的内容） ----
  function getApiConfig() {
    const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
    const model = localStorage.getItem('luna_api_model') || '';
    return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model };
  }

  function setGenHint(text, isError) {
    const hint = document.getElementById('snGenHint');
    if (!hint) return;
    hint.textContent = text || '';
    hint.classList.toggle('sn-gen-hint-error', !!isError);
  }
  function setGenLoading(loading) {
    const btn = document.getElementById('btnGenerate');
    const txt = document.getElementById('btnGenerateText');
    if (!btn) return;
    btn.classList.toggle('sn-gen-loading', loading);
    if (txt) txt.textContent = loading ? 'AI 生成中…' : '生成一日Vlog';
  }

  async function getActiveWorldData() {
    const id = parseInt(localStorage.getItem('luna_active_world')) || null;
    if (!id) return null;
    const worlds = await getAllWorlds();
    return worlds.find(w => w.id === id) || null;
  }

  function getTopicInput() {
    const el = document.getElementById('genTopicInput');
    return el ? el.value.trim() : '';
  }

  // 世界观只负责"这个世界成立的规则/氛围/时代背景"，不负责任何具体人设
  function buildWorldBrief(w) {
    const bits = [];
    if (w.theme && w.theme.length) bits.push(`主题风格：${w.theme.join('、')}`);
    if (w.duration) bits.push(`时长范围：${w.duration}`);
    if (w.pov && w.pov.length) bits.push(`叙事视角：${w.pov.join('、')}`);
    if (w.mood && w.mood.length) bits.push(`情绪基调：${w.mood.join('、')}`);
    if (w.era) bits.push(`时代/地域背景：${w.era}`);
    return bits.join('\n');
  }

  async function getExistingCharForGen() {
    const chars = await getAllCharsReadOnly();
    if (!chars.length) return null;
    const activeId = parseInt(localStorage.getItem('luna_active_char')) || null;
    return chars.find(c => c.id === activeId) || chars[0];
  }

  function buildExistingCharBrief(c) {
    const bits = [`名字：${c.name || '未命名'}`];
    if (c.persona) bits.push(`人设：${c.persona}`);
    if (c.bio) bits.push(`简介：${c.bio}`);
    if (c.desc) bits.push(`描述：${c.desc}`);
    if (c.tags) bits.push(`标签：${(Array.isArray(c.tags) ? c.tags : [c.tags]).join('、')}`);
    return bits.join('\n');
  }

  // ---- 核心提示词：世界观(规则) + 用户输入的主题 → 一批"同一主题、不同人设"的伪视频卡片 ----
  //      若角色库里存了角色，其中必须有一条使用该真实角色（其余仍然是AI自由现编的不同人设）
  function buildGenPrompt(world, topic, existingChar) {
    const worldBrief = buildWorldBrief(world);
    const existingBlock = existingChar ? `

【已存在的角色 —— 其中必须有且仅有一条卡片使用这个真实角色】
${buildExistingCharBrief(existingChar)}
这个角色的姓名必须原样使用（就是"${existingChar.name}"），不能改名、不能替换成别人，人设也不能和上面描述的冲突。请把这一条的 "author" 精确填成"${existingChar.name}"，并把 "isRealChar" 设为 true；其余每一条都必须是你自由现编的、类型完全不同的新人设，"isRealChar" 设为 false。` : '';

    return `你是"碎念"App的内容生成引擎。这是一个只生成"伪视频"卡片的社交信息流App（形式像抖音/小红书关注页），不产出真实视频文件，只需要生成"看起来像一条视频动态"的结构化信息：作者、标题、封面文案、正文、时长、互动数据。

【世界观 = 这个世界成立的规则/背景/氛围，不代表任何固定人物】
${world.desc ? world.desc + '\n' : ''}${worldBrief || '（未填写更多细节，请你自行合理推演）'}

【本次生成主题】
"${topic}"
${existingBlock}

【任务】
围绕上面这个主题，在满足世界观规则/氛围的前提下，虚构一批"同一主题、不同人设呈现"的伪视频卡片——就像刷到了好几条同类型内容，但每一条的主人公都是完全不同的人、完全不同的性格类型和风格。

要求：
1. 除上面提到的"已存在的角色"（如果有）之外，其余每一条卡片的人物都由你现编姓名与人设，禁止使用"NPC1""路人甲"之类占位符，也不要使用真实存在的公众人物姓名。
2. 核心是"人设多样性"：如果主题是"男朋友的一日vlog"，就要覆盖明显不同的类型（例如霸总范/温柔文艺范/热血运动范/高冷学霸范/奶狗撒娇范……你自行发挥，不要重复雷同的性格模板），每条卡片一个独立人设、独立故事线，彼此之间不需要有情节关联。
3. 生成数量不固定，由你根据能想到多少个有区分度的人设来判断，一般在 4～9 条之间（含"已存在的角色"那一条）；宁可少而精，不要为凑数硬编重复类型。
4. 语言、氛围必须符合世界观里的规则/时代背景/情绪基调，但人物性格、身份、造型完全由你自由发挥，世界观不限制人设。
5. title 要能一眼看出这条呈现的是"哪一种类型"（例如"霸总男友的深夜加班餐"），tag 用 2~5 字概括这个人设类型（例如"霸总""文艺""运动""奶狗""学霸"）。
6. duration 给一个 mm:ss 时长，范围建议在 00:45 ~ 03:30 之间（除非世界观里明确设定了别的时长范围）；这个时长会直接决定后续正片详情要写多少内容，所以不要给出过短（比如 00:10）或不合常理的时长，也不要为了"看起来真实"而随手写一个和内容体量脱节的数字；likes/comments 给出符合平台调性的合理数字，不需要精确，模拟真实感即可。

请严格只输出以下 JSON 数组，不要输出任何解释文字，不要使用 markdown 代码块标记：
[
  {
    "author": "这条视频里人物的名字",
    "isRealChar": true 或 false，
    "personaType": "这条呈现的人设类型简称，例如 霸总/文艺/运动/奶狗/学霸",
    "title": "视频标题，一句话，要点明是哪种人设类型，要有画面感",
    "caption": "叠加在封面上的一句话，8~16字左右，类似字幕",
    "desc": "正文文案，1~3句话，符合该人设的口吻与性格",
    "tag": "简短话题/分类标签，2~5字，可与 personaType 相同",
    "duration": "mm:ss 格式时长",
    "likes": 数字,
    "comments": 数字,
    "time": "相对发布时间，例如 3小时前 / 刚刚 / 昨天"
  }
]`;
  }

  function safeParseJsonArray(raw) {
    if (!raw) return null;
    let text = String(raw).trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) return null;
    text = text.slice(start, end + 1);
    try {
      const data = JSON.parse(text);
      return Array.isArray(data) ? data : null;
    } catch (e) { return null; }
  }

  // ---- 卡片渲染 ----
  function renderPosts(posts, prepend) {
    const feed = document.getElementById('snFeed');
    const empty = document.getElementById('snFeedEmpty');
    if (!feed || !posts || !posts.length) return;
    if (empty) empty.style.display = 'none';

    const frag = document.createDocumentFragment();
    posts.forEach(p => {
      const card = document.createElement('div');
      card.className = 'sn-post';
      if (p.id != null) card.dataset.postId = p.id;
      card.style.cursor = 'pointer';
      const isReal = !!p.isRealChar;
      const letter = (p.author || '?').trim()[0] || '?';
      const palette = pickPalette(p.author || p.title || Math.random());
      const ringBg = isReal && p.charColor && COLOR_MAP[p.charColor] ? COLOR_MAP[p.charColor].ring : null;

      const avatarInner = (isReal && p.charAvatar)
        ? `<img class="sn-post-avatar-img" src="${p.charAvatar}" alt="${escHtml(p.author || '')}"/>`
        : `<div class="sn-post-avatar" style="background:${palette}">${escHtml(letter)}</div>`;

      card.innerHTML = `
        <div class="sn-post-head">
          <div class="sn-post-avatar-wrap${ringBg ? ' sn-post-avatar-ring' : ''}" style="${ringBg ? `background:${ringBg}` : ''}">
            <div class="sn-post-avatar-inner">${avatarInner}</div>
          </div>
          <div class="sn-post-headtext">
            <div class="sn-post-name">
              <span class="sn-post-name-text">${escHtml(p.author || '未知')}</span>
              ${isReal ? `<svg class="sn-post-verified" viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 2l2.4 1.1 2.6-.3 1.3 2.3 2.3 1.3-.3 2.6L21.4 11l-1.1 2.4.3 2.6-2.3 1.3-1.3 2.3-2.6-.3L12 20.8l-2.4-1.1-2.6.3-1.3-2.3-2.3-1.3.3-2.6L2.6 11l1.1-2.4-.3-2.6 2.3-1.3L7 1.4l2.6.3z" fill="currentColor"/><path d="M8.5 12l2.3 2.3L15.8 9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>` : ''}
              ${p.personaType ? `<span class="sn-post-persona-tag">${escHtml(p.personaType)}</span>` : ''}
            </div>
            <div class="sn-post-meta">${escHtml(p.time || '刚刚')}</div>
          </div>
        </div>
        <div class="sn-post-cover" style="background:${palette}">
          <div class="sn-post-cover-glow"></div>
          ${p.tag ? `<div class="sn-post-tag">${escHtml(p.tag)}</div>` : ''}
          ${p.duration ? `<div class="sn-post-duration">${escHtml(p.duration)}</div>` : ''}
          <div class="sn-post-play">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
          <div class="sn-post-cover-caption">${escHtml(p.caption || '')}</div>
        </div>
        <div class="sn-post-body">
          <div class="sn-post-title">${escHtml(p.title || '')}</div>
          <div class="sn-post-desc">${escHtml(p.desc || '')}</div>
        </div>
        <div class="sn-post-foot">
          <span class="sn-post-foot-item">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5.5 6 5c2-.15 3.5 1 4 2.4C10.5 6 12 4.85 14 5c3.5.5 5 4 3.5 7.5C15 17.65 12 21 12 21z" stroke="currentColor" stroke-width="1.5"/></svg>
            ${Number.isFinite(p.likes) ? p.likes : (p.likes || 0)}
          </span>
          <span class="sn-post-foot-item">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 4h16v12H8l-4 4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            ${Number.isFinite(p.comments) ? p.comments : (p.comments || 0)}
          </span>
          <span class="sn-post-foot-item sn-post-foot-share">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 12l7-7v4c6 0 8 3 9 7-2.2-2-4.6-3-9-3v4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
          </span>
        </div>
      `;
      card.addEventListener('click', () => openVideoDetail(p));
      frag.appendChild(card);
    });

    if (prepend) {
      const anchor = (empty && empty.parentNode === feed) ? empty.nextSibling : feed.firstChild;
      feed.insertBefore(frag, anchor);
    } else {
      feed.appendChild(frag);
    }
  }

  // 页面加载时：把当前世界观已存档过的内容还原出来
  async function loadFeedForActiveWorld() {
    const worldId = parseInt(localStorage.getItem('luna_active_world')) || null;
    if (!worldId) return;
    const posts = await getPostsByWorld(worldId);
    if (posts.length) renderPosts(posts, false);
  }
  loadFeedForActiveWorld();

  // 回填上次输入的生成主题，方便重复生成
  (function restoreLastTopic() {
    const input = document.getElementById('genTopicInput');
    const last = localStorage.getItem('luna_last_gen_topic');
    if (input && last) input.value = last;
  })();

  // ---- 生成按钮 ----
  const btnGenerate = document.getElementById('btnGenerate');
  if (btnGenerate) {
    btnGenerate.addEventListener('click', async () => {
      setGenHint('');
      const { baseUrl, apiKey, model } = getApiConfig();
      if (!baseUrl || !apiKey || !model) {
        setGenHint('请先在"设置 → AI 接口"里配置好接口地址 / 密钥并选择模型', true);
        return;
      }
      const world = await getActiveWorldData();
      if (!world) {
        setGenHint('请先点击上方"专属世界观"设定并存档一个世界观（这里只定规则/氛围）', true);
        return;
      }
      const topic = getTopicInput();
      if (!topic) {
        const input = document.getElementById('genTopicInput');
        if (input) input.focus();
        setGenHint('请先输入想生成的内容主题，例如"男朋友的一日vlog"', true);
        return;
      }
      localStorage.setItem('luna_last_gen_topic', topic);
      const existingChar = await getExistingCharForGen();

      setGenLoading(true);
      try {
        const prompt = buildGenPrompt(world, topic, existingChar);
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: '你是一个严格按照要求输出 JSON 的内容生成引擎，只输出 JSON 数组本身，不输出任何多余文字或代码块标记。' },
              { role: 'user', content: prompt }
            ],
            temperature: 1.0,
            max_tokens: 2400
          })
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        const raw = data.choices?.[0]?.message?.content || '';
        let posts = safeParseJsonArray(raw);
        if (!posts || !posts.length) throw new Error('AI 返回内容无法解析，请重试');

        // 兜底：如果角色库里有角色，但 AI 没有按要求生成对应的那一条，就手动补一条，
        // 保证只要库里存了角色，这次生成里一定能看到 ta
        if (existingChar) {
          const hit = posts.find(p =>
            p.isRealChar === true ||
            (p.author && String(p.author).trim() === String(existingChar.name).trim())
          );
          if (hit) {
            hit.isRealChar = true;
            hit.author = existingChar.name;
            hit.charAvatar = existingChar.avatar || null;
            hit.charColor = existingChar.color || null;
          } else {
            posts.unshift({
              author: existingChar.name,
              isRealChar: true,
              personaType: '',
              title: `${existingChar.name}的${topic}`,
              caption: `记录一下我的${topic}`,
              desc: existingChar.persona || existingChar.bio || existingChar.desc || `这是${existingChar.name}的日常一天。`,
              tag: '日常',
              duration: '00:' + (20 + Math.floor(Math.random() * 40)),
              likes: 500 + Math.floor(Math.random() * 4000),
              comments: 20 + Math.floor(Math.random() * 300),
              time: '刚刚',
              charAvatar: existingChar.avatar || null,
              charColor: existingChar.color || null,
            });
          }
        }
        // 把真实角色的头像信息补到匹配项上，供渲染时使用真实头像
        if (existingChar) {
          posts = posts.map(p => {
            if (p.isRealChar) {
              return { ...p, charAvatar: p.charAvatar || existingChar.avatar || null, charColor: p.charColor || existingChar.color || null };
            }
            return p;
          });
        }

        const worldId = world.id;
        const now = Date.now();
        const withMeta = posts.map((p, i) => ({ ...p, worldId, topic, createdAt: now + i }));

        await addPosts(withMeta);
        renderPosts(withMeta, true);
        setGenHint(`已生成 ${withMeta.length} 种不同人设的内容`);
      } catch (e) {
        setGenHint('生成失败：' + e.message, true);
      } finally {
        setGenLoading(false);
      }
    });
  }

  /* ============================================================
     视频详情页 — 点击卡片 → 结合世界观 + 卡片信息 AI 现编完整内容
     结构：正片分镜(旁白+台词) / 弹幕 / 评论(含博主随机回复 + 真实角色必回复且不OOC)
     延展板块（彩蛋/花絮/分支/内心OS/其他视角）本期只做功能卡片占位
  ============================================================ */

  const vdOverlay = document.getElementById('vdOverlay');
  const vdBrewing = document.getElementById('vdBrewing');
  const vdPage = document.getElementById('vdPage');
  const vdBackBtn = document.getElementById('vdBackBtn');
  const vdDanmuLayer = document.getElementById('vdDanmuLayer');
  const vdDanmuToggle = document.getElementById('vdDanmuToggle');
  const vdStage = document.getElementById('vdStage');
  const vdPlayCenter = document.getElementById('vdPlayCenter');
  const vdNarrationText = document.getElementById('vdNarrationText');
  const vdProgressFill = document.getElementById('vdProgressFill');
  const vdStageTime = document.getElementById('vdStageTime');
  const vdCommentInput = document.getElementById('vdCommentInput');
  const vdCommentSend = document.getElementById('vdCommentSend');
  const vdExtraToast = document.getElementById('vdExtraToast');
  const vdCommentJumpBtn = document.getElementById('vdCommentJumpBtn');
  const vdBody = document.getElementById('vdBody');

  let _vdCurrentPost = null;   // 当前打开的卡片原始数据
  let _vdDetail = null;        // AI 生成的完整详情内容（含分镜/弹幕/评论/延展状态）
  let _vdDanmuTimers = [];
  let _vdPlaying = true;
  let _vdSceneTimer = null;
  let _vdSceneIdx = 0;
  let _vdWorldCache = null;

  function escAttr(s) { return escHtml(s).replace(/"/g, '&quot;'); }

  function showToast(text) {
    if (!vdExtraToast) return;
    vdExtraToast.textContent = text;
    vdExtraToast.classList.add('show');
    clearTimeout(vdExtraToast._t);
    vdExtraToast._t = setTimeout(() => vdExtraToast.classList.remove('show'), 2200);
  }

  /* ---------------- 打开 / 关闭 详情页 ---------------- */
  let _vdGenToken = 0; // 每次打开详情页 +1，用来判断"取消退出"之后异步返回的结果是否已经过期

  function renderBrewingPreview(post) {
    const nameEl = document.getElementById('vdBrewingPreviewName');
    const titleEl = document.getElementById('vdBrewingPreviewTitle');
    const avatarEl = document.getElementById('vdBrewingPreviewAvatar');
    if (!nameEl || !titleEl || !avatarEl) return;
    nameEl.textContent = post.author || '未知';
    titleEl.textContent = post.title || '';
    const letter = (post.author || '?').trim()[0] || '?';
    const palette = pickPalette(post.author || post.title || Math.random());
    if (post.isRealChar && post.charAvatar) {
      avatarEl.innerHTML = `<img src="${escAttr(post.charAvatar)}" alt="${escAttr(post.author||'')}"/>`;
      avatarEl.style.background = 'transparent';
    } else {
      avatarEl.innerHTML = escHtml(letter);
      avatarEl.style.background = palette;
    }
  }

  async function openVideoDetail(post) {
    if (!vdOverlay) return;
    const myToken = ++_vdGenToken;
    _vdCurrentPost = post;
    _vdDetail = null;
    document.body.style.overflow = 'hidden';
    vdOverlay.classList.add('show');
    vdBrewing.classList.remove('hide');
    vdPage.classList.remove('vd-page-in');
    resetBrewingSteps();
    renderBrewingPreview(post); // 不用等AI，卡片自带的信息立刻就能看到

    // 已经生成过详情（例如上次点开过），直接从 IndexedDB 里取缓存，无需重新生成
    let cached = null;
    if (post.id != null) {
      const full = await getPostById(post.id);
      if (full && full.vdDetail) cached = full.vdDetail;
    }
    if (myToken !== _vdGenToken) return; // 等缓存查询期间用户已经取消/切换，不再继续

    if (cached) {
      // 有缓存：仍然走一遍简短的"整理中"过渡，体验更连贯，但不重新请求AI
      await playBrewingSteps(true);
      if (myToken !== _vdGenToken) return;
      _vdDetail = cached;
      renderVideoDetail();
      enterDetailPage();
      return;
    }

    // 无缓存：调用 AI 生成完整内容；生成过程中用户可以点"先去看看别的"退出，生成会在后台继续
    const stepsPromise = playBrewingSteps(false);
    try {
      const world = _vdWorldCache || (_vdWorldCache = await getActiveWorldData());
      const detail = await generateVideoDetail(post, world);
      await stepsPromise;
      if (post.id != null) {
        post.vdDetail = detail;
        await updatePost(post);
      }
      if (myToken !== _vdGenToken) {
        // 用户已经退出去看别的了：不强行拉回界面，静默存好缓存，下次点开直接读取
        showToast(`「${post.title || '内容'}」已生成完毕，可再次点开查看`);
        return;
      }
      _vdDetail = detail;
      renderVideoDetail();
      enterDetailPage();
    } catch (e) {
      await stepsPromise;
      if (myToken !== _vdGenToken) return;
      _vdDetail = buildFallbackDetail(post, String(e && e.message || e));
      renderVideoDetail();
      enterDetailPage();
    }
  }

  // "先去看看别的"：直接关闭生成中界面，返回信息流，不打断后台生成
  const vdBrewingCancelBtn = document.getElementById('vdBrewingCancelBtn');
  if (vdBrewingCancelBtn) {
    vdBrewingCancelBtn.addEventListener('click', () => {
      _vdGenToken++; // 让还在进行中的 openVideoDetail 异步流程知道自己已经过期
      vdOverlay.classList.remove('show');
      vdBrewing.classList.add('hide');
      document.body.style.overflow = '';
    });
  }

  function resetBrewingSteps() {
    document.querySelectorAll('.vd-brewing-step').forEach(s => {
      s.classList.remove('vd-step-active', 'vd-step-done');
    });
  }
  function playBrewingSteps(fast) {
    const steps = Array.from(document.querySelectorAll('.vd-brewing-step'));
    const dur = fast ? 260 : 620;
    return new Promise(resolve => {
      let i = 0;
      function next() {
        if (i > 0) steps[i - 1].classList.remove('vd-step-active');
        if (i > 0) steps[i - 1].classList.add('vd-step-done');
        if (i >= steps.length) { resolve(); return; }
        steps[i].classList.add('vd-step-active');
        i++;
        setTimeout(next, dur);
      }
      next();
    });
  }

  function enterDetailPage() {
    vdBrewing.classList.add('hide');
    requestAnimationFrame(() => vdPage.classList.add('vd-page-in'));
    if (vdBody) vdBody.scrollTop = 0;
  }

  function closeVideoDetail() {
    _vdGenToken++;
    vdOverlay.classList.remove('show');
    vdPage.classList.remove('vd-page-in');
    document.body.style.overflow = '';
    stopDanmu();
    stopSceneCycle();
    clearInterval(_vdProgressTimer);
  }
  if (vdBackBtn) vdBackBtn.addEventListener('click', closeVideoDetail);

  /* ---------------- AI 生成：完整正片分镜 + 弹幕 + 评论 ---------------- */
  // 根据时长估算需要多少个分镜：太少会导致内容凑不够时长、旁白很快循环完
  // 注意：不再设置人为的分镜数量上限（原来封顶 14 个，导致时长一长内容就被砍掉、和时长完全对不上）
  function estimateSceneCount(durationStr) {
    const sec = parseDurationToSec(durationStr);
    const n = Math.round(sec / 12);
    return Math.max(8, n);
  }

  // 根据时长估算正文（旁白+台词）至少应该有多少字，避免"时长很长但正文才两三百字"的问题
  function estimateMinCharCount(durationStr) {
    const sec = parseDurationToSec(durationStr);
    const estimate = Math.round(sec * 9);
    return Math.max(1000, estimate);
  }

  // 根据"这次生成大概需要写多少字"动态估算 max_tokens，取代写死的固定值。
  // 之前无论时长多长都固定给 6000 tokens，一旦正文字数要求超过它能装下的量，
  // AI 的输出会在句子中间被硬生生截断，JSON 写不完 —— 这正是"生成到一半就断、格式跑掉"的根源。
  // 中文场景下，1 个汉字大致占 1.5~2 个 token，再算上 JSON 结构符号、弹幕、评论等额外内容的开销，
  // 这里按"正文字数 * 2.2"打底，并加上弹幕/评论固定开销，最后留 20% 余量，同时设置一个较高的下限和上限。
  function estimateMaxTokens(minChars) {
    const bodyTokens = minChars * 2.2;           // 正文（旁白+台词）预估 token 数
    const extraTokens = 2200;                     // 弹幕(10~16条) + 评论(6~10条，含路人接话) 的固定开销
    const withMargin = (bodyTokens + extraTokens) * 1.2; // 整体留 20% 余量，避免卡在临界值被截断
    return Math.max(4000, Math.min(16000, Math.round(withMargin)));
  }

  function buildDetailPrompt(post, world) {
    const worldBrief = world ? (world.desc ? world.desc + '\n' : '') + buildWorldBrief(world) : '（未设定世界观，请自行合理推演氛围）';
    const charLock = post.isRealChar
      ? `注意："${post.author}"是一个已经存在的真实角色，你在正片旁白、台词、以及后面的"评论区角色回复"里都必须严格贴合这个角色的既有人设，绝不能写出任何偏离人设、OOC（Out Of Character）的言行。`
      : `"${post.author}"是这条内容里现编的人设（类型：${post.personaType || '未指定'}），只要在这一条内容里保持这个人设一致即可。`;
    const sceneCount = estimateSceneCount(post.duration);
    const minChars = estimateMinCharCount(post.duration);

    return `你是"碎念"App的内容生成引擎，现在需要把一张信息流卡片"扩写"成完整的一条伪视频详情内容。

【世界观（规则/氛围，仅供参考，不限制具体人设）】
${worldBrief}

【这张卡片的既有信息，禁止与之矛盾】
主角（这条内容的作者/视频主人公）：${post.author}
人设类型：${post.personaType || '（无）'}
标题：${post.title}
封面文案：${post.caption || ''}
正文简介：${post.desc || ''}
话题标签：${post.tag || ''}
时长：${post.duration || '00:30'}
${charLock}

【任务】
这是一个"伪视频"App：不产出真实视频文件，一切画面感都要靠文字的旁白/对白来传达，所以正片部分必须写成"分镜"形式。

分镜数量与字数要求（硬性要求，不是建议，必须严格遵守）：
- 这条视频时长是 ${post.duration || '00:30'}，请生成 ${sceneCount} 个分镜，只允许比这个数字多，不允许比这个数字少。
- 所有分镜的 narration + line 加起来的总字数，必须达到至少 ${minChars} 字，宁可多写，绝对不能少写。时长越长，这个总字数就必须越高，两者必须匹配；如果你发现按当前分镜数量写不够 ${minChars} 字，就主动增加分镜数量或者把每个分镜写得更细致（增加环境细节、心理活动、对话来回），而不是缩短分镜数量。
- 每个分镜的 narration 本身也不要写成一句话就结束，尽量是 2~4 句、有画面细节和心理活动的一段描述；line 如果存在也可以是稍长一点的完整对话，而不是单字回应。
- 绝对禁止为了控制字数而写成"寥寥两三句就结束的流水账"，也绝对禁止注水式地反复说同一件事凑字数——要用真实的情节推进、细节堆叠、对话往来来达到字数要求。分镜要有清晰的开头-发展-转折-结尾推进感，信息量和节奏感必须撑得起这个时长。

每个分镜包含：
- time：时间戳 mm:ss，代表这个分镜开始展示的时间点，从 00:00 开始随分镜推进递增，最后一个分镜的 time 不能超过 ${post.duration || '00:30'}。【重要】相邻两个分镜之间的时间间隔，必须和这个分镜的文字量（narration+line的字数）大致匹配——正常阅读语速大约每秒 4~5 个字，所以文字多、信息量大的分镜要分配更长的时间间隔，绝不能出现"一大段文字只给2~3秒"这种读不完画面就切走的情况；文字少的分镜可以间隔短一些。写完所有分镜后，请自己检查一遍：每个分镜的（下一个分镜时间-当前时间）秒数，乘以4.5，应该大于等于这个分镜的文字数，不满足就调整这个分镜的时间戳或精简/增补文字，直到匹配。
- narration：旁白，描述动作/表情/心理/场景，第三人称或全知视角的口吻。
- line：这个分镜里说出口的一句话台词，可以为空字符串（如果这个分镜只是纯画面/心理，没有人说话）。
- speaker：说出这句 line 的人的名字。如果画面里除了主角"${post.author}"之外还出现了其他人物（比如对话对象、朋友、家人等），line 可能是那个人说的，speaker 就必须写那个人的名字，不能强行算在主角"${post.author}"头上；如果 line 是主角说的，speaker 就写"${post.author}"；如果 line 为空，speaker 也留空字符串。
- 【非常重要】不要出现"张冠李戴"：比如主角带朋友回家介绍"这是我朋友XXX"，紧接着"XXX"作自我介绍，这一句台词的 speaker 必须是"XXX"本人，绝不能写成主角的话，也不能让主角和XXX说出互相矛盾、身份错乱的台词。写之前请在心里理清楚这一幕里到底谁在跟谁说话。

同时生成：
1. danmu：10~16条弹幕短句，每条严格控制在 2~14 字以内（弹幕本来就是滑过屏幕的短句，太长会来不及看完），模拟真实观众刷屏的反应，长短不一、语气不同，贴合内容与人设，允许玩梗、调侃、感叹、追问，但不要重复雷同。
2. comments：6~10条评论，每条包含：
   - name：评论者昵称，自由现编，不要用真实公众人物
   - text：评论内容，控制在 6~40 字之间，不要写成长篇大论，短平快、口语化，可以是夸赞/调侃/追问/玩梗/共情
   - authorReplied：true/false，是否该条已经被作者本人回复。如果为 true，额外给一个 authorReply 字段（作者本人回复，控制在 4~30 字之间，语气必须贴合人设，简短自然，像真实回复而非客套话）。至少让 2~3 条 authorReplied 为 true。
   - otherReplies：一个数组（可以为空数组），表示其他路人网友对这条评论的接话/附和/抬杠/玩梗，让评论区有"网友之间互相聊起来"的真实感，不是每条评论都只有作者一个人在回。每条 otherReply 包含 name（另一个自由现编的路人昵称，不同于 name 字段）和 text（控制在 4~30 字之间的接话内容，语气自然）。建议至少让 2~4 条评论带有 1~2 条 otherReplies，不需要每条都有，视情况合理分布，避免所有热闹都集中在一条评论下。
【评论口吻的关键要求】这些评论是网友直接留在"${post.author}"本人发布的这条视频下面的，属于当面对话，所以评论里提到博主本人时必须用第二人称"你"，绝对不能用"他/她/ta"这种第三人称来称呼博主本人（例如应该写"想看你拍泡面""你这也太可爱了"，不能写成"想看他拍泡面""他也太可爱了"，那样就变成在背后议论，逻辑不通）。评论区里出现的其他人物（比如视频里一起出镜的朋友/对象）才可以用第三人称提及。otherReplies 里的路人网友互相之间也是当面聊天，同理提到博主要用"你"。
3. 不要输出任何解释文字、不要使用 markdown 代码块标记，只输出以下 JSON：

{
  "scenes": [
    { "time": "00:00", "narration": "...", "line": "...", "speaker": "..." }
  ],
  "danmu": ["...", "..."],
  "comments": [
    { "name": "...", "text": "...", "authorReplied": true, "authorReply": "...", "otherReplies": [ { "name": "...", "text": "..." } ] }
  ]
}`;
  }

  // "续写"用的 prompt：在已有分镜/弹幕/评论基础上追加新的一批，禁止重复已有情节，且要求人物关系与已有内容保持一致
  // "换一批弹幕/评论"：正片分镜/旁白完全不动，只基于已有正片内容追加新的一批弹幕和评论
  function buildContinuePrompt(post, world, existingDetail) {
    const worldBrief = world ? (world.desc ? world.desc + '\n' : '') + buildWorldBrief(world) : '（未设定世界观，请自行合理推演氛围）';
    const charLock = post.isRealChar
      ? `注意："${post.author}"是一个已经存在的真实角色，回复口吻必须严格贴合这个角色的既有人设，绝不能OOC。`
      : `"${post.author}"是这条内容里现编的人设（类型：${post.personaType || '未指定'}），回复口吻要保持这个人设一致。`;
    const sceneBrief = (existingDetail.scenes || []).map(s => `[${s.time}] ${s.speaker ? s.speaker + '：' : ''}${s.line || s.narration || ''}`).join('\n');
    const prevDanmu = (existingDetail.danmu || []).join('、');
    const prevComments = (existingDetail.comments || []).map(c => c.text).join('、');

    return `你是"碎念"App的内容生成引擎。用户正在看一条伪视频的详情页，点击了"换一批"，希望在**不改动正片内容**的前提下，追加新的一批弹幕和评论（正片分镜、旁白、台词已经定稿，你不需要也不能生成或修改它们）。

【世界观（规则/氛围）】
${worldBrief}

【这条视频的既有信息（仅供你理解语境，不要复述、不要改写）】
主角：${post.author}
人设类型：${post.personaType || '（无）'}
标题：${post.title}
正文简介：${post.desc || ''}
正片内容摘要：
${sceneBrief || '（暂无）'}
${charLock}

【已有弹幕，新一批不要和这些重复雷同】
${prevDanmu || '（暂无）'}

【已有评论，新一批不要和这些重复雷同】
${prevComments || '（暂无）'}

【任务】
只生成以下两项内容：
1. danmu：6~10条新弹幕，每条严格控制在 2~14 字以内，模拟真实观众刷屏反应，长短不一、语气不同，贴合内容与人设，可以玩梗调侃追问，不要和已有弹幕重复。
2. comments：4~6条新评论，每条包含：
   - name：评论者昵称，自由现编，不要用真实公众人物
   - text：评论内容，控制在 6~40 字之间，短平快、口语化
   - authorReplied：true/false。如果为 true，额外给 authorReply 字段（作者本人回复，控制在 4~30 字之间，语气贴合人设，简短自然）。至少1~2条 authorReplied 为 true。
   - otherReplies：数组（可为空），表示其他路人网友对这条评论的接话/附和，每条包含 name（另一个自由现编昵称）和 text（4~30字）。让评论区有网友互相聊起来的真实感，建议至少1~2条评论带有 otherReplies。
评论是网友直接留在"${post.author}"本人视频下的当面留言，提到博主本人必须用第二人称"你"，不能用"他/她"这种背后议论式的第三人称。

不要输出任何解释文字、不要使用 markdown 代码块标记，只输出以下 JSON（不需要 scenes 字段）：
{
  "danmu": ["...", "..."],
  "comments": [ { "name": "...", "text": "...", "authorReplied": true, "authorReply": "...", "otherReplies": [ { "name": "...", "text": "..." } ] } ]
}`;
  }

  async function generateVideoDetail(post, world) {
    const { baseUrl, apiKey, model } = getApiConfig();
    if (!baseUrl || !apiKey || !model) {
      throw new Error('请先在"设置 → AI 接口"里配置好接口地址 / 密钥并选择模型');
    }
    const prompt = buildDetailPrompt(post, world);
    const minChars = estimateMinCharCount(post.duration);
    // 关键修复：max_tokens 不再写死 6000，而是根据这次要写多少字动态估算。
    // 时长越长、要求的正文字数越多，给的 token 预算就越大，避免长内容写到一半被截断。
    const maxTokens = estimateMaxTokens(minChars);
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个严格按照要求输出 JSON 的内容生成引擎，只输出 JSON 对象本身，不输出任何多余文字或代码块标记。' },
          { role: 'user', content: prompt }
        ],
        temperature: 1.0,
        max_tokens: maxTokens
      })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const finishReason = data.choices?.[0]?.finish_reason || '';
    const raw = data.choices?.[0]?.message?.content || '';
    let detail = safeParseJsonObject(raw);
    // 即使标准解析失败，也很可能是"输出被截断导致 JSON 没写完"，而不是内容本身有问题，
    // 这里尝试从残缺文本里抢救出已经写完整的那些分镜/弹幕/评论，而不是直接判整体失败。
    if (!detail || !detail.scenes || !detail.scenes.length) {
      detail = salvageTruncatedDetail(raw);
    }
    if (!detail || !detail.scenes || !detail.scenes.length) throw new Error('AI 返回内容无法解析，请重试');

    // 补齐字段防御
    detail.scenes = detail.scenes.map(s => normalizeScene(s, post.author));
    detail.danmu = Array.isArray(detail.danmu) ? detail.danmu.filter(Boolean) : [];
    detail.comments = Array.isArray(detail.comments) ? detail.comments.map(normalizeComment) : [];

    // 字数不达标兜底：如果 AI 没有严格遵守最低字数要求（或者输出被截断导致字数不够），自动重试一次，
    // 重试时按"还差多少字"重新估算一次 max_tokens，避免重试还是被同样的长度上限卡住。
    const totalChars = detail.scenes.reduce((sum, s) => sum + (s.narration || '').length + (s.line || '').length, 0);
    const wasTruncated = finishReason === 'length';
    if (totalChars < minChars * 0.75 || wasTruncated) {
      const retryDetail = await retryGenerateVideoDetailForLength(post, world, baseUrl, apiKey, model, totalChars, minChars);
      if (retryDetail) {
        redistributeSceneTimings(retryDetail, post);
        return retryDetail;
      }
    }

    // 无论 AI 有没有认真按字数分配时间戳，这里都用前端逻辑按实际文字量重新计算每个分镜该停留多久，
    // 并据此重新算出真实总时长写回 post.duration，从根本上保证"时长显示"和"内容量"永远对得上，
    // 不再依赖 AI 是否听话遵守节奏分配。
    redistributeSceneTimings(detail, post);

    return detail;
  }

  // 从被截断、JSON 没写完整的原始文本里，尽量抢救出已经完整生成的那部分内容，
  // 而不是因为最后一个对象/数组没封口就把整段辛苦生成的内容全部丢弃。
  // 做法：逐个尝试把 scenes / danmu / comments 三个数组单独摘出来解析，摘不出来的字段留空即可。
  function salvageTruncatedDetail(raw) {
    if (!raw) return null;
    const text = String(raw);

    function extractArray(key) {
      const keyIdx = text.indexOf(`"${key}"`);
      if (keyIdx === -1) return [];
      const bracketStart = text.indexOf('[', keyIdx);
      if (bracketStart === -1) return [];
      // 从数组开头逐字符扫描，追踪花括号/方括号/字符串引号的嵌套深度，
      // 每当某一层对象在 depth 回到"数组内、对象外"时，就说明这是一个写完整的元素，记下它的结束位置。
      let depth = 0;
      let inStr = false;
      let esc = false;
      let lastCompleteEnd = -1;
      let sawObjectOpen = false;
      for (let i = bracketStart + 1; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
          if (esc) { esc = false; }
          else if (ch === '\\') { esc = true; }
          else if (ch === '"') { inStr = false; }
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === '{') { depth++; sawObjectOpen = true; continue; }
        if (ch === '}') {
          depth--;
          if (depth === 0 && sawObjectOpen) lastCompleteEnd = i;
          continue;
        }
        if (ch === '[' ) { continue; }
        if (ch === ']' && depth === 0) { break; } // 数组正常结束
      }
      if (lastCompleteEnd === -1) return [];
      const arrText = text.slice(bracketStart, lastCompleteEnd + 1) + ']';
      try {
        const arr = JSON.parse(arrText);
        return Array.isArray(arr) ? arr : [];
      } catch (e) { return []; }
    }

    const scenes = extractArray('scenes');
    if (!scenes.length) return null; // 连一个完整分镜都抢救不出来，只能判定失败重来
    const danmu = extractArray('danmu').filter(x => typeof x === 'string' && x.trim());
    const comments = extractArray('comments');
    return { scenes, danmu, comments, _salvaged: true };
  }

  // 按每个分镜的文字量（narration+line）重新计算时间戳，取代 AI 给出的、经常和内容量对不上的 time 字段。
  // 核心原则："文字多，分配的时间就要多；文字少，就应该快一点切走"，而不是所有分镜套用同一个语速。
  // 具体做法：短分镜（字少）按更快的语速估算，避免因为固定停顿垫底而显得"没内容也磨蹭"；
  // 长分镜（字多）额外打一个宽裕系数，避免"一大段字只给一点点时间，根本读不完就切走"。
  // 最后把所有分镜时长加总得到新的总时长，同步覆盖 post.duration，保证时长和内容量始终匹配。
  function redistributeSceneTimings(detail, post) {
    const BASE_CHARS_PER_SEC = 4.5;  // 基础阅读语速：每秒约 4.5 字
    const PAUSE_SEC = 1;              // 每个分镜的基础画面停顿余量
    const MIN_SCENE_SEC = 2;          // 内容很少的分镜，最短也给 2 秒，不至于闪一下就没了
    const LONG_SCENE_CHARS = 60;      // 超过这个字数，判定为"长分镜"，需要额外放宽时间
    let cursor = 0;
    detail.scenes.forEach(s => {
      s.time = formatSec(cursor);
      const chars = (s.narration || '').length + (s.line || '').length;
      let sceneDur;
      if (chars <= 0) {
        sceneDur = MIN_SCENE_SEC;
      } else if (chars > LONG_SCENE_CHARS) {
        // 长分镜：语速再放慢一点（多给 15% 的富余时间），保证信息量大的段落能被完整读完
        sceneDur = chars / BASE_CHARS_PER_SEC * 1.15 + PAUSE_SEC;
      } else {
        // 短/中等分镜：按基础语速走，不额外注水，短句就应该很快切过去
        sceneDur = chars / BASE_CHARS_PER_SEC + PAUSE_SEC;
      }
      sceneDur = Math.max(MIN_SCENE_SEC, Math.round(sceneDur));
      cursor += sceneDur;
    });
    const newDuration = formatSec(cursor);
    post.duration = newDuration;
    detail._computedDuration = newDuration;
  }

  // 字数不够时的补偿重试：明确告诉模型上次写少了多少字，要求这次务必写够。
  // 同时把 max_tokens 按照"还需要补多少字"重新估算得更宽裕一些，
  // 避免重试的这一次又因为 token 预算不够而在同样的地方被截断。
  async function retryGenerateVideoDetailForLength(post, world, baseUrl, apiKey, model, prevChars, minChars) {
    try {
      const prompt = buildDetailPrompt(post, world) + `

【重要提醒】你上一次生成的正文总字数只有约 ${prevChars} 字，远低于这条视频时长所需要的至少 ${minChars} 字，这一次必须严格达到这个字数要求，通过增加分镜数量、丰富每个分镜的细节描写和对话内容来实现，不要再写得过于简短。`;
      const retryMaxTokens = estimateMaxTokens(Math.round(minChars * 1.15)); // 重试给更宽松一点的预算
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你是一个严格按照要求输出 JSON 的内容生成引擎，只输出 JSON 对象本身，不输出任何多余文字或代码块标记。' },
            { role: 'user', content: prompt }
          ],
          temperature: 1.0,
          max_tokens: retryMaxTokens
        })
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const raw = data.choices?.[0]?.message?.content || '';
      let detail = safeParseJsonObject(raw);
      if (!detail || !detail.scenes || !detail.scenes.length) {
        detail = salvageTruncatedDetail(raw); // 重试这次万一还是被截断，同样尝试抢救已完整的部分
      }
      if (!detail || !detail.scenes || !detail.scenes.length) return null;
      detail.scenes = detail.scenes.map(s => normalizeScene(s, post.author));
      detail.danmu = Array.isArray(detail.danmu) ? detail.danmu.filter(Boolean) : [];
      detail.comments = Array.isArray(detail.comments) ? detail.comments.map(normalizeComment) : [];
      return detail;
    } catch (e) {
      return null; // 重试失败就沿用第一次的结果，不阻塞用户
    }
  }

  // 分镜字段防御：line 有内容但没给 speaker 时，默认算作主角说的（而不是留空导致署名丢失）
  function normalizeScene(s, authorName) {
    const line = s.line || '';
    let speaker = (s.speaker || '').trim();
    if (line && !speaker) speaker = authorName || '';
    return { time: s.time || '00:00', narration: s.narration || '', line, speaker };
  }

  // 评论字段防御：补齐 otherReplies（路人接话）数组，兼容旧数据里没有这个字段的情况
  function normalizeComment(c) {
    return {
      name: c.name || '路人',
      text: c.text || '',
      authorReplied: !!c.authorReplied,
      authorReply: c.authorReply || '',
      otherReplies: Array.isArray(c.otherReplies)
        ? c.otherReplies.filter(r => r && r.text).map(r => ({ name: r.name || '路人', text: r.text || '' }))
        : []
    };
  }

  // ---- 换一批弹幕/评论：完全不涉及正片分镜，只追加新的弹幕和评论 ----
  async function generateMoreVideoDetail(post, world, existingDetail) {
    const { baseUrl, apiKey, model } = getApiConfig();
    if (!baseUrl || !apiKey || !model) {
      throw new Error('请先在"设置 → AI 接口"里配置好接口地址 / 密钥并选择模型');
    }
    const prompt = buildContinuePrompt(post, world, existingDetail);
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: '你是一个严格按照要求输出 JSON 的内容生成引擎，只输出 JSON 对象本身，不输出任何多余文字或代码块标记。' },
          { role: 'user', content: prompt }
        ],
        temperature: 1.0,
        max_tokens: 1400
      })
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content || '';
    const more = safeParseJsonObject(raw);
    if (!more || (!more.danmu && !more.comments)) throw new Error('AI 返回内容无法解析，请重试');

    more.danmu = Array.isArray(more.danmu) ? more.danmu.filter(Boolean) : [];
    more.comments = Array.isArray(more.comments) ? more.comments.map(normalizeComment) : [];
    return more;
  }

  function safeParseJsonObject(raw) {
    if (!raw) return null;
    let text = String(raw).trim();
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) return null;
    text = text.slice(start, end + 1);
    try {
      const data = JSON.parse(text);
      return (data && typeof data === 'object') ? data : null;
    } catch (e) { return null; }
  }

  // AI 不可用/失败时的兜底内容，保证详情页始终"看得下去"
  function buildFallbackDetail(post, errMsg) {
    return {
      scenes: [
        { time: '00:00', narration: `镜头缓缓拉近，${post.author}的表情里带着一点日常的松弛感。`, line: post.caption || '', speaker: post.caption ? post.author : '' },
        { time: '00:12', narration: '光线从窗边斜切进来，气氛安静下来，只有细碎的环境声。', line: post.desc || '', speaker: post.desc ? post.author : '' },
        { time: '00:24', narration: '一个短暂的停顿，像是在思考什么，随后嘴角微微上扬。', line: '', speaker: '' }
      ],
      danmu: ['来啦来啦', '这个氛围绝了', '蹲更新', '这镜头感…', '好治愈', '啊啊啊啊', '救命这也太真实了', '直接心动'],
      comments: [
        { name: '路人甲', text: '这条也太有感觉了吧', authorReplied: true, authorReply: '谢谢喜欢～' },
        { name: '静静路过', text: '期待后续', authorReplied: false, authorReply: '' }
      ],
      _fallback: true,
      _fallbackReason: errMsg
    };
  }

  /* ---------------- 渲染详情页各区块 ---------------- */
  function renderVideoDetail() {
    const post = _vdCurrentPost;
    const detail = _vdDetail;
    if (!post || !detail) return;

    // 封面色块 / 标签 / 时长
    const palette = pickPalette(post.author || post.title || Math.random());
    vdStage.style.background = palette;
    document.getElementById('vdStageTag').textContent = post.tag || post.personaType || '日常';
    document.getElementById('vdStageTime').textContent = `00:00 / ${post.duration || '00:30'}`;

    // 标题 / 数据
    document.getElementById('vdTitle').textContent = post.title || '';
    document.getElementById('vdViews').textContent = `${formatCount(post.likes ? post.likes * 7 : 1200)} 播放`;
    document.getElementById('vdPubTime').textContent = post.time || '刚刚';

    // 作者
    const isReal = !!post.isRealChar;
    const letter = (post.author || '?').trim()[0] || '?';
    const ringBg = isReal && post.charColor && COLOR_MAP[post.charColor] ? COLOR_MAP[post.charColor].ring : null;
    const wrap = document.getElementById('vdAuthorAvatarWrap');
    wrap.classList.toggle('vd-author-avatar-ring', !!ringBg);
    wrap.style.background = ringBg || 'transparent';
    document.getElementById('vdAuthorAvatarInner').innerHTML = (isReal && post.charAvatar)
      ? `<img src="${escAttr(post.charAvatar)}" alt="${escAttr(post.author||'')}"/>`
      : `<div style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${palette};color:#fff;font-weight:700;">${escHtml(letter)}</div>`;
    document.getElementById('vdAuthorName').innerHTML = `${escHtml(post.author || '未知')}${isReal ? ' <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style="color:#4a90d9"><path d="M12 2l2.4 1.1 2.6-.3 1.3 2.3 2.3 1.3-.3 2.6L21.4 11l-1.1 2.4.3 2.6-2.3 1.3-1.3 2.3-2.6-.3L12 20.8l-2.4-1.1-2.6.3-1.3-2.3-2.3-1.3.3-2.6L2.6 11l1.1-2.4-.3-2.6 2.3-1.3L7 1.4l2.6.3z" fill="currentColor"/><path d="M8.5 12l2.3 2.3L15.8 9" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}`;
    document.getElementById('vdAuthorSub').textContent = post.personaType ? `${post.personaType} · ${post.tag || ''}` : (post.tag || '碎念创作者');

    // 互动数据
    document.getElementById('vdLikeCount').textContent = formatCount(post.likes || 0);
    document.getElementById('vdCommentCount').textContent = formatCount((detail.comments || []).length);

    // 分镜正片
    const scriptEl = document.getElementById('vdScript');
    scriptEl.innerHTML = (detail.scenes || []).map(s => sceneHtml(s)).join('');

    // 评论
    renderComments(detail.comments || []);

    // 延展板块状态复位（每次打开新内容都是"待生成"，功能后续接入）
    document.querySelectorAll('.vd-extra-state').forEach(el => { el.dataset.state = 'locked'; el.textContent = '待生成'; });

    // 弹幕 + 分镜滚动 + 播放进度模拟
    startDanmu(detail.danmu || []);
    startSceneCycle(detail.scenes || []);
    startProgressSim(post.duration || '00:30');
  }

  function sceneHtml(s) {
    return `
      <div class="vd-scene">
        <div class="vd-scene-marker">${escHtml(s.time || '')}</div>
        ${s.narration ? `<div class="vd-scene-narr">${escHtml(s.narration)}</div>` : ''}
        ${s.line ? `<div class="vd-scene-line"><b>${escHtml(s.speaker || '')}${s.speaker ? '：' : ''}</b>${escHtml(s.line)}</div>` : ''}
      </div>
    `;
  }

  function formatCount(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  /* ---------------- 弹幕：默认开启，多轨道飘动，暂停时不再生成/推进 ---------------- */
  function stopDanmu() {
    _vdDanmuTimers.forEach(t => clearTimeout(t));
    _vdDanmuTimers = [];
  }
  function startDanmu(list) {
    stopDanmu();
    if (vdDanmuLayer) vdDanmuLayer.innerHTML = '';
    if (!list || !list.length) return;
    if (vdDanmuLayer.classList.contains('vd-danmu-off')) return;
    const tracks = 5;
    let i = 0;
    function spawn() {
      // 暂停中：不生成新弹幕，也不推进队列，等恢复播放后从原来的位置继续
      if (!_vdPlaying) { scheduleNext(true); return; }
      if (vdDanmuLayer.classList.contains('vd-danmu-off')) { scheduleNext(false); return; }
      const text = list[i % list.length];
      const el = document.createElement('div');
      el.className = 'vd-danmu-item';
      el.textContent = text;
      const track = i % tracks;
      el.style.top = `${14 + track * (100 / (tracks + 1))}%`;
      el.style.left = '100%';
      const dur = 7 + Math.random() * 4;
      el.style.animationDuration = dur + 's';
      vdDanmuLayer.appendChild(el);
      setTimeout(() => el.remove(), dur * 1000 + 200);
      i++;
      scheduleNext(false);
    }
    function scheduleNext(retryShort) {
      const delay = retryShort ? 400 : (900 + Math.random() * 900);
      const t = setTimeout(spawn, delay);
      _vdDanmuTimers.push(t);
    }
    spawn();
  }
  // 暂停/继续时，正在飘的弹幕本身也要跟着停住/恢复（CSS animation-play-state）
  function setDanmuPlayState(playing) {
    if (!vdDanmuLayer) return;
    vdDanmuLayer.querySelectorAll('.vd-danmu-item').forEach(el => {
      el.style.animationPlayState = playing ? 'running' : 'paused';
    });
  }
  if (vdDanmuToggle) {
    vdDanmuToggle.addEventListener('click', () => {
      const on = vdDanmuToggle.classList.toggle('active');
      vdDanmuLayer.classList.toggle('vd-danmu-off', !on);
      if (on && _vdDetail) startDanmu(_vdDetail.danmu || []);
      else stopDanmu();
    });
  }

  // 用户发送评论后，把评论内容也作为一条弹幕飘过，增强"发出去就在画面里"的实时感
  function pushMineDanmu(text) {
    if (vdDanmuLayer.classList.contains('vd-danmu-off')) return;
    const el = document.createElement('div');
    el.className = 'vd-danmu-item vd-danmu-mine';
    el.textContent = text;
    el.style.top = `${20 + Math.random() * 55}%`;
    el.style.left = '100%';
    const dur = 6.5;
    el.style.animationDuration = dur + 's';
    if (!_vdPlaying) el.style.animationPlayState = 'paused';
    vdDanmuLayer.appendChild(el);
    setTimeout(() => el.remove(), dur * 1000 + 200);
  }

  /* ---------------- 旁白字幕：与播放进度精确对应（按时间戳匹配分镜），不再是固定循环 ---------------- */
  let _vdScenesRef = [];
  let _vdLastShownSceneIdx = -1;
  function stopSceneCycle() { _vdScenesRef = []; _vdLastShownSceneIdx = -1; _vdSceneIdx = 0; }
  function startSceneCycle(scenes) {
    _vdScenesRef = scenes || [];
    _vdLastShownSceneIdx = -1;
    if (_vdScenesRef.length) showSceneForTime(0);
  }
  // 根据当前播放到的秒数，找到"时间戳 <= 当前时间"里最后一个分镜，展示它的旁白/台词
  function findSceneIndexForTime(sec) {
    if (!_vdScenesRef.length) return -1;
    let idx = 0;
    for (let i = 0; i < _vdScenesRef.length; i++) {
      const t = parseDurationToSec(_vdScenesRef[i].time);
      if (t <= sec) idx = i; else break;
    }
    return idx;
  }
  function showSceneForTime(sec) {
    const idx = findSceneIndexForTime(sec);
    if (idx === -1 || idx === _vdLastShownSceneIdx) return;
    _vdLastShownSceneIdx = idx;
    const s = _vdScenesRef[idx];
    renderNarrationBlocks(s);
  }
  function renderNarrationBlocks(s) {
    const narrBlock = document.getElementById('vdNarrBlock');
    const lineBlock = document.getElementById('vdLineBlock');
    const narrText = document.getElementById('vdNarrationText');
    const lineTag = document.getElementById('vdLineTag');
    const lineText = document.getElementById('vdLineText');

    // 旁白：有就展示，没有就整块隐藏（而不是被台词顶替）
    if (s.narration) {
      narrBlock.style.display = '';
      narrText.textContent = s.narration;
      restartAnim(narrBlock);
    } else {
      narrBlock.style.display = 'none';
    }

    // 台词：有就单独展示一块，标签用真正的说话人名字（不再写死"旁白"）
    if (s.line) {
      lineBlock.style.display = '';
      lineTag.textContent = s.speaker || '台词';
      lineText.textContent = s.line;
      restartAnim(lineBlock);
    } else {
      lineBlock.style.display = 'none';
    }
  }
  function restartAnim(el) {
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
  }

  /* ---------------- 播放/暂停 + 进度条模拟（可拖动） ---------------- */
  let _vdProgressTimer = null;
  let _vdCurSec = 0;
  let _vdTotalSec = 30;
  let _vdDragging = false;
  function parseDurationToSec(d) {
    const m = /^(\d+):(\d+)$/.exec(String(d || '0:30').trim());
    if (!m) return 30;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }
  function formatSec(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function renderProgressUI() {
    const pct = _vdTotalSec ? Math.min(100, Math.max(0, (_vdCurSec / _vdTotalSec) * 100)) : 0;
    vdProgressFill.style.width = `${pct}%`;
    const thumb = document.getElementById('vdProgressThumb');
    if (thumb) thumb.style.left = `${pct}%`;
    vdStageTime.textContent = `${formatSec(_vdCurSec)} / ${formatSec(_vdTotalSec)}`;
  }
  function setCurrentTime(sec, opts) {
    _vdCurSec = Math.min(_vdTotalSec, Math.max(0, sec));
    renderProgressUI();
    showSceneForTime(_vdCurSec);
  }
  function startProgressSim(durationStr) {
    clearInterval(_vdProgressTimer);
    _vdTotalSec = parseDurationToSec(durationStr);
    _vdCurSec = 0;
    _vdPlaying = true;
    vdStage.classList.remove('vd-stage-paused');
    renderProgressUI();
    _vdProgressTimer = setInterval(() => {
      if (!_vdPlaying || _vdDragging) return;
      _vdCurSec += 1;
      if (_vdCurSec >= _vdTotalSec) {
        _vdCurSec = _vdTotalSec;
        renderProgressUI();
        showSceneForTime(_vdCurSec);
        // 播放到结尾就停住（暂停态），不再从头循环，避免"一直在重复循环"
        _vdPlaying = false;
        vdStage.classList.add('vd-stage-paused');
        return;
      }
      renderProgressUI();
      showSceneForTime(_vdCurSec);
    }, 1000);
  }
  function togglePlay() {
    // 已经播放到结尾时，点击播放视为"从头再来一遍"
    if (!_vdPlaying && _vdCurSec >= _vdTotalSec) {
      setCurrentTime(0);
    }
    _vdPlaying = !_vdPlaying;
    vdStage.classList.toggle('vd-stage-paused', !_vdPlaying);
    setDanmuPlayState(_vdPlaying);
  }
  if (vdPlayCenter) {
    vdPlayCenter.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  }
  if (vdStage) {
    vdStage.addEventListener('click', (e) => {
      if (e.target.closest('.vd-stage-btn') || e.target.closest('.vd-play-center') || e.target.closest('.vd-progress')) return;
      togglePlay();
    });
  }

  /* ---------------- 进度条拖动 ---------------- */
  const vdProgressEl = document.getElementById('vdProgress');
  if (vdProgressEl) {
    let wasPlayingBeforeDrag = true;
    function ratioFromEvent(e) {
      const rect = vdProgressEl.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
      return Math.min(1, Math.max(0, x / rect.width));
    }
    function onDragStart(e) {
      _vdDragging = true;
      wasPlayingBeforeDrag = _vdPlaying;
      vdProgressEl.classList.add('vd-progress-dragging');
      onDragMove(e);
      window.addEventListener('mousemove', onDragMove);
      window.addEventListener('mouseup', onDragEnd);
      window.addEventListener('touchmove', onDragMove, { passive: false });
      window.addEventListener('touchend', onDragEnd);
    }
    function onDragMove(e) {
      if (e.cancelable) e.preventDefault();
      const ratio = ratioFromEvent(e);
      setCurrentTime(ratio * _vdTotalSec);
    }
    function onDragEnd() {
      _vdDragging = false;
      vdProgressEl.classList.remove('vd-progress-dragging');
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragEnd);
      window.removeEventListener('touchmove', onDragMove);
      window.removeEventListener('touchend', onDragEnd);
      // 拖动结束后恢复拖动前的播放状态
      _vdPlaying = wasPlayingBeforeDrag;
      vdStage.classList.toggle('vd-stage-paused', !_vdPlaying);
      setDanmuPlayState(_vdPlaying);
    }
    vdProgressEl.addEventListener('mousedown', onDragStart);
    vdProgressEl.addEventListener('touchstart', onDragStart, { passive: true });
  }

  /* ---------------- 评论区渲染 + 交互 ---------------- */
  function renderComments(comments) {
    const list = document.getElementById('vdCommentList');
    const totalEl = document.getElementById('vdCommentTotal');
    if (!list) return;
    if (!comments.length) {
      list.innerHTML = '<div class="vd-comment-empty">还没有评论，来说第一句吧</div>';
      if (totalEl) totalEl.textContent = '0';
      return;
    }
    list.innerHTML = comments.map((c, idx) => commentItemHtml(c, idx)).join('');
    if (totalEl) totalEl.textContent = String(comments.length);
    bindCommentReplyEvents();
  }

  // 只有"我"发的评论楼层才允许继续追问（点"回复"展开输入框，发送后走 AI 生成作者的楼中楼回复）
  function bindCommentReplyEvents() {
    const list = document.getElementById('vdCommentList');
    if (!list) return;
    list.querySelectorAll('[data-reply-target]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = btn.getAttribute('data-reply-target');
        const wrap = document.getElementById(`vdReplyInputWrap-${idx}`);
        if (wrap) {
          wrap.style.display = wrap.style.display === 'none' ? 'flex' : 'none';
          const input = document.getElementById(`vdReplyInput-${idx}`);
          if (input && wrap.style.display !== 'none') input.focus();
        }
      });
    });
    list.querySelectorAll('[data-reply-send]').forEach(btn => {
      btn.addEventListener('click', () => handleSendThreadReply(btn.getAttribute('data-reply-send')));
    });
    list.querySelectorAll('.vd-comment-reply-input').forEach(input => {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const idx = input.id.replace('vdReplyInput-', '');
          handleSendThreadReply(idx);
        }
      });
    });
  }

  function avatarBlockHtml(name, ring, isMine) {
    // "我"的头像固定展示为"我"字+固定色，不受 name 字段内容影响，避免历史数据里名字/称呼不一致导致头像显示错乱
    if (isMine) {
      return `
      <div class="vd-comment-avatar-wrap">
        <div class="vd-comment-avatar-inner" style="background:var(--sn-accent, #4a90d9)">我</div>
      </div>`;
    }
    const letter = (name || '?').trim()[0] || '?';
    const palette = pickPalette(name);
    return `
      <div class="vd-comment-avatar-wrap" style="${ring ? `background:${ring}` : ''}">
        <div class="vd-comment-avatar-inner" style="background:${ring ? 'var(--sn-surface)' : palette}">${ring ? '' : escHtml(letter)}</div>
      </div>`;
  }

  function commentItemHtml(c, idx) {
    const isMine = !!c.isMine;
    const replies = [];
    if (c.authorReplied && c.authorReply) {
      const post = _vdCurrentPost || {};
      const ring = post.isRealChar && post.charColor && COLOR_MAP[post.charColor] ? COLOR_MAP[post.charColor].ring : null;
      replies.push(`
        <div class="vd-comment-reply">
          ${avatarBlockHtml(post.author, ring)}
          <div class="vd-comment-body">
            <div class="vd-comment-row1">
              <span class="vd-comment-name vd-comment-author">${escHtml(post.author || '作者')}</span>
              <span class="vd-comment-badge">作者</span>
            </div>
            <div class="vd-comment-text">${escHtml(c.authorReply)}</div>
          </div>
        </div>
      `);
    }
    // 其他路人网友的接话/附和，让评论区不止有"作者单独回一句"这一种互动
    (c.otherReplies || []).forEach(r => {
      replies.push(`
        <div class="vd-comment-reply">
          ${avatarBlockHtml(r.name)}
          <div class="vd-comment-body">
            <div class="vd-comment-row1">
              <span class="vd-comment-name">${escHtml(r.name || '路人')}</span>
            </div>
            <div class="vd-comment-text">${escHtml(r.text || '')}</div>
          </div>
        </div>
      `);
    });
    // 用户自己追加的楼中楼追问（本地维护，见 myThreadReplies）
    (c.myThreadReplies || []).forEach(t => {
      replies.push(`
        <div class="vd-comment-reply vd-comment-reply-mine">
          ${avatarBlockHtml('我', null, true)}
          <div class="vd-comment-body">
            <div class="vd-comment-row1">
              <span class="vd-comment-name">我</span>
              <span class="vd-comment-badge vd-comment-badge-user">我</span>
            </div>
            <div class="vd-comment-text">${escHtml(t.text || '')}</div>
          </div>
        </div>
      `);
      if (t.authorReply) {
        const post = _vdCurrentPost || {};
        replies.push(`
          <div class="vd-comment-reply">
            ${avatarBlockHtml(post.author)}
            <div class="vd-comment-body">
              <div class="vd-comment-row1">
                <span class="vd-comment-name vd-comment-author">${escHtml(post.author || '作者')}</span>
                <span class="vd-comment-badge">作者</span>
              </div>
              <div class="vd-comment-text">${escHtml(t.authorReply)}</div>
            </div>
          </div>
        `);
      }
    });
    return `
      <div class="vd-comment-item" data-comment-idx="${idx}">
        ${avatarBlockHtml(c.name, null, isMine)}
        <div class="vd-comment-body">
          <div class="vd-comment-row1">
            <span class="vd-comment-name">${escHtml(c.name || '路人')}</span>
            ${isMine ? '<span class="vd-comment-badge vd-comment-badge-user">我</span>' : ''}
            <span class="vd-comment-time">${escHtml(c.time || '刚刚')}</span>
          </div>
          <div class="vd-comment-text">${escHtml(c.text || '')}</div>
          <div class="vd-comment-foot">
            <span class="vd-comment-like">
              <svg viewBox="0 0 24 24" fill="none"><path d="M12 21s-7-4.35-9.5-8.5C1 9 2.5 5.5 6 5c2-.15 3.5 1 4 2.4C10.5 6 12 4.85 14 5c3.5.5 5 4 3.5 7.5C15 17.65 12 21 12 21z" stroke="currentColor" stroke-width="1.4"/></svg>
              ${c.likes || Math.floor(Math.random()*40)}
            </span>
            <span class="vd-comment-reply-btn" data-reply-target="${idx}">回复</span>
          </div>
          ${replies.length ? `<div class="vd-comment-replies">${replies.join('')}</div>` : ''}
          ${isMine ? `<div class="vd-comment-reply-input-wrap" id="vdReplyInputWrap-${idx}" style="display:none;">
            <input class="vd-comment-reply-input" id="vdReplyInput-${idx}" type="text" placeholder="继续追问…" maxlength="120"/>
            <button class="vd-comment-reply-send" data-reply-send="${idx}">发送</button>
          </div>` : ''}
        </div>
      </div>
    `;
  }

  // 提取正文里 @提到 的名字，判断是否命中"真实角色"（当前视频的作者）——命中则必须回复且不能OOC
  function mentionsAuthor(text, authorName) {
    if (!authorName) return false;
    const t = String(text);
    return t.includes('@' + authorName) || t.includes(authorName);
  }

  // 博主人设化的"简易本地回复"兜底（无AI接口时也能有基本互动），
  // 真正贴合人设、不OOC的回复优先走 AI 生成；这里仅作为网络失败时的兜底占位。
  function localFallbackReply(post) {
    const bank = ['谢谢～', '哈哈是这样的', '嗯嗯在的在的', '被发现了(笑)', '会有后续的', '谢谢喜欢这条内容'];
    return bank[Math.floor(Math.random() * bank.length)];
  }

  async function generateAuthorReply(post, commentText, isMentioned, threadHistory) {
    const { baseUrl, apiKey, model } = getApiConfig();
    if (!baseUrl || !apiKey || !model) return null;
    const world = _vdWorldCache;
    const charLock = post.isRealChar
      ? `"${post.author}"是一个已经存在的真实角色，你的回复必须严格贴合这个角色一贯的性格与说话方式，绝对不能OOC（不能表现出与人设矛盾的言行、语气、态度）。人设参考：${post.personaType || ''}；正文口吻参考：${post.desc || ''}。`
      : `"${post.author}"是这条内容里的人设（类型：${post.personaType || '未指定'}），回复要贴合这个人设的口吻。`;
    const mentionRule = isMentioned
      ? '这条评论里提到了作者本人（@或提及了名字），身为作者，你必须回复这一条，不能忽略。'
      : '这是一条普通评论，作为作者可以选择回复或不回复，但既然要生成，请给一条自然、简短、符合人设的回复。';
    // 楼中楼场景：把之前这一楼的对话历史给到模型，保证追问能接得上上下文，而不是断片式的回答
    const historyBlock = (threadHistory && threadHistory.length)
      ? `\n【这一楼之前的对话，按时间顺序】\n${threadHistory.map(h => `${h.role === 'user' ? '网友' : post.author}：${h.text}`).join('\n')}\n用户刚刚在这一楼继续追问了一句，你需要接着上面的对话往下回，不要重复之前说过的话，要像真实连续聊天一样自然衔接。`
      : '';

    const prompt = `你正在扮演"${post.author}"，为你发布的一条内容下方的一条评论撰写回复。
【视频标题】${post.title}
【世界观氛围】${world ? (world.desc || buildWorldBrief(world)) : '（未设定）'}
${charLock}
${mentionRule}
【网友评论原文】${commentText}${historyBlock}

只输出这条回复的正文文本，不要加引号、不要加"回复："之类的前缀，不要输出任何解释，控制在 2~40 字之间，语气要像真实社交平台下的随手回复，不要客套官方腔。`;

    try {
      const resp = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你严格按照要求，只输出纯文本回复正文，不加任何多余符号或说明。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.95,
          max_tokens: 120
        })
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const text = (data.choices?.[0]?.message?.content || '').trim();
      return text || null;
    } catch (e) { return null; }
  }

  function appendCommentToDetailAndPersist(comment) {
    if (!_vdDetail) return;
    _vdDetail.comments = _vdDetail.comments || [];
    _vdDetail.comments.unshift(comment);
    if (_vdCurrentPost && _vdCurrentPost.id != null) {
      _vdCurrentPost.vdDetail = _vdDetail;
      updatePost(_vdCurrentPost);
    }
  }

  async function handleSendComment() {
    if (!vdCommentInput) return;
    const text = vdCommentInput.value.trim();
    if (!text || !_vdCurrentPost || !_vdDetail) return;
    vdCommentInput.value = '';

    const myComment = { name: '我', text, isMine: true, time: '刚刚', likes: 0, authorReplied: false, authorReply: '', myThreadReplies: [] };
    appendCommentToDetailAndPersist(myComment);
    renderComments(_vdDetail.comments);
    pushMineDanmu(text);

    const post = _vdCurrentPost;
    const isMentioned = mentionsAuthor(text, post.author);

    // 真实角色：必须回复。现编人设：提高基础回复概率，保证评论区互动感（原来0.7偏低导致"只有作者回复"的感觉都很难触发）。
    const shouldReply = isMentioned ? true : Math.random() < 0.9;
    if (!shouldReply) return;

    // 展示"正在输入"占位
    const list = document.getElementById('vdCommentList');
    const typingEl = document.createElement('div');
    typingEl.className = 'vd-comment-typing';
    typingEl.innerHTML = '<i></i><i></i><i></i>';
    const firstItem = list.firstElementChild;
    if (firstItem) {
      const body = firstItem.querySelector('.vd-comment-body');
      if (body) body.appendChild(typingEl);
    }

    let reply = await generateAuthorReply(post, text, isMentioned);
    if (!reply) reply = localFallbackReply(post);

    myComment.authorReplied = true;
    myComment.authorReply = reply;
    if (post.id != null) { post.vdDetail = _vdDetail; await updatePost(post); }
    renderComments(_vdDetail.comments);
  }

  // 楼中楼继续追问：只对"我"发的评论楼层生效，追问会带上这一楼之前的完整对话历史，
  // 让作者的回复能连续接话，而不是每次都当成孤立的一句话来回应。
  async function handleSendThreadReply(idxStr) {
    const idx = parseInt(idxStr, 10);
    if (Number.isNaN(idx) || !_vdDetail || !_vdDetail.comments || !_vdDetail.comments[idx]) return;
    const comment = _vdDetail.comments[idx];
    const input = document.getElementById(`vdReplyInput-${idx}`);
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    input.value = '';

    comment.myThreadReplies = comment.myThreadReplies || [];
    comment.myThreadReplies.push({ text, authorReply: '' });
    renderComments(_vdDetail.comments);

    const post = _vdCurrentPost;
    const isMentioned = mentionsAuthor(text, post.author);

    // 拼出这一楼到目前为止的完整对话历史（原评论 -> 作者首次回复 -> 之前每一轮追问与回复）
    const history = [];
    history.push({ role: 'user', text: comment.text });
    if (comment.authorReply) history.push({ role: 'author', text: comment.authorReply });
    comment.myThreadReplies.slice(0, -1).forEach(t => {
      history.push({ role: 'user', text: t.text });
      if (t.authorReply) history.push({ role: 'author', text: t.authorReply });
    });

    let reply = await generateAuthorReply(post, text, isMentioned, history);
    if (!reply) reply = localFallbackReply(post);

    comment.myThreadReplies[comment.myThreadReplies.length - 1].authorReply = reply;
    if (post.id != null) { post.vdDetail = _vdDetail; await updatePost(post); }
    renderComments(_vdDetail.comments);
  }

  if (vdCommentSend) vdCommentSend.addEventListener('click', handleSendComment);
  if (vdCommentInput) vdCommentInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSendComment(); });
  if (vdCommentJumpBtn) {
    vdCommentJumpBtn.addEventListener('click', () => {
      const sec = document.getElementById('vdCommentSection');
      if (sec && vdBody) vdBody.scrollTo({ top: sec.offsetTop - 10, behavior: 'smooth' });
    });
  }

  /* ---------------- 互动按钮：赞 / 收藏（本地状态，纯前端反馈） ---------------- */
  const vdLikeBtn = document.getElementById('vdLikeBtn');
  if (vdLikeBtn) {
    vdLikeBtn.addEventListener('click', () => {
      const active = vdLikeBtn.classList.toggle('vd-action-active');
      const countEl = document.getElementById('vdLikeCount');
      const base = _vdCurrentPost ? (_vdCurrentPost.likes || 0) : 0;
      countEl.textContent = formatCount(active ? base + 1 : base);
    });
  }
  const vdFavBtn = document.getElementById('vdFavBtn');
  if (vdFavBtn) vdFavBtn.addEventListener('click', () => vdFavBtn.classList.toggle('vd-action-active'));
  const vdFollowBtn = document.getElementById('vdFollowBtn');
  if (vdFollowBtn) {
    vdFollowBtn.addEventListener('click', () => {
      const followed = vdFollowBtn.classList.toggle('vd-followed');
      vdFollowBtn.textContent = followed ? '已关注' : '关注';
    });
  }

  /* ---------------- "换一批"：只追加新的弹幕和评论，正片分镜/旁白完全不动 ---------------- */
  const vdMoreScriptBtn = document.getElementById('vdMoreScriptBtn');
  function setMoreScriptLoading(loading) {
    if (!vdMoreScriptBtn) return;
    vdMoreScriptBtn.classList.toggle('vd-more-loading', loading);
    const txt = document.getElementById('vdMoreScriptBtnText');
    if (txt) txt.textContent = loading ? '生成中' : '换一批';
  }
  if (vdMoreScriptBtn) {
    vdMoreScriptBtn.addEventListener('click', async () => {
      if (!_vdCurrentPost || !_vdDetail) return;
      if (vdMoreScriptBtn.classList.contains('vd-more-loading')) return;
      setMoreScriptLoading(true);
      try {
        const world = _vdWorldCache || (_vdWorldCache = await getActiveWorldData());
        const more = await generateMoreVideoDetail(_vdCurrentPost, world, _vdDetail);

        // 正片分镜/旁白完全不动，只把新弹幕、新评论追加到已有数据里，一起持久化
        _vdDetail.danmu = (_vdDetail.danmu || []).concat(more.danmu);
        _vdDetail.comments = (more.comments || []).concat(_vdDetail.comments || []);

        renderComments(_vdDetail.comments);
        document.getElementById('vdCommentCount').textContent = formatCount(_vdDetail.comments.length);
        startDanmu(_vdDetail.danmu);
        setDanmuPlayState(_vdPlaying);

        if (_vdCurrentPost.id != null) {
          _vdCurrentPost.vdDetail = _vdDetail;
          await updatePost(_vdCurrentPost);
        }
        showToast(`已生成 ${more.danmu.length} 条新弹幕 / ${more.comments.length} 条新评论`);
      } catch (e) {
        showToast('生成失败：' + (e && e.message ? e.message : '请重试'));
      } finally {
        setMoreScriptLoading(false);
      }
    });
  }

  /* ---------------- 延展板块：彩蛋/花絮/分支/内心OS/其他视角
     本期仅做功能卡片占位与交互反馈，生成逻辑后续接入 ---------------- */
  const EXTRA_LABELS = {
    egg: '彩蛋', bts: '花絮', branch: '分支', innermind: '内心OS', otherview: '其他视角'
  };
  document.querySelectorAll('.vd-extra-card').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.dataset.extra;
      const label = EXTRA_LABELS[key] || '该板块';
      showToast(`「${label}」生成功能即将上线，敬请期待`);
    });
  });

})();