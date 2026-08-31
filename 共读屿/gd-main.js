/* ==========================================================
   共读屿 · gd-main.js  （粮仓 / 我的）
   ========================================================== */

let WORKS = [], CUR_TAB = '__all__', CUR_VIEW = 'granary';

document.addEventListener('DOMContentLoaded', async () => {
  GD.mountStatusBar();
  bindDock();
  bindSlot();
  bindProfileEdit();
  await refreshAll();
  GDFab.injectCSS();
  document.getElementById('apiSetEntry').addEventListener('click', () => GDFab.openApiSet());
  GDFab.mount({ page: 'home' });
  document.getElementById('meScroll').addEventListener('scroll', onMeScroll, { passive: true });
});

async function refreshAll() {
  WORKS = (await GD.worksAll()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  renderGranary();
  renderMe();
}

/* ---------------- 视图切换 ---------------- */
function bindDock() {
  document.querySelectorAll('.gd-dock-item').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });
}
function switchView(v) {
  CUR_VIEW = v;
  document.querySelectorAll('.gd-dock-item').forEach(el => el.classList.toggle('on', el.dataset.view === v));
  document.getElementById('viewGranary').classList.toggle('on', v === 'granary');
  document.getElementById('viewMe').classList.toggle('on', v === 'me');
  if (v === 'me') onMeScroll(); else GD.setStatusDark(false);
}
function onMeScroll() {
  if (CUR_VIEW !== 'me') return;
  const st = document.getElementById('meScroll').scrollTop;
  GD.setStatusDark(st < 150);
}

/* ==========================================================
   投递口交互：向上推入稿纸 → 进入投稿页
   ========================================================== */
function bindSlot() {
  const slot = document.getElementById('slot');
  const card = document.getElementById('slotCard');
  let startY = null, dy = 0, fired = false;

  const reset = () => {
    card.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1), opacity .4s';
    card.style.transform = 'translateX(-50%) rotate(-1.6deg)';
    card.style.opacity = '1';
    slot.classList.remove('armed');
  };
  const fire = () => {
    if (fired) return; fired = true;
    card.style.transition = 'transform .42s cubic-bezier(.6,0,.9,.3), opacity .3s .12s';
    card.style.transform = 'translateX(-50%) translateY(58px) scale(.88) rotate(0deg)';
    card.style.opacity = '0';
    setTimeout(() => GD.go('gd-upload.html'), 340);
  };
  const pt = e => (e.touches ? e.touches[0].clientY : e.clientY);

  const down = e => { startY = pt(e); dy = 0; slot.classList.add('armed'); card.style.transition = 'none'; };
  const move = e => {
    if (startY === null) return;
    dy = pt(e) - startY;
    if (dy < 0) {
      e.preventDefault();
      const d = Math.max(dy, -46);
      card.style.transform = `translateX(-50%) translateY(${d}px) rotate(${-1.6 - d * 0.05}deg)`;
    }
  };
  const up = () => {
    if (startY === null) return;
    const moved = dy;
    startY = null;
    if (moved < -26) fire(); else reset();
  };

  slot.addEventListener('touchstart', down, { passive: true });
  slot.addEventListener('touchmove', move, { passive: false });
  slot.addEventListener('touchend', up);
  slot.addEventListener('mousedown', down);
  window.addEventListener('mousemove', e => { if (startY !== null) move(e); });
  window.addEventListener('mouseup', up);
  slot.addEventListener('click', () => { if (Math.abs(dy) < 6) fire(); });
}

/* ==========================================================
   粮仓渲染
   ========================================================== */
function renderGranary() {
  const st = GD.stats();
  const totalWords = WORKS.reduce((a, w) => a + (w.wordCount || 0), 0);
  document.getElementById('grStampNum').textContent = WORKS.length;
  document.getElementById('grWords').textContent = GD.fmtWords(totalWords);
  document.getElementById('grTime').textContent = GD.fmtDuration(st.totalMs);
  document.getElementById('grStreak').textContent = st.streak + ' 天';

  /* 索引标签：全部 + 各 CP + 未归档 */
  const map = new Map();
  WORKS.forEach(w => {
    const key = (w.tags && w.tags.cp) ? w.tags.cp : '散篇';
    map.set(key, (map.get(key) || 0) + 1);
  });
  const tabs = [['__all__', '全部', WORKS.length], ...[...map.entries()].map(([k, v]) => [k, k, v])];
  document.getElementById('arcTabs').innerHTML = tabs.map(([k, label, c]) =>
    `<div class="arc-tab ${k === CUR_TAB ? 'on' : ''}" data-k="${GD.esc(k)}">${GD.esc(label)}<span class="c">${c}</span></div>`
  ).join('');
  document.querySelectorAll('.arc-tab').forEach(el => el.addEventListener('click', () => {
    CUR_TAB = el.dataset.k; renderGranary();
  }));

  /* 篇目 */
  const list = document.getElementById('grList');
  const arr = CUR_TAB === '__all__' ? WORKS
    : WORKS.filter(w => ((w.tags && w.tags.cp) ? w.tags.cp : '散篇') === CUR_TAB);

  if (!arr.length) {
    list.innerHTML = `
      <div class="gd-empty">
        <svg viewBox="0 0 64 64" width="60" height="60" fill="none" style="margin:0 auto;display:block">
          <rect x="10" y="14" width="44" height="38" rx="3" stroke="#b3b9c2" stroke-width="1.4"/>
          <path d="M10 26h44" stroke="#b3b9c2" stroke-width="1.4"/>
          <path d="M24 14v12M40 14v12" stroke="#b3b9c2" stroke-width="1.2" opacity=".6"/>
          <path d="M18 36h28M18 44h18" stroke="#cfd3da" stroke-width="1.4"/>
        </svg>
        <div class="ttl">粮仓还空着</div>
        <div class="sub">把你收藏的同人文推进上方的投递口<br>它们会被编号、盖章、按 CP 分格归档</div>
      </div>`;
    return;
  }

  list.innerHTML = arr.map((w, i) => {
    const t = w.tags || {};
    const tags = [t.fandom, ...(t.types || []), t.status, t.rating].filter(Boolean).slice(0, 5);
    const pct = Math.round((w.progress || 0) * 100);
    const bars = Array.from({ length: 9 }, (_, k) =>
      `<i style="height:${3 + ((w.wordCount || 0) + k * 37) % 10}px"></i>`).join('');
    return `
    <div class="fic gd-rise" data-id="${w.id}" style="animation-delay:${i * 55}ms">
      <div class="fic-cover">
        ${w.cover
          ? `<img src="${w.cover}">`
          : `<div class="ph">${coverGlyph(w.title || '')}</div>`}
        <div class="no">№ ${String(w.id).padStart(3, '0')}</div>
      </div>
      <div class="fic-body">
        ${t.cp ? `<div class="fic-cp">${GD.esc(t.cp)}</div>` : ''}
        <div class="fic-title">${GD.esc(w.title || '未命名')}</div>
        ${w.summary ? `<div class="fic-sum">${GD.esc(w.summary)}</div>` : ''}
        ${tags.length ? `<div class="fic-tags">${tags.map(x => `<span>${GD.esc(x)}</span>`).join('')}</div>` : ''}
        <div class="fic-foot">
          <div class="w">${GD.fmtWords(w.wordCount || 0)}字 · ${Math.max(1, Math.round((w.wordCount || 0) / 400))}min</div>
          <div class="fic-prog"><i style="width:${pct}%"></i></div>
          <div class="fic-bars">${bars}</div>
        </div>
      </div>
    </div>`;
  }).join('');

  document.querySelectorAll('.fic').forEach(el => {
    let t0 = 0, longPress = null;
    const openIt = () => GD.go('gd-reader.html?id=' + el.dataset.id);
    el.addEventListener('click', openIt);
    el.addEventListener('touchstart', () => {
      t0 = Date.now();
      longPress = setTimeout(() => { longPress = null; openFicSheet(el.dataset.id); }, 620);
    }, { passive: true });
    el.addEventListener('touchend', e => {
      if (longPress) clearTimeout(longPress);
      else e.preventDefault();
    });
    el.addEventListener('contextmenu', e => { e.preventDefault(); openFicSheet(el.dataset.id); });
  });
}

function coverGlyph(title) {
  const ch = (title || '屿').replace(/[^\u4e00-\u9fffA-Za-z]/g, '').slice(0, 1) || '屿';
  return `<svg viewBox="0 0 96 130" width="100%" height="100%">
    <rect width="96" height="130" fill="none"/>
    <circle cx="48" cy="52" r="27" fill="none" stroke="rgba(20,22,26,.16)" stroke-width="1"/>
    <path d="M14 96h68" stroke="rgba(20,22,26,.16)" stroke-width="1"/>
    <path d="M20 104h56M28 110h40" stroke="rgba(20,22,26,.1)" stroke-width="1"/>
    <text x="48" y="62" text-anchor="middle" font-family="'Noto Serif SC',serif" font-size="30"
      font-weight="700" fill="rgba(20,22,26,.42)">${GD.esc(ch)}</text>
  </svg>`;
}

/* 篇目长按操作 */
async function openFicSheet(id) {
  const w = await GD.workGet(id); if (!w) return;
  document.getElementById('ficMaskTitle').textContent = w.title;
  document.getElementById('ficMaskBody').innerHTML = `
    <div style="font-size:12px;line-height:2;color:var(--ink-3);margin-bottom:18px;letter-spacing:.04em;">
      入库 ${GD.fmtDate(w.createdAt)} · ${GD.fmtWords(w.wordCount)}字 · 已读 ${Math.round((w.progress || 0) * 100)}%
      · 停留 ${GD.fmtDuration(w.readMs || 0, true)}
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;">
      <button class="gd-btn" onclick="GD.go('gd-reader.html?id=${w.id}')">继续阅读</button>
      <button class="gd-btn ghost" onclick="GD.go('gd-upload.html?edit=${w.id}')">编辑档案</button>
      <button class="gd-btn ghost" onclick="delWork(${w.id})">移出粮仓</button>
    </div>`;
  document.getElementById('ficMask').classList.add('show');
}
async function delWork(id) {
  const ok = await GD.confirmBox('移出粮仓？', '这篇的正文、封面、评论与阅读记录都会被清除，且无法恢复。', '移出');
  if (!ok) return;
  await GD.workDel(id);
  const cs = await GD.commentsAll();
  await Promise.all(cs.filter(c => c.workId == id).map(c => GD.commentDel(c.id)));
  document.getElementById('ficMask').classList.remove('show');
  await refreshAll(); GD.toast('已移出粮仓');
}

/* ==========================================================
   我的
   ========================================================== */
function renderMe() {
  const p = GD.profile(), st = GD.stats();
  const sess = GD.LS.get('gd_coread_session', null);
  const val = GDBadge.value(st, WORKS.length, sess ? (sess.totalMs || 0) : 0);
  const pr = GDBadge.progress(val);
  const bi = GDBadge.info(Math.max(1, pr.lv));

  // 头图 / 头像
  const banner = document.getElementById('meBanner');
  if (p.banner) { banner.src = p.banner; banner.style.display = 'block'; } else banner.style.display = 'none';
  const av = document.getElementById('meAvatar');
  av.innerHTML = (p.avatar ? `<img src="${p.avatar}">` : GD.avatarSVG(p.name, 82)) + '<div class="edge"></div>';

  document.getElementById('meLvChip').textContent = `LV.${String(pr.lv).padStart(2, '0')} · ${bi.name}`;
  document.getElementById('meName').childNodes[0].nodeValue = p.name + ' ';
  document.getElementById('meHandle').textContent = '@' + p.handle;
  document.getElementById('meBio').textContent = p.bio;
  document.getElementById('meLocText').textContent = p.location;

  document.getElementById('meLinks').innerHTML = p.links.map((l, i) => `
    <div class="me-link ${l.value ? 'filled' : ''}" data-i="${i}">
      ${linkIcon(l.type)}<span>${GD.esc(l.value || l.label)}</span>
    </div>`).join('');
  document.querySelectorAll('.me-link').forEach(el =>
    el.addEventListener('click', () => editLink(parseInt(el.dataset.i))));

  // 数据
  document.getElementById('meStats').innerHTML = [
    [GD.fmtDuration(st.totalMs).replace(/([a-z])/g, '<small>$1</small>'), '累计阅读时长'],
    [GD.fmtWords(st.words) + '<small>字</small>', '读过的字'],
    [WORKS.length + '<small>篇</small>', '粮仓存量'],
    [st.streak + '<small>天</small>', '连续到访']
  ].map(([n, l]) => `<div class="me-stat"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('');

  // 勋章
  document.getElementById('meBadgeBox').innerHTML = `
    <div class="mb-row">
      <div>${GDBadge.svg(Math.max(1, pr.lv), 78)}</div>
      <div style="flex:1;min-width:0;">
        <div class="mb-name">${bi.name}</div>
        <div class="mb-en">${bi.en} · LEVEL ${String(pr.lv).padStart(2, '0')} / 30</div>
        <div class="mb-bar"><i style="width:${(pr.pct * 100).toFixed(1)}%"></i></div>
        <div class="mb-meta">
          <span>屿光值 ${val}</span>
          <span>${pr.next ? `距「${GDBadge.info(pr.lv + 1).name}」还差 ${pr.remain}` : '已至满级'}</span>
        </div>
      </div>
    </div>
    <div class="mb-all" id="mbAll">
      <div class="t">查看全部三十级勋章与规则</div>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.6"/></svg>
    </div>`;
  document.getElementById('mbAll').addEventListener('click', () => openBadgePanel(val));

  // 记录
  const recs = WORKS.filter(w => w.lastReadAt).sort((a, b) => b.lastReadAt - a.lastReadAt).slice(0, 5);
  document.getElementById('meRecords').innerHTML = recs.length ? recs.map((w, i) => `
    <div class="rec" onclick="GD.go('gd-reader.html?id=${w.id}')">
      <div class="rk">${String(i + 1).padStart(2, '0')}</div>
      <div class="rc">${w.cover ? `<img src="${w.cover}">` : coverGlyph(w.title)}</div>
      <div class="ri">
        <div class="rt">${GD.esc(w.title)}</div>
        <div class="rm">${GD.relTime(w.lastReadAt)} · 停留 ${GD.fmtDuration(w.readMs || 0)}</div>
      </div>
      <div class="rp">${Math.round((w.progress || 0) * 100)}%</div>
    </div>`).join('')
    : `<div style="font-size:12px;color:var(--ink-4);padding:6px 0 4px;letter-spacing:.05em;">还没有阅读记录。翻开粮仓里的任意一篇，计时会自动开始。</div>`;

  // 热力
  const days = st.days || {}; const cells = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ms = days[GD.todayKey(d)] || 0;
    const lv = ms === 0 ? 0 : ms < 6e5 ? 1 : ms < 18e5 ? 2 : ms < 36e5 ? 3 : 4;
    const bg = ['var(--paper-3)', '#c5cad1', '#9aa1ab', '#606772', '#22262c'][lv];
    cells.push(`<i style="background:${bg}" title="${GD.todayKey(d)}"></i>`);
  }
  document.getElementById('meHeat').innerHTML = cells.join('');

  // 共读入口
  const entry = document.getElementById('coreadEntry');
  if (sess && sess.active) {
    entry.classList.add('active');
    document.getElementById('coreadTitle').textContent = `${sess.charName} 正在与你共读`;
    document.getElementById('coreadDesc').textContent =
      `本次共读已持续 ${GD.fmtDuration(sess.totalMs || 0, true)} · 点击可更换悬浮球样式或结束共读。`;
    document.getElementById('coreadLive').style.display = 'inline-flex';
  } else {
    entry.classList.remove('active');
    document.getElementById('coreadLive').style.display = 'none';
  }
  entry.onclick = () => GD.go('gd-coread.html');
}

function linkIcon(t) {
  const s = 'stroke="currentColor" stroke-width="1.4" fill="none"';
  const m = {
    weibo: `<circle cx="10" cy="14" r="6" ${s}/><circle cx="17" cy="9" r="3" ${s}/>`,
    ig: `<rect x="4" y="4" width="16" height="16" rx="5" ${s}/><circle cx="12" cy="12" r="3.6" ${s}/><circle cx="17" cy="7" r="1" fill="currentColor"/>`,
    x: `<path d="M5 5l14 14M19 5L5 19" ${s}/>`,
    lofter: `<path d="M8 5v10a4 4 0 0 0 8 0M6 11h6" ${s}/>`
  };
  return `<svg viewBox="0 0 24 24" width="12" height="12">${m[t] || m.x}</svg>`;
}

/* ---------------- 勋章面板 ---------------- */
function openBadgePanel(val) {
  const W = GDBadge.W;
  document.getElementById('badgeRule').innerHTML = `
    <b style="font-family:var(--serif);letter-spacing:.1em;color:var(--ink);">屿光值 · 计算规则</b><br>
    阅读时长 每 1 分钟 <b>+${W.minute}</b> &nbsp;|&nbsp; 阅读字数 每 1000 字 <b>+${W.kiloWord}</b><br>
    连续到访 每 1 天 <b>+${W.streakDay}</b> &nbsp;|&nbsp; 收录篇目 每 1 篇 <b>+${W.work}</b><br>
    评论互动 每 1 条 <b>+${W.interaction}</b> &nbsp;|&nbsp; 共读陪伴 每 1 分钟 <b>+${W.coreadMinute}</b><br>
    <span style="color:var(--ink-4);">等级只升不降；连续到访中断后已获勋章永久保留，仅连续加成重新累积。</span><br>
    <span style="font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:var(--ink-2);">CURRENT · ${val} 屿光</span>`;

  const lv = GDBadge.levelOf(val);
  document.getElementById('badgeGrid').innerHTML = GDBadge.all().map(b => {
    const got = b.lv <= lv;
    return `<div class="badge-cell ${got ? 'got' : 'lock'}">
      <div style="display:flex;justify-content:center">${GDBadge.svg(b.lv, 66, !got)}</div>
      <div class="nm">${b.name}</div>
      <div class="rq">${got ? 'UNLOCKED' : b.need + ' 屿光'}</div>
    </div>`;
  }).join('');
  document.getElementById('badgeMask').classList.add('show');
}

/* ==========================================================
   资料编辑
   ========================================================== */
let _imgTarget = null;
function bindProfileEdit() {
  document.getElementById('meName').addEventListener('click', () => editField('name', '昵称', 'input'));
  document.getElementById('meHandle').addEventListener('click', () => editField('handle', '用户名 / ID', 'input'));
  document.getElementById('meBio').addEventListener('click', () => editField('bio', '个人简介', 'textarea'));
  document.getElementById('meLoc').addEventListener('click', () => editField('location', '所在地 / 常驻', 'input'));
  document.getElementById('meAvatar').addEventListener('click', () => pickImage('avatar'));
  document.getElementById('meBannerBtn').addEventListener('click', e => { e.stopPropagation(); pickImage('banner'); });

  document.getElementById('hiddenImg').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    const data = await GD.readImage(f, _imgTarget === 'banner' ? 1400 : 500, 0.88);
    const p = GD.profile(); p[_imgTarget] = data; GD.setProfile(p);
    e.target.value = ''; renderMe(); GD.toast(_imgTarget === 'banner' ? '资料背景已更换' : '头像已更换');
  });
}
function pickImage(target) { _imgTarget = target; document.getElementById('hiddenImg').click(); }

function editField(key, label, type) {
  const p = GD.profile();
  document.getElementById('editTitle').textContent = '编辑 · ' + label;
  document.getElementById('editBody').innerHTML = `
    <div class="gd-field">
      <div class="gd-label"><b>${label}</b><span>EDIT</span></div>
      ${type === 'textarea'
        ? `<textarea class="gd-textarea" id="edV">${GD.esc(p[key])}</textarea>`
        : `<input class="gd-input" id="edV" value="${GD.esc(p[key])}">`}
    </div>
    <button class="gd-btn" style="width:100%" onclick="saveField('${key}')">保 存</button>`;
  document.getElementById('editMask').classList.add('show');
  setTimeout(() => document.getElementById('edV').focus(), 260);
}
function saveField(key) {
  const p = GD.profile();
  p[key] = document.getElementById('edV').value.trim() || p[key];
  GD.setProfile(p); closeEdit(); renderMe();
}
function editLink(i) {
  const p = GD.profile(), l = p.links[i];
  document.getElementById('editTitle').textContent = '编辑 · ' + l.label;
  document.getElementById('editBody').innerHTML = `
    <div class="gd-field">
      <div class="gd-label"><b>${l.label}</b><span>HANDLE</span></div>
      <input class="gd-input" id="edV" value="${GD.esc(l.value)}" placeholder="填写你的账号，如 @someone">
    </div>
    <button class="gd-btn" style="width:100%" onclick="saveLink(${i})">保 存</button>`;
  document.getElementById('editMask').classList.add('show');
}
function saveLink(i) {
  const p = GD.profile();
  p.links[i].value = document.getElementById('edV').value.trim();
  GD.setProfile(p); closeEdit(); renderMe();
}
function closeEdit() { document.getElementById('editMask').classList.remove('show'); }