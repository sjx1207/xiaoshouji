/* ================================
   Identity Page — user.js
================================ */

/* ---- 状态栏时间同步 ---- */
function updateTime() {
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const el = document.getElementById('statusTime');
  if (el) el.textContent = `${h}:${m}`;
}
updateTime();
setInterval(updateTime, 10000);

/* ---- 数据存储 ---- */
const STORE_KEY = 'luna_identities_v1';

function loadIdentities() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveIdentities(list) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
}

let identities = loadIdentities();
let pendingTags = [];
let selectedAvatarColor = '#1a1a22';
let currentDetailId = null;

/* ---- 渲染卡片列表 ---- */
function renderCards() {
  const grid = document.getElementById('cardsGrid');
  const empty = document.getElementById('emptyState');

  // 统计
  document.getElementById('statTotal').textContent = identities.length;
  const activeCount = identities.filter(i => i.active).length;
  document.getElementById('statActive').textContent = activeCount;
  const mainRole = identities.length > 0 ? (identities[0].role || '—') : '—';
  const roleEl = document.getElementById('statRole');
  roleEl.textContent = mainRole.length > 5 ? mainRole.slice(0, 5) + '…' : (mainRole || '—');

  // 清空旧卡片（保留 emptyState）
  Array.from(grid.querySelectorAll('.id-card, .deco-line')).forEach(el => el.remove());

  if (identities.length === 0) {
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  identities.forEach((identity, idx) => {
    const card = buildCard(identity, idx);
    grid.appendChild(card);
  });
}

function buildCard(identity, idx) {
  const card = document.createElement('div');
  card.className = 'id-card';
  card.style.animationDelay = `${idx * 0.06}s`;
  card.onclick = () => openDetail(identity.id);

  const initial = identity.name ? identity.name[0].toUpperCase() : '?';
  const isActive = identity.active !== false;

  // 格式化日期
  const date = new Date(identity.createdAt);
  const dateStr = `${date.getFullYear()}.${String(date.getMonth()+1).padStart(2,'0')}.${String(date.getDate()).padStart(2,'0')}`;

  // ID 编号
  const idNum = `#${String(identity.id).slice(-6).toUpperCase()}`;

  const tagsHtml = (identity.tags || []).slice(0, 3).map(t =>
    `<span class="card-tag">${escHtml(t)}</span>`
  ).join('');

  card.innerHTML = `
    <div class="card-topbar ${isActive ? '' : 'inactive'}"></div>
    <div class="card-inner">
      <div class="card-avatar" style="background:${identity.avatarColor || '#1a1a22'}">
        ${initial}
      </div>
      <div class="card-info">
        <div class="card-name">${escHtml(identity.name)}</div>
        ${identity.role ? `<div class="card-role">${escHtml(identity.role)}</div>` : ''}
        ${identity.desc ? `<div class="card-desc">${escHtml(identity.desc)}</div>` : ''}
        ${tagsHtml ? `<div class="card-tags">${tagsHtml}</div>` : ''}
      </div>
      <div class="card-right">
        <div class="card-status">
          <div class="status-dot ${isActive ? '' : 'inactive'}"></div>
          <span>${isActive ? 'LIVE' : 'OFF'}</span>
        </div>
        <div class="card-chevron">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </div>
      </div>
    </div>
    <div class="card-footer">
      <div class="card-date">${dateStr}</div>
      <div class="card-id-num">${idNum}</div>
    </div>
  `;

  return card;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---- 添加面板 ---- */
function openAddPanel() {
  // 重置表单
  document.getElementById('inputName').value = '';
  document.getElementById('inputRole').value = '';
  document.getElementById('inputDesc').value = '';
  document.getElementById('inputTag').value = '';
  document.getElementById('toggleActive').checked = true;
  pendingTags = [];
  renderTagList();

  // 重置头像
  selectedAvatarColor = '#1a1a22';
  document.querySelectorAll('.avatar-chip').forEach((chip, i) => {
    chip.classList.toggle('selected', i === 0);
    chip.textContent = 'A';
  });

  document.getElementById('panelOverlay').classList.add('active');
  document.getElementById('addPanel').classList.add('active');

  setTimeout(() => document.getElementById('inputName').focus(), 400);
}

function closeAddPanel() {
  document.getElementById('panelOverlay').classList.remove('active');
  document.getElementById('addPanel').classList.remove('active');
}

function closePanelCheck(e) {
  if (e.target === document.getElementById('panelOverlay')) closeAddPanel();
}

/* ---- 头像颜色 ---- */
function selectAvatarColor(el) {
  document.querySelectorAll('.avatar-chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  selectedAvatarColor = el.dataset.color;
}

/* ---- 同步头像字母 ---- */
function syncAvatarLetter(val) {
  const letter = val ? val[0].toUpperCase() : 'A';
  document.querySelectorAll('.avatar-chip').forEach(chip => {
    chip.textContent = letter;
  });
}

/* ---- 标签 ---- */
function addTagOnEnter(e) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault();
    const val = e.target.value.trim().replace(/,$/, '');
    if (val && pendingTags.length < 6 && !pendingTags.includes(val)) {
      pendingTags.push(val);
      renderTagList();
    }
    e.target.value = '';
  }
}

function renderTagList() {
  const list = document.getElementById('tagList');
  list.innerHTML = pendingTags.map((t, i) =>
    `<div class="tag-pill">
      ${escHtml(t)}
      <span class="tag-del" onclick="removeTag(${i})">×</span>
    </div>`
  ).join('');
}

function removeTag(i) {
  pendingTags.splice(i, 1);
  renderTagList();
}

/* ---- 提交身份 ---- */
function submitIdentity() {
  const name = document.getElementById('inputName').value.trim();
  if (!name) {
    shakeInput('inputName');
    return;
  }

  const identity = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    role: document.getElementById('inputRole').value.trim(),
    desc: document.getElementById('inputDesc').value.trim(),
    tags: [...pendingTags],
    active: document.getElementById('toggleActive').checked,
    avatarColor: selectedAvatarColor,
    createdAt: Date.now()
  };

  identities.unshift(identity);
  saveIdentities(identities);
  renderCards();
  closeAddPanel();
}

function shakeInput(id) {
  const el = document.getElementById(id);
  el.style.borderColor = '#ff3b30';
  el.style.animation = 'shake 0.35s ease';
  setTimeout(() => {
    el.style.borderColor = '';
    el.style.animation = '';
  }, 400);
}

/* 抖动动画 */
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
@keyframes shake {
  0%,100% { transform: translateX(0); }
  20%      { transform: translateX(-6px); }
  40%      { transform: translateX(6px); }
  60%      { transform: translateX(-4px); }
  80%      { transform: translateX(4px); }
}`;
document.head.appendChild(shakeStyle);

/* ---- 详情面板 ---- */
function openDetail(id) {
  const identity = identities.find(i => i.id === id);
  if (!identity) return;
  currentDetailId = id;

  const initial = identity.name ? identity.name[0].toUpperCase() : '?';
  const isActive = identity.active !== false;
  const date = new Date(identity.createdAt);
  const dateStr = `${date.getFullYear()} 年 ${date.getMonth()+1} 月 ${date.getDate()} 日`;
  const idNum = `ID · ${identity.id.toUpperCase()}`;

  const tagsHtml = (identity.tags || []).length > 0
    ? `<div class="detail-section">
         <div class="detail-section-label">标签</div>
         <div class="detail-tags">
           ${identity.tags.map(t => `<span class="detail-tag">${escHtml(t)}</span>`).join('')}
         </div>
       </div>`
    : '';

  const descHtml = identity.desc
    ? `<div class="detail-section">
         <div class="detail-section-label">备注</div>
         <div class="detail-section-value">${escHtml(identity.desc)}</div>
       </div>`
    : '';

  document.getElementById('detailContent').innerHTML = `
    <div class="detail-avatar-row">
      <div class="detail-avatar" style="background:${identity.avatarColor || '#1a1a22'}">${initial}</div>
      <div>
        <div class="detail-name">${escHtml(identity.name)}</div>
        ${identity.role ? `<div class="detail-role">${escHtml(identity.role)}</div>` : ''}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-label">状态</div>
      <div class="detail-status-row">
        <div class="detail-status">
          <div class="status-dot ${isActive ? '' : 'inactive'}"></div>
          <span>${isActive ? '激活中' : '已停用'}</span>
        </div>
        <button class="detail-delete-btn" onclick="deleteIdentity('${identity.id}')">删除身份</button>
      </div>
    </div>

    ${tagsHtml}
    ${descHtml}

    <div class="detail-section">
      <div class="detail-section-label">创建时间</div>
      <div class="detail-section-value">${dateStr}</div>
    </div>

    <div class="detail-section">
      <div class="detail-section-label">档案编号</div>
      <div class="detail-section-value" style="font-family:'Space Mono',monospace;font-size:12px;letter-spacing:1px;color:#8a8a95">${idNum}</div>
    </div>
  `;

  document.getElementById('detailOverlay').classList.add('active');
  document.getElementById('detailPanel').classList.add('active');
}

function closeDetail() {
  document.getElementById('detailOverlay').classList.remove('active');
  document.getElementById('detailPanel').classList.remove('active');
}

function deleteIdentity(id) {
  if (!confirm('确定要删除这个身份档案吗？')) return;
  identities = identities.filter(i => i.id !== id);
  saveIdentities(identities);
  renderCards();
  closeDetail();
}

/* ---- 初始化 ---- */
renderCards();