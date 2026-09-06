/* ==========================================================
   dn-reader.js — 阅读器 / 章末评论 / 阅读设置
   说明：全 App 只有「评论区」会自动调用 AI，其余均需用户主动触发。
   ========================================================== */

let RD = { pos: 0, settings: null };

/* ================= 打开阅读器 ================= */
function openReader() {
  const b = DN.current;
  const ch = b.catalog[DN.chapterIdx];
  const pov = charById(b, b.povId);

  document.getElementById('rtBook').textContent = b.title;
  document.getElementById('rtChap').textContent = `第 ${DN.chapterIdx + 1} 章 · ${ch.title}`;
  document.getElementById('rtPov').textContent = pov ? pov.name + ' 视角' : '全知视角';
  document.getElementById('rtCover').style.backgroundImage = b.cover ? `url('${b.cover}')` : '';

  RD.pos = 0;
  document.getElementById('rdFlow').innerHTML = '';
  document.getElementById('cmZone').classList.remove('show');
  document.getElementById('rdTap').classList.remove('hide');
  document.getElementById('rdTapLabel').textContent = '轻 触 · 继 续';

  applyReaderSettings();
  dnDarkStatus(false);
  dnOpenPage('page-reader');
  document.getElementById('page-reader').scrollTop = 0;
}

/* ================= 逐段输出 ================= */
function revealNext() {
  const b = DN.current;
  const ch = b.catalog[DN.chapterIdx];
  const segs = ch.segs || [];
  if (RD.pos >= segs.length) return finishChapter();

  const s = segs[RD.pos++];
  const flow = document.getElementById('rdFlow');
  const pov = b.povId;
  const c = (b.chars || []).find(x => x.name === s.speaker);
  const isMe = c && c.id === pov;

  let html = '';
  if (s.type === 'narration') {
    html = `<div class="nar">${dnEsc(s.text)}</div>`;
  } else {
    const av = c && c.avatar
      ? `<div class="dlg-av" style="background-image:url('${c.avatar}')"></div>`
      : `<div class="dlg-av">${dnEsc((s.speaker || '？').slice(0, 1))}</div>`;
    html = `<div class="dlg ${isMe ? 'me' : ''} ${s.type === 'monologue' ? 'mono' : ''}">
      ${av}
      <div class="dlg-col">
        <div class="dlg-name">${dnEsc(s.speaker)}${s.type === 'monologue' ? ' · 心声' : ''}</div>
        <div class="bub">
          <span class="bub-edge"></span>
          ${dnEsc(s.text)}
          <span class="bub-deco"><i></i><i></i><i></i></span>
        </div>
      </div>
    </div>`;
  }
  flow.insertAdjacentHTML('beforeend', html);
  const last = flow.lastElementChild;
  last.scrollIntoView({ behavior: 'smooth', block: 'center' });

  const left = segs.length - RD.pos;
  document.getElementById('rdTapLabel').textContent = left > 0 ? `轻 触 · 继 续（余 ${left}）` : '轻 触 · 读 完 本 章';
  ch.pos = RD.pos;
}

async function finishChapter() {
  const b = DN.current;
  const ch = b.catalog[DN.chapterIdx];
  document.getElementById('rdTap').classList.add('hide');
  ch.read = true;
  await DNStore.put(b); await dnReload();

  const zone = document.getElementById('cmZone');
  zone.classList.add('show');
  renderComments('ch');
  zone.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // 评论区：唯一允许自动调用 AI 的地方
  if (!ch.comments || !ch.comments.length) genChapterComments();
}

async function genChapterComments() {
  const b = DN.current;
  const ch = b.catalog[DN.chapterIdx];
  const list = document.getElementById('cmList');
  list.insertAdjacentHTML('beforeend',
    '<div id="cmLoading" style="font-size:11px;letter-spacing:.2em;color:#9a9aa4;text-align:center;padding:14px">读者正在赶来…</div>');
  try {
    const text = (ch.segs || []).map(s => (s.speaker ? s.speaker + '：' : '') + s.text).join('\n').slice(0, 1800);
    const data = await DNAI.json(
      '你是小说章节评论区的模拟器。评论要像真实读者：有的磕 CP，有的心疼角色，有的吐槽，有的分析细节，有的只发一句感叹。语气口语化、长度不一，禁止统一句式。用户名是社区昵称风格。',
      `作品《${b.title}》第 ${DN.chapterIdx + 1} 章《${ch.title}》正文节选：\n${text}\n\n请生成 4 条主评论，其中 2 条带 1–2 条楼中楼回复。\n随机种子：${Math.random().toString(36).slice(2)}\n\n返回 JSON：{"comments":[{"user":"","body":"","likes":数字,"replies":[{"user":"","body":"","likes":数字}]}]}`,
      { maxTokens: 3500, temperature: 1.05 });
    ch.comments = (data.comments || []).map(c => ({
      id: 'x' + Math.random().toString(36).slice(2, 7),
      user: c.user || '读者', body: c.body || '', likes: +c.likes || 0, mine: false,
      replies: (c.replies || []).map(r => ({
        id: 'y' + Math.random().toString(36).slice(2, 7),
        user: r.user || '读者', body: r.body || '', likes: +r.likes || 0, mine: false
      }))
    }));
    await DNStore.put(b);
  } catch (e) { dnToast(e.message); }
  finally {
    const el = document.getElementById('cmLoading');
    if (el) el.remove();
    renderComments('ch');
  }
}

/* ================= 评论渲染（章节 / 书评通用） ================= */
function commentsOf(ns) {
  if (ns === 'ch') {
    const ch = DN.current.catalog[DN.chapterIdx];
    ch.comments = ch.comments || [];
    return ch.comments;
  }
  curReview.comments = curReview.comments || [];
  return curReview.comments;
}
function cmtHTML(c, ns, path) {
  const sub = (c.replies || []).map((r, j) => cmtHTML(r, ns, path + '-' + j)).join('');
  return `<div class="cmt" data-p="${path}">
    <div class="cmt-h">
      <div class="cmt-av">${dnEsc((c.user || '读').slice(0, 1))}</div>
      <div class="cmt-u">${dnEsc(c.user)}${c.mine ? ' · 我' : ''}</div>
      <div class="cmt-t">${c.likes || 0} 赞</div>
    </div>
    <div class="cmt-b">${dnEsc(c.body)}</div>
    <div class="cmt-f">
      <span data-act="like" data-p="${path}">赞</span>
      <span data-act="reply" data-p="${path}">回复</span>
    </div>
    ${sub ? `<div class="cmt-sub">${sub}</div>` : ''}
  </div>`;
}
function renderComments(ns) {
  const box = document.getElementById(ns === 'ch' ? 'cmList' : 'rvCm');
  const list = commentsOf(ns);
  box.innerHTML = list.map((c, i) => cmtHTML(c, ns, String(i))).join('') ||
    `<div style="font-size:11.5px;color:#9a9aa4;letter-spacing:.08em;text-align:center;padding:12px">还没有评论</div>`;
  bindCommentEvents(box, ns);
}
function nodeByPath(ns, path) {
  const parts = path.split('-').map(Number);
  let node = commentsOf(ns)[parts[0]];
  for (let i = 1; i < parts.length; i++) node = node.replies[parts[i]];
  return node;
}
function rootIndex(path) { return +path.split('-')[0]; }

function bindCommentEvents(box, ns) {
  box.querySelectorAll('[data-act="like"]').forEach(el => {
    el.onclick = async () => {
      const n = nodeByPath(ns, el.dataset.p);
      n.likes = (n.likes || 0) + 1;
      el.classList.add('liked');
      el.closest('.cmt').querySelector('.cmt-t').textContent = n.likes + ' 赞';
      await persist(ns);
    };
  });
  box.querySelectorAll('[data-act="reply"]').forEach(el => {
    el.onclick = () => {
      const cmt = el.closest('.cmt');
      if (cmt.querySelector('.cm-replybar')) return;
      const bar = document.createElement('div');
      bar.className = 'cm-replybar';
      bar.innerHTML = `<input placeholder="回复 ${dnEsc(nodeByPath(ns, el.dataset.p).user)}…" /><b>发送</b>`;
      cmt.appendChild(bar);
      bar.querySelector('input').focus();
      bar.querySelector('b').onclick = () => {
        const v = bar.querySelector('input').value.trim();
        if (!v) return;
        addComment(ns, v, el.dataset.p);
      };
    };
  });
}

async function persist(ns) {
  if (ns === 'ch') await DNStore.put(DN.current);
  else await DNStore.put(DN.current);
}

/* 添加评论（主评论 path=null），随后自动调用 AI 生成回应 */
async function addComment(ns, text, path) {
  const p = DNStore.profile();
  const item = {
    id: 'x' + Math.random().toString(36).slice(2, 7),
    user: p.name, body: text, likes: 0, mine: true, replies: []
  };
  const list = commentsOf(ns);
  let rIdx;
  if (path == null) {
    list.push(item);
    rIdx = list.length - 1;
  } else {
    rIdx = rootIndex(path);
    const target = nodeByPath(ns, path);
    if (path.indexOf('-') === -1) {
      target.replies = target.replies || [];
      target.replies.push(item);
    } else {
      const root = list[rIdx];
      root.replies = root.replies || [];
      item.body = '回复 @' + target.user + '：' + text;
      root.replies.push(item);
    }
  }
  renderComments(ns);
  await persist(ns);
  autoReply(ns, rIdx, text);
}

/* 自动 AI 回应（评论区专属） */
async function autoReply(ns, rootIdx, userText) {
  const b = DN.current;
  const list = commentsOf(ns);
  const root = list[rootIdx];
  if (!root) return;
  try {
    const ctx = ns === 'ch'
      ? `作品《${b.title}》第 ${DN.chapterIdx + 1} 章《${b.catalog[DN.chapterIdx].title}》`
      : `书评《${curReview.title}》：${(curReview.body || '').slice(0, 200)}`;
    const thread = [root.body].concat((root.replies || []).map(r => r.user + '：' + r.body)).join('\n');
    const data = await DNAI.json(
      '你是评论区里的其他读者。用口语化的中文回复，1–2 句，有态度、有互动感，可以接梗、可以反驳、可以补充细节。禁止客服式套话。',
      `场景：${ctx}\n\n当前楼层：\n${thread}\n\n刚刚有读者说：「${userText}」\n请以 1 位其他读者的身份回应。\n随机种子：${Math.random().toString(36).slice(2)}\n\n返回 JSON：{"user":"昵称","body":"回复内容"}`,
      { maxTokens: 900, temperature: 1.05 });
    root.replies = root.replies || [];
    root.replies.push({
      id: 'y' + Math.random().toString(36).slice(2, 7),
      user: data.user || '路过的读者', body: data.body || '', likes: 0, mine: false
    });
    renderComments(ns);
    await persist(ns);
  } catch (e) { /* 评论失败静默，不打断阅读 */ }
}

/* ================= 阅读设置 ================= */
function applyReaderSettings() {
  const b = DN.current;
  const s = DNStore.mergedSettings(b);
  RD.settings = s;
  const page = document.getElementById('page-reader');
  page.style.setProperty('--rd-size', s.size + 'px');
  page.style.setProperty('--rd-font', s.font);
  page.style.setProperty('--rd-color', s.color);
  if (s.bg) { applyGlobalBg(s.bg); page.classList.add('custombg'); }
  else { applyGlobalBg(''); page.classList.remove('custombg'); }
}
function currentScope() {
  return document.getElementById('rsScope').classList.contains('g') ? 'global' : 'book';
}
async function writeSetting(patch) {
  const b = DN.current;
  if (currentScope() === 'global') {
    const g = Object.assign({}, DNStore.DEFAULT_RS, DNStore.globalSettings(), patch);
    DNStore.saveGlobal(g);
    if (b.readerSettings) { b.readerSettings = null; await DNStore.put(b); }
  } else {
    b.readerSettings = Object.assign({ scope: 'book' }, DNStore.mergedSettings(b), b.readerSettings || {}, patch, { scope: 'book' });
    await DNStore.put(b);
  }
  applyReaderSettings();
  syncSettingUI();
}
function syncSettingUI() {
  const s = DNStore.mergedSettings(DN.current);
  document.getElementById('rsSizeVal').textContent = s.size;
  const pct = (s.size - 12) / (26 - 12);
  document.querySelector('.rss-fill').style.width = (pct * 100) + '%';
  document.querySelector('.rss-knob').style.left = (pct * 100) + '%';
  document.querySelectorAll('#rsFonts .rf').forEach(el => el.classList.toggle('active', el.dataset.f === s.font));
  document.getElementById('rcPreview').style.color = s.color;
  document.getElementById('rcPreview').style.fontFamily = s.font;
  document.getElementById('rcHex').textContent = s.color.toUpperCase();
  document.getElementById('rcKnob').style.background = s.color;
}

/* ---- 纯 CSS 色环取色（不使用浏览器原生取色器） ---- */
let hsl = { h: 240, s: 0.12, l: 0.18 };
function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else[r, g, b] = [c, 0, x];
  const f = v => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return '#' + f(r) + f(g) + f(b);
}
function initColorWheel() {
  const wheel = document.getElementById('rcWheel');
  const knob = document.getElementById('rcKnob');
  const light = document.getElementById('rcLight');
  const lknob = light.querySelector('.rcl-knob');

  const place = () => {
    const rad = (hsl.h - 90) * Math.PI / 180;
    const R = 66 * (0.30 + hsl.s * 0.66);
    knob.style.left = (66 + Math.cos(rad) * R) + 'px';
    knob.style.top = (66 + Math.sin(rad) * R) + 'px';
    lknob.style.left = (hsl.l * 100) + '%';
    const hex = hslToHex(hsl.h, hsl.s, hsl.l);
    knob.style.background = hex;
    document.getElementById('rcPreview').style.color = hex;
    document.getElementById('rcHex').textContent = hex.toUpperCase();
    return hex;
  };

  let dragging = false;
  const pick = e => {
    const r = wheel.getBoundingClientRect();
    const dx = e.clientX - r.left - r.width / 2;
    const dy = e.clientY - r.top - r.height / 2;
    let a = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    if (a < 0) a += 360;
    hsl.h = a;
    const d = Math.min(1, Math.hypot(dx, dy) / (r.width / 2));
    hsl.s = Math.max(0, Math.min(1, (d - 0.30) / 0.66));
    writeSetting({ color: place() });
  };
  wheel.addEventListener('pointerdown', e => { dragging = true; wheel.setPointerCapture(e.pointerId); pick(e); });
  wheel.addEventListener('pointermove', e => { if (dragging) pick(e); });
  wheel.addEventListener('pointerup', () => dragging = false);

  let ld = false;
  const pickL = e => {
    const r = light.getBoundingClientRect();
    hsl.l = Math.max(0.03, Math.min(0.97, (e.clientX - r.left) / r.width));
    writeSetting({ color: place() });
  };
  light.addEventListener('pointerdown', e => { ld = true; light.setPointerCapture(e.pointerId); pickL(e); });
  light.addEventListener('pointermove', e => { if (ld) pickL(e); });
  light.addEventListener('pointerup', () => ld = false);
  place();
}

function initReaderSettings() {
  const panel = document.getElementById('rsPanel');
  document.getElementById('rsBookmark').onclick = () => {
    panel.classList.add('show');
    syncSettingUI();
  };
  document.getElementById('rsDone').onclick = () => panel.classList.remove('show');
  document.querySelector('.rs-grip').onclick = () => panel.classList.remove('show');

  document.querySelectorAll('.rsc-opt').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('.rsc-opt').forEach(o => o.classList.remove('active'));
      el.classList.add('active');
      document.getElementById('rsScope').classList.toggle('g', el.dataset.scope === 'global');
      syncSettingUI();
    };
  });

  document.getElementById('rsBgUp').onclick = async () => {
    const d = await dnFile(document.getElementById('rsBgFile'));
    if (!d) return;
    writeSetting({ bg: d });
  };
  document.getElementById('rsBgClear').onclick = () => writeSetting({ bg: '' });

  const slider = document.getElementById('rsSize');
  let sd = false;
  const setSize = e => {
    const r = slider.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    writeSetting({ size: Math.round(12 + p * 14) });
  };
  slider.addEventListener('pointerdown', e => { sd = true; slider.setPointerCapture(e.pointerId); setSize(e); });
  slider.addEventListener('pointermove', e => { if (sd) setSize(e); });
  slider.addEventListener('pointerup', () => sd = false);

  document.querySelectorAll('#rsFonts .rf').forEach(el => {
    el.onclick = () => writeSetting({ font: el.dataset.f });
  });

  initColorWheel();
}

/* ================= 绑定 ================= */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('rdTap').onclick = revealNext;

  document.getElementById('cmSend').onclick = () => {
    const inp = document.getElementById('cmInput');
    const v = inp.value.trim();
    if (!v) return;
    inp.value = '';
    addComment('ch', v, null);
  };
  document.getElementById('cmInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('cmSend').click();
  });

  document.getElementById('cmNext').onclick = () => {
    const b = DN.current;
    if (DN.chapterIdx + 1 >= b.catalog.length) return dnToast('已经是最后一章');
    dnClosePage('page-reader');
    onChapterTap(DN.chapterIdx + 1);
  };

  initReaderSettings();
});
