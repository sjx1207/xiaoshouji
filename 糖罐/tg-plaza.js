/* ================================================================
   糖罐 TANGGUAN — tg-plaza.js
   广场：AI 内容工厂 + 信息流 + 长图查看器 + 存入相册
   依赖：tg-core.js（存储 / 路由 / UI 小件）、tg-cardkit.js（长图渲染）
================================================================ */

/* ================================================================
   〇、补充图标（依旧全部手绘 SVG，零 emoji）
================================================================ */
Object.assign(TG_ICONS, {
  refresh: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 12a8 8 0 1 1-2.4-5.7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M20 3.6V9h-5.4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.4v11.4M7.4 10.6 12 15.2l4.6-4.6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.4 17.4v1.8a1.8 1.8 0 0 0 1.8 1.8h11.6a1.8 1.8 0 0 0 1.8-1.8v-1.8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 20.4S3.6 15.4 3.6 9.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8.4 2.6c0 5.8-8.4 10.8-8.4 10.8z" fill="currentColor" opacity=".9"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none"><path d="m12 3.6 2.6 5.6 6.1.7-4.5 4.2 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.9l6.1-.7z" fill="currentColor" opacity=".85"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none"><circle cx="5.5" cy="12" r="1.9" fill="currentColor"/><circle cx="12" cy="12" r="1.9" fill="currentColor"/><circle cx="18.5" cy="12" r="1.9" fill="currentColor"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.6 11.4 20.4 4l-7.4 16.4-2.2-6.6z" fill="currentColor" opacity=".92"/><path d="m10.8 13.8 9.6-9.8" stroke="#fff" stroke-width="1.4" opacity=".5"/></svg>',
  robot: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.8" y="7.4" width="16.4" height="12" rx="4.2" fill="currentColor" opacity=".92"/><circle cx="9" cy="13.4" r="1.9" fill="#fff"/><circle cx="15" cy="13.4" r="1.9" fill="#fff"/><path d="M12 3.2v3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="2.6" r="1.6" fill="currentColor"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor" opacity=".9"/><rect x="13" y="4" width="7" height="7" rx="2" fill="currentColor" opacity=".5"/><rect x="4" y="13" width="7" height="7" rx="2" fill="currentColor" opacity=".5"/><rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor" opacity=".9"/></svg>'
});

/* ================================================================
   一、AI 通道（兼容市面上全部 OpenAI 协议模型：GPT / Claude 中转 /
   Gemini 中转 / DeepSeek / Kimi / 通义 / 智谱 / 本地 Ollama…）
   —— 三层保险：请求重试 → JSON 修复 → 本地兜底模板，永不白屏
================================================================ */
function tgApiCfg() {
  const cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  return { base: (cur.baseUrl || '').replace(/\/+$/, ''), key: cur.apiKey || '', model: localStorage.getItem('luna_api_model') || '' };
}
function tgHasApi() { const c = tgApiCfg(); return !!(c.base && c.key); }

/* 抽取模型返回的纯文本：兼容 content 为字符串 / 数组 / 带 reasoning 的多种形态 */
function tgPickText(d) {
  if (!d) return '';
  const ch = (d.choices && d.choices[0]) || {};
  let m = ch.message || ch.delta || {};
  let c = m.content;
  if (typeof c === 'string' && c.trim()) return c;
  if (Array.isArray(c)) {
    const s = c.map(x => (typeof x === 'string' ? x : (x && (x.text || x.content) || ''))).join('');
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
    temperature: opt.temp == null ? 0.92 : opt.temp,
    max_tokens: opt.max || 4000,
    stream: false
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opt.timeout || 120000);
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

/* —— 极其宽容的 JSON 解析：能救则救 —— */
function tgJSON(raw) {
  if (!raw) return null;
  let s = String(raw);
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '');
  s = s.replace(/```[a-zA-Z]*\s*/g, '').replace(/```/g, '');
  s = s.replace(/^\uFEFF/, '').trim();
  // 取最外层 { } 或 [ ]
  const oi = s.indexOf('{'), oj = s.lastIndexOf('}');
  const ai = s.indexOf('['), aj = s.lastIndexOf(']');
  let cut = s;
  if (oi !== -1 && oj > oi && (ai === -1 || oi < ai)) cut = s.slice(oi, oj + 1);
  else if (ai !== -1 && aj > ai) cut = s.slice(ai, aj + 1);
  const tries = [
    x => x,
    x => x.replace(/,\s*([}\]])/g, '$1'),                                  // 尾逗号
    x => x.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'"),// 中文引号
    x => x.replace(/(\r\n|\n|\r)/g, '\\n'),                                // 串内真换行
    x => x.replace(/,\s*([}\]])/g, '$1').replace(/[\u201C\u201D]/g, '"').replace(/(\r\n|\n|\r)/g, '\\n'),
    x => { // 截断补全：补齐未闭合的括号
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
    }
  ];
  for (const f of tries) {
    try { const v = JSON.parse(f(cut)); if (v && typeof v === 'object') return v; } catch (e) { }
  }
  return null;
}

/* 要 JSON 就一定拿到 JSON：最多三轮，逐轮加强约束 */
async function tgAskJSON(sys, user, opt) {
  opt = opt || {};
  let lastErr = null;
  for (let i = 0; i < 3; i++) {
    try {
      const extra = i === 0 ? '' :
        '\n\n【上一次输出无法被解析。这一次务必：直接以 { 开头、以 } 结尾，不要任何解释、不要代码块标记、字符串内换行写成 \\n。】';
      const txt = await tgChat([
        { role: 'system', content: sys + extra },
        { role: 'user', content: user + (i ? '\n\n（重申：只输出 JSON 本体）' : '') }
      ], { max: opt.max || 4000, temp: i ? 0.75 : 0.95 });
      const j = tgJSON(txt);
      if (j) return j;
      lastErr = new Error('PARSE');
    } catch (e) { lastErr = e; if (String(e.message).indexOf('NO_API') === 0) throw e; }
  }
  throw lastErr || new Error('PARSE');
}

/* ================================================================
   二、体裁规格（九种，全部带 schema 与产量下限）
================================================================ */
const TG_GENRES = [
  { k: 'essay', n: '随笔', en: 'ESSAY', desc: '正主或旁观者写下的长随笔、观察记、小论' },
  { k: 'diary', n: '日记', en: 'DIARY', desc: '一日一记，琐碎、私密、藏着没说出口的话' },
  { k: 'note', n: '便签', en: 'NOTE', desc: '冰箱上、桌角上、书页里留下的短条' },
  { k: 'qa', n: '问答', en: 'ASKBOX', desc: '匿名提问箱，问得刁钻答得要命' },
  { k: 'forum', n: '论坛体', en: 'FORUM', desc: '贴吧 / 论坛楼中楼，众人围观磕糖' },
  { k: 'tweet', n: '推特体', en: 'TWEET', desc: '推特时间线，含转推与回复' },
  { k: 'weibo', n: '微博体', en: 'WEIBO', desc: '微博正文 + 热评，带话题与数据' },
  { k: 'chatlog', n: '捡手机', en: 'CHATLOG', desc: '捡到的手机，微信 / LINE / iMessage 聊天记录' },
  { k: 'quote', n: '语录', en: 'QUOTE', desc: '被反复引用的名场面台词与摘句' }
];

const TG_SCHEMA = {
  essay: `{"genre":"essay","title":"标题","author":{"name":"发帖昵称","handle":"英文或拼音ID","identity":"如：随笔太太/路人/正主本人"},"caption":"发在广场上的一段引言，60-110字","tags":["标签1","标签2","标签3"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"sections":[{"h":"小标题","body":["段落一","段落二"]}]}}`,
  diary: `{"genre":"diary","title":"日记本名","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"entries":[{"date":"3月14日 周四","weather":"阴转小雨","mood":"心情词","body":["段落一","段落二"],"ps":"附言一句"}]}}`,
  note: `{"genre":"note","title":"便签集名","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"notes":[{"tag":"贴在哪里，如 冰箱门","title":"便签抬头","body":"便签正文，40-90字","from":"署名"}]}}`,
  qa: `{"genre":"qa","title":"提问箱标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"items":[{"q":"匿名提问，20-45字","a":"回答，60-140字"}]}}`,
  forum: `{"genre":"forum","title":"帖子标题","author":{"name":"楼主昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"board":"版块名","view":数字,"time":"2月11日 22:41","floors":[{"user":"用户名","time":"22:43","text":"发言内容，30-120字","like":数字,"reply":数字}]}}`,
  tweet: `{"genre":"tweet","title":"时间线标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"tweets":[{"name":"发推人","handle":"英文ID","time":"3h","text":"推文正文，40-140字","stats":{"reply":数字,"repost":数字,"like":数字},"replies":[{"name":"回复者","handle":"ID","text":"回复，20-60字"}]}]}}`,
  weibo: `{"genre":"weibo","title":"标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"posts":[{"name":"博主名","handle":"来自 iPhone 客户端","time":"今天 21:07","text":"微博正文，含#话题#，60-160字","stats":{"repost":数字,"comment":数字,"like":数字},"replies":[{"name":"评论者","handle":"","text":"热评，20-60字"}]}]}}`,
  chatlog: `{"genre":"chatlog","title":"聊天窗口标题","author":{"name":"发帖昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"skin":"wechat 或 line 或 imessage 或 qq","title":"窗口顶部显示的名字","messages":[{"type":"time","text":"昨天 23:14"},{"side":"them","name":"对方名字","text":"一句话，一般10-40字"},{"side":"me","name":"我方名字","text":"一句话"}]}}`,
  quote: `{"genre":"quote","title":"语录集标题","author":{"name":"昵称","handle":"ID","identity":"身份"},"caption":"引言60-110字","tags":["标签"],"stats":{"like":数字,"comment":数字,"repost":数字,"collect":数字},"data":{"lines":[{"text":"台词或摘句，20-70字","who":"说这句话的人"}]}}`
};
const TG_AMOUNT = {
  essay: '数组 sections 必须有 5 到 7 个小节，每小节 body 至少 2 段、每段 90 到 160 字。',
  diary: '数组 entries 必须有 4 到 6 篇日记，每篇 body 至少 3 段、每段 80 到 150 字。',
  note: '数组 notes 必须有 6 到 9 张便签。',
  qa: '数组 items 必须有 7 到 10 组问答。',
  forum: '数组 floors 必须有 12 到 18 层，楼中楼要有互相接话、有考据党、有磕疯了的、有理性分析的。',
  tweet: '数组 tweets 必须有 5 到 8 条推文，每条至少 2 条 replies。',
  weibo: '数组 posts 必须有 4 到 6 条微博，每条至少 3 条 replies。',
  chatlog: '数组 messages 必须有 32 到 48 条，中间穿插 3 到 5 个 type 为 time 的时间戳，对话要有来有回、有停顿、有话没说完的地方。',
  quote: '数组 lines 必须有 10 到 14 条。'
};

function tgSysPrompt() {
  return [
    '你是「糖罐」——一个中文同人 CP 社区的内容生成引擎。你的全部输出只能是一个 JSON 对象。',
    '',
    '【输出硬规则，违反即失败】',
    '1. 第一个字符必须是 {，最后一个字符必须是 }。禁止 markdown 代码块、禁止任何解释、禁止注释、禁止在 JSON 前后写字。',
    '2. 所有键名和字符串一律用英文双引号。字符串内部需要换行时写成 \\n，绝不能出现真实换行。',
    '3. 顶层键必须与给定 schema 完全一致，不增不减不改名。数字字段填纯数字，不加引号、不加单位。',
    '4. 简体中文写作。禁止使用任何 emoji、颜文字、表情符号、星号强调。',
    '5. 内容必须写满写实，不允许一句话敷衍，不允许出现「省略」「以此类推」「示例」等占位表述。',
    '',
    '【写作要求】',
    'A. 你要写的是「让人磕到」的同人内容：细节、留白、未说出口的心思、日常里的钝刀子，而不是空洞的抒情。',
    'B. 严格贴合给定人设，绝不 OOC：说话方式、称呼、性格边界、关系距离都要吻合。',
    'C. 昵称、用户名、时间、点赞数、评论数等一切社区数据都由你编造，要像真实社区里长出来的，不要用「用户A」这类占位名。',
    'D. 不同发言者要有明显不同的语气和用词，不要所有人一个腔调。'
  ].join('\n');
}

/* 把圈子（笔坊全部信息）压成给模型看的资料卡 */
function tgCircleBrief(c, deep) {
  const L = [];
  const side = (p, tag) => {
    if (!p) return;
    L.push(`【${tag}】${p.name || '未命名'}` +
      [p.role && '身份：' + p.role, p.gender && '性别：' + p.gender, p.age && '年龄：' + p.age,
      p.species && '设定：' + p.species, (p.tags || []).length && '标签：' + p.tags.join('、')]
        .filter(Boolean).map(s => '｜' + s).join(''));
    const f = deep && deep[p.uid];
    if (f) {
      const put = (k, v) => { if (v && String(v).trim()) L.push(`  · ${k}：${String(v).slice(0, 420)}`); };
      put('人设', f.prompt || f.desc);
      put('外貌', f.appearance);
      put('说话方式', f.speechStyle);
      put('口头禅', (f.catchphrases || []).join('、'));
      put('喜欢', (f.likes || []).join('、'));
      put('厌恶', (f.dislikes || []).join('、'));
      put('背景', f.backstory);
      put('当前情境', f.scenario);
      put('关系', [f.relation, f.relationDetail].filter(Boolean).join(' / '));
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
  return L.join('\n');
}

/* 读取角色库全字段（只喂给模型，绝不渲染到界面） */
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
   三、广场状态
================================================================ */
let tgPlaza = {
  posts: [],          // 已渲染的帖子（含 imgs）
  circles: [],
  circleId: 'all',    // 'all' | 'random' | 圈子 id
  genre: 'all',
  busy: false,
  loaded: false
};

function tgPickGenre(pref) {
  if (pref && pref !== 'all') return pref;
  const pool = TG_GENRES.map(g => g.k);
  return pool[Math.floor(Math.random() * pool.length)];
}
const tgRnd = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

/* ================================================================
   四、生成一个帖子
================================================================ */
async function tgGenPost(circle, genreKey, deepMap) {
  const g = genreKey;
  const spec = TG_GENRES.find(x => x.k === g) || TG_GENRES[0];
  const voices = ['正主之一亲自发布', '正主的另一位发布', '圈内太太发布', '路人围观发布', '同担粉丝发布'];
  const voice = voices[Math.floor(Math.random() * voices.length)];

  let scene;
  if (circle) {
    scene = '【本次要写的 CP 资料（来自用户的笔坊存档，必须严格遵守，绝不 OOC）】\n' + tgCircleBrief(circle, deepMap);
  } else {
    scene = [
      '【本次没有指定 CP，请你自己原创一对足够让人上头的 CP】',
      '要求：两人有明确姓名、身份、和一个具体的关系张力（如：旧识重逢、师徒错位、共犯关系、隔着一层身份的靠近）。',
      '世界观自由（现代都市 / 民国 / 校园 / 悬疑 / 幻想皆可），但要落到具体细节上。'
    ].join('\n');
  }

  const user = [
    scene,
    '',
    `【体裁】${spec.n}（${spec.desc}）`,
    `【视角】${voice}`,
    `【产量】${TG_AMOUNT[g]}`,
    '【额外要求】caption 是这条帖子发在广场上的引言，要有钩子；tags 给 3 到 5 个中文标签，不带井号；stats 里的数字要符合社区体感（几百到几万不等，且互相协调）。',
    circle ? '' : '另外，请在顶层额外增加两个键 "cpA" 和 "cpB"，分别是你原创的两个人的名字；再增加一个键 "cpWorld"，一句话交代世界观与关系张力。',
    '',
    '【必须严格遵循的 JSON 结构】',
    TG_SCHEMA[g],
    '',
    '现在直接输出 JSON。'
  ].filter(Boolean).join('\n');

  const KEY = { essay: 'sections', diary: 'entries', note: 'notes', qa: 'items', forum: 'floors', tweet: 'tweets', weibo: 'posts', chatlog: 'messages', quote: 'lines' }[g];
  let post = null;
  for (let round = 0; round < 2; round++) {
    const j = await tgAskJSON(tgSysPrompt(), user + (round ? '\n\n（上一次内容太单薄，这次务必写满数量要求。）' : ''), { max: 4600 });
    post = tgNormalize(j, g, circle);
    const arr = post.data[KEY] || [];
    if (arr.length >= (g === 'chatlog' ? 10 : 3)) return post;   // 内容够厚才收
  }
  return post;
}

/* 容错归一：任何字段缺失都补上，保证渲染不炸 */
function tgNormalize(j, g, circle) {
  j = j || {};
  const d = j.data || j.content || {};
  const a = j.author || {};
  const nm = a.name || j.name || '匿名同好';
  const post = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    genre: TG_GENRES.some(x => x.k === (j.genre || g)) ? (j.genre || g) : g,
    title: j.title || '无题',
    author: {
      name: nm,
      handle: a.handle || ('tg_' + Math.random().toString(36).slice(2, 8)),
      identity: a.identity || '圈内同好'
    },
    caption: j.caption || j.intro || '',
    tags: Array.isArray(j.tags) ? j.tags.filter(Boolean).slice(0, 5) : [],
    stats: Object.assign({ like: tgRnd(320, 9800), comment: tgRnd(40, 1200), repost: tgRnd(20, 800), collect: tgRnd(60, 3000) }, j.stats || {}),
    circleId: circle ? circle.id : null,
    circleName: circle ? circle.name : null,
    cpA: circle ? (circle.pairA && circle.pairA.name) : (j.cpA || ''),
    cpB: circle ? (circle.pairB && circle.pairB.name) : (j.cpB || ''),
    cpWorld: circle ? (circle.intro || '') : (j.cpWorld || ''),
    data: d,
    createdAt: Date.now()
  };
  // 每种体裁的最小可渲染性检查
  const arrOf = { essay: 'sections', diary: 'entries', note: 'notes', qa: 'items', forum: 'floors', tweet: 'tweets', weibo: 'posts', chatlog: 'messages', quote: 'lines' }[post.genre];
  if (arrOf && !Array.isArray(d[arrOf])) {
    // 兼容模型把数组塞在别处
    const cand = Object.keys(d).find(k => Array.isArray(d[k]) && d[k].length);
    if (cand) d[arrOf] = d[cand];
    else d[arrOf] = [];
  }
  if (post.genre === 'chatlog') {
    d.messages = (d.messages || []).map(m => {
      if (typeof m === 'string') return { side: 'them', name: post.cpA || '对方', text: m };
      const side = (m.side === 'me' || m.role === 'me' || m.who === 'me') ? 'me' : (m.type === 'time' || m.type === 'system' ? m.type : 'them');
      return { type: m.type, side: side === 'time' || side === 'system' ? undefined : side, name: m.name || (side === 'me' ? (post.cpB || '我') : (post.cpA || '对方')), text: m.text || m.content || '' };
    }).filter(m => m.text);
    if (!d.title) d.title = post.title;
    const skins = ['wechat', 'line', 'imessage', 'qq'];
    if (skins.indexOf(d.skin) < 0) d.skin = skins[Math.floor(Math.random() * skins.length)];
  }
  if (!post.cpA) post.cpA = '未名';
  if (!post.cpB) post.cpB = '未名';
  if (!post.caption) post.caption = post.title;
  if (!post.tags.length) post.tags = [post.genre === 'chatlog' ? '捡到的手机' : '磕糖现场', post.cpA + '×' + post.cpB];
  return post;
}

/* ================================================================
   五、生成入口（含无圈子引导）
================================================================ */
async function tgPlazaGenerate(n) {
  if (tgPlaza.busy) return;
  if (!tgHasApi()) {
    tgSheetOpen(`<h4>还没有接上模型</h4>
      <p class="tg-sheet-sub">广场的每一条内容都是现生成的，需要先在「设置 · API」里填好接口与模型。任何 OpenAI 协议的服务都可以。</p>
      <div style="height:14px"></div><button class="tg-btn tg-btn-dark" onclick="tgCloseSheet()">知道了</button>`);
    return;
  }
  const circles = tgPlaza.circles;
  if (!circles.length && tgPlaza.circleId !== 'random') {
    tgSheetOpen(`<h4>先有圈，才有糖</h4>
      <p class="tg-sheet-sub">你还没有建立任何 CP 圈。可以先去笔坊建一个，广场就会围绕你的圈生成一切内容；也可以让糖罐随机磕一口——满意的话，一键把它变成你的圈。</p>
      <div style="height:16px"></div>
      <div class="tg-btn-row">
        <button class="tg-btn tg-btn-light" onclick="tgCloseSheet();tgTab(3)">去笔坊建圈</button>
        <button class="tg-btn tg-btn-dark" onclick="tgCloseSheet();tgPlazaRandom()">随机磕一口</button>
      </div>`);
    return;
  }
  tgPlaza.busy = true;
  tgPlazaBar();
  const box = document.getElementById('tgFeed');
  const load = document.createElement('div');
  load.className = 'tg-gen';
  load.innerHTML = `<div class="tg-gen-ring"><i></i><i></i><i></i></div>
    <b>正在生成</b><p id="tgGenTip">铺纸、落笔、排版成图……</p>`;
  box.insertBefore(load, box.firstChild);

  const deep = await tgLoadCharsDeep();
  const count = n || 2;
  let ok = 0, err = null;
  for (let i = 0; i < count; i++) {
    let circle = null;
    if (tgPlaza.circleId === 'random') circle = null;
    else if (tgPlaza.circleId === 'all') circle = circles.length ? circles[Math.floor(Math.random() * circles.length)] : null;
    else circle = circles.find(c => c.id === tgPlaza.circleId) || null;
    const g = tgPickGenre(tgPlaza.genre);
    const tip = document.getElementById('tgGenTip');
    if (tip) tip.textContent = `第 ${i + 1} / ${count} 篇 · ${(TG_GENRES.find(x => x.k === g) || {}).n} · ${circle ? circle.name : '随机 CP'}`;
    try {
      const post = await tgGenPost(circle, g, deep);
      post.imgs = TGCard.render(post);
      if (!post.imgs.length) throw new Error('RENDER');
      tgPlaza.posts.unshift(post);
      await tgPut('posts', { id: post.id, createdAt: post.createdAt, post: Object.assign({}, post, { imgs: null }) });
      ok++;
      tgRenderFeed(true);
    } catch (e) {
      err = e;
      console.warn('[糖罐] 生成失败：', e);
    }
  }
  tgPlaza.busy = false;
  tgRenderFeed();
  tgPlazaBar();
  if (ok) { tgToast(`新生成 ${ok} 条`); if (typeof tgAddSweet === 'function') tgAddSweet(6 * ok); }
  else {
    const msg = err && /NO_API/.test(err.message) ? '接口没有配置好'
      : err && /API_/.test(err.message) ? '模型接口返回了错误：' + err.message.replace('API_', '')
        : '模型这次没有给出可用内容';
    tgSheetOpen(`<h4>没能生成出来</h4><p class="tg-sheet-sub">${tgEsc(msg)}。糖罐已经自动重试过三轮并尝试修复了返回内容。可以换一个模型，或稍后再试一次。</p>
      <div style="height:14px"></div><button class="tg-btn tg-btn-dark" onclick="tgCloseSheet()">好</button>`);
  }
}
function tgPlazaRandom() { tgPlaza.circleId = 'random'; tgPlazaBar(); tgPlazaGenerate(2); }

/* ================================================================
   六、渲染信息流
================================================================ */
function tgPlazaBar() {
  const bar = document.getElementById('tgPlazaBar');
  if (!bar) return;
  const cs = tgPlaza.circles;
  const chips = [
    `<button class="tg-chip ${tgPlaza.circleId === 'all' ? 'on' : ''}" onclick="tgSetCircle('all')">全部圈子</button>`,
    `<button class="tg-chip ${tgPlaza.circleId === 'random' ? 'on' : ''}" onclick="tgSetCircle('random')">随机 CP</button>`
  ].concat(cs.map(c => `<button class="tg-chip ${tgPlaza.circleId === c.id ? 'on' : ''}" onclick="tgSetCircle('${c.id}')">${tgEsc(c.name)}</button>`));
  const gs = [`<button class="tg-gchip ${tgPlaza.genre === 'all' ? 'on' : ''}" onclick="tgSetGenre('all')">全部体裁</button>`]
    .concat(TG_GENRES.map(g => `<button class="tg-gchip ${tgPlaza.genre === g.k ? 'on' : ''}" onclick="tgSetGenre('${g.k}')">${g.n}</button>`));
  bar.innerHTML = `
    <div class="tg-chips tg-scrollx">${chips.join('')}</div>
    <div class="tg-chips tg-scrollx" style="margin-top:8px">${gs.join('')}</div>
    <div class="tg-plaza-acts">
      <button class="tg-btn tg-btn-dark tg-btn-sm" ${tgPlaza.busy ? 'disabled' : ''} onclick="tgPlazaGenerate(2)">${tgPlaza.busy ? '生成中…' : '生成新内容'}</button>
      <button class="tg-mini-btn" data-ico="refresh" ${tgPlaza.busy ? 'disabled' : ''} onclick="tgPlazaGenerate(1)"></button>
      <button class="tg-mini-btn" data-ico="grid" onclick="tgPlazaHelp()"></button>
    </div>`;
  tgFillIcons(bar);
}
function tgSetCircle(id) { tgPlaza.circleId = id; tgPlazaBar(); tgRenderFeed(); }
function tgSetGenre(k) { tgPlaza.genre = k; tgPlazaBar(); tgRenderFeed(); }
function tgPlazaHelp() {
  tgSheetOpen(`<h4>广场是怎么运作的</h4>
    <p class="tg-sheet-sub">这里的每一条帖子都是模型现写的，正文会被排版成整页长图，最多九张，一张也不会被裁断。</p>
    ${TG_GENRES.map(g => `<div class="tg-rule"><b>${g.n} <small style="font-family:var(--tg-mono);font-size:9px;letter-spacing:.2em;color:var(--tg-mist-2)">${g.en}</small></b><p>${g.desc}</p></div>`).join('')}
    <div class="tg-rule"><b>关于圈子</b><p>选中某个圈时，糖罐会把笔坊里存下的全部资料——两位的档案、文风十一维、圈子简介与标签——一并交给模型，并强制要求不得 OOC。没有圈子时可以先随机磕一口，看中了再一键建圈。</p></div>`);
}

function tgImgGrid(post) {
  const n = post.imgs.length;
  const cls = n === 1 ? 'g1' : n === 2 ? 'g2' : n === 4 ? 'g4' : 'g3';
  return `<div class="tg-imgs ${cls}">
    ${post.imgs.map((src, i) => `<div class="tg-img" onclick="tgViewer('${post.id}',${i})"><img src="${src}" alt=""><span class="tg-img-n">${i + 1}</span></div>`).join('')}
    <div class="tg-img-count">${n} 张</div>
  </div>`;
}

function tgRenderFeed(keepLoader) {
  const box = document.getElementById('tgFeed');
  if (!box) return;
  const loader = keepLoader ? box.querySelector('.tg-gen') : null;
  let list = tgPlaza.posts;
  if (tgPlaza.circleId !== 'all' && tgPlaza.circleId !== 'random') list = list.filter(p => p.circleId === tgPlaza.circleId);
  if (tgPlaza.circleId === 'random') list = list.filter(p => !p.circleId);
  if (tgPlaza.genre !== 'all') list = list.filter(p => p.genre === tgPlaza.genre);

  if (!list.length && !loader) {
    box.innerHTML = `<div class="tg-empty tg-rise tg-d2">
      <div class="tg-empty-mark" data-ico="plaza"></div>
      <p>${tgPlaza.circles.length ? '这个筛选下还没有内容。<br>点上面的「生成新内容」，让糖罐现写一批。' : '广场还是空的。<br>先去笔坊建一个 CP 圈，或者让糖罐随机磕一口。'}</p>
      <div style="height:18px"></div>
      <div class="tg-btn-row">
        ${tgPlaza.circles.length ? '' : '<button class="tg-btn tg-btn-light" onclick="tgTab(3)">去笔坊</button>'}
        <button class="tg-btn tg-btn-dark" onclick="${tgPlaza.circles.length ? 'tgPlazaGenerate(2)' : 'tgPlazaRandom()'}">${tgPlaza.circles.length ? '生成新内容' : '随机磕一口'}</button>
      </div></div>`;
    tgFillIcons(box);
    return;
  }
  const html = list.map((p, i) => {
    const gm = TG_GENRES.find(g => g.k === p.genre) || TG_GENRES[0];
    return `<article class="tg-post tg-rise tg-d${(i % 5) + 1}">
      <div class="tg-post-top">
        <div class="tg-post-av"><span>${tgEsc(p.author.name[0] || '·')}</span></div>
        <div class="tg-post-who">
          <b>${tgEsc(p.author.name)}</b>
          <i>@${tgEsc(p.author.handle)} · ${tgEsc(p.author.identity)}</i>
        </div>
        <div class="tg-post-genre">${gm.n}</div>
      </div>
      <div class="tg-post-cp">${tgEsc(p.cpA)}<em>×</em>${tgEsc(p.cpB)}${p.circleName ? `<span>${tgEsc(p.circleName)}</span>` : '<span class="rnd">随机生成</span>'}</div>
      <h3 class="tg-post-title">${tgEsc(p.title)}</h3>
      <p class="tg-post-cap">${tgEsc(p.caption)}</p>
      ${tgImgGrid(p)}
      <div class="tg-post-tags">${p.tags.map(t => `<i>#${tgEsc(t)}</i>`).join('')}</div>
      <div class="tg-post-bar">
        <button onclick="tgPostAct('${p.id}','like',this)"><span data-ico="heart"></span>${p.stats.like}</button>
        <button onclick="tgPostAct('${p.id}','collect',this)"><span data-ico="star"></span>${p.stats.collect}</button>
        <button onclick="tgViewer('${p.id}',0)"><span data-ico="image"></span>${p.imgs.length}</button>
        <button onclick="tgPostMore('${p.id}')"><span data-ico="more"></span></button>
      </div>
      ${p.circleId ? '' : `<button class="tg-post-make" onclick="tgMakeCircle('${p.id}')">把「${tgEsc(p.cpA)} × ${tgEsc(p.cpB)}」收进笔坊，建成我的圈</button>`}
    </article>`;
  }).join('');
  box.innerHTML = html;
  if (loader) box.insertBefore(loader, box.firstChild);
  tgFillIcons(box);
}

function tgPostAct(id, kind, btn) {
  const p = tgPlaza.posts.find(x => x.id === id); if (!p) return;
  if (btn.classList.contains('on')) { btn.classList.remove('on'); p.stats[kind]--; }
  else { btn.classList.add('on'); p.stats[kind]++; if (typeof tgAddSweet === 'function') tgAddSweet(kind === 'like' ? 3 : 6); }
  btn.innerHTML = `<span data-ico="${kind === 'like' ? 'heart' : 'star'}"></span>${p.stats[kind]}`;
  tgFillIcons(btn);
}
function tgPostMore(id) {
  const p = tgPlaza.posts.find(x => x.id === id); if (!p) return;
  tgSheetOpen(`<h4>${tgEsc(p.title)}</h4>
    <p class="tg-sheet-sub">${tgEsc(p.cpA)} × ${tgEsc(p.cpB)} · ${(TG_GENRES.find(g => g.k === p.genre) || {}).n} · 共 ${p.imgs.length} 张</p>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgSaveAll('${p.id}')">全部存入相册</button>
    <div style="height:10px"></div>
    <button class="tg-btn tg-btn-light" onclick="tgViewer('${p.id}',0);tgCloseSheet()">逐张查看</button>
    <div style="height:10px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgDelPost('${p.id}')">从广场移除</button>`);
}
async function tgDelPost(id) {
  tgPlaza.posts = tgPlaza.posts.filter(p => p.id !== id);
  await tgDel('posts', id);
  tgCloseSheet(); tgRenderFeed(); tgToast('已移除');
}

/* 随机 CP → 一键建圈 */
function tgMakeCircle(id) {
  const p = tgPlaza.posts.find(x => x.id === id); if (!p) return;
  tgSheetOpen(`<h4>建成我的圈</h4>
    <p class="tg-sheet-sub">这一对会被写进笔坊存档，之后广场围绕它生成的一切内容都会读取这份资料。</p>
    <div class="tg-field"><div class="tg-label">圈名 <small>name</small></div>
      <input class="tg-input" id="tgMkName" value="${tgEsc(p.cpA + '×' + p.cpB)}"></div>
    <div class="tg-field"><div class="tg-label">简介 <small>intro</small></div>
      <textarea class="tg-textarea" id="tgMkIntro">${tgEsc(p.cpWorld || p.caption)}</textarea></div>
    <div style="height:14px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgMakeCircleGo('${p.id}')">建立圈子</button>`);
}
async function tgMakeCircleGo(id) {
  const p = tgPlaza.posts.find(x => x.id === id); if (!p) return;
  const name = (document.getElementById('tgMkName').value || '').trim() || (p.cpA + '×' + p.cpB);
  const intro = (document.getElementById('tgMkIntro').value || '').trim();
  const obj = {
    type: 'circle', name,
    pairA: { uid: 'x' + Math.random().toString(36).slice(2, 7), kind: 'char', name: p.cpA, tags: p.tags.slice(0, 3), role: '', gender: '', age: '', species: '' },
    pairB: { uid: 'x' + Math.random().toString(36).slice(2, 7), kind: 'char', name: p.cpB, tags: p.tags.slice(0, 3), role: '', gender: '', age: '', species: '' },
    source: 'plaza', aiData: { hook: p.cpWorld || p.caption },
    style: { sel: {}, custom: {} }, intro, tags: p.tags.slice(0, 4), access: '公开',
    avatar: null, bg: null
  };
  const saved = await tgPut('circles', obj);
  p.circleId = saved.id; p.circleName = saved.name;
  if (typeof tgAddSweet === 'function') tgAddSweet(120);
  tgCloseSheet();
  await tgPlazaLoad(true);
  tgToast('圈子已建立，甜蜜值 +120');
  if (typeof tgRenderCircleList === 'function') tgRenderCircleList();
  if (typeof tgRefreshStats === 'function') tgRefreshStats();
}

/* ================================================================
   七、长图查看器 + 存入相册
================================================================ */
let tgVw = { post: null, i: 0 };
function tgViewer(id, i) {
  const p = tgPlaza.posts.find(x => x.id === id); if (!p) return;
  tgVw = { post: p, i: i || 0 };
  const m = document.getElementById('tgViewerMask');
  m.classList.add('on');
  tgViewerPaint();
}
function tgViewerPaint() {
  const p = tgVw.post; if (!p) return;
  const n = p.imgs.length;
  document.getElementById('tgVwImg').src = p.imgs[tgVw.i];
  document.getElementById('tgVwIdx').textContent = `${tgVw.i + 1} / ${n}`;
  document.getElementById('tgVwTitle').textContent = p.title;
  document.getElementById('tgVwDots').innerHTML = p.imgs.map((_, i) =>
    `<i class="${i === tgVw.i ? 'on' : ''}" onclick="tgVwGo(${i})"></i>`).join('');
}
function tgVwGo(i) { const n = tgVw.post.imgs.length; tgVw.i = (i + n) % n; tgViewerPaint(); }
function tgVwNext(d) { tgVwGo(tgVw.i + d); }
function tgViewerClose(e) { if (e && e.target.closest('.tg-vw-inner')) return; document.getElementById('tgViewerMask').classList.remove('on'); }

/* —— 写入 Luna 相册（luna-gallery-db / photos） —— */
function tgAlbumDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('luna-gallery-db', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('albums')) db.createObjectStore('albums', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function tgSavePhotos(items) {
  const db = await tgAlbumDB();
  await new Promise((res, rej) => {
    const tx = db.transaction('photos', 'readwrite');
    const st = tx.objectStore('photos');
    items.forEach((it, i) => st.put({
      id: 'tg_' + Date.now().toString(36) + '_' + i + '_' + Math.random().toString(36).slice(2, 6),
      src: it.src, name: it.name, addedAt: Date.now() + i
    }));
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
  localStorage.setItem('luna_gallery_update', String(Date.now()));
}
async function tgSaveOne() {
  const p = tgVw.post; if (!p) return;
  try {
    await tgSavePhotos([{ src: p.imgs[tgVw.i], name: `${p.title}_${tgVw.i + 1}` }]);
    tgToast('已存入相册');
  } catch (e) { tgToast('存入相册失败'); }
}
async function tgSaveAll(id) {
  const p = id ? tgPlaza.posts.find(x => x.id === id) : tgVw.post;
  if (!p) return;
  try {
    await tgSavePhotos(p.imgs.map((src, i) => ({ src, name: `${p.title}_${i + 1}` })));
    tgCloseSheet();
    tgToast(`${p.imgs.length} 张已存入相册`);
  } catch (e) { tgToast('存入相册失败'); }
}

/* ================================================================
   八、载入与入场
================================================================ */
async function tgPlazaLoad(force) {
  tgPlaza.circles = await tgAll('circles');
  if (!tgPlaza.loaded || force) {
    if (!tgPlaza.posts.length) {
      const rows = await tgAll('posts');
      tgPlaza.posts = rows.map(r => r.post).filter(Boolean).map(p => {
        p.imgs = TGCard.render(p);
        return p;
      }).filter(p => p.imgs.length);
    }
    tgPlaza.loaded = true;
  }
  tgPlazaBar();
  tgRenderFeed();
}

/* 接管入场钩子（保留 tg-bifang.js 原有实现） */
(function () {
  const prev = window.tgOnEnter;
  window.tgOnEnter = function (id) {
    if (typeof prev === 'function') { try { prev(id); } catch (e) { } }
    if (id === 'scr-plaza') tgPlazaLoad();
    if (typeof tgOnEnterDM === 'function') tgOnEnterDM(id);
  };
})();

/* 查看器手势 */
document.addEventListener('DOMContentLoaded', () => {
  const box = document.getElementById('tgVwStage');
  if (!box) return;
  let sx = 0, sy = 0;
  box.addEventListener('touchstart', e => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
  box.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 46 && Math.abs(dx) > Math.abs(dy)) tgVwNext(dx < 0 ? 1 : -1);
  });
});
