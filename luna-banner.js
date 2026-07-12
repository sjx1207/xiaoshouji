/* ================================
   luna-banner.js
   跨 App 共享的「消息横幅」弹出模块

   用途：
     任何页面（wallet.html / messages.html / characters.html 等）只要引入本文件，
     即可调用 window.LunaBanner.show({...}) 弹出一条横幅通知。
     横幅的开关状态与视觉样式统一读取自「设置 App」写入的 localStorage：
       luna_banner_enabled : 'true' | 'false'
       luna_banner_style   : 'champagne' | 'sage' | 'midnight' | 'rose' | 'oat' | 'mist'
       luna_banner_update  : 时间戳，用于跨页面通知样式变化

   用法示例（例如 wallet.js 办卡成功后）：
     window.LunaBanner.show({
       app: 'Wallet',
       title: '办卡成功',
       message: '你的新卡已添加到卡包'
     });
================================ */

(function () {
  if (window.LunaBanner && window.LunaBanner.__isFullImpl) return; // 避免重复注入（例如 settings.js 已提供同名实现时）

  const BANNER_ICON_MAP = {
    champagne: '<i style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle,#fff8ee 0%,transparent 70%);"></i>',
    sage:      '',
    midnight:  '<i style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle,#e6c896 0%,transparent 70%);"></i>',
    rose:      '',
    oat:       '',
    mist:      '<i style="width:100%;height:100%;border-radius:50%;background:radial-gradient(circle,#f2f6f4 0%,transparent 70%);"></i>'
  };

  /* 横幅本体样式：与「设置 → 消息横幅」预览页共用同一套视觉规范，
     以内联 <style> 注入，使本模块不依赖 settings.css 即可独立工作 */
  const CSS = `
.luna-banner-host{position:fixed;top:52px;left:0;right:0;z-index:20000;display:flex;flex-direction:column;align-items:center;gap:8px;pointer-events:none;}
.bn-banner{position:relative;z-index:1;width:100%;max-width:288px;box-sizing:border-box;display:flex;gap:11px;align-items:flex-start;padding:13px 15px;border-radius:20px;transition:background .25s,box-shadow .25s;pointer-events:auto;font-family:'Inter',-apple-system,sans-serif;}
.bn-icon{width:32px;height:32px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.bn-icon i{display:block;width:15px;height:15px;}
.bn-body{flex:1;min-width:0;}
.bn-top{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
.bn-app{font-size:12px;font-weight:600;letter-spacing:.03em;}
.bn-time{font-size:11px;flex-shrink:0;}
.bn-title{font-family:'Cormorant Garamond','Noto Serif SC',serif;font-size:16px;font-weight:600;margin:4px 0 1px;}
.bn-msg{font-size:12.5px;line-height:1.5;margin:0;}
.bn-champagne{background:rgba(255,252,248,.86);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.5);box-shadow:0 12px 30px rgba(90,60,30,.18);}
.bn-champagne .bn-icon{background:linear-gradient(160deg,#c9a06a,#a97c46);}
.bn-champagne .bn-app{color:#9c8060;text-transform:uppercase;}
.bn-champagne .bn-time{color:#b8a892;}
.bn-champagne .bn-title{color:#3d2f22;}
.bn-champagne .bn-msg{color:#6e5c48;}
.bn-sage{background:rgba(250,251,248,.9);backdrop-filter:blur(18px);box-shadow:0 10px 26px rgba(60,80,55,.16);align-items:center;}
.bn-sage .bn-icon{width:8px;height:8px;background:#7c9271;}
.bn-sage .bn-title{display:none;}
.bn-sage .bn-app{color:#5c6d52;}
.bn-sage .bn-time{color:#9caa93;}
.bn-sage .bn-msg{color:#3f4a3a;margin-top:2px;}
.bn-midnight{background:rgba(20,18,16,.78);backdrop-filter:blur(22px);border:1px solid rgba(230,200,150,.22);box-shadow:0 14px 34px rgba(0,0,0,.4);}
.bn-midnight .bn-icon{background:rgba(230,200,150,.14);border:1px solid rgba(230,200,150,.3);border-radius:9px;}
.bn-midnight .bn-app{color:#c9b48c;text-transform:uppercase;}
.bn-midnight .bn-time{color:#7d7568;}
.bn-midnight .bn-title{color:#f3ead9;}
.bn-midnight .bn-msg{color:#b5ac9c;}
.bn-rose{background:rgba(255,250,251,.88);backdrop-filter:blur(18px);box-shadow:0 12px 28px rgba(120,60,80,.16);align-items:center;}
.bn-rose .bn-icon{background:linear-gradient(160deg,#d9a8b6,#bd7f92);}
.bn-rose .bn-title{display:none;}
.bn-rose .bn-app{color:#8a5c68;}
.bn-rose .bn-time{color:#c2a0aa;}
.bn-rose .bn-msg{color:#553842;margin-top:2px;}
.bn-oat{background:#f7f2e9;box-shadow:0 10px 26px rgba(70,55,25,.18);padding-left:20px;}
.bn-oat::before{content:'';position:absolute;left:14px;top:13px;bottom:13px;width:2px;background:linear-gradient(180deg,#b6935c,#8f6f42);}
.bn-oat .bn-icon{display:none;}
.bn-oat .bn-app{color:#a1875f;text-transform:uppercase;letter-spacing:.08em;}
.bn-oat .bn-time{color:#b7a789;}
.bn-oat .bn-title{color:#453419;}
.bn-oat .bn-msg{color:#71613f;}
.bn-mist{background:rgba(247,249,248,.92);backdrop-filter:blur(16px);box-shadow:0 10px 24px rgba(40,60,55,.15);align-items:center;}
.bn-mist .bn-icon{border-radius:10px;background:linear-gradient(160deg,#93a89e,#6f8880);}
.bn-mist .bn-title{display:none;}
.bn-mist .bn-app{color:#4c5c56;}
.bn-mist .bn-time{color:#8fa19a;}
.bn-mist .bn-msg{color:#39443f;margin-top:2px;}
`;

  function ensureStyle() {
    if (document.getElementById('lunaBannerStyle')) return;
    const style = document.createElement('style');
    style.id = 'lunaBannerStyle';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function ensureHost() {
    let host = document.getElementById('lunaBannerHost');
    if (!host) {
      host = document.createElement('div');
      host.id = 'lunaBannerHost';
      host.className = 'luna-banner-host';
      document.body.appendChild(host);
    }
    return host;
  }

  window.LunaBanner = {
    __isFullImpl: true,

    getConfig() {
      return {
        enabled: localStorage.getItem('luna_banner_enabled') === 'true',
        style: localStorage.getItem('luna_banner_style') || 'champagne'
      };
    },

    /* 弹出一条横幅通知。若用户已在设置中关闭横幅开关，则不弹出，返回 false。
       参数：{ app, title, message, icon, duration } */
    show(opts) {
      const cfg = this.getConfig();
      if (!cfg.enabled) return false;

      ensureStyle();
      const host = ensureHost();

      const { app = 'Luna', title = '', message = '', icon = '', duration = 3600 } = opts || {};
      const now = new Date();
      const timeStr = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
      const iconHtml = icon || (BANNER_ICON_MAP[cfg.style] || '');

      const el = document.createElement('div');
      el.className = 'bn-banner bn-' + cfg.style + ' luna-banner-toast';
      el.style.transform = 'translateY(-16px)';
      el.style.opacity = '0';
      el.style.transition = 'transform .32s cubic-bezier(.22,1,.36,1), opacity .32s';
      el.innerHTML = `
        <div class="bn-icon">${iconHtml}</div>
        <div class="bn-body">
          <div class="bn-top">
            <span class="bn-app">${app}</span>
            <span class="bn-time">${timeStr}</span>
          </div>
          ${title ? `<div class="bn-title">${title}</div>` : ''}
          ${message ? `<p class="bn-msg">${message}</p>` : ''}
        </div>`;

      host.appendChild(el);
      requestAnimationFrame(() => {
        el.style.transform = 'translateY(0)';
        el.style.opacity = '1';
      });

      const remove = () => {
        el.style.transform = 'translateY(-16px)';
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 340);
      };
      const timer = setTimeout(remove, duration);
      el.addEventListener('click', () => { clearTimeout(timer); remove(); });

      return true;
    }
  };
})();
