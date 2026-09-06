/* ==========================================================================
   角初笺 · jc-cardart.js — 角色卡渲染引擎
   角色卡不再是死板的 DOM，而是一份完整的 HTML + CSS + JS 文档，
   渲染在沙箱 iframe 里。
     · 有背景图 / 头像 → 直接用素材库的图
     · 没有            → 全部用 CSS + SVG 现场绘制（渐变、纹样、剪影徽记）
   art 规格由模型给出（配色 / 母题 / 版式 / 字符），本地负责把它变成代码，
   这样既保证每张卡长得都不一样，又不会因为模型吐坏代码而开天窗。
========================================================================== */
(function (global) {
  'use strict';

  var MOTIFS = ['moon', 'rain', 'petal', 'smoke', 'wave', 'star', 'flame', 'ink', 'frost', 'thread', 'lattice', 'dust'];
  var LAYOUTS = ['stack', 'split', 'band', 'corner'];

  var PALETTES = [
    ['#14141a', '#2c2c38', '#8d8d9c'], ['#1b1a20', '#3a3340', '#a39aa8'],
    ['#101418', '#243036', '#8fa3ad'], ['#191418', '#3b2b30', '#b09a9d'],
    ['#12161a', '#2a3a3a', '#93aca4'], ['#1a1712', '#37301f', '#b0a180'],
    ['#15131c', '#332a44', '#a396bb'], ['#181818', '#333333', '#a0a0a0'],
    ['#0f1620', '#1f2f43', '#8ea6c2'], ['#1d1418', '#402431', '#c095a3']
  ];

  function hash(str) {
    var h = 2166136261;
    str = String(str || '');
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function pickBy(arr, seed) { return arr[seed % arr.length]; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** 把模型给的 art 规格补全、纠错 —— 模型给什么都不会崩 */
  function spec(card) {
    var a = (card && card.art) || {};
    var seed = hash((card && (card.name + card.enName + card.tagline)) || Math.random());
    var pal = Array.isArray(a.palette) && a.palette.length >= 2
      ? a.palette.map(function (c) { return /^#[0-9a-f]{3,8}$/i.test(String(c)) ? c : null; }).filter(Boolean)
      : null;
    if (!pal || pal.length < 3) pal = pickBy(PALETTES, seed);
    return {
      palette: pal,
      motif: MOTIFS.indexOf(a.motif) > -1 ? a.motif : pickBy(MOTIFS, seed >> 3),
      layout: LAYOUTS.indexOf(a.layout) > -1 ? a.layout : pickBy(LAYOUTS, seed >> 7),
      glyph: (a.glyph && String(a.glyph).slice(0, 1)) || (card && card.name ? String(card.name).slice(0, 1) : '笺'),
      accent: /^#[0-9a-f]{3,8}$/i.test(String(a.accent)) ? a.accent : pal[2],
      grain: a.grain !== false,
      seed: seed
    };
  }

  /* ---------------------------------------------------------------
     没有头像时的剪影徽记：由姓名哈希决定形状，永远不会重样
  --------------------------------------------------------------- */
  function sigil(sd, accent) {
    var r = function (n) { return ((sd >> n) & 255) / 255; };
    var neck = 26 + r(2) * 12;
    var head = 15 + r(4) * 5;
    var tilt = (r(6) - .5) * 16;
    var hair = r(8) > .5;
    var ring = r(10) > .45;
    return [
      '<svg viewBox="0 0 100 100" class="sigil">',
      '<defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">',
      '<stop offset="0" stop-color="', accent, '" stop-opacity=".95"/>',
      '<stop offset="1" stop-color="', accent, '" stop-opacity=".28"/>',
      '</linearGradient></defs>',
      ring ? '<circle cx="50" cy="50" r="41" fill="none" stroke="url(#sg)" stroke-width="1" opacity=".55"/>' : '',
      '<g transform="rotate(', tilt.toFixed(1), ' 50 50)">',
      '<path d="M', (50 - neck / 2).toFixed(1), ' 88 Q50 ', (58 + r(12) * 6).toFixed(1), ' ', (50 + neck / 2).toFixed(1), ' 88 Z" fill="url(#sg)"/>',
      '<circle cx="50" cy="', (44 - head / 2).toFixed(1), '" r="', head.toFixed(1), '" fill="url(#sg)"/>',
      hair ? '<path d="M' + (50 - head - 2).toFixed(1) + ' ' + (44 - head / 2).toFixed(1) +
             ' Q50 ' + (44 - head * 2.1).toFixed(1) + ' ' + (50 + head + 2).toFixed(1) + ' ' + (44 - head / 2).toFixed(1) +
             ' L' + (50 + head + 4).toFixed(1) + ' ' + (60 + r(14) * 14).toFixed(1) +
             ' Q50 ' + (52).toFixed(1) + ' ' + (50 - head - 4).toFixed(1) + ' ' + (60 + r(16) * 14).toFixed(1) +
             ' Z" fill="' + accent + '" opacity=".5"/>' : '',
      '</g>',
      '<path d="M18 92 H82" stroke="', accent, '" stroke-width="1" opacity=".4"/>',
      '</svg>'
    ].join('');
  }

  /* ---------------------------------------------------------------
     母题层（纯 CSS / SVG 绘制，无一张图片）
  --------------------------------------------------------------- */
  function motifLayer(m, ac) {
    switch (m) {
      case 'moon':
        return '<div class="mo moon"><span class="m-disc"></span><span class="m-shadow"></span><span class="m-halo"></span></div>';
      case 'rain':
        return '<div class="mo rain">' + Array.from({ length: 26 }, function (_, i) {
          return '<i style="left:' + (i * 3.9 + (i % 3)) + '%;animation-delay:' + (-(i * 0.23) % 3).toFixed(2) +
                 's;animation-duration:' + (1.5 + (i % 5) * .3).toFixed(2) + 's;height:' + (14 + (i % 4) * 9) + 'px"></i>';
        }).join('') + '</div>';
      case 'petal':
        return '<div class="mo petal">' + Array.from({ length: 14 }, function (_, i) {
          return '<i style="left:' + (i * 7.3 % 96) + '%;animation-delay:' + (-(i * 1.1) % 9).toFixed(2) +
                 's;animation-duration:' + (7 + (i % 5) * 1.6).toFixed(2) + 's;--sp:' + (5 + i % 5) + 'px"></i>';
        }).join('') + '</div>';
      case 'smoke':
        return '<div class="mo smoke"><span></span><span></span><span></span></div>';
      case 'wave':
        return '<div class="mo wave"><span></span><span></span><span></span><span></span></div>';
      case 'star':
        return '<div class="mo star">' + Array.from({ length: 34 }, function (_, i) {
          return '<i style="left:' + ((i * 37) % 100) + '%;top:' + ((i * 53) % 88) + '%;animation-delay:' +
                 (-(i * .37) % 4).toFixed(2) + 's;--s:' + (1 + (i % 3) * .8) + 'px"></i>';
        }).join('') + '</div>';
      case 'flame':
        return '<div class="mo flame"><span class="f-core"></span><span class="f-glow"></span><span class="f-wick"></span></div>';
      case 'ink':
        return '<div class="mo ink"><span></span><span></span><span></span></div>';
      case 'frost':
        return '<svg class="mo frost" viewBox="0 0 200 300" preserveAspectRatio="none">' +
          Array.from({ length: 9 }, function (_, i) {
            var y = i * 34 + 8;
            return '<path d="M0 ' + y + ' Q50 ' + (y - 16) + ' 100 ' + y + ' T200 ' + y + '" fill="none" stroke="' + ac +
                   '" stroke-width=".7" opacity="' + (0.1 + (i % 3) * 0.06).toFixed(2) + '"/>';
          }).join('') + '</svg>';
      case 'thread':
        return '<svg class="mo thread" viewBox="0 0 200 300" preserveAspectRatio="none">' +
          Array.from({ length: 6 }, function (_, i) {
            return '<path d="M' + (i * 40 - 10) + ' -10 C' + (i * 40 + 60) + ' 90 ' + (i * 40 - 40) + ' 190 ' +
                   (i * 40 + 30) + ' 310" fill="none" stroke="' + ac + '" stroke-width=".8" opacity=".22"/>';
          }).join('') + '</svg>';
      case 'lattice':
        return '<div class="mo lattice"></div>';
      default:
        return '<div class="mo dust">' + Array.from({ length: 22 }, function (_, i) {
          return '<i style="left:' + ((i * 41) % 100) + '%;top:' + ((i * 67) % 100) + '%;animation-delay:' +
                 (-(i * .6) % 7).toFixed(2) + 's;--s:' + (1.5 + (i % 4)) + 'px"></i>';
        }).join('') + '</div>';
    }
  }

  /* ---------------------------------------------------------------
     生成整份 HTML 文档
  --------------------------------------------------------------- */
  function doc(card, opts) {
    opts = opts || {};
    var A = spec(card);
    var hasBg = !!card.cardBg, hasAv = !!card.avatar;
    var p0 = A.palette[0], p1 = A.palette[1], ac = A.accent;
    var traits = (card.traits || []).slice(0, 4);

    var bgLayer = hasBg
      ? '<div class="bg photo" style="background-image:url(' + card.cardBg + ')"></div>' +
        '<div class="bg tone"></div>'
      : '<div class="bg drawn"></div>' + motifLayer(A.motif, ac);

    var avLayer = hasAv
      ? '<span class="av-img" style="background-image:url(' + card.avatar + ')"></span>'
      : sigil(A.seed, ac);

    return [
'<!DOCTYPE html><html><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
'<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Mono:wght@400;700&family=Cormorant+Garamond:ital,wght@0,300;0,500;1,300&display=swap" rel="stylesheet">',
'<style>',
'*{margin:0;padding:0;box-sizing:border-box}',
'html,body{height:100%;overflow:hidden;background:transparent;-webkit-font-smoothing:antialiased}',
'body{font-family:"PingFang SC","Inter",sans-serif;color:#fff}',
'.card{position:absolute;inset:0;overflow:hidden;border-radius:26px 34px 26px 34px;',
'  transform-style:preserve-3d;transition:transform .5s cubic-bezier(.2,.9,.24,1)}',

/* --- 背景 --- */
'.bg{position:absolute;inset:0}',
'.bg.photo{background-size:cover;background-position:center;transform:scale(1.08);transition:transform .8s cubic-bezier(.2,.9,.24,1)}',
'.bg.tone{background:linear-gradient(180deg,rgba(8,8,12,.42) 0%,rgba(8,8,12,.06) 30%,rgba(8,8,12,.5) 66%,rgba(6,6,10,.92) 100%)}',
'.bg.drawn{background:',
'   radial-gradient(120% 70% at 22% 8%, ' + ac + '2e 0%, transparent 62%),',
'   radial-gradient(90% 60% at 84% 96%, ' + ac + '22 0%, transparent 60%),',
'   linear-gradient(158deg,' + p1 + ' 0%,' + p0 + ' 58%,#08080c 100%)}',

/* --- 母题 --- */
'.mo{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
'.moon .m-disc{position:absolute;right:16%;top:13%;width:86px;height:86px;border-radius:50%;',
'  background:radial-gradient(circle at 34% 30%,#fff,' + ac + ' 74%);opacity:.82;',
'  box-shadow:0 0 46px ' + ac + '7a}',
'.moon .m-shadow{position:absolute;right:11%;top:9%;width:86px;height:86px;border-radius:50%;',
'  background:linear-gradient(140deg,' + p0 + ',' + p1 + ');opacity:.94}',
'.moon .m-halo{position:absolute;right:8%;top:5.5%;width:126px;height:126px;border-radius:50%;',
'  border:1px solid ' + ac + '4d;animation:halo 7s ease-in-out infinite}',
'@keyframes halo{0%,100%{transform:scale(1);opacity:.5}50%{transform:scale(1.09);opacity:.16}}',
'.rain i{position:absolute;top:-10%;width:1px;background:linear-gradient(180deg,transparent,' + ac + 'aa);',
'  animation:fall linear infinite;opacity:.5}',
'@keyframes fall{to{transform:translateY(560px)}}',
'.petal i{position:absolute;top:-8%;width:var(--sp);height:calc(var(--sp)*.62);border-radius:60% 10% 60% 10%;',
'  background:' + ac + ';opacity:.42;animation:drift linear infinite}',
'@keyframes drift{0%{transform:translate(0,-20px) rotate(0)}',
'  50%{transform:translate(26px,240px) rotate(220deg)}100%{transform:translate(-10px,500px) rotate(420deg)}}',
'.smoke span{position:absolute;bottom:-30%;left:50%;width:190px;height:190px;border-radius:50%;',
'  background:radial-gradient(circle,' + ac + '3a,transparent 66%);filter:blur(14px);animation:rise 12s ease-in-out infinite}',
'.smoke span:nth-child(2){left:18%;animation-delay:-4s;transform:scale(.8)}',
'.smoke span:nth-child(3){left:78%;animation-delay:-8s;transform:scale(1.2)}',
'@keyframes rise{0%{transform:translate(-50%,40px) scale(.7);opacity:0}',
'  40%{opacity:.7}100%{transform:translate(-50%,-260px) scale(1.5);opacity:0}}',
'.wave span{position:absolute;left:50%;top:62%;width:60px;height:60px;margin:-30px 0 0 -30px;border-radius:50%;',
'  border:1px solid ' + ac + '73;animation:ripple 5.4s cubic-bezier(.2,.7,.3,1) infinite}',
'.wave span:nth-child(2){animation-delay:-1.35s}.wave span:nth-child(3){animation-delay:-2.7s}',
'.wave span:nth-child(4){animation-delay:-4.05s}',
'@keyframes ripple{0%{transform:scale(.3);opacity:.85}100%{transform:scale(5.6);opacity:0}}',
'.star i{position:absolute;width:var(--s);height:var(--s);border-radius:50%;background:#fff;',
'  animation:twk 4s ease-in-out infinite;opacity:.7}',
'@keyframes twk{0%,100%{opacity:.15;transform:scale(.6)}50%{opacity:.95;transform:scale(1.25)}}',
'.flame .f-core{position:absolute;left:50%;bottom:24%;width:22px;height:44px;margin-left:-11px;',
'  border-radius:50% 50% 46% 46%/62% 62% 38% 38%;',
'  background:linear-gradient(180deg,#fff,' + ac + ' 58%,transparent);filter:blur(.4px);',
'  animation:flick 2.1s ease-in-out infinite;transform-origin:50% 100%}',
'.flame .f-glow{position:absolute;left:50%;bottom:16%;width:170px;height:170px;margin-left:-85px;border-radius:50%;',
'  background:radial-gradient(circle,' + ac + '4d,transparent 62%);animation:flick 3.3s ease-in-out infinite}',
'.flame .f-wick{position:absolute;left:50%;bottom:18%;width:1.5px;height:26px;margin-left:-.75px;background:' + ac + '99}',
'@keyframes flick{0%,100%{transform:scaleY(1) skewX(0)}30%{transform:scaleY(1.12) skewX(4deg)}',
'  60%{transform:scaleY(.92) skewX(-5deg)}}',
'.ink span{position:absolute;border-radius:56% 44% 62% 38%/48% 62% 38% 52%;',
'  background:radial-gradient(circle at 40% 35%,' + ac + '5c,transparent 70%);filter:blur(6px);animation:bleed 14s ease-in-out infinite}',
'.ink span:nth-child(1){left:-12%;top:8%;width:180px;height:170px}',
'.ink span:nth-child(2){right:-14%;top:44%;width:210px;height:190px;animation-delay:-5s}',
'.ink span:nth-child(3){left:24%;bottom:-16%;width:200px;height:160px;animation-delay:-9s}',
'@keyframes bleed{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.18) rotate(14deg)}}',
'.frost,.thread{width:100%;height:100%}',
'.lattice{background-image:linear-gradient(' + ac + '2b 1px,transparent 1px),linear-gradient(90deg,' + ac + '2b 1px,transparent 1px);',
'  background-size:38px 38px;mask-image:radial-gradient(120% 90% at 50% 20%,#000,transparent 78%);',
'  -webkit-mask-image:radial-gradient(120% 90% at 50% 20%,#000,transparent 78%)}',
'.dust i{position:absolute;width:var(--s);height:var(--s);border-radius:50%;background:' + ac + ';opacity:.35;',
'  animation:float 9s ease-in-out infinite}',
'@keyframes float{0%,100%{transform:translate(0,0)}50%{transform:translate(14px,-26px)}}',

/* --- 纸纹 & 框 --- */
'.grain{position:absolute;inset:0;pointer-events:none;opacity:.16;mix-blend-mode:overlay;',
'  background-image:repeating-linear-gradient(112deg,rgba(255,255,255,.5) 0 1px,transparent 1px 4px)}',
'.frame{position:absolute;inset:11px;border-radius:18px 26px 18px 26px;border:1px solid rgba(255,255,255,.26);pointer-events:none}',
'.frame:before,.frame:after{content:"";position:absolute;width:20px;height:20px;border:1.4px solid rgba(255,255,255,.66)}',
'.frame:before{left:-1px;top:-1px;border-right:0;border-bottom:0;border-radius:8px 0 0 0}',
'.frame:after{right:-1px;bottom:-1px;border-left:0;border-top:0;border-radius:0 0 8px 0}',

/* --- 内容 --- */
'.inner{position:absolute;inset:0;padding:26px 24px;display:flex;flex-direction:column;justify-content:flex-end}',
'.top{position:absolute;left:24px;right:24px;top:24px;display:flex;align-items:flex-start;gap:12px}',
'.av{width:60px;height:60px;flex:0 0 60px;border-radius:20px 26px 20px 26px;overflow:hidden;position:relative;',
'  background:rgba(255,255,255,.1);backdrop-filter:blur(9px);box-shadow:0 0 0 1.4px rgba(255,255,255,.44),0 14px 30px -14px rgba(0,0,0,.7)}',
'.av-img{position:absolute;inset:0;background-size:cover;background-position:center}',
'.sigil{position:absolute;inset:0;width:100%;height:100%}',
'.top-meta{flex:1;padding-top:5px}',
'.tm-line{font-family:"Space Mono",monospace;font-size:7.5px;letter-spacing:2px;color:rgba(255,255,255,.62)}',
'.tm-tag{display:inline-block;margin-top:7px;padding:3px 8px;border-radius:7px 11px 7px 11px;',
'  border:1px solid rgba(255,255,255,.34);background:rgba(255,255,255,.11);backdrop-filter:blur(7px);',
'  font-size:9px;letter-spacing:1.4px}',
'.stamp{position:absolute;right:22px;top:22px;width:44px;height:44px;border-radius:50%;',
'  border:1.4px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;',
'  font-family:"Cormorant Garamond",serif;font-size:19px;color:#fff;background:rgba(12,12,18,.28);',
'  backdrop-filter:blur(7px);transform:rotate(-7deg)}',
'.name{font-family:"Cormorant Garamond","Songti SC",serif;font-size:34px;line-height:1.06;letter-spacing:4px;',
'  text-shadow:0 4px 22px rgba(0,0,0,.55)}',
'.enname{font-family:"Bebas Neue",sans-serif;font-size:11px;letter-spacing:5px;color:rgba(255,255,255,.6);margin-top:5px}',
'.rule{height:1px;margin:12px 0 11px;background:linear-gradient(90deg,rgba(255,255,255,.62),transparent)}',
'.tagline{font-size:12.5px;line-height:1.72;color:rgba(255,255,255,.9);min-height:22px;',
'  text-shadow:0 2px 12px rgba(0,0,0,.6)}',
'.tagline .cur{display:inline-block;width:1px;height:12px;background:#fff;vertical-align:-1px;animation:blink 1s steps(1) infinite}',
'@keyframes blink{0%,50%{opacity:1}51%,100%{opacity:0}}',
'.traits{display:flex;flex-wrap:wrap;gap:6px;margin-top:13px}',
'.traits i{font-style:normal;padding:4px 9px;border-radius:8px 12px 8px 12px;font-size:9.5px;letter-spacing:1.3px;',
'  border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.1);backdrop-filter:blur(7px);',
'  opacity:0;transform:translateY(8px);animation:pop .6s cubic-bezier(.2,1.4,.3,1) forwards}',
'@keyframes pop{to{opacity:1;transform:none}}',
'.foot{display:flex;align-items:center;gap:8px;margin-top:15px;',
'  font-family:"Space Mono",monospace;font-size:7px;letter-spacing:2px;color:rgba(255,255,255,.46)}',
'.foot b{flex:1;height:1px;background:rgba(255,255,255,.22)}',
'.sheen{position:absolute;inset:0;pointer-events:none;',
'  background:linear-gradient(112deg,transparent 34%,rgba(255,255,255,.16) 50%,transparent 64%);',
'  transform:translateX(-130%);animation:sheen 5.6s cubic-bezier(.2,.9,.24,1) infinite}',
'@keyframes sheen{0%{transform:translateX(-130%)}56%,100%{transform:translateX(130%)}}',
'.card.in{animation:cardIn .82s cubic-bezier(.2,1.05,.24,1) both}',
'@keyframes cardIn{from{opacity:0;transform:translateY(26px) scale(.94) rotateX(9deg)}to{opacity:1;transform:none}}',
'</style></head><body>',

'<div class="card in" id="card">',
  bgLayer,
  A.grain ? '<div class="grain"></div>' : '',
  '<div class="frame"></div>',
  '<div class="stamp">' + esc(A.glyph) + '</div>',
  '<div class="top">',
    '<div class="av">' + avLayer + '</div>',
    '<div class="top-meta">',
      '<div class="tm-line">' + esc([card.gender, card.age ? card.age : '', card.mbti].filter(Boolean).join(' · ')).toUpperCase() + '</div>',
      '<div class="tm-tag">' + esc(card.identity || card.genre || '来客') + '</div>',
    '</div>',
  '</div>',
  '<div class="inner">',
    '<div class="name">' + esc(card.name || '—') + '</div>',
    '<div class="enname">' + esc((card.enName || '').toUpperCase()) + '</div>',
    '<div class="rule"></div>',
    '<div class="tagline" id="tag"></div>',
    '<div class="traits">' + traits.map(function (t, i) {
      return '<i style="animation-delay:' + (0.5 + i * 0.09).toFixed(2) + 's">' + esc(t) + '</i>';
    }).join('') + '</div>',
    '<div class="foot"><span>' + esc((card.lang || '中文').toUpperCase()) + '</span><b></b>' +
      '<span>' + esc(String(card.era || card.genre || '').toUpperCase().slice(0, 22)) + '</span></div>',
  '</div>',
  '<div class="sheen"></div>',
'</div>',

'<script>(function(){',
'var card=document.getElementById("card");',
/* 签名逐字浮现 */
'var t=' + JSON.stringify(String(card.tagline || '')) + ',el=document.getElementById("tag"),i=0;',
'el.innerHTML=\'<span id="tt"></span><span class="cur"></span>\';',
'var tt=document.getElementById("tt");',
'setTimeout(function step(){if(i<=t.length){tt.textContent=t.slice(0,i++);setTimeout(step,' + (opts.fast ? 14 : 34) + ');}',
'else{var c=el.querySelector(".cur");if(c)c.style.display="none";}},520);',
/* 父页面把指针位置喂进来，做视差 —— iframe 自身 pointer-events 关闭 */
'window.addEventListener("message",function(e){var d=e.data||{};',
'if(d.jc==="tilt"){card.style.transform="perspective(900px) rotateY("+(d.x*7).toFixed(2)+"deg) rotateX("+(-d.y*7).toFixed(2)+"deg) translateZ(0)";',
'var ph=document.querySelector(".bg.photo");if(ph)ph.style.transform="scale(1.1) translate("+(d.x*-9).toFixed(1)+"px,"+(d.y*-9).toFixed(1)+"px)";}',
'if(d.jc==="reset"){card.style.transform="";var p=document.querySelector(".bg.photo");if(p)p.style.transform="scale(1.08)";}',
'});',
'})();<\/script>',
'</body></html>'
    ].join('');
  }

  /** 把卡挂到容器里；返回 iframe */
  function mount(host, card, opts) {
    var f = document.createElement('iframe');
    f.className = 'cardart';
    f.setAttribute('scrolling', 'no');
    f.setAttribute('sandbox', 'allow-scripts');
    f.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;pointer-events:none;border-radius:inherit';
    f.srcdoc = doc(card, opts);
    host.appendChild(f);
    return f;
  }

  /** 供模型填写的 art 字段说明，拼进 prompt */
  var ART_SCHEMA = [
    '  "art": {',
    '    "palette": ["#最深色", "#中间色", "#点缀色"],   // 三个十六进制色，须与人物气质相符，整体偏暗以便压住白字',
    '    "accent": "#点缀色",',
    '    "motif": "从这里选一个：moon/rain/petal/smoke/wave/star/flame/ink/frost/thread/lattice/dust",',
    '    "layout": "stack/split/band/corner 任选其一",',
    '    "glyph": "一个能代表此人的汉字或拉丁字母，只要一个字"',
    '  }'
  ].join('\n');

  var ART_RULE =
    '每位角色都要给出 art 配色与母题，且三位之间必须显著不同：' +
    '配色不可雷同（冷／暖／中性各有分布），motif 不可重复。' +
    '母题要贴合人物：清冷选 moon/frost/star，缠绵选 petal/ink，压抑选 smoke/rain，' +
    '炽烈选 flame/wave，理性选 lattice/thread。';

  global.JC = global.JC || {};
  global.JC.CardArt = {
    MOTIFS: MOTIFS, PALETTES: PALETTES,
    spec: spec, doc: doc, mount: mount, sigil: sigil,
    ART_SCHEMA: ART_SCHEMA, ART_RULE: ART_RULE
  };
})(window);
