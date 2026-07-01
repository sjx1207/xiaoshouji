/* ================================================================
   collective.js — 集体潜意识（独立页面）
   玩法：输入一个词 → 全员各自给出第一反应 → AI 判定两两之间共鸣/冲突
        → 网络图呈现 → 点击节点看完整心理侧写（含潜藏人格节点）

   与 groupanon.js 共享同一套 localStorage 契约：
   - luna_groupanon_data / luna_group_data / luna_groupchat_data → 群成员数据
   - luna_api_current / luna_api_model → AI 接口配置
   - luna_groupanon_from → 返回来源标记
================================================================ */

/* ----------------------------------------------------------------
   Status bar utilities (1:1 复刻自 groupanon.js，保证观感一致)
---------------------------------------------------------------- */
function updateTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const timeStr = new Date().toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });
  const el = document.getElementById('statusTime');
  if (el) el.textContent = timeStr;
}

function updateBattery() {
  const pctEl   = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  function render(p) {
    p = Math.round(p);
    if (pctEl)   pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)'
        : 'linear-gradient(90deg,#6ee7b7,#34d399)';
    }
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      render(b.level * 100);
      b.addEventListener('levelchange', () => render(b.level * 100));
    });
  } else { render(76); }
}

function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const el = document.getElementById('statusIsland');
  if (!el) return;
  if (!enabled) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="si-minimal"><div class="si-capsule"></div></div>`;
}

/* ----------------------------------------------------------------
   State
---------------------------------------------------------------- */
let _groupMembers = [];
let _groupName    = 'GROUP';
let _usingDemoMembers = false;

let _userIdentity = null;
let _userGender   = null;

let _colWords       = [];
let _colCurrentWord = null;
let _colNextNodeId  = 1;

/* 单条记录历史保留上限，防止 localStorage 无限膨胀 */
const COL_HISTORY_LIMIT = 40;

/* ----------------------------------------------------------------
   Fallback demo members (与 groupanon.js 一致，保证跳转前后风格统一)
---------------------------------------------------------------- */
const DEMO_MEMBERS = [
  {
    id:'m1', name:'萧沐白', initial:'萧', avatar:null, role:'admin',
    bio:'冷峻、寡言，外表疏离实则内心细腻。是这个群的大哥，对弟弟妹妹们有保护欲但嘴上不说。',
    relations: {
      m2: { callName:'清欢', relationship:'青梅竹马，从小认识，心里有点特别但绝口不提' },
      m3: { callName:'老三', relationship:'发小，互相看不顺眼但关键时刻都挺对方' },
      m4: { callName:'小四', relationship:'最小的弟弟，暗中关照，表面淡漠' },
    }
  },
  {
    id:'m2', name:'林清欢', initial:'林', avatar:null, role:'member',
    bio:'温柔体贴，习惯用玩笑话掩盖在意。在这个群里排行老二，最会察言观色。',
    relations: {
      m1: { callName:'沐白哥', relationship:'青梅竹马，从小认识，对他有说不清的情愫' },
      m3: { callName:'辞年', relationship:'室友般的关系，什么都聊，但经常被他气到' },
      m4: { callName:'鹿鸣', relationship:'像对小弟弟，看他开心就开心' },
    }
  },
  {
    id:'m3', name:'顾辞年', initial:'顾', avatar:null, role:'member',
    bio:'毒舌但护短，嘴硬心软的双子座。排行老三，嘴上最刻薄，心里最义气。',
    relations: {
      m1: { callName:'大哥', relationship:'死党，明面上互怼，私下最能说心里话' },
      m2: { callName:'二姐', relationship:'经常被她说教，但其实很信任她' },
      m4: { callName:'小白', relationship:'时常欺负他，其实最怕他受委屈' },
    }
  },
  {
    id:'m4', name:'白鹿鸣', initial:'白', avatar:null, role:'member',
    bio:'开朗活泼，藏不住情绪的透明人。群里最小，什么都写在脸上，傻白甜但心思比看起来细。',
    relations: {
      m1: { callName:'沐白哥', relationship:'最崇拜的人，一直想在他面前显得成熟一点' },
      m2: { callName:'清欢姐', relationship:'最亲的姐姐，什么都跟她说' },
      m3: { callName:'辞年哥', relationship:'表面上怕他，其实根本没在怕' },
    }
  },
];

/* ----------------------------------------------------------------
   Load user identity (persona) from IndexedDB LunaIdentityDB
---------------------------------------------------------------- */
async function loadUserIdentity() {
  try {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('LunaIdentityDB');
      req.onsuccess = e => res(e.target.result);
      req.onerror   = () => rej(new Error('no db'));
    });
    if (!db.objectStoreNames.contains('identities')) { db.close(); return null; }
    const list = await new Promise(res => {
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
    db.close();
    if (!list.length) return null;
    return list.find(i => i.active !== false) || list[0];
  } catch(e) { return null; }
}

function deriveGender(identity) {
  if (!identity) return null;
  const src = [
    identity.gender || '', identity.desc || '',
    (identity.tags || []).join(' '), identity.role || '',
  ].join(' ').toLowerCase();
  if (/女|she|her|girl|lady/.test(src)) return 'female';
  if (/男|he|him|boy|guy/.test(src))    return 'male';
  return null;
}

function userPronoun() {
  if (_userGender === 'female') return '她';
  if (_userGender === 'male')   return '他';
  return 'TA';
}
function userDisplayName() { return _userIdentity?.name || '群主'; }

/* ----------------------------------------------------------------
   Load group data from localStorage (由 groupanon.js 写入，跨页共享)
---------------------------------------------------------------- */
function loadGroupData() {
  _usingDemoMembers = false;
  try {
    const raw = localStorage.getItem('luna_groupanon_data')
             || localStorage.getItem('luna_group_data')
             || localStorage.getItem('luna_groupchat_data');
    if (raw) {
      const data = JSON.parse(raw);
      _groupName = data.name || 'GROUP';
      const members = data.members && data.members.length > 0 ? data.members : null;
      if (members) {
        _groupMembers = members.map(m => ({
          ...m,
          initial: m.initial || (m.name ? m.name[0] : '?'),
          avatar:  m.avatar  || m.avatarUrl || m.icon || null,
        }));
      } else {
        _groupMembers = DEMO_MEMBERS;
        _usingDemoMembers = true;
      }
    } else {
      _groupMembers = DEMO_MEMBERS;
      _usingDemoMembers = true;
    }
  } catch(e) {
    _groupMembers = DEMO_MEMBERS;
    _usingDemoMembers = true;
  }
  if (_groupMembers.length < 2) {
    _groupMembers = [..._groupMembers, ...DEMO_MEMBERS].slice(0, 4);
    _usingDemoMembers = true;
  }
}

/* ----------------------------------------------------------------
   持久化「集体潜意识」历史记录到 localStorage
   —— 按群名做命名空间，避免不同群的记录互相覆盖
---------------------------------------------------------------- */
function getColStorageKey() {
  return 'luna_collective_words::' + (_groupName || 'default');
}

function saveColWords() {
  try {
    const trimmed = _colWords.slice(0, COL_HISTORY_LIMIT);
    localStorage.setItem(getColStorageKey(), JSON.stringify({
      nextNodeId: _colNextNodeId,
      words: trimmed,
    }));
  } catch (e) {
    // 超出配额等异常情况下，尝试只保留最近的一部分记录再重试一次
    console.warn('[collective] saveColWords failed, retrying with fewer entries', e);
    try {
      const shrunk = _colWords.slice(0, 10);
      localStorage.setItem(getColStorageKey(), JSON.stringify({
        nextNodeId: _colNextNodeId,
        words: shrunk,
      }));
    } catch (e2) {
      console.warn('[collective] saveColWords retry failed', e2);
    }
  }
}

function loadColWords() {
  try {
    const raw = localStorage.getItem(getColStorageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.words)) {
      _colWords = data.words;
      _colNextNodeId = typeof data.nextNodeId === 'number' ? data.nextNodeId : (_colNextNodeId);
    }
  } catch (e) {
    console.warn('[collective] loadColWords failed', e);
    _colWords = [];
  }
}

/* ----------------------------------------------------------------
   Back navigation — 回到 groupanon.html 的 Hub
---------------------------------------------------------------- */
function handleBack() {
  if (document.getElementById('colDetailSheet')?.classList.contains('open')) {
    closeColDetail(); return;
  }
  if (document.getElementById('infoSheet')?.classList.contains('open')) {
    hideInfo(); return;
  }
  window.location.href = 'groupanon.html';
}

/* ----------------------------------------------------------------
   Info sheet
---------------------------------------------------------------- */
function showInfo() {
  document.getElementById('sheetOverlay')?.classList.add('open');
  document.getElementById('infoSheet')?.classList.add('open');
}
function hideInfo() {
  document.getElementById('sheetOverlay')?.classList.remove('open');
  document.getElementById('infoSheet')?.classList.remove('open');
}

/* ----------------------------------------------------------------
   Toast
---------------------------------------------------------------- */
function gaToast(msg) {
  const t = document.getElementById('gaToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ----------------------------------------------------------------
   Utilities
---------------------------------------------------------------- */
function escHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

/* ----------------------------------------------------------------
   AI API calls — 复用设置页已配置好的接口
   （读取 settings.js 写入的 luna_api_current / luna_api_model）
---------------------------------------------------------------- */
function getLunaApiConfig() {
  let cur = {};
  try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch(e) {}
  const baseUrl = (cur.baseUrl || '').trim().replace(/\/$/, '');
  const apiKey  = (cur.apiKey  || '').trim();
  const model   = (localStorage.getItem('luna_api_model') || cur.model || '').trim();
  return { baseUrl, apiKey, model };
}

async function callClaude(prompt, systemPrompt, maxTokens) {
  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) throw new Error('NO_API_CONFIG');

  const isAnthropic = baseUrl.includes('anthropic.com');
  let res, data, reply;

  if (isAnthropic) {
    const body = { model, max_tokens: maxTokens || 500, messages: [{ role: 'user', content: prompt }] };
    if (systemPrompt) body.system = systemPrompt;

    res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data = await res.json();
    reply = data.content?.[0]?.text || '';
    if (!reply) {
      const stopReason = data.stop_reason || '';
      throw new Error('API 返回空内容' + (stopReason ? `（stop_reason: ${stopReason}）` : '') + '，请检查模型配置或重试');
    }
  } else {
    const apiBase = baseUrl.replace(/\/v1$/, '') + '/v1';
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    res = await fetch(`${apiBase}/chat/completions`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: maxTokens || 500, temperature: 0.95 }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('API error ' + res.status + (errText ? ': ' + errText.slice(0, 200) : ''));
    }
    data = await res.json();
    reply = data.choices?.[0]?.message?.content ?? '';
    if (reply === null || reply === undefined || reply === '') {
      const finishReason = data.choices?.[0]?.finish_reason || '';
      const errMsg = data.error?.message || '';
      if (errMsg) throw new Error('API 错误：' + errMsg.slice(0, 100));
      throw new Error('API 返回空内容' + (finishReason ? `（finish_reason: ${finishReason}）` : '') + '，可能被内容过滤或 max_tokens 过小');
    }
  }
  return reply.trim();
}

function notifyApiNotConfigured() {
  gaToast('请先在「设置 → API」中配置并选择模型');
}

/* ----------------------------------------------------------------
   Character brief helpers（与 groupanon.js 中的逻辑保持一致）
---------------------------------------------------------------- */
function buildMemberBrief(member) {
  const roleLabel = member.role === 'admin' ? '群管理员' : '普通群成员';
  const parts = [];
  const mainDesc = (member.desc || member.bio || '').trim();
  if (mainDesc) parts.push(mainDesc);
  if (member.traits && member.traits.length) parts.push('性格标签：' + member.traits.join('、'));
  if (member.gender) parts.push(member.gender);
  if (member.age)    parts.push(member.age + '岁');
  const customPrompt = (member.prompt || '').trim();
  if (customPrompt) parts.push('角色设定：' + customPrompt);
  if (parts.length > 0) return `${parts.join('；')}（身份：${roleLabel}）`;
  return `群内${roleLabel}，名字是「${member.name}」。请根据名字赋予一个具体一致的性格，并在整个对话中严格保持。`;
}

function buildGroupCastLine(excludeId) {
  return _groupMembers.filter(m => m.id !== excludeId).map(m => m.name).join('、');
}

function buildRelationContext(member) {
  const others = _groupMembers.filter(m => m.id !== member.id);
  if (!others.length) return '';
  const lines = others.map(other => {
    const rel = member.relations && member.relations[other.id];
    if (rel) {
      const callPart = rel.callName ? `叫TA「${rel.callName}」` : `叫TA「${other.name}」`;
      const relPart  = rel.relationship ? `，${rel.relationship}` : '';
      return `- 对「${other.name}」：${callPart}${relPart}`;
    }
    return `- 对「${other.name}」：直接叫「${other.name}」`;
  });
  return `\n【你和群内其他人的称呼与关系——说话时必须用这里的称呼，不能乱叫】\n${lines.join('\n')}`;
}

/* ================================================================
   集体潜意识 — 核心玩法
================================================================ */

/* ---------------------------------------------------------------
   Input handling
--------------------------------------------------------------- */
function onColWordInput(el) {
  const btn = document.getElementById('colSubmitBtn');
  if (btn) btn.classList.toggle('active', el.value.trim().length > 0);
}
function onColWordKeydown(e) {
  if (e.key === 'Enter') { e.preventDefault(); submitCollectiveWord(); }
}
function fillCollectiveWord(w) {
  const field = document.getElementById('colWordInput');
  if (field) { field.value = w; onColWordInput(field); }
  submitCollectiveWord();
}

/* ---------------------------------------------------------------
   History chip row
--------------------------------------------------------------- */
function renderColHistory() {
  const row = document.getElementById('colHistoryRow');
  if (!row) return;
  if (!_colWords.length) { row.innerHTML = ''; return; }
  row.innerHTML = _colWords.map((w, i) => `
    <div class="col-hist-chip ${_colCurrentWord === w ? 'active' : ''}" onclick="showColWord(${i})">${escHtml(w.word)}</div>
  `).join('');
}
function showColWord(idx) {
  const w = _colWords[idx];
  if (!w) return;
  _colCurrentWord = w;
  renderColHistory();
  renderColNetwork(w);
}

/* ---------------------------------------------------------------
   Submit a word → run the whole generation pipeline
--------------------------------------------------------------- */
async function submitCollectiveWord() {
  const field = document.getElementById('colWordInput');
  const word  = field?.value.trim();
  if (!word) return;
  if (!_groupMembers.length) { gaToast('没有可用的群成员数据'); return; }

  const { baseUrl, apiKey, model } = getLunaApiConfig();
  if (!baseUrl || !apiKey || !model) { notifyApiNotConfigured(); return; }

  field.value = '';
  onColWordInput(field);

  showColLoading(word);

  const wordEntry = { word, time: Date.now(), nodes: [], edges: [] };

  try {
    for (const member of _groupMembers) {
      updateColLoadingMember(member.id, false);
      try {
        const reactionData = await generateColReaction(word, member);
        wordEntry.nodes.push({
          id: 'n' + (_colNextNodeId++),
          memberId: member.id,
          memberName: member.name,
          memberInitial: member.initial,
          memberAvatar: member.avatar,
          isShadow: false,
          reaction: reactionData.reaction,
          trace: reactionData.trace,
          undertone: reactionData.undertone,
        });
      } catch (err) {
        console.warn('[collective] member reaction failed', member.name, err);
      }
      updateColLoadingMember(member.id, true);
    }

    if (wordEntry.nodes.length < 2) throw new Error('生成的反应数量不足，请重试');

    const shadowCandidate = pickShadowCandidate();
    if (shadowCandidate) {
      updateColLoadingMember(shadowCandidate.id, false, true);
      try {
        const shadowData = await generateColShadowReaction(word, shadowCandidate);
        if (shadowData) {
          wordEntry.nodes.push({
            id: 'n' + (_colNextNodeId++),
            memberId: shadowCandidate.id,
            memberName: shadowCandidate.name,
            memberInitial: shadowCandidate.initial,
            memberAvatar: shadowCandidate.avatar,
            isShadow: true,
            reaction: shadowData.reaction,
            trace: shadowData.trace,
            undertone: shadowData.undertone,
          });
        }
      } catch (err) {
        console.warn('[collective] shadow reaction failed', err);
      }
    }

    setColLoadingStatus('正在比对每个人的第一反应……');
    wordEntry.edges = await judgeColEdges(word, wordEntry.nodes);

  } catch (err) {
    hideColLoading();
    if (err.message === 'NO_API_CONFIG') notifyApiNotConfigured();
    else gaToast('生成失败：' + (err.message || err));
    console.error('[submitCollectiveWord]', err);
    return;
  }

  _colWords.unshift(wordEntry);
  _colCurrentWord = wordEntry;
  saveColWords();
  renderColHistory();
  renderColNetwork(wordEntry);
}

/* ---------------------------------------------------------------
   Loading UI helpers
--------------------------------------------------------------- */
function showColLoading(word) {
  document.getElementById('colIdle')?.classList.add('hidden');
  document.getElementById('colNetwork')?.classList.add('hidden');
  document.getElementById('colLoading')?.classList.remove('hidden');
  const wordEl = document.getElementById('colLoadingWord');
  if (wordEl) wordEl.textContent = `「${word}」`;
  setColLoadingStatus('正在潜入每个人的第一反应……');

  const membersEl = document.getElementById('colLoadingMembers');
  if (membersEl) {
    membersEl.innerHTML = _groupMembers.map(m =>
      `<span class="col-lm-chip" id="colLm-${m.id}">${escHtml(m.name)}</span>`
    ).join('');
  }
}
function setColLoadingStatus(text) {
  const el = document.getElementById('colLoadingStatus');
  if (el) el.textContent = text;
}
function updateColLoadingMember(memberId, done, isShadow) {
  const chip = document.getElementById('colLm-' + memberId);
  if (!chip) return;
  if (isShadow && !done) { chip.textContent = chip.textContent + ' · 潜藏人格'; return; }
  chip.classList.toggle('done', done);
}
function hideColLoading() {
  document.getElementById('colLoading')?.classList.add('hidden');
  document.getElementById('colIdle')?.classList.remove('hidden');
}

/* ---------------------------------------------------------------
   AI generation — first reaction (反应+成因+潜台词，合计约400-500+字)
--------------------------------------------------------------- */
async function generateColReaction(word, member) {
  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);
  const castLine    = buildGroupCastLine(member.id);

  const systemPrompt = `你正在扮演群聊成员「${member.name}」，参与一个叫「集体潜意识」的心理游戏：群主投下一个词，你要给出不经修饰的第一反应，然后由你（仍以${member.name}的视角）补充这份反应背后的心理成因和没说出口的潜台词。

【这个人是谁】
${brief}${relationCtx}

【群里的其他成员】
${castLine || '暂无其他成员'}

【任务：针对词语「${word}」，生成三段内容】

第一段【第一反应】：
- 必须是不假思索、条件反射式的东西——可以是一个画面、一句话、一个具体的人或物、一个动作冲动，不能是"我觉得……"式的评论
- 要有「${member.name}」的语言辨识度，长度约25-45字
- 不要解释、不要修饰，就是脑子里蹦出来的那一下

第二段【心理成因】：
- 以「${member.name}」的视角，说明为什么TA的第一反应是这个——牵扯到TA的性格、经历、习惯性心理防御或情感模式
- 要具体，可以虚构一个跟这个词相关的、符合TA人设的小片段或习惯作为佐证
- 长度约140-190字，第一人称或贴近第一人称的叙述都可以

第三段【潜台词】：
- 写出「${member.name}」在说出第一反应时，心里没讲出口的那句话——更私密、更真实、可能和表面反应有落差甚至矛盾
- 体现这个人表里之间的缝隙
- 长度约90-140字

【严禁清单】
- 禁止三段互相重复或空洞打太极
- 禁止出现"AI""模型""程序"
- 禁止每段都用"其实""说实话""怎么说呢"开头
- 禁止心灵鸡汤式收尾，不需要升华或总结陈词
- 如果提到其他群成员，必须用「你和群内其他人的称呼」里注明的叫法

【严格按以下格式输出，不要加任何多余文字、编号说明或标题以外的内容】
反应：<第一段内容>
成因：<第二段内容>
潜台词：<第三段内容>`;

  const prompt = `词是「${word}」。用「${member.name}」的方式，按格式给出第一反应、心理成因、潜台词三段。`;
  const raw = await callClaude(prompt, systemPrompt, 900);
  return parseColReactionRaw(raw);
}

async function generateColShadowReaction(word, member) {
  const brief       = buildMemberBrief(member);
  const relationCtx = buildRelationContext(member);

  const systemPrompt = `你正在扮演群聊成员「${member.name}」内心深处、平时几乎不显露的另一重人格——TA的「潜藏人格」。这重人格在听到词语时会给出和TA平时表现完全不同、甚至相反的反应。

【表面上的这个人是谁】
${brief}${relationCtx}

【任务：针对词语「${word}」，以潜藏人格的视角生成三段内容】

第一段【第一反应】：
- 潜藏人格对这个词不假思索的反应，要与「${member.name}」平时会给出的反应形成明显反差或对照
- 长度约25-45字，不解释不修饰

第二段【心理成因】：
- 说明这重潜藏人格从何而来——是被压抑的欲望、未被满足的需求、早年的某种创伤性经验、还是长期扮演某个角色所积累的疲惫和反弹
- 需要具体、有画面感的一个片段作为支撑
- 长度约140-190字

第三段【潜台词】：
- 这重潜藏人格最想说却始终没有说出口、甚至连「${member.name}」自己都不愿承认的一句真心话
- 长度约90-140字

【严禁清单】
- 禁止让潜藏人格显得夸张、扭曲成另一个完全不合理的人，反差要真实可信、扎根于这个角色本身
- 禁止出现"AI""模型""程序"
- 禁止心灵鸡汤式收尾

【严格按以下格式输出，不要加任何多余文字】
反应：<第一段内容>
成因：<第二段内容>
潜台词：<第三段内容>`;

  const prompt = `词是「${word}」。写出「${member.name}」潜藏人格对这个词的第一反应、成因、潜台词三段，务必和TA表面的反应形成反差。`;
  const raw = await callClaude(prompt, systemPrompt, 900);
  return parseColReactionRaw(raw);
}

function parseColReactionRaw(raw) {
  const reactionM  = raw.match(/反应[：:]\s*([\s\S]*?)(?=\n成因[：:]|$)/);
  const traceM     = raw.match(/成因[：:]\s*([\s\S]*?)(?=\n潜台词[：:]|$)/);
  const undertoneM = raw.match(/潜台词[：:]\s*([\s\S]*)$/);
  const reaction  = (reactionM  ? reactionM[1]  : raw.slice(0, 60)).trim();
  const trace     = (traceM     ? traceM[1]     : '').trim() || '这份反应背后的具体原因，TA自己也说不太清楚，只是身体先于思考做出了回应。';
  const undertone = (undertoneM ? undertoneM[1] : '').trim() || '有些话，到嘴边又咽了回去。';
  return { reaction, trace, undertone };
}

/* Pick at most one member likely to carry an interesting shadow persona */
function pickShadowCandidate() {
  const keywordHit = _groupMembers.find(m => {
    const brief = buildMemberBrief(m);
    return /表里不一|矛盾|嘴硬心软|藏|伪装|冷峻.*细腻|外表.*内心|双重|反差/.test(brief);
  });
  if (keywordHit) return keywordHit;
  if (_groupMembers.length >= 2 && Math.random() < 0.4) {
    return _groupMembers[Math.floor(Math.random() * _groupMembers.length)];
  }
  return null;
}

/* ---------------------------------------------------------------
   AI judge — pairwise resonance / conflict between node reactions
--------------------------------------------------------------- */
async function judgeColEdges(word, nodes) {
  if (nodes.length < 2) return [];

  const listing = nodes.map((n, i) =>
    `${i + 1}. ${n.memberName}${n.isShadow ? '（潜藏人格）' : ''}：「${n.reaction}」`
  ).join('\n');

  const prompt = `词是「${word}」，以下是每个人的第一反应：
${listing}

请判断这些反应两两之间的关系，只标出"明显共鸣"（情绪基调、指向、态度高度相似或呼应）和"明显冲突"（态度、情绪方向截然相反或彼此矛盾）的配对，普通的、看不出明显关联的配对不要列出。
最多列出6条关系。

严格按以下格式逐行输出，不要任何多余文字：
序号A-序号B：共鸣
序号A-序号B：冲突

例如：
1-3：共鸣
2-4：冲突

如果确实没有明显的共鸣或冲突，输出：无`;

  let raw = '';
  try {
    raw = await callClaude(prompt, null, 400);
  } catch (err) {
    console.warn('[judgeColEdges] failed, fallback to no edges', err);
    return [];
  }

  const edges = [];
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^(\d+)\s*-\s*(\d+)\s*[：:]\s*(共鸣|冲突)/);
    if (!m) continue;
    const ai = parseInt(m[1], 10) - 1;
    const bi = parseInt(m[2], 10) - 1;
    if (ai < 0 || bi < 0 || ai >= nodes.length || bi >= nodes.length || ai === bi) continue;
    edges.push({ a: nodes[ai].id, b: nodes[bi].id, type: m[3] === '共鸣' ? 'resonance' : 'conflict' });
  }
  return edges;
}

/* ---------------------------------------------------------------
   Network rendering — radial layout
--------------------------------------------------------------- */
function renderColNetwork(wordEntry) {
  document.getElementById('colLoading')?.classList.add('hidden');
  document.getElementById('colIdle')?.classList.add('hidden');
  document.getElementById('colNetwork')?.classList.remove('hidden');

  const svg = document.getElementById('colNetSvg');
  const edgesLayer = document.getElementById('colEdgesLayer');
  const nodesLayer = document.getElementById('colNodesLayer');
  if (!svg || !edgesLayer || !nodesLayer) return;

  const W = 340, H = 460;
  const cx = W / 2, cy = H / 2 + 6;
  const nodes = wordEntry.nodes;
  const n = nodes.length;
  const radius = Math.min(W, H) / 2 - 58;

  const positioned = nodes.map((node, i) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const r = node.isShadow ? radius + 26 : radius;
    return { ...node, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
  });
  const posMap = {};
  positioned.forEach(p => posMap[p.id] = p);

  let edgesSvg = '';
  wordEntry.edges.forEach(edge => {
    const a = posMap[edge.a], b = posMap[edge.b];
    if (!a || !b) return;
    const cls = edge.type === 'resonance' ? 'col-edge-resonance' : 'col-edge-conflict';
    edgesSvg += `<line class="col-edge ${cls}" data-a="${a.id}" data-b="${b.id}"
      x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" />`;
  });
  positioned.forEach(p => {
    edgesSvg += `<line class="col-edge" stroke="#e4e0ee" stroke-width="0.5" stroke-dasharray="1 5" opacity="0.6"
      x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" />`;
  });
  edgesLayer.innerHTML = edgesSvg;

  let nodesSvg = `
    <circle class="col-center-ring" cx="${cx}" cy="${cy}" r="34"/>
    <circle class="col-center-circle" cx="${cx}" cy="${cy}" r="26"/>
    <text class="col-center-text" x="${cx}" y="${cy}">${escSvgText(wordEntry.word)}</text>
  `;

  positioned.forEach(p => {
    const r = p.isShadow ? 22 : 26;
    const previewText = truncatePreview(p.reaction, 10);
    nodesSvg += `
      <g class="col-node-group" data-id="${p.id}" onclick="openColDetail('${p.id}')">
        <circle class="col-node-halo" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r + 7}"/>
        <circle class="col-node-circle ${p.isShadow ? 'shadow-node' : ''}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${r}"/>
        <text class="col-node-initial" x="${p.x.toFixed(1)}" y="${p.y.toFixed(1) - (p.isShadow?2:1)}">${escSvgText(p.memberInitial)}</text>
        <text class="col-node-label" x="${p.x.toFixed(1)}" y="${(p.y + r + 13).toFixed(1)}">${escSvgText(p.memberName)}${p.isShadow ? '·潜藏' : ''}</text>
        <text class="col-node-preview" x="${p.x.toFixed(1)}" y="${(p.y + r + 25).toFixed(1)}">${escSvgText(previewText)}</text>
      </g>
    `;
  });

  nodesLayer.innerHTML = nodesSvg;

  nodesLayer.querySelectorAll('.col-node-group').forEach(g => {
    g.addEventListener('pointerdown', () => highlightColNode(g.dataset.id, wordEntry));
  });
}

function highlightColNode(nodeId, wordEntry) {
  const nodesLayer = document.getElementById('colNodesLayer');
  const edgesLayer = document.getElementById('colEdgesLayer');
  if (!nodesLayer || !edgesLayer) return;

  const connected = new Set([nodeId]);
  wordEntry.edges.forEach(e => {
    if (e.a === nodeId) connected.add(e.b);
    if (e.b === nodeId) connected.add(e.a);
  });

  nodesLayer.querySelectorAll('.col-node-group').forEach(g => {
    g.classList.toggle('dim', !connected.has(g.dataset.id));
  });
  edgesLayer.querySelectorAll('.col-edge[data-a]').forEach(line => {
    const involved = line.dataset.a === nodeId || line.dataset.b === nodeId;
    line.classList.toggle('highlight', involved);
    line.classList.toggle('dim', !involved && (connected.size > 1));
  });
}

function truncatePreview(text, maxLen) {
  if (!text) return '';
  return text.length > maxLen ? text.slice(0, maxLen) + '…' : text;
}
function escSvgText(str) { return escHtml(str || ''); }

/* ---------------------------------------------------------------
   Node detail sheet
--------------------------------------------------------------- */
function openColDetail(nodeId) {
  const wordEntry = _colCurrentWord;
  if (!wordEntry) return;
  const node = wordEntry.nodes.find(n => n.id === nodeId);
  if (!node) return;

  const member = _groupMembers.find(m => m.id === node.memberId);
  const avEl = document.getElementById('colDetailAv');
  if (avEl) {
    avEl.innerHTML = (member && member.avatar)
      ? `<img src="${escHtml(member.avatar)}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.textContent='${escHtml(node.memberInitial)}'"/>`
      : escHtml(node.memberInitial);
  }
  document.getElementById('colDetailName').textContent = node.memberName + (node.isShadow ? '（潜藏人格）' : '');
  document.getElementById('colDetailWord').textContent  = wordEntry.word;
  document.getElementById('colDetailShadowBadge')?.classList.toggle('hidden', !node.isShadow);
  document.getElementById('colDetailReaction').textContent  = node.reaction;
  document.getElementById('colDetailTrace').textContent     = node.trace;
  document.getElementById('colDetailUndertone').textContent = node.undertone;

  const linksEl = document.getElementById('colDetailLinks');
  if (linksEl) {
    const related = wordEntry.edges.filter(e => e.a === node.id || e.b === node.id);
    if (!related.length) {
      linksEl.innerHTML = `<div class="col-detail-link-empty">与其他人的反应之间，暂未发现明显的共鸣或冲突</div>`;
    } else {
      linksEl.innerHTML = related.map(e => {
        const otherId = e.a === node.id ? e.b : e.a;
        const other = wordEntry.nodes.find(n => n.id === otherId);
        if (!other) return '';
        const label = e.type === 'resonance' ? '共鸣' : '冲突';
        return `<div class="col-detail-link-item ${e.type}">
          <span class="col-link-dot"></span>
          与「${escHtml(other.memberName)}${other.isShadow ? '·潜藏人格' : ''}」的反应存在${label}
        </div>`;
      }).join('');
    }
  }

  document.getElementById('colDetailOverlay')?.classList.add('open');
  document.getElementById('colDetailSheet')?.classList.add('open');
  highlightColNode(nodeId, wordEntry);
}

function closeColDetail() {
  document.getElementById('colDetailOverlay')?.classList.remove('open');
  document.getElementById('colDetailSheet')?.classList.remove('open');
  document.getElementById('colNodesLayer')?.querySelectorAll('.col-node-group').forEach(g => g.classList.remove('dim'));
  document.getElementById('colEdgesLayer')?.querySelectorAll('.col-edge').forEach(l => { l.classList.remove('dim'); l.classList.remove('highlight'); });
}

/* ----------------------------------------------------------------
   INIT
---------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', async () => {
  updateTime();
  updateBattery();
  applyIsland();

  _userIdentity = await loadUserIdentity();
  _userGender   = deriveGender(_userIdentity);

  loadGroupData();
  loadColWords();

  if (_usingDemoMembers) {
    setTimeout(() => {
      gaToast('未读取到群成员数据，请从群聊页面的「群互动」入口进入');
    }, 800);
  }

  renderColHistory();

  if (_colWords.length > 0) {
    _colCurrentWord = _colWords[0];
    renderColNetwork(_colCurrentWord);
  }

  setInterval(updateTime, 10000);
});