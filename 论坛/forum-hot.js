/* =========================================================
   论坛 · 热搜  forum-hot.js
   · 按所选存档调用 AI 生成 50 条热搜（带导语、上榜时间、最高排名、引爆帖）
   · Tab：领奖台 + 前 10 + 热门帖子（5 种不同类型）+ 热门视频 + 人气博主
   · 完整榜单页（50 条，可按领域筛选）· 话题详情页
   · 没有生成过榜单时，按广场真实数据实时计算
========================================================= */
F.hot = { world: null };

F.hot.match = (p, name) => p.topic === name || (p.tags || []).includes(name) || String((p.title || '') + (p.content || '')).includes('#' + name + '#');
F.hot.heatOf = p => ((p.stats.views || 0) / 10 + F.likeCount(p) + F.commentCount(p) * 4 + F.favCount(p) * 2 + (p.stats.reposts || 0) * 3) * (1 + Math.max(0, 1 - (Date.now() - p.createdAt) / (86400e3 * 3)));
F.hot.pool = wid => [...F.state.posts.filter(p => p.type !== 'repost' && p.visibility !== 'self'), ...F.state.videos].filter(p => !wid || p.worldId === wid);

/* 实时计算（兜底） */
F.hot.compute = wid => {
  const map = {};
  F.hot.pool(wid).forEach(p => {
    const h = F.hot.heatOf(p);
    new Set([p.topic, ...(p.tags || [])].filter(Boolean).map(s => String(s).trim())).forEach(k => {
      const m = map[k] = map[k] || { title: k, heat: 0, n: 0, latest: 0 };
      m.heat += h; m.n++; m.latest = Math.max(m.latest, p.createdAt);
    });
  });
  const arr = Object.values(map).sort((a, b) => b.heat - a.heat);
  const max = arr[0] ? arr[0].heat : 1;
  return arr.slice(0, 50).map((m, i) => ({
    rank: i + 1, title: m.title, heat: Math.round(m.heat * 37), computed: true, category: '',
    tag: Date.now() - m.latest < 7200e3 ? '新' : m.heat > max * .7 ? '沸' : m.heat > max * .35 ? '热' : '', trend: 'same', lead: '', discuss: m.n
  }));
};
F.hot.list = wid => { const h = wid && F.state.hotlists[wid]; return h && h.items.length ? h.items : F.hot.compute(wid); };
F.hot.item = (name, wid) => (F.hot.list(wid) || []).find(x => x.title === name);
F.hot.tagHTML = t => t ? `<i class="hs-flag f-${{ 爆: 'bao', 沸: 'boil', 热: 'hot', 新: 'new', 荐: 'rec', 独家: 'ex' }[t] || 'hot'}">${F.esc(t)}</i>` : '';
F.hot.trendHTML = t => t === 'up' ? `<span class="hs-tr up">${F.I('arrowUp')}</span>` : t === 'down' ? `<span class="hs-tr down">${F.I('arrowUp')}</span>` : t === 'new' ? '<span class="hs-tr nw">NEW</span>' : '';

/* ---------------- 热搜 Tab ---------------- */
F.tabs.renderers.hot = view => {
  const ws = F.state.worlds;
  if (!F.hot.world || !F.world(F.hot.world)) F.hot.world = (F.world(F.home.cat) || ws.slice().sort((a, b) => (b.lastGenAt || 0) - (a.lastGenAt || 0))[0] || {}).id || null;
  const w = F.world(F.hot.world);
  const saved = w && F.state.hotlists[w.id];
  const list = F.hot.list(w && w.id);
  const top = list.slice(0, 10);
  const maxH = top[0] ? top[0].heat : 1;
  // 热门帖子：5 种不同类型各取最热一条
  const pool = F.hot.pool(w && w.id).filter(p => !p.frames).sort((a, b) => F.hot.heatOf(b) - F.hot.heatOf(a));
  const seenT = new Set(), hotPosts = [];
  pool.forEach(p => { if (hotPosts.length < 5 && !seenT.has(p.type)) { seenT.add(p.type); hotPosts.push(p); } });
  const hotVideos = F.hot.pool(w && w.id).filter(p => p.frames).sort((a, b) => F.hot.heatOf(b) - F.hot.heatOf(a)).slice(0, 6);
  const bloggers = [...F.state.npcs.filter(n => !w || n.worldId === w.id).map(n => ({ kind: 'npc', id: n.id })), ...F.state.charProfiles.map(c => ({ kind: 'char', id: c.id }))]
    .map(r => ({ r, p: F.person(r) })).sort((a, b) => F.followerCount(b.p) - F.followerCount(a.p)).slice(0, 10);

  view.innerHTML = `
    <div class="hs-top"><h1>热搜</h1><small>${w ? `「${F.esc(w.theme || w.name)}」此刻在讨论什么` : '建立内容存档后，这里会出现属于那个世界的热搜'}</small></div>
    ${ws.length ? `<div class="hs-worlds"><span class="cat-pill"></span>${ws.map(x => `<button class="cat ${x.id === F.hot.world ? 'on' : ''}" data-hw="${x.id}">${F.esc(x.theme || x.name)}</button>`).join('')}</div>` : ''}
    ${w ? `<div class="hs-bar-gen lg" style="--lg-r:22px">
      <div><b>${saved ? '热搜榜' : '实时热度'}</b><small>${saved ? `更新于 ${F.ago(saved.at)} · ${saved.items.length} 条` : '按广场里的真实互动计算 · 生成后有完整 50 条榜单'}</small></div>
      <button class="gbtn sm lg lg-dark" data-hgen>${F.I('spark')}${saved ? '刷新榜单' : '生成热搜'}</button></div>` : ''}
    ${!top.length ? `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I('flame')}</div><h4>还没有热搜</h4><p>${w ? '点上方「生成热搜」，AI 会按这个世界的世界观写出完整的 50 条榜单。' : '先在首页「生成」里建立一个内容存档。'}</p>${w ? '' : `<button class="gbtn lgx lg lg-dark" data-hworlds>${F.I('plus')}建立内容存档</button>`}</div>` : `
    <div class="hs-podium">${top.slice(0, 3).map((t, i) => `
      <button class="hs-pod p${i + 1}" data-topic="${F.esc(t.title)}">
        <span class="hs-rank num-font">${i + 1}</span>
        <div class="hs-pod-t"><b>${F.esc(t.title)}</b>${F.hot.tagHTML(t.tag)}</div>
        ${t.lead ? `<p class="clamp2">${F.esc(t.lead)}</p>` : ''}
        <small>${F.num(t.heat)} 热度${t.since ? ' · ' + F.esc(t.since) + ' 上榜' : ''}${t.category ? ' · ' + F.esc(t.category) : ''}</small>
        <div class="hs-bar"><i style="width:${t.heat / maxH * 100}%"></i></div>
      </button>`).join('')}</div>
    <div class="hs-list">${top.slice(3).map(t => F.hot.rowHTML(t)).join('')}</div>
    ${list.length > 10 ? `<button class="gbtn lgx lg block hs-all" data-hall>${F.I('flame')}查看完整榜单 · ${list.length} 条</button>` : ''}`}
    ${hotPosts.length ? `<div class="hs-sec"><h3>热门帖子</h3><small>五种内容各取最热一条</small></div>
      <div class="hp-list">${hotPosts.map(p => { const a = F.person(p.author); return `
        <button class="hp" data-hp="${p.id}">
          <div class="hp-top"><span class="dt-type">${F.I((F.TYPES[p.type] || {}).icon || 'doc')}${F.typeName(p.type)}</span>${p.topic ? `<span class="hp-topic" data-topic="${F.esc(p.topic)}">#${F.esc(p.topic)}#</span>` : ''}</div>
          <b class="clamp2">${F.esc(p.title || (p.poll && p.poll.question) || F.plain(p.content).slice(0, 70))}</b>
          <div class="hp-by">${F.avatarHTML(a, 20)}<span>${F.esc(a.nickname)}</span><em>${F.I('heart')}${F.num(F.likeCount(p))}</em><em>${F.I('comment')}${F.commentCount(p)}</em></div>
        </button>`; }).join('')}</div>
      <p class="hint" style="text-align:center;margin:10px 20px 0">想看更多，点帖子上的话题进入对应话题页</p>` : ''}
    ${hotVideos.length ? `<div class="hs-sec"><h3>热门视频</h3></div><div class="hv-row">${hotVideos.map(v => `<button class="hv" data-hv="${v.id}"><div class="hv-th">${F.vscene.thumb(v)}<span>${F.I('play')}${F.num(v.stats.views)}</span></div><b class="clamp2">${F.esc(F.plain(v.title))}</b></button>`).join('')}</div>` : ''}
    ${bloggers.length ? `<div class="hs-sec"><h3>人气博主</h3></div>
    <div class="hs-people">${bloggers.map(({ r, p }) => `<button class="hs-person" data-p="${r.kind}:${r.id}">${F.avatarHTML(p, 58)}<b>${F.esc(p.nickname)}</b><small>${F.num(F.followerCount(p))} 粉丝</small></button>`).join('')}</div>` : ''}`;

  const track = view.querySelector('.hs-worlds');
  if (track) {
    const pill = track.querySelector('.cat-pill');
    const place = () => { const on = track.querySelector('.cat.on'); if (on) { pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; } };
    requestAnimationFrame(place);
    track.querySelectorAll('[data-hw]').forEach(b => b.onclick = () => { F.hot.world = b.dataset.hw; F.tabs.refresh(); });
  }
  view.querySelectorAll('[data-topic]').forEach(b => b.onclick = e => { e.stopPropagation(); F.hot.topic(b.dataset.topic, F.hot.world); });
  view.querySelectorAll('[data-hp]').forEach(b => b.onclick = () => F.detail.open(b.dataset.hp));
  view.querySelectorAll('[data-hv]').forEach(b => b.onclick = () => F.video.open(b.dataset.hv));
  view.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const [kind, id] = b.dataset.p.split(':'); F.people.open({ kind, id }); });
  const all = view.querySelector('[data-hall]'); if (all) all.onclick = () => F.hot.board(F.hot.world);
  const hw = view.querySelector('[data-hworlds]'); if (hw) hw.onclick = () => F.home.openWorlds();
  const g = view.querySelector('[data-hgen]'); if (g) g.onclick = () => F.hot.generate(w, g);
};

F.hot.rowHTML = t => `
  <button class="hs-item" data-topic="${F.esc(t.title)}">
    <span class="hs-n num-font ${t.rank <= 3 ? 'top' : ''}">${t.rank}</span>
    <div class="hs-main"><div class="hs-t"><b>${F.esc(t.title)}</b>${F.hot.tagHTML(t.tag)}</div>
      <small>${F.num(t.heat)}${t.category ? ' · ' + F.esc(t.category) : ''}${t.since ? ' · ' + F.esc(t.since) : ''}</small></div>
    ${F.hot.trendHTML(t.trend)}
  </button>`;

F.hot.generate = async (w, btn) => {
  if (!F.ai.ready()) return F.toast('请先到桌面「设置 › API」配置接口', 'gear', 2600);
  if (btn.classList.contains('busy')) return;
  btn.classList.add('busy'); btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-color:rgba(255,255,255,.25);border-top-color:#fff"></span>生成中`;
  F.toast('正在生成 50 条热搜，大约需要半分钟', 'flame', 2600);
  try { await F.ai.hotlist(w); await F.save('hotlists'); F.toast('热搜榜已更新', 'flame'); }
  catch (e) { F.toast('生成失败：' + e.message, 'close', 3200); }
  if (F.tabs.current === 'hot' && !F.nav.stack.length) F.tabs.refresh();
};

/* ---------------- 完整榜单（新页面） ---------------- */
F.hot.board = wid => {
  F.nav.push((page, api) => {
    let cat = '全部';
    const draw = () => {
      const list = F.hot.list(wid);
      const w = F.world(wid);
      const cats = ['全部', ...new Set(list.map(t => t.category).filter(Boolean))];
      const L = cat === '全部' ? list : list.filter(t => t.category === cat);
      page.innerHTML = `${F.topbar('热搜榜', { sub: w ? `「${w.theme || w.name}」· ${list.length} 条` : '' })}
        <div class="page-scroll"><div class="hb">
          ${cats.length > 2 ? `<div class="chips hb-cats">${cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-c="${F.esc(c)}">${F.esc(c)}</button>`).join('')}</div>` : ''}
          <div class="hs-list" style="margin:0">${L.map(F.hot.rowHTML).join('')}</div>
        </div></div>`;
      F.bindBack(page, api);
      page.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
      page.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => F.hot.topic(b.dataset.topic, wid));
    };
    draw(); page._refresh = draw;
  });
};

/* ---------------- 话题页（新页面） ---------------- */
F.hot.topic = (name, wid) => {
  F.nav.push((page, api) => {
    let sort = 'hot';
    const draw = () => {
      const it = F.hot.item(name, wid) || F.hot.item(name, null);
      const rel = F.hot.pool(null).filter(p => F.hot.match(p, name) && (!wid || !p.worldId || p.worldId === wid));
      const L = rel.slice().sort(sort === 'hot' ? (a, b) => F.hot.heatOf(b) - F.hot.heatOf(a) : (a, b) => b.createdAt - a.createdAt);
      const authors = new Set(rel.map(p => p.author.kind + p.author.id)).size;
      const w = F.world(wid) || (rel[0] && F.world(rel[0].worldId));
      // 热度走势：以上榜时长与热度推一条稳定的曲线
      const hours = Math.max(3, Math.round((it && it.hours) || 6));
      const r = F.rng(name + 'trend');
      const peakAt = Math.floor(hours * (.55 + r() * .35));
      const heat = (it && it.heat) || rel.reduce((s, p) => s + F.hot.heatOf(p), 0) * 37 || 1000;
      const pts = Array.from({ length: Math.min(12, hours + 1) }, (_, i) => {
        const x = i / (Math.min(12, hours + 1) - 1) * hours;
        const k = x <= peakAt ? Math.pow(x / Math.max(1, peakAt), 1.6) : 1 - (x - peakAt) / (hours * 2.2);
        return Math.max(0, Math.round(heat * F.clamp(k, 0, 1) * (.92 + r() * .16)));
      });
      const labels = pts.map((_, i) => `${Math.round(i / (pts.length - 1) * hours)}h`);
      const trig = it && it.trigger;
      const trigItem = trig && trig.ref ? F.item(trig.ref.kind, trig.ref.id) : (rel.slice().sort((a, b) => a.createdAt - b.createdAt)[0] || null);
      page.innerHTML = `${F.topbar('话题', { sub: w ? `「${w.theme || w.name}」` : '' })}
        <div class="page-scroll"><div class="tp">
          <div class="tp-hero">
            <div class="tp-rank">${it && !it.computed ? `<span class="num-font">No.${it.rank}</span>${it.peak && it.peak < it.rank ? `<em>最高第 ${it.peak} 名</em>` : it.rank <= 3 ? '<em>榜首区</em>' : ''}${F.hot.tagHTML(it.tag)}` : '<span>实时话题</span>'}</div>
            <h1>#${F.esc(name)}#</h1>
            ${it && it.lead ? `<p class="tp-lead">${F.esc(it.lead)}</p>` : ''}
            <div class="tp-stats">
              <div><b class="num-font">${F.num(heat)}</b><small>热度</small></div>
              <div><b class="num-font">${F.num((it && it.reads) || rel.reduce((s, p) => s + (p.stats.views || 0), 0))}</b><small>阅读</small></div>
              <div><b class="num-font">${F.num((it && it.discuss) || rel.reduce((s, p) => s + F.commentCount(p), 0))}</b><small>讨论</small></div>
              <div><b class="num-font">${authors}</b><small>参与博主</small></div>
            </div>
            ${it && !it.computed ? `<div class="tp-meta"><span>${F.I('cal')}${F.esc(it.since || '今天')} 上榜</span><span>${F.I('flame')}在榜 ${it.hours || hours} 小时</span>${it.category ? `<span>${F.I('grid')}${F.esc(it.category)}</span>` : ''}</div>` : ''}
          </div>
          <div class="tp-card"><div class="tp-ct">热度走势<small>峰值出现在上榜后约 ${peakAt} 小时</small></div>${F.profile.area(pts, labels)}</div>
          <div class="tp-card"><div class="tp-ct">引爆帖<small>这个话题是怎么冲上热搜的</small></div>
            ${trigItem ? F.share.quote(trigItem, 'in-topic') : trig && trig.summary ? `<div class="tp-trig"><b>${F.esc(trig.nickname || trig.handle || '网友')}</b>${trig.handle ? `<span>@${F.esc(trig.handle)}</span>` : ''}<p>${F.esc(trig.summary)}</p></div>` : '<p class="hint">还没有相关内容</p>'}
          </div>
          <div class="tp-gen">
            <button class="gbtn lg lg-dark" data-gp>${F.I('spark')}生成话题帖子</button>
            <button class="gbtn lg" data-gv>${F.I('play')}生成话题视频</button>
          </div>
          <div class="tp-ct" style="margin:22px 6px 10px;display:flex;align-items:center">全部内容<small style="margin-left:6px">${rel.length}</small><span style="flex:1"></span>
            <div class="seg" id="tpSort" style="width:118px"><button data-v="hot" class="${sort === 'hot' ? 'on' : ''}" style="height:28px;font-size:12px">热门</button><button data-v="new" class="${sort === 'new' ? 'on' : ''}" style="height:28px;font-size:12px">最新</button></div></div>
          <div class="feed" style="padding:0">${L.map(F.cards.renderAny).join('') || '<div class="empty"><p>这个话题下还没有内容，可以点上面的按钮生成。</p></div>'}</div>
        </div></div>`;
      F.bindBack(page, api);
      F.bindFeed(page.querySelector('.feed'));
      F.seg(page.querySelector('#tpSort'), v => { sort = v; draw(); });
      const pickW = async () => w || (F.state.worlds.length === 1 ? F.state.worlds[0] : F.world(await F.menu('使用哪个存档？', F.state.worlds.map(x => ({ label: x.name, value: x.id, icon: 'grid' })))));
      page.querySelector('[data-gp]').onclick = async () => { const ww = await pickW(); if (ww) F.home.genSheet(ww, { topic: name }); };
      page.querySelector('[data-gv]').onclick = async () => { const ww = await pickW(); if (ww) F.video.genFlow({ world: ww, topic: name }); };
    };
    draw(); page._refresh = draw;
  });
};
