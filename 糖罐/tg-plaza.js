/* ================================================================
   糖罐 TANGGUAN — tg-plaza.js  v2
   广场 = 热榜 + 正主动态 + 混合体裁信息流
   依赖：tg-core.js / tg-genre.js / tg-cardkit.js
================================================================ */

Object.assign(TG_ICONS, {
  refresh: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.4-5.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 3.6V9h-5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.4v11.4M7.4 10.6 12 15.2l4.6-4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.4 17.4v1.8a1.8 1.8 0 0 0 1.8 1.8h11.6a1.8 1.8 0 0 0 1.8-1.8v-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.4S3.6 15.4 3.6 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.4 2.6c0 5.8-8.4 10.8-8.4 10.8z" fill="currentColor" opacity=".9"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3.6 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.7z" fill="currentColor" opacity=".85"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.6 11.4 20.4 4l-7.4 16.4-2.2-6.6z" fill="currentColor" opacity=".92"/><path d="m10.8 13.8 9.6-9.8" stroke="#fff" stroke-width="1.4" opacity=".5"/></svg>',
  robot: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.8" y="7.4" width="16.4" height="12" rx="4.2" fill="currentColor" opacity=".92"/><circle cx="9" cy="13.4" r="1.9" fill="#fff"/><circle cx="15" cy="13.4" r="1.9" fill="#fff"/><path d="M12 3.2v3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="2.6" r="1.6" fill="currentColor"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" opacity=".9"/><rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" opacity=".5"/><rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" opacity=".5"/><rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" opacity=".9"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none"><path d="M2.4 12S6 5.6 12 5.6 21.6 12 21.6 12 18 18.4 12 18.4 2.4 12 2.4 12z" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="3.2" fill="currentColor" opacity=".8"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 5.6h16a1.6 1.6 0 0 1 1.6 1.6v8.4a1.6 1.6 0 0 1-1.6 1.6H9.4L5 20.4v-3.2H4a1.6 1.6 0 0 1-1.6-1.6V7.2A1.6 1.6 0 0 1 4 5.6z" fill="currentColor" opacity=".85"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none"><path d="M13 2.2c.6 4.2 5 5.6 5 10.2a6 6 0 0 1-12 0c0-2.4 1.4-3.6 2.2-5.4 1.2 1.2 1.4 2.6 1.4 2.6C10.8 6.6 12.4 4.6 13 2.2z" fill="currentColor" opacity=".9"/></svg>',
  crown: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 8.4 7 12l5-7.6 5 7.6 4-3.6-1.8 10.4H4.8z" fill="currentColor" opacity=".9"/><rect x="4.8" y="19" width="14.4" height="2.4" rx="1.2" fill="currentColor" opacity=".5"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.6 2.6 21.4 9.4l-3 1.2-.6 4.4-5.8-5.8-5 8.4 8.4-5-5.8-5.8 4.4-.6z" fill="currentColor" opacity=".9"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 6.4A1.6 1.6 0 0 1 4.6 4.8h4.2l2 2.4h8.6A1.6 1.6 0 0 1 21 8.8v9.6a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 18.4z" fill="currentColor" opacity=".85"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.6 6.6h3.6c4.2 0 4.4 10.8 8.6 10.8h4.6M3.6 17.4h3.6c2 0 3.1-2.5 4-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M17.6 3.6 21 6.6l-3.4 3M17.6 14.4l3.4 3-3.4 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none"><path d="m6 15 6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
});

/* ================================================================
   全局帖子登记处：广场 / 圈子 / 详情页共用
================================================================ */
const tgPostReg = {
  map: {},
  put(p) { if (p && p.id) this.map[p.id] = p; return p; },
  get(id) { return this.map[id] || null; },
  all() { return Object.keys(this.map).map(k => this.map[k]); }
};

/* ================================================================
   广场状态
================================================================ */
let tgPlaza = {
  posts: [],
  circles: [],
  owner: [],          // 正主动态
  rank: null,         // CP 热榜
  circleId: 'all',
  genre: 'all',
  batch: 3,
  busy: false,
  loaded: false
};

/* ================================================================
   一、CP 热榜
================================================================ */
/* 兜底榜单：AI 失败/残缺时用，保证界面上永远有一份完整可看的榜单，不出现报错或空白 */
const TG_RANK_FALLBACK_POOL = [
  { cp: '砚溪', a: '砚辞', b: '溪迟', world: '古籍修复室里的两位同事，隔着一张长桌修补残卷', line: '碎瓷都能拼回原样，两个人的话却越说越碎', tag: '考据' },
  { cp: '深蓝', a: '沈忱', b: '蓝屿', world: '深海科考队的队长与新人潜水员', line: '氧气只够撑四十分钟，他多留了十分钟给她', tag: '职场' },
  { cp: '棋盘', a: '祁言', b: '盘照', world: '棋院里对弈十年互无胜绩的宿敌', line: '认输那天，棋盘上第一次没有落子声', tag: '竞技' },
  { cp: '灯塔', a: '邓时', b: '塔弦', world: '孤岛灯塔的老守灯人与来采风的年轻画家', line: '画完最后一幅画，灯塔的灯却没再亮过', tag: '治愈' },
  { cp: '锅炉', a: '郭路', b: '炉屿', world: '老工厂车间里最后一班倒班的两个人', line: '锅炉停转那晚，他们第一次准时下班', tag: '年代' },
  { cp: '雨信', a: '于欣', b: '辛言', world: '异地通信十年却从未见面的笔友', line: '十年信件，最后一封只写了见面的车次', tag: '书信' },
  { cp: '钟摆', a: '钟白', b: '摆屿', world: '钟表店学徒与总来送坏表的邻居', line: '修好的表都很准，只有心跳一直乱', tag: '日常' },
  { cp: '海棠', a: '何唐', b: '棠意', world: '园艺社长与总来偷剪花枝的转学生', line: '她剪的每一枝，后来都种活了', tag: '校园' },
  { cp: '暗涌', a: '安永', b: '涌之', world: '缉毒警与卧底多年才知道彼此身份的搭档', line: '收网那天，两人才第一次喊对方本名', tag: '悬疑' },
  { cp: '青囊', a: '清扬', b: '囊野', world: '乡镇诊所里的老中医与刚分配来的西医', line: '一个把脉一个听诊，处方却越开越像', tag: '医疗' },
  { cp: '孤本', a: '顾本', b: '芬野', world: '旧书店老板与专门找孤本的委托人', line: '找了三年的那本书，最后夹在他自己写的信里', tag: '文艺' },
  { cp: '晚风', a: '万锋', b: '闻屿', world: '天台种花的租客与楼下总来收衣服的邻居', line: '风把晾着的衬衫吹到了对方阳台', tag: '甜宠' }
];
function tgGenRankFallback() {
  const circles = tgPlaza.circles;
  const mine = circles.slice(0, 6).map((c, i) => ({
    rank: i + 1,
    cp: c.name || (((c.pairA && c.pairA.name) || '?') + '×' + ((c.pairB && c.pairB.name) || '?')),
    a: (c.pairA && c.pairA.name) || '', b: (c.pairB && c.pairB.name) || '',
    world: (c.intro || '这一对的故事，正在被更多人看见').slice(0, 60),
    line: '本站太太们正在疯狂产粮，手速快的都在这条圈里',
    heat: tgRnd(60000, 98000), trend: 'up', delta: tgRnd(30, 180), tag: '本站'
  }));
  const pool = TG_RANK_FALLBACK_POOL.slice().sort(() => Math.random() - 0.5);
  const list = mine.slice();
  let pi = 0;
  while (list.length < 10 && pi < pool.length) {
    const p = pool[pi++];
    list.push({
      rank: list.length + 1, cp: p.cp, a: p.a, b: p.b, world: p.world, line: p.line,
      heat: tgRnd(20000, 82000 - list.length * 3000), trend: tgPick(['up', 'down', 'new', 'hold']),
      delta: tgRnd(0, 150), tag: p.tag
    });
  }
  list.forEach((x, i) => { x.rank = i + 1; });
  return { date: tgFmtDate(Date.now()), list: list.slice(0, 10), ts: Date.now(), isFallback: true };
}

async function tgGenRank() {
  const circles = tgPlaza.circles;
  const mine = circles.slice(0, 4).map(c =>
    `${(c.pairA && c.pairA.name) || '?'} × ${(c.pairB && c.pairB.name) || '?'}（圈名「${c.name}」${c.intro ? '，' + String(c.intro).slice(0, 40) : ''}）`);

  const user = [
    '【任务】生成一份中文同人社区当日的「CP 热度榜」。',
    mine.length
      ? '【必须收录的 CP（这些是本站用户自己建的圈，请安排在榜单的前六名之内，热度要够高，并写出为什么这几天突然爆了）】\n' + mine.map((m, i) => (i + 1) + '. ' + m).join('\n')
      : '【本站还没有用户建的圈，请全部由你原创】',
    '【榜单要求】',
    '· 一共 10 条，名次从 1 排到 10。',
    '· 每条要有：CP 名、两个人的名字、一句世界观（15 到 30 字）、一句「安利语」（20 到 40 字，要有钩子，不要剧透）、热度值（一个 4 到 7 位的整数，名次越高数值越大）、涨跌（up / down / new / hold 之一）、涨跌幅（整数百分比，0 到 400）、一个 3 到 5 字的类型标签。',
    '· 十条之间的题材、时代、关系类型要拉开：不要连着三条都是校园，不要都是双男主。',
    '· 每条的安利语句式都要不一样，不要全是「一个……的故事」。',
    '',
    '【必须严格遵循的 JSON 结构】',
    '{"date":"榜单日期，如 8月24日","list":[{"rank":1,"cp":"CP名","a":"左位名字","b":"右位名字","world":"一句世界观","line":"安利语","heat":123456,"trend":"up","delta":88,"tag":"类型标签"}]}',
    '',
    '现在直接输出 JSON。'
  ].filter(Boolean).join('\n');

  let j = null;
  try {
    j = await tgAskJSON(tgSysPrompt(), user, { max: 3600, rounds: 3, expectKeys: ['list', 'rank', 'items'] });
  } catch (e) { j = null; }
  if (j) {
    const list = (Array.isArray(j) ? j : (j.list || j.rank || j.items || j.data || j.chart || [])).map((x, i) => ({
      rank: tgNum(x.rank, i + 1),
      cp: String(x.cp || ((x.a || '') + '×' + (x.b || ''))).slice(0, 20),
      a: String(x.a || '').slice(0, 14), b: String(x.b || '').slice(0, 14),
      world: String(x.world || '').slice(0, 60),
      line: String(x.line || '').slice(0, 90),
      heat: tgNum(x.heat, 90000 - i * 6000),
      trend: ['up', 'down', 'new', 'hold'].indexOf(x.trend) >= 0 ? x.trend : 'hold',
      delta: tgNum(x.delta, tgRnd(0, 120)),
      tag: String(x.tag || '').slice(0, 8)
    })).filter(x => x.cp).slice(0, 10);
    // AI 给出的条数够（≥6条），哪怕没满10条，也用真实内容补足，好过整份换成兜底
    if (list.length >= 6) {
      while (list.length < 10) {
        const p = TG_RANK_FALLBACK_POOL[list.length % TG_RANK_FALLBACK_POOL.length];
        list.push({ rank: list.length + 1, cp: p.cp, a: p.a, b: p.b, world: p.world, line: p.line, heat: tgRnd(20000, 60000), trend: 'hold', delta: tgRnd(0, 80), tag: p.tag });
      }
      const rank = { date: String(j.date || tgFmtDate(Date.now())), list, ts: Date.now() };
      try { localStorage.setItem('tg_rank', JSON.stringify(rank)); } catch (e) { }
      return rank;
    }
  }
  // AI 没返回 / 解析失败 / 条数太少：一律用兜底榜单，界面上永远有完整结果，不出现报错或空白
  const rank = tgGenRankFallback();
  try { localStorage.setItem('tg_rank', JSON.stringify(rank)); } catch (e) { }
  return rank;
}

function tgRenderRank() {
  const box = document.getElementById('tgPlazaRank');
  if (!box) return;
  const r = tgPlaza.rank;
  if (!r) {
    box.innerHTML = `<div class="tg-rank tg-rise tg-d1">
      <div class="tg-rank-head">
        <div class="tg-rank-ttl"><b>今日 CP 热榜</b><i>DAILY CHART</i></div>
        <button class="tg-mini-btn" data-ico="refresh" onclick="tgRefreshRank()"></button>
      </div>
      <p class="tg-hint" style="margin:14px 0 0">榜单还没有生成。点右上角，让糖罐现排一份今天的十条。</p>
    </div>`;
    tgFillIcons(box); return;
  }
  const arrow = t => t === 'up' ? '<span class="tg-tr up" data-ico="up"></span>'
    : t === 'down' ? '<span class="tg-tr dn" data-ico="down"></span>'
      : t === 'new' ? '<span class="tg-tr nw">NEW</span>' : '<span class="tg-tr hd">—</span>';
  box.innerHTML = `<div class="tg-rank tg-rise tg-d1">
    <div class="tg-rank-head">
      <div class="tg-rank-ttl"><b>今日 CP 热榜</b><i>DAILY CHART · ${tgEsc(r.date)}</i></div>
      <button class="tg-mini-btn" data-ico="refresh" ${tgPlaza.busy ? 'disabled' : ''} onclick="tgRefreshRank()"></button>
    </div>
    <div class="tg-rank-list">
      ${r.list.map(x => `
        <div class="tg-rk ${x.rank <= 3 ? 'top' : ''}" onclick="tgRankOpen(${x.rank})">
          <div class="tg-rk-n">${String(x.rank).padStart(2, '0')}</div>
          <div class="tg-rk-main">
            <b>${tgEsc(x.cp)}${x.tag ? `<em>${tgEsc(x.tag)}</em>` : ''}</b>
            <p>${tgEsc(x.line || x.world)}</p>
          </div>
          <div class="tg-rk-side">
            <i>${tgKn(x.heat)}</i>
            ${arrow(x.trend)}
          </div>
        </div>`).join('')}
    </div>
  </div>`;
  tgFillIcons(box);
}
function tgRankOpen(n) {
  const r = tgPlaza.rank; if (!r) return;
  const x = r.list.find(i => i.rank === n); if (!x) return;
  const mine = tgPlaza.circles.find(c => (c.pairA && c.pairA.name) === x.a || c.name === x.cp);
  tgSheetOpen(`
    <div class="tg-rk-hero">
      <b>${String(n).padStart(2, '0')}</b>
      <div><h4 style="margin:0">${tgEsc(x.cp)}</h4><i>${tgEsc(x.a)} × ${tgEsc(x.b)}</i></div>
    </div>
    <p class="tg-sheet-sub" style="margin-top:14px">${tgEsc(x.world)}</p>
    <div class="tg-rule"><b>为什么在榜上</b><p>${tgEsc(x.line)}</p></div>
    <div class="tg-rule"><b>数据</b>
      <div class="tg-rule-list"><span>热度值</span><b>${tgKn(x.heat)}</b></div>
      <div class="tg-rule-list"><span>较昨日</span><b>${x.trend === 'new' ? '新上榜' : (x.trend === 'up' ? '+' : x.trend === 'down' ? '-' : '±') + x.delta + '%'}</b></div>
      <div class="tg-rule-list"><span>类型</span><b>${tgEsc(x.tag || '未分类')}</b></div>
    </div>
    <div style="height:14px"></div>
    ${mine ? `<button class="tg-btn tg-btn-dark" onclick="tgCloseSheet();tgOpenCircle('${mine.id}')">进入我的圈</button>`
      : `<button class="tg-btn tg-btn-dark" onclick="tgRankGen(${n})">围绕这一对生成三篇</button>`}`);
}
async function tgRankGen(n) {
  const r = tgPlaza.rank; const x = r && r.list.find(i => i.rank === n);
  tgCloseSheet();
  if (!x) return;
  await tgPlazaGenerate(3, { seed: `【指定 CP】${x.a} × ${x.b}｜${x.world}\n请严格围绕这一对来写，不要换人。`, cpA: x.a, cpB: x.b });
}
async function tgRefreshRank() {
  if (tgPlaza.busy) return;
  if (!tgHasApi()) { tgNoApi(); return; }
  tgPlaza.busy = true; tgPlazaBar();
  const box = document.getElementById('tgPlazaRank');
  if (box) box.innerHTML = `<div class="tg-gen"><div class="tg-gen-ring"><i></i><i></i><i></i></div><b>正在排榜</b><p>统计、去重、排序……</p></div>`;
  const r = await tgGenRank();
  tgPlaza.rank = r; // tgGenRank 现在永远返回一份完整榜单（AI 失败时自动换成兜底内容），界面上不会再出现空白或报错
  tgPlaza.busy = false;
  tgRenderRank(); tgPlazaBar();
}

/* ================================================================
   二、正主动态
================================================================ */
async function tgGenOwnerFeed(circle, deep, n) {
  const out = [];
  const who = [circle.pairA, circle.pairB].filter(Boolean);
  const gs = tgPickGenres(n, null, TG_OWNER_GENRES);
  for (let i = 0; i < n; i++) {
    const w = who[i % who.length] || who[0];
    const other = who.find(x => x !== w) || w;
    try {
      const p = await tgGenPost({
        circle, deep, genre: gs[i], scope: 'owner',
        ownerName: w && w.name,
        voice: `由正主「${w && w.name}」本人发布`,
        extra: [
          `【互动要求】这条内容发出来之后，另一位正主「${other && other.name}」一定要在评论 / 回复 / 楼层里出现，说的话必须极其像本人：可能只有四个字，可能阴阳怪气，可能答非所问，但绝不能是彩虹屁。`,
          '【重要】不要让两个人在公开场合把关系说破。围观群众可以起哄，正主本人不能承认。',
          '【重要】这不是同人创作，这是当事人自己发的东西。不要出现「本文」「这篇」「同人」之类的词。'
        ].join('\n'),
        maxTokens: 6000
      });
      p.imgs = TGCard.render(p);
      if (!p.imgs.length) continue;
      p.scope = 'owner'; p.ownerName = w && w.name;
      tgPostReg.put(p);
      await tgPut('posts', { id: p.id, createdAt: p.createdAt, kind: 'owner', circleId: circle.id, post: Object.assign({}, p, { imgs: null }) });
      out.push(p);
    } catch (e) { }
  }
  return out;
}

function tgRenderOwnerRail() {
  const box = document.getElementById('tgOwnerRail');
  if (!box) return;
  const list = tgPlaza.owner;
  if (!tgPlaza.circles.length) { box.innerHTML = ''; return; }
  if (!list.length) {
    box.innerHTML = `<div class="tg-sec-title"><b>正主动态</b><i>FROM THEM</i>
      <button class="tg-tiny-btn" ${tgPlaza.busy ? 'disabled' : ''} onclick="tgOwnerGen()">让他们发点什么</button></div>
      <p class="tg-hint">这里只放正主本人发的东西——朋友圈、微博、日记、随手记的便签。评论区里另一位一定会出现。</p>`;
    return;
  }
  box.innerHTML = `<div class="tg-sec-title"><b>正主动态</b><i>FROM THEM</i>
      <button class="tg-tiny-btn" ${tgPlaza.busy ? 'disabled' : ''} onclick="tgOwnerGen()">再来一条</button></div>
    <div class="tg-rail tg-scrollx">
      ${list.map(p => `
        <div class="tg-owncard" onclick="tgOpenPost('${p.id}')">
          <div class="tg-owncard-top">
            <div class="tg-owncard-av"><span>${tgEsc((p.ownerName || p.cpA || '·')[0])}</span></div>
            <div><b>${tgEsc(p.ownerName || p.cpA)}</b><i>${tgEsc(tgGenreName(p.genre))}</i></div>
          </div>
          <div class="tg-owncard-img"><img src="${p.imgs[0]}" alt=""></div>
          <p>${tgEsc(String(p.caption || p.title).slice(0, 46))}</p>
          <div class="tg-owncard-foot"><i>${tgEsc(p.circleName || '')}</i><em>${tgKn(p.stats.like)}</em></div>
        </div>`).join('')}
    </div>`;
}

async function tgOwnerGen() {
  if (tgPlaza.busy) return;
  if (!tgHasApi()) { tgNoApi(); return; }
  const circles = tgPlaza.circles;
  if (!circles.length) { tgToast('先去笔坊建一个圈'); return; }
  const c = tgPlaza.circleId !== 'all' && tgPlaza.circleId !== 'random'
    ? (circles.find(x => x.id === tgPlaza.circleId) || circles[0])
    : circles[Math.floor(Math.random() * circles.length)];
  tgPlaza.busy = true; tgPlazaBar();
  const box = document.getElementById('tgOwnerRail');
  if (box) box.insertAdjacentHTML('afterbegin', `<div class="tg-gen" id="tgOwnGen"><div class="tg-gen-ring"><i></i><i></i><i></i></div><b>${tgEsc(c.name)}</b><p>正主正在编辑这条内容……</p></div>`);
  const deep = await tgLoadCharsDeep();
  const got = await tgGenOwnerFeed(c, deep, 1);
  tgPlaza.owner = got.concat(tgPlaza.owner).slice(0, 12);
  tgPlaza.busy = false;
  tgRenderOwnerRail(); tgPlazaBar();
  if (got.length) { tgToast('正主发了一条'); if (typeof tgAddSweet === 'function') tgAddSweet(8); }
  else tgToast('这次没发出来，再试一次');
}

/* ================================================================
   三、信息流生成
================================================================ */
function tgNoApi() {
  tgSheetOpen(`<h4>还没有接上模型</h4>
    <p class="tg-sheet-sub">广场的每一条内容都是现生成的，需要先在「设置 · API」里填好接口与模型。任何 OpenAI 协议的服务都可以。</p>
    <div style="height:14px"></div><button class="tg-btn tg-btn-dark" onclick="tgCloseSheet()">知道了</button>`);
}

/**
 * n     数量
 * opt   { seed, cpA, cpB, genres }
 */
async function tgPlazaGenerate(n, opt) {
  opt = opt || {};
  if (tgPlaza.busy) return;
  if (!tgHasApi()) { tgNoApi(); return; }
  const circles = tgPlaza.circles;
  if (!circles.length && tgPlaza.circleId !== 'random' && !opt.seed) {
    tgSheetOpen(`<h4>先有圈，才有糖</h4>
      <p class="tg-sheet-sub">你还没有建立任何 CP 圈。可以先去笔坊建一个，广场就会围绕你的圈生成一切内容；也可以让糖罐随机磕一口——满意的话，一键把它变成你的圈。</p>
      <div style="height:16px"></div>
      <div class="tg-btn-row">
        <button class="tg-btn tg-btn-light" onclick="tgCloseSheet();tgTab(3)">去笔坊建圈</button>
        <button class="tg-btn tg-btn-dark" onclick="tgCloseSheet();tgPlazaRandom()">随机磕一口</button>
      </div>`);
    return;
  }

  const count = n || tgPlaza.batch;
  const genres = opt.genres || tgPickGenres(count, tgPlaza.genre);

  tgPlaza.busy = true; tgPlazaBar();
  const box = document.getElementById('tgFeed');
  const load = document.createElement('div');
  load.className = 'tg-gen';
  load.innerHTML = `<div class="tg-gen-ring"><i></i><i></i><i></i></div>
    <b>正在生成</b><p id="tgGenTip">铺纸、落笔、排版成图……</p>
    <div class="tg-gen-track" id="tgGenTrack"></div>`;
  box.insertBefore(load, box.firstChild);

  const deep = await tgLoadCharsDeep();
  let ok = 0, err = null;
  for (let i = 0; i < count; i++) {
    let circle = null;
    if (opt.seed) circle = null;
    else if (tgPlaza.circleId === 'random') circle = null;
    else if (tgPlaza.circleId === 'all') circle = circles.length ? circles[Math.floor(Math.random() * circles.length)] : null;
    else circle = circles.find(c => c.id === tgPlaza.circleId) || null;

    const g = genres[i];
    const tip = document.getElementById('tgGenTip');
    if (tip) tip.textContent = `第 ${i + 1} / ${count} 篇 · ${tgGenreName(g)} · ${circle ? circle.name : (opt.cpA ? opt.cpA + '×' + opt.cpB : '随机 CP')}`;
    const track = document.getElementById('tgGenTrack');
    if (track) track.innerHTML = genres.map((k, j) => `<i class="${j < i ? 'done' : (j === i ? 'now' : '')}">${tgGenreName(k)}</i>`).join('');

    try {
      const post = await tgGenPost({ circle, genre: g, deep, extra: opt.seed || '' });
      if (opt.cpA) { post.cpA = opt.cpA; post.cpB = opt.cpB; }
      post.imgs = TGCard.render(post);
      if (!post.imgs.length) throw new Error('RENDER');
      tgPostReg.put(post);
      tgPlaza.posts.unshift(post);
      await tgPut('posts', { id: post.id, createdAt: post.createdAt, kind: 'plaza', circleId: post.circleId, post: Object.assign({}, post, { imgs: null }) });
      ok++;
      tgRenderFeed(true);
    } catch (e) { err = e; console.warn('[糖罐] 生成失败：', e); }
  }
  tgPlaza.busy = false;
  tgRenderFeed(); tgPlazaBar();

  if (ok) { tgToast(`新生成 ${ok} 条 · ${genres.slice(0, ok).map(tgGenreName).join(' / ')}`); if (typeof tgAddSweet === 'function') tgAddSweet(6 * ok); }
  else {
    const msg = err && /NO_API/.test(err.message) ? '接口没有配置好'
      : err && /API_/.test(err.message) ? '模型接口返回了错误：' + err.message.replace('API_', '')
        : '模型这次没有给出可用内容';
    tgSheetOpen(`<h4>没能生成出来</h4><p class="tg-sheet-sub">${tgEsc(msg)}。糖罐已经自动重试过三轮 JSON、又降级到纯文本协议再试了一次。可以换一个模型，或把上下文长度调大一些。</p>
      <div style="height:14px"></div><button class="tg-btn tg-btn-dark" onclick="tgCloseSheet()">好</button>`);
  }
}
function tgPlazaRandom() { tgPlaza.circleId = 'random'; tgPlazaBar(); tgPlazaGenerate(3); }

/* 生成设置面板 */
function tgPlazaGenSheet() {
  tgSheetOpen(`<h4>这一批要怎么生成</h4>
    <p class="tg-sheet-sub">选「混合」时，同一批里的每一篇都会是不同体裁，绝不重样。</p>
    <div class="tg-field"><div class="tg-label">数量 <small>count</small></div>
      <div class="tg-chips" id="tgBatchChips">
        ${[1, 3, 5, 8].map(n => `<button class="tg-chip ${tgPlaza.batch === n ? 'on' : ''}" onclick="tgSetBatch(${n},this)">${n} 篇</button>`).join('')}
      </div></div>
    <div class="tg-field"><div class="tg-label">体裁 <small>genre</small></div>
      <div class="tg-chips">
        <button class="tg-chip ${tgPlaza.genre === 'all' ? 'on' : ''}" onclick="tgSetGenre('all');tgPlazaGenSheet()">混合（每篇都不同）</button>
        ${TG_GENRES.map(g => `<button class="tg-chip ${tgPlaza.genre === g.k ? 'on' : ''}" onclick="tgSetGenre('${g.k}');tgPlazaGenSheet()">${g.n}</button>`).join('')}
      </div></div>
    <div style="height:18px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgCloseSheet();tgPlazaGenerate()">开始生成</button>`);
}
function tgSetBatch(n, btn) {
  tgPlaza.batch = n;
  if (btn) { btn.parentNode.querySelectorAll('.tg-chip').forEach(b => b.classList.remove('on')); btn.classList.add('on'); }
}

/* ================================================================
   四、工具条与信息流渲染
================================================================ */
function tgPlazaBar() {
  const bar = document.getElementById('tgPlazaBar');
  if (!bar) return;
  const cs = tgPlaza.circles;
  const chips = [
    `<button class="tg-chip ${tgPlaza.circleId === 'all' ? 'on' : ''}" onclick="tgSetCircle('all')">全部</button>`,
    `<button class="tg-chip ${tgPlaza.circleId === 'random' ? 'on' : ''}" onclick="tgSetCircle('random')">随机 CP</button>`
  ].concat(cs.map(c => `<button class="tg-chip ${tgPlaza.circleId === c.id ? 'on' : ''}" onclick="tgSetCircle('${c.id}')">${tgEsc(c.name)}</button>`));
  const gs = [`<button class="tg-gchip ${tgPlaza.genre === 'all' ? 'on' : ''}" onclick="tgSetGenre('all')">混合</button>`]
    .concat(TG_GENRES.map(g => `<button class="tg-gchip ${tgPlaza.genre === g.k ? 'on' : ''}" onclick="tgSetGenre('${g.k}')">${g.n}</button>`));
  bar.innerHTML = `
    <div class="tg-chips tg-scrollx">${chips.join('')}</div>
    <div class="tg-chips tg-scrollx" style="margin-top:8px">${gs.join('')}</div>
    <div class="tg-plaza-acts">
      <button class="tg-btn tg-btn-dark tg-btn-sm" ${tgPlaza.busy ? 'disabled' : ''} onclick="tgPlazaGenerate()">${tgPlaza.busy ? '生成中…' : `生成 ${tgPlaza.batch} 篇`}</button>
      <button class="tg-mini-btn" data-ico="shuffle" ${tgPlaza.busy ? 'disabled' : ''} onclick="tgPlazaGenSheet()"></button>
      <button class="tg-mini-btn" data-ico="grid" onclick="tgPlazaHelp()"></button>
    </div>`;
  tgFillIcons(bar);
}
function tgSetCircle(id) { tgPlaza.circleId = id; tgPlazaBar(); tgRenderFeed(); }
function tgSetGenre(k) { tgPlaza.genre = k; tgPlazaBar(); tgRenderFeed(); }

function tgPlazaHelp() {
  tgSheetOpen(`<h4>广场是怎么运作的</h4>
    <p class="tg-sheet-sub">每一条帖子都是模型现写的，正文会被排版成整页长图，最多九张，一张也不会被裁断。热榜、正主动态、信息流三层内容互相独立，可以分别刷新。</p>
    ${TG_GENRES.map(g => `<div class="tg-rule"><b>${g.n} <small style="font-family:var(--tg-mono);font-size:9px;letter-spacing:.2em;color:var(--tg-mist-2)">${g.en}</small></b><p>${g.desc}</p></div>`).join('')}
    <div class="tg-rule"><b>有圈子和没圈子的区别</b><p>没有圈子时，广场是一座公共糖厂：每一条都是模型现编的原创 CP，看中了可以一键收进笔坊。建了圈之后，广场会把笔坊里存下的全部资料——两位的完整档案、文风十一维、圈子简介与标签——一并交给模型并强制不得 OOC，同时解锁「正主动态」：由正主本人发布，另一位一定会在评论区出现。</p></div>
    <div class="tg-rule"><b>为什么每次体裁都不一样</b><p>糖罐用的是发牌式抽签：一批里的每一篇都从牌堆里抽一张不重复的牌，牌抽完才会重新洗牌。所以连着生成八篇，就是八种不同的体裁。</p></div>`);
}

function tgImgGrid(post) {
  const n = post.imgs.length;
  const cls = n === 1 ? 'g1' : n === 2 ? 'g2' : n === 4 ? 'g4' : 'g3';
  return `<div class="tg-imgs ${cls}">
    ${post.imgs.map((src, i) => `<div class="tg-img" onclick="event.stopPropagation();tgViewer('${post.id}',${i})"><img src="${src}" alt=""><span class="tg-img-n">${i + 1}</span></div>`).join('')}
    <div class="tg-img-count">${n} 张</div>
  </div>`;
}

/* 帖子卡（广场 / 圈子共用） */
function tgPostCardHTML(p, i, opt) {
  opt = opt || {};
  const gm = tgGenreOf(p.genre);
  const cmt = (p.comments || []).reduce((a, c) => a + 1 + (c.replies || []).length, 0);
  return `<article class="tg-post tg-rise tg-d${(i % 5) + 1}" onclick="tgOpenPost('${p.id}')">
    ${p.pinned ? '<div class="tg-pinned" data-ico="pin"><span>置顶</span></div>' : ''}
    <div class="tg-post-top">
      <div class="tg-post-av ${p.scope === 'owner' ? 'own' : ''}"><span>${tgEsc((p.author.name || '·')[0])}</span></div>
      <div class="tg-post-who">
        <b>${tgEsc(p.author.name)}${p.scope === 'owner' ? '<em class="tg-badge-own">正主</em>' : ''}</b>
        <i>@${tgEsc(p.author.handle)} · ${tgEsc(p.author.identity)}</i>
      </div>
      <div class="tg-post-genre">${gm.n}</div>
    </div>
    <div class="tg-post-cp">${tgEsc(p.cpA)}<em>×</em>${tgEsc(p.cpB)}${p.circleName ? `<span>${tgEsc(p.circleName)}</span>` : '<span class="rnd">随机生成</span>'}</div>
    <h3 class="tg-post-title">${tgEsc(p.title)}</h3>
    <p class="tg-post-cap">${tgEsc(p.caption)}</p>
    ${tgImgGrid(p)}
    <div class="tg-post-tags">${p.tags.map(t => `<i>#${tgEsc(t)}</i>`).join('')}</div>
    <div class="tg-post-bar">
      <button onclick="event.stopPropagation();tgPostAct('${p.id}','like',this)"><span data-ico="heart"></span>${tgKn(p.stats.like)}</button>
      <button onclick="event.stopPropagation();tgPostAct('${p.id}','collect',this)"><span data-ico="star"></span>${tgKn(p.stats.collect)}</button>
      <button onclick="event.stopPropagation();tgOpenPost('${p.id}')"><span data-ico="chat"></span>${tgKn(cmt || p.stats.comment)}</button>
      <button class="v"><span data-ico="eye"></span>${tgKn(p.view || 0)}</button>
      <button onclick="event.stopPropagation();tgPostMore('${p.id}')"><span data-ico="more"></span></button>
    </div>
    ${(!p.circleId && !opt.inCircle) ? `<button class="tg-post-make" onclick="event.stopPropagation();tgMakeCircle('${p.id}')">把「${tgEsc(p.cpA)} × ${tgEsc(p.cpB)}」收进笔坊，建成我的圈</button>` : ''}
  </article>`;
}

function tgRenderFeed(keepLoader) {
  const box = document.getElementById('tgFeed');
  if (!box) return;
  const loader = keepLoader ? box.querySelector('.tg-gen') : null;
  let list = tgPlaza.posts;
  if (tgPlaza.circleId !== 'all' && tgPlaza.circleId !== 'random') list = list.filter(p => p.circleId === tgPlaza.circleId);
  if (tgPlaza.circleId === 'random') list = list.filter(p => !p.circleId);
  if (tgPlaza.genre !== 'all') list = list.filter(p => p.genre === tgPlaza.genre);

  if (!list.length && !loader) {
    box.innerHTML = `<div class="tg-empty tg-rise tg-d2">
      <div class="tg-empty-mark" data-ico="plaza"></div>
      <p>${tgPlaza.circles.length ? '这个筛选下还没有内容。<br>点上面的「生成」，让糖罐现写一批。' : '广场还是空的。<br>先去笔坊建一个 CP 圈，或者让糖罐随机磕一口。'}</p>
      <div style="height:18px"></div>
      <div class="tg-btn-row">
        ${tgPlaza.circles.length ? '' : '<button class="tg-btn tg-btn-light" onclick="tgTab(3)">去笔坊</button>'}
        <button class="tg-btn tg-btn-dark" onclick="${tgPlaza.circles.length ? 'tgPlazaGenerate()' : 'tgPlazaRandom()'}">${tgPlaza.circles.length ? '生成新内容' : '随机磕一口'}</button>
      </div></div>`;
    tgFillIcons(box);
    return;
  }
  box.innerHTML = `<div class="tg-sec-title"><b>信息流</b><i>FEED · ${list.length}</i></div>`
    + list.map((p, i) => tgPostCardHTML(p, i)).join('');
  if (loader) box.insertBefore(loader, box.firstChild);
  tgFillIcons(box);
}

function tgPostAct(id, kind, btn) {
  const p = tgPostReg.get(id); if (!p) return;
  if (btn.classList.contains('on')) { btn.classList.remove('on'); p.stats[kind]--; }
  else { btn.classList.add('on'); p.stats[kind]++; if (typeof tgAddSweet === 'function') tgAddSweet(kind === 'like' ? 3 : 6); }
  btn.innerHTML = `<span data-ico="${kind === 'like' ? 'heart' : 'star'}"></span>${tgKn(p.stats[kind])}`;
  tgFillIcons(btn);
  tgSavePost(p);
}
async function tgSavePost(p) {
  if (!p) return;
  await tgPut('posts', { id: p.id, createdAt: p.createdAt, kind: p.scope === 'owner' ? 'owner' : (p.circleTab || 'plaza'), circleId: p.circleId, post: Object.assign({}, p, { imgs: null }) });
}

function tgPostMore(id) {
  const p = tgPostReg.get(id); if (!p) return;
  tgSheetOpen(`<h4>${tgEsc(p.title)}</h4>
    <p class="tg-sheet-sub">${tgEsc(p.cpA)} × ${tgEsc(p.cpB)} · ${tgGenreName(p.genre)} · 共 ${p.imgs.length} 张</p>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgCloseSheet();tgOpenPost('${p.id}')">打开详情页</button>
    <div style="height:10px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgSaveAll('${p.id}')">全部存入相册</button>
    <div style="height:10px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgViewer('${p.id}',0);tgCloseSheet()">逐张查看</button>
    <div style="height:10px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgDelPost('${p.id}')">移除这条</button>`);
}
async function tgDelPost(id) {
  tgPlaza.posts = tgPlaza.posts.filter(p => p.id !== id);
  tgPlaza.owner = tgPlaza.owner.filter(p => p.id !== id);
  delete tgPostReg.map[id];
  await tgDel('posts', id);
  tgCloseSheet(); tgRenderFeed(); tgRenderOwnerRail();
  if (typeof tgCircleRepaint === 'function') tgCircleRepaint();
  tgToast('已移除');
}

/* 随机 CP → 一键建圈 */
function tgMakeCircle(id) {
  const p = tgPostReg.get(id); if (!p) return;
  tgSheetOpen(`<h4>建成我的圈</h4>
    <p class="tg-sheet-sub">这一对会被写进笔坊存档，之后广场与圈子里围绕它生成的一切内容都会读取这份资料。</p>
    <div class="tg-field"><div class="tg-label">圈名 <small>name</small></div>
      <input class="tg-input" id="tgMkName" value="${tgEsc(p.cpA + '×' + p.cpB)}"></div>
    <div class="tg-field"><div class="tg-label">简介 <small>intro</small></div>
      <textarea class="tg-textarea" id="tgMkIntro">${tgEsc(p.cpWorld || p.caption)}</textarea></div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgMakeCircleGo('${p.id}')">建立圈子</button>`);
}
async function tgMakeCircleGo(id) {
  const p = tgPostReg.get(id); if (!p) return;
  const name = (document.getElementById('tgMkName').value || '').trim() || (p.cpA + '×' + p.cpB);
  const intro = (document.getElementById('tgMkIntro').value || '').trim();
  const obj = {
    type: 'circle', name,
    pairA: { uid: 'x' + Math.random().toString(36).slice(2, 7), kind: 'char', name: p.cpA, tags: p.tags.slice(0, 3), role: '', gender: '', age: '', species: '' },
    pairB: { uid: 'x' + Math.random().toString(36).slice(2, 7), kind: 'char', name: p.cpB, tags: p.tags.slice(0, 3), role: '', gender: '', age: '', species: '' },
    source: 'plaza', aiData: { hook: p.cpWorld || p.caption },
    style: { sel: {}, custom: {} }, intro, tags: p.tags.slice(0, 4), access: '公开',
    avatar: null, bg: null, exp: 0
  };
  const saved = await tgPut('circles', obj);
  p.circleId = saved.id; p.circleName = saved.name;
  await tgSavePost(p);
  if (typeof tgAddSweet === 'function') tgAddSweet(120);
  tgCloseSheet();
  await tgPlazaLoad(true);
  tgToast('圈子已建立，甜蜜值 +120');
  if (typeof tgRenderCircleList === 'function') tgRenderCircleList();
  if (typeof tgRefreshStats === 'function') tgRefreshStats();
}

/* ================================================================
   五、长图查看器 + 存入相册
================================================================ */
let tgVw = { post: null, i: 0 };
function tgViewer(id, i) {
  const p = tgPostReg.get(id); if (!p || !p.imgs || !p.imgs.length) return;
  tgVw = { post: p, i: i || 0 };
  document.getElementById('tgViewerMask').classList.add('on');
  tgViewerPaint();
}
function tgViewerPaint() {
  const p = tgVw.post; if (!p) return;
  const n = p.imgs.length;
  document.getElementById('tgVwImg').src = p.imgs[tgVw.i];
  document.getElementById('tgVwIdx').textContent = `${tgVw.i + 1} / ${n}`;
  document.getElementById('tgVwTitle').textContent = p.title;
  document.getElementById('tgVwDots').innerHTML = p.imgs.map((_, i) =>
    `<i class="${i === tgVw.i ? 'on' : ''}" onclick="tgVwGo(${i})"></i>`).join('');
}
function tgVwGo(i) { const n = tgVw.post.imgs.length; tgVw.i = (i + n) % n; tgViewerPaint(); }
function tgVwNext(d) { tgVwGo(tgVw.i + d); }
function tgViewerClose(e) { if (e && e.target.closest('.tg-vw-inner')) return; document.getElementById('tgViewerMask').classList.remove('on'); }

function tgAlbumDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('luna-gallery-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('albums')) db.createObjectStore('albums', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function tgSavePhotos(items) {
  const db = await tgAlbumDB();
  await new Promise((res, rej) => {
    const tx = db.transaction('photos', 'readwrite');
    const st = tx.objectStore('photos');
    items.forEach((it, i) => st.put({
      id: 'tg_' + Date.now().toString(36) + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
      src: it.src, name: it.name, addedAt: Date.now() + i
    }));
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  localStorage.setItem('luna_gallery_update', String(Date.now()));
}
async function tgSaveOne() {
  const p = tgVw.post; if (!p) return;
  try { await tgSavePhotos([{ src: p.imgs[tgVw.i], name: `${p.title}_${tgVw.i + 1}` }]); tgToast('已存入相册'); }
  catch (e) { tgToast('存入相册失败'); }
}
async function tgSaveAll(id) {
  const p = id ? tgPostReg.get(id) : tgVw.post;
  if (!p) return;
  try {
    await tgSavePhotos(p.imgs.map((src, i) => ({ src, name: `${p.title}_${i + 1}` })));
    tgCloseSheet(); tgToast(`${p.imgs.length} 张已存入相册`);
  } catch (e) { tgToast('存入相册失败'); }
}

/* ================================================================
   六、载入与入场
================================================================ */
async function tgPlazaLoad(force) {
  tgPlaza.circles = await tgAll('circles');
  if (!tgPlaza.loaded || force) {
    const rows = await tgAll('posts');
    const plaza = [], owner = [];
    rows.forEach(r => {
      const p = r.post; if (!p) return;
      if (tgPostReg.get(p.id)) {
        const ex = tgPostReg.get(p.id);
        if (r.kind === 'owner') { if (!owner.some(x => x.id === p.id)) owner.push(ex); }
        else if (!r.kind || r.kind === 'plaza') plaza.push(ex);
        return;
      }
      p.imgs = TGCard.render(p);
      if (!p.imgs.length) return;
      p.comments = p.comments || [];
      tgPostReg.put(p);
      if (r.kind === 'owner') owner.push(p);
      else if (!r.kind || r.kind === 'plaza') plaza.push(p);
    });
    tgPlaza.posts = plaza;
    tgPlaza.owner = owner.slice(0, 12);
    try {
      const r = JSON.parse(localStorage.getItem('tg_rank') || 'null');
      if (r && r.list && r.list.length) tgPlaza.rank = r;
    } catch (e) { }
    tgPlaza.loaded = true;
  }
  tgPlazaBar();
  tgRenderRank();
  tgRenderOwnerRail();
  tgRenderFeed();
}

(function () {
  const prev = window.tgOnEnter;
  window.tgOnEnter = function (id) {
    if (typeof prev === 'function') { try { prev(id); } catch (e) { } }
    if (id === 'scr-plaza') tgPlazaLoad();
    if (typeof tgOnEnterDM === 'function') tgOnEnterDM(id);
    if (typeof tgOnEnterCircle === 'function') tgOnEnterCircle(id);
    if (typeof tgOnEnterPost === 'function') tgOnEnterPost(id);
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('tgVwStage');
  if (!box) return;
  let sx = 0, sy = 0;
  box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  box.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) tgVwNext(dx < 0 ? 1 : -1);
  });
});