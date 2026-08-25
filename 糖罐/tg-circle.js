/* ================================================================
   糖罐 TANGGUAN — tg-circle.js
   圈子 = 索引贴文件夹
   概览 / 正主 / 二创 / 榜单 / 管理，五张索引卡片
   依赖：tg-core.js / tg-genre.js / tg-cardkit.js / tg-plaza.js
================================================================ */

/* ================================================================
   零、圈内等级与权限
================================================================ */
const TG_CT_NEED = [0, 60, 160, 320, 560, 900, 1400, 2100, 3000, 4150, 5600, 7400, 9600, 12250, 15400, 19100, 23400, 28350, 34000, 40400];
const TG_CT_FALLBACK = [
  '路过的人', '常驻观众', '认真读者', '磕学新秀', '资深考据', '核心产粮', '圈内元老', '此圈之主',
  '钉死不走', '刻进骨头', '通宵型信徒', '论文级考据', '嗑穿次元', '自成一派', '圈内活史书',
  '死忠中的死忠', '磕到殉道', '万年镇圈', '活体圈规', '此圈唯一神'
];
const TG_CT_LEVELS = TG_CT_NEED.length;

const TG_CIRCLE_PERKS = [
  { lv: 1, n: '发布二创', d: '可以在二创区生成任意体裁的内容，并同步到对应分区。' },
  { lv: 2, n: '置顶一条', d: '可以把任意一条帖子钉在圈子首页最上方。' },
  { lv: 3, n: '编辑圈子资料', d: '可以更换头像、背景、简介与标签。' },
  { lv: 4, n: '正主动态', d: '解锁「让正主自己发一条」，另一位会在评论区出现。' },
  { lv: 5, n: '专属头衔改名', d: '可以让 AI 重新为这个圈拟一套二十级头衔，也可以手动改写。' },
  { lv: 6, n: '圈子公告', d: '可以写一条公告，永久显示在概览页顶部。' },
  { lv: 7, n: '精华位', d: '可以给帖子打上精华标记，榜单里会单独成列。' },
  { lv: 8, n: '年度名录', d: '这个圈会被写进糖罐年度名录，资料卡获得独立纹理。' },
  { lv: 10, n: '圈子勋章墙', d: '资料卡新增专属勋章位，展示这个圈独有的成就。' },
  { lv: 13, n: '隐藏体裁', d: '解锁两种更冷门、更考据向的体裁分区。' },
  { lv: 16, n: '专属水印', d: '这个圈产出的所有二创会带上仅此一家的暗纹水印。' },
  { lv: 20, n: '封神', d: '头衔栏获得独立底色与刻痕效果，永久区别于其他圈子。' }
];

function tgCircleLv(exp) {
  let lv = 1;
  TG_CT_NEED.forEach((n, i) => { if ((exp || 0) >= n) lv = i + 1; });
  return lv;
}
function tgCircleTitle(c, lv) {
  const t = (c && c.titles && c.titles.length === TG_CT_LEVELS) ? c.titles : TG_CT_FALLBACK.map(n => ({ name: n, desc: '' }));
  return t[Math.max(0, Math.min(TG_CT_LEVELS - 1, (lv || 1) - 1))];
}
async function tgCircleExp(c, n) {
  c.exp = (c.exp || 0) + n;
  await tgPut('circles', c);
}

/* ================================================================
   一、圈子列表（scr-circle）
================================================================ */
async function tgRenderCircleList() {
  const box = document.getElementById('tgCircleList');
  if (!box) return;
  const list = await tgAll('circles');
  window._tgArc = list;
  if (!list.length) {
    box.innerHTML = `<div class="tg-empty tg-rise tg-d2"><div class="tg-empty-mark" data-ico="circle"></div>
      <p>你还没有属于自己的圈。<br>去笔坊，四步就能建成第一个。</p>
      <div style="height:18px"></div>
      <button class="tg-btn tg-btn-dark" onclick="tgTab(3)">前往笔坊</button></div>`;
    tgFillIcons(box); return;
  }
  const posts = await tgAll('posts');
  const cnt = {};
  posts.forEach(r => { if (r.circleId) cnt[r.circleId] = (cnt[r.circleId] || 0) + 1; });

  box.innerHTML = `<div class="tg-sec-title"><b>我磕的圈</b><i>${list.length} CIRCLES</i></div>`
    + list.map((c, i) => {
      const lv = tgCircleLv(c.exp);
      const ti = tgCircleTitle(c, lv);
      return `<div class="tg-cfile tg-rise tg-d${(i % 6) + 1}" onclick="tgOpenCircle('${c.id}')">
        <div class="tg-cfile-tab"><span>${String(i + 1).padStart(2, '0')}</span></div>
        <div class="tg-cfile-body">
          <div class="tg-cfile-bg">${c.bg ? `<img src="${c.bg}" alt="">` : ''}</div>
          <div class="tg-cfile-row">
            <div class="tg-cfile-av">${c.avatar ? `<img src="${c.avatar}">` : `<span>${tgEsc((c.name || '?')[0])}</span>`}</div>
            <div class="tg-cfile-main">
              <b>${tgEsc(c.name)}</b>
              <p>${tgEsc((c.pairA && c.pairA.name) || '?')} × ${tgEsc((c.pairB && c.pairB.name) || '?')}</p>
              <div class="tg-cfile-tags">${(c.tags || []).slice(0, 3).map(t => `<i>${tgEsc(t)}</i>`).join('') || '<i>未设标签</i>'}</div>
            </div>
            <div class="tg-cfile-side">
              <em>LV.${lv}</em><i>${tgEsc(ti.name)}</i>
            </div>
          </div>
          <div class="tg-cfile-foot">
            <span>内容 <b>${cnt[c.id] || 0}</b></span>
            <span>活跃 <b>${c.exp || 0}</b></span>
            <span>建于 <b>${tgFmtDate(c.createdAt)}</b></span>
          </div>
        </div>
      </div>`;
    }).join('');
  tgFillIcons(box);
}

/* ================================================================
   二、圈子主页状态
================================================================ */
let tgCir = {
  c: null,
  tab: 'about',
  posts: [],       // 二创
  owner: [],       // 正主动态
  deep: {},
  busy: false,
  genre: 'all',
  batch: 3
};

function tgOpenCircle(id) {
  const list = window._tgArc || [];
  let c = list.find(x => x.id === id);
  if (!c) { tgAll('circles').then(l => { window._tgArc = l; const cc = l.find(x => x.id === id); if (cc) tgEnterCircle(cc); }); return; }
  tgEnterCircle(c);
}
async function tgEnterCircle(c) {
  tgCir.c = c;
  tgCir.tab = 'about';
  tgTitleDraft = null; tgTitleHistory = [];
  tgGo('scr-circlehome');
  tgCircleLoad();
}

async function tgCircleLoad() {
  const c = tgCir.c; if (!c) return;
  const rows = await tgAll('posts');
  const fan = [], own = [];
  rows.filter(r => r.circleId === c.id).forEach(r => {
    let p = tgPostReg.get(r.post && r.post.id);
    if (!p) {
      p = r.post; if (!p) return;
      p.imgs = TGCard.render(p);
      if (!p.imgs.length) return;
      p.comments = p.comments || [];
      tgPostReg.put(p);
    }
    if (r.kind === 'owner') own.push(p); else fan.push(p);
  });
  tgCir.posts = fan;
  tgCir.owner = own;
  fan.concat(own).forEach(p => { p.pinned = !!(c.pinnedId && p.id === c.pinnedId); });
  if (!Object.keys(tgCir.deep).length) tgCir.deep = await tgLoadCharsDeep();
  tgPaintCircle();
}
function tgCircleRepaint() { if (document.getElementById('scr-circlehome').classList.contains('active')) tgPaintCircle(); }

/* ================================================================
   三、主页渲染（索引贴文件夹）
================================================================ */
const TG_CTABS = [
  { k: 'about', n: '概览', en: 'ABOUT' },
  { k: 'them', n: '正主', en: 'THEM' },
  { k: 'fan', n: '二创', en: 'FANWORK' },
  { k: 'chart', n: '榜单', en: 'CHART' },
  { k: 'admin', n: '管理', en: 'ADMIN' }
];

function tgPaintCircle() {
  const c = tgCir.c; if (!c) return;
  const lv = tgCircleLv(c.exp);
  const ti = tgCircleTitle(c, lv);
  const next = TG_CT_NEED[lv] != null ? TG_CT_NEED[lv] : null;
  const cur = TG_CT_NEED[lv - 1];
  const pct = next ? Math.min(100, (((c.exp || 0) - cur) / (next - cur)) * 100) : 100;

  const hero = document.getElementById('tgCirHero');
  hero.classList.toggle('has-bg', !!c.bg);
  hero.innerHTML = `
    <div class="tg-cir-bg" onclick="tgCirPick('bg')">${c.bg ? `<img src="${c.bg}" alt="">` : '<div class="tg-cir-bgtip">轻触更换背景</div>'}</div>
    <div class="tg-cir-veil"></div>
    <div class="tg-cir-topbar">
      <button class="tg-back" data-ico="back" onclick="tgBack()"></button>
      <div class="tg-topbar-title">圈子</div>
      <div class="tg-topbar-step">CIRCLE</div>
    </div>
    <div class="tg-cir-face">
      <div class="tg-cir-av" onclick="tgCirPick('av')">${c.avatar ? `<img src="${c.avatar}">` : `<span>${tgEsc((c.name || '?')[0])}</span>`}</div>
      <div class="tg-cir-id">
        <h2>${tgEsc(c.name)}</h2>
        <i>${tgEsc((c.pairA && c.pairA.name) || '?')} × ${tgEsc((c.pairB && c.pairB.name) || '?')}</i>
      </div>
      <div class="tg-cir-lv" onclick="tgCirTitleSheet()">
        <em>LV.${lv}</em><b>${tgEsc(ti.name)}</b>
      </div>
    </div>
    <div class="tg-cir-tags">${(c.tags || []).map(t => `<i>${tgEsc(t)}</i>`).join('')}${c.access ? `<i class="ac">${tgEsc(String(c.access).split(' ')[0])}</i>` : ''}</div>
    <div class="tg-cir-bar">
      <div class="tg-cir-barfill" style="width:${pct}%"></div>
    </div>
    <div class="tg-cir-nums">
      <div><b>${tgKn(c.exp || 0)}</b><span>活跃值</span></div>
      <div><b>${tgCir.posts.length}</b><span>二创</span></div>
      <div><b>${tgCir.owner.length}</b><span>正主动态</span></div>
      <div><b>${next ? next - (c.exp || 0) : 0}</b><span>${next ? '距下一级' : '已满级'}</span></div>
    </div>`;

  const tabs = document.getElementById('tgCirTabs');
  tabs.innerHTML = TG_CTABS.map(t => `
    <button class="tg-fd-tab ${tgCir.tab === t.k ? 'on' : ''}" onclick="tgCirTab('${t.k}')">
      <b>${t.n}</b><i>${t.en}</i>
    </button>`).join('');

  const body = document.getElementById('tgCirBody');
  if (tgCir.tab === 'about') body.innerHTML = tgCirAbout(c);
  else if (tgCir.tab === 'them') body.innerHTML = tgCirThem(c);
  else if (tgCir.tab === 'fan') body.innerHTML = tgCirFan(c);
  else if (tgCir.tab === 'chart') body.innerHTML = tgCirChart(c);
  else body.innerHTML = tgCirAdmin(c, lv);
  tgFillIcons(document.getElementById('scr-circlehome'));
}
function tgCirTab(k) { tgCir.tab = k; tgPaintCircle(); document.getElementById('scr-circlehome').scrollTop = Math.min(document.getElementById('scr-circlehome').scrollTop, 260); }

/* ---------------- 概览 ---------------- */
function tgCirAbout(c) {
  const lore = c.lore;
  const pin = tgCir.posts.concat(tgCir.owner).find(p => p.id === c.pinnedId);
  return `
    ${c.notice ? `<div class="tg-notice"><span data-ico="pin"></span><p>${tgEsc(c.notice)}</p></div>` : ''}
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>圈子简介</b><i>INTRO</i></div>
      <p class="tg-fd-p">${tgEsc(c.intro || '这个圈还没有写简介。可以在管理页里补上，或者让糖罐替你写一段。')}</p>
    </div>

    ${pin ? `<div class="tg-fd-sec">
      <div class="tg-fd-h"><b>置顶</b><i>PINNED</i></div>
      <div class="tg-pinbox" onclick="tgOpenPost('${pin.id}')">
        <div class="tg-pinbox-img"><img src="${pin.imgs[0]}" alt=""></div>
        <div class="tg-pinbox-main"><b>${tgEsc(pin.title)}</b><p>${tgEsc(String(pin.caption).slice(0, 52))}</p>
          <em>${tgGenreName(pin.genre)} · ${tgKn(pin.view || 0)} 浏览</em></div>
      </div>
    </div>` : ''}

    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>这一对的基本信息</b><i>DOSSIER</i>
        <button class="tg-tiny-btn" ${tgCir.busy ? 'disabled' : ''} onclick="tgGenLore()">${lore ? '重新生成' : '让 AI 整理'}</button></div>
      ${lore ? tgLoreHTML(lore) : `<p class="tg-fd-p">还没有整理过。糖罐可以读取笔坊里这一对的全部档案，整理出一页「入坑必读」：一句话简介、怎么认识的、关系现状、三件关键物品、时间线、雷区、以及新人最常问的几个问题。</p>`}
    </div>

    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>最近</b><i>RECENT</i></div>
      ${tgCir.posts.concat(tgCir.owner).sort((a, b) => b.createdAt - a.createdAt).slice(0, 3)
      .map((p, i) => tgPostCardHTML(p, i, { inCircle: true })).join('')
    || '<p class="tg-fd-p">这个圈还没有任何内容。去「二创」页生成第一批。</p>'}
    </div>`;
}
function tgLoreHTML(l) {
  return `
    <div class="tg-dossier">
      <div class="tg-dos-line">${tgEsc(l.oneline || '')}</div>
      ${[['怎么认识的', l.meet], ['现在是什么关系', l.relation], ['最大的问题', l.conflict]].filter(x => x[1]).map(x => `
        <div class="tg-dos-row"><b>${x[0]}</b><p>${tgEsc(x[1])}</p></div>`).join('')}
      ${(l.items || []).length ? `<div class="tg-dos-row"><b>三件关键物品</b>
        <div class="tg-dos-chips">${l.items.map(i => `<i>${tgEsc(i)}</i>`).join('')}</div></div>` : ''}
      ${(l.timeline || []).length ? `<div class="tg-dos-row"><b>时间线</b>
        <div class="tg-timeline">${l.timeline.map(t => `<div class="tg-tl"><em>${tgEsc(t.when || '')}</em><p>${tgEsc(t.what || '')}</p></div>`).join('')}</div></div>` : ''}
      ${l.forbidden ? `<div class="tg-dos-row warn"><b>雷区</b><p>${tgEsc(l.forbidden)}</p></div>` : ''}
      ${(l.faq || []).length ? `<div class="tg-dos-row"><b>新人常问</b>
        ${l.faq.map(f => `<div class="tg-faq"><em>${tgEsc(f.q || '')}</em><p>${tgEsc(f.a || '')}</p></div>`).join('')}</div>` : ''}
    </div>`;
}

/* ---------------- 正主 ---------------- */
function tgCirThem(c) {
  const one = (p, seat) => {
    if (!p) return '';
    const f = tgCir.deep[p.uid];
    return `<div class="tg-them">
      <div class="tg-them-seat">${seat}</div>
      <div class="tg-them-av"><span>${tgEsc((p.name || '?')[0])}</span></div>
      <div class="tg-them-main">
        <b>${tgEsc(p.name)}</b>
        <i>${[p.role, p.gender, p.age].filter(Boolean).join(' · ') || '资料未公开'}</i>
        <div class="tg-them-tags">${(p.tags || []).map(t => `<em>${tgEsc(t)}</em>`).join('')}</div>
      </div>
      <div class="tg-them-lock" data-ico="lock"></div>
    </div>`;
  };
  const list = tgCir.owner.sort((a, b) => b.createdAt - a.createdAt);
  return `
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>正主名录</b><i>THE TWO</i></div>
      ${one(c.pairA, 'A')}${one(c.pairB, 'B')}
      <p class="tg-hint" style="margin-top:10px">卡片只显示公开信息。人设、提示词、背景故事等核心内容始终加密，不会在任何界面上出现，但生成内容时会完整交给模型。</p>
    </div>
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>正主发的</b><i>THEIR POSTS · ${list.length}</i>
        <button class="tg-tiny-btn" ${tgCir.busy ? 'disabled' : ''} onclick="tgCirGen('owner')">让他们发一条</button></div>
      <p class="tg-hint">这不是同人。是他们自己发的朋友圈、微博、日记、随手写的便签。另一位一定会在评论区出现，而且绝不会把话说破。</p>
      <div id="tgCirOwnList">
        ${list.length ? list.map((p, i) => tgPostCardHTML(p, i, { inCircle: true })).join('')
      : '<p class="tg-fd-p">还没有任何一条。点上面那颗按钮。</p>'}
      </div>
    </div>`;
}

/* ---------------- 二创 ---------------- */
function tgCirFan(c) {
  const gs = ['all'].concat(TG_GENRES.map(g => g.k));
  let list = tgCir.posts.slice().sort((a, b) => b.createdAt - a.createdAt);
  if (tgCir.genre !== 'all') list = list.filter(p => p.genre === tgCir.genre);
  return `
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>二创区</b><i>FANWORK · ${tgCir.posts.length}</i></div>
      <p class="tg-hint">选一个体裁，就连出三篇同体裁的；选「混合」，一批里的每一篇都是不同体裁，绝不重样。生成后自动归到对应分区。</p>
      <div class="tg-chips tg-scrollx" style="margin-top:10px">
        ${gs.map(k => `<button class="tg-gchip ${tgCir.genre === k ? 'on' : ''}" onclick="tgCirGenre('${k}')">${k === 'all' ? '混合' : tgGenreName(k)}</button>`).join('')}
      </div>
      <div class="tg-plaza-acts">
        <button class="tg-btn tg-btn-dark tg-btn-sm" ${tgCir.busy ? 'disabled' : ''} onclick="tgCirGen('fan')">${tgCir.busy ? '生成中…' : `生成 ${tgCir.batch} 篇`}</button>
        <button class="tg-mini-btn" data-ico="shuffle" ${tgCir.busy ? 'disabled' : ''} onclick="tgCirBatchSheet()"></button>
      </div>
    </div>
    <div id="tgCirFanList">
      ${list.length ? list.map((p, i) => tgPostCardHTML(p, i, { inCircle: true })).join('')
      : '<div class="tg-fd-sec"><p class="tg-fd-p">这个分区还没有内容。</p></div>'}
    </div>`;
}
function tgCirGenre(k) { tgCir.genre = k; tgPaintCircle(); }
function tgCirBatchSheet() {
  tgSheetOpen(`<h4>这一批生成几篇</h4>
    <p class="tg-sheet-sub">数量越多耗时越久。混合模式下最多能一次铺满十四种体裁。</p>
    <div class="tg-chips" style="margin-top:14px">
      ${[1, 3, 5, 8, 14].map(n => `<button class="tg-chip ${tgCir.batch === n ? 'on' : ''}" onclick="tgCir.batch=${n};tgCloseSheet();tgPaintCircle();tgToast('已设为 ${n} 篇')">${n} 篇</button>`).join('')}
    </div>`);
}

/* ---------------- 榜单 ---------------- */
function tgCirChart(c) {
  const all = tgCir.posts.concat(tgCir.owner);
  const hot = all.slice().sort((a, b) => (b.stats.like + b.stats.collect * 2) - (a.stats.like + a.stats.collect * 2)).slice(0, 8);
  const view = all.slice().sort((a, b) => (b.view || 0) - (a.view || 0)).slice(0, 5);
  const byG = {};
  all.forEach(p => { byG[p.genre] = (byG[p.genre] || 0) + 1; });
  const gList = Object.keys(byG).sort((a, b) => byG[b] - byG[a]);
  if (!all.length) return `<div class="tg-fd-sec"><p class="tg-fd-p">还没有内容可以排。先去二创区生成一批。</p></div>`;
  return `
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>圈内热帖</b><i>HOT</i></div>
      <div class="tg-rank-list">
        ${hot.map((p, i) => `<div class="tg-rk ${i < 3 ? 'top' : ''}" onclick="tgOpenPost('${p.id}')">
          <div class="tg-rk-n">${String(i + 1).padStart(2, '0')}</div>
          <div class="tg-rk-main"><b>${tgEsc(p.title)}<em>${tgGenreName(p.genre)}</em></b><p>${tgEsc(String(p.caption).slice(0, 40))}</p></div>
          <div class="tg-rk-side"><i>${tgKn(p.stats.like)}</i><span class="tg-tr hd">赞</span></div>
        </div>`).join('')}
      </div>
    </div>
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>被翻得最多的</b><i>MOST VIEWED</i></div>
      <div class="tg-rank-list">
        ${view.map((p, i) => `<div class="tg-rk" onclick="tgOpenPost('${p.id}')">
          <div class="tg-rk-n">${String(i + 1).padStart(2, '0')}</div>
          <div class="tg-rk-main"><b>${tgEsc(p.title)}</b><p>${tgEsc(p.author.name)}</p></div>
          <div class="tg-rk-side"><i>${tgKn(p.view || 0)}</i><span class="tg-tr hd">浏览</span></div>
        </div>`).join('')}
      </div>
    </div>
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>体裁分布</b><i>BY GENRE</i></div>
      ${gList.map(k => {
        const w = Math.round(byG[k] / all.length * 100);
        return `<div class="tg-gbar"><span>${tgGenreName(k)}</span>
          <div class="tg-gbar-t"><i style="width:${w}%"></i></div><b>${byG[k]}</b></div>`;
      }).join('')}
    </div>`;
}

/* ---------------- 管理 ---------------- */
function tgCirAdmin(c, lv) {
  return `
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>权限解锁</b><i>PERKS · LV.${lv}</i></div>
      <p class="tg-hint">圈内活跃值来自你在这个圈里的每一次生成、互动与更新。等级只升不降，高阶自动包含低阶。</p>
      ${TG_CIRCLE_PERKS.map(p => `
        <div class="tg-perk ${lv >= p.lv ? 'on' : ''}">
          <div class="tg-perk-lv">LV.${p.lv}</div>
          <div class="tg-perk-main"><b>${p.n}</b><p>${p.d}</p></div>
          <div class="tg-perk-state">${lv >= p.lv ? '已解锁' : `差 ${TG_CT_NEED[p.lv - 1] - (c.exp || 0)}`}</div>
        </div>`).join('')}
    </div>
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>操作</b><i>ACTIONS</i></div>
      <div class="tg-act-grid">
        ${tgActBtn(lv, 2, '设置置顶', 'tgCirPinSheet()')}
        ${tgActBtn(lv, 3, '编辑资料', 'tgCirEdit()')}
        ${tgActBtn(lv, 5, '重拟头衔', 'tgTitleHistory=[];tgCirTitleSheet();tgGenTitles(true)')}
        ${tgActBtn(lv, 6, '写公告', 'tgCirNotice()')}
      </div>
    </div>
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>二十级头衔</b><i>TITLES</i></div>
      <p class="tg-hint">头衔由 AI 根据这一对的关系、气质与世界观拟定，每个圈都不一样。</p>
      ${(c.titles && c.titles.length === TG_CT_LEVELS ? c.titles : TG_CT_FALLBACK.map(n => ({ name: n, desc: '默认头衔，尚未为这个圈定制' }))).map((t, i) => `
        <div class="tg-title-row ${lv >= i + 1 ? 'on' : ''}">
          <em>LV.${i + 1}</em>
          <div><b>${tgEsc(t.name)}</b><p>${tgEsc(t.desc || '')}</p></div>
          <i>${TG_CT_NEED[i]}</i>
        </div>`).join('')}
    </div>
    <div class="tg-fd-sec">
      <div class="tg-fd-h"><b>危险操作</b><i>DANGER</i></div>
      <button class="tg-btn tg-btn-light" onclick="tgCirDelete()">解散这个圈</button>
    </div>`;
}
function tgActBtn(lv, need, txt, fn) {
  const ok = lv >= need;
  return `<button class="tg-act ${ok ? '' : 'lock'}" onclick="${ok ? fn : `tgToast('LV.${need} 解锁')`}">
    <b>${txt}</b><i>${ok ? '可用' : 'LV.' + need}</i></button>`;
}

/* ================================================================
   四、生成：二创 / 正主
================================================================ */
async function tgCirGen(kind) {
  const c = tgCir.c;
  if (!c || tgCir.busy) return;
  if (!tgHasApi()) { tgNoApi(); return; }
  const lv = tgCircleLv(c.exp);
  if (kind === 'owner' && lv < 4) { tgToast('正主动态需要圈内 LV.4'); return; }

  const n = kind === 'owner' ? 1 : tgCir.batch;
  tgCir.busy = true; tgPaintCircle();
  const host = document.getElementById(kind === 'owner' ? 'tgCirOwnList' : 'tgCirFanList');
  if (host) host.insertAdjacentHTML('afterbegin',
    `<div class="tg-gen" id="tgCirGenBox"><div class="tg-gen-ring"><i></i><i></i><i></i></div>
      <b>正在生成</b><p id="tgCirTip">读取档案、锁定人设、落笔……</p><div class="tg-gen-track" id="tgCirTrack"></div></div>`);

  const genres = kind === 'owner'
    ? tgPickGenres(1, null, TG_OWNER_GENRES)
    : tgPickGenres(n, tgCir.genre);

  let ok = 0;
  for (let i = 0; i < n; i++) {
    const tip = document.getElementById('tgCirTip');
    if (tip) tip.textContent = `第 ${i + 1} / ${n} 篇 · ${tgGenreName(genres[i])}`;
    const tr = document.getElementById('tgCirTrack');
    if (tr) tr.innerHTML = genres.map((k, j) => `<i class="${j < i ? 'done' : (j === i ? 'now' : '')}">${tgGenreName(k)}</i>`).join('');
    try {
      let p;
      if (kind === 'owner') {
        const who = Math.random() < 0.5 ? c.pairA : c.pairB;
        const other = who === c.pairA ? c.pairB : c.pairA;
        p = await tgGenPost({
          circle: c, deep: tgCir.deep, genre: genres[i], scope: 'owner',
          ownerName: who && who.name,
          voice: `由正主「${who && who.name}」本人发布`,
          extra: [
            `【互动要求】另一位正主「${other && other.name}」必须在评论 / 回复 / 楼层里出现，说的话要极其像本人，可以只有四个字，可以阴阳怪气，但绝不能是彩虹屁。`,
            '【重要】不要让两个人在公开场合把关系说破。围观的人可以起哄，正主本人不能承认。',
            '【重要】这不是同人创作，是当事人自己发的东西，不要出现「本文」「这篇」「同人」这类词。'
          ].join('\n'),
          maxTokens: 6000
        });
      } else {
        p = await tgGenPost({
          circle: c, deep: tgCir.deep, genre: genres[i], scope: 'circle',
          extra: '【场合】这是发在这个 CP 圈内部的二创，读者都是熟悉设定的人，不需要交代背景，可以直接进入细节和梗。'
        });
      }
      p.imgs = TGCard.render(p);
      if (!p.imgs.length) throw new Error('RENDER');
      p.circleTab = kind;
      tgPostReg.put(p);
      await tgPut('posts', { id: p.id, createdAt: p.createdAt, kind: kind === 'owner' ? 'owner' : 'fan', circleId: c.id, post: Object.assign({}, p, { imgs: null }) });
      if (kind === 'owner') tgCir.owner.unshift(p); else tgCir.posts.unshift(p);
      ok++;
    } catch (e) { console.warn('[糖罐] 圈内生成失败', e); }
  }
  await tgCircleExp(c, ok * 12);
  tgCir.busy = false;
  tgPaintCircle();
  if (ok) {
    tgToast(`新增 ${ok} 篇 · 活跃值 +${ok * 12}`);
    if (typeof tgAddSweet === 'function') tgAddSweet(6 * ok);
  } else tgToast('这次没生成出来，换个模型或稍后再试');
}

/* ================================================================
   五、AI：基本信息 / 头衔
================================================================ */
async function tgGenLore() {
  const c = tgCir.c; if (!c || tgCir.busy) return;
  if (!tgHasApi()) { tgNoApi(); return; }
  tgCir.busy = true; tgPaintCircle();
  const user = [
    '【任务】为一个 CP 圈整理一页「入坑必读」的基本信息。',
    '【CP 资料】\n' + tgCircleBrief(c, tgCir.deep),
    '',
    '【要求】',
    '· oneline：一句话说清这一对，25 到 45 字，要有钩子，不要写成简介腔。',
    '· meet：他们是怎么认识的，80 到 140 字，落到具体场景上。',
    '· relation：现在是什么关系，80 到 140 字，写清楚那层没捅破的东西。',
    '· conflict：他们之间最大的问题是什么，60 到 110 字。',
    '· items：三件关键物品，每件 4 到 10 字。',
    '· timeline：4 到 6 个时间节点，when 是时间标记（如「七年前」「去年冬天」），what 是那时发生了什么，20 到 40 字。',
    '· forbidden：这个圈的雷区，60 到 100 字，用圈主口吻。',
    '· faq：3 到 4 个新人最常问的问题与回答，回答 40 到 80 字。',
    '',
    '【必须严格遵循的 JSON 结构】',
    '{"oneline":"","meet":"","relation":"","conflict":"","items":["","",""],"timeline":[{"when":"","what":""}],"forbidden":"","faq":[{"q":"","a":""}]}',
    '',
    '现在直接输出 JSON。'
  ].join('\n');
  try {
    const j = await tgAskJSON(tgSysPrompt(), user, { max: 3600, rounds: 3 });
    c.lore = {
      oneline: String(j.oneline || ''), meet: String(j.meet || ''),
      relation: String(j.relation || ''), conflict: String(j.conflict || ''),
      items: (Array.isArray(j.items) ? j.items : []).map(String).slice(0, 4),
      timeline: (Array.isArray(j.timeline) ? j.timeline : []).map(t => ({ when: String(t.when || ''), what: String(t.what || '') })).slice(0, 8),
      forbidden: String(j.forbidden || ''),
      faq: (Array.isArray(j.faq) ? j.faq : []).map(f => ({ q: String(f.q || ''), a: String(f.a || '') })).slice(0, 5),
      summary: [j.oneline, j.relation, j.conflict].filter(Boolean).join(' ')
    };
    await tgPut('circles', c);
    await tgCircleExp(c, 20);
    tgToast('基本信息已整理');
  } catch (e) { tgToast('这次没整理出来，再试一次'); }
  tgCir.busy = false; tgPaintCircle();
}

let tgTitleBusy = false;
let tgTitleDraft = null;   // 生成出来但还未应用的一套头衔，供预览页使用
let tgTitleHistory = [];   // 已经出过的版本（头衔文本），用于提示 AI 不要重复

/* 拟一批（n 个），供整段生成与分批生成共用 */
async function tgGenTitleBatch(c, pairName, avoid, n, offset) {
  const rangeNote = offset != null
    ? `本次只需要拟第 ${offset + 1} 到 ${offset + n} 级（共 ${n} 个），级别越高要越「重」越「狠」，延续从低到高越陷越深的路径。`
    : `一共 ${n} 个，从最低到最高，要能看出一条越陷越深、越磕越死忠的路径，后几级要明显比前几级更「重」更「狠」。`;
  const user = [
    `【任务】为 CP 圈「${pairName}」拟一套专属头衔。`,
    '【CP 资料】\n' + tgCircleBrief(c, tgCir.deep),
    '',
    '【要求】',
    `· ${rangeNote}`,
    `· 每个头衔都必须直接点名或强绑定「${pairName}」这一对——用到二人的名字、称呼、职业、关系动词、标志性物件、场景或那句最戳的台词，换成任何别的 CP 都读不通、套不上。`,
    '· 每个头衔 2 到 6 个字，不要用「新手 / 入门 / 高级 / 大师」这类通用词，也不要用「粉丝 / 唯粉 / 站姐」这类饭圈通用词。',
    '· desc 用 15 到 30 字解释这个头衔在这个圈里意味着什么，要提到这一对具体的关系或细节，语气可以毒可以温柔，但要有态度。',
    avoid,
    '',
    '【必须严格遵循的 JSON 结构】',
    '{"titles":[{"name":"","desc":""}]}',
    '',
    '现在直接输出 JSON。'
  ].join('\n');
  const j = await tgAskJSON(tgSysPrompt(), user, { max: Math.max(1400, n * 140), rounds: 3, expectKeys: ['titles', 'list'] });
  let t = Array.isArray(j) ? j : (j.titles || j.list || j.items || j.data || []);
  t = t.map(x => (typeof x === 'string' ? { name: x, desc: '' } : { name: String(x.name || '').slice(0, 10), desc: String(x.desc || '').slice(0, 60) })).filter(x => x.name);
  return t.slice(0, n);
}

async function tgGenTitles(inSheet) {
  const c = tgCir.c; if (!c || tgTitleBusy) return;
  if (!tgHasApi()) { tgNoApi(); return; }
  tgTitleBusy = true;
  if (inSheet) tgTitleSheetLoading(); else tgPaintCircle();
  const pairName = `${(c.pairA && c.pairA.name) || '?'} × ${(c.pairB && c.pairB.name) || '?'}`;
  const avoid = tgTitleHistory.length
    ? `\n【必须避开的旧版本，不能重复出现同名头衔，措辞也要明显不同】\n` +
      tgTitleHistory.map((v, vi) => `第 ${vi + 1} 版：` + v.map(x => x.name).join('、')).join('\n')
    : '';

  let draft = null, failReason = '';
  try {
    // 先整批 20 个一次性尝试
    let t = await tgGenTitleBatch(c, pairName, avoid, TG_CT_LEVELS);
    if (t.length < TG_CT_LEVELS) {
      // 不够整批的，缺口部分单独按「续写」再拟一次，而不是直接用默认词条充数
      const missN = TG_CT_LEVELS - t.length;
      try {
        const more = await tgGenTitleBatch(c, pairName, avoid + `\n（已经拟好前 ${t.length} 个，现在只需要接着拟第 ${t.length + 1} 到 ${TG_CT_LEVELS} 级）`, missN, t.length);
        t = t.concat(more);
      } catch (e2) { /* 补拟也失败就维持原样，走下面的条数判断 */ }
    }
    if (t.length < Math.ceil(TG_CT_LEVELS * 0.6)) {
      draft = null;
      failReason = `模型这次只返回了 ${t.length} 条，格式或字段可能不对`;
    } else {
      while (t.length < TG_CT_LEVELS) t.push({ name: TG_CT_FALLBACK[t.length], desc: '' });
      draft = t.slice(0, TG_CT_LEVELS);
    }
  } catch (e) {
    draft = null;
    const msg = String((e && e.message) || e);
    failReason = msg.indexOf('NO_API') === 0 ? '未配置 API' : (msg === 'PARSE' ? '模型返回内容无法解析为 JSON' : msg === 'MISSING_KEY' ? '返回的字段名对不上' : '请求失败：' + msg.slice(0, 30));
  }
  tgTitleBusy = false;
  if (!inSheet) { tgPaintCircle(); return; }
  if (!document.getElementById('tgSheetMask').classList.contains('on')) return; // 用户已经关掉弹层，不再打扰
  if (!draft) { tgToast('这次没拟出来（' + failReason + '），再试一次'); tgCirTitleSheet(); return; }
  tgTitleDraft = draft;
  tgTitlePreviewSheet();
}

function tgTitleSheetLoading() {
  const c = tgCir.c; if (!c) return;
  tgSheetOpen(`<h4>${tgEsc(c.name)} · 圈内头衔</h4>
    <div class="tg-gen" style="margin-top:6px">
      <div class="tg-gen-ring"><i></i><i></i><i></i></div>
      <b>正在为这一对重拟头衔</b>
      <p>读取 CP 档案、锁定关系脉络、逐级落笔……</p>
    </div>`);
}

/* 生成结果先在这里预览，用户确认后才会真的替换 c.titles */
function tgTitlePreviewSheet() {
  const c = tgCir.c; if (!c || !tgTitleDraft) return;
  const lv = tgCircleLv(c.exp);
  tgSheetOpen(`<h4>${tgEsc(c.name)} · 新的一套头衔</h4>
    <p class="tg-sheet-sub">这是刚拟好的新版本，还没有应用。看看合不合适，再决定替换还是重新生成。</p>
    ${tgTitleDraft.map((x, i) => `<div class="tg-title-row ${lv >= i + 1 ? 'on' : ''}">
      <em>LV.${i + 1}</em><div><b>${tgEsc(x.name)}</b><p>${tgEsc(x.desc || '')}</p></div><i>${TG_CT_NEED[i]}</i></div>`).join('')}
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgTitleApplyDraft()">应用这一套</button>
    <div style="height:9px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgTitleRegenFromPreview()">不满意，重新生成</button>
    <div style="height:9px"></div>
    <button class="tg-btn tg-btn-ghost" onclick="tgTitleDiscardDraft()">放弃，保留原来的</button>`);
}

async function tgTitleApplyDraft() {
  const c = tgCir.c; if (!c || !tgTitleDraft) return;
  c.titles = tgTitleDraft;
  await tgPut('circles', c);
  tgTitleHistory = []; tgTitleDraft = null;
  tgToast('新头衔已应用');
  tgCirTitleSheet();
  tgCircleRepaint();
}

function tgTitleDiscardDraft() {
  if (tgTitleDraft) tgTitleHistory.push(tgTitleDraft);
  tgTitleDraft = null;
  tgToast('已放弃，保留原来的头衔');
  tgCirTitleSheet();
}

function tgTitleRegenFromPreview() {
  if (tgTitleDraft) tgTitleHistory.push(tgTitleDraft);
  tgTitleDraft = null;
  tgGenTitles(true);
}

function tgCirTitleSheet() {
  const c = tgCir.c; if (!c) return;
  const lv = tgCircleLv(c.exp);
  const t = c.titles && c.titles.length === TG_CT_LEVELS ? c.titles : TG_CT_FALLBACK.map(n => ({ name: n, desc: '' }));
  tgSheetOpen(`<h4>${tgEsc(c.name)} · 圈内头衔</h4>
    <p class="tg-sheet-sub">当前 LV.${lv}「${tgEsc(t[lv - 1].name)}」。活跃值 ${c.exp || 0}。</p>
    ${t.map((x, i) => `<div class="tg-title-row ${lv >= i + 1 ? 'on' : ''}">
      <em>LV.${i + 1}</em><div><b>${tgEsc(x.name)}</b><p>${tgEsc(x.desc || '')}</p></div><i>${TG_CT_NEED[i]}</i></div>`).join('')}
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgTitleHistory=[];tgGenTitles(true)">让 AI 重拟一套</button>`);
}

/* ================================================================
   六、管理动作
================================================================ */
function tgCirPinSheet() {
  const all = tgCir.posts.concat(tgCir.owner).sort((a, b) => b.createdAt - a.createdAt);
  if (!all.length) { tgToast('还没有可以置顶的内容'); return; }
  tgSheetOpen(`<h4>设置置顶</h4>
    <p class="tg-sheet-sub">被置顶的那条会固定显示在概览页最上方。</p>
    <div style="height:10px"></div>
    ${all.slice(0, 14).map(p => `<div class="tg-rec" onclick="tgCirPin('${p.id}')">
      <div class="tg-rec-av"><span>${tgEsc((p.title || '?')[0])}</span></div>
      <div class="tg-rec-main"><b>${tgEsc(p.title)}</b><p>${tgGenreName(p.genre)} · ${tgEsc(p.author.name)}</p></div>
      <div class="tg-rec-side"><i>${tgCir.c.pinnedId === p.id ? '已置顶' : ''}</i></div>
    </div>`).join('')}
    <div style="height:12px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgCirPin('')">取消置顶</button>`);
}
async function tgCirPin(id) {
  const c = tgCir.c;
  tgCir.posts.concat(tgCir.owner).forEach(p => { p.pinned = (p.id === id); });
  c.pinnedId = id || null;
  await tgPut('circles', c);
  tgCloseSheet(); tgCir.tab = 'about'; tgPaintCircle();
  tgToast(id ? '已置顶' : '已取消置顶');
}

function tgCirEdit() {
  const c = tgCir.c;
  tgSheetOpen(`<h4>编辑圈子资料</h4>
    <div class="tg-field"><div class="tg-label">圈名 <small>name</small></div>
      <input class="tg-input" id="tgCeName" value="${tgEsc(c.name)}"></div>
    <div class="tg-field"><div class="tg-label">简介 <small>intro</small></div>
      <textarea class="tg-textarea" id="tgCeIntro">${tgEsc(c.intro || '')}</textarea></div>
    <div class="tg-field"><div class="tg-label">标签 <small>tags，用顿号或竖线分隔</small></div>
      <input class="tg-input" id="tgCeTags" value="${tgEsc((c.tags || []).join('｜'))}"></div>
    <div style="height:16px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgCirEditSave()">保存</button>`);
}
async function tgCirEditSave() {
  const c = tgCir.c;
  c.name = (document.getElementById('tgCeName').value || '').trim() || c.name;
  c.intro = (document.getElementById('tgCeIntro').value || '').trim();
  c.tags = (document.getElementById('tgCeTags').value || '').split(/[|｜、,，\/]/).map(x => x.trim()).filter(Boolean).slice(0, 8);
  await tgPut('circles', c);
  tgCloseSheet(); tgPaintCircle(); tgRenderCircleList(); tgToast('已保存');
}

function tgCirNotice() {
  const c = tgCir.c;
  tgSheetOpen(`<h4>圈子公告</h4>
    <p class="tg-sheet-sub">写一句挂在概览页顶部的话。留空则取消公告。</p>
    <div class="tg-field"><textarea class="tg-textarea" id="tgCeNotice" placeholder="例：本圈不接受拆逆，来之前请先读置顶。">${tgEsc(c.notice || '')}</textarea></div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgCirNoticeSave()">保存</button>`);
}
async function tgCirNoticeSave() {
  const c = tgCir.c;
  c.notice = (document.getElementById('tgCeNotice').value || '').trim();
  await tgPut('circles', c);
  tgCloseSheet(); tgCir.tab = 'about'; tgPaintCircle(); tgToast('公告已更新');
}

function tgCirDelete() {
  const c = tgCir.c;
  tgSheetOpen(`<h4>解散「${tgEsc(c.name)}」</h4>
    <p class="tg-sheet-sub">圈子本身会被删除，圈内已生成的内容也会一并移除。这个操作不可撤销。</p>
    <div style="height:16px"></div>
    <div class="tg-btn-row">
      <button class="tg-btn tg-btn-light" onclick="tgCloseSheet()">再想想</button>
      <button class="tg-btn tg-btn-dark" onclick="tgCirDeleteGo()">确认解散</button>
    </div>`);
}
async function tgCirDeleteGo() {
  const c = tgCir.c;
  const rows = await tgAll('posts');
  for (const r of rows) if (r.circleId === c.id) await tgDel('posts', r.id);
  await tgDel('circles', c.id);
  tgCloseSheet(); tgBack();
  tgRenderCircleList();
  if (typeof tgRefreshStats === 'function') tgRefreshStats();
  tgPlaza.loaded = false;
  tgToast('已解散');
}

/* 圈子封面上传 */
function tgCirPick(which) {
  const lv = tgCircleLv(tgCir.c && tgCir.c.exp);
  if (lv < 3) { tgToast('更换封面需要圈内 LV.3'); return; }
  tgPickImg(which === 'bg' ? 'cirbg' : 'cirav');
}
(function () {
  const prev = window.tgOnImage;
  window.tgOnImage = function (target, dataUrl) {
    if (target === 'cirbg' || target === 'cirav') {
      const c = tgCir.c; if (!c) return;
      if (target === 'cirbg') c.bg = dataUrl; else c.avatar = dataUrl;
      tgPut('circles', c).then(() => { tgPaintCircle(); tgToast('封面已更新'); });
      return;
    }
    if (typeof prev === 'function') prev(target, dataUrl);
  };
})();

/* ================================================================
   七、入场钩子
================================================================ */
function tgOnEnterCircle(id) {
  if (id === 'scr-circle') tgRenderCircleList();
  if (id === 'scr-circlehome' && tgCir.c) tgPaintCircle();
}