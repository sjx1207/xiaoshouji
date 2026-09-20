/* =========================================================
   论坛 · 帖子详情（新页面）  forum-detail.js
   按类型排版正文 · 符号标记 · 数据面板 · 主评论 + 楼中楼
   用户发表评论/回复 → 自动调用 AI 回复（唯一的自动调用场景）
   “刷新动态”按钮 → 手动更新数据并生成新评论
========================================================= */
F.detail = {};

F.detail.open = (postId, { focusComment } = {}) => {
  let post = F.post(postId);
  if (!post) return F.toast('这条内容已不存在', 'close');
  if (post.type === 'repost' && post.ref) return post.ref.kind === 'video' ? F.video.open(post.ref.id) : F.detail.open(post.ref.id);
  post.stats.views = (post.stats.views || 0) + 1; F.save('posts');

  F.nav.push((page, api) => {
    const a = F.person(post.author);
    const isMine = post.author.kind === 'user';
    const readType = ['article', 'essay', 'qa', 'review', 'thread'].includes(post.type);
    let sort = 'hot', replyTarget = null; // {comment, reply}
    const busyThreads = new Set();

    page.innerHTML = `
      <header class="topbar">
        <div class="tb-side"><button class="gorb lg" data-back>${F.I('back')}</button></div>
        <button class="dt-author" data-person="${post.author.kind}:${post.author.id}">${F.avatarHTML(a, 34)}<span class="who"><b>${F.esc(a.nickname)}${F.isVerified(a) ? F.vbadge(a.kind !== 'char') : ''}</b><small>${F.esc(F.verifyTitle(a) || '@' + a.handle)}</small></span></button>
        <div class="tb-side r">${isMine && post.author.id === F.state.activeIdentityId ? '' : `<button class="gbtn sm lg ${F.isFollowing(post.author) ? '' : 'lg-dark'}" data-follow>${F.isFollowing(post.author) ? '已关注' : '关注'}</button>`}<button class="gorb sm lg dt-more" data-more>${F.I('more')}${readType ? '<svg class="dt-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="16.5" pathLength="100" id="dtProg"/></svg>' : ''}</button></div>
      </header>
      <div class="page-scroll" id="dtScroll">
        <div class="dt-body" id="dtBody"></div>
        <div id="dtComments"></div>
      </div>
      <div class="dt-bar">
        <div class="dt-input lg" style="--lg-r:22px;position:relative"><span class="reply-to" id="dtReplyTo" style="display:none"></span><textarea rows="1" maxlength="800" placeholder="${post.allowComment === false ? '作者关闭了评论' : '说点什么…'}" ${post.allowComment === false ? 'disabled' : ''}></textarea><button class="dt-send" disabled>${F.I('send')}</button></div>
        <div class="dt-acts" id="dtActs"></div>
      </div>`;
    F.bindBack(page, api);
    const $ = s => page.querySelector(s);
    const scroll = $('#dtScroll');

    /* ---------- 正文 ---------- */
    const body = () => {
      const T = F.TYPES[post.type] || { name: F.typeName(post.type), icon: 'doc' }, w = F.world(post.worldId);
      const typeRow = `<div style="display:flex;gap:6px;flex-wrap:wrap"><span class="dt-type">${F.I(T.icon)}${T.name}</span>${w ? `<span class="dt-type">${F.esc(w.theme || w.name)}</span>` : ''}${post.visibility === 'self' ? `<span class="dt-type">${F.I('lock')}仅自己可见</span>` : ''}</div>`;
      const meta = `<div class="dt-meta"><span>${F.I('cal')}${F.fullDate(post.createdAt)} ${new Date(post.createdAt).toTimeString().slice(0, 5)}</span>${readType ? `<span>${F.I('doc')}${F.plain(post.content + (post.thread || []).join('')).length} 字 · ${F.cards.readMins(post)} 分钟</span>` : ''}${post.location ? `<span>${F.I('pin')}${F.esc(post.location)}</span>` : ''}</div>`;
      const imgs = post.images && post.images.length ? (post.type === 'photo'
        ? `<div class="ph-stage" style="margin:12px -6px"><div class="ph-track">${post.images.map((x, i) => `<div class="ph-slide" data-img="${i}">${x.src ? `<img src="${x.src}">` : F.art.photoSVG(x.seed || x.desc)}${!x.src && x.desc ? `<p class="ph-desc">${F.esc(x.desc)}</p>` : ''}</div>`).join('')}</div>${post.images.length > 1 ? `<span class="ph-count">1/${post.images.length}</span><div class="ph-dots">${post.images.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>` : ''}</div>`
        : `<div class="dt-imgs"><div class="imgs n${Math.min(post.images.length, 4)} ${post.images.length > 4 ? 'many' : ''}">${post.images.map((x, i) => `<div class="im" data-img="${i}">${x.src ? `<img src="${x.src}">` : F.art.photoSVG(x.seed || x.desc)}${!x.src && x.desc ? `<span class="im-cap">${F.esc(x.desc)}</span>` : ''}</div>`).join('')}</div></div>`) : '';
      let main = '';
      switch (post.type) {
        case 'article':
          main = `${typeRow}<h1 class="dt-title">${F.esc(post.title)}</h1>${meta}${imgs}<div class="rt read">${F.rich(post.content, { toc: true })}</div>`; break;
        case 'essay':
          main = `${typeRow}<h1 class="dt-title" style="letter-spacing:.08em">${F.esc(post.title)}</h1>${meta}${imgs}<div class="dt-essay"><div class="rt read">${F.rich(post.content)}</div><p class="es-sign" style="font-size:14px">—— ${F.esc(a.nickname)} · ${F.fullDate(post.createdAt)}</p></div>`; break;
        case 'poll':
          main = `${typeRow}<h1 class="dt-title" style="font-family:var(--f-ui)">${F.esc(post.poll.question || post.title)}</h1>${meta}${post.content ? `<div class="rt">${F.rich(post.content)}</div>` : ''}${F.cards.pollBlock(post)}${imgs}`; break;
        case 'qa':
          main = `${typeRow}<div class="dt-qa-q"><span class="qa-mark">Q</span><h2>${F.esc(post.title)}</h2></div><div class="qa-by" style="margin-bottom:10px">${F.avatarHTML(a, 26)}<b style="font-size:14px">${F.esc(a.nickname)}</b><span class="qa-tt">的回答</span></div>${meta}${imgs}<div class="rt read">${F.rich(post.content)}</div>`; break;
        case 'thread':
          main = `${typeRow}${post.title ? `<h1 class="dt-title" style="font-family:var(--f-ui);font-size:21px">${F.esc(post.title)}</h1>` : ''}${meta}<ol class="dt-thread">${(post.thread || [post.content]).map((s, i, arr) => `<li><span class="th-n num-font">${i + 1}/${arr.length}</span><div class="rt">${F.rich(s)}</div></li>`).join('')}</ol>${imgs}`; break;
        case 'review':
          main = `${typeRow}<h1 class="dt-title">${F.esc(post.title)}</h1>${meta}<div class="rv-panel"><div class="rv-score"><b class="num-font">${post.review.rating.toFixed(1)}</b>${F.cards.stars(post.review.rating)}</div><div class="rv-obj"><span class="rv-cat">${F.esc(post.review.category)}</span><h4>${F.esc(post.review.subject)}</h4><small>${F.esc(a.nickname)} 的评分</small></div></div>${imgs}<div class="rt read">${F.rich(post.content)}</div>`; break;
        case 'news':
          main = `<div class="dt-news-src"><span class="nw-lv">${F.esc((post.news && post.news.level) || '快讯')}</span><b>${F.esc((post.news && post.news.source) || a.nickname)}</b></div><h1 class="dt-title" style="font-family:var(--f-ui);font-weight:800">${F.esc(post.title)}</h1>${meta}${imgs}<div class="rt">${F.rich(post.content)}</div>`; break;
        default:
          main = `${typeRow}${post.title ? `<h1 class="dt-title">${F.esc(post.title)}</h1>` : ''}<div class="rt" style="margin-top:12px;font-size:16.5px">${F.rich(post.content)}</div>${imgs}${meta}`;
      }
      $('#dtBody').innerHTML = `${main}${F.cards.topicLine(post)}
        <div class="dt-stats" id="dtStats"></div>`;
      stats();
      $('#dtBody').querySelectorAll('[data-img]').forEach(el => el.onclick = () => F.viewer(post.images, +el.dataset.img));
      $('#dtBody').querySelectorAll('[data-jump]').forEach(el => el.onclick = () => { const h = page.querySelector('#' + el.dataset.jump); scroll.scrollTo({ top: h.offsetTop - 20, behavior: 'smooth' }); });
      const tr = $('#dtBody .ph-track'); if (tr) tr.addEventListener('scroll', F.debounce(() => { const i = Math.round(tr.scrollLeft / tr.clientWidth); const st = tr.parentNode; st.querySelector('.ph-count').textContent = `${i + 1}/${tr.children.length}`; st.querySelectorAll('.ph-dots i').forEach((d, k) => d.classList.toggle('on', k === i)); }, 40));
      $('#dtBody').querySelectorAll('[data-vote]').forEach(b => b.onclick = () => { if (F.act.vote(post, +b.dataset.vote)) { body(); F.toast('投票成功', 'check', 1300); } });
    };
    const stats = () => {
      $('#dtStats').innerHTML = [['浏览', post.stats.views], ['点赞', F.likeCount(post)], ['收藏', F.favCount(post)], ['转发', post.stats.reposts]].map(([l, v]) => `<div><b>${F.num(v)}</b><small>${l}</small></div>`).join('');
      $('#dtActs').innerHTML = `<button class="act ${F.act.liked(post) ? 'on' : ''}" data-like>${F.I('heart')}<span>${F.num(F.likeCount(post))}</span></button><button class="act ${F.act.faved(post) ? 'on' : ''}" data-fav>${F.I('fav')}<span>${F.num(F.favCount(post))}</span></button><button class="act" data-repost>${F.I('repost')}<span>转发</span></button>`;
      $('[data-like]').onclick = e => { F.act.like(post); stats(); const b = $('[data-like]'); b.classList.add('pop'); };
      $('[data-fav]').onclick = () => { const on = F.act.fav(post); stats(); $('[data-fav]').classList.add('pop'); F.toast(on ? '已收藏' : '已取消收藏', 'fav', 1300); };
      $('[data-repost]').onclick = () => F.act.repost(post);
    };

    /* ---------- 评论区 ---------- */
    const who = ref => {
      const p = F.person(ref);
      const tags = (F.refEq(ref, post.author) ? '<span class="tag-au">作者</span>' : '') + (ref.kind === 'user' && ref.id === F.state.activeIdentityId ? '<span class="tag-me">我</span>' : '');
      return { p, html: `<span data-person="${ref.kind}:${ref.id}">${F.esc(p.nickname)}</span>${F.isVerified(p) ? F.vbadge(p.kind !== 'char') : ''}${tags}` };
    };
    const openFolds = new Set();
    const comments = (flashIds = []) => {
      const list = post.comments.slice();
      if (sort === 'hot') list.sort((x, y) => (y.likes + (y.likedBy || []).length + (y.replies || []).length * 2) - (x.likes + (x.likedBy || []).length + (x.replies || []).length * 2));
      else list.sort((x, y) => y.time - x.time);
      const n = F.commentCount(post);
      $('#dtComments').innerHTML = `
        <div class="cm-head"><h4>评论<small>${n}</small></h4>
          <div class="seg" id="cmSort" style="width:120px"><button data-v="hot" class="${sort === 'hot' ? 'on' : ''}" style="height:28px;font-size:12px">热门</button><button data-v="new" class="${sort === 'new' ? 'on' : ''}" style="height:28px;font-size:12px">最新</button></div>
          <button class="cm-refresh lg" id="cmRefresh">${F.I('refresh')}刷新动态</button>
        </div>
        <div class="cm-list">${list.length ? list.map(c => {
          const w = who(c.author);
          const reps = c.replies || [];
          const open = openFolds.has(c.id) || reps.length <= 3;
          const shown = open ? reps : reps.slice(0, 2);
          return `<div class="cm ${flashIds.includes(c.id) ? 'flash' : ''}" data-c="${c.id}">
            <div data-person="${c.author.kind}:${c.author.id}">${F.avatarHTML(w.p, 36)}</div>
            <div class="cm-main">
              <div class="cm-name">${w.html}</div>
              <div class="cm-text" data-reply-c="${c.id}">${F.inline(c.text)}</div>
              <div class="cm-sub"><span>${F.ago(c.time)}</span><button data-reply-c="${c.id}">回复</button></div>
              ${reps.length || busyThreads.has(c.id) ? `<div class="rp-box">${shown.map(r => { const rw = who(r.author); return `<div class="rp ${flashIds.includes(r.id) ? 'flash' : ''}" data-r="${r.id}">
                  <div data-person="${r.author.kind}:${r.author.id}">${F.avatarHTML(rw.p, 24)}</div>
                  <div class="cm-main"><div class="cm-name">${rw.html}</div>
                    <div class="cm-text" data-reply-r="${c.id}|${r.id}">${r.replyToName ? `<span class="to">回复 ${F.esc(r.replyToName)}：</span>` : ''}${F.inline(r.text)}</div>
                    <div class="cm-sub"><span>${F.ago(r.time)}</span><button data-reply-r="${c.id}|${r.id}">回复</button></div></div>
                  <button class="cm-like ${(r.likedBy || []).includes(F.state.activeIdentityId) ? 'on' : ''}" data-like-r="${c.id}|${r.id}">${F.I('heart')}<span>${r.likes + (r.likedBy || []).length || ''}</span></button>
                </div>`; }).join('')}
                ${!open ? `<button class="rp-fold" data-fold="${c.id}">展开全部 ${reps.length} 条回复</button>` : ''}
                ${busyThreads.has(c.id) ? `<div class="cm-typing"><span><i></i><i></i><i></i></span>对方正在回复</div>` : ''}
              </div>` : ''}
            </div>
            <button class="cm-like ${(c.likedBy || []).includes(F.state.activeIdentityId) ? 'on' : ''}" data-like-c="${c.id}">${F.I('heart')}<span>${c.likes + (c.likedBy || []).length || ''}</span></button>
          </div>`;
        }).join('') : `<div class="empty" style="padding:30px"><p>还没有评论。说点什么，或点「刷新动态」看看大家的反应。</p></div>`}</div>`;
      F.seg($('#cmSort'), v => { sort = v; comments(); });
      $('#cmRefresh').onclick = refresh;
    };
    const findC = id => post.comments.find(c => c.id === id);

    // 评论区委托事件
    $('#dtComments').addEventListener('click', e => {
      const t = e.target;
      const pe = t.closest('[data-person]'); if (pe && !t.closest('.cm-text')) { const [kind, id] = pe.dataset.person.split(':'); return F.people.open({ kind, id }); }
      const lc = t.closest('[data-like-c]'); if (lc) { F.act.likeComment(findC(lc.dataset.likeC)); return comments(); }
      const lr = t.closest('[data-like-r]'); if (lr) { const [c, r] = lr.dataset.likeR.split('|'); F.act.likeComment(findC(c).replies.find(x => x.id === r)); return comments(); }
      const fd = t.closest('[data-fold]'); if (fd) { openFolds.add(fd.dataset.fold); return comments(); }
      const rc = t.closest('[data-reply-c]'); if (rc) return setReply({ comment: findC(rc.dataset.replyC) });
      const rr = t.closest('[data-reply-r]'); if (rr) { const [c, r] = rr.dataset.replyR.split('|'); const cc = findC(c); return setReply({ comment: cc, reply: cc.replies.find(x => x.id === r) }); }
    });

    /* ---------- 输入与发送 ---------- */
    const ta = page.querySelector('.dt-bar textarea'), send = page.querySelector('.dt-send'), rt = $('#dtReplyTo');
    const setReply = target => {
      if (post.allowComment === false) return;
      replyTarget = target;
      const to = target ? F.person((target.reply || target.comment).author) : null;
      if (to) { rt.style.display = 'flex'; rt.innerHTML = `回复 <b>@${F.esc(to.nickname)}</b><button>取消</button>`; rt.querySelector('button').onclick = () => setReply(null); ta.placeholder = `回复 @${to.nickname}`; ta.focus(); }
      else { rt.style.display = 'none'; ta.placeholder = '说点什么…'; }
    };
    ta.oninput = () => { send.disabled = !ta.value.trim(); ta.style.height = 'auto'; ta.style.height = Math.min(110, ta.scrollHeight) + 'px'; };
    ta.onfocus = () => $('#dtActs').style.display = 'none';
    ta.onblur = () => setTimeout(() => { if (!ta.value.trim()) $('#dtActs').style.display = ''; }, 150);
    send.onclick = async () => {
      const text = ta.value.trim(); if (!text) return;
      const me = { kind: 'user', id: F.state.activeIdentityId };
      const target = replyTarget;
      let parent, mine;
      if (target) {
        parent = target.comment;
        const toRef = (target.reply || target.comment).author;
        mine = { id: F.uid('rp'), author: me, replyTo: toRef, replyToName: target.reply ? F.person(toRef).nickname : '', text, likes: 0, likedBy: [], time: Date.now() };
        parent.replies.push(mine); openFolds.add(parent.id);
      } else {
        mine = { id: F.uid('cm'), author: me, text, likes: 0, likedBy: [], time: Date.now(), replies: [] };
        post.comments.push(mine); parent = mine; sort = 'new';
      }
      ta.value = ''; ta.oninput(); ta.blur(); setReply(null);
      await F.save('posts');
      busyThreads.add(parent.id); comments([mine.id]);
      requestAnimationFrame(() => F.scrollInto(scroll, page.querySelector(`[data-c="${parent.id}"]`), 'center'));
      // 自动调用 AI 回复用户
      const whoTo = target && target.reply ? target.reply.author : target ? target.comment.author : post.author;
      const isSelfTalk = whoTo.kind === 'user' && post.author.kind === 'user';
      if (!F.ai.ready()) { busyThreads.delete(parent.id); comments(); return F.toast('配置 API 后，评论会收到回复', 'gear', 2600); }
      try {
        const reps = await F.ai.replyToUser(post, { comment: target ? target.comment : null, reply: target ? target.reply : null, text: isSelfTalk ? text + '（这是作者本人在自己帖子下的发言，请由网友接话）' : text });
        const meName = F.me().nickname;
        reps.forEach((r, i) => { r.replyTo = me; r.replyToName = i === 0 ? meName : ''; r.time = Date.now() + i; parent.replies.push(r); });
        await F.save('posts', 'npcs');
        busyThreads.delete(parent.id); comments(reps.map(r => r.id));
      } catch (e) { busyThreads.delete(parent.id); comments(); F.toast('回复生成失败：' + e.message, 'close', 3200); }
    };

    /* ---------- 刷新动态（手动） ---------- */
    async function refresh() {
      const b = $('#cmRefresh'); if (b.classList.contains('busy')) return;
      if (!F.ai.ready()) return F.toast('请先到桌面「设置 › API」配置接口', 'gear', 2600);
      b.classList.add('busy'); b.innerHTML = `${F.I('refresh')}刷新中`;
      const before = new Set(post.comments.flatMap(c => [c.id, ...(c.replies || []).map(r => r.id)]));
      const oldStats = { ...post.stats };
      try {
        const { added } = await F.ai.refreshPost(post);
        await F.save('posts', 'npcs', 'identities', 'charProfiles');
        const fresh = post.comments.flatMap(c => [c.id, ...(c.replies || []).map(r => r.id)]).filter(id => !before.has(id));
        stats(); comments(fresh);
        F.toast(`浏览 +${F.num(post.stats.views - oldStats.views)} · 赞 +${F.num(post.stats.likes - oldStats.likes)} · 新评论 ${added}`, 'chart', 2800);
      } catch (e) { F.toast('刷新失败：' + e.message, 'close', 3200); comments(); }
    }

    /* ---------- 顶部：关注 / 更多 / 作者 ---------- */
    $('.dt-author').onclick = () => F.people.open(post.author);
    const fb = $('[data-follow]');
    if (fb) fb.onclick = () => { F.people.toggleFollow(post.author); const on = F.isFollowing(post.author); fb.textContent = on ? '已关注' : '关注'; fb.classList.toggle('lg-dark', !on); };
    $('[data-more]').onclick = async () => {
      const v = await F.menu('更多', [{ label: '复制正文', value: 'copy', icon: 'doc' }, { label: '转发', value: 'repost', icon: 'repost' }, { label: '删除这条内容', value: 'del', icon: 'trash', danger: true }]);
      if (v === 'copy') { try { await navigator.clipboard.writeText(F.plain(post.content)); F.toast('已复制'); } catch (e) { F.toast('复制失败', 'close'); } }
      if (v === 'repost') F.act.repost(post);
      if (v === 'del' && await F.confirm('删除这条内容？', '删除后无法恢复。', '删除', true)) {
        F.state.posts = F.state.posts.filter(p => p.id !== post.id); await F.save('posts'); api.close(); F.toast('已删除');
      }
    };
    if (readType) scroll.addEventListener('scroll', () => {
      const bodyH = $('#dtBody').offsetHeight - scroll.clientHeight;
      $('#dtProg').style.strokeDashoffset = 100 - F.clamp(scroll.scrollTop / Math.max(1, bodyH) * 100, 0, 100);
    }, { passive: true });

    body(); comments();
    page._refresh = () => { stats(); comments(); };
    page._onLeave = F.bus.on('reposted', () => stats());
    if (focusComment) setTimeout(() => F.scrollInto(scroll, page.querySelector(`[data-c="${focusComment}"]`), 'center', false), 500);
  });
};