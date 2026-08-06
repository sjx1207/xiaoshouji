/* ================================
   Luna Post Editor — post-editor.js
   发布动态：文字 / 图片 / 位置 / 心情 / 可见范围
================================ */

/* ---- 内部状态 ---- */
const PE_STATE = {
  images: [],           // [{dataUrl}]
  location: null,       // {name, sub}
  mood: null,            // {label, emoji}
  audience: 'public',    // public | friends | private
};

/* ---- 全球位置搜索（Nominatim / OpenStreetMap，免费、无需 API Key） ---- */
const PE_GEOCODE_ENDPOINT = 'https://nominatim.openstreetmap.org/search';
const PE_REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
let peLocSearchToken = 0;      // 竞态保护：只渲染最新一次请求的结果
let peLocDebounceTimer = null;
let peLocRecents = [];         // 最近使用过的位置（本地缓存，最多 6 条）

try {
  peLocRecents = JSON.parse(localStorage.getItem('luna_recent_locations') || '[]');
} catch (e) { peLocRecents = []; }

const PE_MOODS = [
  { emoji: '✦', label: '平静' },
  { emoji: '◎', label: '愉悦' },
  { emoji: '◇', label: '专注' },
  { emoji: '△', label: '思考' },
  { emoji: '☾', label: '疲惫' },
  { emoji: '✧', label: '期待' },
  { emoji: '～', label: '放松' },
];

const PE_AUDIENCE = [
  { id: 'public',  name: '公开可见', desc: '所有人都可以看到这条动态' },
  { id: 'friends', name: '仅好友可见', desc: '只有你的好友可以看到' },
  { id: 'private', name: '仅自己可见', desc: '只有你自己能看到' },
];

/* ---- 打开 / 关闭 ---- */
function openNewPost() {
  const overlay = document.getElementById('peOverlay');
  const page    = document.getElementById('peaPage');
  overlay.classList.add('show');
  page.classList.add('show');

  peSyncStatusBar();
  peSyncAuthor();
  document.body.style.overflow = 'hidden';

  // 每次打开聚焦文本框（延迟以等待过渡）
  setTimeout(() => {
    const ta = document.getElementById('peTextarea');
    if (ta) ta.focus();
  }, 380);
}

function peRequestClose() {
  const ta = document.getElementById('peTextarea');
  const hasContent = (ta && ta.value.trim().length > 0) || PE_STATE.images.length > 0;
  if (hasContent) {
    if (!confirm('放弃这条动态吗？')) return;
  }
  peResetState();
  peClose();
}

function peClose() {
  document.getElementById('peOverlay').classList.remove('show');
  document.getElementById('peaPage').classList.remove('show');
  document.body.style.overflow = '';
}

function peResetState() {
  PE_STATE.images = [];
  PE_STATE.location = null;
  PE_STATE.mood = null;
  PE_STATE.audience = 'public';

  const ta = document.getElementById('peTextarea');
  if (ta) ta.value = '';
  peOnTextInput();
  peRenderMedia();
  peRenderMetaChips();
  peUpdateAudienceLabels();

  const locVal = document.getElementById('peLocValue');
  if (locVal) locVal.textContent = '添加位置';
  const moodVal = document.getElementById('peMoodValue');
  if (moodVal) moodVal.textContent = '添加心情';
}

/* ---- 状态栏同步（与主界面一致） ---- */
function peSyncStatusBar() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const t  = new Date().toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  const timeEl = document.getElementById('peStatusTime');
  if (timeEl) timeEl.textContent = t;

  const mainPct   = document.getElementById('batPct');
  const mainInner = document.getElementById('batInner');
  const pePct     = document.getElementById('peBatPct');
  const peInner   = document.getElementById('peBatInner');
  if (mainPct && pePct)     pePct.textContent = mainPct.textContent;
  if (mainInner && peInner) peInner.style.width = mainInner.style.width;

  const enabled  = localStorage.getItem('luna_island_enabled') === 'true';
  const style    = localStorage.getItem('luna_island_style') || 'minimal';
  const islandEl = document.getElementById('peStatusIsland');
  if (islandEl) {
    if (!enabled) { islandEl.innerHTML = ''; }
    else {
      const styleMap = {
        minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
        glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
        clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text">--:--</span></div></div>`,
        pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
        ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
        rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
        music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
        scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
      };
      islandEl.innerHTML = styleMap[style] || styleMap.minimal;
    }
  }
}

/* ---- 作者信息同步（读取主界面头像/昵称） ---- */
function peSyncAuthor() {
  const avEl   = document.getElementById('peAuthorAv');
  const nameEl = document.getElementById('peAuthorName');

  // 优先取 Profile 页头像/昵称，其次退回 Messages 页头像
  const profileNameEl = document.querySelector('#pageProfile .pf-name, #pageProfile .pf-display-name');
  const igAvEl = document.querySelector('.ig-av');

  if (avEl) {
    if (igAvEl) {
      avEl.textContent = igAvEl.childNodes[0] ? igAvEl.childNodes[0].textContent.trim() || '我' : '我';
    }
  }
  if (nameEl) {
    nameEl.textContent = (profileNameEl && profileNameEl.textContent.trim()) || 'Luna';
  }
}

/* ---- 文本输入 ---- */
function peOnTextInput() {
  const ta = document.getElementById('peTextarea');
  const count = document.getElementById('peCharCount');
  const len = ta.value.length;
  count.textContent = `${len} / 500`;
  count.classList.toggle('warn', len > 450);
  peUpdatePublishState();
}

/* ---- 发布按钮状态 ---- */
function peUpdatePublishState() {
  const ta = document.getElementById('peTextarea');
  const btn = document.getElementById('pePublishBtn');
  const has = (ta.value.trim().length > 0) || PE_STATE.images.length > 0;
  btn.classList.toggle('active', has);
}

/* ---- 图片处理 ---- */
function peHandleFiles(event) {
  const files = Array.from(event.target.files || []);
  const remaining = 9 - PE_STATE.images.length;
  const toRead = files.slice(0, remaining);

  toRead.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      PE_STATE.images.push({ dataUrl: e.target.result });
      peRenderMedia();
      peUpdatePublishState();
    };
    reader.readAsDataURL(file);
  });

  event.target.value = '';

  if (files.length > remaining) {
    peToast('最多添加 9 张图片');
  }
}

function peRemoveImage(idx) {
  PE_STATE.images.splice(idx, 1);
  peRenderMedia();
  peUpdatePublishState();
}

function peRenderMedia() {
  const zone = document.getElementById('peMediaZone');
  const grid = document.getElementById('peMediaGrid');
  const imgCount = document.getElementById('peImgCount');
  const n = PE_STATE.images.length;

  if (n === 0) {
    zone.style.display = 'none';
    grid.innerHTML = '';
    imgCount.textContent = '';
    return;
  }

  zone.style.display = 'block';
  grid.className = `pe-media-grid count-${n === 1 ? 1 : (n === 2 ? 2 : 3)}`;
  imgCount.textContent = `${n}/9`;

  let html = '';
  PE_STATE.images.forEach((img, i) => {
    html += `
      <div class="pe-media-item">
        <img src="${img.dataUrl}" alt="" />
        <div class="pe-media-remove" onclick="peRemoveImage(${i})">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </div>
      </div>`;
  });

  if (n < 9) {
    html += `
      <div class="pe-media-add" onclick="document.getElementById('peFileInput').click()">
        <div class="pe-media-add-inner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(10,10,10,0.4)" stroke-width="1.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          <div class="pe-media-add-count">${n}/9</div>
        </div>
      </div>`;
  }

  grid.innerHTML = html;
}

/* ---- 位置弹层 ---- */
function peOpenLocation() {
  const overlay = document.getElementById('peLocOverlay');
  const sheet   = document.getElementById('peLocSheet');
  overlay.classList.add('show');
  sheet.classList.add('show');
  document.getElementById('peLocSearch').value = '';
  peShowLocationIdle();
  setTimeout(() => document.getElementById('peLocSearch').focus(), 260);
}
function peCloseLocation() {
  document.getElementById('peLocOverlay').classList.remove('show');
  document.getElementById('peLocSheet').classList.remove('show');
  clearTimeout(peLocDebounceTimer);
}

/* 初始状态：不显示位置 + 使用当前定位 + 最近使用过的地点 */
function peShowLocationIdle() {
  const el = document.getElementById('peLocList');
  let html = `
    <div class="pe-loc-item" onclick="peSelectLocation(null)">
      <div class="pe-loc-pin">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div><div class="pe-loc-name">不显示位置</div></div>
    </div>
    <div class="pe-loc-item" id="peLocUseCurrent" onclick="peUseCurrentLocation()">
      <div class="pe-loc-pin">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M22 12h-3M5 12H2"/></svg>
      </div>
      <div><div class="pe-loc-name">使用当前位置</div></div>
    </div>
  `;

  if (peLocRecents.length > 0) {
    html += `<div class="pe-loc-section-label">最近使用</div>`;
    html += peLocRecents.map(loc => peLocItemHtml(loc)).join('');
  }

  html += `<div class="pe-loc-section-label">输入地点名称，可搜索全球任意城市 / 地标</div>`;

  el.innerHTML = html;
}

function peLocItemHtml(loc) {
  return `
    <div class="pe-loc-item" onclick='peSelectLocation(${JSON.stringify(loc).replace(/'/g, "&#39;")})'>
      <div class="pe-loc-pin">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
      <div>
        <div class="pe-loc-name">${loc.name}</div>
        ${loc.sub ? `<div class="pe-loc-sub">${loc.sub}</div>` : ''}
      </div>
    </div>`;
}

function peShowLocationLoading() {
  document.getElementById('peLocList').innerHTML = `
    <div class="pe-loc-status">
      <div class="pe-loc-spinner"></div>
      <div>搜索中…</div>
    </div>`;
}

function peShowLocationEmpty() {
  document.getElementById('peLocList').innerHTML = `
    <div class="pe-loc-status">
      <div>未找到相关地点</div>
    </div>`;
}

function peShowLocationError() {
  document.getElementById('peLocList').innerHTML = `
    <div class="pe-loc-status">
      <div>搜索失败，请检查网络后重试</div>
    </div>`;
}

/* 输入防抖 + 全球搜索（Nominatim） */
function peFilterLocations() {
  const q = document.getElementById('peLocSearch').value.trim();
  clearTimeout(peLocDebounceTimer);

  if (!q) {
    peShowLocationIdle();
    return;
  }

  peLocDebounceTimer = setTimeout(() => peRunLocationSearch(q), 380);
}

async function peRunLocationSearch(query) {
  const token = ++peLocSearchToken;
  peShowLocationLoading();

  try {
    const url = `${PE_GEOCODE_ENDPOINT}?format=jsonv2&addressdetails=1&limit=12&accept-language=zh-CN&q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('bad response');
    const data = await res.json();

    if (token !== peLocSearchToken) return; // 已有更新的搜索，丢弃这次结果

    if (!Array.isArray(data) || data.length === 0) {
      peShowLocationEmpty();
      return;
    }

    const results = data.map(peMapNominatimResult);
    document.getElementById('peLocList').innerHTML = results.map(loc => peLocItemHtml(loc)).join('');
  } catch (err) {
    if (token !== peLocSearchToken) return;
    peShowLocationError();
  }
}

/* 将 Nominatim 返回结果整理为 {name, sub, lat, lon} */
function peMapNominatimResult(item) {
  const addr = item.address || {};
  const name = addr.attraction || addr.building || addr.amenity || addr.shop ||
               addr.road || addr.suburb || addr.neighbourhood ||
               addr.city || addr.town || addr.village || addr.county ||
               (item.display_name ? item.display_name.split(',')[0] : '未知地点');

  const subParts = [addr.city || addr.town || addr.village, addr.state, addr.country]
    .filter(Boolean)
    .filter((v, i, arr) => v !== name && arr.indexOf(v) === i);

  return {
    name: name.trim(),
    sub: subParts.join(' · '),
    lat: item.lat,
    lon: item.lon,
  };
}

/* 使用浏览器定位，反查地名 */
function peUseCurrentLocation() {
  if (!('geolocation' in navigator)) {
    peToast('当前设备不支持定位');
    return;
  }
  const btn = document.getElementById('peLocUseCurrent');
  if (btn) btn.querySelector('.pe-loc-name').textContent = '正在定位…';

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude, longitude } = pos.coords;
      try {
        const url = `${PE_REVERSE_ENDPOINT}?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-CN`;
        const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
        const item = await res.json();
        const loc = peMapNominatimResult(item);
        peSelectLocation(loc);
      } catch (err) {
        peToast('定位解析失败，请重试');
        peShowLocationIdle();
      }
    },
    () => {
      peToast('无法获取定位权限');
      peShowLocationIdle();
    },
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

function peSelectLocation(loc) {
  PE_STATE.location = loc;
  document.getElementById('peLocValue').textContent = loc ? loc.name : '添加位置';
  peRenderMetaChips();
  peCloseLocation();

  if (loc) {
    peLocRecents = [loc, ...peLocRecents.filter(l => l.name !== loc.name)].slice(0, 6);
    try { localStorage.setItem('luna_recent_locations', JSON.stringify(peLocRecents)); } catch (e) {}
  }
}

/* ---- 心情弹层 ---- */
function peOpenMood() {
  const overlay = document.getElementById('peMoodOverlay');
  const sheet   = document.getElementById('peMoodSheet');
  overlay.classList.add('show');
  sheet.classList.add('show');
  const el = document.getElementById('peMoodList');
  el.innerHTML = PE_MOODS.map(m => `
    <div class="pe-mood-item" onclick='peSelectMood(${JSON.stringify(m)})'>
      <div class="pe-mood-emoji-txt">${m.emoji}</div>
      <div class="pe-loc-name">${m.label}</div>
    </div>
  `).join('') + `
    <div class="pe-mood-item" onclick="peSelectMood(null)">
      <div class="pe-mood-emoji-txt">—</div>
      <div class="pe-loc-name">不添加心情</div>
    </div>
  `;
}
function peCloseMood() {
  document.getElementById('peMoodOverlay').classList.remove('show');
  document.getElementById('peMoodSheet').classList.remove('show');
}
function peSelectMood(mood) {
  PE_STATE.mood = mood;
  document.getElementById('peMoodValue').textContent = mood ? `${mood.emoji} ${mood.label}` : '添加心情';
  peRenderMetaChips();
  peCloseMood();
}

/* ---- 可见范围弹层 ---- */
function peOpenAudience() {
  const overlay = document.getElementById('peAudOverlay');
  const sheet   = document.getElementById('peAudSheet');
  overlay.classList.add('show');
  sheet.classList.add('show');
  const el = document.getElementById('peAudList');
  el.innerHTML = PE_AUDIENCE.map(a => `
    <div class="pe-audience-item ${a.id === PE_STATE.audience ? 'sel' : ''}" onclick="peSelectAudience('${a.id}')">
      <div>
        <div class="pe-loc-name">${a.name}</div>
        <div class="pe-audience-desc">${a.desc}</div>
      </div>
      <div class="pe-audience-check"></div>
    </div>
  `).join('');
}
function peCloseAudience() {
  document.getElementById('peAudOverlay').classList.remove('show');
  document.getElementById('peAudSheet').classList.remove('show');
}
function peSelectAudience(id) {
  PE_STATE.audience = id;
  peUpdateAudienceLabels();
  peCloseAudience();
}
function peUpdateAudienceLabels() {
  const found = PE_AUDIENCE.find(a => a.id === PE_STATE.audience) || PE_AUDIENCE[0];
  const label1 = document.getElementById('peAudienceLabel');
  const label2 = document.getElementById('peAudienceValue2');
  if (label1) label1.textContent = found.name;
  if (label2) label2.textContent = found.name;
}

/* ---- 元信息 chips（位置 / 心情） ---- */
function peRenderMetaChips() {
  const wrap = document.getElementById('peMetaChips');
  const chips = [];

  if (PE_STATE.location) {
    chips.push(`
      <div class="pe-meta-chip">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        ${PE_STATE.location.name}
        <span class="pe-meta-chip-x" onclick="peSelectLocation(null)">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
      </div>`);
  }

  if (PE_STATE.mood) {
    chips.push(`
      <div class="pe-meta-chip">
        ${PE_STATE.mood.emoji} ${PE_STATE.mood.label}
        <span class="pe-meta-chip-x" onclick="peSelectMood(null)">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </span>
      </div>`);
  }

  wrap.style.display = chips.length ? 'flex' : 'none';
  wrap.innerHTML = chips.join('');
}

/* ---- 发布 ---- */
function pePublish() {
  const ta = document.getElementById('peTextarea');
  const text = ta.value.trim();
  const hasContent = text.length > 0 || PE_STATE.images.length > 0;
  if (!hasContent) return;

  const overlay = document.getElementById('pePublishingOverlay');
  overlay.classList.add('show');

  setTimeout(() => {
    if (typeof momentsPublishPost === 'function') {
      momentsPublishPost({
        text,
        images: PE_STATE.images.map(i => i.dataUrl),
        location: PE_STATE.location,
        mood: PE_STATE.mood,
        audience: PE_STATE.audience,
      });
    }

    overlay.classList.remove('show');
    peResetState();
    peClose();
    peToast('发布成功');
  }, 700);
}

/* ---- 轻提示 ---- */
function peToast(msg) {
  const el = document.getElementById('peToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(peToast._t);
  peToast._t = setTimeout(() => el.classList.remove('show'), 1800);
}