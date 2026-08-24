/* ================================================================
   糖罐 TANGGUAN — tg-dm.js
   私信：角色库同步 · 陌生人来信 · 高级感聊天页 · AI 回复
   依赖：tg-core.js、tg-plaza.js（复用 tgChat / tgAskJSON / 图标）
================================================================ */

let tgDM = {
  convs: [],      // 会话（含角色会话与陌生人会话）
  chars: [],      // 角色库公开信息
  deep: {},       // 角色库全字段（只喂模型）
  tab: 'all',
  cur: null,      // 当前会话
  msgs: [],
  busy: false,
  loaded: false
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
   二、列表渲染
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

  const head = `
    <div class="tg-seg" style="margin-bottom:14px">
      <button class="${tgDM.tab === 'all' ? 'on' : ''}" onclick="tgDMTab('all',this)">全部</button>
      <button class="${tgDM.tab === 'char' ? 'on' : ''}" onclick="tgDMTab('char',this)">角色</button>
      <button class="${tgDM.tab === 'stranger' ? 'on' : ''}" onclick="tgDMTab('stranger',this)">陌生人</button>
    </div>
    <div class="tg-plaza-acts" style="margin:0 0 16px">
      <button class="tg-btn tg-btn-dark tg-btn-sm" id="tgStrBtn" onclick="tgNewStranger()">随机一封陌生人私信</button>
      <button class="tg-mini-btn" data-ico="refresh" onclick="tgDMLoad()"></button>
    </div>`;

  if (!rows.length) {
    box.innerHTML = head + `<div class="tg-empty"><div class="tg-empty-mark" data-ico="dm"></div>
      <p>信箱是空的。<br>角色库里的人会自动出现在这里；<br>也可以让糖罐替你收一封陌生人的私信。</p></div>`;
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
   三、陌生人生成
================================================================ */
const TG_STRANGER_KINDS = [
  '同担（和你磕同一对，热情到有点吓人）',
  '一方的唯粉（对你磕的 CP 态度微妙，说话夹枪带棒但没撕破脸）',
  '考据党（拿着时间线和细节来跟你对线，语气冷静）',
  '刚入坑的新人（什么都不懂，问得又急又可爱）',
  '写手太太（想找你约稿或者互相看文，说话客气有分寸）',
  '产粮的画手（发来草图想听意见，忐忑）',
  '前圈老人（说着当年的事，带着一点唏嘘）',
  '对家（阴阳怪气地来试探，克制但有刺）'
];

async function tgNewStranger() {
  if (tgDM.busy) return;
  if (!tgHasApi()) { tgToast('请先在设置里配置模型接口'); return; }
  tgDM.busy = true;
  const btn = document.getElementById('tgStrBtn');
  if (btn) { btn.disabled = true; btn.textContent = '正在收信…'; }

  const circles = await tgAll('circles');
  const c = circles.length ? circles[Math.floor(Math.random() * circles.length)] : null;
  const kind = TG_STRANGER_KINDS[Math.floor(Math.random() * TG_STRANGER_KINDS.length)];
  const me = (typeof tgMe !== 'undefined' && tgMe.name) ? tgMe.name : '你';

  const sys = tgSysPrompt();
  const user = [
    '【任务】为一个中文同人社区生成一位来私信的陌生人，以及他发来的开场消息。',
    c ? '【对方知道你磕的圈】\n' + tgCircleBrief(c, tgDM.deep) : '【收信人还没有公开的圈子，对方是因为广场上的动态找过来的】',
    `【这个人的类型】${kind}`,
    `【收信人昵称】${me}`,
    '【要求】名字与用户名要像真实网友（可以有数字、缩写、生僻词，不要「用户A」）；开场消息 2 到 4 条，长短不一，像真人连发，第一条不要长篇大论；语气要贴合类型，不要客服腔，不要自我介绍式的完整段落。',
    '',
    '【必须严格遵循的 JSON 结构】',
    '{"name":"昵称","handle":"英文或拼音ID","identity":"一句话身份，8字以内","bio":"个人简介，30字内","persona":"这个人的完整性格与说话方式描述，120到200字，供后续对话使用","opening":["第一条","第二条"]}',
    '',
    '现在直接输出 JSON。'
  ].filter(Boolean).join('\n');

  try {
    const j = await tgAskJSON(sys, user, { max: 1400 });
    const conv = await tgPut('dms', {
      kind: 'stranger',
      name: j.name || '陌生人',
      handle: j.handle || ('u' + Math.random().toString(36).slice(2, 7)),
      identity: (j.identity || '陌生人').slice(0, 12),
      bio: j.bio || '',
      persona: j.persona || kind,
      lastText: '', lastTs: Date.now(), unread: 0
    });
    let ops = Array.isArray(j.opening) ? j.opening.filter(x => typeof x === 'string' && x.trim()) : [];
    if (!ops.length) ops = ['在吗', '冒昧打扰一下'];
    for (let i = 0; i < ops.length; i++) {
      await tgPut('msgs', { convId: conv.id, side: 'them', text: ops[i].trim(), ts: Date.now() + i, createdAt: Date.now() + i });
    }
    conv.lastText = ops[ops.length - 1]; conv.lastTs = Date.now(); conv.unread = ops.length;
    await tgPut('dms', conv);
    await tgDMLoad();
    tgToast('收到一封新的私信');
    if (typeof tgAddSweet === 'function') tgAddSweet(4);
  } catch (e) {
    tgToast('这次没能收到信，稍后再试');
  } finally {
    tgDM.busy = false;
    const b = document.getElementById('tgStrBtn');
    if (b) { b.disabled = false; b.textContent = '随机一封陌生人私信'; }
  }
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
  } else {
    conv = tgDM.convs.find(c => c.id === uid);
  }
  if (!conv) return;
  conv.unread = 0; await tgPut('dms', conv);
  tgDM.cur = conv;

  const all = await tgAll('msgs');
  tgDM.msgs = all.filter(m => m.convId === conv.id).sort((a, b) => (a.ts || a.createdAt) - (b.ts || b.createdAt));

  // 角色首次进入：用 firstMes 起个头
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
  let last = 0;
  const html = tgDM.msgs.map(m => {
    const ts = m.ts || m.createdAt;
    let div = '';
    if (ts - last > 1000 * 60 * 20) {
      div = `<div class="tg-chat-time">${tgFmtChatTime(ts)}</div>`;
      last = ts;
    }
    const me = m.side === 'me';
    return div + `<div class="tg-b ${me ? 'me' : 'them'}">
      ${me ? '' : `<div class="tg-b-av">${conv.avatar ? `<img src="${conv.avatar}">` : `<span>${tgEsc((conv.name || '·')[0])}</span>`}</div>`}
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
   五、AI 回复（只有点按钮才会调用）
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
    put('身份', f.role),
    put('性别', f.gender), put('年龄', f.age), put('设定', f.species),
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
  const n = 2 + Math.floor(Math.random() * 5); // 2-6，本轮期望条数
  return [
    '【回复规则，必须全部遵守】',
    `1. 这一轮你要连发 ${n} 条消息（长短不一，不要每条都一样长）。这是私聊，像真人一样把话拆开发。`,
    '2. 每条都要短——大多数在 6 到 30 字之间，允许出现极短的一条（三五个字），最多一条稍长但不超过 60 字。',
    '3. 必须接住对方最后一句话，不要答非所问、不要另起话题、不要复述对方说过的内容。',
    '4. 严格保持人设：称呼、语气、用词、性格边界都要一致，绝不 OOC，绝不跳出角色，不提自己是 AI。',
    '5. 不写旁白、不写心理描写、不写场景描述，除非人设本来就爱用括号里的小动作（那也最多一处）。',
    '6. 禁止使用任何 emoji、颜文字、星号、破折号排比等书面腔；禁止「有什么可以帮你」这类客服用语；禁止总结与说教。',
    '7. 允许出现停顿感：没说完的半句、突然的追问、答非所问但符合性格的岔开——要有活人的毛边。',
    '',
    '【输出格式】只输出一个 JSON 对象，第一个字符是 {，最后一个字符是 }，不要代码块、不要解释：',
    '{"msgs":["第一条","第二条","第三条"]}'
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

  const hist = tgDM.msgs.slice(-24).map(m => `${m.side === 'me' ? '对方' : conv.name}：${m.text}`).join('\n');
  const meName = (typeof tgMe !== 'undefined' && tgMe.name) ? tgMe.name : '对方';

  const sys = [
    tgPersonaOf(conv),
    '',
    `和你说话的人叫「${meName}」。`,
    '',
    tgChatRules()
  ].join('\n');
  const user = [
    '【到目前为止的聊天记录】',
    hist || '（还没有任何对话，由你先开口）',
    '',
    '现在轮到你回复。直接输出 JSON。'
  ].join('\n');

  let msgs = null;
  try {
    const j = await tgAskJSON(sys, user, { max: 1200 });
    if (Array.isArray(j)) msgs = j;
    else if (Array.isArray(j.msgs)) msgs = j.msgs;
    else if (Array.isArray(j.messages)) msgs = j.messages;
    else if (typeof j.text === 'string') msgs = [j.text];
  } catch (e) {
    // 兜底：直接要一段自然文本，再自行切条
    try {
      const raw = await tgChat([
        { role: 'system', content: sys.replace(/【输出格式】[\s\S]*$/, '直接用自然语言回复，每条消息独占一行，不要编号。') },
        { role: 'user', content: user.replace('直接输出 JSON。', '直接回复。') }
      ], { max: 900, temp: 0.9 });
      msgs = String(raw).split('\n');
    } catch (e2) { msgs = null; }
  }

  const t = document.getElementById('tgTyping'); if (t) t.remove();
  sub.textContent = subOld;
  if (btn) btn.classList.remove('busy');
  tgDM.busy = false;

  msgs = (msgs || []).map(x => String(typeof x === 'string' ? x : (x && (x.text || x.content) || '')))
    .map(s => s.replace(/^\s*[-–—·•\d]+[.、)]?\s*/, '').replace(/^["「『]|["」』]$/g, '').trim())
    .filter(Boolean);

  if (!msgs.length) { tgToast('这次没有回复出来，再点一次试试'); return; }

  // 只有一条时按语气切开，保证不是单条
  if (msgs.length === 1) msgs = tgSplitLine(msgs[0]);

  for (let i = 0; i < msgs.length; i++) {
    await new Promise(r => setTimeout(r, i ? 380 + Math.random() * 620 : 120));
    await tgPushMsg('them', msgs[i]);
  }
  if (typeof tgAddSweet === 'function') tgAddSweet(3);
}

/* 把一整段切成 2-4 条，长短随机，绝不只剩一条 */
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
  const want = Math.min(parts.length, 2 + Math.floor(Math.random() * 3));
  const out = [];
  const per = Math.ceil(parts.length / want);
  for (let i = 0; i < parts.length; i += per) out.push(parts.slice(i, i + per).join(''));
  return out.length > 1 ? out : [out[0].slice(0, Math.ceil(out[0].length / 2)), out[0].slice(Math.ceil(out[0].length / 2))];
}

/* ================================================================
   六、入场钩子与输入框自适应
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
