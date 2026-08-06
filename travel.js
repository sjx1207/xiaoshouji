(function () {
  'use strict';

  /* ============ 状态栏：时间 / 电量 同步（主屏 + Char 系统专属状态栏，双份同步不脱节） ============ */
  function updateStatusTime() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, '0');
    const text = h + ':' + m;
    ['statusTime', 'cfStatusTime'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    });
  }
  updateStatusTime();
  setInterval(updateStatusTime, 1000 * 15);

  function syncBattery() {
    let pct = 76;
    try {
      const stored = window.localStorage.getItem('luna_battery_pct');
      if (stored && !isNaN(parseInt(stored, 10))) pct = parseInt(stored, 10);
    } catch (e) {}
    [['batPct', 'batInner'], ['cfBatPct', 'cfBatInner']].forEach(([pctId, innerId]) => {
      const pctEl = document.getElementById(pctId);
      const innerEl = document.getElementById(innerId);
      if (pctEl) pctEl.textContent = pct;
      if (innerEl) innerEl.style.width = pct + '%';
    });
  }
  syncBattery();
  setInterval(syncBattery, 1000 * 20);

  /* ============================================================
     数据层：行程 / 每日安排 / 待办清单
     结构：
     trips: [{
       id, owner: 'mine' | 'char', name, color,
       startDate: 'YYYY-MM-DD', endDate: 'YYYY-MM-DD', status,
       days: {
         'YYYY-MM-DD': {
           items: [{ id, time, title, loc, note, cat }],
           todos: [{ id, text, done, priority }]
         }
       }
     }]
     ============================================================ */
  const STORAGE_KEY = 'luna_itinerary_data_v1';
  const CARD_COLORS = ['#6fe3c8', '#7bc4f0', '#ff9fb0', '#ffcf86'];

  /* ============================================================
     IndexedDB 存储层：本地"数据库"
     用于持久化：行程数据（迁移自 localStorage）+ 用户自定义背景素材（图片/视频，体积大，localStorage 存不下）
     注意：这仍是浏览器本地存储，不是云端/服务器数据库，
     换设备、换浏览器、清除网站数据依然会丢失 —— 这是纯前端方案的物理限制。
     ============================================================ */
  const IDB_NAME = 'luna_app_db';
  const IDB_VERSION = 1;
  const IDB_STORE_KV = 'kv';       // 通用键值：行程数据、当前主题选择等
  const IDB_STORE_MEDIA = 'media'; // 用户上传的背景媒体文件（Blob，不限制大小）

  let idbPromise = null;
  function openIDB() {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('indexedDB not supported')); return; }
      const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(IDB_STORE_KV)) {
          db.createObjectStore(IDB_STORE_KV);
        }
        if (!db.objectStoreNames.contains(IDB_STORE_MEDIA)) {
          db.createObjectStore(IDB_STORE_MEDIA);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return idbPromise;
  }

  function idbGet(storeName, key) {
    return openIDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result !== undefined ? req.result : null);
      req.onerror = () => reject(req.error);
    }));
  }

  function idbSet(storeName, key, value) {
    return openIDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    }));
  }

  function idbDelete(storeName, key) {
    return openIDB().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    }));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  function pad2(n) { return String(n).padStart(2, '0'); }

  function toISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function todayISO() { return toISO(new Date()); }

  function addDaysISO(iso, n) {
    const d = new Date(iso + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return toISO(d);
  }

  function dateRangeList(startISO, endISO) {
    const out = [];
    let cur = startISO;
    let guard = 0;
    while (cur <= endISO && guard < 60) {
      out.push(cur);
      cur = addDaysISO(cur, 1);
      guard++;
    }
    return out;
  }

  function fmtRangeCN(startISO, endISO) {
    const s = startISO.split('-'), e = endISO.split('-');
    if (s[0] === e[0]) {
      return s[0] + '.' + s[1] + '.' + s[2] + ' – ' + (s[1] === e[1] ? '' : e[1] + '.') + e[2];
    }
    return s[0] + '.' + s[1] + '.' + s[2] + ' – ' + e[0] + '.' + e[1] + '.' + e[2];
  }

  function tripStatus(trip) {
    const t = todayISO();
    if (t < trip.startDate) return 'upcoming';
    if (t > trip.endDate) return 'done';
    return 'ongoing';
  }

  function statusLabel(s) {
    return { upcoming: '筹备中', ongoing: '进行中', done: '已完成' }[s] || '筹备中';
  }

  function emptyDay() { return { items: [], todos: [] }; }

  function ensureDay(trip, iso) {
    if (!trip.days[iso]) trip.days[iso] = emptyDay();
    return trip.days[iso];
  }


  /* 同步初始渲染用：先用 localStorage 里的旧数据（如果有）把界面跑起来，没有就是空列表——
     不再使用任何写死的示例行程。随后异步从 IndexedDB 读取真正持久化的数据，读到就覆盖重渲染。 */
  function loadDataSyncFallback() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.trips)) return parsed;
      }
    } catch (e) {}
    return { trips: [] };
  }

  function persist(data) {
    // 双写：localStorage 作为同步兜底（容量小，仅存行程数据本身，不含媒体），
    // IndexedDB 作为主存储（容量大，跨刷新稳定持久化）
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
    idbSet(IDB_STORE_KV, STORAGE_KEY, data).catch(() => {});
  }

  let DATA = loadDataSyncFallback();

  /* 启动时异步从 IndexedDB 拉取权威数据；若 IndexedDB 里还没有记录（真正首次使用），
     写入一个空的 trips 列表完成"初始化"，绝不写入任何示例/假数据。 */
  function hydrateFromIDB() {
    idbGet(IDB_STORE_KV, STORAGE_KEY).then((stored) => {
      if (stored && Array.isArray(stored.trips)) {
        DATA = stored;
      } else {
        idbSet(IDB_STORE_KV, STORAGE_KEY, DATA).catch(() => {});
      }
      renderHeaderForTab();
      renderMineView();
      renderCharView();
      if (state.detailTripId) {
        const trip = getTrip(state.detailTripId);
        if (trip) { renderDayTabs(trip); renderDayBoard(trip); }
      }
    }).catch(() => {
      // IndexedDB 不可用（极少数环境），继续使用 localStorage/种子数据，功能不受影响
    });
  }

  /* ============================================================
     应用状态
     ============================================================ */
  const state = {
    activeTab: 'mine',          // mine | char （对应底部导航）
    mineSubView: 'list',        // list | calendar
    calMonthCursor: todayISO().slice(0, 7), // 'YYYY-MM'
    calSelectedDate: null,
    detailTripId: null,
    detailSelectedDate: null,
    detailSubView: 'day',       // day | week | month（行程详情页内部视图）
    detailMonthCursor: null,    // 'YYYY-MM'，月览视图当前查看的月份
    detailReturnPanel: null,    // 从行程详情页返回时应回到哪个面板：'mine' | 'char' | 'charTrips'
    activeCharId: null,         // 当前正在查看的角色档案 id（LunaCharDB 主键）
    sheetMode: null,            // 'trip' | 'item' | 'todo'
    sheetEditingId: null,
    sheetColor: CARD_COLORS[0],
    sheetCat: 'sight'
  };

  function getTrip(id) { return DATA.trips.find((t) => t.id === id); }
  function tripsByOwner(owner) { return DATA.trips.filter((t) => t.owner === owner); }

  /* ============================================================
     顶部页头：随层级切换
     ============================================================ */
  const appHeader = document.getElementById('appHeader');
  const headerTitle = document.getElementById('headerTitle');
  const headerEyebrow = document.getElementById('headerEyebrow');
  const headerSub = document.getElementById('headerSub');
  const headerBackBtn = document.getElementById('headerBackBtn');
  const statTripCount = document.getElementById('statTripCount');
  const statDayCount = document.getElementById('statDayCount');
  const tripMetaRange = document.getElementById('tripMetaRange');
  const tripMetaBadge = document.getElementById('tripMetaBadge');

  const TAB_TITLES = { mine: '我的行程', char: 'Char 行程' };
  const TAB_SUBS = { mine: '记录每一段旅途的心动瞬间', char: '一起规划，一起出发' };
  const TAB_EYEBROWS = { mine: 'Itinerary Book', char: "Char's Journeys" };

  function totalOpenTodos(owner) {
    let n = 0;
    tripsByOwner(owner).forEach((trip) => {
      Object.values(trip.days).forEach((d) => {
        d.todos.forEach((td) => { if (!td.done) n++; });
      });
    });
    return n;
  }

  function renderHeaderForTab() {
    headerTitle.textContent = TAB_TITLES[state.activeTab];
    headerSub.textContent = TAB_SUBS[state.activeTab];
    headerEyebrow.textContent = TAB_EYEBROWS[state.activeTab];
    statTripCount.textContent = tripsByOwner(state.activeTab).length;
    statDayCount.textContent = totalOpenTodos(state.activeTab);
  }

  function enterDetailHeader(trip) {
    appHeader.classList.add('is-detail');
    headerTitle.textContent = trip.name;
    headerSub.textContent = '';
    tripMetaRange.textContent = fmtRangeCN(trip.startDate, trip.endDate);
    const s = tripStatus(trip);
    tripMetaBadge.textContent = statusLabel(s);
    tripMetaBadge.className = 'trip-meta-badge' + (s === 'ongoing' ? ' is-ongoing' : s === 'done' ? ' is-done' : '');
  }

  function exitDetailHeader() {
    appHeader.classList.remove('is-detail');
    renderHeaderForTab();
  }

  /* ============================================================
     底部导航：果冻胶囊扭转切换 + 粒子爆发反馈（原有逻辑，保持不动）
     ============================================================ */
  const nav = document.getElementById('insNav');
  const pill = document.getElementById('navPill');
  const items = Array.from(nav.querySelectorAll('.ins-nav-item'));
  const navPanels = [
    document.querySelector('.panel[data-panel="mine"]'),
    document.querySelector('.panel[data-panel="char"]')
  ];
  const detailPanel = document.querySelector('.panel[data-panel="detail"]');

  function movePill(index, animate) {
    const shiftPercent = index * 100;
    if (!animate) pill.style.transition = 'none';
    pill.style.setProperty('--pillX', shiftPercent + '%');
    pill.style.transform = 'translateX(' + shiftPercent + '%)';
    if (!animate) {
      void pill.offsetWidth;
      pill.style.transition = '';
    }
  }

  function twistPill() {
    pill.classList.remove('is-twisting');
    void pill.offsetWidth;
    pill.classList.add('is-twisting');
  }

  function burstSparkle(el) {
    const sparkle = el.querySelector('.ins-nav-sparkle');
    if (!sparkle) return;
    sparkle.classList.remove('is-bursting');
    void sparkle.offsetWidth;
    sparkle.classList.add('is-bursting');
  }

  function showPanel(target) {
    document.querySelectorAll('.panel').forEach((p) => {
      p.classList.toggle('is-active', p.dataset.panel === target);
    });
    if (target !== 'charTrips') exitCharProfileVisual();
    lunaFrameEl.classList.toggle('is-char-wall', target === 'char');
    lunaFrameEl.classList.toggle('tab-mine', target === 'mine');
  }

  function activateTab(target, index, sourceEl) {
    items.forEach((it) => it.classList.toggle('is-active', it === sourceEl));
    state.activeTab = target;
    state.activeCharId = null;
    showPanel(target);

    movePill(index, true);
    twistPill();
    burstSparkle(sourceEl);

    exitDetailHeader();
    setTimeout(() => { renderHeaderForTab(); }, 0);

    if (navigator.vibrate) {
      try { navigator.vibrate(6); } catch (e) {}
    }

    renderMineView();
    renderCharView();
  }

  items.forEach((item, index) => {
    item.addEventListener('click', () => {
      if (item.classList.contains('is-active') && !appHeader.classList.contains('is-detail')) return;
      activateTab(item.dataset.target, index, item);
    });
  });

  window.requestAnimationFrame(() => {
    const activeIndex = items.findIndex((it) => it.classList.contains('is-active'));
    movePill(activeIndex >= 0 ? activeIndex : 0, false);
  });

  /* ============================================================
     行程详情页 进入 / 返回
     行程详情页对"我的行程"和"角色行程"通用；
     返回时需要知道是从哪一层进来的（列表 tab 本身，还是某个角色的档案页），
     用 state.detailReturnPanel 记录，返回时精确回到原处。
     ============================================================ */
  function openTripDetail(tripId, returnPanel) {
    const trip = getTrip(tripId);
    if (!trip) return;
    state.detailTripId = tripId;
    state.detailReturnPanel = returnPanel || state.activeTab;
    const dates = dateRangeList(trip.startDate, trip.endDate);
    const t = todayISO();
    state.detailSelectedDate = dates.includes(t) ? t : dates[0];
    state.detailSubView = 'day';
    state.detailMonthCursor = (state.detailSelectedDate || trip.startDate).slice(0, 7);

    showPanel('detail');
    enterDetailHeader(trip);
    setDetailSubView('day');
    renderDayTabs(trip);
    renderDayBoard(trip);
  }

  function closeTripDetail() {
    state.detailTripId = null;
    const target = state.detailReturnPanel || state.activeTab;
    state.detailReturnPanel = null;
    if (target === 'charTrips' && state.activeCharId) {
      showPanel('charTrips');
      exitDetailHeader();
      enterCharProfileVisual();
      renderCharProfileHeader();
      renderCharTripList();
    } else {
      showPanel(state.activeTab);
      exitDetailHeader();
    }
  }

  headerBackBtn.addEventListener('click', closeTripDetail);

  /* 返回首页：跳转到应用外层的 index.html（角色/首页入口） */
  const headerHomeBtn = document.getElementById('headerHomeBtn');
  headerHomeBtn.addEventListener('click', () => {
    window.location.href = 'index.html';
  });

  /* ============================================================
     渲染：行程卡片列表
     ============================================================ */
  const tripCardList = document.getElementById('tripCardList');

  function buildTripCard(trip) {
    const s = tripStatus(trip);
    const dates = dateRangeList(trip.startDate, trip.endDate);
    let doneItems = 0, totalItems = 0;
    dates.forEach((iso) => {
      const day = trip.days[iso];
      if (!day) return;
      totalItems += day.todos.length;
      doneItems += day.todos.filter((td) => td.done).length;
    });
    const pct = totalItems ? Math.round((doneItems / totalItems) * 100) : (s === 'done' ? 100 : 0);

    const card = document.createElement('div');
    card.className = 'trip-card';
    card.style.setProperty('--card-accent', trip.color || CARD_COLORS[0]);
    card.innerHTML =
      '<div class="trip-card-topline">' +
        '<span class="trip-card-name">' + escapeHTML(trip.name) + '</span>' +
        '<span class="trip-card-status' + (s === 'ongoing' ? ' is-ongoing' : s === 'done' ? ' is-done' : '') + '">' + statusLabel(s) + '</span>' +
      '</div>' +
      '<div class="trip-card-dates">' + fmtRangeCN(trip.startDate, trip.endDate) + '</div>' +
      '<div class="trip-card-footline">' +
        '<div class="trip-card-progress">' +
          '<div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="progress-label">' + pct + '%</span>' +
        '</div>' +
        '<span class="trip-card-days-chip">' + dates.length + ' 天</span>' +
      '</div>';
    card.addEventListener('click', () => openTripDetail(trip.id));
    return card;
  }

  function renderMineView() {
    if (state.activeTab !== 'mine') return;
    tripCardList.innerHTML = '';
    const trips = tripsByOwner('mine').slice().sort((a, b) => a.startDate < b.startDate ? -1 : 1);
    if (!trips.length) {
      tripCardList.innerHTML = '<p class="todo-empty">还没有行程，点击下方新建一段吧</p>';
    } else {
      trips.forEach((t) => tripCardList.appendChild(buildTripCard(t)));
    }
    renderHeaderForTab();
    if (state.mineSubView === 'calendar') renderCalendar();
  }

  function renderCharView() {
    if (state.activeTab !== 'char') return;
    renderHeaderForTab();
    renderCharRoster();
  }

  /* ============================================================
     ══════════════════════════════════════════════════════════
     Char 行程系统
     · 角色数据直接读取 characters.html 所用的 LunaCharDB（IndexedDB）
       字段对齐 characters.js 的 saveCard()：
       name, role, desc, avatar, color, traits, likes, dislikes,
       speechStyle, catchphrases, backstory, scenario, prompt …
     · 每个角色的"行程"是 DATA.trips 中 owner==='char' 且 charId 匹配的子集
     · 每个角色拥有独立持久化的档案背景（IndexedDB media store，key 按 charId 区分）
     · AI 生成：读取本机已配置的 API（luna_api_current / luna_api_model，
       与"设置-模型 API"页共用同一份配置），以角色人设拼系统提示词，
       要求模型仅输出 JSON 结构的行程数据，解析后写入 DATA
     ══════════════════════════════════════════════════════════
     ============================================================ */
  const CHAR_DB_NAME = 'LunaCharDB';
  let _charDbPromise = null;

  function openCharDBReadOnly() {
    if (_charDbPromise) return _charDbPromise;
    _charDbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('indexedDB unsupported')); return; }
      const probe = window.indexedDB.open(CHAR_DB_NAME);
      probe.onsuccess = (e) => {
        const db = e.target.result;
        resolve(db);
      };
      probe.onerror = (e) => reject(e.target.error);
      probe.onupgradeneeded = (e) => {
        // 该库理应已由角色档案页创建；此处仅兜底，不主动写入任何数据
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chars')) {
          db.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
    return _charDbPromise;
  }

  function getAllCharsFromDB() {
    return openCharDBReadOnly().then((db) => new Promise((resolve) => {
      if (!db.objectStoreNames.contains('chars')) { resolve([]); return; }
      const tx = db.transaction('chars', 'readonly');
      const req = tx.objectStore('chars').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    })).catch(() => []);
  }

  function getCharFromDB(charId) {
    return getAllCharsFromDB().then((list) => list.find((c) => String(c.id) === String(charId)) || null);
  }

  let charListCache = [];

  function charTripsFor(charId) {
    return DATA.trips.filter((t) => t.owner === 'char' && String(t.charId) === String(charId));
  }

  function charLetterAvatarHTML(name) {
    const letter = (name || '?').trim().charAt(0).toUpperCase() || '?';
    return '<div class="cf-arch-card-media-letter"><span>' + escapeHTML(letter) + '</span></div>';
  }

  /* ---------- 角色档案墙：网格渲染 ---------- */
  const cfRosterGrid = document.getElementById('cfRosterGrid');

  function renderCharRoster() {
    getAllCharsFromDB().then((chars) => {
      charListCache = chars;
      cfRosterGrid.innerHTML = '';
      if (!chars.length) {
        cfRosterGrid.innerHTML =
          '<div class="cf-roster-empty">还没有创建任何角色<br/>先去"角色档案"里建一个角色，再回来为 TA 规划行程吧</div>';
        return;
      }
      // 按行程数量排序：行程最多的角色作为首位"封面卡"，突出常用角色，而非固定顺序
      const ordered = chars.slice().sort((a, b) => charTripsFor(b.id).length - charTripsFor(a.id).length);
      ordered.forEach((c, idx) => {
        const trips = charTripsFor(c.id);
        const isCover = idx === 0 && trips.length > 0;
        const card = document.createElement('div');
        card.className = 'cf-arch-card' + (isCover ? ' is-cover' : '');
        card.style.animationDelay = (0.08 + Math.min(idx, 8) * 0.08) + 's';
        const serial = 'NO.' + String(idx + 1).padStart(2, '0');
        card.innerHTML =
          '<div class="cf-arch-card-spine"></div>' +
          '<div class="cf-arch-card-media">' +
            (c.avatar ? '<img src="' + c.avatar + '" alt="" />' : charLetterAvatarHTML(c.name)) +
            '<span class="cf-arch-card-index">No.' + String(idx + 1).padStart(2, '0') + '</span>' +
            '<span class="cf-arch-card-trips-tag">' + trips.length + ' 段行程</span>' +
            '<div class="cf-arch-card-frame"><i></i><i></i></div>' +
          '</div>' +
          '<div class="cf-arch-card-body">' +
            (isCover ? '<span class="cf-arch-card-kicker">FEATURED · 最常规划</span>' : '') +
            '<div class="cf-arch-card-name-row">' +
              '<div class="cf-arch-card-name">' + escapeHTML(c.name || '未命名角色') + '</div>' +
              '<span class="cf-arch-card-serial">' + serial + '</span>' +
            '</div>' +
            (c.role ? '<div class="cf-arch-card-role">' + escapeHTML(c.role) + '</div>' : '') +
            '<div class="cf-arch-card-divider"><i></i></div>' +
            (c.desc ? '<div class="cf-arch-card-desc">' + escapeHTML(c.desc) + '</div>' : '') +
            '<div class="cf-arch-card-footer">' +
              '<div class="cf-arch-card-footer-stat">' +
                '<span class="cf-arch-card-footer-num">' + trips.length + '</span>' +
                '<span class="cf-arch-card-footer-word">段行程</span>' +
              '</div>' +
              '<span class="cf-arch-card-footer-cta">查看档案' +
                '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              '</span>' +
            '</div>' +
          '</div>';
        card.addEventListener('click', () => openCharProfile(c.id));
        cfRosterGrid.appendChild(card);
      });
    });
  }

  /* ---------- 角色行程档案页：进入 / 返回 ---------- */
  const cfProfileId = document.getElementById('cfProfileId');
  const cfTripList = document.getElementById('cfTripList');
  const cfBgBtn = document.getElementById('cfBgBtn');
  const cfBackBtn = document.getElementById('cfBackBtn');
  const cfAddTripBtn = document.getElementById('cfAddTripBtn');
  const cfAiEntryBtn = document.getElementById('cfAiEntryBtn');
  const lunaFrameEl = document.querySelector('.luna-frame');

  function enterCharProfileVisual() {
    lunaFrameEl.classList.add('is-char-profile');
  }
  function exitCharProfileVisual() {
    lunaFrameEl.classList.remove('is-char-profile');
  }

  function openCharProfile(charId) {
    state.activeCharId = charId;
    cfActiveFilter = 'all';
    if (cfFilterRow) {
      cfFilterRow.querySelectorAll('.cf-filter-chip').forEach((b) => b.classList.toggle('is-active', b.dataset.filter === 'all'));
    }
    showPanel('charTrips');
    enterCharProfileVisual();
    renderCharProfileHeader();
    renderCharTripList();
    applyCharBg(charId);
  }

  cfBackBtn.addEventListener('click', () => {
    state.activeCharId = null;
    exitCharProfileVisual();
    showPanel('char');
    renderCharView();
  });

  function currentChar() {
    return charListCache.find((c) => String(c.id) === String(state.activeCharId)) || null;
  }

  function renderCharProfileHeader() {
    const c = currentChar();
    if (!c) { cfProfileId.innerHTML = ''; return; }

    // 注意：角色的 性别 / 年龄 / 性格标签 属于私密人设字段，仅供 AI 生成行程时拼接
    // system prompt 使用，不在任何公开展示的档案页面里出现。
    // 这里的数据条只展示"行程本身"的公开统计信息（段数 / 天数 / 已完成段数）。
    const trips = charTripsFor(c.id);
    const totalDays = trips.reduce((sum, t) => sum + dateRangeList(t.startDate, t.endDate).length, 0);
    const doneCount = trips.filter((t) => tripStatus(t) === 'done').length;

    cfProfileId.innerHTML =
      '<div class="cf-profile-avatar">' +
        (c.avatar ? '<img src="' + c.avatar + '" alt="" />' : '<span class="cf-profile-avatar-letter">' + escapeHTML((c.name || '?').charAt(0).toUpperCase()) + '</span>') +
      '</div>' +
      '<div class="cf-profile-name">' + escapeHTML(c.name || '未命名角色') + '</div>' +
      (c.role ? '<div class="cf-profile-role">' + escapeHTML(c.role) + '</div>' : '') +
      '<div class="cf-profile-stats">' +
        '<div class="cf-profile-stat"><span class="cf-profile-stat-num">' + trips.length + '</span><span class="cf-profile-stat-label">行程段数</span></div>' +
        '<div class="cf-profile-stat-divider"></div>' +
        '<div class="cf-profile-stat"><span class="cf-profile-stat-num">' + totalDays + '</span><span class="cf-profile-stat-label">累计天数</span></div>' +
        '<div class="cf-profile-stat-divider"></div>' +
        '<div class="cf-profile-stat"><span class="cf-profile-stat-num">' + doneCount + '</span><span class="cf-profile-stat-label">已完成</span></div>' +
      '</div>';

    renderCharSpotlight(trips);
  }

  /* ---------- 即将出发 聚焦卡：从该角色行程中挑出下一段未开始/进行中的行程 ---------- */
  const cfSpotlight = document.getElementById('cfSpotlight');
  const cfSpotlightName = document.getElementById('cfSpotlightName');
  const cfSpotlightDates = document.getElementById('cfSpotlightDates');
  const cfSpotlightCountdown = document.getElementById('cfSpotlightCountdown');
  const cfSpotlightProgress = document.getElementById('cfSpotlightProgress');

  function renderCharSpotlight(trips) {
    const candidates = trips
      .filter((t) => tripStatus(t) !== 'done')
      .slice()
      .sort((a, b) => a.startDate < b.startDate ? -1 : 1);
    const trip = candidates[0];
    if (!trip) { cfSpotlight.style.display = 'none'; return; }

    const s = tripStatus(trip);
    const today = todayISO();
    cfSpotlightName.textContent = trip.name || '未命名行程';
    cfSpotlightDates.textContent = fmtRangeCN(trip.startDate, trip.endDate);

    if (s === 'ongoing') {
      const all = dateRangeList(trip.startDate, trip.endDate);
      const passed = all.filter((d) => d <= today).length;
      cfSpotlightCountdown.textContent = '进行中 · 第 ' + passed + ' / ' + all.length + ' 天';
      cfSpotlightProgress.style.width = Math.min(100, Math.round((passed / all.length) * 100)) + '%';
    } else {
      const diffDays = Math.max(0, Math.round((new Date(trip.startDate) - new Date(today)) / 86400000));
      cfSpotlightCountdown.textContent = diffDays === 0 ? '今天出发' : '还有 ' + diffDays + ' 天出发';
      cfSpotlightProgress.style.width = '4%';
    }

    cfSpotlight.style.display = '';
    cfSpotlight.onclick = () => openTripDetail(trip.id, 'charTrips');
  }

  let cfActiveFilter = 'all';
  const cfFilterRow = document.getElementById('cfFilterRow');
  if (cfFilterRow) {
    cfFilterRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.cf-filter-chip');
      if (!btn) return;
      cfActiveFilter = btn.dataset.filter;
      cfFilterRow.querySelectorAll('.cf-filter-chip').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderCharTripList();
    });
  }

  function renderCharTripList() {
    const charId = state.activeCharId;
    if (!charId) return;
    let trips = charTripsFor(charId).slice().sort((a, b) => a.startDate < b.startDate ? -1 : 1);
    if (cfActiveFilter !== 'all') {
      trips = trips.filter((t) => tripStatus(t) === cfActiveFilter);
    }
    cfTripList.innerHTML = '';
    if (!trips.length) {
      cfTripList.innerHTML = '<p class="todo-empty">' +
        (cfActiveFilter === 'all' ? '这位角色还没有行程，试试上方的 AI 生成，或手动新建一段' : '这个分类下暂时没有行程') +
        '</p>';
      return;
    }
    trips.forEach((trip) => {
      const s = tripStatus(trip);
      const dates = dateRangeList(trip.startDate, trip.endDate);
      const row = document.createElement('div');
      row.className = 'cf-trip-row';
      row.innerHTML =
        '<span class="cf-trip-row-accent" style="background:' + (trip.color || CARD_COLORS[0]) + '"></span>' +
        '<div class="cf-trip-row-main">' +
          '<div class="cf-trip-row-topline">' +
            '<span class="cf-trip-row-name">' + escapeHTML(trip.name) + '</span>' +
            (trip.aiGenerated ? '<span class="cf-trip-row-ai-badge">AI 生成</span>' : '') +
          '</div>' +
          '<span class="cf-trip-row-dates">' + fmtRangeCN(trip.startDate, trip.endDate) + ' · ' + dates.length + ' 天</span>' +
        '</div>' +
        '<span class="cf-trip-row-status' + (s === 'ongoing' ? ' is-ongoing' : s === 'done' ? ' is-done' : '') + '">' + statusLabel(s) + '</span>' +
        '<svg class="cf-trip-row-chevron" width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      row.addEventListener('click', () => openTripDetail(trip.id, 'charTrips'));
      cfTripList.appendChild(row);
    });
  }

  cfAddTripBtn.addEventListener('click', () => {
    if (!state.activeCharId) return;
    openSheet('trip', null, null, null, 'char', state.activeCharId);
  });

  /* ============================================================
     角色专属背景：每个角色独立存储、独立展示
     复用同一个 IndexedDB（IDB_STORE_MEDIA / IDB_STORE_KV），
     key 里带上 charId 做隔离，互不覆盖
     ============================================================ */
  const CF_BG_SWATCHES = [
    { id: 'porcelain', name: '瓷白', css: 'linear-gradient(150deg, #ffffff 0%, #eef1f2 100%)' },
    { id: 'mist-sky',  name: '雾蓝', css: 'linear-gradient(150deg, #eaf3fb 0%, #dce9f5 100%)' },
    { id: 'sea-glass', name: '海玻璃', css: 'linear-gradient(150deg, #e9f9f4 0%, #d8f0e6 100%)' },
    { id: 'blush-veil', name: '薄粉纱', css: 'linear-gradient(150deg, #fdf1f3 0%, #fbe4e9 100%)' },
    { id: 'graphite',  name: '石墨灰', css: 'linear-gradient(150deg, #eceef0 0%, #d7dbde 100%)' },
    { id: 'ink-line',  name: '墨线白', css: 'linear-gradient(150deg, #ffffff 0%, #f1f2f3 100%)' }
  ];

  function charBgMediaKey(charId) { return 'char_bg_media_' + charId; }
  function charBgMetaKey(charId) { return 'char_bg_meta_' + charId; }
  function charBgSwatchKey(charId) { return 'luna_char_bg_swatch_' + charId; }

  const cfProfileBg = document.getElementById('cfProfileBg');
  let charBgObjectUrl = null;

  function applyCharBg(charId) {
    if (charBgObjectUrl) { URL.revokeObjectURL(charBgObjectUrl); charBgObjectUrl = null; }
    cfProfileBg.style.background = '';
    cfProfileBg.style.backgroundSize = '';
    cfProfileBg.style.backgroundPosition = '';
    cfProfileBg.innerHTML = '';

    idbGet(IDB_STORE_MEDIA, charBgMediaKey(charId)).then((blob) => {
      if (blob) {
        idbGet(IDB_STORE_KV, charBgMetaKey(charId)).then((meta) => {
          const type = (meta && meta.type) || (blob.type && blob.type.indexOf('video') === 0 ? 'video' : 'image');
          charBgObjectUrl = URL.createObjectURL(blob);
          if (type === 'video') {
            const vid = document.createElement('video');
            vid.className = 'bg-custom-media';
            vid.autoplay = true; vid.muted = true; vid.loop = true; vid.playsInline = true;
            vid.src = charBgObjectUrl;
            vid.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;';
            cfProfileBg.appendChild(vid);
            vid.play().catch(() => {});
          } else {
            cfProfileBg.style.background = 'center / cover no-repeat url(' + charBgObjectUrl + ')';
          }
        });
        return;
      }
      // 没有上传的媒体，退回到该角色选中的素雅色卡（若有），否则用默认渐变
      const savedSwatch = (function () { try { return window.localStorage.getItem(charBgSwatchKey(charId)); } catch (e) { return null; } })();
      const sw = CF_BG_SWATCHES.find((s) => s.id === savedSwatch) || CF_BG_SWATCHES[0];
      cfProfileBg.style.background = sw.css;
    }).catch(() => {
      cfProfileBg.style.background = CF_BG_SWATCHES[0].css;
    });
  }

  const cfBgSheetMask = document.getElementById('cfBgSheetMask');
  const cfBgSheetCloseBtn = document.getElementById('cfBgSheetCloseBtn');
  const cfBgSheetCharName = document.getElementById('cfBgSheetCharName');
  const cfBgSwatchGrid = document.getElementById('cfBgSwatchGrid');
  const cfBgUploadBtn = document.getElementById('cfBgUploadBtn');
  const cfBgUploadInput = document.getElementById('cfBgUploadInput');
  const cfBgUploadHint = document.getElementById('cfBgUploadHint');

  function setCfBgHint(text, kind) {
    cfBgUploadHint.textContent = text || '';
    cfBgUploadHint.className = 'theme-upload-hint' + (kind ? ' is-' + kind : '');
  }

  function renderCfBgSwatches() {
    const charId = state.activeCharId;
    if (!charId) return;
    const savedSwatch = (function () { try { return window.localStorage.getItem(charBgSwatchKey(charId)); } catch (e) { return null; } })();

    idbGet(IDB_STORE_MEDIA, charBgMediaKey(charId)).then((blob) => {
      cfBgSwatchGrid.innerHTML = '';

      if (blob) {
        const el = document.createElement('div');
        el.className = 'theme-swatch is-custom-slot is-selected';
        if (charBgObjectUrl) el.style.background = 'center / cover no-repeat url(' + charBgObjectUrl + ')';
        el.innerHTML =
          '<span class="theme-swatch-remove" id="cfBgRemoveBtn" title="移除">✕</span>' +
          '<span class="theme-swatch-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13L10 18L19 7" stroke="#3fd0ae" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
          '<span class="theme-swatch-name">我上传的背景</span>';
        el.addEventListener('click', (e) => {
          if (e.target.closest('#cfBgRemoveBtn')) { removeCharBg(charId); return; }
        });
        cfBgSwatchGrid.appendChild(el);
      }

      CF_BG_SWATCHES.forEach((sw) => {
        const isSelected = !blob && sw.id === (savedSwatch || CF_BG_SWATCHES[0].id);
        const el = document.createElement('div');
        el.className = 'theme-swatch' + (isSelected ? ' is-selected' : '');
        el.style.background = sw.css;
        el.style.border = '1px solid rgba(34,38,47,0.08)';
        el.innerHTML =
          '<span class="theme-swatch-check"><svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13L10 18L19 7" stroke="#3fd0ae" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
          '<span class="theme-swatch-name">' + sw.name + '</span>';
        el.addEventListener('click', () => {
          try { window.localStorage.setItem(charBgSwatchKey(charId), sw.id); } catch (err) {}
          // 选中素雅色卡即视为清除自定义媒体，二者互斥
          Promise.all([idbDelete(IDB_STORE_MEDIA, charBgMediaKey(charId)), idbDelete(IDB_STORE_KV, charBgMetaKey(charId))]).then(() => {
            applyCharBg(charId);
            renderCfBgSwatches();
          });
          if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e2) {} }
        });
        cfBgSwatchGrid.appendChild(el);
      });
    });
  }

  function removeCharBg(charId) {
    Promise.all([idbDelete(IDB_STORE_MEDIA, charBgMediaKey(charId)), idbDelete(IDB_STORE_KV, charBgMetaKey(charId))]).finally(() => {
      applyCharBg(charId);
      renderCfBgSwatches();
      setCfBgHint('已移除，已恢复为默认色卡');
    });
  }

  function saveCharBgFile(charId, file) {
    const isVideo = file.type.indexOf('video') === 0;
    const isImage = file.type.indexOf('image') === 0;
    if (!isVideo && !isImage) { setCfBgHint('请选择图片或视频文件', 'error'); return; }
    setCfBgHint('正在保存到本地数据库…');
    const type = isVideo ? 'video' : 'image';
    Promise.all([
      idbSet(IDB_STORE_MEDIA, charBgMediaKey(charId), file),
      idbSet(IDB_STORE_KV, charBgMetaKey(charId), { type, name: file.name, savedAt: Date.now() })
    ]).then(() => {
      setCfBgHint('已保存，背景已应用', 'ok');
      applyCharBg(charId);
      renderCfBgSwatches();
      if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
    }).catch(() => {
      setCfBgHint('保存失败，请重试（可能是设备存储空间不足）', 'error');
    });
  }

  cfBgBtn.addEventListener('click', () => {
    const c = currentChar();
    cfBgSheetCharName.textContent = c ? c.name : '该角色';
    setCfBgHint('');
    renderCfBgSwatches();
    cfBgSheetMask.classList.add('is-open');
  });
  cfBgSheetCloseBtn.addEventListener('click', () => cfBgSheetMask.classList.remove('is-open'));
  cfBgSheetMask.addEventListener('click', (e) => { if (e.target === cfBgSheetMask) cfBgSheetMask.classList.remove('is-open'); });
  cfBgUploadBtn.addEventListener('click', () => cfBgUploadInput.click());
  cfBgUploadInput.addEventListener('change', () => {
    const file = cfBgUploadInput.files && cfBgUploadInput.files[0];
    cfBgUploadInput.value = '';
    if (file && state.activeCharId) saveCharBgFile(state.activeCharId, file);
  });

  /* ============================================================
     AI 生成角色行程
     ============================================================ */
  const aiSheetMask = document.getElementById('aiSheetMask');
  const aiSheetCloseBtn = document.getElementById('aiSheetCloseBtn');
  const aiCancelBtn = document.getElementById('aiCancelBtn');
  const aiGenerateBtn = document.getElementById('aiGenerateBtn');
  const aiSheetCharName = document.getElementById('aiSheetCharName');
  const aiDurationRow = document.getElementById('aiDurationRow');
  const aiStartDateBtn = document.getElementById('aiStartDateBtn');
  const aiThemeInput = document.getElementById('aiThemeInput');
  const aiExtraInput = document.getElementById('aiExtraInput');
  const aiApiHint = document.getElementById('aiApiHint');
  const aiStepConfig = document.getElementById('aiStepConfig');
  const aiStepLoading = document.getElementById('aiStepLoading');
  const aiStepError = document.getElementById('aiStepError');
  const aiLoadingText = document.getElementById('aiLoadingText');
  const aiErrorMsg = document.getElementById('aiErrorMsg');

  const AI_DURATION_DAYS = { day: 1, week: 7, month: 30 };
  const AI_DURATION_LABEL = { day: '一天', week: '一周', month: '一月' };
  let aiSelectedDuration = 'day';

  function getApiConfig() {
    let cur = {};
    let model = '';
    try { cur = JSON.parse(window.localStorage.getItem('luna_api_current') || '{}'); } catch (e) {}
    try { model = window.localStorage.getItem('luna_api_model') || ''; } catch (e) {}
    return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model };
  }

  function refreshAiApiHint() {
    const cfg = getApiConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      aiApiHint.textContent = '还没有配置可用的模型 API，请先前往"设置 › 模型 API"完成配置后再来生成';
      aiApiHint.classList.add('is-visible');
      aiGenerateBtn.disabled = true;
      aiGenerateBtn.style.opacity = '0.5';
    } else {
      aiApiHint.classList.remove('is-visible');
      aiGenerateBtn.disabled = false;
      aiGenerateBtn.style.opacity = '';
    }
  }

  aiDurationRow.querySelectorAll('.cf-ai-duration-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      aiDurationRow.querySelectorAll('.cf-ai-duration-btn').forEach((b) => b.classList.remove('is-selected'));
      btn.classList.add('is-selected');
      aiSelectedDuration = btn.dataset.dur;
    });
  });

  function openAiSheet() {
    const c = currentChar();
    if (!c) return;
    aiSheetCharName.textContent = c.name || '角色';
    aiSelectedDuration = 'day';
    aiDurationRow.querySelectorAll('.cf-ai-duration-btn').forEach((b) => b.classList.toggle('is-selected', b.dataset.dur === 'day'));
    aiStartDateBtn.dataset.value = todayISO();
    bindDateBtn(aiStartDateBtn);
    aiThemeInput.value = '';
    aiExtraInput.value = '';
    refreshAiApiHint();
    showAiStep('config');
    aiSheetMask.classList.add('is-open');
  }

  function showAiStep(step) {
    aiStepConfig.classList.toggle('is-active', step === 'config');
    aiStepLoading.classList.toggle('is-active', step === 'loading');
    aiStepError.classList.toggle('is-active', step === 'error');
    aiCancelBtn.style.display = step === 'loading' ? 'none' : '';
    aiGenerateBtn.textContent = step === 'error' ? '重试' : '开始生成';
    aiGenerateBtn.style.display = step === 'loading' ? 'none' : '';
  }

  function closeAiSheet() {
    aiSheetMask.classList.remove('is-open');
  }

  cfAiEntryBtn.addEventListener('click', openAiSheet);
  aiSheetCloseBtn.addEventListener('click', closeAiSheet);
  aiCancelBtn.addEventListener('click', closeAiSheet);
  aiSheetMask.addEventListener('click', (e) => { if (e.target === aiSheetMask) closeAiSheet(); });

  /* ---------- 拼装角色人设 system prompt ---------- */
  function buildCharPersonaPrompt(c) {
    const lines = [];
    lines.push('你正在为一个虚构角色规划真实、细腻、具体的日常行程/旅行安排。');
    lines.push('角色姓名：' + (c.name || '未命名'));
    if (c.role) lines.push('角色身份/职业：' + c.role);
    if (c.desc) lines.push('角色简介：' + c.desc);
    if (c.gender) lines.push('性别：' + c.gender);
    if (c.age) lines.push('年龄：' + c.age);
    if (c.species) lines.push('种族/身份类型：' + c.species);
    if (c.appearance) lines.push('外貌：' + c.appearance);
    if (Array.isArray(c.traits) && c.traits.length) lines.push('性格特质：' + c.traits.join('、'));
    if (Array.isArray(c.likes) && c.likes.length) lines.push('喜欢：' + c.likes.join('、'));
    if (Array.isArray(c.dislikes) && c.dislikes.length) lines.push('不喜欢：' + c.dislikes.join('、'));
    if (c.fears) lines.push('恐惧/顾忌：' + c.fears);
    if (c.speechStyle) lines.push('说话风格：' + c.speechStyle);
    if (c.backstory) lines.push('背景故事：' + c.backstory);
    if (c.scenario) lines.push('当前所处场景：' + c.scenario);
    return lines.join('\n');
  }

  function buildAiUserPrompt(c, opts) {
    const dayCount = AI_DURATION_DAYS[opts.duration];
    const dates = [];
    let cursor = opts.startDate;
    for (let i = 0; i < dayCount; i++) { dates.push(cursor); cursor = addDaysISO(cursor, 1); }

    const persona = buildCharPersonaPrompt(c);
    let req = '';
    req += persona + '\n\n';
    req += '请依据以上人设，为这位角色生成一段 ' + AI_DURATION_LABEL[opts.duration] + '（共 ' + dayCount + ' 天）的行程安排。\n';
    req += '日期范围：' + dates[0] + ' 至 ' + dates[dates.length - 1] + '。\n';
    if (opts.theme) req += '行程主题/目的地：' + opts.theme + '\n';
    if (opts.extra) req += '补充要求：' + opts.extra + '\n';
    req += '\n要求：\n';
    req += '1. 每天安排 3~6 条具体的时间轴事项（items），时间、标题、地点、简短备注要符合角色人设与说话习惯（备注可用角色的口吻简短记录一句心情或想法）。\n';
    req += '2. 每天再配 2~4 条待办清单（todos），可以是行程相关的准备事项。\n';
    req += '3. 事项分类 cat 仅能是以下四种之一：sight（景点/活动）、food（美食）、transport（交通）、stay（住宿）。\n';
    req += '4. 待办优先级 priority 仅能是 high / mid / low 之一。\n';
    req += '5. 给整段行程取一个贴合角色与主题、8 个字以内的中文行程名。\n';
    req += '6. 严格只输出一个 JSON 对象，不要任何解释文字、不要 markdown 代码块标记。JSON 结构如下：\n';
    req += '{\n';
    req += '  "tripName": "行程名称",\n';
    req += '  "days": {\n';
    req += '    "' + dates[0] + '": {\n';
    req += '      "items": [ { "time": "09:00", "title": "事项标题", "loc": "地点", "note": "备注", "cat": "sight" } ],\n';
    req += '      "todos": [ { "text": "待办内容", "priority": "mid" } ]\n';
    req += '    }\n';
    req += '  }\n';
    req += '}\n';
    req += 'days 对象的 key 必须覆盖以下全部日期，一个不漏：' + dates.join(', ') + '\n';
    return req;
  }

  /* 尝试修复因 token 截断/多余逗号等原因导致的“几乎合法”的 JSON：
     - 去掉尾部多余的逗号
     - 若字符串在结尾处被截断（未闭合的引号/对象/数组），
       通过回退到最后一个完整的 "}," 或 "]," 边界，并补齐缺失的括号来抢救已生成的部分 */
  function repairTruncatedJson(jsonSlice) {
    // 1) 去掉对象/数组结尾多余的逗号，如 { "a":1, } 或 [1,2,]
    let s = jsonSlice.replace(/,\s*([}\]])/g, '$1');
    try { return JSON.parse(s); } catch (e) { /* 继续尝试修复 */ }

    // 2) 从末尾开始，找到最后一个能让括号配平的截断点，逐步回退
    //    只统计不在字符串内的括号，避免被字符串内容干扰
    const stack = [];
    let inStr = false, escape = false;
    let lastSafeIdx = -1;

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (inStr) {
        if (escape) { escape = false; }
        else if (ch === '\\') { escape = true; }
        else if (ch === '"') { inStr = false; }
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{' || ch === '[') { stack.push(ch); }
      else if (ch === '}' || ch === ']') { stack.pop(); }
      // 记录“括号已配平”的完整对象/数组结束点，作为安全回退位置
      if ((ch === '}' || ch === ']') && stack.length > 0) {
        lastSafeIdx = i;
      }
    }

    if (lastSafeIdx === -1) return null;

    // 从最后一个安全点截断，丢弃后面不完整的内容，再补齐未闭合的括号
    let truncated = s.slice(0, lastSafeIdx + 1);
    // 补一个可能被截断处遗留的逗号
    truncated = truncated.replace(/,\s*$/, '');
    // 根据剩余未闭合的 stack（此时它是截断前整体的括号状态）重新计算
    const closeStack = [];
    inStr = false; escape = false;
    for (let i = 0; i < truncated.length; i++) {
      const ch = truncated[i];
      if (inStr) {
        if (escape) { escape = false; }
        else if (ch === '\\') { escape = true; }
        else if (ch === '"') { inStr = false; }
        continue;
      }
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{' || ch === '[') closeStack.push(ch === '{' ? '}' : ']');
      else if (ch === '}' || ch === ']') closeStack.pop();
    }
    if (inStr) {
      // 字符串本身被截断在中间，直接闭合引号
      truncated += '"';
    }
    while (closeStack.length) { truncated += closeStack.pop(); }

    try { return JSON.parse(truncated); } catch (e) { return null; }
  }

  function extractJsonFromText(text) {
    if (!text) return null;
    let cleaned = text.trim();
    // 去除可能出现在任意位置的 markdown 代码块围栏
    cleaned = cleaned.replace(/^```(?:json)?/i, '').replace(/```\s*$/i, '').trim();
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace === -1) return null;
    // 优先尝试完整片段（当输出未被截断、结尾有多余文字时）
    if (lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonSlice = cleaned.slice(firstBrace, lastBrace + 1);
      try { return JSON.parse(jsonSlice); } catch (e) { /* 继续尝试修复截断的情况 */ }
      const repaired = repairTruncatedJson(jsonSlice);
      if (repaired) return repaired;
    }
    // 输出可能在结尾处被截断（没有匹配的最后一个 "}"），直接从第一个 { 开始尝试修复
    const fromStart = cleaned.slice(firstBrace);
    return repairTruncatedJson(fromStart);
  }

  function sanitizeCat(cat) {
    return ['sight', 'food', 'transport', 'stay'].includes(cat) ? cat : 'sight';
  }
  function sanitizePriority(p) {
    return ['high', 'mid', 'low'].includes(p) ? p : 'mid';
  }
  function sanitizeTime(t) {
    if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) {
      const [h, m] = t.split(':');
      return pad2(Math.min(23, parseInt(h, 10) || 0)) + ':' + pad2(Math.min(59, parseInt(m, 10) || 0));
    }
    return '09:00';
  }

  /* 按生成天数动态估算所需 max_tokens：
     每天大约 6 条 items + 4 条 todos，中文场景下每天的 JSON 内容
     大致需要 260~320 tokens，另加 JSON 结构本身与安全余量。
     固定 4000 tokens 在 7 天/30 天场景下极易导致输出被截断、JSON 不完整而解析失败。 */
  function estimateMaxTokens(duration) {
    const dayCount = AI_DURATION_DAYS[duration] || 1;
    const perDay = 320;
    const overhead = 600;
    const estimated = overhead + perDay * dayCount;
    // 给不同规模设置合理的上下限，避免单次请求过大导致超时或超出模型上限
    return Math.max(2000, Math.min(estimated, 16000));
  }

  async function callAiForItinerary(systemContext, userPrompt, cfg, opts) {
    const maxTokens = estimateMaxTokens(opts && opts.duration);
    const resp = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: [
          { role: 'system', content: '你是一个专业的行程规划助手，只输出严格符合要求的 JSON，不输出任何多余文字，也不要使用 markdown 代码块包裹。' },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.85
      })
    });
    if (!resp.ok) {
      const errText = await resp.text().catch(() => '');
      throw new Error('接口返回 HTTP ' + resp.status + (errText ? ('：' + errText.slice(0, 120)) : ''));
    }
    const data = await resp.json();
    const choice = data.choices && data.choices[0];
    const content = choice && choice.message ? choice.message.content : '';
    if (!content) throw new Error('模型没有返回内容，请重试');
    const parsed = extractJsonFromText(content);
    if (!parsed || !parsed.days) {
      // 输出因达到 max_tokens 上限而被截断时，给出更明确的提示，
      // 引导用户缩短生成天数或简化补充要求，而不是盲目重试
      if (choice && choice.finish_reason === 'length') {
        throw new Error('模型输出内容过长被截断，未能解析出完整的行程 JSON。可尝试缩短生成天数（如先生成"一周"）或精简补充要求后重试。');
      }
      throw new Error('未能解析出有效的行程 JSON，可尝试重新生成');
    }
    return parsed;
  }

  aiGenerateBtn.addEventListener('click', async () => {
    if (aiGenerateBtn.disabled) return;
    if (aiStepError.classList.contains('is-active')) { showAiStep('config'); return; }

    const c = currentChar();
    if (!c) return;
    const startDate = aiStartDateBtn.dataset.value || todayISO();
    const opts = {
      duration: aiSelectedDuration,
      startDate,
      theme: aiThemeInput.value.trim(),
      extra: aiExtraInput.value.trim()
    };
    const cfg = getApiConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) { refreshAiApiHint(); return; }

    aiLoadingText.textContent = '正在为 ' + (c.name || '角色') + ' 构思这段行程…';
    showAiStep('loading');

    try {
      const userPrompt = buildAiUserPrompt(c, opts);
      const result = await callAiForItinerary(buildCharPersonaPrompt(c), userPrompt, cfg, opts);

      const dayCount = AI_DURATION_DAYS[opts.duration];
      const endDate = addDaysISO(startDate, dayCount - 1);
      const tripName = (result.tripName && String(result.tripName).trim()) || ((c.name || '角色') + ' · ' + AI_DURATION_LABEL[opts.duration] + '行程');

      const days = {};
      let cursor = startDate;
      for (let i = 0; i < dayCount; i++) {
        const srcDay = result.days[cursor] || {};
        const items = Array.isArray(srcDay.items) ? srcDay.items.slice(0, 8).map((it) => ({
          id: uid('it'),
          time: sanitizeTime(it.time),
          title: (it.title || '未命名安排').toString().slice(0, 60),
          loc: (it.loc || '').toString().slice(0, 60),
          note: (it.note || '').toString().slice(0, 140),
          cat: sanitizeCat(it.cat)
        })) : [];
        const todos = Array.isArray(srcDay.todos) ? srcDay.todos.slice(0, 6).map((td) => ({
          id: uid('td'),
          text: (td.text || '待办事项').toString().slice(0, 60),
          done: false,
          priority: sanitizePriority(td.priority)
        })) : [];
        days[cursor] = { items, todos };
        cursor = addDaysISO(cursor, 1);
      }

      const newTrip = {
        id: uid('trip'),
        owner: 'char',
        charId: c.id,
        name: tripName.slice(0, 20),
        color: CARD_COLORS[Math.floor(Math.random() * CARD_COLORS.length)],
        startDate, endDate,
        days,
        aiGenerated: true
      };
      DATA.trips.push(newTrip);
      persist(DATA);

      closeAiSheet();
      renderCharProfileHeader();
      renderCharTripList();
      renderCharRoster();
      openTripDetail(newTrip.id, 'charTrips');

    } catch (err) {
      aiErrorMsg.textContent = (err && err.message) || '生成失败，请检查网络与 API 配置后重试';
      showAiStep('error');
    }
  });

  /* ============================================================
     视图切换：列表 ⇄ 全览日历
     ============================================================ */
  const vsButtons = Array.from(document.querySelectorAll('.vs-btn'));
  const subViews = Array.from(document.querySelectorAll('.mine-sub-view'));

  vsButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-active')) return;
      vsButtons.forEach((b) => b.classList.toggle('is-active', b === btn));
      const target = btn.dataset.view;
      state.mineSubView = target;
      subViews.forEach((sv) => sv.classList.toggle('is-active', sv.dataset.subview === target));
      if (target === 'calendar') renderCalendar();
    });
  });

  /* ============================================================
     全览日历
     ============================================================ */
  const calNavLabel = document.getElementById('calNavLabel');
  const calGrid = document.getElementById('calGrid');
  const calDayDetail = document.getElementById('calDayDetail');
  const calPrevBtn = document.getElementById('calPrevBtn');
  const calNextBtn = document.getElementById('calNextBtn');

  const CN_MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];

  function tripsCoveringDate(iso, owner) {
    return tripsByOwner(owner).filter((t) => iso >= t.startDate && iso <= t.endDate);
  }

  function renderCalendar() {
    const [y, m] = state.calMonthCursor.split('-').map(Number);
    calNavLabel.textContent = y + '年 ' + CN_MONTHS[m - 1];

    const firstOfMonth = new Date(y, m - 1, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 周一为 0
    const daysInMonth = new Date(y, m, 0).getDate();
    const prevDaysInMonth = new Date(y, m - 1, 0).getDate();

    calGrid.innerHTML = '';
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - startWeekday;
      let cellDate, otherMonth = false;
      if (dayOffset < 0) {
        cellDate = new Date(y, m - 2, prevDaysInMonth + dayOffset + 1);
        otherMonth = true;
      } else if (dayOffset >= daysInMonth) {
        cellDate = new Date(y, m, dayOffset - daysInMonth + 1);
        otherMonth = true;
      } else {
        cellDate = new Date(y, m - 1, dayOffset + 1);
      }
      const iso = toISO(cellDate);
      const trips = tripsCoveringDate(iso, 'mine');
      const isToday = iso === todayISO();
      const isSelected = iso === state.calSelectedDate;

      const cell = document.createElement('div');
      cell.className = 'cal-cell' +
        (otherMonth ? ' is-other-month' : '') +
        (isToday ? ' is-today' : '') +
        (trips.length ? ' has-trip' : '') +
        (isSelected ? ' is-selected' : '');
      cell.dataset.iso = iso;

      let dotsHTML = '';
      if (trips.length) {
        dotsHTML = '<span class="cal-cell-dots">' + trips.slice(0, 3).map(() => '<span></span>').join('') + '</span>';
      }
      cell.innerHTML = '<span class="cal-cell-num">' + cellDate.getDate() + '</span>' + dotsHTML;
      cell.addEventListener('click', () => {
        state.calSelectedDate = iso;
        renderCalendar();
        renderCalDayDetail(iso);
      });
      calGrid.appendChild(cell);
    }

    if (state.calSelectedDate) renderCalDayDetail(state.calSelectedDate);
  }

  function renderCalDayDetail(iso) {
    const trips = tripsCoveringDate(iso, 'mine');
    if (!trips.length) {
      calDayDetail.innerHTML = '<p class="cal-day-detail-empty">这天还没有安排的行程</p>';
      return;
    }
    let html = '';
    trips.forEach((trip) => {
      const day = trip.days[iso];
      const items = day ? day.items.slice().sort((a, b) => a.time < b.time ? -1 : 1) : [];
      html += '<div class="cal-day-detail-head">' +
        '<span class="cal-day-detail-date">' + iso.slice(5).replace('-', '.') + '</span>' +
        '<span class="cal-day-detail-trip" data-trip="' + trip.id + '">' + escapeHTML(trip.name) + ' ›</span>' +
      '</div>';
      if (items.length) {
        html += '<div class="cal-day-detail-items">' +
          items.map((it) => '<div class="cal-day-detail-item"><span class="time">' + it.time + '</span><span class="dot"></span><span>' + escapeHTML(it.title) + '</span></div>').join('') +
        '</div>';
      } else {
        html += '<p class="cal-day-detail-empty" style="padding:4px 0;">当天暂无具体安排</p>';
      }
    });
    calDayDetail.innerHTML = html;
    calDayDetail.querySelectorAll('.cal-day-detail-trip').forEach((el) => {
      el.addEventListener('click', () => {
        const trip = getTrip(el.dataset.trip);
        openTripDetail(trip.id);
        state.detailSelectedDate = iso;
        renderDayTabs(trip);
        renderDayBoard(trip);
      });
    });
  }

  calPrevBtn.addEventListener('click', () => {
    const [y, m] = state.calMonthCursor.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    state.calMonthCursor = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    renderCalendar();
  });
  calNextBtn.addEventListener('click', () => {
    const [y, m] = state.calMonthCursor.split('-').map(Number);
    const d = new Date(y, m, 1);
    state.calMonthCursor = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    renderCalendar();
  });

  /* ============================================================
     行程详情：日期横向标签
     ============================================================ */
  const dayTabRow = document.getElementById('dayTabRow');
  const dayBoard = document.getElementById('dayBoard');
  const CN_WEEKDAY = ['日','一','二','三','四','五','六'];

  function renderDayTabs(trip) {
    dayTabRow.innerHTML = '';
    const dates = dateRangeList(trip.startDate, trip.endDate);
    dates.forEach((iso, idx) => {
      const day = trip.days[iso];
      const hasItems = day && (day.items.length || day.todos.length);
      const d = new Date(iso + 'T00:00:00');
      const tab = document.createElement('div');
      tab.className = 'day-tab' + (iso === state.detailSelectedDate ? ' is-active' : '') + (hasItems ? ' has-items' : '');
      tab.innerHTML =
        '<span class="day-tab-dnum">D' + (idx + 1) + '</span>' +
        '<span class="day-tab-date">' + d.getDate() + '</span>' +
        '<span class="day-tab-dot"></span>';
      tab.addEventListener('click', () => {
        state.detailSelectedDate = iso;
        renderDayTabs(trip);
        renderDayBoard(trip);
      });
      dayTabRow.appendChild(tab);
    });
  }

  /* ============================================================
     行程详情：当日看板（时间轴 + 待办）
     ============================================================ */
  const timelineList = document.getElementById('timelineList');
  const todoList = document.getElementById('todoList');
  const todoCount = document.getElementById('todoCount');

  const CAT_LABELS = { sight: '景点', food: '美食', transport: '交通', stay: '住宿' };

  function renderDayBoard(trip) {
    const iso = state.detailSelectedDate;
    const day = ensureDay(trip, iso);

    // 时间轴
    timelineList.innerHTML = '';
    if (!day.items.length) {
      timelineList.innerHTML = '<p class="timeline-empty">这天还没有安排，点击右上角添加</p>';
    } else {
      day.items.slice().sort((a, b) => a.time < b.time ? -1 : 1).forEach((it) => {
        const row = document.createElement('div');
        row.className = 'timeline-item' + (trip.aiGenerated ? ' is-ai-gen' : '');
        row.dataset.cat = it.cat || 'sight';
        row.innerHTML =
          '<div class="timeline-item-time cat-' + (it.cat || 'sight') + '"><span class="h">' + it.time + '</span><span class="tag"></span></div>' +
          '<div class="timeline-item-body">' +
            '<div class="timeline-item-title">' + escapeHTML(it.title) + '</div>' +
            (it.loc ? '<div class="timeline-item-loc">' + escapeHTML(it.loc) + '</div>' : '') +
            (it.note ? '<div class="timeline-item-note">' + escapeHTML(it.note) + '</div>' : '') +
          '</div>' +
          '<span class="timeline-item-cat-chip">' + (CAT_LABELS[it.cat] || '景点') + '</span>';
        row.addEventListener('click', () => openSheet('item', trip.id, iso, it.id));
        timelineList.appendChild(row);
      });
    }

    // 待办清单
    todoList.innerHTML = '';
    const doneCount = day.todos.filter((td) => td.done).length;
    todoCount.textContent = doneCount + '/' + day.todos.length;
    if (!day.todos.length) {
      todoList.innerHTML = '<p class="todo-empty">这天还没有待办事项</p>';
    } else {
      day.todos.forEach((td) => {
        const row = document.createElement('div');
        row.className = 'todo-item' + (td.done ? ' is-done' : '');
        row.innerHTML =
          '<span class="todo-check">' +
            '<svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M5 13L10 18L19 7" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</span>' +
          '<span class="todo-text">' + escapeHTML(td.text) + '</span>' +
          '<span class="todo-priority" data-p="' + (td.priority === 'high' ? 'high' : td.priority === 'low' ? 'low' : 'mid') + '"></span>';
        row.querySelector('.todo-check').addEventListener('click', (e) => {
          e.stopPropagation();
          td.done = !td.done;
          persist(DATA);
          renderDayBoard(trip);
          renderMineView();
          if (state.activeCharId) renderCharTripList();
        });
        row.addEventListener('click', () => openSheet('todo', trip.id, iso, td.id));
        todoList.appendChild(row);
      });
    }
  }

  document.getElementById('addItemBtn').addEventListener('click', () => {
    if (!state.detailTripId) return;
    openSheet('item', state.detailTripId, state.detailSelectedDate, null);
  });
  document.getElementById('addTodoBtn').addEventListener('click', () => {
    if (!state.detailTripId) return;
    openSheet('todo', state.detailTripId, state.detailSelectedDate, null);
  });
  document.getElementById('addTripBtn').addEventListener('click', () => openSheet('trip', null, null, null, 'mine'));

  /* ============================================================
     行程详情：单日 ⇄ 周览 ⇄ 月览 视图切换
     ============================================================ */
  const detailViewSwitcher = document.getElementById('detailViewSwitcher');
  const weekBoard = document.getElementById('weekBoard');
  const monthBoard = document.getElementById('monthBoard');

  function setDetailSubView(view) {
    state.detailSubView = view;
    detailViewSwitcher.querySelectorAll('.dvs-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.dview === view));
    dayTabRow.style.display = view === 'day' ? '' : 'none';
    dayBoard.style.display = view === 'day' ? '' : 'none';
    weekBoard.style.display = view === 'week' ? 'flex' : 'none';
    monthBoard.style.display = view === 'month' ? 'block' : 'none';

    const trip = getTrip(state.detailTripId);
    if (!trip) return;
    if (view === 'week') renderWeekBoard(trip);
    if (view === 'month') renderMonthBoard(trip);
  }

  detailViewSwitcher.querySelectorAll('.dvs-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('is-active')) return;
      setDetailSubView(btn.dataset.dview);
    });
  });

  /* ---------- 周览：把整段行程按自然周切块，每周一张卡，卡内逐日列出安排概要 ---------- */
  function renderWeekBoard(trip) {
    const dates = dateRangeList(trip.startDate, trip.endDate);
    weekBoard.innerHTML = '';

    // 按“周一为一周起点”切块；不足一周的首尾块也各自成组
    const weeks = [];
    let cur = [];
    dates.forEach((iso) => {
      const wd = (new Date(iso + 'T00:00:00').getDay() + 6) % 7; // 周一 = 0
      if (cur.length && wd === 0) { weeks.push(cur); cur = []; }
      cur.push(iso);
    });
    if (cur.length) weeks.push(cur);

    if (!weeks.length) {
      weekBoard.innerHTML = '<p class="week-board-empty">这段行程还没有日期范围</p>';
      return;
    }

    weeks.forEach((weekDates, wIdx) => {
      const card = document.createElement('div');
      card.className = 'week-card';

      const rangeLabel = weekDates[0].slice(5).replace('-', '.') + ' – ' + weekDates[weekDates.length - 1].slice(5).replace('-', '.');
      let html = '<div class="week-card-head">' +
        '<span class="week-card-title">第 ' + (wIdx + 1) + ' 周</span>' +
        '<span class="week-card-range">' + rangeLabel + '</span>' +
      '</div>' +
      '<div class="week-card-days">';

      weekDates.forEach((iso) => {
        const day = trip.days[iso];
        const items = day ? day.items.slice().sort((a, b) => a.time < b.time ? -1 : 1) : [];
        const todos = day ? day.todos : [];
        const doneCount = todos.filter((td) => td.done).length;
        const d = new Date(iso + 'T00:00:00');
        const isToday = iso === todayISO();

        html += '<div class="week-day-row' + (isToday ? ' is-today' : '') + '" data-iso="' + iso + '">' +
          '<div class="week-day-date">' +
            '<span class="week-day-num">' + d.getDate() + '</span>' +
            '<span class="week-day-wd">周' + CN_WEEKDAY[d.getDay()] + '</span>' +
          '</div>' +
          '<div class="week-day-summary">';

        if (!items.length && !todos.length) {
          html += '<span class="week-day-empty">暂无安排</span>';
        } else {
          if (items.length) {
            html += '<div class="week-day-items">' +
              items.slice(0, 3).map((it) => '<span class="week-day-item-chip" data-cat="' + (it.cat || 'sight') + '">' + escapeHTML(it.time) + ' ' + escapeHTML(it.title) + '</span>').join('') +
              (items.length > 3 ? '<span class="week-day-more">+' + (items.length - 3) + '</span>' : '') +
            '</div>';
          }
          if (todos.length) {
            html += '<span class="week-day-todo-badge">待办 ' + doneCount + '/' + todos.length + '</span>';
          }
        }
        html += '</div>' +
          '<svg class="week-day-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</div>';
      });

      html += '</div>';
      card.innerHTML = html;
      card.querySelectorAll('.week-day-row').forEach((row) => {
        row.addEventListener('click', () => {
          state.detailSelectedDate = row.dataset.iso;
          setDetailSubView('day');
          renderDayTabs(trip);
          renderDayBoard(trip);
        });
      });
      weekBoard.appendChild(card);
    });
  }

  /* ---------- 月览：日历网格视角，显示整月安排密度，点击某天查看当天概要/跳转 ---------- */
  const mbNavLabel = document.getElementById('mbNavLabel');
  const mbGrid = document.getElementById('mbGrid');
  const mbDayDetail = document.getElementById('mbDayDetail');
  const mbPrevBtn = document.getElementById('mbPrevBtn');
  const mbNextBtn = document.getElementById('mbNextBtn');

  function renderMonthBoard(trip) {
    if (!state.detailMonthCursor) state.detailMonthCursor = (state.detailSelectedDate || trip.startDate).slice(0, 7);
    const [y, m] = state.detailMonthCursor.split('-').map(Number);
    mbNavLabel.textContent = y + '年 ' + CN_MONTHS[m - 1];

    const firstOfMonth = new Date(y, m - 1, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(y, m, 0).getDate();
    const prevDaysInMonth = new Date(y, m - 1, 0).getDate();

    mbGrid.innerHTML = '';
    const totalCells = Math.ceil((startWeekday + daysInMonth) / 7) * 7;
    const tripDates = dateRangeList(trip.startDate, trip.endDate);

    for (let i = 0; i < totalCells; i++) {
      const dayOffset = i - startWeekday;
      let cellDate, otherMonth = false;
      if (dayOffset < 0) {
        cellDate = new Date(y, m - 2, prevDaysInMonth + dayOffset + 1);
        otherMonth = true;
      } else if (dayOffset >= daysInMonth) {
        cellDate = new Date(y, m, dayOffset - daysInMonth + 1);
        otherMonth = true;
      } else {
        cellDate = new Date(y, m - 1, dayOffset + 1);
      }
      const iso = toISO(cellDate);
      const inTrip = tripDates.includes(iso);
      const day = trip.days[iso];
      const itemCount = day ? day.items.length : 0;
      const isToday = iso === todayISO();
      const isSelected = iso === state.detailSelectedDate;

      const cell = document.createElement('div');
      cell.className = 'mb-cell' +
        (otherMonth ? ' is-other-month' : '') +
        (isToday ? ' is-today' : '') +
        (inTrip ? ' in-trip' : '') +
        (itemCount ? ' has-items' : '') +
        (isSelected ? ' is-selected' : '');
      cell.dataset.iso = iso;
      cell.innerHTML = '<span class="mb-cell-num">' + cellDate.getDate() + '</span>' +
        (itemCount ? '<span class="mb-cell-count">' + itemCount + '</span>' : '');
      if (inTrip) {
        cell.addEventListener('click', () => {
          state.detailSelectedDate = iso;
          renderMonthBoard(trip);
          renderMbDayDetail(trip, iso);
        });
      }
      mbGrid.appendChild(cell);
    }

    const detailIso = tripDates.includes(state.detailSelectedDate) ? state.detailSelectedDate : tripDates[0];
    if (detailIso) renderMbDayDetail(trip, detailIso);
  }

  function renderMbDayDetail(trip, iso) {
    const day = trip.days[iso];
    const items = day ? day.items.slice().sort((a, b) => a.time < b.time ? -1 : 1) : [];
    let html = '<div class="mb-day-detail-head">' +
      '<span class="mb-day-detail-date">' + iso.slice(5).replace('-', '.') + '</span>' +
      '<span class="mb-day-detail-jump" id="mbJumpBtn">查看当天 ›</span>' +
    '</div>';
    if (items.length) {
      html += '<div class="mb-day-detail-items">' +
        items.map((it) => '<div class="mb-day-detail-item"><span class="time">' + escapeHTML(it.time) + '</span><span class="dot"></span><span>' + escapeHTML(it.title) + '</span></div>').join('') +
      '</div>';
    } else {
      html += '<p class="mb-day-detail-empty">这天还没有具体安排</p>';
    }
    mbDayDetail.innerHTML = html;
    const jumpBtn = document.getElementById('mbJumpBtn');
    if (jumpBtn) {
      jumpBtn.addEventListener('click', () => {
        state.detailSelectedDate = iso;
        setDetailSubView('day');
        renderDayTabs(trip);
        renderDayBoard(trip);
      });
    }
  }

  mbPrevBtn.addEventListener('click', () => {
    const [y, m] = state.detailMonthCursor.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    state.detailMonthCursor = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    const trip = getTrip(state.detailTripId);
    if (trip) renderMonthBoard(trip);
  });
  mbNextBtn.addEventListener('click', () => {
    const [y, m] = state.detailMonthCursor.split('-').map(Number);
    const d = new Date(y, m, 1);
    state.detailMonthCursor = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
    const trip = getTrip(state.detailTripId);
    if (trip) renderMonthBoard(trip);
  });

  /* ============================================================
     底部弹层：新建 / 编辑（行程、安排、待办 通用）
     ============================================================ */
  const sheetMask = document.getElementById('sheetMask');
  const sheetTitle = document.getElementById('sheetTitle');
  const sheetBody = document.getElementById('sheetBody');
  const sheetSaveBtn = document.getElementById('sheetSaveBtn');
  const sheetDeleteBtn = document.getElementById('sheetDeleteBtn');
  const sheetCloseBtn = document.getElementById('sheetCloseBtn');

  let pendingOwner = 'mine';
  let pendingCharId = null;

  function openSheet(mode, tripId, dateISO, editId, ownerForNewTrip, charIdForNewTrip) {
    state.sheetMode = mode;
    state.sheetEditingId = editId;
    state.sheetColor = CARD_COLORS[0];
    state.sheetCat = 'sight';
    pendingOwner = ownerForNewTrip || 'mine';
    pendingCharId = charIdForNewTrip || null;

    sheetDeleteBtn.classList.toggle('is-visible', !!editId);

    if (mode === 'trip') {
      const trip = editId ? getTrip(editId) : null;
      sheetTitle.textContent = trip ? '编辑行程' : '新建行程';
      state.sheetColor = trip ? trip.color : CARD_COLORS[0];
      sheetBody.innerHTML =
        '<div class="field-group"><span class="field-label">行程名称</span>' +
          '<input class="field-input" id="fName" type="text" placeholder="例如：京都 · 岚山慢旅" value="' + (trip ? escapeAttr(trip.name) : '') + '" /></div>' +
        '<div class="field-row">' +
          '<div class="field-group"><span class="field-label">开始日期</span>' +
            '<button type="button" class="field-date-btn" id="fStart" data-value="' + (trip ? trip.startDate : todayISO()) + '">' +
              '<span class="field-date-btn-text"></span>' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.5H20.5" stroke="currentColor" stroke-width="1.7"/><path d="M8 3V6.5M16 3V6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
            '</button></div>' +
          '<div class="field-group"><span class="field-label">结束日期</span>' +
            '<button type="button" class="field-date-btn" id="fEnd" data-value="' + (trip ? trip.endDate : addDaysISO(todayISO(), 3)) + '">' +
              '<span class="field-date-btn-text"></span>' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="16" rx="3.2" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 9.5H20.5" stroke="currentColor" stroke-width="1.7"/><path d="M8 3V6.5M16 3V6.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>' +
            '</button></div>' +
        '</div>' +
        '<div class="field-group"><span class="field-label">主题色</span>' +
          '<div class="field-color-row" id="fColorRow">' +
            CARD_COLORS.map((c) => '<span class="field-color-dot' + (c === state.sheetColor ? ' is-selected' : '') + '" data-color="' + c + '" style="background:' + c + '"></span>').join('') +
          '</div></div>';
      bindColorRow();
      bindDateBtn(document.getElementById('fStart'));
      bindDateBtn(document.getElementById('fEnd'));
    } else if (mode === 'item') {
      const trip = getTrip(tripId);
      const day = trip ? ensureDay(trip, dateISO) : null;
      const item = editId && day ? day.items.find((i) => i.id === editId) : null;
      state.sheetCat = item ? item.cat : 'sight';
      sheetTitle.textContent = item ? '编辑安排' : '添加安排';
      sheetBody.innerHTML =
        '<div class="field-row">' +
          '<div class="field-group" style="flex:0 0 128px;"><span class="field-label">时间</span>' +
            '<button type="button" class="field-time-btn" id="fTime" data-value="' + (item ? item.time : '09:00') + '">' +
              '<span class="field-time-btn-text"></span>' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12L15 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</button></div>' +
          '<div class="field-group"><span class="field-label">标题</span><input class="field-input" id="fTitle" type="text" placeholder="要做什么" value="' + (item ? escapeAttr(item.title) : '') + '" /></div>' +
        '</div>' +
        '<div class="field-group"><span class="field-label">地点</span><input class="field-input" id="fLoc" type="text" placeholder="地点 / 地址（可选）" value="' + (item ? escapeAttr(item.loc || '') : '') + '" /></div>' +
        '<div class="field-group"><span class="field-label">类型</span>' +
          '<div class="field-chip-row" id="fCatRow">' +
            Object.keys(CAT_LABELS).map((c) => '<span class="field-chip' + (c === state.sheetCat ? ' is-selected' : '') + '" data-cat="' + c + '">' + CAT_LABELS[c] + '</span>').join('') +
          '</div></div>' +
        '<div class="field-group"><span class="field-label">备注</span><textarea class="field-textarea" id="fNote" placeholder="补充信息（可选）">' + (item ? escapeHTML(item.note || '') : '') + '</textarea></div>';
      bindCatRow();
      bindTimeBtn(document.getElementById('fTime'));
    } else if (mode === 'todo') {
      const trip = getTrip(tripId);
      const day = trip ? ensureDay(trip, dateISO) : null;
      const todo = editId && day ? day.todos.find((t) => t.id === editId) : null;
      sheetTitle.textContent = todo ? '编辑待办' : '添加待办';
      const priority = todo ? todo.priority : 'mid';
      sheetBody.innerHTML =
        '<div class="field-group"><span class="field-label">内容</span><input class="field-input" id="fText" type="text" placeholder="要做的事" value="' + (todo ? escapeAttr(todo.text) : '') + '" /></div>' +
        '<div class="field-group"><span class="field-label">优先级</span>' +
          '<div class="field-chip-row" id="fPriorityRow">' +
            '<span class="field-chip" data-p="high">重要</span>' +
            '<span class="field-chip" data-p="mid">一般</span>' +
            '<span class="field-chip" data-p="low">不急</span>' +
          '</div></div>';
      const prioChips = sheetBody.querySelectorAll('#fPriorityRow .field-chip');
      prioChips.forEach((chip) => {
        chip.classList.toggle('is-selected', chip.dataset.p === priority);
        chip.addEventListener('click', () => {
          prioChips.forEach((c) => c.classList.remove('is-selected'));
          chip.classList.add('is-selected');
        });
      });
    }

    sheetMask.dataset.tripId = tripId || '';
    sheetMask.dataset.dateIso = dateISO || '';
    sheetMask.classList.add('is-open');
  }

  function bindColorRow() {
    const dots = sheetBody.querySelectorAll('.field-color-dot');
    dots.forEach((dot) => {
      dot.addEventListener('click', () => {
        dots.forEach((d) => d.classList.remove('is-selected'));
        dot.classList.add('is-selected');
        state.sheetColor = dot.dataset.color;
      });
    });
  }

  function bindCatRow() {
    const chips = sheetBody.querySelectorAll('#fCatRow .field-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('is-selected'));
        chip.classList.add('is-selected');
        state.sheetCat = chip.dataset.cat;
      });
    });
  }

  /* ============================================================
     自定义日期选择器：替换原生 <input type="date">
     一个按钮 + 一个内嵌小日历弹层，样式与全览日历一致的糖果玻璃风
     ============================================================ */
  const MONTH_LABELS_CN = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const WEEKDAY_LABELS_CN = ['一','二','三','四','五','六','日'];

  function fmtDateBtnLabel(iso) {
    if (!iso) return '选择日期';
    const p = iso.split('-');
    return p[0] + '.' + p[1] + '.' + p[2];
  }

  function closeAnyFieldPopover() {
    const existing = document.querySelector('.field-popover-mask');
    if (existing) existing.remove();
  }

  function bindDateBtn(btn) {
    if (!btn) return;
    btn.querySelector('.field-date-btn-text').textContent = fmtDateBtnLabel(btn.dataset.value);
    btn.addEventListener('click', () => openDatePopover(btn));
  }

  function openDatePopover(btn) {
    closeAnyFieldPopover();
    const initial = btn.dataset.value || todayISO();
    let cursor = initial.slice(0, 7); // YYYY-MM
    let mode = 'days'; // 'days' | 'yearmonth'
    let ymPickerYear = Number(cursor.slice(0, 4)); // 年月选择面板里，当前展示的年份

    const mask = document.createElement('div');
    mask.className = 'field-popover-mask';
    const pop = document.createElement('div');
    pop.className = 'field-popover date-popover';
    mask.appendChild(pop);
    document.body.appendChild(mask);

    function renderDaysView() {
      const [y, m] = cursor.split('-').map(Number);
      const firstOfMonth = new Date(y, m - 1, 1);
      const startWeekday = (firstOfMonth.getDay() + 6) % 7; // 周一=0
      const daysInMonth = new Date(y, m, 0).getDate();
      const prevDaysInMonth = new Date(y, m - 1, 0).getDate();

      let cellsHtml = '';
      for (let i = 0; i < startWeekday; i++) {
        const dnum = prevDaysInMonth - startWeekday + 1 + i;
        cellsHtml += '<div class="dp-cell is-other-month"><span>' + dnum + '</span></div>';
      }
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = y + '-' + pad2(m) + '-' + pad2(d);
        const isToday = iso === todayISO();
        const isSelected = iso === btn.dataset.value;
        cellsHtml += '<div class="dp-cell' + (isToday ? ' is-today' : '') + (isSelected ? ' is-selected' : '') + '" data-iso="' + iso + '"><span>' + d + '</span></div>';
      }
      const totalCells = startWeekday + daysInMonth;
      const trailing = (7 - (totalCells % 7)) % 7;
      for (let i = 1; i <= trailing; i++) {
        cellsHtml += '<div class="dp-cell is-other-month"><span>' + i + '</span></div>';
      }

      pop.innerHTML =
        '<div class="dp-head">' +
          '<button type="button" class="dp-nav-btn" id="dpPrev" aria-label="上个月"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<button type="button" class="dp-label" id="dpLabelBtn">' + y + ' 年 ' + MONTH_LABELS_CN[m - 1] +
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" class="dp-label-caret"><path d="M6 9L12 15L18 9" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</button>' +
          '<button type="button" class="dp-nav-btn" id="dpNext" aria-label="下个月"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
        '<div class="dp-weekday-row">' + WEEKDAY_LABELS_CN.map((w) => '<span>' + w + '</span>').join('') + '</div>' +
        '<div class="dp-grid">' + cellsHtml + '</div>' +
        '<div class="dp-foot"><button type="button" class="dp-today-btn" id="dpToday">回到今天</button></div>';

      pop.querySelector('#dpPrev').addEventListener('click', () => {
        const [yy, mm] = cursor.split('-').map(Number);
        const d = new Date(yy, mm - 2, 1);
        cursor = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
        renderDaysView();
      });
      pop.querySelector('#dpNext').addEventListener('click', () => {
        const [yy, mm] = cursor.split('-').map(Number);
        const d = new Date(yy, mm, 1);
        cursor = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
        renderDaysView();
      });
      pop.querySelector('#dpToday').addEventListener('click', () => {
        cursor = todayISO().slice(0, 7);
        renderDaysView();
      });
      pop.querySelector('#dpLabelBtn').addEventListener('click', () => {
        mode = 'yearmonth';
        ymPickerYear = Number(cursor.slice(0, 4));
        renderYearMonthView();
      });
      pop.querySelectorAll('.dp-cell:not(.is-other-month)').forEach((cell) => {
        cell.addEventListener('click', () => {
          const iso = cell.dataset.iso;
          btn.dataset.value = iso;
          btn.querySelector('.field-date-btn-text').textContent = fmtDateBtnLabel(iso);
          closeAnyFieldPopover();
          if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
        });
      });
    }

    /* 年月快选面板：先选年份（左右翻年），再点月份格子直接跳到那个月，
       省去逐月点箭头的等待，用于跨度较大的日期选择（如半年后的行程）。 */
    function renderYearMonthView() {
      const selectedY = Number(cursor.slice(0, 4));
      const selectedM = Number(cursor.slice(5, 7));

      let monthsHtml = '';
      for (let mo = 1; mo <= 12; mo++) {
        const isSelected = ymPickerYear === selectedY && mo === selectedM;
        const isCurrentMonth = ymPickerYear === Number(todayISO().slice(0, 4)) && mo === Number(todayISO().slice(5, 7));
        monthsHtml += '<div class="dp-month-cell' + (isSelected ? ' is-selected' : '') + (isCurrentMonth ? ' is-today' : '') + '" data-m="' + mo + '"><span>' + (mo) + ' 月</span></div>';
      }

      pop.innerHTML =
        '<div class="dp-head">' +
          '<button type="button" class="dp-nav-btn" id="dpYearPrev" aria-label="上一年"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 5L8 12L15 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
          '<span class="dp-label dp-label-static">' + ymPickerYear + ' 年</span>' +
          '<button type="button" class="dp-nav-btn" id="dpYearNext" aria-label="下一年"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 5L16 12L9 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '</div>' +
        '<div class="dp-month-grid">' + monthsHtml + '</div>' +
        '<div class="dp-foot"><button type="button" class="dp-today-btn" id="dpBackToDays">返回选日期</button></div>';

      pop.querySelector('#dpYearPrev').addEventListener('click', () => { ymPickerYear--; renderYearMonthView(); });
      pop.querySelector('#dpYearNext').addEventListener('click', () => { ymPickerYear++; renderYearMonthView(); });
      pop.querySelector('#dpBackToDays').addEventListener('click', () => { mode = 'days'; renderDaysView(); });
      pop.querySelectorAll('.dp-month-cell').forEach((cell) => {
        cell.addEventListener('click', () => {
          const mo = Number(cell.dataset.m);
          cursor = ymPickerYear + '-' + pad2(mo);
          mode = 'days';
          renderDaysView();
          if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
        });
      });
    }

    renderDaysView();
    requestAnimationFrame(() => mask.classList.add('is-open'));
    mask.addEventListener('click', (e) => { if (e.target === mask) closeAnyFieldPopover(); });
  }

  /* ============================================================
     自定义时间选择器：替换原生 <input type="time">
     双滚轮（时 / 分）弹层，同样走糖果玻璃风格
     ============================================================ */
  function fmtTimeBtnLabel(hm) {
    return hm || '09:00';
  }

  function bindTimeBtn(btn) {
    if (!btn) return;
    btn.querySelector('.field-time-btn-text').textContent = fmtTimeBtnLabel(btn.dataset.value);
    btn.addEventListener('click', () => openTimePopover(btn));
  }

  function openTimePopover(btn) {
    closeAnyFieldPopover();
    const initial = (btn.dataset.value || '09:00').split(':');
    let hh = parseInt(initial[0], 10) || 0;
    let mm = parseInt(initial[1], 10) || 0;

    const mask = document.createElement('div');
    mask.className = 'field-popover-mask';
    const pop = document.createElement('div');
    pop.className = 'field-popover time-popover';
    mask.appendChild(pop);
    document.body.appendChild(mask);

    const hours = Array.from({ length: 24 }, (_, i) => pad2(i));
    const mins = Array.from({ length: 60 }, (_, i) => pad2(i));

    pop.innerHTML =
      '<div class="tp-head"><span class="tp-label">选择时间</span></div>' +
      '<div class="tp-wheels">' +
        '<div class="tp-wheel" id="tpHourWheel">' + hours.map((h) => '<div class="tp-opt" data-v="' + h + '">' + h + '</div>').join('') + '</div>' +
        '<div class="tp-colon">:</div>' +
        '<div class="tp-wheel" id="tpMinWheel">' + mins.map((m) => '<div class="tp-opt" data-v="' + m + '">' + m + '</div>').join('') + '</div>' +
        '<div class="tp-wheel-mask-top"></div><div class="tp-wheel-mask-bottom"></div>' +
      '</div>' +
      '<div class="tp-foot"><button type="button" class="tp-confirm-btn" id="tpConfirm">确定</button></div>';

    const hourWheel = pop.querySelector('#tpHourWheel');
    const minWheel = pop.querySelector('#tpMinWheel');
    const OPT_H = 36;

    function scrollWheelTo(wheel, index, smooth) {
      wheel.scrollTo({ top: index * OPT_H, behavior: smooth ? 'smooth' : 'auto' });
    }
    function syncSelectedClass(wheel, value) {
      wheel.querySelectorAll('.tp-opt').forEach((o) => o.classList.toggle('is-selected', o.dataset.v === value));
    }

    scrollWheelTo(hourWheel, hh, false);
    scrollWheelTo(minWheel, mm, false);
    syncSelectedClass(hourWheel, pad2(hh));
    syncSelectedClass(minWheel, pad2(mm));

    let hourTimer, minTimer;
    hourWheel.addEventListener('scroll', () => {
      clearTimeout(hourTimer);
      hourTimer = setTimeout(() => {
        hh = Math.round(hourWheel.scrollTop / OPT_H);
        hh = Math.max(0, Math.min(23, hh));
        scrollWheelTo(hourWheel, hh, true);
        syncSelectedClass(hourWheel, pad2(hh));
      }, 90);
    });
    minWheel.addEventListener('scroll', () => {
      clearTimeout(minTimer);
      minTimer = setTimeout(() => {
        mm = Math.round(minWheel.scrollTop / OPT_H);
        mm = Math.max(0, Math.min(59, mm));
        scrollWheelTo(minWheel, mm, true);
        syncSelectedClass(minWheel, pad2(mm));
      }, 90);
    });
    pop.querySelectorAll('#tpHourWheel .tp-opt').forEach((opt, i) => {
      opt.addEventListener('click', () => { hh = i; scrollWheelTo(hourWheel, hh, true); syncSelectedClass(hourWheel, pad2(hh)); });
    });
    pop.querySelectorAll('#tpMinWheel .tp-opt').forEach((opt, i) => {
      opt.addEventListener('click', () => { mm = i; scrollWheelTo(minWheel, mm, true); syncSelectedClass(minWheel, pad2(mm)); });
    });

    pop.querySelector('#tpConfirm').addEventListener('click', () => {
      const val = pad2(hh) + ':' + pad2(mm);
      btn.dataset.value = val;
      btn.querySelector('.field-time-btn-text').textContent = fmtTimeBtnLabel(val);
      closeAnyFieldPopover();
      if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
    });

    requestAnimationFrame(() => mask.classList.add('is-open'));
    mask.addEventListener('click', (e) => { if (e.target === mask) closeAnyFieldPopover(); });
  }

  function closeSheet() {
    sheetMask.classList.remove('is-open');
  }
  sheetCloseBtn.addEventListener('click', closeSheet);
  sheetMask.addEventListener('click', (e) => { if (e.target === sheetMask) closeSheet(); });

  sheetSaveBtn.addEventListener('click', () => {
    const mode = state.sheetMode;
    const tripId = sheetMask.dataset.tripId;
    const dateIso = sheetMask.dataset.dateIso;

    if (mode === 'trip') {
      const name = (document.getElementById('fName').value || '').trim();
      const start = document.getElementById('fStart').dataset.value;
      const end = document.getElementById('fEnd').dataset.value;
      if (!name || !start || !end || end < start) { shake(); return; }

      if (state.sheetEditingId) {
        const trip = getTrip(state.sheetEditingId);
        trip.name = name; trip.startDate = start; trip.endDate = end; trip.color = state.sheetColor;
      } else {
        const newTrip = { id: uid('trip'), owner: pendingOwner, name, color: state.sheetColor, startDate: start, endDate: end, days: {} };
        if (pendingOwner === 'char') newTrip.charId = pendingCharId;
        DATA.trips.push(newTrip);
      }
      persist(DATA);
      renderMineView();
      renderCharView();
      if (state.activeCharId) renderCharTripList();

    } else if (mode === 'item') {
      const trip = getTrip(tripId);
      const day = ensureDay(trip, dateIso);
      const time = document.getElementById('fTime').dataset.value || '09:00';
      const title = (document.getElementById('fTitle').value || '').trim();
      const loc = (document.getElementById('fLoc').value || '').trim();
      const note = (document.getElementById('fNote').value || '').trim();
      if (!title) { shake(); return; }

      if (state.sheetEditingId) {
        const it = day.items.find((i) => i.id === state.sheetEditingId);
        it.time = time; it.title = title; it.loc = loc; it.note = note; it.cat = state.sheetCat;
      } else {
        day.items.push({ id: uid('it'), time, title, loc, note, cat: state.sheetCat });
      }
      persist(DATA);
      renderDayTabs(trip);
      renderDayBoard(trip);

    } else if (mode === 'todo') {
      const trip = getTrip(tripId);
      const day = ensureDay(trip, dateIso);
      const text = (document.getElementById('fText').value || '').trim();
      const prioEl = sheetBody.querySelector('#fPriorityRow .field-chip.is-selected');
      const priority = prioEl ? prioEl.dataset.p : 'mid';
      if (!text) { shake(); return; }

      if (state.sheetEditingId) {
        const td = day.todos.find((t) => t.id === state.sheetEditingId);
        td.text = text; td.priority = priority;
      } else {
        day.todos.push({ id: uid('td'), text, done: false, priority });
      }
      persist(DATA);
      renderDayTabs(trip);
      renderDayBoard(trip);
      renderMineView();
      renderCharView();
      if (state.activeCharId) renderCharTripList();
    }

    closeSheet();
  });

  sheetDeleteBtn.addEventListener('click', () => {
    const mode = state.sheetMode;
    const tripId = sheetMask.dataset.tripId;
    const dateIso = sheetMask.dataset.dateIso;
    if (!state.sheetEditingId) { closeSheet(); return; }

    if (mode === 'trip') {
      DATA.trips = DATA.trips.filter((t) => t.id !== state.sheetEditingId);
      persist(DATA);
      closeSheet();
      closeTripDetail();
      renderMineView();
      renderCharView();
      if (state.activeCharId) renderCharTripList();
      return;
    }
    const trip = getTrip(tripId);
    const day = trip ? trip.days[dateIso] : null;
    if (day) {
      if (mode === 'item') day.items = day.items.filter((i) => i.id !== state.sheetEditingId);
      if (mode === 'todo') day.todos = day.todos.filter((t) => t.id !== state.sheetEditingId);
    }
    persist(DATA);
    renderDayTabs(trip);
    renderDayBoard(trip);
    renderMineView();
    renderCharView();
    if (state.activeCharId) renderCharTripList();
    closeSheet();
  });

  function shake() {
    sheetBody.style.transition = 'transform .08s ease';
    sheetBody.style.transform = 'translateX(-6px)';
    setTimeout(() => { sheetBody.style.transform = 'translateX(6px)'; }, 80);
    setTimeout(() => { sheetBody.style.transform = 'translateX(0)'; }, 160);
  }

  /* ============================================================
     工具函数
     ============================================================ */
  function escapeHTML(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeAttr(str) {
    return escapeHTML(str).replace(/"/g, '&quot;');
  }

  /* ============================================================
     背景主题：切换 + 持久化
     ============================================================ */
  const THEME_KEY = 'luna_bg_theme_v1';
  const THEMES = [
    { id: 'mint-sky',      name: '薄荷天光', swatch: 'linear-gradient(135deg, #6fe3c8 0%, #7bc4f0 55%, #ff9fb0 120%)' },
    { id: 'sunrise-coral', name: '珊瑚晨曦', swatch: 'linear-gradient(135deg, #ff9fb0 0%, #ffcf86 60%, #7bc4f0 120%)' },
    { id: 'sky-mint',      name: '云海天蓝', swatch: 'linear-gradient(135deg, #7bc4f0 0%, #6fe3c8 55%, #9db8ff 120%)' },
    { id: 'lemon-mint',    name: '青柠薄荷', swatch: 'linear-gradient(135deg, #c7e878 0%, #6fe3c8 55%, #ffcf86 120%)' },
    { id: 'petal-blush',   name: '花瓣粉雾', swatch: 'linear-gradient(135deg, #ff9fb0 0%, #ffc4d6 55%, #7bc4f0 120%)' },
    { id: 'deep-ocean',    name: '深海晴空', swatch: 'linear-gradient(135deg, #4fa8e8 0%, #3fd0ae 55%, #6f8fe8 120%)' }
  ];
  const lunaFrame = document.querySelector('.luna-frame');
  const CUSTOM_BG_THEME_ID = 'custom-upload';
  const CUSTOM_BG_MEDIA_KEY = 'user_custom_bg_media'; // IndexedDB media store 里存 Blob 的 key
  const CUSTOM_BG_META_KEY = 'luna_custom_bg_meta_v1'; // IndexedDB kv store 里存类型等元信息

  function loadTheme() {
    try {
      const saved = window.localStorage.getItem(THEME_KEY);
      if (saved && (THEMES.some((t) => t.id === saved) || saved === CUSTOM_BG_THEME_ID)) return saved;
    } catch (e) {}
    return THEMES[0].id;
  }

  function applyTheme(themeId) {
    if (themeId === CUSTOM_BG_THEME_ID) {
      lunaFrame.removeAttribute('data-theme');
      return; // 自定义背景的显隐由 applyCustomBg()/clearCustomBg() 单独控制
    }
    clearCustomBgVisual();
    if (themeId === THEMES[0].id) {
      lunaFrame.removeAttribute('data-theme');
    } else {
      lunaFrame.setAttribute('data-theme', themeId);
    }
    try { window.localStorage.setItem(THEME_KEY, themeId); } catch (e) {}
  }

  let currentTheme = loadTheme();

  /* ---------- 自定义背景：上传、存 IndexedDB、应用、移除 ---------- */
  const bgCustomLayer = document.getElementById('bgCustomLayer');
  const bgCustomImg = document.getElementById('bgCustomImg');
  const bgCustomVideo = document.getElementById('bgCustomVideo');
  const themeUploadBtn = document.getElementById('themeUploadBtn');
  const themeUploadInput = document.getElementById('themeUploadInput');
  const themeUploadHint = document.getElementById('themeUploadHint');

  let customBgObjectUrl = null;
  let customBgAvailable = false; // 本次会话内是否已确认 IndexedDB 中存在自定义背景

  function setUploadHint(text, kind) {
    themeUploadHint.textContent = text || '';
    themeUploadHint.className = 'theme-upload-hint' + (kind ? ' is-' + kind : '');
  }

  function clearCustomBgVisual() {
    lunaFrame.removeAttribute('data-custom-bg');
    lunaFrame.removeAttribute('data-custom-bg-type');
    try { bgCustomVideo.pause(); } catch (e) {}
  }

  function showCustomBgVisual(blob, type) {
    if (customBgObjectUrl) { URL.revokeObjectURL(customBgObjectUrl); customBgObjectUrl = null; }
    customBgObjectUrl = URL.createObjectURL(blob);
    if (type === 'video') {
      bgCustomVideo.src = customBgObjectUrl;
      bgCustomImg.removeAttribute('src');
      lunaFrame.setAttribute('data-custom-bg-type', 'video');
      bgCustomVideo.play().catch(() => {});
    } else {
      bgCustomImg.src = customBgObjectUrl;
      bgCustomVideo.removeAttribute('src');
      lunaFrame.setAttribute('data-custom-bg-type', 'image');
    }
    lunaFrame.setAttribute('data-custom-bg', '1');
  }

  function applyCustomBgFromIDB() {
    return idbGet(IDB_STORE_MEDIA, CUSTOM_BG_MEDIA_KEY).then((blob) => {
      if (!blob) { customBgAvailable = false; return false; }
      return idbGet(IDB_STORE_KV, CUSTOM_BG_META_KEY).then((meta) => {
        const type = (meta && meta.type) || (blob.type && blob.type.indexOf('video') === 0 ? 'video' : 'image');
        showCustomBgVisual(blob, type);
        customBgAvailable = true;
        return true;
      });
    }).catch(() => { customBgAvailable = false; return false; });
  }

  function saveCustomBgFile(file) {
    const isVideo = file.type.indexOf('video') === 0;
    const isImage = file.type.indexOf('image') === 0;
    if (!isVideo && !isImage) {
      setUploadHint('请选择图片或视频文件', 'error');
      return;
    }
    setUploadHint('正在保存到本地数据库…');
    const type = isVideo ? 'video' : 'image';
    Promise.all([
      idbSet(IDB_STORE_MEDIA, CUSTOM_BG_MEDIA_KEY, file),
      idbSet(IDB_STORE_KV, CUSTOM_BG_META_KEY, { type, name: file.name, savedAt: Date.now() })
    ]).then(() => {
      customBgAvailable = true;
      showCustomBgVisual(file, type);
      currentTheme = CUSTOM_BG_THEME_ID;
      applyTheme(currentTheme);
      try { window.localStorage.setItem(THEME_KEY, currentTheme); } catch (e) {}
      setUploadHint('已保存，背景已应用', 'ok');
      renderThemeSwatches();
      if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
    }).catch(() => {
      setUploadHint('保存失败，请重试（可能是设备存储空间不足）', 'error');
    });
  }

  function removeCustomBg() {
    Promise.all([
      idbDelete(IDB_STORE_MEDIA, CUSTOM_BG_MEDIA_KEY),
      idbDelete(IDB_STORE_KV, CUSTOM_BG_META_KEY)
    ]).finally(() => {
      customBgAvailable = false;
      if (customBgObjectUrl) { URL.revokeObjectURL(customBgObjectUrl); customBgObjectUrl = null; }
      if (currentTheme === CUSTOM_BG_THEME_ID) {
        currentTheme = THEMES[0].id;
        applyTheme(currentTheme);
      } else {
        clearCustomBgVisual();
      }
      setUploadHint('已移除自定义背景');
      renderThemeSwatches();
    });
  }

  themeUploadBtn.addEventListener('click', () => themeUploadInput.click());
  themeUploadInput.addEventListener('change', () => {
    const file = themeUploadInput.files && themeUploadInput.files[0];
    themeUploadInput.value = '';
    if (file) saveCustomBgFile(file);
  });

  // 页面加载时若已选中自定义背景主题，尝试从 IndexedDB 恢复画面
  if (currentTheme === CUSTOM_BG_THEME_ID) {
    applyCustomBgFromIDB().then((ok) => { if (!ok) { currentTheme = THEMES[0].id; applyTheme(currentTheme); } });
  } else {
    applyTheme(currentTheme);
    // 静默探测一下 IndexedDB 里是否已有自定义背景，用于色卡网格里展示"我的背景"槽位
    idbGet(IDB_STORE_MEDIA, CUSTOM_BG_MEDIA_KEY).then((blob) => { customBgAvailable = !!blob; renderThemeSwatches(); }).catch(() => {});
  }

  const themeSheetMask = document.getElementById('themeSheetMask');
  const themeSheetCloseBtn = document.getElementById('themeSheetCloseBtn');
  const themeSwatchGrid = document.getElementById('themeSwatchGrid');
  const headerThemeBtn = document.getElementById('headerThemeBtn');

  function renderThemeSwatches() {
    themeSwatchGrid.innerHTML = '';

    if (customBgAvailable) {
      const el = document.createElement('div');
      el.className = 'theme-swatch is-custom-slot' + (currentTheme === CUSTOM_BG_THEME_ID ? ' is-selected' : '');
      if (currentTheme === CUSTOM_BG_THEME_ID && customBgObjectUrl) {
        el.style.background = 'center / cover no-repeat url(' + customBgObjectUrl + ')';
      }
      el.innerHTML =
        '<span class="theme-swatch-remove" id="customBgRemoveBtn" title="移除">✕</span>' +
        '<span class="theme-swatch-check">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13L10 18L19 7" stroke="#3fd0ae" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span>' +
        '<span class="theme-swatch-name">我的背景</span>';
      el.addEventListener('click', (e) => {
        if (e.target.closest('#customBgRemoveBtn')) { removeCustomBg(); return; }
        currentTheme = CUSTOM_BG_THEME_ID;
        applyCustomBgFromIDB().then(() => {
          try { window.localStorage.setItem(THEME_KEY, currentTheme); } catch (err) {}
          lunaFrame.removeAttribute('data-theme');
          renderThemeSwatches();
        });
        if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e2) {} }
      });
      themeSwatchGrid.appendChild(el);
    }

    THEMES.forEach((theme) => {
      const el = document.createElement('div');
      el.className = 'theme-swatch' + (theme.id === currentTheme ? ' is-selected' : '');
      el.style.background = theme.swatch;
      el.innerHTML =
        '<span class="theme-swatch-check">' +
          '<svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M5 13L10 18L19 7" stroke="#3fd0ae" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span>' +
        '<span class="theme-swatch-name">' + theme.name + '</span>';
      el.addEventListener('click', () => {
        currentTheme = theme.id;
        applyTheme(currentTheme);
        renderThemeSwatches();
        if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} }
      });
      themeSwatchGrid.appendChild(el);
    });
  }

  function openThemeSheet() {
    setUploadHint('');
    renderThemeSwatches();
    themeSheetMask.classList.add('is-open');
  }
  function closeThemeSheet() {
    themeSheetMask.classList.remove('is-open');
  }
  headerThemeBtn.addEventListener('click', openThemeSheet);
  themeSheetCloseBtn.addEventListener('click', closeThemeSheet);
  themeSheetMask.addEventListener('click', (e) => { if (e.target === themeSheetMask) closeThemeSheet(); });

  /* 角色档案在其他页面（characters.html）被增删改时会写入这个 localStorage 标记，
     这里监听一下，保证角色墙 / 已打开的角色档案页数据不至于是陈旧的 */
  window.addEventListener('storage', (e) => {
    if (e.key === 'luna_characters_updated' || e.key === 'luna_char_db_update') {
      _charDbPromise = null; // 强制下次重新打开 DB 连接，避免拿到旧的连接快照
      if (state.activeTab === 'char' && !state.activeCharId) renderCharRoster();
      if (state.activeCharId) {
        renderCharProfileHeader();
        renderCharTripList();
      }
    }
  });

  /* ============================================================
     初始渲染
     ============================================================ */
  renderHeaderForTab();
  renderMineView();
  renderCharView();
  hydrateFromIDB();

})();