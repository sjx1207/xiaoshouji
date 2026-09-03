/* =========================================================
   回想录 · MEMOIR — archive.js
   建档（同步角色书 / 身份档）· 存档库 · 存档详情 · 阅读页
   ========================================================= */
(function () {
'use strict';
const M = window.Memoir, $ = M.$, $$ = M.$$, esc = M.esc;

const A = {};
M.Archive = A;

let archives = [], entries = [], chars = [], idents = [];
let setup = null;      // 建档草稿
let curArc = null;     // 当前查看的存档

const DERV = {
  vlog: { name: '浮光', en: 'FLOATING LIGHT' },
  qa:   { name: '叩问', en: 'INQUIRY' },
  if:   { name: '歧路', en: 'DIVERGENCE' },
  feed: { name: '回声', en: 'ECHOES' },
};
M.DERV = DERV;

A.init = async function () {
  archives = await M.db.all('archives');
  entries  = await M.db.all('entries');
};
A.reload = async function () {
  archives = await M.db.all('archives');
  entries  = await M.db.all('entries');
};
A.all = () => archives.slice();
A.byId = id => archives.find(a => a.id === id);
A.entriesOf = (aid, type) => entries.filter(e => e.archiveId === aid && (!type || e.type === type))
  .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
A.entryById = id => entries.find(e => e.id === id);
A.saveEntry = async function (en) {
  en.updatedAt = Date.now();
  await M.db.put('entries', en);
  entries = await M.db.all('entries');
  return en;
};
A.saveArchive = async function (arc) {
  arc.updatedAt = Date.now();
  await M.db.put('archives', arc);
  archives = await M.db.all('archives');
  return arc;
};

/* =========================================================
   建档
   ========================================================= */
A.openSetup = async function () {
  chars  = await M.loadChars();
  idents = await M.loadIdentities();
  setup = { charId: null, userId: null, presetIds: [], bg: null, title: '', seed: '' };
  M.nav('setup');
  renderSetup();
};

function autoBindUser(charId) {
  const byBind = idents.find(u =>
    (Array.isArray(u.boundCharIds) && u.boundCharIds.includes(charId)) || u.boundCharId === charId);
  if (byBind) return byBind.id;
  const primary = idents.find(u => u.isPrimary) || idents.find(u => u.active !== false) || idents[0];
  return primary ? primary.id : null;
}

function renderSetup() {
  const c = chars.find(x => x.id === setup.charId);
  const u = idents.find(x => x.id === setup.userId);
  const body = $('#setupBody');

  body.innerHTML = `
    <div class="m-sec-label" style="margin-top:2px"><span>角 色 书</span></div>
    ${chars.length ? `<div class="m-pickrow" id="suChars">
      ${chars.map(ch => `
        <div class="m-pcard ${ch.id === setup.charId ? 'on' : ''}" data-cid="${ch.id}">
          ${M.avatarHtml(ch, 'lg')}
          <div class="m-pcard-n">${esc(ch.name || '未命名')}</div>
          <div class="m-pcard-r">${esc(ch.role || ch.species || '—')}</div>
        </div>`).join('')}
    </div>` : `<div class="m-panel" style="padding:20px"><div style="font-size:12.5px;line-height:1.9;color:var(--ink-4)">角色书里还没有角色。请先到「角色」App 创建，回想录会自动同步。</div></div>`}

    <div class="m-sec-label"><span>你 的 身 份</span></div>
    ${idents.length ? `<div class="m-pickrow" id="suUsers">
      ${idents.map(it => `
        <div class="m-pcard ${it.id === setup.userId ? 'on' : ''}" data-uid="${it.id}">
          ${M.avatarHtml(it, 'lg round')}
          <div class="m-pcard-n">${esc(it.name || '未命名')}</div>
          <div class="m-pcard-r">${esc(it.identityType || it.role || '—')}</div>
        </div>`).join('')}
    </div>` : `<div class="m-panel" style="padding:20px"><div style="font-size:12.5px;line-height:1.9;color:var(--ink-4)">身份档为空。可到「身份」App 创建，用于精准定义"你"在故事里的样子。</div></div>`}
    ${c && u ? `<div class="m-panel" style="padding:15px 16px;margin-top:4px">
      <div class="m-orn-c tl"></div><div class="m-orn-c tr"></div><div class="m-orn-c bl"></div><div class="m-orn-c br"></div>
      <div style="display:flex;align-items:center;gap:12px">
        ${M.avatarHtml(c)}<div style="font-family:var(--serif);font-size:12px;letter-spacing:.2em;color:var(--ink-4)">与</div>${M.avatarHtml(u, 'round')}
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;color:var(--ink)">${esc(c.name)} · ${esc(u.name)}</div>
          <div style="margin-top:4px;font-size:10.5px;color:var(--ink-5);letter-spacing:.1em">${esc(c.relation || '关系未定义')}${c.callUser ? ' ｜ 称你为 ' + esc(c.callUser) : ''}</div>
        </div>
      </div>
    </div>` : ''}

    <div class="m-sec-label"><span>预 设</span></div>
    <div id="suPresets">${M.Preset.pickerHtml(setup.presetIds)}</div>

    <div class="m-sec-label"><span>存 档</span></div>
    <div class="m-field">
      <div class="m-field-label">存档名<em>TITLE</em></div>
      <input class="m-input" id="suTitle" placeholder="${esc(c ? '与' + c.name + '的回想' : '例：雨季的第七天')}" value="${esc(setup.title)}" />
    </div>
    <div class="m-field">
      <div class="m-field-label">开场引导<em>OPENING · 可留空</em></div>
      <textarea class="m-textarea" id="suSeed" placeholder="想从哪里开始？例如：深夜的便利店，她第三次出现在同一个货架前。留空则由角色的开场白与设定自动起笔。">${esc(setup.seed)}</textarea>
    </div>
    <div class="m-field">
      <div class="m-field-label">存档背景<em>COVER · 用于装饰存档卡</em></div>
      <div class="m-bgpick ${setup.bg ? 'has' : ''}" id="suBg">
        ${setup.bg ? `<img src="${esc(setup.bg)}" alt="" />` : ''}
        <div class="m-orn-c tl"></div><div class="m-orn-c tr"></div><div class="m-orn-c bl"></div><div class="m-orn-c br"></div>
        <div class="m-bgpick-hint">${setup.bg ? '轻触更换背景' : '轻触上传一张背景图'}</div>
      </div>
    </div>
    <div class="m-rule"><i></i><b></b><i></i></div>
    <div class="m-btn wide dark" data-act="setup-go">开 始 回 想</div>
    <div style="height:24px"></div>`;

  const cr = $('#suChars');
  if (cr) cr.onclick = e => {
    const el = e.target.closest('.m-pcard'); if (!el) return;
    setup.charId = el.dataset.cid;
    if (!setup.userId) setup.userId = autoBindUser(setup.charId);
    renderSetup();
  };
  const ur = $('#suUsers');
  if (ur) ur.onclick = e => {
    const el = e.target.closest('.m-pcard'); if (!el) return;
    setup.userId = el.dataset.uid; renderSetup();
  };
  $('#suPresets').onclick = e => {
    const ch = e.target.closest('.m-chip'); if (!ch) return;
    const id = ch.dataset.pid;
    const at = setup.presetIds.indexOf(id);
    if (at > -1) setup.presetIds.splice(at, 1); else setup.presetIds.push(id);
    ch.classList.toggle('on');
  };
  $('#suTitle').oninput = e => setup.title = e.target.value;
  $('#suSeed').oninput = e => setup.seed = e.target.value;
  $('#suBg').onclick = async () => {
    const d = await M.pickImage(1400);
    if (d) { setup.bg = d; renderSetup(); }
  };
}

M.actions['setup-go'] = async () => {
  if (!setup) return;
  if (!setup.charId) { M.toast('请先选择一位角色'); return; }
  const c = chars.find(x => x.id === setup.charId);
  const u = idents.find(x => x.id === setup.userId) || null;
  const arc = {
    id: M.uid(),
    title: (setup.title || '').trim() || `与${c.name || '未名'}的回想`,
    charId: c.id, char: JSON.parse(JSON.stringify(c)),
    userId: u ? u.id : null, user: u ? JSON.parse(JSON.stringify(u)) : null,
    presetIds: setup.presetIds.slice(),
    bg: setup.bg || null,
    seed: setup.seed || '',
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await A.saveArchive(arc);
  M.toast('存档已建立');
  const scene = await A.newScene(arc, setup.seed);
  M.Play.open(arc, scene, true);
};

A.newScene = async function (arc, seed) {
  const idx = A.entriesOf(arc.id, 'scene').length + 1;
  const en = {
    id: M.uid(), archiveId: arc.id, type: 'scene',
    title: `第${idx}段 · 未命名`, index: idx,
    seed: seed || '', turns: [],
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await A.saveEntry(en);
  return en;
};

/* =========================================================
   存档库
   ========================================================= */
A.renderList = function () {
  const box = $('#archiveList');
  const list = archives.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  if (!list.length) {
    box.innerHTML = `
      <div class="m-empty" style="padding-top:110px">
        <div class="m-empty-mark"><b></b></div>
        <div class="m-empty-t">还没有任何存档</div>
        <div class="m-empty-d">从一位角色开始，回想录会替你保管<br/>剧情、浮光、叩问、歧路与回声</div>
        <div class="m-btn dark" style="margin-top:24px" data-act="start">建 立 第 一 个 存 档</div>
      </div>`;
    return;
  }
  box.innerHTML = list.map(a => {
    const sc = A.entriesOf(a.id, 'scene');
    const dv = entries.filter(e => e.archiveId === a.id && e.type !== 'scene');
    const last = sc[0];
    const preview = last && last.turns && last.turns.length
      ? stripTags(last.turns[last.turns.length - 1].text || '').slice(0, 70)
      : (a.seed || '尚未开始第一段剧情');
    return `
      <div class="m-arc" data-aid="${a.id}">
        <div class="m-arc-bg">${a.bg ? `<img src="${esc(a.bg)}" alt="" />` : ''}</div>
        <div class="m-arc-scrim"></div>
        <div class="m-arc-in">
          <div class="m-arc-head">
            <div class="m-arc-avs">
              ${M.avatarHtml(a.char)}
              ${a.user ? M.avatarHtml(a.user, 'round') : ''}
            </div>
            <div class="m-arc-name">
              <div class="m-arc-t">${esc(a.title)}</div>
              <div class="m-arc-pair">${esc(a.char.name || '')}${a.user ? ' ｜ ' + esc(a.user.name || '') : ''}</div>
            </div>
          </div>
          <div class="m-arc-body">${esc(preview)}</div>
          <div class="m-arc-foot">
            <span class="m-arc-cnt">剧情 <b>${sc.length}</b></span>
            <span class="m-arc-cnt">衍生 <b>${dv.length}</b></span>
            <span class="m-arc-date">${esc(M.fmtDate(a.updatedAt))}</span>
          </div>
        </div>
      </div>`;
  }).join('');
  box.onclick = e => {
    const el = e.target.closest('.m-arc'); if (!el) return;
    A.openDetail(el.dataset.aid);
  };
};

function stripTags(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); }
M.stripTags = stripTags;

/* =========================================================
   存档详情
   ========================================================= */
A.openDetail = function (aid) {
  curArc = A.byId(aid); if (!curArc) return;
  A.current = curArc;
  M.nav('archive-detail');
  A.renderDetail();
};

A.renderDetail = function () {
  const a = curArc; if (!a) return;
  $('#adTitle').innerHTML = esc(a.title) + '<em>RECORD</em>';
  const scenes = A.entriesOf(a.id, 'scene').sort((x, y) => (x.index || 0) - (y.index || 0));
  const body = $('#adBody');

  const dervRow = Object.keys(DERV).map(k => {
    const n = A.entriesOf(a.id, k).length;
    return `<div class="m-derv" data-derv="${k}">
      <div class="m-derv-n">${esc(DERV[k].name)}</div>
      <div class="m-derv-c">${n}</div>
    </div>`;
  }).join('');

  body.innerHTML = `
    <div class="m-ad-hero">
      <div class="m-ad-hero-bg">${a.bg ? `<img src="${esc(a.bg)}" alt="" />` : ''}</div>
      <div class="m-ad-hero-scrim"></div>
      <div class="m-ad-hero-in">
        <div class="m-ad-avs">
          ${M.avatarHtml(a.char, 'lg')}
          <span class="m-rel">${esc((a.char.relation || '').slice(0, 8) || '与')}</span>
          ${a.user ? M.avatarHtml(a.user, 'lg round') : ''}
        </div>
        <div class="m-ad-t">${esc(a.title)}</div>
        <div class="m-ad-sub">${esc(a.char.name || '')}${a.user ? ' ｜ ' + esc(a.user.name || '') : ''} ｜ ${esc(M.fmtDate(a.createdAt))}</div>
      </div>
    </div>

    <div class="m-sec-label" style="margin-top:6px"><span>衍 生</span></div>
    <div class="m-derv-grid" id="adDerv">${dervRow}</div>

    <div class="m-sec-label"><span>剧 情</span></div>
    ${scenes.length ? scenes.map(s => {
      const turns = s.turns || [];
      const lastAi = [...turns].reverse().find(t => t.role === 'ai');
      return `
      <div class="m-scene" data-sid="${s.id}">
        <div class="m-scene-idx">${s.index || '·'}</div>
        <div class="m-scene-b">
          <div class="m-scene-t">${esc(s.title)}</div>
          <div class="m-scene-d">${esc(stripTags(lastAi ? lastAi.text : s.seed).slice(0, 84) || '尚未生成内容')}</div>
          <div class="m-scene-m">
            <span class="m-badge">${turns.filter(t => t.role === 'ai').length} 回合</span>
            <span class="m-badge">${esc(M.fmtDate(s.updatedAt))}</span>
          </div>
        </div>
      </div>`;
    }).join('') : `<div style="font-size:12px;color:var(--ink-5);line-height:1.9;padding:8px 4px 14px">这个存档还没有剧情段落。</div>`}

    <div class="m-btn wide ghost" data-act="ad-new-scene" style="margin-top:6px">新 起 一 段 剧 情</div>
    <div class="m-rule"><i></i><b></b><i></i></div>
    <div style="font-size:10.5px;letter-spacing:.16em;color:var(--ink-5);text-align:center">全部衍生内容均归档于此存档之下</div>
    <div style="height:22px"></div>`;

  $('#adDerv').onclick = e => {
    const d = e.target.closest('.m-derv'); if (!d) return;
    A.showDervList(d.dataset.derv);
  };
  body.querySelectorAll('.m-scene').forEach(el => {
    el.onclick = () => {
      const s = A.entryById(el.dataset.sid);
      if (s) M.Play.open(a, s, false);
    };
  });
};

M.actions['ad-new-scene'] = async () => {
  const s = await A.newScene(curArc, '');
  M.Play.open(curArc, s, true);
};

M.actions['ad-menu'] = async () => {
  const a = curArc; if (!a) return;
  const v = await M.sheet({
    title: '存档操作', plain: true, options: [
      { id: 'rename', title: '重命名存档', desc: a.title },
      { id: 'bg', title: '更换存档背景', desc: '用于装饰存档卡与详情页' },
      { id: 'resync', title: '重新同步角色与身份', desc: '从角色书 / 身份档拉取最新资料' },
      { id: 'export', title: '导出存档为文本', desc: '剧情与衍生内容合并导出' },
      { id: 'del', title: '删除整个存档', desc: '连同其下所有剧情与衍生内容', danger: true },
    ],
  });
  if (!v) return;
  if (v === 'rename') {
    const t = await M.prompt('重命名存档', { input: { value: a.title, placeholder: '存档名' } });
    if (t) { a.title = t; await A.saveArchive(a); A.renderDetail(); M.toast('已更名'); }
  } else if (v === 'bg') {
    const d = await M.pickImage(1400);
    if (d) { a.bg = d; await A.saveArchive(a); A.renderDetail(); M.toast('背景已更新'); }
  } else if (v === 'resync') {
    const cs = await M.loadChars(), us = await M.loadIdentities();
    const c = cs.find(x => x.id === a.charId), u = us.find(x => x.id === a.userId);
    if (c) a.char = JSON.parse(JSON.stringify(c));
    if (u) a.user = JSON.parse(JSON.stringify(u));
    await A.saveArchive(a); A.renderDetail();
    M.toast(c ? '资料已同步' : '角色书中已找不到该角色');
  } else if (v === 'export') {
    A.exportText(a);
  } else if (v === 'del') {
    const ok = await M.confirm('删除整个存档', `「${a.title}」及其下 ${A.entriesOf(a.id).length} 条内容都会被永久移除。`, '删除');
    if (!ok) return;
    for (const e of A.entriesOf(a.id)) await M.db.del('entries', e.id);
    await M.db.del('archives', a.id);
    await A.reload();
    M.toast('存档已删除');
    M.back(); A.renderList(); M.Home.render();
  }
};

A.exportText = function (a) {
  const lines = [`《${a.title}》`, `角色：${a.char.name || ''}　身份：${a.user ? a.user.name : '未设定'}`, `建立：${M.fmtDate(a.createdAt)}`, ''];
  A.entriesOf(a.id, 'scene').sort((x, y) => (x.index || 0) - (y.index || 0)).forEach(s => {
    lines.push('—— ' + s.title + ' ——');
    (s.turns || []).forEach(t => {
      lines.push((t.role === 'user' ? '【你】' : '【叙事】') + '\n' + stripTags(t.text));
      lines.push('');
    });
  });
  Object.keys(DERV).forEach(k => {
    const es = A.entriesOf(a.id, k);
    if (!es.length) return;
    lines.push(`—— ${DERV[k].name} ——`);
    es.forEach(e => lines.push(`· ${e.title}（${M.fmtDate(e.createdAt)}）\n${stripTags(e.plain || e.html || JSON.stringify(e.data || ''))}\n`));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a2 = document.createElement('a');
  a2.href = url; a2.download = a.title + '.txt'; a2.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  M.toast('已导出');
};

/* 衍生列表 */
A.showDervList = async function (type) {
  const list = A.entriesOf(curArc.id, type);
  if (!list.length) {
    const go = await M.sheet({
      title: DERV[type].name, desc: `这个存档还没有${DERV[type].name}内容。是否现在生成一份？`,
      confirm: true, okText: '去生成',
    });
    if (go) M.Extras.start(type, curArc.id);
    return;
  }
  const v = await M.sheet({
    title: DERV[type].name, desc: `共 ${list.length} 份`, plain: true,
    options: list.map(e => ({ id: e.id, title: e.title, desc: M.fmtDate(e.createdAt) }))
      .concat([{ id: '__new', title: '生成新的一份' }]),
  });
  if (!v) return;
  if (v === '__new') { M.Extras.start(type, curArc.id); return; }
  A.openEntry(v);
};

/* =========================================================
   阅读页
   ========================================================= */
let curEntry = null;
A.openEntry = function (id) {
  const en = A.entryById(id); if (!en) return;
  curEntry = en; A.currentEntry = en;
  if (en.type === 'vlog') { M.Extras.openVlog(en); return; }
  const arc = A.byId(en.archiveId);
  $('#readerTitle').innerHTML = esc(en.title) + `<em>${esc((DERV[en.type] || {}).en || 'READ')}</em>`;
  const body = $('#readerBody');
  body.innerHTML = `
    <div class="m-read-hero">
      <div class="m-read-kicker">${esc((DERV[en.type] || {}).en || '')}</div>
      <div class="m-read-t">${esc(en.title)}</div>
      <div class="m-read-meta">${esc(arc ? arc.title : '')} ｜ ${esc(M.fmtDate(en.createdAt))}</div>
    </div>
    <div id="readerMount"></div>
    <div style="height:26px"></div>`;
  const mount = $('#readerMount');
  if (en.type === 'feed') {
    M.Extras.renderFeed(mount, en, arc);
  } else if (en.html) {
    const holder = document.createElement('div');
    holder.className = 'm-ai-frame';
    mount.appendChild(holder);
    M.renderFrame(holder, en.html);
  } else {
    mount.innerHTML = `<div class="m-ai-frame"><div class="m-ai-raw">${esc(en.plain || '（无内容）')}</div></div>`;
  }
  M.nav('reader');
};

M.actions['reader-menu'] = async () => {
  const en = curEntry; if (!en) return;
  const v = await M.sheet({
    title: '内容操作', plain: true, options: [
      { id: 'rename', title: '重命名' },
      { id: 'regen', title: '重新生成', desc: '使用相同来源再生成一份' },
      { id: 'del', title: '删除这份内容', danger: true },
    ],
  });
  if (v === 'rename') {
    const t = await M.prompt('重命名', { input: { value: en.title } });
    if (t) { en.title = t; await A.saveEntry(en); $('#readerTitle').innerHTML = esc(t) + '<em>READ</em>'; A.openEntry(en.id); M.toast('已更名'); }
  } else if (v === 'regen') {
    M.Extras.regen(en);
  } else if (v === 'del') {
    const ok = await M.confirm('删除这份内容', en.title, '删除');
    if (!ok) return;
    await M.db.del('entries', en.id);
    await A.reload();
    M.toast('已删除'); M.back(); A.renderDetail(); M.Home.render();
  }
};

})();
