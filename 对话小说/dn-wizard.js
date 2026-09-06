/* ==========================================================
   dn-wizard.js — 建档七步
   ========================================================== */
const W = {
  step: 1,
  introMode: 'self',
  intro: '',
  title: '',
  nameHistory: [],
  styleMode: 'self',
  style: null,        // {name, desc, sample}
  styleOptions: [],
  roleCount: 2,
  cpCount: 1,
  titleTones: [],
  lockChars: [],
  chars: [],
  pairs: [],
  relation: null,
  cover: '',
  wordMin: 180,
  wordMax: 420,
  chapterCount: 12
};

function startWizard() {
  Object.assign(W, {
    step: 1, introMode: 'self', intro: '', title: '', nameHistory: [],
    styleMode: 'self', style: null, styleOptions: [],
    roleCount: 2, cpCount: 1, titleTones: [], lockChars: [], chars: [], pairs: [], relation: null,
    cover: '', wordMin: 180, wordMax: 420, chapterCount: 12
  });
  document.getElementById('introInput').value = '';
  document.getElementById('introTags').value = '';
  document.getElementById('introScale').value = '';
  document.getElementById('titleInput').value = '';
  document.getElementById('styleInput').value = '';
  document.getElementById('charWish').value = '';
  document.getElementById('nameGrid').innerHTML = '';
  document.getElementById('styleList').innerHTML = '';
  document.getElementById('charWrap').innerHTML = '';
  document.getElementById('relCards').innerHTML = '';
  document.getElementById('relSvg').innerHTML = '';
  document.getElementById('relStage').classList.remove('ready');
  document.getElementById('charRedo').classList.remove('show');
  document.querySelectorAll('#toneRack .tone').forEach(t => t.classList.remove('on'));
  renderLockList();
  document.getElementById('introOut').classList.remove('show');
  document.getElementById('introOut').innerHTML = '';
  document.getElementById('coverPick').classList.remove('has');
  document.getElementById('coverPick').style.backgroundImage = '';
  document.getElementById('roleCount').textContent = 2;
  document.getElementById('cpCount').textContent = 1;
  updateCalc();
  wzGo(1);
  dnOpenPage('page-wizard');
}

function wzGo(n) {
  W.step = Math.min(7, Math.max(1, n));
  document.querySelectorAll('.wz-step').forEach(el => el.classList.toggle('active', +el.dataset.step === W.step));
  document.getElementById('wzIdx').textContent = W.step;
  const names = ['', '确定内容', '确定书名', '确定文风', '角色与 CP', '关系网', '封面与参数', '归档'];
  document.getElementById('wzTitle').textContent = '建档 · ' + names[W.step];
  const rail = document.getElementById('wzRail');
  if (rail.children.length !== 7) rail.innerHTML = '<i></i>'.repeat(7);
  [...rail.children].forEach((el, i) => el.classList.toggle('done', i < W.step));
  document.getElementById('wzPrev').style.visibility = W.step === 1 ? 'hidden' : 'visible';
  document.getElementById('wzNext').style.display = W.step === 7 ? 'none' : '';
  document.getElementById('page-wizard').scrollTop = 0;
  if (W.step === 7) renderFinal();
}

/* ---------- 校验 ---------- */
function wzValidate() {
  if (W.step === 1) {
    const v = document.getElementById('introInput').value.trim();
    if (!v) { dnToast('请先确定故事简介'); return false; }
    W.intro = v; return true;
  }
  if (W.step === 2) {
    const v = document.getElementById('titleInput').value.trim();
    if (!v) { dnToast('请确定书名'); return false; }
    W.title = v; return true;
  }
  if (W.step === 3) {
    if (W.styleMode === 'self') {
      const v = document.getElementById('styleInput').value.trim();
      if (!v) { dnToast('请描述文风'); return false; }
      W.style = { name: '自定义文风', desc: v, sample: '' };
    }
    if (!W.style) { dnToast('请选定一套文风'); return false; }
    return true;
  }
  if (W.step === 4) {
    if (W.cpCount * 2 > W.roleCount) { dnToast('CP 人数超出了重要角色数'); return false; }
    if (!W.chars.length) { dnToast('请先生成人物档案'); return false; }
    return true;
  }
  if (W.step === 5) {
    if (!W.relation) { dnToast('请先生成关系网'); return false; }
    return true;
  }
  if (W.step === 6) {
    const a = +document.getElementById('wordMin').value;
    const b = +document.getElementById('wordMax').value;
    const c = +document.getElementById('chapCount').value;
    if (!a || !b || a < 50 || b <= a) { dnToast('字数区间不合法'); return false; }
    if (!c || c < 1) { dnToast('章节数不合法'); return false; }
    W.wordMin = a; W.wordMax = b; W.chapterCount = c;
    return true;
  }
  return true;
}

/* ================= 第一步 · 简介 ================= */
function initStep1() {
  document.querySelectorAll('[data-group="introMode"] .mode-card').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('[data-group="introMode"] .mode-card').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      W.introMode = el.dataset.v;
      const lb = document.getElementById('introLabel');
      const ta = document.getElementById('introInput');
      const line = document.getElementById('introActLine');
      if (W.introMode === 'self') {
        lb.textContent = '简介正文'; ta.placeholder = '写下你的故事简介……';
        line.style.display = 'none';
      } else if (W.introMode === 'polish') {
        lb.textContent = '你的梗概（AI 将扩写润色）'; ta.placeholder = '一句话也可以：她重生回到婚礼当天……';
        line.style.display = '';
      } else {
        lb.textContent = '你想看的主题（AI 自由发挥）'; ta.placeholder = '如：民国谍战 + 追妻火葬场';
        line.style.display = '';
      }
    };
  });
  document.getElementById('introActLine').style.display = 'none';

  document.getElementById('introGenBtn').onclick = async function () {
    const seed = document.getElementById('introInput').value.trim();
    if (!seed) return dnToast('先写一点内容或主题');
    const tags = document.getElementById('introTags').value.trim();
    const scale = document.getElementById('introScale').value.trim();
    const btn = this;
    btn.classList.add('on', 'busy');
    dnLoad(true, '构思中');
    try {
      const sys = '你是一位中文言情/对话体小说的资深策划。你写的简介要有钩子、有画面、有情绪张力，语言精致但不堆砌，避免网文口水与陈词滥调。禁止写成大纲式条目。';
      const ask = W.introMode === 'polish'
        ? `请把下面这段素材扩写、丰富、润色为一段 260–380 字的小说简介，保留原意与关键设定，补足人物动机、核心冲突与情绪张力：\n\n${seed}`
        : `请围绕主题「${seed}」自由创作一段 260–380 字的小说简介，要有明确的主角关系、核心矛盾与悬念钩子。`;
      const extra = (tags ? `\n题材关键词：${tags}` : '') + (scale ? `\n期望气质：${scale}` : '');
      const out = await DNAI.chat([
        { role: 'system', content: sys },
        { role: 'user', content: ask + extra + '\n\n只输出简介正文本身，不要标题、不要解释。' }
      ], { maxTokens: 2000 });
      const box = document.getElementById('introOut');
      box.innerHTML = `<div style="font-size:10px;letter-spacing:.24em;color:#a9a9b2;margin-bottom:10px">AI 生成</div>
        <div style="white-space:pre-wrap">${dnEsc(out)}</div>
        <div style="display:flex;gap:9px;margin-top:14px">
          <span class="stc-pick" id="introUse">采用</span>
          <span class="stc-try" id="introAgain">换一版</span>
        </div>`;
      box.classList.add('show');
      document.getElementById('introUse').onclick = () => {
        document.getElementById('introInput').value = out;
        W.intro = out;
        dnToast('已采用');
      };
      document.getElementById('introAgain').onclick = () => document.getElementById('introGenBtn').click();
    } catch (e) { dnToast(e.message); }
    finally { btn.classList.remove('busy'); dnLoad(false); }
  };
}

/* ================= 第二步 · 书名 ================= */
function initStep2() {
  document.querySelectorAll('#toneRack .tone').forEach(el => {
    el.onclick = () => {
      el.classList.toggle('on');
      W.titleTones = [...document.querySelectorAll('#toneRack .tone.on')].map(x => x.dataset.v);
    };
  });

  document.getElementById('titleGenBtn').onclick = async function () {
    const intro = document.getElementById('introInput').value.trim() || W.intro;
    if (!intro) return dnToast('请先完成第一步');
    this.classList.add('on', 'busy');
    dnLoad(true, '拟名中');
    try {
      const avoid = W.nameHistory.length
        ? `\n\n【必须避开】以下书名已出现过，本次全部不许重复，且切入角度要与它们明显不同：${W.nameHistory.join('、')}`
        : '';
      const tone = W.titleTones.length ? `\n用户指定调性：${W.titleTones.join('、')}（务必贴合）` : '';

      const sys = [
        '你是顶尖言情小说编辑，专职起书名。书名是一本书最重要的钩子，读者只看名字就要产生「点进去」的冲动。',
        '',
        '硬性标准：',
        '1. 绝对不许把简介的情节直白复述成书名（例如「重生后我嫁给了将军」这种流水账式命名一律不合格）。',
        '2. 必须有情绪张力或悬念留白：让人想问「谁？为什么？后来呢？」。',
        '3. 音韵要好听：读起来有节奏，避免生僻拗口字堆砌，避免三个以上名词硬拼。',
        '4. 5–9 字为佳，最多 12 字。',
        '',
        '可用的钩子范式（5 个候选必须分属不同范式）：',
        '· 台词式——像书里某人说出口的一句话，带称呼或语气（如「你别惹我心动」）',
        '· 意象式——一个具体的物件或场景承载全书情绪（如「雪落两三枝」「玫瑰刑」）',
        '· 反差式——两个矛盾的词并置，制造张力（如「温柔的恶徒」）',
        '· 悬念式——留一个未说完的缺口（如「他不肯说的那年」）',
        '· 身份式——用关系或称谓点出核心羁绊，但要有余味（如「他的第七任未婚妻」）',
        '',
        '禁止：书名里出现「重生」「穿越」「系统」「总裁」这类平台化标签词；禁止使用书名号；禁止解释性长句。'
      ].join('\n');

      const data = await DNAI.json(sys,
        `以下是这本对话体小说的简介：\n${intro}${tone}${avoid}\n\n请给出 5 个书名候选，五个分属五种不同范式。\n每个候选还要写：范式名（4字内）、以及这个名字的钩子在哪（hook，20字内，说明它为什么让人想点开）。\n随机种子：${Math.random().toString(36).slice(2)}\n\n返回 JSON：{"names":[{"title":"","angle":"范式名","hook":""}]}`,
        { maxTokens: 1800, temperature: 1.12 });

      const arr = (data.names || []).slice(0, 5);
      if (!arr.length) throw new Error('未生成候选');
      W.nameHistory.push(...arr.map(x => x.title));
      const grid = document.getElementById('nameGrid');
      grid.innerHTML = arr.map((n, i) => `
        <div class="ncard" style="animation-delay:${i * 55}ms;flex-direction:column;align-items:flex-start;gap:7px" data-t="${dnEsc(n.title)}">
          <div style="display:flex;align-items:baseline;gap:10px;width:100%">
            <b>${dnEsc(n.title)}</b><small style="margin-left:auto">${dnEsc(n.angle || '')}</small>
          </div>
          <small style="opacity:.85;line-height:1.6">${dnEsc(n.hook || '')}</small>
        </div>`).join('');
      grid.querySelectorAll('.ncard').forEach(el => {
        el.onclick = () => {
          grid.querySelectorAll('.ncard').forEach(c => c.classList.remove('picked'));
          el.classList.add('picked');
          document.getElementById('titleInput').value = el.dataset.t;
          W.title = el.dataset.t;
        };
      });
      this.querySelector('b').textContent = '不满意 · 换五个新角度';
    } catch (e) { dnToast(e.message); }
    finally { this.classList.remove('busy'); dnLoad(false); }
  };
}

/* ================= 第三步 · 文风 ================= */
function initStep3() {
  document.querySelectorAll('[data-group="styleMode"] .mode-card').forEach(el => {
    el.onclick = () => {
      document.querySelectorAll('[data-group="styleMode"] .mode-card').forEach(c => c.classList.remove('active'));
      el.classList.add('active');
      W.styleMode = el.dataset.v;
      document.getElementById('styleSelfBox').style.display = W.styleMode === 'self' ? '' : 'none';
      document.getElementById('styleActLine').style.display = W.styleMode === 'ai' ? '' : 'none';
      document.getElementById('styleList').innerHTML = '';
      W.style = null;
    };
  });

  document.getElementById('styleGenBtn').onclick = async function () {
    const intro = W.intro || document.getElementById('introInput').value.trim();
    this.classList.add('on', 'busy');
    dnLoad(true, '拟稿中');
    try {
      const data = await DNAI.json(
        '你是对话体小说的文风设计师。对话体小说以角色对白推动剧情，因此文风描述必须具体可执行：包括对白密度与长度、称呼与语气习惯、旁白的介入方式与长度、标点与节奏偏好、情绪表达方式、禁忌（不要写什么）。禁止空泛形容词堆砌。',
        `故事简介：\n${intro || '（暂无，请按通用言情对话体设定）'}\n\n请设计 3 套差异明显的文风方案。每套 description 用 120–180 字，写清楚上述可执行要点。\n随机种子：${Math.random().toString(36).slice(2)}\n\n返回 JSON：{"styles":[{"name":"文风名4-8字","description":""}]}`,
        { maxTokens: 2600, temperature: 1 }
      );
      W.styleOptions = (data.styles || []).slice(0, 3);
      renderStyleList();
      this.querySelector('b').textContent = '重新拟三套';
    } catch (e) { dnToast(e.message); }
    finally { this.classList.remove('busy'); dnLoad(false); }
  };
}

function renderStyleList() {
  const list = document.getElementById('styleList');
  list.innerHTML = W.styleOptions.map((s, i) => `
    <div class="stcard" data-i="${i}" style="animation-delay:${i * 60}ms">
      <div class="stc-h"><b>${dnEsc(s.name)}</b><span class="stc-pick" data-act="pick">选用</span></div>
      <div class="stc-d">${dnEsc(s.description)}</div>
      <div class="stc-acts"><span class="stc-try" data-act="try">试看这套文风</span></div>
      <div class="stc-sample" data-sample></div>
    </div>`).join('');

  list.querySelectorAll('.stcard').forEach(card => {
    const i = +card.dataset.i;
    card.querySelector('[data-act="pick"]').onclick = () => {
      list.querySelectorAll('.stcard').forEach(c => c.classList.remove('picked'));
      card.classList.add('picked');
      W.style = {
        name: W.styleOptions[i].name,
        desc: W.styleOptions[i].description,
        sample: W.styleOptions[i].sample || ''
      };
      dnToast('已选用「' + W.style.name + '」');
    };
    card.querySelector('[data-act="try"]').onclick = async (e) => {
      const box = card.querySelector('[data-sample]');
      const btn = e.currentTarget;
      btn.textContent = '生成中…';
      try {
        const txt = await DNAI.chat([
          { role: 'system', content: '你是对话体小说作者。用给定文风写一段试看片段，必须包含旁白与至少 4 句角色对白，对白用「角色名：内容」的形式，旁白单独成行以（）包裹。总长 160–240 字。' },
          { role: 'user', content: `文风：${W.styleOptions[i].name}\n${W.styleOptions[i].description}\n\n故事背景：${(W.intro || '自由发挥').slice(0, 300)}\n\n只输出片段本身。` }
        ], { maxTokens: 1400 });
        W.styleOptions[i].sample = txt;
        box.textContent = txt;
        box.classList.add('show');
        btn.textContent = '重新试看';
      } catch (err) { dnToast(err.message); btn.textContent = '试看这套文风'; }
    };
  });
}

/* ================= 第四步 · CP 与角色 ================= */
function updateCalc() {
  const strip = document.getElementById('calcStrip');
  const r = W.roleCount, c = W.cpCount;
  const inCp = c * 2, solo = r - inCp;
  const bad = inCp > r;
  strip.classList.toggle('warn', bad);
  strip.innerHTML = bad
    ? `CP 需要 <em>${inCp}</em> 人，但重要角色只有 <em>${r}</em> 位。请调整。`
    : `共 <em>${r}</em> 位重要角色：<em>${c}</em> 对 CP（占 <em>${inCp}</em> 人，第 1 对为男女主），其余 <em>${solo}</em> 位为独立重要角色（无固定感情线归属）。`;
}
function renderLockList() {
  const box = document.getElementById('lockList');
  if (!box) return;
  box.innerHTML = W.lockChars.length
    ? W.lockChars.map((c, i) => `<div class="lock-tag">${dnEsc(c.name)}<i>${dnEsc(c.gender || '未定')}</i><b data-rm="${i}">✕</b></div>`).join('')
    : '<div class="lock-empty">还没有锁定角色。若简介里已写了人名，请先点「从简介识别角色」，AI 就不会擅自改名。</div>';
  box.querySelectorAll('[data-rm]').forEach(el => {
    el.onclick = () => { W.lockChars.splice(+el.dataset.rm, 1); renderLockList(); };
  });
  const rest = Math.max(0, W.roleCount - W.lockChars.length);
  document.getElementById('lockMeta').textContent =
    `已锁定 ${W.lockChars.length} 位 · AI 补足 ${rest} 位`;
}

function initStep4() {
  document.querySelectorAll('.stepper span').forEach(el => {
    el.onclick = () => {
      const t = el.dataset.t;
      const d = el.dataset.act === 'inc' ? 1 : -1;
      if (t === 'roleCount') W.roleCount = Math.max(2, Math.min(12, W.roleCount + d));
      else W.cpCount = Math.max(1, Math.min(6, W.cpCount + d));
      document.getElementById('roleCount').textContent = W.roleCount;
      document.getElementById('cpCount').textContent = W.cpCount;
      updateCalc(); renderLockList();
    };
  });

  /* 从用户提供的简介中识别既有角色，姓名锁定 */
  document.getElementById('lockExtract').onclick = async () => {
    const intro = W.intro || document.getElementById('introInput').value.trim();
    if (!intro) return dnToast('简介还没写');
    dnLoad(true, '识别角色');
    try {
      const data = await DNAI.json(
        '你是文本信息抽取器。只抽取原文中真实出现的人物名字，一个字都不许改写、不许音译、不许换成别的名字。原文没写名字的人物不要编造。',
        `原文：\n${intro}\n\n抽取其中出现的人物。gender 只在原文能判断时填写，否则留空。note 用原文依据概括其身份或关系，20 字内。\n\n返回 JSON：{"chars":[{"name":"","gender":"","note":""}]}`,
        { maxTokens: 1500, temperature: 0.3 });
      let added = 0;
      (data.chars || []).forEach(c => {
        const name = (c.name || '').trim();
        if (!name || !intro.includes(name)) return;               // 必须真在原文出现
        if (W.lockChars.some(x => x.name === name)) return;
        W.lockChars.push({ name, gender: c.gender || '', note: c.note || '', source: 'user' });
        added++;
      });
      renderLockList();
      if (W.lockChars.length > W.roleCount) {
        W.roleCount = Math.min(12, W.lockChars.length);
        document.getElementById('roleCount').textContent = W.roleCount;
        updateCalc(); renderLockList();
      }
      dnToast(added ? `识别到 ${added} 位角色，姓名已锁定` : '简介里没有识别到明确人名');
    } catch (e) { dnToast(e.message); }
    finally { dnLoad(false); }
  };

  document.getElementById('lockAdd').onclick = async () => {
    const name = await dnPrompt('角色姓名（AI 不会更改）', '');
    if (!name) return;
    const note = await dnPrompt('这个角色是谁？（可留空）', '');
    W.lockChars.push({ name, gender: '', note: note || '', source: 'user' });
    if (W.lockChars.length > W.roleCount) {
      W.roleCount = Math.min(12, W.lockChars.length);
      document.getElementById('roleCount').textContent = W.roleCount;
      updateCalc();
    }
    renderLockList();
  };

  document.getElementById('charGenBtn').onclick = () => doCharGen('');
  document.getElementById('charRedoBtn').onclick = () => {
    const fb = document.getElementById('charFeedback').value.trim();
    if (!fb) return dnToast('先写下你想改什么');
    doCharGen(fb);
  };
}

async function doCharGen(feedback) {
  if (W.cpCount * 2 > W.roleCount) return dnToast('CP 人数超出了重要角色数');
  if (W.lockChars.length > W.roleCount) return dnToast('锁定角色多于重要角色数，请上调人数');
  const wish = document.getElementById('charWish').value.trim();
  const intro = W.intro || document.getElementById('introInput').value.trim();
  const styleDesc = W.style ? W.style.desc : '通用言情对话体';
  const btn = document.getElementById('charGenBtn');
  btn.classList.add('on', 'busy');
  const solo = W.roleCount - W.cpCount * 2;

  const lockTxt = W.lockChars.length
    ? `\n\n【姓名锁定名单 · 最高优先级】以下角色由用户提供，必须原样使用，一个字都不能改，不许替换成其他名字，也不许遗漏：\n${W.lockChars.map(c => `· ${c.name}${c.gender ? '（' + c.gender + '）' : ''}${c.note ? '：' + c.note : ''}`).join('\n')}\n这些角色的设定必须与用户给的备注和简介中的描写一致，你只能在此基础上扩写补全。`
    : '';
  const fbTxt = feedback ? `\n\n【用户对上一版不满意，必须按此修改】\n${feedback}\n上一版角色为：${W.chars.map(c => c.name).join('、')}。请针对性调整，不要原样重复。` : '';
  const prevTxt = feedback ? W.chars.map(c => `${c.name}：${(c.profile || '').slice(0, 80)}`).join('\n') : '';

  const sys = '你是言情小说人物设定师。除「姓名锁定名单」外，新角色的名字必须偏言情/古典/雅致（如：沈砚舟、温窈、顾昭珩、江晚棠），严禁张伟、李娜这类现实户籍风姓名；人设要戏剧化，禁止写成写实纪录片式的平淡设定。每个人物 profile 要全面：外貌气质、身份背景、核心性格、行为习惯、说话方式与口头禅、心理创伤或执念、在故事中的作用、与对方的羁绊。';

  try {
    /* —— 先生成 CP —— */
    dnLoad(true, '生成 CP 档案');
    const cpData = await DNAI.json(sys,
      `故事简介：\n${intro}\n\n文风：${styleDesc}${wish ? '\n用户设定倾向：' + wish : ''}${lockTxt}${fbTxt}${prevTxt ? '\n\n上一版摘要：\n' + prevTxt : ''}\n\n请生成 ${W.cpCount} 对 CP，共 ${W.cpCount * 2} 人，第 1 对是男女主。\n若锁定名单中的角色适合成为 CP，优先把他们排进 CP，并在 members 里原样使用其姓名。\n每人 profile 不少于 160 字，连贯段落。\n\n返回 JSON：{"pairs":[{"relation":"这对CP的关系与羁绊，40字内","members":[{"name":"","gender":"男/女","age":"","identity":"身份一句话","profile":""},{}]}]}`,
      { maxTokens: 9000, temperature: 0.95 });

    const chars = [], pairs = [];
    const lockNames = W.lockChars.map(c => c.name);
    (cpData.pairs || []).slice(0, W.cpCount).forEach((pp, pi) => {
      const ms = (pp.members || []).slice(0, 2);
      const ids = [];
      ms.forEach(m => {
        const id = 'c' + Math.random().toString(36).slice(2, 8);
        ids.push(id);
        chars.push({
          id, name: m.name || '未名', gender: m.gender || '', age: m.age || '',
          identity: m.identity || '', profile: m.profile || '',
          group: pi === 0 ? '主 CP' : 'CP ' + (pi + 1),
          pair: pi, solo: false, avatar: '',
          source: lockNames.includes(m.name) ? 'user' : 'ai'
        });
      });
      pairs.push({ idx: pi, ids, relation: pp.relation || '', names: ms.map(m => m.name) });
    });

    /* —— 再生成独立重要角色，并保证剩余锁定角色一定出现 —— */
    const usedNames = chars.map(c => c.name);
    const restLock = W.lockChars.filter(c => !usedNames.includes(c.name));
    if (solo > 0) {
      dnLoad(true, '生成独立角色档案');
      const known = chars.map(c => `${c.name}（${c.group}）`).join('、');
      const mustTxt = restLock.length
        ? `\n\n【必须包含且姓名锁定】：\n${restLock.map(c => `· ${c.name}${c.note ? '：' + c.note : ''}`).join('\n')}\n请把他们排在最前面，姓名原样。`
        : '';
      const soloData = await DNAI.json(sys,
        `故事简介：\n${intro}\n\n已有 CP 角色：${known}${wish ? '\n用户设定倾向：' + wish : ''}${mustTxt}${fbTxt}\n\n请生成 ${solo} 位「独立重要角色」：不属于任何 CP、没有固定感情线归属，但对剧情有重要推动作用。每人 profile 不少于 160 字，并说明其与已有角色的牵连。\n\n返回 JSON：{"solos":[{"name":"","gender":"男/女","age":"","identity":"","profile":""}]}`,
        { maxTokens: 8000, temperature: 0.95 });
      (soloData.solos || []).slice(0, solo).forEach(m => {
        chars.push({
          id: 'c' + Math.random().toString(36).slice(2, 8),
          name: m.name || '未名', gender: m.gender || '', age: m.age || '',
          identity: m.identity || '', profile: m.profile || '',
          group: '独立重要角色', pair: -1, solo: true, avatar: '',
          source: lockNames.includes(m.name) ? 'user' : 'ai'
        });
      });
    }

    /* —— 兜底：锁定角色若被 AI 漏掉，直接补进档案 —— */
    const finalNames = chars.map(c => c.name);
    const missing = W.lockChars.filter(c => !finalNames.includes(c.name));
    missing.forEach(c => {
      chars.push({
        id: 'c' + Math.random().toString(36).slice(2, 8),
        name: c.name, gender: c.gender || '', age: '',
        identity: c.note || '用户提供的重要角色',
        profile: (c.note ? c.note + '\n\n' : '') + '（此角色由你提供，AI 未生成完整档案，可在「按意见重新生成」中补充要求。）',
        group: '独立重要角色', pair: -1, solo: true, avatar: '', source: 'user'
      });
    });
    if (missing.length) dnToast(`${missing.map(c => c.name).join('、')} 未被 AI 采用，已按你提供的原名补入`);

    /* 保留已上传的头像 */
    const oldAv = {}; W.chars.forEach(c => { if (c.avatar) oldAv[c.name] = c.avatar; });
    chars.forEach(c => { if (oldAv[c.name]) c.avatar = oldAv[c.name]; });

    W.chars = chars; W.pairs = pairs; W.relation = null;
    renderCharCards();
    document.getElementById('charRedo').classList.add('show');
    document.getElementById('charFeedback').value = '';
    btn.querySelector('b').textContent = '重新生成人物档案';
    if (!missing.length) dnToast('档案已生成，可点击头像上传');
  } catch (e) { dnToast(e.message); }
  finally { btn.classList.remove('busy'); dnLoad(false); }
}

function renderCharCards() {
  const wrap = document.getElementById('charWrap');
  let html = '';
  let lastGroup = '';
  W.chars.forEach((c, i) => {
    if (c.group !== lastGroup) {
      lastGroup = c.group;
      html += `<div class="cgroup-t">${dnEsc(c.group)}</div>`;
    }
    html += `<div class="ccard" style="animation-delay:${i * 50}ms">
      <div class="cc-av ${c.avatar ? 'has' : ''}" data-av="${c.id}" style="${c.avatar ? `background-image:url('${c.avatar}')` : ''}"><span>头像</span></div>
      <div class="cc-main">
        <div class="cc-n"><b>${dnEsc(c.name)}</b><i>${dnEsc(c.gender)}${c.age ? ' · ' + dnEsc(c.age) : ''}</i></div>
        <div class="cc-tag ${c.solo ? 'solo' : ''}">${dnEsc(c.identity || c.group)}</div>
        <div class="cc-d">${dnEsc(c.profile)}</div>
      </div>
    </div>`;
  });
  wrap.innerHTML = html;
  wrap.querySelectorAll('[data-av]').forEach(el => {
    el.onclick = async () => {
      const d = await dnFile(document.getElementById('charAvatarFile'));
      if (!d) return;
      const c = W.chars.find(x => x.id === el.dataset.av);
      c.avatar = d;
      el.style.backgroundImage = `url('${d}')`;
      el.classList.add('has');
    };
  });
}

/* ================= 第六步 · 封面 ================= */
function initStep6() {
  document.getElementById('coverPick').onclick = async () => {
    const d = await dnFile(document.getElementById('coverFile'));
    if (!d) return;
    W.cover = d;
    const el = document.getElementById('coverPick');
    el.style.backgroundImage = `url('${d}')`;
    el.classList.add('has');
  };
  document.querySelectorAll('.cs-quick span').forEach(el => {
    el.onclick = () => { document.getElementById('chapCount').value = el.dataset.n; };
  });
}

/* ================= 第七步 · 归档 ================= */
function renderFinal() {
  const rows = [
    ['书名', W.title],
    ['文风', W.style ? W.style.name : '—'],
    ['角色', W.chars.map(c => c.name).join('、')],
    ['CP', W.pairs.map(p => p.names.join(' × ')).join(' / ') || '—'],
    ['章节', W.chapterCount + ' 章'],
    ['每轮字数', W.wordMin + ' – ' + W.wordMax + ' 字'],
    ['简介', (W.intro || '').slice(0, 90) + ((W.intro || '').length > 90 ? '…' : '')]
  ];
  document.getElementById('finalCard').innerHTML = rows.map(r =>
    `<div class="fc-row"><div class="fc-k">${r[0]}</div><div class="fc-v">${dnEsc(r[1] || '—')}</div></div>`).join('');
}

function initStep7() {
  document.getElementById('archiveBtn').onclick = async () => {
    const book = {
      id: DNStore.uid(),
      time: Date.now(),
      title: W.title,
      intro: W.intro,
      style: W.style,
      roleCount: W.roleCount,
      cpCount: W.cpCount,
      chars: W.chars,
      pairs: W.pairs.map(p => p.names),
      pairIds: W.pairs,
      relation: W.relation,
      cover: W.cover,
      wordMin: W.wordMin,
      wordMax: W.wordMax,
      chapterCount: W.chapterCount,
      catalog: [],
      stats: null,
      reviews: [],
      onShelf: false,
      povId: '',
      readerSettings: null
    };
    await DNStore.put(book);
    await dnReload();
    dnClosePage('page-wizard');
    dnSwitchTab('workshop');
    dnToast('已归档至创作工坊');
  };
}

/* ---------------- 绑定 ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  initStep1(); initStep2(); initStep3(); initStep4(); initStep6(); initStep7();
  document.getElementById('wzNext').onclick = () => { if (wzValidate()) wzGo(W.step + 1); };
  document.getElementById('wzPrev').onclick = () => wzGo(W.step - 1);
});