/* ================================================================
   糖罐 TANGGUAN — tg-dm.js  v2
   私信：角色库同步 · 陌生人批量来信 · 高级感聊天页 · 不限条数 AI 回复
   依赖：tg-core.js / tg-genre.js
================================================================ */

let tgDM = {
  convs: [], chars: [], deep: {},
  tab: 'all', cur: null, msgs: [],
  busy: false, loaded: false
};

/* ================================================================
   一、载入
================================================================ */
async function tgDMLoad() {
  const [chars, convs] = await Promise.all([tgLoadChars(), tgAll('dms')]);
  tgDM.chars = chars;
  tgDM.convs = convs;
  if (!tgDM.loaded) { tgDM.deep = await tgLoadCharsDeep(); tgDM.loaded = true; }
  tgRenderDM();
}
function tgConvOfChar(uid) { return tgDM.convs.find(c => c.charUid === uid); }

/* ================================================================
   二、列表
================================================================ */
function tgDMTab(t, btn) {
  tgDM.tab = t;
  if (btn) { btn.parentNode.querySelectorAll('button').forEach(b => b.classList.remove('on')); btn.classList.add('on'); }
  tgRenderDM();
}

function tgRenderDM() {
  const box = document.getElementById('tgDMList');
  if (!box) return;

  const strangers = tgDM.convs.filter(c => c.kind === 'stranger');
  const charRows = tgDM.chars.map(ch => {
    const c = tgConvOfChar(ch.uid);
    return {
      kind: 'char', uid: ch.uid, name: ch.name, avatar: ch.avatar,
      sub: c ? (c.lastText || '') : (ch.role || '来自角色库'),
      ts: c ? c.lastTs : 0, conv: c, ch
    };
  });
  const strRows = strangers.map(c => ({
    kind: 'stranger', uid: c.id, name: c.name, avatar: null,
    sub: c.lastText || c.identity, ts: c.lastTs || c.createdAt, conv: c
  }));

  let rows = tgDM.tab === 'char' ? charRows : tgDM.tab === 'stranger' ? strRows : charRows.concat(strRows);
  rows.sort((a, b) => (b.ts || 0) - (a.ts || 0));

  const unread = strangers.reduce((a, c) => a + (c.unread || 0), 0);
  const head = `
    <div class="tg-seg" style="margin-bottom:14px">
      <button class="${tgDM.tab === 'all' ? 'on' : ''}" onclick="tgDMTab('all',this)">全部</button>
      <button class="${tgDM.tab === 'char' ? 'on' : ''}" onclick="tgDMTab('char',this)">角色</button>
      <button class="${tgDM.tab === 'stranger' ? 'on' : ''}" onclick="tgDMTab('stranger',this)">陌生人 ${unread ? '· ' + unread : ''}</button>
    </div>
    <div class="tg-plaza-acts" style="margin:0 0 16px">
      <button class="tg-btn tg-btn-dark tg-btn-sm" id="tgStrBtn" ${tgDM.busy ? 'disabled' : ''} onclick="tgNewStranger()">${tgDM.busy ? '正在收信…' : '收一批陌生人私信'}</button>
      <button class="tg-mini-btn" data-ico="shuffle" ${tgDM.busy ? 'disabled' : ''} onclick="tgStrangerSheet()"></button>
      <button class="tg-mini-btn" data-ico="refresh" onclick="tgDMLoad()"></button>
    </div>`;

  if (!rows.length) {
    box.innerHTML = head + `<div class="tg-empty"><div class="tg-empty-mark" data-ico="dm"></div>
      <p>信箱是空的。<br>角色库里的人会自动出现在这里；<br>也可以让糖罐替你收一批陌生人的私信。</p></div>`;
    tgFillIcons(box); return;
  }

  box.innerHTML = head + rows.map((r, i) => `
    <div class="tg-conv tg-rise tg-d${(i % 6) + 1}" onclick="tgOpenChat('${r.kind}','${r.uid}')">
      <div class="tg-conv-av">${r.avatar ? `<img src="${r.avatar}">` : `<span>${tgEsc((r.name || '·')[0])}</span>`}</div>
      <div class="tg-conv-main">
        <div class="tg-conv-l1"><b>${tgEsc(r.name)}</b>${r.kind === 'stranger' ? `<em>${tgEsc(r.conv.identity || '陌生人')}</em>` : '<em class="ch">角色</em>'}</div>
        <p>${tgEsc((r.sub || '还没有说过话').slice(0, 42))}</p>
      </div>
      <div class="tg-conv-side">
        <i>${r.ts ? tgFmtTime(r.ts) : ''}</i>
        ${r.conv && r.conv.unread ? `<b>${r.conv.unread}</b>` : ''}
      </div>
    </div>`).join('');
  tgFillIcons(box);
}
function tgFmtTime(ts) {
  const d = new Date(ts), n = new Date();
  const same = d.toDateString() === n.toDateString();
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  return same ? hm : `${d.getMonth() + 1}.${d.getDate()}`;
}

/* ================================================================
   三、陌生人：一次几封由随机决定，不锁死在某个数上
================================================================ */
const TG_STRANGER_KINDS = [
  '同担（和你磕同一对，热情到有点吓人）',
  '一方的唯粉（对你磕的 CP 态度微妙，说话夹枪带棒但没撕破脸）',
  '考据党（拿着时间线和细节来跟你对线，语气冷静）',
  '刚入坑的新人（什么都不懂，问得又急又可爱）',
  '写手太太（想找你约稿或者互相看文，说话客气有分寸）',
  '产粮的画手（发来草图想听意见，忐忑）',
  '前圈老人（说着当年的事，带着一点唏嘘）',
  '对家（阴阳怪气地来试探，克制但有刺）',
  '搞错人了的陌生人（发错了对象，但聊着聊着没走）',
  '你三年前的同担（重新回坑，翻到了你的旧文）',
  '做同人志的编辑（正式、有条理，带着约稿单）',
  '半夜睡不着的路人（没什么目的，就是想找人说话）',
  '拿你的文当过救命稻草的人（真诚到让人不好意思）',
  '自称认识正主原型的人（真假难辨，说话吞吞吐吐）',
  '想收你旧痛的收藏党（开口就问价）',
  '被 CP 伤到弃坑的人（回来道别）'
];

/* 宽分布随机：不会永远停在同一个数量级上 */
function tgStrangerCount() {
  const r = Math.random();
  if (r < 0.22) return tgRnd(1, 3);
  if (r < 0.52) return tgRnd(3, 7);
  if (r < 0.80) return tgRnd(6, 12);
  if (r < 0.95) return tgRnd(10, 18);
  return tgRnd(16, 26);
}

function tgStrangerSheet() {
  tgSheetOpen(`<h4>这一次收几封</h4>
    <p class="tg-sheet-sub">默认交给随机：可能只来一封，也可能一口气涌进来二十几封，不设固定范围。每个人的开场消息条数也各不相同。</p>
    <div class="tg-chips" style="margin-top:14px">
      <button class="tg-chip on" onclick="tgCloseSheet();tgNewStranger()">随机（推荐）</button>
      ${[1, 3, 5, 10, 20].map(n => `<button class="tg-chip" onclick="tgCloseSheet();tgNewStranger(${n})">${n} 封</button>`).join('')}
    </div>
    <div style="height:16px"></div>
    <div class="tg-rule"><b>他们是谁</b><p>糖罐会从十六种网友类型里随机抽人，并读取你已经建好的圈子资料，让对方知道你在磕什么。每个人都有独立的性格档案，之后的对话会一直沿用。</p></div>`);
}

async function tgNewStranger(fixed) {
  if (tgDM.busy) return;
  if (!tgHasApi()) { tgToast('请先在设置里配置模型接口'); return; }
  tgDM.busy = true;
  tgRenderDM();

  const total = fixed || tgStrangerCount();
  const circles = await tgAll('circles');
  const me = (typeof tgMe !== 'undefined' && tgMe.name) ? tgMe.name : '你';

  const btn = document.getElementById('tgStrBtn');
  const setTip = t => { const b = document.getElementById('tgStrBtn'); if (b) b.textContent = t; };
  setTip(`正在收信 0 / ${total}`);

  let got = 0;
  /* 分批请求：每批 4 封，失败只影响这一批，不会全军覆没 */
  const per = 4;
  for (let s = 0; s < total; s += per) {
    const n = Math.min(per, total - s);
    const kinds = [];
    while (kinds.length < n) {
      const k = TG_STRANGER_KINDS[Math.floor(Math.random() * TG_STRANGER_KINDS.length)];
      if (kinds.indexOf(k) < 0 || kinds.length >= TG_STRANGER_KINDS.length) kinds.push(k);
    }
    const c = circles.length ? circles[Math.floor(Math.random() * circles.length)] : null;

    const user = [
      `【任务】为一个中文同人社区生成 ${n} 位来私信的陌生人，以及他们各自发来的开场消息。`,
      c ? '【他们知道收信人在磕什么】\n' + tgCircleBrief(c, tgDM.deep) : '【收信人还没有公开的圈子，他们是因为广场上的动态找过来的】',
      '【这一批人的类型，按顺序一一对应】\n' + kinds.map((k, i) => `${i + 1}. ${k}`).join('\n'),
      `【收信人昵称】${me}`,
      '',
      '【要求】',
      '· 名字与用户名要像真实网友：可以有数字、缩写、生僻词、拼错的英文，绝不能是「用户A」这类占位名。',
      '· 每个人的开场消息条数由这个人的性格决定，不要都一样：话痨可能连发七八条，高冷的可能只发一句，紧张的可能发一条又补一条。至少一条，上不封顶。',
      '· 第一条不要长篇大论，也不要自我介绍式的完整段落。要像真人在手机上打字。',
      '· 每个人的语气必须明显不同，不能几个人一个腔调。',
      '· persona 要写足 120 到 220 字，把说话习惯、口头禅、打字习惯（爱不爱用标点、会不会打错字）、对这个 CP 的态度都写清楚，之后的对话会一直沿用它。',
      '· 禁止 emoji、颜文字、星号。',
      '',
      '【必须严格遵循的 JSON 结构】',
      '{"people":[{"name":"昵称","handle":"英文或拼音ID","identity":"一句话身份，8字以内","bio":"个人简介，30字内","persona":"完整性格与说话方式","opening":["第一条","第二条"]}]}',
      '',
      '现在直接输出 JSON。'
    ].filter(Boolean).join('\n');

    let people = [];
    try {
      const j = await tgAskJSON(tgSysPrompt(), user, { max: 5000, rounds: 3 });
      people = Array.isArray(j) ? j : (j.people || j.list || j.strangers || []);
    } catch (e) { people = []; }

    for (let i = 0; i < people.length && i < n; i++) {
      const j = people[i] || {};
      let ops = Array.isArray(j.opening) ? j.opening : (typeof j.opening === 'string' ? String(j.opening).split('\n') : []);
      ops = ops.map(x => String(typeof x === 'string' ? x : (x && (x.text || x.content)) || '').trim()).filter(Boolean);
      if (!ops.length) ops = ['在吗'];
      const conv = await tgPut('dms', {
        kind: 'stranger',
        name: String(j.name || '陌生人').slice(0, 20),
        handle: String(j.handle || ('u' + Math.random().toString(36).slice(2, 7))).slice(0, 20),
        identity: String(j.identity || '陌生人').slice(0, 12),
        bio: String(j.bio || '').slice(0, 60),
        persona: String(j.persona || kinds[i] || '').slice(0, 900),
        lastText: '', lastTs: Date.now(), unread: 0
      });
      const base = Date.now() - (total - got) * 1000;
      for (let k = 0; k < ops.length; k++) {
        await tgPut('msgs', { convId: conv.id, side: 'them', text: ops[k], ts: base + k * 60, createdAt: base + k * 60 });
      }
      conv.lastText = ops[ops.length - 1];
      conv.lastTs = base + ops.length * 60;
      conv.unread = ops.length;
      await tgPut('dms', conv);
      got++;
      setTip(`正在收信 ${got} / ${total}`);
    }
  }

  tgDM.busy = false;
  await tgDMLoad();
  if (got) {
    tgToast(`收到 ${got} 封新私信`);
    if (typeof tgAddSweet === 'function') tgAddSweet(3 * got);
  } else tgToast('这次一封都没收到，换个模型或稍后再试');
}

/* ================================================================
   四、聊天页
================================================================ */
async function tgOpenChat(kind, uid) {
  let conv;
  if (kind === 'char') {
    conv = tgConvOfChar(uid);
    if (!conv) {
      const ch = tgDM.chars.find(x => x.uid === uid);
      conv = await tgPut('dms', {
        kind: 'char', charUid: uid, name: ch ? ch.name : '角色',
        handle: (ch && ch.role) || '', identity: (ch && ch.role) || '角色库',
        avatar: ch ? ch.avatar : null, bio: '', persona: '',
        lastText: '', lastTs: Date.now(), unread: 0
      });
      tgDM.convs.push(conv);
    }
  } else conv = tgDM.convs.find(c => c.id === uid);
  if (!conv) return;
  conv.unread = 0; await tgPut('dms', conv);
  tgDM.cur = conv;

  const all = await tgAll('msgs');
  tgDM.msgs = all.filter(m => m.convId === conv.id).sort((a, b) => (a.ts || a.createdAt) - (b.ts || b.createdAt));

  if (!tgDM.msgs.length && conv.kind === 'char') {
    const f = tgDM.deep[conv.charUid];
    const first = f && (f.firstMes || '').trim();
    if (first) {
      const m = await tgPut('msgs', { convId: conv.id, side: 'them', text: first, ts: Date.now(), createdAt: Date.now() });
      tgDM.msgs.push(m);
    }
  }

  document.getElementById('tgChatName').textContent = conv.name;
  document.getElementById('tgChatSub').textContent = conv.kind === 'char' ? (conv.identity || '角色库') : (conv.identity + (conv.bio ? ' · ' + conv.bio : ''));
  tgGo('scr-chat');
  tgPaintChat(true);
}

function tgPaintChat(jump) {
  const box = document.getElementById('tgChatBody');
  if (!box) return;
  const conv = tgDM.cur; if (!conv) return;
  let last = 0, prevSide = null;
  const html = tgDM.msgs.map((m, i) => {
    const ts = m.ts || m.createdAt;
    let div = '';
    if (ts - last > 1000 * 60 * 20) { div = `<div class="tg-chat-time">${tgFmtChatTime(ts)}</div>`; last = ts; prevSide = null; }
    const me = m.side === 'me';
    const cont = prevSide === m.side;
    prevSide = m.side;
    return div + `<div class="tg-b ${me ? 'me' : 'them'} ${cont ? 'cont' : ''}">
      ${me ? '' : `<div class="tg-b-av">${cont ? '' : (conv.avatar ? `<img src="${conv.avatar}">` : `<span>${tgEsc((conv.name || '·')[0])}</span>`)}</div>`}
      <div class="tg-b-body"><div class="tg-b-bub">${tgEsc(m.text).replace(/\n/g, '<br>')}</div></div>
    </div>`;
  }).join('');
  box.innerHTML = html || `<div class="tg-chat-empty">还没有对话。<br>说点什么，或者直接让 AI 替对方开口。</div>`;
  if (jump !== false) requestAnimationFrame(() => { box.scrollTop = box.scrollHeight + 999; });
}
function tgFmtChatTime(ts) {
  const d = new Date(ts), n = new Date();
  const hm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  if (d.toDateString() === n.toDateString()) return hm;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

async function tgPushMsg(side, text) {
  const conv = tgDM.cur; if (!conv) return;
  const m = await tgPut('msgs', { convId: conv.id, side, text, ts: Date.now(), createdAt: Date.now() });
  tgDM.msgs.push(m);
  conv.lastText = text; conv.lastTs = Date.now();
  await tgPut('dms', conv);
  tgPaintChat();
}
async function tgSendMsg() {
  const inp = document.getElementById('tgChatInput');
  const v = (inp.value || '').trim();
  if (!v) return;
  inp.value = ''; inp.style.height = 'auto';
  await tgPushMsg('me', v);
  if (typeof tgAddSweet === 'function') tgAddSweet(1);
}
function tgChatPlus() {
  tgSheetOpen(`<h4>功能栏</h4>
    <p class="tg-sheet-sub">这一栏留给后续的玩法。当前版本先把对话本身做扎实。</p>
    <div class="tg-fn-grid">
      ${['发图片', '发语音', '转账', '拍一拍', '发红包', '共享位置', '约稿单', '关系卡'].map(t =>
    `<div class="tg-fn" onclick="tgToast('「${t}」正在路上')"><span></span><b>${t}</b></div>`).join('')}
    </div>`);
}

/* ================================================================
   五、AI 回复：条数不设上限
================================================================ */
function tgPersonaOf(conv) {
  if (conv.kind === 'stranger') {
    return [
      `你现在扮演一位中文同人社区的网友，名字叫「${conv.name}」（ID：${conv.handle}）。`,
      `身份：${conv.identity}。`,
      conv.bio ? `简介：${conv.bio}` : '',
      `性格与说话方式：${conv.persona}`
    ].filter(Boolean).join('\n');
  }
  const f = tgDM.deep[conv.charUid] || {};
  const put = (k, v) => (v && String(v).trim()) ? `${k}：${String(v).slice(0, 700)}` : '';
  const dial = (f.dialogExamples || []).slice(0, 4).map(d =>
    typeof d === 'string' ? d : `${d.user ? '对方：' + d.user + ' / ' : ''}${d.char || d.assistant || ''}`).filter(Boolean);
  return [
    `你现在就是「${f.name || conv.name}」本人，正在用手机和对方私聊。`,
    put('人设', f.prompt || f.desc),
    put('身份', f.role), put('性别', f.gender), put('年龄', f.age), put('设定', f.species),
    put('外貌', f.appearance), put('穿着', f.outfit),
    put('性格特质', (f.traits || []).join('、')),
    put('说话方式', f.speechStyle),
    put('口头禅', (f.catchphrases || []).join('、')),
    put('喜欢', (f.likes || []).join('、')),
    put('厌恶', (f.dislikes || []).join('、')),
    put('害怕', f.fears),
    put('背景故事', f.backstory),
    put('当前情境', f.scenario),
    put('与对方的关系', [f.relation, f.relationDetail].filter(Boolean).join(' / ')),
    put('你对对方的称呼', f.callUser),
    put('绝对不会做的事', (f.neverList || []).join('、')),
    put('边界', f.boundaries),
    dial.length ? '对话范例（模仿这种语感，不要照抄内容）：\n' + dial.join('\n') : ''
  ].filter(Boolean).join('\n');
}

function tgChatRules() {
  return [
    '【回复规则，必须全部遵守】',
    '1. 这一轮你要连发几条消息，由你自己根据情绪和内容决定，不设上限也不设下限：可能只回一个字，也可能一口气刷十几条。绝不要每次都发一样多。',
    '2. 每条的长短要有落差。大多数很短，允许出现只有两三个字的一条，也允许偶尔一条稍长。不要每条都一样长。',
    '3. 必须接住对方最后一句话，不要答非所问、不要另起话题、不要复述对方说过的内容。',
    '4. 严格保持人设：称呼、语气、用词、性格边界都要一致，绝不 OOC，绝不跳出角色，不提自己是 AI。',
    '5. 不写旁白、不写心理描写、不写场景描述，除非人设本来就爱用括号里的小动作（那也最多一处）。',
    '6. 禁止 emoji、颜文字、星号、书面腔排比；禁止「有什么可以帮你」这类客服用语；禁止总结与说教。',
    '7. 要有活人的毛边：没说完的半句、突然的追问、发出去又改口、答非所问但符合性格的岔开。',
    '',
    '【输出格式】只输出一个 JSON 对象，第一个字符是 {，最后一个字符是 }，不要代码块、不要解释：',
    '{"msgs":["第一条","第二条"]}'
  ].join('\n');
}

async function tgAIReply() {
  const conv = tgDM.cur;
  if (!conv || tgDM.busy) return;
  if (!tgHasApi()) { tgToast('请先在设置里配置模型接口'); return; }
  tgDM.busy = true;
  const btn = document.getElementById('tgAiBtn');
  if (btn) btn.classList.add('busy');
  const sub = document.getElementById('tgChatSub');
  const subOld = sub.textContent;
  sub.textContent = '正在输入…';
  const box = document.getElementById('tgChatBody');
  box.insertAdjacentHTML('beforeend', `<div class="tg-b them" id="tgTyping"><div class="tg-b-av"><span>${tgEsc((conv.name || '·')[0])}</span></div>
    <div class="tg-b-body"><div class="tg-b-bub typing"><i></i><i></i><i></i></div></div></div>`);
  box.scrollTop = box.scrollHeight + 999;

  const hist = tgDM.msgs.slice(-40).map(m => `${m.side === 'me' ? '对方' : conv.name}：${m.text}`).join('\n');
  const meName = (typeof tgMe !== 'undefined' && tgMe.name) ? tgMe.name : '对方';

  const sys = [tgPersonaOf(conv), '', `和你说话的人叫「${meName}」。`, '', tgChatRules()].join('\n');
  const user = ['【到目前为止的聊天记录】', hist || '（还没有任何对话，由你先开口）', '', '现在轮到你回复。直接输出 JSON。'].join('\n');

  let msgs = null;
  try {
    const j = await tgAskJSON(sys, user, { max: 3000, rounds: 3 });
    if (Array.isArray(j)) msgs = j;
    else if (Array.isArray(j.msgs)) msgs = j.msgs;
    else if (Array.isArray(j.messages)) msgs = j.messages;
    else if (typeof j.text === 'string') msgs = [j.text];
  } catch (e) {
    try {
      const raw = await tgChat([
        { role: 'system', content: sys.replace(/【输出格式】[\s\S]*$/, '直接用自然语言回复，每条消息独占一行，不要编号、不要引号。条数由你自己决定，不设上限。') },
        { role: 'user', content: user.replace('直接输出 JSON。', '直接回复。') }
      ], { max: 2000, temp: 0.95 });
      msgs = String(raw).split('\n');
    } catch (e2) { msgs = null; }
  }

  const t = document.getElementById('tgTyping'); if (t) t.remove();
  sub.textContent = subOld;
  if (btn) btn.classList.remove('busy');
  tgDM.busy = false;

  msgs = (msgs || []).map(x => String(typeof x === 'string' ? x : ((x && (x.text || x.content)) || '')))
    .map(s => s.replace(/^\s*[-–—·•\d]+[.、)]?\s*/, '').replace(/^["「『]|["」』]$/g, '').trim())
    .filter(Boolean);

  if (!msgs.length) { tgToast('这次没有回复出来，再点一次试试'); return; }
  if (msgs.length === 1 && msgs[0].length > 26) msgs = tgSplitLine(msgs[0]);

  for (let i = 0; i < msgs.length; i++) {
    await new Promise(r => setTimeout(r, i ? 260 + Math.random() * 560 : 120));
    await tgPushMsg('them', msgs[i]);
  }
  if (typeof tgAddSweet === 'function') tgAddSweet(3);
}

function tgSplitLine(s) {
  const str = String(s);
  const parts = [];
  let buf = '';
  for (const ch of str) {
    buf += ch;
    if ('。！？…；!?~'.indexOf(ch) >= 0) { parts.push(buf.trim()); buf = ''; }
  }
  if (buf.trim()) parts.push(buf.trim());
  if (parts.length < 2) {
    const mid = Math.max(4, Math.floor(s.length / 2));
    return [s.slice(0, mid), s.slice(mid)].filter(Boolean);
  }
  const want = Math.min(parts.length, 2 + Math.floor(Math.random() * 4));
  const out = [];
  const per = Math.ceil(parts.length / want);
  for (let i = 0; i < parts.length; i += per) out.push(parts.slice(i, i + per).join(''));
  return out.length > 1 ? out : [out[0].slice(0, Math.ceil(out[0].length / 2)), out[0].slice(Math.ceil(out[0].length / 2))];
}

/* ================================================================
   六、入场钩子
================================================================ */
function tgOnEnterDM(id) {
  if (id === 'scr-dm') tgDMLoad();
  if (id === 'scr-chat') tgPaintChat();
}

document.addEventListener('DOMContentLoaded', () => {
  const inp = document.getElementById('tgChatInput');
  if (!inp) return;
  inp.addEventListener('input', () => {
    inp.style.height = 'auto';
    inp.style.height = Math.min(96, inp.scrollHeight) + 'px';
  });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); tgSendMsg(); }
  });
});