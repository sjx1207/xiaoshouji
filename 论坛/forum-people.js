/* =========================================================
   论坛 · 他人主页  forum-people.js
   帖子 / 视频 / 点赞 / 收藏 / 转发 / 讨论（正主）
   更多菜单：让 TA 发新帖子、发新视频（只由 TA 本人发布）
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
  const pool = [...F.state.posts.filter(p => p.type !== 'repost'), ...F.state.videos].filter(p => !F.refEq(p.author, ref) && (ref.kind !== 'npc' || p.worldId === person.worldId) && p.visibility !== 'self');
  return pool.filter(() => r() < (kind === 'likes' ? .3 : .14)).sort((a, b) => b.createdAt - a.createdAt);
};

/* 为 TA 生成内容：只由 TA 本人发布，使用所选存档 */
F.people.genFor = async (ref, kind) => {
  if (!F.state.worlds.length) { F.toast('先建立一个内容存档', 'grid'); return F.home.openWorlds(); }
  const p = F.person(ref);
  let w = ref.kind === 'npc' ? F.world(p.worldId) : null;
  if (!w) {
    if (F.state.worlds.length === 1) w = F.state.worlds[0];
    else {
      const id = await F.menu('使用哪个存档的世界观？', F.state.worlds.map(x => ({ label: x.name, sub: x.theme, value: x.id, icon: 'grid', on: x.id === F.home.cat })));
      if (!id) return; w = F.world(id);
    }
  }
  if (kind === 'video') F.video.genFlow({ world: w, authorRef: ref });
  else F.home.genSheet(w, { authorRef: ref });
};

F.people.open = ref => {
  if (!ref) return;
  if (ref.kind === 'user' && ref.id === F.state.activeIdentityId) { F.nav.popAll(); F.tabs.go('me'); return; }
  const p0 = F.person(ref);
  F.video && F.video.pauseAll();
  F.nav.push((page, api) => {
    let tab = 'posts';
    page.classList.add('people-page');
    const draw = () => {
      const p = F.person(ref);
      const vis = x => x.visibility === 'public' || !x.visibility || (x.visibility === 'fans' && F.isFollowing(ref));
      const posts = F.postsBy(ref).filter(vis);
      const videos = F.videosBy(ref);
      let likes, favs, reposts;
      if (ref.kind === 'user') {
        const all = [...F.state.posts, ...F.state.videos];
        likes = p.privacy && p.privacy.showLikes === false ? null : all.filter(x => (x.likedBy || []).includes(ref.id));
        favs = p.privacy && p.privacy.showFavs === false ? null : all.filter(x => (x.favBy || []).includes(ref.id));
        reposts = F.repostsBy(ref);
      } else {
        likes = F.people.derived(ref, 'likes'); favs = F.people.derived(ref, 'favs');
        reposts = [...F.repostsBy(ref), ...F.share.derived(ref)].sort((a, b) => b.createdAt - a.createdAt);
      }
      const about = F.aboutRef(ref);
      const lists = { posts, videos, likes, favs, reposts, about };
      const tabs = [['posts', '帖子', posts.length], videos.length ? ['videos', '视频', videos.length] : null, ['likes', '点赞', likes ? likes.length : ''], ['favs', '收藏', favs ? favs.length : ''], ['reposts', '转发', reposts.length], about.length ? ['about', '讨论', about.length] : null].filter(Boolean);
      if (!tabs.some(x => x[0] === tab)) tab = 'posts';
      const w = ref.kind === 'npc' ? F.world(p.worldId) : null;
      const following = F.isFollowing(ref);
      page.innerHTML = `
        <div class="page-scroll" id="ppScroll">
          <div class="pf-compact"><span class="pf-compact-name">${F.esc(p.nickname)}</span></div>
          <div class="pf-float"><button class="gorb lg ${p.cover && p.coverDark ? 'lg-on-img' : ''}" data-back>${F.I('back')}</button><span style="flex:1"></span><button class="gorb lg ${p.cover && p.coverDark ? 'lg-on-img' : ''}" data-more>${F.I('more')}</button></div>
          ${F.profile.header(p)}
          ${w ? `<div class="pp-world"><span>${F.I('globe')}</span>来自「${F.esc(w.theme || w.name)}」</div>` : ''}
          <div class="pf-pad"><div class="seg pf-seg ${tabs.length > 4 ? 'dense' : ''}" id="ppSeg">${tabs.map(([v, l, n]) => `<button data-v="${v}" class="${tab === v ? 'on' : ''}">${l}<i>${n}</i></button>`).join('')}</div></div>
          <div class="feed" id="ppFeed"></div>
        </div>`;
      page.querySelector('[data-slot="btns"]').innerHTML = `
        <button class="gbtn lg ${following ? '' : 'lg-dark'}" data-follow>${following ? F.I('check') + '已关注' : F.I('plus') + '关注'}</button>
        <button class="gorb lg" data-dm>${F.I('mail')}</button>`;
      F.bindBack(page, api);
      const feed = page.querySelector('#ppFeed');
      const drawFeed = () => {
        const L = lists[tab];
        const icon = { posts: 'doc', videos: 'play', likes: 'heart', favs: 'fav', reposts: 'repost', about: 'crown' }[tab];
        if (L === null) feed.innerHTML = `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I('lock')}</div><h4>TA 设置了隐私</h4><p>这个列表不公开</p></div>`;
        else if (!L.length) feed.innerHTML = `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I(icon)}</div><h4>${tab === 'posts' ? '还没有发布内容' : '这里还空着'}</h4>${tab === 'posts' && ref.kind !== 'user' ? `<p>可以让 TA 按所选存档的世界观发布新内容</p><button class="gbtn lg lg-dark" data-gen-for="post">${F.I('spark')}让 TA 发帖子</button>` : ''}</div>`;
        else feed.innerHTML = L.map(F.cards.renderAny).join('');
        const g = feed.querySelector('[data-gen-for]'); if (g) g.onclick = () => F.people.genFor(ref, g.dataset.genFor);
      };
      drawFeed(); F.bindFeed(feed);
      F.seg(page.querySelector('#ppSeg'), v => { tab = v; drawFeed(); });
      page.querySelector('[data-follow]').onclick = () => { F.people.toggleFollow(ref); const top = page.querySelector('#ppScroll').scrollTop; draw(); page.querySelector('#ppScroll').scrollTop = top; };
      page.querySelector('[data-dm]').onclick = () => F.dm.openChat(ref);
      page.querySelector('[data-more]').onclick = async () => {
        const items = [];
        if (ref.kind !== 'user') items.push({ label: '让 TA 发新帖子', sub: '只由 TA 本人发布，贴合 TA 的人设与领域', value: 'genp', icon: 'spark' }, { label: '让 TA 发新视频', sub: '逐帧脚本，模拟真实短视频', value: 'genv', icon: 'play' });
        items.push({ label: '发私信', value: 'dm', icon: 'mail' });
        if (ref.kind === 'char') items.push({ label: '编辑 TA 的论坛档案', value: 'edit', icon: 'edit' });
        items.push({ label: '复制用户名', value: 'copy', icon: 'at' });
        const v = await F.menu(p.nickname, items);
        if (v === 'genp') F.people.genFor(ref, 'post');
        if (v === 'genv') F.people.genFor(ref, 'video');
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