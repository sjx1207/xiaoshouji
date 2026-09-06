/* ==========================================================================
   角初笺 × CHAT · jc-chat-bridge.js
   把 chat.html「新的连接」弹窗里的「加好友」磁贴，接到新页面 jc-friend-add.html。
   —— 不改动 chat.js 一行代码：只在冒泡阶段拦截该磁贴的点击。
   用法：在 chat.html 里、<script src="chat.js"> 之后加一行
         <script src="jc-chat-bridge.js"></script>
========================================================================== */
(function () {
  'use strict';

  function silkGo(url) {
    var v = document.createElement('div');
    v.style.cssText =
      'position:fixed;inset:0;z-index:99999;pointer-events:auto;opacity:0;' +
      'transition:opacity .3s cubic-bezier(.22,.9,.24,1);' +
      'background:linear-gradient(180deg,#fbfbfc 0%,#f5f5f7 38%,#eeeef1 100%);';
    document.body.appendChild(v);
    requestAnimationFrame(function () {
      v.style.opacity = '1';
      setTimeout(function () { location.href = url; }, 290);
    });
  }

  document.addEventListener('click', function (e) {
    var tile = e.target.closest && e.target.closest('.add-tile[data-add="friend"]');
    if (!tile) return;
    e.preventDefault();
    e.stopPropagation();
    var modal = document.getElementById('addModal');
    if (modal) modal.classList.remove('open');
    silkGo('../初笺/jc-friend-add.html');
  }, true);   // 捕获阶段，先于 chat.js 自己的占位处理

  /* 从加好友页返回时，让好友列表立刻反映新数据 */
  window.addEventListener('storage', function (e) {
    if (e.key === 'jc_friend_added') location.reload();
  });
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) location.reload();
  });
})();
