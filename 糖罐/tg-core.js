/* ================================================================
   糖罐 TANGGUAN — tg-core.js
   状态栏同步 / 路由 / 底部导航 / 存储 / AI / 等级徽章
   所有全局名一律 tg 前缀，与 Luna 原文件零冲突
================================================================ */

/* ================================================================
   1. 状态栏 —— 与 Luna 主屏完全同步的行为
================================================================ */
function tgSyncStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const tick = () => {
    let h, m;
    try {
      const s = new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
      [h, m] = s.split(':');
    } catch (e) {
      const d = new Date();
      h = String(d.getHours()).padStart(2, '0');
      m = String(d.getMinutes()).padStart(2, '0');
    }
    const el = document.getElementById('tgTime');
    if (el) el.textContent = `${parseInt(h, 10)}:${m}`;
  };
  tick();
  setInterval(tick, 15000);

  // 电池：优先读真实电量，读不到就沿用 Luna 的 76%
  const paint = (pct) => {
    const p = document.getElementById('tgBatPct');
    const i = document.getElementById('tgBatInner');
    if (p) p.textContent = pct;
    if (i) i.style.width = Math.max(6, pct) + '%';
  };
  if (navigator.getBattery) {
    navigator.getBattery().then(b => {
      const up = () => paint(Math.round(b.level * 100));
      up(); b.addEventListener('levelchange', up);
    }).catch(() => paint(76));
  } else paint(76);
}

/* ================================================================
   2. 图标库（全部手绘 SVG，零 emoji）
================================================================ */
const TG_ICONS = {
  plaza: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 10.4 12 4l8 6.4V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" fill="currentColor" opacity=".9"/><circle cx="12" cy="12.4" r="1.6" fill="#fff" opacity=".55"/></svg>',
  circle:'<svg viewBox="0 0 24 24" fill="none"><circle cx="9.4" cy="12" r="5.2" fill="currentColor" opacity=".92"/><circle cx="14.6" cy="12" r="5.2" fill="currentColor" opacity=".42"/></svg>',
  dm:    '<svg viewBox="0 0 24 24" fill="none"><path d="M3.6 6.8A2.2 2.2 0 0 1 5.8 5h12.4a2.2 2.2 0 0 1 2.2 1.8L12 13z" fill="currentColor" opacity=".92"/><path d="M3.5 8.6 12 14.6l8.5-6V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" fill="currentColor" opacity=".45"/></svg>',
  nib:   '<svg viewBox="0 0 24 24" fill="none"><path d="M17.6 3.4 20.6 6.4 9.9 17.1l-4.6 1.6 1.6-4.6z" fill="currentColor" opacity=".92"/><path d="M4.2 20.6h15.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".5"/><circle cx="12.6" cy="11.4" r="1.5" fill="#fff" opacity=".6"/></svg>',
  me:    '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" fill="currentColor" opacity=".92"/><path d="M4.4 20.4c.4-4.2 3.7-6.6 7.6-6.6s7.2 2.4 7.6 6.6a.9.9 0 0 1-.9 1H5.3a.9.9 0 0 1-.9-1z" fill="currentColor" opacity=".45"/></svg>',
  go:    '<svg viewBox="0 0 24 24" fill="none"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  back:  '<svg viewBox="0 0 24 24" fill="none"><path d="m15 5-7 7 7 7" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  caret: '<svg viewBox="0 0 24 24" fill="none"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock:  '<svg viewBox="0 0 24 24" fill="none"><rect x="5" y="10" width="14" height="10" rx="2.6" fill="currentColor"/><path d="M8.4 10V7.8a3.6 3.6 0 1 1 7.2 0V10" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  pair:  '<svg viewBox="0 0 24 24" fill="none"><circle cx="8.6" cy="9" r="3.4" fill="currentColor"/><circle cx="15.4" cy="9" r="3.4" fill="currentColor" opacity=".45"/><path d="M3.6 20c.4-3.2 2.5-5 5-5s4.6 1.8 5 5" fill="currentColor" opacity=".8"/><path d="M10.4 20c.4-3.2 2.5-5 5-5s4.6 1.8 5 5" fill="currentColor" opacity=".35"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.6 14 9l6.4 2-6.4 2-2 6.4-2-6.4L3.6 11 10 9z" fill="currentColor"/><circle cx="19" cy="5" r="1.5" fill="currentColor" opacity=".55"/><circle cx="5" cy="18" r="1.1" fill="currentColor" opacity=".45"/></svg>',
  box:   '<svg viewBox="0 0 24 24" fill="none"><path d="M3.4 7.6 12 3.6l8.6 4L12 11.6z" fill="currentColor"/><path d="M3.4 8.8v8L12 20.8v-8z" fill="currentColor" opacity=".62"/><path d="M20.6 8.8v8L12 20.8v-8z" fill="currentColor" opacity=".34"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.2" y="5.4" width="17.6" height="13.2" rx="3" fill="currentColor" opacity=".22"/><circle cx="9" cy="10.2" r="1.9" fill="currentColor"/><path d="M4.4 17.4 9.8 12l3.6 3.4 3-2.6 3.2 4.6z" fill="currentColor" opacity=".75"/></svg>',
  plus:  '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5.6v12.8M5.6 12h12.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  edit:  '<svg viewBox="0 0 24 24" fill="none"><path d="M16.8 3.6 20.4 7.2 8.6 19H5v-3.6z" fill="currentColor" opacity=".9"/><path d="M4.4 21.2h15.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" opacity=".45"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none"><circle cx="17.6" cy="6" r="2.8" fill="currentColor"/><circle cx="6.4" cy="12" r="2.8" fill="currentColor" opacity=".6"/><circle cx="17.6" cy="18" r="2.8" fill="currentColor" opacity=".82"/><path d="m9 10.6 6-3.2M9 13.4l6 3.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" opacity=".5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 7.6h12l-1 12.4a1.4 1.4 0 0 1-1.4 1.3H8.4A1.4 1.4 0 0 1 7 20zM9.4 4.6h5.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
};
function tgIco(n) { return TG_ICONS[n] || ''; }
function tgFillIcons(root) {
  (root || document).querySelectorAll('[data-ico]').forEach(el => {
    if (el.dataset.icoDone) return;
    el.insertAdjacentHTML('afterbegin', tgIco(el.dataset.ico));
    el.dataset.icoDone = '1';
  });
}

/* ================================================================
   3. 路由
================================================================ */
const TG_TABS = [
  { id: 'scr-plaza',   ico: 'plaza',  txt: '广场' },
  { id: 'scr-circle',  ico: 'circle', txt: '圈子' },
  { id: 'scr-dm',      ico: 'dm',     txt: '私信' },
  { id: 'scr-bifang',  ico: 'nib',    txt: '笔坊' },
  { id: 'scr-profile', ico: 'me',     txt: '我' }
];
let tgStack = ['scr-plaza'];

function tgCurrent() { return tgStack[tgStack.length - 1]; }

function tgShow(id, push) {
  const from = document.querySelector('.tg-screen.active');
  const to = document.getElementById(id);
  if (!to || (from && from.id === id)) return;
  if (from) { from.classList.remove('active'); from.classList.toggle('leaving-left', !!push); }
  to.classList.remove('leaving-left');
  to.classList.add('active');
  to.scrollTop = 0;
  // 有 has-nav 的是主页面，其余子页隐藏导航
  const nav = document.getElementById('tgNav');
  nav.classList.toggle('hidden', !to.classList.contains('has-nav'));
  // 配对席位固定托盘：只在 scr-pick 页显示，挂在外框上不随任何页面滚动
  const tray = document.getElementById('tgTray');
  if (tray) tray.classList.toggle('show', id === 'scr-pick');
  // 帖子详情页的固定回复条，同样挂在外框上
  const pvb = document.getElementById('tgPvBar');
  if (pvb) pvb.classList.toggle('show', id === 'scr-postview');
  document.getElementById('tgFrame').classList.toggle('on-dark',
    id === 'scr-profile' && !!(typeof tgMe !== 'undefined' && tgMe.bgImg));
  // 重新触发浮现动画
  to.querySelectorAll('.tg-rise').forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
  if (typeof tgOnEnter === 'function') tgOnEnter(id);
}

function tgGo(id) { if (tgCurrent() === id) return; tgStack.push(id); tgShow(id, true); tgSyncNav(); }
function tgBack() { if (tgStack.length < 2) return; tgStack.pop(); tgShow(tgCurrent(), false); tgSyncNav(); }
function tgTab(i) {
  const id = TG_TABS[i].id;
  tgStack = [id];
  tgShow(id, true);
  tgSyncNav(i);
}

/* ================================================================
   4. 底部导航（液态形变 + 糖粒迸发）
================================================================ */
function tgBuildNav() {
  const wrap = document.getElementById('tgNavItems');
  wrap.innerHTML = TG_TABS.map((t, i) => `
    <button class="tg-tab" data-i="${i}" onclick="tgTapTab(${i})">
      <span class="tg-tab-halo"></span>
      <span class="tg-spark"></span><span class="tg-spark"></span><span class="tg-spark"></span>
      <span class="tg-spark"></span><span class="tg-spark"></span><span class="tg-spark"></span>
      <span class="tg-tab-ico">${tgIco(t.ico)}</span>
      <span class="tg-tab-txt">${t.txt}</span>
    </button>`).join('');
}

function tgTapTab(i) {
  const btn = document.querySelector(`.tg-tab[data-i="${i}"]`);
  if (btn) { btn.classList.remove('burst'); void btn.offsetWidth; btn.classList.add('burst'); }
  if (navigator.vibrate) { try { navigator.vibrate(8); } catch (e) {} }
  tgTab(i);
}

function tgSyncNav(forceIdx) {
  const cur = tgCurrent();
  let idx = forceIdx;
  if (idx == null) idx = TG_TABS.findIndex(t => t.id === cur);
  // 子页面归属：笔坊系 / 个人中心系
  if (idx < 0) {
    if (['scr-pick','scr-ai','scr-airesult','scr-style','scr-name','scr-cover','scr-done','scr-archive'].includes(cur)) idx = 3;
    else if (cur === 'scr-chat') idx = 2;
    else if (cur === 'scr-level') idx = 4;
    else if (cur === 'scr-circlehome') idx = 1;
    else if (cur === 'scr-postview') {
      // 详情页归属于把它打开的那一页
      const prev = tgStack[tgStack.length - 2] || 'scr-plaza';
      const pi = TG_TABS.findIndex(t => t.id === prev);
      idx = pi >= 0 ? pi : (prev === 'scr-circlehome' ? 1 : 0);
    }
    else idx = 0;
  }
  const tabs = document.querySelectorAll('.tg-tab');
  tabs.forEach((t, i) => t.classList.toggle('on', i === idx));
  const blob = document.getElementById('tgBlob');
  const t = tabs[idx];
  if (!t || !blob) return;
  const pad = 7;
  blob.classList.add('travel');
  blob.style.left = (t.offsetLeft + pad) + 'px';
  blob.style.width = (t.offsetWidth - pad * 2) + 'px';
  clearTimeout(blob._tm);
  blob._tm = setTimeout(() => blob.classList.remove('travel'), 330);
}

/* ================================================================
   5. 存储：糖罐自有库 + 读取 Luna 的角色 / 身份
================================================================ */
const TG_DB = 'TangguanDB';
/* v2：新增 posts（广场帖子）/ dms（私信会话）/ msgs（私信消息） */
const TG_STORES = ['circles', 'drafts', 'styles', 'aihist', 'me', 'posts', 'dms', 'msgs'];
let _tgdb = null;

function tgOpenDB() {
  return new Promise((res, rej) => {
    if (_tgdb) return res(_tgdb);
    const req = indexedDB.open(TG_DB, 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      TG_STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); });
    };
    req.onsuccess = e => { _tgdb = e.target.result; res(_tgdb); };
    req.onerror = () => rej('tg db error');
  });
}
async function tgAll(store) {
  const db = await tgOpenDB().catch(() => null); if (!db) return [];
  return new Promise(res => {
    const r = db.transaction(store, 'readonly').objectStore(store).getAll();
    r.onsuccess = () => res((r.result || []).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    r.onerror = () => res([]);
  });
}
async function tgPut(store, obj) {
  const db = await tgOpenDB().catch(() => null); if (!db) return null;
  if (!obj.id) obj.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  if (!obj.createdAt) obj.createdAt = Date.now();
  return new Promise(res => {
    const r = db.transaction(store, 'readwrite').objectStore(store).put(obj);
    r.onsuccess = () => res(obj); r.onerror = () => res(null);
  });
}
async function tgDel(store, id) {
  const db = await tgOpenDB().catch(() => null); if (!db) return;
  db.transaction(store, 'readwrite').objectStore(store).delete(id);
}

/* —— 读取 Luna 角色库（只取公开字段，人设类一律不带出） —— */
function tgLoadChars() {
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB');
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) return res([]);
      const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      r.onsuccess = () => res((r.result || []).map(c => ({
        uid: 'c' + c.id, kind: 'char', name: c.name || '未命名',
        avatar: c.avatar || null,
        role: c.role || '', gender: c.gender || '', age: c.age || '',
        species: c.species || '',
        tags: (Array.isArray(c.traits) ? c.traits : []).slice(0, 4)
        // 注意：prompt / backstory / scenario / firstMes / relationDetail 等
        // 属于人设核心，此处刻意不读取、不携带、不渲染
      })));
      r.onerror = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

/* —— 读取 Luna 用户身份库 —— */
function tgLoadUsers() {
  return new Promise(res => {
    const req = indexedDB.open('LunaIdentityDB');
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) return res([]);
      const r = db.transaction('identities', 'readonly').objectStore('identities').getAll();
      r.onsuccess = () => res((r.result || []).map(u => ({
        uid: 'u' + u.id, kind: 'user', name: u.name || '未命名',
        avatar: u.avatarImg || null, color: u.avatarColor || null,
        role: u.role || u.identityType || '', gender: u.gender || '',
        age: '', species: u.occupation || '',
        tags: (Array.isArray(u.tags) ? u.tags : []).map(t => (typeof t === 'string' ? t : t.text)).slice(0, 4),
        raw: u
        // personality / desc / motto 属私密档案，不在配对卡上展示
      })));
      r.onerror = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

/* ================================================================
   6. AI 调用（复用 Luna 已配置的 OpenAI 兼容接口）
================================================================ */
async function tgAI(system, user, maxTokens) {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey) throw new Error('NO_API');
  const base = cur.baseUrl.replace(/\/$/, '');
  const resp = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${cur.apiKey}` },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      temperature: 0.95,
      max_tokens: maxTokens || 3000
    })
  });
  if (!resp.ok) throw new Error('API_' + resp.status);
  const d = await resp.json();
  return (d.choices && d.choices[0] && d.choices[0].message.content) || '';
}
function tgParseJSON(txt) {
  if (!txt) return null;
  let s = txt.replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = s.indexOf('['), b = s.lastIndexOf(']');
  const c = s.indexOf('{'), d = s.lastIndexOf('}');
  let cut = s;
  if (a !== -1 && b !== -1 && (a < c || c === -1)) cut = s.slice(a, b + 1);
  else if (c !== -1 && d !== -1) cut = s.slice(c, d + 1);
  try { return JSON.parse(cut); } catch (e) { return null; }
}

/* ================================================================
   7. 通用 UI 小件
================================================================ */
function tgEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
let _tgToastTm = null;
function tgToast(msg) {
  const el = document.getElementById('tgToast');
  el.textContent = msg; el.classList.add('on');
  clearTimeout(_tgToastTm);
  _tgToastTm = setTimeout(() => el.classList.remove('on'), 2100);
}
function tgSheetOpen(html) {
  const s = document.getElementById('tgSheet');
  s.innerHTML = '<div class="tg-sheet-grip"></div>' + html;
  tgFillIcons(s);
  document.getElementById('tgSheetMask').classList.add('on');
}
function tgCloseSheet(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('tgSheetMask').classList.remove('on');
}
function tgFmtDate(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

/* 图片选择：统一走一个 input */
let _tgImgTarget = null;
function tgPickImg(target) {
  _tgImgTarget = target;
  const inp = document.getElementById('tgFileInput');
  inp.value = '';
  inp.click();
}
function tgInitFileInput() {
  document.getElementById('tgFileInput').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { if (typeof tgOnImage === 'function') tgOnImage(_tgImgTarget, rd.result); };
    rd.readAsDataURL(f);
  });
}

/* 折叠区块 */
function tgToggleSec(el) { el.closest('.tg-sec').classList.toggle('open'); }

/* ================================================================
   8. 等级体系 —— 30 级，30 枚形制完全不同的徽章
================================================================ */
const TG_LEVELS = [
  { lv:1,  name:'初尝',   need:0     }, { lv:2,  name:'微甜',   need:60    },
  { lv:3,  name:'糖屑',   need:150   }, { lv:4,  name:'蜜语',   need:280   },
  { lv:5,  name:'糖霜',   need:450   }, { lv:6,  name:'心跳',   need:660   },
  { lv:7,  name:'缱绻',   need:920   }, { lv:8,  name:'绵糖',   need:1230  },
  { lv:9,  name:'蜜渍',   need:1600  }, { lv:10, name:'心动',   need:2030  },
  { lv:11, name:'情丝',   need:2530  }, { lv:12, name:'糖釉',   need:3100  },
  { lv:13, name:'缠绵',   need:3750  }, { lv:14, name:'沉溺',   need:4480  },
  { lv:15, name:'蜜光',   need:5300  }, { lv:16, name:'琥珀',   need:6210  },
  { lv:17, name:'焦糖',   need:7220  }, { lv:18, name:'引力',   need:8330  },
  { lv:19, name:'潮汐',   need:9550  }, { lv:20, name:'星轨',   need:10890 },
  { lv:21, name:'共鸣',   need:12360 }, { lv:22, name:'交织',   need:13970 },
  { lv:23, name:'熔金',   need:15730 }, { lv:24, name:'永夜',   need:17650 },
  { lv:25, name:'银河',   need:19740 }, { lv:26, name:'神谕',   need:22010 },
  { lv:27, name:'圣殿',   need:24470 }, { lv:28, name:'无垠',   need:27130 },
  { lv:29, name:'不朽',   need:30000 }, { lv:30, name:'糖罐之主', need:33100 }
];
const TG_TIERS = [
  { s:1,  e:5,  t:1, name:'糖屑阶',  perk:'解锁基础圈子创建、每日签到甜蜜值 +5' },
  { s:6,  e:10, t:2, name:'蜜语阶',  perk:'解锁文风档存档位 ×10、圈子自定义背景' },
  { s:11, e:15, t:3, name:'心潮阶',  perk:'解锁 AI 共创单次四对、CP 名花体渲染' },
  { s:16, e:20, t:4, name:'琥珀阶',  perk:'解锁圈子置顶、专属资料卡纹理、长文连载位' },
  { s:21, e:25, t:5, name:'星轨阶',  perk:'解锁圈主认证徽标、广场加权推荐、限定动效' },
  { s:26, e:30, t:6, name:'神域阶',  perk:'解锁殿堂展示位、年度糖罐名录、全部历史徽章可切换佩戴' }
];
function tgTierOf(lv) { return TG_TIERS.find(t => lv >= t.s && lv <= t.e) || TG_TIERS[0]; }

/* 30 枚徽章：每一枚的几何构成、对称方式、层次数量都不重复 */
const TG_BADGE_ART = [
/* 01 圆璧   */ '<circle class="bd-c" cx="24" cy="24" r="19"/><circle class="bd-b" cx="24" cy="24" r="12.5"/><circle class="bd-a" cx="24" cy="24" r="5"/>',
/* 02 六棱   */ '<polygon class="bd-b" points="24,4 41,14 41,34 24,44 7,34 7,14"/><polygon class="bd-c" points="24,11 35,17.5 35,30.5 24,37 13,30.5 13,17.5"/><rect class="bd-a" x="21" y="19" width="6" height="10" rx="2"/>',
/* 03 水滴   */ '<path class="bd-b" d="M24 4c8 10 13 16 13 22a13 13 0 0 1-26 0c0-6 5-12 13-22z"/><path class="bd-c" d="M24 14c4.6 6.2 7.4 9.6 7.4 12.8a7.4 7.4 0 0 1-14.8 0C16.6 23.6 19.4 20.2 24 14z"/><circle class="bd-a" cx="20" cy="24" r="2.6"/>',
/* 04 菱格   */ '<polygon class="bd-c" points="24,3 45,24 24,45 3,24"/><polygon class="bd-b" points="24,12 36,24 24,36 12,24"/><polygon class="bd-a" points="24,19 29,24 24,29 19,24"/>',
/* 05 三峰   */ '<polygon class="bd-c" points="24,7 44,41 4,41"/><polygon class="bd-b" points="24,17 36,41 12,41"/><polygon class="bd-a" points="24,27 30,41 18,41"/>',
/* 06 新月   */ '<circle class="bd-b" cx="24" cy="24" r="19"/><circle class="bd-c" cx="31" cy="20" r="16"/><circle class="bd-a" cx="14" cy="30" r="3.4"/>',
/* 07 五芒   */ '<polygon class="bd-b" points="24,3 30,18 46,18 33,28 38,44 24,34 10,44 15,28 2,18 18,18"/><polygon class="bd-c" points="24,13 27,21 35,21 28.5,26 31,34 24,29 17,34 19.5,26 13,21 21,21"/><circle class="bd-a" cx="24" cy="25" r="3"/>',
/* 08 齿轮   */ '<circle class="bd-b" cx="24" cy="24" r="17"/><rect class="bd-a" x="21.5" y="1" width="5" height="8" rx="2"/><rect class="bd-a" x="21.5" y="39" width="5" height="8" rx="2"/><rect class="bd-a" x="1" y="21.5" width="8" height="5" rx="2"/><rect class="bd-a" x="39" y="21.5" width="8" height="5" rx="2"/><circle class="bd-c" cx="24" cy="24" r="9"/><circle class="bd-a" cx="24" cy="24" r="3.4"/>',
/* 09 花瓣   */ '<ellipse class="bd-c" cx="24" cy="12" rx="6" ry="10"/><ellipse class="bd-c" cx="24" cy="36" rx="6" ry="10"/><ellipse class="bd-b" cx="12" cy="24" rx="10" ry="6"/><ellipse class="bd-b" cx="36" cy="24" rx="10" ry="6"/><circle class="bd-a" cx="24" cy="24" r="6"/>',
/* 10 波纹   */ '<path class="bd-l" style="stroke-width:3" d="M4 16c5-5 9-5 14 0s9 5 14 0 9-5 12-2"/><path class="bd-l" style="stroke-width:3" d="M4 26c5-5 9-5 14 0s9 5 14 0 9-5 12-2"/><path class="bd-l" style="stroke-width:3" d="M4 36c5-5 9-5 14 0s9 5 14 0 9-5 12-2"/><circle class="bd-a" cx="24" cy="26" r="3.2"/>',
/* 11 棱镜   */ '<polygon class="bd-b" points="20,6 38,38 2,38"/><polygon class="bd-c" points="20,17 30,35 10,35"/><rect class="bd-a" x="30" y="14" width="16" height="3" rx="1.5"/><rect class="bd-a" x="30" y="21" width="14" height="3" rx="1.5" opacity=".7"/><rect class="bd-a" x="30" y="28" width="12" height="3" rx="1.5" opacity=".45"/>',
/* 12 拱门   */ '<path class="bd-c" d="M7 44V22a17 17 0 0 1 34 0v22z"/><path class="bd-b" d="M14 44V23a10 10 0 0 1 20 0v21z"/><path class="bd-a" d="M20 44V26a4 4 0 0 1 8 0v18z"/><rect class="bd-a" x="4" y="43" width="40" height="4" rx="2"/>',
/* 13 交叉   */ '<rect class="bd-b" x="20" y="3" width="8" height="42" rx="4" transform="rotate(45 24 24)"/><rect class="bd-b" x="20" y="3" width="8" height="42" rx="4" transform="rotate(-45 24 24)"/><circle class="bd-c" cx="24" cy="24" r="9"/><polygon class="bd-a" points="24,17 30,24 24,31 18,24"/>',
/* 14 螺旋   */ '<path class="bd-l" style="stroke-width:3.4" d="M24 24a5 5 0 1 1-4-4.9M24 24a11 11 0 1 1-10.6-11M24 24a17.5 17.5 0 1 1-16.6-17.4"/><circle class="bd-a" cx="24" cy="24" r="3"/>',
/* 15 网格   */ '<rect class="bd-c" x="5" y="5" width="11" height="11" rx="3"/><rect class="bd-b" x="18.5" y="5" width="11" height="11" rx="3"/><rect class="bd-c" x="32" y="5" width="11" height="11" rx="3"/><rect class="bd-b" x="5" y="18.5" width="11" height="11" rx="3"/><rect class="bd-a" x="18.5" y="18.5" width="11" height="11" rx="3"/><rect class="bd-b" x="32" y="18.5" width="11" height="11" rx="3"/><rect class="bd-c" x="5" y="32" width="11" height="11" rx="3"/><rect class="bd-b" x="18.5" y="32" width="11" height="11" rx="3"/><rect class="bd-c" x="32" y="32" width="11" height="11" rx="3"/>',
/* 16 宝珠   */ '<ellipse class="bd-b" cx="24" cy="40" rx="14" ry="4"/><circle class="bd-a" cx="24" cy="21" r="16"/><circle class="bd-c" cx="18" cy="15" r="5.4"/><circle class="bd-c" cx="29" cy="27" r="2.4" opacity=".7"/>',
/* 17 火焰   */ '<path class="bd-a" d="M24 2c2 9 11 12 11 22a11 11 0 0 1-22 0c0-5 3-7 4-11 3 3 3 6 3 6 3-6 4-11 4-17z"/><path class="bd-c" d="M24 24c1 4 5 5 5 9a5.6 5.6 0 0 1-11 0c0-3 4-5 6-9z"/><rect class="bd-b" x="12" y="41" width="24" height="4" rx="2"/>',
/* 18 引力环 */ '<ellipse class="bd-l" style="stroke-width:2.6" cx="24" cy="24" rx="21" ry="9"/><ellipse class="bd-l" style="stroke-width:2.6" cx="24" cy="24" rx="21" ry="9" transform="rotate(60 24 24)"/><ellipse class="bd-l" style="stroke-width:2.6" cx="24" cy="24" rx="21" ry="9" transform="rotate(120 24 24)"/><circle class="bd-a" cx="24" cy="24" r="6.4"/><circle class="bd-c" cx="24" cy="24" r="2.6"/>',
/* 19 潮汐   */ '<path class="bd-c" d="M24 5a19 19 0 1 1 0 38z"/><path class="bd-b" d="M24 5a19 19 0 1 0 0 38z"/><path class="bd-a" d="M5 28c6-5 10 5 19 0s13 5 19 0v4c-6 5-10-5-19 0S11 27 5 32z"/>',
/* 20 星轨   */ '<circle class="bd-l" style="stroke-width:2.4" cx="24" cy="24" r="19"/><ellipse class="bd-l" style="stroke-width:2.4" cx="24" cy="24" rx="19" ry="7" transform="rotate(-28 24 24)"/><circle class="bd-a" cx="24" cy="24" r="7"/><circle class="bd-c" cx="39" cy="14" r="3.6"/><circle class="bd-b" cx="10" cy="33" r="2.4"/>',
/* 21 共鸣   */ '<circle class="bd-a" cx="10" cy="24" r="5"/><path class="bd-l" style="stroke-width:3" d="M19 14a15 15 0 0 1 0 20"/><path class="bd-l" style="stroke-width:3" d="M27 8a24 24 0 0 1 0 32"/><path class="bd-l" style="stroke-width:3" d="M35 3a32 32 0 0 1 0 42"/>',
/* 22 交织   */ '<rect class="bd-b" x="3" y="10" width="42" height="7" rx="3.5"/><rect class="bd-c" x="3" y="31" width="42" height="7" rx="3.5"/><rect class="bd-a" x="10" y="3" width="7" height="42" rx="3.5"/><rect class="bd-a" x="31" y="3" width="7" height="42" rx="3.5" opacity=".72"/><rect class="bd-c" x="20.5" y="20.5" width="7" height="7" rx="2"/>',
/* 23 熔金   */ '<path class="bd-a" d="M12 4h24l-4 14H16z"/><path class="bd-b" d="M16 18h16l-3 12H19z"/><path class="bd-c" d="M19 30h10l-5 15z"/><circle class="bd-c" cx="24" cy="10" r="3"/>',
/* 24 永夜   */ '<path class="bd-a" d="M24 3 43 10v15c0 11-8 18-19 21-11-3-19-10-19-21V10z"/><path class="bd-c" d="M28 14a10 10 0 1 0 0 19 12 12 0 0 1 0-19z"/><circle class="bd-b" cx="17" cy="17" r="2"/><circle class="bd-b" cx="15" cy="27" r="1.4"/>',
/* 25 银河   */ '<path class="bd-b" d="M4 34C12 16 34 32 44 12c2 4 1 8-2 12C31 40 14 28 8 40z"/><circle class="bd-a" cx="14" cy="30" r="2.6"/><circle class="bd-a" cx="24" cy="25" r="3.4"/><circle class="bd-a" cx="34" cy="20" r="2.2"/><circle class="bd-c" cx="40" cy="34" r="2"/><circle class="bd-c" cx="9" cy="14" r="1.8"/>',
/* 26 神谕   */ '<path class="bd-c" d="M2 24c8-11 14-16 22-16s14 5 22 16c-8 11-14 16-22 16S10 35 2 24z"/><circle class="bd-a" cx="24" cy="24" r="9"/><circle class="bd-c" cx="20.5" cy="20.5" r="2.6"/><path class="bd-b" d="M24 4v4M8 12l3 3M40 12l-3 3"/>',
/* 27 圣殿   */ '<polygon class="bd-a" points="24,3 46,16 2,16"/><rect class="bd-b" x="7" y="19" width="6" height="20" rx="2"/><rect class="bd-c" x="17" y="19" width="6" height="20" rx="2"/><rect class="bd-b" x="27" y="19" width="6" height="20" rx="2"/><rect class="bd-c" x="37" y="19" width="4" height="20" rx="2"/><rect class="bd-a" x="2" y="40" width="44" height="5" rx="2.5"/>',
/* 28 无垠   */ '<path class="bd-l" style="stroke-width:5.5" d="M24 24c-4-7-8-9-12-9a9 9 0 0 0 0 18c4 0 8-2 12-9zM24 24c4-7 8-9 12-9a9 9 0 0 1 0 18c-4 0-8-2-12-9z"/><circle class="bd-a" cx="24" cy="24" r="3.4"/><circle class="bd-c" cx="12" cy="24" r="2"/><circle class="bd-c" cx="36" cy="24" r="2"/>',
/* 29 不朽   */ '<path class="bd-l" style="stroke-width:3" d="M24 45C10 39 6 27 8 9c7 2 12 8 14 15"/><path class="bd-l" style="stroke-width:3" d="M24 45c14-6 18-18 16-36-7 2-12 8-14 15"/><polygon class="bd-a" points="24,14 30,24 24,34 18,24"/><circle class="bd-c" cx="24" cy="24" r="3"/>',
/* 30 糖罐   */ '<rect class="bd-a" x="9" y="16" width="30" height="28" rx="9"/><rect class="bd-c" x="13" y="22" width="22" height="10" rx="4"/><rect class="bd-b" x="6" y="9" width="36" height="7" rx="3.5"/><polygon class="bd-a" points="24,0 27.5,6 20.5,6"/><circle class="bd-c" cx="18" cy="38" r="2.4"/><circle class="bd-c" cx="26" cy="39" r="1.8"/><circle class="bd-c" cx="32" cy="36" r="1.4"/>'
];
function tgBadge(lv, size) {
  const t = tgTierOf(lv).t;
  const s = size || 44;
  return `<svg class="tg-badge-svg t${t}" viewBox="0 0 48 48" style="width:${s}px;height:${s}px">${TG_BADGE_ART[lv - 1]}</svg>`;
}
function tgLvOf(sweet) {
  let lv = 1;
  for (const l of TG_LEVELS) if (sweet >= l.need) lv = l.lv;
  return lv;
}

/* 甜蜜值获取与规则（全部公开可见） */
const TG_SWEET_RULES = [
  { act: '每日签到', val: '+5', note: '连续 7 天额外 +30' },
  { act: '建立一个 CP 圈', val: '+120', note: '每日最多计 2 次' },
  { act: '在圈内发布长文（≥800 字）', val: '+45', note: '每日最多计 3 次' },
  { act: '发布短评 / 碎碎念', val: '+8', note: '每日最多计 10 次' },
  { act: '收到他人「磕到了」', val: '+3', note: '同一人每日只计 1 次' },
  { act: '被收藏进他人糖罐', val: '+6', note: '不设上限' },
  { act: '完成一次 AI 共创并采纳', val: '+20', note: '每日最多计 3 次' },
  { act: '保存一份文风档并被复用', val: '+15', note: '按被复用次数计' },
  { act: '圈子当日进入广场热榜', val: '+200', note: '圈主与共建者共享' },
  { act: '连续 30 天活跃', val: '+500', note: '每自然月结算一次' }
];
const TG_RULE_TEXT = [
  { t: '甜蜜值只增不减', d: '常规情况下甜蜜值不会因为不活跃而衰减，等级一旦达成永久保留。仅在违规内容被处理时会扣除该内容对应的全部甜蜜值。' },
  { t: '等级与徽章', d: '共 30 级，分为糖屑、蜜语、心潮、琥珀、星轨、神域六阶。每一级都有独立设计的徽章，形制互不重复，升级瞬间自动更换并可回溯佩戴（LV.26 起解锁自由切换）。' },
  { t: '升级判定', d: '甜蜜值达到下一级门槛时立即升级，无需领取。跨级达成时会依次播放每一级的徽章解锁动效。' },
  { t: '权益继承', d: '高阶权益自动包含所有低阶权益。降级不会发生，因此权益不会被回收。' },
  { t: '数据透明', d: '你在个人中心的等级卡片中可随时查看当前甜蜜值、本级区间、距下一级差值，以及每一笔甜蜜值的来源明细。' }
];

/* ================================================================
   9. 启动
================================================================ */
document.addEventListener('DOMContentLoaded', () => {
  tgSyncStatusBar();
  tgBuildNav();
  tgFillIcons(document);
  tgInitFileInput();
  tgShow('scr-plaza', true);
  requestAnimationFrame(() => tgSyncNav(0));
  window.addEventListener('resize', () => tgSyncNav());
  if (typeof tgInitBifang === 'function') tgInitBifang();
  if (typeof tgInitProfile === 'function') tgInitProfile();
});