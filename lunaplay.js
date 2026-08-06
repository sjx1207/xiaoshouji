/* ==========================================================================
   Lunaplay — Core Navigation Interaction
   ========================================================================== */

(function () {
  const navItems = Array.from(document.querySelectorAll('.lunanav__item'));
  const glow = document.getElementById('lunanavGlow');
  const moon = document.getElementById('lunanavMoon');
  const track = document.querySelector('.lunanav__track');
  const pages = Array.from(document.querySelectorAll('.page'));

  let current = 'recommend';

  function positionIndicators(activeBtn, animate) {
    const trackRect = track.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    // glow：定位到按钮中心，圆形跟随
    const glowSize = 52;
    const glowLeft = (btnRect.left - trackRect.left) + btnRect.width / 2 - glowSize / 2;
    glow.style.transition = animate ? '' : 'none';
    glow.style.transform = `translateX(${glowLeft - 8}px)`;

    // moon：定位到按钮中心正上方基线上
    const moonLeft = (btnRect.left - trackRect.left) + btnRect.width / 2 - 2.5;
    moon.style.transition = animate ? '' : 'none';
    moon.style.left = `${moonLeft}px`;

    if (!animate) {
      // 强制回流后恢复 transition，避免初始化时出现滑动动画
      void glow.offsetWidth;
      void moon.offsetWidth;
      glow.style.transition = '';
      moon.style.transition = '';
    }
  }

  function switchTo(target, opts) {
    opts = opts || {};
    if (target === current && !opts.force) return;

    const activeBtn = navItems.find((btn) => btn.dataset.target === target);
    if (!activeBtn) return;

    navItems.forEach((btn) => {
      const isActive = btn.dataset.target === target;
      btn.classList.toggle('is-active', isActive);
      if (isActive) {
        btn.classList.remove('is-pulsing');
        void btn.offsetWidth;
        btn.classList.add('is-pulsing');
      }
    });

    pages.forEach((page) => {
      page.classList.toggle('is-active', page.dataset.page === target);
    });

    positionIndicators(activeBtn, true);
    current = target;

    document.dispatchEvent(new CustomEvent('lunaplay:pagechange', { detail: { page: target } }));
  }

  navItems.forEach((btn) => {
    btn.addEventListener('click', () => switchTo(btn.dataset.target));
  });

  // 初始化定位（无动画，避免首帧从左上角滑入）
  window.addEventListener('load', () => {
    const initialBtn = navItems.find((btn) => btn.classList.contains('is-active'));
    positionIndicators(initialBtn, false);
    pages.forEach((page) => {
      page.classList.toggle('is-active', page.dataset.page === current);
    });
  });

  // 视口尺寸变化时重新定位（不做动画）
  window.addEventListener('resize', () => {
    const activeBtn = navItems.find((btn) => btn.classList.contains('is-active'));
    positionIndicators(activeBtn, false);
  });

  // 暴露一个简单的路由方法供其他脚本或按钮调用（例如私信页跳转到某会话后返回等）
  window.Lunaplay = window.Lunaplay || {};
  window.Lunaplay.switchTo = switchTo;

  // 推荐页激活时，状态栏切换为深色背景样式
  const appEl = document.querySelector('.app');
  function syncStatusbarTheme(page) {
    appEl.classList.toggle('is-on-dark', page === 'recommend');
  }
  document.addEventListener('lunaplay:pagechange', (e) => syncStatusbarTheme(e.detail.page));
  window.addEventListener('load', () => syncStatusbarTheme(current));
})();


/* ==========================================================================
   推荐页 Feed 交互
   ========================================================================== */
(function () {
  const stream = document.getElementById('feedStream');
  if (!stream) return;

  const tabs = document.querySelectorAll('.feed__tab');
  const allCards = Array.from(document.querySelectorAll('.feedcard[data-feedtab]'));

  // Tab 切换：按 data-feedtab 过滤 feed 流，真正显示不同的内容分组
  function switchFeedTab(tabName) {
    allCards.forEach((card) => {
      const match = card.dataset.feedtab === tabName;
      card.style.display = match ? '' : 'none';
    });
    stream.scrollTo({ top: 0, behavior: 'auto' });
    // 重新点燃首张可见卡片的播放条
    requestAnimationFrame(() => {
      const firstVisible = allCards.find((c) => c.dataset.feedtab === tabName);
      const fill = firstVisible && firstVisible.querySelector('.feedcard__playbar-fill');
      if (fill) {
        fill.classList.remove('is-playing');
        void fill.offsetWidth;
        fill.classList.add('is-playing');
      }
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      switchFeedTab(tab.dataset.tab);
    });
  });

  // 初始状态：只显示"推荐"分组
  switchFeedTab('recommend');

  function formatCount(n) {
    return n >= 1000 ? (n).toFixed(1) + 'k' : String(Math.round(n));
  }

  // 点赞切换态 + 数字动画反馈
  document.querySelectorAll('.actionbtn[data-action="like"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.classList.toggle('is-liked');
      const numEl = btn.querySelector('.actionbtn__num');
      const base = parseFloat(numEl.textContent);
      if (btn.classList.contains('is-liked')) {
        numEl.dataset.original = numEl.textContent;
        numEl.textContent = formatCount(base + 1);
      } else if (numEl.dataset.original) {
        numEl.textContent = numEl.dataset.original;
      }
    });
  });

  // 收藏切换态
  document.querySelectorAll('.actionbtn[data-action="collect"]').forEach((btn) => {
    btn.addEventListener('click', () => btn.classList.toggle('is-collected'));
  });

  // 关注按钮
  document.querySelectorAll('.feedcard__follow').forEach((btn) => {
    btn.addEventListener('click', () => {
      const following = btn.classList.toggle('is-following');
      btn.textContent = following ? '已关注' : '关注';
    });
  });

  // ---- 播放进度条：卡片滑入视口时启动"播放"动画，滑出则重置 ----
  const playCards = Array.from(document.querySelectorAll('.feedcard'));
  if (playCards.length) {
    const playObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const fill = entry.target.querySelector('.feedcard__playbar-fill');
        if (!fill) return;
        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
          fill.classList.remove('is-playing');
          void fill.offsetWidth;
          fill.classList.add('is-playing');
        } else {
          fill.classList.remove('is-playing');
          const startPct = getComputedStyle(fill).getPropertyValue('--pb-start').trim() || '0%';
          fill.style.width = startPct;
        }
      });
    }, { threshold: [0, 0.6, 1] });
    playCards.forEach((card) => {
      if (card.querySelector('.feedcard__playbar-fill')) playObserver.observe(card);
    });

    // 首屏卡片默认可见，但 observer 要等下一次交叉计算才会回调，
    // 所以这里主动检测一次视口内的卡片并立刻点燃播放条，避免刚进页面时进度条静止不动
    requestAnimationFrame(() => {
      playCards.forEach((card) => {
        const fill = card.querySelector('.feedcard__playbar-fill');
        if (!fill) return;
        const rect = card.getBoundingClientRect();
        const visibleRatio = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0)) / rect.height;
        if (visibleRatio > 0.6) {
          fill.classList.add('is-playing');
        }
      });
    });
  }

  // ---- 互动型卡片：观众投票，选中后揭晓双方占比 ----
  const interactPanel = document.getElementById('interactPanel');
  if (interactPanel) {
    const opts = Array.from(interactPanel.querySelectorAll('.interactopt'));
    opts.forEach((opt) => {
      opt.addEventListener('click', () => {
        if (interactPanel.classList.contains('is-locked')) return;
        interactPanel.classList.add('is-locked');
        opts.forEach((o) => {
          o.classList.add('is-revealed');
          o.classList.toggle('is-picked', o === opt);
        });
      });
    });
  }

  // ---- 分支结局型卡片：滑入片尾时自动展开走向选择面板 ----
  const branchCard = document.querySelector('.feedcard__branch');
  if (branchCard) {
    const branchResult = document.getElementById('branchResult');
    const endings = {
      a: '她推开门的那一刻，捧花掉在地上，谁都没去捡。后来他说，那是他这辈子最不后悔的一次冲动。',
      b: '他把花放在门口，转身走了。婚礼准时开始，只是新娘捏着捧花时，手一直没停止发抖。'
    };

    const branchObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        branchCard.classList.toggle('is-visible', entry.isIntersecting && entry.intersectionRatio > 0.7);
      });
    }, { threshold: [0, 0.7, 1] });
    branchObserver.observe(branchCard.closest('.feedcard'));

    branchCard.querySelectorAll('.branchopt').forEach((btn) => {
      btn.addEventListener('click', () => {
        branchCard.querySelectorAll('.branchopt').forEach((b) => b.classList.remove('is-chosen'));
        btn.classList.add('is-chosen');
        branchResult.textContent = endings[btn.dataset.ending] || '';
        branchResult.classList.add('is-visible');
      });
    });
  }

  // ---- 图集型卡片：横向滑动时同步底部圆点 ----
  const galleryStream = document.getElementById('galleryStream');
  const galleryDots = document.getElementById('galleryDots');
  if (galleryStream && galleryDots) {
    const dots = Array.from(galleryDots.children);
    let galleryTicking = false;
    galleryStream.addEventListener('scroll', () => {
      if (galleryTicking) return;
      galleryTicking = true;
      requestAnimationFrame(() => {
        const idx = Math.round(galleryStream.scrollLeft / galleryStream.clientWidth);
        dots.forEach((d, i) => d.classList.toggle('is-active', i === idx));
        galleryTicking = false;
      });
    });
  }
})();


/* ==========================================================================
   好友圈 Friends 交互
   ========================================================================== */
(function () {
  document.querySelectorAll('.momentbtn[data-action="like"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const liked = btn.classList.toggle('is-liked');
      const numEl = btn.querySelector('span');
      const base = parseInt(numEl.textContent, 10);
      numEl.textContent = liked ? base + 1 : base - 1;
    });
  });

  document.querySelectorAll('.story').forEach((story) => {
    story.addEventListener('click', () => {
      story.classList.remove('is-unread');
    });
  });
})();


/* ==========================================================================
   私信 Messages 交互：会话左滑呼出操作
   ========================================================================== */
(function () {
  const convWraps = document.querySelectorAll('.convwrap');
  if (!convWraps.length) return;

  let openWrap = null;

  function closeOpen() {
    if (openWrap) {
      openWrap.classList.remove('is-swiped');
      openWrap = null;
    }
  }

  convWraps.forEach((wrap) => {
    const conv = wrap.querySelector('.conv');
    let startX = 0;
    let startY = 0;
    let dragging = false;
    let axisLocked = null;

    conv.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = true;
      axisLocked = null;
    }, { passive: true });

    conv.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;

      if (axisLocked === null) {
        axisLocked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }
      if (axisLocked === 'y') return;

      if (dx < -30) {
        if (openWrap && openWrap !== wrap) closeOpen();
        wrap.classList.add('is-swiped');
        openWrap = wrap;
      } else if (dx > 30) {
        wrap.classList.remove('is-swiped');
        if (openWrap === wrap) openWrap = null;
      }
    }, { passive: true });

    conv.addEventListener('touchend', () => { dragging = false; });

    // 桌面端点击模拟：点击已展开的会话则收起，否则正常触发（此处仅演示，不跳转详情页）
    conv.addEventListener('click', (e) => {
      if (wrap.classList.contains('is-swiped')) {
        e.preventDefault();
        wrap.classList.remove('is-swiped');
        openWrap = null;
      }
    });
  });

  document.querySelectorAll('.convactions__btn--del').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.convwrap');
      wrap.style.transition = 'max-height .32s ease, opacity .32s ease, margin .32s ease';
      wrap.style.maxHeight = wrap.offsetHeight + 'px';
      requestAnimationFrame(() => {
        wrap.style.maxHeight = '0px';
        wrap.style.opacity = '0';
      });
      setTimeout(() => wrap.remove(), 320);
    });
  });

  document.querySelectorAll('.convactions__btn--pin').forEach((btn) => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.convwrap');
      const list = wrap.parentElement;
      list.prepend(wrap);
      wrap.classList.remove('is-swiped');
      openWrap = null;
    });
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.convwrap')) closeOpen();
  });
})();


/* ==========================================================================
   个人中心 Profile 交互：标签切换
   ========================================================================== */
(function () {
  const tabs = document.querySelectorAll('.ptab');
  const indicator = document.getElementById('ptabIndicator');
  if (!tabs.length) return;

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      indicator.style.transform = `translateX(${i * 100}%)`;
    });
  });
})();


/* ==========================================================================
   身份编辑 / 创建 弹窗：IndexedDB 持久化 + 表单交互 + 身份切换
   ========================================================================== */
(function () {
  const modal = document.getElementById('idModal');
  if (!modal) return;

  const backdrop = document.getElementById('idModalBackdrop');
  const closeBtn = document.getElementById('idModalClose');
  const openBtn = document.getElementById('profileEditBtn');
  const form = document.getElementById('idForm');
  const titleEl = document.getElementById('idModalTitle');

  const coverInput = document.getElementById('idCoverInput');
  const coverPreview = document.getElementById('idCoverPreview');
  const avatarInput = document.getElementById('idAvatarInput');
  const avatarPreview = document.getElementById('idAvatarPreview');

  const nicknameInput = document.getElementById('idNickname');
  const bioInput = document.getElementById('idBio');
  const followersInput = document.getElementById('idFollowers');

  const roleChipsWrap = document.getElementById('idRoleChips');
  const roleCustomBtn = document.getElementById('idRoleCustomBtn');
  const roleCustomInput = document.getElementById('idRoleCustomInput');

  const verifyToggle = document.getElementById('idVerifyToggle');
  const verifyTypeField = document.getElementById('idVerifyTypeField');
  const verifyChipsWrap = document.getElementById('idVerifyChips');
  const verifyCustomBtn = document.getElementById('idVerifyCustomBtn');
  const verifyCustomInput = document.getElementById('idVerifyCustomInput');

  const switchRow = document.getElementById('idSwitchRow');
  const switchAddBtn = document.getElementById('idSwitchAdd');

  // ---------- IndexedDB：身份档案数据库 ----------
  const DB_NAME = 'lunaplay_identity_db';
  const STORE = 'identities';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function dbGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- 状态 ----------
  let identities = [];
  let activeId = null;
  let editingId = null; // 当前表单正在编辑/新建的身份 id
  let coverData = '';
  let avatarData = '';
  let selectedRole = '';
  let selectedVerifyType = '';
  let isVerified = false;

  function uid() {
    return 'id_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ---------- 弹窗开关 ----------
  function openModal(mode) {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (mode === 'create') {
      resetForm();
      titleEl.textContent = '创建身份';
    } else {
      titleEl.textContent = '编辑资料';
    }
  }

  function closeModal() {
    // 关闭前先把焦点移出弹窗，避免 aria-hidden 隐藏了仍持有焦点的元素
    if (modal.contains(document.activeElement)) {
      (openBtn || document.body).focus();
    }
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (openBtn) openBtn.addEventListener('click', () => {
    const active = identities.find((i) => i.id === activeId);
    if (active) {
      editingId = active.id;
      fillForm(active);
      openModal('edit');
    } else {
      editingId = null;
      openModal('create');
    }
  });

  switchAddBtn && switchAddBtn.addEventListener('click', () => {
    editingId = null;
    resetForm();
    titleEl.textContent = '创建身份';
  });

  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  // ---------- 图片上传预览 ----------
  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  coverInput.addEventListener('change', async () => {
    const file = coverInput.files && coverInput.files[0];
    if (!file) return;
    coverData = await readFileAsDataURL(file);
    coverPreview.style.backgroundImage = `url(${coverData})`;
    coverPreview.classList.add('has-image');
  });

  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files && avatarInput.files[0];
    if (!file) return;
    avatarData = await readFileAsDataURL(file);
    avatarPreview.style.backgroundImage = `url(${avatarData})`;
    avatarPreview.classList.add('has-image');
  });

  // ---------- 身份类型 chips ----------
  function setupChipGroup(wrap, customBtn, customInput, onSelect) {
    wrap.querySelectorAll('.idchip').forEach((chip) => {
      if (chip === customBtn) return;
      chip.addEventListener('click', () => {
        wrap.querySelectorAll('.idchip').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        customInput.hidden = true;
        customInput.value = '';
        onSelect(chip.dataset.role || chip.dataset.vtype || chip.textContent.trim());
      });
    });
    customBtn.addEventListener('click', () => {
      wrap.querySelectorAll('.idchip').forEach((c) => c.classList.remove('is-active'));
      customBtn.classList.add('is-active');
      customInput.hidden = false;
      customInput.focus();
      onSelect(customInput.value.trim());
    });
    customInput.addEventListener('input', () => {
      onSelect(customInput.value.trim());
    });
  }

  setupChipGroup(roleChipsWrap, roleCustomBtn, roleCustomInput, (v) => { selectedRole = v; });
  setupChipGroup(verifyChipsWrap, verifyCustomBtn, verifyCustomInput, (v) => { selectedVerifyType = v; });

  // ---------- 认证开关 ----------
  verifyToggle.querySelectorAll('.idtoggle__opt').forEach((opt) => {
    opt.addEventListener('click', () => {
      verifyToggle.querySelectorAll('.idtoggle__opt').forEach((o) => o.classList.remove('is-active'));
      opt.classList.add('is-active');
      isVerified = opt.dataset.verify === '1';
      verifyTypeField.hidden = !isVerified;
    });
  });

  // ---------- 表单重置 / 填充 ----------
  function resetForm() {
    form.reset();
    coverData = '';
    avatarData = '';
    selectedRole = '';
    selectedVerifyType = '';
    isVerified = false;

    coverPreview.style.backgroundImage = '';
    coverPreview.classList.remove('has-image');
    avatarPreview.style.backgroundImage = '';
    avatarPreview.classList.remove('has-image');

    roleChipsWrap.querySelectorAll('.idchip').forEach((c) => c.classList.remove('is-active'));
    roleCustomInput.hidden = true;
    roleCustomInput.value = '';

    verifyChipsWrap.querySelectorAll('.idchip').forEach((c) => c.classList.remove('is-active'));
    verifyCustomInput.hidden = true;
    verifyCustomInput.value = '';

    verifyToggle.querySelectorAll('.idtoggle__opt').forEach((o) => o.classList.remove('is-active'));
    verifyToggle.querySelector('[data-verify="0"]').classList.add('is-active');
    verifyTypeField.hidden = true;
  }

  function fillForm(identity) {
    resetForm();
    nicknameInput.value = identity.nickname || '';
    bioInput.value = identity.bio || '';
    followersInput.value = identity.followers || 0;

    if (identity.cover) {
      coverData = identity.cover;
      coverPreview.style.backgroundImage = `url(${coverData})`;
      coverPreview.classList.add('has-image');
    }
    if (identity.avatar) {
      avatarData = identity.avatar;
      avatarPreview.style.backgroundImage = `url(${avatarData})`;
      avatarPreview.classList.add('has-image');
    }

    selectedRole = identity.role || '';
    if (selectedRole) {
      const matchChip = Array.from(roleChipsWrap.querySelectorAll('.idchip[data-role]')).find((c) => c.dataset.role === selectedRole);
      if (matchChip) {
        matchChip.classList.add('is-active');
      } else {
        roleCustomBtn.classList.add('is-active');
        roleCustomInput.hidden = false;
        roleCustomInput.value = selectedRole;
      }
    }

    isVerified = !!identity.isVerified;
    verifyToggle.querySelectorAll('.idtoggle__opt').forEach((o) => o.classList.remove('is-active'));
    verifyToggle.querySelector(`[data-verify="${isVerified ? '1' : '0'}"]`).classList.add('is-active');
    verifyTypeField.hidden = !isVerified;

    selectedVerifyType = identity.verifyType || '';
    if (selectedVerifyType) {
      const matchChip = Array.from(verifyChipsWrap.querySelectorAll('.idchip[data-vtype]')).find((c) => c.dataset.vtype === selectedVerifyType);
      if (matchChip) {
        matchChip.classList.add('is-active');
      } else {
        verifyCustomBtn.classList.add('is-active');
        verifyCustomInput.hidden = false;
        verifyCustomInput.value = selectedVerifyType;
      }
    }
  }

  // ---------- 提交保存 ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nickname = nicknameInput.value.trim() || '未命名用户';
    const bio = bioInput.value.trim();
    const followers = Math.max(0, parseInt(followersInput.value, 10) || 0);

    const record = {
      id: editingId || uid(),
      nickname,
      bio,
      role: selectedRole,
      isVerified,
      verifyType: isVerified ? selectedVerifyType : '',
      followers,
      cover: coverData,
      avatar: avatarData,
      createdAt: Date.now()
    };

    await dbPut(record);

    const idx = identities.findIndex((i) => i.id === record.id);
    if (idx >= 0) identities[idx] = record; else identities.push(record);

    activeId = record.id;
    editingId = record.id;

    renderSwitchRow();
    applyIdentityToProfile(record);
    closeModal();
  });

  // ---------- 身份切换条渲染 ----------
  function renderSwitchRow() {
    switchRow.querySelectorAll('.idswitch__card').forEach((el) => el.remove());

    identities.forEach((identity) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'idswitch__card' + (identity.id === activeId ? ' is-active' : '');

      const avatar = document.createElement('span');
      avatar.className = 'idswitch__avatar';
      if (identity.avatar) avatar.style.backgroundImage = `url(${identity.avatar})`;
      avatar.style.backgroundSize = 'cover';
      avatar.style.backgroundPosition = 'center';

      const name = document.createElement('span');
      name.className = 'idswitch__name';
      name.textContent = identity.nickname;

      card.appendChild(avatar);
      card.appendChild(name);

      if (identity.isVerified) {
        const badge = document.createElement('span');
        badge.className = 'idswitch__verify';
        badge.innerHTML = verifyBadgeSVG();
        card.appendChild(badge);
      }

      card.addEventListener('click', () => {
        activeId = identity.id;
        renderSwitchRow();
        applyIdentityToProfile(identity);
        editingId = identity.id;
        fillForm(identity);
        titleEl.textContent = '编辑资料';
      });

      switchRow.insertBefore(card, switchAddBtn);
    });
  }

  function verifyBadgeSVG() {
    return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5l2.4 2.1 3.1-.4 1 3 2.7 1.6-.7 3.1.7 3.1-2.7 1.6-1 3-3.1-.4L12 21.5l-2.4-2.1-3.1.4-1-3-2.7-1.6.7-3.1-.7-3.1 2.7-1.6 1-3 3.1.4L12 2.5Z" fill="var(--ink)"/><path d="M8.5 12.3l2.2 2.2 4.5-4.8" stroke="var(--surface)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  // ---------- 应用身份到个人中心页面 ----------
  function applyIdentityToProfile(identity) {
    const nameEl = document.getElementById('profileName');
    const badgeEl = document.getElementById('profileVerifyBadge');
    const handleEl = document.getElementById('profileHandle');
    const bioEl = document.getElementById('profileBio');
    const coverEl = document.getElementById('profileCover');
    const avatarEl = document.getElementById('profileAvatar');
    const followersEl = document.getElementById('statFollowers');

    nameEl.childNodes[0].nodeValue = identity.nickname;
    if (identity.isVerified) {
      badgeEl.hidden = false;
      badgeEl.innerHTML = verifyBadgeSVG();
    } else {
      badgeEl.hidden = true;
    }

    handleEl.textContent = (identity.role ? identity.role : '添加个性签名') +
      (identity.isVerified && identity.verifyType ? ' · ' + identity.verifyType : '');

    if (identity.bio) {
      bioEl.textContent = identity.bio;
      bioEl.classList.remove('profile__bio--empty');
    } else {
      bioEl.textContent = '写点什么，介绍一下自己吧。';
      bioEl.classList.add('profile__bio--empty');
    }

    if (identity.cover) {
      coverEl.style.backgroundImage = `url(${identity.cover})`;
      coverEl.style.backgroundSize = 'cover';
      coverEl.style.backgroundPosition = 'center';
    }
    if (identity.avatar) {
      avatarEl.style.backgroundImage = `url(${identity.avatar})`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
    }

    followersEl.textContent = formatNum(identity.followers || 0);
  }

  function formatNum(n) {
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + 'w';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  // ---------- 初始化：从 IndexedDB 加载 ----------
  (async function init() {
    try {
      identities = await dbGetAll();
      identities.sort((a, b) => a.createdAt - b.createdAt);
      if (identities.length) {
        activeId = identities[0].id;
        renderSwitchRow();
        applyIdentityToProfile(identities[0]);
      }
    } catch (err) {
      console.error('身份数据库加载失败', err);
    }
  })();
})();


/* ==========================================================================
   AI 内容方案 · 设计器弹窗：IndexedDB 存档 + 自绘选择器 + 列表/表单视图
   ========================================================================== */
(function () {
  const modal = document.getElementById('schemeModal');
  if (!modal) return;

  const backdrop = document.getElementById('schemeModalBackdrop');
  const closeBtn = document.getElementById('schemeModalClose');
  const settingsBtn = document.getElementById('profileSettingsBtn');

  const viewList = document.getElementById('schemeViewList');
  const listEl = document.getElementById('schemeList');
  const listEmpty = document.getElementById('schemeListEmpty');
  const newBtn = document.getElementById('schemeNewBtn');

  const form = document.getElementById('schemeForm');
  const backBtn = document.getElementById('schemeFormBack');
  const titleEl = document.getElementById('schemeModalTitle');

  const nameInput = document.getElementById('scName');
  const worldInput = document.getElementById('scWorld');
  const themeInput = document.getElementById('scTheme');
  const charactersInput = document.getElementById('scCharacters');
  const conflictInput = document.getElementById('scConflict');
  const styleInput = document.getElementById('scStyle');
  const noteInput = document.getElementById('scNote');

  const typeChipsWrap = document.getElementById('scTypeChips');
  const typeCustomBtn = document.getElementById('scTypeCustomBtn');
  const typeCustomInput = document.getElementById('scTypeCustomInput');

  const moodChipsWrap = document.getElementById('scMoodChips');

  // ---------- IndexedDB：内容方案数据库 ----------
  const DB_NAME = 'lunaplay_scheme_db';
  const STORE = 'schemes';
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function dbGetAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function dbPut(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function dbDelete(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // ---------- 状态 ----------
  let schemes = [];
  let editingId = null;
  let selectedType = '';
  let selectedMoods = [];
  let selectedPerspective = '';
  let selectedLength = '';
  let selectedTone = '';

  function uid() {
    return 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ---------- 弹窗开关 ----------
  function openModal() {
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    showListView();
  }
  function closeModal() {
    // 关闭前先把焦点移出弹窗，避免 aria-hidden 隐藏了仍持有焦点的元素
    if (modal.contains(document.activeElement)) {
      (settingsBtn || document.body).focus();
    }
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    closeAllSelects();
  }
  if (settingsBtn) settingsBtn.addEventListener('click', openModal);
  backdrop.addEventListener('click', closeModal);
  closeBtn.addEventListener('click', closeModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  // ---------- 视图切换 ----------
  function showListView() {
    viewList.hidden = false;
    form.hidden = true;
    titleEl.textContent = '内容方案';
    renderList();
  }
  function showFormView(mode) {
    viewList.hidden = true;
    form.hidden = false;
    titleEl.textContent = mode === 'edit' ? '编辑方案' : '新建方案';
  }
  newBtn.addEventListener('click', () => {
    editingId = null;
    resetForm();
    showFormView('new');
  });
  backBtn.addEventListener('click', showListView);

  // ---------- chips：内容类型（单选）----------
  typeChipsWrap.querySelectorAll('.schemechip').forEach((chip) => {
    if (chip === typeCustomBtn) return;
    chip.addEventListener('click', () => {
      typeChipsWrap.querySelectorAll('.schemechip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      typeCustomInput.hidden = true;
      typeCustomInput.value = '';
      selectedType = chip.dataset.val;
    });
  });
  typeCustomBtn.addEventListener('click', () => {
    typeChipsWrap.querySelectorAll('.schemechip').forEach((c) => c.classList.remove('is-active'));
    typeCustomBtn.classList.add('is-active');
    typeCustomInput.hidden = false;
    typeCustomInput.focus();
    selectedType = typeCustomInput.value.trim();
  });
  typeCustomInput.addEventListener('input', () => { selectedType = typeCustomInput.value.trim(); });

  // ---------- chips：情绪基调（多选）----------
  moodChipsWrap.querySelectorAll('.schemechip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('is-active');
      const v = chip.dataset.val;
      if (chip.classList.contains('is-active')) {
        if (!selectedMoods.includes(v)) selectedMoods.push(v);
      } else {
        selectedMoods = selectedMoods.filter((m) => m !== v);
      }
    });
  });

  // ---------- 自绘下拉选择器 ----------
  function setupSelect(rootId, triggerId, panelId, valueId, onSelect) {
    const root = document.getElementById(rootId);
    const trigger = document.getElementById(triggerId);
    const panel = document.getElementById(panelId);
    const valueEl = document.getElementById(valueId);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = !root.classList.contains('is-open');
      closeAllSelects();
      if (willOpen) root.classList.add('is-open');
    });

    panel.querySelectorAll('.scselect__opt').forEach((opt) => {
      opt.addEventListener('click', () => {
        panel.querySelectorAll('.scselect__opt').forEach((o) => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        valueEl.textContent = opt.textContent;
        valueEl.classList.remove('is-placeholder');
        root.classList.remove('is-open');
        onSelect(opt.dataset.val);
      });
    });

    return { root, panel, valueEl, placeholder: valueEl.textContent };
  }

  const selectRefs = [];
  selectRefs.push(setupSelect('scPerspectiveSelect', 'scPerspectiveTrigger', 'scPerspectivePanel', 'scPerspectiveValue', (v) => { selectedPerspective = v; }));
  selectRefs.push(setupSelect('scLengthSelect', 'scLengthTrigger', 'scLengthPanel', 'scLengthValue', (v) => { selectedLength = v; }));
  selectRefs.push(setupSelect('scToneSelect', 'scToneTrigger', 'scTonePanel', 'scToneValue', (v) => { selectedTone = v; }));

  function closeAllSelects() {
    document.querySelectorAll('.scselect.is-open').forEach((el) => el.classList.remove('is-open'));
  }
  document.addEventListener('click', closeAllSelects);

  function setSelectValue(ref, val) {
    if (!val) {
      ref.valueEl.textContent = ref.placeholder;
      ref.valueEl.classList.add('is-placeholder');
      ref.panel.querySelectorAll('.scselect__opt').forEach((o) => o.classList.remove('is-selected'));
      return;
    }
    const opt = Array.from(ref.panel.querySelectorAll('.scselect__opt')).find((o) => o.dataset.val === val);
    ref.panel.querySelectorAll('.scselect__opt').forEach((o) => o.classList.remove('is-selected'));
    if (opt) {
      opt.classList.add('is-selected');
      ref.valueEl.textContent = opt.textContent;
      ref.valueEl.classList.remove('is-placeholder');
    }
  }

  // ---------- 表单重置 / 填充 ----------
  function resetForm() {
    form.reset();
    selectedType = '';
    selectedMoods = [];
    selectedPerspective = '';
    selectedLength = '';
    selectedTone = '';

    typeChipsWrap.querySelectorAll('.schemechip').forEach((c) => c.classList.remove('is-active'));
    typeCustomInput.hidden = true;
    typeCustomInput.value = '';

    moodChipsWrap.querySelectorAll('.schemechip').forEach((c) => c.classList.remove('is-active'));

    selectRefs.forEach((ref) => setSelectValue(ref, ''));
  }

  function fillForm(scheme) {
    resetForm();
    nameInput.value = scheme.name || '';
    worldInput.value = scheme.world || '';
    themeInput.value = scheme.theme || '';
    charactersInput.value = scheme.characters || '';
    conflictInput.value = scheme.conflict || '';
    styleInput.value = scheme.style || '';
    noteInput.value = scheme.note || '';

    selectedType = scheme.type || '';
    if (selectedType) {
      const matchChip = Array.from(typeChipsWrap.querySelectorAll('.schemechip[data-val]')).find((c) => c.dataset.val === selectedType);
      if (matchChip) {
        matchChip.classList.add('is-active');
      } else {
        typeCustomBtn.classList.add('is-active');
        typeCustomInput.hidden = false;
        typeCustomInput.value = selectedType;
      }
    }

    selectedMoods = Array.isArray(scheme.moods) ? scheme.moods.slice() : [];
    moodChipsWrap.querySelectorAll('.schemechip').forEach((chip) => {
      if (selectedMoods.includes(chip.dataset.val)) chip.classList.add('is-active');
    });

    selectedPerspective = scheme.perspective || '';
    setSelectValue(selectRefs[0], selectedPerspective);
    selectedLength = scheme.length || '';
    setSelectValue(selectRefs[1], selectedLength);
    selectedTone = scheme.tone || '';
    setSelectValue(selectRefs[2], selectedTone);
  }

  // ---------- 提交保存 ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = nameInput.value.trim();
    if (!name) {
      nameInput.focus();
      return;
    }

    const record = {
      id: editingId || uid(),
      name,
      world: worldInput.value.trim(),
      theme: themeInput.value.trim(),
      type: selectedType,
      perspective: selectedPerspective,
      length: selectedLength,
      moods: selectedMoods.slice(),
      style: styleInput.value.trim(),
      characters: charactersInput.value.trim(),
      conflict: conflictInput.value.trim(),
      tone: selectedTone,
      note: noteInput.value.trim(),
      updatedAt: Date.now()
    };

    await dbPut(record);

    const idx = schemes.findIndex((s) => s.id === record.id);
    if (idx >= 0) schemes[idx] = record; else schemes.push(record);

    showListView();
  });

  // ---------- 列表渲染 ----------
  function renderList() {
    listEl.querySelectorAll('.schemecard').forEach((el) => el.remove());

    const sorted = schemes.slice().sort((a, b) => b.updatedAt - a.updatedAt);
    listEmpty.hidden = sorted.length > 0;

    sorted.forEach((scheme, i) => {
      const card = document.createElement('div');
      card.className = 'schemecard';

      const index = document.createElement('span');
      index.className = 'schemecard__index';
      index.textContent = String(i + 1).padStart(2, '0');

      const body = document.createElement('div');
      body.className = 'schemecard__body';

      const nameEl = document.createElement('p');
      nameEl.className = 'schemecard__name';
      nameEl.textContent = scheme.name;

      const metaEl = document.createElement('span');
      metaEl.className = 'schemecard__meta';
      const metaParts = [scheme.type, scheme.length, scheme.theme].filter(Boolean);
      metaEl.textContent = metaParts.length ? metaParts.join(' · ') : '暂无更多信息';

      body.appendChild(nameEl);
      body.appendChild(metaEl);

      const actions = document.createElement('div');
      actions.className = 'schemecard__actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'schemecard__btn schemecard__btn--edit';
      editBtn.setAttribute('aria-label', '编辑');
      editBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M4 20l.9-3.6L16.6 4.7c.6-.6 1.5-.6 2.1 0l.6.6c.6.6.6 1.5 0 2.1L7.6 19.1 4 20Z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editingId = scheme.id;
        fillForm(scheme);
        showFormView('edit');
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'schemecard__btn schemecard__btn--del';
      delBtn.setAttribute('aria-label', '删除');
      delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5.5c0-.6.4-1 1-1h4c.6 0 1 .4 1 1V7M7 7l.7 12c.05.9.8 1.5 1.7 1.5h5.2c.9 0 1.65-.6 1.7-1.5L17 7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await dbDelete(scheme.id);
        schemes = schemes.filter((s) => s.id !== scheme.id);
        renderList();
      });

      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      card.appendChild(index);
      card.appendChild(body);
      card.appendChild(actions);

      card.addEventListener('click', () => {
        editingId = scheme.id;
        fillForm(scheme);
        showFormView('edit');
      });

      listEl.appendChild(card);
    });
  }

  // ---------- 初始化：从 IndexedDB 加载 ----------
  (async function init() {
    try {
      schemes = await dbGetAll();
    } catch (err) {
      console.error('内容方案数据库加载失败', err);
    }
  })();
})();