/* ==========================================================================
   角初笺 · jc-preset.js — 角色预设（全部多选）
   除了你点名的 年龄 / 性别 / MBTI / 性格 / 语言，我另外补了 8 组维度：
   身份职业 · 题材风格 · 时代背景 · 外貌气质 · 情感浓度 · 关系倾向 ·
   姓名风格 · 称呼偏好，外加「明确排除」与「额外要求」两个自由输入。
========================================================================== */
(function () {
  'use strict';
  JC.bootChrome();
  document.getElementById('backBtn').addEventListener('click', function () { JC.back('juechu.html'); });

  var GROUPS = [
    { key: 'ageRange', num: '01', cn: '年龄区间', en: 'AGE RANGE',
      opts: ['18-20 少年感', '21-24 初入世', '25-28 正当年', '29-33 成熟', '34-40 沉稳', '40+ 岁月感', '外表年龄不明'] },
    { key: 'gender', num: '02', cn: '性别', en: 'GENDER',
      opts: ['男', '女', '中性', '不设限'] },
    { key: 'mbti', num: '03', cn: 'MBTI 人格', en: 'MBTI',
      opts: ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'] },
    { key: 'persona', num: '04', cn: '性格基调', en: 'TEMPERAMENT',
      opts: ['清冷疏离','温柔缱绻','桀骜张扬','偏执占有','沉稳可靠','狡黠戏谑','孤僻寡言','热烈直白','病娇','钝感','矜贵','痞气','忠犬','高岭之花','外冷内热','伪善'] },
    { key: 'lang', num: '05', cn: '使用语言', en: 'LANGUAGE',
      opts: ['中文','英文','日文','韩文','法文','德文','西班牙文','意大利文','俄文','葡萄牙文','泰文','阿拉伯文'] },
    { key: 'identity', num: '06', cn: '身份职业', en: 'IDENTITY',
      opts: ['财阀继承人','外科医生','刑警','律师','大学教授','钢琴家','小说家','摄影师','调香师','剑客','将军','宫廷画师','占卜师','酒吧老板','舞者','影帝','建筑师','法医','修复师','神职人员'] },
    { key: 'genre', num: '07', cn: '题材风格', en: 'GENRE',
      opts: ['现代都市情感','古风言情','民国旧梦','西幻宫廷','东方玄幻','悬疑暗恋','校园青春','娱乐圈','末世纪年','蒸汽朋克','神话传说','武侠江湖'] },
    { key: 'era', num: '08', cn: '时代与地域', en: 'ERA & PLACE',
      opts: ['当代都市','八十年代','民国','唐宋','明清','中世纪欧洲','维多利亚','近未来','架空王朝','海岛小镇','北欧雪国','江南水乡'] },
    { key: 'look', num: '09', cn: '外貌气质', en: 'APPEARANCE',
      opts: ['清隽书卷','浓颜攻击性','雪肤黑发','金发碧眼','红发','异色瞳','苍白病气','蜜色健康','长发','短发利落','身量高挑','偏瘦骨感','带疤痕','戴眼镜','有纹身'] },
    { key: 'tone', num: '10', cn: '情感浓度', en: 'EMOTIONAL KEY',
      opts: ['克制隐忍','缠绵浓烈','疏淡如水','拉扯博弈','救赎向','双向暗涌','先婚后爱','久别重逢','破镜重圆','一见倾心'] },
    { key: 'relationBias', num: '11', cn: '关系倾向', en: 'RELATION BIAS',
      opts: ['陌生人起步','旧识重逢','同事同僚','师生','邻里','合作对手','契约关系','主仆','宿敌','笔友'] },
    { key: 'nameStyle', num: '12', cn: '姓名风格', en: 'NAME STYLE',
      opts: ['中式古典','中式现代','日式','韩式','英美','法式','北欧','斯拉夫','拉丁','架空异域'] },
    { key: 'address', num: '13', cn: '称呼偏好', en: 'HOW THEY CALL YOU',
      opts: ['直呼其名','昵称','敬称','冷淡的「你」','亲昵尾音','姓氏+职称','独有的代号'] }
  ];

  var state = null;
  var root = document.getElementById('presetRoot');

  function render() {
    root.innerHTML = GROUPS.map(function (g, i) {
      return '<section class="pgroup" style="animation-delay:' + (i * .035) + 's">' +
        '<div class="pg-head">' +
          '<span class="pg-num">' + g.num + '</span>' +
          '<span class="pg-cn">' + g.cn + '</span>' +
          '<span class="pg-en">' + g.en + '</span>' +
          '<span class="pg-rule"></span>' +
          '<span class="pg-cnt" data-cnt="' + g.key + '">' + (state[g.key] || []).length + '</span>' +
        '</div>' +
        '<div class="chips" data-key="' + g.key + '">' +
          g.opts.map(function (o) {
            var on = (state[g.key] || []).indexOf(o) > -1;
            return '<button class="chip' + (on ? ' on' : '') + '" data-v="' + JC.esc(o) + '">' + JC.esc(o) + '</button>';
          }).join('') +
          // 自定义项：不在预置表里的一律当自定义，可单独摘掉
          (state[g.key] || []).filter(function (v) { return g.opts.indexOf(v) < 0; }).map(function (v) {
            return '<button class="chip custom on" data-v="' + JC.esc(v) + '">' + JC.esc(v) +
                   '<i class="chip-x">×</i></button>';
          }).join('') +
          '<button class="chip add" data-add="' + g.key + '">＋ 自定义</button>' +
        '</div>' +
        '<div class="chip-add-row" data-row="' + g.key + '">' +
          '<input class="ca-in" placeholder="写下你要的' + g.cn + '，回车即添加" />' +
          '<button class="ca-ok">加 入</button>' +
        '</div>' +
      '</section>';
    }).join('') +
    '<section class="pgroup">' +
      '<div class="pg-head"><span class="pg-num">14</span><span class="pg-cn">明确排除</span>' +
      '<span class="pg-en">EXCLUDE</span><span class="pg-rule"></span></div>' +
      '<textarea class="p-input" id="pAvoid" rows="2" placeholder="不想遇到的设定，例如：不要已婚、不要年龄差过大…">' + JC.esc(state.avoid || '') + '</textarea>' +
    '</section>' +
    '<section class="pgroup">' +
      '<div class="pg-head"><span class="pg-num">15</span><span class="pg-cn">额外要求</span>' +
      '<span class="pg-en">EXTRA</span><span class="pg-rule"></span></div>' +
      '<textarea class="p-input" id="pExtra" rows="3" placeholder="任何补充：世界观设定、偏好的相遇场景、想要的语气…">' + JC.esc(state.extra || '') + '</textarea>' +
    '</section>' +
    '<div style="text-align:center;font-family:\'Space Mono\',monospace;font-size:8px;letter-spacing:3px;color:var(--grey-3);padding:20px 0 4px;">' +
      '所有维度均可多选 · 留空即不设限' +
    '</div>';

    // 自定义输入
    root.querySelectorAll('.chip.add').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        var row = root.querySelector('.chip-add-row[data-row="' + b.dataset.add + '"]');
        row.classList.toggle('on');
        if (row.classList.contains('on')) row.querySelector('.ca-in').focus();
      });
    });
    root.querySelectorAll('.chip-add-row').forEach(function (row) {
      var key = row.dataset.row;
      var input = row.querySelector('.ca-in');
      function commit() {
        var v = input.value.trim();
        if (!v) return;
        state[key] = state[key] || [];
        if (state[key].indexOf(v) < 0) state[key].push(v);
        input.value = '';
        var sc = root.parentElement ? root.parentElement.scrollTop : 0;
        render();
        if (root.parentElement) root.parentElement.scrollTop = sc;
        JC.toast('已加入自定义：' + v);
      }
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(); } });
      row.querySelector('.ca-ok').addEventListener('click', commit);
    });

    root.querySelectorAll('.chips').forEach(function (box) {
      var key = box.dataset.key;
      box.querySelectorAll('.chip:not(.add)').forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.v;
          state[key] = state[key] || [];
          var i = state[key].indexOf(v);
          if (i > -1) state[key].splice(i, 1); else state[key].push(v);
          b.classList.toggle('on');
          root.querySelector('[data-cnt="' + key + '"]').textContent = state[key].length;
          try { navigator.vibrate && navigator.vibrate(6); } catch (e) {}
        });
      });
    });
  }

  JC.Preset.get().then(function (p) { state = p; render(); });

  document.getElementById('saveBtn').addEventListener('click', function () {
    state.avoid = document.getElementById('pAvoid').value.trim();
    state.extra = document.getElementById('pExtra').value.trim();
    JC.Preset.set(state).then(function () {
      JC.toast('预设已保存 · 生成时将严格遵循');
      setTimeout(function () { JC.back('juechu.html'); }, 700);
    });
  });

  document.getElementById('clearBtn').addEventListener('click', function () {
    state = Object.assign({}, JC.PRESET_DEFAULT);
    Object.keys(state).forEach(function (k) { if (Array.isArray(state[k])) state[k] = []; });
    render();
    JC.toast('已清空，记得保存');
  });
})();