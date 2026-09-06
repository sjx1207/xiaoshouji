/* ==========================================================================
   角初笺 · jc-archive.js — 角色存档 ＋「心印」系统（原「火花系统」改名）
========================================================================== */
(function () {
  'use strict';
  JC.bootChrome();
  document.getElementById('backBtn').addEventListener('click', function () { JC.back('juechu.html'); });

  /* ======================================================================
     心印 · HEART SEAL —— 规则总表
     必须先与角色缔结任意关系，系统才解封；未缔结时全部灰印，且不累计。
  ====================================================================== */
  var SEALS = [
    { id: 'I',    cn: '初痕',     need: 0,    extra: '缔结任意关系的那一刻自动落印', glyph: 'ring' },
    { id: 'II',   cn: '落墨',     need: 60,   extra: '—', glyph: 'drop' },
    { id: 'III',  cn: '同频',     need: 180,  extra: '—', glyph: 'wave' },
    { id: 'IV',   cn: '缄默之约', need: 400,  extra: '累计 7 个不同日期有往来', glyph: 'lock' },
    { id: 'V',    cn: '逆鳞',     need: 700,  extra: '至少一次由角色主动提出关系升级', glyph: 'scale' },
    { id: 'VI',   cn: '共影',     need: 1100, extra: '连续 14 天不间断往来', glyph: 'twin' },
    { id: 'VII',  cn: '长夜同灯', need: 1600, extra: '累计互发语音 30 条', glyph: 'lamp' },
    { id: 'VIII', cn: '一生印',   need: 2400, extra: '关系累计升级 3 次', glyph: 'seal' }
  ];
  window.JC_SEALS = SEALS;

  var GAIN = [
    ['+2',  '每完成一个来回（你发一条、对方回一条）'],
    ['+8',  '当日第一次开口，每天仅计一次'],
    ['+n',  '连续开口第 n 天额外加 n 点，单日上限 +15'],
    ['+3',  '对方的回复里主动向你抛出问题'],
    ['+4',  '互发语音消息'],
    ['+5',  '在动态下互相评论'],
    ['+40', '缔结新关系或关系升级'],
    ['+12', '对方主动发起的一次搭话被你接住']
  ];
  var LOSE = [
    ['−12', '超过 72 小时无往来后，此后每满 24 小时扣一次'],
    ['0',   '连续 3 条只回单字或表情，该段对话不计入心印度'],
    ['−60', '解除关系；已解锁的印章保留但转为灰封状态'],
    ['封',  '未缔结关系前，一切数值不累计、印章全灰']
  ];

  function glyphSVG(kind, got) {
    var s = 'stroke="currentColor" stroke-width="1.35" fill="none"';
    var map = {
      ring:  '<circle cx="12" cy="12" r="7.4" ' + s + '/><circle cx="12" cy="12" r="3.4" ' + s + '/>',
      drop:  '<path d="M12 4.6c3 3.6 4.6 6.2 4.6 8.4a4.6 4.6 0 11-9.2 0c0-2.2 1.6-4.8 4.6-8.4z" ' + s + '/>',
      wave:  '<path d="M3.6 13.4c2-3.6 3.4-3.6 5.4 0s3.4 3.6 5.4 0 3.4-3.6 5.4 0" ' + s + '/><path d="M3.6 8.6c2-3.6 3.4-3.6 5.4 0" ' + s + ' opacity=".5"/>',
      lock:  '<rect x="5.4" y="10.4" width="13.2" height="9" rx="2.4" ' + s + '/><path d="M8.6 10.4V8a3.4 3.4 0 016.8 0v2.4" ' + s + '/>',
      scale: '<path d="M12 3.8l7.2 4.1v8.2L12 20.2 4.8 16.1V7.9L12 3.8z" ' + s + '/><path d="M12 8.4l3.4 2v3.2L12 15.6l-3.4-2v-3.2L12 8.4z" ' + s + '/>',
      twin:  '<circle cx="9.2" cy="12" r="5" ' + s + '/><circle cx="14.8" cy="12" r="5" ' + s + '/>',
      lamp:  '<path d="M12 3.6v2.2M8 8.6h8l1.4 7.4a5.4 5.4 0 01-10.8 0L8 8.6z" ' + s + '/><path d="M9.6 20.4h4.8" ' + s + '/>',
      seal:  '<circle cx="12" cy="12" r="8" ' + s + '/><path d="M8.6 12.2l2.4 2.4 4.4-4.8" ' + s + ' stroke-linecap="round"/>'
    };
    return '<svg viewBox="0 0 24 24">' + (map[kind] || map.ring) + '</svg>';
  }
  window.JC_SEAL_GLYPH = glyphSVG;

  /** 给定一段关系的心印度与统计，算出已解锁的印章 */
  function computeSeals(st) {
    st = st || {};
    if (!st.relation) return [];
    var got = [];
    SEALS.forEach(function (s) {
      if ((st.spark || 0) < s.need) return;
      if (s.id === 'IV' && (st.activeDays || 0) < 7) return;
      if (s.id === 'V' && !st.upgradedByThem) return;
      if (s.id === 'VI' && (st.streak || 0) < 14) return;
      if (s.id === 'VII' && (st.voiceCount || 0) < 30) return;
      if (s.id === 'VIII' && (st.upgrades || 0) < 3) return;
      got.push(s.id);
    });
    return got;
  }
  window.JC_COMPUTE_SEALS = computeSeals;

  /* ======================================================================
     Tab
  ====================================================================== */
  document.querySelectorAll('.gal-tab').forEach(function (b) {
    b.addEventListener('click', function () {
      var t = b.dataset.t;
      document.querySelectorAll('.gal-tab').forEach(function (x) { x.classList.toggle('on', x === b); });
      document.getElementById('paneCards').classList.toggle('jc-hide', t !== 'cards');
      document.getElementById('paneSeal').classList.toggle('jc-hide', t !== 'seal');
      document.getElementById('topCn').textContent = t === 'cards' ? '存档' : '心印';
      document.getElementById('topEn').textContent = t === 'cards' ? 'ARCHIVE' : 'HEART SEAL';
      if (t === 'seal') renderSeal();
    });
  });
  if (/tab=seal/.test(location.search)) {
    setTimeout(function () { document.querySelector('.gal-tab[data-t="seal"]').click(); }, 0);
  }

  /* ======================================================================
     存档
  ====================================================================== */
  function renderCards() {
    JC.DB.all('cards').then(function (list) {
      list.sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
      document.getElementById('nCards').textContent = list.length;
      document.getElementById('arcEmpty').style.display = list.length ? 'none' : '';
      document.getElementById('arcGrid').innerHTML = list.map(function (c, i) {
        return '<div class="arc" data-id="' + c.id + '" style="animation-delay:' + Math.min(i * .04, .5) + 's">' +
          (c.cardBg ? '<img src="' + c.cardBg + '">' : '') +
          '<div class="arc-veil"></div><div class="arc-frame"></div>' +
          (c.relation ? '<span class="arc-rel">' + JC.esc(c.relation) + '</span>' : '') +
          '<button class="arc-del" data-del="' + c.id + '">×</button>' +
          '<div class="arc-b"><div class="arc-n">' + JC.esc(c.name) + '</div>' +
          '<div class="arc-m">' + JC.esc((c.identity || '') + ' · ' + (c.mbti || '') + ' · ' + (c.lang || '中文')) + '</div></div>' +
        '</div>';
      }).join('');

      document.querySelectorAll('.arc').forEach(function (el) {
        el.addEventListener('click', function (e) {
          if (e.target.dataset.del) {
            JC.DB.del('cards', Number(e.target.dataset.del)).then(renderCards);
            return;
          }
          JC.DB.get('cards', Number(el.dataset.id)).then(function (c) {
            return JC.DB.kvSet('viewing', c);
          }).then(function () { JC.go('jc-detail.html'); });
        });
      });
    });
  }
  renderCards();

  /* ======================================================================
     心印面板
  ====================================================================== */
  function renderSeal() {
    Promise.all([JC.DB.all('convos'), JC.DB.all('cards')]).then(function (r) {
      var convos = r[0].filter(function (c) { return c.relation; });
      document.getElementById('nSeal').textContent = convos.reduce(function (n, c) {
        return n + computeSeals(c).length;
      }, 0);

      var html =
        '<section class="seal-hero">' +
          '<div class="sh-title">心 印</div>' +
          '<div class="sh-sub">HEART&nbsp;SEAL&nbsp;·&nbsp;THE&nbsp;MARK&nbsp;LEFT&nbsp;ON&nbsp;PAPER</div>' +
          '<div class="sh-desc">心印不是好感度，是「你们之间留下的痕迹」。它<b>只在缔结关系之后</b>才开始记录——' +
          '在此之前，无论聊多少句，纸上都是空白。八枚印章逐级落下，越往后越难，需要的不只是数值，' +
          '还有时间、频率、以及对方是否也主动向你走了一步。</div>' +
        '</section>';

      /* 规则 */
      html += '<div class="jc-eyebrow" style="margin:20px 4px 10px;"><span class="jc-eyebrow-dot"></span>' +
        '<span class="jc-eyebrow-cn">墨温积累</span><span class="jc-eyebrow-en">GAIN</span><span class="jc-eyebrow-rule"></span></div>' +
        '<div class="seal-rule">' + GAIN.map(function (g) {
          return '<div class="sr-line"><span class="sr-k">' + g[0] + '</span><span>' + g[1] + '</span></div>';
        }).join('') + '</div>';

      html += '<div class="jc-eyebrow" style="margin:20px 4px 10px;"><span class="jc-eyebrow-dot"></span>' +
        '<span class="jc-eyebrow-cn">墨温流失</span><span class="jc-eyebrow-en">DECAY</span><span class="jc-eyebrow-rule"></span></div>' +
        '<div class="seal-rule">' + LOSE.map(function (g) {
          return '<div class="sr-line"><span class="sr-k">' + g[0] + '</span><span>' + g[1] + '</span></div>';
        }).join('') + '</div>';

      html += '<div class="jc-eyebrow" style="margin:20px 4px 10px;"><span class="jc-eyebrow-dot"></span>' +
        '<span class="jc-eyebrow-cn">八印刻度</span><span class="jc-eyebrow-en">EIGHT MARKS</span><span class="jc-eyebrow-rule"></span></div>' +
        '<div class="seal-rule">' + SEALS.map(function (s) {
          return '<div class="sr-line"><span class="sr-k">' + s.id + '</span><span><b>' + s.cn + '</b>　心印度 ' + s.need +
            (s.extra !== '—' ? '　·　' + s.extra : '') + '</span></div>';
        }).join('') + '</div>';

      /* 各段关系的进度 */
      if (!convos.length) {
        html += '<div class="gal-empty"><div class="ge-cn">尚 未 缔 结</div>' +
          '<div class="ge-sub">在聊天页用「邀请缔结关系」开启心印，或等待对方开口</div></div>';
      } else {
        html += '<div class="jc-eyebrow" style="margin:24px 4px 10px;"><span class="jc-eyebrow-dot"></span>' +
          '<span class="jc-eyebrow-cn">已缔结</span><span class="jc-eyebrow-en">BONDS</span><span class="jc-eyebrow-rule"></span></div>';
        convos.forEach(function (c) {
          var got = computeSeals(c);
          html += '<section class="seal-hero" style="padding:18px 16px 18px;">' +
            '<div style="display:flex;align-items:center;gap:11px;">' +
              '<div class="dm-av" style="width:44px;height:44px;border-radius:14px 19px 14px 19px;overflow:hidden;background:#e6e6ea;display:flex;align-items:center;justify-content:center;">' +
                (c.avatar ? '<img src="' + c.avatar + '" style="width:100%;height:100%;object-fit:cover;">' : '<span style="font-family:\'Cormorant Garamond\',serif;font-size:19px;color:#6f6f78">' + JC.esc((c.name || '?').charAt(0)) + '</span>') +
              '</div>' +
              '<div><div style="font-size:14px;font-weight:650;letter-spacing:1.6px;">' + JC.esc(c.name) + '</div>' +
              '<div style="font-size:9.5px;letter-spacing:1.2px;color:var(--grey-2);margin-top:3px;">' + JC.esc(c.relation) +
              '　心印度 ' + (c.spark || 0) + '</div></div>' +
            '</div>' +
            '<div class="seal-row">' + SEALS.map(function (s) {
              var on = got.indexOf(s.id) > -1;
              return '<div class="seal-badge' + (on ? ' got' : '') + '" title="' + s.cn + '">' +
                glyphSVG(s.glyph) + '<span class="sb-n">' + (on ? s.cn : s.id) + '</span></div>';
            }).join('') + '</div>' +
          '</section>';
        });
      }

      document.getElementById('paneSeal').innerHTML = html;
    });
  }
})();
