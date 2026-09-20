/* =========================================================
   论坛 · 转发与分享  forum-share.js
   · 转发到主页：带转发语，生成一条“转发”内容，计入原内容转发数与我的转发列表
   · 私信分享：发给私信里的人，以卡片形式出现在聊天中
   帖子与视频通用
========================================================= */
F.share = {};

F.share.kindOf = item => item && item.frames ? 'video' : 'post';

F.share.open = (item) => {
  if (!item) return;
  const kind = F.share.kindOf(item);
  const src = item.type === 'repost' && item.ref ? F.item(item.ref.kind, item.ref.id) : item;   // 转发的转发 → 指向源头
  if (!src) return F.toast('原内容已删除', 'close');
  const srcKind = F.share.kindOf(src);
  const a = F.person(src.author);
  const peers = (() => {
    const me = F.state.activeIdentityId;
    const list = F.state.dms.filter(t => t.identityId === me && t.messages.length).sort((x, y) => y.updatedAt - x.updatedAt).map(t => t.peer);
    [...(F.me().following || []), ...F.state.charProfiles.map(c => ({ kind: 'char', id: c.id }))].forEach(r => { if (!list.some(x => F.refEq(x, r))) list.push(r); });
    return list.slice(0, 16);
  })();
  const picked = [];
  F.sheet({
    title: '转发', sub: `${a.nickname} 的${srcKind === 'video' ? '视频' : F.typeName(src.type)}`, foot: true,
    render(api) {
      api.body.innerHTML = `
        <div class="sh-quote">${F.share.quote(src)}</div>
        <div class="seg" id="shSeg" style="margin:14px 0 12px"><button data-v="wall" class="on">转发到主页</button><button data-v="dm">私信分享</button></div>
        <div id="shWall">
          <div class="sh-editor lg" style="--lg-r:22px">${F.avatarHTML(F.me(), 32)}<textarea id="shText" maxlength="300" rows="3" placeholder="说说你的想法，留空则直接转发"></textarea></div>
          <p class="hint">以「${F.esc(F.me().nickname)}」的身份转发，会出现在首页与你的「转发」列表里</p>
        </div>
        <div id="shDm" style="display:none">
          ${peers.length ? `<div class="sh-peers">${peers.map(r => { const p = F.person(r); return `<button class="sh-peer" data-p="${r.kind}:${r.id}">${F.avatarHTML(p, 50)}<span class="sh-ck">${F.I('check')}</span><small>${F.esc(p.nickname)}</small></button>`; }).join('')}</div>
          <input class="input" id="shNote" maxlength="120" placeholder="附一句话（选填）" style="margin-top:12px">` : `<div class="empty" style="padding:26px"><p>还没有可以分享的人。先关注一些人，或为角色建档。</p></div>`}
        </div>`;
      api.foot.innerHTML = `<button class="gbtn lgx lg lg-dark block" id="shGo">${F.I('repost')}转发</button>`;
      let mode = 'wall';
      const go = api.foot.querySelector('#shGo');
      F.seg(api.body.querySelector('#shSeg'), v => {
        mode = v;
        api.body.querySelector('#shWall').style.display = v === 'wall' ? '' : 'none';
        api.body.querySelector('#shDm').style.display = v === 'dm' ? '' : 'none';
        go.innerHTML = v === 'wall' ? `${F.I('repost')}转发` : `${F.I('send')}${picked.length ? `发送给 ${picked.length} 人` : '选择要分享的人'}`;
      });
      api.body.querySelectorAll('.sh-peer').forEach(b => b.onclick = () => {
        const [k, id] = b.dataset.p.split(':'); const i = picked.findIndex(r => r.kind === k && r.id === id);
        i < 0 ? picked.push({ kind: k, id }) : picked.splice(i, 1);
        b.classList.toggle('on', i < 0);
        go.innerHTML = `${F.I('send')}${picked.length ? `发送给 ${picked.length} 人` : '选择要分享的人'}`;
      });
      go.onclick = async () => {
        if (mode === 'wall') {
          const text = api.body.querySelector('#shText').value.trim();
          const rp = {
            id: F.uid('p'), worldId: src.worldId || null, type: 'repost', author: { kind: 'user', id: F.state.activeIdentityId }, source: 'user',
            title: '', content: text, ref: { kind: srcKind, id: src.id }, topic: '', tags: [], images: [],
            stats: { likes: 0, reposts: 0, favorites: 0, views: 0 }, likedBy: [], favBy: [], comments: [], createdAt: Date.now(), visibility: 'public'
          };
          F.state.posts.push(rp);
          src.stats.reposts = (src.stats.reposts || 0) + 1;
          src.repostedBy = src.repostedBy || []; src.repostedBy.push(F.state.activeIdentityId);
          await F.save('posts', 'videos');
          api.close(); F.toast('已转发', 'repost');
          F.bus.emit('reposted', src);
        } else {
          if (!picked.length) return F.toast('先选择要分享的人', 'users');
          const note = (api.body.querySelector('#shNote') || {}).value || '';
          picked.forEach(r => {
            const t = F.dm.thread(r);
            t.messages.push({ from: 'me', share: { kind: srcKind, id: src.id }, text: note.trim(), time: Date.now() });
            t.updatedAt = Date.now();
          });
          src.stats.reposts = (src.stats.reposts || 0) + picked.length;
          await F.save('dms', 'posts', 'videos');
          api.close(); F.toast(`已分享给 ${picked.length} 人`, 'send');
        }
      };
    }
  });
};

/* 被引用的原内容：小卡片 */
F.share.quote = (o, cls = '') => {
  if (!o) return `<div class="qt qt-gone ${cls}">${F.I('close')}原内容已删除</div>`;
  const a = F.person(o.author);
  const isV = !!o.frames;
  const thumb = isV ? `<div class="qt-thumb v">${F.vscene ? F.vscene.thumb(o) : ''}<span>${F.I('play')}</span></div>`
    : (o.images && o.images[0] ? `<div class="qt-thumb">${o.images[0].src ? `<img src="${o.images[0].src}">` : F.art.photoSVG(o.images[0].seed || o.images[0].desc)}</div>` : '');
  const text = isV ? o.title : (o.title || (o.poll && o.poll.question) || F.plain(o.content || ''));
  return `<div class="qt ${cls}" data-open-ref="${isV ? 'video' : 'post'}:${o.id}">
    ${thumb}
    <div class="qt-main"><div class="qt-by">${F.avatarHTML(a, 18)}<b>${F.esc(a.nickname)}</b>${F.isVerified(a) ? F.vbadge(a.kind !== 'char') : ''}<span>${isV ? '视频' : F.typeName(o.type)}</span></div>
    <p class="clamp2">${F.esc(String(text).replace(/\n+/g, ' '))}</p></div>
  </div>`;
};

/* 转发卡片（首页 / 我的转发） */
F.cards.t_repost = (p, a) => {
  const o = p.ref ? F.item(p.ref.kind, p.ref.id) : null;
  return `
  <div class="mo-grid">
    <div ${F.cards.ref(p.author)} class="mo-av">${F.avatarHTML(a, 42)}</div>
    <div class="mo-main">
      <div class="mo-head" ${F.cards.ref(p.author)}>${F.cards.name(a)}<span class="dot-sep"></span><span class="tm">${F.ago(p.createdAt)}</span></div>
      <div class="rp-label">${F.I('repost')}${p._syn ? '转发了' : '转发'}</div>
      ${p.content ? `<div class="mo-text">${F.inline(p.content)}</div>` : ''}
      ${F.share.quote(o, 'in-card')}
      ${p._syn ? '' : F.cards.actions(p, 'thin')}
    </div>
  </div>`;
};

/* 网友 / 角色的转发：由种子稳定推导（不写入数据），与点赞收藏同一套逻辑 */
F.share.derived = ref => {
  const r = F.rng(ref.id + 'reposts');
  const person = F.person(ref);
  const pool = [...F.state.posts.filter(p => p.type !== 'repost'), ...F.state.videos].filter(p => !F.refEq(p.author, ref) && (ref.kind !== 'npc' || p.worldId === person.worldId) && p.visibility !== 'self');
  return pool.filter(() => r() < .09).map(o => ({
    id: 'syn_' + o.id, _syn: true, type: 'repost', author: ref, content: '', ref: { kind: o.frames ? 'video' : 'post', id: o.id },
    createdAt: o.createdAt + Math.floor(r() * 7200e3), stats: { likes: 0, reposts: 0, favorites: 0, views: 0 }, comments: []
  })).sort((a, b) => b.createdAt - a.createdAt);
};

/* 混合列表渲染：帖子 / 视频 / 转发 */
F.cards.renderAny = item => {
  if (item.frames) return F.cards.renderVideo ? F.cards.renderVideo(item) : '';
  if (item._syn) return `<article class="card c-repost syn">${F.cards.t_repost(item, F.person(item.author))}</article>`;
  return F.cards.render(item);
};

/* 私信里的分享卡片 */
F.share.bubble = m => {
  const o = F.item(m.share.kind, m.share.id);
  return `<div class="dm-share">${F.share.quote(o, 'in-dm')}${m.text ? `<p class="dm-share-note">${F.esc(m.text)}</p>` : ''}</div>`;
};

/* 全局：点击任意引用卡片打开原内容 */
document.addEventListener('click', e => {
  const q = e.target.closest('[data-open-ref]');
  if (!q) return;
  e.stopPropagation();
  const [kind, id] = q.dataset.openRef.split(':');
  if (kind === 'video') F.video && F.video.open(id); else F.detail.open(id);
}, true);
