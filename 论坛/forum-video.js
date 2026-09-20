/* =========================================================
   论坛 · 短视频  forum-video.js
   AI 生成“逐帧脚本”→ 用 CSS 场景 + 镜头运动 + 字幕 + 花字 + 音效模拟播放
   每帧时长按台词与花字长度自动计算；关注 / 推荐双流；TikTok 式折叠评论
========================================================= */
F.video = { tab: 'rec', players: [] };

/* ---------------- 场景渲染 ---------------- */
F.vscene = {
  parts(bg, seed) {
    const r = F.rng(seed);
    const R = (a, b) => a + r() * (b - a);
    let h = '';
    const n = (k, fn) => { for (let i = 0; i < k; i++) h += fn(i); };
    switch (bg) {
      case 'rain': n(28, () => `<i class="pt rn" style="left:${R(0, 100)}%;height:${R(14, 34)}px;animation-duration:${R(.45, .9).toFixed(2)}s;animation-delay:-${R(0, 1).toFixed(2)}s;opacity:${R(.25, .6).toFixed(2)}"></i>`); break;
      case 'snow': n(26, () => { const s = R(3, 8); return `<i class="pt sn" style="left:${R(0, 100)}%;width:${s}px;height:${s}px;animation-duration:${R(5, 11).toFixed(1)}s;animation-delay:-${R(0, 10).toFixed(1)}s"></i>`; }); break;
      case 'night': n(12, () => { const s = R(14, 46); return `<i class="pt bk" style="left:${R(0, 95)}%;top:${R(8, 70)}%;width:${s}px;height:${s}px;animation-delay:-${R(0, 4).toFixed(1)}s"></i>`; }); break;
      case 'neon': n(5, i => `<i class="pt ne" style="top:${14 + i * 15 + R(-4, 4)}%;left:${R(-10, 30)}%;width:${R(40, 80)}%;animation-delay:-${R(0, 3).toFixed(1)}s"></i>`); break;
      case 'street': n(8, i => `<i class="pt bd" style="left:${i * 13 - 4 + R(-2, 2)}%;width:${R(10, 16)}%;height:${R(34, 70)}%"></i>`); h += '<i class="pt lt"></i>'; break;
      case 'sea': n(3, i => `<i class="pt wv" style="bottom:${-40 + i * 9}%;animation-duration:${6 + i * 2}s;opacity:${.35 + i * .2}"></i>`); h += '<i class="pt sun"></i>'; break;
      case 'nature': n(3, i => `<i class="pt hl" style="bottom:${-30 + i * 8}%;left:${-30 + R(-10, 20)}%;opacity:${.3 + i * .25}"></i>`); h += '<i class="pt sun"></i>'; break;
      case 'cafe': n(6, i => `<i class="pt wn" style="left:${8 + (i % 3) * 30}%;top:${10 + Math.floor(i / 3) * 24}%"></i>`); n(2, i => `<i class="pt st" style="left:${44 + i * 8}%;animation-delay:-${i}s"></i>`); h += '<i class="pt cup"></i>'; break;
      case 'stage': n(3, i => `<i class="pt sp" style="left:${18 + i * 30}%;animation-delay:-${i * 1.3}s"></i>`); h += '<i class="pt fl"></i>'; break;
      case 'studio': h += '<i class="pt so"></i><i class="pt fl"></i>'; break;
      case 'food': h += '<i class="pt pl"></i>'; n(3, i => `<i class="pt st" style="left:${42 + i * 7}%;bottom:48%;animation-delay:-${i * .7}s"></i>`); break;
      case 'crowd': n(18, i => `<i class="pt hd" style="left:${i * 6 - 4 + R(-2, 2)}%;bottom:${R(-8, 10)}%;animation-delay:-${R(0, 2).toFixed(1)}s;transform:scale(${R(.8, 1.3).toFixed(2)})"></i>`); n(8, () => `<i class="pt fsh" style="left:${R(0, 100)}%;top:${R(5, 45)}%;animation-delay:-${R(0, 5).toFixed(1)}s"></i>`); break;
      case 'car': h += '<i class="pt ws"></i><i class="pt db"></i>'; n(5, () => `<i class="pt ps" style="top:${R(30, 60)}%;animation-duration:${R(1.2, 2.6).toFixed(1)}s;animation-delay:-${R(0, 2).toFixed(1)}s"></i>`); break;
      case 'window': h += '<i class="pt wf"></i>'; n(9, i => `<i class="pt bl" style="top:${12 + i * 8}%"></i>`); break;
      case 'screen': h += '<i class="pt ui"><b></b><b></b><b></b><b></b></i><i class="pt cs"></i>'; break;
      default: h += '<i class="pt lp"></i><i class="pt sh"></i><i class="pt bed"></i>';
    }
    return h;
  },
  html(f, seed, still) {
    return `<div class="scn scn-${f.bg} t-${f.tone} ${still ? 'still' : 'mv-' + f.motion}" style="--dur:${(f.dur || 4).toFixed(2)}s"><div class="scn-bg">${this.parts(f.bg, seed)}</div><i class="scn-grain"></i></div>`;
  },
  thumb(v) { const f = v.frames[Math.min(1, v.frames.length - 1)]; return this.html(f, v.id + 't', true); }
};
F.video.fmt = s => { s = Math.round(s); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

/* ---------------- 列表中的视频卡片 ---------------- */
F.cards.renderVideo = v => {
  const a = F.person(v.author);
  return `<article class="card c-video" data-video="${v.id}">
    <div class="cv-thumb">${F.vscene.thumb(v)}<span class="cv-play">${F.I('play')}</span><span class="cv-dur num-font">${F.video.fmt(v.duration)}</span></div>
    <div class="cv-main">
      <span class="cv-type">${F.I((F.VTYPES[v.type] || {}).icon || 'play')}${F.typeName(v.type)}</span>
      <h4 class="clamp2">${F.esc(F.plain(v.title))}</h4>
      <div class="cv-by">${F.avatarHTML(a, 20)}<b>${F.esc(a.nickname)}</b>${F.isVerified(a) ? F.vbadge(a.kind !== 'char') : ''}</div>
      <div class="cv-stat"><span>${F.I('heart')}${F.num(F.likeCount(v))}</span><span>${F.I('comment')}${F.commentCount(v)}</span><span>${F.I('eye')}${F.num(v.stats.views)}</span></div>
    </div></article>`;
};

/* ---------------- 单条视频的界面 ---------------- */
F.video.slideHTML = v => {
  const a = F.person(v.author);
  const self = v.author.kind === 'user' && v.author.id === F.state.activeIdentityId;
  const fol = F.isFollowing(v.author);
  const ab = v.about ? F.person(v.about) : null;
  return `<section class="vs" data-vid="${v.id}">
    <div class="vs-stage"></div>
    <div class="vs-shade"></div>
    <div class="vs-desc"><span class="vs-desc-ic">${F.I('camera')}</span><p></p></div>
    <div class="vs-on"></div>
    <div class="vs-sfx"></div>
    <div class="vs-pause">${F.I('play')}</div>
    <div class="vs-rail">
      <button class="vs-av" data-person="${v.author.kind}:${v.author.id}">${F.avatarHTML(a, 46)}${!self && !fol ? `<span class="vs-fo" data-vfollow>${F.I('plus')}</span>` : ''}</button>
      <button class="vs-btn ${F.act.liked(v) ? 'on' : ''}" data-vlike>${F.I('heart')}<b>${F.num(F.likeCount(v))}</b></button>
      <button class="vs-btn" data-vcomment>${F.I('comment')}<b>${F.num(F.commentCount(v))}</b></button>
      <button class="vs-btn ${F.act.faved(v) ? 'on' : ''}" data-vfav>${F.I('fav')}<b>${F.num(F.favCount(v))}</b></button>
      <button class="vs-btn" data-vrepost>${F.I('repost')}<b>${F.num(v.stats.reposts)}</b></button>
    </div>
    <div class="vs-info">
      ${ab ? `<span class="vs-about" data-person="${v.about.kind}:${v.about.id}">${F.I('crown')}${F.esc(ab.nickname)}</span>` : ''}
      <div class="vs-who" data-person="${v.author.kind}:${v.author.id}"><b>@${F.esc(a.nickname)}</b>${F.isVerified(a) ? F.vbadge(false) : ''}<span>${F.typeName(v.type)} · ${F.ago(v.createdAt)}</span></div>
      <p class="vs-cap" data-vcap>${F.inline(v.title)}</p>
      ${v.topic ? `<button class="vs-topic" data-vtopic="${F.esc(v.topic)}">${F.I('hash')}${F.esc(v.topic)}</button>` : ''}
      ${v.music ? `<div class="vs-music"><span class="vs-disc"></span><div class="vs-mq"><span>${F.esc(v.music)}　　${F.esc(v.music)}　　</span></div></div>` : ''}
      <div class="vs-sub"><b></b><p></p></div>
    </div>
    <div class="vs-prog">${v.frames.map(f => `<i style="flex:${f.dur.toFixed(2)}"><b></b></i>`).join('')}</div>
    <div class="vs-time num-font"></div>
  </section>`;
};

/* ---------------- 播放器 ---------------- */
F.video.player = (el, v) => {
  const stage = el.querySelector('.vs-stage'), desc = el.querySelector('.vs-desc p'), on = el.querySelector('.vs-on'), sfx = el.querySelector('.vs-sfx');
  const subB = el.querySelector('.vs-sub b'), subP = el.querySelector('.vs-sub p'), sub = el.querySelector('.vs-sub');
  const bars = [...el.querySelectorAll('.vs-prog b')], time = el.querySelector('.vs-time');
  const P = { i: -1, t: 0, playing: false, raf: 0, last: 0, counted: false, el, v };
  const show = i => {
    const f = v.frames[i]; P.i = i; P.t = 0;
    const node = document.createElement('div'); node.className = 'vs-layer'; node.innerHTML = F.vscene.html(f, v.id + i);
    stage.appendChild(node);
    requestAnimationFrame(() => node.classList.add('in'));
    const olds = [...stage.children].slice(0, -1); olds.forEach(o => { o.classList.remove('in'); setTimeout(() => o.remove(), 700); });
    desc.textContent = f.scene; el.querySelector('.vs-desc').classList.toggle('empty', !f.scene);
    on.innerHTML = f.text ? `<span>${F.esc(f.text)}</span>` : ''; on.classList.remove('pop'); void on.offsetWidth; if (f.text) on.classList.add('pop');
    sfx.innerHTML = f.sfx ? `${F.I('bolt')}${F.esc(f.sfx)}` : ''; sfx.classList.toggle('show', !!f.sfx);
    subB.textContent = f.line ? (f.speaker || '旁白') : ''; subP.textContent = f.line || ''; sub.classList.toggle('show', !!f.line);
    sub.classList.remove('fresh'); void sub.offsetWidth; sub.classList.add('fresh');
    bars.forEach((b, k) => { b.style.transition = 'none'; b.style.width = k < i ? '100%' : '0%'; });
  };
  const tick = ts => {
    if (!P.playing) return;
    const dt = P.last ? (ts - P.last) / 1000 : 0; P.last = ts;
    P.t += dt;
    const f = v.frames[P.i];
    bars[P.i].style.width = Math.min(100, P.t / f.dur * 100) + '%';
    const passed = v.frames.slice(0, P.i).reduce((s, x) => s + x.dur, 0) + P.t;
    time.textContent = `${F.video.fmt(passed)} / ${F.video.fmt(v.duration)}`;
    if (P.t >= f.dur) {
      if (P.i + 1 < v.frames.length) show(P.i + 1);
      else { if (!P.counted) { v.stats.views++; P.counted = true; F.save('videos'); } show(0); }
    }
    P.raf = requestAnimationFrame(tick);
  };
  P.play = () => { if (P.playing) return; if (P.i < 0) show(0); P.playing = true; P.last = 0; el.classList.remove('paused'); P.raf = requestAnimationFrame(tick); };
  P.pause = () => { P.playing = false; cancelAnimationFrame(P.raf); el.classList.add('paused'); };
  P.toggle = () => P.playing ? P.pause() : P.play();
  P.seekFrame = i => { show(F.clamp(i, 0, v.frames.length - 1)); if (!P.playing) P.play(); };
  show(0); el.classList.add('paused');
  return P;
};

/* ---------------- 视频流（Tab 与单独页面共用） ---------------- */
F.video.mountFeed = (box, list, { scroller } = {}) => {
  const players = [];
  box.innerHTML = list.map(F.video.slideHTML).join('');
  box.querySelectorAll('.vs').forEach((el, k) => {
    const v = list[k]; const P = F.video.player(el, v); players.push(P);
    el.addEventListener('click', e => F.video.onSlideClick(e, el, v, P));
    // 双击点赞
    let lastTap = 0;
    el.querySelector('.vs-stage').parentNode.addEventListener('pointerup', e => {
      if (e.target.closest('button,[data-person],.vs-cap,.vs-topic')) return;
      const now = Date.now();
      if (now - lastTap < 280) { if (!F.act.liked(v)) { F.act.like(v); F.video.syncRail(el, v); } F.video.burst(el, e); }
      lastTap = now;
    });
  });
  const io = new IntersectionObserver(ents => ents.forEach(en => {
    const P = players.find(p => p.el === en.target); if (!P) return;
    if (en.isIntersecting && en.intersectionRatio > .6) { players.forEach(o => o !== P && o.pause()); P.play(); box._active = P; }
    else P.pause();
  }), { root: scroller || box, threshold: [0, .6, 1] });
  box.querySelectorAll('.vs').forEach(el => io.observe(el));
  box._players = players; box._io = io;
  return players;
};
F.video.onSlideClick = (e, el, v, P) => {
  const t = e.target;
  if (t.closest('[data-vfollow]')) { e.stopPropagation(); if (!F.isFollowing(v.author)) F.people.toggleFollow(v.author); t.closest('[data-vfollow]').remove(); return; }
  const pe = t.closest('[data-person]'); if (pe) { const [kind, id] = pe.dataset.person.split(':'); F.people.open({ kind, id }); return; }
  if (t.closest('[data-vlike]')) { F.act.like(v); F.video.syncRail(el, v); t.closest('[data-vlike]').classList.add('pop'); return; }
  if (t.closest('[data-vfav]')) { const on = F.act.fav(v); F.video.syncRail(el, v); F.toast(on ? '已收藏' : '已取消收藏', 'fav', 1200); return; }
  if (t.closest('[data-vrepost]')) { F.share.open(v); return; }
  if (t.closest('[data-vcomment]')) { F.video.comments(v, () => F.video.syncRail(el, v)); return; }
  if (t.closest('[data-vtopic]')) { F.hot.topic(t.closest('[data-vtopic]').dataset.vtopic, v.worldId); return; }
  if (t.closest('[data-vcap]')) { t.closest('[data-vcap]').classList.toggle('open'); return; }
  const bar = t.closest('.vs-prog i'); if (bar) { P.seekFrame([...bar.parentNode.children].indexOf(bar)); return; }
  P.toggle();
};
F.video.syncRail = (el, v) => {
  const set = (sel, on, n) => { const b = el.querySelector(sel); if (!b) return; b.classList.toggle('on', !!on); b.querySelector('b').textContent = n; };
  set('[data-vlike]', F.act.liked(v), F.num(F.likeCount(v)));
  set('[data-vfav]', F.act.faved(v), F.num(F.favCount(v)));
  set('[data-vcomment]', false, F.num(F.commentCount(v)));
  set('[data-vrepost]', false, F.num(v.stats.reposts));
};
F.video.burst = (el, e) => {
  const r = el.getBoundingClientRect();
  const h = document.createElement('span'); h.className = 'vs-burst'; h.innerHTML = F.I('heart');
  h.style.left = (e.clientX - r.left) + 'px'; h.style.top = (e.clientY - r.top) + 'px';
  el.appendChild(h); setTimeout(() => h.remove(), 900);
};
F.video.pauseAll = () => {
  document.querySelectorAll('.vt-feed, .vp-feed').forEach(b => (b._players || []).forEach(p => p.pause()));
};

/* ---------------- 短视频 Tab ---------------- */
F.tabs.renderers.video = (view) => {
  view._darkTop = true;
  view.classList.add('vtab');
  const myFollow = F.me().following || [];
  const all = F.state.videos.slice().sort((a, b) => b.createdAt - a.createdAt);
  const list = F.video.tab === 'follow' ? all.filter(v => myFollow.some(r => F.refEq(r, v.author))) : F.video.recOrder(all);
  const sig = F.video.tab + '|' + list.map(v => v.id).join(',') + '|' + F.state.activeIdentityId;
  if (view._sig === sig && view.querySelector('.vt-feed')) {
    const box = view.querySelector('.vt-feed'); (box._players || []).forEach(p => F.video.syncRail(p.el, p.v));
    if (box._active) box._active.play();
    return;
  }
  view._sig = sig;
  const old = view.querySelector('.vt-feed'); if (old && old._io) old._io.disconnect();
  view.innerHTML = `
    <div class="vt-top">
      <span style="width:38px"></span>
      <div class="vt-tabs"><button data-vt="follow" class="${F.video.tab === 'follow' ? 'on' : ''}">关注</button><button data-vt="rec" class="${F.video.tab === 'rec' ? 'on' : ''}">推荐</button><i class="vt-line"></i></div>
      <button class="gorb lg lg-on-img" data-vgen>${F.I('spark')}</button>
    </div>
    <div class="vt-feed"></div>`;
  const box = view.querySelector('.vt-feed');
  if (!list.length) {
    const fol = F.video.tab === 'follow';
    box.innerHTML = `<div class="vt-empty">
      <div class="vd-frame"><div class="vd-screen">${F.art.photoSVG('video-a')}<div class="vd-play lg lg-on-img">${F.I('play')}</div></div><div class="vd-screen s2">${F.art.photoSVG('video-b')}</div><div class="vd-screen s3">${F.art.photoSVG('video-c')}</div></div>
      <h2>${fol ? '关注的人还没有发视频' : '还没有视频'}</h2>
      <p>${fol ? '去「推荐」看看，或在生成时让你关注的人来拍视频。' : '选择一个内容存档，挑选 Vlog、Reaction、二创等类型，AI 会写出逐帧脚本并模拟播放。'}</p>
      <button class="gbtn lgx lg lg-dark" data-vgen>${F.I('spark')}生成视频</button></div>`;
  } else F.video.mountFeed(box, list);
  view.querySelectorAll('[data-vgen]').forEach(b => b.onclick = () => F.video.genFlow());
  const tabs = view.querySelectorAll('[data-vt]'), line = view.querySelector('.vt-line');
  const place = () => { const on = view.querySelector('[data-vt].on'); line.style.left = on.offsetLeft + on.offsetWidth / 2 - 10 + 'px'; };
  requestAnimationFrame(place);
  tabs.forEach(b => b.onclick = () => { if (F.video.tab === b.dataset.vt) return; F.video.tab = b.dataset.vt; F.tabs.refresh(); });
};
/* 推荐：热度与新鲜度混排，关注的人略微加权 */
F.video.recOrder = list => list.map(v => {
  const age = (Date.now() - v.createdAt) / 3600e3;
  const s = Math.log10(1 + F.likeCount(v) + F.commentCount(v) * 5 + v.stats.views / 20) * 2 - age / 24 + (F.isFollowing(v.author) ? 1 : 0) + F.rng(v.id)() ;
  return [s, v];
}).sort((a, b) => b[0] - a[0]).map(x => x[1]);

/* ---------------- 单独打开某条视频（从主页、收藏、分享卡片进入） ---------------- */
F.video.open = (id) => {
  const v = F.vid(id); if (!v) return F.toast('视频已删除', 'close');
  F.video.pauseAll();
  F.nav.push((page, api) => {
    page.classList.add('vp-page');
    const more = F.videosBy(v.author).filter(x => x.id !== v.id);
    page.innerHTML = `<button class="gorb lg lg-on-img vp-back" data-back>${F.I('back')}</button><div class="vp-feed"></div>`;
    F.bindBack(page, api);
    const box = page.querySelector('.vp-feed');
    F.video.mountFeed(box, [v, ...more]);
    page._onLeave = () => { (box._players || []).forEach(p => p.pause()); box._io && box._io.disconnect(); };
    page._refresh = () => { (box._players || []).forEach(p => F.video.syncRail(p.el, p.v)); box._active && box._active.play(); };
  }, { darkTop: true });
};

/* ---------------- 评论面板：TikTok 式，楼中楼默认折叠 ---------------- */
F.video.comments = (v, onChange) => {
  F.video.pauseAll();
  const open = {}; const busy = new Set(); let target = null;
  F.sheet({
    cls: 'vc-sheet', foot: true, title: `${F.commentCount(v)} 条评论`,
    onClose: () => { onChange && onChange(); const box = document.querySelector('.tab-view.active .vt-feed, .page.in .vp-feed'); box && box._active && box._active.play(); },
    render(api) {
      const head = api.el.querySelector('.sheet-head h3');
      const refreshBtn = document.createElement('button'); refreshBtn.className = 'cm-refresh lg'; refreshBtn.innerHTML = `${F.I('refresh')}刷新`;
      api.el.querySelector('.sheet-head').insertBefore(refreshBtn, api.el.querySelector('.sheet-head [data-close]'));
      const who = ref => { const p = F.person(ref); return `<span data-person="${ref.kind}:${ref.id}">${F.esc(p.nickname)}</span>${F.isVerified(p) ? F.vbadge(p.kind !== 'char') : ''}${F.refEq(ref, v.author) ? '<em class="vc-au">作者</em>' : ''}${ref.kind === 'user' && ref.id === F.state.activeIdentityId ? '<em class="vc-me">我</em>' : ''}`; };
      const draw = (flash = []) => {
        head.textContent = `${F.commentCount(v)} 条评论`;
        const mineFirst = c => c.author.kind === 'user' && c.author.id === F.state.activeIdentityId ? 1 : 0;
        const list = v.comments.slice().sort((a, b) => mineFirst(b) - mineFirst(a) || (mineFirst(a) ? b.time - a.time : 0) || (b.likes + (b.likedBy || []).length) - (a.likes + (a.likedBy || []).length) || b.time - a.time);
        api.body.innerHTML = list.length ? list.map(c => {
          const reps = c.replies || [], shown = open[c.id] || 0;
          return `<div class="vc ${flash.includes(c.id) ? 'flash' : ''}" data-c="${c.id}">
            <div data-person="${c.author.kind}:${c.author.id}">${F.avatarHTML(F.person(c.author), 36)}</div>
            <div class="vc-main">
              <div class="vc-name">${who(c.author)}</div>
              <p class="vc-text" data-rc="${c.id}">${F.inline(c.text)}</p>
              <div class="vc-sub"><span>${F.ago(c.time)}</span><button data-rc="${c.id}">回复</button></div>
              ${shown ? `<div class="vc-reps">${reps.slice(0, shown).map(r => `<div class="vc-rp ${flash.includes(r.id) ? 'flash' : ''}">
                  <div data-person="${r.author.kind}:${r.author.id}">${F.avatarHTML(F.person(r.author), 24)}</div>
                  <div class="vc-main"><div class="vc-name">${who(r.author)}</div>
                    <p class="vc-text" data-rr="${c.id}|${r.id}">${r.replyToName ? `<span class="to">回复 ${F.esc(r.replyToName)}</span> ` : ''}${F.inline(r.text)}</p>
                    <div class="vc-sub"><span>${F.ago(r.time)}</span><button data-rr="${c.id}|${r.id}">回复</button></div></div>
                  <button class="vc-like ${(r.likedBy || []).includes(F.state.activeIdentityId) ? 'on' : ''}" data-lr="${c.id}|${r.id}">${F.I('heart')}<span>${r.likes + (r.likedBy || []).length || ''}</span></button>
                </div>`).join('')}</div>` : ''}
              ${busy.has(c.id) ? `<div class="cm-typing"><span><i></i><i></i><i></i></span>对方正在回复</div>` : ''}
              ${reps.length ? `<div class="vc-fold">${shown < reps.length ? `<button data-more="${c.id}"><i></i>展开${shown ? '更多' : ` ${reps.length} 条`}回复${F.I('down')}</button>` : ''}${shown ? `<button data-less="${c.id}">收起</button>` : ''}</div>` : ''}
            </div>
            <button class="vc-like ${(c.likedBy || []).includes(F.state.activeIdentityId) ? 'on' : ''}" data-lc="${c.id}">${F.I('heart')}<span>${c.likes + (c.likedBy || []).length || ''}</span></button>
          </div>`;
        }).join('') : `<div class="empty" style="padding:40px 20px"><p>还没有评论，来抢个沙发。</p></div>`;
      };
      draw();
      const findC = id => v.comments.find(c => c.id === id);
      api.body.onclick = e => {
        const t = e.target;
        const pe = t.closest('[data-person]'); if (pe && !t.closest('.vc-text')) { const [kind, id] = pe.dataset.person.split(':'); api.close(); setTimeout(() => F.people.open({ kind, id }), 300); return; }
        const m = t.closest('[data-more]'); if (m) { const c = findC(m.dataset.more); open[c.id] = Math.min(c.replies.length, (open[c.id] || 0) + 3); return draw(); }
        const l = t.closest('[data-less]'); if (l) { open[l.dataset.less] = 0; return draw(); }
        const lc = t.closest('[data-lc]'); if (lc) { F.act.likeComment(findC(lc.dataset.lc)); return draw(); }
        const lr = t.closest('[data-lr]'); if (lr) { const [c, r] = lr.dataset.lr.split('|'); F.act.likeComment(findC(c).replies.find(x => x.id === r)); return draw(); }
        const rc = t.closest('[data-rc]'); if (rc) return setTarget({ comment: findC(rc.dataset.rc) });
        const rr = t.closest('[data-rr]'); if (rr) { const [c, r] = rr.dataset.rr.split('|'); const cc = findC(c); return setTarget({ comment: cc, reply: cc.replies.find(x => x.id === r) }); }
      };
      api.foot.innerHTML = `<div class="vc-to" style="display:none"></div><div class="dt-input lg" style="--lg-r:22px">${F.avatarHTML(F.me(), 28)}<textarea rows="1" maxlength="500" placeholder="善语结善缘，说点什么…"></textarea><button class="dt-send" disabled>${F.I('send')}</button></div>`;
      const ta = api.foot.querySelector('textarea'), send = api.foot.querySelector('.dt-send'), to = api.foot.querySelector('.vc-to');
      const setTarget = tg => {
        target = tg;
        if (tg) { const p = F.person((tg.reply || tg.comment).author); to.style.display = 'flex'; to.innerHTML = `回复 <b>@${F.esc(p.nickname)}</b><button>取消</button>`; to.querySelector('button').onclick = () => setTarget(null); ta.placeholder = `回复 @${p.nickname}`; ta.focus(); }
        else { to.style.display = 'none'; ta.placeholder = '善语结善缘，说点什么…'; }
      };
      ta.oninput = () => { send.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(96, ta.scrollHeight) + 'px'; };
      send.onclick = async () => {
        const text = ta.value.trim(); if (!text) return;
        const me = { kind: 'user', id: F.state.activeIdentityId };
        const tg = target; let parent, mine;
        if (tg) { parent = tg.comment; const toRef = (tg.reply || tg.comment).author; mine = { id: F.uid('rp'), author: me, replyTo: toRef, replyToName: tg.reply ? F.person(toRef).nickname : '', text, likes: 0, likedBy: [], time: Date.now() }; parent.replies.push(mine); open[parent.id] = parent.replies.length; }
        else { mine = { id: F.uid('cm'), author: me, text, likes: 0, likedBy: [], time: Date.now(), replies: [] }; v.comments.push(mine); parent = mine; }
        ta.value = ''; ta.oninput(); setTarget(null);
        await F.save('videos');
        busy.add(parent.id); draw([mine.id]);
        if (!F.ai.ready()) { busy.delete(parent.id); draw(); return F.toast('配置 API 后，评论会收到回复', 'gear', 2400); }
        try {
          const reps = await F.ai.replyToUser(v, { comment: tg ? tg.comment : null, reply: tg ? tg.reply : null, text });
          reps.forEach((r, i) => { r.replyTo = me; r.replyToName = i === 0 ? F.me().nickname : ''; parent.replies.push(r); });
          open[parent.id] = parent.replies.length;
          await F.save('videos', 'npcs');
          busy.delete(parent.id); draw(reps.map(r => r.id));
        } catch (err) { busy.delete(parent.id); draw(); F.toast('回复生成失败：' + err.message, 'close', 3000); }
      };
      refreshBtn.onclick = async () => {
        if (refreshBtn.classList.contains('busy')) return;
        if (!F.ai.ready()) return F.toast('请先到桌面「设置 › API」配置接口', 'gear', 2400);
        refreshBtn.classList.add('busy');
        const before = new Set(v.comments.flatMap(c => [c.id, ...c.replies.map(r => r.id)]));
        try {
          const o = { ...v.stats };
          await F.ai.refreshPost(v); await F.save('videos', 'npcs');
          draw(v.comments.flatMap(c => [c.id, ...c.replies.map(r => r.id)]).filter(id => !before.has(id)));
          F.toast(`播放 +${F.num(v.stats.views - o.views)} · 赞 +${F.num(v.stats.likes - o.likes)}`, 'chart', 2400);
        } catch (err) { F.toast('刷新失败：' + err.message, 'close', 3000); }
        refreshBtn.classList.remove('busy');
      };
    }
  });
};

/* ---------------- 生成视频：选择存档 → 类型计数 → 参与者 / 正主 → 生成 ---------------- */
F.video.genFlow = async (opts = {}) => {
  if (!F.state.worlds.length) { F.toast('先建立一个内容存档', 'grid'); return F.home.openWorlds(); }
  let w = opts.world || F.world(F.home.cat) || F.state.worlds.slice().sort((a, b) => (b.lastGenAt || 0) - (a.lastGenAt || 0))[0];
  const counts = {}; F.VTYPE_ORDER.forEach(t => counts[t] = 0);
  const fixed = opts.authorRef || null;
  let joinFollow = !fixed, picked = [], authorN = 0, extra = opts.topic ? `围绕话题 #${opts.topic}# 拍摄` : '';
  const pro = F.home.proState(w);
  const MAX = 12;
  const followPool = () => {
    const refs = (F.me().following || []).filter(r => r.kind === 'char' || (r.kind === 'npc' && F.npc(r.id)));
    F.state.charProfiles.forEach(c => { if (!refs.some(r => r.kind === 'char' && r.id === c.id)) refs.push({ kind: 'char', id: c.id, _notFollowed: true }); });
    return refs;
  };
  F.sheet({
    title: fixed ? `让 ${F.person(fixed).nickname} 发视频` : opts.topic ? `#${opts.topic}# 视频` : '生成视频', sub: '选择存档与视频类型，可自由组合', foot: true, cls: 'gen-sheet',
    render(api) {
      const total = () => Object.values(counts).reduce((s, x) => s + x, 0);
      const draw = () => {
        const T = total();
        authorN = Math.min(authorN, T, picked.length ? T : 0);
        const pool = followPool();
        api.body.innerHTML = `
          <div class="group-title" style="margin-top:4px">内容存档</div>
          <div class="chips gs-worlds">${F.state.worlds.map(x => `<button class="chip ${x.id === w.id ? 'on' : ''}" data-w="${x.id}">${F.esc(x.theme || x.name)}</button>`).join('')}</div>
          <div class="group-title">视频类型</div>
          <div class="gs-types">${F.VTYPE_ORDER.map(t => `
            <div class="gs-type ${counts[t] ? 'has' : ''}"><span class="gs-glyph gv">${F.I(F.VTYPES[t].icon)}</span>
              <div class="gs-main"><b>${F.VTYPES[t].name}</b><small>${F.VTYPES[t].blurb}</small></div>
              <div class="stepper ${counts[t] ? 'has' : ''}"><button data-m="${t}" ${counts[t] ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button><span class="num">${counts[t]}</span><button data-p="${t}" ${T >= MAX ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button></div>
            </div>`).join('')}</div>
          ${fixed ? '' : `
          <div class="group-title">关注的人是否参与</div>
          <div class="group"><div class="row"><div class="r-main"><div class="r-title">让关注的人参与生成</div><div class="r-sub">选中的人会拍视频、在评论区出现</div></div>${F.switchHTML('jf', joinFollow)}</div></div>
          ${joinFollow ? (pool.length ? `<div class="vg-people">${pool.map(r => { const p = F.person(r); const on = picked.some(x => F.refEq(x, r)); return `<button class="vg-p ${on ? 'on' : ''}" data-pk="${r.kind}:${r.id}">${F.avatarHTML(p, 44)}<span class="sh-ck">${F.I('check')}</span><small>${F.esc(p.nickname)}</small><i>${r.kind === 'char' ? (r._notFollowed ? '角色' : '角色·已关注') : '已关注'}</i></button>`; }).join('')}</div>
            ${picked.length && T ? `<div class="gs-cp"><div><b>其中由他们发布</b><small>其余由世界里的视频博主发布</small></div><div class="stepper ${authorN ? 'has' : ''}"><button data-am ${authorN ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button><span class="num">${authorN}</span><button data-ap ${authorN >= T ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button></div></div>` : ''}`
            : `<p class="hint" style="margin:0 8px 12px">你还没有关注任何博主或角色。</p>`) : ''}`}
          ${F.home.proHTML(pro)}
          <div class="group-title">本次侧重（选填）</div>
          <textarea class="textarea" id="vgExtra" rows="2" maxlength="300" placeholder="如：围绕昨晚的演唱会；多一点反转">${F.esc(extra)}</textarea>`;
        api.foot.innerHTML = `<button class="gbtn lgx lg lg-dark block gs-go" ${T ? '' : 'disabled'}>${F.I('spark')}${T ? `生成 ${T} 条视频` : '先选择视频类型'}</button><p class="hint" style="text-align:center;margin-top:8px">${T ? `逐条调用 AI，共 ${T} 次，每次上限 ${Math.max(12000, F.state.settings.maxTokens)} tokens` : `单次最多 ${MAX} 条`}</p>`;
        api.body.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { w = F.world(b.dataset.w); Object.assign(pro, F.home.proState(w)); draw(); });
        api.body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { if (total() < MAX) { counts[b.dataset.p]++; draw(); } });
        api.body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { counts[b.dataset.m] = Math.max(0, counts[b.dataset.m] - 1); draw(); });
        const jf = api.body.querySelector('[data-sw="jf"]'); if (jf) jf.onchange = () => { joinFollow = jf.checked; if (!joinFollow) picked = []; draw(); };
        api.body.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.pk.split(':'); const i = picked.findIndex(r => r.kind === k && r.id === id); i < 0 ? picked.push({ kind: k, id }) : picked.splice(i, 1); if (i < 0 && !authorN) authorN = 1; draw(); });
        const ap = api.body.querySelector('[data-ap]'); if (ap) ap.onclick = () => { authorN++; draw(); };
        const am = api.body.querySelector('[data-am]'); if (am) am.onclick = () => { authorN--; draw(); };
        F.home.proBind(api.body, pro, draw);
        api.body.querySelector('#vgExtra').oninput = e => extra = e.target.value;
        api.foot.querySelector('.gs-go').onclick = () => {
          if (!F.ai.ready()) return F.toast('请先到桌面「设置 › API」配置接口与模型', 'gear', 3000);
          const bag = []; const left = { ...counts };
          while (Object.values(left).some(x => x)) F.VTYPE_ORDER.forEach(t => { if (left[t]) { bag.push(t); left[t]--; } });
          const slots = new Set(); const step = authorN ? bag.length / authorN : 0;
          for (let k = 0; k < authorN; k++) slots.add(Math.floor(k * step + step / 2));
          let ai = 0;
          const charIds = picked.filter(r => r.kind === 'char').map(r => r.id);
          const jobs = bag.map((type, index) => {
            const job = { kind: 'video', index, type, worldId: w.id, extra: extra.trim(), chars: charIds, roles: {}, status: 'wait', protagonist: F.home.proJob(pro), topic: opts.topic || '' };
            if (fixed) { if (fixed.kind === 'char') job.authorChar = fixed.id; else job.authorNpc = fixed.id; }
            else if (slots.has(index) && picked.length) { const r = picked[(ai++) % picked.length]; if (r.kind === 'char') job.authorChar = r.id; else job.authorNpc = r.id; }
            return job;
          });
          F.home.saveProDefault(w, pro);
          api.close();
          setTimeout(() => F.home.runGen(w, jobs), 380);
        };
      };
      draw();
    }
  });
};
