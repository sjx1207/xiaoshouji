/* =========================================================
   论坛 · 他人主页 / 热搜 / 短视频  forum-people.js
========================================================= */
F.people = {};

F.people.toggleFollow = ref => {
  const me = F.me(); me.following = me.following || [];
  const i = me.following.findIndex(r => F.refEq(r, ref));
  if (i < 0) { me.following.push({ kind: ref.kind, id: ref.id }); F.toast('已关注', 'check', 1300); }
  else { me.following.splice(i, 1); F.toast('已取消关注', 'minus', 1300); }
  F.save('identities');
  return i < 0;
};

/* 网友 / 角色的点赞与收藏：由种子稳定推导，每次打开都一致 */
F.people.derived = (ref, kind) => {
  const r = F.rng(ref.id + kind);
  const person = F.person(ref);
  const pool = F.state.posts.filter(p => !F.refEq(p.author, ref) && (ref.kind !== 'npc' || p.worldId === person.worldId) && p.visibility !== 'self');
  return pool.filter(() => r() < (kind === 'likes' ? .3 : .14)).sort((a, b) => b.createdAt - a.createdAt);
};

F.people.open = ref => {
  if (!ref) return;
  if (ref.kind === 'user' && ref.id === F.state.activeIdentityId) { F.nav.popAll(); F.tabs.go('me'); return; }
  const p0 = F.person(ref);
  F.nav.push((page, api) => {
    let tab = 'posts';
    page.classList.add('people-page');
    const draw = () => {
      const p = F.person(ref);
      const posts = F.postsBy(ref).filter(x => x.visibility === 'public' || (x.visibility === 'fans' && F.isFollowing(ref)));
      let likes, favs;
      if (ref.kind === 'user') {
        likes = p.privacy && p.privacy.showLikes === false ? null : F.state.posts.filter(x => (x.likedBy || []).includes(ref.id));
        favs = p.privacy && p.privacy.showFavs === false ? null : F.state.posts.filter(x => (x.favBy || []).includes(ref.id));
      } else { likes = F.people.derived(ref, 'likes'); favs = F.people.derived(ref, 'favs'); }
      const w = ref.kind === 'npc' ? F.world(p.worldId) : null;
      const following = F.isFollowing(ref);
      page.innerHTML = `
        <div class="page-scroll" id="ppScroll">
          <div class="pf-compact"><span class="pf-compact-name">${F.esc(p.nickname)}</span></div>
          <div class="pf-float"><button class="gorb lg ${p.cover && p.coverDark ? 'lg-on-img' : ''}" data-back>${F.I('back')}</button><span style="flex:1"></span><button class="gorb lg ${p.cover && p.coverDark ? 'lg-on-img' : ''}" data-more>${F.I('more')}</button></div>
          ${F.profile.header(p)}
          ${w ? `<div class="pp-world"><span>${F.I('globe')}</span>来自「${F.esc(w.theme || w.name)}」${p.persona ? ` · ${F.esc(p.persona)}` : ''}</div>` : ''}
          <div class="pf-pad"><div class="seg pf-seg" id="ppSeg">
            <button data-v="posts" class="${tab === 'posts' ? 'on' : ''}">帖子<i>${posts.length}</i></button>
            <button data-v="likes" class="${tab === 'likes' ? 'on' : ''}">点赞<i>${likes ? likes.length : ''}</i></button>
            <button data-v="favs" class="${tab === 'favs' ? 'on' : ''}">收藏<i>${favs ? favs.length : ''}</i></button>
          </div></div>
          <div class="feed" id="ppFeed"></div>
        </div>`;
      page.querySelector('[data-slot="btns"]').innerHTML = `
        <button class="gbtn lg ${following ? '' : 'lg-dark'}" data-follow>${following ? F.I('check') + '已关注' : F.I('plus') + '关注'}</button>
        <button class="gorb lg" data-dm>${F.I('mail')}</button>`;
      F.bindBack(page, api);
      const feed = page.querySelector('#ppFeed');
      const drawFeed = () => {
        const L = tab === 'posts' ? posts : tab === 'likes' ? likes : favs;
        if (L === null) feed.innerHTML = `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I('lock')}</div><h4>TA 设置了隐私</h4><p>这个列表不公开</p></div>`;
        else if (!L.length) feed.innerHTML = `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I(tab === 'posts' ? 'doc' : tab === 'likes' ? 'heart' : 'fav')}</div><h4>${tab === 'posts' ? '还没有发布内容' : '这里还空着'}</h4><p>${tab === 'posts' && ref.kind !== 'user' ? '在「生成内容」里选择包含 TA 的存档，TA 就会开始发帖' : ''}</p></div>`;
        else feed.innerHTML = L.map(F.cards.render).join('');
      };
      drawFeed(); F.bindFeed(feed);
      F.seg(page.querySelector('#ppSeg'), v => { tab = v; drawFeed(); });
      page.querySelector('[data-follow]').onclick = () => { F.people.toggleFollow(ref); const top = page.querySelector('#ppScroll').scrollTop; draw(); page.querySelector('#ppScroll').scrollTop = top; };
      page.querySelector('[data-dm]').onclick = () => F.dm.openChat(ref);
      page.querySelector('[data-more]').onclick = async () => {
        const items = [{ label: '发私信', value: 'dm', icon: 'mail' }];
        if (ref.kind === 'char') items.push({ label: '编辑 TA 的论坛档案', value: 'edit', icon: 'edit' });
        items.push({ label: '复制用户名', value: 'copy', icon: 'at' });
        const v = await F.menu(p.nickname, items);
        if (v === 'dm') F.dm.openChat(ref);
        if (v === 'edit') F.edit.open('char');
        if (v === 'copy') { try { await navigator.clipboard.writeText('@' + p.handle); F.toast('已复制'); } catch (e) {} }
      };
      page.querySelectorAll('[data-count]').forEach(b => b.onclick = () => F.people.follows(ref, b.dataset.count));
      const sc = page.querySelector('#ppScroll');
      const dark = !!(p.cover && p.coverDark);
      page._tone = dark; F.statusbar.tone(dark);
      sc.addEventListener('scroll', () => {
        const y = sc.scrollTop, on = y > 190;
        page.querySelector('.pf-compact').classList.toggle('show', on);
        page.querySelector('.pf-float').classList.toggle('solid', on);
        page._tone = dark && y < 150; F.statusbar.tone(page._tone);
      }, { passive: true });
    };
    draw();
    page._refresh = () => { const sc = page.querySelector('#ppScroll'); const y = sc ? sc.scrollTop : 0; draw(); page.querySelector('#ppScroll').scrollTop = y; };
  }, { darkTop: !!(p0.cover && p0.coverDark) });
};

/* 关注 / 粉丝列表 */
F.people.follows = (ref, kind) => {
  const p = F.person(ref);
  if (kind === 'likes') return F.toast(`${p.nickname} 共获得 ${F.num(F.likesReceived(ref))} 个赞`, 'heart');
  if (kind === 'posts') return;
  F.sheet({
    title: kind === 'following' ? `${p.nickname} 的关注` : `${p.nickname} 的粉丝`,
    render(api) {
      let refs = [], extra = 0;
      if (kind === 'following') {
        if (ref.kind === 'user') { refs = p.following || []; extra = (p.base && p.base.following) || 0; }
        else extra = F.followingCount(p);
      } else {
        refs = F.state.identities.filter(i => (i.following || []).some(r => F.refEq(r, ref))).map(i => ({ kind: 'user', id: i.id }));
        extra = F.followerCount(p) - refs.length;
      }
      api.body.innerHTML = `<div class="group">${refs.map(r => { const x = F.person(r); return `<button class="row" data-p="${r.kind}:${r.id}" style="width:100%;text-align:left">${F.avatarHTML(x, 40)}<div class="r-main"><div class="r-title">${F.esc(x.nickname)}${F.isVerified(x) ? F.vbadge(x.kind !== 'char') : ''}</div><div class="r-sub">@${F.esc(x.handle)}${r.kind === 'user' ? ' · 你的身份' : r.kind === 'char' ? ' · 角色' : ''}</div></div><svg class="chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>`; }).join('')}
        ${extra > 0 ? `<div class="row"><div class="r-main"><div class="r-sub">${refs.length ? '以及另外 ' : '共 '}${F.num(extra)} 位${kind === 'following' ? '被关注的用户' : '网友'}</div></div></div>` : ''}
        ${!refs.length && extra <= 0 ? '<div class="row"><div class="r-sub">暂时还没有</div></div>' : ''}</div>`;
      api.body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const [k, id] = b.dataset.p.split(':'); api.close(); setTimeout(() => F.people.open({ kind: k, id }), 300); });
    }
  });
};

/* ---------------- 热搜 Tab ---------------- */
F.hot = {};
F.hot.compute = () => {
  const map = {};
  const now = Date.now();
  F.state.posts.filter(p => p.visibility !== 'self').forEach(p => {
    const heat = ((p.stats.views || 0) / 10 + F.likeCount(p) + F.commentCount(p) * 4 + F.favCount(p) * 2 + (p.stats.reposts || 0) * 3) * (1 + Math.max(0, 1 - (now - p.createdAt) / (86400e3 * 3)));
    const keys = new Set([p.topic, ...(p.tags || [])].filter(Boolean).map(s => String(s).trim()).filter(Boolean));
    keys.forEach(k => {
      map[k] = map[k] || { name: k, heat: 0, posts: [], latest: 0, worlds: new Set() };
      map[k].heat += heat; map[k].posts.push(p); map[k].latest = Math.max(map[k].latest, p.createdAt);
      if (p.worldId) map[k].worlds.add(p.worldId);
    });
  });
  return Object.values(map).sort((a, b) => b.heat - a.heat);
};
F.tabs.renderers.hot = view => {
  const list = F.hot.compute().slice(0, 30);
  const max = list[0] ? list[0].heat : 1;
  const flag = t => { if (Date.now() - t.latest < 3600e3 * 2) return '<i class="hs-flag new">新</i>'; if (t.heat > max * .7) return '<i class="hs-flag boil">沸</i>'; if (t.heat > max * .35) return '<i class="hs-flag hot">热</i>'; return ''; };
  const bloggers = [...F.state.npcs.map(n => ({ kind: 'npc', id: n.id })), ...F.state.charProfiles.map(c => ({ kind: 'char', id: c.id }))]
    .map(r => ({ r, p: F.person(r) })).sort((a, b) => F.followerCount(b.p) - F.followerCount(a.p)).slice(0, 10);
  view.innerHTML = `
    <div class="hs-top"><h1>热搜</h1><small>根据广场里的浏览、点赞、评论与收藏实时计算</small></div>
    ${!list.length ? `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I('flame')}</div><h4>还没有热搜</h4><p>生成或发布带话题的内容后，热搜榜会自动出现。</p></div>` : `
    <div class="hs-podium">${list.slice(0, 3).map((t, i) => `
      <button class="hs-pod p${i + 1}" data-topic="${F.esc(t.name)}">
        <span class="hs-rank num-font">${i + 1}</span>
        <b>#${F.esc(t.name)}#</b>
        <small>${F.num(Math.round(t.heat * 37))} 热度 · ${t.posts.length} 条讨论</small>
        <div class="hs-bar"><i style="width:${t.heat / max * 100}%"></i></div>
      </button>`).join('')}</div>
    <div class="hs-list">${list.slice(3).map((t, i) => `
      <button class="hs-item" data-topic="${F.esc(t.name)}"><span class="hs-n num-font">${i + 4}</span><div class="hs-main"><b>${F.esc(t.name)}</b>${flag(t)}<small>${F.num(Math.round(t.heat * 37))} · ${t.posts.length} 条</small></div><svg class="chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></button>`).join('')}</div>`}
    ${bloggers.length ? `<div class="group-title" style="margin:24px 20px 10px">人气博主</div>
    <div class="hs-people">${bloggers.map(({ r, p }) => `<button class="hs-person" data-p="${r.kind}:${r.id}">${F.avatarHTML(p, 58)}<b>${F.esc(p.nickname)}</b><small>${F.num(F.followerCount(p))} 粉丝</small></button>`).join('')}</div>` : ''}`;
  view.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => F.hot.topic(b.dataset.topic));
  view.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const [kind, id] = b.dataset.p.split(':'); F.people.open({ kind, id }); });
};
F.hot.topic = name => {
  F.nav.push((page, api) => {
    const draw = () => {
      const t = F.hot.compute().find(x => x.name === name);
      const posts = t ? t.posts.slice().sort((a, b) => b.createdAt - a.createdAt) : [];
      page.innerHTML = `${F.topbar('#' + name + '#', { sub: `${posts.length} 条讨论` })}<div class="page-scroll"><div class="feed" style="padding-top:6px">${posts.map(F.cards.render).join('') || '<div class="empty"><p>暂无内容</p></div>'}</div></div>`;
      F.bindBack(page, api); F.bindFeed(page.querySelector('.feed'));
    };
    draw(); page._refresh = draw;
  });
};

/* ---------------- 短视频 Tab（占位） ---------------- */
F.tabs.renderers.video = view => {
  if (view.dataset.ready) return;
  view.dataset.ready = '1';
  view.innerHTML = `<div class="vd">
    <div class="vd-frame">
      <div class="vd-screen">${F.art.photoSVG('video-a')}<div class="vd-play lg lg-on-img">${F.I('play')}</div></div>
      <div class="vd-screen s2">${F.art.photoSVG('video-b')}</div>
      <div class="vd-screen s3">${F.art.photoSVG('video-c')}</div>
    </div>
    <h2>短视频即将开放</h2>
    <p>上下滑动的沉浸式短视频流正在筹备中。<br>届时，存档里的博主与角色也会在这里更新 vlog。</p>
  </div>`;
};
