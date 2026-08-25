/* ================================================================
   糖罐 TANGGUAN — tg-genre.js
   内容生成引擎（广场 / 圈子 / 二创 / 正主动态 共用）

   核心目标：无论用户接的是 GPT / Claude 中转 / Gemini 中转 / DeepSeek /
   Kimi / 通义 / 智谱 / 本地 Ollama / 各种小模型，都必须能：
     1. 生成得出来（三轮 JSON + 一轮行协议 + 一轮极简协议，五重保险）
     2. 解析得出来（六种修复策略 + 行协议兜底）
     3. 不掉格式、不 OOC（人设资料整包下发 + 硬约束 + 复检重写）
     4. 体裁不重复（发牌式抽签，一批里绝不出现两个相同体裁）
================================================================ */

/* ================================================================
   一、接口层
================================================================ */
function tgApiCfg() {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  return {
    base: (cur.baseUrl || '').replace(/\/+$/, ''),
    key: cur.apiKey || '',
    model: localStorage.getItem('luna_api_model') || ''
  };
}
function tgHasApi() { const c = tgApiCfg(); return !!(c.base && c.key); }

/* 抽取模型返回的纯文本：兼容 content 为字符串 / 数组 / 带 reasoning 的各种形态 */
function tgPickText(d) {
  if (!d) return '';
  const ch = (d.choices && d.choices[0]) || {};
  const m = ch.message || ch.delta || {};
  let c = m.content;
  if (typeof c === 'string' && c.trim()) return c;
  if (Array.isArray(c)) {
    const s = c.map(x => (typeof x === 'string' ? x : ((x && (x.text || x.content)) || ''))).join('');
    if (s.trim()) return s;
  }
  if (typeof ch.text === 'string' && ch.text.trim()) return ch.text;
  if (typeof m.reasoning_content === 'string' && m.reasoning_content.trim()) return m.reasoning_content;
  if (d.content && Array.isArray(d.content)) return d.content.map(x => x.text || '').join('');
  if (typeof d.output_text === 'string') return d.output_text;
  return '';
}

async function tgChat(messages, opt) {
  opt = opt || {};
  const c = tgApiCfg();
  if (!c.base || !c.key) throw new Error('NO_API');
  const body = {
    model: c.model || 'gpt-4o-mini',
    messages,
    temperature: opt.temp == null ? 0.94 : opt.temp,
    max_tokens: opt.max || 8000,
    stream: false
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opt.timeout || 180000);
  let resp;
  try {
    resp = await fetch(c.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + c.key },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } finally { clearTimeout(timer); }
  if (!resp.ok) {
    let t = ''; try { t = (await resp.text()).slice(0, 160); } catch (e) { }
    throw new Error('API_' + resp.status + (t ? ' ' + t : ''));
  }
  const d = await resp.json();
  const txt = tgPickText(d);
  if (!txt) throw new Error('EMPTY');
  return txt;
}

/* ================================================================
   二、极其宽容的 JSON 解析
================================================================ */
function tgJSON(raw) {
  if (!raw) return null;
  let s = String(raw);
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/<\|[\s\S]*?\|>/g, '');
  s = s.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '');
  s = s.replace(/^\uFEFF/, '').trim();

  const oi = s.indexOf('{'), oj = s.lastIndexOf('}');
  const ai = s.indexOf('['), aj = s.lastIndexOf(']');
  let cut = s;
  if (oi !== -1 && oj > oi && (ai === -1 || oi < ai)) cut = s.slice(oi, oj + 1);
  else if (ai !== -1 && aj > ai) cut = s.slice(ai, aj + 1);

  const fixQuotes = x => x.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const fixTail = x => x.replace(/,\s*([}\]])/g, '$1');
  const fixNL = x => {
    // 只把「字符串内部」的真实换行转义掉
    let out = '', q = false, esc = false;
    for (const ch of x) {
      if (esc) { out += ch; esc = false; continue; }
      if (ch === '\\') { out += ch; esc = true; continue; }
      if (ch === '"') { q = !q; out += ch; continue; }
      if (q && (ch === '\n' || ch === '\r')) { out += '\\n'; continue; }
      if (q && ch === '\t') { out += '\\t'; continue; }
      out += ch;
    }
    return out;
  };
  const fixFullWidth = x => x.replace(/：(?=\s*["\[{])/g, ':').replace(/，(?=\s*")/g, ',');
  const close = x => {
    let o = 0, a = 0, q = false, esc = false, out = '';
    for (const ch of x) {
      out += ch;
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') q = !q;
      if (q) continue;
      if (ch === '{') o++; if (ch === '}') o--;
      if (ch === '[') a++; if (ch === ']') a--;
    }
    if (q) out += '"';
    out = out.replace(/,\s*$/, '');
    while (a-- > 0) out += ']';
    while (o-- > 0) out += '}';
    return out;
  };

  const tries = [
    x => x,
    x => fixTail(x),
    x => fixNL(x),
    x => fixTail(fixNL(fixQuotes(x))),
    x => fixTail(fixNL(fixQuotes(fixFullWidth(x)))),
    x => close(fixTail(fixNL(fixQuotes(fixFullWidth(x))))),
    x => close(fixNL(x))
  ];
  for (const f of tries) {
    try { const v = JSON.parse(f(cut)); if (v && typeof v === 'object') return v; } catch (e) { }
  }
  return null;
}

/* 失败/成功日志，最多留 40 条，方便判断是哪类模型经常出问题 */
window._tgGenLog = window._tgGenLog || [];
function tgGenLog(entry) {
  window._tgGenLog.push(Object.assign({ t: Date.now(), model: (tgApiCfg().model || '') }, entry));
  if (window._tgGenLog.length > 40) window._tgGenLog.shift();
}
function tgGenLogSummary() {
  const fail = window._tgGenLog.filter(x => !x.ok);
  const byReason = {};
  fail.forEach(x => { byReason[x.reason] = (byReason[x.reason] || 0) + 1; });
  return { total: window._tgGenLog.length, fail: fail.length, byReason };
}

/* 三轮 JSON，逐轮加强约束；opt.expectKeys 传入期望的字段名数组时，
   拿到的对象若一个都不含，也算解析失败继续重试，而不是把空结果放行给上层去兜底 */
async function tgAskJSON(sys, user, opt) {
  opt = opt || {};
  let lastErr = null;
  const rounds = opt.rounds || 3;
  const expectKeys = opt.expectKeys || null;
  for (let i = 0; i < rounds; i++) {
    try {
      const lowTemp = i >= rounds - 1; // 最后一轮自动降温，牺牲一点创意换格式稳定性
      const extra = i === 0 ? '' : [
        '',
        '【上一次的输出无法被解析或字段不对。这一次必须做到：】',
        '· 第一个字符是 { ，最后一个字符是 } 。',
        '· 不要写任何解释、不要写代码块标记、不要写注释。',
        '· 所有引号用英文双引号，字符串里的换行写成 \\n。',
        '· 数字不要加引号、不要加单位、不要写成「约 300」。',
        expectKeys ? `· 顶层键名必须是「${expectKeys.join(' / ')}」之一，不要自创别的键名。` : ''
      ].filter(Boolean).join('\n');
      const txt = await tgChat([
        { role: 'system', content: sys + extra },
        { role: 'user', content: user + (i ? '\n\n（重申：只输出 JSON 本体，不要有第二种东西。）' : '') }
      ], { max: opt.max || 8000, temp: lowTemp ? 0.55 : (i ? 0.72 : 0.95), timeout: opt.timeout });
      const j = tgJSON(txt);
      if (j) {
        if (expectKeys && !Array.isArray(j) && !expectKeys.some(k => j[k] !== undefined)) {
          lastErr = new Error('MISSING_KEY');
          tgGenLog({ ok: false, reason: 'MISSING_KEY', round: i });
          continue;
        }
        tgGenLog({ ok: true, round: i });
        return j;
      }
      lastErr = new Error('PARSE');
      tgGenLog({ ok: false, reason: 'PARSE', round: i });
    } catch (e) {
      lastErr = e;
      tgGenLog({ ok: false, reason: String(e.message || e).slice(0, 20), round: i });
      if (String(e.message).indexOf('NO_API') === 0) throw e;
    }
  }
  throw lastErr || new Error('PARSE');
}

/* ================================================================
   三、行协议（JSON 全部失败时的兜底通道）
   —— 小模型写不出合法 JSON，但几乎都能写对「键：值」的分块文本。
================================================================ */
const TG_LOOSE_KEYMAP = {
  '标题': 'title', '题目': 'title', '日记本名': 'title', '窗口标题': 'title',
  '引言': 'caption', '导语': 'caption', '简介': 'caption',
  '标签': 'tags', '话题': 'tags',
  '作者': 'author', '发帖人': 'author', '楼主': 'author',
  '小标题': 'h', '正文': 'body', '内容': 'body', '段落': 'body',
  '日期': 'date', '天气': 'weather', '心情': 'mood', '附言': 'ps',
  '位置': 'tag', '抬头': 'title2', '署名': 'from', '落款': 'from',
  '问': 'q', '提问': 'q', '答': 'a', '回答': 'a',
  '用户': 'user', '用户名': 'user', '昵称': 'name', '时间': 'time',
  '赞': 'like', '点赞': 'like', '回复数': 'reply',
  '版块': 'board', '浏览': 'view',
  '发言': 'text', '推文': 'text', '微博': 'text', '弹幕': 'text',
  '回复': 'replies', '评论': 'replies', '热评': 'replies',
  '台词': 'text', '摘句': 'text', '说话人': 'who', '出处': 'who',
  '寄信人': 'from', '收信人': 'to', '称呼': 'salut',
  '受访者': 'who', '刊物': 'outlet', '栏目': 'column',
  '视频': 'video', 'UP主': 'up', '时间码': 't',
  '图片': 'imgs', '地点': 'location', '点赞人': 'likes'
};

/* 把「块文本」拆成 {meta, items} */
function tgLooseSplit(raw) {
  const s = String(raw || '')
    .replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '')
    .replace(/\r/g, '').trim();
  const blocks = s.split(/\n\s*(?:---+|===+|—{2,})\s*\n/).map(b => b.trim()).filter(Boolean);
  const parse = b => {
    const o = {}; const loose = [];
    b.split('\n').forEach(ln => {
      const m = ln.match(/^\s*[·\-*]?\s*([^：:]{1,10})\s*[：:]\s*(.*)$/);
      if (m && TG_LOOSE_KEYMAP[m[1].trim()]) {
        const k = TG_LOOSE_KEYMAP[m[1].trim()];
        if (o[k] == null) o[k] = m[2].trim();
        else o[k] += '\n' + m[2].trim();
      } else if (ln.trim()) loose.push(ln.trim());
    });
    if (loose.length) o._loose = loose;
    return o;
  };
  return { meta: parse(blocks[0] || ''), items: blocks.slice(1).map(parse), raw: s };
}

const tgSplitList = v => String(v || '').split(/[|｜、，,／\/]/).map(x => x.trim()).filter(Boolean);
const tgSplitPara = o => {
  const b = [];
  if (o.body) String(o.body).split('\n').forEach(x => x.trim() && b.push(x.trim()));
  (o._loose || []).forEach(x => b.push(x));
  return b.length ? b : [''];
};

/* 每种体裁：行协议的说明 + 把块还原成 data 的还原器 */
const TG_LOOSE = {
  essay: {
    tip: '每个小节一块，块内写「小标题：」和「正文：」（正文可以多行，一行一段）。',
    build: it => ({ sections: it.map(o => ({ h: o.h || '', body: tgSplitPara(o) })) })
  },
  diary: {
    tip: '每篇日记一块，块内写「日期：」「天气：」「心情：」「正文：」（可多行）「附言：」。',
    build: it => ({ entries: it.map(o => ({ date: o.date || '某日', weather: o.weather || '', mood: o.mood || '', body: tgSplitPara(o), ps: o.ps || '' })) })
  },
  note: {
    tip: '每张便签一块，块内写「位置：」「抬头：」「正文：」「署名：」。',
    build: it => ({ notes: it.map(o => ({ tag: o.tag || '', title: o.title2 || o.title || '', body: tgSplitPara(o).join(''), from: o.from || '' })) })
  },
  qa: {
    tip: '每组问答一块，块内写「问：」和「答：」。',
    build: it => ({ items: it.map(o => ({ q: o.q || '', a: o.a || tgSplitPara(o).join('') })) })
  },
  forum: {
    tip: '第一块写「版块：」「时间：」「浏览：」，之后每一层楼一块，写「用户：」「时间：」「发言：」「赞：」。',
    build: (it, meta) => ({
      board: meta.board || '同人区', view: parseInt(meta.view, 10) || 0, time: meta.time || '',
      floors: it.map(o => ({ user: o.user || o.name || '匿名', time: o.time || '', text: o.text || tgSplitPara(o).join(''), like: parseInt(o.like, 10) || 0, reply: parseInt(o.reply, 10) || 0 }))
    })
  },
  tweet: {
    tip: '每条推文一块，写「昵称：」「用户名：」「时间：」「推文：」，回复写成「回复：昵称|内容」，可写多行。',
    build: it => ({
      tweets: it.map(o => ({
        name: o.name || '', handle: o.user || '', time: o.time || '',
        text: o.text || tgSplitPara(o).join(''),
        stats: { reply: 0, repost: 0, like: 0 },
        replies: String(o.replies || '').split('\n').filter(Boolean).map(r => {
          const p = r.split(/[|｜]/); return { name: (p[0] || '').trim(), text: (p[1] || p[0] || '').trim() };
        })
      }))
    })
  },
  weibo: {
    tip: '每条微博一块，写「昵称：」「时间：」「微博：」，热评写成「评论：昵称|内容」，可写多行。',
    build: it => ({
      posts: it.map(o => ({
        name: o.name || '', handle: '', time: o.time || '',
        text: o.text || tgSplitPara(o).join(''),
        stats: { repost: 0, comment: 0, like: 0 },
        replies: String(o.replies || '').split('\n').filter(Boolean).map(r => {
          const p = r.split(/[|｜]/); return { name: (p[0] || '').trim(), text: (p[1] || p[0] || '').trim() };
        })
      }))
    })
  },
  chatlog: {
    tip: '不要分块。每行一条消息，格式是「说话人：内容」；时间戳单独一行写成「时间：昨天 23:14」；系统提示写成「系统：对方撤回了一条消息」。',
    build: (it, meta, raw) => {
      const lines = String(raw || '').split('\n').map(x => x.trim()).filter(Boolean);
      const msgs = [];
      let first = '';
      lines.forEach(ln => {
        const m = ln.match(/^([^：:]{1,14})\s*[：:]\s*(.+)$/);
        if (!m) return;
        const who = m[1].trim(), txt = m[2].trim();
        if (/^(时间|时间戳|日期)$/.test(who)) { msgs.push({ t: 'time', v: txt }); return; }
        if (/^(系统|提示)$/.test(who)) { msgs.push({ t: 'sys', v: txt }); return; }
        if (/^(标题|引言|标签|作者|窗口标题)$/.test(who)) return;
        if (!first) first = who;
        msgs.push({ s: who === first ? 'a' : 'b', name: who, v: txt });
      });
      const names = [];
      msgs.forEach(m => { if (m.name && names.indexOf(m.name) < 0) names.push(m.name); });
      return { messages: msgs, aName: names[0] || '', bName: names[1] || '' };
    }
  },
  quote: {
    tip: '每条一块，写「台词：」和「说话人：」。',
    build: it => ({ lines: it.map(o => ({ text: o.text || tgSplitPara(o).join(''), who: o.who || '' })) })
  },
  letter: {
    tip: '每封信一块，写「寄信人：」「收信人：」「日期：」「称呼：」「正文：」（可多行）「落款：」「附言：」。',
    build: it => ({ letters: it.map(o => ({ from: o.from || '', to: o.to || '', date: o.date || '', salut: o.salut || '', body: tgSplitPara(o), sign: o.from || '', ps: o.ps || '' })) })
  },
  moments: {
    tip: '每条朋友圈一块，写「昵称：」「时间：」「正文：」「图片：描述1|描述2」「地点：」「点赞人：甲|乙」，评论写成「评论：昵称|内容」，可多行。',
    build: it => ({
      moments: it.map(o => ({
        name: o.name || '', time: o.time || '', text: o.text || tgSplitPara(o).join(''),
        imgs: tgSplitList(o.imgs), location: o.location || '', likes: tgSplitList(o.likes),
        comments: String(o.replies || '').split('\n').filter(Boolean).map(r => {
          const p = r.split(/[|｜]/); return { name: (p[0] || '').trim(), reply: '', text: (p[1] || p[0] || '').trim() };
        })
      }))
    })
  },
  interview: {
    tip: '第一块写「刊物：」「栏目：」「导语：」，之后每组一块，写「问：」「答：」「受访者：」。',
    build: (it, meta) => ({
      outlet: meta.outlet || '', column: meta.column || '', lead: meta.caption || meta.body || '',
      qa: it.map(o => ({ q: o.q || '', a: o.a || tgSplitPara(o).join(''), who: o.who || '' }))
    })
  },
  news: {
    tip: '第一块写「刊物：」「栏目：」「时间：」「导语：」，之后每段一块，写「小标题：」「正文：」。',
    build: (it, meta) => ({
      outlet: meta.outlet || '', column: meta.column || '', time: meta.time || '',
      lead: meta.caption || '',
      sections: it.map(o => ({ h: o.h || '', body: tgSplitPara(o) }))
    })
  },
  danmu: {
    tip: '第一块写「视频：」「UP主：」，之后每条弹幕一块，写「时间码：」「弹幕：」。',
    build: (it, meta) => ({
      video: meta.video || meta.title || '', up: meta.up || '',
      danmu: it.map(o => ({ t: o.t || o.time || '', text: o.text || tgSplitPara(o).join('') }))
    })
  }
};

/* 行协议问答 */
async function tgAskLoose(sysBase, userBase, g) {
  const spec = TG_LOOSE[g] || TG_LOOSE.essay;
  const sys = [
    sysBase.replace(/【输出硬规则[\s\S]*?(?=【写作要求】)/, ''),
    '',
    '【本次输出格式：纯文本，不要 JSON、不要代码块】',
    '先写一块基本信息，每行一个「键：值」：',
    '标题：……',
    '引言：……',
    '标签：标签一|标签二|标签三',
    '作者：昵称|英文ID|身份',
    '',
    '然后写一行三个减号 --- 作为分隔，接着写正文块。',
    spec.tip,
    '块与块之间同样用一行三个减号 --- 分隔。',
    '除了这些，什么都不要写。'
  ].join('\n');
  const txt = await tgChat([
    { role: 'system', content: sys },
    { role: 'user', content: userBase.replace(/【必须严格遵循的 JSON 结构】[\s\S]*$/, '现在直接开始写。') }
  ], { max: 8000, temp: 0.9 });

  const { meta, items, raw } = tgLooseSplit(txt);
  const a = tgSplitList(meta.author);
  return {
    genre: g,
    title: meta.title || '',
    caption: meta.caption || '',
    tags: tgSplitList(meta.tags),
    author: { name: a[0] || '', handle: a[1] || '', identity: a[2] || '' },
    data: spec.build(items, meta, raw)
  };
}

/* ================================================================
   四、体裁总表（14 种）
================================================================ */
const TG_GENRES = [
  { k: 'essay', n: '随笔', en: 'ESSAY', desc: '正主或旁观者写下的长随笔、观察记、小论', where: 'both' },
  { k: 'diary', n: '日记', en: 'DIARY', desc: '一日一记，琐碎、私密、藏着没说出口的话', where: 'both' },
  { k: 'note', n: '便签', en: 'NOTE', desc: '冰箱上、桌角上、书页里留下的短条', where: 'both' },
  { k: 'qa', n: '问答', en: 'ASKBOX', desc: '匿名提问箱，问得刁钻答得要命', where: 'both' },
  { k: 'forum', n: '论坛体', en: 'FORUM', desc: '贴吧 / 论坛楼中楼，众人围观磕糖', where: 'fan' },
  { k: 'tweet', n: '推特体', en: 'TIMELINE', desc: '推特时间线，含转推与回复', where: 'both' },
  { k: 'weibo', n: '微博体', en: 'WEIBO', desc: '微博正文 + 热评，带话题与数据', where: 'both' },
  { k: 'chatlog', n: '捡手机', en: 'CHATLOG', desc: '捡到的手机，微信 / LINE / iMessage 聊天记录', where: 'both' },
  { k: 'quote', n: '语录', en: 'QUOTES', desc: '被反复引用的名场面台词与摘句', where: 'both' },
  { k: 'letter', n: '书信体', en: 'LETTER', desc: '寄出的、没寄出的、退回来的信', where: 'both' },
  { k: 'moments', n: '朋友圈', en: 'MOMENTS', desc: '九宫格与配文，评论区里全是熟人', where: 'both' },
  { k: 'interview', n: '访谈体', en: 'INTERVIEW', desc: '杂志专访，记者一句句往深了问', where: 'both' },
  { k: 'news', n: '报道体', en: 'DISPATCH', desc: '媒体通稿式的冷静叙述，越冷越疼', where: 'fan' },
  { k: 'danmu', n: '弹幕体', en: 'DANMAKU', desc: '一整条时间轴的弹幕，全是同一批人在刷', where: 'fan' }
];
/* 正主本人能发的体裁（不含论坛体、报道体这类第三方视角） */
const TG_OWNER_GENRES = ['moments', 'weibo', 'tweet', 'diary', 'note', 'letter', 'chatlog', 'quote', 'essay'];

const TG_SCHEMA = {
  essay: `{"genre":"essay","title":"标题","author":{"name":"发帖昵称","handle":"英文或拼音ID","identity":"如：随笔太太/路人/正主本人"},"caption":"发在广场上的引言，60-110字","tags":["标签1","标签2","标签3"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"sections":[{"h":"小标题","body":["段落一","段落二"]}]}}`,
  diary: `{"genre":"diary","title":"日记本名","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"entries":[{"date":"3月14日 周四","weather":"阴转小雨","mood":"心情词","body":["段落一","段落二"],"ps":"附言一句"}]}}`,
  note: `{"genre":"note","title":"便签集名","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"notes":[{"tag":"贴在哪里，如 冰箱门","title":"便签抬头","body":"便签正文，40-90字","from":"署名"}]}}`,
  qa: `{"genre":"qa","title":"提问箱标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"items":[{"q":"匿名提问，20-45字","a":"回答，60-140字"}]}}`,
  forum: `{"genre":"forum","title":"帖子标题","author":{"name":"楼主昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"board":"版块名","view":0,"time":"2月11日 22:41","floors":[{"user":"用户名","time":"22:43","text":"发言内容，30-120字","like":0,"reply":0}]}}`,
  tweet: `{"genre":"tweet","title":"时间线标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"tweets":[{"name":"发推人","handle":"英文ID","time":"3h","text":"推文正文，40-140字","stats":{"reply":0,"repost":0,"like":0},"replies":[{"name":"回复者","handle":"ID","text":"回复，20-60字"}]}]}}`,
  weibo: `{"genre":"weibo","title":"标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"posts":[{"name":"博主名","handle":"来自 iPhone 客户端","time":"今天 21:07","text":"微博正文，含#话题#，60-160字","stats":{"repost":0,"comment":0,"like":0},"replies":[{"name":"评论者","handle":"","text":"热评，20-60字"}]}]}}`,
  chatlog: `{"genre":"chatlog","title":"这条帖子的标题","author":{"name":"发帖昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"skin":"wechat","aName":"左边那个人的名字","bName":"右边那个人的名字","title":"聊天窗口顶部显示的名字","messages":[{"t":"time","v":"昨天 23:14"},{"s":"a","v":"一句话"},{"s":"b","k":"voice","v":"语音转成的文字","d":7},{"s":"a","k":"revoke"},{"t":"sys","v":"系统提示文字"}]}}`,
  quote: `{"genre":"quote","title":"语录集标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"lines":[{"text":"台词或摘句，20-70字","who":"说这句话的人"}]}}`,
  letter: `{"genre":"letter","title":"信件集标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"letters":[{"from":"寄信人","to":"收信人","date":"某年某月某日","salut":"称呼语","body":["段落一","段落二"],"sign":"落款","ps":"附言，可空"}]}}`,
  moments: `{"genre":"moments","title":"标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"moments":[{"name":"发这条的人","time":"3小时前","text":"配文，30-120字","imgs":["用文字描述这张图拍了什么"],"location":"定位，可空","likes":["点赞的人"],"comments":[{"name":"评论者","reply":"回复给谁，没有就留空","text":"评论内容"}]}]}}`,
  interview: `{"genre":"interview","title":"专访标题","author":{"name":"记者昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"outlet":"刊物名","column":"栏目名","lead":"导语，100-160字","qa":[{"q":"记者提问，20-50字","a":"受访者回答，80-200字","who":"回答的人"}]}}`,
  news: `{"genre":"news","title":"新闻标题","author":{"name":"记者昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"outlet":"媒体名","column":"版面","time":"发稿时间","lead":"导语100-150字","sections":[{"h":"小标题","body":["段落一","段落二"]}]}}`,
  danmu: `{"genre":"danmu","title":"标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":0,"comment":0,"repost":0,"collect":0},"data":{"video":"视频标题","up":"UP主名","danmu":[{"t":"00:12","text":"弹幕内容，6-40字"}]}}`
};

const TG_AMOUNT = {
  essay: 'sections 必须有 5 到 7 个小节，每小节 body 至少 2 段、每段 90 到 170 字。',
  diary: 'entries 必须有 4 到 6 篇日记，每篇 body 至少 3 段、每段 80 到 150 字。',
  note: 'notes 必须有 6 到 9 张便签，位置各不相同。',
  qa: 'items 必须有 7 到 10 组问答，问题的攻击性与温度要有高低差。',
  forum: 'floors 必须有 14 到 20 层：要有考据党贴时间线、有磕疯了的、有理性分析的、有跑题的、有被回怼的、有中途换话题的。',
  tweet: 'tweets 必须有 5 到 8 条，每条至少 2 条 replies，其中至少一条推文是转推或引用别人。',
  weibo: 'posts 必须有 4 到 6 条，每条至少 3 条 replies，热评之间要能接上话。',
  chatlog: 'messages 必须有 40 到 70 条，穿插 4 到 6 个时间戳。',
  quote: 'lines 必须有 10 到 14 条，出处要分散在不同场景。',
  letter: 'letters 必须有 3 到 5 封，至少有一封是没寄出去或被退回的，每封 body 至少 3 段。',
  moments: 'moments 必须有 5 到 8 条，至少 3 条带 imgs，评论区里要出现互相回复。',
  interview: 'qa 必须有 8 到 12 组，记者要有追问、有被回避的问题、有一次冷场。',
  news: 'sections 必须有 5 到 7 段，语气克制、只陈述、不抒情。',
  danmu: 'danmu 必须有 22 到 34 条，时间码递增，要有重复刷屏的梗、有前后呼应的、有突然安静下来的一段。'
};

/* 每种体裁的主数组键 */
const TG_ARRKEY = {
  essay: 'sections', diary: 'entries', note: 'notes', qa: 'items', forum: 'floors',
  tweet: 'tweets', weibo: 'posts', chatlog: 'messages', quote: 'lines',
  letter: 'letters', moments: 'moments', interview: 'qa', news: 'sections', danmu: 'danmu'
};
/* 收货下限：低于这个数就重写 */
const TG_MINLEN = {
  essay: 3, diary: 2, note: 4, qa: 4, forum: 7, tweet: 3, weibo: 2,
  chatlog: 14, quote: 6, letter: 2, moments: 3, interview: 5, news: 3, danmu: 12
};

function tgGenreOf(k) { return TG_GENRES.find(g => g.k === k) || TG_GENRES[0]; }
function tgGenreName(k) { return tgGenreOf(k).n; }

/* ================================================================
   五、体裁抽签：一批之内绝不重复
================================================================ */
let _tgDeck = [];
function tgShuffle(a) {
  const x = a.slice();
  for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
  return x;
}
/* 发牌：连续调用不会很快重复；pool 用完自动重新洗牌 */
function tgDrawGenre(pool) {
  const src = (pool && pool.length) ? pool : TG_GENRES.map(g => g.k);
  _tgDeck = _tgDeck.filter(k => src.indexOf(k) >= 0);
  if (!_tgDeck.length) _tgDeck = tgShuffle(src);
  return _tgDeck.pop();
}
/* 一次要 n 个互不相同的体裁 */
function tgPickGenres(n, pref, pool) {
  const src = (pool && pool.length) ? pool : TG_GENRES.map(g => g.k);
  if (pref && pref !== 'all' && pref !== 'mix') return new Array(n).fill(pref);
  const out = [];
  let bag = tgShuffle(src);
  while (out.length < n) {
    if (!bag.length) bag = tgShuffle(src);
    const k = bag.pop();
    if (out.indexOf(k) < 0 || out.length >= src.length) out.push(k);
  }
  return out;
}

/* ================================================================
   六、系统提示词
================================================================ */
function tgSysPrompt(extra) {
  return [
    '你是「糖罐」——一个中文同人 CP 社区的内容生成引擎。你的全部输出只能是一个 JSON 对象。',
    '',
    '【输出硬规则，违反即失败】',
    '1. 第一个字符必须是 {，最后一个字符必须是 }。禁止 markdown 代码块、禁止任何解释、禁止注释、禁止在 JSON 前后写字。',
    '2. 所有键名和字符串一律用英文双引号。字符串内部需要换行时写成 \\n，绝不能出现真实换行。',
    '3. 顶层键必须与给定 schema 完全一致，不增不减不改名。数字字段填纯数字，不加引号、不加单位、不写区间。',
    '4. 简体中文写作。禁止使用任何 emoji、颜文字、表情符号、星号强调、markdown 语法。',
    '5. 内容必须写满写实，不允许一句话敷衍，不允许出现「省略」「以此类推」「示例」「等等」这类占位表述。',
    '6. 如果内容很长，宁可减少修辞也要把 JSON 写完整、把括号闭合。绝不能中途截断。',
    '',
    '【写作要求】',
    'A. 你要写的是「让人磕到」的同人内容：具体的细节、大量的留白、没说出口的心思、日常里的钝刀子。不要空洞抒情，不要总结陈词，不要在结尾升华。',
    'B. 严格贴合给定人设，绝不 OOC：说话方式、自称与称呼、性格边界、关系距离、知识范围都要吻合。人设里写明「绝不会做」的事，一次都不许出现。',
    'C. 昵称、用户名、时间、点赞数、评论数等一切社区数据都由你编造，要像真实社区里长出来的，不要用「用户A」「网友1」这类占位名。',
    'D. 不同发言者要有明显不同的语气、句长和用词习惯，不要所有人一个腔调。',
    'E. 允许出现不完整的句子、被打断的话、答非所问、突然的沉默。真实感优先于工整。',
    extra || ''
  ].filter(Boolean).join('\n');
}

/* ================================================================
   七、把圈子压成资料卡喂给模型
================================================================ */
function tgCircleBrief(c, deep) {
  if (!c) return '';
  const L = [];
  const side = (p, tag) => {
    if (!p) return;
    L.push(`【${tag}】${p.name || '未命名'}` +
      [p.role && '身份：' + p.role, p.gender && '性别：' + p.gender, p.age && '年龄：' + p.age,
      p.species && '设定：' + p.species, (p.tags || []).length && '标签：' + p.tags.join('、')]
        .filter(Boolean).map(s => '｜' + s).join(''));
    const f = deep && deep[p.uid];
    if (f) {
      const put = (k, v) => { if (v && String(v).trim()) L.push(`  · ${k}：${String(v).slice(0, 460)}`); };
      put('人设', f.prompt || f.desc);
      put('外貌', f.appearance);
      put('穿着', f.outfit);
      put('性格', (f.traits || []).join('、'));
      put('说话方式', f.speechStyle);
      put('口头禅', (f.catchphrases || []).join('、'));
      put('喜欢', (f.likes || []).join('、'));
      put('厌恶', (f.dislikes || []).join('、'));
      put('害怕', f.fears);
      put('背景', f.backstory);
      put('当前情境', f.scenario);
      put('关系', [f.relation, f.relationDetail].filter(Boolean).join(' / '));
      put('对对方的称呼', f.callUser);
      put('绝不会做', (f.neverList || []).join('、'));
    }
  };
  L.push(`圈名：${c.name || '未命名'}`);
  if (c.intro) L.push(`圈子简介：${c.intro}`);
  if ((c.tags || []).length) L.push(`圈子标签：${c.tags.join('、')}`);
  side(c.pairA, '左位');
  side(c.pairB, '右位');
  const sel = (c.style && c.style.sel) || {};
  const styleTxt = Object.keys(sel).map(k => (Array.isArray(sel[k]) ? sel[k].join('、') : sel[k])).filter(Boolean).join(' ｜ ');
  if (styleTxt) L.push(`文风设定：${styleTxt}`);
  if (c.style && c.style.custom) {
    const cu = Object.values(c.style.custom).filter(Boolean).join(' ｜ ');
    if (cu) L.push(`文风补充：${cu}`);
  }
  if (c.aiData) {
    const a = c.aiData;
    if (a.hook) L.push(`核心钩子：${a.hook}`);
    if (a.setting) L.push(`设定：${a.setting}`);
    if (a.dynamic) L.push(`关系动力：${a.dynamic}`);
  }
  if (c.lore && c.lore.summary) L.push(`圈内已确立的设定：${String(c.lore.summary).slice(0, 500)}`);
  return L.join('\n');
}

/* 读取角色库全字段（只喂模型，绝不渲染到界面） */
function tgLoadCharsDeep() {
  return new Promise(res => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; res({}); } }, 2500);
    try {
      const req = indexedDB.open('LunaCharDB');
      req.onsuccess = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('chars')) { clearTimeout(t); done = true; return res({}); }
        const r = db.transaction('chars', 'readonly').objectStore('chars').getAll();
        r.onsuccess = () => {
          const map = {};
          (r.result || []).forEach(c => { map['c' + c.id] = c; });
          clearTimeout(t); done = true; res(map);
        };
        r.onerror = () => { clearTimeout(t); done = true; res({}); };
      };
      req.onerror = () => { clearTimeout(t); done = true; res({}); };
    } catch (e) { clearTimeout(t); done = true; res({}); }
  });
}

/* ================================================================
   八、捡手机专用规则（重点重写：不再是一问一答）
================================================================ */
const TG_CHAT_SKINS = [
  { k: 'wechat', n: '微信' }, { k: 'line', n: 'LINE' },
  { k: 'imessage', n: 'iMessage' }, { k: 'qq', n: 'QQ' }
];
function tgChatlogRules() {
  return [
    '【捡手机的写法，这一条最重要，请逐条照做】',
    '1. 绝对不要写成「一问一答、一人一句」的乒乓球式对话。那是最假的写法。',
    '2. 一方可以连发 3 到 6 条短消息（想到什么发什么、改口、补充、自己接自己的话），另一方隔很久才回一句。',
    '3. 允许出现：只有两三个字的消息、只有一个标点的消息、发出去又撤回、已读不回之后对方追问、答非所问、把话题岔开、假装没看见。',
    '4. 时间戳要制造真实的节奏：凌晨两点连发五条，然后跳到第二天中午才有回音；也可以中间隔一周。',
    '5. 消息类型要混着用，不要全是纯文字：',
    '   · {"s":"a","k":"voice","v":"语音里说的话","d":9} 语音条，d 是秒数（1 到 60）',
    '   · {"s":"a","k":"img","v":"用一句话描述这张图拍到了什么"} 图片',
    '   · {"s":"a","k":"quote","q":"被引用的那句原话","v":"针对它说的话"} 引用回复',
    '   · {"s":"a","k":"revoke"} 撤回了一条消息（不写内容，就是要让人猜）',
    '   · {"s":"a","k":"transfer","v":"转账留言","amt":"200.00"} 转账',
    '   · {"s":"a","k":"redpack","v":"红包封面上的字"} 红包',
    '   · {"s":"a","k":"call","v":"通话时长 02:47"} 或 v 写「已取消」「对方未接听」',
    '   · {"s":"a","k":"loc","v":"地点名"} 位置',
    '   · {"s":"a","k":"file","v":"文件名.docx"} 文件',
    '   · {"t":"sys","v":"对方开启了朋友验证"} 系统提示',
    '   · {"t":"time","v":"昨天 23:14"} 时间戳',
    '6. 磕点要藏在细节里：改了三次才发出去的措辞、深夜发完立刻撤回、转账金额是某个纪念日、语音只有 2 秒、备注名被改过。不要让两个人把感情说破。',
    '7. 一整段对话里至少要出现 3 次「撤回 / 已读不回 / 突然沉默 / 说到一半停住」中的任意一种。',
    '8. aName 是左边（对方）那个人，bName 是右边（自己）那个人。s 只能是 "a" 或 "b"。',
    '9. skin 从 wechat / line / imessage / qq 里挑一个，本次请挑：'
  ].join('\n');
}

/* ================================================================
   九、统一生成入口
================================================================ */
const tgRnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const tgPick = a => a[Math.floor(Math.random() * a.length)];

const TG_VOICES = [
  '正主之一亲自发布（他自己不觉得这是在秀恩爱）',
  '正主的另一位发布（语气和上一位截然不同）',
  '圈内产粮的太太发布（写手视角，爱用细节）',
  '路人围观发布（不磕，但被戳到了）',
  '同担粉丝发布（激动到语无伦次）',
  '考据党发布（拿证据说话，冷静到可怕）',
  '当事人身边的第三个人发布（朋友 / 同事 / 家人视角）',
  '多年后回看的人发布（带着后见之明的克制）'
];

/**
 * opt = {
 *   circle,          // 圈子对象，可空
 *   genre,           // 体裁 key
 *   deep,            // 角色库全字段
 *   voice,           // 视角描述，可空（默认随机）
 *   scope,           // 'plaza' | 'circle' | 'owner'
 *   ownerName,       // scope=owner 时，由谁来发
 *   extra,           // 额外要求文本
 *   maxTokens
 * }
 */
async function tgGenPost(opt) {
  opt = opt || {};
  const g = opt.genre || tgDrawGenre();
  const spec = tgGenreOf(g);
  const circle = opt.circle || null;
  const voice = opt.voice || tgPick(TG_VOICES);
  const skin = tgPick(TG_CHAT_SKINS).k;

  let scene;
  if (circle) {
    scene = '【本次要写的 CP 资料（来自用户的笔坊存档，必须严格遵守，绝不 OOC）】\n' + tgCircleBrief(circle, opt.deep);
  } else {
    scene = [
      '【本次没有指定 CP，请你自己原创一对足够让人上头的 CP】',
      '要求：两人有明确姓名、身份，以及一个具体的关系张力（旧识重逢 / 师徒错位 / 共犯 / 隔着身份的靠近 / 单向的照顾 / 互相误解了很多年）。',
      '世界观自由（现代都市、民国、校园、悬疑、幻想、职场、江湖皆可），但必须落到具体的地名、物件、职业细节上。',
      '这一对要和常见套路拉开距离，不要写成「霸道总裁与小助理」这类模板。'
    ].join('\n');
  }

  const ownerLine = opt.scope === 'owner'
    ? `【本条内容由正主「${opt.ownerName || (circle && circle.pairA && circle.pairA.name) || ''}」本人发布】\n他不是在发同人，他就是在过自己的日子。评论区里会有另一位正主出现，以及一群围观的人。另一位正主的发言要极其克制、极其像本人。`
    : '';

  const user = [
    scene,
    ownerLine,
    '',
    `【体裁】${spec.n}（${spec.desc}）`,
    `【视角】${voice}`,
    `【产量】${TG_AMOUNT[g]}`,
    g === 'chatlog' ? tgChatlogRules() + skin : '',
    opt.extra || '',
    '【额外要求】caption 是这条帖子发在社区里的引言，要有钩子、不要剧透；tags 给 3 到 5 个中文标签，不带井号；stats 里的数字要符合社区体感（几百到几万不等，且四个数之间互相协调：收藏一般小于点赞，转发一般小于评论）。',
    circle ? '' : '另外，请在顶层额外增加三个键："cpA" 和 "cpB" 是你原创的两个人的名字，"cpWorld" 用一句话交代世界观与关系张力。',
    '',
    '【必须严格遵循的 JSON 结构】',
    TG_SCHEMA[g],
    '',
    '现在直接输出 JSON。'
  ].filter(Boolean).join('\n');

  const sys = tgSysPrompt();
  const KEY = TG_ARRKEY[g];
  const MIN = TG_MINLEN[g] || 3;
  let best = null;

  /* 通道一：严格 JSON，两轮 */
  for (let round = 0; round < 2; round++) {
    try {
      const j = await tgAskJSON(sys, user + (round ? '\n\n（上一次内容太单薄，这一次务必写满数量要求，并把 JSON 完整闭合。）' : ''),
        { max: opt.maxTokens || 8000, rounds: 2 });
      const post = tgNormalize(j, g, circle, opt);
      const len = ((post.data[KEY] || []).length);
      if (!best || len > ((best.data[KEY] || []).length)) best = post;
      if (len >= MIN) return post;
    } catch (e) {
      if (String(e.message).indexOf('NO_API') === 0) throw e;
    }
  }

  /* 通道二：行协议兜底 */
  try {
    const j2 = await tgAskLoose(sys, user, g);
    const post2 = tgNormalize(j2, g, circle, opt);
    const len2 = ((post2.data[KEY] || []).length);
    if (!best || len2 > ((best.data[KEY] || []).length)) best = post2;
    if (len2 >= Math.max(2, Math.floor(MIN / 2))) return best;
  } catch (e) { }

  if (best && (best.data[KEY] || []).length) return best;
  throw new Error('EMPTY_CONTENT');
}

/* ================================================================
   十、归一化：任何字段缺失都补齐，保证渲染不炸
================================================================ */
function tgNormalize(j, g, circle, opt) {
  opt = opt || {};
  j = j || {};
  if (Array.isArray(j)) j = { data: { [TG_ARRKEY[g]]: j } };
  let d = j.data || j.content || j.body || {};
  if (Array.isArray(d)) d = { [TG_ARRKEY[g]]: d };
  const a = j.author || {};
  const nm = a.name || j.name || j.nickname || '匿名同好';

  const post = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    genre: TG_GENRES.some(x => x.k === (j.genre || g)) ? (j.genre || g) : g,
    title: String(j.title || j.headline || '无题').slice(0, 60),
    author: {
      name: String(nm).slice(0, 24),
      handle: String(a.handle || a.id || ('tg_' + Math.random().toString(36).slice(2, 8))).slice(0, 24),
      identity: String(a.identity || a.role || '圈内同好').slice(0, 20)
    },
    caption: String(j.caption || j.intro || j.lead || '').slice(0, 300),
    tags: Array.isArray(j.tags) ? j.tags.map(t => String(typeof t === 'string' ? t : (t && t.name) || '').replace(/^#|#$/g, '').trim()).filter(Boolean).slice(0, 5) : [],
    stats: {
      like: tgNum(j.stats && j.stats.like, tgRnd(320, 9800)),
      comment: tgNum(j.stats && j.stats.comment, tgRnd(40, 1200)),
      repost: tgNum(j.stats && j.stats.repost, tgRnd(20, 800)),
      collect: tgNum(j.stats && j.stats.collect, tgRnd(60, 3000))
    },
    view: tgRnd(2400, 186000),
    circleId: circle ? circle.id : null,
    circleName: circle ? circle.name : null,
    scope: opt.scope || 'plaza',
    ownerName: opt.ownerName || null,
    cpA: circle ? ((circle.pairA && circle.pairA.name) || '') : (j.cpA || ''),
    cpB: circle ? ((circle.pairB && circle.pairB.name) || '') : (j.cpB || ''),
    cpWorld: circle ? (circle.intro || '') : (j.cpWorld || ''),
    comments: [],
    commentSeed: false,
    data: d,
    createdAt: Date.now()
  };

  /* 主数组容错：模型把数组塞在别处也能救 */
  const arrOf = TG_ARRKEY[post.genre];
  if (arrOf && !Array.isArray(d[arrOf])) {
    const cand = Object.keys(d).find(k => Array.isArray(d[k]) && d[k].length);
    if (cand) d[arrOf] = d[cand];
    else if (Array.isArray(j[arrOf])) d[arrOf] = j[arrOf];
    else d[arrOf] = [];
  }

  /* 逐体裁清洗 */
  const S = v => String(v == null ? '' : v).replace(/\*\*/g, '').trim();
  const arr = d[arrOf] || [];

  if (post.genre === 'essay' || post.genre === 'news') {
    d[arrOf] = arr.map(s => {
      if (typeof s === 'string') return { h: '', body: [s] };
      return { h: S(s.h || s.title || s.heading), body: tgLines(s.body || s.text || s.content) };
    }).filter(s => s.body.length);
    if (post.genre === 'news') { d.outlet = S(d.outlet); d.column = S(d.column); d.lead = S(d.lead || post.caption); d.time = S(d.time); }
  }
  else if (post.genre === 'diary') {
    d.entries = arr.map(e => ({
      date: S(e.date || e.day || '某日'), weather: S(e.weather), mood: S(e.mood),
      body: tgLines(e.body || e.text || e.content), ps: S(e.ps || e.postscript)
    })).filter(e => e.body.length);
  }
  else if (post.genre === 'note') {
    d.notes = arr.map(n => (typeof n === 'string'
      ? { tag: '', title: '', body: n, from: '' }
      : { tag: S(n.tag || n.place), title: S(n.title || n.head), body: S(n.body || n.text || n.content), from: S(n.from || n.sign) }))
      .filter(n => n.body);
  }
  else if (post.genre === 'qa' || post.genre === 'interview') {
    const src = post.genre === 'interview' ? (d.qa || arr) : arr;
    const list = src.map(it => ({ q: S(it.q || it.question), a: S(it.a || it.answer), who: S(it.who || it.name) }))
      .filter(it => it.q || it.a);
    if (post.genre === 'interview') { d.qa = list; d.outlet = S(d.outlet); d.column = S(d.column); d.lead = S(d.lead || post.caption); }
    else d.items = list;
  }
  else if (post.genre === 'forum') {
    d.board = S(d.board || '同人区'); d.time = S(d.time); d.view = tgNum(d.view, tgRnd(3000, 90000));
    d.floors = arr.map(f => (typeof f === 'string'
      ? { user: '匿名', time: '', text: f, like: 0, reply: 0 }
      : { user: S(f.user || f.name || '匿名'), time: S(f.time), text: S(f.text || f.content), like: tgNum(f.like, tgRnd(0, 400)), reply: tgNum(f.reply, tgRnd(0, 40)) }))
      .filter(f => f.text);
  }
  else if (post.genre === 'tweet' || post.genre === 'weibo') {
    const key = post.genre === 'tweet' ? 'tweets' : 'posts';
    d[key] = arr.map(t => ({
      name: S(t.name || t.user), handle: S(t.handle), time: S(t.time),
      text: S(t.text || t.content),
      stats: {
        reply: tgNum(t.stats && t.stats.reply, tgRnd(10, 900)),
        repost: tgNum(t.stats && t.stats.repost, tgRnd(10, 2000)),
        comment: tgNum(t.stats && t.stats.comment, tgRnd(20, 1600)),
        like: tgNum(t.stats && t.stats.like, tgRnd(100, 30000))
      },
      quote: t.quote ? { name: S(t.quote.name), text: S(t.quote.text) } : null,
      replies: (Array.isArray(t.replies) ? t.replies : []).map(r => (typeof r === 'string'
        ? { name: '', text: r } : { name: S(r.name), handle: S(r.handle), text: S(r.text || r.content) })).filter(r => r.text)
    })).filter(t => t.text);
  }
  else if (post.genre === 'moments') {
    d.moments = arr.map(m => ({
      name: S(m.name), time: S(m.time), text: S(m.text || m.content),
      imgs: (Array.isArray(m.imgs) ? m.imgs : (m.imgs ? [m.imgs] : [])).map(S).filter(Boolean).slice(0, 9),
      location: S(m.location), likes: (Array.isArray(m.likes) ? m.likes : []).map(S).filter(Boolean),
      comments: (Array.isArray(m.comments) ? m.comments : []).map(c => (typeof c === 'string'
        ? { name: '', reply: '', text: c } : { name: S(c.name), reply: S(c.reply || c.to), text: S(c.text || c.content) })).filter(c => c.text)
    })).filter(m => m.text || m.imgs.length);
  }
  else if (post.genre === 'quote') {
    d.lines = arr.map(l => (typeof l === 'string' ? { text: l, who: '' } : { text: S(l.text || l.line), who: S(l.who || l.name) })).filter(l => l.text);
  }
  else if (post.genre === 'letter') {
    d.letters = arr.map(l => ({
      from: S(l.from), to: S(l.to), date: S(l.date), salut: S(l.salut || l.salutation),
      body: tgLines(l.body || l.text || l.content), sign: S(l.sign || l.from), ps: S(l.ps)
    })).filter(l => l.body.length);
  }
  else if (post.genre === 'danmu') {
    d.video = S(d.video || post.title); d.up = S(d.up);
    d.danmu = arr.map((x, i) => (typeof x === 'string'
      ? { t: '', text: x } : { t: S(x.t || x.time), text: S(x.text || x.content) })).filter(x => x.text);
  }
  else if (post.genre === 'chatlog') {
    d.skin = TG_CHAT_SKINS.some(s => s.k === d.skin) ? d.skin : tgPick(TG_CHAT_SKINS).k;
    d.aName = S(d.aName) || post.cpA || '对方';
    d.bName = S(d.bName) || post.cpB || '我';
    d.title = S(d.title) || d.aName;
    const KINDS = ['voice', 'img', 'quote', 'revoke', 'transfer', 'redpack', 'call', 'loc', 'file', 'sticker'];
    let firstName = '';
    d.messages = (d.messages || []).map(m => {
      if (typeof m === 'string') {
        const mm = m.match(/^([^：:]{1,14})\s*[：:]\s*(.+)$/);
        if (mm) { if (!firstName) firstName = mm[1]; return { s: mm[1] === firstName ? 'a' : 'b', v: mm[2] }; }
        return { s: 'a', v: m };
      }
      // 时间 / 系统
      const t = m.t || m.type;
      if (t === 'time' || t === 'sys' || t === 'system') return { t: t === 'system' ? 'sys' : t, v: S(m.v || m.text || m.content) };
      // 阵营
      let s = m.s || m.side || m.role || m.who;
      if (s === 'me' || s === 'right' || s === 'b' || s === 'B') s = 'b';
      else if (s === 'them' || s === 'left' || s === 'a' || s === 'A') s = 'a';
      else {
        const nn = S(m.name || s);
        if (!firstName && nn) firstName = nn;
        s = (nn && nn === firstName) ? 'a' : (nn ? 'b' : 'a');
      }
      const k = KINDS.indexOf(m.k || m.kind) >= 0 ? (m.k || m.kind) : null;
      const o = { s, v: S(m.v || m.text || m.content) };
      if (k) o.k = k;
      if (k === 'voice') o.d = Math.max(1, Math.min(60, tgNum(m.d, tgRnd(2, 22))));
      if (k === 'quote') o.q = S(m.q || m.quote);
      if (k === 'transfer') o.amt = S(m.amt || m.amount) || (tgRnd(1, 999) + '.00');
      if (k === 'revoke') o.v = '';
      return o;
    }).filter(m => m.t === 'time' || m.t === 'sys' || m.k === 'revoke' || m.v);
  }

  if (!post.cpA) post.cpA = (post.genre === 'chatlog' && d.aName) || '未名';
  if (!post.cpB) post.cpB = (post.genre === 'chatlog' && d.bName) || '未名';
  if (!post.caption) post.caption = post.title;
  if (!post.tags.length) post.tags = ['磕糖现场', post.cpA + '×' + post.cpB];
  post.data = d;
  return post;
}

function tgNum(v, dft) {
  if (typeof v === 'number' && isFinite(v)) return Math.round(v);
  if (typeof v === 'string') {
    const m = v.replace(/[,，\s]/g, '').match(/(\d+(\.\d+)?)\s*([wW万kK千]?)/);
    if (m) {
      let n = parseFloat(m[1]);
      if (/[wW万]/.test(m[3])) n *= 10000;
      if (/[kK千]/.test(m[3])) n *= 1000;
      if (isFinite(n)) return Math.round(n);
    }
  }
  return dft;
}
function tgLines(v) {
  const out = [];
  const push = s => String(s == null ? '' : s).split(/\n+/).forEach(x => { const t = x.trim(); if (t) out.push(t); });
  if (Array.isArray(v)) v.forEach(x => push(typeof x === 'string' ? x : ((x && (x.text || x.content)) || '')));
  else if (typeof v === 'string') push(v);
  return out;
}

/* 数字好看化 */
function tgKn(n) {
  n = Number(n) || 0;
  if (n >= 100000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + '万';
  if (n >= 10000) return (n / 10000).toFixed(2).replace(/0$/, '').replace(/\.$/, '') + '万';
  return String(n);
}