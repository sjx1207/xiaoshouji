/* =========================================================
   回想录 · MEMOIR — extras.js
   浮光（仿视频 vlog）· 叩问（Q&A）· 歧路（IF 线）· 回声（动态）
   ========================================================= */
(function () {
'use strict';
const M = window.Memoir, $ = M.$, $$ = M.$$, esc = M.esc;

const E = {};
M.Extras = E;

const META = {
  vlog: { name: '浮光', en: 'FLOATING LIGHT', desc: '把剧情演成一帧一帧的画面与话语，未到的部分会被藏起来' },
  qa:   { name: '叩问', en: 'INQUIRY',        desc: '围绕剧情本身提出并回答问题，可交互展开' },
  if:   { name: '歧路', en: 'DIVERGENCE',     desc: '选定一个瞬间，让故事走上另一条路' },
  feed: { name: '回声', en: 'ECHOES',         desc: '角色们把这段经历发成动态，彼此评论' },
};

let pick = null;

E.init = function () {};

/* =========================================================
   来源选择页
   ========================================================= */
E.start = async function (type, archiveId, sceneId) {
  await M.Archive.reload();
  const arcs = M.Archive.all();
  if (!arcs.length) {
    M.alert(META[type].name, '还没有任何存档。先建立一个存档并跑一段剧情，衍生玩法才有素材可用。');
    return;
  }
  pick = {
    type,
    archiveId: archiveId || arcs.sort((a, b) => b.updatedAt - a.updatedAt)[0].id,
    sceneId: sceneId || null,
    scope: type === 'if' ? 'one' : (sceneId ? 'one' : 'all'),
    opts: defaultOpts(type),
  };
  M.nav('pick');
  renderPick();
};

function defaultOpts(type) {
  if (type === 'vlog') return { length: 'std', voice: 'film' };
  if (type === 'qa')   return { count: 8, angle: 'mix' };
  if (type === 'feed') return { platform: 'moments', posts: 4 };
  return {};
}

function renderPick() {
  const t = pick.type, meta = META[t];
  $('#pickTitle').innerHTML = esc(meta.name) + `<em>${esc(meta.en)}</em>`;
  const arcs = M.Archive.all().sort((a, b) => b.updatedAt - a.updatedAt);
  const arc = M.Archive.byId(pick.archiveId);
  const scenes = M.Archive.entriesOf(pick.archiveId, 'scene')
    .filter(s => (s.turns || []).some(x => x.role === 'ai'))
    .sort((a, b) => (a.index || 0) - (b.index || 0));

  if (pick.scope === 'one' && !pick.sceneId && scenes.length) pick.sceneId = scenes[scenes.length - 1].id;

  $('#pickBody').innerHTML = `
    <div class="m-panel" style="padding:18px 17px;margin-bottom:4px">
      <div class="m-orn-c tl"></div><div class="m-orn-c tr"></div><div class="m-orn-c bl"></div><div class="m-orn-c br"></div>
      <div style="font-family:var(--mono);font-size:8px;letter-spacing:.32em;color:var(--ink-5)">${esc(meta.en)}</div>
      <div style="margin-top:10px;font-family:var(--serif);font-size:24px;letter-spacing:.18em;color:var(--ink)">${esc(meta.name)}</div>
      <div style="margin-top:10px;font-size:12px;line-height:1.9;color:var(--ink-4)">${esc(meta.desc)}</div>
    </div>

    <div class="m-sec-label"><span>存 档</span></div>
    <div class="m-pickrow" id="pkArcs">
      ${arcs.map(a => `
        <div class="m-pcard ${a.id === pick.archiveId ? 'on' : ''}" data-aid="${a.id}" style="width:126px">
          ${M.avatarHtml(a.char, 'lg')}
          <div class="m-pcard-n">${esc(a.title)}</div>
          <div class="m-pcard-r">${esc(a.char.name || '')}</div>
        </div>`).join('')}
    </div>

    <div class="m-sec-label"><span>范 围</span></div>
    ${t === 'if' ? `
      <div style="font-size:11.5px;line-height:1.9;color:var(--ink-5);margin:-4px 4px 12px">歧路只能从单独一段剧情分出，否则分歧便失去了意义。</div>
    ` : `
      <div class="m-chips" id="pkScope" style="margin-bottom:14px">
        <div class="m-chip ${pick.scope === 'one' ? 'on' : ''}" data-s="one">某一段剧情</div>
        <div class="m-chip ${pick.scope === 'all' ? 'on' : ''}" data-s="all">整个存档</div>
      </div>`}

    ${(pick.scope === 'one' || t === 'if') ? (scenes.length ? `
      <div id="pkScenes">
        ${scenes.map(s => `
          <div class="m-scene ${s.id === pick.sceneId ? 'on' : ''}" data-sid="${s.id}"
               style="${s.id === pick.sceneId ? 'border-color:var(--line-3);background:#fff;box-shadow:var(--sh-1)' : ''}">
            <div class="m-scene-idx">${s.index || '·'}</div>
            <div class="m-scene-b">
              <div class="m-scene-t">${esc(s.title)}</div>
              <div class="m-scene-d">${esc(M.stripTags(((s.turns || []).filter(x => x.role === 'ai').pop() || {}).text || '').slice(0, 80))}</div>
              <div class="m-scene-m"><span class="m-badge">${(s.turns || []).filter(x => x.role === 'ai').length} 回合</span></div>
            </div>
          </div>`).join('')}
      </div>` : `<div style="font-size:12px;color:var(--ink-5);padding:8px 4px">这个存档还没有已生成内容的剧情段落。</div>`)
      : `<div style="font-size:11.5px;line-height:1.9;color:var(--ink-5);margin:-4px 4px 12px">将读取该存档下全部 ${scenes.length} 段剧情作为素材。</div>`}

    <div class="m-sec-label"><span>参 数</span></div>
    ${optsHtml(t)}

    <div class="m-rule"><i></i><b></b><i></i></div>
    <div class="m-btn wide dark" data-act="pick-go">开 始 生 成</div>
    <div style="height:24px"></div>`;

  $('#pkArcs').onclick = e => {
    const el = e.target.closest('.m-pcard'); if (!el) return;
    pick.archiveId = el.dataset.aid; pick.sceneId = null; renderPick();
  };
  const sc = $('#pkScope');
  if (sc) sc.onclick = e => {
    const el = e.target.closest('.m-chip'); if (!el) return;
    pick.scope = el.dataset.s; renderPick();
  };
  const ss = $('#pkScenes');
  if (ss) ss.onclick = e => {
    const el = e.target.closest('.m-scene'); if (!el) return;
    pick.sceneId = el.dataset.sid; renderPick();
  };
  const op = $('#pkOpts');
  if (op) op.onclick = e => {
    const el = e.target.closest('.m-chip'); if (!el) return;
    const k = el.parentElement.dataset.k;
    M.$$(`[data-k="${k}"] .m-chip`).forEach(x => x.classList.remove('on'));
    el.classList.add('on');
    pick.opts[k] = isNaN(+el.dataset.v) ? el.dataset.v : +el.dataset.v;
  };
}

function optsHtml(t) {
  const grp = (k, label, items) => `
    <div class="m-field">
      <div class="m-field-label">${label}</div>
      <div class="m-chips" data-k="${k}">
        ${items.map(i => `<div class="m-chip ${String(pick.opts[k]) === String(i.v) ? 'on' : ''}" data-v="${i.v}">${esc(i.t)}</div>`).join('')}
      </div>
    </div>`;
  let h = '<div id="pkOpts">';
  if (t === 'vlog') {
    h += grp('length', '片长<em>DURATION</em>', [
      { v: 'short', t: '短片 · 约 1 分钟' }, { v: 'std', t: '标准 · 约 2 分半' }, { v: 'long', t: '完整 · 约 5 分钟' }]);
    h += grp('voice', '影像语气<em>TONE</em>', [
      { v: 'film', t: '电影感' }, { v: 'diary', t: '私影像' }, { v: 'doc', t: '纪录片' }]);
  } else if (t === 'qa') {
    h += grp('count', '题量<em>COUNT</em>', [{ v: 5, t: '5 题' }, { v: 8, t: '8 题' }, { v: 12, t: '12 题' }]);
    h += grp('angle', '角度<em>ANGLE</em>', [
      { v: 'mix', t: '综合' }, { v: 'emotion', t: '情感与动机' },
      { v: 'detail', t: '细节与伏笔' }, { v: 'char', t: '角色本人回答' }]);
  } else if (t === 'feed') {
    h += grp('platform', '形态<em>FORM</em>', [
      { v: 'moments', t: '朋友圈式' }, { v: 'zone', t: '空间说说式' }, { v: 'twi', t: '推文式' }]);
    h += grp('posts', '条数<em>POSTS</em>', [{ v: 3, t: '3 条' }, { v: 4, t: '4 条' }, { v: 6, t: '6 条' }]);
  } else if (t === 'if') {
    h += `<div style="font-size:11.5px;line-height:1.9;color:var(--ink-5);padding:2px 4px 8px">
      生成流程：先由模型勘定这一段中真正存在过的分歧瞬间，你选定其一，再进入可交互的分支叙事；分支会作为独立的歧路存档保存在该存档之下。</div>`;
  }
  return h + '</div>';
}

/* =========================================================
   素材整理
   ========================================================= */
function sourceText(arc, sceneIds) {
  const out = [];
  sceneIds.forEach(sid => {
    const s = M.Archive.entryById(sid); if (!s) return;
    out.push(`〔${s.title}〕`);
    (s.turns || []).forEach(t => {
      const txt = M.stripTags(t.text || '');
      if (!txt) return;
      out.push((t.role === 'user' ? (t.director ? '［导演指令］' : '［用户行动］') : '［叙事］') + txt);
    });
  });
  let s = out.join('\n\n');
  const LIMIT = 26000;
  if (s.length > LIMIT) s = s.slice(0, 9000) + '\n\n……（中段略）……\n\n' + s.slice(-15000);
  return s;
}

function baseContext(arc) {
  return `===== 角色（CHAR）设定 · 最高优先级，必须精准还原 =====
${M.charBlock(arc.char)}

===== 用户（USER）身份设定 · 最高优先级 =====
${arc.user ? M.userBlock(arc.user) : '（用户未设定身份档，请以"你"称呼，不要捏造其姓名与背景。）'}

===== 预设素材 =====
${M.Preset.compose(arc.presetIds || []) || '（无）'}

存档名：${arc.title}`;
}

M.actions['pick-go'] = async () => {
  const arc = M.Archive.byId(pick.archiveId);
  const scenes = M.Archive.entriesOf(pick.archiveId, 'scene').filter(s => (s.turns || []).some(x => x.role === 'ai'));
  if (!scenes.length) return M.toast('这个存档还没有可用的剧情');
  let ids;
  if (pick.scope === 'one' || pick.type === 'if') {
    if (!pick.sceneId) return M.toast('请选择一段剧情');
    ids = [pick.sceneId];
  } else {
    ids = scenes.sort((a, b) => (a.index || 0) - (b.index || 0)).map(s => s.id);
  }
  const src = sourceText(arc, ids);
  const label = ids.length === 1 ? (M.Archive.entryById(ids[0]) || {}).title : '全档';
  try {
    if (pick.type === 'vlog') await genVlog(arc, src, ids, label);
    else if (pick.type === 'qa') await genQA(arc, src, ids, label);
    else if (pick.type === 'feed') await genFeed(arc, src, ids, label);
    else if (pick.type === 'if') await genIf(arc, src, ids[0], label);
  } catch (e) {
    M.loading(false);
    if (e.name !== 'AbortError') M.alert('生成失败', String(e.message || e).slice(0, 220));
  }
};

E.regen = async function (en) {
  const arc = M.Archive.byId(en.archiveId);
  if (!arc) return;
  const ids = en.sourceIds || [];
  if (!ids.length) return M.toast('缺少来源信息，请重新生成一份');
  pick = { type: en.type, archiveId: arc.id, sceneId: ids[0], scope: ids.length === 1 ? 'one' : 'all', opts: en.opts || defaultOpts(en.type) };
  M.actions['pick-go']();
};

/* =========================================================
   浮光 · VLOG
   ========================================================= */
async function genVlog(arc, src, ids, label) {
  const durMap = { short: [16, 24], std: [30, 44], long: [56, 76] };
  const [lo, hi] = durMap[pick.opts.length] || durMap.std;
  const tone = { film: '电影感：讲究景别、光线、剪辑节奏，旁白克制',
                 diary: '私影像：手持感、生活质地、旁白像自言自语',
                 doc: '纪录片：冷静的观察视角，旁白带有回望的时间感' }[pick.opts.voice];

  M.loading(true, '浮光生成中', '正在把文字拆成一帧一帧的画面');
  const raw = await M.chat([
    { role: 'system', content: `你是一位影像导演兼剪辑师。请把给定的中文剧情改写成一段"仿视频"的分镜脚本，供 App 逐帧播放。

${baseContext(arc)}

【输出格式】只输出一个 JSON 对象，不要任何解释、不要 markdown 代码围栏：
{
  "title": "影片标题，4-10 字，不含标点与符号",
  "subtitle": "一行英文或拼音式的副标题，全大写，不超过 28 个字符",
  "frames": [
    {"kind":"title","text":"标题帧文字","sub":"副标","shot":"BLACK","dur":3.5},
    {"kind":"narration","text":"旁白文字","shot":"EXT. 雨夜街道 — 远景","dur":6},
    {"kind":"dialogue","who":"角色名","side":"char","text":"台词","shot":"近景 — 侧脸","dur":4.5}
  ]
}

【规则】
1. frames 数量 ${lo} 到 ${hi} 帧，总时长自然合理：旁白帧 4–8 秒，台词帧按字数 2.5–6 秒，标题帧 3–4 秒。dur 为数字（秒），可含一位小数。
2. kind 只能是 title / narration / dialogue 三种。
3. dialogue 必须有 who（说话者姓名，须与设定一致）与 side（"char" 表示角色一方，"user" 表示用户一方，"other" 表示其他人）。
4. narration 是旁白：描述画面、动作、光线、声音与时间流动，不要写成台词，不出现引号。
5. shot 是镜头标注，简短，用中文或标准剧本英文缩写（如 INT./EXT.、特写、过肩、空镜），不超过 18 个字符。
6. 影像语气：${tone}。
7. 必须忠于原剧情的事实、顺序与情绪，不得新增未发生的重大事件；可以补足合理的画面细节。
8. 开头必须是一帧 title，结尾可以是一帧留白的 narration 作为收束。
9. 全文严禁出现任何 emoji、表情符号或图形符号。所有文字使用中文。` },
    { role: 'user', content: `【剧情素材】\n${src}` },
  ], { onDelta: (d, all) => M.loadTick(all.length) });
  M.loading(false);

  const data = M.pickJson(raw);
  if (!data || !Array.isArray(data.frames) || !data.frames.length) {
    return M.alert('解析失败', '模型没有返回可用的分镜数据，可以再试一次，或到生成设置里提高单次生成上限。');
  }
  data.frames = data.frames.map(f => ({
    kind: ['title', 'narration', 'dialogue'].includes(f.kind) ? f.kind : 'narration',
    text: M.deEmoji(String(f.text || '')),
    sub: M.deEmoji(String(f.sub || '')),
    who: M.deEmoji(String(f.who || '')),
    side: f.side === 'user' ? 'user' : (f.side === 'other' ? 'other' : 'char'),
    shot: M.deEmoji(String(f.shot || '')).slice(0, 24),
    dur: Math.max(1.6, Math.min(14, Number(f.dur) || 4.5)),
  }));

  const en = {
    id: M.uid(), archiveId: arc.id, type: 'vlog',
    title: M.deEmoji(data.title || '浮光') + ' · ' + label,
    data, sourceIds: ids, opts: Object.assign({}, pick.opts),
    plain: data.frames.map(f => (f.who ? f.who + '：' : '') + f.text).join('\n'),
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await M.Archive.saveEntry(en);
  M.Home.render();
  M.toast('浮光已归档');
  E.openVlog(en);
}

/* ---------- 播放器 ---------- */
let V = { en: null, frames: [], i: -1, playing: false, t: 0, speed: 1, timer: null, total: 0, starts: [] };

E.openVlog = function (en) {
  V.en = en;
  V.frames = (en.data && en.data.frames) || [];
  V.starts = []; let acc = 0;
  V.frames.forEach(f => { V.starts.push(acc); acc += f.dur; });
  V.total = acc; V.t = 0; V.i = -1; V.playing = false; V.speed = 1;
  $('#vlogTitle').innerHTML = esc(en.title) + '<em>FLOATING LIGHT</em>';
  $('#vlogSpeed').textContent = '1.0×';
  renderTrack();
  M.nav('vlog');
  setFrame(0, false);
  setTimeout(() => togglePlay(true), 420);
};

function renderTrack() {
  $('#vlogTrack').innerHTML = V.frames.map((f, i) => `
    <div class="m-tk locked" data-i="${i}">
      <div class="m-tk-t">${esc(M.fmtClock(V.starts[i]))}</div>
      <div class="m-tk-b">
        ${f.kind === 'dialogue' ? `<div class="m-tk-w">${esc(f.who)}</div>` : ''}
        ${esc(f.text.slice(0, 70))}
      </div>
    </div>`).join('');
  $('#vlogTrack').onclick = e => {
    const el = e.target.closest('.m-tk'); if (!el) return;
    const i = +el.dataset.i;
    if (el.classList.contains('locked')) { M.toast('还没有播到这里'); return; }
    seekTo(V.starts[i] + 0.01);
  };
}

function setFrame(i, animate) {
  if (i === V.i || !V.frames[i]) { if (!V.frames[i]) return; }
  V.i = i;
  const f = V.frames[i];
  $('#vlogShot').innerHTML = `<span>${esc(f.shot || (f.kind === 'title' ? 'TITLE' : 'SCENE'))}</span>`;
  const cap = $('#vlogCaption');
  let html = '';
  if (f.kind === 'title') {
    html = `<div class="m-cap title"><b>${esc(f.text)}</b>${f.sub ? `<span>${esc(f.sub)}</span>` : ''}</div>`;
  } else if (f.kind === 'dialogue') {
    html = `<div class="m-cap line">
      <div class="m-cap-who ${f.side === 'user' ? 'u' : ''}">${esc(f.who || '')}</div>
      <div class="m-cap-txt">${esc(f.text)}</div></div>`;
  } else {
    html = `<div class="m-cap narr">${esc(f.text)}</div>`;
  }
  cap.innerHTML = html;
  // 逐条解锁轨道
  $$('#vlogTrack .m-tk').forEach((el, k) => {
    el.classList.toggle('cur', k === i);
    if (k <= i) { el.classList.remove('locked'); el.classList.add('seen'); }
  });
  const cur = $('#vlogTrack .m-tk.cur');
  if (cur) cur.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function frameAt(t) {
  let idx = 0;
  for (let k = 0; k < V.starts.length; k++) if (t >= V.starts[k]) idx = k;
  return idx;
}

function tick() {
  V.t += 0.1 * V.speed;
  if (V.t >= V.total) { V.t = V.total; paint(); togglePlay(false); M.toast('播放完毕'); return; }
  const i = frameAt(V.t);
  if (i !== V.i) setFrame(i, true);
  paint();
}

function paint() {
  const pct = V.total ? (V.t / V.total * 100) : 0;
  $('#vlogSeekIn').style.width = pct + '%';
  $('#vlogSeekDot').style.left = pct + '%';
  $('#vlogTC').textContent = `${M.fmtClock(V.t)} / ${M.fmtClock(V.total)}`;
}

function togglePlay(on) {
  V.playing = on == null ? !V.playing : on;
  clearInterval(V.timer);
  const btn = $('#vlogToggle');
  btn.dataset.svg = V.playing ? 'pause' : 'play';
  btn.dataset.svgDone = '';
  M.paintIcons(btn.parentElement);
  $('#vlogStage').classList.toggle('playing', V.playing);
  if (V.playing) V.timer = setInterval(tick, 100);
}

function seekTo(t) {
  V.t = Math.max(0, Math.min(V.total, t));
  setFrame(frameAt(V.t), true);
  paint();
}

M.actions['vlog-toggle'] = () => togglePlay();
M.actions['vlog-prev'] = () => { const i = Math.max(0, V.i - 1); seekTo(V.starts[i] + 0.01); };
M.actions['vlog-next'] = () => { const i = Math.min(V.frames.length - 1, V.i + 1); seekTo(V.starts[i] + 0.01); };
M.actions['vlog-speed'] = () => {
  const seq = [1, 1.25, 1.5, 2, 0.75];
  V.speed = seq[(seq.indexOf(V.speed) + 1) % seq.length];
  $('#vlogSpeed').textContent = V.speed.toFixed(2).replace(/0$/, '') + '×';
};
M.actions['vlog-menu'] = async () => {
  const v = await M.sheet({
    title: '浮光', plain: true, options: [
      { id: 'restart', title: '从头播放' },
      { id: 'all', title: '显示全部字幕', desc: '解除逐帧隐藏' },
      { id: 'rename', title: '重命名' },
      { id: 'regen', title: '重新生成' },
      { id: 'del', title: '删除这份浮光', danger: true },
    ],
  });
  if (v === 'restart') { seekTo(0); togglePlay(true); }
  else if (v === 'all') { $$('#vlogTrack .m-tk').forEach(el => { el.classList.remove('locked'); el.classList.add('seen'); }); M.toast('已展开全部'); }
  else if (v === 'rename') {
    const t = await M.prompt('重命名', { input: { value: V.en.title } });
    if (t) { V.en.title = t; await M.Archive.saveEntry(V.en); $('#vlogTitle').innerHTML = esc(t) + '<em>FLOATING LIGHT</em>'; }
  } else if (v === 'regen') { togglePlay(false); E.regen(V.en); }
  else if (v === 'del') {
    const ok = await M.confirm('删除这份浮光', V.en.title, '删除');
    if (!ok) return;
    togglePlay(false);
    await M.db.del('entries', V.en.id);
    await M.Archive.reload();
    M.toast('已删除'); M.back(); M.Archive.renderDetail(); M.Home.render();
  }
};
M.onBackTo = function () { togglePlay(false); };
$('#vlogSeek').addEventListener('click', e => {
  const r = e.currentTarget.getBoundingClientRect();
  seekTo((e.clientX - r.left) / r.width * V.total);
});

/* =========================================================
   叩问 · Q&A
   ========================================================= */
async function genQA(arc, src, ids, label) {
  const angle = {
    mix: '综合：既问情节与伏笔，也问情感动机与关系变化',
    emotion: '专注情感与动机：为什么这样做、当时在想什么、关系发生了什么位移',
    detail: '专注细节与伏笔：容易被忽略的物件、动作、时间线与呼应',
    char: '由角色本人以第一人称回答，语气须完全符合其说话方式',
  }[pick.opts.angle];

  M.loading(true, '叩问生成中', '正在向这段故事提问');
  const raw = await M.chat([
    { role: 'system', content: `你要为 App「回想录」生成一份"叩问"——围绕一段中文剧情的可交互问答卡片集，输出为 HTML 片段。

${baseContext(arc)}

【内容要求】
1. 共 ${pick.opts.count} 组问答。角度：${angle}。
2. 每一组包含：一个问题、一个默认收起的答案。答案 120–260 字，有具体证据，引用剧情中真实出现过的细节，不要空泛。
3. 问题要真的值得问：指向动机、转折、伏笔、未说出口的话、关系的变化，而不是"发生了什么"这种复述题。
4. 顶部写一段 80–140 字的引言，交代这次叩问的切入点。底部给一段 60–120 字的收束。
5. 严禁编造剧情中不存在的事实。若某处确实无从判断，答案中要明说这是留白，并给出两种合理的读法。

【交互要求】
· 用纯 CSS 与少量 JS 实现问题的展开/收起（点击问题条切换答案显示），动画柔和。
· 顶部提供"全部展开 / 全部收起"两个控件。
· 每组问答带一个细字距的编号标签（如 Ⅰ、Ⅱ、Ⅲ 或 01、02），以及一个表示角度的小标签。
· 不使用浏览器原生弹窗与 details/summary 的默认样式，一切自绘。

${M.STYLE_RULES}` },
    { role: 'user', content: `【剧情素材】\n${src}` },
  ], { onDelta: (d, all) => M.loadTick(all.length) });
  M.loading(false);

  const html = M.pickHtml(raw);
  if (!html) return M.alert('生成失败', '模型没有返回可用内容，请再试一次。');
  const en = {
    id: M.uid(), archiveId: arc.id, type: 'qa',
    title: '叩问 · ' + label, html, plain: M.stripTags(html),
    sourceIds: ids, opts: Object.assign({}, pick.opts),
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await M.Archive.saveEntry(en);
  M.Home.render(); M.toast('叩问已归档');
  M.Archive.openEntry(en.id);
}

/* =========================================================
   回声 · 动态流
   ========================================================= */
async function genFeed(arc, src, ids, label) {
  const plat = {
    moments: '朋友圈式：文字为主，配 0–3 张"图片"（用文字描述画面内容代替真实图片），只有共同好友能看到彼此的评论',
    zone: '空间说说式：更外露、更长，偶尔带有当时流行的排版习惯，评论区更热闹',
    twi: '推文式：短、密、锋利，允许自我回复形成串，转发式的评论',
  }[pick.opts.platform];

  const rels = [];
  const c = arc.char;
  if (c.relation) rels.push(`${c.name} 与用户：${c.relation}`);
  if (c.relationDetail) rels.push(c.relationDetail);
  if (arc.user && Array.isArray(arc.user.linkedIdentities)) {
    arc.user.linkedIdentities.forEach(l => rels.push(`${arc.user.name} 与 ${l.name || ''}：${l.relation || l.type || '关系'}`));
  }
  const wb = await M.loadWorldbook();
  const linked = wb.filter(e => Array.isArray(e.chars) && e.chars.includes(arc.charId))
    .map(e => `· ${e.title || e.name || ''}：${(e.content || '').slice(0, 300)}`).join('\n');

  M.loading(true, '回声生成中', '正在让角色们发出动态');
  const raw = await M.chat([
    { role: 'system', content: `你要为 App「回想录」生成"回声"——剧情之后，角色们发布的社交动态与彼此的评论互动。输出为 JSON。

${baseContext(arc)}

===== 关系网络（用于生成评论互动） =====
${rels.join('\n') || '（未提供明确关系，请只让主角色与剧情中真实出现过的人物互动）'}
${linked ? '\n===== 关联世界书 =====\n' + linked : ''}

【输出格式】只输出 JSON，不要解释、不要代码围栏：
{
  "title": "这组动态的标题，4-10 字",
  "posts": [
    {
      "author": "发布者姓名",
      "side": "char | user | other",
      "time": "相对时间，如 昨天 23:41、3 小时前",
      "text": "正文",
      "images": ["用一句话描述这张图的画面内容", "..."],
      "likes": ["点赞者姓名", "..."],
      "comments": [
        {"author":"评论者","text":"评论内容","replies":[{"author":"回复者","to":"被回复者","text":"回复内容"}]}
      ]
    }
  ]
}

【规则】
1. 共 ${pick.opts.posts} 条动态。形态：${plat}。
2. 主角色（${c.name}）必须发布不止一条：至少 2 条，分布在剧情前后不同的时间点，语气与心境要有变化。
3. 评论必须来自剧情中真实存在或关系网络中列明的人物，不要凭空捏造陌生人。评论要像真人：有梗、有试探、有心照不宣，也可以有人问错了重点。
4. 评论可以有二级回复（replies），最多两层。
5. images 用文字描述画面，0 到 3 条；如果这条动态是纯文字就给空数组。
6. 正文长度依形态而变：朋友圈式 20–90 字，空间式 40–160 字，推文式 15–60 字。
7. 严禁出现任何 emoji、颜文字、表情符号。要表达情绪请用文字本身或标点。
8. 所有内容必须与剧情事实一致，可以含蓄、可以只有当事人才懂，但不能矛盾。` },
    { role: 'user', content: `【剧情素材】\n${src}` },
  ], { onDelta: (d, all) => M.loadTick(all.length) });
  M.loading(false);

  const data = M.pickJson(raw);
  if (!data || !Array.isArray(data.posts) || !data.posts.length) {
    return M.alert('解析失败', '模型没有返回可用的动态数据，请再试一次。');
  }
  const en = {
    id: M.uid(), archiveId: arc.id, type: 'feed',
    title: M.deEmoji(data.title || '回声') + ' · ' + label,
    data, sourceIds: ids, opts: Object.assign({}, pick.opts),
    plain: data.posts.map(p => `${p.author}：${p.text}`).join('\n'),
    likeState: {},
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await M.Archive.saveEntry(en);
  M.Home.render(); M.toast('回声已归档');
  M.Archive.openEntry(en.id);
}

E.renderFeed = function (mount, en, arc) {
  const posts = (en.data && en.data.posts) || [];
  const who = side => side === 'user' ? (arc && arc.user) : (side === 'char' ? (arc && arc.char) : null);
  mount.innerHTML = `
    <div class="m-feed-head">
      <div class="m-feed-head-in">
        ${arc ? M.avatarHtml(arc.char, 'lg') : ''}
        <div>
          <div class="m-feed-head-n">${esc(en.data.title || '回声')}</div>
          <div class="m-feed-head-d">${esc(arc ? arc.title : '')} ｜ ${posts.length} 条动态</div>
        </div>
      </div>
    </div>
    ${posts.map((p, pi) => {
      const person = who(p.side) || { name: p.author };
      const imgs = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
      const liked = en.likeState && en.likeState[pi];
      const likes = Array.isArray(p.likes) ? p.likes.filter(Boolean) : [];
      return `
      <div class="m-post">
        <div class="m-post-top">
          ${M.avatarHtml(Object.assign({}, person, { name: p.author || person.name }), 'round')}
          <div class="m-post-n">
            <div class="m-post-name">${esc(p.author || '')}</div>
            <div class="m-post-time">${esc(p.time || '')}</div>
          </div>
        </div>
        <div class="m-post-txt">${esc(M.deEmoji(p.text || ''))}</div>
        ${imgs.length ? `<div class="m-post-imgs ${imgs.length === 1 ? 'one' : ''}">
          ${imgs.slice(0, 6).map(t => `<div class="m-post-img">${esc(t)}</div>`).join('')}</div>` : ''}
        <div class="m-post-acts">
          <div class="m-pa ${liked ? 'on' : ''}" data-like="${pi}">${M.svg('heart', 12)}<span>${likes.length + (liked ? 1 : 0)}</span></div>
          <div class="m-pa">${M.svg('cmt', 12)}<span>${(p.comments || []).length}</span></div>
          ${likes.length ? `<div class="m-pa" style="flex:1;justify-content:flex-end;letter-spacing:.06em">${esc(likes.slice(0, 4).join(' · '))}</div>` : ''}
        </div>
        ${(p.comments || []).length ? `<div class="m-post-cmts">
          ${p.comments.map(cm => `
            <div class="m-cmt"><b>${esc(cm.author || '')}</b>：${esc(M.deEmoji(cm.text || ''))}</div>
            ${(cm.replies || []).map(r => `
              <div class="m-cmt reply"><b>${esc(r.author || '')}</b>${r.to ? ` <span class="to">回复 ${esc(r.to)}</span>` : ''}：${esc(M.deEmoji(r.text || ''))}</div>`).join('')}
          `).join('')}
        </div>` : ''}
      </div>`;
    }).join('')}`;

  mount.onclick = async e => {
    const l = e.target.closest('[data-like]'); if (!l) return;
    const i = l.dataset.like;
    en.likeState = en.likeState || {};
    en.likeState[i] = !en.likeState[i];
    await M.Archive.saveEntry(en);
    E.renderFeed(mount, en, arc);
  };
};

/* =========================================================
   歧路 · IF 线
   ========================================================= */
async function genIf(arc, src, sceneId, label) {
  const scene = M.Archive.entryById(sceneId);
  M.loading(true, '歧路勘定中', '正在寻找这段故事里真正的分岔口');
  const raw = await M.chat([
    { role: 'system', content: `你是一位叙事分析师。请从给定的中文剧情中，找出真正存在过的"分歧瞬间"——那些如果当时的选择不同，故事就会走向别处的时刻。

${baseContext(arc)}

【输出格式】只输出 JSON，不要解释、不要代码围栏：
{
  "anchors": [
    {
      "moment": "这个瞬间的名字，4-12 字",
      "when": "它发生在剧情中的什么位置，一句话",
      "original": "原本发生了什么，40-80 字",
      "pivot": "真正的分歧点是什么，一句话点明",
      "alternatives": ["另一种可能的走向，25-50 字", "另一种可能的走向"]
    }
  ]
}

【规则】
1. 给出 3 到 4 个锚点，按剧情时间顺序排列。
2. 必须是剧情中真实出现过的瞬间，不得虚构。
3. 分歧点要具体到某个动作、某句话、某个犹豫，不要写成"如果他们关系更好"这种笼统假设。
4. 每个锚点给 2 个可选走向，二者必须指向明显不同的后果。
5. 严禁任何 emoji 与图形符号。` },
    { role: 'user', content: `【剧情素材】\n${src}` },
  ], { onDelta: (d, all) => M.loadTick(all.length) });
  M.loading(false);

  const data = M.pickJson(raw);
  if (!data || !Array.isArray(data.anchors) || !data.anchors.length) {
    return M.alert('解析失败', '没能勘定出分歧点，请再试一次。');
  }

  // 选锚点
  const aIdx = await M.sheet({
    title: '分歧点', desc: '选择一个瞬间，让故事从那里走上另一条路',
    options: data.anchors.map((a, i) => ({ id: String(i), title: a.moment || `锚点 ${i + 1}`, desc: (a.pivot || a.original || '').slice(0, 60) })),
  });
  if (aIdx == null) return;
  const anchor = data.anchors[+aIdx];

  // 选走向
  const alts = (anchor.alternatives || []).map((t, i) => ({ id: String(i), title: `走向 ${i === 0 ? '甲' : '乙'}`, desc: t }));
  alts.push({ id: 'own', title: '我自己写一个走向', desc: '由你决定那一刻改变了什么' });
  const pickAlt = await M.sheet({
    title: anchor.moment || '分歧点',
    desc: (anchor.original || '').slice(0, 90),
    options: alts,
  });
  if (pickAlt == null) return;
  let altText;
  if (pickAlt === 'own') {
    altText = await M.prompt('另一种走向', {
      desc: '写下那一刻改变的是什么',
      input: { multiline: true, placeholder: '例：他没有转身，而是叫住了她' },
    });
    if (!altText) return;
  } else {
    altText = anchor.alternatives[+pickAlt];
  }

  // 建立歧路存档（复用跑剧情引擎）
  const branchIdx = M.Archive.entriesOf(arc.id, 'if').length + 1;
  const en = {
    id: M.uid(), archiveId: arc.id, type: 'if',
    title: `歧路 ${branchIdx} · ${anchor.moment || label}`,
    index: branchIdx,
    turns: [],
    sourceIds: [sceneId],
    anchors: data.anchors,
    branch: {
      moment: anchor.moment || '',
      when: anchor.when || '',
      original: anchor.original || '',
      pivot: anchor.pivot || '',
      alternative: altText,
      sourceTitle: scene ? scene.title : '',
      summary: M.stripTags(src).slice(-4200),
    },
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await M.Archive.saveEntry(en);
  M.Home.render();
  M.toast('歧路已开辟');
  M.Play.open(arc, en, true);
}

/* 歧路条目从列表点开时，直接进入分支叙事 */
const _openEntry = M.Archive.openEntry;
M.Archive.openEntry = function (id) {
  const en = M.Archive.entryById(id);
  if (en && en.type === 'if' && Array.isArray(en.turns)) {
    const arc = M.Archive.byId(en.archiveId);
    if (arc) return M.Play.open(arc, en, !en.turns.length);
  }
  return _openEntry(id);
};

})();
