/* ================================
   Chatroom — chatroom.js
================================ */

/* 实时时钟 */
function crTick() {
  const n = new Date();
  const el = document.getElementById('crTime');
  if (el) {
    el.textContent =
      n.getHours().toString().padStart(2, '0') + ':' +
      n.getMinutes().toString().padStart(2, '0');
  }
}
crTick();
setInterval(crTick, 10000);

document.addEventListener('DOMContentLoaded', function () {

  /* 返回按钮（头像） */
  var backBtn = document.getElementById('crBackBtn');
  if (backBtn) {
    backBtn.addEventListener('click', function () {
      if (window.history.length > 1) {
        window.history.back();
      } else {
        window.location.href = 'index.html';
      }
    });
  }

  /* 建议芯片 → 填入输入框 */
  document.querySelectorAll('.cr-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var box = document.getElementById('crInputBox');
      if (!box) return;
      var txt = chip.querySelector('span') ? chip.querySelector('span').textContent : '';
      box.textContent = txt;
      box.style.color = '#1a1a1a';
      box.focus();
    });
  });

  /* 输入框占位逻辑 */
  var inputBox = document.getElementById('crInputBox');
  if (inputBox) {
    inputBox.addEventListener('focus', function () {
      if (inputBox.textContent.trim() === '向 Luna 发送消息') {
        inputBox.textContent = '';
        inputBox.style.color = '#1a1a1a';
      }
    });
    inputBox.addEventListener('blur', function () {
      if (!inputBox.textContent.trim()) {
        inputBox.textContent = '向 Luna 发送消息';
        inputBox.style.color = '#c0bab2';
      }
    });
    inputBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        crSend();
      }
    });
  }

  /* 发送按钮 */
  var sendBtn = document.getElementById('crSendBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', crSend);
  }

});

function crSend() {
  var box = document.getElementById('crInputBox');
  var area = document.getElementById('crMessages');
  if (!box || !area) return;

  var txt = box.textContent.trim();
  if (!txt || txt === '向 Luna 发送消息') return;

  /* 移除 typing */
  var tw = document.getElementById('crTyping');
  if (tw) tw.remove();

  /* 时间 */
  var n = new Date();
  var t = n.getHours().toString().padStart(2, '0') + ':' +
          n.getMinutes().toString().padStart(2, '0');

  /* 新消息 */
  var d = document.createElement('div');
  d.className = 'cr-msg-mine';
  d.innerHTML =
    '<div class="cr-mine-bubble">' +
      '<p class="cr-msg-p" style="padding-left:0;color:#f2f0eb">' + txt + '</p>' +
    '</div>' +
    '<div class="cr-mine-meta">' +
      '<span class="cr-mine-time">' + t + '</span>' +
    '</div>';
  area.appendChild(d);

  /* 清空输入框 */
  box.textContent = '向 Luna 发送消息';
  box.style.color = '#c0bab2';

  /* 重新显示 typing */
  var newTw = document.createElement('div');
  newTw.className = 'cr-typing';
  newTw.id = 'crTyping';
  newTw.innerHTML =
    '<div class="cr-mini-av">' +
      '<svg width="28" height="28" viewBox="0 0 28 28">' +
        '<circle cx="14" cy="14" r="14" fill="#e8e8e8"/>' +
        '<ellipse cx="14" cy="10" rx="6" ry="5.5" fill="#c8c8c8"/>' +
        '<ellipse cx="14" cy="10" rx="4.2" ry="4.2" fill="#dcdcdc"/>' +
        '<ellipse cx="14" cy="22" rx="8" ry="6" fill="#d0d0d0"/>' +
      '</svg>' +
    '</div>' +
    '<div class="cr-typing-bubble">' +
      '<div class="cr-tdot"></div>' +
      '<div class="cr-tdot"></div>' +
      '<div class="cr-tdot"></div>' +
    '</div>';
  area.appendChild(newTw);
  area.scrollTop = area.scrollHeight;
}