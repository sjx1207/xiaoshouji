/* ==========================================================
   共读屿 · gd-reader.js  v2
   ========================================================== */

let WORK = null, CMTS = [], REPLY_TO = null;
let SESSION_MS = 0, MAX_PROG = 0, _tickT = null, _visible = true;

const DEF_SET = {
  fs: 18, lh: 212, ls: 1.5, ps: 155, pad: 28, fw: 400,
  font: 'serif', theme: 'plain',
  veil: 42, blur: 0, gray: 30,
  inkIdx: -1, inkCustom: '',
  indent: 0, justify: 1, num: 0, dlgBlock: 1,
  marks: { q: 1, p: 1, n: 1, w: 1, d: 1 }, customFont: '',
  bgScope: 'work' // 'work' = 仅当前这篇；'global' = 所有篇目共用同一张背景
};
const FONTS = [
  { k: 'serif', n: '宋 · 书页', css: `'Noto Serif SC','Songti SC',serif` },
  { k: 'kai',   n: '楷 · 手写', css: `'Kaiti SC','STKaiti','楷体',serif` },
  { k: 'hei',   n: '黑 · 清晰', css: `'PingFang SC','Inter','Microsoft YaHei',sans-serif` },
  { k: 'fang',  n: '仿 · 稿纸', css: `'FangSong','仿宋','STFangsong',serif` },
  { k: 'mono',  n: '等宽 · 档案', css: `'Space Mono','Courier New',monospace` }
];
const THEMES = [
  { k: 'plain', n: '素白', bg: '#f7f8f9', ink: '#191c21' },
  { k: 'card',  n: '灰卡', bg: '#e9ebee', ink: '#15181d' },
  { k: 'smoke', n: '浅烟', bg: '#eef0f2', ink: '#20242a' },
  { k: 'moon',  n: '月石', bg: '#dfe3e7', ink: '#12151a' },
  { k: 'xuan',  n: '宣白', bg: '#fcfcfb', ink: '#22272e' },
  { k: 'slate', n: '深墨', bg: '#1f2328', ink: '#e3e6e9' }
];
const INKS = ['#0b0d11', '#191c21', '#2a2f37', '#3b424b', '#5a626d', '#e3e6e9'];

let SET = Object.assign({}, DEF_SET, GD.LS.get('gd_reader_set_v2', {}));
SET.marks = Object.assign({}, DEF_SET.marks, SET.marks || {});

document.addEventListener('DOMContentLoaded', async () => {
  GD.mountStatusBar(false, { grain: false });   // 阅读器不叠纸纹，保证背景图清晰
  const id = new URLSearchParams(location.search).get('id');
  WORK = await GD.workGet(id);
  if (!WORK) { GD.toast('找不到这篇'); setTimeout(() => GD.go('gongduyu.html'), 900); return; }
  MAX_PROG = WORK.progress || 0;

  await applySettings(true);
  buildSettingsUI();
  renderHero();
  renderText();
  renderFinished();
  bindScroll();
  bindComments();
  startTimer();
  await loadComments();
  GDFab.mount({ page: 'reader', work: WORK });

  document.addEventListener('visibilitychange', () => {
    _visible = !document.hidden;
    if (!_visible) persist();
  });
  window.addEventListener('pagehide', persist);
});

/* ==========================================================
   卷首
   ========================================================== */
function renderHero() {
  const t = WORK.tags || {};
  const tags = [t.fandom, t.rating, t.status, ...(t.types || []), ...(t.custom || [])].filter(Boolean);
  document.getElementById('rdTitle').textContent = WORK.title;
  document.getElementById('rdHero').innerHTML = `
    <div class="rule-top"><i></i><b>Gongduyu Reading</b><i></i></div>
    ${WORK.cover ? `<div class="cvr"><img src="${WORK.cover}"></div>` : ''}
    ${t.cp ? `<div class="cp">${GD.esc(t.cp)}</div>` : ''}
    <h1 style="${WORK.cover ? 'padding-right:92px' : ''}">${GD.esc(WORK.title)}</h1>
    <div class="meta">
      <span>${GD.fmtWords(WORK.wordCount)} 字</span>
      <span>约 ${Math.max(1, Math.round(WORK.wordCount / 400))} 分钟</span>
      ${t.author ? `<span>BY ${GD.esc(t.author)}</span>` : ''}
      <span>№ ${String(WORK.id).padStart(3, '0')}</span>
    </div>
    ${tags.length ? `<div class="tagline">${tags.slice(0, 9).map(GD.esc).join(' &nbsp;/&nbsp; ')}</div>` : ''}
    ${WORK.summary ? `<div class="sum">${GD.esc(WORK.summary)}</div>` : ''}`;
  document.getElementById('rdEndMeta').textContent =
    `${GD.fmtWords(WORK.wordCount)} WORDS · ${t.cp ? t.cp + ' · ' : ''}${GD.fmtDate(WORK.createdAt)}`;
}

/* ---------- 左右结构标点 ---------- */
const PAIRS = {
  '「': ['」', 'q'], '『': ['』', 'q'], '“': ['”', 'q'], '‘': ['’', 'q'],
  '（': ['）', 'p'],
  '【': ['】', 'n'],
  '《': ['》', 'w'], '〈': ['〉', 'w'], '〔': ['〕', 'n'], '｛': ['｝', 'n']
};
/* 半角 ( ) [ ] { } 不再纳入自动标记：这些符号在普通正文里出现的概率
   （代号、括注、误输入…）远高于真的想触发「场记/低语」标记，纳入后
   常常把跟标点无关的整段文字错误地圈进某个标记样式里，看起来就像
   "乱码的标记"。只保留歧义低的全角中文标点自动标记。 */
function pairStraight(s) { let n = 0; return s.replace(/"/g, () => (n++ % 2 === 0 ? '“' : '”')); }

/* 「对白」多样式随机分配器：同一篇里让 q 类标点（对白）轮换出现不同的
   视觉处理方式（见 gd-reader.css 的 .q-v0 ~ .q-v5），而不是从头到尾都是
   同一种加粗。用"不重复相邻"的随机算法，保证样式分布看起来错落，
   而不会连续两句对白撞成一样的样子。 */
const Q_VARIANTS = 10;
let _qLast = -1;
function nextQVariant() {
  if (Q_VARIANTS <= 1) return 0;
  let v;
  do { v = Math.floor(Math.random() * Q_VARIANTS); } while (v === _qLast && Q_VARIANTS > 1);
  _qLast = v;
  return v;
}

/* 对白独立分层（dlg）段落也用同一套"不重复相邻"随机分配，
   让长文里连续出现的整段对白不会套着同一个样式反复出现。 */
const DLG_VARIANTS = 5;
let _dlgLast = -1;
function nextDlgVariant() {
  if (DLG_VARIANTS <= 1) return 0;
  let v;
  do { v = Math.floor(Math.random() * DLG_VARIANTS); } while (v === _dlgLast && DLG_VARIANTS > 1);
  _dlgLast = v;
  return v;
}

function markup(raw) {
  const s = pairStraight(String(raw));
  const stack = [{ cls: null, close: null, open: '', buf: '' }];
  const push = str => { stack[stack.length - 1].buf += str; };
  for (const ch of s) {
    const top = stack[stack.length - 1];
    if (top.close && ch === top.close) {
      stack.pop();
      if (!top.buf) {
        // 一对标点之间没有任何内容（常见于原稿里连续打了两个引号这类
        // 输入/转换遗留问题），这种情况不装饰成标记——原样吐出两个符号，
        // 避免渲染出一个空心的、看不出内容的标记块。
        push(GD.esc(top.open) + GD.esc(ch));
        continue;
      }
      const extra = top.cls === 'q' ? ` q-v${nextQVariant()}` : '';
      push(`<span class="${top.cls}${extra}"><i class="qm">${GD.esc(top.open)}</i>${top.buf}<i class="qm">${GD.esc(ch)}</i></span>`);
      continue;
    }
    if (PAIRS[ch]) { const [cl, cls] = PAIRS[ch]; stack.push({ cls, close: cl, open: ch, buf: '' }); continue; }
    push(GD.esc(ch));
  }
  while (stack.length > 1) { const t = stack.pop(); stack[stack.length - 1].buf += GD.esc(t.open) + t.buf; }
  return stack[0].buf.replace(/(——+|…{1,})/g, '<span class="d">$1</span>');
}

/* 判断整段是不是"一句话对白" */
function isDialogue(t) {
  if (!/^[「『“"]/.test(t)) return false;
  const inner = t.replace(/[「」『』“”"]/g, '');
  const quoted = (t.match(/[「『“][^」』”]*[」』”]/g) || []).join('').length;
  return quoted / Math.max(1, t.length) > 0.55 || inner.length < 90;
}

function renderText() {
  const lines = String(WORK.content || '').split('\n');
  const out = [];
  let n = 0, lead = true;
  _qLast = -1; // 每次重新渲染正文时重置，避免跨渲染残留上一次的"末尾样式"
  _dlgLast = -1;
  lines.forEach(line => {
    // 去掉原稿里的全角/半角缩进空格，缩进完全交给设置控制
    const t = line.replace(/^[\s\u3000\u00a0]+/, '').replace(/[\s\u3000]+$/, '');
    if (!t) return;
    if (/^([-—*·=~＊◇◆#]{3,}|第[一二三四五六七八九十百零\d]+[章节幕回].{0,24}|[（(]?\s*\d{1,3}\s*[)）]?|【.{1,24}】|[·•]{3,})$/.test(t)) {
      const label = /^[-—*·=~＊◇◆#·•]{3,}$/.test(t) ? '＊' : t.replace(/^[【（(]|[】）)]$/g, '');
      out.push(`<div class="rd-sep"><i></i><b>${GD.esc(label)}</b><i></i></div>`);
      lead = true; return;
    }
    n++;
    const cls = ['rd-p'];
    if (lead) cls.push('lead');
    if (SET.dlgBlock && isDialogue(t)) cls.push('dlg', `dlg-v${nextDlgVariant()}`);
    const num = (SET.num && n % 5 === 1) ? `<span class="rd-num">${String(n).padStart(2, '0')}</span>` : '';
    out.push(`<p class="${cls.join(' ')}">${num}${markup(t)}</p>`);
    lead = false;
  });
  document.getElementById('rdText').innerHTML = out.join('');
  applyMarks();
}

function applyMarks() {
  Object.entries(SET.marks).forEach(([k, v]) => document.body.classList.toggle('off-' + k, !v));
  const on = Object.values(SET.marks).filter(Boolean).length;
  const el = document.getElementById('markToggle');
  el.textContent = on ? `HIGHLIGHT ${on}/5` : 'HIGHLIGHT OFF';
  el.onclick = () => {
    const any = Object.values(SET.marks).some(v => v);
    Object.keys(SET.marks).forEach(k => SET.marks[k] = any ? 0 : 1);
    saveSet(); applyMarks(); buildSettingsUI();
  };
}

/* ==========================================================
   设置
   ========================================================== */
function saveSet() { GD.LS.set('gd_reader_set_v2', SET); }

/* 背景图按范围存放：
   - 全局：所有篇目共用一张，key 固定为 reader_bg_global（沿用旧版 reader_bg 的数据）
   - 仅这一篇：每篇一个独立 key，互不影响 */
const BG_GLOBAL_KEY = 'reader_bg_global';
function bgKeyFor(scope) {
  return scope === 'global' ? BG_GLOBAL_KEY : `reader_bg_work_${WORK.id}`;
}
async function currentBg() {
  // 兼容旧版数据：旧版只有一个全局 key "reader_bg"，迁移一次到 reader_bg_global
  let bg = await GD.assetGet(bgKeyFor(SET.bgScope));
  if (!bg && SET.bgScope === 'global') {
    const legacy = await GD.assetGet('reader_bg');
    if (legacy) { await GD.assetPut(BG_GLOBAL_KEY, legacy); await GD.assetPut('reader_bg', null); bg = legacy; }
  }
  return bg;
}

async function applySettings(initial) {
  const r = document.documentElement.style;
  r.setProperty('--rd-fs', SET.fs + 'px');
  r.setProperty('--rd-lh', (SET.lh / 100).toFixed(2));
  r.setProperty('--rd-ls', (SET.ls / 100).toFixed(3) + 'em');
  r.setProperty('--rd-ps', (SET.ps / 100).toFixed(2) + 'em');
  r.setProperty('--rd-pad', SET.pad + 'px');
  r.setProperty('--rd-indent', SET.indent ? '2em' : '0em');
  r.setProperty('--rd-fw', SET.fw || 400);

  const f = FONTS.find(x => x.k === SET.font);
  r.setProperty('--rd-font', SET.font === 'custom' ? `'GDUserFont',serif` : (f ? f.css : FONTS[0].css));

  const th = THEMES.find(x => x.k === SET.theme) || THEMES[0];
  const ink = SET.inkCustom ? SET.inkCustom : (SET.inkIdx >= 0 ? INKS[SET.inkIdx] : th.ink);
  r.setProperty('--rd-bg', th.bg);
  r.setProperty('--rd-ink', ink);
  r.setProperty('--rd-line', rgba(ink, .16));
  r.setProperty('--rd-soft', rgba(ink, .58));
  document.body.classList.toggle('noj', !SET.justify);
  GD.setStatusDark(isLight(ink) ? true : false);

  const bg = await currentBg();
  const img = document.getElementById('rdBgImg'), veil = document.getElementById('rdBgVeil');
  if (bg) {
    img.style.backgroundImage = `url(${bg})`;
    img.style.display = 'block';
    img.style.filter = `grayscale(${SET.gray}%) blur(${SET.blur}px) contrast(1.02)`;
    img.style.transform = SET.blur ? `scale(${1 + SET.blur / 60})` : 'none';
    veil.style.display = 'block';
    veil.style.background = hexToRgba(th.bg, SET.veil / 100);
  } else { img.style.display = 'none'; veil.style.display = 'none'; }

  if (initial && SET.customFont) {
    const data = await GD.assetGet('reader_font');
    if (data) { try { const ff = new FontFace('GDUserFont', `url(${data})`); await ff.load(); document.fonts.add(ff); } catch (e) {} }
  }
}
function hex2rgb(h) {
  const c = h.replace('#', '');
  return [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16));
}
function rgba(hex, a) { const [r, g, b] = hex2rgb(hex); return `rgba(${r},${g},${b},${a})`; }
function hexToRgba(hex, a) { return rgba(hex, a); }
function isLight(hex) { const [r, g, b] = hex2rgb(hex); return (r + g + b) / 3 > 150; }

function buildSettingsUI() {
  document.getElementById('fontRow').innerHTML =
    FONTS.map(f => `<div class="font-sw ${SET.font === f.k ? 'on' : ''}" data-k="${f.k}" style="font-family:${f.css}">${f.n}</div>`).join('') +
    (SET.customFont ? `<div class="font-sw ${SET.font === 'custom' ? 'on' : ''}" data-k="custom" style="font-family:'GDUserFont'">${GD.esc(SET.customFont)}</div>` : '');
  document.querySelectorAll('#fontRow .font-sw').forEach(el => el.onclick = () => {
    SET.font = el.dataset.k; saveSet(); applySettings(); buildSettingsUI();
  });

  document.getElementById('themeRow').innerHTML = THEMES.map(t => `
    <div class="theme-sw ${SET.theme === t.k ? 'on' : ''}" data-k="${t.k}"
      style="background:${t.bg};color:${t.ink}">文<span class="nm">${t.n}</span></div>`).join('');
  document.querySelectorAll('.theme-sw').forEach(el => el.onclick = () => {
    SET.theme = el.dataset.k; SET.inkIdx = -1; saveSet(); applySettings(); buildSettingsUI();
  });

  document.getElementById('inkRow').innerHTML =
    `<div class="ink-sw ${!SET.inkCustom && SET.inkIdx === -1 ? 'on' : ''}" data-i="-1"
       style="background:linear-gradient(135deg,#fff 48%,#191c21 52%)"></div>` +
    INKS.map((c, i) => `<div class="ink-sw ${!SET.inkCustom && SET.inkIdx === i ? 'on' : ''}" data-i="${i}" style="background:${c}"></div>`).join('');
  document.querySelectorAll('.ink-sw').forEach(el => el.onclick = () => {
    SET.inkIdx = parseInt(el.dataset.i); SET.inkCustom = ''; saveSet(); applySettings(); buildSettingsUI();
  });
  buildInkWheel();

  const R = [['sFs', 'vFs', 'fs', v => v + 'px'], ['sLh', 'vLh', 'lh', v => (v / 100).toFixed(2)],
             ['sLs', 'vLs', 'ls', v => (v / 100).toFixed(2)], ['sPs', 'vPs', 'ps', v => (v / 100).toFixed(2)],
             ['sPad', 'vPad', 'pad', v => v + 'px'], ['sFw', 'vFw', 'fw', v => String(v)],
             ['sVeil', 'vVeil', 'veil', v => v + '%'],
             ['sBlur', 'vBlur', 'blur', v => v + 'px'], ['sGray', 'vGray', 'gray', v => v + '%']];
  R.forEach(([sid, vid, key, fmt]) => {
    const s = document.getElementById(sid); if (!s) return;
    s.value = SET[key];
    document.getElementById(vid).textContent = fmt(SET[key]);
    s.oninput = () => {
      SET[key] = parseFloat(s.value);
      document.getElementById(vid).textContent = fmt(SET[key]);
      saveSet(); applySettings();
    };
  });

  document.querySelectorAll('#layoutRow .gd-chip').forEach(el => {
    const k = el.dataset.k;
    el.classList.toggle('on', !!SET[k]);
    el.onclick = () => {
      SET[k] = SET[k] ? 0 : 1; saveSet(); el.classList.toggle('on');
      applySettings();
      if (k === 'num' || k === 'dlgBlock') renderText();
    };
  });

  document.querySelectorAll('#markRow .gd-chip').forEach(el => {
    el.classList.toggle('on', !!SET.marks[el.dataset.k]);
    el.onclick = () => { SET.marks[el.dataset.k] = SET.marks[el.dataset.k] ? 0 : 1; saveSet(); applyMarks(); el.classList.toggle('on'); };
  });

  document.getElementById('fontUpload').onclick = () => document.getElementById('fontFile').click();
  document.getElementById('fontFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    await GD.assetPut('reader_font', data);
    SET.customFont = f.name.replace(/\.[^.]+$/, '').slice(0, 12); SET.font = 'custom'; saveSet();
    try { const ff = new FontFace('GDUserFont', `url(${data})`); await ff.load(); document.fonts.add(ff); } catch (err) {}
    applySettings(); buildSettingsUI(); GD.toast('字体已启用');
  };
  document.querySelectorAll('#bgScopeRow .gd-chip').forEach(el => {
    el.classList.toggle('on', SET.bgScope === el.dataset.k);
    el.onclick = () => {
      if (SET.bgScope === el.dataset.k) return;
      SET.bgScope = el.dataset.k; saveSet();
      applySettings(); buildSettingsUI();
    };
  });
  const scopeHint = document.getElementById('bgScopeHint');
  if (scopeHint) {
    scopeHint.textContent = SET.bgScope === 'global'
      ? '当前上传/清除会替换所有篇目共用的背景图。'
      : '当前上传/清除只影响《' + (WORK ? WORK.title : '这一篇') + '》，其他篇目不受影响。';
  }

  document.getElementById('bgUpload').onclick = () => document.getElementById('bgFile').click();
  document.getElementById('bgFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    await GD.assetPut(bgKeyFor(SET.bgScope), await GD.readImage(f, 1600, 0.9));
    e.target.value = '';
    if (SET.veil > 60) SET.veil = 42;
    saveSet(); applySettings(); buildSettingsUI();
    GD.toast(SET.bgScope === 'global' ? '全局背景已更换' : '这一篇的背景已更换');
  };
  document.getElementById('bgClear').onclick = async () => {
    await GD.assetPut(bgKeyFor(SET.bgScope), null);
    applySettings();
    GD.toast(SET.bgScope === 'global' ? '全局背景已清除' : '这一篇的背景已清除');
  };
  document.getElementById('resetSet').onclick = () => {
    SET = Object.assign({}, DEF_SET, { customFont: SET.customFont });
    SET.marks = Object.assign({}, DEF_SET.marks);
    saveSet(); applySettings(); buildSettingsUI(); renderText(); GD.toast('已恢复默认');
  };

  const delBtn = document.getElementById('delWorkBtn');
  if (delBtn) delBtn.onclick = () => { document.getElementById('setMask').classList.remove('show'); deleteWorkFromReader(); };
}
/* ==========================================================
   字色环（灰阶亮度环，纯 CSS/JS 自绘，不使用 <input type=color>）
   ----------------------------------------------------------
   环上任意一点只对应一个"灰度值"：以 12 点钟方向为纯黑(0)，
   顺时针走到 6 点钟方向为纯白(255)，再继续走回 12 点钟方向
   又回到纯黑——跟 CSS 里 conic-gradient 的黑→白→黑完全对应，
   保证指针停在哪里，取到的颜色就是环上那一点看到的颜色，
   不会出现"选中点"和"环上颜色"对不上的问题。
   ========================================================== */
function curInkHex() {
  if (SET.inkCustom) return SET.inkCustom;
  if (SET.inkIdx >= 0) return INKS[SET.inkIdx];
  const th = THEMES.find(x => x.k === SET.theme) || THEMES[0];
  return th.ink;
}
function grayToHex(g) {
  g = Math.max(0, Math.min(255, Math.round(g)));
  const h = g.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}
function hexToGray(hex) {
  const [r, g, b] = hex2rgb(hex);
  return Math.round((r + g + b) / 3);
}
/* 灰度 -> 环上角度（0deg = 12点方向，顺时针）。0/255 都落在 12 点，
   刻意让黑落在 [0,180) 半环、白落在 [180,360) 半环，跟 CSS 的
   0%→50%→100% 黑白黑一一对应。 */
function grayToAngle(g) { return (g / 255) * 180; }
function angleToGray(deg) {
  deg = ((deg % 360) + 360) % 360;
  const half = deg <= 180 ? deg : 360 - deg;
  return Math.round((half / 180) * 255);
}
function buildInkWheel() {
  const wheel = document.getElementById('inkWheel');
  const dot = document.getElementById('inkWheelDot');
  const core = document.getElementById('inkWheelCore');
  const sw = document.getElementById('inkValSw');
  const tx = document.getElementById('inkValTx');
  if (!wheel) return;

  const paint = () => {
    const hex = curInkHex();
    const g = hexToGray(hex);
    const ang = grayToAngle(g);
    const rad = (ang - 0) * Math.PI / 180;
    const R = 46; // 环半径（wheel 132px，取内圈中线）
    const x = 66 + R * Math.sin(rad);
    const y = 66 - R * Math.cos(rad);
    dot.style.left = x + 'px'; dot.style.top = y + 'px';
    dot.style.setProperty('--iw-c', hex);
    sw.style.setProperty('--iw-c', hex);
    core.textContent = hex.toUpperCase();
    tx.textContent = hex.toUpperCase();
  };
  paint();

  let dragging = false;
  const setFromEvent = e => {
    const r = wheel.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const p = e.touches ? e.touches[0] : e;
    const dx = p.clientX - cx, dy = p.clientY - cy;
    let ang = Math.atan2(dx, -dy) * 180 / Math.PI; // 0deg = 12点，顺时针为正
    if (ang < 0) ang += 360;
    const g = angleToGray(ang);
    SET.inkCustom = grayToHex(g);
    SET.inkIdx = -1;
    saveSet(); applySettings(); paint();
    document.querySelectorAll('.ink-sw').forEach(el => el.classList.remove('on'));
  };
  wheel.onpointerdown = e => { dragging = true; wheel.setPointerCapture(e.pointerId); setFromEvent(e); };
  wheel.onpointermove = e => { if (dragging) setFromEvent(e); };
  wheel.onpointerup = () => { dragging = false; };
  wheel.onpointercancel = () => { dragging = false; };
  core.ondblclick = () => { SET.inkCustom = ''; saveSet(); applySettings(); buildSettingsUI(); };
}

/* ==========================================================
   已看完 · 标记与展示
   ----------------------------------------------------------
   与阅读进度联动但可手动覆盖：progress>=0.92 视为"自然读完"，
   同时允许随时手动标记/取消（WORK.finishedManual），
   两者任一为真即视为"已看完"，優先展示手动状态的措辞。
   ========================================================== */
function isFinished() { return !!WORK.finishedManual || (WORK.progress || 0) >= 0.92; }
function toggleFinished() {
  WORK.finishedManual = !isFinished();
  if (!WORK.finishedManual && (WORK.progress || 0) >= 0.92) {
    // 进度本身已经过线，单纯"取消手动标记"无法让状态回到未读完，
    // 这里不悄悄拦下用户的操作，而是明确告诉他们为什么按了没反应。
    GD.toast('阅读进度已超过 92%，无法取消已看完');
    WORK.finishedManual = true;
    return;
  }
  GD.workPut(WORK);
  renderFinished();
  GD.toast(WORK.finishedManual ? '已盖章标记为看完' : '已取消标记');
}
function finSealSVG() {
  return `<svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4.5 4.5L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function renderFinished() {
  const fin = isFinished();
  const btn = document.getElementById('rdFinBtn');
  if (btn) { btn.classList.toggle('finished', fin); btn.title = fin ? '已看完（点击取消手动标记）' : '标记已看完'; }

  const bar = document.getElementById('rdFinishBar');
  if (bar) {
    bar.classList.toggle('on', fin);
    document.getElementById('rdFinTitle').textContent = fin ? '已 盖 章 · 看 完 了' : '标 记 已 看 完';
    document.getElementById('rdFinSub').textContent = fin
      ? (WORK.finishedManual ? '手动标记 · 再点一次可取消' : '阅读进度已超过 92%，自动盖章')
      : '读到这里，给这篇盖个章';
  }

  const seal = document.getElementById('rdEndSeal');
  if (seal) {
    seal.innerHTML = fin
      ? `<div class="finish-seal on">${finSealSVG()}已 看 完</div>`
      : `<div class="finish-seal" onclick="toggleFinished()" style="cursor:pointer">${finSealSVG()}标记已看完</div>`;
  }

  const heroTitle = document.querySelector('#rdHero h1');
  if (heroTitle) {
    const already = heroTitle.querySelector('.fin-tag');
    if (already) already.remove();
    if (fin) heroTitle.insertAdjacentHTML('beforeend', `<span class="fin-tag">${finSealSVG()}已看完</span>`);
  }
}

/* ==========================================================
   移出粮仓（在阅读器内直接删除这篇：正文/封面/评论/阅读记录）
   ========================================================== */
async function deleteWorkFromReader() {
  const ok = await GD.confirmBox('移出粮仓？', '这篇的正文、封面、评论与阅读记录都会被清除，且无法恢复。', '移出');
  if (!ok) return;
  persist();
  await GD.workDel(WORK.id);
  const cs = await GD.commentsAll();
  await Promise.all(cs.filter(c => c.workId == WORK.id).map(c => GD.commentDel(c.id)));
  GD.toast('已移出粮仓');
  setTimeout(() => GD.go('gongduyu.html'), 500);
}

function openSet() { buildSettingsUI(); document.getElementById('setMask').classList.add('show'); }

/* ==========================================================
   滚动 / 进度 / 计时
   ========================================================== */
function bindScroll() {
  const sc = document.getElementById('rdScroll');
  let lastY = 0;
  sc.addEventListener('scroll', () => {
    const max = sc.scrollHeight - sc.clientHeight;
    const p = max > 0 ? Math.min(1, sc.scrollTop / max) : 1;
    document.getElementById('rdProg').style.width = (p * 100) + '%';
    if (p > MAX_PROG) MAX_PROG = p;
    const top = document.getElementById('rdTop');
    top.classList.toggle('hide', sc.scrollTop > lastY && sc.scrollTop > 220);
    lastY = sc.scrollTop;
  }, { passive: true });
}
function startTimer() {
  _tickT = setInterval(() => {
    if (!_visible) return;
    SESSION_MS += 1000;
    const el = document.getElementById('rdTimer');
    if (el) el.textContent = GD.fmtDuration(SESSION_MS);
    if (SESSION_MS % 20000 === 0) persist();
  }, 1000);
}
let _lastPersist = 0;
function persist() {
  if (!WORK) return;
  const add = SESSION_MS - _lastPersist;
  if (add > 0) { GD.addReadTime(add); WORK.readMs = (WORK.readMs || 0) + add; _lastPersist = SESSION_MS; }
  const prev = WORK.progress || 0;
  if (MAX_PROG > prev) {
    const st = GD.stats();
    st.words += Math.round((WORK.wordCount || 0) * (MAX_PROG - prev));
    if (prev < 0.92 && MAX_PROG >= 0.92) { st.finished += 1; renderFinished(); }
    GD.setStats(st);
    WORK.progress = MAX_PROG;
  }
  WORK.lastReadAt = Date.now();
  GD.workPut(WORK);
}
function leaveReader() { persist(); GD.go('gongduyu.html'); }

/* ==========================================================
   互动区
   ========================================================== */
function bindComments() {
  document.getElementById('rdCall').addEventListener('click', () => summon(true));
  document.getElementById('cmtMore').addEventListener('click', () => summon(false));
  document.getElementById('cmtSend').addEventListener('click', sendComment);
  const ta = document.getElementById('cmtText');
  ta.addEventListener('focus', () => document.getElementById('cmtInput').classList.add('show'));
  ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(96, ta.scrollHeight) + 'px'; });
  document.addEventListener('click', e => {
    if (!e.target.closest('.cmt-input') && !e.target.closest('.cmt-ft')) {
      document.getElementById('cmtInput').classList.remove('show');
      REPLY_TO = null; document.getElementById('replyTo').classList.remove('show');
    }
  });
}
async function loadComments() {
  CMTS = (await GD.commentsAll()).filter(c => c.workId == WORK.id).sort((a, b) => a.time - b.time);
  if (CMTS.length) {
    document.getElementById('cmtWrap').style.display = 'block';
    document.getElementById('rdCall').style.display = 'none';
    renderComments();
  }
}

function cmtNode(c, i, isSub, subsHTML = '') {
  return `
    <div class="cmt" data-id="${c.id}">
      <div class="cmt-top">
        <div class="cmt-av">${c.avatar ? `<img src="${c.avatar}">` : GD.avatarSVG(c.name, isSub ? 30 : 38)}</div>
        <div class="cmt-main">
          <div class="cmt-nm">
            <b>${GD.esc(c.name)}</b>
            ${c.self ? '<span class="badge">屿主</span>' : ''}
            ${isSub && c.toName ? `<span class="fl">回复 ${GD.esc(c.toName)}</span>` : ''}
            <span class="fl">${isSub ? '' : (i + 1) + 'L · '}${GD.relTime(c.time)}</span>
          </div>
          <div class="cmt-tx">${GD.esc(c.text)}</div>
          <div class="cmt-ft">
            <span class="lk ${c.liked ? 'on' : ''}" data-id="${c.id}">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="${c.liked ? 'currentColor' : 'none'}">
                <path d="M12 20s-7-4.6-7-9.4A4.2 4.2 0 0 1 12 8a4.2 4.2 0 0 1 7 2.6C19 15.4 12 20 12 20Z" stroke="currentColor" stroke-width="1.4"/>
              </svg>${c.likes || 0}
            </span>
            <span class="rp" data-id="${c.id}">回复</span>
          </div>
        </div>
      </div>
      ${subsHTML}
    </div>`;
}
function renderComments() {
  const roots = CMTS.filter(c => !c.parentId);
  document.getElementById('cmtCount').textContent = CMTS.length + ' 条';
  document.getElementById('cmtList').innerHTML = roots.map((c, i) => {
    const subs = CMTS.filter(x => x.rootId === c.id);
    const subsHTML = subs.length
      ? `<div class="cmt-sub">${subs.map(sc => cmtNode(sc, 0, true)).join('')}</div>` : '';
    return cmtNode(c, i, false, subsHTML);
  }).join('');

  document.querySelectorAll('.cmt-ft .lk').forEach(el => el.onclick = async () => {
    const c = CMTS.find(x => x.id == el.dataset.id); if (!c) return;
    c.liked = !c.liked; c.likes = Math.max(0, (c.likes || 0) + (c.liked ? 1 : -1));
    await GD.commentPut(c); renderComments();
  });
  document.querySelectorAll('.cmt-ft .rp').forEach(el => el.onclick = e => {
    e.stopPropagation();
    const c = CMTS.find(x => x.id == el.dataset.id);
    REPLY_TO = c;
    const rt = document.getElementById('replyTo');
    rt.textContent = '回复 @' + c.name; rt.classList.add('show');
    document.getElementById('cmtInput').classList.add('show');
    document.getElementById('cmtText').focus();
  });
}

function loadingBlock(txt) {
  return `<div class="cmt-loading"><div class="dots"><i></i><i></i><i></i></div><div class="tx">${txt}</div></div>`;
}
/* 取正文中信息量最高的片段喂给模型 */
function excerpt(limit = 6000) {
  const c = String(WORK.content || '');
  if (c.length <= limit) return c;
  const head = c.slice(0, Math.floor(limit * 0.45));
  const mid = c.slice(Math.floor(c.length / 2 - limit * 0.15), Math.floor(c.length / 2 + limit * 0.15));
  const tail = c.slice(-Math.floor(limit * 0.25));
  return `${head}\n……（中略）……\n${mid}\n……（中略）……\n${tail}`;
}
function workBrief() {
  const t = WORK.tags || {};
  return `篇名：《${WORK.title}》
CP / 主角：${t.cp || '未标注'}
原作圈子：${t.fandom || '未标注'}
标签：${[...(t.types || []), ...(t.custom || []), t.rating, t.status].filter(Boolean).join('、') || '无'}
雷区：${(t.warns || []).join('、') || '无'}
卷首语：${WORK.summary || '无'}`;
}

async function summon(first) {
  const wrap = document.getElementById('cmtWrap');
  wrap.style.display = 'block';
  if (first) document.getElementById('rdCall').style.display = 'none';
  const list = document.getElementById('cmtList');
  list.insertAdjacentHTML('beforeend', `<div id="cmtLoad">${loadingBlock('SIGNAL SENT · 屿上的人正在读这一篇')}</div>`);
  wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let arr = null, err = '';
  if (GD.apiReady()) {
    try {
      const sys = `你是同人圈（磕 CP / 二创）评论区模拟器。你要先真正读完给你的正文，再写评论。

硬性要求：
1. 只输出 JSON 数组，不要任何解释、不要 markdown 代码块。元素结构：
   {"name":"网名","text":"评论","likes":数字,"replies":[{"name":"网名","text":"回复","likes":数字}]}
2. 5-6 条主评论，其中至少 4 条要带 1-2 条二级回复。
3. **每条评论都必须落在这篇文的具体内容上**：写出人物的名字、他们做的具体动作、说过的具体台词（可以短引一句）、某个道具/场景/时间点。禁止任何脱离正文也能成立的空泛夸奖（如"文笔好""好虐""太爱了"单独出现）。
4. 评论要覆盖不同角度，至少包含：
   - 一条抓住某个细节反复咀嚼的（"他把那句话咽回去的时候…"）
   - 一条磕生磕死型（针对两人之间某个具体互动发疯）
   - 一条做人物动机分析的（讲清楚为什么这里会这样写）
   - 一条被某句台词/意象戳中而破防的
   - 一条玩梗、催更或跟太太喊话的
5. 网名要有同人圈味道：中英混、缩写、句子式 ID、圈内黑话都行，不要"用户123"。
6. 口语，情绪真实，长短不一（8-70 字为主，可以有一条 80-120 字的分析）。允许"啊啊啊""蚌埠住了""磕死我了""码住""爬了"这类语气。
7. 严禁使用 emoji 表情符号与颜文字。严禁说自己是 AI。严禁剧透式复述全文。`;
      const out = await GD.ai([
        { role: 'system', content: sys },
        { role: 'user', content: `${workBrief()}\n\n正文：\n${excerpt()}` }
      ], { max_tokens: 2000, temperature: 1.02 });
      arr = GD.parseJSON(out);
    } catch (e) { err = e.message; arr = null; }
  } else err = '未配置 API';

  if (!Array.isArray(arr) || !arr.length) {
    arr = localComments();
    if (err) GD.toast('AI 评论失败（' + err + '），先用本地回声顶上');
  }

  document.getElementById('cmtLoad')?.remove();
  for (const c of arr.slice(0, 6)) {
    const root = {
      workId: WORK.id, parentId: 0, rootId: 0,
      name: String(c.name || '路人甲').slice(0, 18),
      text: String(c.text || '').slice(0, 500),
      likes: Number(c.likes) || Math.floor(Math.random() * 60) + 3,
      time: Date.now() - Math.floor(Math.random() * 36e5)
    };
    const id = await GD.commentPut(root); root.id = id; CMTS.push(root);
    for (const r of (c.replies || []).slice(0, 3)) {
      const sub = {
        workId: WORK.id, parentId: id, rootId: id, toName: root.name,
        name: String(r.name || '同好').slice(0, 18),
        text: String(r.text || '').slice(0, 400),
        likes: Number(r.likes) || Math.floor(Math.random() * 20),
        time: root.time + 6e4 + Math.floor(Math.random() * 12e5)
      };
      sub.id = await GD.commentPut(sub); CMTS.push(sub);
    }
  }
  CMTS.sort((a, b) => a.time - b.time);
  GD.bumpInteraction(arr.length);
  renderComments();
}

async function sendComment() {
  const ta = document.getElementById('cmtText');
  const txt = ta.value.trim(); if (!txt) return;
  const me = GD.profile();
  const root = REPLY_TO ? (REPLY_TO.rootId || REPLY_TO.id) : 0;

  const mine = {
    workId: WORK.id, parentId: REPLY_TO ? REPLY_TO.id : 0, rootId: root,
    toName: REPLY_TO ? REPLY_TO.name : '', name: me.name, avatar: me.avatar || '',
    self: true, text: txt, likes: 0, time: Date.now()
  };
  mine.id = await GD.commentPut(mine); CMTS.push(mine);
  ta.value = ''; ta.style.height = 'auto';
  document.getElementById('cmtWrap').style.display = 'block';
  document.getElementById('rdCall').style.display = 'none';
  GD.bumpInteraction(1);
  renderComments();

  const target = REPLY_TO;
  REPLY_TO = null; document.getElementById('replyTo').classList.remove('show');

  const holder = document.createElement('div');
  holder.innerHTML = loadingBlock(target ? `${GD.esc(target.name)} 正在打字…` : '有人正在回复你…');
  document.getElementById('cmtList').appendChild(holder);

  let reply = null;
  if (GD.apiReady()) {
    try {
      const ctx = CMTS.slice(-8).map(c => `${c.name}：${c.text}`).join('\n');
      const who = target
        ? `你是评论区里的「${target.name}」，你之前说过："${target.text}"。现在回应对方的回复。`
        : `你是评论区里另一个刚读完这篇的同好，自己起一个有同人圈味道的网名。`;
      const out = await GD.ai([
        { role: 'system', content: `${who}
只输出 JSON：{"name":"网名","text":"回复内容"}，不要解释。
要求：必须接住对方说的具体内容，并且尽量再带出正文里的一个具体细节（人物名/动作/台词/场景）。口语、有情绪，可以接梗、追问、共鸣或轻微抬杠，10-70 字。禁止 emoji 与颜文字，禁止客套和自我介绍。` },
        { role: 'user', content: `${workBrief()}\n\n正文节选：\n${excerpt(2400)}\n\n评论区上下文：\n${ctx}\n\n请回复「${me.name}」刚说的：${txt}` }
      ], { max_tokens: 320, temperature: 1.05 });
      reply = GD.parseJSON(out);
    } catch (e) { reply = null; }
  }
  if (!reply || !reply.text) reply = localReply(target);

  holder.remove();
  const sub = {
    workId: WORK.id, parentId: mine.id, rootId: root || mine.id, toName: me.name,
    name: target ? target.name : String(reply.name || '同好').slice(0, 18),
    avatar: target ? (target.avatar || '') : '',
    text: String(reply.text).slice(0, 400),
    likes: Math.floor(Math.random() * 12), time: Date.now()
  };
  sub.id = await GD.commentPut(sub); CMTS.push(sub);
  renderComments();
}

/* ---------- 本地兜底：也尽量咬住正文 ---------- */
function keyLines() {
  const ls = String(WORK.content || '').split('\n').map(s => s.trim()).filter(s => s.length > 8 && s.length < 46);
  const q = ls.filter(s => /[「『“]/.test(s));
  return { q: q.length ? q : ls, all: ls };
}
const NAMES = ['雨天限定的糖', '三十七度半', '把刀收好', '今天也在爬墙', '不睡觉的太太党', '纸巾库存告急', '磕到了本人', '夜航船', '副本已通关', '清水永动机', '屿上打卡第七天', '逗号中毒者'];
const pick = a => a[Math.floor(Math.random() * a.length)];
function localComments() {
  const { q, all } = keyLines();
  const cut = s => (s || '').replace(/[「」『』“”]/g, '').slice(0, 16);
  const T = [
    () => `“${cut(pick(q))}”——就这一句，我反复看了五遍`,
    () => `${cut(pick(all))} 这里的停顿处理得太狠了，谁懂啊`,
    () => `他在这段里什么都没说，但全写在动作上了，蚌埠住了`,
    () => `客观讲：结构收得住，情绪没有硬煽，比大部分同题材干净`,
    () => `码住。明天清醒了再来哭一次`,
    () => `看到“${cut(pick(q))}”的时候我就知道要完蛋了`
  ];
  const R = ['同！我以为只有我盯着这句', '别说了我又要重看一遍', '楼上分析得对，我补一句：这里前面其实埋过', '你这么一讲我更难受了', '爬了，明天还来'];
  const used = new Set();
  const nm = () => { let n; do { n = pick(NAMES); } while (used.has(n) && used.size < NAMES.length); used.add(n); return n; };
  return Array.from({ length: 5 }, () => ({
    name: nm(), text: pick(T)(), likes: Math.floor(Math.random() * 80) + 4,
    replies: Math.random() > 0.3
      ? Array.from({ length: Math.random() > 0.5 ? 2 : 1 }, () => ({ name: nm(), text: pick(R), likes: Math.floor(Math.random() * 15) }))
      : []
  }));
}
function localReply(target) {
  const R = ['同！我以为只有我注意到这里', '别说了我又要重看一遍', '你这么一讲我更难受了', '爬了，明天还来', '这段我截图存了三份'];
  return { name: target ? target.name : pick(NAMES), text: pick(R) };
}