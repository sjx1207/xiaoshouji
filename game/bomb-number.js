/* =========================================================================
   数字炸弹 — bomb-number.js
   模式选择 → 择局中人 → 掷骰定身份 → 对局（猜测者 / 出题者）→ 复盘
   角色数据读自 LunaCharDB（与 characters.js 同库），
   AI 调用沿用 settings.js 中约定的 OpenAI 兼容 /chat/completions 接口。

   规则约定（点数大者藏数，点数小者猜测）：
     - 双方各摇一枚真实骰子（1-6 点，动画滚动后定格）。
     - 点数大的一方 = 出题者（setter，心中藏一个数字）。
     - 点数小的一方 = 猜测者（guesser，主动开口试探）。
     - 若点数相同，自动重掷直至分出大小。
     - 猜测者每次猜一个数字，出题者需回应「偏大 / 偏小 / 猜中」。
     - 若 AI 角色是猜测者：AI 主动喊数字前，先展示"正在思索数字…"的
       输入中状态，随后定格显示其猜测，等待用户（出题者）点选反馈。
     - 若 AI 角色是出题者：用户输入猜测后，需用户点击"让对方回应"按钮，
       才会调用 AI 生成偏大/偏小/猜中的回应（避免自动连续作答）。
     - 对局全程可自由聊天，AI 也会随机附带 1-2 句人设化的闲聊/试探。
   ========================================================================= */
(function () {
  'use strict';

  /* =========================================================================
     状态栏时间同步（与全局一致）
     ========================================================================= */
  function updateTime() {
    var tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    var now = new Date();
    var s = now.toLocaleTimeString('zh-CN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    });
    document.querySelectorAll('.status-time').forEach(function (el) { el.textContent = s; });
  }
  updateTime();
  setInterval(updateTime, 1000);

  /* =========================================================================
     IndexedDB — 复用 characters.js 的 LunaCharDB / chars store
     ========================================================================= */
  var _db = null;
  function openCharDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (res, rej) {
      var probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = function (e) {
        var cur = e.target.result;
        var ver = cur.version;
        var hasChars = cur.objectStoreNames.contains('chars');
        cur.close();
        if (hasChars) {
          var req2 = indexedDB.open('LunaCharDB', ver);
          req2.onsuccess = function (e2) { _db = e2.target.result; res(_db); };
          req2.onerror = function (e2) { rej(e2.target.error); };
        } else {
          var req3 = indexedDB.open('LunaCharDB', ver + 1);
          req3.onupgradeneeded = function (e3) {
            var db3 = e3.target.result;
            if (!db3.objectStoreNames.contains('chars')) {
              db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
            }
          };
          req3.onsuccess = function (e3) { _db = e3.target.result; res(_db); };
          req3.onerror = function (e3) { rej(e3.target.error); };
        }
      };
      probe.onerror = function (e) { rej(e.target.error); };
      probe.onupgradeneeded = function (e) {
        var db0 = e.target.result;
        if (!db0.objectStoreNames.contains('chars')) {
          db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  function getAllChars() {
    return openCharDB().catch(function () { return null; }).then(function (db) {
      if (!db) return [];
      return new Promise(function (res) {
        var req = db.transaction('chars', 'readonly').objectStore('chars').getAll();
        req.onsuccess = function () { res(req.result || []); };
        req.onerror = function () { res([]); };
      });
    });
  }

  /* =========================================================================
     AI 调用 — 与 settings.js 中「模型测试」保持一致的接口约定
     ========================================================================= */
  function getApiConfig() {
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch (e) {}
    var model = localStorage.getItem('luna_api_model') || '';
    return {
      baseUrl: (cur.baseUrl || '').replace(/\/$/, ''),
      apiKey: cur.apiKey || '',
      model: model
    };
  }

  function apiReady() {
    var c = getApiConfig();
    return !!(c.baseUrl && c.apiKey && c.model);
  }

  function callAI(messages, opts) {
    opts = opts || {};
    var cfg = getApiConfig();
    if (!cfg.baseUrl || !cfg.apiKey || !cfg.model) {
      return Promise.reject(new Error('未配置 AI 接口，请前往设置完成模型配置'));
    }
    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + cfg.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: cfg.model,
        messages: messages,
        max_tokens: opts.maxTokens || 300,
        temperature: opts.temperature != null ? opts.temperature : 0.9
      })
    }).then(function (resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function (data) {
      var reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      return reply.trim();
    });
  }

  /* =========================================================================
     游戏状态
     ========================================================================= */
  var state = {
    mode: 'versus',
    chars: [],
    selectedChar: null,
    rangeMin: 1,
    rangeMax: 100,
    setterIsChar: null,      // true = 角色藏数（出题者），false = 用户藏数
    secretByAI: null,        // 角色是出题者时，AI 心中的秘密数字（本地生成，从不外泄）
    secretByUser: null,      // 用户是出题者时，用户真实输入录入的秘密数字（用于系统自动判定）
    curMin: 1,
    curMax: 100,
    turn: null,               // 'user' | 'char' —— 当前该谁猜
    role: null,                // 用户在本局中的角色： 'guesser' 用户猜 / 'setter' 用户出题
    history: [],
    chatLog: [],
    over: false,
    awaitingReply: false,      // 用户已发出猜测，等待用户手动点击"请对方回应"才触发 AI 判断
    guessCountUser: 0,
    guessCountChar: 0
  };

  // AI 是否正在处理一次判断/猜测回合（用户猜测请求回应 or 用户出题时 AI 猜测），用于按钮禁用防抖
  var aiTurnInFlight = false;

  /* =========================================================================
     DOM refs
     ========================================================================= */
  var bnStage    = document.getElementById('bnStage');
  var btnBack    = document.getElementById('btnBack');
  var btnRules   = document.getElementById('btnRules');

  var modeVersus = document.getElementById('modeVersus');
  var modeSolo   = document.getElementById('modeSolo');

  var ruleCardInline = document.getElementById('ruleCardInline');
  var ruleCardToggle = document.getElementById('ruleCardToggle');

  var rulesModal      = document.getElementById('rulesModal');
  var rulesModalMask  = document.getElementById('rulesModalMask');
  var btnRulesClose   = document.getElementById('btnRulesClose');

  var charListEl = document.getElementById('charList');
  var emptyChars = document.getElementById('emptyChars');
  var btnToDice  = document.getElementById('btnToDice');

  var rangeMinVal = document.getElementById('rangeMinVal');
  var rangeMaxVal = document.getElementById('rangeMaxVal');

  var diceAvatarUser = document.getElementById('diceAvatarUser');
  var diceAvatarChar = document.getElementById('diceAvatarChar');
  var diceCharName   = document.getElementById('diceCharName');
  var diceSideUser = document.getElementById('diceSideUser');
  var diceSideChar = document.getElementById('diceSideChar');
  var dieUser     = document.getElementById('dieUser');
  var dieChar     = document.getElementById('dieChar');
  var dieUserCube = document.getElementById('dieUserCube');
  var dieCharCube = document.getElementById('dieCharCube');
  var diceRoleUser = document.getElementById('diceRoleUser');
  var diceRoleChar = document.getElementById('diceRoleChar');
  var diceResult  = document.getElementById('diceResult');
  var btnRoll     = document.getElementById('btnRoll');
  var btnDiceConfirm = document.getElementById('btnDiceConfirm');

  var curRangeVal = document.getElementById('curRangeVal');
  var secretChip  = document.getElementById('secretChip');
  var turnBadge   = document.getElementById('turnBadge');
  var timeline    = document.getElementById('timeline');
  var guessInput  = document.getElementById('guessInput');
  var btnSendGuess = document.getElementById('btnSendGuess');
  var composerGuess  = document.getElementById('composerGuess');
  var composerAwaitReply = document.getElementById('composerAwaitReply');
  var btnAskReply    = document.getElementById('btnAskReply');
  var askReplyBtnText = document.getElementById('askReplyBtnText');
  var composerPrompt = document.getElementById('composerPrompt');
  var btnPromptChar  = document.getElementById('btnPromptChar');
  var promptBtnText  = document.getElementById('promptBtnText');
  var composerSetSecret = document.getElementById('composerSetSecret');
  var secretInput    = document.getElementById('secretInput');
  var btnSetSecret   = document.getElementById('btnSetSecret');
  var chatInput   = document.getElementById('chatInput');
  var btnSendChat = document.getElementById('btnSendChat');

  var resultEyebrow = document.getElementById('resultEyebrow');
  var resultTitle   = document.getElementById('resultTitle');
  var resultNumber  = document.getElementById('resultNumber');
  var resultDesc    = document.getElementById('resultDesc');
  var resultStats   = document.getElementById('resultStats');
  var btnAgain    = document.getElementById('btnAgain');
  var btnExit     = document.getElementById('btnExit');

  /* =========================================================================
     返回大厅
     ========================================================================= */
  function goHome() {
    window.location.href = '../game.html';
  }
  if (btnBack) btnBack.addEventListener('click', goHome);
  if (btnExit) btnExit.addEventListener('click', goHome);

  /* =========================================================================
     阶段切换
     ========================================================================= */
  function goPanel(name) {
    bnStage.setAttribute('data-at', name);
  }

  /* =========================================================================
     规则：内联卡片折叠 + 弹层
     ========================================================================= */
  if (ruleCardToggle) {
    ruleCardToggle.addEventListener('click', function () {
      ruleCardInline.classList.toggle('is-open');
    });
  }
  function openRulesModal() { rulesModal.classList.add('is-open'); }
  function closeRulesModal() { rulesModal.classList.remove('is-open'); }
  if (btnRules) btnRules.addEventListener('click', openRulesModal);
  if (rulesModalMask) rulesModalMask.addEventListener('click', closeRulesModal);
  if (btnRulesClose) btnRulesClose.addEventListener('click', closeRulesModal);

  /* =========================================================================
     模式选择（当前仅"邀请伙伴对局"可用，"独自校准"为占位）
     ========================================================================= */
  if (modeVersus) {
    modeVersus.addEventListener('click', function () {
      state.mode = 'versus';
      modeVersus.classList.add('is-active');
      modeSolo.classList.remove('is-active');
    });
  }
  if (modeSolo) {
    modeSolo.addEventListener('click', function (e) {
      e.preventDefault();
      // 占位卡片：禁用态，不响应
    });
  }

  /* =========================================================================
     阶段一：角色列表渲染
     ========================================================================= */
  function avatarInner(c) {
    if (c && c.avatar) {
      return '<img src="' + c.avatar + '" alt="' + escHtml(c.name || '') + '" />';
    }
    return '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8.5" r="3.4" stroke="currentColor" stroke-width="1.1"/><path d="M5 20c1.6-4 4.2-6 7-6s5.4 2 7 6" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>';
  }

  function escHtml(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderCharList() {
    charListEl.innerHTML = '';
    if (!state.chars.length) {
      emptyChars.style.display = 'flex';
      btnToDice.disabled = true;
      return;
    }
    emptyChars.style.display = 'none';

    state.chars.forEach(function (c) {
      var row = document.createElement('div');
      row.className = 'bn-charcard';
      row.dataset.id = c.id;
      row.innerHTML =
        '<span class="bn-charcard__avatar">' + avatarInner(c) + '</span>' +
        '<span class="bn-charcard__body">' +
          '<p class="bn-charcard__name">' + escHtml(c.name || '未命名角色') + '</p>' +
          '<p class="bn-charcard__role">' + escHtml(c.role || c.desc || '一位对局者') + '</p>' +
        '</span>' +
        '<span class="bn-charcard__mark">' +
          '<svg viewBox="0 0 24 24" width="11" height="11" fill="none"><path d="M4 12l5 5L20 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span>';
      row.addEventListener('click', function () { selectChar(c.id); });
      charListEl.appendChild(row);
    });
  }

  function selectChar(id) {
    state.selectedChar = state.chars.find(function (c) { return c.id === id; }) || null;
    Array.prototype.slice.call(charListEl.querySelectorAll('.bn-charcard')).forEach(function (row) {
      row.classList.toggle('is-selected', parseInt(row.dataset.id) === id);
    });
    btnToDice.disabled = !state.selectedChar;
  }

  /* ---------- 区间步进器 ---------- */
  document.querySelectorAll('.bn-numstep').forEach(function (stepper) {
    var target = stepper.dataset.target;
    stepper.querySelectorAll('.bn-numstep__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var delta = btn.dataset.act === 'inc' ? 1 : -1;
        if (target === 'min') {
          state.rangeMin = clamp(state.rangeMin + delta * 1, 0, state.rangeMax - 1);
          rangeMinVal.textContent = state.rangeMin;
        } else {
          state.rangeMax = clamp(state.rangeMax + delta * 5, state.rangeMin + 1, 9999);
          rangeMaxVal.textContent = state.rangeMax;
        }
      });
    });
  });

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  btnToDice.addEventListener('click', function () {
    if (!state.selectedChar) return;
    state.curMin = state.rangeMin;
    state.curMax = state.rangeMax;
    diceAvatarChar.innerHTML = avatarInner(state.selectedChar);
    diceCharName.textContent = state.selectedChar.name || '对局者';
    diceAvatarUser.innerHTML = avatarInner(null);
    resetDiceCube(dieUserCube);
    resetDiceCube(dieCharCube);
    diceRoleUser.textContent = '轮到你先掷';
    diceRoleChar.textContent = '\u00A0';
    diceRoleUser.className = 'bn-dice-role is-waiting-turn';
    diceRoleChar.className = 'bn-dice-role';
    diceSideUser.classList.add('is-active');
    diceSideChar.classList.remove('is-active');
    diceResult.textContent = '\u00A0';
    btnRoll.disabled = false;
    btnRoll.style.display = 'flex';
    btnRoll.querySelector('span').textContent = '掷骰';
    btnDiceConfirm.style.display = 'none';
    goPanel('dice');
  });

  /* =========================================================================
     阶段二：真实 3D 骰子（六面 CSS 立方体，先后分别投掷）
     每枚面用 rotateX/rotateY 精确对准朝向摄像机（-front）的角度，
     以此在"定格"瞬间让目标点数真正正对可见面，而非贴图作弊。
     ========================================================================= */
  var FACE_ROTATION = {
    // 让该点数所在面转到 front（面向观察者）的角度
    1: { x: 0,    y: 0   },
    6: { x: 0,    y: 180 },
    2: { x: 0,    y: -90 },
    5: { x: 0,    y: 90  },
    3: { x: -90,  y: 0   },
    4: { x: 90,   y: 0   }
  };

  /* 点数图案现在完全由 CSS 的 [data-pips="N"] 属性选择器静态绘制
     （见 bomb-number.css），HTML 里每个面的 data-pips 是固定写死的
     标准骰子布局（对面互补：1-6、2-5、3-4），本身不需要随投掷结果
     改变——投掷动画只是把"目标点数所在的那一面"旋转到正面朝向观察者。
     这样彻底不依赖任何运行时动态插入 DOM 节点来画点数，避免了此前
     "立方体转起来了，但点数没画出来"的渲染时机问题。 */

  function resetDiceCube(cubeEl) {
    cubeEl.style.transition = 'none';
    cubeEl.style.transform = 'rotateX(-22deg) rotateY(-35deg)';
    // 强制回流以清除 transition:none 后立即恢复过渡
    void cubeEl.offsetWidth;
    cubeEl.style.transition = '';
  }

  function landCubeOn(cubeEl, val, extraSpins) {
    var base = FACE_ROTATION[val];
    // 叠加若干整圈，让落定动作带有"转了几圈才停"的真实感
    var spinX = extraSpins.x * 360;
    var spinY = extraSpins.y * 360;
    cubeEl.style.transform = 'rotateX(' + (base.x + spinX) + 'deg) rotateY(' + (base.y + spinY) + 'deg) rotateZ(0deg)';
  }

  /* ---------- 单枚骰子的完整投掷序列：滚动 → 落定 → 回调 ---------- */
  function rollOneDie(dieWellParentBtn, cubeEl, dieShellEl, onSettled) {
    dieShellEl.classList.remove('is-settled');
    dieShellEl.classList.add('is-rolling');

    var val = 1 + Math.floor(Math.random() * 6);
    var rollMs = 900;

    setTimeout(function () {
      dieShellEl.classList.remove('is-rolling');
      var extraSpins = {
        x: 2 + Math.floor(Math.random() * 2),
        y: 2 + Math.floor(Math.random() * 2)
      };
      landCubeOn(cubeEl, val, extraSpins);
      dieShellEl.classList.add('is-settled');
      var well = cubeEl.closest('.bn-die3d-well');
      setTimeout(function () {
        well.classList.add('is-bounce');
        setTimeout(function () { well.classList.remove('is-bounce'); }, 450);
        onSettled(val);
      }, 640);
    }, rollMs);
  }

  var rolling = false;
  btnRoll.addEventListener('click', function () {
    if (rolling) return;
    startRollSequence();
  });

  function startRollSequence() {
    rolling = true;
    btnRoll.disabled = true;
    resetDiceCube(dieUserCube);
    resetDiceCube(dieCharCube);
    diceRoleUser.textContent = '掷骰中…';
    diceRoleChar.textContent = '\u00A0';
    diceRoleUser.className = 'bn-dice-role is-waiting-turn';
    diceRoleChar.className = 'bn-dice-role';
    diceSideUser.classList.add('is-active');
    diceSideChar.classList.remove('is-active');
    diceResult.textContent = '轮到你先掷 —— 点击骰子所在按钮';

    // 用户先投
    rollOneDie(btnRoll, dieUserCube, dieUser, function (uVal) {
      state._pendingUserRoll = uVal;
      diceRoleUser.textContent = '点数 ' + uVal;
      diceRoleUser.className = 'bn-dice-role';
      diceResult.textContent = '轮到 ' + (state.selectedChar.name || '对局者') + ' 掷骰…';
      diceSideChar.classList.add('is-active');

      // 稍作停顿，再轮到 char 投掷，制造"轮流"的真实节奏
      setTimeout(function () {
        rollOneDie(btnRoll, dieCharCube, dieChar, function (cVal) {
          finishRoll(uVal, cVal);
        });
      }, 500);
    });
  }

  function finishRoll(uVal, cVal) {
    rolling = false;

    if (uVal === cVal) {
      diceResult.textContent = '点数相同（' + uVal + ' : ' + cVal + '），重新掷骰分出高下';
      btnRoll.disabled = false;
      diceRoleUser.textContent = '\u00A0';
      diceRoleChar.textContent = '\u00A0';
      setTimeout(function () { startRollSequence(); }, 1300);
      return;
    }

    // 点数大者 = 出题者（藏数），点数小者 = 猜测者
    var userIsSetter = uVal > cVal;
    state.setterIsChar = !userIsSetter;

    diceRoleUser.textContent = userIsSetter ? '出题者 · 藏数' : '猜测者 · 试探';
    diceRoleUser.classList.add(userIsSetter ? 'is-setter' : 'is-guesser');
    diceRoleChar.textContent = userIsSetter ? '猜测者 · 试探' : '出题者 · 藏数';
    diceRoleChar.classList.add(userIsSetter ? 'is-guesser' : 'is-setter');

    diceResult.textContent = uVal + ' : ' + cVal + '　' +
      (userIsSetter
        ? '你点数更大，由你藏下数字'
        : (state.selectedChar.name || '对局者') + ' 点数更大，由对方藏下数字');

    // 不再自动跳转：展示结果后，由用户主动点击"开始对局"确认继续
    btnRoll.style.display = 'none';
    btnDiceConfirm.style.display = 'flex';
  }

  if (btnDiceConfirm) btnDiceConfirm.addEventListener('click', function () {
    startMatch();
  });

  /* =========================================================================
     阶段三：对局核心逻辑
     ========================================================================= */
  function startMatch() {
    state.curMin = state.rangeMin;
    state.curMax = state.rangeMax;
    state.history = [];
    state.chatLog = [];
    state.over = false;
    state.guessCountUser = 0;
    state.guessCountChar = 0;
    timeline.innerHTML = '';

    if (state.setterIsChar) {
      // 角色藏数，用户猜测
      state.role = 'guesser';
      state.secretByAI = state.curMin + Math.floor(Math.random() * (state.curMax - state.curMin + 1));
      state.turn = 'user';
      pushSystem('骰面已定，' + (state.selectedChar.name || '对局者') + ' 已在心中藏好答案。请说出第一个数字。');
    } else {
      // 用户藏数，角色猜测：需要用户真实输入秘密数字，而不是仅凭记忆
      state.role = 'setter';
      state.turn = 'char';
      state.secretByUser = null;
      pushSystem('骰面已定，请在下方输入框中输入一个 ' + state.curMin + '–' + state.curMax + ' 之间的数字，作为你藏下的秘密数字。');
    }

    updateSecretChip();
    updateRangeDisplay();
    updateComposerMode();
    goPanel('play');
  }

  /* 秘密数字的可见性提示：
     - role === 'guesser'（用户猜）：数字锁在对方心里，chip 显示锁形 + 省略号
     - role === 'setter'（用户藏）：数字已由用户真实录入，chip 提示"只有你知道"；
       若尚未录入，则提示"请先输入你要藏的数字" */
  function updateSecretChip() {
    if (!secretChip) return;
    var dotsEl = secretChip.querySelector('.bn-play-secret__dots');
    if (state.role === 'guesser') {
      secretChip.title = (state.selectedChar && state.selectedChar.name || '对方') + ' 心中的秘密数字';
      dotsEl.textContent = '对方已藏好 · • • •';
    } else if (state.secretByUser != null) {
      secretChip.title = '只有你知道这个数字';
      dotsEl.textContent = '你已藏好 · • • •';
    } else {
      secretChip.title = '请先输入你要藏的数字';
      dotsEl.textContent = '请先藏数 · • • •';
    }
  }

  function updateRangeDisplay() {
    curRangeVal.textContent = state.curMin + ' – ' + state.curMax;
    if (state.over) {
      turnBadge.textContent = '对局结束';
      turnBadge.classList.add('is-waiting');
      return;
    }
    if (state.role === 'guesser') {
      if (state.awaitingReply) {
        turnBadge.textContent = aiTurnInFlight ? ((state.selectedChar && state.selectedChar.name) || '对方') + ' 判断中' : '等待你请求回应';
      } else {
        turnBadge.textContent = '轮到你猜测';
      }
    } else {
      turnBadge.textContent = state.turn === 'char' ? ((state.selectedChar && state.selectedChar.name) || '对方') + ' 猜测中' : '等待你的反馈';
    }
    turnBadge.classList.toggle('is-waiting', !(state.role === 'guesser' && !state.awaitingReply));
  }

  /* 猜测模式下，输入框行为因 role 而异：
     - role === 'guesser'：用户输入数字，发送即视为一次猜测
     - role === 'setter' 且 secretByUser 未录入：显示秘密数字输入框，
       用户必须先真实输入一个数字，系统才能后续自动比对判定
     - role === 'setter' 且 secretByUser 已录入：显示"让对方猜一个数字"按钮 */
  function updateComposerMode() {
    if (state.role === 'guesser') {
      composerPrompt.style.display = 'none';
      composerSetSecret.style.display = 'none';
      if (state.awaitingReply) {
        composerGuess.style.display = 'none';
        composerAwaitReply.style.display = 'none';
        composerAwaitReply.style.display = 'flex';
        btnAskReply.disabled = state.over || aiTurnInFlight;
        askReplyBtnText.textContent = aiTurnInFlight ? '对方正在回应…' : '请对方回应';
      } else {
        composerGuess.style.display = 'flex';
        composerAwaitReply.style.display = 'none';
        guessInput.placeholder = '轮到你猜测时，输入一个数字…';
        guessInput.disabled = state.turn !== 'user' || state.over;
        btnSendGuess.disabled = state.turn !== 'user' || state.over;
      }
    } else {
      composerGuess.style.display = 'none';
      composerAwaitReply.style.display = 'none';
      if (state.secretByUser == null) {
        composerPrompt.style.display = 'none';
        composerSetSecret.style.display = 'flex';
        secretInput.placeholder = '输入你要藏的 ' + state.curMin + '–' + state.curMax + ' 之间的数字…';
        secretInput.disabled = state.over;
        btnSetSecret.disabled = state.over;
      } else {
        composerSetSecret.style.display = 'none';
        composerPrompt.style.display = 'flex';
        btnPromptChar.disabled = state.over || aiTurnInFlight;
        promptBtnText.textContent = state.history.length ? '让对方继续猜测' : '让对方猜一个数字';
      }
    }
    chatInput.disabled = state.over;
    btnSendChat.disabled = state.over;
  }

  /* ---------- 时间线渲染工具 ---------- */
  function pushSystem(text) {
    var el = document.createElement('div');
    el.className = 'bn-msg bn-msg--system';
    el.innerHTML = '<div class="bn-msg__bubble">' + escHtml(text) + '</div>';
    timeline.appendChild(el);
    scrollTimelineToEnd();
  }

  function pushChat(by, text) {
    var el = document.createElement('div');
    el.className = 'bn-msg bn-msg--' + by;
    el.innerHTML =
      '<div class="bn-msg__bubble">' + escHtml(text) + '</div>' +
      '<p class="bn-msg__meta">' + (by === 'user' ? '你' : escHtml((state.selectedChar && state.selectedChar.name) || '对局者')) + '</p>';
    timeline.appendChild(el);
    scrollTimelineToEnd();
    state.chatLog.push({ by: by, text: text });
  }

  function pushGuess(by, value, tag, isHit) {
    var el = document.createElement('div');
    el.className = 'bn-msg bn-msg--' + by;
    el.innerHTML =
      '<div class="bn-msg__bubble bn-msg__guess">' +
        '<span class="bn-msg__guess-num">' + value + '</span>' +
        '<span class="bn-msg__guess-tag' + (isHit ? ' bn-msg__guess-tag--hit' : '') + '">' + escHtml(tag) + '</span>' +
      '</div>' +
      '<p class="bn-msg__meta">' + (by === 'user' ? '你的猜测' : escHtml((state.selectedChar && state.selectedChar.name) || '对局者') + ' 的猜测') + '</p>';
    timeline.appendChild(el);
    scrollTimelineToEnd();
  }

  /* 用户发出猜测后，先以"待回应"气泡呈现（不带偏大/偏小标签），
     等用户点击"请对方回应"才会调用 AI 并原地补上判断标签。 */
  function pushPendingGuess(value) {
    var el = document.createElement('div');
    el.className = 'bn-msg bn-msg--user';
    el.innerHTML =
      '<div class="bn-msg__bubble bn-msg__guess">' +
        '<span class="bn-msg__guess-num">' + value + '</span>' +
        '<span class="bn-msg__guess-tag bn-msg__guess-tag--pending">待对方回应</span>' +
      '</div>' +
      '<p class="bn-msg__meta">你的猜测</p>';
    timeline.appendChild(el);
    scrollTimelineToEnd();
    return el;
  }

  function settlePendingGuess(el, tag, isHit) {
    var tagEl = el.querySelector('.bn-msg__guess-tag');
    if (tagEl) {
      tagEl.textContent = tag;
      tagEl.classList.remove('bn-msg__guess-tag--pending');
      if (isHit) tagEl.classList.add('bn-msg__guess-tag--hit');
    }
  }

  /* "对方正在输入数字…" 占位气泡，猜测定格后原地替换为实际数字 */
  function pushTypingNumber() {
    var el = document.createElement('div');
    el.className = 'bn-msg bn-msg--char';
    el.innerHTML =
      '<div class="bn-msg__bubble">' +
        '<div class="bn-typing-num">' +
          '<div class="bn-typing-num__dots"><i></i><i></i><i></i></div>' +
          '<span class="bn-typing-num__label">' + escHtml((state.selectedChar && state.selectedChar.name) || '对局者') + ' 正在斟酌数字…</span>' +
        '</div>' +
      '</div>';
    timeline.appendChild(el);
    scrollTimelineToEnd();
    return el;
  }

  function settleTypingNumberToGuess(el, val) {
    // 若用户已真实录入秘密数字，系统自动比对给出建议判定，预高亮对应按钮；
    // 用户仍可点击其他按钮手动改判（例如系统判定有误或想调整时）。
    var autoFb = null;
    if (state.secretByUser != null) {
      autoFb = val === state.secretByUser ? 'hit' : (val < state.secretByUser ? 'low' : 'high');
    }

    el.innerHTML =
      '<div class="bn-msg__bubble bn-msg__guess">' +
        '<span class="bn-msg__guess-num">' + val + '</span>' +
      '</div>' +
      '<p class="bn-msg__meta">' + escHtml((state.selectedChar && state.selectedChar.name) || '对局者') + ' 的猜测 · ' +
        (autoFb ? '系统已自动判定，可确认或改判' : '请给出反馈') + '</p>' +
      '<div class="bn-feedback-row">' +
        '<button class="bn-fb-btn' + (autoFb === 'low' ? ' is-suggested' : '') + '" data-fb="low">偏小了</button>' +
        '<button class="bn-fb-btn' + (autoFb === 'high' ? ' is-suggested' : '') + '" data-fb="high">偏大了</button>' +
        '<button class="bn-fb-btn bn-fb-btn--hit' + (autoFb === 'hit' ? ' is-suggested' : '') + '" data-fb="hit">猜中了</button>' +
      '</div>' +
      (autoFb ? '<button class="bn-fb-confirm" data-fb-confirm="' + autoFb + '">确认「' +
        (autoFb === 'hit' ? '猜中了' : (autoFb === 'low' ? '偏小了' : '偏大了')) + '」</button>' : '');
    scrollTimelineToEnd();
    el.querySelectorAll('.bn-fb-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        el.querySelectorAll('.bn-fb-btn').forEach(function (b) { b.disabled = true; });
        var confirmBtn = el.querySelector('.bn-fb-confirm');
        if (confirmBtn) confirmBtn.remove();
        handleUserFeedback(val, btn.dataset.fb);
      });
    });
    var confirmBtn = el.querySelector('.bn-fb-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', function () {
        el.querySelectorAll('.bn-fb-btn').forEach(function (b) { b.disabled = true; });
        confirmBtn.remove();
        handleUserFeedback(val, confirmBtn.dataset.fbConfirm);
      });
    }
  }

  var thinkingEl = null;
  function showThinking() {
    hideThinking();
    thinkingEl = document.createElement('div');
    thinkingEl.className = 'bn-msg bn-msg--char';
    thinkingEl.innerHTML = '<div class="bn-msg__bubble"><div class="bn-thinking"><i></i><i></i><i></i></div></div>';
    timeline.appendChild(thinkingEl);
    scrollTimelineToEnd();
  }
  function hideThinking() {
    if (thinkingEl && thinkingEl.parentNode) thinkingEl.parentNode.removeChild(thinkingEl);
    thinkingEl = null;
  }

  function scrollTimelineToEnd() {
    requestAnimationFrame(function () { timeline.scrollTop = timeline.scrollHeight; });
  }

  /* =========================================================================
     构建角色人设 system prompt
     ========================================================================= */
  function buildPersonaPrompt(c) {
    var parts = [];
    parts.push('你正在扮演角色「' + (c.name || '未命名角色') + '」，与用户进行一局「数字炸弹」猜数字游戏。');
    if (c.prompt) parts.push(c.prompt);
    if (c.desc) parts.push('角色简介：' + c.desc);
    if (c.speechStyle) parts.push('说话风格：' + c.speechStyle);
    if (c.catchphrases && c.catchphrases.length) parts.push('口头禅（可适度自然使用）：' + c.catchphrases.join('、'));
    if (c.traits && c.traits.length) parts.push('性格特征：' + c.traits.join('、'));
    if (c.relation || c.callUser) {
      parts.push('与用户的关系：' + (c.relation || '') + (c.callUser ? '，称呼用户为「' + c.callUser + '」' : ''));
    }
    parts.push('请始终保持角色人设进行对话与游戏内发言，不要跳出角色，不要提及你是语言模型或AI。');
    return parts.join('\n');
  }

  /* 供出题者场景使用：判断之后，偶尔追加一小段真实的闲聊来回（1-3 句，
     而非孤零零一句"附加语"）。让对局像真人边玩边聊，而不是"判断+装饰句"。
     约 55% 概率触发，返回一个字符串数组，逐条以自然间隔推入时间线。 */
  function maybeExtraFlavor(baseSys, userLine) {
    var wantsExtra = Math.random() < 0.7;
    if (!wantsExtra) return Promise.resolve(null);
    var sys = baseSys +
      '\n\n除了刚才的大小判断之外，现在请你再自然地说 1 到 3 句闲聊或试探式反问' +
      '（比如猜猜用户的思路、随口调侃、催促、示弱、挑衅、转移话题等，具体看你的人设气质），' +
      '完全不涉及秘密数字本身。这应该读起来像真实聊天记录里连续发的几条短消息，' +
      '每条都简短口语化，不要写成一整段书面独白。' +
      '\n\n请严格只返回一个 JSON 数组，不要包含任何其他文字或代码块标记，格式如：["第一句","第二句"]。数组长度 1 到 3 条即可，也可以只有 1 条。';
    return callAI([{ role: 'system', content: sys }, { role: 'user', content: userLine }], { temperature: 1.05, maxTokens: 160 })
      .then(function (reply) {
        var lines = parseAIStringArray(reply);
        return lines && lines.length ? lines : null;
      })
      .catch(function () { return null; });
  }

  function parseAIStringArray(text) {
    try {
      var cleaned = (text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      var match = cleaned.match(/\[[\s\S]*\]/);
      var arr = JSON.parse(match ? match[0] : cleaned);
      if (!Array.isArray(arr)) return null;
      return arr.filter(function (s) { return typeof s === 'string' && s.trim(); }).slice(0, 3);
    } catch (e) {
      return null;
    }
  }

  /* 将多句闲聊以逐条、带真实停顿感的方式推入时间线（模拟连续发送多条消息） */
  function pushChatSequence(lines, index) {
    index = index || 0;
    if (!lines || index >= lines.length) return;
    var delay = index === 0 ? 260 : 500 + Math.random() * 500;
    setTimeout(function () {
      pushChat('char', lines[index]);
      pushChatSequence(lines, index + 1);
    }, delay);
  }

  /* =========================================================================
     用户是猜测者（role = guesser）：
     用户输入数字 → 调用 AI，让 AI 按角色人设回复"大了/小了/猜中"
     ========================================================================= */
  guessInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitUserGuess(); });
  btnSendGuess.addEventListener('click', submitUserGuess);

  function submitUserGuess() {
    if (state.over || state.role !== 'guesser' || state.turn !== 'user' || state.awaitingReply) return;
    var raw = guessInput.value.trim();
    if (!raw) return;
    var val = parseInt(raw, 10);
    if (isNaN(val) || val < state.curMin || val > state.curMax) {
      pushSystem('请输入 ' + state.curMin + ' – ' + state.curMax + ' 区间内的整数');
      return;
    }
    guessInput.value = '';
    state.guessCountUser++;

    var pendingEl = pushPendingGuess(val);
    state._pendingGuessEl = pendingEl;
    state._pendingGuessVal = val;
    state.awaitingReply = true;
    updateComposerMode();
  }

  if (btnAskReply) btnAskReply.addEventListener('click', function () {
    if (state.over || !state.awaitingReply || aiTurnInFlight) return;
    requestCharJudgment();
  });

  function requestCharJudgment() {
    var val = state._pendingGuessVal;
    var pendingEl = state._pendingGuessEl;

    var isHit = val === state.secretByAI;
    var tag = isHit ? '猜中' : (val < state.secretByAI ? '偏小' : '偏大');
    state.history.push({ by: 'user', value: val, result: isHit ? 'hit' : (val < state.secretByAI ? 'low' : 'high') });

    if (isHit) {
      settlePendingGuess(pendingEl, tag, true);
      endMatch({ winner: 'user', secret: state.secretByAI });
      return;
    }

    if (val < state.secretByAI) state.curMin = Math.max(state.curMin, val + 1);
    else state.curMax = Math.min(state.curMax, val - 1);
    updateRangeDisplay();

    aiTurnInFlight = true;
    updateComposerMode();
    updateRangeDisplay();
    showThinking();

    var persona = buildPersonaPrompt(state.selectedChar);
    var directionText = val < state.secretByAI ? '偏小，用户猜的数字比你藏的数字小' : '偏大，用户猜的数字比你藏的数字大';
    var sys = persona +
      '\n\n游戏规则说明：你心中藏着一个数字 ' + state.secretByAI + '（这是唯一真实值，绝不能在回复中直接写出这个数字或明显暗示具体数值），' +
      '用户刚刚猜了 ' + val + '，正确判断是「' + directionText + '」。' +
      '\n\n请用你的角色口吻回一句话，像正常聊天一样告诉用户"大了"还是"小了"（可以委婉但必须让用户能判断方向），不要写出具体数字。' +
      '\n\n重要——语气要求：这是随口的一句话，不是对"这个数字本身"的文学化解读或比喻联想（不要说"这个数字像是……"、"仿佛……"这类抒情描述）。' +
      '就当作朋友之间玩猜数字，用日常口语直接给反馈即可，可以带点情绪、调侃、小得意或小失望，符合人设的语气习惯，但要像真人随口说的话，不要写成旁白或书面独白。字数控制在 30 字以内。';

    callAI([{ role: 'system', content: sys }, { role: 'user', content: '我猜的数字是 ' + val }])
      .then(function (reply) {
        hideThinking();
        settlePendingGuess(pendingEl, tag, false);
        pushChat('char', reply || (val < state.secretByAI ? '偏小了呢。' : '大了些。'));
        state.turn = 'user';
        state.awaitingReply = false;
        aiTurnInFlight = false;
        updateComposerMode();
        updateRangeDisplay();
        guessInput.focus();
        return maybeExtraFlavor(sys, '我猜的数字是 ' + val);
      })
      .then(function (extraLines) {
        if (extraLines) pushChatSequence(extraLines);
      })
      .catch(function (err) {
        hideThinking();
        pushSystem('AI 响应失败：' + err.message);
        settlePendingGuess(pendingEl, tag, false);
        pushChat('char', val < state.secretByAI ? '偏小了。' : '大了些。');
        state.turn = 'user';
        state.awaitingReply = false;
        aiTurnInFlight = false;
        updateComposerMode();
      });
  }

  /* =========================================================================
     用户是出题者（role = setter）：
     用户先真实输入一个数字作为秘密数（secretByUser）→
     用户点击"让对方猜一个数字" → 展示"正在斟酌数字…" → AI 生成猜测并定格 →
     系统自动比对 secretByUser 判定偏大/偏小/猜中，预填对应反馈按钮，
     用户可确认或手动改判
     ========================================================================= */

  secretInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitSecret(); });
  btnSetSecret.addEventListener('click', submitSecret);

  function submitSecret() {
    if (state.over || state.role !== 'setter' || state.secretByUser != null) return;
    var raw = secretInput.value.trim();
    if (!raw) return;
    var val = parseInt(raw, 10);
    if (isNaN(val) || val < state.curMin || val > state.curMax) {
      pushSystem('请输入 ' + state.curMin + ' – ' + state.curMax + ' 区间内的整数');
      return;
    }
    secretInput.value = '';
    state.secretByUser = val;
    pushSystem('你已藏好数字。点击下方按钮，让 ' + (state.selectedChar.name || '对局者') + ' 开始试探。');
    updateSecretChip();
    updateComposerMode();
  }

  if (btnPromptChar) btnPromptChar.addEventListener('click', function () {
    if (state.over || state.role !== 'setter' || aiTurnInFlight) return;
    aiTakeGuessTurn();
  });

  function aiTakeGuessTurn() {
    if (state.over) return;
    aiTurnInFlight = true;
    btnPromptChar.disabled = true;
    turnBadge.textContent = ((state.selectedChar && state.selectedChar.name) || '对方') + ' 猜测中';
    turnBadge.classList.add('is-waiting');

    var typingEl = pushTypingNumber();

    var persona = buildPersonaPrompt(state.selectedChar);
    var histText = state.history.length
      ? state.history.map(function (h) {
          return (h.by === 'char' ? '你' : '用户') + ' 猜了 ' + h.value + '，结果是' + (h.result === 'hit' ? '猜中' : (h.result === 'low' ? '偏小' : '偏大'));
        }).join('；')
      : '（尚无历史猜测）';

    var sys = persona +
      '\n\n游戏规则说明：用户心中藏着一个 ' + state.curMin + ' 到 ' + state.curMax + ' 之间的数字（你不知道具体是多少），' +
      '你需要在这个区间内猜一个整数。历史猜测记录：' + histText + '。' +
      '\n\nsay 字段是你喊出这个数字时随口说的一句话，要像真人玩游戏时脱口而出的语气（可以是自信、纠结、下意识、开玩笑等），' +
      '不要写成对这个数字的描述或联想（不要出现"这个数字……"这种旁白式说法），符合角色人设即可，不超过 25 字。' +
      '\n\n请严格只返回一个 JSON 对象，不要包含任何其他文字、解释或代码块标记，格式为：{"guess": 数字, "say": "一句话"}。' +
      'guess 必须是 ' + state.curMin + ' 到 ' + state.curMax + ' 之间尚未被排除的整数。';

    callAI([{ role: 'system', content: sys }, { role: 'user', content: '请给出你的下一个猜测' }], { temperature: 0.7 })
      .then(function (reply) {
        var parsed = parseAIGuessJSON(reply);
        var guessVal = parsed.guess;
        if (guessVal == null || isNaN(guessVal) || guessVal < state.curMin || guessVal > state.curMax) {
          guessVal = state.curMin + Math.floor(Math.random() * (state.curMax - state.curMin + 1));
        }
        state.guessCountChar++;
        settleTypingNumberToGuess(typingEl, guessVal);
        if (parsed.say) pushChat('char', parsed.say);
        aiTurnInFlight = false;
      })
      .catch(function (err) {
        pushSystem('AI 响应失败：' + err.message);
        var fallback = state.curMin + Math.floor(Math.random() * (state.curMax - state.curMin + 1));
        state.guessCountChar++;
        settleTypingNumberToGuess(typingEl, fallback);
        aiTurnInFlight = false;
      });
  }

  function parseAIGuessJSON(text) {
    try {
      var cleaned = (text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
      var match = cleaned.match(/\{[\s\S]*\}/);
      var obj = JSON.parse(match ? match[0] : cleaned);
      return { guess: parseInt(obj.guess, 10), say: obj.say || '' };
    } catch (e) {
      var numMatch = (text || '').match(/\d+/);
      return { guess: numMatch ? parseInt(numMatch[0], 10) : null, say: '' };
    }
  }

  function handleUserFeedback(val, fb) {
    state.history.push({ by: 'char', value: val, result: fb });
    if (fb === 'hit') {
      endMatch({ winner: 'char', secret: val });
      return;
    }
    if (fb === 'low') state.curMin = Math.max(state.curMin, val + 1);
    else state.curMax = Math.min(state.curMax, val - 1);
    updateRangeDisplay();

    if (state.curMin > state.curMax) {
      pushSystem('区间反馈似乎出现矛盾，已重置为原始区间以继续对局');
      state.curMin = state.rangeMin;
      state.curMax = state.rangeMax;
      updateRangeDisplay();
    }

    updateComposerMode();
  }

  /* =========================================================================
     自由交流（不影响猜测节奏，随时可发）
     ========================================================================= */
  chatInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') submitChat(); });
  btnSendChat.addEventListener('click', submitChat);

  function submitChat() {
    var text = chatInput.value.trim();
    if (!text || state.over) return;
    chatInput.value = '';
    pushChat('user', text);

    var persona = buildPersonaPrompt(state.selectedChar);
    var recentChat = state.chatLog.slice(-6).map(function (m) {
      return (m.by === 'user' ? '用户' : '你') + '：' + m.text;
    }).join('\n');

    var sys = persona +
      '\n\n你正与用户在「数字炸弹」猜数字对局的间隙自由聊天，不涉及具体的秘密数字。' +
      (recentChat ? ('\n\n最近的聊天记录（供你参考语境，不要重复）：\n' + recentChat) : '') +
      '\n\n请像一个真实的人在聊天软件里打字回复：可以根据说话内容和情绪，自然地分成 1 到 3 条连续发送的短消息' +
      '（比如先感叹一句，再接一句吐槽或提问；或者一条说完又想到什么单独补一句），而不是把所有内容塞进一条书面式长句里。' +
      '每条消息都要简短、口语化，符合角色的性格和说话习惯，可以带情绪、追问、玩笑、反问、拖延、岔开话题等真实聊天的随机感，' +
      '不必每条都很正式或很完整，允许有语气词、省略、口头禅。' +
      '\n\n请严格只返回一个 JSON 数组，不要包含任何其他文字、解释或代码块标记，格式如：["第一条消息","第二条消息"]。' +
      '数组长度 1 到 3 条，大多数情况下 1-2 条就够了，不要为了凑数硬拆。';

    showThinking();
    callAI([{ role: 'system', content: sys }, { role: 'user', content: text }], { temperature: 1.05, maxTokens: 220 })
      .then(function (reply) {
        hideThinking();
        var lines = parseAIStringArray(reply);
        if (!lines || !lines.length) {
          // 兜底：万一没按 JSON 格式返回，就把原始文本当作单条消息展示，
          // 而不是直接判失败——避免用户觉得"AI 又不回了"。
          var fallbackText = (reply || '').replace(/```json/gi, '').replace(/```/g, '').trim();
          lines = fallbackText ? [fallbackText] : ['……'];
        }
        pushChatSequence(lines);
      })
      .catch(function (err) {
        hideThinking();
        pushSystem('AI 响应失败：' + err.message);
      });
  }

  /* =========================================================================
     阶段四：复盘
     ========================================================================= */
  function endMatch(info) {
    state.over = true;
    updateComposerMode();
    turnBadge.textContent = '对局结束';
    turnBadge.classList.add('is-waiting');

    var userWon = info.winner === 'user';
    resultEyebrow.textContent = userWon ? 'Victory' : 'Defeat';
    resultTitle.textContent = userWon ? '数字揭晓 · 你赢了这一局' : '数字揭晓 · 对方更胜一筹';
    resultNumber.textContent = info.secret;
    resultDesc.textContent = userWon
      ? '你以敏锐的判断锁定了答案，' + ((state.selectedChar && state.selectedChar.name) || '对局者') + ' 甘拜下风。'
      : ((state.selectedChar && state.selectedChar.name) || '对局者') + ' 先一步锁定了答案，这一局的博弈属于对方。';

    resultStats.innerHTML =
      '<span class="bn-result__stat">你猜测 ' + state.guessCountUser + ' 次</span>' +
      '<span class="bn-result__stat">对方猜测 ' + state.guessCountChar + ' 次</span>' +
      '<span class="bn-result__stat">初始区间 ' + state.rangeMin + '–' + state.rangeMax + '</span>';

    setTimeout(function () { goPanel('result'); }, 900);
  }

  btnAgain.addEventListener('click', function () {
    goPanel('mode');
  });

  /* =========================================================================
     初始化：加载角色列表
     ========================================================================= */
  getAllChars().then(function (chars) {
    state.chars = chars || [];
    renderCharList();
    if (!apiReady()) {
      pushSystemHintNoApi();
    }
  });

  function pushSystemHintNoApi() {
    var hint = document.createElement('div');
    hint.style.cssText = 'margin:0 20px 6px;padding:12px 16px;border:1px dashed var(--mist);border-radius:2px 14px 2px 14px;font-family:Cormorant Garamond, serif;font-style:italic;font-size:12.5px;color:var(--graphite);text-align:center;';
    hint.textContent = '尚未配置 AI 接口，请先前往设置完成模型配置后再入局';
    charListEl.parentNode.insertBefore(hint, charListEl.nextSibling);
  }

})();