/* ================================
   Luna Phone — app.js
   桌面交互逻辑
================================ */
/* ================================
   页面左右滑动
================================ */
(function() {
  let startX = 0, startY = 0, curPage = 0, dragging = false;
  const totalPages = 3;
  const wrap = document.getElementById('pagesWrap');
  const dots = document.querySelectorAll('.dot');
  let wheelTimer = null;

  function getFrameW() {
    return wrap.parentElement ? wrap.parentElement.offsetWidth : window.innerWidth;
  }

  function goTo(page) {
    curPage = Math.max(0, Math.min(totalPages - 1, page));
    wrap.style.transform = `translateX(${-curPage * getFrameW()}px)`;
    dots.forEach((d, i) => d.classList.toggle('on', i === curPage));
  }

  // ── 触摸滑动 ──
  wrap.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  wrap.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      goTo(dx < 0 ? curPage + 1 : curPage - 1);
    }
  }, { passive: true });

  // ── 鼠标拖拽（用 document 监听 mouseup，防止拖出边界后松手没响应）──
  wrap.addEventListener('mousedown', e => {
    startX = e.clientX;
    dragging = true;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
  });
  document.addEventListener('mouseup', e => {
    if (!dragging) return;
    dragging = false;
    const dx = e.clientX - startX;
    if (Math.abs(dx) > 40) goTo(dx < 0 ? curPage + 1 : curPage - 1);
  });

  // ── 触控板双指滑动（节流：每次滑动只触发一次翻页）──
  wrap.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (wheelTimer) return;           // 节流：忽略连续事件
    const absX = Math.abs(e.deltaX);
    const absY = Math.abs(e.deltaY);
    if (absX > absY && absX > 20) {  // 确保是横向滑动
      goTo(e.deltaX > 0 ? curPage + 1 : curPage - 1);
      wheelTimer = setTimeout(() => { wheelTimer = null; }, 600);
    }
  }, { passive: false });

  // 窗口resize时重新计算位置
  window.addEventListener('resize', () => goTo(curPage));

  document.addEventListener('DOMContentLoaded', () => goTo(0));
})();

/* ---- 实时时间 ---- */
function updateTime() {
  const el = document.getElementById('statusTime');
  const wt = document.getElementById('widgetTime');
  const wd = document.getElementById('widgetDate');
  const dayFill = document.getElementById('dayFill');
  const dayPct = document.getElementById('dayPct');

  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  
  // 核心：定义 tzNow 以修复报错
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));

  // 状态栏时间（24小时制，小字）
  const statusTimeStr = now.toLocaleTimeString('zh-CN', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
  });

  // 组件时间（AM/PM 大字）
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true
  });

  // 组件日期（英文大写 + 星期）
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dateStr = `${dayNames[tzNow.getDay()]}, ${monthNames[tzNow.getMonth()]} ${tzNow.getDate()}`;

  // 状态栏
  if (el) el.textContent = statusTimeStr;

  // 组件时间：同步字体样式
  if (wt) {
    wt.textContent = timeStr.toUpperCase();
    wt.style.fontSize = '32px';
    wt.style.fontWeight = '800';
    wt.style.letterSpacing = '-0.04em';
    wt.style.color = 'rgba(30,30,60,0.88)';
    wt.style.lineHeight = '1';
  }

  // 组件日期：同步字体样式
  if (wd) {
    wd.textContent = dateStr;
    wd.style.fontSize = '10px';
    wd.style.fontWeight = '600';
    wd.style.letterSpacing = '0.08em';
    wd.style.color = 'rgba(55,55,90,0.6)';
    wd.style.fontFamily = "'Space Mono', monospace";
    wd.style.textTransform = 'uppercase';
  }

  const totalMins = 24 * 60;
  const passedMins = tzNow.getHours() * 60 + tzNow.getMinutes();
  const pct = Math.round(passedMins / totalMins * 100);
  
  if (dayFill) dayFill.style.width = pct + '%';
  if (dayPct) dayPct.textContent = `PASS ${pct}%`; // 进度也改为英文更高级
}

/* ================================
   天气组件编辑弹窗
================================ */
(function() {
  // IndexedDB 存储
  const DB_NAME = 'LunaWeatherWidgetDB';
  const DB_VER = 1;

  function openWtwDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, DB_VER);
      r.onupgradeneeded = e => {
        e.target.result.createObjectStore('assets', { keyPath: 'key' });
      };
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => rej();
    });
  }

  async function wtwSave(key, value) {
    const db = await openWtwDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put({ key, value });
      tx.oncomplete = () => res();
      tx.onerror = () => rej();
    });
  }

  async function wtwLoad(key) {
    const db = await openWtwDB();
    return new Promise(res => {
      const r = db.transaction('assets').objectStore('assets').get(key);
      r.onsuccess = () => res(r.result ? r.result.value : null);
      r.onerror = () => res(null);
    });
  }

  // 读取文件转 base64
  function fileToBase64(file) {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  // 应用头像到组件
  function applyWtwAvatar(src) {
    const el = document.querySelector('.wtw-avatar');
    if (!el) return;
    el.innerHTML = src
      ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(55,55,90,0.6)" stroke-width="1.6"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(55,55,90,0.6)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  // 应用右侧照片
  function applyWtwPhoto(index, src) {
    const photos = document.querySelectorAll('.wtw-photo');
    const el = photos[index];
    if (!el) return;
    el.innerHTML = src
      ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;" alt=""/>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="rgba(55,55,90,0.45)" stroke-width="1.5"/><circle cx="9" cy="11" r="2.5" stroke="rgba(55,55,90,0.45)" stroke-width="1.3"/><path d="M13 14l2.5-3 3 4" stroke="rgba(55,55,90,0.45)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // 应用背景模式
  function applyWtwBg(mode, customSrc) {
    const widget = document.querySelector('.widget-time-weather');
    if (!widget) return;
    if (mode === 'transparent') {
      widget.style.background = 'transparent';
      widget.style.border = 'none';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else if (mode === 'custom' && customSrc) {
      widget.style.background = `url(${customSrc}) center/cover no-repeat`;
      widget.style.border = '1px solid rgba(255,255,255,0.4)';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
    } else {
      // blur（默认）
      widget.style.background = 'rgba(255,255,255,0.28)';
      widget.style.border = '1px solid rgba(255,255,255,0.75)';
      widget.style.backdropFilter = 'blur(28px) saturate(180%)';
      widget.style.webkitBackdropFilter = 'blur(28px) saturate(180%)';
      widget.style.boxShadow = 'inset 0 1.5px 0 rgba(255,255,255,0.9), 0 8px 32px rgba(140,150,200,0.18)';
    }
  }

  // 页面加载时恢复已保存的设置
  async function initWtwWidget() {
    const avatar = await wtwLoad('avatar');
    const photo1 = await wtwLoad('photo1');
    const photo2 = await wtwLoad('photo2');
    const bgMode = await wtwLoad('bgMode') || 'blur';
    const bgCustom = await wtwLoad('bgCustom');
    if (avatar) applyWtwAvatar(avatar);
    if (photo1) applyWtwPhoto(0, photo1);
    if (photo2) applyWtwPhoto(1, photo2);
    applyWtwBg(bgMode, bgCustom);
  }

  // 弹窗逻辑
  let tempAvatar = null, tempPhoto1 = null, tempPhoto2 = null;
  let tempBgMode = 'blur', tempBgCustom = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await initWtwWidget();

    const overlay = document.getElementById('wtwEditOverlay');
    const modal = document.getElementById('wtwEditModal');
    const widget = document.querySelector('.widget-time-weather');

    // 点击组件打开弹窗
    if (widget) {
      widget.addEventListener('click', async () => {
        tempAvatar = await wtwLoad('avatar');
        tempPhoto1 = await wtwLoad('photo1');
        tempPhoto2 = await wtwLoad('photo2');
        tempBgMode = await wtwLoad('bgMode') || 'blur';
        tempBgCustom = await wtwLoad('bgCustom');

        // 恢复预览
        const prevAv = document.getElementById('wtwPreviewAvatar');
        if (tempAvatar) prevAv.innerHTML = `<img src="${tempAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;

        const prev1 = document.getElementById('wtwPreviewPhoto1');
        if (tempPhoto1) prev1.innerHTML = `<img src="${tempPhoto1}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;

        const prev2 = document.getElementById('wtwPreviewPhoto2');
        if (tempPhoto2) prev2.innerHTML = `<img src="${tempPhoto2}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;

        // 背景模式按钮状态
        document.querySelectorAll('.wtw-bg-option').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.mode === tempBgMode);
        });
        document.getElementById('wtwBgUploadRow').style.display = tempBgMode === 'custom' ? 'block' : 'none';

        overlay.style.display = 'flex';
      });
    }

    // 关闭弹窗
    document.getElementById('wtwModalClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // 头像上传
    document.getElementById('wtwAvatarInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempAvatar = await fileToBase64(file);
      const prev = document.getElementById('wtwPreviewAvatar');
      prev.innerHTML = `<img src="${tempAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    });

    // 照片1上传
    document.getElementById('wtwPhoto1Input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempPhoto1 = await fileToBase64(file);
      const prev = document.getElementById('wtwPreviewPhoto1');
      prev.innerHTML = `<img src="${tempPhoto1}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;
    });

    // 照片2上传
    document.getElementById('wtwPhoto2Input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempPhoto2 = await fileToBase64(file);
      const prev = document.getElementById('wtwPreviewPhoto2');
      prev.innerHTML = `<img src="${tempPhoto2}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;
    });

    // 背景模式切换
    document.querySelectorAll('.wtw-bg-option').forEach(btn => {
      btn.addEventListener('click', () => {
        tempBgMode = btn.dataset.mode;
        document.querySelectorAll('.wtw-bg-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('wtwBgUploadRow').style.display = tempBgMode === 'custom' ? 'block' : 'none';
      });
    });

    // 背景图上传
    document.getElementById('wtwBgInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempBgCustom = await fileToBase64(file);
    });

    // 保存
    document.getElementById('wtwModalSave').addEventListener('click', async () => {
      if (tempAvatar) await wtwSave('avatar', tempAvatar);
      if (tempPhoto1) await wtwSave('photo1', tempPhoto1);
      if (tempPhoto2) await wtwSave('photo2', tempPhoto2);
      await wtwSave('bgMode', tempBgMode);
      if (tempBgCustom) await wtwSave('bgCustom', tempBgCustom);

      applyWtwAvatar(tempAvatar);
      applyWtwPhoto(0, tempPhoto1);
      applyWtwPhoto(1, tempPhoto2);
      applyWtwBg(tempBgMode, tempBgCustom);

      overlay.style.display = 'none';
    });
  });
})();

/* ================================
   好友组件编辑弹窗
================================ */
(function() {
  const DB_NAME = 'LunaFriendsWidgetDB';

  function openFwDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = e => {
        e.target.result.createObjectStore('assets', { keyPath: 'key' });
      };
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => rej();
    });
  }

  async function fwSave(key, value) {
    const db = await openFwDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put({ key, value });
      tx.oncomplete = () => res();
      tx.onerror = () => rej();
    });
  }

  async function fwLoad(key) {
    const db = await openFwDB();
    return new Promise(res => {
      const r = db.transaction('assets').objectStore('assets').get(key);
      r.onsuccess = () => res(r.result ? r.result.value : null);
      r.onerror = () => res(null);
    });
  }

  function fileToBase64(file) {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  // 应用头像
  function applyFwAvatar(index, src) {
    const wraps = document.querySelectorAll('.fw-avatar-wrap');
    const el = wraps[index];
    if (!el) return;
    el.innerHTML = src
      ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>`
      : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(100,100,180,0.4)" stroke-width="1.6"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(100,100,180,0.4)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  // 应用文字
  function applyFwText(name1, name2, bio1, bio2) {
    const names = document.querySelectorAll('.fw-name');
    if (names[0] && name1) names[0].textContent = name1;
    if (names[1] && name2) names[1].textContent = name2;
    const bio = document.querySelector('.fw-bio');
    if (bio) {
      const b1 = bio1 || 'two souls,';
      const b2 = bio2 || 'one frequency.';
      bio.innerHTML = `${b1}<br>${b2}`;
    }
  }

  // 应用背景
  function applyFwBg(mode, customSrc) {
    const widget = document.querySelector('.widget-friends');
    if (!widget) return;
    if (mode === 'transparent') {
      widget.style.background = 'transparent';
      widget.style.border = 'none';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else if (mode === 'custom' && customSrc) {
      widget.style.background = `url(${customSrc}) center/cover no-repeat`;
      widget.style.border = '1px solid rgba(255,255,255,0.4)';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else {
      widget.style.background = '';
      widget.style.border = '';
      widget.style.backdropFilter = '';
      widget.style.webkitBackdropFilter = '';
      widget.style.boxShadow = '';
    }
  }

  // 页面加载恢复
  async function initFwWidget() {
    const av1 = await fwLoad('avatar1');
    const av2 = await fwLoad('avatar2');
    const name1 = await fwLoad('name1');
    const name2 = await fwLoad('name2');
    const bio1 = await fwLoad('bio1');
    const bio2 = await fwLoad('bio2');
    const bgMode = await fwLoad('bgMode') || 'default';
    const bgCustom = await fwLoad('bgCustom');
    if (av1) applyFwAvatar(0, av1);
    if (av2) applyFwAvatar(1, av2);
    applyFwText(name1, name2, bio1, bio2);
    applyFwBg(bgMode, bgCustom);
  }

  let tempAv1 = null, tempAv2 = null;
  let tempFwBgMode = 'default', tempFwBgCustom = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await initFwWidget();

    const overlay = document.getElementById('fwEditOverlay');
    const widget = document.querySelector('.widget-friends');

    // 点击组件打开弹窗
    if (widget) {
      widget.addEventListener('click', async () => {
        tempAv1 = await fwLoad('avatar1');
        tempAv2 = await fwLoad('avatar2');
        tempFwBgMode = await fwLoad('bgMode') || 'default';
        tempFwBgCustom = await fwLoad('bgCustom');

        // 填入已保存的文字
        const name1 = await fwLoad('name1');
        const name2 = await fwLoad('name2');
        const bio1 = await fwLoad('bio1');
        const bio2 = await fwLoad('bio2');
        if (name1) document.getElementById('fwInputName1').value = name1;
        if (name2) document.getElementById('fwInputName2').value = name2;
        if (bio1) document.getElementById('fwInputBio1').value = bio1;
        if (bio2) document.getElementById('fwInputBio2').value = bio2;

        // 恢复头像预览
        const prev1 = document.getElementById('fwPreviewAvatar1');
        if (tempAv1) prev1.innerHTML = `<img src="${tempAv1}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
        const prev2 = document.getElementById('fwPreviewAvatar2');
        if (tempAv2) prev2.innerHTML = `<img src="${tempAv2}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;

        // 背景按钮状态
        document.querySelectorAll('[data-fw-mode]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.fwMode === tempFwBgMode);
        });
        document.getElementById('fwBgUploadRow').style.display = tempFwBgMode === 'custom' ? 'block' : 'none';

        overlay.style.display = 'flex';
      });
    }

    // 关闭
    document.getElementById('fwModalClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // 头像上传
    document.getElementById('fwAvatar1Input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempAv1 = await fileToBase64(file);
      document.getElementById('fwPreviewAvatar1').innerHTML = `<img src="${tempAv1}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    });
    document.getElementById('fwAvatar2Input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempAv2 = await fileToBase64(file);
      document.getElementById('fwPreviewAvatar2').innerHTML = `<img src="${tempAv2}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    });

    // 背景模式切换
    document.querySelectorAll('[data-fw-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        tempFwBgMode = btn.dataset.fwMode;
        document.querySelectorAll('[data-fw-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('fwBgUploadRow').style.display = tempFwBgMode === 'custom' ? 'block' : 'none';
      });
    });

    // 背景图上传
    document.getElementById('fwBgInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempFwBgCustom = await fileToBase64(file);
    });

    // 保存
    document.getElementById('fwModalSave').addEventListener('click', async () => {
      const name1 = document.getElementById('fwInputName1').value.trim();
      const name2 = document.getElementById('fwInputName2').value.trim();
      const bio1 = document.getElementById('fwInputBio1').value.trim();
      const bio2 = document.getElementById('fwInputBio2').value.trim();

      if (tempAv1) await fwSave('avatar1', tempAv1);
      if (tempAv2) await fwSave('avatar2', tempAv2);
      if (name1) await fwSave('name1', name1);
      if (name2) await fwSave('name2', name2);
      if (bio1) await fwSave('bio1', bio1);
      if (bio2) await fwSave('bio2', bio2);
      await fwSave('bgMode', tempFwBgMode);
      if (tempFwBgCustom) await fwSave('bgCustom', tempFwBgCustom);

      if (tempAv1) applyFwAvatar(0, tempAv1);
      if (tempAv2) applyFwAvatar(1, tempAv2);
      applyFwText(name1, name2, bio1, bio2);
      applyFwBg(tempFwBgMode, tempFwBgCustom);

      overlay.style.display = 'none';
    });
  });
})();


/* ================================
   个人资料组件编辑弹窗（第二页第一个组件）
================================ */
(function() {
  const DB_NAME = 'LunaProfileWidgetDB';

  function openPwDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = e => {
        e.target.result.createObjectStore('assets', { keyPath: 'key' });
      };
      r.onsuccess = e => res(e.target.result);
      r.onerror = () => rej();
    });
  }

  async function pwSave(key, value) {
    const db = await openPwDB();
    return new Promise((res, rej) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put({ key, value });
      tx.oncomplete = () => res();
      tx.onerror = () => rej();
    });
  }

  async function pwLoad(key) {
    const db = await openPwDB();
    return new Promise(res => {
      const r = db.transaction('assets').objectStore('assets').get(key);
      r.onsuccess = () => res(r.result ? r.result.value : null);
      r.onerror = () => res(null);
    });
  }

  function fileToBase64(file) {
    return new Promise(res => {
      const reader = new FileReader();
      reader.onload = e => res(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  // 应用头像到 widget-profile
  function applyPwAvatar(src) {
    const el = document.querySelector('.pw-avatar');
    if (!el) return;
    el.innerHTML = src
      ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt=""/>`
      : `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="rgba(100,100,180,0.5)" stroke-width="1.6"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(100,100,180,0.5)" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  }

  // 应用文字
  function applyPwText(name, bio) {
    const nameEl = document.querySelector('.pw-name');
    const bioEl = document.querySelector('.pw-bio');
    if (nameEl && name) nameEl.textContent = name;
    if (bioEl && bio) bioEl.textContent = bio;
  }

  // 应用三张照片
  function applyPwPhoto(index, src) {
    const photos = document.querySelectorAll('.pw-photo');
    const el = photos[index];
    if (!el) return;
    el.innerHTML = src
      ? `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" alt=""/>`
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="rgba(100,100,180,0.35)" stroke-width="1.4"/><circle cx="8.5" cy="10.5" r="2" stroke="rgba(100,100,180,0.35)" stroke-width="1.3"/><path d="M3 16l4.5-4.5 3.5 3.5 2.5-2.5 4 4" stroke="rgba(100,100,180,0.35)" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }

  // 应用背景
  function applyPwBg(mode, customSrc) {
    const widget = document.querySelector('.widget-profile');
    if (!widget) return;
    if (mode === 'transparent') {
      widget.style.background = 'transparent';
      widget.style.border = 'none';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else if (mode === 'custom' && customSrc) {
      widget.style.background = `url(${customSrc}) center/cover no-repeat`;
      widget.style.border = '1px solid rgba(255,255,255,0.4)';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else {
      // blur 默认
      widget.style.background = '';
      widget.style.border = '';
      widget.style.backdropFilter = '';
      widget.style.webkitBackdropFilter = '';
      widget.style.boxShadow = '';
    }
  }

  // 页面加载恢复
  async function initPwWidget() {
    const avatar = await pwLoad('avatar');
    const name   = await pwLoad('name');
    const bio    = await pwLoad('bio');
    const photo1 = await pwLoad('photo1');
    const photo2 = await pwLoad('photo2');
    const photo3 = await pwLoad('photo3');
    const bgMode = await pwLoad('bgMode') || 'blur';
    const bgCustom = await pwLoad('bgCustom');
    if (avatar) applyPwAvatar(avatar);
    applyPwText(name, bio);
    if (photo1) applyPwPhoto(0, photo1);
    if (photo2) applyPwPhoto(1, photo2);
    if (photo3) applyPwPhoto(2, photo3);
    applyPwBg(bgMode, bgCustom);
  }

  let tempPwAvatar = null;
  let tempPwPhoto1 = null, tempPwPhoto2 = null, tempPwPhoto3 = null;
  let tempPwBgMode = 'blur', tempPwBgCustom = null;

  document.addEventListener('DOMContentLoaded', async () => {
    await initPwWidget();

    const overlay = document.getElementById('pwEditOverlay');
    const widget  = document.querySelector('.widget-profile');

    // 点击组件打开弹窗
    if (widget) {
      widget.addEventListener('click', async () => {
        tempPwAvatar  = await pwLoad('avatar');
        tempPwPhoto1  = await pwLoad('photo1');
        tempPwPhoto2  = await pwLoad('photo2');
        tempPwPhoto3  = await pwLoad('photo3');
        tempPwBgMode  = await pwLoad('bgMode') || 'blur';
        tempPwBgCustom = await pwLoad('bgCustom');

        // 填入已保存文字
        const savedName = await pwLoad('name');
        const savedBio  = await pwLoad('bio');
        if (savedName) document.getElementById('pwInputName').value = savedName;
        if (savedBio)  document.getElementById('pwInputBio').value  = savedBio;

        // 恢复头像预览
        const prevAv = document.getElementById('pwPreviewAvatar');
        if (tempPwAvatar) prevAv.innerHTML = `<img src="${tempPwAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;

        // 恢复照片预览
        [tempPwPhoto1, tempPwPhoto2, tempPwPhoto3].forEach((src, i) => {
          const prev = document.getElementById(`pwPreviewPhoto${i + 1}`);
          if (src && prev) prev.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;
        });

        // 背景按钮状态
        document.querySelectorAll('[data-pw-mode]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.pwMode === tempPwBgMode);
        });
        document.getElementById('pwBgUploadRow').style.display = tempPwBgMode === 'custom' ? 'block' : 'none';

        overlay.style.display = 'flex';
      });
    }

    // 关闭
    document.getElementById('pwModalClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // 头像上传
    document.getElementById('pwAvatarInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempPwAvatar = await fileToBase64(file);
      document.getElementById('pwPreviewAvatar').innerHTML = `<img src="${tempPwAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>`;
    });

    // 三张照片上传
    ['pwPhoto1Input', 'pwPhoto2Input', 'pwPhoto3Input'].forEach((id, i) => {
      document.getElementById(id).addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        const src = await fileToBase64(file);
        if (i === 0) tempPwPhoto1 = src;
        if (i === 1) tempPwPhoto2 = src;
        if (i === 2) tempPwPhoto3 = src;
        const prev = document.getElementById(`pwPreviewPhoto${i + 1}`);
        prev.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;"/>`;
      });
    });

    // 背景模式切换
    document.querySelectorAll('[data-pw-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        tempPwBgMode = btn.dataset.pwMode;
        document.querySelectorAll('[data-pw-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('pwBgUploadRow').style.display = tempPwBgMode === 'custom' ? 'block' : 'none';
      });
    });

    // 背景图上传
    document.getElementById('pwBgInput').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      tempPwBgCustom = await fileToBase64(file);
    });

    // 保存
    document.getElementById('pwModalSave').addEventListener('click', async () => {
      const name = document.getElementById('pwInputName').value.trim();
      const bio  = document.getElementById('pwInputBio').value.trim();

      if (tempPwAvatar) await pwSave('avatar', tempPwAvatar);
      if (name)  await pwSave('name', name);
      if (bio)   await pwSave('bio', bio);
      if (tempPwPhoto1) await pwSave('photo1', tempPwPhoto1);
      if (tempPwPhoto2) await pwSave('photo2', tempPwPhoto2);
      if (tempPwPhoto3) await pwSave('photo3', tempPwPhoto3);
      await pwSave('bgMode', tempPwBgMode);
      if (tempPwBgCustom) await pwSave('bgCustom', tempPwBgCustom);

      applyPwAvatar(tempPwAvatar);
      applyPwText(name, bio);
      if (tempPwPhoto1) applyPwPhoto(0, tempPwPhoto1);
      if (tempPwPhoto2) applyPwPhoto(1, tempPwPhoto2);
      if (tempPwPhoto3) applyPwPhoto(2, tempPwPhoto3);
      applyPwBg(tempPwBgMode, tempPwBgCustom);

      overlay.style.display = 'none';
    });
  });
})();

// ========== widget-duo 编辑弹窗 ==========
(function () {
  const PREFIX = 'wd_';
  function wdSave(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch(e){} }
  function wdLoad(k) { try { return localStorage.getItem(PREFIX + k); } catch(e){ return null; } }

  function applyWdAv(side, src) {
    const el = document.querySelector(side === 0 ? '.wd-avatar-l' : '.wd-avatar-r');
    if (!el) return;
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }

  function applyWdText(n1, n2, b1, b2) {
    const labels = document.querySelectorAll('.wd-av-label');
    if (labels[0] && n1) labels[0].textContent = n1;
    if (labels[1] && n2) labels[1].textContent = n2;
    const bubbles = document.querySelectorAll('.wd-bubble');
    if (bubbles[0] && b1) bubbles[0].textContent = b1;
    if (bubbles[1] && b2) bubbles[1].textContent = b2;
  }

  function applyWdBg(mode, custom) {
  const widget = document.querySelector('.widget-duo');
  if (!widget) return;
  if (mode === 'transparent') {
    widget.style.background = 'transparent';
    widget.style.border = 'none';
    widget.style.backdropFilter = 'none';
    widget.style.webkitBackdropFilter = 'none';
    widget.style.boxShadow = 'none';
  } else if (mode === 'custom' && custom) {
    widget.style.background = `url(${custom}) center/cover no-repeat`;
    widget.style.border = '1px solid rgba(255,255,255,0.4)';
    widget.style.backdropFilter = 'none';
    widget.style.webkitBackdropFilter = 'none';
    widget.style.boxShadow = 'none';
  } else {
    widget.style.background = '';
    widget.style.border = '';
    widget.style.backdropFilter = '';
    widget.style.webkitBackdropFilter = '';
    widget.style.boxShadow = '';
  }
}

  function fileToBase64Wd(file) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(file);
    });
  }

  // 初始化：从 localStorage 恢复
  function initWdWidget() {
    const av1 = wdLoad('av1'), av2 = wdLoad('av2');
    const n1 = wdLoad('name1'), n2 = wdLoad('name2');
    const b1 = wdLoad('bubble1'), b2 = wdLoad('bubble2');
    const bgMode = wdLoad('bgMode') || 'blur';
    const bgCustom = wdLoad('bgCustom');
    if (av1) applyWdAv(0, av1);
    if (av2) applyWdAv(1, av2);
    applyWdText(n1, n2, b1, b2);
    applyWdBg(bgMode, bgCustom);
  }

  let tempWdAv1 = null, tempWdAv2 = null;
  let tempWdBgMode = 'blur', tempWdBgCustom = null;

  document.addEventListener('DOMContentLoaded', () => {
    initWdWidget();

    const overlay = document.getElementById('wdEditOverlay');
    const widget = document.querySelector('.widget-duo');

    // 点击组件打开弹窗
    if (widget) {
      widget.addEventListener('click', () => {
        tempWdAv1 = wdLoad('av1');
        tempWdAv2 = wdLoad('av2');
        tempWdBgMode = wdLoad('bgMode') || 'blur';
        tempWdBgCustom = wdLoad('bgCustom');

        // 填入文字
        const n1 = wdLoad('name1'), n2 = wdLoad('name2');
        const b1 = wdLoad('bubble1'), b2 = wdLoad('bubble2');
        if (n1) document.getElementById('wdInputName1').value = n1;
        if (n2) document.getElementById('wdInputName2').value = n2;
        if (b1) document.getElementById('wdInputBubble1').value = b1;
        if (b2) document.getElementById('wdInputBubble2').value = b2;

        // 恢复头像预览
        if (tempWdAv1) document.getElementById('wdPreviewAv1').innerHTML =
          `<img src="${tempWdAv1}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        if (tempWdAv2) document.getElementById('wdPreviewAv2').innerHTML =
          `<img src="${tempWdAv2}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;

        // 恢复背景按钮状态
        document.querySelectorAll('[data-wd-mode]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.wdMode === tempWdBgMode);
        });
        document.getElementById('wdBgUploadRow').style.display =
          tempWdBgMode === 'custom' ? 'block' : 'none';

        overlay.style.display = 'flex';
      });
    }

    // 关闭
    document.getElementById('wdModalClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // 头像上传
    document.getElementById('wdAv1Input').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      tempWdAv1 = await fileToBase64Wd(file);
      document.getElementById('wdPreviewAv1').innerHTML =
        `<img src="${tempWdAv1}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    });
    document.getElementById('wdAv2Input').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      tempWdAv2 = await fileToBase64Wd(file);
      document.getElementById('wdPreviewAv2').innerHTML =
        `<img src="${tempWdAv2}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    });

    // 背景切换
    document.querySelectorAll('[data-wd-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        tempWdBgMode = btn.dataset.wdMode;
        document.querySelectorAll('[data-wd-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('wdBgUploadRow').style.display =
          tempWdBgMode === 'custom' ? 'block' : 'none';
      });
    });

    // 背景图上传
    document.getElementById('wdBgInput').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      tempWdBgCustom = await fileToBase64Wd(file);
    });

    // 保存
    document.getElementById('wdModalSave').addEventListener('click', () => {
      const n1 = document.getElementById('wdInputName1').value.trim();
      const n2 = document.getElementById('wdInputName2').value.trim();
      const b1 = document.getElementById('wdInputBubble1').value.trim();
      const b2 = document.getElementById('wdInputBubble2').value.trim();

      if (tempWdAv1) { wdSave('av1', tempWdAv1); applyWdAv(0, tempWdAv1); }
      if (tempWdAv2) { wdSave('av2', tempWdAv2); applyWdAv(1, tempWdAv2); }
      if (n1) wdSave('name1', n1);
      if (n2) wdSave('name2', n2);
      if (b1) wdSave('bubble1', b1);
      if (b2) wdSave('bubble2', b2);
      wdSave('bgMode', tempWdBgMode);
      if (tempWdBgCustom) wdSave('bgCustom', tempWdBgCustom);

      applyWdText(n1, n2, b1, b2);
      applyWdBg(tempWdBgMode, tempWdBgCustom);

      overlay.style.display = 'none';
    });
  });
})();

// ========== widget-notif 编辑弹窗 ==========
(function () {
  const PREFIX = 'wn_';
  function wnSave(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch(e){} }
  function wnLoad(k) { try { return localStorage.getItem(PREFIX + k); } catch(e){ return null; } }

  function applyWnImg(side, src) {
    const el = document.querySelector(side === 'l' ? '.wn-thumb-l' : '.wn-thumb-r');
    if (!el) return;
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">`;
  }

  function applyWnText(title, sub) {
    const titleEl = document.querySelector('.wn-title');
    const subEl   = document.querySelector('.wn-sub');
    if (titleEl && title) titleEl.textContent = title;
    if (subEl   && sub)   subEl.textContent   = sub;
  }

  function applyWnBg(mode, custom) {
    const widget = document.querySelector('.widget-notif');
    if (!widget) return;
    if (mode === 'transparent') {
      widget.style.background = 'transparent';
      widget.style.border = 'none';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else if (mode === 'custom' && custom) {
      widget.style.background = `url(${custom}) center/cover no-repeat`;
      widget.style.border = '1px solid rgba(255,255,255,0.4)';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else {
      widget.style.background = '';
      widget.style.border = '';
      widget.style.backdropFilter = '';
      widget.style.webkitBackdropFilter = '';
      widget.style.boxShadow = '';
    }
  }

  function fileToBase64Wn(file) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(file);
    });
  }

  function initWnWidget() {
    const imgL   = wnLoad('imgL');
    const imgR   = wnLoad('imgR');
    const title  = wnLoad('title');
    const sub    = wnLoad('sub');
    const bgMode = wnLoad('bgMode') || 'blur';
    const bgCustom = wnLoad('bgCustom');
    if (imgL) applyWnImg('l', imgL);
    if (imgR) applyWnImg('r', imgR);
    applyWnText(title, sub);
    applyWnBg(bgMode, bgCustom);
  }

  let tempWnImgL = null, tempWnImgR = null;
  let tempWnBgMode = 'blur', tempWnBgCustom = null;

  document.addEventListener('DOMContentLoaded', () => {
    initWnWidget();

    const overlay = document.getElementById('wnEditOverlay');
    const widget  = document.querySelector('.widget-notif');

    if (widget) {
      widget.addEventListener('click', () => {
        tempWnImgL   = wnLoad('imgL');
        tempWnImgR   = wnLoad('imgR');
        tempWnBgMode = wnLoad('bgMode') || 'blur';
        tempWnBgCustom = wnLoad('bgCustom');

        const title = wnLoad('title');
        const sub   = wnLoad('sub');
        if (title) document.getElementById('wnInputTitle').value = title;
        if (sub)   document.getElementById('wnInputSub').value   = sub;

        if (tempWnImgL) document.getElementById('wnPreviewL').innerHTML =
          `<img src="${tempWnImgL}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">`;
        if (tempWnImgR) document.getElementById('wnPreviewR').innerHTML =
          `<img src="${tempWnImgR}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">`;

        document.querySelectorAll('[data-wn-mode]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.wnMode === tempWnBgMode);
        });
        document.getElementById('wnBgUploadRow').style.display =
          tempWnBgMode === 'custom' ? 'block' : 'none';

        overlay.style.display = 'flex';
      });
    }

    document.getElementById('wnModalClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    document.getElementById('wnImgLInput').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      tempWnImgL = await fileToBase64Wn(file);
      document.getElementById('wnPreviewL').innerHTML =
        `<img src="${tempWnImgL}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">`;
    });
    document.getElementById('wnImgRInput').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      tempWnImgR = await fileToBase64Wn(file);
      document.getElementById('wnPreviewR').innerHTML =
        `<img src="${tempWnImgR}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">`;
    });

    document.querySelectorAll('[data-wn-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        tempWnBgMode = btn.dataset.wnMode;
        document.querySelectorAll('[data-wn-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('wnBgUploadRow').style.display =
          tempWnBgMode === 'custom' ? 'block' : 'none';
      });
    });

    document.getElementById('wnBgInput').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      tempWnBgCustom = await fileToBase64Wn(file);
    });

    document.getElementById('wnModalSave').addEventListener('click', () => {
      const title = document.getElementById('wnInputTitle').value.trim();
      const sub   = document.getElementById('wnInputSub').value.trim();

      if (tempWnImgL) { wnSave('imgL', tempWnImgL); applyWnImg('l', tempWnImgL); }
      if (tempWnImgR) { wnSave('imgR', tempWnImgR); applyWnImg('r', tempWnImgR); }
      if (title) wnSave('title', title);
      if (sub)   wnSave('sub',   sub);
      wnSave('bgMode', tempWnBgMode);
      if (tempWnBgCustom) wnSave('bgCustom', tempWnBgCustom);

      applyWnText(title, sub);
      applyWnBg(tempWnBgMode, tempWnBgCustom);

      overlay.style.display = 'none';
    });
  });
})();

// ========== widget-chat 编辑弹窗 ==========
(function () {
  const PREFIX = 'wc_';
  function wcSave(k, v) { try { localStorage.setItem(PREFIX + k, v); } catch(e){} }
  function wcLoad(k) { try { return localStorage.getItem(PREFIX + k); } catch(e){ return null; } }

  function fileToBase64Wc(file) {
    return new Promise(res => {
      const r = new FileReader();
      r.onload = e => res(e.target.result);
      r.readAsDataURL(file);
    });
  }

  // 好友头像（保留在线小圆点）
  function applyWcFriendAv(idx, src) {
    const rings = document.querySelectorAll('.wc-av-ring');
    const ring = rings[idx];
    if (!ring) return;
    const dot = ring.querySelector('.wc-online-dot');
    const dotHTML = dot ? dot.outerHTML : '';
    ring.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">${dotHTML}`;
  }

  // 好友名字
  function applyWcFriendNames(names) {
    const els = document.querySelectorAll('.wc-friend-name');
    names.forEach((n, i) => { if (els[i] && n) els[i].textContent = n; });
  }

  // 主用户头像
  function applyWcUserAv(src) {
    const el = document.querySelector('.wc-uav');
    if (!el) return;
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
  }

  // 主用户文字
  function applyWcUserText(name, bio) {
    const nameEl = document.querySelector('.wc-uname');
    const bioEl  = document.querySelector('.wc-ubio');
    if (nameEl && name) nameEl.textContent = name;
    if (bioEl  && bio)  bioEl.textContent  = bio;
  }

  // 三张照片
  function applyWcPhoto(idx, src) {
    const items = document.querySelectorAll('.wc-photo-item');
    const el = items[idx];
    if (!el) return;
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`;
  }

  // 气泡文字
  function applyWcBubble(text) {
    const el = document.querySelector('.wc-bubble-right');
    if (el && text) el.textContent = text;
  }

  // 聊天图
  function applyWcChatImg(src) {
    const el = document.querySelector('.wc-img-reply');
    if (!el) return;
    el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;">`;
  }

  // 背景
  function applyWcBg(mode, custom) {
    const widget = document.querySelector('.widget-chat');
    if (!widget) return;
    if (mode === 'transparent') {
      widget.style.background = 'transparent';
      widget.style.border = 'none';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else if (mode === 'custom' && custom) {
      widget.style.background = `url(${custom}) center/cover no-repeat`;
      widget.style.border = '1px solid rgba(255,255,255,0.4)';
      widget.style.backdropFilter = 'none';
      widget.style.webkitBackdropFilter = 'none';
      widget.style.boxShadow = 'none';
    } else {
      widget.style.background = '';
      widget.style.border = '';
      widget.style.backdropFilter = '';
      widget.style.webkitBackdropFilter = '';
      widget.style.boxShadow = '';
    }
  }

  function initWcWidget() {
    for (let i = 1; i <= 4; i++) {
      const av = wcLoad(`f${i}av`);
      if (av) applyWcFriendAv(i - 1, av);
    }
    applyWcFriendNames([
      wcLoad('f1name'), wcLoad('f2name'),
      wcLoad('f3name'), wcLoad('f4name')
    ]);
    const uav = wcLoad('userav');
    if (uav) applyWcUserAv(uav);
    applyWcUserText(wcLoad('uname'), wcLoad('ubio'));
    for (let i = 1; i <= 3; i++) {
      const p = wcLoad(`photo${i}`);
      if (p) applyWcPhoto(i - 1, p);
    }
    const bubble = wcLoad('bubble');
    if (bubble) applyWcBubble(bubble);
    const chatImg = wcLoad('chatimg');
    if (chatImg) applyWcChatImg(chatImg);
    applyWcBg(wcLoad('bgMode') || 'blur', wcLoad('bgCustom'));
  }

  let tempWcBgMode = 'blur', tempWcBgCustom = null;

  // 预览辅助
  function setPreview(id, src, radius) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:cover;border-radius:${radius || '8px'};">`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initWcWidget();

    const overlay = document.getElementById('wcEditOverlay');
    const widget  = document.querySelector('.widget-chat');

    if (widget) {
      widget.addEventListener('click', () => {
        // 回填文字
        const fields = [
          ['wcInputF1','f1name'],['wcInputF2','f2name'],
          ['wcInputF3','f3name'],['wcInputF4','f4name'],
          ['wcInputUname','uname'],['wcInputUbio','ubio'],
          ['wcInputBubble','bubble']
        ];
        fields.forEach(([id, key]) => {
          const v = wcLoad(key);
          if (v) document.getElementById(id).value = v;
        });

        // 回填头像预览
        for (let i = 1; i <= 4; i++) {
          const v = wcLoad(`f${i}av`);
          if (v) setPreview(`wcPreviewF${i}`, v, '50%');
        }
        const uav = wcLoad('userav');
        if (uav) setPreview('wcPreviewUser', uav, '50%');
        for (let i = 1; i <= 3; i++) {
          const v = wcLoad(`photo${i}`);
          if (v) setPreview(`wcPreviewP${i}`, v, '8px');
        }
        const ci = wcLoad('chatimg');
        if (ci) setPreview('wcPreviewChatImg', ci, '10px');

        // 背景按钮
        tempWcBgMode = wcLoad('bgMode') || 'blur';
        tempWcBgCustom = wcLoad('bgCustom');
        document.querySelectorAll('[data-wc-mode]').forEach(btn => {
          btn.classList.toggle('active', btn.dataset.wcMode === tempWcBgMode);
        });
        document.getElementById('wcBgUploadRow').style.display =
          tempWcBgMode === 'custom' ? 'block' : 'none';

        overlay.style.display = 'flex';
      });
    }

    // 关闭
    document.getElementById('wcModalClose').addEventListener('click', () => {
      overlay.style.display = 'none';
    });
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // 图片上传 - 好友头像1~4
    [1,2,3,4].forEach(i => {
      document.getElementById(`wcF${i}Input`).addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        const src = await fileToBase64Wc(file);
        wcSave(`f${i}av`, src);
        setPreview(`wcPreviewF${i}`, src, '50%');
        applyWcFriendAv(i - 1, src);
      });
    });

    // 主头像
    document.getElementById('wcUserInput').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      const src = await fileToBase64Wc(file);
      wcSave('userav', src);
      setPreview('wcPreviewUser', src, '50%');
      applyWcUserAv(src);
    });

    // 三张照片
    [1,2,3].forEach(i => {
      document.getElementById(`wcP${i}Input`).addEventListener('change', async e => {
        const file = e.target.files[0]; if (!file) return;
        const src = await fileToBase64Wc(file);
        wcSave(`photo${i}`, src);
        setPreview(`wcPreviewP${i}`, src, '8px');
        applyWcPhoto(i - 1, src);
      });
    });

    // 聊天图
    document.getElementById('wcChatImgInput').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      const src = await fileToBase64Wc(file);
      wcSave('chatimg', src);
      setPreview('wcPreviewChatImg', src, '10px');
      applyWcChatImg(src);
    });

    // 背景切换
    document.querySelectorAll('[data-wc-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        tempWcBgMode = btn.dataset.wcMode;
        document.querySelectorAll('[data-wc-mode]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('wcBgUploadRow').style.display =
          tempWcBgMode === 'custom' ? 'block' : 'none';
      });
    });

    // 背景图上传
    document.getElementById('wcBgInput').addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return;
      tempWcBgCustom = await fileToBase64Wc(file);
      wcSave('bgCustom', tempWcBgCustom);
    });

    // 保存
    document.getElementById('wcModalSave').addEventListener('click', () => {
      const f1 = document.getElementById('wcInputF1').value.trim();
      const f2 = document.getElementById('wcInputF2').value.trim();
      const f3 = document.getElementById('wcInputF3').value.trim();
      const f4 = document.getElementById('wcInputF4').value.trim();
      const uname  = document.getElementById('wcInputUname').value.trim();
      const ubio   = document.getElementById('wcInputUbio').value.trim();
      const bubble = document.getElementById('wcInputBubble').value.trim();

      if (f1) wcSave('f1name', f1);
      if (f2) wcSave('f2name', f2);
      if (f3) wcSave('f3name', f3);
      if (f4) wcSave('f4name', f4);
      if (uname)  wcSave('uname',  uname);
      if (ubio)   wcSave('ubio',   ubio);
      if (bubble) wcSave('bubble', bubble);
      wcSave('bgMode', tempWcBgMode);
      if (tempWcBgCustom) wcSave('bgCustom', tempWcBgCustom);

      applyWcFriendNames([f1, f2, f3, f4]);
      applyWcUserText(uname, ubio);
      applyWcBubble(bubble);
      applyWcBg(tempWcBgMode, tempWcBgCustom);

      overlay.style.display = 'none';
    });
  });
})();

/* ---- 锁屏逻辑 ---- */
(function() {
  function getPASSCODE() {
    return localStorage.getItem('luna_passcode') || '000000';
  }

  let lockInput = '';

  function updateLockScreen() {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const now = new Date();
    const tzNow = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const sTime = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    const el = document.getElementById('lockStatusTime');
    if (el) el.textContent = sTime;
    const h = tzNow.getHours();
    const m = tzNow.getMinutes();
    const hDisp = h % 12 || 12;
    const mStr = String(m).padStart(2, '0');
    const lt = document.getElementById('lockTimeStr');
    if (lt) lt.textContent = hDisp + ':' + mStr;
    const days = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const months = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];
    const ld = document.getElementById('lockDateStr');
    if (ld) ld.textContent = days[tzNow.getDay()] + ', ' + months[tzNow.getMonth()] + ' ' + tzNow.getDate();
    const totalMins = 24 * 60;
    const elapsed = h * 60 + m;
    const pct = Math.round(elapsed / totalMins * 100);
    const dp = document.getElementById('lockDayPct');
    const df = document.getElementById('lockDayFill');
    if (dp) dp.textContent = pct + '%';
    if (df) df.style.width = pct + '%';
    const mainPct = document.getElementById('batPct');
    const mainInner = document.getElementById('batInner');
    const lp = document.getElementById('lockBatPct');
    const li = document.getElementById('lockBatInner');
    if (mainPct && lp) lp.textContent = mainPct.textContent;
    if (mainInner && li) { li.style.width = mainInner.style.width; li.style.background = mainInner.style.background; }
  }

  updateLockScreen();
  setInterval(updateLockScreen, 1000);

  // 点击锁屏主体 → 弹出键盘
  const ls = document.getElementById('lockScreen');
  const panel = document.getElementById('lockPassPanel');
  if (ls) {
    ls.addEventListener('click', function(e) {
      if (panel && panel.style.display === 'flex') return;
      const passEnabled = localStorage.getItem('luna_lock_pass_enabled') === 'true';
      if (!passEnabled) {
        // 没开密码 → 直接解锁
        ls.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        ls.style.opacity = '0';
        ls.style.transform = 'scale(1.03)';
        setTimeout(() => { ls.style.display = 'none'; }, 400);
        return;
      }
      if (panel) {
        panel.style.display = 'flex';
        lockInput = '';
        updateDots();
      }
    });
  }

  function updateDots() {
    for (let i = 0; i < 6; i++) {
      const d = document.getElementById('dot' + i);
      if (!d) continue;
      d.classList.remove('filled', 'error');
      if (i < lockInput.length) d.classList.add('filled');
    }
  }

  window.lockKeyPress = function(num) {
    if (lockInput.length >= 6) return;
    lockInput += num;
    updateDots();
    if (lockInput.length === 6) {
      setTimeout(() => {
        if (lockInput === getPASSCODE()) {
          // 正确：解锁
          ls.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
          ls.style.opacity = '0';
          ls.style.transform = 'scale(1.03)';
          setTimeout(() => { ls.style.display = 'none'; }, 400);
        } else {
          // 错误：抖动 + 清空
          for (let i = 0; i < 6; i++) {
            const d = document.getElementById('dot' + i);
            if (d) { d.classList.remove('filled'); d.classList.add('error'); }
          }
          const hint = document.getElementById('lockPassHint');
          if (hint) { hint.textContent = 'Incorrect Passcode'; hint.style.color = 'rgba(200,50,50,0.7)'; }
          const dots = document.getElementById('lockDots');
          if (dots) {
            dots.style.transition = 'transform 0.05s';
            let count = 0;
            const shake = setInterval(() => {
              dots.style.transform = count % 2 === 0 ? 'translateX(8px)' : 'translateX(-8px)';
              count++;
              if (count > 5) { clearInterval(shake); dots.style.transform = 'translateX(0)'; }
            }, 60);
          }
          setTimeout(() => {
            lockInput = '';
            updateDots();
            if (hint) { hint.textContent = 'Enter Passcode'; hint.style.color = ''; }
          }, 800);
        }
      }, 120);
    }
  };

  window.lockKeyDel = function() {
    if (lockInput.length > 0) { lockInput = lockInput.slice(0, -1); updateDots(); }
  };

  window.lockPassCancel = function(e) {
    if (e) e.stopPropagation();
    if (panel) panel.style.display = 'none';
    lockInput = '';
    updateDots();
  };
})();


function updateBattery() {
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');

  function render(pct) {
    const p = Math.round(pct);
    if (pctEl) pctEl.textContent = p;
    if (innerEl) {
      innerEl.style.width = p + '%';
      innerEl.style.background = p <= 20
        ? 'linear-gradient(90deg, #f87171, #ef4444)'
        : 'linear-gradient(90deg, #6ee7b7, #34d399)';
    }
  }

  if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
      render(battery.level * 100);
      battery.addEventListener('levelchange', () => {
        render(battery.level * 100);
      });
    });
  } else {
    // 不支持的设备（iOS等）显示固定值
    render(76);
  }
}
updateBattery();


/* ---- App 点击事件 ---- */
function setupAppClicks() {
  // 合并 grid 和 dock 里的所有可点击图标
  const allApps = document.querySelectorAll('.app[data-app], .dock-app[data-app]');

  allApps.forEach(el => {
    el.addEventListener('click', () => {
      const appName = el.dataset.app;
      openApp(appName);
    });
  });
}

/* 打开 App（目前只是占位提示，后续每个 app 会有独立模块） */
/* 打开 App — 带丝滑转场动画 */
function openApp(name) {
  // 图标弹簧反馈
  const face = document.querySelector(`[data-app="${name}"] .app-face, [data-app="${name}"] .dock-face`);
  if (face) {
    face.style.transition = 'transform 0.12s cubic-bezier(0.34,1.56,0.64,1)';
    face.style.transform = 'scale(0.82)';
    setTimeout(() => { face.style.transform = 'scale(1)'; }, 130);
  }

  // App 路由表
  const routes = {
    'wallpaper': 'Wallpaper.html',
    // 后续加其他 app：
    'settings': 'settings.html',
    'chat': 'chat.html',
    'characters': 'characters.html',
    'worldbook': 'worldbook.html',
    'iconbeauty': 'iconbeauty.html',
    'memory': 'memory.html',
    'archive': 'archive.html',
    'music': 'music.html',
    'forum': 'forum.html',
    'beautify': 'beautify.html',
    'wallet': 'wallet.html',
    'user': 'user.html',
    'dialognovel': 'dialognovel.html',
  }

  const url = routes[name];
  if (!url) return; // 没有对应页面就不跳转

  // 全屏遮罩淡入 → 跳转
  const mask = document.getElementById('appTransMask');
  mask.style.transition = 'opacity 0.32s cubic-bezier(0.4,0,0.2,1)';
  mask.style.opacity = '1';
  mask.style.pointerEvents = 'all';

  setTimeout(() => {
    window.location.href = url;
  }, 300);
}

// 禁止浏览器使用返回缓存快照，同时应用字体设置
window.addEventListener('pageshow', (e) => {
  if (e.persisted) window.location.reload();
  applyGlobalFont();
});
/* ---- 初始化 ---- */
document.addEventListener('DOMContentLoaded', () => {
  setupAppClicks();
  updateBattery();
  updateTime();
  setInterval(updateTime, 1000);
  applyIsland();
  applyCustomIcons();
  // 应用锁屏壁纸
  const lockWall = localStorage.getItem('luna_lock_wallpaper');
  const lockWallImg = document.getElementById('lockWallpaperImg');
  if (lockWall && lockWallImg) {
    lockWallImg.style.backgroundImage = `url(${lockWall})`;
    lockWallImg.style.display = 'block';
  }
});

function setWeather(type, label) {
  document.querySelectorAll('.wi-svg').forEach(el => el.style.display = 'none');
  const target = document.getElementById('wi-' + type);
  if (target) target.style.display = 'block';
  const lbl = document.querySelector('.wi-label');
  if (lbl) lbl.textContent = label;
}

/* ================================
   壁纸接入 — 读取 wallpaper.html 写入的 IndexedDB
================================ */
let _wpDb = null;

function openWpDB() {
  return new Promise((res, rej) => {
    if (_wpDb) {
      if (_wpDb.objectStoreNames.contains('data')) return res(_wpDb);
      _wpDb = null;
    }
    const req = indexedDB.open('LunaWallpaperDB');
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        db.createObjectStore('data', { keyPath: 'key' });
      }
    };
    req.onsuccess = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('data')) {
        db.close();
        const up = indexedDB.open('LunaWallpaperDB', db.version + 1);
        up.onupgradeneeded = ev => {
          if (!ev.target.result.objectStoreNames.contains('data'))
            ev.target.result.createObjectStore('data', { keyPath: 'key' });
        };
        up.onsuccess = ev => { _wpDb = ev.target.result; res(_wpDb); };
        up.onerror = () => rej();
      } else {
        _wpDb = db; res(_wpDb);
      }
    };
    req.onerror = () => rej();
  });
}

async function wpDbGet(key) {
  const db = await openWpDB();
  return new Promise((res) => {
    const req = db.transaction('data').objectStore('data').get(key);
    req.onsuccess = () => res(req.result ? req.result.value : null);
    req.onerror = () => res(null);
  });
}

async function applyWallpaperToFrame(data) {
  const layer = document.getElementById('wallpaperLayer');
  if (!layer) return;

  // 清空旧内容
  layer.innerHTML = '';

  if (!data || !data.dataUrl) {
    // 没有壁纸，恢复默认渐变（清空 layer 即可，css 的 background 还在）
    return;
  }

  if (data.kind === 'image') {
    const img = document.createElement('img');
    img.src = data.dataUrl;
    layer.appendChild(img);
  } else if (data.kind === 'video') {
    const video = document.createElement('video');
    video.src = data.dataUrl;
    video.autoplay = true;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    layer.appendChild(video);
  }
}

async function initWallpaper() {
  const applied = await wpDbGet('applied');
  await applyWallpaperToFrame(applied);

  // 监听 wallpaper.html 通过 localStorage 发出的更新信号
  window.addEventListener('storage', async (e) => {
    if (e.key === 'luna_wallpaper_update') {
      const applied = await wpDbGet('applied');
      await applyWallpaperToFrame(applied);
    }
    if (e.key === 'luna_tz_update') {
      // 时区变化后重新渲染时间（如果你的 widget 有时区相关显示可在此扩展）
      updateTime();
    }
    if (e.key === 'luna_font_update') {
      applyGlobalFont();
    }
    if (e.key === 'luna_island_update') {
      applyIsland();
    }
    if (e.key === 'luna_weather_widget_update') {
      try {
        const db = await new Promise((res, rej) => {
          const r = indexedDB.open('LunaWeatherDB', 2);
          r.onsuccess = ev => res(ev.target.result);
          r.onerror = () => rej();
        });
        const data = await new Promise((res, rej) => {
          const r = db.transaction('settings').objectStore('settings').get('weather');
          r.onsuccess = () => res(r.result || {});
          r.onerror = () => rej({});
        });
        applyAllSettings(data);
      } catch(err) {}
    }
    if (e.key === 'luna_music_widget_update') {
      _mpCache = await loadMusicDB();
      const d = _mpCache;

      // 歌名 + 歌手（新版 iOS 双唱片样式选择器）
      if (d.song)   { const el = document.querySelector('.mw-ios-song');   if (el) el.textContent = d.song; }
      if (d.artist) { const el = document.querySelector('.mw-ios-artist'); if (el) el.textContent = d.artist; }

      // 左右两张唱片图片
      const discLeft  = document.getElementById('mwDiscLeft');
      const discRight = document.getElementById('mwDiscRight');
      if (d.discLeftImage && discLeft) {
        discLeft.style.backgroundImage = `url(${d.discLeftImage})`;
        discLeft.style.backgroundSize = 'cover';
        discLeft.style.backgroundPosition = 'center';
      } else if (d.coverImage && discLeft) {
        discLeft.style.backgroundImage = `url(${d.coverImage})`;
        discLeft.style.backgroundSize = 'cover';
        discLeft.style.backgroundPosition = 'center';
      }
      if (d.discRightImage && discRight) {
        discRight.style.backgroundImage = `url(${d.discRightImage})`;
        discRight.style.backgroundSize = 'cover';
        discRight.style.backgroundPosition = 'center';
      } else if (d.coverImage && discRight) {
        discRight.style.backgroundImage = `url(${d.coverImage})`;
        discRight.style.backgroundSize = 'cover';
        discRight.style.backgroundPosition = 'center';
      }

      // 背景 + 透明度
      if (d.bgImage) applyMusicWidgetBg(d.bgImage);
      else applyMusicWidgetBg(null);
      if (d.opacity !== undefined) _mpCache.opacity = d.opacity;
      applyMusicIndexBand();
    }
    if (e.key === 'luna_friends_widget_update') {
      initFriendsWidget();
    }
    if (e.key === 'luna_magazine_widget_update') {
      initMagazineWidget();
    }
    if (e.key === 'luna_press_widget_update') {
      initPressWidget();
    }
    if (e.key === 'luna_diary_widget_update') {
      initDiaryWidget();
    }
  });
}

// ---- 字体DB（从settings.js同步过来）----
let _fontDb = null;
function openFontDB() {
  return new Promise((res, rej) => {
    if (_fontDb) return res(_fontDb);
    const req = indexedDB.open('LunaFontDB', 4);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('fonts', { keyPath: 'id' });
    };
    req.onsuccess = e => { _fontDb = e.target.result; res(_fontDb); };
    req.onerror = () => rej();
  });
}
async function fontDbGetAll() {
  const db = await openFontDB();
  return new Promise(res => {
    const req = db.transaction('fonts').objectStore('fonts').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror   = () => res([]);
  });
}

async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));

  // 从IndexedDB取字体数据，重新注册进浏览器
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB',4 );
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
      });
      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch(e) {}
  }

  // 注入 <style> + !important，覆盖所有 CSS 写死的颜色
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const colorRule  = style.color ? `color: ${style.color} !important;` : '';
  const sizeRule   = style.size  ? `font-size: ${style.size}px !important;` : '';
  const familyRule = name        ? `font-family: '${name}', sans-serif !important;` : '';
  // 排除所有装饰性 widget，防止全局字体覆盖其内部排版
  const EXCL = [
    '.bp-card', '.bp-card *',
    '.photo-diary-widget', '.photo-diary-widget *',
    '.friends-widget', '.friends-widget *',
    '.magazine-widget', '.magazine-widget *',
    '.music-widget', '.music-widget *',
    '.press-widget', '.press-widget *',
    '.luna-profile-card', '.luna-profile-card *',
    '.widget-time-weather', '.widget-time-weather *',
  ].map(s => `:not(${s})`).join('');
  tag.textContent = `*${EXCL} { ${colorRule} ${sizeRule} ${familyRule} }`;
}

/* ================================
   灵动岛状态栏同步
================================ */
function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if (!el) return;

  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };

  el.innerHTML = styleMap[style] || styleMap.minimal;

  // 时钟样式实时更新
  clearInterval(window._siClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* 图标美化同步 — 页面加载时读取自定义图标 */
async function applyCustomIcons() {
  try {
    const db = await new Promise((res, rej) => {
      // 不写死版本号，避免 store 不存在的 NotFoundError
      const req = indexedDB.open('LunaIconBeautyDB');
      req.onupgradeneeded = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('icons')) {
          d.createObjectStore('icons', { keyPath: 'appId' });
        }
      };
      req.onsuccess = e => {
        const d = e.target.result;
        if (!d.objectStoreNames.contains('icons')) { d.close(); res(null); return; }
        res(d);
      };
      req.onerror = () => res(null);
    });
    if (!db) return;
    const icons = await new Promise(res => {
      const r = db.transaction('icons').objectStore('icons').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => res([]);
    });
    icons.forEach(row => {
      const face = document.querySelector(`[data-app="${row.appId}"] .app-face, [data-app="${row.appId}"] .dock-face`);
      if (!face) return;
      face.innerHTML = `<img src="${row.imageData}" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt=""/>`;
    });
  } catch(e) {}
}

// 页面加载时立即同步一次图标
document.addEventListener('DOMContentLoaded', () => applyCustomIcons());

// 监听 iconbeauty 保存事件（跨页面同步）
window.addEventListener('storage', e => {
  if (e.key === 'luna_icon_update') applyCustomIcons();
});