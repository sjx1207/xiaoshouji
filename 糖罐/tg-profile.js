/* ================================================================
   糖罐 TANGGUAN — tg-profile.js
   个人中心（IG / X / 微博 式资料卡）+ 三十级甜蜜殿堂
================================================================ */

let tgMe = {
  id: 'me',
  name: '', handle: 'tangguan', bio: '',
  identity: '', pronoun: '', location: '', birthday: '',
  avatarImg: null, bgImg: null,
  sweet: 0, joined: Date.now()
};

/* ---------------- 载入 / 保存 ---------------- */
async function tgLoadMe() {
  const list = await tgAll('me');
  if (list.length) { tgMe = Object.assign(tgMe, list[0]); return; }
  // 首次进入：借用 Luna 的主身份作为默认资料
  const users = await tgLoadUsers();
  const u = users.find(x => x.raw && x.raw.isPrimary) || users[0];
  if (u) {
    tgMe.name = u.name;
    tgMe.handle = (u.raw && u.raw.username) || 'tangguan_' + Math.random().toString(36).slice(2, 6);
    tgMe.bio = (u.raw && (u.raw.motto || u.raw.desc)) || '';
    tgMe.identity = u.role || '';
    tgMe.location = (u.raw && u.raw.location) || '';
    tgMe.birthday = (u.raw && u.raw.birthday) || '';
    tgMe.avatarImg = u.avatar || null;
  }
  if (!tgMe.name) tgMe.name = '糖罐用户';
  await tgSaveMe();
}
async function tgSaveMe() { await tgPut('me', tgMe); }

async function tgAddSweet(n) {
  tgMe.sweet = (tgMe.sweet || 0) + n;
  await tgSaveMe();
  if (document.getElementById('scr-profile').classList.contains('active')) tgRenderProfile();
}

/* ---------------- 资料卡渲染 ---------------- */
async function tgRenderProfile() {
  if (!tgMe.name) await tgLoadMe();

  const bg = document.getElementById('tgMeBg');
  const oldImg = bg.querySelector('img');
  if (tgMe.bgImg) {
    if (oldImg) oldImg.src = tgMe.bgImg;
    else bg.insertAdjacentHTML('afterbegin', `<img src="${tgMe.bgImg}" alt="">`);
  } else if (oldImg) oldImg.remove();
  document.getElementById('tgFrame').classList.toggle('on-dark', !!tgMe.bgImg);

  const av = document.getElementById('tgMeAv');
  av.innerHTML = tgMe.avatarImg
    ? `<img src="${tgMe.avatarImg}" alt="">`
    : `<span>${tgEsc((tgMe.name || '糖')[0])}</span>`;

  document.getElementById('tgMeName').textContent = tgMe.name;
  document.getElementById('tgMeHandle').textContent = '@' + tgMe.handle;
  document.getElementById('tgMeBio').textContent = tgMe.bio || '这个人还没有写下任何一句自我介绍。';

  const meta = [];
  if (tgMe.identity) meta.push(tgMe.identity);
  if (tgMe.pronoun) meta.push(tgMe.pronoun);
  if (tgMe.location) meta.push(tgMe.location);
  if (tgMe.birthday) meta.push(tgMe.birthday);
  meta.push('加入于 ' + tgFmtDate(tgMe.joined));
  document.getElementById('tgMeMeta').innerHTML = meta.map(m => `<i>${tgEsc(m)}</i>`).join('');

  const [circles, styles, ai] = await Promise.all([tgAll('circles'), tgAll('styles'), tgAll('aihist')]);
  document.getElementById('tgMeNums').innerHTML = [
    ['磕的圈', circles.length], ['文风档', styles.length],
    ['共创', ai.length], ['甜蜜值', tgMe.sweet || 0]
  ].map(([k, v]) => `<div class="tg-num"><b>${v}</b><span>${k}</span></div>`).join('');

  /* 等级区 */
  const lv = tgLvOf(tgMe.sweet || 0);
  const cur = TG_LEVELS[lv - 1], next = TG_LEVELS[lv];
  const tier = tgTierOf(lv);
  document.getElementById('tgMeBadge').innerHTML = tgBadge(lv, 54);
  document.getElementById('tgMeLvName').textContent = `LV.${lv} ${cur.name}`;
  document.getElementById('tgMeLvTier').textContent = tier.name + ' · ' + tier.perk;
  document.getElementById('tgMeSweet').textContent = tgMe.sweet || 0;
  document.getElementById('tgMeCur').textContent = `LV.${lv} 起点 ${cur.need}`;
  document.getElementById('tgMeNext').textContent = next
    ? `还差 ${next.need - (tgMe.sweet || 0)} 升至 LV.${next.lv} ${next.name}`
    : '已抵达糖罐之主';
  const pct = next ? Math.min(100, ((tgMe.sweet - cur.need) / (next.need - cur.need)) * 100) : 100;
  setTimeout(() => { document.getElementById('tgMeBar').style.width = pct + '%'; }, 120);

  document.getElementById('tgMeLvChip').innerHTML = tgBadge(lv, 19) + `<b>LV.${lv} ${tgEsc(cur.name)}</b>`;

  /* 我磕的圈 */
  const box = document.getElementById('tgMeCircles');
  box.innerHTML = circles.length
    ? `<div class="tg-mc-list">
        ${circles.slice(0, 6).map((r, i) => `
        <div class="tg-mc-card" onclick="tgOpenCircle('${r.id}')">
          <i class="tg-mc-idx">${String(i + 1).padStart(2, '0')}</i>
          <div class="tg-mc-av">${r.avatar ? `<img src="${r.avatar}">` : `<span>${tgEsc((r.name || '?')[0])}</span>`}</div>
          <div class="tg-mc-main">
            <b>${tgEsc(r.name)}</b>
            <p>${tgEsc(r.pairA.name)} × ${tgEsc(r.pairB.name)}</p>
          </div>
          <div class="tg-mc-side">
            <div class="tg-mc-date">${tgFmtDate(r.createdAt)}</div>
            <div class="tg-mc-arrow" data-ico="go"></div>
          </div>
        </div>`).join('')}
        <div class="tg-mc-foot"><span>共磕 ${circles.length} 圈</span><b>ARCHIVE</b></div>
      </div>`
    : `<p class="tg-hint">还没有圈子。去笔坊建立第一个，甜蜜值 +120。</p>`;
  tgFillIcons(box);
  window._tgArc = circles;
}

function tgProfileImage(target, dataUrl) {
  if (target === 'meav') tgMe.avatarImg = dataUrl;
  if (target === 'mebg') tgMe.bgImg = dataUrl;
  tgSaveMe(); tgRenderProfile();
  tgToast(target === 'meav' ? '头像已更新' : '背景已更新');
}

/* ---------------- 编辑资料 ---------------- */
const TG_ME_FIELDS = [
  { k: 'name', n: '昵称', ph: '别人看到的名字' },
  { k: 'handle', n: '用户名', ph: '唯一 ID，不含空格' },
  { k: 'identity', n: '身份 / 属性', ph: '如：写手 · 长佩体质 · 只吃刀' },
  { k: 'pronoun', n: '称呼偏好', ph: '如：她 / 他 / 无所谓' },
  { k: 'location', n: '所在地', ph: '可留空' },
  { k: 'birthday', n: '生日', ph: '如：11.27' }
];
function tgOpenEdit() {
  tgSheetOpen(`
    <h4>编辑资料</h4>
    <p class="tg-sheet-sub">全部可留空。头像与背景在资料页直接轻触更换。</p>
    ${TG_ME_FIELDS.map(f => `
      <div class="tg-field">
        <div class="tg-label">${f.n} <small>${f.k}</small></div>
        <input class="tg-input" id="tgMeF-${f.k}" placeholder="${f.ph}" value="${tgEsc(tgMe[f.k] || '')}">
      </div>`).join('')}
    <div class="tg-field">
      <div class="tg-label">简介 <small>bio</small></div>
      <textarea class="tg-textarea" id="tgMeF-bio" placeholder="一句话介绍你自己，或者一句只有你懂的话。">${tgEsc(tgMe.bio || '')}</textarea>
    </div>
    <div style="height:16px"></div>
    <button class="tg-btn tg-btn-dark" onclick="tgSaveEdit()">保存</button>`);
}
async function tgSaveEdit() {
  TG_ME_FIELDS.forEach(f => {
    const el = document.getElementById('tgMeF-' + f.k);
    if (el) tgMe[f.k] = el.value.trim();
  });
  const b = document.getElementById('tgMeF-bio');
  if (b) tgMe.bio = b.value.trim();
  if (!tgMe.name) tgMe.name = '糖罐用户';
  await tgSaveMe();
  tgCloseSheet(); tgRenderProfile(); tgToast('资料已更新');
}

/* ---------------- 甜蜜殿堂 ---------------- */
function tgRenderLevel() {
  const lv = tgLvOf(tgMe.sweet || 0);
  const cur = TG_LEVELS[lv - 1], next = TG_LEVELS[lv], tier = tgTierOf(lv);
  const pct = next ? Math.min(100, ((tgMe.sweet - cur.need) / (next.need - cur.need)) * 100) : 100;

  document.getElementById('tgLevelTop').innerHTML = `
    <div class="tg-sweet tg-rise tg-d1" style="cursor:default">
      <div class="tg-corner tr"></div><div class="tg-corner bl"></div>
      <div class="tg-sweet-head">
        <div class="tg-sweet-badge">${tgBadge(lv, 54)}</div>
        <div class="tg-sweet-txt"><b>LV.${lv} ${tgEsc(cur.name)}</b><p>${tgEsc(tier.name)}</p></div>
        <div class="tg-sweet-val"><b>${tgMe.sweet || 0}</b><i>SWEETNESS</i></div>
      </div>
      <div class="tg-bar"><div class="tg-bar-fill" style="width:${pct}%"></div></div>
      <div class="tg-sweet-foot"><span>本级 ${cur.need}</span><span>${next ? '下级 ' + next.need : 'MAX'}</span></div>
      <p class="tg-hint" style="margin:14px 0 0">当前阶权益：${tgEsc(tier.perk)}</p>
    </div>

    <div class="tg-field"><div class="tg-label">六阶总览 <small>tiers</small></div></div>
    ${TG_TIERS.map(t => `
      <div class="tg-rule">
        <b>${tgEsc(t.name)} · LV.${t.s} — LV.${t.e}</b>
        <p>${tgEsc(t.perk)}</p>
      </div>`).join('')}`;

  const grid = document.getElementById('tgLevelGrid');
  grid.innerHTML = TG_LEVELS.map(l => {
    const locked = l.lv > lv;
    return `<div class="tg-lv-cell ${locked ? 'locked' : ''} ${l.lv === lv ? 'cur' : ''}" onclick="tgLvDetail(${l.lv})">
      ${tgBadge(l.lv, 44)}
      <b>${tgEsc(l.name)}</b>
      <i>LV.${l.lv}</i>
    </div>`;
  }).join('');

  document.getElementById('tgRules').innerHTML = `
    <div class="tg-rule">
      <b>甜蜜值怎么来</b>
      ${TG_SWEET_RULES.map(r => `
        <div class="tg-rule-list">
          <span>${tgEsc(r.act)}<br><span style="font-size:9.5px;color:var(--tg-mist-2)">${tgEsc(r.note)}</span></span>
          <b>${tgEsc(r.val)}</b>
        </div>`).join('')}
    </div>
    ${TG_RULE_TEXT.map(r => `<div class="tg-rule"><b>${tgEsc(r.t)}</b><p>${tgEsc(r.d)}</p></div>`).join('')}
    <div class="tg-rule">
      <b>三十级门槛一览</b>
      ${TG_LEVELS.map(l => `<div class="tg-rule-list"><span>LV.${l.lv} ${tgEsc(l.name)}</span><b>${l.need}</b></div>`).join('')}
    </div>`;
}

function tgLvDetail(n) {
  const l = TG_LEVELS[n - 1], t = tgTierOf(n);
  const have = (tgMe.sweet || 0) >= l.need;
  const prev = n > 1 ? TG_LEVELS[n - 2].need : 0;
  tgSheetOpen(`
    <div style="text-align:center;padding:6px 0 4px">${tgBadge(n, 92)}</div>
    <h4 style="text-align:center;margin-top:10px">LV.${n} ${tgEsc(l.name)}</h4>
    <p class="tg-sheet-sub" style="text-align:center">${tgEsc(t.name)} · 徽章编号 ${String(n).padStart(2, '0')} / 30</p>
    <div class="tg-rule" style="margin-top:16px">
      <b>解锁条件</b>
      <p>累计甜蜜值达到 <b>${l.need}</b>。本级区间 ${prev} — ${l.need}。
      ${have ? '你已经解锁这一枚。' : `还差 ${l.need - (tgMe.sweet || 0)} 点。`}</p>
    </div>
    <div class="tg-rule">
      <b>本阶权益</b>
      <p>${tgEsc(t.perk)}（高阶自动包含低阶全部权益）</p>
    </div>
    <div class="tg-rule">
      <b>徽章说明</b>
      <p>第 ${n} 枚徽章为独立形制，与其余 29 枚在几何构成、对称方式与明暗层次上均不重复。升到本级时自动佩戴，LV.26 起可自由切换回任意已解锁徽章。</p>
    </div>`);
}

function tgInitProfile() { tgLoadMe(); }