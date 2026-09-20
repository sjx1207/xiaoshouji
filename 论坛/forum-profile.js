/* =========================================================
   论坛 · 我的  forum-profile.js
   资料展示 / 身份切换（小号）/ 论坛设置 / 数据中心
========================================================= */
F.profile = { tab: 'posts' };

/* 共用：资料头部（我的页 与 他人主页 共用同一套结构，保证观感一致） */
F.profile.header = (p, { self = false } = {}) => {
  const ref = { kind: p.kind, id: p.id };
  const v = F.isVerified(p);
  const vt = F.verifyTitle(p);
  const meta = [
    p.location && `<span>${F.I('pin')}${F.esc(p.location)}</span>`,
    p.occupation && `<span>${F.I('users')}${F.esc(p.occupation)}</span>`,
    p.school && `<span>${F.I('book')}${F.esc(p.school)}</span>`,
    p.birthday && `<span>${F.I('cal')}${F.esc(p.birthday)}</span>`,
    p.website && `<span>${F.I('link')}${F.esc(p.website)}</span>`,
    `<span>${F.I('spark')}${F.fullDate(p.createdAt || Date.now())} 加入</span>`
  ].filter(Boolean).join('');
  return `
  <div class="pf-cover">${F.coverHTML(p)}<div class="pf-cover-fade"></div></div>
  <div class="pf-head">
    <div class="pf-row1">
      <div class="pf-av-wrap">${F.avatarHTML(p, 88)}${p.kind === 'char' ? '<span class="pf-kind">角色</span>' : ''}</div>
      <div class="pf-btns" data-slot="btns"></div>
    </div>
    <h1 class="pf-name">${F.esc(p.nickname)}${v ? F.vbadge(p.kind !== 'char') : ''}</h1>
    <div class="pf-handle">@${F.esc(p.handle)}${p.gender ? `<span class="pf-g">${F.esc(p.gender)}</span>` : ''}</div>
    ${v && vt ? `<div class="pf-vline">${F.I('shield')}<span>${F.esc((p.verify && p.verify.type) ? p.verify.type + ' · ' : '')}${F.esc(vt)}</span></div>` : ''}
    ${p.bio ? `<p class="pf-bio clamp3">${F.inline(p.bio).replace(/\n/g, '<br>')}</p>` : (self ? `<p class="pf-bio muted">还没有简介，去编辑资料写一句介绍自己吧</p>` : '')}
    <div class="pf-meta">${meta}</div>
    ${(p.tags || []).length ? `<div class="pf-tags">${p.tags.map(t => `<span>${F.esc(t)}</span>`).join('')}</div>` : ''}
    <div class="pf-counts">
      <button data-count="following"><b class="num-font">${F.num(F.followingCount(p))}</b><small>关注</small></button>
      <button data-count="followers"><b class="num-font">${F.num(F.followerCount(p))}</b><small>粉丝</small></button>
      <button data-count="likes"><b class="num-font">${F.num(F.likesReceived(ref))}</b><small>获赞</small></button>
      <button data-count="posts"><b class="num-font">${F.postsBy(ref).length}</b><small>帖子</small></button>
    </div>
    ${F.profile.fanBlock(p)}
  </div>`;
};

/* 认证博主专属：粉丝团 + 圈子 */
F.profile.fanBlock = p => {
  const v = p.verify;
  if (!v || v.status !== 'verified') return '';
  const fc = v.fanClub || {};
  let html = '';
  if (fc.enabled && fc.name) {
    const lv = (fc.levels || '').split(/[,，]/).filter(Boolean);
    html += `<div class="pf-fan lg lg-dark" style="--lg-r:24px">
      <div class="pf-fan-l"><span class="pf-fan-ic">${F.I('crown')}</span><div><b>${F.esc(fc.name)}</b><small>${F.esc(fc.intro || fc.joinRule || '粉丝团')}</small></div></div>
      <div class="pf-fan-r"><span class="pf-badge">${F.esc(fc.badge || fc.name.slice(0, 2))}</span><small>${F.num(F.followerCount(p))} 位成员${lv.length ? ' · ' + lv.length + ' 个等级' : ''}</small></div>
    </div>`;
  }
  if ((v.circles || []).length) {
    html += `<div class="pf-circles">${v.circles.map(c => `<div class="pf-circle"><div class="pc-cover">${c.cover ? `<img src="${c.cover}">` : F.art.coverSVG(c.id)}</div><b>${F.esc(c.name)}</b><small>${F.esc(c.desc || '圈子')}</small></div>`).join('')}</div>`;
  }
  return html;
};

/* ---------------- 我的 Tab ---------------- */
F.tabs.renderers.me = (view) => {
  const me = F.me();
  const ref = { kind: 'user', id: me.id };
  view._darkTop = !!me.coverDark;
  const mine = F.postsBy(ref);
  const all = [...F.state.posts, ...F.state.videos];
  const liked = all.filter(p => (p.likedBy || []).includes(me.id)).sort((a, b) => b.createdAt - a.createdAt);
  const faved = all.filter(p => (p.favBy || []).includes(me.id)).sort((a, b) => b.createdAt - a.createdAt);
  const reposts = F.repostsBy(ref);
  const about = F.aboutRef(ref);
  if (F.profile.tab === 'about' && !about.length) F.profile.tab = 'posts';
  const views7 = mine.filter(p => Date.now() - p.createdAt < 7 * 86400e3).reduce((s, p) => s + (p.stats.views || 0), 0);
  const totalViews = mine.reduce((s, p) => s + (p.stats.views || 0), 0);
  const spark = F.profile.sparkline(F.profile.daily(mine, 7, p => (p.stats.views || 0) + F.likeCount(p) * 8), 64, 20);

  view.innerHTML = `
    <div class="pf-compact"><span class="pf-compact-name">${F.esc(me.nickname)}</span></div>
    <div class="pf-float">
      <button class="gbtn sm lg ${me.coverDark ? 'lg-on-img' : ''}" data-act="switch">${F.avatarHTML(me, 20)}<span>切换身份</span>${F.I('down')}</button>
      <span style="flex:1"></span>
      <button class="gorb lg ${me.coverDark ? 'lg-on-img' : ''}" data-act="settings">${F.I('gear')}</button>
    </div>
    ${F.profile.header({ ...me, kind: 'user' }, { self: true })}
    <div class="pf-pad">
      <button class="pf-insight lg" data-act="data" style="--lg-r:20px">
        <div class="pi-l"><small>近 7 天浏览</small><b class="num-font">${F.num(views7)}</b></div>
        <div class="pi-spark">${spark}</div>
        <div class="pi-r"><span>累计 ${F.num(totalViews)}</span>${F.I('right')}</div>
      </button>
      <div class="seg pf-seg" id="pfSeg">
        <button data-v="posts" class="${F.profile.tab === 'posts' ? 'on' : ''}">帖子<i>${mine.length}</i></button>
        <button data-v="likes" class="${F.profile.tab === 'likes' ? 'on' : ''}">点赞<i>${liked.length}</i></button>
        <button data-v="favs" class="${F.profile.tab === 'favs' ? 'on' : ''}">收藏<i>${faved.length}</i></button>
        <button data-v="reposts" class="${F.profile.tab === 'reposts' ? 'on' : ''}">转发<i>${reposts.length}</i></button>
        ${about.length ? `<button data-v="about" class="${F.profile.tab === 'about' ? 'on' : ''}">讨论<i>${about.length}</i></button>` : ''}
      </div>
    </div>
    <div class="feed" id="pfFeed"></div>`;

  // 头部按钮：编辑资料 + 数据
  view.querySelector('[data-slot="btns"]').innerHTML = `
    <button class="gbtn lg" data-act="edit">${F.I('edit')}编辑资料</button>
    <button class="gorb lg" data-act="data">${F.I('chart')}</button>`;

  const feed = view.querySelector('#pfFeed');
  const lists = { posts: mine, likes: liked, favs: faved, reposts, about };
  const empties = {
    posts: ['还没有发过帖子', '点下方中间的按钮，发布你的第一条内容', 'plus', '去发帖'],
    likes: ['还没有点赞过内容', '在首页看到喜欢的帖子，点一下心形就会出现在这里', 'heart'],
    favs: ['收藏夹是空的', '收藏的帖子会整齐地排在这里，方便以后再读', 'fav'],
    reposts: ['还没有转发过', '在任意帖子或视频上点转发，可以附上转发语发到主页', 'repost'],
    about: ['还没有关于你的讨论', '', 'crown']
  };
  const draw = () => {
    const L = lists[F.profile.tab];
    if (!L.length) {
      const e = empties[F.profile.tab];
      feed.innerHTML = `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I(e[2])}</div><h4>${e[0]}</h4><p>${e[1]}</p>${e[3] ? `<button class="gbtn lg" data-act="compose">${F.I('plus')}${e[3]}</button>` : ''}</div>`;
    } else feed.innerHTML = L.map(F.cards.renderAny).join('');
  };
  draw();
  F.bindFeed(feed);
  F.seg(view.querySelector('#pfSeg'), v => { F.profile.tab = v; draw(); });

  view.onclick = e => {
    const b = e.target.closest('[data-act]'); if (!b) {
      const c = e.target.closest('[data-count]');
      if (c) F.people.follows({ kind: 'user', id: me.id }, c.dataset.count);
      return;
    }
    const a = b.dataset.act;
    if (a === 'edit') F.edit.open();
    if (a === 'switch') F.profile.switchSheet();
    if (a === 'settings') F.profile.settings();
    if (a === 'data') F.profile.dashboard();
    if (a === 'compose') F.compose.open();
  };
  // 滚动：顶部紧凑栏 + 状态栏明暗
  view._onScroll = y => {
    const on = y > 190;
    view.querySelector('.pf-compact').classList.toggle('show', on);
    view.querySelector('.pf-float').classList.toggle('solid', on);
    const dark = !!me.coverDark && y < 150;
    if (F.tabs.current === 'me' && !F.nav.stack.length) F.statusbar.tone(dark);
    view._darkTop = dark;
  };
};

/* ---------------- 身份切换（小号） ---------------- */
F.profile.switchSheet = () => {
  F.sheet({
    title: '切换身份', sub: '每个身份的资料、帖子、点赞、收藏与关注都各自独立存档',
    render(api) {
      const draw = () => {
        api.body.innerHTML = `<div class="id-list">${F.state.identities.map(u => {
          const on = u.id === F.state.activeIdentityId;
          return `<div class="id-item ${on ? 'on' : ''}" data-id="${u.id}">
            ${F.avatarHTML(u, 46)}
            <div class="id-main"><b>${F.esc(u.nickname)}${F.isVerified(u) ? F.vbadge() : ''}</b><small>@${F.esc(u.handle)} · ${F.postsBy({ kind: 'user', id: u.id }).length} 帖 · ${F.num(F.followerCount({ ...u, kind: 'user' }))} 粉丝</small></div>
            ${on ? `<span class="id-on">${F.I('check')}</span>` : `<button class="gorb sm lg" data-del="${u.id}">${F.I('trash')}</button>`}
          </div>`;
        }).join('')}</div>
        <button class="gbtn lgx lg block" data-add style="margin-top:12px">${F.I('plus')}添加新身份</button>`;
        api.body.querySelectorAll('.id-item').forEach(el => el.onclick = async e => {
          if (e.target.closest('[data-del]')) return;
          if (el.dataset.id === F.state.activeIdentityId) return;
          F.state.activeIdentityId = el.dataset.id;
          await F.save('activeIdentityId');
          api.close();
          F.toast(`已切换到 ${F.me().nickname}`, 'swap');
          F.tabs.refresh();
        });
        api.body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
          const u = F.identity(b.dataset.del);
          if (!(await F.confirm(`删除身份「${u.nickname}」？`, '该身份的资料会被删除，已发布的帖子会保留并显示为已注销用户。', '删除', true))) return;
          F.state.identities = F.state.identities.filter(x => x.id !== u.id);
          await F.save('identities'); draw();
        });
        api.body.querySelector('[data-add]').onclick = async () => {
          const u = F.newIdentity({ nickname: '新身份 ' + (F.state.identities.length + 1) });
          F.state.identities.push(u); F.state.activeIdentityId = u.id;
          await F.save('identities', 'activeIdentityId');
          api.close(); F.tabs.refresh();
          setTimeout(() => F.edit.open(), 380);
        };
      };
      draw();
    }
  });
};

/* ---------------- 论坛设置 ---------------- */
F.profile.settings = () => {
  const S = F.state.settings;
  const c = F.ai.cfg();
  F.sheet({
    title: '论坛设置', sub: c.model ? `当前模型：${c.model}` : '尚未配置 API（在桌面「设置 › API」中配置）',
    render(api) {
      api.body.innerHTML = `
        <div class="group">
          <div class="row"><div class="r-main"><div class="r-title">模型支持识图</div><div class="r-sub">开启后，发帖配图会直接发送给模型；关闭时只发送你为图片填写的文字描述</div></div>${F.switchHTML('vision', S.vision)}</div>
          <div class="row"><div class="r-main"><div class="r-title">流式生成</div><div class="r-sub">实时显示生成进度；接口不支持时会自动切换为普通请求</div></div>${F.switchHTML('stream', S.stream)}</div>
        </div>
        <div class="group-title">单次生成 Token 上限</div>
        <div class="chips" data-chips="maxTokens">${[4096, 8192, 16000, 32000].map(v => `<button class="chip ${S.maxTokens === v ? 'on' : ''}" data-v="${v}">${v >= 1000 ? Math.round(v / 1000) + 'k' : v}</button>`).join('')}</div>
        <p class="hint">长文、连载串建议 8k 以上，避免内容被截断导致格式损坏</p>
        <div class="group-title">想象力（temperature）</div>
        <div class="chips" data-chips="temperature">${[[0.7, '克制'], [0.9, '均衡'], [1.1, '奔放']].map(([v, l]) => `<button class="chip ${S.temperature === v ? 'on' : ''}" data-v="${v}">${l} ${v}</button>`).join('')}</div>
        <div class="group-title">角色自主发帖</div>
        <button class="gbtn lg block" data-auto>${F.I('refresh')}立即检查一次</button>
        <p class="hint">已开启自主发帖的角色，会在打开论坛时按各自的频率自动发布。</p>`;
      api.body.querySelectorAll('[data-sw]').forEach(i => i.onchange = () => { S[i.dataset.sw] = i.checked; F.save('settings'); });
      api.body.querySelectorAll('[data-chips]').forEach(g => g.querySelectorAll('.chip').forEach(ch => ch.onclick = () => {
        g.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === ch));
        S[g.dataset.chips] = +ch.dataset.v; F.save('settings');
      }));
      api.body.querySelector('[data-auto]').onclick = async () => {
        const n = F.state.charProfiles.filter(c => c.auto && c.auto.enabled).length;
        if (!n) return F.toast('还没有角色开启自主发帖', 'spark');
        F.state.charProfiles.forEach(c => { if (c.auto && c.auto.enabled) c.auto.lastAt = 0; });
        api.close(); F.toast(`${n} 个角色正在准备发帖…`, 'spark'); await F.autoPost();
      };
    }
  });
};

/* ---------------- 统计工具 ---------------- */
F.profile.daily = (posts, days, valFn) => {
  const out = new Array(days).fill(0);
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const t0 = start.getTime() - (days - 1) * 86400e3;
  posts.forEach(p => { const i = Math.floor((p.createdAt - t0) / 86400e3); if (i >= 0 && i < days) out[i] += valFn(p); });
  return out;
};
F.profile.sparkline = (vals, w = 64, h = 20) => {
  const max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [i / (vals.length - 1 || 1) * w, h - 2 - v / max * (h - 4)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${pts[pts.length - 1][0]}" cy="${pts[pts.length - 1][1]}" r="2.4" fill="currentColor"/></svg>`;
};
F.profile.area = (vals, labels) => {
  const W = 320, H = 130, max = Math.max(1, ...vals);
  const pts = vals.map((v, i) => [12 + i / (vals.length - 1 || 1) * (W - 24), H - 22 - v / max * (H - 44)]);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], cx = (x0 + x1) / 2; d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`; }
  const area = d + ` L${pts[pts.length - 1][0]} ${H - 22} L${pts[0][0]} ${H - 22} Z`;
  const step = Math.ceil(labels.length / 7);
  return `<svg viewBox="0 0 ${W} ${H}" class="dash-area"><defs><linearGradient id="dashG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e1e22" stop-opacity=".22"/><stop offset="1" stop-color="#1e1e22" stop-opacity="0"/></linearGradient></defs>
    ${[0.25, 0.5, 0.75].map(f => `<line x1="12" x2="${W - 12}" y1="${22 + (H - 44) * f}" y2="${22 + (H - 44) * f}" stroke="rgba(20,20,26,.06)" stroke-dasharray="2 4"/>`).join('')}
    <path d="${area}" fill="url(#dashG)"/><path d="${d}" fill="none" stroke="#1e1e22" stroke-width="2" stroke-linecap="round"/>
    ${pts.map((p, i) => vals[i] === max && max > 0 ? `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#fff" stroke="#1e1e22" stroke-width="2"/><text x="${p[0]}" y="${p[1] - 10}" text-anchor="middle" font-size="10" fill="#1e1e22" font-family="Fraunces">${F.num(max)}</text>` : '').join('')}
    ${labels.map((l, i) => i % step === 0 || i === labels.length - 1 ? `<text x="${pts[i][0]}" y="${H - 4}" text-anchor="middle" font-size="9.5" fill="#8d8d95">${l}</text>` : '').join('')}
  </svg>`;
};

/* ---------------- 数据中心（新页面） ---------------- */
F.profile.dashboard = () => {
  F.nav.push((page, api) => {
    let tab = 'overview', range = 7;
    page.innerHTML = `${F.topbar('数据中心', { sub: '@' + F.me().handle })}
      <div class="page-scroll"><div class="dash">
        <div class="seg" id="dSeg"><button data-v="overview" class="on">概览</button><button data-v="content">内容</button><button data-v="fans">粉丝</button><button data-v="interact">互动</button></div>
        <div class="dash-range chips" id="dRange">${[[7, '近 7 天'], [30, '近 30 天'], [0, '全部']].map(([v, l]) => `<button class="chip ${v === 7 ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
        <div id="dBody"></div>
      </div></div>`;
    F.bindBack(page, api);
    F.seg(page.querySelector('#dSeg'), v => { tab = v; draw(); });
    page.querySelectorAll('#dRange .chip').forEach(c => c.onclick = () => { page.querySelectorAll('#dRange .chip').forEach(x => x.classList.toggle('on', x === c)); range = +c.dataset.v; draw(); });
    const body = page.querySelector('#dBody');

    function draw() {
      const me = F.me(), ref = { kind: 'user', id: me.id };
      const all = F.postsBy(ref);
      const posts = range ? all.filter(p => Date.now() - p.createdAt < range * 86400e3) : all;
      const sum = f => posts.reduce((s, p) => s + f(p), 0);
      const V = sum(p => p.stats.views || 0), L = sum(F.likeCount), C = sum(F.commentCount), Fv = sum(F.favCount), R = sum(p => p.stats.reposts || 0);
      const rate = V ? ((L + C + Fv) / V * 100) : 0;
      const days = range || Math.max(7, Math.min(60, Math.ceil((Date.now() - (all.length ? all[all.length - 1].createdAt : Date.now())) / 86400e3) + 1));
      const labels = Array.from({ length: days }, (_, i) => { const d = new Date(Date.now() - (days - 1 - i) * 86400e3); return (d.getMonth() + 1) + '/' + d.getDate(); });

      if (tab === 'overview') {
        const series = F.profile.daily(posts, days, p => (p.stats.views || 0));
        body.innerHTML = `
          <div class="dash-hero">
            <div class="dh-top"><div><small>浏览量</small><b class="num-font">${F.num(V)}</b></div><div class="dh-rate"><small>互动率</small><b class="num-font">${rate.toFixed(1)}%</b></div></div>
            ${F.profile.area(series, labels)}
          </div>
          <div class="dash-grid">
            ${[['heart', '获赞', L], ['comment', '评论', C], ['fav', '被收藏', Fv], ['repost', '转发', R], ['users', '粉丝', F.followerCount({ ...me, kind: 'user' })], ['doc', '发布', posts.length]].map(([i, l, v]) => `<div class="dg-cell"><span>${F.I(i)}</span><b class="num-font">${F.num(v)}</b><small>${l}</small></div>`).join('')}
          </div>
          <div class="group-title">身份对比</div>
          <div class="group">${F.state.identities.map(u => {
            const r = { kind: 'user', id: u.id }; const ps = F.postsBy(r);
            return `<div class="row">${F.avatarHTML(u, 34)}<div class="r-main"><div class="r-title">${F.esc(u.nickname)}${u.id === me.id ? '<span class="dash-cur">当前</span>' : ''}</div><div class="r-sub">${ps.length} 帖 · 获赞 ${F.num(F.likesReceived(r))} · 粉丝 ${F.num(F.followerCount({ ...u, kind: 'user' }))}</div></div></div>`;
          }).join('')}</div>
          <div class="group-title">整个论坛</div>
          <div class="dash-grid three">
            <div class="dg-cell"><b class="num-font">${F.state.worlds.length}</b><small>内容存档</small></div>
            <div class="dg-cell"><b class="num-font">${F.state.posts.length}</b><small>全部帖子</small></div>
            <div class="dg-cell"><b class="num-font">${F.state.npcs.length}</b><small>出现过的博主</small></div>
          </div>`;
      }
      if (tab === 'content') {
        const byType = {};
        posts.forEach(p => byType[p.type] = (byType[p.type] || 0) + 1);
        const maxT = Math.max(1, ...Object.values(byType));
        const top = posts.slice().sort((a, b) => (F.likeCount(b) + F.commentCount(b) * 3) - (F.likeCount(a) + F.commentCount(a) * 3)).slice(0, 5);
        const avg = posts.length ? Math.round(V / posts.length) : 0;
        body.innerHTML = `
          <div class="dash-grid three"><div class="dg-cell"><b class="num-font">${posts.length}</b><small>发布数</small></div><div class="dg-cell"><b class="num-font">${F.num(avg)}</b><small>篇均浏览</small></div><div class="dg-cell"><b class="num-font">${posts.length ? (L / posts.length).toFixed(1) : 0}</b><small>篇均获赞</small></div></div>
          <div class="group-title">内容类型分布</div>
          <div class="dash-bars">${F.TYPE_ORDER.filter(t => byType[t]).map(t => `<div class="db-row"><span>${F.I(F.TYPES[t].icon)}${F.TYPES[t].name}</span><div class="db-trk"><i style="width:${byType[t] / maxT * 100}%"></i></div><b class="num-font">${byType[t]}</b></div>`).join('') || '<p class="muted" style="padding:12px 4px;font-size:13px">这段时间还没有发布内容</p>'}</div>
          <div class="group-title">表现最好的内容</div>
          <div class="group">${top.map(p => `<div class="row dash-post" data-open="${p.id}"><div class="r-main"><div class="r-title clamp2" style="font-size:14px">${F.esc(p.title || F.plain(p.content).slice(0, 60) || '（图片）')}</div><div class="r-sub">${F.typeName(p.type)} · ${F.ago(p.createdAt)} · 浏览 ${F.num(p.stats.views)} · 赞 ${F.num(F.likeCount(p))} · 评论 ${F.commentCount(p)}</div></div><svg class="chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></div>`).join('') || '<div class="row"><div class="r-sub">暂无数据</div></div>'}</div>`;
      }
      if (tab === 'fans') {
        const who = {};
        posts.forEach(p => p.comments.forEach(c => { [c, ...(c.replies || [])].forEach(x => { if (x.author.kind !== 'user') { const k = x.author.kind + ':' + x.author.id; who[k] = (who[k] || 0) + 1; } }); }));
        const topFans = Object.entries(who).sort((a, b) => b[1] - a[1]).slice(0, 8);
        const v = me.verify;
        body.innerHTML = `
          <div class="dash-grid three"><div class="dg-cell"><b class="num-font">${F.num(F.followerCount({ ...me, kind: 'user' }))}</b><small>粉丝</small></div><div class="dg-cell"><b class="num-font">${F.num(F.followingCount({ ...me, kind: 'user' }))}</b><small>关注</small></div><div class="dg-cell"><b class="num-font">${Object.keys(who).length}</b><small>互动过的人</small></div></div>
          <div class="group-title">最常来互动的人</div>
          <div class="group">${topFans.map(([k, n], i) => { const [kind, id] = k.split(':'); const p = F.person({ kind, id }); return `<div class="row" data-person="${k}"><span class="dash-rank num-font">${i + 1}</span>${F.avatarHTML(p, 34)}<div class="r-main"><div class="r-title">${F.esc(p.nickname)}${F.isVerified(p) ? F.vbadge(kind !== 'char') : ''}</div><div class="r-sub">@${F.esc(p.handle)}</div></div><span class="r-val">${n} 次</span></div>`; }).join('') || '<div class="row"><div class="r-sub">还没有人在你的帖子下互动</div></div>'}</div>
          <div class="group-title">认证与粉丝经营</div>
          <div class="group">
            <div class="row"><div class="r-main"><div class="r-title">认证状态</div></div><span class="r-val">${v.status === 'verified' ? '已认证 · ' + F.esc(v.title || v.type) : '普通用户'}</span></div>
            <div class="row"><div class="r-main"><div class="r-title">粉丝团</div></div><span class="r-val">${v.status === 'verified' && v.fanClub.enabled ? F.esc(v.fanClub.name) : '未开通'}</span></div>
            <div class="row"><div class="r-main"><div class="r-title">圈子</div></div><span class="r-val">${v.status === 'verified' ? v.circles.length + ' 个' : '认证后可创建'}</span></div>
          </div>`;
      }
      if (tab === 'interact') {
        const items = [];
        posts.forEach(p => p.comments.forEach(c => { if (c.author.kind !== 'user') items.push({ p, x: c, t: c.time }); (c.replies || []).forEach(r => { if (r.author.kind !== 'user') items.push({ p, x: r, t: r.time, reply: true }); }); }));
        items.sort((a, b) => b.t - a.t);
        body.innerHTML = `<div class="group-title">最新收到的评论与回复</div>
          <div class="group">${items.slice(0, 30).map(({ p, x, reply }) => { const a = F.person(x.author); return `<div class="row dash-post" data-open="${p.id}">${F.avatarHTML(a, 34)}<div class="r-main"><div class="r-title" style="font-size:13.5px">${F.esc(a.nickname)} <span class="muted" style="font-weight:500">${reply ? '回复了评论' : '评论了你'}</span></div><div class="r-sub clamp2" style="color:var(--ink-2)">${F.esc(x.text)}</div><div class="r-sub">${F.ago(x.time)} · ${F.esc((p.title || F.plain(p.content)).slice(0, 18))}</div></div></div>`; }).join('') || '<div class="row"><div class="r-sub">还没有收到评论</div></div>'}</div>`;
      }
      body.querySelectorAll('[data-open]').forEach(r => r.onclick = () => F.detail.open(r.dataset.open));
      body.querySelectorAll('[data-person]').forEach(r => r.onclick = () => { const [kind, id] = r.dataset.person.split(':'); F.people.open({ kind, id }); });
    }
    draw();
    page._refresh = draw;
  });
};