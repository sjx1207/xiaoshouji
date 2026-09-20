/* =========================================================
   论坛 · 编辑资料（新页面）  forum-edit.js
   我的资料：全部可编辑 + 认证博主 / 粉丝团 / 圈子 + 给 AI 的设定
   角色资料：同步角色档案（人设必同步）+ 发帖规范 + 自主发帖 + 参与生成
   每个角色都有独立的论坛档案，互不混用
========================================================= */
F.edit = {};

F.getPath = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
F.setPath = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); const t = ks.reduce((a, k) => (a[k] = a[k] || {}), o); t[last] = v; };

/* 封面明暗检测：决定状态栏与悬浮按钮用浅色还是深色 */
F.lum = src => new Promise(res => {
  const im = new Image();
  im.onload = () => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 16;
    const g = c.getContext('2d'); g.drawImage(im, 0, 0, im.width, im.height * .4, 0, 0, 40, 16);
    const d = g.getImageData(0, 0, 40, 16).data; let s = 0;
    for (let i = 0; i < d.length; i += 4) s += (d[i] * .299 + d[i + 1] * .587 + d[i + 2] * .114);
    res(s / (d.length / 4) / 255);
  };
  im.onerror = () => res(1); im.src = src;
});

/* 通用绑定：data-bind 文本 / data-sw 开关 / data-chip 单选 / data-multi 多选 */
F.edit.bind = (root, obj, onAny) => {
  root.querySelectorAll('[data-bind]').forEach(el => {
    const v = F.getPath(obj, el.dataset.bind); el.value = v == null ? '' : v;
    el.addEventListener('input', () => {
      let val = el.value;
      if (el.type === 'number') val = Math.max(0, parseInt(val) || 0);
      F.setPath(obj, el.dataset.bind, val);
      const cnt = root.querySelector(`[data-count-for="${el.dataset.bind}"]`); if (cnt) cnt.textContent = `${el.value.length}/${el.maxLength}`;
      onAny && onAny(el.dataset.bind);
    });
  });
  root.querySelectorAll('[data-sw]').forEach(el => {
    if (el.dataset.sw === 'verify.on' || el.disabled) return;
    el.checked = !!F.getPath(obj, el.dataset.sw);
    el.addEventListener('change', () => { F.setPath(obj, el.dataset.sw, el.checked); onAny && onAny(el.dataset.sw); });
  });
  root.querySelectorAll('[data-chip]').forEach(g => {
    const cur = F.getPath(obj, g.dataset.chip);
    g.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('on', String(c.dataset.v) === String(cur));
      c.onclick = () => { g.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); F.setPath(obj, g.dataset.chip, c.dataset.v); onAny && onAny(g.dataset.chip); };
    });
  });
  root.querySelectorAll('[data-multi]').forEach(g => {
    const cur = F.getPath(obj, g.dataset.multi) || [];
    g.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('on', cur.includes(c.dataset.v));
      c.onclick = () => {
        const arr = (F.getPath(obj, g.dataset.multi) || []).slice(); const i = arr.indexOf(c.dataset.v);
        i < 0 ? arr.push(c.dataset.v) : arr.splice(i, 1);
        if (!arr.length && g.dataset.min) return F.toast('至少保留一项', 'minus');
        F.setPath(obj, g.dataset.multi, arr); c.classList.toggle('on', i < 0); onAny && onAny(g.dataset.multi);
      };
    });
  });
};
const chipRow = (path, opts, multi) => `<div class="chips" ${multi ? 'data-multi' : 'data-chip'}="${path}">${opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<button class="chip" data-v="${F.esc(v)}">${F.esc(l)}</button>`; }).join('')}</div>`;
const fld = (label, inner, hint = '', extra = '') => `<div class="field"><div class="f-label">${label}${extra}</div>${inner}${hint ? `<p class="hint">${hint}</p>` : ''}</div>`;
const txt = (path, ph = '', max = 40) => `<input class="input" data-bind="${path}" placeholder="${F.esc(ph)}" maxlength="${max}">`;
const area = (path, ph = '', max = 600, rows = 3) => `<textarea class="textarea" data-bind="${path}" placeholder="${F.esc(ph)}" maxlength="${max}" rows="${rows}"></textarea>`;

/* 标签输入 */
F.edit.tags = (host, obj, path, ph = '输入后回车添加') => {
  const draw = () => {
    const arr = F.getPath(obj, path) || [];
    host.innerHTML = `<div class="tag-input">${arr.map((t, i) => `<button class="chip on" data-i="${i}">${F.esc(t)}<span class="x">${F.I('close')}</span></button>`).join('')}<input placeholder="${arr.length >= 8 ? '最多 8 个' : ph}" maxlength="12" ${arr.length >= 8 ? 'disabled' : ''}></div>`;
    host.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { arr.splice(+b.dataset.i, 1); F.setPath(obj, path, arr); draw(); });
    const inp = host.querySelector('input');
    const add = () => { const v = inp.value.trim().replace(/^#/, ''); if (!v) return; if (!arr.includes(v)) arr.push(v); F.setPath(obj, path, arr); draw(); host.querySelector('input').focus(); };
    inp.onkeydown = e => { if (e.key === 'Enter' || e.key === ',' || e.key === '，') { e.preventDefault(); add(); } };
    inp.onblur = add;
  };
  draw();
};

/* 头像 / 封面上传 */
F.edit.visual = (host, obj, { onChange } = {}) => {
  const draw = () => {
    host.innerHTML = `<div class="ed-visual">
      <div class="ed-cover" data-pick="cover">${F.coverHTML(obj)}<span class="gorb lg ${obj.cover ? 'lg-on-img' : ''} ed-cam">${F.I('camera')}</span></div>
      <div class="ed-avatar" data-pick="avatar">${F.avatarHTML(obj, 84)}<span class="gorb lg ed-cam">${F.I('camera')}</span></div>
      <span class="ed-visual-tip">点击更换头像与背景</span></div>`;
    host.querySelectorAll('[data-pick]').forEach(el => el.onclick = async () => {
      const key = el.dataset.pick;
      const choice = obj[key] ? await F.menu(key === 'cover' ? '背景图' : '头像', [{ label: '从相册选择', value: 'pick', icon: 'image' }, { label: key === 'cover' ? '恢复默认背景' : '恢复默认头像', value: 'clear', icon: 'refresh', danger: true }]) : 'pick';
      if (!choice) return;
      if (choice === 'clear') { obj[key] = null; if (key === 'cover') { obj.coverDark = false; obj.coverCustom = false; } draw(); onChange && onChange(); return; }
      const [f] = await F.pickImages(false); if (!f) return;
      obj[key] = await F.readImage(f, key === 'cover' ? 1600 : 640);
      if (key === 'cover') { obj.coverDark = (await F.lum(obj.cover)) < .55; obj.coverCustom = true; }
      if (key === 'avatar' && obj.kind === 'char') obj.avatarCustom = true;
      draw(); onChange && onChange();
    });
  };
  draw();
};

/* 认证 + 粉丝团 + 圈子（用户与角色共用） */
F.edit.verifyHTML = (v) => `
  <div class="vf-card ${v.status === 'verified' ? 'on' : 'off'}" id="vfCard">
    <div class="vf-top"><span class="vf-seal">${F.I('shield')}</span><div style="flex:1"><b>${v.status === 'verified' ? '认证博主' : '普通用户'}</b><small>${v.status === 'verified' ? '已开通 · 可经营粉丝团与圈子' : '开启认证后解锁博主专属能力'}</small></div>${F.switchHTML('verify.on', v.status === 'verified')}</div>
    <div class="vf-perks"><div>${F.I('shield')}<b>认证标识</b>名字旁显示认证印章与头衔</div><div>${F.I('crown')}<b>粉丝团</b>自定义团名、徽章与等级</div><div>${F.I('circles')}<b>圈子</b>建立话题圈子聚集同好</div></div>
  </div>
  <div class="locked-zone ${v.status === 'verified' ? '' : 'lock'}" id="vfZone">
    <div class="lock-veil">${F.I('lock')}开启认证后可编辑</div>
    <div class="group-title">认证信息</div>
    ${fld('认证类型', chipRow('verify.type', ['个人博主', '内容创作者', '机构媒体', '品牌官方', '公众人物']))}
    ${fld('认证领域', txt('verify.field', '如：摄影、美食、游戏、财经', 20))}
    ${fld('认证头衔', txt('verify.title', '显示在主页，如：知名摄影博主', 24), '会显示在名字下方与评论区，AI 生成的网友也会据此认识你')}
    ${fld('认证说明', area('verify.intro', '简述你的内容方向与代表作品', 200, 2))}
    <div class="group-title">粉丝团</div>
    <div class="group"><div class="row"><div class="r-main"><div class="r-title">开通粉丝团</div><div class="r-sub">关注你的人会成为粉丝团成员</div></div>${F.switchHTML('verify.fanClub.enabled', v.fanClub.enabled)}</div></div>
    ${fld('粉丝团名称', txt('verify.fanClub.name', '如：星光后援会', 16))}
    ${fld('粉丝徽章', txt('verify.fanClub.badge', '2~4 个字，如：星光', 4), '徽章会挂在粉丝的昵称旁')}
    ${fld('等级命名', txt('verify.fanClub.levels', '用逗号分隔：路人,新粉,铁粉,挚友', 60))}
    ${fld('入团规则', txt('verify.fanClub.joinRule', '如：关注满 7 天自动加入', 40))}
    ${fld('粉丝团介绍', area('verify.fanClub.intro', '介绍一下你的粉丝团', 120, 2))}
    <div class="group-title"><span class="gt-line">圈子</span><button class="gbtn sm lg" data-add-circle>${F.I('plus')}新建圈子</button></div>
    <div id="circleList"></div>
  </div>`;
F.edit.bindVerify = (root, obj, redraw) => {
  const sw = root.querySelector('[data-sw="verify.on"]');
  sw.onchange = async () => {
    if (sw.checked) {
      obj.verify.status = 'verified'; obj.verify.since = Date.now();
      if (!obj.verify.title) obj.verify.title = (obj.verify.field ? obj.verify.field + '博主' : '认证博主');
      F.toast('已开启认证，博主能力已解锁', 'shield');
    } else {
      if (!(await F.confirm('取消认证？', '粉丝团与圈子会暂时隐藏，重新认证后恢复。', '取消认证', true))) { sw.checked = true; return; }
      obj.verify.status = 'none';
    }
    redraw();
  };
  const list = root.querySelector('#circleList');
  const drawC = () => {
    const cs = obj.verify.circles;
    list.innerHTML = cs.length ? cs.map((c, i) => `<div class="circle-item"><div class="ci-cover" data-cc="${i}">${c.cover ? `<img src="${c.cover}">` : F.art.coverSVG(c.id)}</div><div class="ci-main"><input value="${F.esc(c.name)}" data-cn="${i}" placeholder="圈子名称" maxlength="16"><input class="sub" value="${F.esc(c.desc)}" data-cd="${i}" placeholder="一句话介绍" maxlength="30"></div><button class="gorb sm lg" data-cx="${i}">${F.I('trash')}</button></div>`).join('') : `<p class="hint" style="margin-bottom:12px">还没有圈子。圈子会展示在你的主页，AI 生成内容时也会让网友提到它们。</p>`;
    list.querySelectorAll('[data-cn]').forEach(el => el.oninput = () => cs[+el.dataset.cn].name = el.value);
    list.querySelectorAll('[data-cd]').forEach(el => el.oninput = () => cs[+el.dataset.cd].desc = el.value);
    list.querySelectorAll('[data-cx]').forEach(el => el.onclick = () => { cs.splice(+el.dataset.cx, 1); drawC(); });
    list.querySelectorAll('[data-cc]').forEach(el => el.onclick = async () => { const [f] = await F.pickImages(); if (!f) return; cs[+el.dataset.cc].cover = await F.readImage(f, 800); drawC(); });
  };
  drawC();
  root.querySelector('[data-add-circle]').onclick = () => {
    if (obj.verify.circles.length >= 8) return F.toast('最多创建 8 个圈子', 'minus');
    obj.verify.circles.push({ id: F.uid('cc'), name: '', desc: '', cover: null }); drawC();
  };
};

/* ---------------- 打开编辑页 ---------------- */
F.edit.open = (startTab = 'user') => {
  F.nav.push((page, api) => {
    let tab = startTab;
    let dirty = false;
    page.innerHTML = `${F.topbar('编辑资料', { right: `<button class="gbtn sm lg lg-dark" data-save>保存</button>` })}
      <div class="ed-switch"><div class="seg" id="edSeg"><button data-v="user" class="${tab === 'user' ? 'on' : ''}">我的资料</button><button data-v="char" class="${tab === 'char' ? 'on' : ''}">角色资料</button></div></div>
      <div class="page-scroll"><div class="ed-body" id="edBody"></div></div>
      <div class="ed-save"><button class="gbtn lgx lg lg-dark block" data-save>保存资料</button></div>`;
    F.bindBack(page, api);
    const body = page.querySelector('#edBody');
    const saveBtns = page.querySelectorAll('[data-save]');
    let saver = null;
    saveBtns.forEach(b => b.onclick = () => saver && saver());
    F.seg(page.querySelector('#edSeg'), v => { tab = v; draw(); });
    page.querySelector('[data-back]').onclick = async () => {
      if (dirty && !(await F.confirm('放弃未保存的修改？', '离开后本次修改不会保留。', '放弃'))) return;
      api.close();
    };
    const draw = () => { tab === 'user' ? drawUser() : drawChar(); page.querySelector('.page-scroll').scrollTop = 0; };
    const touched = () => { dirty = true; };

    /* ======== 我的资料 ======== */
    function drawUser() {
      const u = F.deepClone(F.me());
      saveBtns.forEach(b => b.textContent = '保存资料');
      body.innerHTML = `
        <div id="edVisual"></div>
        <div class="group-title">基本资料</div>
        ${fld('昵称', txt('nickname', '你的名字', 20))}
        ${fld('用户名', `<input class="input" data-bind="handle" placeholder="字母、数字或下划线" maxlength="20">`, '主页与评论区显示为 @用户名')}
        ${fld('简介', area('bio', '介绍一下自己', 160, 3), '', `<em data-count-for="bio">${(u.bio || '').length}/160</em>`)}
        ${fld('性别', chipRow('gender', [['女', '女'], ['男', '男'], ['', '不展示'], ['非二元', '非二元']]))}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${fld('生日', `<input class="input" type="text" data-bind="birthday" placeholder="如 5月20日" maxlength="16">`)}
          ${fld('所在地', txt('location', '城市', 16))}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${fld('职业 / 身份', txt('occupation', '如：插画师', 20))}
          ${fld('学校', txt('school', '选填', 20))}
        </div>
        ${fld('个人链接', txt('website', '如：个人作品集地址', 60))}
        ${fld('个性标签', '<div id="edTags"></div>')}
        <div class="group-title">给 AI 的设定<span class="gt-line"></span></div>
        <p class="hint" style="margin:-2px 8px 12px">以下内容不会展示在主页，只在生成帖子、评论与私信时交给 AI，让网友和角色更“认识”你。</p>
        ${fld('我的人设', area('persona', '性格、经历、正在做的事、说话习惯……越具体，生成内容越贴合你', 1200, 5))}
        ${fld('希望被怎样称呼 / 对待', txt('aiAddress', '如：叫我小满；评论区可以调侃我但别太刻薄', 80))}
        ${fld('我和角色们的关系', area('relationToChars', '如：和某某是青梅竹马，常在对方帖子下斗嘴', 400, 2))}
        <div class="group-title">隐私</div>
        <div class="group">
          <div class="row"><div class="r-main"><div class="r-title">公开点赞列表</div></div>${F.switchHTML('privacy.showLikes')}</div>
          <div class="row"><div class="r-main"><div class="r-title">公开收藏列表</div></div>${F.switchHTML('privacy.showFavs')}</div>
          <div class="row"><div class="r-main"><div class="r-title">谁可以私信我</div></div></div>
        </div>
        ${chipRow('privacy.dm', [['all', '所有人'], ['follow', '我关注的人'], ['none', '关闭私信']])}
        <div class="group-title">认证博主</div>
        <div id="edVerify"></div>
        ${F.state.identities.length > 1 ? `<button class="gbtn lg block" data-del-id style="margin-top:22px;color:#b23434">${F.I('trash')}删除这个身份</button>` : ''}`;
      F.edit.visual(body.querySelector('#edVisual'), u, { onChange: touched });
      F.edit.bind(body, u, touched);
      const vHost = body.querySelector('#edVerify');
      const drawV = () => { vHost.innerHTML = F.edit.verifyHTML(u.verify); F.edit.bind(vHost, u, touched); F.edit.bindVerify(vHost, u, drawV); };
      drawV();
      F.edit.tags(body.querySelector('#edTags'), u, 'tags');
      const del = body.querySelector('[data-del-id]');
      if (del) del.onclick = async () => {
        if (!(await F.confirm(`删除身份「${u.nickname}」？`, '已发布的帖子会保留并显示为已注销用户。', '删除', true))) return;
        F.state.identities = F.state.identities.filter(x => x.id !== u.id);
        F.state.activeIdentityId = F.state.identities[0].id;
        await F.save('identities', 'activeIdentityId'); dirty = false; api.close();
      };
      saver = async () => {
        u.nickname = (u.nickname || '').trim() || '未命名';
        u.handle = (u.handle || '').replace(/[^\w]/g, '').slice(0, 20) || ('user' + Date.now().toString().slice(-5));
        const clash = F.state.identities.find(x => x.id !== u.id && x.handle === u.handle) || F.state.charProfiles.find(c => c.handle === u.handle);
        if (clash) return F.toast('这个用户名已被占用', 'minus');
        const i = F.state.identities.findIndex(x => x.id === u.id);
        F.state.identities[i] = u;
        await F.save('identities'); dirty = false;
        F.toast('资料已保存');
      };
    }

    /* ======== 角色资料 ======== */
    let curChar = null;
    async function drawChar() {
      body.innerHTML = `<div class="empty"><div class="spin" style="margin:0 auto"></div></div>`;
      const chars = await F.ai.rawChars(true);
      if (!chars.length) {
        saver = null; saveBtns.forEach(b => b.textContent = '保存');
        body.innerHTML = `<div class="empty"><div class="e-art lg" style="--lg-r:30px">${F.I('users')}</div><h4>还没有角色</h4><p>先到桌面「角色档案」里创建角色，这里会自动读取并为每个角色建立独立的论坛档案。</p></div>`;
        return;
      }
      if (!curChar || !chars.find(c => c.id === curChar)) curChar = (F.state.charProfiles[0] && chars.find(c => c.id === F.state.charProfiles[0].charId) ? F.state.charProfiles[0].charId : chars[0].id);
      const raw = chars.find(c => c.id === curChar);
      const existing = F.charProfileByChar(curChar);
      const list = `<div class="cp-list">${chars.map(c => { const has = F.charProfileByChar(c.id); return `<button class="cp-chip ${c.id === curChar ? 'on' : ''}" data-char="${c.id}">${F.avatarHTML({ avatar: c.avatar, nickname: c.name, handle: 'c' + c.id }, 46)}<small>${F.esc(c.name || '未命名')}</small><i>${has ? '已建档' : '未建档'}</i></button>`; }).join('')}</div>`;
      if (!existing) {
        saver = null; saveBtns.forEach(b => b.textContent = '保存');
        body.innerHTML = `${list}
          <div class="cp-src">${F.avatarHTML({ avatar: raw.avatar, nickname: raw.name, handle: 'c' + raw.id }, 54)}<div class="r-main"><b>${F.esc(raw.name)}</b><small>${F.esc(raw.desc || raw.role || '来自角色档案')}</small></div></div>
          <div class="empty" style="padding-top:20px"><div class="e-art lg" style="--lg-r:30px">${F.I('doc')}</div><h4>为 ${F.esc(raw.name)} 建立论坛档案</h4><p>档案独属于这个角色：会同步 TA 的基础资料与人设，并单独保存 TA 的发帖规范、自主发帖与参与生成的设置。</p><button class="gbtn lgx lg lg-dark" data-create>${F.I('plus')}建立档案</button></div>`;
        bindCharList();
        body.querySelector('[data-create]').onclick = async () => {
          const cp = F.newCharProfile(raw);
          if (cp.cover) cp.coverDark = (await F.lum(cp.cover)) < .55;
          F.state.charProfiles.push(cp); await F.save('charProfiles');
          F.toast(`已为 ${raw.name} 建立档案`); drawChar();
        };
        return;
      }
      const cp = F.deepClone(existing);
      cp.auto.worldId = cp.auto.worldId || '';
      if (cp.gender == null) cp.gender = raw.gender || '';
      saveBtns.forEach(b => b.textContent = '存档 ' + (raw.name || '角色'));
      const syncRows = [
        ['persona', '核心人设', '只交给 AI 使用，永远不会展示在主页', true],
        ['name', '角色本名', raw.name || '—'], ['avatar', '头像', '跟随角色档案的头像'],
        ['cover', '主页背景', F.isImg(raw.cardBg) ? '跟随角色书的卡片背景图' : '角色书里还没有背景图'],
        ['desc', '一句话描述与年龄', raw.desc || '—'], ['appearance', '外貌', raw.appearance ? '已填写' : '角色档案未填写'],
        ['traits', '性格', raw.traits ? String(raw.traits).slice(0, 30) : '角色档案未填写'], ['speechStyle', '说话风格与口头禅', raw.speechStyle ? '已填写' : '角色档案未填写'],
        ['likes', '喜好与雷点', (raw.likes || raw.dislikes) ? '已填写' : '角色档案未填写'], ['backstory', '背景经历', raw.backstory ? '已填写（较长，默认不同步）' : '角色档案未填写'],
        ['relation', '与用户的关系', raw.relation || '角色档案未填写'], ['worldbook', '角色专属世界书', '关联到该角色的常驻世界书条目'], ['memory', '与用户的记忆', '读取记忆档案中与该角色相关的记忆']
      ];
      body.innerHTML = `${list}
        <div class="cp-src">${F.avatarHTML({ avatar: raw.avatar, nickname: raw.name, handle: 'c' + raw.id }, 54)}<div class="r-main"><b>${F.esc(raw.name)}</b><small>资料来自角色档案 · ${existing.savedAt ? '上次存档 ' + F.ago(existing.savedAt) : '尚未存档'}</small></div><button class="gbtn sm lg" data-resync>${F.I('refresh')}同步</button></div>
        <div id="edVisual"></div>
        <div class="group-title">论坛资料</div>
        ${fld('论坛昵称', txt('nickname', raw.name, 20))}
        ${fld('用户名', txt('handle', '字母、数字或下划线', 20))}
        ${fld('简介', area('bio', '一句对外的自我介绍，如：修文物的，也修人心', 60, 2), '简介会公开展示，只写一句话；人设等私密设定不会出现在主页')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${fld('所在地', txt('location', '选填', 16))}${fld('性别', chipRow('gender', [['女', '女'], ['男', '男'], ['', '不展示']]))}</div>
        ${fld('标签', '<div id="edTags"></div>')}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${fld('初始粉丝数', `<input class="input" type="number" data-bind="base.followers">`)}${fld('关注数', `<input class="input" type="number" data-bind="base.following">`)}</div>

        <div class="group-title">同步内容</div>
        <div class="group">${syncRows.map(([k, t, s, lock]) => `<div class="row ${lock ? 'lock' : ''}"><div class="r-main"><div class="r-title">${t}</div><div class="r-sub">${F.esc(s)}</div></div>${F.switchHTML('sync.' + k, lock ? true : cp.sync[k], lock)}</div>`).join('')}</div>
        <p class="hint" style="margin:-4px 8px 6px">核心人设是角色的根基，始终同步，不能关闭。</p>
        ${raw.prompt ? `<div class="cp-persona">${F.esc(raw.prompt)}</div>` : `<p class="hint">角色档案里还没有写人设，建议先补充，否则生成的内容会偏离角色。</p>`}

        <div class="group-title">发帖规范</div>
        ${fld('文风', area('post.style', '如：短句多、留白多，喜欢用比喻；不写鸡汤', 300, 2))}
        ${fld('语气', chipRow('post.tone', ['温柔', '冷淡', '毒舌', '元气', '文艺', '理性', '慵懒', '中二', '克制']))}
        ${fld('常发话题', txt('post.topics', '如：摄影、夜跑、猫、深夜食堂', 80))}
        ${fld('不会发的内容', txt('post.taboo', '如：不晒奢侈品，不聊政治', 80))}
        ${fld('篇幅', chipRow('post.length', ['一句话', '简短', '适中', '长篇']))}
        ${fld('叙述视角', chipRow('post.perspective', ['第一人称', '第三人称', '随性']))}
        ${fld('话题标签', chipRow('post.hashtag', ['从不', '偶尔', '经常']))}
        ${fld('颜文字 / 表情', chipRow('post.emoji', ['不用', '少量', '常用']))}
        ${fld('提及用户的频率', chipRow('post.mentionUser', ['从不', '偶尔', '经常', '每条都会']))}
        ${fld('过往发帖示例', area('post.sample', '贴一两条 TA 会发的帖子，AI 会模仿其口吻', 600, 3))}
        ${fld('在论坛里与用户的互动关系', area('relationToUser', '如：总是第一个给用户点赞，但评论时嘴硬', 300, 2))}

        <div class="group-title">自主发帖</div>
        <div class="group"><div class="row"><div class="r-main"><div class="r-title">允许自主发帖</div><div class="r-sub">打开论坛时按频率自动调用 AI，以 TA 的身份发帖</div></div>${F.switchHTML('auto.enabled')}</div></div>
        <div id="autoZone" class="locked-zone ${cp.auto.enabled ? '' : 'lock'}"><div class="lock-veil">${F.I('lock')}开启后可设置</div>
          ${fld('频率', `<div class="freq-grid" data-chip="auto.freq">${[['open', '每次打开'], ['hourly', '每小时'], ['daily', '每天'], ['3days', '每三天'], ['weekly', '每周']].map(([v, l]) => `<button class="chip" data-v="${v}">${l}</button>`).join('')}</div>`)}
          ${fld('发布到', chipRow('auto.worldId', [['', '不分区'], ...F.state.worlds.map(w => [w.id, w.theme || w.name])]), '选择存档后，会使用该存档的世界观与文风')}
          ${fld('发帖类型', `<div class="chips" data-multi="auto.types" data-min="1">${F.TYPE_ORDER.map(t => `<button class="chip" data-v="${t}">${F.TYPES[t].name}</button>`).join('')}</div>`)}
        </div>

        <div class="group-title">参与内容生成</div>
        <div class="group">
          <div class="row"><div class="r-main"><div class="r-title">默认参与生成</div><div class="r-sub">生成内容时默认勾选 TA</div></div>${F.switchHTML('gen.joinDefault')}</div>
          <div class="row"><div class="r-main"><div class="r-title">用户评论时回复</div><div class="r-sub">在 TA 的帖子或评论下留言时，由 TA 本人回复</div></div>${F.switchHTML('gen.replyUser')}</div>
        </div>
        ${fld('参与方式', chipRow('gen.role', [['both', '发帖 + 评论'], ['author', '只发帖'], ['comment', '只评论']]))}
        ${fld('评论区活跃度', chipRow('gen.commentActive', ['安静', '适中', '话痨']))}

        <div class="group-title">认证博主</div>
        <div id="edVerify"></div>
        <button class="gbtn lg block" data-del-cp style="margin-top:22px;color:#b23434">${F.I('trash')}删除 TA 的论坛档案</button>`;
      bindCharList();
      F.edit.visual(body.querySelector('#edVisual'), cp, { onChange: touched });
      F.edit.bind(body, cp, k => { touched(); if (k === 'auto.enabled') body.querySelector('#autoZone').classList.toggle('lock', !cp.auto.enabled); });
      F.edit.tags(body.querySelector('#edTags'), cp, 'tags');
      const vHost = body.querySelector('#edVerify');
      const drawV = () => { vHost.innerHTML = F.edit.verifyHTML(cp.verify); F.edit.bind(vHost, cp, touched); F.edit.bindVerify(vHost, cp, drawV); };
      drawV();
      body.querySelector('[data-resync]').onclick = () => {
        if (cp.sync.name) { cp.nickname = raw.name || cp.nickname; cp.nameCustom = false; }
        if (cp.sync.avatar && F.isImg(raw.avatar)) cp.avatar = raw.avatar;
        if (cp.sync.cover !== false && F.isImg(raw.cardBg)) { cp.cover = raw.cardBg; cp.coverCustom = false; }
        touched(); F.toast(F.isImg(raw.cardBg) ? '已同步名字、头像与背景' : '已同步（角色书里没有背景图）'); F.edit.visual(body.querySelector('#edVisual'), cp, { onChange: touched });
        body.querySelector('[data-bind="nickname"]').value = cp.nickname; body.querySelector('[data-bind="bio"]').value = cp.bio;
      };
      body.querySelector('[data-del-cp]').onclick = async () => {
        if (!(await F.confirm(`删除 ${cp.nickname} 的论坛档案？`, '角色档案本身不受影响；TA 已发布的帖子会保留。', '删除', true))) return;
        F.state.charProfiles = F.state.charProfiles.filter(x => x.id !== cp.id);
        await F.save('charProfiles'); dirty = false; drawChar();
      };
      saver = async () => {
        cp.sync.persona = true;
        cp.nickname = (cp.nickname || '').trim() || raw.name;
        cp.nameCustom = cp.nickname !== raw.name;
        if (cp.sync.cover && !cp.coverCustom && F.isImg(raw.cardBg)) cp.cover = raw.cardBg;
        cp.handle = (cp.handle || '').replace(/[^\w]/g, '').slice(0, 20) || cp.handle;
        const clash = F.state.charProfiles.find(x => x.id !== cp.id && x.handle === cp.handle) || F.state.identities.find(u => u.handle === cp.handle);
        if (clash) return F.toast('这个用户名已被占用', 'minus');
        cp.auto.worldId = cp.auto.worldId || null;
        cp.savedAt = Date.now();
        const i = F.state.charProfiles.findIndex(x => x.id === cp.id);
        F.state.charProfiles[i] = cp;
        await F.save('charProfiles'); dirty = false;
        F.toast(`${cp.nickname} 的档案已存档`);
        body.querySelector('.cp-src small').textContent = '资料来自角色档案 · 上次存档 刚刚';
      };
    }
    function bindCharList() {
      body.querySelectorAll('[data-char]').forEach(b => b.onclick = async () => {
        const id = isNaN(+b.dataset.char) ? b.dataset.char : +b.dataset.char;
        if (id === curChar) return;
        if (dirty && !(await F.confirm('切换角色前保存修改？', '当前角色的修改尚未存档。', '不保存并切换'))) return;
        dirty = false; curChar = id; drawChar();
      });
    }
    draw();
  });
};