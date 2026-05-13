/* ================================
   Chatroom — chatroom.js
================================ */
/* ================================================================
   消息长按气泡菜单 — Bubble Context Menu
================================================================ */
(function(){

  /* 菜单项定义 */
  const CTX_ITEMS = [
    { id:'copy',     label:'复制', icon:'⎘',  danger:false },
    { id:'quote',    label:'引用', icon:'❝',  danger:false },
    { id:'star',     label:'收藏', icon:'☆',  danger:false },
    { id:'edit',     label:'修改', icon:'✎',  danger:false },
    { id:'forward',  label:'转发', icon:'↗',  danger:false },
    { id:'multi',    label:'多选', icon:'☑',  danger:false },
    { id:'recall',   label:'撤回', icon:'↩',  danger:true  },
    { id:'delete',   label:'删除', icon:'✕',  danger:true  },
  ];

  const overlay  = document.getElementById('msgCtxOverlay');
  const backdrop = document.getElementById('msgCtxBackdrop');
  const mirror   = document.getElementById('msgCtxMirror');
  const menu     = document.getElementById('msgCtxMenu');
  const cancelBtn= document.getElementById('msgCtxCancel');

  let ctxTargetEl   = null; /* 被长按的气泡 wrap (.cr-msg-mine / .cr-msg-luna) */
  let ctxBubbleEl   = null; /* 气泡本身 (.cr-mine-bubble / .cr-luna-bubble) */
  let ctxMsgIndex   = -1;
  let longPressTimer= null;

  /* ── 构建菜单 ── */
  function buildMenu() {
    menu.innerHTML = '';
    CTX_ITEMS.forEach((item, idx) => {
      if (idx === 6) {
        /* 危险操作前加分隔线 */
        const sep = document.createElement('div');
        sep.className = 'msg-ctx-sep';
        menu.appendChild(sep);
      }
      const btn = document.createElement('button');
      btn.className = 'msg-ctx-item' + (item.danger ? ' danger' : '');
      btn.dataset.action = item.id;
      btn.innerHTML =
        `<div class="msg-ctx-icon">${item.icon}</div>` +
        `<div class="msg-ctx-label">${item.label}</div>`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleAction(item.id);
      });
      menu.appendChild(btn);
    });
  }

  /* ── 打开菜单 ── */
  function openCtxMenu(msgWrapEl) {
    ctxTargetEl = msgWrapEl;
    const isMine = msgWrapEl.classList.contains('cr-msg-mine');
    ctxBubbleEl = msgWrapEl.querySelector(isMine ? '.cr-mine-bubble' : '.cr-luna-bubble');

    /* 找到在 crMessages 数组中的索引 */
    const allWrap = document.querySelectorAll('.cr-msg-mine, .cr-msg-luna');
    ctxMsgIndex = Array.from(allWrap).indexOf(msgWrapEl);

    /* 气泡震动反馈 */
    ctxBubbleEl.classList.add('ctx-selecting');
    setTimeout(() => ctxBubbleEl.classList.remove('ctx-selecting'), 200);

    /* 计算气泡在屏幕中的位置，用于镜像定位 */
    const rect = ctxBubbleEl.getBoundingClientRect();

    /* 镜像气泡（纯视觉，不可交互） */
    mirror.innerHTML = ctxBubbleEl.outerHTML;
    mirror.style.top    = rect.top  + 'px';
    mirror.style.left   = rect.left + 'px';
    mirror.style.width  = rect.width + 'px';

    buildMenu();

    /* 菜单位置：气泡上方居中，防止超出屏幕 */
    const menuH = 72; /* 估算高度 */
    const menuW = Math.min(window.innerWidth - 24, CTX_ITEMS.length * 56 + 20);
    let menuTop  = rect.top - menuH - 12;
    let menuLeft = rect.left + rect.width / 2 - menuW / 2;

    if (menuTop < 60) menuTop = rect.bottom + 12;
    menuLeft = Math.max(12, Math.min(menuLeft, window.innerWidth - menuW - 12));

    menu.style.top  = menuTop  + 'px';
    menu.style.left = menuLeft + 'px';
    menu.style.width = menuW   + 'px';

    overlay.classList.add('open');
  }

  /* ── 关闭菜单 ── */
  function closeCtxMenu() {
    overlay.classList.remove('open');
    ctxTargetEl = null;
    ctxBubbleEl = null;
    ctxMsgIndex = -1;
    mirror.innerHTML = '';
    menu.innerHTML   = '';
  }

  /* ── 执行操作 ── */
  function handleAction(action) {
    if (ctxMsgIndex < 0 || ctxMsgIndex >= crMessages.length) {
      closeCtxMenu(); return;
    }
    const msg = crMessages[ctxMsgIndex];

    switch(action) {

      case 'copy':
        navigator.clipboard.writeText(msg.text).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = msg.text; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
        });
        crShowTip('已复制');
        break;

      case 'quote':
        /* 把引用文字填入输入框 */
        var box = document.getElementById('crInputBox');
        if (box) {
          var shortText = msg.text.length > 20 ? msg.text.slice(0,20)+'…' : msg.text;
          box.textContent = '「' + shortText + '」\n';
          box.style.color = '#1a1a1a';
          box.focus();
          /* 光标移到末尾 */
          var range = document.createRange();
          range.selectNodeContents(box);
          range.collapse(false);
          var sel = window.getSelection();
          sel.removeAllRanges(); sel.addRange(range);
        }
        break;

      case 'star':
        /* 收藏：存入 localStorage */
        var stars = JSON.parse(localStorage.getItem('luna_starred') || '[]');
        stars.push({ text: msg.text, time: msg.time, from: CR_NAME, savedAt: Date.now() });
        localStorage.setItem('luna_starred', JSON.stringify(stars));
        crShowTip('已收藏 ★');
        break;

      case 'edit':
        /* 修改：将文字填入输入框供二次编辑 */
        var box2 = document.getElementById('crInputBox');
        if (box2) {
          box2.textContent = msg.text;
          box2.style.color = '#1a1a1a';
          box2.focus();
        }
        crShowTip('内容已填入输入框，修改后重新发送');
        break;

      case 'recall':
        if (msg.role === 'mine') {
          /* 撤回：从数组和 DOM 删除，显示系统提示 */
          crMessages.splice(ctxMsgIndex, 1);
          dbSaveMessages(CR_NAME, crMessages);
          if (ctxTargetEl) ctxTargetEl.remove();
          crShowTip('消息已撤回');
        } else {
          crShowTip('只能撤回自己的消息');
        }
        break;

      case 'delete':
        crMessages.splice(ctxMsgIndex, 1);
        dbSaveMessages(CR_NAME, crMessages);
        if (ctxTargetEl) ctxTargetEl.remove();
        crShowTip('消息已删除');
        break;

      case 'forward':
        crShowTip('转发功能开发中～');
        break;

      case 'multi':
        crShowTip('多选功能开发中～');
        break;
    }
    closeCtxMenu();
  }

  /* ── 绑定长按到消息区（事件委托） ── */
  var msgArea = document.getElementById('crMessages');
  if (msgArea) {
    /* Touch 长按：500ms */
    msgArea.addEventListener('touchstart', function(e) {
      var bubble = e.target.closest('.cr-mine-bubble, .cr-luna-bubble');
      if (!bubble) return;
      var wrap = bubble.closest('.cr-msg-mine, .cr-msg-luna');
      if (!wrap) return;

      longPressTimer = setTimeout(function() {
        openCtxMenu(wrap);
        /* 防止触发 click/scroll */
        e.preventDefault();
      }, 500);
    }, { passive: false });

    msgArea.addEventListener('touchmove', function() {
      clearTimeout(longPressTimer);
    });
    msgArea.addEventListener('touchend', function() {
      clearTimeout(longPressTimer);
    });
    msgArea.addEventListener('touchcancel', function() {
      clearTimeout(longPressTimer);
    });

    /* 桌面端：右键菜单 */
    msgArea.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
      var bubble = e.target.closest('.cr-mine-bubble, .cr-luna-bubble');
      if (!bubble) return;
      var wrap = bubble.closest('.cr-msg-mine, .cr-msg-luna');
      if (!wrap) return;
      openCtxMenu(wrap);
    });
  }

  /* ── 关闭按钮 ── */
  cancelBtn.addEventListener('click', closeCtxMenu);
  backdrop.addEventListener('click',  closeCtxMenu);

})();
/* ================================
   Feature Panel — 13 功能卡
================================ */
(function(){

const FP_CARDS = [
  { no:'01', tag:'History',  title:'重回',  sub:'时光倒流', desc:'回溯每一次对话的温度与轨迹。',
    art:'history',  bg:'#1a1a1a' },
  { no:'02', tag:'Image',    title:'图片',  sub:'视觉记忆', desc:'分享照片，让Ta看见你的世界。',
    art:'image',    bg:'#f7f5f2' },
  { no:'03', tag:'Meme',     title:'表情包',sub:'情绪表达', desc:'一张图胜过千言万语。',
    art:'meme',     bg:'#2a2a2a' },
  { no:'04', tag:'Voice',    title:'语音',  sub:'声音印记', desc:'用声音传递最真实的情感。',
    art:'voice',    bg:'#111' },
  { no:'05', tag:'Video',    title:'视频',  sub:'动态瞬间', desc:'把最美的一帧留给彼此。',
    art:'video',    bg:'#1c1c1c' },
  { no:'06', tag:'Location', title:'位置',  sub:'此刻所在', desc:'告诉Ta你在哪里，Ta总在这里。',
    art:'location', bg:'#f5f5f0' },
  { no:'07', tag:'Transfer', title:'转账',  sub:'心意流转', desc:'数字温情，轻轻传递。',
    art:'transfer', bg:'#fafafa' },
  { no:'08', tag:'Hongbao',  title:'红包',  sub:'惊喜彩蛋', desc:'随手一份红，带来好运气。',
    art:'hongbao',  bg:'#1a1a1a' },
  { no:'09', tag:'Whisper',  title:'心声',  sub:'私密倾诉', desc:'只有你们两个人知道的秘密。',
    art:'whisper',  bg:'#2c2828' },
  { no:'10', tag:'Offline',  title:'线下',  sub:'真实相遇', desc:'从屏幕走向现实的约定。',
    art:'offline',  bg:'#f0ede8' },
  { no:'11', tag:'Gift',     title:'礼物',  sub:'惊喜盒子', desc:'每天解锁一份专属的彩蛋。',
    art:'gift',     bg:'#fafafa' },
  { no:'12', tag:'Journey',  title:'旅程',  sub:'共同成长', desc:'记录你们走过的每一段路。',
    art:'journey',  bg:'#1a1a1a' },
  { no:'13', tag:'Private',  title:'私密',  sub:'专属空间', desc:'只属于你们，加密且唯一。',
    art:'private',  bg:'#111' },
];

function makeArt(type, bg){
  const dark = bg.startsWith('#1') || bg.startsWith('#2') || bg === '#111';
  const fg = dark ? '#fff' : '#1a1a1a';
  const fgo = dark ? 'rgba(255,255,255,' : 'rgba(26,26,26,';

  const arts = {
    history:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="88" r="42" stroke="${fg}" stroke-width="0.5" opacity="0.2"/>
      <circle cx="80" cy="88" r="28" stroke="${fg}" stroke-width="0.7" opacity="0.35"/>
      <line x1="80" y1="88" x2="80" y2="64" stroke="${fg}" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <line x1="80" y1="88" x2="96" y2="96" stroke="${fg}" stroke-width="0.9" stroke-linecap="round" opacity="0.5"/>
      <circle cx="80" cy="88" r="3" fill="${fg}" opacity="0.7"/>
      <path d="M52 88 Q56 72 68 66" stroke="${fg}" stroke-width="0.5" opacity="0.25" fill="none" stroke-dasharray="2 3"/>
      <text x="80" y="168" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.28)" letter-spacing="3">HISTORY</text>
    </svg>`,
    image:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="35" y="45" width="90" height="100" rx="4" stroke="${fg}" stroke-width="0.6" opacity="0.25"/>
      <circle cx="60" cy="72" r="10" stroke="${fg}" stroke-width="0.5" opacity="0.3"/>
      <path d="M35 118 L65 90 L88 112 L105 94 L125 118" stroke="${fg}" stroke-width="0.7" opacity="0.3" fill="none"/>
      <text x="80" y="172" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">IMAGE</text>
    </svg>`,
    meme:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="85" r="40" stroke="${fg}" stroke-width="0.6" opacity="0.22"/>
      <circle cx="66" cy="76" r="5" fill="${fg}" opacity="0.3"/>
      <circle cx="94" cy="76" r="5" fill="${fg}" opacity="0.3"/>
      <path d="M60 98 Q80 116 100 98" stroke="${fg}" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.45"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">MEME</text>
    </svg>`,
    voice:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <g opacity="0.5">
        <line x1="38" y1="92" x2="38" y2="108" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="50" y1="80" x2="50" y2="120" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="62" y1="70" x2="62" y2="130" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="74" y1="82" x2="74" y2="118" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="80" y1="62" x2="80" y2="138" stroke="${fg}" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="86" y1="75" x2="86" y2="125" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="98" y1="84" x2="98" y2="116" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="110" y1="78" x2="110" y2="122" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="122" y1="90" x2="122" y2="110" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
      </g>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">VOICE</text>
    </svg>`,
    video:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="28" y="68" width="72" height="52" rx="5" stroke="${fg}" stroke-width="0.6" opacity="0.3"/>
      <path d="M102 82 L126 72 L126 116 L102 106Z" stroke="${fg}" stroke-width="0.6" opacity="0.3" fill="none"/>
      <circle cx="64" cy="94" r="12" fill="none" stroke="${fg}" stroke-width="0.5" opacity="0.2"/>
      <path d="M60 90 L74 94 L60 98Z" fill="${fg}" opacity="0.25"/>
      <text x="80" y="172" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">VIDEO</text>
    </svg>`,
    location:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="78" r="26" stroke="${fg}" stroke-width="0.6" opacity="0.25"/>
      <circle cx="80" cy="78" r="8" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.5"/>
      <path d="M80 52 L80 104 M54 78 L106 78" stroke="${fg}" stroke-width="0.4" opacity="0.15" stroke-dasharray="3 4"/>
      <path d="M80 110 Q80 130 80 138" stroke="${fg}" stroke-width="1" opacity="0.3" stroke-linecap="round"/>
      <circle cx="80" cy="140" r="3" fill="${fg}" opacity="0.3"/>
      <text x="80" y="172" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">LOCATION</text>
    </svg>`,
    transfer:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="40" y="60" width="80" height="52" rx="6" stroke="${fg}" stroke-width="0.6" opacity="0.22"/>
      <line x1="40" y1="78" x2="120" y2="78" stroke="${fg}" stroke-width="0.5" opacity="0.15"/>
      <text x="80" y="95" text-anchor="middle" font-family="serif" font-size="18" fill="${fgo}0.3)">¥</text>
      <path d="M55 128 L80 118 L105 128" stroke="${fg}" stroke-width="0.6" opacity="0.2" fill="none"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">TRANSFER</text>
    </svg>`,
    hongbao:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="44" y="55" width="72" height="90" rx="6" stroke="${fg}" stroke-width="0.6" opacity="0.3"/>
      <path d="M44 78 L80 95 L116 78" stroke="${fg}" stroke-width="0.5" opacity="0.25" fill="none"/>
      <circle cx="80" cy="110" r="14" stroke="${fg}" stroke-width="0.6" opacity="0.3"/>
      <text x="80" y="115" text-anchor="middle" font-family="serif" font-size="12" fill="${fgo}0.35)">福</text>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">HONGBAO</text>
    </svg>`,
    whisper:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <path d="M30 75 Q30 55 50 55 L110 55 Q130 55 130 75 L130 100 Q130 120 110 120 L95 120 L80 140 L80 120 L50 120 Q30 120 30 100Z"
        stroke="${fg}" stroke-width="0.6" opacity="0.28" fill="none"/>
      <line x1="50" y1="78" x2="110" y2="78" stroke="${fg}" stroke-width="0.4" opacity="0.2"/>
      <line x1="50" y1="88" x2="90" y2="88" stroke="${fg}" stroke-width="0.4" opacity="0.2"/>
      <line x1="50" y1="98" x2="105" y2="98" stroke="${fg}" stroke-width="0.4" opacity="0.2"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">WHISPER</text>
    </svg>`,
    offline:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="82" r="35" stroke="${fg}" stroke-width="0.5" opacity="0.18"/>
      <line x1="46" y1="82" x2="114" y2="82" stroke="${fg}" stroke-width="0.4" opacity="0.18"/>
      <ellipse cx="80" cy="82" rx="18" ry="35" stroke="${fg}" stroke-width="0.4" opacity="0.18"/>
      <circle cx="80" cy="82" r="4" fill="${fg}" opacity="0.35"/>
      <line x1="55" y1="130" x2="105" y2="130" stroke="${fg}" stroke-width="0.6" opacity="0.22"/>
      <line x1="65" y1="136" x2="95" y2="136" stroke="${fg}" stroke-width="0.4" opacity="0.15"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">OFFLINE</text>
    </svg>`,
    gift:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="48" y="85" width="64" height="52" rx="2" fill="none" stroke="${fg}" stroke-width="0.6" opacity="0.28"/>
      <rect x="46" y="72" width="68" height="16" rx="2" fill="none" stroke="${fg}" stroke-width="0.6" opacity="0.28"/>
      <line x1="80" y1="72" x2="80" y2="137" stroke="${fg}" stroke-width="0.5" opacity="0.18"/>
      <path d="M80 72 C80 72 70 58 62 61 C54 64 62 72 80 72Z" fill="none" stroke="${fg}" stroke-width="0.5" opacity="0.25"/>
      <path d="M80 72 C80 72 90 58 98 61 C106 64 98 72 80 72Z" fill="none" stroke="${fg}" stroke-width="0.5" opacity="0.25"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">GIFT</text>
    </svg>`,
    journey:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <path d="M28 120 Q55 60 80 80 Q105 100 132 45" stroke="${fg}" stroke-width="0.8" fill="none" opacity="0.35"/>
      <circle cx="28"  cy="120" r="3" fill="${fg}" opacity="0.4"/>
      <circle cx="80"  cy="80"  r="3" fill="${fg}" opacity="0.55"/>
      <circle cx="132" cy="45"  r="3" fill="${fg}" opacity="0.4"/>
      <line x1="28" y1="120" x2="28" y2="138" stroke="${fg}" stroke-width="0.4" opacity="0.2" stroke-dasharray="2 2"/>
      <line x1="80" y1="80"  x2="80" y2="138" stroke="${fg}" stroke-width="0.4" opacity="0.2" stroke-dasharray="2 2"/>
      <line x1="132" y1="45" x2="132" y2="138" stroke="${fg}" stroke-width="0.4" opacity="0.2" stroke-dasharray="2 2"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">JOURNEY</text>
    </svg>`,
    private:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="56" y="88" width="48" height="38" rx="4" stroke="${fg}" stroke-width="0.6" opacity="0.4"/>
      <path d="M66 88 L66 78 Q66 58 80 58 Q94 58 94 78 L94 88" stroke="${fg}" stroke-width="0.6" opacity="0.4" fill="none"/>
      <circle cx="80" cy="107" r="5" fill="${fg}" opacity="0.35"/>
      <line x1="80" y1="112" x2="80" y2="120" stroke="${fg}" stroke-width="1" opacity="0.25" stroke-linecap="round"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">PRIVATE</text>
    </svg>`,
  };
  return arts[type] || arts.history;
}

const stage   = document.getElementById('fpStage');
const dotsEl  = document.getElementById('fpDots');
const SPREAD  = 20;
let fpCurrent = Math.floor(FP_CARDS.length / 2);
let isDrag = false, startX = 0, lastX = 0, dragDelta = 0;
const cardEls = [];

function getAngle(i){ return 0; }
function getZ(i){ return FP_CARDS.length - Math.abs(i - fpCurrent); }
function getOp(i){
  const d = Math.abs(i - fpCurrent);
  return d === 0 ? 1 : d === 1 ? 0.7 : d === 2 ? 0.4 : 0;
}
function getSc(i){
  const d = Math.abs(i - fpCurrent);
  return d === 0 ? 1 : d === 1 ? 0.88 : 0.78;
}

FP_CARDS.forEach((c, i) => {
  const el = document.createElement('div');
  el.className = 'fp-card';
  el.innerHTML = `
    <div class="fp-card-art" style="background:${c.bg}">${makeArt(c.art, c.bg)}</div>
    <div class="fp-card-no">${c.no}</div>
    <div class="fp-card-footer">
      <div class="fp-card-tag">${c.tag}</div>
      <div class="fp-card-title">${c.title}</div>
      <div class="fp-card-sub">${c.sub}</div>
    </div>`;
  el.addEventListener('click', () => {
    if (Math.abs(dragDelta) < 5) {
      i === fpCurrent ? updateDetail() : goTo(i);
    }
  });
  stage.appendChild(el);
  cardEls.push(el);

  const dot = document.createElement('div');
  dot.className = 'fan-dot' + (i === fpCurrent ? ' active' : '');
  dot.addEventListener('click', () => goTo(i));
  dotsEl.appendChild(dot);
});

function updateCards(live = 0){
  const stageW = stage.offsetWidth || 340;
  const centerX = stageW / 2;
  const cardW = 160;
  const gap = 170;

  cardEls.forEach((el, i) => {
    const offset = (i - fpCurrent) + live;
    const x = centerX - cardW / 2 + offset * gap;
    const d = Math.abs(i - fpCurrent);
    const arcY = d === 0 ? 35 : d === 1 ? 42 : 60;
const rot = (i - fpCurrent) * 30;
const sc = getSc(i);
const op = getOp(i);
el.style.transform = `translateX(${x}px) translateY(${arcY}px) rotate(${rot}deg) scale(${sc})`;
    el.style.zIndex  = getZ(i);
    el.style.opacity = op;
    el.style.pointerEvents = op === 0 ? 'none' : 'auto';
  });
}

function updateDots(){
  dotsEl.querySelectorAll('.fan-dot').forEach((d, i) => {
    d.className = 'fan-dot' + (i === fpCurrent ? ' active' : '');
  });
}

function updateDetail(){
  const d = FP_CARDS[fpCurrent];
  document.getElementById('fpDetailName').textContent = d.title;
  document.getElementById('fpDetailDesc').textContent = d.desc;
  document.getElementById('fpDetailIcon').innerHTML =
    `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
       <text x="10" y="14" text-anchor="middle" font-family="serif" font-size="13" fill="#888">${d.title[0]}</text>
     </svg>`;
}

function goTo(idx){
  fpCurrent = Math.max(0, Math.min(FP_CARDS.length - 1, idx));
  updateCards();
  updateDots();
  updateDetail();
}

updateCards();
updateDetail();

document.getElementById('fpPrev').addEventListener('click', () => goTo(fpCurrent - 1));
document.getElementById('fpNext').addEventListener('click', () => goTo(fpCurrent + 1));

stage.addEventListener('pointerdown', e => {
  isDrag = true; startX = e.clientX; lastX = e.clientX; dragDelta = 0;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!isDrag) return;
  lastX = e.clientX; dragDelta = lastX - startX;
  updateCards(dragDelta * -0.12);
});
stage.addEventListener('pointerup', () => {
  if (!isDrag) return; isDrag = false;
  dragDelta = lastX - startX;
  if (Math.abs(dragDelta) > 40) goTo(fpCurrent + (dragDelta < 0 ? 1 : -1));
  else updateCards();
  dragDelta = Math.abs(dragDelta);
});
stage.addEventListener('pointercancel', () => { isDrag = false; updateCards(); });

/* ── 开关 overlay ── */
const overlay = document.getElementById('featureOverlay');

function openFP(){ overlay.classList.add('open'); }
function closeFP(){ overlay.classList.remove('open'); }

document.getElementById('fpCloseBtn').addEventListener('click', closeFP);
document.getElementById('overlayBackdrop').addEventListener('click', closeFP);

/* 绑定 + 按钮 */
const addBtn = document.querySelector('.cr-add-btn');
if (addBtn) addBtn.addEventListener('click', openFP);

})();

/* ---- 当前角色名（从 localStorage 读） ---- */
const CR_NAME = localStorage.getItem('luna_current_chat') || 'Luna';

/* ---- IndexedDB：按角色独立存取消息 ---- */
let _crDB = null;

const LUNA_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
};

function getCrDB() {
  return new Promise((res, rej) => {
    if (_crDB) { res(_crDB); return; }

    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(LUNA_STORES).filter(
        name => !db.objectStoreNames.contains(name)
      );
      db.close();

      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _crDB = e2.target.result; res(_crDB); };
        reopen.onerror   = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) {
              udb.createObjectStore(name, LUNA_STORES[name]);
            }
          });
        };
        upgrade.onsuccess = e2 => { _crDB = e2.target.result; res(_crDB); };
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

/* 保存某个角色的全部消息（传入消息数组） */
function dbSaveMessages(name, msgs) {
  getCrDB().then(db => {
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').put({ chatKey: name, msgs });
  }).catch(() => {});
}

/* 读取某个角色的全部消息 */
async function dbLoadMessages(name) {
  try {
    const db = await getCrDB();
    return new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 当前聊天的消息数组（内存） */
let crMessages = [];

/* ================================================================
   头像缓存 — 从 LunaCharDB 加载后全局复用
================================================================ */
let _crAvatarUrl = null; // 加载成功后存 url/base64，null=未加载，false=无头像

function crLoadAvatarCache() {
  return new Promise(resolve => {
    if (_crAvatarUrl !== null) { resolve(_crAvatarUrl); return; }
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { _crAvatarUrl = false; resolve(false); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === CR_NAME);
        _crAvatarUrl = (found && found.avatar) ? found.avatar : false;
        resolve(_crAvatarUrl);
      };
      r.onerror = () => { _crAvatarUrl = false; resolve(false); };
    };
    req.onerror = () => { _crAvatarUrl = false; resolve(false); };
  });
}

/* 生成小头像 HTML（消息气泡 & typing 共用） */
function crMiniAvHtml() {
  if (_crAvatarUrl) {
    return `<div class="cr-mini-av" style="flex-shrink:0;width:28px;height:28px;border-radius:50%;overflow:hidden;">` +
      `<img src="${_crAvatarUrl}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;" /></div>`;
  }
  return '<div class="cr-mini-av">' + crMiniAvSvg() + '</div>';
}

/* 实时时钟 */
function crTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: tz
  });
  const el = document.getElementById('crTime');
  if (el) el.textContent = timeStr;

  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}
crTick();
setInterval(crTick, 10000);

document.addEventListener('DOMContentLoaded', async function () {
  applyIsland();
  applyGlobalFont();

  /* 预加载头像缓存，让后续气泡直接用 */
  await crLoadAvatarCache();

  crInitStats();
  crInitHeader();

  await crRestoreMessages();

  var backBtn = document.getElementById('crBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      localStorage.setItem('luna_conv_dirty', '1');
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'chat.html';
      }
    });
  }

  var placeholder = '向 ' + CR_NAME + ' 发送消息';
  document.querySelectorAll('.cr-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var box = document.getElementById('crInputBox');
      if (!box) return;
      var txt = chip.querySelector('span') ? chip.querySelector('span').textContent : '';
      box.textContent = txt;
      box.style.color = '#1a1a1a';
      box.focus();
    });
  });

  var inputBox = document.getElementById('crInputBox');
  if (inputBox) {
    inputBox.textContent = placeholder;
    inputBox.style.color = '#c0bab2';
    inputBox.addEventListener('focus', function () {
      if (inputBox.textContent.trim() === placeholder) {
        inputBox.textContent = '';
        inputBox.style.color = '#1a1a1a';
      }
    });
    inputBox.addEventListener('blur', function () {
      if (!inputBox.textContent.trim()) {
        inputBox.textContent = placeholder;
        inputBox.style.color = '#c0bab2';
      }
    });
    inputBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        crSend();
      }
    });
  }

  var sendBtn = document.getElementById('crSendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', crSend);
  }

  /* 绑定 AI 按钮 */
  document.querySelector('.cr-ai-btn')?.addEventListener('click', crAiReply);
});

/* ── 同步头部角色信息 ── */
function crInitHeader() {
  var nameEl = document.querySelector('.cr-name');
  if (nameEl) nameEl.textContent = CR_NAME;

  document.querySelectorAll('.cr-footer-lbl').forEach(function(el) {
    el.textContent = CR_NAME.toUpperCase();
  });

  document.title = CR_NAME + ' · 聊天';

  var req = indexedDB.open('LunaCharDB', 4);
  req.onsuccess = function(e) {
    var db = e.target.result;
    if (!db.objectStoreNames.contains('chars')) return;
    var r = db.transaction('chars').objectStore('chars').getAll();
    r.onsuccess = function() {
      var chars = r.result || [];
      var found = chars.find(function(c) { return c.name === CR_NAME; });
      if (!found) return;
      var subEl = document.querySelector('.cr-sub');
      if (subEl && found.role) subEl.textContent = found.role;
      if (found.avatar) {
        var avWrap = document.querySelector('.cr-avatar');
        if (avWrap) {
          avWrap.style.backgroundImage = 'url(' + found.avatar + ')';
          avWrap.style.backgroundSize = 'cover';
          avWrap.style.borderRadius = '50%';
        }
      }
    };
  };
}

/* ── 头部三栏统计动态初始化 ── */
function crInitStats() {
  var name = localStorage.getItem('luna_current_chat') || 'Luna';

  var lunaNameEl = document.querySelector('.cr-stat-luna-row span');
  if (lunaNameEl) lunaNameEl.textContent = name;

  /* 头像：优先用已缓存的 _crAvatarUrl */
  var avatarInner = document.getElementById('crAvatarInner');
  if (avatarInner) {
    function renderAvatar(avatarSrc) {
      if (avatarSrc) {
        var img = document.createElement('img');
        img.src = avatarSrc;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
        avatarInner.innerHTML = '';
        avatarInner.appendChild(img);
      } else {
        avatarInner.textContent = name[0] || '?';
      }
    }

    if (_crAvatarUrl !== null) {
      renderAvatar(_crAvatarUrl);
    } else {
      var charProbe = indexedDB.open('LunaCharDB');
      charProbe.onsuccess = function(ev) {
        var cdb = ev.target.result;
        if (!cdb.objectStoreNames.contains('chars')) {
          renderAvatar(false); return;
        }
        var cr = cdb.transaction('chars').objectStore('chars').getAll();
        cr.onsuccess = function() {
          var found = (cr.result || []).find(function(c) { return c.name === name; });
          renderAvatar(found && found.avatar ? found.avatar : false);
        };
      };
    }
  }

  var probe = indexedDB.open('LunaChatDB');
  probe.onsuccess = function(e) {
    var db = e.target.result;

    if (db.objectStoreNames.contains('messages')) {
      var r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = function() {
        var msgs = r.result ? (r.result.msgs || []) : [];
        var countEl = document.querySelector('.cr-stat:nth-child(1) .cr-stat-val');
        if (countEl) countEl.textContent = msgs.length;
      };
    }

    if (db.objectStoreNames.contains('conv')) {
      var r2 = db.transaction('conv').objectStore('conv').get(name);
      r2.onsuccess = function() {
        var item = r2.result;
        var daysEl = document.querySelector('.cr-stat:nth-child(2) .cr-stat-val');
        if (daysEl && item && item.createdAt) {
          var diffMs = Date.now() - item.createdAt;
          var days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          daysEl.textContent = days + 'd';
        } else if (daysEl) {
          daysEl.textContent = '0d';
        }
      };
    }
  };
}

/* ── 恢复历史消息到 DOM ── */
async function crRestoreMessages() {
  crMessages = await dbLoadMessages(CR_NAME);
  var area = document.getElementById('crMessages');
  if (!area) return;

  area.innerHTML = '';

  if (crMessages.length > 0) {
    crMessages.forEach(function(msg) {
      var el = crBuildMsgEl(msg);
      if (el) area.appendChild(el);
    });
  }

  area.scrollTop = area.scrollHeight;
}

/* ── 根据消息对象构建 DOM 元素 ── */
function crBuildMsgEl(msg) {
  var el = document.createElement('div');
  if (msg.role === 'mine') {
    el.className = 'cr-msg-mine';
    el.innerHTML =
      '<div class="cr-mine-bubble">' +
        '<p class="cr-msg-p" style="padding-left:0;color:#f2f0eb">' + escHtml(msg.text) + '</p>' +
      '</div>' +
      '<div class="cr-mine-meta">' +
        '<span class="cr-mine-time">' + msg.time + '</span>' +
      '</div>';
  } else {
    el.className = 'cr-msg-luna';
    el.innerHTML =
      crMiniAvHtml() +
      '<div>' +
        '<div class="cr-luna-bubble">' +
          '<div class="cr-luna-accent"></div>' +
          '<p class="cr-msg-p">' + escHtml(msg.text) + '</p>' +
          '<div class="cr-msg-footer">' +
            '<svg width="10" height="10" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#ccc"/></svg>' +
            '<span class="cr-footer-lbl">' + CR_NAME.toUpperCase() + '</span>' +
          '</div>' +
        '</div>' +
        '<p class="cr-msg-time">' + msg.time + '</p>' +
      '</div>';
  }
  return el;
}

function crMiniAvSvg() {
  return '<svg width="28" height="28" viewBox="0 0 28 28">' +
    '<circle cx="14" cy="14" r="14" fill="#e8e8e8"/>' +
    '<ellipse cx="14" cy="10" rx="6" ry="5.5" fill="#c8c8c8"/>' +
    '<ellipse cx="14" cy="10" rx="4.2" ry="4.2" fill="#dcdcdc"/>' +
    '<ellipse cx="14" cy="22" rx="8" ry="6" fill="#d0d0d0"/>' +
  '</svg>';
}

function crBuildTyping() {
  var el = document.createElement('div');
  el.className = 'cr-typing';
  el.id = 'crTyping';
  el.innerHTML =
    crMiniAvHtml() +
    '<div class="cr-typing-bubble">' +
      '<div class="cr-tdot"></div>' +
      '<div class="cr-tdot"></div>' +
      '<div class="cr-tdot"></div>' +
    '</div>';
  return el;
}

/* XSS 防护 */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function crSend() {
  var placeholder = '向 ' + CR_NAME + ' 发送消息';
  var box = document.getElementById('crInputBox');
  var area = document.getElementById('crMessages');
  if (!box || !area) return;

  var txt = box.textContent.trim();
  if (!txt || txt === placeholder) return;

  var tw = document.getElementById('crTyping');
  if (tw) tw.remove();

  var n = new Date();
  var t = n.getHours().toString().padStart(2, '0') + ':' +
          n.getMinutes().toString().padStart(2, '0');

  var msgObj = { role: 'mine', text: txt, time: t };
  crMessages.push(msgObj);

  var el = crBuildMsgEl(msgObj);
  area.appendChild(el);

  dbSaveMessages(CR_NAME, crMessages);

  getCrDB().then(function(db) {
    var tx = db.transaction('conv', 'readwrite');
    var store = tx.objectStore('conv');
    var req = store.get(CR_NAME);
    req.onsuccess = function() {
      var item = req.result;
      if (item) {
        item.preview = txt;
        item.time = t;
        item.timeVal = Date.now();
        store.put(item);
      } else {
        store.put({
          name: CR_NAME,
          initial: CR_NAME[0],
          preview: txt,
          time: t,
          timeVal: Date.now(),
          createdAt: Date.now(),
          unread: 0, online: false, pinned: false, type: 'def'
        });
      }
    };
  }).catch(function() {});

  box.textContent = placeholder;
  box.style.color = '#c0bab2';

  area.scrollTop = area.scrollHeight;
}

/* 灵动岛同步 */
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };
  el.innerHTML = styleMap[style] || styleMap.minimal;
  clearInterval(window._siClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* 字体同步 */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts')) {
            d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
          }
        };
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
      });
      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror   = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch(e) {}
  }
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

window.addEventListener('storage', function(e) {
  if (e.key === 'luna_font_update' || e.key === 'luna_font_style') applyGlobalFont();
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') applyIsland();
  if (e.key === 'luna_tz_update') crTick();
});

window.addEventListener('pageshow', function(e) {
  if (e.persisted) window.location.reload();
});

/* ================================================================
   AI 回复模块
================================================================ */

/* ── 从 LunaCharDB 读角色完整人设（同时更新头像缓存） ── */
function crLoadCharProfile(name) {
  return new Promise(resolve => {
    const req = indexedDB.open('LunaCharDB', 4);
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === name);
        if (found?.avatar) _crAvatarUrl = found.avatar;
        resolve(found || null);
      };
      r.onerror = () => resolve(null);
    };
    req.onerror = () => resolve(null);
  });
}

/* ── 构建 system prompt ── */
function crBuildSystemPrompt(char, situation) {
  const name    = char?.name    || CR_NAME;
  const role    = char?.role    || '';
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';
  const bg      = char?.background || char?.story || '';

  // situation: 'reply'=正常回复用户 | 'initiative'=用户没说话主动破冰 | 'continue'=已回复过催续
  const situationNote = situation === 'initiative'
    ? '\n【当前情况】用户打开了聊天界面但还没有说话。请你用角色口吻自然地主动开口说一两句，随意自然，不要正式，不要问太多问题，就像看到对方上线随口说一句话那种感觉。'
    : situation === 'continue'
    ? '\n【当前情况】对方还没有回复你最后的消息。你可以追一句，或者发个表情/感叹，或者自顾自说个别的，像真人那样，短短一句就好，别催得太明显。'
    : '';

  return `你现在扮演「${name}」，一个真实存在的人，绝对不是 AI 或助手。

【角色身份】
名字：${name}
${role    ? `定位：${role}`        : ''}
${persona ? `人物简介：${persona}` : ''}
${traits  ? `性格特点：${traits}`  : ''}
${bg      ? `背景故事：${bg}`      : ''}

【说话规则 — 必须严格遵守】
1. 你就是 ${name}，有血有肉、有情绪、有口头禅，永远不承认自己是 AI。
2. 严禁任何动作/神情描写：不能出现（笑）（叹气）（翻白眼）*点头* 这类括号或星号包裹的内容，真人发消息不会写这些。
3. 把回复拆成多条短消息，每条之间用换行符分隔，每条不超过25个字，像真人连发消息。
4. 自然带入话题：顺势聊自己的事、反问对方、引发好奇，有来有往，不要每条都在表达关心。
5. 语气有起伏：有时热情，有时随意，有时调皮，有时淡淡的，不要每条都热情洋溢。
6. 严禁 Markdown 格式，无加粗、无列表、无标题。
7. 直接输出消息内容，多条之间换行，不加任何编号或前缀。
${situationNote}`;
}

/* ── 把 crMessages 转成 API messages 格式 ── */
function crBuildApiMessages(historyMsgs) {
  const recent = historyMsgs.slice(-30);
  const result = recent.map(m => ({
    role: m.role === 'mine' ? 'user' : 'assistant',
    content: m.text
  }));
  while (result.length > 0 && result[0].role === 'assistant') result.shift();
  if (result.length === 0) result.push({ role: 'user', content: '你好' });
  if (result[result.length - 1].role === 'assistant') {
    result.push({ role: 'user', content: '……' });
  }
  return result;
}

/* ── 判断当前是哪种情况 ── */
function crGetSituation() {
  if (!crMessages.some(m => m.role === 'mine')) return 'initiative'; // 用户从未发过消息
  // 找最后一条 mine 之后有没有 luna 回复
  let lastUserIdx = -1;
  for (let i = crMessages.length - 1; i >= 0; i--) {
    if (crMessages[i].role === 'mine') { lastUserIdx = i; break; }
  }
  const repliedAfter = crMessages.slice(lastUserIdx + 1).some(m => m.role === 'luna');
  return repliedAfter ? 'continue' : 'reply';
}

/* ── typing 动画 ── */
function crShowTyping() {
  const area = document.getElementById('crMessages');
  if (!area || document.getElementById('crTyping')) return;
  area.appendChild(crBuildTyping());
  area.scrollTop = area.scrollHeight;
}
function crHideTyping() {
  document.getElementById('crTyping')?.remove();
}

/* ── 渲染单条 AI 消息气泡 ── */
function crAppendAiReply(text) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2, '0') + ':' +
            n.getMinutes().toString().padStart(2, '0');

  const msgObj = { role: 'luna', text, time: t };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  getCrDB().then(db => {
    const tx = db.transaction('conv', 'readwrite');
    const store = tx.objectStore('conv');
    const req = store.get(CR_NAME);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.preview = text.slice(0, 30);
        item.time = t;
        item.timeVal = Date.now();
        store.put(item);
      }
    };
  }).catch(() => {});

  const el = crBuildMsgEl(msgObj);
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }));
}

/* ── 逐条发送，模拟真人连发 ── */
async function crSendLines(lines) {
  const valid = lines.map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < valid.length; i++) {
    if (i > 0) {
      crShowTyping();
      // 按字数决定间隔，越长等越久，像打字一样
      const delay = 500 + Math.min(valid[i].length * 60, 1200);
      await new Promise(r => setTimeout(r, delay));
      crHideTyping();
    }
    crAppendAiReply(valid[i]);
  }
}

/* ── 统一 API 调用 ── */
async function crCallApi(systemPrompt, messages) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('NO_API_CONFIG');

  const response = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cur.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('回复为空');
  return text;
}

/* ── 小提示 ── */
function crShowTip(msg, ms = 2500) {
  const area = document.getElementById('crMessages');
  if (!area) return;
  const tip = document.createElement('div');
  tip.style.cssText = 'text-align:center;color:#bbb;font-size:12px;padding:6px 0;';
  tip.textContent = msg;
  area.appendChild(tip);
  area.scrollTop = area.scrollHeight;
  setTimeout(() => tip.remove(), ms);
}

/* ── AI 按钮防重复 ── */
let crAiLoading = false;

function crSetAiBtnState(loading) {
  crAiLoading = loading;
  const btn = document.querySelector('.cr-ai-btn');
  if (!btn) return;
  btn.style.opacity       = loading ? '0.4' : '1';
  btn.style.pointerEvents = loading ? 'none' : 'auto';
}

/* ── 核心入口 ── */
async function crAiReply() {
  if (crAiLoading) return;

  // 先检查 API 配置
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    crShowTip('请先在设置页配置 API');
    return;
  }

  const situation = crGetSituation(); // 'initiative' | 'reply' | 'continue'

  crSetAiBtnState(true);
  crShowTyping();

  try {
    const char         = await crLoadCharProfile(CR_NAME);
    const systemPrompt = crBuildSystemPrompt(char, situation);
    const messages     = crBuildApiMessages(crMessages);

    const replyText = await crCallApi(systemPrompt, messages);

    crHideTyping();
    // 按换行拆成多条发送
    await crSendLines(replyText.split('\n'));

  } catch (err) {
    crHideTyping();
    console.error('[crAiReply]', err);
    crShowTip('消息好像没发出去，稍后再试～');
  } finally {
    crSetAiBtnState(false);
  }
}