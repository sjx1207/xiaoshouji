/* ==========================================================================
   角初笺 · jc-detail.js — 角色全卷 / 通讯码签发 / 进入聊天
   资料字段参照角色书结构，但「与用户的关系」一类字段一律不生成。
========================================================================== */
(function () {
  'use strict';
  var esc = JC.esc, AI = JC.AI, DB = JC.DB;
  JC.bootChrome();

  var C = null;

  document.getElementById('backBtn').addEventListener('click', function () { JC.back('juechu.html'); });

  DB.kvGet('viewing', null).then(function (c) {
    if (!c) { JC.toast('没有可展示的角色'); setTimeout(function () { JC.back('juechu.html'); }, 900); return; }
    C = c;
    paint();
    if (C.dossier) renderDossier(C.dossier, true);
  });

  function paint() {
    var frame = document.getElementById('heroFrame');
    if (C.cardBg) {
      var im = document.createElement('img'); im.src = C.cardBg;
      frame.insertBefore(im, frame.firstChild);
      frame.classList.add('has-photo');
    }
    var av = document.getElementById('dtAv');
    if (C.avatar) {
      var a = document.createElement('img'); a.src = C.avatar;
      av.insertBefore(a, av.firstChild);
      document.getElementById('dtAvGlyph').style.display = 'none';
    } else {
      document.getElementById('dtAvGlyph').textContent = (C.name || '笺').charAt(0);
    }
    document.getElementById('dtName').textContent = C.name || '—';
    document.getElementById('dtEn').textContent = (C.enName || '').toUpperCase();
    document.getElementById('dtTag').textContent = C.tagline || '';
    document.getElementById('dtChips').innerHTML = [
      C.gender, (C.age ? C.age + ' 岁' : ''), C.mbti, C.identity, C.lang, C.genre, C.era
    ].filter(Boolean).map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('');
  }

  /* ======================================================================
     展卷交互 —— 拖动蜡印横向拉满，触发全卷生成
  ====================================================================== */
  (function initUnfurl() {
    var rail = document.querySelector('.uf-rail');
    var knob = document.getElementById('ufKnob');
    var fill = document.getElementById('ufFill');
    var label = document.getElementById('ufLabel');
    var dragging = false, startX = 0, x = 0, max = 0, busy = false;

    function layout() { max = rail.clientWidth - knob.offsetWidth - 16; }
    layout();
    window.addEventListener('resize', layout);

    knob.addEventListener('pointerdown', function (e) {
      if (busy) return;
      dragging = true; startX = e.clientX - x;
      knob.setPointerCapture(e.pointerId);
    });
    knob.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      layout();
      x = Math.max(-max, Math.min(0, e.clientX - startX));
      knob.style.transform = 'translateX(' + x + 'px)';
      var p = max ? Math.abs(x) / max : 0;
      fill.style.width = (p * 100) + '%';
      label.textContent = p > .96 ? '松手，卷轴尽展' : '继续拉…… ' + Math.round(p * 100) + '%';
    });
    function up() {
      if (!dragging) return;
      dragging = false;
      var p = max ? Math.abs(x) / max : 0;
      if (p > .96) { generate(); }
      else {
        x = 0; knob.style.transform = 'translateX(0)';
        fill.style.width = '0'; label.textContent = '拖动蜡印，展开此人全卷';
      }
    }
    knob.addEventListener('pointerup', up);
    knob.addEventListener('pointercancel', up);

    function generate() {
      if (!AI.ready()) { JC.toast('请先在「设置 · API」中配置接口'); return; }
      busy = true; rail.classList.add('busy');
      label.innerHTML = '正在誊写全卷……';

      JC.Profile.get().then(function (prof) {
        var sys = [
          '你是「角初笺」的角色档案誊写员。现在要为下面这位已存在的虚构角色，补齐一份最详尽的角色书式档案。',
          JC.ROMANCE_RULE,
          '',
          '【绝对禁止】不得生成任何「与用户的关系」相关内容：不写关系定位、不写对用户的称呼、不写共同过往、',
          '不写好感度，也不得在任何字段里出现「你」指代用户。此人与用户此刻尚未相识，这部分会由后续系统另行处理。',
          '',
          '【已知信息，必须保持一致，不得改动】',
          JSON.stringify({
            name: C.name, enName: C.enName, gender: C.gender, age: C.age, mbti: C.mbti,
            lang: C.lang, identity: C.identity, genre: C.genre, era: C.era,
            tagline: C.tagline, traits: C.traits, look: C.look, voice: C.voice, secret: C.secret
          }),
          '',
          '（以下用户资料仅用于把握整体气质与题材匹配，绝不可写进角色档案）\n' + JC.Profile.toPrompt(prof),
          '',
          '只输出 JSON，字段如下，全部必填，中文书写（除 enName 与角色母语台词外）：',
          '{',
          '"role":"一句话身份定位，15字内",',
          '"desc":"人物总述，120-180字，文学化",',
          '"species":"种族或身份属性，如 人类 / 半妖 / 吸血族",',
          '"birthday":"生日，格式 M月D日",',
          '"appearance":"外貌细写，120字左右，含身高体态、五官、气场",',
          '"outfit":"惯常穿着与随身物，60-90字",',
          '"likes":["喜好","4-6项"],',
          '"dislikes":["厌恶","3-5项"],',
          '"fears":"最深的恐惧，40字内",',
          '"habits":["小动作或生活习惯","3-5项"],',
          '"speechStyle":"说话方式与语气特征，60-90字",',
          '"catchphrases":["口头禅","2-4句"],',
          '"backstory":"生平与过往，200-280字，须有转折与阴影",',
          '"scenario":"此人当下所处的情境与困境，100-140字",',
          '"worldSetting":"其所在世界观的关键设定，100-140字",',
          '"social":"社交圈层与重要他人（不含用户），80-120字",',
          '"strength":"擅长之事，50字内",',
          '"weakness":"致命软肋，50字内",',
          '"dream":"渴望与执念，50字内",',
          '"firstMes":"此人主动发来的第一条消息，用其母语书写，40-90字，符合其语气",',
          '"firstMesZh":"若母语非中文则给出中文翻译，否则留空字符串",',
          '"dialogExamples":[{"scene":"场景名","line":"该角色的一段代表性台词"}],',
          '"neverList":["此人绝不会做的事","3-4项"],',
          '"boundaries":"其言行边界与禁区，60字内",',
          '"pov":"第一人称",',
          '"actionMark":"星号",',
          '"replyLength":"适中"',
          '}'
        ].join('\n');

        sys += '\n\n' + JC.Time.prompt();
        return AI.json([
          { role: 'system', content: sys },
          { role: 'user', content: '誊写「' + C.name + '」的完整档案。' }
        ], { temperature: .92, max_tokens: 3000 });
      }).then(function (d) {
        C.dossier = d;
        C.firstMes = d.firstMes;
        C.firstMesZh = d.firstMesZh;
        return DB.kvSet('viewing', C).then(function () { return persist(); });
      }).then(function () {
        rail.classList.add('done');
        label.textContent = '全卷已展';
        renderDossier(C.dossier);
        JC.toast('全卷誊写完成');
      }).catch(function (e) {
        label.textContent = '誊写失败：' + e.message;
        x = 0; knob.style.transform = 'translateX(0)'; fill.style.width = '0';
        JC.toast(e.message);
      }).finally(function () { busy = false; rail.classList.remove('busy'); });
    }
  })();

  /* 若已存档，把新字段写回存档记录 */
  function persist() {
    if (!C.id) return Promise.resolve();
    return DB.get('cards', C.id).then(function (rec) {
      if (!rec) return;
      return DB.put('cards', Object.assign(rec, C));
    });
  }

  /* ======================================================================
     全卷渲染
  ====================================================================== */
  function sec(num, cn, en, inner) {
    return '<section class="dsec"><div class="ds-head"><span class="ds-num">' + num + '</span>' +
      '<span class="ds-cn">' + cn + '</span><span class="ds-en">' + en + '</span><span class="ds-rule"></span></div>' +
      inner + '</section>';
  }
  function pills(arr) {
    return '<div class="ds-pills">' + (arr || []).map(function (t) { return '<i>' + esc(t) + '</i>'; }).join('') + '</div>';
  }
  function kv(rows) {
    return rows.filter(function (r) { return r[1]; }).map(function (r) {
      return '<div class="ds-kv"><span class="ds-k">' + r[0] + '</span><span class="ds-v">' + esc(r[1]) + '</span></div>';
    }).join('');
  }

  function renderDossier(d, silent) {
    if (!d) return;
    if (silent) {
      document.querySelector('.uf-rail').classList.add('done');
      document.getElementById('ufLabel').textContent = '全卷已展';
      document.getElementById('ufFill').style.width = '100%';
    }
    var html = '';
    html += sec('01', '总述', 'OVERVIEW',
      '<div class="ds-body">' + esc(d.desc || '') + '</div>' +
      (d.role ? '<div class="ds-quote">' + esc(d.role) + '</div>' : ''));

    html += sec('02', '基本', 'PROFILE', kv([
      ['姓名', C.name], ['原名', C.enName], ['性别', C.gender], ['年龄', C.age],
      ['生日', d.birthday], ['种族', d.species], ['MBTI', C.mbti],
      ['身份', C.identity], ['语言', C.lang], ['时代', C.era], ['题材', C.genre]
    ]));

    html += sec('03', '形貌', 'APPEARANCE',
      '<div class="ds-body">' + esc(d.appearance || '') + '</div>' +
      (d.outfit ? '<div class="ds-quote">' + esc(d.outfit) + '</div>' : ''));

    html += sec('04', '性情', 'TEMPERAMENT',
      pills(C.traits) +
      '<div class="ds-body" style="margin-top:11px;">' + esc(d.strength ? '所长：' + d.strength : '') +
      (d.weakness ? '\n软肋：' + d.weakness : '') + (d.dream ? '\n执念：' + d.dream : '') +
      (d.fears ? '\n畏惧：' + d.fears : '') + '</div>');

    html += sec('05', '好恶', 'LIKES & DISLIKES',
      '<div class="ds-kv"><span class="ds-k">喜好</span><span class="ds-v">' + pills(d.likes) + '</span></div>' +
      '<div class="ds-kv"><span class="ds-k">厌恶</span><span class="ds-v">' + pills(d.dislikes) + '</span></div>' +
      (d.habits ? '<div class="ds-kv"><span class="ds-k">习惯</span><span class="ds-v">' + pills(d.habits) + '</span></div>' : ''));

    html += sec('06', '言辞', 'VOICE',
      '<div class="ds-body">' + esc(d.speechStyle || '') + '</div>' +
      (d.catchphrases && d.catchphrases.length
        ? '<div class="ds-quote">' + d.catchphrases.map(function (c) { return '「' + esc(c) + '」'; }).join('　') + '</div>' : ''));

    html += sec('07', '过往', 'BACKSTORY', '<div class="ds-body">' + esc(d.backstory || '') + '</div>');
    html += sec('08', '当下', 'SCENARIO', '<div class="ds-body">' + esc(d.scenario || '') + '</div>');
    html += sec('09', '世界', 'WORLD',
      '<div class="ds-body">' + esc(d.worldSetting || '') + '</div>' +
      (d.social ? '<div class="ds-quote">' + esc(d.social) + '</div>' : ''));

    if (C.secret) html += sec('10', '隐秘', 'THE SECRET', '<div class="ds-quote">' + esc(C.secret) + '</div>');

    if (d.dialogExamples && d.dialogExamples.length) {
      html += sec('11', '对白例', 'DIALOGUE',
        '<div class="ds-dialog">' + d.dialogExamples.map(function (x) {
          return '<div class="ds-d"><b>' + esc(x.scene || '') + '</b>' + esc(x.line || '') + '</div>';
        }).join('') + '</div>');
    }

    html += sec('12', '边界', 'BOUNDARIES',
      pills(d.neverList) + (d.boundaries ? '<div class="ds-body" style="margin-top:11px;">' + esc(d.boundaries) + '</div>' : ''));

    if (d.firstMes) {
      html += sec('13', '开场', 'FIRST MESSAGE',
        '<div class="ds-quote">' + esc(d.firstMes) + (d.firstMesZh ? '\n\n' + esc(d.firstMesZh) : '') + '</div>');
    }

    document.getElementById('dossier').innerHTML = html;
  }

  /* ======================================================================
     收入存档
  ====================================================================== */
  document.getElementById('saveBtn').addEventListener('click', function () {
    if (C.id) { JC.toast('此人已在存档中'); return; }
    var rec = Object.assign({}, C); delete rec.id;
    DB.put('cards', rec).then(function (id) {
      C.id = id;
      return DB.kvSet('viewing', C);
    }).then(function () { JC.toast('已收入存档'); });
  });

  /* ======================================================================
     通讯码：签发 Luna ID + 验证码，供 Chat 加好友使用
  ====================================================================== */
  var codeMask = document.getElementById('codeMask');
  var codeSheet = document.getElementById('codeSheet');
  codeMask.addEventListener('click', closeCode);
  function closeCode() { codeMask.classList.remove('open'); codeSheet.classList.remove('open'); }

  function makeId(name) {
    var seed = String(name || '').split('').reduce(function (a, c) { return (a * 31 + c.charCodeAt(0)) >>> 0; }, 7);
    var A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    function chunk(n, s) {
      var out = '';
      for (var i = 0; i < n; i++) { s = (s * 1103515245 + 12345) >>> 0; out += A[s % A.length]; }
      return out;
    }
    return 'LUNA-' + chunk(4, seed) + '-' + chunk(4, seed ^ Date.now());
  }
  function makeCode() {
    var s = '';
    for (var i = 0; i < 6; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  document.getElementById('linkPlate').addEventListener('click', function () {
    if (!C) return;
    if (!C.lunaId) { C.lunaId = makeId(C.name); C.lunaCode = makeCode(); }
    var payload = {
      lunaId: C.lunaId, lunaCode: C.lunaCode,
      name: C.name, enName: C.enName, avatar: C.avatar, cardBg: C.cardBg,
      identity: C.identity, tagline: C.tagline, lang: C.lang, mbti: C.mbti,
      gender: C.gender, age: C.age, traits: C.traits,
      issuedAt: Date.now()
    };

    Promise.all([DB.kvSet('viewing', C), persist(), pushHandoff(payload)]).then(function () {
      codeSheet.querySelector('#codeBody').innerHTML =
        '<div class="sheet-head" style="display:flex;align-items:flex-end;gap:10px;margin-bottom:16px;">' +
          '<span class="cc-lb">CODE</span>' +
          '<span style="flex:1;height:1px;background:linear-gradient(90deg,var(--hair),transparent);margin-bottom:6px;"></span>' +
        '</div>' +
        '<div class="code-card">' +
          '<div class="cc-lb">EXCLUSIVE&nbsp;LUNA&nbsp;ID</div>' +
          '<div class="cc-id">' + esc(C.lunaId) + '</div>' +
          '<div class="cc-code">' + esc(C.lunaCode) + '</div>' +
          '<div class="cc-note">这串编号与验证码专属于「' + esc(C.name) + '」。<br>' +
          '带着它到 Chat 的「加好友」页，即可把这位角色接入你的聊天列表。</div>' +
        '</div>' +
        '<div class="code-row">' +
          '<button class="code-btn light" id="copyCode">复制编号</button>' +
          '<button class="code-btn dark" id="gotoBind">前 往 绑 定</button>' +
        '</div>';
      codeMask.classList.add('open');
      codeSheet.classList.add('open');

      document.getElementById('copyCode').addEventListener('click', function () {
        var t = C.lunaId + ' / ' + C.lunaCode;
        if (navigator.clipboard) navigator.clipboard.writeText(t);
        JC.toast('已复制：' + t);
      });
      document.getElementById('gotoBind').addEventListener('click', function () {
        JC.go('jc-friend-add.html?id=' + encodeURIComponent(C.lunaId));
      });
    });
  });

  /* 把签发记录写进 localStorage，供 chat 端的加好友页读取（跨页面、跨库） */
  function pushHandoff(p) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem('jc_luna_registry') || '[]'); } catch (e) {}
    list = list.filter(function (x) { return x.lunaId !== p.lunaId; });
    list.unshift(p);
    localStorage.setItem('jc_luna_registry', JSON.stringify(list.slice(0, 60)));
    return Promise.resolve();
  }

  /* ======================================================================
     进入聊天
  ====================================================================== */
  document.getElementById('talkPlate').addEventListener('click', function () {
    if (!C) return;
    DB.all('convos').then(function (list) {
      var found = list.filter(function (x) { return x.name === C.name; })[0];
      if (found) return found.id;
      return DB.put('convos', {
        name: C.name, enName: C.enName, avatar: C.avatar, cardBg: C.cardBg,
        gender: C.gender, age: C.age, mbti: C.mbti, lang: C.lang || '中文',
        identity: C.identity, tagline: C.tagline, traits: C.traits,
        look: C.look, secret: C.secret, dossier: C.dossier || null,
        firstMes: C.firstMes || C.tagline,
        messages: C.firstMes ? [{
          from: 'them', type: 'text', text: C.firstMes,
          zh: (C.lang && C.lang !== '中文') ? (C.firstMesZh || '') : '',
          ts: Date.now()
        }] : [],
        unread: 0, ts: Date.now(),
        relation: '', spark: 0, activeDays: 0, streak: 0,
        voiceCount: 0, upgrades: 0, upgradedByThem: false, sealed: []
      });
    }).then(function (id) { JC.go('jc-chat.html?c=' + id); });
  });
})();