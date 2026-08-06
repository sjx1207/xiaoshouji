/* ================================
   Luna Phone — 主屏编辑模式
   长按拖拽排序 + 添加/删除组件 + 页面管理 + 恢复默认
   + 跨页拖拽（拖到屏幕边缘自动翻页）
   + Dock 拖拽进出（图标尺寸随位置自动切换，不会跑版）
   + 已删除项目召回面板（误删可找回）
   独立模块，不侵入原有 script.js 逻辑
================================ */
(function () {
  'use strict';

  const GRID_COLS = 4;
  const GRID_ROWS = 6;
  const DOCK_SLOTS = 4;
  const LONG_PRESS_MS = 480;
  const EDGE_ZONE_PX = 34;       // 拖到距离屏幕左右边缘多近时触发翻页
  const EDGE_FLIP_MS = 650;      // 在边缘停留多久后自动翻页
  // 存储版本号升级：v1/v2 时代保存的布局在跨页拖拽 + dock 支持上线前写入，
  // 缺少 dock 槽位与新的越界校验规则。为了避免旧数据把 dock 之外的东西
  // 错误地解释成 dock 槽位（导致图标尺寸错乱），升级到 v3。
  const STORAGE_KEY = 'lunaHomeLayout.v3';

  let editing = false;
  let dragging = false; // 是否有某一项正在被手指/鼠标拖动（不同于"处于编辑模式"）
  let longPressTimer = null;
  let dragCtx = null; // 当前拖拽上下文
  let suppressNextClick = false;

  /* ---------- 页面管理：完全动态，不再写死数量 ---------- */
  function pagesWrapEl() {
    return document.getElementById('pagesWrap');
  }
  function grids() {
    const wrap = pagesWrapEl();
    if (!wrap) return [];
    return Array.from(wrap.children).filter(el => el.classList && el.classList.contains('app-grid'));
  }
  function gridIndex(grid) {
    return grids().indexOf(grid);
  }
  function dockEl() {
    return document.getElementById('lunaDock');
  }

  /* ---------- 工具：读写元素的 grid-column / grid-row ---------- */
  // 注意：CSS 里像 "1 / -1" 这种用负数表示"到最后一列/行"的写法，
  // getComputedStyle 拿到的 gridColumnEnd/gridRowEnd 在很多浏览器上会
  // 原样返回 "-1"，而不是解析成具体的行号。如果直接拿 -1 去减 colStart，
  // 算出来的 span 会是负数，被 Math.max(1, ...) 强行钳成 1，
  // 相当于组件的真实宽高被"吃掉"了——这就是写死的组件（天气/好友/资料/
  // 通知/情侣/聊天等 widget）拖不动、位置一乱大小就跟着错的根本原因。
  // 这里做负数行号解析：负数从"总行数+1"往回数（CSS grid 规则）。
  function resolveLine(value, totalTracks) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n)) return null;
    if (n > 0) return n;
    if (n < 0) return totalTracks + 2 + n; // -1 => 最后一条线 = totalTracks+1
    return null;
  }

  function getItemRect(el) {
    const cs = getComputedStyle(el);
    const colStartRaw = parseInt(cs.gridColumnStart, 10);
    const rowStartRaw = parseInt(cs.gridRowStart, 10);

    const col = Number.isFinite(colStartRaw) && colStartRaw > 0 ? colStartRaw : 1;
    const row = Number.isFinite(rowStartRaw) && rowStartRaw > 0 ? rowStartRaw : 1;

    const colEnd = resolveLine(cs.gridColumnEnd, GRID_COLS);
    const rowEnd = resolveLine(cs.gridRowEnd, GRID_ROWS);

    let colSpan = (colEnd !== null) ? (colEnd - col) : 1;
    let rowSpan = (rowEnd !== null) ? (rowEnd - row) : 1;

    // 兜底：span 不合法时（例如意外的 0 或负数），保底为 1，
    // 但绝不能悄悄把本来占多格的写死组件缩成 1 格。
    if (!Number.isFinite(colSpan) || colSpan < 1) colSpan = 1;
    if (!Number.isFinite(rowSpan) || rowSpan < 1) rowSpan = 1;
    colSpan = Math.min(colSpan, GRID_COLS);
    rowSpan = Math.min(rowSpan, GRID_ROWS);

    return { col, colSpan, row, rowSpan };
  }

  function setItemRect(el, rect) {
    const colEnd = rect.col + rect.colSpan;
    const rowEnd = rect.row + rect.rowSpan;
    el.style.gridColumn = rect.colSpan > 1 ? `${rect.col} / ${colEnd}` : `${rect.col}`;
    el.style.gridRow = rect.rowSpan > 1 ? `${rect.row} / ${rowEnd}` : `${rect.row}`;
  }

  // 校验一个存储条目里的 col/row/colSpan/rowSpan 是否是合法、在网格范围内的值。
  // 用于过滤掉任何损坏/异常的历史存档，防止把错误数据重新套回界面。
  function isValidRectEntry(entry) {
    if (!entry) return false;
    const { col, row, colSpan, rowSpan } = entry;
    if (![col, row, colSpan, rowSpan].every(n => Number.isFinite(n))) return false;
    if (col < 1 || row < 1 || colSpan < 1 || rowSpan < 1) return false;
    if (col + colSpan - 1 > GRID_COLS) return false;
    if (row + rowSpan - 1 > GRID_ROWS) return false;
    return true;
  }

  function isItem(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList.contains('app')) return true;
    if (el.classList.contains('home-widget')) return true;
    return [...el.classList].some(c => c.startsWith('widget-'));
  }

  function itemsInGrid(grid) {
    return [...grid.children].filter(el => el.nodeType === 1 && isItem(el));
  }

  // Dock 里的项目目前只支持 App（不支持写死组件/自建组件——和真实手机一样，
  // dock 只放应用图标），用 .dock-app 标记。
  function isDockApp(el) {
    return !!(el && el.nodeType === 1 && el.classList.contains('dock-app'));
  }
  function dockApps() {
    const dock = dockEl();
    if (!dock) return [];
    return Array.from(dock.children).filter(el => el.nodeType === 1 && el.classList.contains('dock-app'));
  }

  // 一个元素是否是"写死在 HTML 里的原生组件"（天气/好友/资料/通知/情侣/聊天等），
  // 而不是用户后来自建添加的 home-widget。这类组件現在也允许被移除，
  // 但移除方式是"记入隐藏名单"而不是彻底删掉 DOM（方便"恢复默认"时找回）。
  function isBuiltinWidget(el) {
    return !el.classList.contains('app') && !el.classList.contains('home-widget') && isItem(el);
  }
  function builtinWidgetClass(el) {
    return [...el.classList].find(c => c.startsWith('widget-')) || '';
  }

  /* ---------- 布局持久化 ---------- */
  function loadLayout() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }
  function persist(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
  function pageStorageKey(grid) {
    // 用页面在当前 DOM 中的序号 + 原始 id（如果有）做 key，
    // 这样新增的页面（没有固定 id）也能正确保存/恢复。
    return grid.id ? grid.id : ('idx:' + gridIndex(grid));
  }
  function saveLayout() {
    const data = loadLayout();
    data.pageOrder = grids().map(g => pageStorageKey(g));
    grids().forEach(grid => {
      const pageKey = pageStorageKey(grid);
      data[pageKey] = itemsInGrid(grid).map(el => {
        const r = getItemRect(el);
        const entry = { key: itemKey(el), col: r.col, row: r.row, colSpan: r.colSpan, rowSpan: r.rowSpan };
        if (el.dataset.hwId) entry.widgetKind = el.dataset.hwKind || '';
        // 自定义设计组件：额外持久化用户的 HTML/CSS 内容，否则刷新页面后
        // 只靠 widgetKind='custom' 找不到对应的固定 catalog 条目，组件会丢失。
        if (el.dataset.hwKind === 'custom') {
          entry.customHtml = el.dataset.hwCustomHtml || '';
          entry.customCss = el.dataset.hwCustomCss || '';
        }
        return entry;
      });
    });
    // Dock 的当前排列（按 DOM 顺序即可，dock 是一维的，不需要行列坐标）
    data.dockOrder = dockApps().map(el => itemKey(el));
    persist(data);
  }
  function recordRemovedItem(grid, removeKey) {
    const data = loadLayout();
    const key = pageStorageKey(grid) + ':removed';
    data[key] = data[key] || [];
    if (!data[key].includes(removeKey)) data[key].push(removeKey);
    // 同时记一份到全局"已删除"列表，供召回面板统一展示、按删除时间倒序。
    data.removedLog = data.removedLog || [];
    data.removedLog = data.removedLog.filter(r => r.key !== removeKey); // 去重，保留最新一条
    data.removedLog.push({ key: removeKey, pageKey: key.slice(0, -8), name: itemDisplayNameByKey(grid, removeKey), t: Date.now() });
    persist(data);
  }
  function unrecordRemovedItem(pageKeyOrGrid, removeKey) {
    const data = loadLayout();
    const pageKey = typeof pageKeyOrGrid === 'string' ? pageKeyOrGrid : pageStorageKey(pageKeyOrGrid);
    const key = pageKey + ':removed';
    if (Array.isArray(data[key])) {
      data[key] = data[key].filter(k => k !== removeKey);
    }
    data.removedLog = (data.removedLog || []).filter(r => !(r.key === removeKey && r.pageKey === pageKey));
    persist(data);
  }
  function itemKey(el) {
    if (el.dataset.app) return 'app:' + el.dataset.app;
    if (el.dataset.hwId) return 'hw:' + el.dataset.hwId;
    const wcls = builtinWidgetClass(el);
    return 'w:' + (wcls || el.className);
  }
  function itemDisplayNameByKey(grid, key) {
    // 删除的一瞬间元素可能还在 DOM 里（调用顺序上 recordRemovedItem 先于 el.remove()），
    // 所以可以直接按 key 找到对应元素来读名字。
    if (key.indexOf('app:') === 0) {
      const appName = key.slice(4);
      const el = (grid && grid.querySelector(`.app[data-app="${CSS.escape(appName)}"]`))
        || document.querySelector(`.app[data-app="${CSS.escape(appName)}"]`);
      if (el) return itemDisplayName(el);
      return appName;
    }
    if (key.indexOf('w:') === 0) {
      const cls = key.slice(2);
      const el = cls ? (grid && grid.querySelector('.' + CSS.escape(cls))) : null;
      if (el) return itemDisplayName(el);
      return '组件';
    }
    return '此项目';
  }
  function applyStoredLayout() {
    const data = loadLayout();
    grids().forEach(grid => {
      const pageKey = pageStorageKey(grid);
      const stored = data[pageKey];
      if (!stored) return;

      // 先重建保存过的自建组件（home-widget），它们不在原始 HTML 里
      stored.forEach(entry => {
        if (!entry || entry.key.indexOf('hw:') !== 0) return;
        const uid = entry.key.slice(3);
        if (grid.querySelector(`[data-hw-id="${uid}"]`)) return;
        const kind = entry.widgetKind;

        if (kind === 'custom') {
          // 自定义设计组件：内容存的是用户自己的 HTML/CSS，不是固定 catalog 条目
          const el = document.createElement('div');
          el.className = 'home-widget home-widget-custom';
          el.dataset.hwId = uid;
          el.dataset.hwKind = 'custom';
          el.dataset.hwCustomHtml = entry.customHtml || '';
          el.dataset.hwCustomCss = entry.customCss || '';
          el.innerHTML = customWidgetInnerHtml(uid, entry.customHtml || '', entry.customCss || '');
          grid.appendChild(el);
          return;
        }

        const catalogEntry = WIDGET_CATALOG.find(w => w.id === kind);
        if (!catalogEntry) return;
        const el = document.createElement('div');
        el.className = 'home-widget';
        el.dataset.hwId = uid;
        el.dataset.hwKind = catalogEntry.id;
        el.innerHTML = widgetInnerHtml(catalogEntry, uid);
        grid.appendChild(el);
        initLiveWidget(catalogEntry.id, uid);
      });

      // 再应用所有已知项目的位置——但先做合法性校验，
      // 任何越界/损坏的历史记录一律跳过，保留元素的 CSS 默认位置和尺寸，
      // 避免把写死组件挤压/位移成错误的样子。
      stored.forEach(entry => {
        if (!isValidRectEntry(entry)) return;
        const el = itemsInGrid(grid).find(e => itemKey(e) === entry.key);
        if (el) setItemRect(el, { col: entry.col, row: entry.row, colSpan: entry.colSpan, rowSpan: entry.rowSpan });
      });

      // 项目（App 或写死组件）若之前被用户移除过，则本次加载也不显示。
      // 移除前先归档一份（页面刷新后内存归档会丢失，这里重新补上），
      // 这样"已删除"面板在刷新页面后依然能找回同样的原始节点。
      const removedKeys = data[pageKey + ':removed'] || [];
      removedKeys.forEach(rk => {
        if (rk.indexOf('app:') === 0) {
          const appName = rk.slice(4);
          const el = grid.querySelector(`.app[data-app="${CSS.escape(appName)}"]`);
          if (el) { archiveNode(rk, el); el.remove(); }
        } else if (rk.indexOf('w:') === 0) {
          const cls = rk.slice(2);
          const el = cls ? grid.querySelector('.' + CSS.escape(cls)) : null;
          if (el) { archiveNode(rk, el); el.remove(); }
        }
      });
    });

    // 恢复"用户新增的空白页面"：读取存过的页面顺序，
    // 如果发现比当前 DOM 更多的页面标记为"用户新增页面"，重新建出来。
    const extraPages = data.userAddedPages || [];
    extraPages.forEach(pid => {
      if (document.getElementById(pid)) return;
      createEmptyPageEl(pid, true);
    });

    // 恢复 Dock 的排列（含从主屏移入 dock、或从 dock 移到主屏的历史操作）
    applyStoredDock(data);
  }

  // Dock 存储格式：data.dockOrder = ['app:xxx', ...]（最多 DOCK_SLOTS 个）。
  // 如果某个 key 原本属于某个主屏页面（说明用户把它从主屏拖进了 dock），
  // 需要把对应 DOM 元素从主屏挪到 dock 里，并切换成 dock 尺寸样式。
  function applyStoredDock(data) {
    const dock = dockEl();
    if (!dock) return;

    // 原生写死在 dock 里的 app，如果之前被用户移除过，隐藏并归档
    const dockRemovedKey = dock.id + ':removed';
    const dockRemoved = data[dockRemovedKey] || [];
    dockRemoved.forEach(rk => {
      if (rk.indexOf('app:') !== 0) return;
      const appName = rk.slice(4);
      const el = dock.querySelector(`.dock-app[data-app="${CSS.escape(appName)}"]`);
      if (el) { archiveNode(rk, el); el.remove(); }
    });

    const order = data.dockOrder;
    if (!Array.isArray(order) || !order.length) return;

    order.forEach(key => {
      if (key.indexOf('app:') !== 0) return; // dock 目前只支持 app
      const appName = key.slice(4);
      let el = dock.querySelector(`.dock-app[data-app="${CSS.escape(appName)}"]`);
      if (el) return; // 已经在 dock 里（原生写死的 dock app），保持原位
      // 到各主屏页面里找这个 app，把它挪进 dock
      for (const grid of grids()) {
        const found = grid.querySelector(`.app[data-app="${CSS.escape(appName)}"]`);
        if (found) {
          convertAppToDockShape(found);
          dock.appendChild(found);
          break;
        }
      }
    });

    // 按存储顺序重排 dock 内的 DOM 顺序
    order.forEach(key => {
      if (key.indexOf('app:') !== 0) return;
      const appName = key.slice(4);
      const el = dock.querySelector(`.dock-app[data-app="${CSS.escape(appName)}"]`);
      if (el) dock.appendChild(el);
    });
  }

  function resetAllToDefault() {
    if (!window.confirm('恢复默认桌面布局？\n将清除所有自定义排列、已添加的组件与新增页面，被移除的原始 App/组件也会恢复显示，Dock 也会恢复默认图标。此操作不可撤销。')) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  }

  /* ---------- 占用表（主屏网格） ---------- */
  function buildOccupancy(grid, excludeEl) {
    const occ = Array.from({ length: GRID_ROWS + 1 }, () => Array(GRID_COLS + 1).fill(null));
    itemsInGrid(grid).forEach(el => {
      if (el === excludeEl) return;
      const r = getItemRect(el);
      for (let rr = r.row; rr < r.row + r.rowSpan; rr++) {
        for (let cc = r.col; cc < r.col + r.colSpan; cc++) {
          if (rr <= GRID_ROWS && cc <= GRID_COLS) occ[rr][cc] = el;
        }
      }
    });
    return occ;
  }

  function fits(occ, col, row, colSpan, rowSpan) {
    if (col < 1 || row < 1 || col + colSpan - 1 > GRID_COLS || row + rowSpan - 1 > GRID_ROWS) return false;
    for (let rr = row; rr < row + rowSpan; rr++) {
      for (let cc = col; cc < col + colSpan; cc++) {
        if (occ[rr][cc]) return false;
      }
    }
    return true;
  }

  function findNearestFree(occ, wantCol, wantRow, colSpan, rowSpan) {
    let best = null, bestDist = Infinity;
    for (let row = 1; row <= GRID_ROWS - rowSpan + 1; row++) {
      for (let col = 1; col <= GRID_COLS - colSpan + 1; col++) {
        if (fits(occ, col, row, colSpan, rowSpan)) {
          const d = Math.abs(col - wantCol) + Math.abs(row - wantRow);
          if (d < bestDist) { bestDist = d; best = { col, row }; }
        }
      }
    }
    return best;
  }

  /* ---------- 长按检测 & 进入/退出编辑模式 ---------- */
  function attachLongPress(el, grid) {
    if (el.dataset.ibLongPressBound) return;
    el.dataset.ibLongPressBound = '1';
    el.addEventListener('pointerdown', (e) => {
      if (editing) return; // 已在编辑模式，交给拖拽逻辑
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        enterEditMode();
      }, LONG_PRESS_MS);
      const cancel = () => clearTimeout(longPressTimer);
      el.addEventListener('pointerup', cancel, { once: true });
      el.addEventListener('pointerleave', cancel, { once: true });
      el.addEventListener('pointercancel', cancel, { once: true });
    });
  }

  function enterEditMode() {
    if (editing) return;
    editing = true;
    document.body.classList.add('home-editing');
    grids().forEach(grid => {
      itemsInGrid(grid).forEach(el => {
        attachDrag(el);
        addRemoveBadge(el); // 现在所有项目（App / 写死组件 / 自建组件）都能删
      });
    });
    // Dock 里的 app 同样进入可拖拽/可删除状态
    const dock = dockEl();
    if (dock) {
      document.body.classList.add('home-editing-dock');
      dockApps().forEach(el => {
        attachDrag(el);
        addRemoveBadge(el);
      });
    }
    showToolbar();
    showAddPageAffordance();
  }

  function exitEditMode() {
    editing = false;
    document.body.classList.remove('home-editing');
    document.body.classList.remove('home-editing-dock');
    document.querySelectorAll('.ib-remove-badge').forEach(b => b.remove());
    saveLayout();
    hideToolbar();
    hideAddPageAffordance();
    cleanupEmptyUserPages();
    if (window.LunaPager) window.LunaPager.refresh();
  }

  /* ---------- 删除角标（App / 写死组件 / 自建组件 / Dock App 通用） ---------- */
  // 同样不捕获 container：元素绑定角标之后完全可能被拖去了别的容器
  // （主屏页面之间、或主屏 ↔ dock），点击删除时必须按它"此刻"真正所在的
  // 容器来记录移除信息，否则会把删除记录写进错误的页面/dock 存档里。
  function addRemoveBadge(el) {
    if (el.querySelector(':scope > .ib-remove-badge')) return;
    const badge = document.createElement('div');
    badge.className = 'ib-remove-badge';
    badge.addEventListener('pointerdown', (e) => e.stopPropagation());
    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const liveContainer = el.parentElement;
      if (!liveContainer) return;
      confirmRemoveItem(el, liveContainer);
    });
    el.appendChild(badge);
  }

  function itemDisplayName(el) {
    const label = el.querySelector('.app-label');
    if (label) return label.textContent;
    if (el.classList.contains('dock-app')) {
      // dock app 没有文字标签，退回用 data-app 名称的中文映射（如果有的话）表意即可
      return el.dataset.app || 'Dock 图标';
    }
    if (el.classList.contains('widget-time-weather')) return '天气时间组件';
    if (el.classList.contains('widget-friends')) return '好友组件';
    if (el.classList.contains('widget-profile')) return '个人资料组件';
    if (el.classList.contains('widget-notif')) return '通知组件';
    if (el.classList.contains('widget-duo')) return '情侣组件';
    if (el.classList.contains('widget-chat')) return '聊天组件';
    if (el.dataset.hwKind === 'custom') return '自定义组件';
    if (el.dataset.hwKind) {
      const c = WIDGET_CATALOG.find(w => w.id === el.dataset.hwKind);
      if (c) return c.name;
    }
    return '此项目';
  }

  // 删除一个项目：写死组件/App 会先归档 DOM 节点（供"已删除"面板原样恢复），
  // 再记入隐藏名单、从 DOM 移除。自建 home-widget 不需要归档——它本来就是
  // 从存档数据重建出来的，删除后从存档数组里拿掉即可（saveLayout 会自动重算）。
  function confirmRemoveItem(el, container) {
    const name = itemDisplayName(el);
    if (!window.confirm(`从主屏幕移除"${name}"？\n移除后可在编辑工具条的"已删除"里找回。`)) return;

    let key = null;
    if (isDockApp(el)) {
      if (el.dataset.app) key = 'app:' + el.dataset.app;
      if (key) recordRemovedItem(dockEl(), key);
    } else if (el.classList.contains('app')) {
      if (el.dataset.app) key = 'app:' + el.dataset.app;
      if (key) recordRemovedItem(container, key);
    } else if (isBuiltinWidget(el)) {
      const cls = builtinWidgetClass(el);
      if (cls) key = 'w:' + cls;
      if (key) recordRemovedItem(container, key);
    }

    if (key) archiveNode(key, el);

    el.remove();
    saveLayout();
    if (!isDockApp(el)) maybeAutoRemoveEmptyPage(container);
    refreshRemovedPanelIfOpen();
  }

  /* ================================================================
     已删除项目召回面板
  ================================================================ */
  let removedSheetEl = null, removedOverlayEl = null;

  function pageDisplayLabel(pageKey) {
    if (dockEl() && pageKey === dockEl().id) return 'Dock';
    const grid = grids().find(g => pageStorageKey(g) === pageKey);
    if (!grid) return pageKey;
    const idx = gridIndex(grid);
    return `第 ${idx + 1} 页`;
  }

  function collectRemovedEntries() {
    const data = loadLayout();
    const log = Array.isArray(data.removedLog) ? data.removedLog.slice() : [];
    // 只保留仍然真实处于"已移除"状态的条目（防止恢复后日志没同步而出现幽灵项）
    return log.filter(entry => {
      const removedList = data[entry.pageKey + ':removed'] || [];
      return removedList.includes(entry.key);
    }).sort((a, b) => b.t - a.t);
  }

  function openRemovedPanel() {
    if (!removedOverlayEl) {
      removedOverlayEl = document.createElement('div');
      removedOverlayEl.className = 'ib-widget-overlay';
      removedSheetEl = document.createElement('div');
      removedSheetEl.className = 'ib-widget-sheet ib-removed-sheet';
      removedSheetEl.innerHTML = `
        <div class="ib-sheet-handle"></div>
        <div class="ib-sheet-header">
          <div class="ib-sheet-title">已删除项目</div>
          <button class="ib-sheet-close" id="ibRemovedCloseBtn">关闭</button>
        </div>
        <div class="ib-removed-body" id="ibRemovedBody"></div>
      `;
      document.body.appendChild(removedOverlayEl);
      document.body.appendChild(removedSheetEl);
      removedOverlayEl.addEventListener('click', closeRemovedPanel);
      removedSheetEl.querySelector('#ibRemovedCloseBtn').addEventListener('click', closeRemovedPanel);
    }
    renderRemovedPanel();
    requestAnimationFrame(() => {
      removedOverlayEl.classList.add('show');
      removedSheetEl.classList.add('show');
    });
  }
  function closeRemovedPanel() {
    if (removedOverlayEl) removedOverlayEl.classList.remove('show');
    if (removedSheetEl) removedSheetEl.classList.remove('show');
  }
  function refreshRemovedPanelIfOpen() {
    if (removedSheetEl && removedSheetEl.classList.contains('show')) renderRemovedPanel();
  }

  function renderRemovedPanel() {
    const body = removedSheetEl.querySelector('#ibRemovedBody');
    const entries = collectRemovedEntries();
    if (!entries.length) {
      body.innerHTML = `<div class="ib-removed-empty">暂无已删除的项目</div>`;
      return;
    }
    body.innerHTML = '';
    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = 'ib-removed-row';
      row.innerHTML = `
        <div class="ib-removed-info">
          <div class="ib-removed-name">${escapeHtml(entry.name)}</div>
          <div class="ib-removed-from">来自 ${escapeHtml(pageDisplayLabel(entry.pageKey))}</div>
        </div>
        <button class="ib-removed-restore">恢复</button>
      `;
      row.querySelector('.ib-removed-restore').addEventListener('click', () => {
        restoreRemovedEntry(entry);
      });
      body.appendChild(row);
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = String(s == null ? '' : s);
    return d.innerHTML;
  }

  function restoreRemovedEntry(entry) {
    unrecordRemovedItem(entry.pageKey, entry.key);

    if (entry.key.indexOf('app:') === 0) {
      const appName = entry.key.slice(4);
      const isDockTarget = entry.pageKey === (dockEl() && dockEl().id);
      if (isDockTarget) {
        restoreAppToDock(appName);
      } else {
        const grid = grids().find(g => pageStorageKey(g) === entry.pageKey);
        restoreAppToPage(appName, grid || grids()[0]);
      }
    } else if (entry.key.indexOf('w:') === 0) {
      const cls = entry.key.slice(2);
      const grid = grids().find(g => pageStorageKey(g) === entry.pageKey);
      restoreBuiltinWidgetToPage(cls, grid || grids()[0]);
    }

    saveLayout();
    renderRemovedPanel();
    if (window.LunaPager) window.LunaPager.refresh();
  }

  // App 曾经存在于某个主屏页面，但当前 DOM 里已经被删除——由于我们从不真正
  // 销毁"写死在 HTML 里"的元素的数据本体（只是 el.remove()，元素对象仍在内存中
  // 只要没被垃圾回收），最稳妥的恢复方式是：查找页面残留的原始节点缓存。
  // 但更稳健、不依赖内存缓存的做法，是我们在删除前先做一次快照备份（见 removalArchive）。
  function restoreAppToPage(appName, grid) {
    const archived = takeArchivedNode('app:' + appName);
    if (!archived) return; // 理论上不会发生：删除时必定会先归档
    if (!grid) grid = grids()[0];
    const rect = archived.__ibArchivedRect || { colSpan: 1, rowSpan: 1 };
    const occ = buildOccupancy(grid, null);
    const pos = findNearestFree(occ, 1, 1, rect.colSpan || 1, rect.rowSpan || 1) || { col: 1, row: 1 };
    setItemRect(archived, { col: pos.col, row: pos.row, colSpan: rect.colSpan || 1, rowSpan: rect.rowSpan || 1 });
    grid.appendChild(archived);
    attachLongPress(archived, grid);
    if (editing) { attachDrag(archived); addRemoveBadge(archived); }
  }

  function restoreAppToDock(appName) {
    const archived = takeArchivedNode('app:' + appName);
    if (!archived) return;
    const dock = dockEl();
    if (!dock) return;
    if (dockApps().length >= DOCK_SLOTS) {
      alert('Dock 已满（最多 ' + DOCK_SLOTS + ' 个），请先从 Dock 移除一个图标，或改为恢复到主屏。');
      // 放回归档，避免丢失
      archiveNode('app:' + appName, archived);
      return;
    }
    convertAppToDockShape(archived);
    dock.appendChild(archived);
    attachLongPress(archived, dock);
    if (editing) { attachDrag(archived); addRemoveBadge(archived); }
  }

  function restoreBuiltinWidgetToPage(cls, grid) {
    const archived = takeArchivedNode('w:' + cls);
    if (!archived) return;
    if (!grid) grid = grids()[0];
    const rect = archived.__ibArchivedRect || { colSpan: 1, rowSpan: 1 };
    const occ = buildOccupancy(grid, null);
    const pos = findNearestFree(occ, 1, 1, rect.colSpan || 1, rect.rowSpan || 1) || { col: 1, row: 1 };
    setItemRect(archived, { col: pos.col, row: pos.row, colSpan: rect.colSpan || 1, rowSpan: rect.rowSpan || 1 });
    grid.appendChild(archived);
    attachLongPress(archived, grid);
    if (editing) { attachDrag(archived); addRemoveBadge(archived); }
  }

  // ---- 删除归档：删除一个"写死在 HTML 里"的元素前，先把它的 DOM 节点原样
  // 存一份在内存里（不挂载在页面上），这样"召回"时能拿回一模一样的节点
  // （包括内部的 svg、原有的 class、内联样式等），不需要凭空重建、也不会
  // 因为凭空重建漏掉某些内联样式/事件而导致外观和原来不一致。
  const removalArchive = new Map(); // key -> { node, rect }
  function archiveNode(key, node) {
    // 必须在 el.remove() 之前、节点还在 DOM 里时读取 rect 快照——
    // 节点一旦脱离 DOM，getComputedStyle 在部分浏览器上会返回不可靠的默认值，
    // 如果召回时才现读会导致组件尺寸（如天气组件 4×4）被错误地读成 1×1。
    const isDock = isDockApp(node);
    const rect = isDock ? { col: 1, row: 1, colSpan: 1, rowSpan: 1 } : getItemRect(node);
    removalArchive.set(key, { node, rect });
  }
  function takeArchivedNode(key) {
    const entry = removalArchive.get(key);
    if (!entry) return null;
    removalArchive.delete(key);
    const node = entry.node;
    // 清掉拖拽/长按遗留的绑定标记和视觉状态，恢复干净状态以便重新绑定
    node.removeAttribute('data-ib-drag-bound');
    node.removeAttribute('data-ib-long-press-bound');
    node.classList.remove('ib-dragging');
    node.style.transform = '';
    const badge = node.querySelector(':scope > .ib-remove-badge');
    if (badge) badge.remove();
    node.__ibArchivedRect = entry.rect;
    return node;
  }

  /* ================================================================
     拖拽排序 / 跨页拖拽 / Dock 进出（指针事件，兼容触屏与鼠标）
  ================================================================ */
  // 注意：不在闭包里捕获 container——元素可能在此后被跨页拖拽或拖进/拖出 dock，
  // 导致它的实际父容器发生变化。如果这里把 container 存进闭包，绑定时刻之后
  // 发生的任何迁移都不会被这个监听器感知到，下一次拖拽会用错误的坐标系
  // （比如明明已经在 dock 里了，却仍按主屏网格的行列去计算落点）。
  // 所以每次 pointerdown 时都重新读取 el.parentElement 作为当前真实容器。
  function attachDrag(el) {
    if (el.dataset.ibDragBound) return;
    el.dataset.ibDragBound = '1';

    el.addEventListener('pointerdown', (e) => {
      if (!editing) return;
      if (e.target.closest('.ib-remove-badge')) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const liveContainer = el.parentElement;
      if (!liveContainer) return;
      startDrag(el, liveContainer, e);
    });
  }

  function isDockContainer(c) { return c && c.id === 'lunaDock'; }

  function startDrag(el, container, e) {
    const isDock = isDockContainer(container);
    const rect = isDock ? { col: 1, row: 1, colSpan: 1, rowSpan: 1 } : getItemRect(el);
    const box = container.getBoundingClientRect();
    const cellW = box.width / (isDock ? DOCK_SLOTS : GRID_COLS);
    const cellH = box.height / (isDock ? 1 : GRID_ROWS);

    dragCtx = {
      el,
      container,        // 当前所在的容器（页面 grid 或 dock），会在跨容器拖拽时动态更新
      originContainer: container,
      originIsDock: isDock,
      rect,
      // 不可变快照：这个项目"真实、原始"的宽高（例如天气组件永远是 4×4）。
      // 拖拽全程只读不改，跨页/跨容器搬运时一律以它为准，避免被中途的
      // 临时状态（如 dock 1×1 形态）污染，这是修复跨页尺寸丢失 bug 的关键。
      originRect: { colSpan: rect.colSpan, rowSpan: rect.rowSpan },
      pageFlipBlocked: null, // 记录"当前因放不下而被拒绝跨入"的目标页面，避免同一页反复重试
      startX: e.clientX, startY: e.clientY,
      refX: e.clientX, refY: e.clientY, // 计算目标格子用的位移基准点，跨容器切换时会重置
      lastPointerX: e.clientX, lastPointerY: e.clientY,
      cellW, cellH,
      lastCol: rect.col, lastRow: rect.row,
      pointerId: e.pointerId,
      curIsDock: isDock,
      edgeSide: null,       // 'left' | 'right' | null —— 当前是否停在翻页边缘
      edgeTimer: null,
      overDock: isDock      // 拖拽过程中指针当前是否悬停在 dock 区域上方
    };
    dragging = true;
    el.classList.add('ib-dragging');

    // 关键修复：拖拽期间必须锁住整个页面的手势，
    // 否则手机上系统会把这次拖动识别成"翻页"或"滚动"，
    // pointermove 事件会被浏览器吞掉，表现为"拖不动"。
    // 注意：这个锁只在"手指真的按住图标移动"这段时间生效，
    // 松手后立刻解锁——编辑模式本身并不会阻止翻页。
    document.body.classList.add('ib-drag-lock');
    if (typeof el.setPointerCapture === 'function' && e.pointerId != null) {
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* 部分浏览器可能报错，忽略 */ }
    }

    const onMove = (ev) => onDragMove(ev);
    const onUp = (ev) => onDragEnd(ev, onMove, onUp);
    document.addEventListener('pointermove', onMove, { passive: false });
    document.addEventListener('pointerup', onUp, { once: true });
    document.addEventListener('pointercancel', onUp, { once: true });
  }

  // 拖拽时指针是否悬停在 dock 区域上方（用屏幕坐标做命中测试，
  // 不依赖当前 container，因为 container 会随跨容器切换而改变）。
  function pointOverDock(clientX, clientY) {
    const dock = dockEl();
    if (!dock) return false;
    const r = dock.getBoundingClientRect();
    // dock 区域向上做一点余量，方便从主屏网格底部拖入时更容易命中
    const pad = 14;
    return clientX >= r.left - pad && clientX <= r.right + pad &&
           clientY >= r.top - pad && clientY <= r.bottom + pad;
  }

  function pointOverGrid(clientX, clientY, grid) {
    const r = grid.getBoundingClientRect();
    return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
  }

  function onDragMove(e) {
    if (!dragCtx) return;
    if (e.cancelable) e.preventDefault(); // 阻止触屏默认滚动/翻页手势抢走拖拽
    const dx = e.clientX - dragCtx.startX;
    const dy = e.clientY - dragCtx.startY;
    dragCtx.lastPointerX = e.clientX;
    dragCtx.lastPointerY = e.clientY;

    // 视觉跟随（用 transform，避免打断 grid/dock 布局计算）
    dragCtx.el.style.transform = `translate(${dx}px, ${dy}px) scale(1.08)`;

    handleEdgePageFlip(e);
    handleDockHoverTransition(e);

    if (dragCtx.curIsDock) {
      onDragMoveInDock(e);
    } else {
      onDragMoveInGrid(e);
    }
  }

  // ---- 跨页拖拽：拖到屏幕左/右边缘并停留一小段时间，自动翻到上一页/下一页 ----
  function handleEdgePageFlip(e) {
    if (dragCtx.curIsDock) { clearEdgeTimer(); return; } // dock 内拖拽不涉及翻页
    const wrap = pagesWrapEl();
    if (!wrap) return;
    const frameBox = (wrap.parentElement || wrap).getBoundingClientRect();
    const x = e.clientX;
    let side = null;
    if (x <= frameBox.left + EDGE_ZONE_PX) side = 'left';
    else if (x >= frameBox.right - EDGE_ZONE_PX) side = 'right';

    if (side === dragCtx.edgeSide) return; // 状态没变化
    clearEdgeTimer();
    dragCtx.edgeSide = side;
    if (!side) return;

    dragCtx.edgeTimer = setTimeout(() => {
      flipPageDuringDrag(side);
      // 翻页后允许再次触发（连续停留可以连续翻页）
      dragCtx.edgeSide = null;
      handleEdgePageFlip(e);
    }, EDGE_FLIP_MS);
  }
  function clearEdgeTimer() {
    if (dragCtx.edgeTimer) { clearTimeout(dragCtx.edgeTimer); dragCtx.edgeTimer = null; }
  }

  function flipPageDuringDrag(side) {
    if (!window.LunaPager) return;
    const cur = window.LunaPager.currentPage();
    const total = window.LunaPager.totalPages();
    const next = side === 'left' ? cur - 1 : cur + 1;
    if (next < 0 || next >= total) return; // 已经是第一页/最后一页，不翻
    window.LunaPager.goTo(next);

    // 把正在拖拽的元素挪到新页面的 grid 里，这样才能继续在新页面上找落点。
    const targetGrid = grids()[next];
    if (!targetGrid || dragCtx.curIsDock) return;
    if (dragCtx.container === targetGrid) return;
    // 目标页此前已经因为放不下这个组件的真实尺寸而拒绝过——翻页本身仍然
    // 允许（用户可以只是路过去看别的页面），但不重复尝试搬运，元素保持
    // 留在原容器原位（即"自动回弹"），直到用户松手或换到另一个能放下的页面。
    if (dragCtx.pageFlipBlocked === targetGrid) return;
    moveDragElToContainer(targetGrid, false);
  }

  // ---- 处理"拖拽悬停到 dock 上方 / 离开 dock"这两种状态切换：
  //      切换时需要同步转换元素的视觉形态（app <-> dock-app 尺寸），
  //      否则移入/移出 dock 时图标大小会跳变或错位。
  function handleDockHoverTransition(e) {
    if (isDockApp(dragCtx.el) === false && dragCtx.el.classList.contains('app') === false) {
      return; // 目前只有普通 App 支持进出 dock；写死组件/自建组件保持在主屏内
    }
    const overDock = pointOverDock(e.clientX, e.clientY);
    if (overDock === dragCtx.overDock) return;
    dragCtx.overDock = overDock;

    const dock = dockEl();
    if (!dock) return;

    if (overDock && !dragCtx.curIsDock) {
      // 从主屏拖入 dock 悬停区：切换成 dock 尺寸的视觉形态，并寄养到 dock 容器里
      moveDragElToContainer(dock, true);
    } else if (!overDock && dragCtx.curIsDock) {
      // 从 dock 拖出到主屏区域：如果当前正悬停在某个主屏页面上，切回主屏形态并寄养过去；
      // 否则先留在 dock 视觉形态，等指针真正进入某个 grid 再切换（避免中间态难看）。
      const hoverGrid = grids().find(g => pointOverGrid(e.clientX, e.clientY, g));
      const targetGrid = hoverGrid || grids()[window.LunaPager ? window.LunaPager.currentPage() : 0];
      if (targetGrid) moveDragElToContainer(targetGrid, false);
    }
  }

  // 把正在拖拽的元素从当前容器移动到目标容器（grid 或 dock），
  // 并按目标容器类型切换视觉形态（app-face 58px+label ↔ dock-face 58px 无 label 但 svg 更小），
  // 同时重置拖拽上下文里的坐标系（cellW/cellH/lastCol/lastRow）以匹配新容器。
  //
  // 关键修复（尺寸丢失 bug）：此前从主屏跨页/跨容器时（toDock === false 分支），
  // 这里无条件把 dragCtx.rect 写死成 { colSpan: 1, rowSpan: 1 }——这只对"App"
  // 是对的（App 本来就是 1×1），但对天气(4×4)/好友(2×2)/资料(4×2)/通知(4×1)/
  // 聊天(4×4)等写死组件、以及自建组件（如 2×2 时钟、2×4/4×2 等自定义尺寸组件）
  // 是错的：一旦拖着这些组件停留在屏幕边缘触发自动翻页，它们的宽高会被
  // 平白无故地压缩成 1×1，看起来就像"跑版/尺寸乱了"。
  // 现在改为：跨容器时始终沿用该元素"拖拽开始时的原始 colSpan/rowSpan"
  // （dragCtx.originRect，在 startDrag 里一次性读取、全程不变），只在新页面里
  // 按这个真实尺寸重新找空位；如果新页面放不下这个尺寸，就不搬过去——
  // 保持元素留在原页面原位（相当于自动"回弹"），并标记 pageFlipBlocked，
  // 避免同一次拖拽反复尝试搬入同一个放不下的页面。
  function moveDragElToContainer(targetContainer, toDock) {
    const el = dragCtx.el;
    const originRect = dragCtx.originRect || dragCtx.rect;

    if (!toDock) {
      // 先在目标页面试算：这个组件的真实尺寸能否放得下，放不下就不搬，直接回弹（保持原位）。
      const occProbe = buildOccupancy(targetContainer, null);
      const pos = findNearestFree(occProbe, dragCtx.lastCol || 1, dragCtx.lastRow || 1, originRect.colSpan, originRect.rowSpan);
      if (!pos) {
        dragCtx.pageFlipBlocked = targetContainer;
        return; // 目标页面容不下，保持在原容器/原位置，什么都不做
      }
      dragCtx.pageFlipBlocked = null;

      const prevTransform = el.style.transform;
      el.style.transform = '';
      convertDockShapeToApp(el);
      targetContainer.appendChild(el);
      const box = targetContainer.getBoundingClientRect();
      dragCtx.cellW = box.width / GRID_COLS;
      dragCtx.cellH = box.height / GRID_ROWS;
      // 沿用原始 colSpan/rowSpan，绝不缩成 1×1
      dragCtx.rect = { col: pos.col, row: pos.row, colSpan: originRect.colSpan, rowSpan: originRect.rowSpan };
      setItemRect(el, dragCtx.rect);

      dragCtx.container = targetContainer;
      dragCtx.curIsDock = false;
      dragCtx.lastCol = dragCtx.rect.col;
      dragCtx.lastRow = dragCtx.rect.row;
      dragCtx.refX = dragCtx.lastPointerX != null ? dragCtx.lastPointerX : dragCtx.startX;
      dragCtx.refY = dragCtx.lastPointerY != null ? dragCtx.lastPointerY : dragCtx.startY;
      el.style.transform = prevTransform;
      return;
    }

    // 拖入 dock：只有普通 App 支持进出 dock（写死组件/自建组件不允许拖进 dock，
    // 调用方 handleDockHoverTransition 已经做了这个限制），dock 图标固定 1×1，
    // 这里的 1×1 是 dock 槽位本身的真实尺寸，不是"丢失原尺寸"。
    const prevTransform = el.style.transform;
    el.style.transform = '';
    targetContainer.appendChild(el);
    convertAppToDockShape(el);
    const box = targetContainer.getBoundingClientRect();
    dragCtx.cellW = box.width / DOCK_SLOTS;
    dragCtx.cellH = box.height;
    dragCtx.rect = { col: 1, row: 1, colSpan: 1, rowSpan: 1 };

    dragCtx.container = targetContainer;
    dragCtx.curIsDock = true;
    dragCtx.lastCol = 1;
    dragCtx.lastRow = 1;
    dragCtx.refX = dragCtx.lastPointerX != null ? dragCtx.lastPointerX : dragCtx.startX;
    dragCtx.refY = dragCtx.lastPointerY != null ? dragCtx.lastPointerY : dragCtx.startY;
    el.style.transform = prevTransform;
  }

  // App → Dock 形态：去掉文字标签（dock 不显示文字），并给 app-face 换成 dock 专属类名
  // 来源用同一份 CSS 尺寸变量控制，保证「放进 dock」和「原生 dock 图标」大小完全一致。
  function convertAppToDockShape(el) {
    if (!el.classList.contains('app')) return;
    el.classList.remove('app');
    el.classList.add('dock-app');
    el.classList.add('ib-migrated'); // 标记：曾经在主屏/dock之间迁移过，供样式/调试识别
    const face = el.querySelector('.app-face');
    if (face) {
      face.classList.remove('app-face');
      face.classList.add('dock-face');
    }
    const label = el.querySelector('.app-label');
    if (label) label.style.display = 'none'; // 隐藏而不删除，方便挪回主屏时原样恢复文字
    el.style.gridColumn = '';
    el.style.gridRow = '';
  }
  // Dock → App 形态：还原文字标签显示，把 dock-face 换回 app-face
  function convertDockShapeToApp(el) {
    if (!el.classList.contains('dock-app')) return;
    el.classList.remove('dock-app');
    el.classList.add('app');
    const face = el.querySelector('.dock-face');
    if (face) {
      face.classList.remove('dock-face');
      face.classList.add('app-face');
    }
    const label = el.querySelector('.app-label');
    if (label) label.style.display = '';
  }

  function onDragMoveInGrid(e) {
    const { el, container: grid, rect, refX, refY, cellW, cellH } = dragCtx;
    const dx = e.clientX - refX;
    const dy = e.clientY - refY;
    dragCtx.lastDx = e.clientX - dragCtx.startX;
    dragCtx.lastDy = e.clientY - dragCtx.startY;

    // 计算目标格子
    const deltaCol = Math.round(dx / cellW);
    const deltaRow = Math.round(dy / cellH);
    let targetCol = Math.min(Math.max(rect.col + deltaCol, 1), GRID_COLS - rect.colSpan + 1);
    let targetRow = Math.min(Math.max(rect.row + deltaRow, 1), GRID_ROWS - rect.rowSpan + 1);

    if (targetCol === dragCtx.lastCol && targetRow === dragCtx.lastRow) return;

    const occ = buildOccupancy(grid, el);
    if (fits(occ, targetCol, targetRow, rect.colSpan, rect.rowSpan)) {
      dragCtx.lastCol = targetCol;
      dragCtx.lastRow = targetRow;
      return;
    }

    // 目标位置被占用：尝试与占用者交换（仅当占用者与自己 span 相同时做简单交换）
    let blocker = null;
    for (let rr = targetRow; rr < targetRow + rect.rowSpan && !blocker; rr++) {
      for (let cc = targetCol; cc < targetCol + rect.colSpan && !blocker; cc++) {
        if (rr <= GRID_ROWS && cc <= GRID_COLS && occ[rr][cc]) blocker = occ[rr][cc];
      }
    }
    if (blocker) {
      const bRect = getItemRect(blocker);
      if (bRect.colSpan === rect.colSpan && bRect.rowSpan === rect.rowSpan) {
        const occ2 = buildOccupancy(grid, blocker);
        if (fits(occ2, dragCtx.lastCol, dragCtx.lastRow, bRect.colSpan, bRect.rowSpan)) {
          setItemRect(blocker, { col: dragCtx.lastCol, row: dragCtx.lastRow, colSpan: bRect.colSpan, rowSpan: bRect.rowSpan });
          dragCtx.lastCol = targetCol;
          dragCtx.lastRow = targetRow;
        }
      }
    }
  }

  // Dock 内拖拽排序：dock 是一维的 4 槽位（DOCK_SLOTS），按水平位置重新插入。
  function onDragMoveInDock(e) {
    const dock = dragCtx.container;
    const box = dock.getBoundingClientRect();
    const apps = dockApps().filter(a => a !== dragCtx.el);
    const total = apps.length + 1;
    const slotW = box.width / total;
    let idx = Math.round((e.clientX - box.left) / slotW);
    idx = Math.max(0, Math.min(apps.length, idx));

    const refNode = apps[idx] || null;
    if (refNode !== dragCtx.el.nextSibling) {
      dock.insertBefore(dragCtx.el, refNode);
    }
  }

  function onDragEnd(e, onMove, onUp) {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointercancel', onUp);
    document.body.classList.remove('ib-drag-lock');
    dragging = false;
    if (!dragCtx) return;
    clearEdgeTimer();
    const { el, container, rect, pointerId, curIsDock } = dragCtx;
    if (typeof el.releasePointerCapture === 'function' && pointerId != null) {
      try { el.releasePointerCapture(pointerId); } catch (err) { /* 忽略 */ }
    }
    el.style.transform = '';
    el.classList.remove('ib-dragging');

    if (curIsDock) {
      // Dock 槽位数量硬限制：如果拖入时已经超过 DOCK_SLOTS，弹回最后一个多余的图标到当前主屏页
      enforceDockCapacity();
    } else {
      // 始终用 originRect（拖拽开始时的不可变尺寸快照）做最终落位依据，
      // 而不是可能在跨容器过程中被中间状态污染的 rect，双重保险防止
      // 写死组件/自建组件的大小在落地瞬间跑位/变形。
      const finalRect = dragCtx.originRect || rect;
      const occ = buildOccupancy(container, el);
      let finalPos = { col: dragCtx.lastCol, row: dragCtx.lastRow };
      if (!fits(occ, finalPos.col, finalPos.row, finalRect.colSpan, finalRect.rowSpan)) {
        finalPos = findNearestFree(occ, finalPos.col, finalPos.row, finalRect.colSpan, finalRect.rowSpan)
          || findNearestFree(buildOccupancy(dragCtx.originContainer, el), rect.col, rect.row, finalRect.colSpan, finalRect.rowSpan)
          || { col: rect.col, row: rect.row };
      }
      setItemRect(el, { col: finalPos.col, row: finalPos.row, colSpan: finalRect.colSpan, rowSpan: finalRect.rowSpan });
    }

    // 如果拖拽过程中元素被搬去了别的容器（跨页拖拽 / 进出 dock），
    // 它在新容器里还没有绑定过长按/拖拽/删除角标（这些绑定是按容器逐个元素做的），
    // 这里补上，否则下次编辑这个项目时会失效。
    if (container !== dragCtx.originContainer) {
      attachLongPress(el, container);
      attachDrag(el);
      addRemoveBadge(el);
    }

    saveLayout();
    maybeAutoRemoveEmptyPage(dragCtx.originIsDock ? null : dragCtx.originContainer);
    dragCtx = null;
    suppressNextClick = true;
    setTimeout(() => { suppressNextClick = false; }, 60);
  }

  // Dock 最多放 DOCK_SLOTS 个图标；如果拖拽落位后超出上限（理论上不太会发生，
  // 因为 moveDragElToContainer 只在悬停时预览性地把元素放进去，但为稳妥起见做兜底），
  // 把最后一个溢出的图标退回当前主屏页面的空位。
  function enforceDockCapacity() {
    const apps = dockApps();
    if (apps.length <= DOCK_SLOTS) return;
    const overflow = apps.slice(DOCK_SLOTS);
    const curIndex = currentPageIndex();
    const grid = grids()[Math.min(curIndex, grids().length - 1)];
    overflow.forEach(el => {
      convertDockShapeToApp(el);
      if (grid) {
        const occ = buildOccupancy(grid, null);
        const pos = findNearestFree(occ, 1, 1, 1, 1) || { col: 1, row: 1 };
        setItemRect(el, { col: pos.col, row: pos.row, colSpan: 1, rowSpan: 1 });
        grid.appendChild(el);
        attachLongPress(el, grid);
        if (editing) { attachDrag(el); addRemoveBadge(el); }
      }
    });
  }

  /* ---------- 底部工具条 ---------- */
  let toolbarEl = null;
  function showToolbar() {
    if (!toolbarEl) {
      toolbarEl = document.createElement('div');
      toolbarEl.className = 'ib-edit-toolbar';
      toolbarEl.innerHTML = `
        <button class="ib-edit-btn" id="ibAddWidgetBtn">+ 添加组件</button>
        <button class="ib-edit-btn" id="ibRemovedBtn">已删除</button>
        <button class="ib-edit-btn" id="ibResetDefaultBtn">恢复默认</button>
        <button class="ib-edit-btn primary" id="ibDoneEditBtn">完成</button>
      `;
      document.body.appendChild(toolbarEl);
      toolbarEl.querySelector('#ibDoneEditBtn').addEventListener('click', exitEditMode);
      toolbarEl.querySelector('#ibAddWidgetBtn').addEventListener('click', openWidgetSheet);
      toolbarEl.querySelector('#ibRemovedBtn').addEventListener('click', openRemovedPanel);
      toolbarEl.querySelector('#ibResetDefaultBtn').addEventListener('click', resetAllToDefault);
    }
    requestAnimationFrame(() => toolbarEl.classList.add('show'));
  }
  function hideToolbar() {
    if (toolbarEl) toolbarEl.classList.remove('show');
  }

  /* ---------- 页面管理：新增页面 / 空页面自动回收 ---------- */
  let addPageBtnEl = null;

  function createEmptyPageEl(pid, silent) {
    const wrap = pagesWrapEl();
    if (!wrap) return null;
    const el = document.createElement('div');
    el.className = 'app-grid';
    el.id = pid;
    el.dataset.userPage = '1'; // 标记：用户新增的页面（空了会被自动回收）
    wrap.appendChild(el);
    itemsInGrid(el).forEach(child => attachLongPress(child, el));
    if (!silent) {
      const data = loadLayout();
      data.userAddedPages = data.userAddedPages || [];
      if (!data.userAddedPages.includes(pid)) data.userAddedPages.push(pid);
      persist(data);
    }
    return el;
  }

  // 和真实手机桌面一样：在最后一页之后，提供"新增页面"的入口。
  // 新增的页面是空白的，用户可以把 App/组件拖过去，或从"添加组件"面板放置内容。
  function addNewPage() {
    const pid = 'ibPage_' + Date.now();
    const el = createEmptyPageEl(pid, false);
    if (!el) return;
    if (editing) {
      itemsInGrid(el).forEach(child => { attachDrag(child); addRemoveBadge(child); });
    }
    if (window.LunaPager) {
      window.LunaPager.refresh();
      window.LunaPager.goTo(gridIndex(el));
    }
    saveLayout();
  }

  // 一个"用户新增的页面"如果被清空（所有 App/组件都挪走或删除了），
  // 就像真实手机一样自动移除这一页，不留空白页占位。
  // 注意：原始就存在的 4 个默认页面（page-1~page-4）即使清空也不会被自动删除，
  // 只有用户后来自己新建的页面才会在清空后自动回收。
  function maybeAutoRemoveEmptyPage(grid) {
    if (!grid || !grid.dataset || !grid.dataset.userPage) return;
    if (itemsInGrid(grid).length > 0) return;
    const data = loadLayout();
    data.userAddedPages = (data.userAddedPages || []).filter(id => id !== grid.id);
    delete data[grid.id];
    delete data[grid.id + ':removed'];
    persist(data);
    grid.remove();
    if (window.LunaPager) window.LunaPager.refresh();
  }
  function cleanupEmptyUserPages() {
    grids().forEach(g => maybeAutoRemoveEmptyPage(g));
  }

  function showAddPageAffordance() {
    if (!addPageBtnEl) {
      addPageBtnEl = document.createElement('button');
      addPageBtnEl.className = 'ib-edit-btn ib-add-page-btn';
      addPageBtnEl.textContent = '+ 新增页面';
      addPageBtnEl.addEventListener('click', addNewPage);
      document.body.appendChild(addPageBtnEl);
    }
    requestAnimationFrame(() => addPageBtnEl.classList.add('show'));
  }
  function hideAddPageAffordance() {
    if (addPageBtnEl) addPageBtnEl.classList.remove('show');
  }

  /* ---------- 添加组件面板 ---------- */
  // 标准组件尺寸参考——和写死在 HTML 里的原生组件保持同一套比例语言，
  // 用户设计自定义组件时按这几档选，能保证跟系统组件对齐、不会破版：
  //   4×4（占满一屏 4 列×4 行，如天气/聊天组件）
  //   2×2（如好友/情侣组件）
  //   4×2（四列两行，即"两行四列"，如资料组件；2×4 竖版留给以后需要的场景）
  //   4×1（四列一行，如通知组件）
  const CUSTOM_SIZE_PRESETS = [
    { id: '4x4', name: '4×4 大尺寸', desc: '占满整屏（4列×4行），如天气/聊天组件', colSpan: 4, rowSpan: 4 },
    { id: '2x2', name: '2×2 标准', desc: '常规方形组件，如好友/情侣组件', colSpan: 2, rowSpan: 2 },
    { id: '4x2', name: '4×2 横幅', desc: '四列两行，如资料组件', colSpan: 4, rowSpan: 2 },
    { id: '2x4', name: '2×4 竖版', desc: '两列四行的竖向组件', colSpan: 2, rowSpan: 4 },
    { id: '4x1', name: '4×1 条形', desc: '四列一行，如通知组件', colSpan: 4, rowSpan: 1 },
    { id: '2x1', name: '2×1 小条', desc: '两列一行，如电量组件', colSpan: 2, rowSpan: 1 }
  ];

  const WIDGET_CATALOG = [
    { id: 'clock', name: '时钟', size: '2×2', colSpan: 2, rowSpan: 2, icon: 'clock' },
    { id: 'note', name: '便签', size: '2×2', colSpan: 2, rowSpan: 2, icon: 'note' },
    { id: 'battery', name: '电量', size: '2×1', colSpan: 2, rowSpan: 1, icon: 'battery' },
    { id: 'photo', name: '相册', size: '2×2', colSpan: 2, rowSpan: 2, icon: 'photo' },
    { id: 'custom', name: '自定义设计', size: '任意', colSpan: 2, rowSpan: 2, icon: 'custom', isCustomBuilder: true }
  ];

  let sheetEl = null, sheetOverlay = null;
  function openWidgetSheet() {
    if (!sheetOverlay) {
      sheetOverlay = document.createElement('div');
      sheetOverlay.className = 'ib-widget-overlay';
      sheetEl = document.createElement('div');
      sheetEl.className = 'ib-widget-sheet';
      sheetEl.innerHTML = `
        <div class="ib-sheet-handle"></div>
        <div class="ib-sheet-header">
          <div class="ib-sheet-title">添加组件</div>
          <button class="ib-sheet-close" id="ibSheetCloseBtn">关闭</button>
        </div>
        <div class="ib-sheet-body" id="ibSheetBody"></div>
      `;
      document.body.appendChild(sheetOverlay);
      document.body.appendChild(sheetEl);
      sheetOverlay.addEventListener('click', closeWidgetSheet);
      sheetEl.querySelector('#ibSheetCloseBtn').addEventListener('click', closeWidgetSheet);

      const body = sheetEl.querySelector('#ibSheetBody');
      WIDGET_CATALOG.forEach(w => {
        const opt = document.createElement('div');
        opt.className = 'ib-widget-option' + (w.isCustomBuilder ? ' ib-widget-option-custom' : '');
        opt.innerHTML = `
          <div class="ib-widget-option-preview">${widgetIconSvg(w.icon)}</div>
          <div class="ib-widget-option-name">${w.name}</div>
          <div class="ib-widget-option-size">${w.size}</div>
        `;
        opt.addEventListener('click', () => {
          if (w.isCustomBuilder) {
            closeWidgetSheet();
            openCustomWidgetBuilder();
          } else {
            addWidgetToCurrentPage(w);
          }
        });
        body.appendChild(opt);
      });
    }
    requestAnimationFrame(() => {
      sheetOverlay.classList.add('show');
      sheetEl.classList.add('show');
    });
  }
  function closeWidgetSheet() {
    if (sheetOverlay) sheetOverlay.classList.remove('show');
    if (sheetEl) sheetEl.classList.remove('show');
  }

  function widgetIconSvg(kind) {
    const icons = {
      clock: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/><path d="M12 7v5l3.5 2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
      note: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>',
      battery: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="17" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/><rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor"/></svg>',
      photo: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="11" r="2" stroke="currentColor" stroke-width="1.2"/><path d="M13 14l2.5-3 3 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      custom: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.2" stroke-dasharray="2.5 2.5"/></svg>'
    };
    return icons[kind] || '';
  }

  /* ---------- 自定义组件设计器（用户上传/编写自己的 HTML+CSS） ---------- */
  let customBuilderOverlay = null, customBuilderEl = null;
  let customBuilderState = { sizeId: '2x2', html: '', css: '' };

  function customSizeById(id) {
    return CUSTOM_SIZE_PRESETS.find(s => s.id === id) || CUSTOM_SIZE_PRESETS[1];
  }

  // 用 iframe + srcdoc 沙盒渲染用户的 CSS/HTML：
  // 1) 用户的 CSS 选择器/全局规则（比如 body{...}、* {...}）不会泄漏出去污染整个系统 UI；
  // 2) 系统自身的样式也不会意外影响用户设计（用户在一个干净的白板上设计）；
  // 3) <script> 标签会被剥离，避免自定义组件里夹带脚本。
  function sanitizeCustomHtml(html) {
    return String(html || '').replace(/<script[\s\S]*?<\/script>/gi, '');
  }
  function buildCustomWidgetSrcdoc(html, css) {
    const safeHtml = sanitizeCustomHtml(html);
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent;
        font-family:'Inter',-apple-system,sans-serif;box-sizing:border-box;}
      *{box-sizing:border-box;}
      </style><style>${css || ''}</style></head><body>${safeHtml}</body></html>`;
  }

  function openCustomWidgetBuilder() {
    if (!customBuilderOverlay) {
      customBuilderOverlay = document.createElement('div');
      customBuilderOverlay.className = 'ib-widget-overlay';
      customBuilderEl = document.createElement('div');
      customBuilderEl.className = 'ib-widget-sheet ib-custom-builder-sheet';
      customBuilderEl.innerHTML = `
        <div class="ib-sheet-handle"></div>
        <div class="ib-sheet-header">
          <div class="ib-sheet-title">自定义设计组件</div>
          <button class="ib-sheet-close" id="ibCustomCloseBtn">关闭</button>
        </div>
        <div class="ib-custom-body" id="ibCustomBody">

          <div class="ib-custom-guide">
            <div class="ib-custom-guide-title">尺寸参考说明</div>
            <div class="ib-custom-guide-text">
              组件按下方标准尺寸放置在 4 列×6 行的主屏网格里，选一个最贴近你设计稿比例的尺寸，
              CSS 里请用百分比 / flex / grid 铺满容器（宽高 100%），不要写死具体像素的整体尺寸。
            </div>
          </div>

          <div class="ib-custom-size-grid" id="ibCustomSizeGrid"></div>

          <div class="ib-custom-field">
            <div class="ib-custom-field-label">HTML 内容</div>
            <textarea class="ib-custom-textarea" id="ibCustomHtmlInput" placeholder="&lt;div class=&quot;my-widget&quot;&gt;你好&lt;/div&gt;"></textarea>
          </div>

          <div class="ib-custom-field">
            <div class="ib-custom-field-label">CSS 样式</div>
            <textarea class="ib-custom-textarea" id="ibCustomCssInput" placeholder=".my-widget { width:100%; height:100%; display:flex; align-items:center; justify-content:center; }"></textarea>
          </div>

          <div class="ib-custom-field">
            <div class="ib-custom-field-label">上传 CSS 文件（可选，会替换上方 CSS 内容）</div>
            <input type="file" id="ibCustomCssFile" accept=".css,text/css"/>
          </div>

          <div class="ib-custom-field">
            <div class="ib-custom-field-label">预览</div>
            <div class="ib-custom-preview-wrap">
              <div class="ib-custom-preview-frame" id="ibCustomPreviewFrame">
                <iframe id="ibCustomPreviewIframe" sandbox="allow-same-origin"></iframe>
              </div>
            </div>
          </div>

        </div>
        <div class="ib-custom-actions">
          <button id="ibCustomCancelBtn">取消</button>
          <button id="ibCustomAddBtn">添加到主屏</button>
        </div>
      `;
      document.body.appendChild(customBuilderOverlay);
      document.body.appendChild(customBuilderEl);

      const close = () => closeCustomWidgetBuilder();
      customBuilderOverlay.addEventListener('click', close);
      customBuilderEl.querySelector('#ibCustomCloseBtn').addEventListener('click', close);
      customBuilderEl.querySelector('#ibCustomCancelBtn').addEventListener('click', close);

      const sizeGrid = customBuilderEl.querySelector('#ibCustomSizeGrid');
      CUSTOM_SIZE_PRESETS.forEach(s => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ib-custom-size-opt';
        btn.dataset.sizeId = s.id;
        btn.innerHTML = `<div class="ib-custom-size-ratio ib-custom-size-ratio-${s.id}"></div><div class="ib-custom-size-name">${s.name}</div><div class="ib-custom-size-desc">${s.desc}</div>`;
        btn.addEventListener('click', () => {
          customBuilderState.sizeId = s.id;
          sizeGrid.querySelectorAll('.ib-custom-size-opt').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          updateCustomPreviewFrameRatio();
        });
        sizeGrid.appendChild(btn);
      });

      const htmlInput = customBuilderEl.querySelector('#ibCustomHtmlInput');
      const cssInput = customBuilderEl.querySelector('#ibCustomCssInput');
      const refreshPreview = () => {
        customBuilderState.html = htmlInput.value;
        customBuilderState.css = cssInput.value;
        renderCustomPreview();
      };
      htmlInput.addEventListener('input', refreshPreview);
      cssInput.addEventListener('input', refreshPreview);

      customBuilderEl.querySelector('#ibCustomCssFile').addEventListener('change', (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          cssInput.value = String(reader.result || '');
          refreshPreview();
        };
        reader.readAsText(file);
      });

      customBuilderEl.querySelector('#ibCustomAddBtn').addEventListener('click', addCustomWidgetToCurrentPage);
    }

    // 每次打开重置成一个干净的默认态，避免上次编辑内容混进新组件
    customBuilderState = { sizeId: '2x2', html: '', css: '' };
    customBuilderEl.querySelector('#ibCustomHtmlInput').value = '';
    customBuilderEl.querySelector('#ibCustomCssInput').value = '';
    customBuilderEl.querySelectorAll('.ib-custom-size-opt').forEach(b => b.classList.toggle('active', b.dataset.sizeId === '2x2'));
    updateCustomPreviewFrameRatio();
    renderCustomPreview();

    requestAnimationFrame(() => {
      customBuilderOverlay.classList.add('show');
      customBuilderEl.classList.add('show');
    });
  }

  function closeCustomWidgetBuilder() {
    if (customBuilderOverlay) customBuilderOverlay.classList.remove('show');
    if (customBuilderEl) customBuilderEl.classList.remove('show');
  }

  function updateCustomPreviewFrameRatio() {
    const frame = customBuilderEl.querySelector('#ibCustomPreviewFrame');
    if (!frame) return;
    const s = customSizeById(customBuilderState.sizeId);
    // 预览框按真实的列/行比例来呈现，让用户设计时就能感知实际比例，
    // 不会出现"设计时觉得挺方，放到主屏才发现被拉伸变形"的落差。
    frame.style.aspectRatio = `${s.colSpan} / ${s.rowSpan}`;
  }

  function renderCustomPreview() {
    const iframe = customBuilderEl && customBuilderEl.querySelector('#ibCustomPreviewIframe');
    if (!iframe) return;
    iframe.srcdoc = buildCustomWidgetSrcdoc(customBuilderState.html, customBuilderState.css);
  }

  function addCustomWidgetToCurrentPage() {
    const html = customBuilderState.html.trim();
    const css = customBuilderState.css.trim();
    if (!html && !css) {
      alert('请先填写 HTML 内容或 CSS 样式，或上传一个 CSS 文件。');
      return;
    }
    const size = customSizeById(customBuilderState.sizeId);

    const grids_ = grids();
    const curIndex = currentPageIndex();
    const grid = grids_[Math.min(curIndex, grids_.length - 1)];
    if (!grid) return;

    const occ = buildOccupancy(grid, null);
    const pos = findNearestFree(occ, 1, 1, size.colSpan, size.rowSpan);
    if (!pos) {
      alert('当前页面空间不足以放下 ' + size.name + '，请先切换到其他页面，或点击"+ 新增页面"创建一个新页面。');
      return;
    }

    const uid = 'hw' + Date.now();
    const el = document.createElement('div');
    el.className = 'home-widget home-widget-custom';
    el.dataset.hwId = uid;
    el.dataset.hwKind = 'custom';
    el.style.gridColumn = size.colSpan > 1 ? `${pos.col} / ${pos.col + size.colSpan}` : `${pos.col}`;
    el.style.gridRow = size.rowSpan > 1 ? `${pos.row} / ${pos.row + size.rowSpan}` : `${pos.row}`;
    el.innerHTML = customWidgetInnerHtml(uid, html, css);
    grid.appendChild(el);

    attachLongPress(el, grid);
    if (editing) { attachDrag(el); addRemoveBadge(el); }

    // 把自定义内容存进元素自身的 dataset，供 saveLayout/rebuild 持久化和还原。
    el.dataset.hwCustomHtml = html;
    el.dataset.hwCustomCss = css;

    saveLayout();
    closeCustomWidgetBuilder();
  }

  // 自定义组件同样用沙盒 iframe 渲染，确保用户设计的 CSS 不会污染主屏其余部分，
  // 也不会被主屏的全局样式（如 .app-grid 的字体/颜色继承）意外影响。
  function customWidgetInnerHtml(uid, html, css) {
    return `<iframe class="hw-custom-iframe" data-hw-custom-frame="${uid}" sandbox="allow-same-origin" srcdoc="${escapeForAttribute(buildCustomWidgetSrcdoc(html, css))}"></iframe>`;
  }
  function escapeForAttribute(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function widgetInnerHtml(w, uid) {
    if (w.id === 'clock') {
      return `<div class="hw-title">时钟</div><div class="hw-clock-time" data-hw-clock="${uid}">--:--</div><div class="hw-clock-date" data-hw-date="${uid}">--</div>`;
    }
    if (w.id === 'note') {
      return `<div class="hw-title">便签</div><div class="hw-note-text" contenteditable="true" data-hw-note="${uid}">点击编辑便签内容...</div>`;
    }
    if (w.id === 'battery') {
      return `<div class="hw-title">电量</div><div class="hw-battery-pct" data-hw-battery="${uid}">--%</div>`;
    }
    if (w.id === 'photo') {
      return `<div class="hw-title">相册</div>${widgetIconSvg('photo')}`;
    }
    return '';
  }

  function currentPageIndex() {
    if (window.LunaPager && typeof window.LunaPager.currentPage === 'function') {
      return window.LunaPager.currentPage();
    }
    // 兜底：从 transform 反推
    const wrap = pagesWrapEl();
    if (!wrap) return 0;
    const t = wrap.style.transform || '';
    const m = t.match(/-?\d+(\.\d+)?/);
    const frameW = wrap.parentElement ? wrap.parentElement.offsetWidth : window.innerWidth;
    if (m && frameW) return Math.round(Math.abs(parseFloat(m[0])) / frameW);
    return 0;
  }

  function addWidgetToCurrentPage(w) {
    const grids_ = grids();
    const curIndex = currentPageIndex();
    // 只在当前页面里找位置；空间不够就提示去别的页面，不会自作主张创建新页面
    // （如果用户想要更多空间，可以用"+ 新增页面"手动创建）。
    const grid = grids_[Math.min(curIndex, grids_.length - 1)];
    if (!grid) return;

    const occ = buildOccupancy(grid, null);
    const pos = findNearestFree(occ, 1, 1, w.colSpan, w.rowSpan);
    if (!pos) {
      alert('当前页面空间不足，请先切换到其他页面，或点击"+ 新增页面"创建一个新页面。');
      return;
    }

    const uid = 'hw' + Date.now();
    const el = document.createElement('div');
    el.className = 'home-widget';
    el.dataset.hwId = uid;
    el.dataset.hwKind = w.id;
    el.style.gridColumn = w.colSpan > 1 ? `${pos.col} / ${pos.col + w.colSpan}` : `${pos.col}`;
    el.style.gridRow = w.rowSpan > 1 ? `${pos.row} / ${pos.row + w.rowSpan}` : `${pos.row}`;
    el.innerHTML = widgetInnerHtml(w, uid);
    grid.appendChild(el);

    attachLongPress(el, grid);
    if (editing) { attachDrag(el); addRemoveBadge(el); }
    initLiveWidget(w.id, uid);

    saveLayout();
    closeWidgetSheet();
  }

  /* ---------- 简单的动态内容（时钟/电量）---------- */
  function initLiveWidget(kind, uid) {
    if (kind === 'clock') {
      const tick = () => {
        const now = new Date();
        const t = document.querySelector(`[data-hw-clock="${uid}"]`);
        const d = document.querySelector(`[data-hw-date="${uid}"]`);
        if (t) t.textContent = now.toTimeString().slice(0, 5);
        if (d) d.textContent = now.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
      };
      tick();
      setInterval(tick, 30000);
    }
    if (kind === 'battery') {
      const el = document.querySelector(`[data-hw-battery="${uid}"]`);
      const src = document.getElementById('batPct');
      if (el) el.textContent = (src ? src.textContent : '76') + '%';
    }
  }

  /* ---------- 阻止编辑模式下的误触打开 App / 组件弹窗 ---------- */
  document.addEventListener('click', (e) => {
    if (editing || suppressNextClick) {
      const item = e.target.closest('.app, .dock-app, .home-widget, [class^="widget-"]');
      if (item && !e.target.closest('.ib-remove-badge')) {
        e.stopPropagation();
        e.preventDefault();
      }
    }
  }, true);

  /* ---------- 初始化：绑定所有已存在的 app / widget / dock-app 长按 ---------- */
  function initAll() {
    applyStoredLayout();
    grids().forEach(grid => {
      itemsInGrid(grid).forEach(el => attachLongPress(el, grid));
    });
    dockApps().forEach(el => attachLongPress(el, dockEl()));
    if (window.LunaPager) window.LunaPager.refresh();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }

  // 暴露给外部调试/调用
  window.LunaHomeEdit = {
    enterEditMode,
    exitEditMode,
    isEditing: () => editing,
    isDragging: () => dragging, // 供 script.js 判断：只在真正拖动图标时才屏蔽翻页手势
    addNewPage,
    resetAllToDefault,
    openRemovedPanel
  };
})();