/* ==========================================================================
   角初笺 · juechu.js — 主壳逻辑
========================================================================== */
(function () {
  'use strict';
  var esc = JC.esc, toast = JC.toast, DB = JC.DB, AI = JC.AI;

  JC.bootChrome();

  /* ======================================================================
     一、底部导航 + 页面切换
  ====================================================================== */
  var TABS = [
    { key: 'meet',    num: 'I',   cn: '初见', en: 'FIRST&nbsp;ENCOUNTER' },
    { key: 'moments', num: 'II',  cn: '动态', en: 'MOMENTS' },
    { key: 'dm',      num: 'III', cn: '私信', en: 'THREADS' },
    { key: 'me',      num: 'IV',  cn: '我的', en: 'MY&nbsp;PAGE' }
  ];
  var curTab = 'meet';
  var tbInk = document.getElementById('tbInk');
  var tbArc = document.getElementById('tbArc');
  var frame = document.getElementById('phoneFrame');

  function moveInk(i) {
    tbInk.style.transform = 'translateX(' + (i * 100) + '%)';
    tbArc.classList.remove('sweep');
    void tbArc.offsetWidth;
    tbArc.classList.add('sweep');
  }

  function switchTab(key) {
    if (key === curTab) return;
    var idx = TABS.map(function (t) { return t.key; }).indexOf(key);
    if (idx < 0) return;
    curTab = key;

    document.querySelectorAll('.tb-item').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.tab === key);
    });
    moveInk(idx);

    document.querySelectorAll('.page').forEach(function (p) {
      p.classList.toggle('is-active', p.dataset.page === key);
    });

    var t = TABS[idx];
    document.getElementById('ttsNum').textContent = t.num;
    document.getElementById('ttsCn').textContent = t.cn;
    document.getElementById('ttsEn').innerHTML = t.en;

    frame.classList.toggle('is-me', key === 'me');
    frame.classList.toggle('is-dark-chrome', key === 'me');

    if (key === 'moments') renderFeed();
    if (key === 'dm') renderDM();
    if (key === 'me') renderMe();
    try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
  }
  document.querySelectorAll('.tb-item').forEach(function (b) {
    b.addEventListener('click', function () { switchTab(b.dataset.tab); });
  });
  moveInk(0);

  /* 入口跳转 */
  document.addEventListener('click', function (e) {
    var p = e.target.closest('[data-portal]');
    if (!p) return;
    var map = {
      preset: 'jc-preset.html',
      archive: 'jc-archive.html',
      gallery: 'jc-gallery.html',
      seal: 'jc-archive.html?tab=seal',
      vault: 'jc-vault.html',
      guide: 'jc-guide.html'
    };
    if (map[p.dataset.portal]) JC.go(map[p.dataset.portal]);
  });

  /* ======================================================================
     二、通用弹层
  ====================================================================== */
  var sheetMask = document.getElementById('sheetMask');
  var sheet = document.getElementById('sheet');
  var sheetBody = document.getElementById('sheetBody');
  function openSheet(html) {
    sheetBody.innerHTML = html;
    sheetMask.classList.add('open');
    sheet.classList.add('open');
  }
  function closeSheet() {
    sheetMask.classList.remove('open');
    sheet.classList.remove('open');
  }
  sheetMask.addEventListener('click', closeSheet);
  window.jcCloseSheet = closeSheet;

  /* ======================================================================
     三、初见 —— 落笺印长按生成
  ====================================================================== */
  var press = document.getElementById('inkPress');
  var arcFg = document.getElementById('inkArcFg');
  var hintMain = document.querySelector('.ink-hint-main');
  var HOLD_MS = 1150, holdTimer = null, holdStart = 0, generating = false;

  function setArc(p) { arcFg.style.strokeDashoffset = String(396 * (1 - p)); }

  function holdBegin(e) {
    if (generating) return;
    e.preventDefault();
    press.classList.add('holding');
    holdStart = Date.now();
    hintMain.textContent = '正在凝墨……松手即散';
    cancelAnimationFrame(holdTimer);
    (function tick() {
      var p = Math.min(1, (Date.now() - holdStart) / HOLD_MS);
      setArc(p);
      if (p >= 1) { holdRelease(true); return; }
      holdTimer = requestAnimationFrame(tick);
    })();
  }
  function holdRelease(complete) {
    cancelAnimationFrame(holdTimer);
    press.classList.remove('holding');
    if (complete) {
      press.classList.add('done');
      setTimeout(function () { press.classList.remove('done'); }, 720);
      var rip = document.getElementById('inkRipple');
      rip.classList.remove('go'); void rip.offsetWidth; rip.classList.add('go');
      try { navigator.vibrate && navigator.vibrate([12, 40, 18]); } catch (e) {}
      doGenerate();
    } else {
      setArc(0);
      hintMain.textContent = '按住印章，等墨迹绕满一圈';
    }
  }
  ['pointerdown'].forEach(function (ev) { press.addEventListener(ev, holdBegin); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    press.addEventListener(ev, function () { if (!generating) holdRelease(false); });
  });

  /* --- 生成角色卡 --- */
  var deckData = [];
  var usedBg = new Set(), usedAv = new Set();

  function cardSchema() {
    return [
      '{',
      '  "cards": [',
      '    {',
      '      "name": "中文或外文姓名（言情小说质感）",',
      '      "enName": "拉丁转写或英文名，全大写",',
      '      "gender": "男/女/其他",',
      '      "age": 26,',
      '      "mbti": "INFJ",',
      '      "lang": "中文",',
      '      "identity": "身份职业，8字以内",',
      '      "genre": "题材风格，如 都市情感 / 古风权谋",',
      '      "era": "时代与地域背景",',
      '      "tagline": "一句话签名，文学化、有钩子，25字内",',
      '      "traits": ["性格标签", "共4个", "各不超过4字", "禁止重复"],',
      '      "look": "外貌气质速写，40字内",',
      '      "voice": "说话方式速写，24字内",',
      '      "secret": "一处尚未说出口的隐秘，30字内"',
      '    }',
      '  ]',
      '}'
    ].join('\n');
  }

  function doGenerate() {
    if (generating) return;
    if (!AI.ready()) {
      setArc(0);
      hintMain.textContent = '请先到「设置 · API」完成接口配置';
      toast('尚未配置 API，请到设置里完成');
      return;
    }
    generating = true;
    hintMain.innerHTML = '<span class="jc-ink-load"><i></i><i></i><i></i></span>';

    Promise.all([JC.Preset.get(), JC.Profile.get()]).then(function (r) {
      var preset = r[0], profile = r[1];
      var sys = [
        '你是「角初笺」的角色生成引擎，为一款言情向虚构社交平台批量塑造可供邂逅的虚构人物。',
        JC.ROMANCE_RULE,
        '',
        '【用户预设范围 —— 必须严格遵守，凡是列出的维度只能在给定取值内取值】',
        JC.Preset.toPrompt(preset),
        '',
        '【用户资料 —— 仅用于把握基调与匹配感，绝不可在角色设定中提及用户或与用户的关系】',
        JC.Profile.toPrompt(profile),
        '',
        '一次生成 3 位彼此差异极大的角色（性别可不同、气质不可雷同）。',
        JC.CardArt.ART_RULE,
        '',
        JC.Time.prompt(),
        '',
        '只输出 JSON，不要任何解释、不要 markdown 代码块。JSON 结构如下：',
        cardSchema()
      ].join('\n');

      return AI.json([
        { role: 'system', content: sys },
        { role: 'user', content: '生成 3 位新角色。' + (Math.random() < .5 ? '其中至少一位气质冷冽克制。' : '其中至少一位气质明亮张扬。') }
      ], { temperature: 1.0, max_tokens: 2000 });
    }).then(function (data) {
      var arr = AI.firstArray(data, ['cards', 'list', 'characters', 'people', 'result', 'data']);
      arr = arr.filter(function (c) { return c && (c.name || c.enName); });
      if (!arr.length) throw new Error('未取得角色数据');
      return attachAssets(arr);
    }).then(function (arr) {
      arr.forEach(function (c) { c.uid = JC.uid(); c.ts = Date.now(); });
      // 花过额度的一律留档，无论用户喜不喜欢
      JC.Vault.addMany(arr, { origin: 'meet' }).catch(function () {});
      deckData = arr.concat(deckData).slice(0, 12);
      renderDeck();
      hintMain.textContent = '再按一次，换一批来客';
      setArc(0);
      toast('落笺成 · 共 ' + arr.length + ' 位');
    }).catch(function (err) {
      hintMain.textContent = '落笺失败：' + err.message;
      setArc(0);
      toast(err.message);
    }).finally(function () { generating = false; });
  }

  /** 从「背景头像库」随机取图挂到角色卡上 */
  function attachAssets(arr) {
    return Promise.all(arr.map(function (c) {
      return Promise.all([
        JC.Gallery.pick('bg', usedBg),
        JC.Gallery.pick('avatar', usedAv)
      ]).then(function (r) {
        if (r[0]) { c.cardBg = r[0].data; usedBg.add(r[0].id); }
        if (r[1]) { c.avatar = r[1].data; usedAv.add(r[1].id); }
        return c;
      });
    }));
  }

  /* --- 卡牌堆渲染 + 左右滑动 --- */
  var deck = document.getElementById('deck');
  var deckEmpty = document.getElementById('deckEmpty');
  var deckIndexEl = document.getElementById('deckIndex');
  var topIdx = 0;

  function buildCard(c, depth) {
    var el = document.createElement('div');
    el.className = 'rcard';
    el.dataset.uid = c.uid;

    // 卡面本体是一份现场生成的 HTML/CSS/JS 文档，跑在沙箱 iframe 里
    var stage = document.createElement('div');
    stage.className = 'rcard-stage';
    el.appendChild(stage);
    if (depth < 3) {
      var f = JC.CardArt.mount(stage, c, { fast: depth > 0 });
      el._art = f;
    }

    var deco = document.createElement('div');
    deco.className = 'rcard-deco';
    deco.innerHTML =
      '<span class="rcard-stamp left">换一位</span>' +
      '<span class="rcard-stamp right">入存档</span>' +
      '<span class="rcard-idx">NO.' + String(topIdx + depth + 1).padStart(3, '0') + '</span>' +
      '<button class="rcard-open" aria-label="查看详情">' +
        '<svg viewBox="0 0 24 24" fill="none"><path d="M8 5l7 7-7 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '</button>';
    el.appendChild(deco);

    var scale = 1 - depth * 0.045;
    var y = depth * 14;
    if (depth === 0) el.classList.add('is-top');
    el.style.transform = 'translateY(' + y + 'px) scale(' + scale + ')';
    el.style.zIndex = String(50 - depth);
    el.style.opacity = depth > 2 ? '0' : '1';
    return el;
  }

  function renderDeck() {
    deck.innerHTML = '';
    var slice = deckData.slice(topIdx, topIdx + 4);
    deckEmpty.style.display = slice.length ? 'none' : '';
    slice.forEach(function (c, i) { deck.appendChild(buildCard(c, i)); });
    // 顶层卡在最上面：倒序 append 才能保证叠放顺序正确
    Array.prototype.slice.call(deck.children).reverse().forEach(function (n) { deck.appendChild(n); });
    deckIndexEl.textContent = deckData.length ? (topIdx + 1) + ' / ' + deckData.length : '— / —';
    bindTop();
  }

  function bindTop() {
    var top = deck.querySelector('.rcard.is-top');
    if (!top) return;
    var card = deckData[topIdx];
    var sx = 0, sy = 0, dx = 0, dy = 0, active = false;
    var stampL = top.querySelector('.rcard-stamp.left');
    var stampR = top.querySelector('.rcard-stamp.right');

    top.querySelector('.rcard-open').addEventListener('click', function (e) {
      e.stopPropagation();
      openDetail(card);
    });
    top.addEventListener('click', function () { if (Math.abs(dx) < 6) openDetail(card); });

    top.addEventListener('pointerdown', function (e) {
      active = true; sx = e.clientX; sy = e.clientY; dx = dy = 0;
      top.classList.add('dragging');
      top.setPointerCapture(e.pointerId);
    });
    top.addEventListener('pointermove', function (e) {
      if (!active) return;
      dx = e.clientX - sx; dy = e.clientY - sy;
      var rot = dx / 18;
      top.style.transform = 'translate(' + dx + 'px,' + (dy * 0.28) + 'px) rotate(' + rot + 'deg)';
      stampL.style.opacity = dx < -24 ? String(Math.min(1, -dx / 110)) : '0';
      stampR.style.opacity = dx > 24 ? String(Math.min(1, dx / 110)) : '0';
      tilt(top, dx / 160, dy / 220);
    });
    function end() {
      if (!active) return;
      active = false;
      top.classList.remove('dragging');
      if (Math.abs(dx) > 96) {
        var dir = dx > 0 ? 1 : -1;
        top.style.transform = 'translate(' + (dir * 620) + 'px,' + (dy * .4 + 60) + 'px) rotate(' + (dir * 26) + 'deg)';
        top.style.opacity = '0';
        if (dir > 0) archiveCard(card);
        else JC.Vault.mark(card.uid, 'passed').catch(function () {});
        setTimeout(function () {
          topIdx++;
          if (topIdx >= deckData.length) { topIdx = Math.max(0, deckData.length - 1); }
          renderDeck();
        }, 330);
      } else {
        top.style.transform = 'translateY(0) scale(1)';
        stampL.style.opacity = stampR.style.opacity = '0';
        tilt(top, 0, 0, true);
      }
    }
    top.addEventListener('pointerup', end);
    top.addEventListener('pointercancel', end);
  }

  /* 把指针位置喂给卡面 iframe，让它自己做视差 */
  function tilt(el, x, y, reset) {
    var f = el._art;
    if (!f || !f.contentWindow) return;
    try {
      f.contentWindow.postMessage(reset ? { jc: 'reset' } : { jc: 'tilt', x: x, y: y }, '*');
    } catch (e) {}
  }

  function archiveCard(c) {
    if (!c) return;
    var rec = Object.assign({}, c);
    delete rec.id;
    DB.put('cards', rec).then(function () {
      JC.Vault.mark(c.uid, 'liked').catch(function () {});
      toast('「' + c.name + '」已入存档');
      refreshCounts();
    });
  }

  function openDetail(c) {
    if (!c) return;
    DB.kvSet('viewing', c).then(function () { JC.go('jc-detail.html'); });
  }

  function refreshCounts() {
    DB.all('cards').then(function (l) {
      document.getElementById('archiveCount').textContent = l.length;
      var el = document.getElementById('msCards'); if (el) el.textContent = l.length;
      var rel = l.filter(function (c) { return c.relation; }).length;
      var r2 = document.getElementById('msRel'); if (r2) r2.textContent = rel;
    });
    DB.all('assets').then(function (l) { document.getElementById('assetCount').textContent = l.length; });
    JC.Preset.get().then(function (p) {
      var any = Object.keys(p).some(function (k) { return Array.isArray(p[k]) && p[k].length; });
      document.getElementById('presetDot').classList.toggle('on', any);
    });
  }
  refreshCounts();

  /* 恢复上次的牌堆 */
  DB.kvGet('deck', []).then(function (d) {
    if (d && d.length) { deckData = d; renderDeck(); }
  });
  window.addEventListener('beforeunload', function () {
    DB.kvSet('deck', deckData.slice(0, 12));
  });

  /* ======================================================================
     四、动态页
  ====================================================================== */
  var circleMode = 'relation';
  var feedEl = document.getElementById('feed');
  var feedEmpty = document.getElementById('feedEmpty');
  var newPill = document.getElementById('newPill');
  var pendingNew = [];

  document.querySelectorAll('.cd-item').forEach(function (b, i) {
    b.addEventListener('click', function () {
      circleMode = b.dataset.circle;
      document.querySelectorAll('.cd-item').forEach(function (x) { x.classList.toggle('is-on', x === b); });
      document.getElementById('cdThumb').style.transform = 'translateX(' + (i * 100) + '%)';
      renderFeed();
    });
  });

  function renderFeed() {
    DB.all('moments').then(function (list) {
      list = list.filter(function (m) { return m.circle === circleMode; })
                 .sort(function (a, b) { return b.ts - a.ts; });
      feedEmpty.classList.toggle('on', !list.length);
      feedEl.innerHTML = list.map(momentHTML).join('');
      bindFeed();
    });
  }

  function momentHTML(m) {
    var initial = (m.name || '笺').charAt(0);
    var imgs = (m.images || []).slice(0, 4);
    return '<article class="mo" data-id="' + m.id + '">' +
      '<div class="mo-head">' +
        '<div class="mo-av">' + (m.avatar ? '<img src="' + esc(m.avatar) + '">' : '<span>' + esc(initial) + '</span>') + '</div>' +
        '<div class="mo-hcol">' +
          '<div class="mo-name">' + esc(m.name) + '</div>' +
          '<div class="mo-sub">' +
            (m.relation ? '<span class="mo-rel">' + esc(m.relation) + '</span>' : '<span class="mo-rel">陌路</span>') +
            '<span>' + esc(m.place || '') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mo-text">' + esc(m.text) + '</div>' +
      (imgs.length ? '<div class="mo-imgs" data-n="' + imgs.length + '">' + imgs.map(function (im) {
        return '<div class="mo-img">' + (im.bg ? '<img src="' + esc(im.bg) + '">' : '') +
               '<div class="mo-img-cap">' + esc(im.caption || '') + '</div></div>';
      }).join('') + '</div>' : '') +
      '<div class="mo-bar">' +
        '<button class="mo-act act-like' + (m.liked ? ' on' : '') + '" data-act="like">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20s-7-4.4-7-9.1A4 4 0 0112 8.6 4 4 0 0119 10.9C19 15.6 12 20 12 20z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>' +
          '<span>' + (m.likes || 0) + '</span></button>' +
        '<button class="mo-act" data-act="cmt">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M4.6 7.4A2.2 2.2 0 016.8 5.2h10.4a2.2 2.2 0 012.2 2.2v6.6a2.2 2.2 0 01-2.2 2.2H10l-3.8 2.6v-2.6a2.2 2.2 0 01-1.6-2.2V7.4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>' +
          '<span>' + ((m.comments || []).length) + '</span></button>' +
        '<button class="mo-act" data-act="open">' +
          '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7.6" stroke="currentColor" stroke-width="1.4"/><path d="M12 8.4v7.2M8.4 12h7.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
          '<span>续</span></button>' +
        '<span class="mo-time">' + JC.timeAgo(m.ts) + '</span>' +
      '</div>' +
      '<div class="mo-cmts" id="cmts-' + m.id + '">' +
        (m.comments || []).map(function (c) {
          return '<div class="cmt"><div class="cmt-av">' +
            (c.avatar ? '<img src="' + esc(c.avatar) + '">' : esc((c.name || '?').charAt(0))) +
            '</div><div class="cmt-b"><div class="cmt-n">' + esc(c.name) + '</div><div class="cmt-t">' + esc(c.text) + '</div></div></div>';
        }).join('') +
        '<div class="cmt-input">' +
          '<input placeholder="写下你的回应…" data-cmt="' + m.id + '" />' +
          '<button class="cmt-send" data-send="' + m.id + '">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12l14-7-5.4 7L19 19 5 12z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function bindFeed() {
    feedEl.querySelectorAll('.mo').forEach(function (art) {
      var id = Number(art.dataset.id);
      art.querySelectorAll('[data-act]').forEach(function (b) {
        b.addEventListener('click', function () {
          var act = b.dataset.act;
          if (act === 'cmt') {
            document.getElementById('cmts-' + id).classList.toggle('open');
          } else if (act === 'like') {
            DB.get('moments', id).then(function (m) {
              m.liked = !m.liked;
              m.likes = (m.likes || 0) + (m.liked ? 1 : -1);
              return DB.put('moments', m);
            }).then(renderFeed);
          } else if (act === 'open') {
            growMoment(id, b);
          }
        });
      });
      art.querySelectorAll('[data-send]').forEach(function (b) {
        b.addEventListener('click', function () {
          var inp = art.querySelector('[data-cmt="' + id + '"]');
          var txt = inp.value.trim();
          if (!txt) return;
          inp.value = '';
          replyComment(id, txt);
        });
      });
    });
  }

  /* 用户评论 → AI 生成角色回应 */
  function replyComment(id, txt) {
    DB.get('moments', id).then(function (m) {
      m.comments = m.comments || [];
      return JC.Profile.get().then(function (prof) {
        m.comments.push({ name: prof.name || '我', avatar: prof.avatar, text: txt, me: true });
        return DB.put('moments', m).then(function () {
          renderFeed();
          document.getElementById('cmts-' + id) && document.getElementById('cmts-' + id).classList.add('open');
          if (!AI.ready()) return;
          var sys = [
            '你在扮演言情向社交平台上的角色「' + m.name + '」。',
            m.persona ? ('角色设定：' + m.persona) : '',
            '你刚发布了一条动态：「' + m.text + '」',
            JC.ROMANCE_RULE,
            '现在用户「' + (prof.name || '对方') + '」在下面评论了。请以角色本人的口吻回复这条评论，' +
            '1 到 2 句，口语化、有情绪、有个人语气习惯，禁止解释、禁止旁白、禁止 emoji。只输出回复正文。'
          ].filter(Boolean).join('\n');
          return AI.chat([
            { role: 'system', content: sys },
            { role: 'user', content: txt }
          ], { max_tokens: 260 }).then(function (rep) {
            return DB.get('moments', id).then(function (mm) {
              mm.comments.push({ name: mm.name, avatar: mm.avatar, text: rep.trim() });
              return DB.put('moments', mm);
            }).then(function () {
              renderFeed();
              var box = document.getElementById('cmts-' + id);
              box && box.classList.add('open');
            });
          });
        });
      });
    }).catch(function (e) { toast(e.message); });
  }

  /* 点击「续」：为该条动态追加新的点赞与评论（不打断阅读） */
  function growMoment(id, btn) {
    if (!AI.ready()) { toast('尚未配置 API'); return; }
    btn.classList.add('on');
    DB.get('moments', id).then(function (m) {
      var sys = [
        '你在为一款言情向社交平台生成动态下方的互动。',
        JC.ROMANCE_RULE,
        '动态作者：' + m.name + '。动态正文：「' + m.text + '」',
        '生成 2 到 3 条来自不同虚构人物的评论，姓名须是言情小说质感的虚构姓名，语气各异（调侃 / 关切 / 意有所指皆可）。',
        '只输出 JSON：{"comments":[{"name":"姓名","text":"评论内容"}],"likes":新增点赞数(整数 3-40)}'
      ].join('\n');
      return AI.json([{ role: 'system', content: sys }, { role: 'user', content: '生成互动。' }], { max_tokens: 700 })
        .then(function (d) {
          m.comments = (m.comments || []).concat(AI.firstArray(d, ['comments', 'list']));
          m.likes = (m.likes || 0) + (d.likes || JC.rand(3, 30));
          return DB.put('moments', m);
        });
    }).then(function () {
      renderFeed();
      toast('这条动态又热闹了一些');
    }).catch(function (e) { toast(e.message); }).finally(function () { btn.classList.remove('on'); });
  }

  /* 生成动态 */
  var castBtn = document.getElementById('momentCast');
  castBtn.addEventListener('click', function () {
    if (!AI.ready()) { toast('尚未配置 API'); return; }
    castBtn.classList.add('busy');
    Promise.all([DB.all('cards'), JC.Preset.get(), JC.Profile.get(), JC.Gallery.byType('bg')])
      .then(function (r) {
        var cards = r[0], preset = r[1], prof = r[2], bgs = r[3];
        var pool = circleMode === 'relation'
          ? cards.filter(function (c) { return c.relation; })
          : cards;
        if (circleMode === 'relation' && !pool.length) {
          throw new Error('关系圈还没有人 —— 先在聊天里缔结一段关系');
        }
        var roster = pool.length
          ? pool.slice(0, 6).map(function (c) {
              return '· ' + c.name + '（' + (c.identity || '') + '，' + (c.mbti || '') + '，关系：' + (c.relation || '尚未缔结') + '）';
            }).join('\n')
          : '（无既有角色，请自行虚构陌生人）';

        var sys = [
          circleMode === 'relation'
            ? '你在为「关系圈」生成动态：作者必须来自下方名单，且动态内容要能微妙地映照他与用户之间的关系。'
            : '你在为「陌路」生成动态：作者是用户尚不认识的陌生人，绝不可提及用户。',
          JC.ROMANCE_RULE,
          '名单：\n' + roster,
          '用户预设范围（陌生人须落在此范围内）：\n' + JC.Preset.toPrompt(preset),
          '用户资料（仅用于把握气质，不得直接提及）：\n' + JC.Profile.toPrompt(prof),
          '',
          '生成 2 条动态。每条包含：作者姓名、地点、正文（40-110字，第一人称，有画面感，像真人随手写下的一段心绪，不要写成散文诗）、',
          '1 到 3 张配图的文字描述（每张一句，描述画面内容，不含人物姓名）、初始点赞数、以及 2-3 条来自其他虚构角色的评论。',
          '只输出 JSON：',
          '{"moments":[{"name":"","place":"","text":"","captions":["",""],"likes":12,"comments":[{"name":"","text":""}]}]}'
        ].join('\n');

        sys += '\n\n' + JC.Time.prompt();
        return AI.json([{ role: 'system', content: sys }, { role: 'user', content: '生成动态。' }], { max_tokens: 1600 })
          .then(function (d) { return { list: AI.firstArray(d, ['moments', 'list', 'posts']), cards: pool, bgs: bgs }; });
      })
      .then(function (ctx) {
        var saves = ctx.list.map(function (m) {
          var who = ctx.cards.filter(function (c) { return c.name === m.name; })[0];
          var imgs = (m.captions || []).slice(0, 4).map(function (cap) {
            var bg = ctx.bgs.length ? JC.pick(ctx.bgs).data : '';
            return { bg: bg, caption: cap };
          });
          return DB.put('moments', {
            circle: circleMode,
            name: m.name,
            avatar: who ? who.avatar : (ctx.bgs.length ? '' : ''),
            relation: who ? who.relation : '',
            persona: who ? (who.tagline + '｜' + (who.traits || []).join('、')) : '',
            place: m.place || '',
            text: m.text || '',
            images: imgs,
            likes: m.likes || JC.rand(6, 60),
            liked: false,
            comments: m.comments || [],
            ts: Date.now() - JC.rand(0, 3600 * 1000)
          });
        });
        return Promise.all(saves);
      })
      .then(function (ids) {
        pendingNew = ids;
        document.getElementById('newPillText').textContent = ids.length + ' 条新动态';
        newPill.classList.add('on');
      })
      .catch(function (e) { toast(e.message); })
      .finally(function () { castBtn.classList.remove('busy'); });
  });

  newPill.addEventListener('click', function () {
    newPill.classList.remove('on');
    var scroll = document.getElementById('momentsScroll');
    var prevH = scroll.scrollHeight, prevTop = scroll.scrollTop;
    renderFeed();
    // 保持阅读位置不被顶飞
    requestAnimationFrame(function () {
      if (prevTop > 40) scroll.scrollTop = prevTop + (scroll.scrollHeight - prevH);
      else scroll.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  /* ======================================================================
     五、私信页
  ====================================================================== */
  var dmList = document.getElementById('dmList');
  var dmEmpty = document.getElementById('dmEmpty');

  function renderDM() {
    DB.all('convos').then(function (list) {
      list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      dmEmpty.classList.toggle('on', !list.length);
      document.getElementById('dmCount').textContent = list.length;
      var unread = list.reduce(function (n, c) { return n + (c.unread || 0); }, 0);
      document.getElementById('dmBadge').classList.toggle('on', unread > 0);

      dmList.innerHTML = list.map(function (c, i) {
        var last = (c.messages || []).slice(-1)[0];
        var prev = last ? (last.from === 'me' ? '我：' : '') + (last.type === 'voice' ? '[语音]' : last.text) : (c.firstMes || '打个招呼吧');
        return '<div class="dm-item" data-id="' + c.id + '" style="animation-delay:' + (i * .045) + 's">' +
          '<div class="dm-av">' + (c.avatar ? '<img src="' + esc(c.avatar) + '">' : '<span>' + esc((c.name || '?').charAt(0)) + '</span>') + '</div>' +
          '<div class="dm-col">' +
            '<div class="dm-row1">' +
              '<span class="dm-name">' + esc(c.name) + '</span>' +
              (c.lang && c.lang !== '中文' ? '<span class="dm-lang">' + esc(c.lang) + '</span>' : '') +
              '<span class="dm-time">' + JC.timeAgo(c.ts || Date.now()) + '</span>' +
            '</div>' +
            '<div class="dm-prev">' + esc(prev) + '</div>' +
          '</div>' +
          (c.unread ? '<span class="dm-unread">' + c.unread + '</span>' : '') +
        '</div>';
      }).join('');

      dmList.querySelectorAll('.dm-item').forEach(function (el) {
        el.addEventListener('click', function () { JC.go('jc-chat.html?c=' + el.dataset.id); });
      });
    });
  }

  /* 偶遇：拉绳生成陌生人 */
  (function initCord() {
    var cord = document.getElementById('encCord');
    var line = document.getElementById('cordLine');
    var enc = document.getElementById('encounter');
    var sy = 0, d = 0, active = false, busy = false;
    var MAX = 86;

    cord.addEventListener('pointerdown', function (e) {
      if (busy) return;
      active = true; sy = e.clientY; cord.classList.add('pulling');
      cord.setPointerCapture(e.pointerId);
    });
    cord.addEventListener('pointermove', function (e) {
      if (!active) return;
      d = Math.max(0, Math.min(MAX + 26, e.clientY - sy));
      line.style.height = (52 + d) + 'px';
      document.getElementById('encSub').textContent =
        d > MAX ? '松手，缘分落地' : '再拽一点…… ' + Math.round(d / MAX * 100) + '%';
    });
    function release() {
      if (!active) return;
      active = false; cord.classList.remove('pulling');
      line.style.height = '52px';
      if (d > MAX) drawStrangers();
      else document.getElementById('encSub').textContent = '向下拽动垂绳，随机遇见几位陌生来客';
      d = 0;
    }
    cord.addEventListener('pointerup', release);
    cord.addEventListener('pointercancel', release);

    function drawStrangers() {
      if (!AI.ready()) { toast('尚未配置 API'); return; }
      busy = true; enc.classList.add('busy');
      document.getElementById('encSub').innerHTML = '<span class="jc-ink-load"><i></i><i></i><i></i></span>';

      Promise.all([JC.Preset.get(), JC.Profile.get()]).then(function (r) {
        var preset = r[0], prof = r[1];
        var sys = [
          '你在为言情向社交平台生成随机出现的「陌生来客」，他们会主动私信用户。',
          JC.ROMANCE_RULE,
          '【用户预设范围 —— 必须严格落在其中】\n' + JC.Preset.toPrompt(preset),
          '【用户资料 —— 只用于让搭讪显得自然，不得直接引用】\n' + JC.Profile.toPrompt(prof),
          '',
          '生成 3 位来客，语言要多样：若用户预设指定了语言则严格遵守；否则在中文、英文、日文、法文、韩文、西班牙文之间随机分布，至少一位使用非中文。',
          'firstMes 必须用该角色的母语书写；若不是中文，另给出 firstMesZh 中文翻译。',
          '只输出 JSON：',
          '{"people":[{"name":"","enName":"","gender":"","age":25,"mbti":"","lang":"日文","identity":"","tagline":"","traits":["","",""],"look":"","firstMes":"","firstMesZh":""}]}'
        ].join('\n');
        sys += '\n\n' + JC.Time.prompt();
        return AI.json([{ role: 'system', content: sys }, { role: 'user', content: '生成 3 位来客。' }], { temperature: 1.02, max_tokens: 1600 });
      }).then(function (d) {
        return attachAssets(AI.firstArray(d, ['people', 'list', 'strangers', 'cards']));
      }).then(function (arr) {
        return Promise.all(arr.map(function (p) {
          return DB.put('convos', {
            name: p.name, enName: p.enName, avatar: p.avatar, cardBg: p.cardBg,
            gender: p.gender, age: p.age, mbti: p.mbti, lang: p.lang || '中文',
            identity: p.identity, tagline: p.tagline, traits: p.traits, look: p.look,
            firstMes: p.firstMes,
            messages: [{
              from: 'them', type: 'text', text: p.firstMes,
              zh: p.lang && p.lang !== '中文' ? p.firstMesZh : '',
              ts: Date.now()
            }],
            unread: 1, ts: Date.now(), relation: '', spark: 0, sealed: []
          });
        }));
      }).then(function (ids) {
        document.getElementById('encSub').textContent = '来了 ' + ids.length + ' 位 —— 往下看';
        renderDM();
        toast('偶遇 ' + ids.length + ' 位陌生来客');
      }).catch(function (e) {
        document.getElementById('encSub').textContent = e.message;
        toast(e.message);
      }).finally(function () {
        busy = false; enc.classList.remove('busy');
        setTimeout(function () {
          document.getElementById('encSub').textContent = '向下拽动垂绳，随机遇见几位陌生来客';
        }, 3200);
      });
    }
  })();

  /* ======================================================================
     六、我的页
  ====================================================================== */
  var filePick = document.getElementById('filePick');
  var pickTarget = null;

  function renderMe() {
    JC.Profile.get().then(function (p) {
      document.getElementById('meName').textContent = p.name || '未署名';
      document.getElementById('meHandle').textContent = '@' + (p.handle || 'juechu');
      document.getElementById('meBio').textContent = p.bio || '这里还没有写下任何一句话。';
      var img = document.getElementById('meAvatarImg');
      var glyph = document.getElementById('meAvatarGlyph');
      if (p.avatar) { img.src = p.avatar; img.style.display = ''; glyph.style.display = 'none'; }
      else { img.style.display = 'none'; glyph.style.display = ''; }

      var cf = document.getElementById('meCoverFrame');
      cf.querySelectorAll('img').forEach(function (n) { n.remove(); });
      if (p.cover) {
        var im = document.createElement('img'); im.src = p.cover;
        cf.insertBefore(im, cf.firstChild);
        cf.classList.add('has-photo');
      } else cf.classList.remove('has-photo');

      renderPersonas(p);
    });
    refreshCounts();
    DB.all('convos').then(function (cs) {
      var seals = cs.reduce(function (n, c) { return n + ((c.sealed || []).length); }, 0);
      document.getElementById('msSeal').textContent = seals;
    });
    JC.Vault.all().then(function (l) {
      var el = document.getElementById('msVault');
      if (el) el.textContent = l.length;
    });
  }

  function renderPersonas(p) {
    var rail = document.getElementById('personaRail');
    var list = p.personas || [];
    rail.innerHTML = list.map(function (x, i) {
      var on = x.id === p.personaId;
      return '<button class="pv' + (on ? ' on' : '') + '" data-pid="' + x.id + '">' +
        '<span class="pv-spine"><em>' + String(i + 1).padStart(2, '0') + '</em></span>' +
        '<span class="pv-col">' +
          '<span class="pv-t">' + esc(x.title) + (on ? '<span class="pv-live">启用中</span>' : '') + '</span>' +
          '<span class="pv-b">' + esc(x.body || '（尚未写下正文）') + '</span>' +
        '</span>' +
        '<span class="pv-side">' +
          '<span class="pv-mark"></span>' +
          '<span class="pv-del" data-del="' + x.id + '">移除</span>' +
        '</span>' +
      '</button>';
    }).join('') +
    '<button class="pv add" id="personaEmpty">＋ 新 建 人 设</button>';

    rail.querySelectorAll('.pv[data-pid]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        if (e.target.dataset && e.target.dataset.del) {
          e.stopPropagation();
          p.personas = p.personas.filter(function (x) { return x.id !== e.target.dataset.del; });
          if (p.personaId === e.target.dataset.del) p.personaId = (p.personas[0] || {}).id || '';
          JC.Profile.set(p).then(renderMe);
          return;
        }
        p.personaId = (p.personaId === b.dataset.pid) ? '' : b.dataset.pid;
        JC.Profile.set(p).then(function () {
          renderMe();
          toast(p.personaId ? '已切换人设' : '已停用人设');
        });
      });
    });
    var em = document.getElementById('personaEmpty');
    if (em) em.addEventListener('click', personaSheet);
  }

  document.getElementById('personaAdd').addEventListener('click', personaSheet);

  function personaSheet() {
    openSheet(
      '<div class="sheet-head"><span class="sh-num">P</span><span class="sh-col">' +
      '<span class="sh-cn">新建人设</span><span class="sh-en">NEW&nbsp;PERSONA</span></span><span class="sh-rule"></span></div>' +
      '<div class="field"><span class="field-lb">人设名称</span><input class="field-in" id="pTitle" placeholder="例如：夜航的记录者" /></div>' +
      '<div class="field"><span class="field-lb">人设正文（AI 生成内容时会读取）</span>' +
      '<textarea class="field-in" id="pBody" rows="5" placeholder="你在这个平台上的身份、语气、习惯、在意的事…"></textarea></div>' +
      '<div class="sheet-actions"><button class="btn-minor" onclick="jcCloseSheet()">取消</button>' +
      '<button class="btn-major" id="pSave">存 入</button></div>'
    );
    document.getElementById('pSave').addEventListener('click', function () {
      var t = document.getElementById('pTitle').value.trim();
      var b = document.getElementById('pBody').value.trim();
      if (!t) return toast('先起个名字');
      JC.Profile.get().then(function (p) {
        p.personas = p.personas || [];
        var id = JC.uid();
        p.personas.push({ id: id, title: t, body: b });
        p.personaId = id;
        return JC.Profile.set(p);
      }).then(function () { closeSheet(); renderMe(); toast('人设已存档'); });
    });
  }

  /* 编辑资料（带预览） */
  document.getElementById('meEditBtn').addEventListener('click', function () {
    JC.Profile.get().then(function (p) {
      openSheet(
        '<div class="sheet-head"><span class="sh-num">ME</span><span class="sh-col">' +
        '<span class="sh-cn">编辑资料</span><span class="sh-en">EDIT&nbsp;PROFILE</span></span><span class="sh-rule"></span></div>' +
        '<div class="field"><span class="field-lb">封面预览（点击更换）</span>' +
        '<div class="preview-box" id="pvCover">' + (p.cover ? '<img src="' + esc(p.cover) + '">' : '<span>尚未设置封面</span>') + '</div></div>' +
        '<div class="field"><span class="field-lb">头像预览（点击更换）</span>' +
        '<div class="preview-box preview-av" id="pvAvatar">' + (p.avatar ? '<img src="' + esc(p.avatar) + '">' : '<span>无</span>') + '</div></div>' +
        '<div class="field"><span class="field-lb">昵称</span><input class="field-in" id="fName" value="' + esc(p.name) + '" /></div>' +
        '<div class="field"><span class="field-lb">用户名</span><input class="field-in" id="fHandle" value="' + esc(p.handle) + '" /></div>' +
        '<div class="field"><span class="field-lb">简介</span><textarea class="field-in" id="fBio" rows="3">' + esc(p.bio) + '</textarea></div>' +
        '<div class="field"><span class="field-lb">性别 / 年龄 / MBTI</span>' +
        '<div style="display:flex;gap:8px;">' +
        '<input class="field-in" id="fGender" placeholder="性别" value="' + esc(p.gender) + '" />' +
        '<input class="field-in" id="fAge" placeholder="年龄" value="' + esc(p.age) + '" />' +
        '<input class="field-in" id="fMbti" placeholder="MBTI" value="' + esc(p.mbti) + '" /></div></div>' +
        '<div class="field"><span class="field-lb">标签（逗号分隔）</span><input class="field-in" id="fTags" value="' + esc((p.tags || []).join('，')) + '" /></div>' +
        '<div class="sheet-actions"><button class="btn-minor" onclick="jcCloseSheet()">取消</button>' +
        '<button class="btn-major" id="fSave">保 存</button></div>'
      );
      var tmp = { cover: p.cover, avatar: p.avatar };
      document.getElementById('pvCover').addEventListener('click', function () { pickImage('cover', tmp); });
      document.getElementById('pvAvatar').addEventListener('click', function () { pickImage('avatar', tmp); });
      document.getElementById('fSave').addEventListener('click', function () {
        p.name = document.getElementById('fName').value.trim() || '未署名';
        p.handle = document.getElementById('fHandle').value.trim() || 'juechu';
        p.bio = document.getElementById('fBio').value.trim();
        p.gender = document.getElementById('fGender').value.trim();
        p.age = document.getElementById('fAge').value.trim();
        p.mbti = document.getElementById('fMbti').value.trim().toUpperCase();
        p.tags = document.getElementById('fTags').value.split(/[，,]/).map(function (s) { return s.trim(); }).filter(Boolean);
        p.cover = tmp.cover; p.avatar = tmp.avatar;
        JC.Profile.set(p).then(function () { closeSheet(); renderMe(); toast('资料已更新'); });
      });
    });
  });

  function pickImage(kind, tmp) {
    pickTarget = function (dataUrl) {
      tmp[kind] = dataUrl;
      var box = document.getElementById(kind === 'cover' ? 'pvCover' : 'pvAvatar');
      box.innerHTML = '<img src="' + dataUrl + '">';
    };
    filePick.value = '';
    filePick.click();
  }
  filePick.addEventListener('change', function () {
    var f = filePick.files && filePick.files[0];
    if (!f || !pickTarget) return;
    JC.fileToDataURL(f, 1400).then(function (d) { pickTarget(d); pickTarget = null; });
  });

  /* 使用说明：把书签往右抽出来 */
  (function () {
    var slot = document.getElementById('guideSlot');
    if (!slot) return;
    var rib = document.getElementById('gsRibbon');
    var fill = document.getElementById('gsFill');
    var sx = 0, dx = 0, on = false, MAX = 150;
    rib.addEventListener('pointerdown', function (e) {
      on = true; sx = e.clientX; dx = 0;
      rib.classList.add('dragging');
      rib.setPointerCapture(e.pointerId);
    });
    rib.addEventListener('pointermove', function (e) {
      if (!on) return;
      dx = Math.max(0, Math.min(MAX + 30, e.clientX - sx));
      rib.style.transform = 'translateX(' + dx + 'px)';
      fill.style.width = Math.min(100, dx / MAX * 100) + '%';
    });
    function end() {
      if (!on) return;
      on = false;
      rib.classList.remove('dragging');
      if (dx >= MAX) {
        rib.style.transform = 'translateX(' + (MAX + 90) + 'px)';
        fill.style.width = '100%';
        setTimeout(function () { JC.go('jc-guide.html'); }, 240);
      } else {
        rib.style.transform = '';
        fill.style.width = '0';
      }
    }
    rib.addEventListener('pointerup', end);
    rib.addEventListener('pointercancel', end);
  })();

  document.getElementById('meCoverEdit').addEventListener('click', function () {
    pickTarget = function (d) {
      JC.Profile.get().then(function (p) { p.cover = d; return JC.Profile.set(p); }).then(renderMe);
    };
    filePick.value = ''; filePick.click();
  });
  document.getElementById('meAvatar').addEventListener('click', function () {
    pickTarget = function (d) {
      JC.Profile.get().then(function (p) { p.avatar = d; return JC.Profile.set(p); }).then(renderMe);
    };
    filePick.value = ''; filePick.click();
  });

  /* 初始 */
  renderMe();
  renderDM();
})();