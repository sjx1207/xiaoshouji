/* =========================================================
   论坛 · AI 层  forum-ai.js
   读取桌面「设置」中的 API（luna_api_current / luna_api_model）
   OpenAI 兼容 /chat/completions，支持流式与识图
========================================================= */

/* ---------------- 内容类型定义（生成、卡片、详情共用） ---------------- */
F.TYPES = {
  moment:  { name: '动态', icon: 'comment', blurb: '推特/微博式短动态，可配图', spec: '一条真实感的社交动态，正文 40~280 字，口语化、有情绪或观点；可配 0~4 张图（只写图片画面描述）。title 留空。' },
  photo:   { name: '图文', icon: 'image', blurb: 'IG 式多图分享，重画面', spec: 'IG 风格的图文分享：必须有 3~9 张图的画面描述（每张 20~60 字，具体到构图、光线、主体），正文是 30~200 字的图说/心情。title 留空。' },
  article: { name: '长文', icon: 'article', blurb: '有标题、有小节的深度长文', spec: '一篇结构完整的长文：title 为吸引人的标题；content 1500~3000 字，使用“## 小标题”分节（3~6 节），可用 > 引用、- 列表、**重点**、「引语」、《书名》等标记；观点鲜明、信息密度高。可配 0~2 张图。' },
  essay:   { name: '随笔', icon: 'feather', blurb: '文学性的散文与心绪', spec: '一篇文学性随笔：title 为短而有意境的题目；content 600~1500 字，第一人称，注重细节、意象与节奏，分多个自然段，可用“对白”与「引语」。不要使用小标题。' },
  poll:    { name: '投票', icon: 'poll', blurb: '抛出问题，看大家怎么选', spec: '一条发起投票的帖子：content 为 20~150 字的背景说明；poll.question 为投票问题；poll.options 2~5 个选项，每个给出真实感的 votes 票数（总票数与热度匹配）。title 留空。' },
  qa:      { name: '问答', icon: 'qa', blurb: '提问与高赞回答', spec: '一个问答帖：title 为一个具体的提问（以问号结尾）；content 为作者给出的高质量回答，300~1200 字，分段清晰，可用 - 列表与 **重点**。' },
  thread:  { name: '连载串', icon: 'thread', blurb: '1/n 形式的推文串', spec: '一个推文串（thread）：title 为串的主题；thread 数组 4~8 段，每段 60~200 字，层层推进，最后一段收束；content 填第一段的内容。' },
  review:  { name: '测评', icon: 'review', blurb: '带评分的书影音/好物测评', spec: '一篇测评：review.subject 为被评对象名称，review.category 为类别（书/电影/剧集/音乐/游戏/好物/餐厅等），review.rating 为 1~5 的评分（可带 .5）；title 为测评标题；content 400~1200 字，含“## 优点”“## 不足”“## 结论”三节。' },
  news:    { name: '快讯', icon: 'news', blurb: '热点速报、官方通报、辟谣', spec: '一条资讯快讯：title 为新闻标题；news.source 为发布来源（媒体/机构/官方账号），news.level 为 快讯/独家/通报/辟谣/深度 之一；content 150~500 字，新闻体，先说结论再补细节。' }
};
F.TYPE_ORDER = ['moment', 'photo', 'article', 'essay', 'poll', 'qa', 'thread', 'review', 'news'];
F.VTYPES = {
  vlog:      { name: 'Vlog', icon: 'camera', blurb: '跟拍一天的生活片段', spec: '第一人称跟拍的生活 vlog，有起床/出门/做事/收尾的节奏，镜头随意自然，碎碎念旁白多。' },
  reaction:  { name: 'Reaction', icon: 'eye', blurb: '看内容时的实时反应', spec: '博主观看某段内容（新闻、MV、剧集、游戏）的实时反应视频，画面分为“屏幕内容”与“博主表情”交替，情绪起伏明显。' },
  remix:     { name: '二创', icon: 'grid', blurb: '混剪、剪辑、鬼畜与再创作', spec: '对已有素材或热点的二次创作（混剪/踩点/鬼畜/配音），节奏快，花字与音效密集，最后有高光收尾。' },
  tutorial:  { name: '教程', icon: 'book', blurb: '手把手的干货教学', spec: '步骤清晰的教学视频，先展示成品，再分步骤讲解，花字标注要点，结尾总结。' },
  unbox:     { name: '开箱测评', icon: 'review', blurb: '拆箱、上手与打分', spec: '开箱测评：拆包装、细节特写、上手体验、优缺点、最终打分。' },
  challenge: { name: '挑战', icon: 'bolt', blurb: '跟风挑战与整活', spec: '参与某个挑战/整活，有规则说明、尝试、失败或反转、结果揭晓。' },
  explore:   { name: '探店', icon: 'pin', blurb: '探店与城市打卡', spec: '探店/打卡：门头、环境、点单、试吃或体验、价格与评价。' },
  drama:     { name: '剧情短剧', icon: 'play', blurb: '有反转的小剧场', spec: '一分钟左右的剧情短剧：人物关系清楚，冲突推进，结尾有反转或钩子，多人对白。' },
  clip:      { name: '直播切片', icon: 'flame', blurb: '直播里的名场面', spec: '直播间名场面切片：弹幕、礼物、主播的即兴反应与金句。' },
  scene:     { name: '现场直击', icon: 'news', blurb: '事件现场的第一视角', spec: '新闻/事件现场的第一视角拍摄：晃动镜头、现场声、路人对话、字幕说明时间地点。' }
};
F.VTYPE_ORDER = ['vlog', 'reaction', 'remix', 'tutorial', 'unbox', 'challenge', 'explore', 'drama', 'clip', 'scene'];

F.ai = {
  cfg() {
    let cur = {};
    try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch (e) {}
    const model = localStorage.getItem('luna_api_model') || '';
    return { baseUrl: (cur.baseUrl || '').replace(/\/$/, ''), apiKey: cur.apiKey || '', model };
  },
  ready() { const c = this.cfg(); return !!(c.baseUrl && c.apiKey && c.model); },

  /* 统一请求：优先流式（实时回传字数），失败自动降级为普通请求 */
  async call(messages, { maxTokens, temperature, stream, onDelta, signal } = {}) {
    const c = this.cfg();
    if (!c.baseUrl || !c.apiKey) throw new Error('还没有配置 API，请到桌面「设置 › API」中填写并选择模型');
    if (!c.model) throw new Error('还没有选择模型，请到桌面「设置 › API」中选择模型');
    const S = F.state.settings;
    const body = { model: c.model, messages, max_tokens: maxTokens || S.maxTokens || 8192, temperature: temperature ?? S.temperature ?? 0.9 };
    const useStream = (stream ?? S.stream) !== false;
    const headers = { 'Authorization': `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' };
    if (useStream) {
      try {
        const resp = await fetch(`${c.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify({ ...body, stream: true }), signal });
        if (!resp.ok) throw new Error(`HTTP ${resp.status} ${(await resp.text()).slice(0, 160)}`);
        const reader = resp.body.getReader(); const dec = new TextDecoder();
        let buf = '', out = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n'); buf = lines.pop();
          for (const ln of lines) {
            const s = ln.trim();
            if (!s.startsWith('data:')) continue;
            const d = s.slice(5).trim();
            if (d === '[DONE]') continue;
            try {
              const j = JSON.parse(d);
              const piece = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? '';
              if (piece) { out += piece; onDelta && onDelta(out); }
            } catch (e) {}
          }
        }
        if (out.trim()) return out;
        throw new Error('流式返回为空');
      } catch (e) {
        if (signal && signal.aborted) throw e;
        if (/HTTP 4(01|03)/.test(e.message)) throw e;
        // 降级为普通请求
      }
    }
    const resp = await fetch(`${c.baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body), signal });
    if (!resp.ok) throw new Error(`请求失败 HTTP ${resp.status}：${(await resp.text()).slice(0, 200)}`);
    const data = await resp.json();
    const txt = data.choices?.[0]?.message?.content || '';
    onDelta && onDelta(txt);
    if (!txt.trim()) throw new Error('模型没有返回内容');
    return txt;
  },

  /* 容错 JSON 解析：去代码围栏 → 截取最外层对象 → 修复常见错误 */
  parse(text) {
    let t = String(text || '').replace(/^\uFEFF/, '').trim();
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```(?:json)?/gi, '').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('返回内容不是 JSON');
    let s = t.slice(a, b + 1);
    const tries = [
      x => x,
      x => x.replace(/,\s*([}\]])/g, '$1'),
      x => x.replace(/,\s*([}\]])/g, '$1').replace(/[\u0000-\u001f]/g, m => m === '\n' ? '\\n' : m === '\t' ? '\\t' : ''),
      x => x.replace(/,\s*([}\]])/g, '$1').replace(/\n/g, '\\n').replace(/\\n\s*([}\]"])/g, '$1').replace(/([{\[,])\s*\\n\s*/g, '$1')
    ];
    for (const f of tries) { try { return JSON.parse(f(s)); } catch (e) {} }
    throw new Error('JSON 格式损坏');
  },

  /* 带一次格式重试的 JSON 调用 */
  async callJSON(messages, opts = {}) {
    let txt = await this.call(messages, opts);
    try { return this.parse(txt); }
    catch (e) {
      opts.onRetry && opts.onRetry();
      const fix = messages.concat([{ role: 'assistant', content: txt.slice(0, 6000) }, { role: 'user', content: '你上一次的输出不是合法 JSON 或被截断了。请重新完整输出，只输出一个合法 JSON 对象，不要任何解释、不要代码围栏，字符串内的英文双引号改用中文引号“”，换行用 \\n。' }]);
      txt = await this.call(fix, opts);
      return this.parse(txt);
    }
  },

  /* ---------------- 上下文构建 ---------------- */
  _chars: null,
  async rawChars(force) { if (!this._chars || force) this._chars = await F.ext.chars(); return this._chars; },
  async rawChar(charId) { return (await this.rawChars()).find(c => c.id === charId); },

  userContext(u) {
    if (!u) return '';
    const v = u.verify && u.verify.status === 'verified';
    const L = [
      `昵称：${u.nickname}（@${u.handle}）`,
      u.bio && `简介：${u.bio}`, u.gender && `性别：${u.gender}`, u.birthday && `生日：${u.birthday}`,
      u.location && `所在地：${u.location}`, u.occupation && `职业/身份：${u.occupation}`, u.school && `学校：${u.school}`,
      u.tags && u.tags.length && `标签：${u.tags.join('、')}`,
      u.persona && `个人设定：${u.persona}`,
      u.aiAddress && `希望被怎样称呼/对待：${u.aiAddress}`,
      u.relationToChars && `与角色们的关系：${u.relationToChars}`,
      v && `认证：${u.verify.type}·${u.verify.field}｜${u.verify.title}`,
      v && u.verify.fanClub.enabled && `拥有粉丝团「${u.verify.fanClub.name}」，粉丝徽章「${u.verify.fanClub.badge}」`,
      v && u.verify.circles.length && `创建的圈子：${u.verify.circles.map(c => c.name).join('、')}`
    ].filter(Boolean);
    return L.join('\n');
  },

  async charContext(cp) {
    const raw = await this.rawChar(cp.charId) || {};
    const s = cp.sync || {};
    const L = [`论坛昵称：${cp.nickname}（@${cp.handle}）`, cp.bio && `论坛简介：${cp.bio}`];
    if (s.name !== false && raw.name) L.push(`角色本名：${raw.name}`);
    // 人设为必同步项：无论开关如何都注入
    if (raw.prompt) L.push(`【核心人设】\n${raw.prompt}`);
    if (s.desc && raw.desc) L.push(`一句话描述：${raw.desc}`);
    if (s.appearance && raw.appearance) L.push(`外貌：${raw.appearance}`);
    if (s.traits && raw.traits) L.push(`性格：${Array.isArray(raw.traits) ? raw.traits.join('、') : raw.traits}`);
    if (s.speechStyle && raw.speechStyle) L.push(`说话风格：${raw.speechStyle}`);
    if (s.speechStyle && raw.catchphrases) L.push(`口头禅：${Array.isArray(raw.catchphrases) ? raw.catchphrases.join('、') : raw.catchphrases}`);
    if (s.likes && (raw.likes || raw.dislikes)) L.push(`喜好：${raw.likes || '-'}；讨厌：${raw.dislikes || '-'}`);
    if (s.backstory && raw.backstory) L.push(`背景经历：${raw.backstory}`);
    if (s.relation && (raw.relation || raw.relationDetail)) L.push(`与用户的关系：${[raw.relation, raw.relationDetail].filter(Boolean).join('，')}`);
    if (raw.age && s.desc) L.push(`年龄：${raw.age}`);
    if (raw.neverList && raw.neverList.length) L.push(`绝对不会做的事：${Array.isArray(raw.neverList) ? raw.neverList.join('、') : raw.neverList}`);
    if (cp.relationToUser) L.push(`在论坛里与用户的互动关系：${cp.relationToUser}`);
    const p = cp.post || {};
    const rules = [
      p.style && `文风：${p.style}`, p.tone && `语气：${p.tone}`, p.topics && `常发话题：${p.topics}`, p.taboo && `不会发的内容：${p.taboo}`,
      p.length && `篇幅偏好：${p.length}`, p.hashtag && `话题标签使用：${p.hashtag}`, p.emoji && `表情符号：${p.emoji}`,
      p.perspective && `叙述视角：${p.perspective}`, p.mentionUser && `提及用户的频率：${p.mentionUser}`, p.sample && `过往发帖示例：${p.sample}`
    ].filter(Boolean);
    if (rules.length) L.push(`【发帖规范】\n${rules.join('\n')}`);
    if (s.worldbook) {
      const wb = await F.ext.worldbook();
      const rel = wb.filter(e => e.enabled !== false && e.mode === 'constant' && Array.isArray(e.chars) && e.chars.includes(cp.charId));
      if (rel.length) L.push(`【角色专属世界设定】\n${rel.map(e => `◆ ${e.title || ''}：${e.detail || ''}`).join('\n')}`);
    }
    if (s.memory) {
      const mem = await F.ext.memories(cp.charId);
      const txt = mem.slice(-12).map(m => m.content || m.text || m.summary || '').filter(Boolean);
      if (txt.length) L.push(`【与用户的记忆】\n${txt.join('\n')}`);
    }
    return L.filter(Boolean).join('\n');
  },

  async worldContext(w) {
    if (!w) return '（本次内容不属于任何存档，按通用社交平台的风格处理）';
    const L = [
      `存档名称：${w.name}`, w.theme && `主题：${w.theme}`, w.tone && `整体文风基调：${w.tone}`, w.style && `写作风格细则：${w.style}`,
      w.worldview && `世界观：${w.worldview}`, w.era && `时代/时间背景：${w.era}`, w.content && `核心内容与正在发生的事件：${w.content}`,
      w.platform && `平台气质：${w.platform}`, w.audience && `网友群像/受众：${w.audience}`, w.npc && `常驻博主设定：${w.npc}`,
      w.keywords && `关键词/意象：${w.keywords}`, w.commentStyle && `评论区氛围：${w.commentStyle}`, w.heat && `热度级别：${w.heat}`,
      w.realism && `真实度：${w.realism}`, w.length && `篇幅偏好：${w.length}`, w.lang && `语言：${w.lang}`,
      w.userRole && `用户（我）在这个世界中的身份：${w.userRole}`, w.userMention && `帖子里提及用户的频率：${w.userMention}`,
      w.taboo && `禁止出现：${w.taboo}`
    ].filter(Boolean);
    if (w.worldbook && w.worldbook.length) {
      const wb = await F.ext.worldbook();
      const sel = wb.filter(e => w.worldbook.includes(e.id));
      if (sel.length) L.push(`【引用的世界书设定】\n${sel.map(e => `◆ ${e.title || ''}${e.sub ? '（' + e.sub + '）' : ''}：${e.detail || ''}`).join('\n')}`);
    }
    return L.join('\n');
  },

  baseRules() {
    return `你是一个高拟真社交论坛的内容引擎，负责生成帖子、博主资料、互动数据与评论区。
硬性要求：
1. 只输出一个合法 JSON 对象，不要任何解释，不要 markdown 代码围栏。
2. JSON 字符串内部不要出现英文双引号，需要引号时用中文“”或「」；换行写成 \\n。
3. 内容必须完整写完，不得出现“此处省略”“……（略）”之类的占位。
4. 所有人物、事件必须符合给定的世界观、文风基调与角色人设，不得跳出设定，不得出现 AI 口吻或免责声明。
5. 数据要有真实感：点赞、转发、收藏、浏览、粉丝数与博主影响力和内容热度相匹配（浏览量通常为点赞的 8~60 倍）。
6. 绝对不要替用户（“我”）发言或编写用户的评论。
7. 不要使用 emoji 表情符号。`;
  },

  worldNpcs(worldId) { return F.state.npcs.filter(n => n.worldId === worldId).sort((a, b) => (b.followers || 0) - (a.followers || 0)); },

  /* ---------------- 生成一篇帖子 ---------------- */
  async generatePost(job, { onDelta, signal, onRetry } = {}) {
    const w = F.world(job.worldId);
    const T = F.TYPES[job.type];
    const me = F.me();
    const worldCtx = await this.worldContext(w);
    const chars = (job.chars || []).map(F.charProfile).filter(Boolean);
    let charBlock = '';
    const roleOf = cp => (job.roles || {})[cp.id] || 'both';
    for (const cp of chars) charBlock += `\n【角色 @${cp.handle}】参与方式：${roleOf(cp) === 'author' ? '作为作者' : roleOf(cp) === 'comment' ? '只在评论区出现' : '可作者可评论'}\n${await this.charContext(cp)}\n`;
    const npcs = w ? this.worldNpcs(w.id).slice(0, 14) : [];
    const recent = F.state.posts.filter(p => w ? p.worldId === w.id : !p.worldId).sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
    const npcA = job.authorNpc ? F.npc(job.authorNpc) : null;
    const authorLine = npcA
      ? `本篇作者固定为博主 @${npcA.handle}（${npcA.nickname}），author.type 填 "npc"，author.handle 必须填 "${npcA.handle}"。TA 的设定：${npcA.persona || ''}｜简介：${npcA.bio || ''}${npcA.verifiedTitle ? '｜认证：' + npcA.verifiedTitle : ''}。内容要延续 TA 一贯的风格与领域。`
      : job.authorChar
      ? `本篇作者固定为角色 @${F.charProfile(job.authorChar).handle}（${F.charProfile(job.authorChar).nickname}），author.type 填 "char"，author.handle 填 "${F.charProfile(job.authorChar).handle}"。请完全以该角色的人设、说话风格与发帖规范来写。`
      : `本篇作者是这个世界里的一位网友/博主（author.type 填 "npc"）。可以复用下方已有博主（handle 必须完全一致），也可以创造新的博主，但要符合常驻博主设定与网友群像。`;
    const commentChars = chars.filter(c => roleOf(c) !== 'author');
    const heat = (w && w.heat) || '中等热度';
    const cRange = /爆/.test(heat) ? '8~12' : /小众|冷/.test(heat) ? '3~6' : '5~9';

    const user = `【存档设定——全部都要读取并遵循】
${worldCtx}

【用户（我）的资料——可被提及，但不能替我发言】
${this.userContext(me)}
${charBlock ? '\n【参与本次生成的角色】' + charBlock : ''}
${npcs.length ? `\n【已存在的博主（可复用）】\n${npcs.map(n => `@${n.handle}｜${n.nickname}｜${n.persona || n.bio || ''}`).join('\n')}` : ''}
${recent.length ? `\n【近期已发布内容（避免重复题材与表达）】\n${recent.map(p => '- ' + (p.title || F.plain(p.content).slice(0, 40))).join('\n')}` : ''}
${job.extra ? `\n【本次生成的额外要求】${job.extra}` : ''}
${await this.protagonistBlock(job)}
【当前时间】${F.timeCtx()}（发帖内容要符合这个时间点，例如深夜发的帖子带着夜晚的状态）
${job.topic ? `【指定话题】本篇必须属于话题 #${job.topic}#，post.topic 填 "${job.topic}"。\n` : ''}
【本篇任务】第 ${job.index + 1} 篇，类型：${T.name}
${T.spec}
${authorLine}
评论区：生成 ${cRange} 条一级评论，其中约一半带 1~3 条楼中楼回复；评论要有立场差异、有梗、有信息量，符合评论区氛围。${commentChars.length ? `角色 ${commentChars.map(c => '@' + c.handle).join('、')} 可以自然地出现在评论区（handle 必须完全一致），言行符合人设。` : ''}

【输出 JSON 结构】
{
 "author":{"type":"npc 或 char","handle":"英文或拼音id","nickname":"昵称","bio":"个人简介","verified":false,"verifiedTitle":"认证头衔，未认证留空","followers":0,"following":0,"likes":0,"location":"","tags":["标签"],"persona":"一句话描述这个博主的性格与内容方向"},
 "post":{"title":"","content":"正文","topic":"所属话题（不带#）","tags":["话题标签"],"location":"","images":[{"desc":"图片画面描述"}],
   "poll":{"question":"","options":[{"text":"","votes":0}]},
   "review":{"subject":"","category":"","rating":4.5},
   "thread":["第1段","第2段"],
   "news":{"source":"","level":""}},
 "stats":{"likes":0,"reposts":0,"favorites":0,"views":0},
 "comments":[{"handle":"","nickname":"","verified":false,"text":"","likes":0,"replies":[{"handle":"","nickname":"","replyTo":"被回复者昵称","text":"","likes":0}]}]
}
不属于本类型的字段可以省略。`;
    return this.callJSON([{ role: 'system', content: this.baseRules() }, { role: 'user', content: user }], { onDelta, signal, onRetry });
  },

  /* ---------------- 把 AI 结果写入数据（博主、帖子、评论） ---------------- */
  ensureNpc(worldId, a) {
    if (!a) a = {};
    const handle = String(a.handle || a.nickname || 'user' + Math.floor(Math.random() * 1e5)).replace(/^@/, '').trim();
    const cp = F.state.charProfiles.find(c => c.handle === handle);
    if (cp) return { kind: 'char', id: cp.id };
    let n = F.state.npcs.find(x => x.worldId === worldId && x.handle === handle);
    if (!n) {
      const r = F.rng(handle);
      n = {
        id: F.uid('n'), worldId, handle, nickname: a.nickname || handle, bio: a.bio || '', persona: a.persona || '',
        verified: !!a.verified, verifiedTitle: a.verifiedTitle || '', location: a.location || '', tags: Array.isArray(a.tags) ? a.tags : [],
        followers: +a.followers || Math.floor(r() * 3000 + 20), following: +a.following || Math.floor(r() * 400 + 10),
        likes: +a.likes || Math.floor(r() * 8000), createdAt: Date.now()
      };
      F.state.npcs.push(n);
    } else if (a.bio || a.persona) {
      // 已有博主：只补全缺失字段，保持资料一致
      n.bio = n.bio || a.bio || ''; n.persona = n.persona || a.persona || '';
      if (a.verified && !n.verified) { n.verified = true; n.verifiedTitle = a.verifiedTitle || n.verifiedTitle; }
    }
    return { kind: 'npc', id: n.id };
  },
  buildComments(worldId, list, baseTime) {
    const out = [];
    (Array.isArray(list) ? list : []).forEach((c, i) => {
      if (!c || !c.text) return;
      const t = baseTime + (i + 1) * (60000 + Math.random() * 600000);
      const nameMap = {};
      const author = this.ensureNpc(worldId, c);
      nameMap[c.nickname] = author;
      const cm = { id: F.uid('cm'), author, text: String(c.text), likes: +c.likes || 0, likedBy: [], time: t, replies: [] };
      (Array.isArray(c.replies) ? c.replies : []).forEach((r, j) => {
        if (!r || !r.text) return;
        const ra = this.ensureNpc(worldId, r);
        nameMap[r.nickname] = ra;
        cm.replies.push({ id: F.uid('rp'), author: ra, replyTo: nameMap[r.replyTo] || null, replyToName: r.replyTo || '', text: String(r.text), likes: +r.likes || 0, likedBy: [], time: t + (j + 1) * 90000 });
      });
      out.push(cm);
    });
    return out;
  },
  ingestPost(job, data) {
    const w = F.world(job.worldId);
    const wid = w ? w.id : null;
    let author;
    if (job.authorChar) author = { kind: 'char', id: job.authorChar };
    else if (job.authorNpc && F.npc(job.authorNpc)) author = { kind: 'npc', id: job.authorNpc };
    else author = this.ensureNpc(wid, Object.assign({}, data.author, { handle: (data.author && data.author.type === 'char') ? ('npc_' + (data.author.handle || '')) : data.author && data.author.handle }));
    const P = data.post || {};
    const createdAt = Date.now() - Math.floor(Math.random() * 3600 * 1000 * 5);
    const post = {
      id: F.uid('p'), worldId: wid, type: job.type, author, source: 'ai',
      title: P.title || '', content: P.content || (Array.isArray(P.thread) ? P.thread[0] : '') || '',
      topic: (P.topic || '').replace(/^#|#$/g, ''), tags: (Array.isArray(P.tags) ? P.tags : []).map(t => String(t).replace(/^#|#$/g, '')).slice(0, 6),
      location: P.location || '',
      images: (Array.isArray(P.images) ? P.images : []).filter(im => im && im.desc).slice(0, 9).map((im, i) => ({ desc: String(im.desc), seed: F.uid('im') + i })),
      poll: job.type === 'poll' && P.poll ? { question: P.poll.question || P.title || '', options: (P.poll.options || []).slice(0, 5).map(o => ({ text: String(o.text || o), votes: +o.votes || 0 })), votes: {} } : null,
      review: job.type === 'review' && P.review ? { subject: P.review.subject || '', category: P.review.category || '', rating: F.clamp(+P.review.rating || 4, 1, 5) } : null,
      thread: job.type === 'thread' && Array.isArray(P.thread) ? P.thread.map(String) : null,
      news: job.type === 'news' ? { source: (P.news && P.news.source) || '', level: (P.news && P.news.level) || '快讯' } : null,
      stats: { likes: +(data.stats && data.stats.likes) || 0, reposts: +(data.stats && data.stats.reposts) || 0, favorites: +(data.stats && data.stats.favorites) || 0, views: +(data.stats && data.stats.views) || 0 },
      likedBy: [], favBy: [], comments: [], createdAt, visibility: 'public',
      about: job.protagonist ? { kind: job.protagonist.kind, id: job.protagonist.id } : null
    };
    if (job.topic) post.topic = job.topic;
    // 类型兜底：模型漏写专属字段时自动补全或降级，保证卡片与详情可正常渲染
    if (post.type === 'poll' && (!post.poll || post.poll.options.length < 2)) post.type = 'moment';
    if (post.type === 'review' && !post.review) post.review = { subject: post.title || '测评对象', category: '测评', rating: 4 };
    if (post.type === 'thread' && (!post.thread || !post.thread.length)) post.thread = F.plain(post.content).split(/\n+/).filter(Boolean).slice(0, 8);
    if (post.type === 'thread' && !post.thread.length) post.type = 'moment';
    if (post.type === 'photo' && !post.images.length) post.images = [{ desc: F.plain(post.content).slice(0, 40), seed: F.uid('im') }];
    post.comments = this.buildComments(wid, data.comments, createdAt);
    F.state.posts.push(post);
    return post;
  },

  /* ---------------- 回复用户评论（自动触发） ---------------- */
  async replyToUser(post, { comment, reply, text }) {
    const w = F.world(post.worldId);
    const me = F.me();
    const postAuthor = F.person(post.author);
    // 决定谁来回：回复某条评论 → 该条作者；直接评论帖子 → 帖子作者
    let target = reply ? reply.author : comment ? comment.author : post.author;
    if (target.kind === 'user') target = post.author.kind === 'user' ? null : post.author;
    const tp = target ? F.person(target) : null;
    let persona = '';
    if (tp && tp.kind === 'char') persona = await this.charContext(F.charProfile(tp.id));
    else if (tp) persona = `@${tp.handle}｜${tp.nickname}｜${tp.persona || tp.bio || ''}`;
    const thread = comment ? [`${F.person(comment.author).nickname}：${comment.text}`, ...(comment.replies || []).slice(-8).map(r => `${F.person(r.author).nickname} 回复 ${r.replyToName || ''}：${r.text}`)] : [];
    const imgs = this.imageParts(post);
    const content = `【存档设定】\n${await this.worldContext(w)}\n\n【用户（我）资料】\n${this.userContext(me)}\n
【帖子】作者 @${postAuthor.handle}（${postAuthor.nickname}）｜类型：${F.typeName(post.type)}
${post.title ? '标题：' + post.title + '\n' : ''}正文：${this.postBody(post).slice(0, 3000)}
${imgs.text}
${thread.length ? '\n【所在评论楼】\n' + thread.join('\n') : ''}

【我刚刚发出的内容】${reply ? `回复 ${F.person(reply.author).nickname}：` : comment ? `回复 ${F.person(comment.author).nickname}：` : '评论：'}${text}

请生成对我这条内容的回复：${tp ? `第一条必须由 @${tp.handle}（${tp.nickname}）回复，完全符合其人设：\n${persona}\n` : '由评论区里的网友回复。'}可以再追加 0~1 条其他网友/博主的自然接话。回复要针对我说的内容，有来有回，不要复读。
输出 JSON：{"replies":[{"handle":"","nickname":"","text":"","likes":0}]}`;
    const msgs = [{ role: 'system', content: this.baseRules() }, { role: 'user', content: imgs.parts.length ? [{ type: 'text', text: content }, ...imgs.parts] : content }];
    const data = await this.callJSON(msgs, { maxTokens: 2400 });
    const reps = Array.isArray(data.replies) ? data.replies : [];
    return reps.filter(r => r && r.text).map((r, i) => {
      const author = (i === 0 && target) ? target : this.ensureNpc(post.worldId, r);
      return { id: F.uid('rp'), author, text: String(r.text), likes: +r.likes || 0, likedBy: [], time: Date.now() + i * 1000 };
    });
  },

  /* ---------------- 刷新数据 + 生成新评论（用户手动触发） ---------------- */
  async refreshPost(post) {
    const w = F.world(post.worldId);
    const pa = F.person(post.author);
    const existing = (post.comments || []).slice(-12);
    const mention = post.mentions || [];
    const chars = F.state.charProfiles.filter(c => mention.includes(c.id) || (c.gen && c.gen.joinDefault && c.gen.role !== 'author' && (!w || !w.defaultChars.length || w.defaultChars.includes(c.id))));
    chars.sort((a, b) => mention.includes(b.id) - mention.includes(a.id));
    let charBlock = '';
    for (const cp of chars.slice(0, 3)) charBlock += `\n【角色 @${cp.handle}】\n${await this.charContext(cp)}\n`;
    const imgs = this.imageParts(post);
    const content = `【存档设定】\n${await this.worldContext(w)}\n\n【用户（我）资料】\n${this.userContext(F.me())}\n${charBlock ? '\n【可以出现在评论区的角色】' + charBlock : ''}
【帖子】作者 @${pa.handle}（${pa.nickname}）${pa.kind === 'user' ? '——这是用户本人发的帖子' : ''}｜类型：${F.typeName(post.type)}｜发布于 ${F.ago(post.createdAt)}
${post.title ? '标题：' + post.title + '\n' : ''}正文：${this.postBody(post).slice(0, 3000)}
${imgs.text}
当前数据：赞 ${F.likeCount(post)}，转发 ${post.stats.reposts}，收藏 ${F.favCount(post)}，浏览 ${post.stats.views}
【已有评论（编号）】
${existing.map((c, i) => `[${i}] ${F.person(c.author).nickname}：${c.text}${(c.replies || []).length ? `（${c.replies.length} 条回复）` : ''}`).join('\n') || '（暂无）'}

请模拟这条帖子之后一段时间的发展：
1. statsDelta：各项数据的增量（合理、与热度匹配，浏览增长最多）。
2. newFollowers：作者因此新增的粉丝数（0 或合理的小数目）。
3. comments：4~8 条新的一级评论（不要和已有评论重复观点），其中部分带回复。
4. replies：2~5 条对已有评论的楼中楼回复，用 toIndex 指向上面的编号。
输出 JSON：{"statsDelta":{"likes":0,"reposts":0,"favorites":0,"views":0},"newFollowers":0,"comments":[{"handle":"","nickname":"","verified":false,"text":"","likes":0,"replies":[{"handle":"","nickname":"","replyTo":"","text":"","likes":0}]}],"replies":[{"toIndex":0,"handle":"","nickname":"","replyTo":"","text":"","likes":0}]}`;
    const msgs = [{ role: 'system', content: this.baseRules() }, { role: 'user', content: imgs.parts.length ? [{ type: 'text', text: content }, ...imgs.parts] : content }];
    const d = await this.callJSON(msgs, {});
    const sd = d.statsDelta || {};
    ['likes', 'reposts', 'favorites', 'views'].forEach(k => post.stats[k] = (post.stats[k] || 0) + Math.max(0, +sd[k] || 0));
    const newC = this.buildComments(post.worldId, d.comments, Date.now() - 600000);
    post.comments.push(...newC);
    (Array.isArray(d.replies) ? d.replies : []).forEach(r => {
      const target = existing[+r.toIndex];
      if (!target || !r.text) return;
      target.replies.push({ id: F.uid('rp'), author: this.ensureNpc(post.worldId, r), replyTo: null, replyToName: r.replyTo || F.person(target.author).nickname, text: String(r.text), likes: +r.likes || 0, likedBy: [], time: Date.now() });
    });
    if (post.author.kind === 'user') { const u = F.identity(post.author.id); if (u) u.base.followers += Math.max(0, +d.newFollowers || 0); }
    if (post.author.kind === 'char') { const c = F.charProfile(post.author.id); if (c) c.base.followers += Math.max(0, +d.newFollowers || 0); }
    if (post.author.kind === 'npc') { const n = F.npc(post.author.id); if (n) n.followers += Math.max(0, +d.newFollowers || 0); }
    return { added: newC.length };
  },

  /* ---------------- 私信回复（用户点按“请 TA 回复”才触发） ---------------- */
  async personaOf(ref) {
    const p = F.person(ref);
    if (p.kind === 'char') return await this.charContext(F.charProfile(p.id));
    if (p.kind === 'npc') return `@${p.handle}｜${p.nickname}｜人设：${p.persona || '（依据简介与发帖推断）'}｜简介：${p.bio || ''}${p.verifiedTitle ? '｜认证：' + p.verifiedTitle : ''}${p.location ? '｜常驻：' + p.location : ''}\n所在世界：\n${await this.worldContext(F.world(p.worldId))}`;
    return this.userContext(p);
  },
  msgText(m) {
    if (m.share) { const o = F.item(m.share.kind, m.share.id); return `[分享了${m.share.kind === 'video' ? '视频' : '帖子'}：${o ? (o.title || F.plain(o.content || '').slice(0, 40)) : '已删除'}]${m.text ? ' ' + m.text : ''}`; }
    return m.text;
  },
  async dmReply(thread) {
    const peer = F.person(thread.peer);
    const me = F.identity(thread.identityId) || F.me();
    const persona = await this.personaOf(thread.peer);
    const recent = [...F.postsBy(thread.peer), ...F.videosBy(thread.peer)].slice(0, 4).map(p => '- ' + (p.title || F.plain(p.content || '').slice(0, 50))).join('\n');
    const hist = thread.messages.slice(-40).map(m => `[${new Date(m.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}] ${m.from === 'me' ? '我' : peer.nickname}：${this.msgText(m)}`).join('\n');
    const n = 2 + Math.floor(Math.random() * 4);
    const peerLoc = peer.location || (peer.kind === 'char' && F.charProfile(peer.id).location) || '';
    const content = `你现在扮演论坛用户 @${peer.handle}（${peer.nickname}），在私信里和我聊天。
【你的资料与人设——必须严格遵守，不能 OOC】
${persona}
${recent ? '【你最近发的内容】\n' + recent + '\n' : ''}
【我的资料】
${this.userContext(me)}

【时间与地点】
现在是 ${F.timeCtx()}。
我所在的位置：${me.location || '未知（不要乱编具体地点，可以自然地问）'}；你所在的位置：${peerLoc || '按你的设定'}。
要对时间有感知：深夜/清晨/饭点/工作日/周末的状态不同；距离上一条消息隔了很久要有相应反应。

【私信记录】
${hist}

回复规则：
1. 完全用你的口吻、用词、口头禅、对我的称呼与关系说话，性格前后一致，不要变成客服或温柔模板。
2. 像真人打字那样分条发送：这次发 ${n} 条左右（可以多一条或少一条，但至少 2 条），每条长短不一。
3. 针对我最后说的话回应，可以追问、吐槽、分享自己此刻在做的事；不要复述我的话，不要替我说话，不要 emoji。
输出 JSON：{"messages":["第一条","第二条"]}`;
    const d = await this.callJSON([{ role: 'system', content: this.baseRules() }, { role: 'user', content }], { maxTokens: 2400 });
    let out = (Array.isArray(d.messages) ? d.messages : []).map(String).map(x => x.trim()).filter(Boolean);
    if (out.length === 1) {
      const parts = out[0].split(/(?<=[。！？!?…~])/).map(x => x.trim()).filter(Boolean);
      if (parts.length >= 2) { const mid = Math.ceil(parts.length / 2); out = [parts.slice(0, mid).join(''), parts.slice(mid).join('')]; }
    }
    return out.slice(0, 7);
  },

  /* ---------------- 来信：根据存档推荐私信（用户点按触发） ---------------- */
  async inbox(world, count = 4) {
    const me = F.me();
    const verified = me.verify && me.verify.status === 'verified';
    const chars = F.state.charProfiles.filter(c => !world || !world.defaultChars.length || world.defaultChars.includes(c.id)).slice(0, 4);
    let charBlock = '';
    for (const cp of chars) charBlock += `\n【角色 @${cp.handle}】\n${await this.charContext(cp)}\n`;
    const npcs = world ? this.worldNpcs(world.id).slice(0, 12) : [];
    const myPosts = F.postsBy({ kind: 'user', id: me.id }).slice(0, 5).map(p => '- ' + (p.title || F.plain(p.content).slice(0, 40))).join('\n');
    const content = `【存档设定】\n${await this.worldContext(world)}\n\n【收信人（我）】\n${this.userContext(me)}\n${myPosts ? '【我最近发的帖子】\n' + myPosts + '\n' : ''}
【当前时间】${F.timeCtx()}；我的位置：${me.location || '未知'}
${charBlock ? '【可能来信的角色】' + charBlock : ''}${npcs.length ? '\n【这个世界里已有的博主（可复用，handle 必须一致）】\n' + npcs.map(n => `@${n.handle}｜${n.nickname}｜${n.persona || n.bio || ''}`).join('\n') : ''}

请生成 ${count} 段别人主动发给我的私信。${verified ? '我是认证博主：来信可以有粉丝表白与催更、商务合作邀约、同行交流、黑粉挑衅、后援会对接等。' : '我是普通用户：来信可以是朋友闲聊、同好搭话、看到我帖子来求助或讨论、网友搭讪、二手交易、小区邻居等，不要出现商务合作。'}
要求：来信人各不相同，符合世界观和各自人设，和我的资料/帖子有关联；每段 2~5 条消息（条数各不相同），语气自然像真人；角色来信必须符合其人设与和我的关系；不要 emoji。
输出 JSON：{"threads":[{"handle":"","nickname":"","bio":"一句话简介","persona":"一句话人设","messages":["",""]}]}`;
    const d = await this.callJSON([{ role: 'system', content: this.baseRules() }, { role: 'user', content }], { maxTokens: Math.max(4000, F.state.settings.maxTokens) });
    return Array.isArray(d.threads) ? d.threads.filter(t => t && Array.isArray(t.messages) && t.messages.length) : [];
  },

  /* ---------------- 正主体系 ---------------- */
  async protagonistBlock(job) {
    const pr = job.protagonist; if (!pr) return '';
    const p = F.person(pr);
    const ctx = pr.kind === 'char' ? await this.charContext(F.charProfile(pr.id)) : this.userContext(F.identity(pr.id));
    const scale = { '小有名气': '粉丝数万，讨论集中在圈内', '当红': '粉丝百万级，常上热搜', '顶流': '粉丝千万级，一举一动都是热搜，本人帖子点赞十万以上起步' }[pr.fame] || '';
    return `
【正主设定——本批内容的主人公】
正主：@${p.handle}（${p.nickname}）｜名气：${pr.fame}（${scale}）｜舆论倾向：${pr.tone}
${ctx}
正主规则：
1. 内容要围绕正主展开，但视角要多样：粉丝安利与应援、路人吃瓜、营销号搬运、站姐/后援会、CP 向、黑粉与反黑、业内人士爆料、官方账号等。
2. 网友对正主的称呼、了解的信息都要基于上面的资料，不能编造与设定冲突的经历；可以有合理的传闻与误会。
3. 正主本人发的内容，数据要远超普通网友，评论区会有大量粉丝控评、“前排”、应援口号${pr.fame === '顶流' ? '，数据是千万级博主的量级' : ''}。
4. 舆论倾向为“${pr.tone}”：${pr.tone === '好评为主' ? '以正面评价为主，偶有理性质疑' : pr.tone === '争议风波' ? '围绕一件争议事件，支持与反对激烈对立，但不要恶意造谣' : '支持与批评并存，立场分明'}。
${pr.kind === 'user' ? '5. 正主就是用户本人：只能由别人讨论、@我、转述我，绝对不能替我发帖、评论或编造我的原话。' : '5. 正主是角色：若本篇作者就是正主，要用其本人的人设与口吻，并体现名人的发帖习惯（官宣、营业、回应）。'}
`;
  },

  /* ---------------- 伪视频生成 ---------------- */
  async genVideo(job, { onDelta, signal, onRetry } = {}) {
    const w = F.world(job.worldId);
    const T = F.VTYPES[job.type];
    const me = F.me();
    const chars = (job.chars || []).map(F.charProfile).filter(Boolean);
    let charBlock = '';
    for (const cp of chars) charBlock += `\n【角色 @${cp.handle}】\n${await this.charContext(cp)}\n`;
    const npcs = w ? this.worldNpcs(w.id).slice(0, 14) : [];
    const recent = F.state.videos.filter(v => w ? v.worldId === w.id : !v.worldId).slice(-8).map(v => '- ' + v.title);
    let authorLine = '作者是这个世界里的一位视频博主（author.type 填 "npc"），可以复用已有博主（handle 必须一致）也可以新建。';
    if (job.authorChar) { const c = F.charProfile(job.authorChar); authorLine = `作者固定为角色 @${c.handle}（${c.nickname}），author.type 填 "char"，完全按其人设出镜、说话。`; }
    if (job.authorNpc) { const n = F.npc(job.authorNpc); authorLine = `作者固定为博主 @${n.handle}（${n.nickname}），author.type 填 "npc"，handle 必须填 "${n.handle}"。TA 的设定：${n.persona || n.bio || ''}`; }
    const content = `【存档设定——全部都要读取并遵循】
${await this.worldContext(w)}

【用户（我）的资料——可被提及，但不能替我出镜说话】
${this.userContext(me)}
${charBlock ? '\n【参与本次生成的角色】' + charBlock : ''}${npcs.length ? `\n【已存在的博主（可复用）】\n${npcs.map(n => `@${n.handle}｜${n.nickname}｜${n.persona || n.bio || ''}`).join('\n')}` : ''}
${recent.length ? `\n【近期已有视频（避免重复）】\n${recent.join('\n')}` : ''}
${await this.protagonistBlock(job)}
【当前时间】${F.timeCtx()}
${job.extra ? `【本次侧重】${job.extra}\n` : ''}
【任务】生成一条竖屏短视频的“逐帧脚本”，类型：${T.name}——${T.spec}
${authorLine}
这是用文字模拟的视频：每一帧写清楚画面、谁在说话、说了什么、屏幕上的花字与音效，读起来要像真的在看这条视频。
帧要求：8~16 帧，按时间顺序；每帧的 bg 从这些场景里选一个最贴切的：room(室内) street(街道) night(夜景) rain(雨天) neon(霓虹) nature(自然/山林) sea(海边) snow(雪景) cafe(咖啡店/餐馆) stage(舞台/演出) studio(录影棚/纯色背景) food(美食特写) crowd(人群/现场) car(车内) window(窗边) screen(屏幕录制/游戏画面)；tone 为 light 或 dark；motion 为镜头运动 still/zoomIn/zoomOut/panL/panR/shake/drift 之一。
line 是这一帧的台词或旁白（可空），text 是屏幕花字（可空，简短有梗），sfx 是音效（可空）。
评论区：6~10 条一级评论，约一半带 1~3 条回复，像短视频平台的评论（玩梗、时间戳“2:13 那里”、@朋友来看）。

输出 JSON：
{"author":{"type":"npc 或 char","handle":"","nickname":"","bio":"","verified":false,"verifiedTitle":"","followers":0,"following":0,"likes":0,"location":"","persona":""},
 "video":{"title":"视频配文（带情绪，可含#话题#）","topic":"话题（不带#）","tags":[""],"music":"背景音乐：歌名 - 歌手（可虚构）","location":"",
   "frames":[{"scene":"画面描述 20~60 字","bg":"room","tone":"light","motion":"zoomIn","speaker":"说话人，旁白写 旁白","line":"","text":"","sfx":""}]},
 "stats":{"likes":0,"reposts":0,"favorites":0,"views":0},
 "comments":[{"handle":"","nickname":"","verified":false,"text":"","likes":0,"replies":[{"handle":"","nickname":"","replyTo":"","text":"","likes":0}]}]}`;
    return this.callJSON([{ role: 'system', content: this.baseRules() }, { role: 'user', content }], { onDelta, signal, onRetry, maxTokens: Math.max(12000, F.state.settings.maxTokens) });
  },
  ingestVideo(job, data) {
    const w = F.world(job.worldId); const wid = w ? w.id : null;
    let author;
    if (job.authorChar) author = { kind: 'char', id: job.authorChar };
    else if (job.authorNpc && F.npc(job.authorNpc)) author = { kind: 'npc', id: job.authorNpc };
    else author = this.ensureNpc(wid, Object.assign({}, data.author, { handle: data.author && data.author.type === 'char' ? 'npc_' + (data.author.handle || '') : data.author && data.author.handle }));
    const V = data.video || {};
    const BG = ['room', 'street', 'night', 'rain', 'neon', 'nature', 'sea', 'snow', 'cafe', 'stage', 'studio', 'food', 'crowd', 'car', 'window', 'screen'];
    const MV = ['still', 'zoomIn', 'zoomOut', 'panL', 'panR', 'shake', 'drift'];
    const frames = (Array.isArray(V.frames) ? V.frames : []).filter(f => f && (f.scene || f.line || f.text)).slice(0, 20).map(f => {
      const line = String(f.line || ''), text = String(f.text || '');
      return {
        scene: String(f.scene || ''), bg: BG.includes(f.bg) ? f.bg : 'studio', tone: f.tone === 'dark' ? 'dark' : 'light', motion: MV.includes(f.motion) ? f.motion : 'drift',
        speaker: String(f.speaker || ''), line, text, sfx: String(f.sfx || ''),
        dur: F.clamp(1.8 + line.length * 0.2 + text.length * 0.08, 2.2, 9)
      };
    });
    if (!frames.length) throw new Error('视频脚本为空');
    const createdAt = Date.now() - Math.floor(Math.random() * 3600e3 * 5);
    const v = {
      id: F.uid('v'), worldId: wid, type: job.type, author, title: V.title || '', topic: String(V.topic || '').replace(/^#|#$/g, ''),
      tags: (Array.isArray(V.tags) ? V.tags : []).map(t => String(t).replace(/^#|#$/g, '')).slice(0, 6), music: V.music || '', location: V.location || '',
      frames, duration: frames.reduce((a, f) => a + f.dur, 0),
      stats: { likes: +(data.stats && data.stats.likes) || 0, reposts: +(data.stats && data.stats.reposts) || 0, favorites: +(data.stats && data.stats.favorites) || 0, views: +(data.stats && data.stats.views) || 0 },
      likedBy: [], favBy: [], comments: [], createdAt, about: job.protagonist ? { kind: job.protagonist.kind, id: job.protagonist.id } : null
    };
    if (job.topic) v.topic = job.topic;
    v.comments = this.buildComments(wid, data.comments, createdAt);
    F.state.videos.push(v);
    return v;
  },

  /* ---------------- 热搜榜生成 ---------------- */
  async hotlist(world) {
    const posts = [...F.state.posts.filter(p => p.worldId === world.id && p.type !== 'repost'), ...F.state.videos.filter(v => v.worldId === world.id)]
      .sort((a, b) => (F.likeCount(b) + F.commentCount(b) * 3) - (F.likeCount(a) + F.commentCount(a) * 3)).slice(0, 30);
    const pr = world.protagonist && world.protagonist.id ? F.person(world.protagonist) : null;
    const content = `【存档设定】\n${await this.worldContext(world)}\n\n【用户（我）】\n${this.userContext(F.me())}\n${pr ? `【这个世界的正主】@${pr.handle}（${pr.nickname}），名气：${world.protagonist.fame}\n` : ''}
【当前时间】${F.timeCtx()}
【已有的热门内容（编号）】
${posts.map((p, i) => `[${i}] #${p.topic || (p.tags || [])[0] || '无话题'}# ${F.person(p.author).nickname}：${(p.title || F.plain(p.content || '')).slice(0, 40)}｜赞 ${F.likeCount(p)}｜评论 ${F.commentCount(p)}`).join('\n') || '（暂无）'}

请生成这个世界此刻的热搜榜，共 50 条，按热度从高到低：
- 已有内容的话题要优先上榜，并用 trigger.postIndex 指向引爆它的那条内容编号；新话题 postIndex 填 -1，并写出引爆者与引爆内容概述。
- 话题要贴合世界观、正在发生的事与网友群像，覆盖不同领域，有真实热搜的语感（有的像新闻标题，有的像网友口头禅）。
- 前 20 条给出完整字段；第 21~50 条只需要 title、heat、tag、category、trend。
- tag 取值：爆 沸 热 新 荐 独家 或 空字符串；trend 取值：up down new same；since 为上榜时间（如“今天 14:32”“昨天 22:10”）；peak 为最高排名；hours 为在榜时长（小时，可带小数）；reads 阅读量；discuss 讨论量；lead 为 30~60 字导语。
输出 JSON：{"items":[{"title":"","heat":0,"tag":"","category":"","trend":"up","since":"","peak":1,"hours":1.5,"reads":0,"discuss":0,"lead":"","trigger":{"postIndex":-1,"handle":"","nickname":"","summary":""}}]}`;
    const d = await this.callJSON([{ role: 'system', content: this.baseRules() }, { role: 'user', content }], { maxTokens: Math.max(16000, F.state.settings.maxTokens) });
    const items = (Array.isArray(d.items) ? d.items : []).filter(x => x && x.title).slice(0, 50).map((x, i) => {
      const t = x.trigger || {};
      const src = posts[+t.postIndex];
      return {
        rank: i + 1, title: String(x.title).replace(/^#|#$/g, ''), heat: +x.heat || Math.round(5e6 / (i + 1)), tag: x.tag || '', category: x.category || '',
        trend: x.trend || 'same', since: x.since || '', peak: +x.peak || i + 1, hours: +x.hours || 0, reads: +x.reads || 0, discuss: +x.discuss || 0, lead: x.lead || '',
        trigger: src ? { ref: { kind: src.frames ? 'video' : 'post', id: src.id } } : (t.summary ? { handle: t.handle || '', nickname: t.nickname || '', summary: t.summary } : null)
      };
    });
    F.state.hotlists[world.id] = { at: Date.now(), items };
    return items;
  },

  /* ---------------- 帖子正文与图片（识图 / 文字描述） ---------------- */
  postBody(p) {
    if (p.frames) return `视频《${p.title || ''}》\n` + p.frames.map((f, i) => `[${i + 1}] 画面：${f.scene}${f.line ? `｜${f.speaker || '旁白'}：${f.line}` : ''}${f.text ? `｜字幕：${f.text}` : ''}`).join('\n');
    if (p.type === 'repost') { const o = p.ref && F.item(p.ref.kind, p.ref.id); return `转发语：${p.content || '转发'}\n被转发内容：${o ? (o.title || F.plain(o.content || '').slice(0, 200)) : '（已删除）'}`; }
    let s = p.content || '';
    if (p.thread) s = p.thread.map((t, i) => `(${i + 1}/${p.thread.length}) ${t}`).join('\n');
    if (p.poll) s += `\n投票：${p.poll.question}｜${p.poll.options.map(o => o.text).join(' / ')}`;
    if (p.review) s = `测评对象：${p.review.subject}（${p.review.category}）评分 ${p.review.rating}\n` + s;
    return s;
  },
  imageParts(p) {
    const imgs = p.images || [];
    if (!imgs.length) return { text: '', parts: [] };
    const vision = F.state.settings.vision;
    const parts = [], desc = [];
    imgs.forEach((im, i) => {
      if (im.src && vision && parts.length < 6) parts.push({ type: 'image_url', image_url: { url: im.src } });
      else if (im.desc && (im.aiDesc !== false)) desc.push(`图${i + 1}：${im.desc}`);
    });
    const text = desc.length ? `配图描述：\n${desc.join('\n')}` : (parts.length ? `（附 ${parts.length} 张配图，请结合图片内容）` : `（附 ${imgs.length} 张图片，未提供描述）`);
    return { text, parts };
  }
};

/* ---------------- 批量生成队列：一篇一次调用，逐篇落盘 ---------------- */
F.gen = {
  running: false, ctrl: null,
  async run(jobs, onUpdate) {
    this.running = true; this.ctrl = new AbortController();
    const results = [];
    for (let i = 0; i < jobs.length; i++) {
      if (this.ctrl.signal.aborted) break;
      const job = jobs[i];
      job.status = 'writing'; job.chars_out = 0; onUpdate({ i, job, phase: 'start' });
      try {
        const isV = job.kind === 'video';
        const data = await (isV ? F.ai.genVideo : F.ai.generatePost).call(F.ai, job, {
          signal: this.ctrl.signal,
          onDelta: txt => { job.chars_out = txt.length; onUpdate({ i, job, phase: 'delta', txt }); },
          onRetry: () => onUpdate({ i, job, phase: 'retry' })
        });
        job.status = 'parsing'; onUpdate({ i, job, phase: 'parse' });
        const post = isV ? F.ai.ingestVideo(job, data) : F.ai.ingestPost(job, data);
        const w = F.world(job.worldId); if (w) w.lastGenAt = Date.now();
        await F.save('posts', 'videos', 'npcs', 'worlds', 'charProfiles');
        job.status = 'done'; job.postId = post.id; results.push(post);
        onUpdate({ i, job, phase: 'done', post });
      } catch (e) {
        if (this.ctrl.signal.aborted) { job.status = 'cancel'; onUpdate({ i, job, phase: 'cancel' }); break; }
        job.status = 'fail'; job.error = e.message; onUpdate({ i, job, phase: 'fail', error: e });
      }
    }
    this.running = false;
    return results;
  },
  cancel() { this.ctrl && this.ctrl.abort(); }
};

/* ---------------- 角色自主发帖：按频率在打开论坛时检查 ---------------- */
F.autoPost = async () => {
  if (!F.ai.ready()) return;
  const due = { open: 0, hourly: 3600e3, daily: 86400e3, '3days': 3 * 86400e3, weekly: 7 * 86400e3 };
  for (const cp of F.state.charProfiles) {
    const a = cp.auto;
    if (!a || !a.enabled) continue;
    const gap = due[a.freq] ?? 86400e3;
    if (Date.now() - (a.lastAt || 0) < gap) continue;
    a.lastAt = Date.now(); await F.save('charProfiles');
    const types = a.types && a.types.length ? a.types : ['moment'];
    const job = { index: 0, type: types[Math.floor(Math.random() * types.length)], worldId: a.worldId || null, authorChar: cp.id, chars: [cp.id], extra: '这是角色自主发布的日常帖子。' };
    job.roles = { [cp.id]: 'author' };
    try {
      const d = await F.ai.generatePost(job, {});
      F.ai.ingestPost(job, d);
      await F.save('posts', 'npcs');
      F.toast(`${cp.nickname} 发布了新帖子`, 'spark');
    } catch (e) { console.warn('自主发帖失败', e); }
  }
};