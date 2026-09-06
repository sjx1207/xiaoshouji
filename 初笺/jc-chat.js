/* ==========================================================================
   角初笺 · jc-chat.js — 交谈页
   硬性约定：
     · AI 只在点击「回」时被调用，绝不自动触发
     · 一次回几条完全由内容决定：不设上限、不设下限、不设区间；唯一底线是绝不只回一条
     · 心声与回复在同一次调用里一起生成，生成齐了才一起呈现
     · 每次调用都注入真实时间，禁止出现「深夜说早安」这类错乱
     · 页面内不使用 alert / confirm / prompt / select，全部自绘
========================================================================== */
(function () {
  'use strict';
  var esc = JC.esc, AI = JC.AI, DB = JC.DB, T = JC.Time;
  JC.bootChrome();

  var convoId = Number(new URLSearchParams(location.search).get('c'));
  var C = null, profile = null, CFG = null, MEM = [];
  var quoting = null;      // 正在引用的消息
  var busy = false;

  document.getElementById('backBtn').addEventListener('click', function () { JC.back('juechu.html'); });
  document.getElementById('setBtn').addEventListener('click', function () {
    JC.go('jc-chatset.html?c=' + convoId);
  });

  Promise.all([DB.get('convos', convoId), JC.Profile.get(), JC.ChatCfg.get()]).then(function (r) {
    C = r[0]; profile = r[1]; CFG = r[2];
    if (!C) { JC.toast('会话不存在'); setTimeout(function () { JC.back('juechu.html'); }, 800); return; }
    C.unread = 0;
    C.messages = C.messages || [];
    applyCfg();
    paintHeader();
    paintMind(C.mind);
    render();
    save();
    return JC.Memory.list(convoId);
  }).then(function (m) { MEM = m || []; });

  function save() { return DB.put('convos', C); }

  /* ======================================================================
     外观：背景整页替换，绝不加白色遮罩或模糊
  ====================================================================== */
  function applyCfg() {
    var root = document.documentElement.style;
    root.setProperty('--chat-font', JC.ChatCfg.FONTS[CFG.font].css);
    root.setProperty('--chat-fs', CFG.fontSize + 'px');
    root.setProperty('--bub-a', String(CFG.bubbleAlpha));

    var bg = document.getElementById('chatBg');
    var url = (CFG.bgScope === 'perChar' ? (C.chatBg || '') : (CFG.bg || C.chatBg || '')) || C.cardBg || '';
    if (url) {
      bg.classList.add('has-photo');
      bg.style.setProperty('--bg-url', 'url(' + url + ')');
      bg.style.setProperty('--bg-fit', CFG.bgFit === 'tile' ? '150px' : CFG.bgFit);
      bg.style.setProperty('--bg-rep', CFG.bgFit === 'tile' ? 'repeat' : 'no-repeat');
    } else {
      bg.classList.remove('has-photo');
    }
    document.getElementById('mind').classList.toggle('hide', !CFG.showInner);
  }

  function paintHeader() {
    document.getElementById('ctName').textContent = C.name || '—';
    var av = document.getElementById('ctAv');
    if (C.avatar) {
      var i = document.createElement('img'); i.src = C.avatar;
      av.insertBefore(i, av.firstChild);
      document.getElementById('ctAvGlyph').style.display = 'none';
    } else document.getElementById('ctAvGlyph').textContent = (C.name || '笺').charAt(0);

    document.getElementById('ctRel').textContent = C.relation || '尚未缔结';
    document.getElementById('ctSpark').textContent = C.relation ? ('心印 ' + (C.spark || 0)) : '';

    document.getElementById('chatOpen').innerHTML =
      '<div class="co-mark"><span class="co-cn">' + esc(C.name) + '</span>' +
      '<span class="co-en">' + esc((C.identity || '') + (C.lang && C.lang !== '中文' ? ' · ' + C.lang : '')) + '</span></div>';
  }
  document.getElementById('ctId').addEventListener('click', openDossier);

  /* ======================================================================
     心声条
  ====================================================================== */
  var mind = document.getElementById('mind');
  document.getElementById('mindRail').addEventListener('click', function () {
    mind.classList.toggle('open');
  });
  function paintMind(m) {
    if (!m) return;
    document.getElementById('mindMood').textContent = m.mood || '—';
    document.getElementById('mindDoing').textContent = m.doing || '—';
    document.getElementById('mindSaid').textContent = m.unsaid ? '「' + m.unsaid + '」' : '';
    document.getElementById('mmUnsaid').textContent = m.unsaid || '—';
    document.getElementById('mmToward').textContent = m.toward || '—';
    var w = Math.max(0, Math.min(100, Number(m.warmth) || 0));
    document.getElementById('mmWarm').style.width = w + '%';
    document.getElementById('mmWarmV').textContent = w;
  }

  /* ======================================================================
     渲染
  ====================================================================== */
  var msgsEl = document.getElementById('msgs');
  var scroller = document.getElementById('chatScroll');

  function render(keepScroll) {
    var prev = scroller.scrollTop, atEnd = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 90;
    var list = C.messages || [];
    var html = '', runFrom = null, k = 0, lastTs = 0;

    list.forEach(function (m, i) {
      if (m.type === 'sys') {
        html += '<div class="sysline">' + esc(m.text) + '</div>';
        runFrom = null; k = 0;
        return;
      }
      if (!lastTs || m.ts - lastTs > 1000 * 60 * 25) {
        html += '<div class="stamp-time">' + esc(stampOf(m.ts)) + '</div>';
        runFrom = null; k = 0;
      }
      lastTs = m.ts;

      if (m.from !== runFrom) { runFrom = m.from; k = 0; } else { k++; }
      var lastOfRun = !list[i + 1] || list[i + 1].from !== m.from || list[i + 1].type === 'sys';

      html += '<div class="row ' + (m.from === 'me' ? 'me' : 'them') + (lastOfRun ? ' show-av' : '') + '" data-i="' + i + '">' +
        '<div class="row-av">' + (m.from === 'me'
          ? (profile.avatar ? '<img src="' + esc(profile.avatar) + '">' : esc((profile.name || '我').charAt(0)))
          : (C.avatar ? '<img src="' + esc(C.avatar) + '">' : esc((C.name || '?').charAt(0)))) + '</div>' +
        '<div class="bcol">' + bubble(m, k, i) + '</div>' +
      '</div>';
    });

    msgsEl.innerHTML = html;
    bindMsgs();
    if (keepScroll) scroller.scrollTop = prev;
    else if (atEnd || !keepScroll) requestAnimationFrame(function () { scroller.scrollTop = scroller.scrollHeight; });
  }

  function stampOf(ts) {
    var p = T.parts(ts), b = T.band(p.hour);
    var today = T.dayKey(Date.now()) === T.dayKey(ts);
    return (today ? '' : p.month + '/' + p.day + '  ') + b.cn + ' ' + p.hour + ':' + p.minute;
  }

  function bubble(m, k, idx) {
    var first = k === 0 ? ' first' : '';
    var kv = 'style="--k:' + k + '"';

    /* --- 转账 / 礼物 --- */
    if (m.type === 'transfer' || m.type === 'gift') {
      var isGift = m.type === 'gift';
      return '<div class="tx' + (isGift ? ' gift' : '') + '">' +
        '<span class="tx-ribbon"></span>' +
        '<div class="tx-k">' + (isGift ? 'A GIFT FOR YOU' : 'TRANSFER') + '</div>' +
        (isGift
          ? '<div class="tx-gname">' + esc(m.gift || '一份心意') + '</div>'
          : '<div class="tx-amt"><small>¥</small>' + esc(Number(m.amount || 0).toFixed(2)) + '</div>') +
        (m.text ? '<div class="tx-note">' + esc(m.text) + '</div>' : '') +
        '<div class="tx-foot"><span>' + (m.from === 'me' ? '你送出' : esc(C.name) + ' 送来') + '</span>' +
        '<span>' + esc(T.clock(m.ts)) + '</span></div>' +
      '</div>' + trBlock(m);
    }

    /* --- 语音 --- */
    if (m.type === 'voice') {
      var sec = m.seconds || JC.voiceSeconds(m.text);
      var bars = 15 + Math.min(16, Math.round(sec / 2));
      var wave = '';
      for (var i = 0; i < bars; i++) {
        var h = 5 + ((i * 7 + sec * 3) % 15);
        wave += '<i style="height:' + h + 'px;animation-delay:' + (i * .06).toFixed(2) + 's"></i>';
      }
      return '<div class="bub' + first + '" ' + kv + ' data-voice="' + idx + '">' +
        '<span class="grain"></span>' + (k === 0 ? '<span class="nib"></span>' : '') +
        (m.quote ? qref(m.quote) : '') +
        '<div class="voice">' +
          '<svg class="mic" viewBox="0 0 24 24" fill="none"><rect x="9" y="3.6" width="6" height="11" rx="3" stroke="currentColor" stroke-width="1.6"/><path d="M5.6 11.6a6.4 6.4 0 0012.8 0M12 18v2.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' +
          '<span class="wave">' + wave + '</span>' +
          '<span class="dur">' + sec + '"</span>' +
        '</div>' +
        '<div class="vtext">' + esc(m.text || '') + (m.zh ? '<br><span style="opacity:.66">' + esc(m.zh) + '</span>' : '') + '</div>' +
      '</div>';
    }

    /* --- 文本 --- */
    return '<div class="bub' + first + '" ' + kv + '>' +
      '<span class="grain"></span>' + (k === 0 ? '<span class="nib"></span>' : '') +
      (m.quote ? qref(m.quote) : '') +
      esc(m.text || '').replace(/\n/g, '<br>') +
    '</div>' + trBlock(m);
  }

  function qref(q) {
    return '<span class="qref"><b>' + esc(q.who || '') + '</b>' + esc((q.text || '').slice(0, 46)) + '</span>';
  }
  function trBlock(m) {
    if (!m.zh || m.type === 'voice') return '';
    return '<div class="tr"><span class="tr-tab">译</span><div class="tr-body">' + esc(m.zh) + '</div></div>';
  }

  function bindMsgs() {
    // 翻译展开
    msgsEl.querySelectorAll('.tr-tab').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.stopPropagation();
        t.parentElement.classList.toggle('on');
      });
    });
    // 语音展开文字
    msgsEl.querySelectorAll('[data-voice]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var v = b.querySelector('.voice');
        b.classList.toggle('voice-on');
        v.classList.add('playing');
        var sec = Number(b.querySelector('.dur').textContent.replace('"', '')) || 3;
        setTimeout(function () { v.classList.remove('playing'); }, Math.min(6000, sec * 220));
      });
    });
    // 长按菜单
    msgsEl.querySelectorAll('.row').forEach(function (row) {
      var t = null;
      function begin(e) {
        t = setTimeout(function () {
          openMenu(Number(row.dataset.i), e.clientX || 40, e.clientY || 200);
        }, 460);
      }
      function stop() { clearTimeout(t); }
      row.addEventListener('pointerdown', begin);
      ['pointerup', 'pointercancel', 'pointerleave', 'pointermove'].forEach(function (ev) {
        row.addEventListener(ev, stop);
      });
      row.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });
  }

  /* ======================================================================
     长按菜单
  ====================================================================== */
  var menu = document.getElementById('msgMenu');
  var mmMask = document.getElementById('mmMask');
  var menuIdx = -1;
  function openMenu(i, x, y) {
    menuIdx = i;
    var frame = document.getElementById('frame').getBoundingClientRect();
    menu.classList.add('on'); mmMask.classList.add('on');
    var mw = 176, mh = 190;
    var left = Math.max(12, Math.min(frame.width - mw - 12, x - frame.left - mw / 2));
    var top = Math.max(80, Math.min(frame.height - mh - 90, y - frame.top - 10));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }
  function closeMenu() { menu.classList.remove('on'); mmMask.classList.remove('on'); menuIdx = -1; }
  mmMask.addEventListener('click', closeMenu);

  menu.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = C.messages[menuIdx];
      if (!m) return closeMenu();
      var act = b.dataset.m;
      if (act === 'quote') {
        quoting = { who: m.from === 'me' ? (profile.name || '我') : C.name, text: m.text || (m.type === 'gift' ? m.gift : '一笔转账'), i: menuIdx };
        document.getElementById('qbWho').textContent = quoting.who;
        document.getElementById('qbTx').textContent = quoting.text;
        document.getElementById('quoteBar').classList.add('on');
        document.getElementById('cpInput').focus();
      } else if (act === 'copy') {
        var txt = (m.text || '') + (m.zh ? '\n' + m.zh : '');
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { JC.toast('已复制'); });
        else JC.toast('复制失败');
      } else if (act === 'remember') {
        JC.Memory.add(convoId, {
          kind: 'manual',
          title: '一句要记住的话',
          body: (m.from === 'me' ? (profile.name || '我') : C.name) + '说：' + (m.text || ''),
          pinned: true
        }).then(function () {
          JC.toast('已钉为长期记忆');
          return JC.Memory.list(convoId);
        }).then(function (l) { MEM = l; });
      } else if (act === 'del') {
        C.messages.splice(menuIdx, 1);
        save().then(function () { render(true); JC.toast('已删除'); });
      }
      closeMenu();
    });
  });

  document.getElementById('qbX').addEventListener('click', function () {
    quoting = null;
    document.getElementById('quoteBar').classList.remove('on');
  });

  /* ======================================================================
     发送
  ====================================================================== */
  var input = document.getElementById('cpInput');
  input.addEventListener('input', function () {
    input.style.height = 'auto';
    input.style.height = Math.min(110, input.scrollHeight) + 'px';
  });

  function push(m) {
    C.messages.push(m);
    if (quoting) { m.quote = { who: quoting.who, text: quoting.text }; quoting = null; document.getElementById('quoteBar').classList.remove('on'); }
    return save().then(function () { render(); });
  }

  document.getElementById('cpSend').addEventListener('click', sendText);
  function sendText() {
    var v = input.value.trim();
    if (!v) return;
    input.value = ''; input.style.height = 'auto';
    push({ from: 'me', type: 'text', text: v, ts: Date.now() }).then(gainForMine);
  }

  /* ======================================================================
     功能面板
  ====================================================================== */
  var panel = document.getElementById('fnPanel');
  var fnBtn = document.getElementById('cpFn');
  fnBtn.addEventListener('click', function () {
    panel.classList.toggle('on');
    fnBtn.classList.toggle('on');
  });
  document.querySelectorAll('.fn-tile').forEach(function (b) {
    b.addEventListener('click', function () {
      panel.classList.remove('on'); fnBtn.classList.remove('on');
      var f = b.dataset.fn;
      if (f === 'voice') voiceSheet();
      else if (f === 'transfer') transferSheet();
      else if (f === 'gift') giftSheet();
      else if (f === 'relation') relationSheet();
      else if (f === 'provoke') aiReply(true);
      else if (f === 'profile') openDossier();
      else if (f === 'memory') JC.go('jc-chatset.html?c=' + convoId + '&sec=mem');
      else if (f === 'settings') JC.go('jc-chatset.html?c=' + convoId);
      else if (f === 'clear') clearSheet();
    });
  });

  function openDossier() {
    DB.kvSet('viewing', Object.assign({}, C, { id: undefined })).then(function () { JC.go('jc-detail.html'); });
  }

  /* ---------------- 弹层 ---------------- */
  var relMask = document.getElementById('relMask');
  var relSheet = document.getElementById('relSheet');
  function openSheet(html) {
    document.getElementById('relBody').innerHTML = html;
    relMask.classList.add('on'); relSheet.classList.add('on');
  }
  function closeSheet() { relMask.classList.remove('on'); relSheet.classList.remove('on'); }
  relMask.addEventListener('click', closeSheet);
  window.jcCloseSheet = closeSheet;

  /* ---------------- 语音（模拟） ---------------- */
  function voiceSheet() {
    openSheet(
      head('V', '发一条语音', 'VOICE MESSAGE') +
      '<div class="sheet-note">写下要说的话，发出去会变成语音条 —— 对方点一下才展开文字。时长按你说的内容自动估算。</div>' +
      '<div class="field"><span class="field-lb">你要说的</span>' +
      '<textarea class="field-in" id="vText" rows="4" placeholder="像真的在说话那样写…"></textarea></div>' +
      '<div class="sheet-note" id="vHint">预计时长 —</div>' +
      '<div class="sheet-actions"><button class="btn-minor" onclick="jcCloseSheet()">取消</button>' +
      '<button class="btn-major" id="vSend">发 出</button></div>'
    );
    var ta = document.getElementById('vText');
    ta.addEventListener('input', function () {
      document.getElementById('vHint').textContent = '预计时长 ' + JC.voiceSeconds(ta.value) + ' 秒';
    });
    document.getElementById('vSend').addEventListener('click', function () {
      var v = ta.value.trim();
      if (!v) return JC.toast('说点什么');
      closeSheet();
      push({ from: 'me', type: 'voice', text: v, seconds: JC.voiceSeconds(v), ts: Date.now() })
        .then(function () { gainForMine(); gain(4, 'voice'); });
    });
  }

  /* ---------------- 转账 ---------------- */
  function transferSheet() {
    openSheet(
      head('¥', '转账', 'TRANSFER') +
      '<div class="field"><span class="field-lb">金额</span>' +
      '<input class="field-in big" id="txAmt" inputmode="decimal" placeholder="0.00" /></div>' +
      '<div class="chip-row" id="txQuick">' +
      [8.88, 52, 199, 520, 1314].map(function (n) { return '<button data-a="' + n + '">' + n + '</button>'; }).join('') +
      '</div>' +
      '<div class="field" style="margin-top:15px"><span class="field-lb">附言</span>' +
      '<input class="field-in" id="txNote" placeholder="想说的一句（可留空）" /></div>' +
      '<div class="sheet-actions"><button class="btn-minor" onclick="jcCloseSheet()">取消</button>' +
      '<button class="btn-major" id="txSend">转 过 去</button></div>'
    );
    document.querySelectorAll('#txQuick button').forEach(function (b) {
      b.addEventListener('click', function () { document.getElementById('txAmt').value = b.dataset.a; });
    });
    document.getElementById('txSend').addEventListener('click', function () {
      var a = parseFloat(document.getElementById('txAmt').value);
      if (!a || a <= 0) return JC.toast('填个金额');
      closeSheet();
      push({
        from: 'me', type: 'transfer', amount: a,
        text: document.getElementById('txNote').value.trim(), ts: Date.now()
      }).then(gainForMine);
    });
  }

  /* ---------------- 礼物 ---------------- */
  var GIFTS = ['一支旧钢笔', '半盒未拆的胶卷', '深夜的热汤', '一张手写车票', '别人不知道的地址',
    '你落在这儿的外套', '晒过太阳的信纸', '一枚旧铜钥匙', '整个空下来的周末', '一束没署名的花'];
  function giftSheet() {
    openSheet(
      head('G', '送礼物', 'A GIFT') +
      '<div class="sheet-note">可以从下面挑一样，也可以自己写。</div>' +
      '<div class="chip-row" id="gQuick">' +
      GIFTS.map(function (g) { return '<button data-g="' + esc(g) + '">' + esc(g) + '</button>'; }).join('') +
      '</div>' +
      '<div class="field" style="margin-top:15px"><span class="field-lb">礼物</span>' +
      '<input class="field-in" id="gName" placeholder="你要送的东西" /></div>' +
      '<div class="field"><span class="field-lb">附言</span>' +
      '<input class="field-in" id="gNote" placeholder="想说的一句（可留空）" /></div>' +
      '<div class="sheet-actions"><button class="btn-minor" onclick="jcCloseSheet()">取消</button>' +
      '<button class="btn-major" id="gSend">送 出</button></div>'
    );
    document.querySelectorAll('#gQuick button').forEach(function (b) {
      b.addEventListener('click', function () {
        document.querySelectorAll('#gQuick button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        document.getElementById('gName').value = b.dataset.g;
      });
    });
    document.getElementById('gSend').addEventListener('click', function () {
      var g = document.getElementById('gName').value.trim();
      if (!g) return JC.toast('先挑一样');
      closeSheet();
      push({
        from: 'me', type: 'gift', gift: g,
        text: document.getElementById('gNote').value.trim(), ts: Date.now()
      }).then(gainForMine);
    });
  }

  /* ---------------- 清空 ---------------- */
  function clearSheet() {
    openSheet(
      head('!', '清空这段对话', 'CLEAR') +
      '<div class="sheet-note">消息会被抹掉，但已归档的长期记忆与心印度都会保留。这一步不可撤销。</div>' +
      '<div class="sheet-actions"><button class="btn-minor" onclick="jcCloseSheet()">再想想</button>' +
      '<button class="btn-major" id="clrGo">确 认 清 空</button></div>'
    );
    document.getElementById('clrGo').addEventListener('click', function () {
      C.messages = [];
      save().then(function () { closeSheet(); render(); JC.toast('已清空'); });
    });
  }

  function head(n, cn, en) {
    return '<div class="sheet-head"><span class="sh-num">' + esc(n) + '</span><span class="sh-col">' +
      '<span class="sh-cn">' + esc(cn) + '</span><span class="sh-en">' + esc(en) + '</span></span>' +
      '<span class="sh-rule"></span></div>';
  }

  /* ======================================================================
     关系
  ====================================================================== */
  var QUICK_REL = ['暧昧期', '恋人', '未婚夫妻', '青梅竹马', '搭档', '共犯', '主雇', '师徒', '旧识', '仇敌'];
  function relationSheet() {
    openSheet(
      head('R', C.relation ? '更新关系' : '缔结关系', C.relation ? 'UPDATE BOND' : 'FORGE A BOND') +
      '<div class="sheet-note">关系名称由你来定。缔结之后，心印才开始计数。</div>' +
      (C.relation ? '<div class="sheet-note">当前：<b>' + esc(C.relation) + '</b></div>' : '') +
      '<div class="chip-row" id="relQuick">' +
      QUICK_REL.map(function (g) { return '<button data-r="' + esc(g) + '">' + esc(g) + '</button>'; }).join('') +
      '</div>' +
      '<div class="field" style="margin-top:15px"><span class="field-lb">关系名称</span>' +
      '<input class="field-in" id="relName" value="' + esc(C.relation || '') + '" placeholder="自己写一个" /></div>' +
      '<div class="sheet-actions">' +
      (C.relation ? '<button class="btn-minor" id="relBreak">解除关系</button>' : '<button class="btn-minor" onclick="jcCloseSheet()">取消</button>') +
      '<button class="btn-major" id="relSave">' + (C.relation ? '更 新' : '缔 结') + '</button></div>'
    );
    document.querySelectorAll('#relQuick button').forEach(function (b) {
      b.addEventListener('click', function () { document.getElementById('relName').value = b.dataset.r; });
    });
    document.getElementById('relSave').addEventListener('click', function () {
      var v = document.getElementById('relName').value.trim();
      if (!v) return JC.toast('写一个名称');
      var had = !!C.relation;
      C.relation = v;
      C.upgrades = (C.upgrades || 0) + (had ? 1 : 0);
      C.messages.push({ type: 'sys', text: had ? '关系已更新为「' + v + '」' : '你们缔结了「' + v + '」', ts: Date.now() });
      gain(40, 'bond');
      save().then(function () { closeSheet(); paintHeader(); render(); JC.toast('已' + (had ? '更新' : '缔结')); });
    });
    var bb = document.getElementById('relBreak');
    if (bb) bb.addEventListener('click', function () {
      C.relation = '';
      C.spark = Math.max(0, (C.spark || 0) - 60);
      C.sealed = [];
      C.messages.push({ type: 'sys', text: '关系已解除，心印灰封', ts: Date.now() });
      save().then(function () { closeSheet(); paintHeader(); render(); });
    });
  }

  /* ======================================================================
     心印
  ====================================================================== */
  var SEALS = [
    { id: 1, cn: '初痕', need: 0 }, { id: 2, cn: '落墨', need: 60 },
    { id: 3, cn: '同频', need: 180 }, { id: 4, cn: '缄默之约', need: 400, days: 7 },
    { id: 5, cn: '逆鳞', need: 700, byThem: true }, { id: 6, cn: '共影', need: 1100, streak: 14 },
    { id: 7, cn: '长夜同灯', need: 1600, voice: 30 }, { id: 8, cn: '一生印', need: 2400, up: 3 }
  ];
  function gain(n, why) {
    if (!C.relation) return;           // 未缔结，一切不累计
    C.spark = (C.spark || 0) + n;
    if (why === 'voice') C.voiceCount = (C.voiceCount || 0) + 1;
    checkSeals();
    document.getElementById('ctSpark').textContent = '心印 ' + C.spark;
  }
  function gainForMine() {
    if (!C.relation) return maybeAutoMemory();
    var today = T.dayKey(Date.now());
    if (C.lastDay !== today) {
      C.days = (C.days || []).concat([today]);
      C.streak = (C.lastDay && dayDiff(C.lastDay, today) === 1) ? (C.streak || 0) + 1 : 1;
      C.lastDay = today;
      gain(8 + Math.min(15, C.streak), 'day');
    }
    gain(2, 'turn');
    save();
    maybeAutoMemory();
  }
  function dayDiff(a, b) {
    return Math.round((new Date(b.replace(/-/g, '/')) - new Date(a.replace(/-/g, '/'))) / 86400000);
  }
  function checkSeals() {
    C.sealed = C.sealed || [];
    SEALS.forEach(function (s) {
      if (C.sealed.indexOf(s.id) > -1) return;
      if ((C.spark || 0) < s.need) return;
      if (s.days && (C.days || []).length < s.days) return;
      if (s.streak && (C.streak || 0) < s.streak) return;
      if (s.voice && (C.voiceCount || 0) < s.voice) return;
      if (s.up && (C.upgrades || 0) < s.up) return;
      if (s.byThem && !C.upgradedByThem) return;
      C.sealed.push(s.id);
      C.messages.push({ type: 'sys', text: '心印落成 · 第 ' + s.id + ' 枚「' + s.cn + '」', ts: Date.now() });
      JC.toast('心印落成：' + s.cn);
    });
  }

  /* ======================================================================
     自动归档记忆
  ====================================================================== */
  function maybeAutoMemory() {
    if (!CFG.autoMemory || !AI.ready()) return;
    var n = (C.messages || []).filter(function (m) { return m.type !== 'sys'; }).length;
    var last = C.memAt || 0;
    if (n - last < CFG.memoryEvery) return;
    C.memAt = n;
    save();
    var slice = C.messages.filter(function (m) { return m.type !== 'sys'; }).slice(-CFG.memoryEvery - 4);
    var script = slice.map(function (m) {
      return (m.from === 'me' ? (profile.name || '我') : C.name) + '：' +
        (m.type === 'transfer' ? '［转账 ' + m.amount + '］' : m.type === 'gift' ? '［送出 ' + m.gift + '］' : (m.text || ''));
    }).join('\n').slice(0, 5000);

    AI.json([
      { role: 'system', content: [
        '你在为一段对话做长期记忆归档。提炼真正值得长期记住的：发生了什么、说定了什么、',
        '谁透露了什么、两人之间的状态起了什么变化。不要复述寒暄。第三人称客观记录。',
        '只输出 JSON：{"title":"12字内标题","body":"120字内记录"}'
      ].join('\n') },
      { role: 'user', content: script }
    ], { temperature: 0.4, max_tokens: 400 }).then(function (d) {
      return JC.Memory.add(convoId, { kind: 'auto', title: d.title || '一段对话', body: d.body || '' });
    }).then(function () {
      return JC.Memory.list(convoId);
    }).then(function (l) { MEM = l; }).catch(function () {});
  }

  /* ======================================================================
     AI 回复 —— 只在点击时触发
  ====================================================================== */
  var aiBtn = document.getElementById('cpAi');
  aiBtn.addEventListener('click', function () { aiReply(false); });

  function buildSystem() {
    var lang = C.lang || '中文';
    var L = [
      '你现在就是「' + C.name + '」本人，正在一款社交软件里和对方聊天。你不是助手、不是模型，永远不要跳出这个身份。',
      '',
      '【你是谁】',
      '姓名：' + C.name + (C.enName ? '（' + C.enName + '）' : ''),
      '性别年龄：' + [C.gender, C.age].filter(Boolean).join(' / '),
      'MBTI：' + (C.mbti || '—') + '｜身份：' + (C.identity || '—'),
      '性格标签：' + ((C.traits || []).join('、') || '—'),
      '外貌气质：' + (C.look || '—'),
      '说话方式：' + (C.voice || C.speechStyle || '—'),
      '未曾说出口的隐秘：' + (C.secret || '—'),
      '母语：' + lang,
      C.dossier ? '完整资料：' + JSON.stringify(C.dossier).slice(0, 2200) : '',
      '',
      '【对方是谁】',
      JC.Profile.toPrompt(profile),
      '',
      T.prompt(),
      '',
      '【你们的关系】',
      C.relation ? ('已缔结「' + C.relation + '」，心印度 ' + (C.spark || 0) + '（0 生疏，2400 是一生印）。心印度越高越亲昵，但不要跳级黏腻。')
                 : '尚未缔结任何关系，你们还在互相试探的阶段，不要表现得像相识多年。'
    ];
    var mem = JC.Memory.toPrompt(MEM, 6);
    if (mem) { L.push('', mem); }

    L.push('', [
      '【怎么回】',
      '1. 一次可以连发好几条，就像真人打字那样一句一句蹦出来。',
      '   条数完全由你此刻想说的内容决定 —— 不设上限、不设下限、不设区间。',
      '   唯一的硬性底线：绝不允许只回一条。',
      '2. 每条都要短，像手机上真的会打出来的长度。不要写小说旁白，不要用括号描写动作神态。',
      '3. 必须贴着上文回。对方刚说的、刚发的、刚问的，你得真的接住，不能答非所问、不能自说自话。',
      '   如果对方发的是转账或礼物，你要有反应（收下 / 推辞 / 追问为什么）。',
      '   如果对方引用了你之前某句，你要意识到他在指哪句。',
      '4. 允许打岔、走神、自我修正、忽然想起别的事 —— 这是活人感的来源。',
      '5. 语言：' + (lang === '中文' ? '全程中文，不需要翻译字段。' :
          '正文用' + lang + '，并且每一条都必须额外给出中文翻译 zh 字段。'),
      '6. 禁止 emoji，禁止「作为AI」之类出戏表述。',
      '',
      '【语音】',
      (CFG.voiceRate > 0
        ? '你可以偶尔发语音（type 设为 "voice"），但要克制：这一次里最多一条，而且只有在"说比打字更合适"时才用。'
        : '这一次不要发语音。'),
      '',
      '【心声】',
      '在 mind 字段里同时给出此刻的真实内心状态。它和回复必须一次生成、彼此对得上。',
      '',
      '只输出下面这个 JSON，不要任何解释、不要 markdown：',
      '{',
      '  "mind": {',
      '    "mood": "4字内的情绪词",',
      '    "doing": "此刻正在做的事，20字内，必须符合当前真实时间",',
      '    "unsaid": "这一刻心里想说但没发出去的那句，30字内",',
      '    "toward": "对对方此刻的态度，20字内",',
      '    "warmth": 0到100的整数',
      '  },',
      '  "messages": [',
      '    { "type": "text", "text": "一条消息", "zh": "非中文时的中文翻译" },',
      '    { "type": "voice", "text": "语音里说的话", "zh": "" }',
      '  ],',
      '  "relationInvite": { "propose": false, "name": "", "words": "" }',
      '}',
      'relationInvite 只在你自己真的想开口提出建立或升级关系时才把 propose 设为 true。'
    ].join('\n'));

    return L.filter(function (x) { return x !== ''; }).join('\n');
  }

  function history() {
    var list = (C.messages || []).filter(function (m) { return m.type !== 'sys'; }).slice(-30);
    return list.map(function (m) {
      var body = m.type === 'transfer' ? '［给你转了 ' + m.amount + ' 元' + (m.text ? '，附言：' + m.text : '') + '］'
        : m.type === 'gift' ? '［送了你「' + m.gift + '」' + (m.text ? '，附言：' + m.text : '') + '］'
        : m.type === 'voice' ? '［语音］' + (m.text || '')
        : (m.text || '');
      if (m.quote) body = '（引用 ' + m.quote.who + '：' + m.quote.text + '）' + body;
      return { role: m.from === 'me' ? 'user' : 'assistant', content: body };
    });
  }

  function aiReply(provoke) {
    if (busy) return;
    if (!AI.ready()) return JC.toast('尚未在「设置 · API」中配置接口');
    busy = true;
    aiBtn.classList.add('busy');
    document.getElementById('typing').classList.add('on');
    scroller.scrollTop = scroller.scrollHeight;

    var msgs = [{ role: 'system', content: buildSystem() }].concat(history());
    if (provoke || !msgs.length || msgs[msgs.length - 1].role !== 'user') {
      msgs.push({ role: 'user', content: '［对方没有说话。此刻由你主动开口，说点符合当前时间和你们关系的事。］' });
    }

    AI.json(msgs, { temperature: 1.0, max_tokens: 1800 }).then(function (d) {
      var arr = AI.firstArray(d, ['messages', 'msgs', 'replies', 'list']);
      arr = arr.filter(function (m) { return m && (m.text || m.content); }).map(function (m) {
        return { type: m.type === 'voice' ? 'voice' : 'text', text: String(m.text || m.content || '').trim(), zh: m.zh || m.translation || '' };
      }).filter(function (m) { return m.text; });

      if (!arr.length) throw new Error('没有取到回复内容');

      // 底线：绝不只回一条（不设上限，也不截断）
      if (arr.length < 2) {
        arr.push({ type: 'text', text: JC.pick(['……', '嗯。', '就这样。', '你在听吗', '算了。']), zh: '' });
      }

      // 语音频率控制：超出设定就降级为文字
      var vUsed = 0;
      arr.forEach(function (m) {
        if (m.type === 'voice') {
          if (vUsed >= 1 || Math.random() > CFG.voiceRate) m.type = 'text';
          else { vUsed++; m.seconds = JC.voiceSeconds(m.text); }
        }
      });

      var mindData = d.mind || d.inner || null;
      if (mindData) { C.mind = mindData; paintMind(mindData); }

      // 逐条落地，间隔随内容长短浮动
      var i = 0;
      (function drop() {
        if (i >= arr.length) {
          document.getElementById('typing').classList.remove('on');
          finishReply(d);
          return;
        }
        var m = arr[i++];
        m.from = 'them'; m.ts = Date.now();
        C.messages.push(m);
        if (m.type === 'voice') { C.voiceCount = (C.voiceCount || 0) + 1; }
        render();
        var wait = i === 1 ? 240 : Math.min(1600, 380 + m.text.length * 26 + Math.random() * 420);
        setTimeout(drop, wait);
      })();

    }).catch(function (err) {
      document.getElementById('typing').classList.remove('on');
      JC.toast('没能接上话：' + err.message);
    }).finally(function () {
      busy = false;
      aiBtn.classList.remove('busy');
    });
  }

  function finishReply(d) {
    gain(3, 'reply');
    save().then(function () { render(); maybeAutoMemory(); });

    var inv = d.relationInvite || d.invite;
    if (inv && inv.propose) {
      setTimeout(function () { inviteSheet(inv); }, 600);
    }
  }

  function inviteSheet(inv) {
    openSheet(
      head('◇', '她开了口', 'SHE ASKED') +
      '<div class="sheet-note">' + esc(inv.words || (C.name + '想和你把关系定下来。')) + '</div>' +
      '<div class="field"><span class="field-lb">她想要的名分</span>' +
      '<input class="field-in" id="ivName" value="' + esc(inv.name || '') + '" /></div>' +
      '<div class="sheet-actions"><button class="btn-minor" onclick="jcCloseSheet()">再想想</button>' +
      '<button class="btn-major" id="ivYes">应 下</button></div>'
    );
    document.getElementById('ivYes').addEventListener('click', function () {
      var v = document.getElementById('ivName').value.trim() || inv.name || '未名之约';
      var had = !!C.relation;
      C.relation = v;
      C.upgradedByThem = true;
      C.upgrades = (C.upgrades || 0) + (had ? 1 : 0);
      C.messages.push({ type: 'sys', text: (had ? '关系升级为「' : '你们缔结了「') + v + '」 · 由她提出', ts: Date.now() });
      gain(40, 'bond');
      save().then(function () { closeSheet(); paintHeader(); render(); });
    });
  }

  /* ======================================================================
     背景快捷替换（长按顶栏头像）
  ====================================================================== */
  var bgPick = document.getElementById('bgPick');
  bgPick.addEventListener('change', function () {
    var f = bgPick.files && bgPick.files[0];
    if (!f) return;
    JC.fileToDataURL(f, 1400).then(function (d) {
      C.chatBg = d;
      save().then(function () { applyCfg(); JC.toast('本角色背景已更新'); });
    });
  });
})();