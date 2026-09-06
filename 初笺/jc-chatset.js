/* ==========================================================================
   角初笺 · jc-chatset.js — 聊天设置
   页面内不使用任何 alert / confirm / prompt / <select> / <input type=range>
========================================================================== */
(function () {
  'use strict';
  var esc = JC.esc, DB = JC.DB, AI = JC.AI;
  JC.bootChrome();

  var bindId = Number(new URLSearchParams(location.search).get('c')) || 0;
  function backToChat() {
    if (bindId) JC.go('jc-chat.html?c=' + bindId);
    else JC.back('juechu.html');
  }
  document.getElementById('backBtn').addEventListener('click', backToChat);
  document.getElementById('bdBack').addEventListener('click', backToChat);

  var CFG = null;
  var convos = [], curConvo = null;

  /* ---------------- 弹层 ---------------- */
  var sheetMask = document.getElementById('sheetMask');
  var sheet = document.getElementById('sheet');
  function openSheet(html) {
    document.getElementById('sheetBody').innerHTML = html;
    sheetMask.classList.add('on'); sheet.classList.add('on');
  }
  function closeSheet() { sheetMask.classList.remove('on'); sheet.classList.remove('on'); }
  sheetMask.addEventListener('click', closeSheet);
  window.jcCloseSheet = closeSheet;

  /* ---------------- 分栏 ---------------- */
  var navInk = document.getElementById('csNavInk');
  document.querySelectorAll('.cs-nav-i').forEach(function (b, i) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.cs-nav-i').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      navInk.style.transform = 'translateX(' + (i * 100) + '%)';
      document.querySelectorAll('.cs-sec').forEach(function (s) {
        s.classList.toggle('on', s.dataset.sec === b.dataset.sec);
      });
      document.querySelector('.cs-scroll').scrollTop = 0;
    });
  });

  /* ---------------- 保存 ---------------- */
  var saveT = null;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () { JC.ChatCfg.set(CFG); }, 180);
  }

  /* ---------------- 分段器 ---------------- */
  function bindSeg(el) {
    var key = el.dataset.key;
    var items = Array.prototype.slice.call(el.querySelectorAll('.seg-i'));
    var ink = el.querySelector('.seg-ink');
    function paint() {
      var i = Math.max(0, items.map(function (x) { return x.dataset.v; }).indexOf(CFG[key]));
      items.forEach(function (x, j) { x.classList.toggle('on', j === i); });
      ink.style.width = 'calc((100% - 8px)/' + items.length + ')';
      ink.style.transform = 'translateX(' + (i * 100) + '%)';
    }
    items.forEach(function (x) {
      x.addEventListener('click', function () { CFG[key] = x.dataset.v; paint(); save(); applyPreview(); });
    });
    el._paint = paint;
  }

  /* ---------------- 开关 ---------------- */
  function bindSwitch(el) {
    var key = el.dataset.key;
    function paint() { el.classList.toggle('on', !!CFG[key]); }
    el.addEventListener('click', function () { CFG[key] = !CFG[key]; paint(); save(); });
    el._paint = paint;
    return paint;
  }

  /* ---------------- 拨盘滑杆 ---------------- */
  function bindDial(id, key, min, max, step, onPaint) {
    var el = document.getElementById(id);
    var track = el.querySelector('.dl-track');
    var fill = el.querySelector('.dl-fill');
    var knob = el.querySelector('.dl-knob');
    function paint() {
      var v = Number(CFG[key]);
      var p = Math.max(0, Math.min(1, (v - min) / (max - min)));
      fill.style.width = (p * 100) + '%';
      var w = track.clientWidth || (el.clientWidth - 8);
      knob.style.left = (4 + p * w) + 'px';
      knob.style.marginLeft = '-13px';
      if (onPaint) onPaint(v);
    }
    function setFromX(clientX) {
      var r = track.getBoundingClientRect();
      var p = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
      var v = min + p * (max - min);
      v = Math.round(v / step) * step;
      CFG[key] = Number(v.toFixed(2));
      paint(); save(); applyPreview();
    }
    var on = false;
    el.addEventListener('pointerdown', function (e) {
      on = true; el.classList.add('dragging');
      el.setPointerCapture(e.pointerId); setFromX(e.clientX);
    });
    el.addEventListener('pointermove', function (e) { if (on) setFromX(e.clientX); });
    ['pointerup', 'pointercancel'].forEach(function (ev) {
      el.addEventListener(ev, function () { on = false; el.classList.remove('dragging'); });
    });
    el._paint = paint;
  }

  /* ---------------- 背景预览 ---------------- */
  function applyPreview() {
    var img = document.getElementById('bgpImg');
    var tag = document.getElementById('bgpTag');
    var url = (CFG.bgScope === 'perChar' && curConvo) ? (curConvo.chatBg || '') : (CFG.bg || '');
    if (url) {
      img.style.backgroundImage = 'url(' + url + ')';
      img.style.backgroundSize = CFG.bgFit === 'tile' ? '110px' : CFG.bgFit;
      img.style.backgroundRepeat = CFG.bgFit === 'tile' ? 'repeat' : 'no-repeat';
      tag.textContent = (CFG.bgScope === 'global' ? '全局背景' : '本角色背景') + ' · 无遮罩';
    } else {
      img.style.backgroundImage = '';
      tag.textContent = (CFG.bgScope === 'perChar' ? '本角色未设置' : '未设置') + ' · 沿用角色卡背景';
    }
    document.querySelectorAll('.bgp-b').forEach(function (b) {
      b.style.fontFamily = JC.ChatCfg.FONTS[CFG.font].css;
      b.style.fontSize = CFG.fontSize + 'px';
      b.style.opacity = String(Math.max(.5, CFG.bubbleAlpha));
    });
  }

  /* ---------------- 字体 ---------------- */
  function renderFonts() {
    var box = document.getElementById('fontList');
    box.innerHTML = Object.keys(JC.ChatCfg.FONTS).map(function (k) {
      var f = JC.ChatCfg.FONTS[k];
      return '<button class="font-i' + (CFG.font === k ? ' on' : '') + '" data-f="' + k + '">' +
        '<span class="fi-a" style="font-family:' + f.css.replace(/"/g, "'") + '">笺</span>' +
        '<span class="fi-col">' +
          '<span class="fi-cn">' + esc(f.cn) + '</span>' +
          '<span class="fi-demo" style="font-family:' + f.css.replace(/"/g, "'") + '">今夜有雨，你还醒着吗</span>' +
        '</span>' +
        '<span class="fi-mark"></span>' +
      '</button>';
    }).join('');
    box.querySelectorAll('.font-i').forEach(function (b) {
      b.addEventListener('click', function () {
        CFG.font = b.dataset.f; renderFonts(); save(); applyPreview();
      });
    });
  }

  /* ---------------- 背景来源 ---------------- */
  var filePick = document.getElementById('filePick');
  document.getElementById('bgPick').addEventListener('click', function () {
    filePick.value = ''; filePick.click();
  });
  filePick.addEventListener('change', function () {
    var f = filePick.files && filePick.files[0];
    if (!f) return;
    JC.fileToDataURL(f, 1400).then(function (d) { setBg(d); });
  });
  document.getElementById('bgClear').addEventListener('click', function () { setBg(''); });

  /* 背景落到哪里，取决于「作用范围」：全局写设置，按角色写这段对话 */
  function setBg(d) {
    if (CFG.bgScope === 'perChar' && curConvo) {
      curConvo.chatBg = d;
      DB.put('convos', curConvo).then(function () {
        applyPreview();
        JC.toast(d ? '「' + curConvo.name + '」的背景已更新' : '已清除本角色背景');
      });
    } else {
      CFG.bg = d; save(); applyPreview();
      JC.toast(d ? '全局背景已更新' : '已清除全局背景');
    }
  }
  document.getElementById('bgFromGallery').addEventListener('click', function () {
    JC.Gallery.byType('bg').then(function (list) {
      if (!list.length) return JC.toast('素材库里还没有背景图');
      openSheet(
        '<div class="sheet-head"><span class="sh-num">B</span><span class="sh-col">' +
        '<span class="sh-cn">从素材库挑一张</span><span class="sh-en">PICK&nbsp;A&nbsp;BACKDROP</span></span><span class="sh-rule"></span></div>' +
        '<div class="pickgrid">' + list.map(function (a) {
          return '<button data-pick="' + a.id + '"><img src="' + esc(a.data) + '"></button>';
        }).join('') + '</div>'
      );
      document.querySelectorAll('[data-pick]').forEach(function (b) {
        b.addEventListener('click', function () {
          var a = list.filter(function (x) { return x.id === Number(b.dataset.pick); })[0];
          if (!a) return;
          setBg(a.data); closeSheet();
        });
      });
    });
  });

  /* ======================================================================
     记忆库
  ====================================================================== */
  function renderWho() {
    var av = document.getElementById('bdAv');
    var nm = document.getElementById('bdName');
    var sub = document.getElementById('bdSub');
    var who = document.getElementById('csWho');
    if (!curConvo) {
      nm.textContent = '未绑定对话';
      sub.textContent = '从聊天页右上角进来，设置才会归到那段对话';
      document.getElementById('bdBack').style.display = 'none';
      return;
    }
    av.innerHTML = curConvo.avatar
      ? '<img src="' + esc(curConvo.avatar) + '">'
      : esc((curConvo.name || '笺').charAt(0));
    nm.textContent = curConvo.name;
    sub.textContent = (curConvo.relation ? curConvo.relation + ' · ' : '') + '这一页的设置属于这段对话';
    who.textContent = (curConvo.name || '') + ' · PREFS';
  }

  function renderMem() {
    var box = document.getElementById('memList');
    var empty = document.getElementById('memEmpty');
    if (!curConvo) { box.innerHTML = ''; empty.classList.add('on'); return; }
    JC.Memory.list(curConvo.id).then(function (list) {
      empty.classList.toggle('on', !list.length);
      box.innerHTML = list.map(function (m) {
        return '<div class="mem' + (m.pinned ? ' pinned' : '') + '" data-m="' + m.id + '">' +
          '<div class="mem-h">' +
            '<span class="mem-kind">' + (m.kind === 'manual' ? 'MANUAL' : 'AUTO') + '</span>' +
            '<span class="mem-t">' + esc(m.title || '一段记忆') + '</span>' +
            '<span class="mem-ts">' + esc(JC.timeAgo(m.ts)) + '</span>' +
          '</div>' +
          '<div class="mem-b">' + esc(m.body) + '</div>' +
          '<div class="mem-acts">' +
            '<button class="mem-a pin" data-pin="' + m.id + '">' + (m.pinned ? '已钉住' : '钉住') + '</button>' +
            '<button class="mem-a" data-del="' + m.id + '">删除</button>' +
          '</div>' +
        '</div>';
      }).join('');
      box.querySelectorAll('[data-pin]').forEach(function (b) {
        b.addEventListener('click', function () {
          JC.Memory.toggle(Number(b.dataset.pin)).then(renderMem);
        });
      });
      box.querySelectorAll('[data-del]').forEach(function (b) {
        b.addEventListener('click', function () {
          JC.Memory.del(Number(b.dataset.del)).then(function () { renderMem(); JC.toast('已删除'); });
        });
      });
    });
  }

  document.getElementById('memMake').addEventListener('click', function () {
    if (!curConvo) return JC.toast('先在上面选一位');
    if (!AI.ready()) return JC.toast('尚未配置 API');
    var btn = this;
    btn.querySelector('span').textContent = '正在提炼…';
    DB.get('convos', curConvo.id).then(function (C) {
      var msgs = (C.messages || []).filter(function (m) { return m.type !== 'sys'; }).slice(-60);
      if (!msgs.length) { JC.toast('这段还没有内容'); throw new Error('empty'); }
      var script = msgs.map(function (m) {
        return (m.from === 'me' ? '我' : C.name) + '：' + (m.text || '');
      }).join('\n').slice(0, 6000);
      return AI.json([
        { role: 'system', content: [
          '你在为一段对话做长期记忆归档。读完对话，提炼出真正值得长期记住的东西：',
          '发生了什么、说定了什么、对方透露了什么、两人之间的状态起了什么变化。',
          '不要复述寒暄，不要写文学评论，写成第三人称的客观记录。',
          '只输出 JSON：{"title":"12字内的标题","body":"120字内的记录"}'
        ].join('\n') },
        { role: 'user', content: script }
      ], { temperature: 0.5, max_tokens: 500 });
    }).then(function (d) {
      return JC.Memory.add(curConvo.id, {
        kind: 'manual', title: d.title || '一段记忆', body: d.body || ''
      });
    }).then(function () {
      JC.toast('已立此存照');
      renderMem();
    }).catch(function (e) {
      if (e.message !== 'empty') JC.toast('归档失败：' + e.message);
    }).finally(function () {
      btn.querySelector('span').textContent = '立此存照 · 手动归档一次';
    });
  });

  /* ======================================================================
     启动
  ====================================================================== */
  JC.ChatCfg.get().then(function (c) {
    CFG = c;

    document.querySelectorAll('.seg').forEach(bindSeg);
    document.querySelectorAll('.switch-row').forEach(bindSwitch);

    bindDial('fsDial', 'fontSize', 12, 19, 0.5, function (v) {
      document.getElementById('fsVal').textContent = v;
    });
    bindDial('baDial', 'bubbleAlpha', 0.4, 1, 0.02, function (v) {
      document.getElementById('baVal').textContent = Math.round(v * 100) + '%';
    });
    bindDial('vrDial', 'voiceRate', 0, 0.6, 0.02, function (v) {
      document.getElementById('vrVal').textContent = Math.round(v * 100) + '%';
    });
    bindDial('meDial', 'memoryEvery', 10, 60, 2, function (v) {
      document.getElementById('meVal').textContent = Math.round(v);
    });

    renderFonts();
    applyPreview();

    // 首帧布局完成后再画一次滑杆，避免宽度取到 0
    requestAnimationFrame(function () {
      document.querySelectorAll('.seg').forEach(function (e) { e._paint && e._paint(); });
      document.querySelectorAll('.switch-row').forEach(function (e) { e._paint && e._paint(); });
      ['fsDial', 'baDial', 'vrDial', 'meDial'].forEach(function (id) {
        var e = document.getElementById(id); e._paint && e._paint();
      });
    });

    return DB.all('convos');
  }).then(function (list) {
    convos = list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    curConvo = convos.filter(function (x) { return x.id === bindId; })[0] || convos[0] || null;
    if (curConvo) bindId = curConvo.id;
    renderWho(); renderMem(); applyPreview();
    var sec = new URLSearchParams(location.search).get('sec');
    if (sec) {
      var btn = document.querySelector('.cs-nav-i[data-sec="' + sec + '"]');
      if (btn) btn.click();
    }
  });
})();
