/* =========================================================
   论坛 · 启动  forum-main.js
========================================================= */
F.goDesktop = () => {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(245,245,247,.97);opacity:0;z-index:99999;transition:opacity .28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
};

(async function boot() {
  F.statusbar.init();
  try { await F.load(); } catch (e) { console.error(e); F.toast('数据读取失败：' + e.message, 'close', 4000); }
  try { await F.syncChars(); } catch (e) { console.warn(e); }
  F.tabs.init();
  F.tabs.current = null;
  F.tabs.go('home');
  window.addEventListener('storage', e => {
    if (e.key === 'luna_char_db_update' || e.key === 'luna_characters_updated') F.ai._chars = null;
  });
  // 安卓返回键 / 浏览器返回：优先关闭弹层与页面
  history.pushState({ f: 1 }, '');
  window.addEventListener('popstate', () => {
    const sheets = document.querySelectorAll('.sheet.show');
    const viewer = document.getElementById('viewer');
    if (viewer.classList.contains('show')) viewer.classList.remove('show');
    else if (sheets.length) sheets[sheets.length - 1].previousElementSibling && sheets[sheets.length - 1].previousElementSibling.click();
    else if (F.nav.stack.length) F.nav.pop();
    else { F.goDesktop(); return; }
    history.pushState({ f: 1 }, '');
  });
  setTimeout(() => F.autoPost(), 1600);
})();