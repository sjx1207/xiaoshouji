/* ==========================================================
   Halo Browser · 交互逻辑
   状态栏时间/电量与主屏 phonechar.js 完全同规格同步
   角色识别逻辑与 phonechar.js 共用同一套 localStorage / IndexedDB 约定，
   确保打开的是「当前角色专属」的浏览器，而不是通用界面。
   ========================================================== */

// ---------------- 当前角色识别（与 phonechar.js 完全一致的读取顺序） ----------------
//   URL ?char=<id> 优先 > luna_active_phone_char > luna_active_char > 按 luna_current_chat 名字兜底 > 全部角色的第一个

function bcGetActiveCharId() {
  try {
    const url = new URL(window.location.href);
    const q = url.searchParams.get('char');
    if (q) return isNaN(Number(q)) ? q : Number(q);
  } catch (e) {}
  const stored = localStorage.getItem('luna_active_phone_char') || localStorage.getItem('luna_active_char');
  if (stored) return isNaN(Number(stored)) ? stored : Number(stored);
  return null;
}

let _bcCharDB = null;
function bcOpenCharDB() {
  if (_bcCharDB) return Promise.resolve(_bcCharDB);
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => { _bcCharDB = e2.target.result; res(_bcCharDB); };
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => { _bcCharDB = e3.target.result; res(_bcCharDB); };
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
  });
}

async function bcGetAllChars() {
  try {
    const db = await bcOpenCharDB();
    return await new Promise(res => {
      const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch (e) { return []; }
}

async function bcLoadActiveChar() {
  const id = bcGetActiveCharId();
  const all = await bcGetAllChars();
  if (!all.length) return null;
  if (id != null) {
    const found = all.find(c => c.id === id || String(c.id) === String(id));
    if (found) return found;
  }
  const name = localStorage.getItem('luna_current_chat');
  if (name) {
    const byName = all.find(c => c.name === name);
    if (byName) return byName;
  }
  return all[0] || null;
}

// 与 phonechar.js 一致的头像兜底底色
const BC_COLOR_MAP = {
  warm:  { avBg:'#1C1C1C', avCol:'#B4B4B4' },
  cool:  { avBg:'#141414', avCol:'#9C9C9C' },
  gold:  { avBg:'#181818', avCol:'#A8A8A8' },
  ash:   { avBg:'#141414', avCol:'#9D9D9D' },
  mist:  { avBg:'#151515', avCol:'#A5A5A5' },
  blush: { avBg:'#171717', avCol:'#ADADAD' },
};

function bcEscapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

// 把角色身份同步进浏览器顶部品牌位（头像 / 名字 / 页面标题）
let BC_CHAR = null;

function bcApplyBrand(char) {
  const avatarWrap = document.getElementById('brandAvatar');
  const avatarImg = document.getElementById('brandAvatarImg');
  const avatarLetter = document.getElementById('brandAvatarLetter');
  const nameEl = document.getElementById('brandName');
  const subEl = document.getElementById('brandSub');
  if (!avatarWrap || !nameEl) return;

  const col = BC_COLOR_MAP[char?.color] || BC_COLOR_MAP.warm;
  const letter = (char?.name || '?')[0].toUpperCase();

  if (char?.avatar) {
    avatarImg.src = char.avatar;
    avatarImg.alt = char.name || '';
    avatarWrap.classList.add('has-img');
    avatarWrap.style.background = '';
  } else {
    avatarWrap.classList.remove('has-img');
    avatarWrap.style.background = col.avBg;
    avatarLetter.textContent = letter;
    avatarLetter.style.color = col.avCol;
  }

  nameEl.textContent = char?.name ? `${char.name} 的浏览器` : '未识别角色';
  document.title = char?.name ? `${char.name} 的浏览器` : 'Halo Browser';

  if (subEl) {
    subEl.textContent = char?.name ? '记录已同步 · 仅本人可见' : '未找到匹配角色数据';
  }
}

async function bcInitCharacterIdentity() {
  BC_CHAR = await bcLoadActiveChar();
  bcApplyBrand(BC_CHAR);
}

bcInitCharacterIdentity();

// ---------------- 状态栏：时间跟随系统实时时间 ----------------

function updateStatusBarTime() {
  const timeEl = document.getElementById('time');
  if (!timeEl) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hours}:${minutes}`;
}

updateStatusBarTime();
setInterval(updateStatusBarTime, 1000 * 10);

// ---------------- 状态栏：电池同步设备真实电量 ----------------

function setBatteryWidth(level) {
  const levelEl = document.getElementById('batteryLevel');
  if (!levelEl) return;
  const clamped = Math.max(0, Math.min(1, level));
  const fullWidth = 16;
  levelEl.setAttribute('width', (fullWidth * clamped).toFixed(2));
}

if ('getBattery' in navigator) {
  navigator.getBattery().then((battery) => {
    setBatteryWidth(battery.level);
    battery.addEventListener('levelchange', () => {
      setBatteryWidth(battery.level);
    });
  });
}

// ---------------- 模式切换：日常 / 私密 ----------------

const modeSwitch = document.getElementById('modeSwitch');
const panelNormal = document.getElementById('panelNormal');
const panelPrivate = document.getElementById('panelPrivate');
const searchPlaceholder = document.getElementById('searchPlaceholder');

const PLACEHOLDER_TEXT = {
  normal: '搜索或输入网址',
  private: '私密标签页 · 搜索不会被记录',
};

const BRAND_SUB_TEXT = {
  normal: '记录已同步 · 仅本人可见',
  private: '私密模式已开启 · 不写入常规历史',
};

function setMode(mode) {
  document.body.classList.toggle('mode-private', mode === 'private');

  modeSwitch.querySelectorAll('.mode-btn').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.mode === mode);
  });

  panelNormal.classList.toggle('is-active', mode === 'normal');
  panelPrivate.classList.toggle('is-active', mode === 'private');

  searchPlaceholder.textContent = PLACEHOLDER_TEXT[mode] || PLACEHOLDER_TEXT.normal;

  const subEl = document.getElementById('brandSub');
  if (subEl && BC_CHAR?.name) {
    subEl.textContent = BRAND_SUB_TEXT[mode] || BRAND_SUB_TEXT.normal;
  }
}

modeSwitch.addEventListener('click', (e) => {
  const btn = e.target.closest('.mode-btn');
  if (!btn) return;
  setMode(btn.dataset.mode);
});

// ---------------- 私密记录：点按模糊标题以显示/隐藏 ----------------

document.querySelectorAll('[data-reveal]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    el.classList.toggle('is-revealed');
  });
});

// ---------------- 网页视图：点按历史记录行，模拟"打开了当时那个网页" ----------------
// 私密记录需先点按模糊标题揭示后，才允许打开网页视图，
// 避免误触直接看到内容，和「私密」这件事的分量保持一致。
//
// 详情页渲染的是真实的"文章正文"，而不是搜索结果列表：
// 每条历史记录自带完整的作者信息、标题、若干段落文字，
// 批注挂在具体某一段正文的末尾（就地展开的旁批气泡），
// 而浏览器视角的内心 OS 是读这篇内容时整体的独立心理描述。

const webview = document.getElementById('webview');
const webviewBack = document.getElementById('webviewBack');
const webviewDeleteBtn = document.getElementById('webviewDeleteBtn');
const webviewAddressText = document.getElementById('webviewAddressText');
const webviewAddressLock = document.getElementById('webviewAddressLock');
const articleSourceAvatar = document.getElementById('articleSourceAvatar');
const articleSourceName = document.getElementById('articleSourceName');
const articleSourceMeta = document.getElementById('articleSourceMeta');
const articleTitleEl = document.getElementById('articleTitle');
const articleBody = document.getElementById('articleBody');
const ownerOs = document.getElementById('ownerOs');
const ownerOsText = document.getElementById('ownerOsText');

let webviewActiveRow = null;

function bcEscapeHtml2(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

// 解析行上的 data-paragraphs："段落一||段落二||段落三..."
function parseParagraphs(row) {
  const raw = row.dataset.paragraphs || '';
  if (!raw) return [row.dataset.title || '这条记录还没有更多正文内容。'];
  return raw.split('||').map((s) => s.trim()).filter(Boolean);
}

// 解析行上的 data-annotate："段落序号|批注正文::段落序号|批注正文::..."
// 序号从 0 开始，对应 parseParagraphs() 返回数组里的第几段；
// 一个 Map：段落序号 -> 批注文本，缺省段落就没有批注图钉
function parseAnnotations(row) {
  const raw = row.dataset.annotate || '';
  const map = new Map();
  if (!raw) return map;
  raw.split('::').forEach((chunk) => {
    const idx = chunk.indexOf('|');
    if (idx === -1) return;
    const key = chunk.slice(0, idx).trim();
    const text = chunk.slice(idx + 1).trim();
    if (!text) return;
    const n = Number(key);
    if (!Number.isNaN(n)) map.set(n, text);
  });
  return map;
}

const PIN_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v6.2M12 3c-2.5 0-4.3 1.7-4.3 4 0 1.6.9 2.6 1.8 3.5.7.7 1.3 1.4 1.5 2.5M12 3c2.5 0 4.3 1.7 4.3 4 0 1.6-.9 2.6-1.8 3.5-.7.7-1.3 1.4-1.5 2.5M9.5 20.5h5"/></svg>';

// 渲染文章正文：逐段落生成 <p>，每一段末尾若命中批注 Map，
// 追加一枚图钉按钮 + 一个默认收起的旁批气泡（直接跟在该段落之后，
// 属于文章正文本身的一部分，而不是弹层/汇总列表）
function renderArticleBody(row) {
  const paragraphs = parseParagraphs(row);
  const annotations = parseAnnotations(row);

  articleBody.innerHTML = paragraphs.map((text, i) => {
    const annoText = annotations.get(i);
    const annoId = `anno-${i}`;
    const pin = annoText
      ? `<button type="button" class="pin-btn" data-pin-target="${annoId}" aria-label="查看批注">${PIN_ICON}</button>`
      : '';
    const bubble = annoText
      ? `<div class="inline-annotate" id="${annoId}">
          <div class="inline-annotate-inner">
            <span class="inline-annotate-tag">批注</span>
            <p class="inline-annotate-text">${bcEscapeHtml2(annoText)}</p>
          </div>
        </div>`
      : '';
    return `<div class="article-para">
      <p class="article-p">${bcEscapeHtml2(text)}${pin}</p>
      ${bubble}
    </div>`;
  }).join('');

  // 图钉点击：就地展开/收起该段落自己的批注气泡，互不影响其他段落，
  // 展开时带一个轻微的下坠 + 淡入动效（见 CSS .inline-annotate.is-open）
  articleBody.querySelectorAll('.pin-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.pinTarget);
      if (!target) return;
      const willOpen = !target.classList.contains('is-open');
      target.classList.toggle('is-open', willOpen);
      btn.classList.toggle('is-active', willOpen);
    });
  });
}

function renderArticle(row) {
  const title = row.dataset.title || '';
  const site = row.dataset.site || '';
  const isPrivate = row.hasAttribute('data-private');

  webviewAddressText.textContent = isPrivate ? '私密搜索 · 不留存记录' : (site || title);
  webviewAddressLock.style.display = isPrivate ? 'flex' : 'none';

  // 来源信息条：作者名 / 头像首字 / 发布语境
  const authorName = row.dataset.author || (isPrivate ? '匿名树洞' : site || '未知来源');
  const authorMeta = row.dataset.authorMeta || (isPrivate ? '私密浏览 · 不会留下痕迹' : '');
  articleSourceName.textContent = authorName;
  articleSourceMeta.textContent = authorMeta;
  articleSourceAvatar.textContent = (authorName || '?').trim()[0] || '?';

  articleTitleEl.textContent = row.dataset.articleTitle || row.dataset.title || '';

  renderArticleBody(row);

  // 浏览器视角：手机主人查阅这条内容时的内心 OS —— 每条历史记录都有各自独立的一句，
  // 默认展开，重新打开时重播一次淡入动效，强调这是"活的旁观视角"
  if (ownerOsText) {
    ownerOsText.textContent = row.dataset.os || '这一刻没有特别的想法，只是随手看看。';
  }
  if (ownerOs) {
    ownerOs.classList.remove('is-collapsed');
    ownerOs.setAttribute('aria-expanded', 'true');
    ownerOs.style.animation = 'none';
    // 强制重排以重新触发入场动画
    void ownerOs.offsetWidth;
    ownerOs.style.animation = '';
  }
}

// 浏览器视角 OS 卡片：点击整张卡片可折叠/展开，方便专心看正文
if (ownerOs) {
  ownerOs.addEventListener('click', () => {
    const collapsed = ownerOs.classList.toggle('is-collapsed');
    ownerOs.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  });
}

function openWebview(row) {
  if (!webview || !row) return;
  webviewActiveRow = row;
  const isPrivate = row.hasAttribute('data-private');
  webview.classList.toggle('is-private-view', isPrivate);
  // 状态栏也要跟着网页视图一起切换深浅，避免顶部状态栏和下方页面色调打架
  document.body.classList.add('webview-open');
  document.body.classList.toggle('webview-open-private', isPrivate);
  renderArticle(row);
  webview.classList.add('is-open');
  webviewPageEl?.scrollTo({ top: 0, behavior: 'auto' });
}

const webviewPageEl = document.getElementById('webviewPage');

function closeWebview() {
  webview?.classList.remove('is-open');
  document.body.classList.remove('webview-open', 'webview-open-private');
  webviewActiveRow = null;
}

document.querySelectorAll('.history-row[data-entry]').forEach((row) => {
  row.addEventListener('click', (e) => {
    e.preventDefault();

    // 点击的是私密标题的模糊揭示区域本身，不重复触发网页视图
    if (e.target.closest('[data-reveal]')) return;

    // 私密记录必须先被揭示过一次，才能打开对应网页视图
    const revealEl = row.querySelector('[data-reveal]');
    if (revealEl && !revealEl.classList.contains('is-revealed')) {
      revealEl.classList.add('is-revealed');
      return;
    }

    openWebview(row);
  });
});

webviewBack?.addEventListener('click', closeWebview);

webviewDeleteBtn?.addEventListener('click', () => {
  if (!webviewActiveRow) return;
  const row = webviewActiveRow;
  closeWebview();
  row.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
  row.style.opacity = '0';
  row.style.transform = 'translateX(-12px)';
  setTimeout(() => row.remove(), 220);
});

// ---------------- 清除记录按钮：轻反馈 ----------------

document.querySelectorAll('.panel-clear').forEach((btn) => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.clear === 'private' ? panelPrivate : panelNormal;
    const rows = group.querySelectorAll('.history-group');
    rows.forEach((g) => {
      g.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      g.style.opacity = '0';
      g.style.transform = 'translateY(-6px)';
    });
    setTimeout(() => {
      rows.forEach((g) => g.remove());
    }, 260);
  });
});

// ---------------- 底部工具栏按钮：按压反馈 ----------------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    btn.style.transform = 'scale(0.85)';
    setTimeout(() => { btn.style.transform = ''; }, 120);
  });
});

// ---------------- 更多按钮：轻反馈（预留菜单入口） ----------------

const topbarMore = document.getElementById('topbarMore');
if (topbarMore) {
  topbarMore.addEventListener('click', () => {
    topbarMore.style.transform = 'scale(0.85)';
    setTimeout(() => { topbarMore.style.transform = ''; }, 120);
  });
}

// ---------------- 更新按钮：刷新当前面板记录 + 重新同步角色身份 ----------------

const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    if (refreshBtn.classList.contains('is-refreshing')) return;
    refreshBtn.classList.add('is-refreshing');

    // 重新同步角色身份，防止切换角色后品牌位仍停留在旧角色
    await bcInitCharacterIdentity();

    setTimeout(() => {
      refreshBtn.classList.remove('is-refreshing');
    }, 500);
  });
}

// ---------------- 背景上传：更新按钮右侧的按钮之一，点击后选择图片并设为全屏背景 ----------------
// 背景图与角色身份绑定存储在 IndexedDB（LunaCharDB / bgPhotos），
// 保证不同角色各自拥有独立背景，且整张图片保持原始清晰度，不做任何模糊处理。

const bgPhoto = document.getElementById('bgPhoto');
const bgUploadInput = document.getElementById('bgUploadInput');
const uploadBgBtn = document.getElementById('uploadBgBtn');
const bgToast = document.getElementById('bgToast');

function bcShowToast(msg) {
  if (!bgToast) return;
  bgToast.textContent = msg;
  bgToast.classList.add('is-shown');
  clearTimeout(bcShowToast._t);
  bcShowToast._t = setTimeout(() => bgToast.classList.remove('is-shown'), 1800);
}

function bcBgStoreKey() {
  const id = bcGetActiveCharId();
  return `luna_browser_bg_${id != null ? id : 'default'}`;
}

function bcOpenBgDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('LunaBrowserBgDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('bg')) {
        db.createObjectStore('bg');
      }
    };
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = (e) => rej(e.target.error);
  });
}

async function bcSaveBg(dataUrl) {
  try {
    const db = await bcOpenBgDB();
    await new Promise((res, rej) => {
      const tx = db.transaction('bg', 'readwrite');
      tx.objectStore('bg').put(dataUrl, bcBgStoreKey());
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (e) { /* 静默失败，不影响当前会话内的显示 */ }
}

async function bcLoadBg() {
  try {
    const db = await bcOpenBgDB();
    return await new Promise((res) => {
      const tx = db.transaction('bg', 'readonly');
      const r = tx.objectStore('bg').get(bcBgStoreKey());
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => res(null);
    });
  } catch (e) { return null; }
}

function bcApplyBg(dataUrl) {
  if (!bgPhoto || !dataUrl) return;
  bgPhoto.style.backgroundImage = `url("${dataUrl}")`;
  bgPhoto.classList.add('is-active');
  document.body.classList.add('has-bg-photo');
  // 注意：网页详情页（.webview）故意不复用这张背景图，
  // 它始终使用固定的浅色/深色底色，作为独立于列表页的一层"打开的内容"，
  // 避免用户上传的照片透进详情页造成"背景穿透"的错觉。
}

// 页面加载时恢复该角色此前设置过的背景
bcLoadBg().then((saved) => { if (saved) bcApplyBg(saved); });

if (uploadBgBtn && bgUploadInput) {
  uploadBgBtn.addEventListener('click', () => {
    uploadBgBtn.style.transform = 'scale(0.85)';
    setTimeout(() => { uploadBgBtn.style.transform = ''; }, 120);
    bgUploadInput.click();
  });

  bgUploadInput.addEventListener('change', () => {
    const file = bgUploadInput.files && bgUploadInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      bcApplyBg(dataUrl);
      bcSaveBg(dataUrl);
      bcShowToast('背景已更新');
    };
    reader.readAsDataURL(file);
    bgUploadInput.value = '';
  });
}