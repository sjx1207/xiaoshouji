/* ==========================================================
   共读屿 · gd-core.js
   状态栏 / 数据层 / AI 桥接 / 阅读统计 / 通用工具
   与 Luna OS 共用：luna_api_current、luna_api_model、LunaCharDB
   ========================================================== */

const GD = (() => {

/* ---------------- 状态栏（所有页面统一注入） ---------------- */
function mountStatusBar(onDark = false) {
  if (!document.querySelector('.gd-grain')) {
    const g = document.createElement('div');
    g.className = 'gd-grain';
    document.body.prepend(g);
  }
  let bar = document.querySelector('.status-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'status-bar';
    bar.innerHTML = `
      <div class="status-time" id="gdStatusTime">9:41</div>
      <div class="status-right">
        <div class="signal"><i></i><i></i><i></i><i></i></div>
        <div class="battery">
          <span class="bat-pct" id="gdBatPct">76</span>
          <div class="bat-shell"><div class="bat-inner" id="gdBatInner"></div><div class="bat-nub"></div></div>
        </div>
      </div>`;
    document.body.appendChild(bar);
  }
  if (onDark) bar.classList.add('on-dark');
  tickStatus();
  setInterval(tickStatus, 10000);

  if (!document.getElementById('gdToast')) {
    const t = document.createElement('div'); t.id = 'gdToast'; document.body.appendChild(t);
  }
  if (!document.getElementById('gdTrans')) {
    const m = document.createElement('div'); m.id = 'gdTrans'; document.body.appendChild(m);
  }
}
function setStatusDark(on) {
  const bar = document.querySelector('.status-bar');
  if (bar) bar.classList.toggle('on-dark', !!on);
}
function tickStatus() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const el = document.getElementById('gdStatusTime');
  if (el) el.textContent = new Date().toLocaleTimeString('zh-CN',
    { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const pct = parseInt(localStorage.getItem('luna_bat_pct') || '76');
  const p = document.getElementById('gdBatPct'); if (p) p.textContent = pct;
  const i = document.getElementById('gdBatInner'); if (i) i.style.width = pct + '%';
}

/* ---------------- 转场跳转 ---------------- */
function go(url) {
  const m = document.getElementById('gdTrans');
  if (!m) { location.href = url; return; }
  m.classList.add('on');
  setTimeout(() => { location.href = url; }, 250);
}
function toast(msg, ms = 1900) {
  const t = document.getElementById('gdToast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------------- 自绘确认框（替代 window.confirm） ---------------- */
function confirmBox(title, desc, yesText = '确定', noText = '取消') {
  return new Promise(resolve => {
    const mask = document.createElement('div');
    mask.className = 'gd-mask gd-confirm-mask';
    mask.innerHTML = `
      <div class="gd-confirm">
        <div class="cf-t">${esc(title)}</div>
        ${desc ? `<div class="cf-d">${esc(desc)}</div>` : ''}
        <div class="cf-b">
          <div class="cf-btn no">${esc(noText)}</div>
          <div class="cf-btn yes">${esc(yesText)}</div>
        </div>
      </div>`;
    document.body.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('show'));
    const close = v => {
      mask.classList.remove('show');
      setTimeout(() => mask.remove(), 300);
      resolve(v);
    };
    mask.querySelector('.cf-btn.no').onclick = () => close(false);
    mask.querySelector('.cf-btn.yes').onclick = () => close(true);
    mask.addEventListener('click', e => { if (e.target === mask) close(false); });
  });
}

/* ---------------- 自绘单选列表（替代 <select>） ----------------
   items: [{ v: value, t: 主标题, s: 副标题(可选) }]
   返回选中的 v；若用户取消则返回 null                              */
function pickerBox(title, items, curVal) {
  return new Promise(resolve => {
    const mask = document.createElement('div');
    mask.className = 'gd-mask show';
    mask.innerHTML = `
      <div class="gd-sheet">
        <div class="gd-sheet-head">
          <div class="t">${esc(title)}</div>
          <div class="gd-x">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7"/></svg>
          </div>
        </div>
        <div class="gd-sheet-body">
          ${items.map(it => `
            <div class="gd-opt ${String(it.v) === String(curVal) ? 'on' : ''}" data-v="${esc(it.v)}">
              <div class="ot">${esc(it.t)}</div>
              ${it.s ? `<div class="os">${esc(it.s)}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(mask);
    const close = v => {
      mask.classList.remove('show');
      setTimeout(() => mask.remove(), 300);
      resolve(v);
    };
    mask.querySelector('.gd-x').onclick = () => close(null);
    mask.addEventListener('click', e => { if (e.target === mask) close(null); });
    mask.querySelectorAll('.gd-opt').forEach(el => {
      el.onclick = () => close(el.dataset.v);
    });
  });
}

/* ---------------- IndexedDB ---------------- */
const DB_NAME = 'GongduyuDB', DB_VER = 1;
let _db = null;
function openDB() {
  return new Promise((res, rej) => {
    if (_db) return res(_db);
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('works'))
        db.createObjectStore('works', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('comments'))
        db.createObjectStore('comments', { keyPath: 'id', autoIncrement: true });
      if (!db.objectStoreNames.contains('assets'))
        db.createObjectStore('assets', { keyPath: 'key' });
    };
    req.onsuccess = e => { _db = e.target.result; res(_db); };
    req.onerror = () => rej('GD DB error');
  });
}
function tx(store, mode, fn) {
  return openDB().then(db => new Promise(res => {
    const r = fn(db.transaction(store, mode).objectStore(store));
    r.onsuccess = () => res(r.result);
    r.onerror = () => res(null);
  }));
}
const worksAll    = () => tx('works', 'readonly',  s => s.getAll()).then(r => r || []);
const workGet     = id => tx('works', 'readonly',  s => s.get(Number(id)));
const workPut     = w  => tx('works', 'readwrite', s => s.put(w));
const workDel     = id => tx('works', 'readwrite', s => s.delete(Number(id)));
const commentsAll = () => tx('comments', 'readonly',  s => s.getAll()).then(r => r || []);
const commentPut  = c  => tx('comments', 'readwrite', s => s.put(c));
const commentDel  = id => tx('comments', 'readwrite', s => s.delete(Number(id)));
const assetPut    = (key, val) => tx('assets', 'readwrite', s => s.put({ key, val }));
const assetGet    = key => tx('assets', 'readonly', s => s.get(key)).then(r => r ? r.val : null);

/* 角色库（Luna 共用） */
function getChars() {
  return new Promise(res => {
    const req = indexedDB.open('LunaCharDB');
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) return res([]);
      const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    };
    req.onerror = () => res([]);
  });
}

/* ---------------- 本地配置 ---------------- */
const LS = {
  get(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

const DEFAULT_PROFILE = {
  name: '未署名的读者',
  handle: 'reader_00',
  bio: '在纸页的缝隙里靠岸。',
  location: '共读屿 · 西岸灯塔',
  links: [
    { type: 'weibo', label: 'weibo', value: '' },
    { type: 'ig',    label: 'instagram', value: '' },
    { type: 'x',     label: 'x', value: '' },
    { type: 'lofter',label: 'lofter', value: '' }
  ],
  avatar: '', banner: '',
  joinAt: Date.now()
};
const profile   = () => Object.assign({}, DEFAULT_PROFILE, LS.get('gd_profile', {}));
const setProfile= p => LS.set('gd_profile', p);

const DEFAULT_STATS = { totalMs: 0, words: 0, finished: 0, days: {}, streak: 0, interactions: 0 };
const stats    = () => Object.assign({}, DEFAULT_STATS, LS.get('gd_stats', {}));
const setStats = s => LS.set('gd_stats', s);

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** 累加阅读时长（毫秒），并维护日历与连续天数 */
function addReadTime(ms) {
  if (!ms || ms < 0) return;
  const s = stats();
  s.totalMs += ms;
  const k = todayKey();
  s.days[k] = (s.days[k] || 0) + ms;
  s.streak = calcStreak(s.days);
  setStats(s);
}
function calcStreak(days) {
  let n = 0; const d = new Date();
  // 今天没读则从昨天起算，避免"当天未读就清零"的挫败感
  if (!days[todayKey(d)]) d.setDate(d.getDate() - 1);
  while (days[todayKey(d)]) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
function bumpInteraction(n = 1) { const s = stats(); s.interactions += n; setStats(s); }

/* ---------------- 字数统计工具（阅读器与投稿共用同一口径） ---------------- */
function countWords(text) {
  if (!text) return 0;
  const t = String(text);
  const cjk = (t.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
  const latin = (t.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
  const kana = (t.match(/[\u3040-\u30ff]/g) || []).length;
  return cjk + latin + kana;
}
function fmtWords(n) {
  if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 2).replace(/\.?0+$/, '') + '万';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}
function fmtDuration(ms, long = false) {
  const min = Math.floor(ms / 60000);
  const h = Math.floor(min / 60), m = min % 60;
  if (long) return h ? `${h} 小时 ${m} 分` : `${m} 分钟`;
  return h ? `${h}h ${m}m` : `${m}m`;
}
function fmtDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
function relTime(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return '刚刚';
  if (s < 3600) return Math.floor(s / 60) + ' 分钟前';
  if (s < 86400) return Math.floor(s / 3600) + ' 小时前';
  if (s < 86400 * 7) return Math.floor(s / 86400) + ' 天前';
  return fmtDate(ts);
}
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* ---------------- AI 桥接 ---------------- */
function apiConf() {
  const cur = LS.get('luna_api_current', {});
  return {
    baseUrl: (cur.baseUrl || '').replace(/\/$/, ''),
    apiKey: cur.apiKey || '',
    model: localStorage.getItem('luna_api_model') || ''
  };
}
const apiReady = () => { const c = apiConf(); return !!(c.baseUrl && c.apiKey && c.model); };

async function ai(messages, opts = {}) {
  const c = apiConf();
  if (!c.baseUrl || !c.apiKey) throw new Error('NO_API');
  const resp = await fetch(`${c.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: c.model || opts.model || 'gpt-4o-mini',
      messages,
      temperature: opts.temperature ?? 0.95,
      max_tokens: opts.max_tokens ?? 1200
    })
  });
  if (!resp.ok) throw new Error('HTTP ' + resp.status);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || '';
}
/** 稳健 JSON 解析：容忍 ```json 包裹与前后废话 */
function parseJSON(text) {
  if (!text) return null;
  let t = text.replace(/```json|```/g, '').trim();
  const a = t.indexOf('['), b = t.lastIndexOf(']');
  const c = t.indexOf('{'), d = t.lastIndexOf('}');
  const cand = [];
  if (a !== -1 && b > a) cand.push(t.slice(a, b + 1));
  if (c !== -1 && d > c) cand.push(t.slice(c, d + 1));
  cand.push(t);
  for (const s of cand) { try { return JSON.parse(s); } catch (e) {} }
  return null;
}

/* 角色 → 系统提示 */
function charPrompt(ch) {
  if (!ch) return '';
  const p = [];
  p.push(`你现在扮演「${ch.name || '未命名'}」。`);
  if (ch.role) p.push(`身份：${ch.role}`);
  if (ch.desc) p.push(`简介：${ch.desc}`);
  if (ch.traits) p.push(`性格：${Array.isArray(ch.traits) ? ch.traits.join('、') : ch.traits}`);
  if (ch.speechStyle) p.push(`说话风格：${ch.speechStyle}`);
  if (ch.catchphrases?.length) p.push(`口头禅：${ch.catchphrases.join('、')}`);
  if (ch.likes?.length) p.push(`喜欢：${ch.likes.join('、')}`);
  if (ch.dislikes?.length) p.push(`讨厌：${ch.dislikes.join('、')}`);
  if (ch.relation) p.push(`与用户的关系：${ch.relation}`);
  if (ch.callUser) p.push(`称呼用户为：${ch.callUser}`);
  if (ch.backstory) p.push(`背景：${String(ch.backstory).slice(0, 600)}`);
  if (ch.prompt) p.push(String(ch.prompt).slice(0, 1500));
  p.push('全程保持角色人设，不要出戏，不要提及自己是 AI 或语言模型，不要写免责声明。');
  return p.join('\n');
}

/* ---------------- 头像占位（无 emoji，用几何字母章） ---------------- */
function avatarSVG(seed, size = 44) {
  const s = String(seed || '?');
  let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const shapes = ['circle', 'diamond', 'square', 'hex', 'arc'];
  const sh = shapes[h % shapes.length];
  const rot = h % 90;
  const g1 = ['#2b2f36', '#3d434c', '#585f6a', '#6f7681', '#8b929c'][h % 5];
  const g2 = ['#e9eaed', '#dfe1e6', '#f3f4f6'][(h >> 3) % 3];
  const ch = s.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || 'G';
  let art = '';
  if (sh === 'circle') art = `<circle cx="22" cy="22" r="14.5" fill="none" stroke="${g1}" stroke-width="1.1" opacity=".45"/>`;
  if (sh === 'diamond') art = `<rect x="8" y="8" width="28" height="28" fill="none" stroke="${g1}" stroke-width="1.1" opacity=".4" transform="rotate(45 22 22)"/>`;
  if (sh === 'square') art = `<rect x="7.5" y="7.5" width="29" height="29" fill="none" stroke="${g1}" stroke-width="1.1" opacity=".4"/>`;
  if (sh === 'hex') art = `<path d="M22 6 36 14 36 30 22 38 8 30 8 14Z" fill="none" stroke="${g1}" stroke-width="1.1" opacity=".4"/>`;
  if (sh === 'arc') art = `<path d="M8 26a14 14 0 0 1 28 0" fill="none" stroke="${g1}" stroke-width="1.2" opacity=".45"/><path d="M12 32h20" stroke="${g1}" stroke-width="1" opacity=".3"/>`;
  return `<svg viewBox="0 0 44 44" width="${size}" height="${size}" style="display:block">
    <rect width="44" height="44" rx="10" fill="${g2}"/>
    <g transform="rotate(${rot} 22 22)">${art}</g>
    <text x="22" y="27.5" text-anchor="middle" font-family="'Noto Serif SC',serif" font-size="15" font-weight="700" fill="${g1}">${esc(ch)}</text>
  </svg>`;
}

/* ---------------- 图片压缩（封面 / 头像 / 背景） ---------------- */
function readImage(file, maxW = 1200, quality = 0.86) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const sc = Math.min(1, maxW / img.width);
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        res(cv.toDataURL('image/jpeg', quality));
      };
      img.onerror = rej; img.src = fr.result;
    };
    fr.onerror = rej; fr.readAsDataURL(file);
  });
}

return {
  mountStatusBar, setStatusDark, go, toast, confirmBox, pickerBox,
  openDB, worksAll, workGet, workPut, workDel,
  commentsAll, commentPut, commentDel, assetPut, assetGet, getChars,
  LS, profile, setProfile, stats, setStats, addReadTime, bumpInteraction, todayKey, calcStreak,
  countWords, fmtWords, fmtDuration, fmtDate, relTime, esc,
  ai, apiReady, apiConf, parseJSON, charPrompt, avatarSVG, readImage
};
})();
window.GD = GD;