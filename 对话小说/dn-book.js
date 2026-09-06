/* ==========================================================
   dn-book.js — 作品详情 / 热度与书评 / 目录 / 章节正文 / 视角选择
   ========================================================== */

function charById(b, id) { return (b.chars || []).find(c => c.id === id) || null; }
function fmtNum(n) { return n >= 10000 ? (n / 10000).toFixed(1) + 'w' : String(n); }

/* ================= 作品详情 ================= */
async function openDetail(id) {
  const b = await DNStore.get(id);
  if (!b) return dnToast('作品不存在');
  DN.current = b;

  document.getElementById('detTitle').textContent = b.title;
  document.getElementById('detStyle').textContent = b.style ? (b.style.name + ' · ' + (b.style.desc || '').slice(0, 40)) : '—';
  document.getElementById('detIntro').textContent = b.intro || '—';
  const cover = document.getElementById('detCover');
  cover.style.backgroundImage = b.cover ? `url('${b.cover}')` : '';
  document.getElementById('detHeroBg').style.backgroundImage = b.cover ? `url('${b.cover}')` : '';

  document.getElementById('detTags').innerHTML = [
    b.chapterCount + ' 章',
    b.cpCount + ' 对 CP',
    (b.chars || []).length + ' 位重要角色',
    b.wordMin + '–' + b.wordMax + ' 字/轮'
  ].map(t => `<span>${t}</span>`).join('');

  renderDetStats(b);
  renderDetChars(b);
  renderDetReviews(b);

  const shelfBtn = document.getElementById('detShelfAct');
  shelfBtn.classList.toggle('on', !!b.onShelf);
  shelfBtn.querySelector('span').textContent = b.onShelf ? '已在书架' : '收入书架';
  shelfBtn.onclick = async () => {
    b.onShelf = !b.onShelf;
    await DNStore.put(b); await dnReload();
    shelfBtn.classList.toggle('on', b.onShelf);
    shelfBtn.querySelector('span').textContent = b.onShelf ? '已在书架' : '收入书架';
    dnToast(b.onShelf ? '已收入书架' : '已移出书架');
    renderShelf();
  };

  const relBox = document.getElementById('detRelSvg');
  if (b.relation && b.relation.nodes) relRender(relBox, b.relation, {});
  else relBox.innerHTML = `<text x="300" y="200" text-anchor="middle" fill="#a9a9b2" font-size="12">未生成关系网</text>`;

  document.getElementById('catSub').textContent = b.title + ' · 共 ' + b.chapterCount + ' 章';
  renderCatalog(b);
  dnOpenPage('page-detail');
}

function renderDetStats(b) {
  const s = b.stats || { reads: 0, likes: 0, favs: 0, comments: 0 };
  document.getElementById('detStats').innerHTML = `
    <div class="dstat"><b>${fmtNum(s.reads)}</b><span>在线阅读</span></div>
    <div class="dstat"><b>${fmtNum(s.likes)}</b><span>点赞</span></div>
    <div class="dstat"><b>${fmtNum(s.favs)}</b><span>收藏</span></div>
    <div class="dstat"><b>${fmtNum(s.comments)}</b><span>评论</span></div>`;
}
function renderDetChars(b) {
  const box = document.getElementById('detChars');
  box.innerHTML = (b.chars || []).map(c => `
    <div class="dch" data-cid="${c.id}">
      <i style="${c.avatar ? `background-image:url('${c.avatar}')` : ''}"></i>
      <b>${dnEsc(c.name)}</b><em>${dnEsc(c.solo ? '独立角色' : c.group)}</em>
    </div>`).join('') || '<div style="font-size:11px;color:#9a9aa4">暂无</div>';
  box.querySelectorAll('.dch').forEach(el => { el.onclick = () => openCharModal(el.dataset.cid); });
}

/* ---------- 角色档案弹窗 ---------- */
function openCharModal(cid) {
  const b = DN.current;
  const c = charById(b, cid);
  if (!c) return;
  const av = document.getElementById('chmAv');
  av.style.backgroundImage = c.avatar ? `url('${c.avatar}')` : '';
  document.getElementById('chmName').textContent = c.name;
  document.getElementById('chmRole').textContent = (c.solo ? '独立重要角色' : c.group) + (c.identity ? ' · ' + c.identity : '');
  const tags = [];
  if (c.gender) tags.push({ t: c.gender, g: true });
  if (c.age) tags.push({ t: c.age, g: true });
  tags.push({ t: c.solo ? '无固定感情线' : c.group, g: false });
  if (c.source === 'user') tags.push({ t: '用户设定', g: false });
  document.getElementById('chmTags').innerHTML = tags.map(x => `<span class="${x.g ? 'gh' : ''}">${dnEsc(x.t)}</span>`).join('');
  document.getElementById('chmBody').textContent = c.profile || '暂无档案';

  const rel = (b.relation && b.relation.links || []).filter(l => l.source === cid || l.target === cid);
  document.getElementById('chmRel').innerHTML = rel.length ? rel.map(l => {
    const other = charById(b, l.source === cid ? l.target : l.source);
    return `<div class="chm-rel-i"><span class="rc-dot"></span>${dnEsc(other ? other.name : '？')}<em>${dnEsc(l.label || (l.type === 'cp' ? 'CP' : '关系'))}</em></div>`;
  }).join('') : '';
  document.getElementById('chModal').classList.add('show');
}
function renderDetReviews(b) {
  const box = document.getElementById('detReviews');
  const list = (b.reviews || []).slice().sort((x, y) => y.hot - x.hot);
  if (!list.length) {
    box.innerHTML = '<div style="font-size:11.5px;color:#9a9aa4;letter-spacing:.08em;padding:6px 2px">还没有书评，点击上方「生成热度与书评」</div>';
    return;
  }
  const top = list[0].hot || 1;
  box.innerHTML = list.map((r, i) => `
    <div class="drv" data-i="${i}" style="animation-delay:${i * 60}ms">
      <div class="drv-rank"></div>
      <div class="drv-h">
        <div class="drv-av">${dnEsc((r.user || '读').slice(0, 1))}</div>
        <div>
          <div class="drv-u">${dnEsc(r.user)}</div>
          <div class="drv-no">TOP ${String(i + 1).padStart(2, '0')}</div>
        </div>
        <div class="drv-hot"><i style="--hw:${Math.round((r.hot / top) * 100)}%"></i>${fmtNum(r.hot)}</div>
      </div>
      <div class="drv-t">${dnEsc(r.title)}</div>
      <div class="drv-b">${dnEsc(r.body)}</div>
      <div class="drv-f">
        <span>${(r.comments || []).length} 条回应</span>
        <span>${r.body.length} 字</span>
        <div class="drv-more">展开全文 ›</div>
      </div>
    </div>`).join('');
  box.querySelectorAll('.drv').forEach(el => { el.onclick = () => openReview(list[+el.dataset.i]); });
}

/* ---------- 生成热度与书评 ---------- */
async function genStatsAndReviews(more) {
  const b = DN.current;
  if (!b) return;
  dnLoad(true, more ? '撰写书评' : '统计与书评');
  try {
    const data = await DNAI.json(
      '你是小说平台的社区内容生成器。书评要像真实读者写的：有观点、有偏爱、有具体细节，语气各异（激动的、克制的、挑刺又真香的），禁止千篇一律的夸奖模板。用户名要像社区昵称，不要用现实全名。',
      `作品：《${b.title}》\n简介：${(b.intro || '').slice(0, 400)}\n文风：${b.style ? b.style.name + ' / ' + b.style.desc : '未设定'}\n主要角色：${(b.chars || []).map(c => c.name).join('、')}\n\n请生成 ${more ? 3 : 4} 条「最热书评」，每条 body 120–200 字，并给出这本书的社区数据。\n随机种子：${Math.random().toString(36).slice(2)}\n\n返回 JSON：{"stats":{"reads":数字,"likes":数字,"favs":数字,"comments":数字},"reviews":[{"user":"","title":"书评标题12字内","body":"","hot":数字}]}`,
      { maxTokens: 4000, temperature: 1 });

    if (data.stats && !more) b.stats = {
      reads: +data.stats.reads || 12000, likes: +data.stats.likes || 3400,
      favs: +data.stats.favs || 1800, comments: +data.stats.comments || 620
    };
    const add = (data.reviews || []).map(r => ({
      id: 'r' + Math.random().toString(36).slice(2, 8),
      user: r.user || '匿名读者', title: r.title || '读后', body: r.body || '',
      hot: +r.hot || Math.floor(Math.random() * 900 + 100),
      comments: []
    }));
    b.reviews = (b.reviews || []).concat(add);
    if (b.stats) b.stats.comments = (b.stats.comments || 0) + add.length;
    await DNStore.put(b); await dnReload();
    renderDetStats(b); renderDetReviews(b);
    dnToast('已生成');
  } catch (e) { dnToast(e.message); }
  finally { dnLoad(false); }
}

/* ================= 书评详情 ================= */
let curReview = null;
function openReview(r) {
  curReview = r;
  document.getElementById('rvTitle').textContent = r.title;
  document.getElementById('rvBody').textContent = r.body;
  renderComments('rv');
  dnOpenPage('page-review');
}

/* ================= 目录 ================= */
let catRange = 0;                       // 当前显示的第几段（每段 50 章）
const CAT_PAGE = 50;

function renderCatalog(b) {
  const list = document.getElementById('catList');
  const jump = document.getElementById('csJump');
  const total = (b.catalog || []).length;
  document.getElementById('catBandSub').textContent =
    total ? `共 ${total} 章 · 已解锁 ${b.catalog.filter(c => c.segs && c.segs.length).length}` : `${b.chapterCount} 章待编排`;
  document.getElementById('catSub').textContent = b.title + ' · 共 ' + (total || b.chapterCount) + ' 章';

  if (!total) {
    jump.innerHTML = '';
    list.innerHTML = '<div style="padding:30px 4px;font-size:11.5px;color:#9a9aa4;letter-spacing:.1em;text-align:center;line-height:2">目录尚未生成<br>点击右上角「生成章节标题」</div>';
    return;
  }

  const pages = Math.ceil(total / CAT_PAGE);
  catRange = Math.min(catRange, pages - 1);
  jump.innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) =>
    `<span class="${i === catRange ? 'on' : ''}" data-p="${i}">${i * CAT_PAGE + 1}–${Math.min(total, (i + 1) * CAT_PAGE)}</span>`).join('') : '';
  jump.querySelectorAll('span').forEach(el => {
    el.onclick = () => { catRange = +el.dataset.p; renderCatalog(b); };
  });

  const from = catRange * CAT_PAGE, to = Math.min(total, from + CAT_PAGE);
  let html = `<div class="cs-prog">已读 ${b.catalog.filter(c => c.read).length} / ${total}</div>`;
  for (let i = from; i < to; i++) {
    const c = b.catalog[i];
    html += `<div class="cat-item ${c.segs && c.segs.length ? 'unlocked' : ''}" data-i="${i}">
      <div class="ci-n">${String(i + 1).padStart(3, '0')}</div>
      <div class="ci-t">${dnEsc(c.title)}</div>
      ${c.segs && c.segs.length
        ? `<div class="ci-state">${c.read ? '已读' : '可阅读'}</div>`
        : `<svg class="ci-lock" viewBox="0 0 24 24" fill="none"><rect x="5" y="10.5" width="14" height="9.5" rx="2.4" stroke="currentColor" stroke-width="1.2"/><path d="M8.4 10.5V8a3.6 3.6 0 017.2 0v2.5" stroke="currentColor" stroke-width="1.2"/></svg>`}
    </div>`;
  }
  list.innerHTML = html;
  list.scrollTop = 0;
  list.querySelectorAll('.cat-item').forEach(el => { el.onclick = () => onChapterTap(+el.dataset.i); });
}

/* 分批生成：一次 25 条，最高支持 300 章，失败自动重试一次 */
async function genCatalog() {
  const b = DN.current;
  if (!b) return;
  const total = Math.max(1, Math.min(300, b.chapterCount));
  const BATCH = 25;
  const rounds = Math.ceil(total / BATCH);
  const titles = [];
  const sys = '你是小说章节目录编排师。章节标题 4–12 字，要有画面与钩子，彼此风格统一、剧情递进。禁止在标题里出现「第X章」这类编号词，禁止重复。';
  const base = `作品：《${b.title}》\n简介：${(b.intro || '').slice(0, 500)}\n文风：${b.style ? b.style.desc : ''}\n角色：${(b.chars || []).map(c => c.name).join('、')}\nCP：${(b.pairs || []).map(p => p.join(' × ')).join('、')}\n全书共 ${total} 章。`;

  for (let r = 0; r < rounds; r++) {
    const from = r * BATCH + 1;
    const to = Math.min(total, from + BATCH - 1);
    dnLoad(true, `编排目录 ${from}-${to} / ${total}`);
    const phase = total <= 1 ? '完整故事' :
      (to <= total * 0.25 ? '起（铺陈与相遇）' :
        to <= total * 0.55 ? '承（纠缠与升温）' :
          to <= total * 0.85 ? '转（冲突与崩塌）' : '合（收束与结局）');
    const tail = titles.length ? `\n\n已生成的最近标题（禁止重复、需承接）：${titles.slice(-12).join('、')}` : '';
    let ok = false;
    for (let attempt = 0; attempt < 2 && !ok; attempt++) {
      try {
        const data = await DNAI.json(sys,
          `${base}\n\n本次只生成第 ${from} 至第 ${to} 章的标题，共 ${to - from + 1} 个，处于故事的「${phase}」阶段。${tail}\n\n返回 JSON：{"titles":["",""]}`,
          { maxTokens: 2200, temperature: 0.95 });
        const arr = (data.titles || []).filter(t => typeof t === 'string' && t.trim()).map(t => t.trim());
        if (!arr.length) throw new Error('空');
        for (let i = 0; i < to - from + 1; i++) titles.push(arr[i] || `无题 ${from + i}`);
        ok = true;
      } catch (e) { if (attempt === 1) { for (let i = from; i <= to; i++) titles.push('未命名章节 ' + i); } }
    }
  }

  const old = b.catalog || [];
  b.catalog = titles.slice(0, total).map((t, i) => ({
    title: t,
    segs: (old[i] && old[i].segs) || [],
    read: (old[i] && old[i].read) || false,
    pos: (old[i] && old[i].pos) || 0,
    comments: (old[i] && old[i].comments) || []
  }));
  await DNStore.put(b); await dnReload();
  catRange = 0;
  renderCatalog(b);
  dnLoad(false);
  dnToast('目录已生成 · ' + b.catalog.length + ' 章');
}

/* ---------- 点击章节：生成正文 → 视角选择 ---------- */
async function onChapterTap(i) {
  const b = DN.current;
  const ch = b.catalog[i];
  DN.chapterIdx = i;
  if (ch.segs && ch.segs.length) { openPov(); return; }

  dnLoad(true, '正在生成正文');
  try {
    const roster = (b.chars || []).map(c => `${c.name}（${c.solo ? '独立角色' : c.group}｜${c.identity}）：${(c.profile || '').slice(0, 120)}`).join('\n');
    const prev = b.catalog.slice(Math.max(0, i - 2), i).map((c, k) => `${c.title}：${(c.segs || []).map(s => s.text).join('').slice(0, 160)}`).join('\n');
    const data = await DNAI.json(
      '你是对话体小说作者。故事必须主要由角色对白推动，旁白只做必要的场景与动作提示。输出为分段序列：type 为 narration（旁白）、dialogue（对白）、monologue（内心独白）。dialogue 与 monologue 必须写明 speaker，且 speaker 必须严格取自给定角色名单。对白要有来有回，一句一段，不要把多人台词塞进同一段。',
      `作品：《${b.title}》\n文风要求：${b.style ? b.style.name + ' — ' + b.style.desc : '言情对话体'}\n简介：${(b.intro || '').slice(0, 500)}\n\n角色名单：\n${roster}\n\nCP：${(b.pairs || []).map(p => p.join(' × ')).join('、')}\n${prev ? '\n前情提要：\n' + prev : ''}\n\n请写第 ${i + 1} 章《${ch.title}》的正文。\n总字数控制在 ${b.wordMin}–${b.wordMax} 字之间。\n对白占比不低于 65%。\n\n返回 JSON：{"segments":[{"type":"narration|dialogue|monologue","speaker":"角色名或空","text":""}]}`,
      { maxTokens: Math.max(6000, Math.min(16000, b.wordMax * 6)), temperature: 0.95 });

    const segs = (data.segments || []).filter(s => s && s.text).map(s => ({
      type: ['narration', 'dialogue', 'monologue'].includes(s.type) ? s.type : 'narration',
      speaker: s.speaker || '',
      text: String(s.text).trim()
    }));
    if (!segs.length) throw new Error('正文为空，请重试');
    ch.segs = segs; ch.pos = 0;
    await DNStore.put(b); await dnReload();
    renderCatalog(b);
    dnLoad(false);
    openPov();
  } catch (e) { dnLoad(false); dnToast(e.message); }
}

/* ================= 视角选择 ================= */
let povPick = '';
function openPov() {
  const b = DN.current;
  const ch = b.catalog[DN.chapterIdx];
  povPick = b.povId || '';
  document.getElementById('povChapName').textContent = `第 ${DN.chapterIdx + 1} 章 · ${ch.title}`;
  const deck = document.getElementById('povDeck');
  deck.innerHTML = (b.chars || []).map((c, i) => `
    <div class="pcard ${c.id === povPick ? 'picked' : ''}" data-id="${c.id}" style="animation-delay:${i * 60}ms">
      <div class="pc-av" style="${c.avatar ? `background-image:url('${c.avatar}')` : ''}"></div>
      <div class="pc-in">
        <div class="pc-n">${dnEsc(c.name)}</div>
        <div class="pc-r">${dnEsc(c.solo ? '独立重要角色' : c.group)}${c.identity ? ' · ' + dnEsc(c.identity) : ''}</div>
        <div class="pc-d">${dnEsc((c.profile || '').slice(0, 60))}</div>
      </div>
      <div class="pc-mark"></div>
    </div>`).join('');
  deck.querySelectorAll('.pcard').forEach(el => {
    el.onclick = () => {
      deck.querySelectorAll('.pcard').forEach(c => c.classList.remove('picked'));
      el.classList.add('picked');
      povPick = el.dataset.id;
      document.getElementById('povGo').classList.remove('off');
    };
  });
  document.getElementById('povGo').classList.toggle('off', !povPick);
  if (window.dnCloseCatalog) window.dnCloseCatalog();
  dnDarkStatus(true);
  dnOpenPage('page-pov');
}

/* ================= 绑定 ================= */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('detStatAct').onclick = () => genStatsAndReviews(false);
  document.getElementById('moreReviewBtn').onclick = function () {
    this.classList.add('on');
    genStatsAndReviews(true);
  };
  document.getElementById('catGenBtn').onclick = genCatalog;

  /* 目录：卷轴打开 / 多重关闭 */
  const sheet = document.getElementById('catSheet');
  const mask = document.getElementById('catMask');
  const closeCat = () => { sheet.classList.remove('show'); mask.classList.remove('show'); };
  document.getElementById('catBand').onclick = () => { sheet.classList.add('show'); mask.classList.add('show'); };
  document.getElementById('csClose').onclick = closeCat;
  document.getElementById('csGrip').onclick = closeCat;
  mask.onclick = closeCat;
  window.dnCloseCatalog = closeCat;

  /* 角色弹窗关闭 */
  const cm = document.getElementById('chModal');
  document.getElementById('chmClose').onclick = () => cm.classList.remove('show');
  cm.onclick = e => { if (e.target === cm) cm.classList.remove('show'); };

  /* 视角确认 */
  document.getElementById('povGo').onclick = async () => {
    if (!povPick) return dnToast('请选择一个视角');
    DN.current.povId = povPick;
    await DNStore.put(DN.current);
    dnClosePage('page-pov');
    openReader();
  };

  /* 书评回复：用户发言后自动调用 AI 回应 */
  document.getElementById('rvSend').onclick = () => {
    const inp = document.getElementById('rvInput');
    const v = inp.value.trim();
    if (!v) return;
    inp.value = '';
    addComment('rv', v, null);
  };
  document.getElementById('rvInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('rvSend').click();
  });
});