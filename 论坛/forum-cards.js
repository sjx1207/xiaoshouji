/* =========================================================
   论坛 · 内容卡片  forum-cards.js
   九种内容类型各自独立的版式，外加统一的互动逻辑
========================================================= */
F.cards = {};

/* ---------- 互动：点赞 / 收藏 / 投票（按当前身份记录，所有页面同步） ---------- */
F.act = {
  like(p) { const me = F.me().id; p.likedBy = p.likedBy || []; const i = p.likedBy.indexOf(me); i < 0 ? p.likedBy.push(me) : p.likedBy.splice(i, 1); F.save('posts', 'videos'); return i < 0; },
  fav(p) { const me = F.me().id; p.favBy = p.favBy || []; const i = p.favBy.indexOf(me); i < 0 ? p.favBy.push(me) : p.favBy.splice(i, 1); F.save('posts', 'videos'); return i < 0; },
  liked: p => (p.likedBy || []).includes(F.me().id),
  faved: p => (p.favBy || []).includes(F.me().id),
  vote(p, idx) { p.poll.votes = p.poll.votes || {}; if (p.poll.votes[F.me().id] != null) return false; p.poll.votes[F.me().id] = idx; F.save('posts', 'videos'); return true; },
  myVote: p => p.poll && p.poll.votes ? p.poll.votes[F.me().id] : undefined,
  pollCounts(p) { const c = p.poll.options.map(o => o.votes || 0); Object.values(p.poll.votes || {}).forEach(i => { if (c[i] != null) c[i]++; }); return c; },
  repost(p) { F.share.open(p); },
  likeComment(c) { const me = F.me().id; c.likedBy = c.likedBy || []; const i = c.likedBy.indexOf(me); i < 0 ? c.likedBy.push(me) : c.likedBy.splice(i, 1); F.save('posts', 'videos'); return i < 0; }
};

/* ---------- 共享片段 ---------- */
F.cards.name = (person, { handle = true } = {}) => `<span class="nm">${F.esc(person.nickname)}</span>${F.isVerified(person) ? F.vbadge(person.kind !== 'char') : ''}${handle ? `<span class="hd">@${F.esc(person.handle)}</span>` : ''}`;
F.cards.ref = ref => `data-person="${ref.kind}:${ref.id}"`;
F.cards.imgs = (p, max = 4) => {
  const im = (p.images || []).slice(0, max);
  if (!im.length) return '';
  const more = (p.images.length > max) ? `<span class="img-more">+${p.images.length - max}</span>` : '';
  return `<div class="imgs n${im.length}">${im.map((x, i) => `<div class="im" data-img="${i}">${x.src ? `<img src="${x.src}" loading="lazy">` : F.art.photoSVG(x.seed || x.desc)}${!x.src && x.desc ? `<span class="im-cap">${F.esc(x.desc)}</span>` : ''}${i === im.length - 1 ? more : ''}</div>`).join('')}</div>`;
};
F.cards.actions = (p, cls = '') => `
  <div class="acts ${cls}">
    <button class="act ${F.act.liked(p) ? 'on' : ''}" data-like>${F.I('heart')}<b>${F.num(F.likeCount(p))}</b></button>
    <button class="act" data-open-post>${F.I('comment')}<b>${F.num(F.commentCount(p))}</b></button>
    <button class="act" data-repost>${F.I('repost')}<b>${F.num(p.stats.reposts)}</b></button>
    <button class="act ${F.act.faved(p) ? 'on' : ''}" data-fav>${F.I('fav')}<b>${F.num(F.favCount(p))}</b></button>
  </div>`;
F.cards.topicLine = p => (p.topic || (p.tags && p.tags.length)) ? `<div class="topic-line">${p.topic ? `<span class="rt-topic">#${F.esc(p.topic)}#</span>` : ''}${(p.tags || []).filter(t => t !== p.topic).slice(0, 3).map(t => `<span class="tg">#${F.esc(t)}</span>`).join('')}</div>` : '';
F.cards.readMins = p => Math.max(1, Math.round(F.plain(p.content).length / 420));

/* ---------- 各类型版式 ---------- */
F.cards.render = p => {
  const a = F.person(p.author);
  let fn = F.cards['t_' + p.type] || F.cards.t_moment;
  if ((p.type === 'poll' && !p.poll) || (p.type === 'review' && !p.review)) fn = F.cards.t_moment;
  const ab = p.about ? F.person(p.about) : null;
  return `<article class="card c-${p.type}" data-post="${p.id}">${ab ? `<span class="about-rib" data-person="${p.about.kind}:${p.about.id}">${F.I('crown')}${F.esc(ab.nickname)}</span>` : ''}${fn(p, a)}</article>`;
};

/* 动态：推特式，左头像右正文 */
F.cards.t_moment = (p, a) => `
  <div class="mo-grid">
    <div ${F.cards.ref(p.author)} class="mo-av">${F.avatarHTML(a, 42)}</div>
    <div class="mo-main">
      <div class="mo-head" ${F.cards.ref(p.author)}>${F.cards.name(a)}<span class="dot-sep"></span><span class="tm">${F.ago(p.createdAt)}</span></div>
      <div class="mo-text" data-open-post>${F.inline(F.plain(p.content)).replace(/\n/g, '<br>')}</div>
      ${F.cards.imgs(p)}
      ${F.cards.topicLine(p)}
      ${F.cards.actions(p, 'thin')}
    </div>
  </div>`;

/* 图文：IG 式，满幅图片轮播 */
F.cards.t_photo = (p, a) => {
  const ims = p.images && p.images.length ? p.images : [{ seed: p.id, desc: '' }];
  return `
  <div class="ph-head" ${F.cards.ref(p.author)}>
    <div class="ph-ring">${F.avatarHTML(a, 34)}</div>
    <div class="ph-who"><div>${F.cards.name(a, { handle: false })}</div>${p.location ? `<small>${F.esc(p.location)}</small>` : `<small>${F.ago(p.createdAt)}</small>`}</div>
    <span class="gorb sm">${F.I('more')}</span>
  </div>
  <div class="ph-stage">
    <div class="ph-track">${ims.map((x, i) => `<div class="ph-slide" data-img="${i}">${x.src ? `<img src="${x.src}" loading="lazy">` : F.art.photoSVG(x.seed || x.desc)}${!x.src && x.desc ? `<p class="ph-desc">${F.esc(x.desc)}</p>` : ''}</div>`).join('')}</div>
    ${ims.length > 1 ? `<span class="ph-count">1/${ims.length}</span><div class="ph-dots">${ims.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}
  </div>
  <div class="ph-bar">
    <button class="act ${F.act.liked(p) ? 'on' : ''}" data-like>${F.I('heart')}</button>
    <button class="act" data-open-post>${F.I('comment')}</button>
    <button class="act" data-repost>${F.I('repost')}</button>
    <span style="flex:1"></span>
    <button class="act ${F.act.faved(p) ? 'on' : ''}" data-fav>${F.I('fav')}</button>
  </div>
  <div class="ph-cap" data-open-post>
    <b class="ph-likes">${F.num(F.likeCount(p))} 次赞</b>
    <p><b>${F.esc(a.nickname)}</b> ${F.inline(F.plain(p.content))}</p>
    ${F.commentCount(p) ? `<span class="muted">查看全部 ${F.commentCount(p)} 条评论</span>` : ''}
  </div>`;
};

/* 长文：杂志式，大标题 + 封面带 */
F.cards.t_article = (p, a) => {
  const cover = p.images && p.images[0];
  return `
  <div class="ar-cover" data-open-post>${cover ? (cover.src ? `<img src="${cover.src}">` : F.art.photoSVG(cover.seed)) : F.art.coverSVG(p.id)}
    <span class="ar-badge lg lg-on-img">${F.I('article')}长文 · ${F.cards.readMins(p)} 分钟</span></div>
  <div class="ar-body" data-open-post>
    <h3 class="ar-title">${F.esc(p.title || '无题')}</h3>
    <p class="ar-ex clamp3">${F.esc(F.plain(p.content).replace(/\n+/g, ' ').slice(0, 160))}</p>
  </div>
  <div class="ar-foot">
    <div class="ar-by" ${F.cards.ref(p.author)}>${F.avatarHTML(a, 24)}${F.cards.name(a, { handle: false })}</div>
    <span class="ar-stat">${F.I('eye')}${F.num(p.stats.views)}</span>
    <button class="ar-stat ${F.act.liked(p) ? 'on' : ''}" data-like>${F.I('heart')}${F.num(F.likeCount(p))}</button>
    <button class="ar-stat ${F.act.faved(p) ? 'on' : ''}" data-fav>${F.I('fav')}</button>
  </div>`;
};

/* 随笔：信笺式，首字下沉 + 署名 */
F.cards.t_essay = (p, a) => {
  const txt = F.plain(p.content).replace(/\n+/g, '　');
  return `
  <div class="es-paper" data-open-post>
    <div class="es-date">${F.fullDate(p.createdAt)}</div>
    <h3 class="es-title">${F.esc(p.title || '随笔')}</h3>
    <p class="es-text"><span class="es-cap">${F.esc(txt.slice(0, 1))}</span>${F.esc(txt.slice(1, 150))}…</p>
    <div class="es-sign" ${F.cards.ref(p.author)}>—— ${F.esc(a.nickname)}</div>
  </div>
  ${F.cards.actions(p, 'soft')}`;
};

/* 投票：可直接在卡片里投 */
F.cards.pollBlock = p => {
  const counts = F.act.pollCounts(p), total = counts.reduce((s, x) => s + x, 0) || 1;
  const mine = F.act.myVote(p), voted = mine != null;
  const max = Math.max(...counts);
  return `<div class="po-block"><div class="po-opts ${voted ? 'voted' : ''}">${p.poll.options.map((o, i) => {
    const pct = Math.round(counts[i] / total * 100);
    return `<button class="po-opt ${mine === i ? 'mine' : ''} ${voted && counts[i] === max ? 'lead' : ''}" data-vote="${i}"><span class="po-fill" style="width:${voted ? pct : 0}%"></span><span class="po-t">${F.esc(o.text)}</span>${voted ? `<span class="po-p num-font">${pct}%</span>` : ''}${mine === i ? F.I('check', 'po-ck') : ''}</button>`;
  }).join('')}</div><div class="po-meta">${F.num(total)} 人参与${voted ? ' · 已投票' : ' · 点选项即可投票'}</div></div>`;
};
F.cards.t_poll = (p, a) => `
  <div class="po-head" ${F.cards.ref(p.author)}>${F.avatarHTML(a, 30)}<div>${F.cards.name(a, { handle: false })}<small>${F.ago(p.createdAt)} 发起投票</small></div><span class="po-ic">${F.I('poll')}</span></div>
  <h3 class="po-q" data-open-post>${F.esc(p.poll.question || p.title)}</h3>
  ${p.content ? `<p class="po-desc clamp2" data-open-post>${F.esc(F.plain(p.content))}</p>` : ''}
  ${F.cards.pollBlock(p)}
  ${F.cards.actions(p, 'thin')}`;

/* 问答：大号 Q，提问 + 高赞回答 */
F.cards.t_qa = (p, a) => `
  <div class="qa-q" data-open-post><span class="qa-mark">Q</span><h3>${F.esc(p.title || '提问')}</h3></div>
  <div class="qa-a" data-open-post>
    <div class="qa-by" ${F.cards.ref(p.author)}>${F.avatarHTML(a, 22)}${F.cards.name(a, { handle: false })}<span class="qa-tt">${F.esc(F.verifyTitle(a) || '的回答')}</span></div>
    <p class="clamp3">${F.esc(F.plain(p.content).replace(/\n+/g, ' '))}</p>
  </div>
  <div class="qa-foot">
    <button class="qa-agree ${F.act.liked(p) ? 'on' : ''}" data-like>${F.I('arrowUp')}赞同 ${F.num(F.likeCount(p))}</button>
    <button class="act" data-open-post>${F.I('comment')}<b>${F.num(F.commentCount(p))}</b></button>
    <button class="act ${F.act.faved(p) ? 'on' : ''}" data-fav>${F.I('fav')}<b>${F.num(F.favCount(p))}</b></button>
  </div>`;

/* 连载串：竖向时间线 1/n */
F.cards.t_thread = (p, a) => {
  const segs = p.thread && p.thread.length ? p.thread : [p.content];
  return `
  <div class="th-head" ${F.cards.ref(p.author)}>${F.avatarHTML(a, 34)}<div>${F.cards.name(a)}<small>${F.ago(p.createdAt)} · 共 ${segs.length} 段</small></div></div>
  ${p.title ? `<h3 class="th-title" data-open-post>${F.esc(p.title)}</h3>` : ''}
  <ol class="th-line" data-open-post>${segs.slice(0, 3).map((s, i) => `<li><span class="th-n num-font">${i + 1}/${segs.length}</span><p class="clamp3">${F.esc(F.plain(s))}</p></li>`).join('')}</ol>
  ${segs.length > 3 ? `<button class="th-more" data-open-post>展开剩余 ${segs.length - 3} 段</button>` : ''}
  ${F.cards.actions(p, 'thin')}`;
};

/* 测评：评分面板 */
F.cards.stars = r => { let s = ''; for (let i = 1; i <= 5; i++) { const f = r >= i ? 1 : r >= i - .5 ? .5 : 0; s += `<span class="st"><i style="width:${f * 100}%"></i></span>`; } return `<span class="stars">${s}</span>`; };
F.cards.t_review = (p, a) => `
  <div class="rv-panel" data-open-post>
    <div class="rv-score"><b class="num-font">${(p.review.rating).toFixed(1)}</b>${F.cards.stars(p.review.rating)}</div>
    <div class="rv-obj"><span class="rv-cat">${F.esc(p.review.category || '测评')}</span><h4>${F.esc(p.review.subject || p.title)}</h4><small>${F.esc(a.nickname)} 的评分</small></div>
  </div>
  <h3 class="rv-title" data-open-post>${F.esc(p.title)}</h3>
  <p class="rv-ex clamp2" data-open-post>${F.esc(F.plain(p.content).replace(/\n+/g, ' '))}</p>
  <div class="rv-foot"><div class="ar-by" ${F.cards.ref(p.author)}>${F.avatarHTML(a, 22)}${F.cards.name(a, { handle: false })}</div>${F.cards.actions(p, 'thin mini')}</div>`;

/* 快讯：电讯稿式 */
F.cards.t_news = (p, a) => `
  <div class="nw-top"><span class="nw-lv">${F.esc((p.news && p.news.level) || '快讯')}</span><span class="nw-src">${F.esc((p.news && p.news.source) || a.nickname)}</span><span class="nw-tm">${new Date(p.createdAt).toTimeString().slice(0, 5)}</span></div>
  <h3 class="nw-h" data-open-post>${F.esc(p.title || F.plain(p.content).slice(0, 30))}</h3>
  <p class="nw-sum clamp2" data-open-post>${F.esc(F.plain(p.content).replace(/\n+/g, ' '))}</p>
  <div class="nw-foot"><span ${F.cards.ref(p.author)} class="nw-by">${F.cards.name(a, { handle: false })}</span>${F.cards.actions(p, 'thin mini')}</div>`;

/* ---------- 事件委托：任何承载卡片的容器调用一次即可 ---------- */
F.bindFeed = (root, { onChange } = {}) => {
  if (root._feedBound) return; root._feedBound = true;
  root.addEventListener('click', e => {
    const card = e.target.closest('[data-post]');
    const personEl = e.target.closest('[data-person]');
    if (personEl && root.contains(personEl)) {
      e.stopPropagation();
      const [kind, id] = personEl.dataset.person.split(':');
      F.people.open({ kind, id }); return;
    }
    const vcard = e.target.closest('[data-video]');
    if (vcard && root.contains(vcard)) { F.video.open(vcard.dataset.video); return; }
    if (!card) return;
    const p = F.post(card.dataset.post); if (!p) return;
    const t = e.target;
    if (t.closest('[data-like]')) {
      const on = F.act.like(p);
      const b = t.closest('[data-like]'); b.classList.toggle('on', on); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      const n = b.querySelector('b'); if (n) n.textContent = F.num(F.likeCount(p));
      const pl = card.querySelector('.ph-likes'); if (pl) pl.textContent = F.num(F.likeCount(p)) + ' 次赞';
      if (b.classList.contains('qa-agree')) b.innerHTML = `${F.I('arrowUp')}赞同 ${F.num(F.likeCount(p))}`;
      if (b.classList.contains('ar-stat')) b.innerHTML = `${F.I('heart')}${F.num(F.likeCount(p))}`;
      return;
    }
    if (t.closest('[data-fav]')) {
      const on = F.act.fav(p); const b = t.closest('[data-fav]'); b.classList.toggle('on', on); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      const n = b.querySelector('b'); if (n) n.textContent = F.num(F.favCount(p));
      F.toast(on ? '已收藏' : '已取消收藏', 'fav', 1400); return;
    }
    if (t.closest('[data-repost]')) { F.act.repost(p); return; }
    if (t.closest('[data-vote]')) {
      if (F.act.vote(p, +t.closest('[data-vote]').dataset.vote)) {
        const blk = t.closest('.po-block');
        const tmp = document.createElement('div'); tmp.innerHTML = F.cards.pollBlock(p);
        const fresh = tmp.firstElementChild; const fills = fresh.querySelectorAll('.po-fill'); const w = [...fills].map(f => f.style.width);
        fills.forEach(f => f.style.width = '0%'); blk.replaceWith(fresh);
        requestAnimationFrame(() => requestAnimationFrame(() => fills.forEach((f, k) => f.style.width = w[k])));
        F.toast('投票成功', 'check', 1300);
      } else F.detail.open(p.id);
      return;
    }
    if (t.closest('[data-img]') && !card.classList.contains('c-photo')) { F.viewer(p.images, +t.closest('[data-img]').dataset.img); return; }
    if (p.type === 'repost') { if (p.ref) (p.ref.kind === 'video' ? F.video.open(p.ref.id) : F.detail.open(p.ref.id)); return; }
    F.detail.open(p.id);
  });
  // 图文轮播计数
  root.addEventListener('scroll', e => {
    const tr = e.target; if (!tr.classList || !tr.classList.contains('ph-track')) return;
    const i = Math.round(tr.scrollLeft / tr.clientWidth), st = tr.parentNode;
    const c = st.querySelector('.ph-count'); if (c) c.textContent = `${i + 1}/${tr.children.length}`;
    st.querySelectorAll('.ph-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
  }, true);
};