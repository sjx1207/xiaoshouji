/* =========================================================
   回想录 · MEMOIR — preset.js
   预设库：文风 / 世界观 / 角色视角 / 用户视角 / 剧情线 / 叙事规则 / 补充设定
   ========================================================= */
(function () {
'use strict';
const M = window.Memoir, $ = M.$, esc = M.esc;

const CATS = [
  { id: 'style',    name: '文风',     en: 'PROSE',      hint: '叙述语气、节奏、修辞密度、人称与时态' },
  { id: 'world',    name: '世界观',   en: 'WORLD',      hint: '时代、地理、体系、规则、禁忌、社会结构' },
  { id: 'charview', name: 'CHAR 视角', en: 'CHAR VIEW',  hint: '角色如何看待世界与用户，内心倾向与行为逻辑' },
  { id: 'userview', name: 'USER 视角', en: 'USER VIEW',  hint: '用户在故事中的处境、立场、已知与未知' },
  { id: 'plot',     name: '剧情',     en: 'PLOT',       hint: '主线走向、阶段目标、伏笔、可触发事件' },
  { id: 'rule',     name: '叙事规则', en: 'RULE',       hint: '排版结构、每回合信息量、禁止事项、互动方式' },
  { id: 'lore',     name: '补充设定', en: 'LORE',       hint: '道具、组织、术语、配角、时间线等杂项' },
];
M.PRESET_CATS = CATS;

const SEEDS = [
  { cat: 'style', title: '冷调纪实', content: '第三人称限知视角，克制、精准、少形容词。用具体的物件、温度、声音与光线承载情绪，不直接写"她很难过"，而写她把杯子放回桌上时手停了半秒。段落偏短，句子有呼吸。对白简省，留白多于解释。' },
  { cat: 'style', title: '细密抒情', content: '第三人称贴身视角，允许绵长的从句与通感。环境与心理互相渗透，善用季节、气味、旧物与光影。每段至少出现一次具体的感官细节。避免抒情空转，情绪必须落在动作或物件上。' },
  { cat: 'rule',  title: '标准叙事回合', content: '每一回合包含：场景与氛围的推进（不少于两段）、角色的具体动作与神态、至少一句台词、以及一个把主动权交还给用户的收束（一个悬置的动作、一个问题、或一个正在发生的变化）。禁止替用户决定其行为、心理与台词。禁止一次性推进过多时间。禁止出现选项以外的元叙述。' },
  { cat: 'rule',  title: '交互式回合', content: '在叙事结尾提供 2 至 4 个可点击的行动选项，用 <button data-send="选项文字"> 实现；同时保留用户自由输入的可能，不要写"只能选择以下选项"。可附带一个可展开的"此刻的状态"面板，用自绘 CSS 呈现时间、地点、在场者与氛围。' },
  { cat: 'world', title: '当代都市', content: '现代都市背景，写字楼、地铁、便利店、雨天的车流。没有超自然要素，一切冲突来自人际关系、时间与选择。物价、交通、通讯方式均符合现实。' },
];

const P = {};
M.Preset = P;
let list = [], curCat = 'style', editing = null;

P.init = async function () {
  list = await M.db.all('presets');
  if (!list.length && !localStorage.getItem('memoir_seeded')) {
    for (const s of SEEDS) {
      await M.db.put('presets', {
        id: M.uid(), cat: s.cat, title: s.title, content: s.content,
        tags: [], createdAt: Date.now(), updatedAt: Date.now(),
      });
    }
    localStorage.setItem('memoir_seeded', '1');
    list = await M.db.all('presets');
  }
};

P.all = () => list.slice();
P.byId = id => list.find(p => p.id === id);
P.byCat = cat => list.filter(p => p.cat === cat);

P.renderList = function () {
  const tabs = $('#presetTabs');
  tabs.innerHTML = CATS.map(c =>
    `<div class="m-tab ${c.id === curCat ? 'on' : ''}" data-cat="${c.id}">${esc(c.name)}<b>${P.byCat(c.id).length}</b></div>`
  ).join('');
  tabs.onclick = e => {
    const t = e.target.closest('.m-tab'); if (!t) return;
    curCat = t.dataset.cat; P.renderList();
    $('#presetList').scrollTop = 0;
  };

  const cat = CATS.find(c => c.id === curCat);
  const items = P.byCat(curCat).sort((a, b) => b.updatedAt - a.updatedAt);
  const box = $('#presetList');
  box.innerHTML = `
    <div class="m-sec-label" style="margin-top:6px"><span>${esc(cat.name)}</span></div>
    <div style="font-size:11.5px;line-height:1.85;color:var(--ink-5);margin:-4px 4px 16px">${esc(cat.hint)}</div>
    ${items.length ? items.map(p => `
      <div class="m-preset" data-pid="${p.id}">
        <div class="m-preset-top">
          <div class="m-preset-t">${esc(p.title)}</div>
          <div class="m-badge">${esc(cat.en)}</div>
        </div>
        <div class="m-preset-d">${esc(p.content)}</div>
        <div class="m-preset-meta">
          <span>${esc(M.fmtDate(p.updatedAt))}</span>
          <span style="margin-left:auto">${p.content.length} 字</span>
        </div>
      </div>`).join('') : `
      <div class="m-empty">
        <div class="m-empty-mark"><b></b></div>
        <div class="m-empty-t">此类尚无预设</div>
        <div class="m-empty-d">点击右上角新建，为生成提供更精准的素材</div>
      </div>`}
    <div class="m-rule"><i></i><b></b><i></i></div>
    <div class="m-btn wide ghost" data-act="preset-new">新建一条${esc(cat.name)}预设</div>`;
  box.onclick = e => {
    const c = e.target.closest('.m-preset'); if (!c) return;
    P.openEdit(c.dataset.pid);
  };
};

P.openEdit = function (id) {
  editing = id ? P.byId(id) : null;
  const cat = editing ? editing.cat : curCat;
  const catObj = CATS.find(c => c.id === cat);
  $('#presetEditTitle').innerHTML = (editing ? '编辑预设' : '新建预设') + `<em>${esc(catObj.en)}</em>`;
  $('#presetEditBody').innerHTML = `
    <div class="m-field">
      <div class="m-field-label">分类<em>CATEGORY</em></div>
      <div class="m-chips" id="pcCats">
        ${CATS.map(c => `<div class="m-chip ${c.id === cat ? 'on' : ''}" data-c="${c.id}">${esc(c.name)}</div>`).join('')}
      </div>
    </div>
    <div class="m-field">
      <div class="m-field-label">标题<em>TITLE</em></div>
      <input class="m-input" id="pcTitle" placeholder="例：冷调纪实" value="${esc(editing ? editing.title : '')}" />
    </div>
    <div class="m-field">
      <div class="m-field-label">内容<em>CONTENT</em></div>
      <textarea class="m-textarea" id="pcContent" style="min-height:260px" placeholder="${esc(catObj.hint)}">${esc(editing ? editing.content : '')}</textarea>
    </div>
    <div class="m-field">
      <div class="m-field-label">关键词<em>TAGS · 逗号分隔</em></div>
      <input class="m-input" id="pcTags" placeholder="克制, 第三人称, 短句" value="${esc(editing && editing.tags ? editing.tags.join(', ') : '')}" />
    </div>
    ${editing ? `<div class="m-rule"><i></i><b></b><i></i></div>
      <div class="m-btn wide ghost" data-act="preset-del" style="color:#9a2b2b">删除这条预设</div>` : ''}
    <div style="height:20px"></div>`;
  $('#pcCats').onclick = e => {
    const c = e.target.closest('.m-chip'); if (!c) return;
    M.$$('#pcCats .m-chip').forEach(x => x.classList.remove('on'));
    c.classList.add('on');
  };
  M.nav('preset-edit');
};

M.actions['preset-new'] = () => P.openEdit(null);

M.actions['preset-save'] = async () => {
  const title = $('#pcTitle').value.trim();
  const content = $('#pcContent').value.trim();
  if (!title) { M.toast('请填写标题'); $('#pcTitle').focus(); return; }
  if (!content) { M.toast('请填写内容'); $('#pcContent').focus(); return; }
  const cat = M.$('#pcCats .m-chip.on').dataset.c;
  const tags = $('#pcTags').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const obj = editing
    ? Object.assign({}, editing, { title, content, cat, tags, updatedAt: Date.now() })
    : { id: M.uid(), title, content, cat, tags, createdAt: Date.now(), updatedAt: Date.now() };
  await M.db.put('presets', obj);
  list = await M.db.all('presets');
  curCat = cat;
  M.toast('预设已保存');
  M.back(); P.renderList(); M.Home.render();
};

M.actions['preset-del'] = async () => {
  if (!editing) return;
  const ok = await M.confirm('删除这条预设', `「${editing.title}」将被永久移除，已建立的存档不受影响。`, '删除');
  if (!ok) return;
  await M.db.del('presets', editing.id);
  list = await M.db.all('presets');
  M.toast('已删除');
  M.back(); P.renderList(); M.Home.render();
};

/* 供建档页使用的选择器 */
P.pickerHtml = function (selected) {
  return CATS.map(c => {
    const items = P.byCat(c.id);
    if (!items.length) return '';
    return `
      <div class="m-field">
        <div class="m-field-label">${esc(c.name)}<em>${esc(c.en)}</em></div>
        <div class="m-chips" data-pcat="${c.id}">
          ${items.map(p => `<div class="m-chip ${selected.includes(p.id) ? 'on' : ''}" data-pid="${p.id}">${esc(p.title)}</div>`).join('')}
        </div>
      </div>`;
  }).join('') || `<div style="font-size:12px;color:var(--ink-5);line-height:1.9;padding:6px 4px">预设库还是空的。可以先直接开始，之后再回到预设库补充文风与世界观。</div>`;
};

/* 组装成提示词 */
P.compose = function (ids) {
  const chosen = ids.map(id => P.byId(id)).filter(Boolean);
  if (!chosen.length) return '';
  const byCat = {};
  chosen.forEach(p => { (byCat[p.cat] = byCat[p.cat] || []).push(p); });
  return CATS.filter(c => byCat[c.id]).map(c =>
    `【${c.name}】\n` + byCat[c.id].map(p => `· ${p.title}：${p.content}`).join('\n')
  ).join('\n\n');
};

})();
