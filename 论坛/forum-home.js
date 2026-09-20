/* =========================================================
   论坛 · 首页  forum-home.js
   双液滴入口（私信 / 生成）· 主题分类栏 · 内容流
   内容存档 → 新建存档 → 选择生成内容 → 生成动画 → 首页展示
   私信列表与会话
========================================================= */
F.home = { cat: 'all', shown: 20 };

/* ---------------- 首页 Tab ---------------- */
F.tabs.renderers.home = (view, soft) => {
  const worlds = F.state.worlds.filter(w => F.state.posts.some(p => p.worldId === w.id));
  if (F.home.cat !== 'all' && F.home.cat !== 'mine' && !worlds.find(w => w.id === F.home.cat)) F.home.cat = 'all';
  const unread = F.state.dms.filter(t => t.identityId === F.state.activeIdentityId).reduce((s, t) => s + (t.unread || 0), 0);
  const d = new Date(); const wk = '日一二三四五六'[d.getDay()];
  const hasMine = F.state.posts.some(p => !p.worldId);
  const scrollY = soft ? view.scrollTop : 0;

  view.innerHTML = `
    <div class="hm-top">
      <button class="gorb lg hm-desk" data-desk aria-label="返回桌面">${F.I('grid')}</button>
      <div class="hm-title"><h1>广场</h1><small>${d.getMonth() + 1}月${d.getDate()}日 星期${wk} · ${F.state.posts.length} 条内容</small></div>
      <div class="duo lg" id="duo">
        <span class="duo-bead"></span>
        <button class="duo-btn duo-dm" data-duo="dm">${F.I('mail')}${unread ? `<i class="duo-badge">${unread > 99 ? '99+' : unread}</i>` : ''}</button>
        <button class="duo-btn duo-gen" data-duo="gen">${F.I('spark')}<span>生成</span></button>
      </div>
    </div>
    <div class="hm-cats">
      <div class="hm-cats-track" id="hmCats">
        <span class="cat-pill"></span>
        <button class="cat ${F.home.cat === 'all' ? 'on' : ''}" data-cat="all">全部</button>
        ${hasMine ? `<button class="cat ${F.home.cat === 'mine' ? 'on' : ''}" data-cat="mine">我的主页</button>` : ''}
        ${worlds.map(w => `<button class="cat ${F.home.cat === w.id ? 'on' : ''}" data-cat="${w.id}">${F.esc(w.theme || w.name)}</button>`).join('')}
      </div>
    </div>
    <div class="feed" id="hmFeed"></div>`;

  const list = () => {
    let ps = F.state.posts.filter(p => p.visibility !== 'self' || (p.author.kind === 'user'));
    if (F.home.cat === 'mine') ps = ps.filter(p => !p.worldId);
    else if (F.home.cat !== 'all') ps = ps.filter(p => p.worldId === F.home.cat);
    return ps.sort((a, b) => b.createdAt - a.createdAt);
  };
  const feed = view.querySelector('#hmFeed');
  const draw = () => {
    const ps = list();
    if (!ps.length) {
      feed.innerHTML = `<div class="empty hm-empty"><div class="e-art lg" style="--lg-r:30px">${F.I('spark')}</div><h4>这里还很安静</h4><p>先建立一个内容存档，写下世界观与文风，<br>再选择想看的内容类型和篇数，AI 会为你生成整个广场。</p><button class="gbtn lgx lg lg-dark" data-go-gen>${F.I('plus')}建立内容存档</button></div>`;
      feed.querySelector('[data-go-gen]').onclick = () => F.home.openWorlds();
      return;
    }
    const w = F.world(F.home.cat);
    feed.innerHTML = (w ? F.home.worldBanner(w, ps.length) : '') + ps.slice(0, F.home.shown).map(F.cards.render).join('') + (ps.length > F.home.shown ? '<div class="feed-more"><span class="spin"></span></div>' : '<div class="feed-end">已经到底了</div>');
    const wb = feed.querySelector('[data-gen-world]'); if (wb) wb.onclick = () => F.home.genSheet(w);
  };
  draw();
  F.bindFeed(feed);

  // 分类液态胶囊
  const track = view.querySelector('#hmCats'), pill = track.querySelector('.cat-pill');
  const place = (anim = true) => { const on = track.querySelector('.cat.on'); if (!on) return; if (!anim) pill.style.transition = 'none'; pill.style.left = on.offsetLeft + 'px'; pill.style.width = on.offsetWidth + 'px'; if (!anim) requestAnimationFrame(() => pill.style.transition = ''); };
  requestAnimationFrame(() => place(false));
  track.querySelectorAll('.cat').forEach(b => b.onclick = () => {
    F.home.cat = b.dataset.cat; F.home.shown = 20;
    track.querySelectorAll('.cat').forEach(x => x.classList.toggle('on', x === b)); place();
    track.scrollTo({ left: b.offsetLeft - (track.clientWidth - b.offsetWidth) / 2, behavior: 'smooth' });
    draw(); view.scrollTo({ top: 0, behavior: 'smooth' });
  });

  view.querySelector('[data-desk]').onclick = F.goDesktop;
  // 双液滴入口
  const duo = view.querySelector('#duo');
  duo.querySelectorAll('[data-duo]').forEach(b => {
    b.addEventListener('pointerdown', () => duo.classList.add('lean-' + b.dataset.duo));
    b.addEventListener('pointerleave', () => duo.classList.remove('lean-dm', 'lean-gen'));
    b.onclick = () => {
      duo.classList.remove('lean-dm', 'lean-gen'); duo.classList.add('flow-' + b.dataset.duo);
      const r = b.getBoundingClientRect(); const at = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      setTimeout(() => { duo.classList.remove('flow-dm', 'flow-gen'); b.dataset.duo === 'dm' ? F.dm.openList(at) : F.home.openWorlds(at); }, 260);
    };
  });

  const catsEl = view.querySelector('.hm-cats');
  const catsNat = view.querySelector('.hm-top').offsetHeight - 52;
  const catsTop = () => catsNat;
  view._onScroll = y => {
    catsEl.classList.toggle('stuck', y >= catsTop() - 1);
    if (y + view.clientHeight > view.scrollHeight - 400 && list().length > F.home.shown) { F.home.shown += 20; const top = view.scrollTop; draw(); view.scrollTop = top; }
  };
  if (soft) { view.scrollTop = scrollY; view._onScroll(scrollY); }
};

F.home.worldBanner = (w, n) => `
  <div class="wb">
    <div class="wb-cover">${w.cover ? `<img src="${w.cover}">` : F.art.coverSVG(w.id)}</div>
    <div class="wb-main"><b>${F.esc(w.name)}</b><small>${F.esc([w.tone, w.platform].filter(Boolean).join(' · ') || '内容存档')} · ${n} 篇</small></div>
    <button class="gbtn sm lg lg-dark" data-gen-world>${F.I('spark')}再生成</button>
  </div>`;

/* ---------------- 内容存档（新页面） ---------------- */
F.home.openWorlds = (at) => {
  F.nav.push((page, api) => {
    const draw = () => {
      const ws = F.state.worlds.slice().sort((a, b) => (b.lastGenAt || b.updatedAt) - (a.lastGenAt || a.updatedAt));
      page.innerHTML = `${F.topbar('生成内容', { sub: '选择一个存档开始生成', right: `<button class="gorb lg lg-dark" data-add>${F.I('plus')}</button>` })}
        <div class="page-scroll"><div class="wl">
          ${!F.ai.ready() ? `<div class="cp-tip warn" style="margin-bottom:14px">${F.I('gear')}<span>还没有可用的 API。请先到桌面「设置 › API」填写地址、密钥并选择模型。</span></div>` : ''}
          ${ws.length ? ws.map(w => {
            const n = F.state.posts.filter(p => p.worldId === w.id).length;
            return `<article class="wl-card" data-w="${w.id}">
              <div class="wl-cover">${w.cover ? `<img src="${w.cover}">` : F.art.coverSVG(w.id)}<div class="wl-shade"></div>
                <button class="gorb sm lg wl-more" data-more="${w.id}">${F.I('more')}</button>
                <div class="wl-over"><span class="wl-theme">${F.esc(w.theme || '未设主题')}</span><h3>${F.esc(w.name)}</h3></div>
              </div>
              <div class="wl-info">
                <p class="clamp2">${F.esc(w.worldview || w.content || w.tone || '还没有写世界观')}</p>
                <div class="wl-meta">${[w.tone, w.platform, w.heat].filter(Boolean).slice(0, 3).map(t => `<span>${F.esc(t)}</span>`).join('')}<em>${n} 篇${w.lastGenAt ? ' · ' + F.ago(w.lastGenAt) : ''}</em></div>
              </div>
            </article>`;
          }).join('') : `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I('grid')}</div><h4>还没有内容存档</h4><p>一个存档就是一个“世界”：主题、文风、世界观、正在发生的事、网友是什么样的人……<br>写得越具体，生成的内容越贴近你想看的。</p><button class="gbtn lgx lg lg-dark" data-add>${F.I('plus')}新建存档</button></div>`}
        </div></div>`;
      F.bindBack(page, api);
      page.querySelectorAll('[data-add]').forEach(b => b.onclick = () => F.home.editWorld(null, draw));
      page.querySelectorAll('[data-w]').forEach(c => c.onclick = e => {
        if (e.target.closest('[data-more]')) return;
        F.home.genSheet(F.world(c.dataset.w));
      });
      page.querySelectorAll('[data-more]').forEach(b => b.onclick = async () => {
        const w = F.world(b.dataset.more);
        const v = await F.menu(w.name, [{ label: '开始生成', value: 'gen', icon: 'spark' }, { label: '编辑存档', value: 'edit', icon: 'edit' }, { label: '在首页查看', value: 'view', icon: 'grid' }, { label: '删除存档', sub: '同时删除该存档下生成的全部内容', value: 'del', icon: 'trash', danger: true }]);
        if (v === 'gen') F.home.genSheet(w);
        if (v === 'edit') F.home.editWorld(w, draw);
        if (v === 'view') { F.home.cat = w.id; F.nav.popAll(); F.tabs.go('home'); }
        if (v === 'del' && await F.confirm(`删除「${w.name}」？`, '该存档及其生成的帖子、博主都会被删除，无法恢复。', '删除', true)) {
          F.state.worlds = F.state.worlds.filter(x => x.id !== w.id);
          F.state.posts = F.state.posts.filter(p => p.worldId !== w.id || p.author.kind === 'user');
          F.state.npcs = F.state.npcs.filter(n => n.worldId !== w.id);
          await F.save('worlds', 'posts', 'npcs'); draw();
        }
      });
    };
    draw();
    page._refresh = draw;
  }, at ? { fromCore: at } : {});
};

/* ---------------- 新建 / 编辑存档（新页面） ---------------- */
F.home.editWorld = (world, done) => {
  const w = world ? F.deepClone(world) : F.newWorld();
  F.nav.push(async (page, api) => {
    const wb = await F.ext.worldbook();
    const chip = (path, opts, multi) => `<div class="chips" ${multi ? 'data-multi' : 'data-chip'}="${path}">${opts.map(o => `<button class="chip" data-v="${F.esc(Array.isArray(o) ? o[0] : o)}">${F.esc(Array.isArray(o) ? o[1] : o)}</button>`).join('')}</div>`;
    const f = (label, inner, hint = '') => `<div class="field"><div class="f-label">${label}</div>${inner}${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
    const t = (p, ph, m = 40) => `<input class="input" data-bind="${p}" placeholder="${F.esc(ph)}" maxlength="${m}">`;
    const a = (p, ph, m = 1500, r = 3) => `<textarea class="textarea" data-bind="${p}" placeholder="${F.esc(ph)}" maxlength="${m}" rows="${r}"></textarea>`;
    page.innerHTML = `${F.topbar(world ? '编辑存档' : '新建存档', { right: `<button class="gbtn sm lg lg-dark" data-save>存档</button>` })}
      <div class="page-scroll"><div class="we">
        <div class="we-cover" data-cover>${w.cover ? `<img src="${w.cover}">` : F.art.coverSVG(w.id)}<span class="gbtn sm lg lg-on-img">${F.I('camera')}上传封面</span></div>
        ${f('存档名称', t('name', '如：雾港市·深夜频道', 24))}
        ${f('主题', t('theme', '显示在首页分类栏，如：都市怪谈', 10), '分类栏按主题区分内容，建议 2~6 个字')}
        <div class="group-title">文风</div>
        ${f('整体文风基调', chip('tone', ['日常松弛', '文艺克制', '热血沙雕', '悬疑暗黑', '温柔治愈', '冷静理性', '古风雅致', '赛博荒诞', '甜宠轻快']) + `<input class="input" data-bind="tone" placeholder="或自己描述基调" maxlength="30" style="margin-top:8px">`)}
        ${f('写作风格细则', a('style', '句子长短、修辞习惯、网络用语多少、是否多用对话……', 600, 2))}
        <div class="group-title">世界</div>
        ${f('世界观', a('worldview', '这是一个怎样的世界？规则、势力、社会风貌、科技或魔法水平……', 3000, 5))}
        ${f('时代与时间', t('era', '如：近未来 2049 年秋；架空王朝永和三年', 40))}
        ${f('核心内容 / 正在发生的事', a('content', '最近大家都在讨论什么？有哪些事件、谜团、八卦正在发酵？', 3000, 4), 'AI 会围绕这些事件展开帖子，让内容之间彼此呼应')}
        ${f('关键词与意象', t('keywords', '如：雨夜、霓虹、旧唱片、失踪的邮差', 100))}
        <div class="group-title">平台与人群</div>
        ${f('平台气质', chip('platform', ['综合广场', '微博热搜风', 'IG 生活流', '推特讨论风', '豆瓣小组', '知乎问答', '小红书种草', '校园论坛', '江湖茶馆', '匿名树洞']))}
        ${f('网友群像', a('audience', '都是些什么人在发帖、在评论？年龄、职业、立场、说话方式', 1200, 3))}
        ${f('常驻博主', a('npc', '希望反复出现的博主，如：爱爆料的狗仔「夜枭」；总在辟谣的官方号', 1500, 3), '生成时会优先复用这些博主，让世界更有连续性')}
        ${f('评论区氛围', chip('commentStyle', ['友善互助', '吵架对线', '玩梗接龙', '理性讨论', '捧场彩虹屁', '阴阳怪气']) + `<input class="input" data-bind="commentStyle" placeholder="或自己描述" maxlength="40" style="margin-top:8px">`)}
        ${f('热度', chip('heat', ['小众冷门', '中等热度', '全网爆款']))}
        ${f('真实度', chip('realism', ['贴近真实社交平台', '略带戏剧性', '高度戏剧化']))}
        <div class="group-title">我与角色</div>
        ${f('我在这个世界中的身份', a('userRole', '如：刚搬来雾港的新人记者；也可以留空，只做旁观者', 600, 2))}
        ${f('帖子提及我的频率', chip('userMention', ['从不', '偶尔', '经常']))}
        ${F.state.charProfiles.length ? f('默认参与的角色', chip('defaultChars', F.state.charProfiles.map(c => [c.id, c.nickname]), true), '生成时会默认勾选这些角色；留空则使用各角色自己的“默认参与”设置') : `<p class="hint" style="margin:0 8px 14px">在「我的 › 编辑资料 › 角色资料」为角色建档后，就能让 TA 们参与生成。</p>`}
        ${wb.length ? f('引用世界书', chip('worldbook', wb.map(e => [e.id, e.title || '未命名条目']), true), '选中的条目会作为设定一并交给 AI') : ''}
        <div class="group-title">约束</div>
        ${f('篇幅偏好', chip('length', ['偏短', '适中', '偏长']))}
        ${f('语言', chip('lang', ['简体中文', '繁體中文', '中英混杂', 'English']))}
        ${f('禁止出现', a('taboo', '不希望出现的情节、词语或题材', 600, 2))}
        <button class="gbtn lgx lg lg-dark block" data-save style="margin-top:10px">${F.I('check')}存档</button>
      </div></div>`;
    F.bindBack(page, api);
    // defaultChars/worldbook 为数组，chips 值为字符串：统一转成字符串比较
    w.defaultChars = (w.defaultChars || []).map(String); w.worldbook = (w.worldbook || []).map(String);
    F.edit.bind(page, w);
    page.querySelector('[data-cover]').onclick = async () => {
      const [file] = await F.pickImages(); if (!file) return;
      w.cover = await F.readImage(file, 1600);
      page.querySelector('[data-cover]').innerHTML = `<img src="${w.cover}"><span class="gbtn sm lg lg-on-img">${F.I('camera')}更换封面</span>`;
    };
    page.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => {
      if (!w.name.trim()) return F.toast('请填写存档名称', 'minus');
      if (!w.theme.trim()) w.theme = w.name.slice(0, 6);
      w.worldbook = w.worldbook.map(x => isNaN(+x) ? x : +x);
      w.updatedAt = Date.now();
      const i = F.state.worlds.findIndex(x => x.id === w.id);
      i < 0 ? F.state.worlds.push(w) : (F.state.worlds[i] = w);
      await F.save('worlds');
      F.toast(world ? '存档已更新' : '存档已建立');
      api.close(); done && done();
      if (!world) setTimeout(() => F.home.genSheet(w), 520);
    });
  });
};

/* ---------------- 正主体系（帖子、视频生成共用） ----------------
   正主 = 本批内容的主人公：可以是当前身份，也可以是某个角色。
   名气决定数据量级与讨论规模；舆论倾向决定评论区的立场分布。
------------------------------------------------------------------ */
F.home.proState = w => {
  const d = (w && w.protagonist) || {};
  return { ref: d.id ? { kind: d.kind, id: d.id } : null, fame: d.fame || '当红', tone: d.tone || '褒贬不一' };
};
F.home.proJob = pro => pro.ref && F.person(pro.ref) ? { kind: pro.ref.kind, id: pro.ref.id, fame: pro.fame, tone: pro.tone } : null;
F.home.saveProDefault = (w, pro) => { w.protagonist = pro.ref ? { kind: pro.ref.kind, id: pro.ref.id, fame: pro.fame, tone: pro.tone } : null; F.save('worlds'); };
F.home.proHTML = pro => {
  const me = F.me();
  const opts = [{ ref: null, name: '不设正主', sub: '普通的广场内容' }, { ref: { kind: 'user', id: me.id }, name: me.nickname, sub: '我（当前身份）', p: me }, ...F.state.charProfiles.map(c => ({ ref: { kind: 'char', id: c.id }, name: c.nickname, sub: '角色', p: c }))];
  return `<div class="group-title">正主<span class="gt-line"></span></div>
    <p class="hint" style="margin:-4px 8px 10px">绑定正主后，这批内容会围绕 TA 展开：粉丝、路人、营销号都在讨论 TA，TA 本人发的内容数据也是名人量级。</p>
    <div class="pro-list">${opts.map((o, i) => { const on = o.ref ? F.refEq(o.ref, pro.ref) : !pro.ref; return `<button class="pro-o ${on ? 'on' : ''}" data-pro="${i}">${o.p ? F.avatarHTML(o.p, 38) : `<span class="pro-none">${F.I('minus')}</span>`}<b>${F.esc(o.name)}</b><small>${o.sub}</small></button>`; }).join('')}</div>
    ${pro.ref ? `<div class="pro-cfg">
      <div class="f-label">名气</div><div class="chips" data-pf="fame">${['小有名气', '当红', '顶流'].map(v => `<button class="chip ${pro.fame === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      <div class="f-label" style="margin-top:12px">舆论倾向</div><div class="chips" data-pf="tone">${['好评为主', '褒贬不一', '争议风波'].map(v => `<button class="chip ${pro.tone === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      ${pro.ref.kind === 'user' ? '<p class="hint">正主是你本人时，AI 只会让别人讨论你、@你，不会替你发帖或说话。</p>' : ''}
    </div>` : ''}`;
};
F.home.proBind = (root, pro, redraw) => {
  const me = F.me();
  const refs = [null, { kind: 'user', id: me.id }, ...F.state.charProfiles.map(c => ({ kind: 'char', id: c.id }))];
  root.querySelectorAll('[data-pro]').forEach(b => b.onclick = () => { pro.ref = refs[+b.dataset.pro]; redraw(); });
  root.querySelectorAll('[data-pf]').forEach(g => g.querySelectorAll('.chip').forEach(c => c.onclick = () => { pro[g.dataset.pf] = c.dataset.v; redraw(); }));
};

/* ---------------- 选择生成内容（弹出页） ----------------
   opts.authorRef：只让某位博主/角色发帖（在 TA 的主页发起）
   opts.topic：只围绕某个话题生成（在话题页发起）
------------------------------------------------------------------ */
F.home.genSheet = (w, opts = {}) => {
  if (!w) return;
  const counts = {}; F.TYPE_ORDER.forEach(t => counts[t] = 0);
  const fixed = opts.authorRef || null;
  const defIds = (w.defaultChars || []).map(String);
  const sel = {};
  F.state.charProfiles.forEach(c => { if (defIds.length ? defIds.includes(String(c.id)) : (c.gen && c.gen.joinDefault)) sel[c.id] = (c.gen && c.gen.role) || 'both'; });
  if (fixed && fixed.kind === 'char') sel[fixed.id] = 'author';
  let charPosts = 0, extra = opts.topic ? `围绕话题 #${opts.topic}# 展开，视角各不相同` : '';
  const pro = F.home.proState(w);
  const MAX = 20;
  F.sheet({
    title: fixed ? `让 ${F.person(fixed).nickname} 发帖` : opts.topic ? `#${opts.topic}#` : w.name,
    sub: fixed ? `使用「${w.theme || w.name}」的世界观与文风` : opts.topic ? '为这个话题生成更多内容' : '选择想看的类型与篇数，可以自由组合',
    foot: true, cls: 'gen-sheet',
    render(api) {
      const total = () => Object.values(counts).reduce((s, x) => s + x, 0);
      const authorChars = () => Object.entries(sel).filter(([, r]) => r !== 'comment').map(([id]) => id);
      const draw = () => {
        const T = total();
        charPosts = Math.min(charPosts, T, authorChars().length ? T : 0);
        api.body.innerHTML = `
          <div class="gs-types">${F.TYPE_ORDER.map(t => `
            <div class="gs-type ${counts[t] ? 'has' : ''}">
              <span class="gs-glyph g-${t}">${F.I(F.TYPES[t].icon)}</span>
              <div class="gs-main"><b>${F.TYPES[t].name}</b><small>${F.TYPES[t].blurb}</small></div>
              <div class="stepper ${counts[t] ? 'has' : ''}"><button data-m="${t}" ${counts[t] ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button><span class="num">${counts[t]}</span><button data-p="${t}" ${T >= MAX ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button></div>
            </div>`).join('')}</div>
          ${!fixed && F.state.charProfiles.length ? `<div class="group-title">角色是否参与本次生成</div>
          <div class="gs-chars">${F.state.charProfiles.map(c => `
            <div class="gs-char ${sel[c.id] ? 'on' : ''}">
              <button class="gs-char-tg" data-tg="${c.id}">${F.avatarHTML(c, 36)}<div><b>${F.esc(c.nickname)}</b><small>${sel[c.id] ? '参与' : '不参与'}</small></div><span class="gs-ck">${sel[c.id] ? F.I('check') : ''}</span></button>
              ${sel[c.id] ? `<div class="gs-role">${[['both', '发帖+评论'], ['author', '只发帖'], ['comment', '只评论']].map(([v, l]) => `<button class="${sel[c.id] === v ? 'on' : ''}" data-role="${c.id}" data-v="${v}">${l}</button>`).join('')}</div>` : ''}
            </div>`).join('')}</div>
          ${authorChars().length && T ? `<div class="gs-cp"><div><b>其中由角色发布</b><small>其余由世界里的网友发布</small></div><div class="stepper ${charPosts ? 'has' : ''}"><button data-cpm ${charPosts ? '' : 'disabled'}><svg viewBox="0 0 24 24"><path d="M6 12h12"/></svg></button><span class="num">${charPosts}</span><button data-cpp ${charPosts >= T ? 'disabled' : ''}><svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg></button></div></div>` : ''}` : ''}
          ${F.home.proHTML(pro)}
          <div class="group-title">本次侧重（选填）</div>
          <textarea class="textarea" id="gsExtra" rows="2" maxlength="300" placeholder="如：围绕昨晚的停电事件；多一点反转">${F.esc(extra)}</textarea>`;
        api.foot.innerHTML = `<button class="gbtn lgx lg lg-dark block gs-go" ${T ? '' : 'disabled'}>${F.I('spark')}${T ? `生成 ${T} 篇` : '先选择内容类型'}</button><p class="hint" style="text-align:center;margin-top:8px">${T ? `将逐篇调用 AI，共 ${T} 次，每次上限 ${F.state.settings.maxTokens} tokens` : `单次最多 ${MAX} 篇`}</p>`;
        api.body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { if (total() < MAX) { counts[b.dataset.p]++; draw(); } });
        api.body.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { counts[b.dataset.m] = Math.max(0, counts[b.dataset.m] - 1); draw(); });
        api.body.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { const id = b.dataset.tg; sel[id] ? delete sel[id] : (sel[id] = (F.charProfile(id).gen || {}).role || 'both'); draw(); });
        api.body.querySelectorAll('[data-role]').forEach(b => b.onclick = () => { sel[b.dataset.role] = b.dataset.v; draw(); });
        const cpp = api.body.querySelector('[data-cpp]'); if (cpp) cpp.onclick = () => { charPosts++; draw(); };
        const cpm = api.body.querySelector('[data-cpm]'); if (cpm) cpm.onclick = () => { charPosts--; draw(); };
        F.home.proBind(api.body, pro, draw);
        api.body.querySelector('#gsExtra').oninput = e => extra = e.target.value;
        api.foot.querySelector('.gs-go').onclick = () => {
          if (!F.ai.ready()) return F.toast('请先到桌面「设置 › API」配置接口与模型', 'gear', 3200);
          const bag = []; const left = { ...counts };
          while (Object.values(left).some(x => x)) F.TYPE_ORDER.forEach(t => { if (left[t]) { bag.push(t); left[t]--; } });
          const authors = authorChars();
          const step = charPosts ? bag.length / charPosts : 0;
          const charSlots = new Set(); for (let k = 0; k < charPosts; k++) charSlots.add(Math.floor(k * step + step / 2));
          let ai = 0;
          const jobs = bag.map((type, index) => {
            const job = { index, type, worldId: w.id, extra: extra.trim(), chars: Object.keys(sel), roles: { ...sel }, status: 'wait', protagonist: F.home.proJob(pro), topic: opts.topic || '' };
            if (fixed) { if (fixed.kind === 'char') job.authorChar = fixed.id; else job.authorNpc = fixed.id; }
            else if (charSlots.has(index) && authors.length) job.authorChar = authors[(ai++) % authors.length];
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

/* ---------------- 生成动画页 ---------------- */
F.home.runGen = (w, jobs) => {
  F.nav.push(async (page, api) => {
    page.classList.add('gen-page');
    page.innerHTML = `
      <header class="topbar clear"><div class="tb-side"></div><div class="tb-title"></div><div class="tb-side r"><button class="gbtn sm lg" data-stop>${F.I('stop')}停止</button></div></header>
      <div class="page-scroll"><div class="gp">
        <div class="gp-stage">
          <div class="orb" id="orb"><i class="b1"></i><i class="b2"></i><i class="b3"></i><span class="orb-sheen"></span>
            <div class="orb-num"><b class="num-font" id="gpNum">0</b><small>/ ${jobs.length}</small></div>
          </div>
          <div class="orb-ring"></div>
        </div>
        <h2 class="gp-title" id="gpTitle">正在进入「${F.esc(w.name)}」</h2>
        <p class="gp-sub" id="gpSub">读取世界观、文风与角色设定</p>
        <div class="gp-meter"><i id="gpBar"></i></div>
        <div class="gp-jobs" id="gpJobs">${jobs.map((j, i) => `
          <div class="gp-job" data-j="${i}"><span class="gs-glyph ${j.kind === 'video' ? 'gv' : 'g-' + j.type}">${F.I((F.TYPES[j.type] || F.VTYPES[j.type]).icon)}</span>
            <div class="gj-main"><b>${F.typeName(j.type)}${j.kind === 'video' ? ' 视频' : ''}</b><small>${j.authorChar ? F.esc(F.charProfile(j.authorChar).nickname) + ' 发布' : j.authorNpc ? F.esc(F.npc(j.authorNpc).nickname) + ' 发布' : '网友发布'}${j.protagonist ? ' · 正主 ' + F.esc(F.person(j.protagonist).nickname) : ''}</small></div>
            <span class="gj-st"><i class="gj-wait"></i></span></div>`).join('')}</div>
        <div class="gp-done" id="gpDone"></div>
      </div></div>`;
    const $ = s => page.querySelector(s);
    let finished = 0;
    const setJob = (i, st, extraTxt) => {
      const el = page.querySelector(`[data-j="${i}"]`); if (!el) return;
      el.className = 'gp-job ' + st;
      const map = { writing: '<span class="spin"></span>', parsing: '<span class="spin"></span>', done: F.I('check'), fail: F.I('close'), cancel: F.I('minus') };
      el.querySelector('.gj-st').innerHTML = map[st] || '<i class="gj-wait"></i>';
      if (extraTxt != null) el.querySelector('small').textContent = extraTxt;
    };
    const phases = ['构思选题', '塑造作者', '撰写正文', '推演互动数据', '生成评论区'];
    page.querySelector('[data-stop]').onclick = async () => {
      if (!F.gen.running) return api.close();
      if (await F.confirm('停止生成？', '已完成的内容会保留。', '停止')) F.gen.cancel();
    };
    await F.sleep(500);
    const res = await F.gen.run(jobs, ({ i, job, phase, txt, error }) => {
      const n = F.typeName(job.type) + (job.kind === 'video' ? ' 视频' : '');
      if (phase === 'start') {
        $('#gpTitle').textContent = `正在撰写第 ${i + 1} 篇 · ${n}`; $('#gpSub').textContent = '连接模型…'; setJob(i, 'writing');
        F.scrollInto(page.querySelector('#gpJobs'), page.querySelector(`[data-j="${i}"]`), 'nearest');
      }
      if (phase === 'delta') {
        const k = F.clamp(Math.floor(txt.length / 700), 0, phases.length - 1);
        $('#gpSub').textContent = `${phases[k]} · 已写 ${txt.length.toLocaleString()} 字`;
        $('#orb').style.setProperty('--pulse', (1 + Math.min(.08, txt.length % 400 / 5000)).toFixed(3));
      }
      if (phase === 'retry') $('#gpSub').textContent = '格式校对中，正在重新整理…';
      if (phase === 'parse') { $('#gpSub').textContent = '整理格式并写入广场'; setJob(i, 'parsing'); }
      if (phase === 'done') { finished++; setJob(i, 'done'); const a = F.person(F.item(job.kind === 'video' ? 'video' : 'post', job.postId).author); page.querySelector(`[data-j="${i}"] small`).textContent = `${a.nickname} · 已完成`; }
      if (phase === 'fail') { finished++; setJob(i, 'fail', '失败：' + (error.message || '').slice(0, 40)); }
      if (phase === 'cancel') setJob(i, 'cancel', '已停止');
      $('#gpNum').textContent = jobs.filter(j => j.status === 'done').length;
      $('#gpBar').style.width = (finished / jobs.length * 100) + '%';
    });
    // 结束
    jobs.forEach((j, i) => { if (j.status === 'wait') setJob(i, 'cancel', '未开始'); });
    const ok = res.length, fail = jobs.filter(j => j.status === 'fail').length;
    page.classList.add('finished');
    $('#gpTitle').textContent = ok ? '生成完成' : '没有生成成功';
    $('#gpSub').textContent = ok ? `${ok} ${jobs[0].kind === 'video' ? '条视频' : '篇内容'}已经发布到「${w.theme || w.name}」${fail ? `，${fail} 条失败` : ''}` : '请检查 API 设置或稍后重试';
    page.querySelector('[data-stop]').innerHTML = `${F.I('close')}关闭`;
    $('#gpDone').innerHTML = `${ok ? `<button class="gbtn lgx lg lg-dark block" data-view>${F.I('grid')}查看内容</button>` : ''}
      ${fail ? `<button class="gbtn lgx lg block" data-retry>${F.I('refresh')}重试失败的 ${fail} 篇</button>` : ''}
      <button class="gbtn lgx lg block" data-again>${F.I('spark')}再生成一批</button>`;
    const isVideo = jobs[0] && jobs[0].kind === 'video';
    const v = page.querySelector('[data-view]'); if (v) v.onclick = () => {
      F.nav.popAll();
      if (isVideo) { F.video.tab = 'rec'; F.tabs.go('video'); setTimeout(() => F.tabs.refresh(), 60); }
      else { F.home.cat = w.id; F.home.shown = 20; F.tabs.go('home'); setTimeout(() => F.tabs.refresh(), 60); }
    };
    const r = page.querySelector('[data-retry]'); if (r) r.onclick = () => { const again = jobs.filter(j => j.status === 'fail').map((j, k) => ({ ...j, index: k, status: 'wait', error: null })); api.close(); setTimeout(() => F.home.runGen(w, again), 400); };
    page.querySelector('[data-again]').onclick = () => { api.close(); setTimeout(() => isVideo ? F.video.genFlow({ world: w }) : F.home.genSheet(w), 400); };
  });
};

/* =========================================================
   私信
   · 列表：未读优先；“来信”按所选存档生成别人主动发来的私信
   · 会话：分组气泡、时间戳、已读、分享卡片、背景切换
   · 只有点按“请 TA 回复”才会调用 AI；条数不固定且至少两条
========================================================= */
F.dm = {};
F.dm.thread = (peer, create = true) => {
  const me = F.state.activeIdentityId;
  let t = F.state.dms.find(x => x.identityId === me && F.refEq(x.peer, peer));
  if (!t && create) { t = { id: F.uid('dm'), identityId: me, peer: { kind: peer.kind, id: peer.id }, messages: [], unread: 0, updatedAt: Date.now() }; F.state.dms.push(t); }
  return t;
};
F.dm.preview = m => m.share ? `[分享] ${(() => { const o = F.item(m.share.kind, m.share.id); return o ? (o.title || F.plain(o.content || '')).slice(0, 20) : '内容已删除'; })()}` : m.text;
F.dm.relation = ref => {
  const f = F.isFollowing(ref);
  const back = ref.kind === 'char' || (ref.kind === 'npc' && F.rng(ref.id + F.state.activeIdentityId)() < .35);
  return f && back ? '互相关注' : f ? '已关注' : back ? '关注了你' : '';
};

F.dm.openList = (at) => {
  F.nav.push((page, api) => {
    let worldId = (F.world(F.home.cat) || F.state.worlds[0] || {}).id || null;
    const draw = () => {
      const ts = F.state.dms.filter(t => t.identityId === F.state.activeIdentityId && t.messages.length)
        .sort((a, b) => (b.unread ? 1 : 0) - (a.unread ? 1 : 0) || b.updatedAt - a.updatedAt);
      const unread = ts.reduce((s, t) => s + (t.unread || 0), 0);
      const w = F.world(worldId);
      page.innerHTML = `${F.topbar('私信', { sub: unread ? `${unread} 条未读` : '以 ' + F.me().nickname + ' 的身份', right: `<button class="gorb lg" data-new>${F.I('edit')}</button>` })}
        <div class="page-scroll"><div class="dm-list">
          <div class="dm-inbox lg" style="--lg-r:26px">
            <div class="dmi-top"><span class="dmi-ic">${F.I('mail')}</span><div><b>来信</b><small>${F.isVerified(F.me()) ? '粉丝来信、商务邀约、同行交流' : '朋友、同好与网友主动找你聊天'}</small></div></div>
            ${F.state.worlds.length ? `<div class="chips dmi-worlds">${F.state.worlds.map(x => `<button class="chip ${x.id === worldId ? 'on' : ''}" data-w="${x.id}">${F.esc(x.theme || x.name)}</button>`).join('')}</div>
            <button class="gbtn lg lg-dark block" data-inbox>${F.I('spark')}按「${F.esc(w ? (w.theme || w.name) : '')}」生成来信</button>` : `<p class="hint">先在首页「生成」里建立一个内容存档，来信会按存档的世界观生成。</p>`}
          </div>
          ${ts.length ? `<div class="dm-sec">消息</div>` + ts.map(t => { const p = F.person(t.peer); const last = t.messages[t.messages.length - 1]; const rel = F.dm.relation(t.peer); return `
            <button class="dm-item ${t.unread ? 'unread' : ''}" data-t="${t.id}">
              <div class="dm-av">${F.avatarHTML(p, 54)}${t.unread ? '<i class="dm-ring"></i>' : ''}</div>
              <div class="dm-main"><div class="dm-top"><b>${F.esc(p.nickname)}${F.isVerified(p) ? F.vbadge(p.kind !== 'char') : ''}</b><small>${F.ago(t.updatedAt)}</small></div>
              <p class="dm-last">${last.from === 'me' ? '<span class="dm-me">我</span>' : ''}${F.esc(F.dm.preview(last))}</p>
              ${rel ? `<span class="dm-rel">${rel}</span>` : ''}</div>
              ${t.unread ? `<i class="dm-dot num-font">${t.unread}</i>` : ''}</button>`; }).join('') :
            `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I('mail')}</div><h4>还没有私信</h4><p>在任何人的主页点「私信」，点右上角发起聊天，<br>或点上面的「来信」看看谁在找你。</p></div>`}
        </div></div>`;
      F.bindBack(page, api);
      page.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = F.state.dms.find(x => x.id === b.dataset.t); F.dm.openChat(t.peer); });
      page.querySelectorAll('[data-w]').forEach(b => b.onclick = () => { worldId = b.dataset.w; draw(); });
      const ib = page.querySelector('[data-inbox]');
      if (ib) ib.onclick = async () => {
        if (!F.ai.ready()) return F.toast('请先到桌面「设置 › API」配置接口', 'gear', 2600);
        if (ib.classList.contains('busy')) return;
        ib.classList.add('busy'); ib.innerHTML = `<span class="spin" style="border-color:rgba(255,255,255,.25);border-top-color:#fff"></span>正在等待来信…`;
        try {
          const list = await F.ai.inbox(F.world(worldId), 3 + Math.floor(Math.random() * 3));
          let n = 0;
          list.forEach(th => {
            const ref = F.ai.ensureNpc(worldId, th);
            const t = F.dm.thread(ref);
            const base = Date.now() - (th.messages.length + 1) * 45000 - Math.floor(Math.random() * 600000);
            th.messages.map(String).filter(Boolean).forEach((m, k) => t.messages.push({ from: 'peer', text: m, time: base + k * (20000 + Math.random() * 60000) }));
            t.unread = (t.unread || 0) + th.messages.length; t.updatedAt = Date.now() - Math.floor(Math.random() * 60000); n++;
          });
          await F.save('dms', 'npcs');
          F.toast(`收到 ${n} 位的来信`, 'mail');
        } catch (e) { F.toast('来信生成失败：' + e.message, 'close', 3200); }
        draw();
      };
      page.querySelector('[data-new]').onclick = async () => {
        const people = [...F.state.charProfiles.map(c => ({ kind: 'char', id: c.id })), ...(F.me().following || [])];
        const uniq = people.filter((r, i) => people.findIndex(x => F.refEq(x, r)) === i && F.person(r));
        if (!uniq.length) return F.toast('先关注一些人，或为角色建档', 'users');
        const v = await F.menu('发起私信', uniq.map(r => { const p = F.person(r); return { label: p.nickname, sub: '@' + p.handle + (r.kind === 'char' ? ' · 角色' : ''), value: r.kind + ':' + r.id }; }));
        if (v) { const [kind, id] = v.split(':'); F.dm.openChat({ kind, id }); }
      };
    };
    draw(); page._refresh = draw;
  }, at ? { fromCore: at } : {});
};

F.dm.BGS = [
  { v: 'porcelain', l: '瓷白' }, { v: 'mist', l: '银雾流光' }, { v: 'pearl', l: '珍珠贝母' }, { v: 'graphite', l: '石墨夜' }, { v: 'image', l: '自定义图片' }
];
F.dm.openChat = (peer) => {
  const p = F.person(peer);
  if (p.kind === 'user' && p.privacy && p.privacy.dm === 'none') return F.toast('对方关闭了私信', 'lock');
  F.nav.push((page, api) => {
    const t = F.dm.thread(peer);
    t.unread = 0; F.save('dms');
    const w = p.kind === 'npc' ? F.world(p.worldId) : null;
    page.classList.add('dm-page');
    page.innerHTML = `
      <div class="dm-bg"></div>
      <header class="topbar dm-head"><div class="tb-side"><button class="gorb lg" data-back>${F.I('back')}</button></div>
        <button class="tb-title dm-peer" data-peer>${F.avatarHTML(p, 34)}<span><b>${F.esc(p.nickname)}${F.isVerified(p) ? F.vbadge(p.kind !== 'char') : ''}</b><small>${F.esc(F.dm.relation(peer) || '@' + p.handle)}</small></span></button>
        <div class="tb-side r"><button class="gorb lg" data-menu>${F.I('more')}</button></div></header>
      <div class="page-scroll dm-scroll"><div class="dm-msgs" id="dmMsgs"></div></div>
      <div class="dt-bar dm-bar">
        <button class="gorb lg dm-ask" data-ask title="请 TA 回复">${F.I('spark')}</button>
        <div class="dt-input lg" style="--lg-r:22px"><textarea rows="1" placeholder="发私信…" maxlength="500"></textarea><button class="dt-send" disabled>${F.I('send')}</button></div>
      </div>`;
    F.bindBack(page, api);
    const bgEl = page.querySelector('.dm-bg');
    const applyBg = () => {
      const bg = t.bg || { type: 'porcelain' };
      page.dataset.bg = bg.type;
      bgEl.innerHTML = bg.type === 'image' && bg.src ? `<img src="${bg.src}"><i class="dm-bg-veil"></i>` : '<i></i><i></i><i></i>';
      page._tone = bg.type === 'graphite' || (bg.type === 'image' && bg.dark);
      F.statusbar.tone(page._tone);
    };
    applyBg();
    const box = page.querySelector('#dmMsgs'), sc = page.querySelector('.dm-scroll'), ta = page.querySelector('textarea'), send = page.querySelector('.dt-send');
    const hm = ts => { const d = new Date(ts); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
    const dayLabel = ts => {
      const d = new Date(ts), n = new Date(); const y = new Date(Date.now() - 86400e3);
      const same = (a, b) => a.toDateString() === b.toDateString();
      return (same(d, n) ? '今天' : same(d, y) ? '昨天' : `${d.getMonth() + 1}月${d.getDate()}日`) + ' ' + hm(ts);
    };
    const draw = (typing) => {
      const ms = t.messages;
      let html = ms.length ? '' : `<div class="dm-hello"><div class="dm-hello-av">${F.avatarHTML(p, 72)}</div><b>${F.esc(p.nickname)}${F.isVerified(p) ? F.vbadge(p.kind !== 'char') : ''}</b><small>@${F.esc(p.handle)}${w ? ` · 来自「${F.esc(w.theme || w.name)}」` : p.kind === 'char' ? ' · 角色' : ''}</small>${F.dm.relation(peer) ? `<span class="dm-rel">${F.dm.relation(peer)}</span>` : ''}</div>`;
      let prev = null;
      ms.forEach((m, i) => {
        const next = ms[i + 1];
        if (!prev || m.time - prev.time > 10 * 60000) html += `<div class="dm-time"><span>${dayLabel(m.time)}</span></div>`;
        const first = !prev || prev.from !== m.from || m.time - prev.time > 3 * 60000;
        const last = !next || next.from !== m.from || next.time - m.time > 3 * 60000;
        const body = m.share ? F.share.bubble(m) : `<p>${F.esc(m.text).replace(/\n/g, '<br>')}</p>`;
        html += `<div class="bub ${m.from} ${first ? 'first' : ''} ${last ? 'last' : ''} ${m.share ? 'is-share' : ''}">
          ${m.from === 'peer' ? `<div class="bub-av">${last ? F.avatarHTML(p, 30) : ''}</div>` : ''}
          <div class="bub-col">${body}${last ? `<span class="bub-ts">${hm(m.time)}${m.from === 'me' ? (ms.slice(i + 1).some(x => x.from === 'peer') ? ' · 已读' : ' · 已送达') : ''}</span>` : ''}</div>
        </div>`;
        prev = m;
      });
      if (typing) html += `<div class="bub peer first last"><div class="bub-av">${F.avatarHTML(p, 30)}</div><div class="bub-col"><p class="typing"><span class="cm-typing"><i></i><i></i><i></i></span></p></div></div>`;
      box.innerHTML = html;
      requestAnimationFrame(() => sc.scrollTop = sc.scrollHeight);
    };
    draw();
    ta.oninput = () => { send.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; };
    send.onclick = async () => {
      const v = ta.value.trim(); if (!v) return;
      t.messages.push({ from: 'me', text: v, time: Date.now() }); t.updatedAt = Date.now();
      ta.value = ''; ta.oninput(); await F.save('dms'); draw();
      page.querySelector('[data-ask]').classList.add('hint-pulse');
    };
    page.querySelector('[data-ask]').onclick = async e => {
      const b = e.currentTarget; if (b.classList.contains('busy')) return;
      if (!t.messages.length) return F.toast('先发一条消息吧', 'mail');
      if (!F.ai.ready()) return F.toast('请先到桌面「设置 › API」配置接口', 'gear', 2600);
      b.classList.add('busy'); b.classList.remove('hint-pulse'); draw(true);
      try {
        const msgs = await F.ai.dmReply(t);
        for (let k = 0; k < msgs.length; k++) {
          await F.sleep(420 + Math.min(1600, msgs[k].length * 38));
          t.messages.push({ from: 'peer', text: msgs[k], time: Date.now() });
          draw(k < msgs.length - 1);
        }
        t.updatedAt = Date.now(); await F.save('dms');
      } catch (err) { draw(); F.toast(err.message, 'close', 3500); }
      b.classList.remove('busy');
    };
    page.querySelector('[data-peer]').onclick = () => F.people.open(peer);
    page.querySelector('[data-menu]').onclick = async () => {
      const cur = (t.bg && t.bg.type) || 'porcelain';
      const v = await F.menu(p.nickname, [
        ...F.dm.BGS.map(b => ({ label: '背景 · ' + b.l, value: 'bg:' + b.v, icon: b.v === 'image' ? 'image' : 'grid', on: cur === b.v })),
        { label: '查看主页', value: 'home', icon: 'users' },
        { label: '清空聊天记录', value: 'clear', icon: 'trash', danger: true }
      ]);
      if (!v) return;
      if (v.startsWith('bg:')) {
        const type = v.slice(3);
        if (type === 'image') {
          const [f] = await F.pickImages(); if (!f) return;
          const src = await F.readImage(f, 1400);
          t.bg = { type, src, dark: (await F.lum(src)) < .5 };
        } else t.bg = { type };
        await F.save('dms'); applyBg(); F.toast('背景已更换');
      }
      if (v === 'home') F.people.open(peer);
      if (v === 'clear' && await F.confirm('清空聊天记录？', '只清空当前身份与 TA 的记录。', '清空', true)) { t.messages = []; await F.save('dms'); draw(); }
    };
    page._refresh = () => { applyBg(); draw(); };
  });
};