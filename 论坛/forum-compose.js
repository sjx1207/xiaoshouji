/* =========================================================
   论坛 · 发帖（新页面，隐藏底部导航）  forum-compose.js
   动态 / 长文 / 随笔 / 投票 · 最多 20 张图 · 图片描述给纯文字模型
========================================================= */
F.compose = { MAX_IMG: 20 };

F.compose.blank = () => ({
  identityId: F.state.activeIdentityId, type: 'moment', title: '', content: '', images: [],
  poll: { question: '', options: ['', ''], days: 3 }, worldId: '', tags: [], mentions: [], location: '',
  visibility: 'public', allowComment: true, aiComments: false
});

F.compose.open = (opts = {}) => {
  const d = F.state.draft && F.state.draft.content !== undefined ? F.deepClone(F.state.draft) : F.compose.blank();
  if (!F.identity(d.identityId)) d.identityId = F.state.activeIdentityId;
  if (opts.worldId) d.worldId = opts.worldId;
  const saveDraft = F.debounce(() => { F.state.draft = d; F.save('draft'); }, 500);

  F.nav.push((page, api) => {
    page.innerHTML = `
      <header class="topbar">
        <div class="tb-side"><button class="gorb lg" data-cancel>${F.I('close')}</button></div>
        <div class="tb-title">发帖<small id="cpDraftHint">${F.state.draft ? '已恢复上次的草稿' : '新内容'}</small></div>
        <div class="tb-side r"><button class="gbtn lg lg-dark" data-publish disabled>发布</button></div>
      </header>
      <div class="page-scroll"><div class="cp-body">
        <button class="cp-who lg" data-who style="--lg-r:22px"></button>
        <div class="seg" id="cpType">${[['moment', '动态'], ['article', '长文'], ['essay', '随笔'], ['poll', '投票']].map(([v, l]) => `<button data-v="${v}" class="${d.type === v ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="cp-paper">
          <input class="cp-title" data-f="title" maxlength="40" placeholder="标题">
          <div class="cp-poll" id="cpPoll"></div>
          <textarea class="cp-text" data-f="content" placeholder=""></textarea>
          <div class="cp-tools" id="cpTools">
            ${[['## ', '小标题', 'H'], ['**', '加粗', 'B'], ['> ', '引用', '❝'], ['- ', '列表', '•'], ['「」', '引语', '「」'], ['《》', '书名', '《》'], ['==', '高亮', 'M'], ['---', '分隔', '—']].map(([ins, l, g]) => `<button data-ins="${F.esc(ins)}" title="${l}"><b>${F.esc(g)}</b><small>${l}</small></button>`).join('')}
          </div>
          <div class="cp-count"><span id="cpCount">0</span></div>
        </div>
        <div class="cp-imgs-head"><b>图片</b><span id="cpImgN">0/${F.compose.MAX_IMG}</span></div>
        <div id="cpVisionTip"></div>
        <div class="cp-imgs" id="cpImgs"></div>

        <div class="group-title">发布设置</div>
        ${F.state.worlds.length ? `<div class="field"><div class="f-label">发布到</div><div class="chips" id="cpWorld"><button class="chip" data-v="">我的主页</button>${F.state.worlds.map(w => `<button class="chip" data-v="${w.id}">${F.esc(w.theme || w.name)}</button>`).join('')}</div><p class="hint">发布到某个存档后，帖子会出现在首页对应主题下，评论区按该存档的世界观生成</p></div>` : ''}
        <div class="field"><div class="f-label">话题</div><div id="cpTags"></div></div>
        ${F.state.charProfiles.length ? `<div class="field"><div class="f-label">提及角色<em>被提及的角色会优先出现在评论区</em></div><div class="chips" id="cpMention">${F.state.charProfiles.map(c => `<button class="chip" data-v="${c.id}">${F.I('at')}${F.esc(c.nickname)}</button>`).join('')}</div></div>` : ''}
        <div class="field"><div class="f-label">位置</div><input class="input" data-f="location" maxlength="20" placeholder="添加位置（选填）"></div>
        <div class="field"><div class="f-label">谁可以看</div><div class="chips" id="cpVis">${[['public', '公开'], ['fans', '仅粉丝'], ['self', '仅自己']].map(([v, l]) => `<button class="chip" data-v="${v}">${F.I(v === 'self' ? 'lock' : v === 'fans' ? 'users' : 'globe')}${l}</button>`).join('')}</div></div>
        <div class="group">
          <div class="row"><div class="r-main"><div class="r-title">允许评论</div></div>${F.switchHTML('allowComment', d.allowComment)}</div>
          <div class="row"><div class="r-main"><div class="r-title">发布后生成首批互动</div><div class="r-sub">发布时调用一次 AI，生成浏览、点赞与评论区；关闭则帖子保持安静，之后可在详情页手动刷新</div></div>${F.switchHTML('aiComments', d.aiComments)}</div>
        </div>
        <div style="height:30px"></div>
      </div></div>`;

    const $ = s => page.querySelector(s);
    const title = $('[data-f="title"]'), text = $('[data-f="content"]'), loc = $('[data-f="location"]');
    title.value = d.title; text.value = d.content; loc.value = d.location;

    const drawWho = () => {
      const u = F.identity(d.identityId);
      $('[data-who]').innerHTML = `${F.avatarHTML(u, 34)}<div class="cw-main"><b>${F.esc(u.nickname)}${F.isVerified(u) ? F.vbadge() : ''}</b><small>以这个身份发布${F.state.identities.length > 1 ? ' · 轻点切换' : ''}</small></div>${F.state.identities.length > 1 ? F.I('swap') : ''}`;
    };
    $('[data-who]').onclick = async () => {
      if (F.state.identities.length < 2) return;
      const v = await F.menu('选择发布身份', F.state.identities.map(u => ({ label: u.nickname, sub: '@' + u.handle, value: u.id, on: u.id === d.identityId })));
      if (v) { d.identityId = v; drawWho(); saveDraft(); }
    };

    const limits = { moment: 2000, article: 20000, essay: 8000, poll: 500 };
    const ph = { moment: '分享新鲜事…', article: '正文。可以用下方工具插入小标题、引用、列表，阅读时会自动排版', essay: '写下此刻的心绪…', poll: '补充说明（选填）' };
    const drawType = () => {
      title.style.display = (d.type === 'article' || d.type === 'essay') ? '' : 'none';
      $('#cpTools').style.display = (d.type === 'article' || d.type === 'essay') ? '' : 'none';
      text.placeholder = ph[d.type]; text.maxLength = limits[d.type];
      text.classList.toggle('serif', d.type === 'essay' || d.type === 'article');
      drawPoll(); count();
    };
    const drawPoll = () => {
      const box = $('#cpPoll');
      if (d.type !== 'poll') { box.innerHTML = ''; return; }
      box.innerHTML = `<input class="cp-title" data-pq maxlength="60" placeholder="投票问题" value="${F.esc(d.poll.question)}">
        ${d.poll.options.map((o, i) => `<div class="cp-opt"><span class="num-font">${i + 1}</span><input data-po="${i}" maxlength="30" placeholder="选项 ${i + 1}" value="${F.esc(o)}">${d.poll.options.length > 2 ? `<button data-px="${i}">${F.I('close')}</button>` : ''}</div>`).join('')}
        ${d.poll.options.length < 6 ? `<button class="cp-opt-add" data-padd>${F.I('plus')}添加选项</button>` : ''}
        <div class="chips" style="margin:10px 0 4px" id="cpDays">${[1, 3, 7].map(n => `<button class="chip ${d.poll.days === n ? 'on' : ''}" data-v="${n}">${n} 天后截止</button>`).join('')}</div>`;
      box.querySelector('[data-pq]').oninput = e => { d.poll.question = e.target.value; valid(); saveDraft(); };
      box.querySelectorAll('[data-po]').forEach(el => el.oninput = () => { d.poll.options[+el.dataset.po] = el.value; valid(); saveDraft(); });
      box.querySelectorAll('[data-px]').forEach(el => el.onclick = () => { d.poll.options.splice(+el.dataset.px, 1); drawPoll(); valid(); });
      const add = box.querySelector('[data-padd]'); if (add) add.onclick = () => { d.poll.options.push(''); drawPoll(); box.querySelector(`[data-po="${d.poll.options.length - 1}"]`).focus(); };
      box.querySelectorAll('#cpDays .chip').forEach(c => c.onclick = () => { d.poll.days = +c.dataset.v; drawPoll(); saveDraft(); });
    };
    const count = () => { $('#cpCount').textContent = `${text.value.length} / ${limits[d.type]}`; };
    const valid = () => {
      let ok = text.value.trim().length > 0 || d.images.length > 0;
      if (d.type === 'article' || d.type === 'essay') ok = title.value.trim() && text.value.trim().length >= 10;
      if (d.type === 'poll') ok = d.poll.question.trim() && d.poll.options.filter(o => o.trim()).length >= 2;
      $('[data-publish]').disabled = !ok;
    };
    const grow = () => { text.style.height = 'auto'; text.style.height = Math.max(160, text.scrollHeight) + 'px'; };
    F.seg($('#cpType'), v => { d.type = v; drawType(); valid(); saveDraft(); });
    [title, text, loc].forEach(el => el.addEventListener('input', () => { d[el.dataset.f] = el.value; count(); valid(); grow(); saveDraft(); }));

    // 排版工具：在光标处插入标记
    page.querySelectorAll('[data-ins]').forEach(b => b.onclick = () => {
      const ins = b.dataset.ins, s = text.selectionStart, e = text.selectionEnd, sel = text.value.slice(s, e);
      let out, caret;
      if (ins === '**' || ins === '==') { out = ins + (sel || '重点') + ins; caret = s + out.length; }
      else if (ins === '「」' || ins === '《》') { out = ins[0] + sel + ins[1]; caret = s + 1 + sel.length; }
      else if (ins === '---') { out = '\n---\n'; caret = s + out.length; }
      else { const pre = (s > 0 && text.value[s - 1] !== '\n') ? '\n' : ''; out = pre + ins + sel; caret = s + out.length; }
      text.setRangeText(out, s, e, 'end'); text.focus(); text.setSelectionRange(caret, caret);
      text.dispatchEvent(new Event('input'));
    });

    /* ---- 图片（上限 20） ---- */
    const drawImgs = () => {
      const vision = F.state.settings.vision;
      $('#cpImgN').textContent = `${d.images.length}/${F.compose.MAX_IMG}`;
      $('#cpVisionTip').innerHTML = d.images.length ? (vision
        ? `<div class="cp-tip">${F.I('eye')}<span>当前模型支持识图，配图会直接发送给 AI。</span><button data-tgl-v>更改</button></div>`
        : `<div class="cp-tip warn">${F.I('doc')}<span>当前模型不能读图。轻点图片，为需要让 AI 理解的图片写一句描述。</span><button data-tgl-v>我的模型能识图</button></div>`) : '';
      const tv = $('[data-tgl-v]'); if (tv) tv.onclick = () => { F.state.settings.vision = !vision; F.save('settings'); drawImgs(); F.toast(F.state.settings.vision ? '已设为支持识图' : '已设为不支持识图'); };
      $('#cpImgs').innerHTML = d.images.map((im, i) => `<div class="cp-img" data-i="${i}"><img src="${im.src}">${i === 0 ? '<span class="cp-first">封面</span>' : ''}${!vision ? `<span class="cp-desc-flag ${im.aiDesc && im.desc ? 'on' : ''}">${im.aiDesc && im.desc ? F.I('check') : F.I('doc')}${im.aiDesc && im.desc ? '已描述' : '未描述'}</span>` : ''}<button class="cp-x" data-x="${i}">${F.I('close')}</button></div>`).join('')
        + (d.images.length < F.compose.MAX_IMG ? `<button class="cp-add" data-add>${F.I('image')}<small>添加图片</small></button>` : '');
      $('#cpImgs').querySelectorAll('[data-x]').forEach(b => b.onclick = e => { e.stopPropagation(); d.images.splice(+b.dataset.x, 1); drawImgs(); valid(); saveDraft(); });
      $('#cpImgs').querySelectorAll('.cp-img').forEach(el => el.onclick = () => imgSheet(+el.dataset.i));
      const add = $('[data-add]'); if (add) add.onclick = async () => {
        const files = await F.pickImages(true);
        const room = F.compose.MAX_IMG - d.images.length;
        if (files.length > room) F.toast(`每条帖子最多 ${F.compose.MAX_IMG} 张，已添加前 ${room} 张`, 'image');
        for (const f of files.slice(0, room)) d.images.push({ src: await F.readImage(f), desc: '', aiDesc: false });
        drawImgs(); valid(); saveDraft();
      };
    };
    const imgSheet = i => {
      const im = d.images[i];
      F.sheet({
        title: `图片 ${i + 1}`, sub: F.state.settings.vision ? '模型会直接读取这张图' : '为纯文字模型提供画面描述', foot: true,
        render(api) {
          api.body.innerHTML = `<div class="cp-prev"><img src="${im.src}"></div>
            <div class="group"><div class="row"><div class="r-main"><div class="r-title">把描述发给 AI</div><div class="r-sub">${F.state.settings.vision ? '支持识图时一般不需要，描述会作为补充' : '开启后，AI 会通过描述“看到”这张图；不需要 AI 理解的图可以关闭'}</div></div>${F.switchHTML('ad', im.aiDesc)}</div></div>
            <div class="field"><textarea class="textarea" id="imDesc" maxlength="200" placeholder="描述画面：谁、在哪、做什么、氛围如何。如：傍晚的江边，我举着一杯柠檬茶，背后是橙色的晚霞">${F.esc(im.desc)}</textarea></div>`;
          api.foot.innerHTML = `<div style="display:flex;gap:8px">${i ? `<button class="gbtn lgx lg" data-first>设为封面</button>` : ''}<button class="gbtn lgx lg" data-rm style="color:#b23434">${F.I('trash')}</button><button class="gbtn lgx lg lg-dark" style="flex:1" data-ok>完成</button></div>`;
          const sw = api.body.querySelector('[data-sw="ad"]'), ta = api.body.querySelector('#imDesc');
          ta.oninput = () => { if (ta.value.trim() && !sw.checked) sw.checked = true; };
          api.foot.querySelector('[data-ok]').onclick = () => { im.desc = ta.value.trim(); im.aiDesc = sw.checked && !!im.desc; api.close(); drawImgs(); saveDraft(); };
          api.foot.querySelector('[data-rm]').onclick = () => { d.images.splice(i, 1); api.close(); drawImgs(); valid(); saveDraft(); };
          const fb = api.foot.querySelector('[data-first]'); if (fb) fb.onclick = () => { d.images.unshift(d.images.splice(i, 1)[0]); api.close(); drawImgs(); saveDraft(); };
        }
      });
    };

    /* ---- 设置区 ---- */
    const bindChips = (sel, key, multi) => {
      const g = $(sel); if (!g) return;
      const upd = () => g.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', multi ? d[key].includes(c.dataset.v) : String(d[key]) === c.dataset.v));
      g.querySelectorAll('.chip').forEach(c => c.onclick = () => {
        if (multi) { const k = d[key].indexOf(c.dataset.v); k < 0 ? d[key].push(c.dataset.v) : d[key].splice(k, 1); }
        else d[key] = c.dataset.v;
        upd(); saveDraft();
      });
      upd();
    };
    bindChips('#cpWorld', 'worldId'); bindChips('#cpMention', 'mentions', true); bindChips('#cpVis', 'visibility');
    F.edit.tags($('#cpTags'), d, 'tags', '输入话题后回车');
    page.querySelectorAll('[data-sw]').forEach(el => el.onchange = () => { d[el.dataset.sw] = el.checked; saveDraft(); });

    /* ---- 取消 / 发布 ---- */
    const close = () => { api.close(); };
    $('[data-cancel]').onclick = async () => {
      const has = text.value.trim() || title.value.trim() || d.images.length || d.poll.question;
      if (!has) { F.state.draft = null; F.save('draft'); return close(); }
      const v = await F.menu('要保留这次编辑吗？', [{ label: '保存草稿', sub: '下次打开发帖时自动恢复', value: 'keep', icon: 'doc' }, { label: '不保存', value: 'drop', icon: 'trash', danger: true }]);
      if (!v) return;
      F.state.draft = v === 'keep' ? d : null; await F.save('draft'); close();
    };
    $('[data-publish]').onclick = async () => {
      const btn = $('[data-publish]'); btn.disabled = true;
      const inlineTopics = [...text.value.matchAll(/#([^#\s][^#\n]{0,30})#/g)].map(m => m[1].trim());
      d.tags = [...new Set([...d.tags, ...inlineTopics])].slice(0, 8);
      const post = {
        id: F.uid('p'), worldId: d.worldId || null, type: d.type, author: { kind: 'user', id: d.identityId }, source: 'user',
        title: (d.type === 'article' || d.type === 'essay') ? title.value.trim() : '',
        content: text.value.trim(), topic: d.tags[0] || '', tags: d.tags.slice(), mentions: d.mentions.slice(), location: loc.value.trim(),
        images: d.images.map((im, i) => ({ src: im.src, desc: im.desc, aiDesc: im.aiDesc, seed: 'u' + i })),
        poll: d.type === 'poll' ? { question: d.poll.question.trim(), options: d.poll.options.filter(o => o.trim()).map(t => ({ text: t.trim(), votes: 0 })), votes: {}, endsAt: Date.now() + d.poll.days * 86400e3 } : null,
        stats: { likes: 0, reposts: 0, favorites: 0, views: 0 }, likedBy: [], favBy: [], comments: [],
        visibility: d.visibility, allowComment: d.allowComment, createdAt: Date.now()
      };
      F.state.posts.push(post);
      F.state.draft = null;
      await F.save('posts', 'draft');
      close();
      F.toast('已发布', 'check');
      if (d.identityId !== F.state.activeIdentityId) { F.state.activeIdentityId = d.identityId; await F.save('activeIdentityId'); }
      F.profile.tab = 'posts';
      setTimeout(() => F.tabs.go('me'), 300);
      if (d.aiComments) {
        try {
          F.toast('正在生成首批互动…', 'spark');
          await F.ai.refreshPost(post);
          await F.save('posts', 'npcs', 'identities');
          F.toast(`收到 ${F.commentCount(post)} 条评论`, 'comment');
        } catch (e) { F.toast('互动生成失败：' + e.message, 'close', 3500); }
      }
    };

    drawWho(); drawType(); drawImgs(); valid(); grow();
    setTimeout(() => text.focus({ preventScroll: true }), 650);
  }, { fromCore: opts.fromCore });
};
