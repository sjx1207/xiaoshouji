/* ================================================
   蜜信 Mixin — mixin.js  v5
   帖子流在首页内展示 / 详情页独立全屏视图
================================================ */

/* ── 状态栏：时间 ── */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

/* ── 状态栏：电量 ── */
function updateBattery() {
  const pctEl   = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  function render(p) {
    p = Math.round(p);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#a78bfa,#818cf8)';
    }
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      render(b.level * 100);
      b.addEventListener('levelchange', () => render(b.level * 100));
    });
  } else { render(76); }
}

/* ── 灵动岛 ── */
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled');
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if (!el) return;
  if (enabled === 'false') { el.innerHTML = ''; return; }
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
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2, '0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ── 字体同步 ── */
async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts'))
            d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror   = () => rej();
      });
      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror   = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch (e) {}
  }
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', 'Cormorant Garamond', serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

/* ── 跨标签设置同步 ── */
let _lastIslandEnabled = null, _lastIslandStyle = null;
let _lastFontName = null, _lastTz = null;

function pollSettings() {
  const ie = localStorage.getItem('luna_island_enabled');
  const is = localStorage.getItem('luna_island_style') || 'minimal';
  const fn = localStorage.getItem('luna_font_active_name');
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  if (ie !== _lastIslandEnabled || is !== _lastIslandStyle) {
    _lastIslandEnabled = ie; _lastIslandStyle = is; applyIsland();
  }
  if (fn !== _lastFontName) { _lastFontName = fn; applyGlobalFont(); }
  if (tz !== _lastTz) { _lastTz = tz; updateTime(); }
}

window.addEventListener('storage', e => {
  if (e.key === 'luna_font_update')   applyGlobalFont();
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateTime();
});

/* ================================================
   视图切换
   三个全屏视图：viewWelcome / viewHome / viewPost
================================================ */
function showView(id) {
  document.querySelectorAll('.mx-view').forEach(v => {
    v.hidden = (v.id !== id);
  });
}

function doEnter() {
  const veil = document.getElementById('mxVeil');
  if (!veil) return;
  veil.classList.add('on');
  setTimeout(() => showView('viewHome'), 700);
  setTimeout(() => veil.classList.remove('on'), 2600);
}

function doBack() {
  const veil = document.getElementById('mxVeil');
  if (!veil) return;
  veil.classList.add('on');
  setTimeout(() => showView('viewWelcome'), 700);
  setTimeout(() => veil.classList.remove('on'), 2600);
}

/* ── viewHome 内部：空状态 ↔ 帖子流状态 ── */
function showHomeForum(show) {
  const empty = document.getElementById('homeEmpty');
  const forum = document.getElementById('homeForum');
  if (empty) empty.hidden = show;
  if (forum) forum.hidden = !show;
}

/* ================================================
   底部导航 Tab
   现在有两份 tabbar（viewHome 内 / viewFound 内），
   点击任意一份都要：1) 真正切换到对应 view  2) 同步所有 tabbar 的激活态与滑轨位置
================================================ */
const TAB_TO_VIEW = { forum: 'viewHome', found: 'viewFound', profile: 'viewProfile' };

function setActiveTab(tabName) {
  document.querySelectorAll('.mx-tabbar').forEach(bar => {
    const tabs = bar.querySelectorAll('.mx-tab');
    tabs.forEach((t, i) => {
      const isActive = t.dataset.tab === tabName;
      t.classList.toggle('active', isActive);
      if (isActive) bar.setAttribute('data-active', i);
    });
  });
}

function goToTab(tabName) {
  setActiveTab(tabName);
  const viewId = TAB_TO_VIEW[tabName];
  if (!viewId) return;
  // “我的”页面暂未实现，避免切到空白/报错，先停留在当前视图
  if (viewId === 'viewProfile' && !document.getElementById('viewProfile')) {
    return;
  }
  showView(viewId);
}

function initTabbar() {
  document.querySelectorAll('.mx-tab').forEach(tab => {
    tab.addEventListener('click', () => goToTab(tab.dataset.tab));
  });
}

/* ── 页脚指示点 ── */
function initFooterDots() {
  const dots = document.querySelectorAll('.fdot');
  dots.forEach(dot => {
    dot.addEventListener('click', () => {
      dots.forEach(d => d.classList.remove('fdot-act'));
      dot.classList.add('fdot-act');
    });
  });
}

/* ── 进入触发 ── */
function initEnterTriggers() {
  ['triggerEnter', 'triggerExplore', 'triggerNew', 'sealCard'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', doEnter);
  });
  const backEl = document.getElementById('triggerBack');
  if (backEl) backEl.addEventListener('click', doBack);

  // 主页论坛入口卡片
  const fec = document.getElementById('forumEntryCard');
  if (fec) fec.addEventListener('click', openForumOverlay);

  document.getElementById('quickNew')?.addEventListener('click', () => openForumOverlay());

  document.getElementById('quickArchive')?.addEventListener('click', () => {
    openForumOverlay();
    setTimeout(() => {
      document.getElementById('archiveDropdownSection')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);
  });

  document.getElementById('quickRandom')?.addEventListener('click', async () => {
    const archives = await dbGetAll('archives');
    if (!archives.length) { openForumOverlay(); return; }
    const arc = archives[Math.floor(Math.random() * archives.length)];
    openForumOverlay();
    setTimeout(() => loadArchiveAndGenerate(arc), 300);
  });
}

/* ================================================
   DB helpers
================================================ */
function openForumDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('MixinForumDB', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('archives')) {
        const s = db.createObjectStore('archives', { keyPath: 'id', autoIncrement: true });
        s.createIndex('name', 'name', { unique: false });
      }
      if (!db.objectStoreNames.contains('posts')) {
        const p = db.createObjectStore('posts', { keyPath: 'id', autoIncrement: true });
        p.createIndex('archiveId', 'archiveId', { unique: false });
      }
    };
    req.onsuccess = e => res(e.target.result);
    req.onerror   = () => rej('DB open failed');
  });
}

async function dbGetAll(store) {
  const db = await openForumDB();
  return new Promise((res, rej) => {
    const r = db.transaction(store).objectStore(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror   = () => rej();
  });
}

async function dbAdd(store, data) {
  const db = await openForumDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    const r  = tx.objectStore(store).add(data);
    r.onsuccess = () => res(r.result);
    r.onerror   = () => rej();
  });
}

async function dbDelete(store, id) {
  const db = await openForumDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(id);
    tx.oncomplete = () => res();
    tx.onerror    = () => rej();
  });
}

/* ================================================
   Forum State
================================================ */
const ForumState = {
  currentArchiveId: null,
  currentArchive: null,
  posts: [],
  currentPostIdx: null,
};

const NICK_POOL = [
  '落霞孤鹜','镜花水月','云间漫步','暮色将至','梦蝶庄周',
  '细雨如丝','南柯一梦','长安旧事','烟波浩渺','星河为伴',
  '寒梅傲雪','竹影清风','月下独酌','千山暮雪','碎玉流光',
  'sunsetter','velvet.ink','peach.blossom','quietfire','ink.and.silk',
  'moonwriter','dusk.petals','silkthread','hidden.fox','rainsong',
];
function randNick() { return NICK_POOL[Math.floor(Math.random() * NICK_POOL.length)]; }
function fmtRelTime() {
  const mins = [2,5,12,23,41,57,63,88,120,143,211,360];
  const m = mins[Math.floor(Math.random() * mins.length)];
  if (m < 60) return `${m}min ago`;
  return `${Math.floor(m/60)}h ago`;
}
function avatarGlyph(nick) { return nick[0] || '匿'; }

/* ================================================
   Anthropic API
================================================ */
async function callClaude(systemPrompt, userPrompt) {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const data = await resp.json();
  return data.content.map(b => b.text || '').join('');
}

/* ================================================
   生成帖子
================================================ */
async function generatePosts(archive, count) {
  const { lore, style, styleName, styleDesc, postLen, cmtLen, cmtCount } = archive;
  const styleStr = styleName && styleDesc
    ? `${styleName}（${styleDesc}）`
    : (styleName || style || '耽美虐恋');

  const sys = `你是一个CP同人论坛的内容生成引擎。只输出纯JSON，不加任何说明。\n世界观：${lore}\n文风：${styleStr}\n`;

  const skeletonPrompt = `生成${count}个论坛帖子列表，JSON格式如下（只输出JSON，无其他文字）：\n[{"title":"...", "excerpt":"...（${postLen}字以内的精简摘要）", "tags":["tag1","tag2"], "hot":true/false}]\n帖子要有CP互动感、网感活人感，热帖标hot:true。`;

  let skeletons = [];
  try {
    const raw = await callClaude(sys, skeletonPrompt);
    skeletons = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    skeletons = Array.from({ length: count }, (_, i) => ({
      title: `【${styleStr}】第${i+1}章 · 碎片`,
      excerpt: '内容生成失败，请重试。',
      tags: [styleStr], hot: false,
    }));
  }

  const [cmtMin, cmtMax] = (cmtLen || '30-80').split('-').map(Number);

  const posts = await Promise.all(skeletons.map(async (sk, idx) => {
    let body = '';
    try {
      body = await callClaude(sys,
        `为论坛帖子《${sk.title}》写正文，${postLen}字以内，${styleStr}文风，有CP互动细节，带真实网络同人感。直接输出正文，不加标题。`);
    } catch { body = sk.excerpt; }

    let comments = [];
    try {
      const cRaw = await callClaude(sys,
        `为帖子《${sk.title}》生成${cmtCount}条论坛评论，每条${cmtMin}~${cmtMax}字，有磕CP的激动感、网感口语、不同立场（支持/分析/调侃/共情/剧透警告等），输出JSON：\n[{"nick":"...", "body":"...", "likes":数字}]\n只输出JSON。`);
      comments = JSON.parse(cRaw.replace(/```json|```/g, '').trim());
    } catch {
      comments = [{ nick: randNick(), body: '磕到了磕到了！！', likes: Math.floor(Math.random() * 80) }];
    }

    return {
      id: Date.now() + idx,
      archiveId: archive.id,
      title: sk.title,
      excerpt: sk.excerpt,
      body,
      tags: sk.tags || [styleStr],
      hot: !!sk.hot,
      comments: comments.map(c => ({
        nick: c.nick || randNick(),
        body: c.body || '',
        likes: c.likes || Math.floor(Math.random() * 60),
        liked: false,
      })),
      author: randNick(),
      time: fmtRelTime(),
    };
  }));

  return posts;
}

/* ================================================
   渲染帖子卡片
================================================ */
function renderPostCard(post, idx) {
  const card = document.createElement('div');
  card.className = 'fpost-card';
  const views   = post.views   || (Math.floor(Math.random()*900)+100);
  const likes   = post.likes   || (Math.floor(Math.random()*200)+10);
  const saves   = post.saves   || (Math.floor(Math.random()*80)+5);
  if (!post.views) post.views = views;
  if (!post.likes) post.likes = likes;
  if (!post.saves) post.saves = saves;

  card.innerHTML = `
    <div class="fpost-meta">
      <div class="fpost-author">
        <div class="fpost-avatar"><span class="favatar-glyph">${avatarGlyph(post.author)}</span></div>
        <div>
          <span class="fpost-name">${post.author}</span>
          <span class="fpost-time" style="margin-left:7px">${post.time}</span>
        </div>
      </div>
      ${post.hot ? '<span class="fcmt-hot">HOT</span>' : ''}
    </div>
    <div class="fpost-title">${post.title}</div>
    <div class="fpost-excerpt">${post.excerpt}</div>
    <div class="fpost-footer">
      <div class="fpost-tags">${post.tags.slice(0,3).map(t => `<span class="fpost-tag">${t}</span>`).join('')}</div>
      <div class="fpost-stats">
        <div class="fpost-stat">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2C3.5 2 1 5 1 6.5S3.5 11 6.5 11 12 8 12 6.5 9.5 2 6.5 2z" stroke="currentColor" stroke-width="1" fill="none"/><circle cx="6.5" cy="6.5" r="1.5" fill="currentColor"/></svg>
          <span>${views}</span>
        </div>
        <div class="fpost-stat">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 10.5S2 7.8 2 4.8C2 3.3 3.1 2 4.5 2c.8 0 1.5.5 2 1.2C6.9 2.5 7.7 2 8.5 2 9.9 2 11 3.3 11 4.8c0 3-4.5 5.7-4.5 5.7z" stroke="currentColor" stroke-width="1" fill="none"/></svg>
          <span>${likes}</span>
        </div>
        <div class="fpost-stat">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M9 1.5H4a1 1 0 00-1 1v9l3.5-2 3.5 2v-9a1 1 0 00-1-1z" stroke="currentColor" stroke-width="1" fill="none"/></svg>
          <span>${saves}</span>
        </div>
        <div class="fpost-stat">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 9.5V8a4 4 0 014-4h3.5M9.5 2l2 2-2 2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <span>${post.comments.length}</span>
        </div>
        <div class="fpost-stat-repost">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4h8M2 8h8M9 2l3 2-3 2M3 6l-3 2 3 2" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
          转发
        </div>
      </div>
    </div>
  `;
  card.addEventListener('click', (e) => {
    if (e.target.closest('.fpost-stat-repost')) { e.stopPropagation(); return; }
    openPostDetail(idx);
  });
  return card;
}

function renderPostStream(posts) {
  const stream = document.getElementById('postStream');
  if (!stream) return;
  stream.innerHTML = '';
  posts.forEach((p, i) => stream.appendChild(renderPostCard(p, i)));
}

/* ================================================
   帖子详情页（独立全屏 viewPost）
================================================ */
function openPostDetail(idx) {
  const post = ForumState.posts[idx];
  if (!post) return;
  ForumState.currentPostIdx = idx;

  showView('viewPost');

  const scroll = document.getElementById('postDetailScroll');
  if (!scroll) return;

  // 随机生成互动数据（若无）
  if (!post.views) post.views = Math.floor(Math.random()*900)+100;
  if (!post.likes) post.likes = Math.floor(Math.random()*200)+10;
  if (!post.saves) post.saves = Math.floor(Math.random()*80)+5;
  if (!post.liked) post.liked = false;
  if (!post.saved) post.saved = false;

  const relTimes = ['2min ago','5min ago','11min ago','23min ago','41min ago','1h ago','2h ago','3h ago'];
  const cmtsHtml = post.comments.map((c, fi) => `
    <div class="fpost-cmt">
      <div class="fcmt-avatar-col">
        <div class="fpost-avatar" style="width:34px;height:34px">
          <span class="favatar-glyph" style="font-size:14px">${avatarGlyph(c.nick)}</span>
        </div>
        ${fi < post.comments.length - 1 ? '<div class="fcmt-thread-line"></div>' : ''}
      </div>
      <div class="fcmt-content-col">
        <div class="fcmt-header">
          <span class="fcmt-nick">${c.nick}</span>
          <span class="fcmt-time-badge">${relTimes[Math.floor(Math.random()*relTimes.length)]}</span>
        </div>
        <div class="fcmt-body">${c.body}</div>
        <div class="fcmt-actions">
          <button class="fcmt-like ${c.liked ? 'liked' : ''}" data-fi="${fi}">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12S2 8.8 2 5.3C2 3.5 3.3 2 5 2c.9 0 1.8.5 2 1.3C7.2 2.5 8.1 2 9 2c1.7 0 3 1.5 3 3.3C12 8.8 7 12 7 12z" stroke="currentColor" stroke-width="1.1" fill="${c.liked ? 'currentColor' : 'none'}"/>
            </svg>
            <span class="fcmt-like-num">${c.likes}</span>
          </button>
          <button class="fcmt-reply-btn" data-reply="${c.nick}">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 4h10v6.5H8l-2.5 2v-2H1.5V4z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>
            回复
          </button>
        </div>
      </div>
    </div>
  `).join('');

  scroll.innerHTML = `
    <div class="fpost-detail-inner">

      <div class="fpost-detail-meta">
        <div class="fpost-author" style="gap:10px;align-items:flex-start">
          <div class="fpost-avatar" style="width:40px;height:40px;flex-shrink:0">
            <span class="favatar-glyph" style="font-size:17px">${avatarGlyph(post.author)}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div class="fpost-name" style="font-size:15px">${post.author}</div>
            <div class="fpost-time" style="font-size:12px;margin-top:3px">${post.time}</div>
          </div>
        </div>
        <div class="fpost-tags" style="margin-top:12px">${post.tags.map(t => `<span class="fpost-tag">${t}</span>`).join('')}</div>
      </div>

      <h2 class="fpost-detail-title">${post.title}</h2>
      <div class="fpost-detail-body">${post.body.replace(/\n/g, '<br>')}</div>

      <!-- 互动栏：data-action 替代 id，避免 innerHTML 注入后 getElementById 失效 -->
      <div class="fpost-interact-bar">
        <button class="fib-item ${post.liked ? 'active' : ''}" data-action="like">
          <div class="fib-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path class="fib-fill-path" d="M11 19S3 14.5 3 9C3 6.5 5 4.5 7.5 4.5c1.2 0 2.4.7 3.5 2 1.1-1.3 2.3-2 3.5-2C17 4.5 19 6.5 19 9c0 5.5-8 10-8 10z" stroke="currentColor" stroke-width="1.4" fill="${post.liked ? 'currentColor' : 'none'}"/>
            </svg>
          </div>
          <span class="fib-count">${post.likes}</span>
        </button>
        <div class="fib-sep"></div>
        <button class="fib-item" data-action="comment">
          <div class="fib-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 5h16v10H14l-3 3-3-3H3V5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" fill="none"/>
            </svg>
          </div>
          <span class="fib-count">${post.comments.length}</span>
        </button>
        <div class="fib-sep"></div>
        <button class="fib-item ${post.saved ? 'active' : ''}" data-action="save">
          <div class="fib-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path class="fib-fill-path" d="M5 3h12a1 1 0 011 1v14l-6-3.5L6 18V4a1 1 0 011-1z" stroke="currentColor" stroke-width="1.4" fill="${post.saved ? 'currentColor' : 'none'}" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="fib-count">${post.saves}</span>
        </button>
        <div class="fib-sep"></div>
        <button class="fib-item" data-action="share">
          <div class="fib-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M4 15v2a2 2 0 002 2h10a2 2 0 002-2v-2M15 7l-4-4-4 4M11 3v11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <span class="fib-count">转发</span>
        </button>
      </div>

      <!-- 评论区 -->
      <div class="fpost-cmts-section">
        <div class="fcmt-section-head">
          <span class="fcmt-count-label">${post.comments.length} 条评论</span>
          <span class="fcmt-sort-label">最热 ▾</span>
        </div>
        ${cmtsHtml}
      </div>

    </div>
  `;

  // ── 评论点赞（事件委托到 scroll）
  scroll.addEventListener('click', function handleScrollClick(e) {
    // 评论点赞
    const likeBtn = e.target.closest('.fcmt-like');
    if (likeBtn) {
      e.stopPropagation();
      const fi  = parseInt(likeBtn.dataset.fi);
      const cmt = ForumState.posts[idx].comments[fi];
      if (isNaN(fi) || !cmt) return;
      cmt.liked  = !cmt.liked;
      cmt.likes += cmt.liked ? 1 : -1;
      likeBtn.classList.toggle('liked', cmt.liked);
      likeBtn.querySelector('.fcmt-like-num').textContent = cmt.likes;
      const path = likeBtn.querySelector('path');
      if (path) path.setAttribute('fill', cmt.liked ? 'currentColor' : 'none');
      return;
    }
    // 回复按钮
    const replyBtn = e.target.closest('.fcmt-reply-btn');
    if (replyBtn) {
      const nick = replyBtn.dataset.reply;
      const inp = document.getElementById('fcmtComposeInput');
      if (inp) { inp.value = `@${nick} `; inp.focus(); }
      return;
    }
    // 互动栏按钮
    const fibBtn = e.target.closest('[data-action]');
    if (!fibBtn) return;
    const action = fibBtn.dataset.action;
    const p = ForumState.posts[idx];

    if (action === 'like') {
      p.liked = !p.liked;
      p.likes += p.liked ? 1 : -1;
      fibBtn.classList.toggle('active', p.liked);
      const path = fibBtn.querySelector('.fib-fill-path');
      if (path) path.setAttribute('fill', p.liked ? 'currentColor' : 'none');
      const cnt = fibBtn.querySelector('.fib-count');
      if (cnt) cnt.textContent = p.likes;
    }
    if (action === 'save') {
      p.saved = !p.saved;
      p.saves += p.saved ? 1 : -1;
      fibBtn.classList.toggle('active', p.saved);
      const path = fibBtn.querySelector('.fib-fill-path');
      if (path) path.setAttribute('fill', p.saved ? 'currentColor' : 'none');
      const cnt = fibBtn.querySelector('.fib-count');
      if (cnt) cnt.textContent = p.saves;
    }
    if (action === 'comment') {
      const inp = document.getElementById('fcmtComposeInput');
      if (inp) inp.focus();
    }
    if (action === 'share') {
      const shareBtn = fibBtn;
      shareBtn.style.color = 'var(--c-purple)';
      setTimeout(() => { shareBtn.style.color = ''; }, 600);
    }
  }, { once: false });

  // ── 评论发送（sendBtn 在 scroll 外面，只绑定一次）
  const sendBtn = document.getElementById('fcmtSendBtn');
  const composeInp = document.getElementById('fcmtComposeInput');
  // 移除旧 listener，重新绑定
  const newSendBtn = sendBtn?.cloneNode(true);
  if (sendBtn && newSendBtn) sendBtn.replaceWith(newSendBtn);
  const freshSend = document.getElementById('fcmtSendBtn');
  const freshInp  = document.getElementById('fcmtComposeInput');
  if (freshSend && freshInp) {
    freshSend.addEventListener('click', () => {
      const body = freshInp.value.trim();
      if (!body) return;
      ForumState.posts[idx].comments.push({ nick: '我', body, likes: 0, liked: false });
      freshInp.value = '';
      freshInp.style.height = 'auto';
      openPostDetail(idx);
    });
    freshInp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); freshSend.click(); }
    });
  }
}

/* ================================================
   设置弹窗（forum-overlay）开/关
   弹窗内只有 panelSetup 一个面板了
================================================ */
function openForumOverlay() {
  const overlay = document.getElementById('forumOverlay');
  if (!overlay) return;
  overlay.hidden = false;
  overlay.offsetHeight; // reflow for transition
  overlay.style.opacity = '';
  refreshArchiveDropdown();
}

function closeForumOverlay() {
  const overlay = document.getElementById('forumOverlay');
  if (!overlay) return;
  overlay.style.opacity = '0';
  overlay.style.pointerEvents = 'none';
  setTimeout(() => {
    overlay.hidden = true;
    overlay.style.opacity = '';
    overlay.style.pointerEvents = '';
  }, 480);
}

/* ================================================
   存档下拉
================================================ */
async function refreshArchiveDropdown(selectedId = null) {
  const archives = await dbGetAll('archives');
  const btn  = document.getElementById('archiveDropdownBtn');
  const list = document.getElementById('archiveDropdownList');
  if (!btn || !list) return;

  list.innerHTML = '';

  const newItem = document.createElement('div');
  newItem.className = 'fadl-item new-entry';
  newItem.textContent = '+ 新建世界观';
  newItem.addEventListener('click', () => {
    document.getElementById('setupName').value = '';
    document.getElementById('setupLore').value = '';
    document.getElementById('loreCount').textContent = '0';
    document.querySelector('#styleChips .fchip.active')?.classList.remove('active');
    document.querySelector('#styleChips .fchip')?.classList.add('active');
    btn.querySelector('.fadb-text').textContent = '— 新建世界观 —';
    list.hidden = true;
    btn.classList.remove('open');
  });
  list.appendChild(newItem);

  archives.forEach(a => {
    const item = document.createElement('div');
    item.className = 'fadl-item';
    item.dataset.id = a.id;
    item.innerHTML = `
      <span class="fadl-name">${a.name}</span>
      <span class="fadl-date">${new Date(a.createdAt).toLocaleDateString('zh-CN')}</span>
      <button class="fadl-del" data-del="${a.id}" aria-label="delete"></button>
    `;
    item.addEventListener('click', e => {
      if (e.target.closest('.fadl-del')) return;
      fillFormFromArchive(a);
      btn.querySelector('.fadb-text').textContent = a.name;
      list.hidden = true;
      btn.classList.remove('open');
    });
    item.querySelector('.fadl-del').addEventListener('click', async e => {
      e.stopPropagation();
      await dbDelete('archives', a.id);
      await refreshArchiveDropdown();
    });
    if (selectedId === a.id) {
      btn.querySelector('.fadb-text').textContent = a.name;
    }
    list.appendChild(item);
  });
}

function fillFormFromArchive(archive) {
  document.getElementById('setupName').value = archive.name || '';
  document.getElementById('setupLore').value = archive.lore || '';
  document.getElementById('loreCount').textContent = (archive.lore || '').length;

  const chips = document.querySelectorAll('#styleChips .fchip');
  chips.forEach(c => c.classList.remove('active'));
  if (archive.styleName) {
    document.getElementById('chipCustom')?.classList.add('active');
    const area = document.getElementById('styleCustomArea');
    if (area) area.hidden = false;
    const sn = document.getElementById('styleCustomName');
    const sd = document.getElementById('styleCustomDesc');
    if (sn) sn.value = archive.styleName;
    if (sd) sd.value = archive.styleDesc || '';
  } else {
    const target = [...chips].find(c => c.dataset.style === archive.style);
    if (target) target.classList.add('active');
    else chips[0]?.classList.add('active');
    const area = document.getElementById('styleCustomArea');
    if (area) area.hidden = true;
  }

  const pls = document.getElementById('postLenSlider');
  if (pls) { pls.value = archive.postLen || 1200; updatePostLenDisplay(); }

  const [min, max] = (archive.cmtLen || '30-80').split('-').map(Number);
  const cmtMin = document.getElementById('cmtLenMin');
  const cmtMax = document.getElementById('cmtLenMax');
  if (cmtMin) cmtMin.value = min;
  if (cmtMax) cmtMax.value = max;
  updateCmtLenDisplay();
  updateDualFill();

  const pcv = document.getElementById('postCountVal');
  const ccv = document.getElementById('cmtCountVal');
  if (pcv) { pcv.textContent = archive.postCount || 3; window._postCount = archive.postCount || 3; }
  if (ccv) { ccv.textContent = archive.cmtCount || 4; window._cmtCount = archive.cmtCount || 4; }
}

/* ================================================
   生成并展示帖子流（在 viewHome 内）
================================================ */
async function loadArchiveAndGenerate(archive) {
  ForumState.currentArchive  = archive;
  ForumState.currentArchiveId = archive.id;

  const nameEl = document.getElementById('hforumWorldName');
  if (nameEl) nameEl.textContent = archive.name;

  closeForumOverlay();
  showHomeForum(true);
  showHomeLoading(true, '正在从世界线召唤……');

  try {
    const posts = await generatePosts(archive, archive.postCount || 3);
    ForumState.posts = posts;
    renderPostStream(posts);
  } catch (err) {
    const stream = document.getElementById('postStream');
    if (stream) stream.innerHTML = `
      <div style="padding:24px;text-align:center;font-family:'Cormorant Garamond',serif;
                  font-style:italic;color:var(--c-text-s);font-size:14px;line-height:1.8">
        生成失败，请检查网络或稍后重试<br>
        <span style="font-size:11px;letter-spacing:.1em;color:var(--c-text-ss)">${err.message || ''}</span>
      </div>`;
  } finally {
    showHomeLoading(false);
  }
}

function showHomeLoading(show, text) {
  const stream = document.getElementById('postStream');
  if (!stream || !show) return;
  stream.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                padding:48px 20px;gap:16px">
      <div class="floading-rings">
        <div class="fl-ring fl-r1"></div>
        <div class="fl-ring fl-r2"></div>
        <div class="fl-ring fl-r3"></div>
      </div>
      <p style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:14px;
                color:var(--c-text-s);text-align:center;letter-spacing:0.08em;margin:0">
        ${text || '生成中……'}
      </p>
    </div>`;
}

/* ================================================
   滑动条
================================================ */
function updatePostLenDisplay() {
  const slider  = document.getElementById('postLenSlider');
  const display = document.getElementById('postLenDisplay');
  if (slider && display) display.textContent = slider.value;
}

function updateCmtLenDisplay() {
  const minEl   = document.getElementById('cmtLenMin');
  const maxEl   = document.getElementById('cmtLenMax');
  const display = document.getElementById('cmtLenDisplay');
  if (!minEl || !maxEl || !display) return;
  let minVal = parseInt(minEl.value), maxVal = parseInt(maxEl.value);
  if (minVal > maxVal) [minVal, maxVal] = [maxVal, minVal];
  display.textContent = `${minVal} – ${maxVal}`;
}

function updateDualFill() {
  const minEl = document.getElementById('cmtLenMin');
  const maxEl = document.getElementById('cmtLenMax');
  const fill  = document.getElementById('cmtSliderFill');
  if (!minEl || !maxEl || !fill) return;
  const min = 10, max = 500;
  const minVal = parseInt(minEl.value), maxVal = parseInt(maxEl.value);
  const left  = ((Math.min(minVal, maxVal) - min) / (max - min)) * 100;
  const right = ((Math.max(minVal, maxVal) - min) / (max - min)) * 100;
  fill.style.left  = left + '%';
  fill.style.width = (right - left) + '%';
}

/* ================================================
   设置面板 UI
================================================ */
function initSetupPanel() {
  const loreTA = document.getElementById('setupLore');
  const loreC  = document.getElementById('loreCount');
  if (loreTA && loreC)
    loreTA.addEventListener('input', () => { loreC.textContent = loreTA.value.length; });

  document.querySelectorAll('#styleChips .fchip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#styleChips .fchip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const area = document.getElementById('styleCustomArea');
      if (area) area.hidden = (btn.dataset.style !== 'custom');
    });
  });

  window._postCount = 3;
  const pcVal = document.getElementById('postCountVal');
  document.getElementById('postCountDec')?.addEventListener('click', () => {
    if (window._postCount > 1) { window._postCount--; if (pcVal) pcVal.textContent = window._postCount; }
  });
  document.getElementById('postCountInc')?.addEventListener('click', () => {
    if (window._postCount < 10) { window._postCount++; if (pcVal) pcVal.textContent = window._postCount; }
  });

  window._cmtCount = 4;
  const ccVal = document.getElementById('cmtCountVal');
  document.getElementById('cmtCountDec')?.addEventListener('click', () => {
    if (window._cmtCount > 2) { window._cmtCount--; if (ccVal) ccVal.textContent = window._cmtCount; }
  });
  document.getElementById('cmtCountInc')?.addEventListener('click', () => {
    if (window._cmtCount < 12) { window._cmtCount++; if (ccVal) ccVal.textContent = window._cmtCount; }
  });

  const pls = document.getElementById('postLenSlider');
  if (pls) { pls.addEventListener('input', updatePostLenDisplay); updatePostLenDisplay(); }

  const cmtMin = document.getElementById('cmtLenMin');
  const cmtMax = document.getElementById('cmtLenMax');
  if (cmtMin && cmtMax) {
    const update = () => { updateCmtLenDisplay(); updateDualFill(); };
    cmtMin.addEventListener('input', update);
    cmtMax.addEventListener('input', update);
    update();
  }

  const dbBtn  = document.getElementById('archiveDropdownBtn');
  const dbList = document.getElementById('archiveDropdownList');
  if (dbBtn && dbList) {
    dbBtn.addEventListener('click', e => {
      e.stopPropagation();
      const isOpen = !dbList.hidden;
      dbList.hidden = isOpen;
      dbBtn.classList.toggle('open', !isOpen);
    });
    document.addEventListener('click', () => {
      dbList.hidden = true;
      dbBtn.classList.remove('open');
    });
    dbList.addEventListener('click', e => e.stopPropagation());
  }

  document.getElementById('btnGenerate')?.addEventListener('click', async () => {
    const name = document.getElementById('setupName')?.value.trim();
    const lore = document.getElementById('setupLore')?.value.trim();

    const activeChip = document.querySelector('#styleChips .fchip.active');
    let style = '', styleName = '', styleDesc = '';
    if (activeChip?.dataset.style === 'custom') {
      styleName = document.getElementById('styleCustomName')?.value.trim() || '';
      styleDesc = document.getElementById('styleCustomDesc')?.value.trim() || '';
      style = styleName || '自定义';
    } else {
      style = activeChip?.dataset.style || '耽美虐恋';
    }

    const postLen = parseInt(document.getElementById('postLenSlider')?.value) || 1200;
    const cmtMinV = parseInt(document.getElementById('cmtLenMin')?.value) || 30;
    const cmtMaxV = parseInt(document.getElementById('cmtLenMax')?.value) || 80;
    const cmtLen  = `${Math.min(cmtMinV, cmtMaxV)}-${Math.max(cmtMinV, cmtMaxV)}`;

    if (!name) { document.getElementById('setupName')?.focus(); return; }
    if (!lore) { document.getElementById('setupLore')?.focus(); return; }

    const archive = {
      name, lore, style, styleName, styleDesc,
      postLen, cmtLen,
      postCount: window._postCount || 3,
      cmtCount:  window._cmtCount  || 4,
      createdAt: Date.now(),
    };
    const id = await dbAdd('archives', archive);
    archive.id = id;
    await loadArchiveAndGenerate(archive);
  });
}

/* ================================================
   导航事件绑定
================================================ */
function initForumNav() {
  // 设置弹窗关闭
  document.getElementById('forumClose')?.addEventListener('click', closeForumOverlay);

  // 详情页返回 → 回 viewHome
  document.getElementById('fnBtnPostBack')?.addEventListener('click', () => {
    showView('viewHome');
  });

  // 首页帖子流顶栏：修改世界观
  document.getElementById('hforumBtnEdit')?.addEventListener('click', () => {
    openForumOverlay();
    if (ForumState.currentArchive) fillFormFromArchive(ForumState.currentArchive);
  });

  // 首页帖子流顶栏：续写
  document.getElementById('hforumBtnMore')?.addEventListener('click', async () => {
    if (!ForumState.currentArchive) return;
    showHomeLoading(true, '续写中……');
    try {
      const newPosts = await generatePosts(
        ForumState.currentArchive,
        ForumState.currentArchive.postCount || 3
      );
      ForumState.posts = [...ForumState.posts, ...newPosts];
      renderPostStream(ForumState.posts);
    } catch (err) { console.error(err); }
  });
}

/* ================================================
   DOMContentLoaded
================================================ */
document.addEventListener('DOMContentLoaded', () => {
  updateTime();
  updateBattery();
  setInterval(updateTime, 30000);

  applyIsland();
  applyGlobalFont();
  setInterval(pollSettings, 800);

  initFooterDots();
  initEnterTriggers();
  initTabbar();
  initSetupPanel();
  initForumNav();
  initFoundModule();
});
/* ================================================
   捡手机 — FOUND PHONE MODULE
   JS v1 · 聊天列表 / 详情 / 设置弹窗 / 磕CP评论
================================================ */

/* ── 状态 ── */
const FoundState = {
  sessions: [],        // 所有聊天会话
  currentSession: null, // 当前打开的会话
  cpComments: [],      // 当前会话的磕CP评论
  selectedRole: null,  // 用户当前选中的身份
};

const FOUND_NICK_POOL = [
  '落霞孤鹜','镜花水月','云间漫步','暮色将至','梦蝶庄周',
  '细雨如丝','南柯一梦','长安旧事','烟波浩渺','星河为伴',
  '寒梅傲雪','竹影清风','月下独酌','千山暮雪','碎玉流光',
  'sunsetter','velvet.ink','peach.blossom','quietfire','moonwriter',
];
function foundRandNick() { return FOUND_NICK_POOL[Math.floor(Math.random() * FOUND_NICK_POOL.length)]; }

/* ─── 打开/关闭 捡手机设置弹窗 ─── */
function openFoundOverlay() {
  const ov = document.getElementById('foundOverlay');
  if (!ov) return;
  ov.classList.add('open');
}
function closeFoundOverlay() {
  const ov = document.getElementById('foundOverlay');
  if (!ov) return;
  ov.classList.remove('open');
}

/* ─── 打开/关闭 磕CP评论弹窗 ─── */
function openCpComments(sessionIdx) {
  const session = FoundState.sessions[sessionIdx];
  if (!session) return;

  const ov = document.getElementById('cpCommentOverlay');
  const titleEl = document.getElementById('cpPanelTitle');
  const metaEl = document.getElementById('cpPanelMeta');
  const loadEl = document.getElementById('cpLoading');
  const scrollEl = document.getElementById('cpCommentScroll');
  const composeEl = document.getElementById('cpCompose');

  titleEl.textContent = session.cpName + ' · 磕CP评论';
  metaEl.textContent = `${session.comments ? session.comments.length : 0} 条评论`;

  loadEl.hidden = false;
  scrollEl.hidden = true;
  composeEl.hidden = true;
  ov.classList.add('open');

  // 若已有评论直接显示，否则生成
  if (session.comments && session.comments.length > 0) {
    loadEl.hidden = true;
    renderCpComments(session.comments, scrollEl, metaEl);
    scrollEl.hidden = false;
    composeEl.hidden = false;
  } else {
    generateCpComments(session).then(cmts => {
      session.comments = cmts;
      FoundState.cpComments = cmts;
      loadEl.hidden = true;
      renderCpComments(cmts, scrollEl, metaEl);
      metaEl.textContent = `${cmts.length} 条评论`;
      scrollEl.hidden = false;
      composeEl.hidden = false;
    }).catch(() => {
      loadEl.hidden = true;
      scrollEl.innerHTML = '<p style="padding:24px;text-align:center;font-family:\'Cormorant Garamond\',serif;font-style:italic;color:var(--c-text-s);font-size:14px">生成失败，请稍后重试</p>';
      scrollEl.hidden = false;
      composeEl.hidden = false;
    });
  }
}

function closeCpComments() {
  const ov = document.getElementById('cpCommentOverlay');
  if (ov) ov.classList.remove('open');
}

/* ─── 生成磕CP评论 ─── */
async function generateCpComments(session) {
  const sys = `你是磕CP同人论坛的评论生成引擎。只输出纯JSON，不加任何说明。`;
  const preview = session.messages.slice(0, 4).map(m => `${m.sender}：${m.body}`).join('\n');
  const prompt = `以下是一段CP聊天记录摘要：\n${preview}\n\n世界观：${session.lore || ''}\nCP：${session.cpName}\n\n请生成${session.cmtCount || 6}条磕CP用户评论，要有激动感、网感口语、不同角度（磕死了/分析/调侃/共情/引用截图/lz分析等），输出JSON：\n[{"nick":"...","body":"...","likes":数字,"hot":true/false}]\n只输出JSON。`;
  const raw = await callClaude(sys, prompt);
  const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
  return parsed.map(c => ({
    nick: c.nick || foundRandNick(),
    body: c.body || '',
    likes: c.likes || Math.floor(Math.random() * 80),
    hot: !!c.hot,
    liked: false,
  }));
}

/* ─── 渲染磕CP评论 ─── */
function renderCpComments(cmts, container, metaEl) {
  container.innerHTML = '';
  cmts.forEach((c, i) => {
    const relTimes = ['2min ago','5min ago','12min ago','23min ago','41min ago','1h ago','2h ago','3h ago'];
    const t = relTimes[Math.floor(Math.random() * relTimes.length)];
    const div = document.createElement('div');
    div.className = 'cp-cmt';
    div.innerHTML = `
      <div class="cp-cmt-avatar-col">
        <div class="fpost-avatar" style="width:34px;height:34px;flex-shrink:0">
          <span class="favatar-glyph" style="font-size:13px">${c.nick[0] || '匿'}</span>
        </div>
        ${i < cmts.length - 1 ? '<div class="cp-cmt-thread"></div>' : ''}
      </div>
      <div class="cp-cmt-content">
        <div class="cp-cmt-header">
          <span class="cp-cmt-nick">${c.nick}</span>
          <span class="cp-cmt-time">${t}</span>
          ${c.hot ? '<span class="cp-cmt-hot">HOT</span>' : ''}
        </div>
        <div class="cp-cmt-body">${c.body}</div>
        <div class="cp-cmt-actions">
          <button class="cp-cmt-like ${c.liked ? 'liked' : ''}" data-ci="${i}">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 12S2 8.8 2 5.3C2 3.5 3.3 2 5 2c.9 0 1.8.5 2 1.3C7.2 2.5 8.1 2 9 2c1.7 0 3 1.5 3 3.3C12 8.8 7 12 7 12z" stroke="currentColor" stroke-width="1.1" fill="${c.liked ? 'currentColor' : 'none'}"/>
            </svg>
            <span class="cp-cmt-like-num">${c.likes}</span>
          </button>
          <button class="cp-cmt-reply" data-nick="${c.nick}">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 4h10v6.5H8l-2.5 2v-2H1.5V4z" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/></svg>
            回复
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  // 评论区点赞 & 回复
  container.addEventListener('click', function(e) {
    const likeBtn = e.target.closest('.cp-cmt-like');
    if (likeBtn) {
      const ci = parseInt(likeBtn.dataset.ci);
      const cmt = FoundState.sessions[FoundState.currentSessionIdx]?.comments?.[ci];
      if (!cmt) return;
      cmt.liked = !cmt.liked;
      cmt.likes += cmt.liked ? 1 : -1;
      likeBtn.classList.toggle('liked', cmt.liked);
      likeBtn.querySelector('.cp-cmt-like-num').textContent = cmt.likes;
      const path = likeBtn.querySelector('path');
      if (path) path.setAttribute('fill', cmt.liked ? 'currentColor' : 'none');
      return;
    }
    const replyBtn = e.target.closest('.cp-cmt-reply');
    if (replyBtn) {
      const nick = replyBtn.dataset.nick;
      const inp = document.getElementById('cpComposeInput');
      if (inp) { inp.value = `@${nick} `; inp.focus(); }
    }
  });
}

/* ─── 生成聊天会话列表 ─── */
async function generateFoundSessions(settings) {
  const { cpName, lore, style, sessionCount, msgCount, chatType, cmtCount } = settings;
  const sys = `你是一个CP聊天记录生成引擎，专门生成磕CP用的手机聊天记录。只输出纯JSON，不加任何说明。`;

  // 确定参与者
  let participants = [];
  if (chatType === 'group') {
    participants = [cpName.split(/[×xX&和，,]+/)[0]?.trim() || 'A',
                   cpName.split(/[×xX&和，,]+/)[1]?.trim() || 'B',
                   '旁观者甲'];
  } else {
    participants = [cpName.split(/[×xX&和，,]+/)[0]?.trim() || 'A',
                   cpName.split(/[×xX&和，,]+/)[1]?.trim() || 'B'];
  }

  const skeletonPrompt = `生成${sessionCount}条聊天会话记录，JSON格式：\n[{"chatName":"会话名称","preview":"最后一条消息预览(20字内)","timeLabel":"时间标签如昨天/周一/3天前","unread":true/false}]\n只输出JSON。`;

  let skeletons = [];
  try {
    const raw = await callClaude(sys + `\nCP：${cpName}\n世界观：${lore}\n文风：${style}`, skeletonPrompt);
    skeletons = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    skeletons = Array.from({ length: sessionCount }, (_, i) => ({
      chatName: chatType === 'group' ? `群聊 ${i+1}` : cpName,
      preview: '...',
      timeLabel: ['刚刚','昨天','周一'][i % 3],
      unread: i === 0,
    }));
  }

  const sessions = await Promise.all(skeletons.map(async (sk, idx) => {
    const msgPrompt = `为聊天记录"${sk.chatName}"生成${msgCount}条消息，参与者：${participants.join('、')}，文风：${style}，要有CP互动感、真实网感、情感张力。\n输出JSON：\n[{"sender":"发送者名字","body":"消息内容","time":"HH:MM格式","isGroup":${chatType === 'group'}}]\n只输出JSON。`;
    let messages = [];
    try {
      const raw = await callClaude(sys + `\nCP：${cpName}\n世界观：${lore}`, msgPrompt);
      messages = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
      messages = participants.map((p, i) => ({
        sender: p, body: `…`, time: `${10+i}:${String(i*7%60).padStart(2,'0')}`, isGroup: chatType === 'group',
      }));
    }

    return {
      id: Date.now() + idx,
      chatName: sk.chatName,
      preview: sk.preview || (messages[messages.length-1]?.body || '').slice(0, 20),
      timeLabel: sk.timeLabel || '刚刚',
      unread: sk.unread || false,
      chatType,
      cpName, lore, style, cmtCount,
      participants,
      messages: messages.map(m => ({
        sender: m.sender || participants[0],
        body: m.body || '',
        time: m.time || '12:00',
        isGroup: m.isGroup || false,
      })),
      comments: null, // 磕CP评论懒加载
    };
  }));

  return sessions;
}

/* ─── 渲染会话列表 ─── */
function renderFoundSessions(sessions) {
  const empty = document.getElementById('foundEmpty');
  const list = document.getElementById('foundSessionList');
  if (!list) return;

  if (sessions.length === 0) {
    if (empty) empty.hidden = false;
    list.hidden = true;
    return;
  }

  if (empty) empty.hidden = true;
  list.hidden = false;
  list.innerHTML = '';

  sessions.forEach((session, idx) => {
    const item = document.createElement('div');
    item.className = 'found-session-item';

    const isGroup = session.chatType === 'group';
    const p = session.participants || [];
    const glyphA = (p[0] || session.chatName)[0] || '匿';
    const glyphB = (p[1] || 'B')[0] || 'B';

    const avatarHtml = isGroup ? `
      <div class="found-avatar-wrap group">
        <div class="found-avatar found-avatar-a">${glyphA}</div>
        <div class="found-avatar found-avatar-b">${glyphB}</div>
        ${session.unread ? '<div class="found-unread-dot"></div>' : ''}
      </div>
    ` : `
      <div class="found-avatar-wrap">
        <div class="found-avatar">${glyphA}</div>
        ${session.unread ? '<div class="found-unread-dot"></div>' : ''}
      </div>
    `;

    item.innerHTML = `
      ${avatarHtml}
      <div class="found-session-info">
        <div class="found-session-row1">
          <span class="found-session-name">
            ${session.chatName}
            ${isGroup ? '<span class="found-group-badge">群</span>' : ''}
          </span>
          <span class="found-session-time">${session.timeLabel}</span>
        </div>
        <div class="found-session-row2">
          <span class="found-session-preview">${session.preview}</span>
          <span class="found-session-count">${session.messages.length} 条</span>
        </div>
      </div>
    `;

    item.addEventListener('click', () => openChatDetail(idx));
    list.appendChild(item);
  });
}

/* ─── 打开聊天详情 ─── */
function openChatDetail(idx) {
  const session = FoundState.sessions[idx];
  if (!session) return;
  FoundState.currentSession = session;
  FoundState.currentSessionIdx = idx;
  // 每次打开新会话都重置"以谁身份回复"，避免沿用上一个会话选择的身份，
  // 导致isMine判断错乱（群聊里发送者全部识别错位、看起来无法区分）
  FoundState.selectedRole = null;

  showView('viewChat');

  // 顶栏
  const nameEl = document.getElementById('chatNavName');
  const metaEl = document.getElementById('chatNavMeta');
  const avatarEl = document.getElementById('chatNavAvatar');
  const avatarWrap = document.getElementById('chatNavAvatarWrap');

  if (nameEl) nameEl.textContent = session.chatName;
  const isGroup = session.chatType === 'group';
  const p = session.participants || [];
  if (avatarEl) avatarEl.textContent = (p[0] || session.chatName)[0] || '匿';

  // 群聊在顶栏头像旁叠加第二个头像
  if (avatarWrap) {
    const existing = avatarWrap.querySelector('.chat-nav-avatar-b');
    if (existing) existing.remove();
    if (isGroup) {
      const bAvatar = document.createElement('div');
      bAvatar.className = 'chat-nav-avatar-b';
      bAvatar.textContent = (p[1] || 'B')[0] || 'B';
      avatarWrap.appendChild(bAvatar);
    }
  }

  if (metaEl) {
    metaEl.textContent = isGroup
      ? `${p.join(' · ')} · ${session.messages.length} 条消息`
      : `私信 · ${session.messages.length} 条消息`;
  }

  // 角色选择chip
  renderRoleChips(session);

  // 渲染消息
  renderChatMessages(session);
}

/* ─── 渲染身份选择chip ─── */
function renderRoleChips(session) {
  const wrap = document.getElementById('chatRoleChips');
  if (!wrap) return;
  wrap.innerHTML = '';
  const roles = [...(session.participants || [])];
  if (!roles.length) return;

  // 默认选第一个
  FoundState.selectedRole = FoundState.selectedRole || roles[0];

  roles.forEach(role => {
    const chip = document.createElement('button');
    chip.className = 'chat-role-chip' + (role === FoundState.selectedRole ? ' active' : '');
    chip.textContent = role;
    chip.addEventListener('click', () => {
      FoundState.selectedRole = role;
      wrap.querySelectorAll('.chat-role-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
    wrap.appendChild(chip);
  });
}

/* ── 群聊：按昵称生成稳定的区分色（同一人每次颜色一致） ── */
const GROUP_PALETTE = [
  { bg: 'linear-gradient(135deg, #b9a8d8, #8b7fa8)', text: '#7c6f99' },
  { bg: 'linear-gradient(135deg, #d8a8c4, #a87f96)', text: '#9c7088' },
  { bg: 'linear-gradient(135deg, #a8c4d8, #7f96a8)', text: '#6f88a0' },
  { bg: 'linear-gradient(135deg, #c8b896, #a8926f)', text: '#9c8260' },
  { bg: 'linear-gradient(135deg, #a8d8c0, #7fa890)', text: '#6f9c84' },
];
function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return GROUP_PALETTE[hash % GROUP_PALETTE.length];
}

/* ─── 渲染聊天消息 ─── */
function renderChatMessages(session) {
  const scroll = document.getElementById('chatScroll');
  if (!scroll) return;
  scroll.innerHTML = '';

  const isGroup = session.chatType === 'group';
  const msgs = session.messages;
  const myRole = FoundState.selectedRole || (session.participants || [])[0];

  // 按时间分组，插入日期分割线
  let lastDateGroup = null;
  const dateLabels = ['今天','昨天','前天','三天前','四天前'];
  let dateIdx = 0;

  msgs.forEach((msg, i) => {
    // 日期分割线（每5条一组简化）
    const groupIdx = Math.floor(i / 5);
    if (groupIdx !== lastDateGroup) {
      lastDateGroup = groupIdx;
      const sep = document.createElement('div');
      sep.className = 'chat-date-sep';
      sep.innerHTML = `<div class="chat-date-line"></div><span class="chat-date-label">${dateLabels[Math.min(dateIdx, dateLabels.length-1)]}</span><div class="chat-date-line"></div>`;
      scroll.appendChild(sep);
      dateIdx++;
    }

    const isMine = msg.sender === myRole;
    const prevMsg = msgs[i - 1];
    const nextMsg = msgs[i + 1];
    const isCont = prevMsg && prevMsg.sender === msg.sender;
    const isLast = !nextMsg || nextMsg.sender !== msg.sender;
    const isGroupStart = !isCont;
    const senderColor = isGroup && !isMine ? colorForName(msg.sender) : null;

    // 群聊发送者名称（对方且是该人第一条消息时显示，按人配色）
    // 注意：这里不再单独 append，而是内联到消息行的 chat-msg-col 里
    const senderLabelHtml = (isGroup && !isMine && isGroupStart)
      ? `<div class="chat-sender-label" style="color:${senderColor.text};margin-left:0">${msg.sender}</div>`
      : '';

    // 消息行
    const row = document.createElement('div');
    row.className = `chat-msg-row${isMine ? ' mine' : ''}${isCont ? ' cont' : ''}${isGroupStart ? ' group-start' : ''}${!isGroup ? ' single-chat' : ''}`;

    // 头像（群聊对方消息，按人配色）
    let avatarHtml = '';
    if (isGroup && !isMine) {
      avatarHtml = `<div class="chat-msg-avatar" style="background:${senderColor.bg}">${msg.sender[0] || '匿'}</div>`;
    }

    // 气泡
    const bubbleClass = isMine ? 'mine' : 'theirs';

    // 时间（最后一条消息显示）
    const timeHtml = isLast
      ? `<div class="chat-msg-time">${msg.time || ''}</div>`
      : '';

    row.innerHTML = `
      ${avatarHtml}
      <div class="chat-msg-col">
        ${senderLabelHtml}
        <div class="chat-bubble ${bubbleClass}">${msg.body}</div>
        ${timeHtml}
      </div>
    `;

    scroll.appendChild(row);
  });

  // 滚到底部
  scroll.scrollTop = scroll.scrollHeight;
}

/* ─── 发送 / AI续写 ─── */
/* ── 健壮地从模型输出中提取JSON对象/数组 ──
   模型有时会在JSON前后多加说明文字、代码块标记，这里尽量兜底解析 */
function extractJson(raw) {
  if (!raw) throw new Error('空响应');
  let s = raw.replace(/```json|```/g, '').trim();
  try { return JSON.parse(s); } catch {}
  // 找到第一个 { 或 [ 到最后一个对应的 } 或 ] 之间的内容再试一次
  const firstObj = s.indexOf('{');
  const firstArr = s.indexOf('[');
  let start = -1, openCh, closeCh;
  if (firstObj === -1 && firstArr === -1) throw new Error('未找到JSON');
  if (firstArr === -1 || (firstObj !== -1 && firstObj < firstArr)) {
    start = firstObj; openCh = '{'; closeCh = '}';
  } else {
    start = firstArr; openCh = '['; closeCh = ']';
  }
  const end = s.lastIndexOf(closeCh);
  if (end === -1 || end <= start) throw new Error('JSON不完整');
  return JSON.parse(s.slice(start, end + 1));
}

async function foundSendMessage(body) {
  const session = FoundState.currentSession;
  if (!session) return;

  const myRole = FoundState.selectedRole || (session.participants || [])[0];
  const now = new Date();
  const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;

  if (body.trim()) {
    // 用户手动发送
    session.messages.push({
      sender: myRole, body: body.trim(),
      time: timeStr, isGroup: session.chatType === 'group',
    });
    renderChatMessages(session);
  } else {
    // AI续写 — 生成下一条（失败时自动重试一次，再失败才提示用户）
    addTypingBubble();
    const sys = `你是CP聊天记录续写引擎。只输出下一条消息的JSON，格式：{"sender":"发送者","body":"消息内容"}，不加其他文字，不要使用markdown代码块。`;
    const recent = session.messages.slice(-6).map(m => `${m.sender}：${m.body}`).join('\n');
    const prompt = `CP：${session.cpName}\n世界观：${session.lore}\n文风：${session.style}\n参与者：${session.participants.join('、')}\n\n最近几条消息：\n${recent}\n\n续写下一条消息（不是${myRole}发送的），只输出JSON，不要加任何前后说明文字。`;

    let lastErr = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await callClaude(sys, prompt);
        const parsed = extractJson(raw);
        session.messages.push({
          sender: parsed.sender || session.participants.find(p => p !== myRole) || session.participants[0],
          body: parsed.body || '…',
          time: timeStr,
          isGroup: session.chatType === 'group',
        });
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) {
      session.messages.push({
        sender: session.participants.find(p => p !== myRole) || session.participants[0],
        body: '（续写失败，请重试）',
        time: timeStr,
        isGroup: session.chatType === 'group',
      });
    }
    removeTypingBubble();
    renderChatMessages(session);
  }
}

function addTypingBubble() {
  const scroll = document.getElementById('chatScroll');
  if (!scroll) return;
  const row = document.createElement('div');
  row.className = 'chat-msg-row';
  row.id = 'chatTypingRow';
  row.innerHTML = `
    <div class="chat-msg-col">
      <div class="chat-typing-bubble">
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
        <div class="chat-typing-dot"></div>
      </div>
    </div>
  `;
  scroll.appendChild(row);
  scroll.scrollTop = scroll.scrollHeight;
}
function removeTypingBubble() {
  document.getElementById('chatTypingRow')?.remove();
}

/* ─── 加载中提示（会话列表区） ─── */
function showFoundLoading(show) {
  const list = document.getElementById('foundSessionList');
  const empty = document.getElementById('foundEmpty');
  if (!list) return;
  if (show) {
    if (empty) empty.hidden = true;
    list.hidden = false;
    list.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;gap:16px">
        <div class="floading-rings">
          <div class="fl-ring fl-r1"></div><div class="fl-ring fl-r2"></div><div class="fl-ring fl-r3"></div>
          <span class="floading-glyph" style="font-size:18px">机</span>
        </div>
        <p style="font-family:'Cormorant Garamond',serif;font-style:italic;font-size:14px;color:var(--c-text-s);text-align:center;letter-spacing:.08em;margin:0">正在解锁这部手机……</p>
      </div>`;
  }
}

/* ─── 生成并展示 ─── */
async function runFoundGenerate(settings) {
  closeFoundOverlay();
  // 切换到捡手机视图
  setActiveTab('found');
  showView('viewFound');
  showFoundLoading(true);
  try {
    const sessions = await generateFoundSessions(settings);
    FoundState.sessions = sessions;
    renderFoundSessions(sessions);
  } catch (err) {
    const list = document.getElementById('foundSessionList');
    if (list) {
      list.hidden = false;
      list.innerHTML = `<div style="padding:24px;text-align:center;font-family:'Cormorant Garamond',serif;font-style:italic;color:var(--c-text-s);font-size:14px;line-height:1.8">生成失败，请检查网络或稍后重试<br><span style="font-size:11px;letter-spacing:.1em;color:var(--c-text-ss)">${err.message || ''}</span></div>`;
    }
  }
}

/* ─── Tab：捡手机切换入口 ─── */
function handleFoundTab() {
  showView('viewFound');
  // 如果还没有会话，空状态已默认显示
}

/* ─── 初始化 Found 模块 ─── */
function initFoundModule() {
  // 打开弹窗
  document.getElementById('foundNewBtn')?.addEventListener('click', openFoundOverlay);
  document.getElementById('foundEmptyNewBtn')?.addEventListener('click', openFoundOverlay);

  // 关闭弹窗
  document.getElementById('foundModalClose')?.addEventListener('click', closeFoundOverlay);
  document.getElementById('foundOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('foundOverlay')) closeFoundOverlay();
  });

  // lore 字数统计
  const loreTA = document.getElementById('fndLore');
  const loreC = document.getElementById('fndLoreCount');
  if (loreTA && loreC) {
    loreTA.addEventListener('input', () => { loreC.textContent = loreTA.value.length; });
  }

  // 类型chip
  document.querySelectorAll('#fndTypeChips .fnd-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#fndTypeChips .fnd-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 文风chip
  document.querySelectorAll('#fndStyleChips .fnd-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#fndStyleChips .fnd-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 步进器 — 会话数
  let _sessionCount = 3;
  const sessionVal = document.getElementById('fndSessionVal');
  document.getElementById('fndSessionDec')?.addEventListener('click', () => {
    if (_sessionCount > 1) { _sessionCount--; if (sessionVal) sessionVal.textContent = _sessionCount; }
  });
  document.getElementById('fndSessionInc')?.addEventListener('click', () => {
    if (_sessionCount < 8) { _sessionCount++; if (sessionVal) sessionVal.textContent = _sessionCount; }
  });

  // 步进器 — 消息数
  let _msgCount = 6;
  const msgVal = document.getElementById('fndMsgVal');
  document.getElementById('fndMsgDec')?.addEventListener('click', () => {
    if (_msgCount > 3) { _msgCount--; if (msgVal) msgVal.textContent = _msgCount; }
  });
  document.getElementById('fndMsgInc')?.addEventListener('click', () => {
    if (_msgCount < 20) { _msgCount++; if (msgVal) msgVal.textContent = _msgCount; }
  });

  // 生成按钮
  document.getElementById('fndGenerateBtn')?.addEventListener('click', () => {
    const cpName = document.getElementById('fndCpName')?.value.trim();
    const lore = document.getElementById('fndLore')?.value.trim();
    if (!cpName) { document.getElementById('fndCpName')?.focus(); return; }
    const chatType = document.querySelector('#fndTypeChips .fnd-chip.active')?.dataset.type || 'single';
    const style = document.querySelector('#fndStyleChips .fnd-chip.active')?.dataset.style || '耽美暗涌';
    runFoundGenerate({ cpName, lore, style, chatType, sessionCount: _sessionCount, msgCount: _msgCount, cmtCount: 6 });
  });

  // 详情页返回
  document.getElementById('chatNavBack')?.addEventListener('click', () => {
    FoundState.selectedRole = null;
    showView('viewFound');
  });

  // 磕CP按钮
  document.getElementById('chatCpBtn')?.addEventListener('click', () => {
    openCpComments(FoundState.currentSessionIdx);
  });

  // CP评论弹窗关闭
  document.getElementById('cpPanelClose')?.addEventListener('click', closeCpComments);
  document.getElementById('cpCommentOverlay')?.addEventListener('click', e => {
    if (e.target === document.getElementById('cpCommentOverlay')) closeCpComments();
  });

  // CP评论发送
  const cpSend = document.getElementById('cpComposeSend');
  const cpInput = document.getElementById('cpComposeInput');
  if (cpSend && cpInput) {
    cpSend.addEventListener('click', () => {
      const body = cpInput.value.trim();
      if (!body) return;
      const session = FoundState.sessions[FoundState.currentSessionIdx];
      if (!session) return;
      if (!session.comments) session.comments = [];
      session.comments.push({ nick: '我', body, likes: 0, liked: false, hot: false });
      cpInput.value = ''; cpInput.style.height = 'auto';
      const scrollEl = document.getElementById('cpCommentScroll');
      const metaEl = document.getElementById('cpPanelMeta');
      if (scrollEl) {
        renderCpComments(session.comments, scrollEl, metaEl);
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
      if (metaEl) metaEl.textContent = `${session.comments.length} 条评论`;
    });
    cpInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cpSend.click(); }
    });
  }

  // 详情页：发送 / AI续写
  const chatSend = document.getElementById('chatSendBtn');
  const chatInput = document.getElementById('chatInput');
  if (chatSend && chatInput) {
    chatSend.addEventListener('click', async () => {
      if (chatSend.disabled) return;
      const body = chatInput.value;
      chatInput.value = ''; chatInput.style.height = 'auto';
      chatSend.disabled = true;
      try { await foundSendMessage(body); }
      finally { chatSend.disabled = false; }
    });
    chatInput.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatSend.click(); }
    });
  }

  const continueBtn = document.getElementById('chatContinueBtn');
  if (continueBtn) {
    continueBtn.addEventListener('click', async () => {
      if (continueBtn.disabled) return;
      continueBtn.disabled = true;
      continueBtn.classList.add('is-loading');
      try { await foundSendMessage(''); } // 空body = AI续写
      finally {
        continueBtn.disabled = false;
        continueBtn.classList.remove('is-loading');
      }
    });
  }
}