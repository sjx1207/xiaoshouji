/* ================================
   Chatroom — chatroom.js
================================ */

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

/* 实时时钟 */
function crTick() {
  // 时间（读取与 index 一致的时区设置）
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

  /* ── 动态渲染头部统计数据 ── */
  crInitStats();

  /* ── 初始化头部：用角色名替换硬编码的 "Luna" ── */
  crInitHeader();

  /* ── 从 DB 恢复该角色的历史消息 ── */
  await crRestoreMessages();

  /* 返回按钮 */
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

  /* 建议芯片 → 填入输入框 */
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

  /* 输入框占位逻辑 */
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

  /* 发送按钮 */
  var sendBtn = document.getElementById('crSendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', crSend);
  }
});

/* ── 同步头部角色信息 ── */
function crInitHeader() {
  /* 替换顶部名字 */
  var nameEl = document.querySelector('.cr-name');
  if (nameEl) nameEl.textContent = CR_NAME;

  /* 替换 footer 里的 LUNA 标签 */
  document.querySelectorAll('.cr-footer-lbl').forEach(function(el) {
    el.textContent = CR_NAME.toUpperCase();
  });

  /* 替换页面 title */
  document.title = CR_NAME + ' · 聊天';

  /* 从 LunaCharDB 里读角色数据，填充副标题 */
  var req = indexedDB.open('LunaCharDB', 4);
  req.onsuccess = function(e) {
    var db = e.target.result;
    if (!db.objectStoreNames.contains('chars')) return;
    var r = db.transaction('chars').objectStore('chars').getAll();
    r.onsuccess = function() {
      var chars = r.result || [];
      var found = chars.find(function(c) { return c.name === CR_NAME; });
      if (!found) return;
      /* 副标题（cr-sub） */
      var subEl = document.querySelector('.cr-sub');
      if (subEl && found.role) subEl.textContent = found.role;
      /* 头像首字母 */
      var avSvgs = document.querySelectorAll('.cr-avatar svg, .cr-mini-av svg');
      /* 如果角色有自定义头像图片 */
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

  /* 第三栏：角色名同步 */
  var lunaNameEl = document.querySelector('.cr-stat-luna-row span');
  if (lunaNameEl) lunaNameEl.textContent = name;

  /* ── 头像渲染：有图片显示图片，没有显示首字母 ── */
  var avatarInner = document.getElementById('crAvatarInner');
  if (avatarInner) {
    var charProbe = indexedDB.open('LunaCharDB');
    charProbe.onsuccess = function(ev) {
      var cdb = ev.target.result;
      if (!cdb.objectStoreNames.contains('chars')) {
        avatarInner.textContent = name[0] || '?';
        return;
      }
      var cr = cdb.transaction('chars').objectStore('chars').getAll();
      cr.onsuccess = function() {
        var found = (cr.result || []).find(function(c) { return c.name === name; });
        if (found && found.avatar) {
          var img = document.createElement('img');
          img.src = found.avatar;
          avatarInner.appendChild(img);
        } else {
          avatarInner.textContent = name[0] || '?';
        }
      };
    };
  }

  /* 从 LunaChatDB 读消息数 & convData 读创建时间 */
  var probe = indexedDB.open('LunaChatDB');
  probe.onsuccess = function(e) {
    var db = e.target.result;

    /* ── 第一栏：对话条数 = 该角色的消息总数 ── */
    if (db.objectStoreNames.contains('messages')) {
      var r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = function() {
        var msgs = r.result ? (r.result.msgs || []) : [];
        var countEl = document.querySelector('.cr-stat:nth-child(1) .cr-stat-val');
        if (countEl) countEl.textContent = msgs.length;
      };
    }

    /* ── 第二栏：相识天数 = 从 convData 里读 createdAt ── */
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

  /* 清除 HTML 里的静态示例消息，只保留日期分割线和 typing 指示器 */
  var typingEl = area.querySelector('.cr-typing');
  area.innerHTML = '';

  if (crMessages.length === 0) {
    /* 第一次打开：不显示任何内容，等用户主动发消息 */
  } else {
    /* 有历史记录：恢复所有消息 */
    crMessages.forEach(function(msg) {
      var el = crBuildMsgEl(msg);
      if (el) area.appendChild(el);
    });
  }

  /* 不显示typing（无AI回复） */

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
      '<div class="cr-mini-av">' + crMiniAvSvg() + '</div>' +
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
    '<div class="cr-mini-av">' + crMiniAvSvg() + '</div>' +
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

  /* 移除 typing */
  var tw = document.getElementById('crTyping');
  if (tw) tw.remove();

  /* 时间 */
  var n = new Date();
  var t = n.getHours().toString().padStart(2, '0') + ':' +
          n.getMinutes().toString().padStart(2, '0');

  /* 构建消息对象并存入内存数组 */
  var msgObj = { role: 'mine', text: txt, time: t };
  crMessages.push(msgObj);

  /* 渲染到 DOM */
  var el = crBuildMsgEl(msgObj);
  area.appendChild(el);

  /* 保存到 IndexedDB */
  dbSaveMessages(CR_NAME, crMessages);

  /* 同步更新 conv 表里该联系人的预览和时间 */
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

  /* 清空输入框 */
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

/* 从 bfcache 恢复时强制重新加载，确保灵动岛/字体同步 */
window.addEventListener('pageshow', function(e) {
  if (e.persisted) window.location.reload();
});