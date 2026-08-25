/* ================================================================
   糖罐 TANGGUAN — tg-post.js
   帖子详情页：浏览量 · 更新交互 · 主评论 / 二级评论 · 作者标记
   依赖：tg-core.js / tg-genre.js / tg-plaza.js
================================================================ */

let tgPV = { p: null, busy: false, replyTo: null };

/* ================================================================
   一、进入
================================================================ */
function tgOpenPost(id) {
  const p = tgPostReg.get(id);
  if (!p) { tgToast('这条内容已经不在了'); return; }
  tgPV.p = p;
  tgPV.replyTo = null;
  // 每次打开都算一次浏览
  p.view = (p.view || 0) + tgRnd(1, 3);
  tgGo('scr-postview');
  tgPaintPost();
  tgSavePost(p);
}
function tgOnEnterPost(id) { if (id === 'scr-postview' && tgPV.p) tgPaintPost(); }

/* ================================================================
   二、渲染
================================================================ */
function tgFmtRel(ts) {
  const d = Date.now() - (ts || Date.now());
  if (d < 60000) return '刚刚';
  if (d < 3600000) return Math.floor(d / 60000) + ' 分钟前';
  if (d < 86400000) return Math.floor(d / 3600000) + ' 小时前';
  if (d < 86400000 * 7) return Math.floor(d / 86400000) + ' 天前';
  return tgFmtDate(ts);
}
function tgCmtCount(p) {
  return (p.comments || []).reduce((a, c) => a + 1 + (c.replies || []).length, 0);
}

function tgPaintPost() {
  const p = tgPV.p; if (!p) return;
  const gm = tgGenreOf(p.genre);

  document.getElementById('tgPvStep').textContent = gm.en;
  document.getElementById('tgPvTitle').textContent = gm.n;

  const box = document.getElementById('tgPvBody');
  box.innerHTML = `
    <article class="tg-pv-card tg-rise tg-d1">
      <div class="tg-corner tr"></div>
      <div class="tg-post-top">
        <div class="tg-post-av ${p.scope === 'owner' ? 'own' : ''}"><span>${tgEsc((p.author.name || '·')[0])}</span></div>
        <div class="tg-post-who">
          <b>${tgEsc(p.author.name)}${p.scope === 'owner' ? '<em class="tg-badge-own">正主</em>' : ''}</b>
          <i>@${tgEsc(p.author.handle)} · ${tgEsc(p.author.identity)}</i>
        </div>
        <div class="tg-post-genre">${gm.n}</div>
      </div>
      <div class="tg-post-cp">${tgEsc(p.cpA)}<em>×</em>${tgEsc(p.cpB)}${p.circleName ? `<span>${tgEsc(p.circleName)}</span>` : '<span class="rnd">随机生成</span>'}</div>
      <h1 class="tg-pv-title">${tgEsc(p.title)}</h1>
      <p class="tg-pv-cap">${tgEsc(p.caption)}</p>
      ${tgImgGrid(p)}
      <div class="tg-post-tags">${p.tags.map(t => `<i>#${tgEsc(t)}</i>`).join('')}</div>
      <div class="tg-pv-meta">
        <span>${tgFmtRel(p.createdAt)}</span>
        <span>浏览 <b>${tgKn(p.view || 0)}</b></span>
        <span>共 ${p.imgs.length} 张</span>
      </div>
      <div class="tg-pv-stats">
        ${[['like', '点赞', p.stats.like], ['comment', '评论', tgCmtCount(p) || p.stats.comment], ['repost', '转发', p.stats.repost], ['collect', '收藏', p.stats.collect]]
      .map(([k, n, v]) => `<div class="tg-pv-st"><b>${tgKn(v)}</b><span>${n}</span></div>`).join('')}
      </div>
      <div class="tg-pv-acts">
        <button onclick="tgPostAct('${p.id}','like',this)"><span data-ico="heart"></span>赞</button>
        <button onclick="tgPostAct('${p.id}','collect',this)"><span data-ico="star"></span>收藏</button>
        <button onclick="tgSaveAll('${p.id}')"><span data-ico="save"></span>存图</button>
        <button onclick="tgViewer('${p.id}',0)"><span data-ico="image"></span>大图</button>
      </div>
    </article>

    <div class="tg-pv-update tg-rise tg-d2">
      <div class="tg-pv-up-main">
        <b>更新这条内容的数据</b>
        <p>拉取新的浏览量、点赞、转发与评论。你发过的主评论会在这时候收到回复。</p>
      </div>
      <button class="tg-up-btn ${tgPV.busy ? 'busy' : ''}" ${tgPV.busy ? 'disabled' : ''} onclick="tgPostUpdate()">
        <span data-ico="refresh"></span>${tgPV.busy ? '更新中' : '更新'}
      </button>
    </div>

    <div class="tg-sec-title" style="margin-top:22px"><b>评论</b><i>${tgCmtCount(p)} 条</i>
      ${(p.comments || []).some(c => c.isMe && c.pending) ? '<em class="tg-wait">有 1 条以上待回复</em>' : ''}
    </div>
    <div id="tgPvCmts">${tgCmtHTML(p)}</div>
    <div style="height:var(--tg-pvbar-h)"></div>`;
  tgFillIcons(box);
  tgPaintReplyBar();
}

function tgCmtHTML(p) {
  const list = (p.comments || []).slice().sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.ts - a.ts);
  if (!list.length) return `<div class="tg-cmt-empty">还没有人说话。<br>写第一条，或者点上面的「更新」让评论区活起来。</div>`;
  const badge = c => (c.isMe ? '<em class="me">我</em>' : '') + (c.isAuthor ? '<em class="au">作者</em>' : '') + (c.isOwner ? '<em class="ow">正主</em>' : '');
  return list.map((c, i) => `
    <div class="tg-cmt tg-rise tg-d${(i % 6) + 1}">
      <div class="tg-cmt-av ${c.isOwner ? 'ow' : c.isAuthor ? 'au' : ''}"><span>${tgEsc((c.name || '·')[0])}</span></div>
      <div class="tg-cmt-main">
        <div class="tg-cmt-l1"><b>${tgEsc(c.name)}</b>${badge(c)}<i>${tgFmtRel(c.ts)}</i></div>
        <p class="tg-cmt-tx">${tgEsc(c.text).replace(/\n/g, '<br>')}</p>
        <div class="tg-cmt-bar">
          <button onclick="tgCmtLike('${c.id}',this)"><span data-ico="heart"></span>${c.like || 0}</button>
          <button onclick="tgCmtReply('${c.id}')">回复</button>
          ${c.isMe && c.pending ? '<em class="tg-pend">等待回复中</em>' : ''}
        </div>
        ${(c.replies || []).length ? `<div class="tg-sub">
          ${c.replies.map(r => `
            <div class="tg-sub-row">
              <b>${tgEsc(r.name)}</b>${badge(r)}${r.to ? `<em class="to">回复 ${tgEsc(r.to)}</em>` : ''}
              <span>${tgEsc(r.text).replace(/\n/g, '<br>')}</span>
              <i>${tgFmtRel(r.ts)} · 赞 ${r.like || 0}</i>
            </div>`).join('')}
        </div>` : ''}
      </div>
    </div>`).join('');
}

function tgCmtLike(id, btn) {
  const p = tgPV.p; if (!p) return;
  const c = (p.comments || []).find(x => x.id === id); if (!c) return;
  if (btn.classList.contains('on')) { btn.classList.remove('on'); c.like = Math.max(0, (c.like || 0) - 1); }
  else { btn.classList.add('on'); c.like = (c.like || 0) + 1; }
  btn.innerHTML = `<span data-ico="heart"></span>${c.like}`;
  tgFillIcons(btn);
  tgSavePost(p);
}

/* ================================================================
   三、回复条
================================================================ */
function tgPaintReplyBar() {
  const bar = document.getElementById('tgPvBar');
  if (!bar) return;
  const t = tgPV.replyTo;
  bar.innerHTML = `
    ${t ? `<div class="tg-pv-replyto"><span>正在回复 <b>${tgEsc(t.name)}</b></span><button onclick="tgCmtReply('')" data-ico="close"></button></div>` : ''}
    <div class="tg-pv-input">
      <textarea id="tgPvInput" rows="1" placeholder="${t ? '回复 ' + tgEsc(t.name) : '写条主评论……更新时会有人回你'}"></textarea>
      <button class="tg-cbtn send" data-ico="send" onclick="tgCmtSend()"></button>
    </div>`;
  tgFillIcons(bar);
  const inp = document.getElementById('tgPvInput');
  if (inp) {
    inp.addEventListener('input', () => { inp.style.height = 'auto'; inp.style.height = Math.min(84, inp.scrollHeight) + 'px'; });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); tgCmtSend(); } });
  }
}
function tgCmtReply(id) {
  const p = tgPV.p;
  if (!id) { tgPV.replyTo = null; tgPaintReplyBar(); return; }
  const c = (p.comments || []).find(x => x.id === id);
  if (!c) return;
  tgPV.replyTo = c;
  tgPaintReplyBar();
  const inp = document.getElementById('tgPvInput');
  if (inp) inp.focus();
}

const tgMeName = () => (typeof tgMe !== 'undefined' && tgMe.name) ? tgMe.name : '我';
const tgMeHandle = () => (typeof tgMe !== 'undefined' && tgMe.handle) ? tgMe.handle : 'tangguan';

async function tgCmtSend() {
  const p = tgPV.p; if (!p) return;
  const inp = document.getElementById('tgPvInput');
  const v = (inp.value || '').trim();
  if (!v) return;
  inp.value = ''; inp.style.height = 'auto';
  p.comments = p.comments || [];

  if (tgPV.replyTo) {
    /* 二级评论：立刻生成对我的回应，条数不设上限 */
    const target = tgPV.replyTo;
    target.replies = target.replies || [];
    target.replies.push({
      id: 'r' + Date.now().toString(36), name: tgMeName(), text: v,
      to: target.name, ts: Date.now(), like: 0, isMe: true
    });
    tgPV.replyTo = null;
    tgPaintPost();
    tgSavePost(p);
    if (typeof tgAddSweet === 'function') tgAddSweet(2);
    await tgReplyToMe(target, v);
  } else {
    /* 主评论：挂上待回复标记，等「更新」时才会有人回 */
    p.comments.unshift({
      id: 'c' + Date.now().toString(36), name: tgMeName(), handle: tgMeHandle(),
      text: v, ts: Date.now(), like: 0, isMe: true, pending: true, replies: []
    });
    tgPaintPost();
    tgSavePost(p);
    if (typeof tgAddSweet === 'function') tgAddSweet(2);
    tgToast('已发布。点「更新」，会有人来回你');
  }
}

/* ================================================================
   四、AI：回应我的二级评论
================================================================ */
function tgPostBrief(p) {
  const L = [
    `【这条内容】体裁：${tgGenreName(p.genre)}｜标题：${p.title}`,
    `作者：${p.author.name}（${p.author.identity}）`,
    `CP：${p.cpA} × ${p.cpB}${p.cpWorld ? '｜' + p.cpWorld : ''}`,
    `引言：${p.caption}`
  ];
  if (p.scope === 'owner') L.push(`注意：这条是正主「${p.ownerName || p.cpA}」本人发的，不是同人。`);
  const circle = (typeof tgPlaza !== 'undefined' ? tgPlaza.circles : []).find(c => c.id === p.circleId);
  if (circle) L.push('【CP 完整资料，绝不 OOC】\n' + tgCircleBrief(circle, (typeof tgCir !== 'undefined' && tgCir.deep) || {}));
  return L.join('\n');
}
function tgCmtRules() {
  return [
    '【评论区的写法】',
    '· 昵称要像真实网友：可以带数字、缩写、生僻字、颜文字之外的怪名字，绝不能是「用户A」「网友1」。',
    '· 每个人的语气和句长都要不同：有人只打三个字，有人写两百字小论文，有人全程阴阳怪气，有人在跑题，有人在纠正别人的错别字。',
    '· 允许出现互相@、接梗、吵起来、被说服、突然煽情、突然冷场。',
    '· 禁止 emoji、颜文字、星号强调、markdown。',
    '· 禁止所有人都在夸，必须有至少一条不友好或不理解的声音。',
    '· 如果这条内容是正主本人发的，另一位正主要在评论里出现，说话极其克制、极其像本人，绝不承认关系。',
    '· author 为 true 表示这条评论是发帖人自己回的；owner 为 true 表示是正主本人。这两种要真的出现，但不要每条都是。'
  ].join('\n');
}

async function tgReplyToMe(target, myText) {
  const p = tgPV.p;
  if (!tgHasApi()) { tgToast('接口没配置，暂时没人回你'); return; }
  tgPV.busy = true;
  const host = document.getElementById('tgPvCmts');
  if (host) host.insertAdjacentHTML('afterbegin', `<div class="tg-cmt-load" id="tgCmtLoad"><i></i><i></i><i></i><span>有人正在回复你</span></div>`);

  const ctx = (target.replies || []).map(r => `${r.name}${r.to ? '（回复 ' + r.to + '）' : ''}：${r.text}`).join('\n');
  const user = [
    tgPostBrief(p),
    '',
    '【楼中楼的原始主评论】',
    `${target.name}：${target.text}`,
    ctx ? '【这一层已有的回复】\n' + ctx : '',
    '',
    `【我（昵称「${tgMeName()}」）刚刚在这一层里说】`,
    myText,
    '',
    '【任务】写出其他人对我这句话的回应。',
    '· 条数由内容自然决定，不设上限也不设下限模板：可能两三条，也可能十几条，取决于我这句话有多值得接。至少要有两条。',
    '· 必须真正接住我说的这句话，可以赞同、抬杠、补刀、纠正、顺着往下说、或者把话题带偏，但不能答非所问。',
    `· 楼主「${target.name}」有可能亲自回我，也可能不回。`,
    tgCmtRules(),
    '',
    '【必须严格遵循的 JSON 结构】',
    '{"replies":[{"name":"昵称","text":"回复内容","like":0,"author":false,"owner":false}]}',
    '',
    '现在直接输出 JSON。'
  ].filter(Boolean).join('\n');

  let list = [];
  try {
    const j = await tgAskJSON(tgSysPrompt(), user, { max: 4000, rounds: 3 });
    list = Array.isArray(j) ? j : (j.replies || j.list || j.comments || []);
  } catch (e) {
    try {
      const raw = await tgChat([
        { role: 'system', content: tgSysPrompt().replace(/【输出硬规则[\s\S]*?(?=【写作要求】)/, '') + '\n\n直接用纯文本回答，每条一行，格式是「昵称：内容」，不要编号、不要解释。' },
        { role: 'user', content: user.replace(/【必须严格遵循的 JSON 结构】[\s\S]*$/, '现在直接写。') }
      ], { max: 2600, temp: 0.95 });
      list = String(raw).split('\n').map(x => x.trim()).filter(Boolean).map(ln => {
        const m = ln.match(/^([^：:]{1,14})\s*[：:]\s*(.+)$/);
        return m ? { name: m[1], text: m[2] } : null;
      }).filter(Boolean);
    } catch (e2) { list = []; }
  }

  const el = document.getElementById('tgCmtLoad'); if (el) el.remove();
  tgPV.busy = false;

  list = list.map(r => ({
    id: 'r' + Math.random().toString(36).slice(2, 9),
    name: String((r && r.name) || '路过').slice(0, 20),
    text: String((r && (r.text || r.content)) || '').trim(),
    to: tgMeName(), ts: Date.now() + Math.floor(Math.random() * 60000),
    like: tgNum(r && r.like, tgRnd(0, 260)),
    isAuthor: !!(r && (r.author || r.isAuthor)),
    isOwner: !!(r && (r.owner || r.isOwner))
  })).filter(r => r.text);

  if (!list.length) { tgToast('这次没人接话，再说一句试试'); return; }
  target.replies = (target.replies || []).concat(list);
  p.stats.comment += list.length;
  tgPaintPost();
  tgSavePost(p);
  tgToast(`${list.length} 个人回了你`);
  if (typeof tgAddSweet === 'function') tgAddSweet(3);
}

/* ================================================================
   五、更新交互：刷新全部数据 + 新评论 + 回复我的主评论
================================================================ */
async function tgPostUpdate() {
  const p = tgPV.p;
  if (!p || tgPV.busy) return;
  if (!tgHasApi()) { tgNoApi(); return; }
  tgPV.busy = true;
  tgPaintPost();
  const host = document.getElementById('tgPvCmts');
  if (host) host.insertAdjacentHTML('afterbegin', `<div class="tg-cmt-load" id="tgCmtLoad"><i></i><i></i><i></i><span>正在拉取新的数据与评论</span></div>`);

  /* 数据增长（本地算，保证一定有变化） */
  const grow = () => 1 + Math.random() * 0.16;
  const dView = tgRnd(120, 9000) + Math.floor((p.view || 0) * 0.04);
  p.view = (p.view || 0) + dView;
  const dLike = Math.max(1, Math.round(p.stats.like * (grow() - 1)) + tgRnd(0, 60));
  p.stats.like += dLike;
  p.stats.repost += Math.max(0, Math.round(p.stats.repost * (grow() - 1)));
  p.stats.collect += Math.max(0, Math.round(p.stats.collect * (grow() - 1)));

  /* 待回复的主评论 */
  const pend = (p.comments || []).filter(c => c.isMe && c.pending);
  const known = (p.comments || []).map(c => c.name).filter(Boolean).slice(0, 24);

  const user = [
    tgPostBrief(p),
    '',
    known.length ? '【评论区已经出现过的昵称，不要重复使用】\n' + known.join('、') : '',
    pend.length ? [
      `【下面是「${tgMeName()}」发的主评论，本次必须每一条都有人来回复】`,
      pend.map((c, i) => `${i + 1}. ${c.text}`).join('\n'),
      '回复要真的接住这句话本身，不能是通用的客套。每一条主评论的回复数量由内容决定，至少两条，上不封顶。'
    ].join('\n') : '',
    '',
    '【任务】为这条内容生成一批新的评论。',
    '· newComments 是新出现的主评论。条数不要固定：这一次可能只有三条，下一次可能有十五条，由内容的热度和话题性决定，但至少三条。',
    '· 每条主评论下面可以带 replies（楼中楼），也可以完全没有。带的时候条数同样自由。',
    '· 主评论之间要有真实的差异：长评、短评、只发一个字的、跑题的、纠错的、玩梗的、突然真情实感的、和别人吵起来的。',
    '· 至少有一条是把这条内容和另一件事联系起来的考据。',
    pend.length ? '· toMine 里，idx 对应上面主评论的编号，replies 是回复这一条的人。' : '',
    tgCmtRules(),
    '',
    '【必须严格遵循的 JSON 结构】',
    '{"newComments":[{"name":"昵称","handle":"ID","text":"评论内容","like":0,"author":false,"owner":false,"replies":[{"name":"昵称","to":"回复谁","text":"内容","like":0,"author":false,"owner":false}]}],"toMine":[{"idx":1,"replies":[{"name":"昵称","text":"内容","like":0,"author":false,"owner":false}]}]}',
    '',
    '现在直接输出 JSON。'
  ].filter(Boolean).join('\n');

  let j = null;
  try { j = await tgAskJSON(tgSysPrompt(), user, { max: 8000, rounds: 3 }); } catch (e) { j = null; }

  const el = document.getElementById('tgCmtLoad'); if (el) el.remove();

  const mkC = (c, isSub) => ({
    id: (isSub ? 'r' : 'c') + Math.random().toString(36).slice(2, 9),
    name: String((c && c.name) || '路过').slice(0, 20),
    handle: String((c && c.handle) || '').slice(0, 20),
    text: String((c && (c.text || c.content)) || '').trim(),
    to: c && c.to ? String(c.to).slice(0, 20) : '',
    ts: Date.now() - Math.floor(Math.random() * 3600000),
    like: tgNum(c && c.like, tgRnd(0, 900)),
    isAuthor: !!(c && (c.author || c.isAuthor)),
    isOwner: !!(c && (c.owner || c.isOwner)),
    replies: []
  });

  let added = 0;
  if (j) {
    const nc = Array.isArray(j) ? j : (j.newComments || j.comments || j.list || []);
    (nc || []).forEach(c => {
      const o = mkC(c, false);
      if (!o.text) return;
      o.replies = (Array.isArray(c.replies) ? c.replies : []).map(r => mkC(r, true)).filter(r => r.text);
      p.comments = p.comments || [];
      p.comments.push(o);
      added += 1 + o.replies.length;
    });
    const tm = j.toMine || j.toMe || [];
    (Array.isArray(tm) ? tm : []).forEach(t => {
      const i = tgNum(t.idx, 0) - 1;
      const target = pend[i];
      if (!target) return;
      const rs = (Array.isArray(t.replies) ? t.replies : []).map(r => {
        const o = mkC(r, true); o.to = tgMeName(); return o;
      }).filter(r => r.text);
      if (!rs.length) return;
      target.replies = (target.replies || []).concat(rs);
      target.pending = false;
      added += rs.length;
    });
  }

  /* 兜底：如果模型没照顾到我的主评论，本地也要把 pending 清掉并补一条 */
  pend.forEach(c => {
    if (c.pending && (c.replies || []).length) c.pending = false;
  });

  p.stats.comment = Math.max(p.stats.comment, tgCmtCount(p));
  tgPV.busy = false;
  tgPaintPost();
  tgSavePost(p);
  if (typeof tgRenderFeed === 'function') tgRenderFeed();
  if (typeof tgCircleRepaint === 'function') tgCircleRepaint();

  const still = (p.comments || []).some(c => c.isMe && c.pending);
  if (added) {
    tgToast(`浏览 +${tgKn(dView)}　新增 ${added} 条评论${still ? '（还有主评论没被回到，再更新一次）' : ''}`);
    if (typeof tgAddSweet === 'function') tgAddSweet(5);
  } else {
    tgToast(`浏览 +${tgKn(dView)}，但这次没有新评论`);
  }
}