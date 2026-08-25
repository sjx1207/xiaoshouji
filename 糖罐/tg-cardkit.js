/* ================================================================
   糖罐 TANGGUAN — tg-cardkit.js  v2
   帖子长图渲染引擎（纯 Canvas，零依赖、零外链、零 emoji）

   v2 变化
   1. 体裁扩到 14 种（新增 书信体 / 朋友圈 / 访谈体 / 报道体 / 弹幕体）
   2. 「捡手机」整体重做：整页仿真手机界面，微信 / LINE / iMessage / QQ
      四套皮肤各自独立的顶栏、气泡几何、尾巴形状、时间戳、已读标记，
      并支持 语音 / 图片 / 引用 / 撤回 / 转账 / 红包 / 通话 / 位置 / 文件
      / 表情 九种消息形态。
   3. 装箱器保持「任何原子块都不会被裁成一半」的硬保证。
================================================================ */

const TGCard = (function () {

  /* ---------------- 基础常量 ---------------- */
  const W = 480;
  const PAD = 34;
  const BW = W - PAD * 2;
  const SCALE = 2;
  const MAXPAGE = 9;
  const HEAD_H = 74;
  const FOOT_H = 62;

  const C = {
    ink: '#17171b', ink2: '#31313a', ink3: '#4e4e58',
    mist: '#787883', mist2: '#a2a2ac', mist3: '#c3c3cb',
    line: 'rgba(20,20,26,0.10)', line2: 'rgba(20,20,26,0.18)',
    soft: '#f1f1f4', soft2: '#e7e7eb', snow: '#ffffff', paper: '#fcfcfd'
  };
  const F = {
    serif: (w, s) => `${w} ${s}px "Songti SC","Noto Serif SC","Source Han Serif SC","Times New Roman",serif`,
    sans: (w, s) => `${w} ${s}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",system-ui,sans-serif`,
    mono: (w, s) => `${w} ${s}px "SF Mono","Menlo","Consolas",monospace`
  };

  /* ---------------- 文本测量与折行 ---------------- */
  let _m = null;
  function mctx() { if (!_m) _m = document.createElement('canvas').getContext('2d'); return _m; }
  function tw(text, font) { const c = mctx(); c.font = font; return c.measureText(String(text == null ? '' : text)).width; }

  function wrap(text, font, maxW) {
    const c = mctx(); c.font = font;
    const out = [];
    const isLat = ch => /[A-Za-z0-9@#$%&/._'"+\-=:;()\[\]]/.test(ch);
    String(text == null ? '' : text).replace(/\r/g, '').split('\n').forEach(par => {
      if (par === '') { out.push(''); return; }
      let line = '', i = 0;
      while (i < par.length) {
        let tok = '';
        if (isLat(par[i])) { while (i < par.length && isLat(par[i])) tok += par[i++]; }
        else tok = par[i++];
        if (c.measureText(tok).width > maxW) {
          for (const ch of tok) {
            if (c.measureText(line + ch).width > maxW && line) { out.push(line); line = ''; }
            line += ch;
          }
          continue;
        }
        if (c.measureText(line + tok).width > maxW && line.trim()) {
          out.push(line); line = tok.replace(/^\s+/, '');
        } else line += tok;
      }
      out.push(line);
    });
    return out;
  }

  /* ---------------- 绘图原语 ---------------- */
  function rr(ctx, x, y, w, h, r) {
    const k = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + h, k);
    ctx.arcTo(x + w, y + h, x, y + h, k);
    ctx.arcTo(x, y + h, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  }
  function rr4(ctx, x, y, w, h, tl, tr, br, bl) {
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br); ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl); ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }
  function hash(s) { let h = 0; for (const ch of String(s || 'x')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

  function avatarShape(ctx, x, y, d, name, shape) {
    const h = hash(name) % 100;
    const g = ctx.createLinearGradient(x, y, x + d, y + d);
    const a = 32 + (h % 26), b = 96 + (h % 60);
    g.addColorStop(0, `rgb(${a + 26},${a + 26},${a + 32})`);
    g.addColorStop(1, `rgb(${b},${b},${b + 8})`);
    ctx.save();
    if (shape === 'square') rr(ctx, x, y, d, d, d * 0.22);
    else { ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, 7); ctx.closePath(); }
    ctx.fillStyle = g; ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath(); ctx.arc(x + d * 0.28, y + d * 0.22, d * 0.42, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = F.serif(600, d * 0.42);
    ctx.textAlign = 'center';
    ctx.fillText(String(name || '·').slice(0, 1), x + d / 2, y + d * 0.63);
    ctx.textAlign = 'left';
  }
  const avatar = (ctx, x, y, d, name) => avatarShape(ctx, x, y, d, name, 'circle');

  function hair(ctx, x, y, w, col) { ctx.fillStyle = col || C.line; ctx.fillRect(x, y, w, 1); }

  /* 小图标：全部手绘路径，零 emoji */
  function icoBack(ctx, x, y, s, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.13; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(x + s * 0.62, y + s * 0.16); ctx.lineTo(x + s * 0.3, y + s * 0.5); ctx.lineTo(x + s * 0.62, y + s * 0.84); ctx.stroke(); ctx.restore();
  }
  function icoDots(ctx, x, y, s, col) {
    ctx.fillStyle = col;
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + s * (0.2 + i * 0.3), y + s * 0.5, s * 0.075, 0, 7); ctx.fill(); }
  }
  function icoChevron(ctx, x, y, s, col) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x + s * 0.34, y + s * 0.32); ctx.lineTo(x + s * 0.66, y + s * 0.5); ctx.lineTo(x + s * 0.34, y + s * 0.68); ctx.stroke(); ctx.restore();
  }
  function icoWave(ctx, x, y, h, col, n, flip) {
    ctx.save(); ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const hh = h * (0.35 + Math.abs(Math.sin(i * 1.7)) * 0.65);
      const xx = flip ? x - i * 3.4 : x + i * 3.4;
      ctx.fillRect(xx, y - hh / 2, 1.8, hh);
    }
    ctx.restore();
  }

  function chip(ctx, x, y, txt, dark) {
    const f = F.mono(400, 9.5);
    const w = tw(txt, f) + 18;
    rr(ctx, x, y, w, 19, 9.5);
    ctx.fillStyle = dark ? C.ink : C.soft; ctx.fill();
    ctx.font = f; ctx.fillStyle = dark ? '#fff' : C.mist;
    ctx.fillText(txt, x + 9, y + 13.2);
    return w;
  }

  /* ---------------- 块工厂 ---------------- */
  const mk = (h, d, brk) => ({ h, d, brk: !!brk });
  const gap = h => mk(h, () => { });
  const BRK = () => ({ h: 0, d: () => { }, brk: true });

  function para(bs, text, o) {
    o = o || {};
    const font = o.font || F.sans(400, 15.5);
    const lh = o.lh || 27.5;
    const col = o.color || C.ink2;
    const wid = o.w || BW;
    const dx = o.dx || 0;
    wrap(text, font, wid).forEach(ln => bs.push(mk(lh, (ctx, x, y) => {
      if (!ln) return;
      ctx.font = font; ctx.fillStyle = col; ctx.textAlign = o.align || 'left';
      const tx = o.align === 'center' ? x + dx + wid / 2 : (o.align === 'right' ? x + dx + wid : x + dx + (o.indent || 0));
      ctx.fillText(ln, tx, y + lh * 0.74);
      ctx.textAlign = 'left';
    })));
  }
  function heading(bs, text, o) {
    o = o || {};
    bs.push(gap(o.mt == null ? 16 : o.mt));
    const font = o.font || F.serif(600, 20);
    const lh = o.lh || 30;
    wrap(text, font, BW).forEach(ln => bs.push(mk(lh, (ctx, x, y) => {
      ctx.font = font; ctx.fillStyle = o.color || C.ink;
      ctx.fillText(ln, x, y + lh * 0.76);
    })));
    if (o.rule !== false) bs.push(mk(14, (ctx, x, y) => { ctx.fillStyle = C.ink; ctx.fillRect(x, y + 7, 26, 1.6); }));
    else bs.push(gap(6));
  }
  function bigTitle(bs, text, size) {
    const s = size || 26;
    wrap(text, F.serif(600, s), BW).forEach(ln =>
      bs.push(mk(s * 1.42, (ctx, x, y) => { ctx.font = F.serif(600, s); ctx.fillStyle = C.ink; ctx.fillText(ln, x, y + s * 1.08); })));
  }

  /* ================================================================
     捡手机：四套皮肤
  ================================================================ */
  const CHAT_W = W;              // 整页满幅
  const CIN = 15;                // 内边距
  const CBW = CHAT_W - CIN * 2;  // 可用宽

  const SKIN = {
    wechat: {
      label: 'WeChat', bg: '#ebebeb', bar: '#f4f4f6', barLine: 'rgba(0,0,0,0.10)',
      avatar: 'square', avD: 34, gapAv: 10, rad: 6, tail: 'triangle',
      themBg: '#ffffff', themInk: '#1c1c20', meBg: '#2e2e37', meInk: '#ffffff',
      showName: false, timeStyle: 'pill', font: 15.2, lh: 24, maxW: 0.68,
      headerH: 92, footerH: 76, read: false
    },
    qq: {
      label: 'QQ', bg: '#f1f1f4', bar: '#fbfbfc', barLine: 'rgba(0,0,0,0.08)',
      avatar: 'square', avD: 36, gapAv: 10, rad: 9, tail: 'triangle',
      themBg: '#ffffff', themInk: '#1c1c20', meBg: '#33333d', meInk: '#ffffff',
      showName: false, timeStyle: 'plain', font: 15, lh: 24, maxW: 0.66,
      headerH: 94, footerH: 74, read: false
    },
    line: {
      label: 'LINE', bg: '#f2f2f4', bar: '#ffffff', barLine: 'rgba(0,0,0,0.07)',
      avatar: 'circle', avD: 34, gapAv: 9, rad: 17, tail: 'curve',
      themBg: '#ffffff', themInk: '#1c1c20', meBg: '#2b2b33', meInk: '#ffffff',
      showName: true, timeStyle: 'side', font: 14.6, lh: 23, maxW: 0.62,
      headerH: 90, footerH: 76, read: '既読'
    },
    imessage: {
      label: 'iMessage', bg: '#ffffff', bar: 'rgba(250,250,251,0.94)', barLine: 'rgba(0,0,0,0.08)',
      avatar: 'none', avD: 0, gapAv: 0, rad: 18, tail: 'curve',
      themBg: '#e9e9ec', themInk: '#101014', meBg: '#2a2a33', meInk: '#ffffff',
      showName: false, timeStyle: 'stamp', font: 15.4, lh: 24, maxW: 0.72,
      headerH: 108, footerH: 78, read: '已读'
    }
  };
  function skinOf(k) { return SKIN[k] || SKIN.wechat; }

  /* 气泡尾巴 */
  function drawTail(ctx, sk, me, bx, by, bw, bh, col) {
    ctx.fillStyle = col;
    if (sk.tail === 'triangle') {
      ctx.beginPath();
      if (me) { ctx.moveTo(bx + bw, by + 13); ctx.lineTo(bx + bw + 6, by + 17); ctx.lineTo(bx + bw, by + 22); }
      else { ctx.moveTo(bx, by + 13); ctx.lineTo(bx - 6, by + 17); ctx.lineTo(bx, by + 22); }
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      if (me) {
        ctx.moveTo(bx + bw - 8, by + bh);
        ctx.quadraticCurveTo(bx + bw + 5, by + bh, bx + bw + 7, by + bh - 9);
        ctx.quadraticCurveTo(bx + bw + 2, by + bh - 1, bx + bw - 8, by + bh);
      } else {
        ctx.moveTo(bx + 8, by + bh);
        ctx.quadraticCurveTo(bx - 5, by + bh, bx - 7, by + bh - 9);
        ctx.quadraticCurveTo(bx - 2, by + bh - 1, bx + 8, by + bh);
      }
      ctx.closePath(); ctx.fill();
    }
  }

  /* 普通文字气泡（含引用） */
  function msgText(m, sk, names, isLastMe) {
    const me = m.s === 'b';
    const font = F.sans(400, sk.font);
    const qFont = F.sans(400, sk.font - 2.4);
    const maxW = CBW * sk.maxW;
    const padX = 14, padY = 10;
    const lines = wrap(m.v || '', font, maxW - padX * 2);
    const qLines = m.k === 'quote' ? wrap(m.q || '', qFont, maxW - padX * 2 - 10) : [];
    let wmax = 0;
    lines.forEach(l => wmax = Math.max(wmax, tw(l, font)));
    qLines.forEach(l => wmax = Math.max(wmax, tw(l, qFont) + 10));
    const bw = Math.max(46, Math.min(maxW, wmax + padX * 2));
    const qh = qLines.length ? qLines.length * (sk.lh - 4) + 12 : 0;
    const bh = lines.length * sk.lh + padY * 2 + qh;
    const nameH = (!me && sk.showName) ? 17 : 0;
    const readH = (me && sk.read && isLastMe) ? 0 : 0;
    const h = bh + nameH + 12 + readH;

    return mk(h, (ctx, x0, y) => {
      const L = x0 - PAD;               // 屏幕左边
      const avD = sk.avatar === 'none' ? 0 : sk.avD;
      const avGap = avD ? sk.gapAv : 0;
      const bx = me ? (L + CHAT_W - CIN - avD - avGap - bw) : (L + CIN + avD + avGap);
      const by = y + nameH;
      if (avD) avatarShape(ctx, me ? L + CHAT_W - CIN - avD : L + CIN, by, avD, me ? names.b : names.a, sk.avatar);
      if (nameH) {
        ctx.font = F.sans(400, 10.5); ctx.fillStyle = C.mist2;
        ctx.fillText(names.a, bx, y + 11);
      }
      const col = me ? sk.meBg : sk.themBg;
      drawTail(ctx, sk, me, bx, by, bw, bh, col);
      rr(ctx, bx, by, bw, bh, sk.rad);
      ctx.fillStyle = col; ctx.fill();
      if (!me && sk.themBg === '#ffffff') { ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.lineWidth = 1; ctx.stroke(); }
      let ty = by + padY;
      if (qLines.length) {
        ctx.fillStyle = me ? 'rgba(255,255,255,0.28)' : 'rgba(20,20,26,0.14)';
        ctx.fillRect(bx + padX, ty + 2, 2, qh - 10);
        ctx.font = qFont; ctx.fillStyle = me ? 'rgba(255,255,255,0.62)' : C.mist;
        qLines.forEach((ln, i) => ctx.fillText(ln, bx + padX + 10, ty + 13 + i * (sk.lh - 4)));
        ty += qh;
      }
      ctx.font = font; ctx.fillStyle = me ? sk.meInk : sk.themInk;
      lines.forEach((ln, i) => ctx.fillText(ln, bx + padX, ty + sk.lh * 0.72 + i * sk.lh));

      // LINE 式：时间与已读贴在气泡外侧
      if (sk.timeStyle === 'side' && m.hm) {
        ctx.font = F.sans(400, 9.5); ctx.fillStyle = C.mist2;
        if (me) {
          ctx.textAlign = 'right';
          if (sk.read && m.read) ctx.fillText(sk.read, bx - 6, by + bh - 22);
          ctx.fillText(m.hm, bx - 6, by + bh - 8);
          ctx.textAlign = 'left';
        } else ctx.fillText(m.hm, bx + bw + 6, by + bh - 8);
      }
    });
  }

  /* 特殊消息：语音 / 图片 / 转账 / 红包 / 通话 / 位置 / 文件 / 表情 */
  function msgSpecial(m, sk, names) {
    const me = m.s === 'b';
    const k = m.k;
    const avD = sk.avatar === 'none' ? 0 : sk.avD;
    const avGap = avD ? sk.gapAv : 0;

    if (k === 'voice') {
      const secs = m.d || 6;
      const bw = Math.min(CBW * 0.6, 78 + secs * 3.4);
      const bh = 42;
      const capLines = m.v ? wrap('「' + m.v + '」', F.sans(400, 11.5), CBW * sk.maxW) : [];
      const h = bh + 12 + (capLines.length ? capLines.length * 18 + 4 : 0);
      return mk(h, (ctx, x0, y) => {
        const L = x0 - PAD;
        const bx = me ? (L + CHAT_W - CIN - avD - avGap - bw) : (L + CIN + avD + avGap);
        if (avD) avatarShape(ctx, me ? L + CHAT_W - CIN - avD : L + CIN, y, avD, me ? names.b : names.a, sk.avatar);
        const col = me ? sk.meBg : sk.themBg;
        drawTail(ctx, sk, me, bx, y, bw, bh, col);
        rr(ctx, bx, y, bw, bh, sk.rad); ctx.fillStyle = col; ctx.fill();
        if (!me && sk.themBg === '#ffffff') { ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.stroke(); }
        const ink = me ? sk.meInk : sk.themInk;
        icoWave(ctx, me ? bx + bw - 22 : bx + 16, y + bh / 2, 15, ink, 9, me);
        ctx.font = F.mono(400, 11); ctx.fillStyle = ink;
        ctx.textAlign = me ? 'left' : 'right';
        ctx.fillText(secs + '"', me ? bx + 16 : bx + bw - 16, y + bh / 2 + 4);
        ctx.textAlign = 'left';
        if (capLines.length) {
          ctx.font = F.sans(400, 11.5); ctx.fillStyle = C.mist;
          ctx.textAlign = me ? 'right' : 'left';
          capLines.forEach((ln, i) => ctx.fillText(ln, me ? bx + bw : bx, y + bh + 16 + i * 18));
          ctx.textAlign = 'left';
        }
      });
    }

    if (k === 'img') {
      const bw = Math.min(CBW * 0.56, 210), bh = 148;
      return mk(bh + 12, (ctx, x0, y) => {
        const L = x0 - PAD;
        const bx = me ? (L + CHAT_W - CIN - avD - avGap - bw) : (L + CIN + avD + avGap);
        if (avD) avatarShape(ctx, me ? L + CHAT_W - CIN - avD : L + CIN, y, avD, me ? names.b : names.a, sk.avatar);
        ctx.save();
        rr(ctx, bx, y, bw, bh, 10); ctx.clip();
        const g = ctx.createLinearGradient(bx, y, bx + bw, y + bh);
        g.addColorStop(0, '#dcdce1'); g.addColorStop(1, '#c2c2c9');
        ctx.fillStyle = g; ctx.fillRect(bx, y, bw, bh);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
        for (let i = -bh; i < bw; i += 14) { ctx.beginPath(); ctx.moveTo(bx + i, y + bh); ctx.lineTo(bx + i + bh, y); ctx.stroke(); }
        ctx.restore();
        ctx.strokeStyle = 'rgba(0,0,0,0.07)'; rr(ctx, bx, y, bw, bh, 10); ctx.stroke();
        const ls = wrap(m.v || '一张图', F.sans(400, 11.5), bw - 28).slice(0, 4);
        ctx.fillStyle = 'rgba(20,20,26,0.55)';
        rr(ctx, bx + 10, y + bh - 16 - ls.length * 16, bw - 20, ls.length * 16 + 8, 6); ctx.fill();
        ctx.font = F.sans(400, 11.5); ctx.fillStyle = '#fff';
        ls.forEach((ln, i) => ctx.fillText(ln, bx + 17, y + bh - 18 - (ls.length - 1 - i) * 16 + 4));
      });
    }

    if (k === 'transfer' || k === 'redpack') {
      const bw = Math.min(CBW * 0.62, 208), bh = 62;
      return mk(bh + 12, (ctx, x0, y) => {
        const L = x0 - PAD;
        const bx = me ? (L + CHAT_W - CIN - avD - avGap - bw) : (L + CIN + avD + avGap);
        if (avD) avatarShape(ctx, me ? L + CHAT_W - CIN - avD : L + CIN, y, avD, me ? names.b : names.a, sk.avatar);
        const g = ctx.createLinearGradient(bx, y, bx + bw, y + bh);
        g.addColorStop(0, '#3a3a44'); g.addColorStop(1, '#1e1e26');
        rr(ctx, bx, y, bw, bh, 9); ctx.fillStyle = g; ctx.fill();
        ctx.save(); rr(ctx, bx, y, bw, bh, 9); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath(); ctx.arc(bx + bw - 12, y + 8, 34, 0, 7); ctx.fill();
        ctx.restore();
        // 左侧标记
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        if (k === 'redpack') { rr(ctx, bx + 14, y + 17, 26, 28, 4); ctx.fill(); ctx.fillStyle = '#2a2a33'; rr(ctx, bx + 14, y + 27, 26, 8, 2); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(bx + 27, y + 31, 13, 0, 7); ctx.fill(); ctx.fillStyle = '#2a2a33'; ctx.font = F.serif(600, 14); ctx.textAlign = 'center'; ctx.fillText('¥', bx + 27, y + 36); ctx.textAlign = 'left'; }
        ctx.font = F.sans(500, 13); ctx.fillStyle = '#fff';
        ctx.fillText(String(m.v || (k === 'redpack' ? '恭喜发财' : '转账')).slice(0, 12), bx + 50, y + 27);
        ctx.font = F.mono(400, 11); ctx.fillStyle = 'rgba(255,255,255,0.62)';
        ctx.fillText(k === 'redpack' ? '微信红包' : '¥ ' + (m.amt || '0.00'), bx + 50, y + 45);
      });
    }

    if (k === 'call') {
      const txt = m.v || '通话时长 00:42';
      const f = F.sans(400, 13);
      const bw = Math.min(CBW * 0.6, tw(txt, f) + 62), bh = 40;
      return mk(bh + 12, (ctx, x0, y) => {
        const L = x0 - PAD;
        const bx = me ? (L + CHAT_W - CIN - avD - avGap - bw) : (L + CIN + avD + avGap);
        if (avD) avatarShape(ctx, me ? L + CHAT_W - CIN - avD : L + CIN, y, avD, me ? names.b : names.a, sk.avatar);
        const col = me ? sk.meBg : sk.themBg;
        rr(ctx, bx, y, bw, bh, sk.rad); ctx.fillStyle = col; ctx.fill();
        if (!me && sk.themBg === '#ffffff') { ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.stroke(); }
        const ink = me ? sk.meInk : sk.themInk;
        ctx.save(); ctx.strokeStyle = ink; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx + 18, y + 15); ctx.lineTo(bx + 24, y + 21); ctx.lineTo(bx + 21, y + 25);
        ctx.quadraticCurveTo(bx + 24, y + 30, bx + 29, y + 32); ctx.lineTo(bx + 33, y + 29); ctx.lineTo(bx + 38, y + 34); ctx.stroke(); ctx.restore();
        ctx.font = f; ctx.fillStyle = ink;
        ctx.fillText(txt, bx + 48, y + bh / 2 + 4.5);
      });
    }

    if (k === 'loc' || k === 'file') {
      const bw = Math.min(CBW * 0.6, 200), bh = k === 'loc' ? 96 : 58;
      return mk(bh + 12, (ctx, x0, y) => {
        const L = x0 - PAD;
        const bx = me ? (L + CHAT_W - CIN - avD - avGap - bw) : (L + CIN + avD + avGap);
        if (avD) avatarShape(ctx, me ? L + CHAT_W - CIN - avD : L + CIN, y, avD, me ? names.b : names.a, sk.avatar);
        rr(ctx, bx, y, bw, bh, 9); ctx.fillStyle = '#ffffff'; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.stroke();
        if (k === 'loc') {
          ctx.save(); rr(ctx, bx, y + 34, bw, bh - 34, 9); ctx.clip();
          ctx.fillStyle = '#e6e6ea'; ctx.fillRect(bx, y + 34, bw, bh - 34);
          ctx.strokeStyle = 'rgba(0,0,0,0.07)';
          for (let i = 0; i < 7; i++) { ctx.beginPath(); ctx.moveTo(bx + i * 30, y + 34); ctx.lineTo(bx + i * 30 - 20, y + bh); ctx.stroke(); }
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(bx, y + 44 + i * 18); ctx.lineTo(bx + bw, y + 40 + i * 18); ctx.stroke(); }
          ctx.fillStyle = '#2a2a33';
          ctx.beginPath(); ctx.arc(bx + bw / 2, y + 62, 5, 0, 7); ctx.fill();
          ctx.restore();
          ctx.font = F.sans(500, 12.5); ctx.fillStyle = C.ink;
          ctx.fillText(String(m.v || '某处').slice(0, 14), bx + 12, y + 22);
        } else {
          ctx.fillStyle = '#e4e4e9'; rr(ctx, bx + 12, y + 13, 26, 32, 4); ctx.fill();
          ctx.fillStyle = '#c4c4cc'; ctx.beginPath(); ctx.moveTo(bx + 30, y + 13); ctx.lineTo(bx + 38, y + 21); ctx.lineTo(bx + 30, y + 21); ctx.closePath(); ctx.fill();
          ctx.font = F.sans(500, 12.5); ctx.fillStyle = C.ink;
          ctx.fillText(String(m.v || '文件').slice(0, 16), bx + 48, y + 26);
          ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
          ctx.fillText((hash(m.v) % 900 + 60) + ' KB', bx + 48, y + 42);
        }
      });
    }

    // sticker：用文字描述的表情
    const f = F.serif(400, 13);
    const ls = wrap('［' + (m.v || '表情') + '］', f, CBW * 0.5);
    const bh = ls.length * 20 + 40;
    return mk(bh + 12, (ctx, x0, y) => {
      const L = x0 - PAD;
      const bw = 108;
      const bx = me ? (L + CHAT_W - CIN - avD - avGap - bw) : (L + CIN + avD + avGap);
      if (avD) avatarShape(ctx, me ? L + CHAT_W - CIN - avD : L + CIN, y, avD, me ? names.b : names.a, sk.avatar);
      rr(ctx, bx, y, bw, bh, 12); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(20,20,26,0.18)'; ctx.stroke(); ctx.setLineDash([]);
      ctx.font = f; ctx.fillStyle = C.mist; ctx.textAlign = 'center';
      ls.forEach((ln, i) => ctx.fillText(ln, bx + bw / 2, y + 26 + i * 20));
      ctx.textAlign = 'left';
    });
  }

  /* 时间戳 / 系统提示 / 撤回 */
  function msgCenter(text, sk, kind) {
    const f = kind === 'stamp' ? F.sans(600, 11.5) : F.sans(400, 11);
    return mk(kind === 'stamp' ? 40 : 36, (ctx, x0, y) => {
      const L = x0 - PAD;
      const w = tw(text, f) + 22;
      const cx = L + CHAT_W / 2;
      if (sk.timeStyle === 'pill' && kind !== 'sys') {
        rr(ctx, cx - w / 2, y + 6, w, 21, 4);
        ctx.fillStyle = 'rgba(20,20,26,0.075)'; ctx.fill();
        ctx.font = f; ctx.fillStyle = C.mist;
        ctx.textAlign = 'center'; ctx.fillText(text, cx, y + 21); ctx.textAlign = 'left';
      } else {
        ctx.font = f; ctx.fillStyle = kind === 'sys' ? C.mist2 : C.mist;
        ctx.textAlign = 'center'; ctx.fillText(text, cx, y + 20); ctx.textAlign = 'left';
      }
    });
  }
  function msgRevoke(m, sk, names) {
    const who = m.s === 'b' ? names.b : names.a;
    const text = `${who} 撤回了一条消息`;
    return mk(34, (ctx, x0, y) => {
      const L = x0 - PAD;
      ctx.font = F.sans(400, 11); ctx.fillStyle = C.mist2;
      ctx.textAlign = 'center'; ctx.fillText(text, L + CHAT_W / 2, y + 19); ctx.textAlign = 'left';
    });
  }

  /* 顶栏 / 输入栏 */
  function drawChatChrome(ctx, H, sk, info) {
    // 背景
    ctx.fillStyle = sk.bg; ctx.fillRect(0, 0, W, H);
    if (sk.k === 'imessage') {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#fafafb');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // 顶栏（含状态栏）
    const hb = sk.headerH;
    ctx.fillStyle = sk.bar; ctx.fillRect(0, 0, W, hb);
    ctx.lineWidth = 1;
    ctx.font = F.sans(600, 12.5); ctx.fillStyle = 'rgba(20,20,26,0.82)';
    ctx.fillText(info.clock || '23:47', 22, 26);
    ctx.fillStyle = 'rgba(20,20,26,0.7)';
    for (let i = 0; i < 4; i++) ctx.fillRect(W - 74 + i * 4, 22 - i * 2.6, 2.6, 4 + i * 2.6);
    ctx.strokeStyle = 'rgba(20,20,26,0.42)'; rr(ctx, W - 48, 15, 22, 11, 3); ctx.stroke();
    ctx.fillStyle = 'rgba(20,20,26,0.72)'; ctx.fillRect(W - 46, 17, 14, 7); ctx.fillRect(W - 25, 18.5, 2, 4);
    hair(ctx, 0, hb - 1, W, sk.barLine);

    icoBack(ctx, 14, hb - 42, 22, 'rgba(20,20,26,0.78)');

    if (sk.k === 'imessage') {
      avatarShape(ctx, W / 2 - 17, 40, 34, info.title, 'circle');
      ctx.font = F.sans(500, 12.5); ctx.fillStyle = 'rgba(20,20,26,0.86)';
      ctx.textAlign = 'center'; ctx.fillText(info.title, W / 2, 90); ctx.textAlign = 'left';
      icoChevron(ctx, W / 2 + tw(info.title, F.sans(500, 12.5)) / 2 + 3, 80, 12, 'rgba(20,20,26,0.4)');
    } else {
      ctx.font = F.sans(600, 15.5); ctx.fillStyle = 'rgba(20,20,26,0.9)';
      ctx.textAlign = 'center';
      ctx.fillText(info.title, W / 2, hb - 32);
      if (info.sub) { ctx.font = F.sans(400, 10.5); ctx.fillStyle = C.mist2; ctx.fillText(info.sub, W / 2, hb - 17); }
      ctx.textAlign = 'left';
      icoDots(ctx, W - 38, hb - 42, 22, 'rgba(20,20,26,0.72)');
    }

    // 输入栏
    const fb = sk.footerH;
    ctx.fillStyle = sk.bar; ctx.fillRect(0, H - fb, W, fb);
    hair(ctx, 0, H - fb, W, sk.barLine);
    const iy = H - fb + 14, ih = 34;
    if (sk.k === 'wechat' || sk.k === 'qq') {
      ctx.strokeStyle = 'rgba(20,20,26,0.2)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(28, iy + ih / 2, 11, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(28, iy + ih / 2 - 5); ctx.lineTo(28, iy + ih / 2 + 4); ctx.stroke();
      rr(ctx, 48, iy, W - 48 - 92, ih, 5); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.05)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(W - 74, iy + ih / 2, 11, 0, 7); ctx.strokeStyle = 'rgba(20,20,26,0.2)'; ctx.stroke();
      ctx.beginPath(); ctx.arc(W - 30, iy + ih / 2, 11, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(20,20,26,0.2)';
      ctx.fillRect(W - 35, iy + ih / 2 - 1, 10, 2); ctx.fillRect(W - 31, iy + ih / 2 - 5, 2, 10);
    } else if (sk.k === 'line') {
      ctx.strokeStyle = 'rgba(20,20,26,0.2)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(26, iy + ih / 2, 10, 0, 7); ctx.stroke();
      rr(ctx, 46, iy, W - 46 - 60, ih, 17); ctx.fillStyle = '#f3f3f5'; ctx.fill();
      ctx.font = F.sans(400, 13); ctx.fillStyle = C.mist3; ctx.fillText('Aa', 60, iy + 22);
      ctx.beginPath(); ctx.arc(W - 30, iy + ih / 2, 12, 0, 7); ctx.fillStyle = '#2b2b33'; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath();
      ctx.moveTo(W - 35, iy + ih / 2 - 5); ctx.lineTo(W - 24, iy + ih / 2); ctx.lineTo(W - 35, iy + ih / 2 + 5); ctx.closePath(); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(20,20,26,0.18)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.arc(26, iy + ih / 2, 11, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(20,20,26,0.35)';
      ctx.fillRect(21, iy + ih / 2 - 1, 10, 2); ctx.fillRect(25, iy + ih / 2 - 5, 2, 10);
      rr(ctx, 46, iy, W - 46 - 26, ih, 17); ctx.strokeStyle = 'rgba(20,20,26,0.16)'; ctx.stroke();
      ctx.font = F.sans(400, 13); ctx.fillStyle = C.mist3; ctx.fillText('iMessage', 60, iy + 22);
      ctx.beginPath(); ctx.arc(W - 42, iy + ih / 2, 11, 0, 7); ctx.fillStyle = '#2a2a33'; ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(W - 42, iy + ih / 2 + 4); ctx.lineTo(W - 42, iy + ih / 2 - 4);
      ctx.moveTo(W - 46, iy + ih / 2); ctx.lineTo(W - 42, iy + ih / 2 - 4); ctx.lineTo(W - 38, iy + ih / 2); ctx.stroke();
    }
    // Home indicator
    ctx.fillStyle = 'rgba(20,20,26,0.22)';
    rr(ctx, W / 2 - 52, H - 12, 104, 4, 2); ctx.fill();
  }

  /* 组装捡手机的块 */
  function buildChat(post) {
    const d = post.data || {};
    const sk = Object.assign({}, skinOf(d.skin));
    sk.k = SKIN[d.skin] ? d.skin : 'wechat';
    const names = { a: d.aName || post.cpA || '对方', b: d.bName || post.cpB || '我' };
    const msgs = d.messages || [];
    const bs = [];
    bs.push(gap(10));
    // 找到最后一条自己发的，用于已读标记
    let lastMe = -1;
    msgs.forEach((m, i) => { if (m.s === 'b' && !m.t) lastMe = i; });
    let clock = '';
    msgs.forEach((m, i) => {
      if (m.t === 'time') {
        clock = m.v;
        bs.push(msgCenter(m.v, sk, sk.timeStyle === 'stamp' ? 'stamp' : 'time'));
        return;
      }
      if (m.t === 'sys') { bs.push(msgCenter(m.v, sk, 'sys')); return; }
      if (m.k === 'revoke') { bs.push(msgRevoke(m, sk, names)); return; }
      const mm = Object.assign({}, m);
      if (sk.timeStyle === 'side') {
        mm.hm = String(10 + (hash(m.v + i) % 12)).padStart(2, '0') + ':' + String(hash(m.v) % 60).padStart(2, '0');
        mm.read = (i === lastMe);
      }
      if (!m.k || m.k === 'quote') bs.push(msgText(mm, sk, names, i === lastMe));
      else bs.push(msgSpecial(mm, sk, names));
      if (sk.read && sk.timeStyle === 'stamp' && i === lastMe) {
        bs.push(mk(20, (ctx, x0, y) => {
          const L = x0 - PAD;
          ctx.font = F.sans(400, 10); ctx.fillStyle = C.mist2;
          ctx.textAlign = 'right'; ctx.fillText('已读', L + CHAT_W - CIN, y + 10); ctx.textAlign = 'left';
        }));
      }
    });
    bs.push(gap(10));
    return { blocks: bs, skin: sk, title: d.title || names.a, sub: sk.k === 'wechat' ? '' : '', clock };
  }

  /* ================================================================
     其余体裁的复合块
  ================================================================ */
  function noteBlock(n) {
    const tFont = F.sans(600, 13);
    const bFont = F.serif(400, 15.5);
    const lines = wrap(n.body || '', bFont, BW - 56);
    const h = 56 + lines.length * 27 + 26;
    return mk(h + 16, (ctx, x, y) => {
      ctx.save();
      ctx.shadowColor = 'rgba(20,20,30,0.10)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;
      rr(ctx, x, y, BW, h, 4);
      const g = ctx.createLinearGradient(x, y, x + BW, y + h);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f3f3f6');
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; rr(ctx, x, y, BW, h, 4); ctx.stroke();
      ctx.save();
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#d9d9df';
      ctx.translate(x + BW / 2, y); ctx.rotate(-0.04);
      ctx.fillRect(-34, -8, 68, 17);
      ctx.restore();
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(String(n.tag || 'NOTE').toUpperCase(), x + 22, y + 30);
      ctx.font = tFont; ctx.fillStyle = C.ink;
      ctx.fillText(n.title || '', x + 22, y + 50);
      ctx.font = bFont; ctx.fillStyle = C.ink2;
      lines.forEach((ln, i) => ctx.fillText(ln, x + 22, y + 76 + i * 27));
      if (n.from) {
        ctx.font = F.sans(400, 11); ctx.fillStyle = C.mist;
        ctx.textAlign = 'right'; ctx.fillText('—— ' + n.from, x + BW - 22, y + h - 14); ctx.textAlign = 'left';
      }
    });
  }

  function floorBlock(f, idx) {
    const nFont = F.sans(600, 12.5), bFont = F.sans(400, 15);
    const lines = wrap(f.text || '', bFont, BW - 54);
    const h = 30 + lines.length * 26 + 26;
    return mk(h, (ctx, x, y) => {
      avatar(ctx, x, y + 2, 30, f.user || '匿');
      ctx.font = nFont; ctx.fillStyle = C.ink; ctx.fillText(f.user || '匿名', x + 40, y + 13);
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(`${idx}F · ${f.time || ''}`, x + 40, y + 27);
      ctx.font = bFont; ctx.fillStyle = C.ink2;
      lines.forEach((ln, i) => ctx.fillText(ln, x + 40, y + 50 + i * 26));
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(`赞 ${f.like || 0}   回复 ${f.reply || 0}`, x + 40, y + h - 16);
      hair(ctx, x + 40, y + h - 4, BW - 40);
    });
  }

  function tweetBlock(t, kind) {
    const bFont = F.sans(400, 15.5);
    const inner = BW - 32;
    const lines = wrap(t.text || '', bFont, inner - 46);
    const q = t.quote && t.quote.text ? wrap(t.quote.text, F.sans(400, 13), inner - 76) : null;
    const qH = q ? q.length * 21 + 40 : 0;
    const reps = (t.replies || []).slice(0, 4).map(r => ({ r, ls: wrap(r.text || '', F.sans(400, 13.5), inner - 62) }));
    let repH = 0; reps.forEach(o => repH += 22 + o.ls.length * 22 + 12);
    const h = 62 + lines.length * 27 + qH + 34 + (repH ? repH + 14 : 0) + 16;
    return mk(h + 16, (ctx, x, y) => {
      ctx.save();
      ctx.shadowColor = 'rgba(20,20,30,0.09)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      rr(ctx, x, y, BW, h, 16); ctx.fillStyle = C.snow; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = C.line; ctx.lineWidth = 1; rr(ctx, x, y, BW, h, 16); ctx.stroke();
      avatar(ctx, x + 16, y + 16, 34, t.name || '·');
      ctx.font = F.sans(600, 13.5); ctx.fillStyle = C.ink;
      ctx.fillText(t.name || '', x + 60, y + 30);
      ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist2;
      ctx.fillText((kind === 'weibo' ? '' : '@') + (t.handle || '') + '  ·  ' + (t.time || ''), x + 60, y + 45);
      ctx.font = bFont; ctx.fillStyle = C.ink2;
      lines.forEach((ln, i) => ctx.fillText(ln, x + 60, y + 74 + i * 27));
      let yy = y + 74 + lines.length * 27 + 4;
      if (q) {
        rr(ctx, x + 60, yy, inner - 46, q.length * 21 + 32, 10);
        ctx.fillStyle = '#f6f6f8'; ctx.fill();
        ctx.strokeStyle = C.line; ctx.stroke();
        ctx.font = F.sans(600, 11); ctx.fillStyle = C.mist;
        ctx.fillText(t.quote.name || '', x + 72, yy + 18);
        ctx.font = F.sans(400, 13); ctx.fillStyle = C.ink3;
        q.forEach((ln, i) => ctx.fillText(ln, x + 72, yy + 36 + i * 21));
        yy += q.length * 21 + 40;
      }
      ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist;
      const s = t.stats || {};
      ctx.fillText(kind === 'weibo'
        ? `转发 ${s.repost || 0}    评论 ${s.comment || 0}    赞 ${s.like || 0}`
        : `${s.reply || 0} 回复    ${s.repost || 0} 转推    ${s.like || 0} 喜欢`, x + 60, yy + 10);
      yy += 26;
      if (reps.length) {
        hair(ctx, x + 60, yy, BW - 76); yy += 14;
        reps.forEach(o => {
          avatar(ctx, x + 60, yy - 2, 20, o.r.name || '·');
          ctx.font = F.sans(600, 11.5); ctx.fillStyle = C.ink3;
          ctx.fillText(o.r.name || '', x + 88, yy + 11);
          ctx.font = F.sans(400, 13.5); ctx.fillStyle = C.ink2;
          o.ls.forEach((ln, i) => ctx.fillText(ln, x + 88, yy + 33 + i * 22));
          yy += 22 + o.ls.length * 22 + 12;
        });
      }
    });
  }

  function qaBlock(it, n) {
    const qFont = F.sans(500, 14.5), aFont = F.serif(400, 16);
    const qls = wrap(it.q || '', qFont, BW - 60);
    const als = wrap(it.a || '', aFont, BW - 24);
    const qh = qls.length * 25 + 26;
    const h = qh + 16 + als.length * 28 + 24 + (it.who ? 20 : 0);
    return mk(h, (ctx, x, y) => {
      rr(ctx, x, y, BW, qh, 12); ctx.fillStyle = C.soft; ctx.fill();
      ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist2;
      ctx.fillText('Q' + String(n).padStart(2, '0'), x + 16, y + 22);
      ctx.font = qFont; ctx.fillStyle = C.ink2;
      qls.forEach((ln, i) => ctx.fillText(ln, x + 48, y + 22 + i * 25));
      ctx.font = aFont; ctx.fillStyle = C.ink;
      als.forEach((ln, i) => ctx.fillText(ln, x + 12, y + qh + 32 + i * 28));
      ctx.fillStyle = C.ink; ctx.fillRect(x, y + qh + 16, 2, als.length * 28 + 4);
      if (it.who) {
        ctx.font = F.sans(400, 10.5); ctx.fillStyle = C.mist;
        ctx.textAlign = 'right'; ctx.fillText('—— ' + it.who, x + BW, y + qh + 32 + als.length * 28); ctx.textAlign = 'left';
      }
      hair(ctx, x, y + h - 12, BW);
    });
  }

  /* 书信 */
  function letterBlock(l) {
    const bFont = F.serif(400, 16);
    const inner = BW - 48;
    const paras = (l.body || []).map(p => wrap(p, bFont, inner));
    let bodyH = 0; paras.forEach(p => bodyH += p.length * 29 + 12);
    const psLines = l.ps ? wrap('附：' + l.ps, F.sans(400, 12.5), inner) : [];
    const h = 64 + 30 + bodyH + 34 + (psLines.length ? psLines.length * 21 + 12 : 0) + 22;
    return mk(h + 18, (ctx, x, y) => {
      ctx.save();
      ctx.shadowColor = 'rgba(20,20,30,0.09)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 7;
      rr(ctx, x, y, BW, h, 3);
      const g = ctx.createLinearGradient(x, y, x + BW, y + h);
      g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#f4f4f7');
      ctx.fillStyle = g; ctx.fill();
      ctx.restore();
      ctx.strokeStyle = C.line; rr(ctx, x, y, BW, h, 3); ctx.stroke();
      // 左侧装订边
      ctx.fillStyle = 'rgba(20,20,26,0.045)'; ctx.fillRect(x, y, 5, h);
      // 邮戳
      ctx.save(); ctx.globalAlpha = .5;
      ctx.strokeStyle = C.mist2; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x + BW - 44, y + 40, 24, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + BW - 44, y + 40, 19, 0, 7); ctx.stroke();
      ctx.font = F.mono(400, 7.5); ctx.fillStyle = C.mist2; ctx.textAlign = 'center';
      ctx.fillText('TANGGUAN', x + BW - 44, y + 38);
      ctx.fillText(String(l.date || '').slice(0, 10), x + BW - 44, y + 48);
      ctx.textAlign = 'left'; ctx.restore();

      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(`FROM ${l.from || '—'}   TO ${l.to || '—'}`, x + 24, y + 30);
      hair(ctx, x + 24, y + 42, BW - 120);
      ctx.font = F.serif(600, 17); ctx.fillStyle = C.ink;
      ctx.fillText(l.salut || '', x + 24, y + 72);
      let yy = y + 96;
      ctx.font = bFont; ctx.fillStyle = C.ink2;
      paras.forEach(p => { p.forEach((ln, i) => ctx.fillText(ln, x + 24, yy + i * 29)); yy += p.length * 29 + 12; });
      yy += 8;
      ctx.font = F.serif(400, 14); ctx.fillStyle = C.ink3;
      ctx.textAlign = 'right'; ctx.fillText(l.sign || l.from || '', x + BW - 26, yy + 8);
      ctx.textAlign = 'left';
      if (psLines.length) {
        yy += 26;
        hair(ctx, x + 24, yy - 8, BW - 48);
        ctx.font = F.sans(400, 12.5); ctx.fillStyle = C.mist;
        psLines.forEach((ln, i) => ctx.fillText(ln, x + 24, yy + 8 + i * 21));
      }
    });
  }

  /* 朋友圈 */
  function momentBlock(m) {
    const inner = BW - 52;
    const tFont = F.sans(400, 14.6);
    const lines = wrap(m.text || '', tFont, inner);
    const imgs = (m.imgs || []).slice(0, 9);
    const cols = imgs.length === 1 ? 1 : (imgs.length <= 4 ? 2 : 3);
    const cell = imgs.length === 1 ? 150 : (cols === 2 ? 96 : 80);
    const rows = Math.ceil(imgs.length / cols);
    const imgH = imgs.length ? rows * (cell + 5) + 6 : 0;
    const likes = (m.likes || []).join('，');
    const likeH = likes ? Math.max(1, wrap(likes, F.sans(400, 12), inner - 22).length) * 20 + 10 : 0;
    const cms = (m.comments || []).map(c => {
      const head = c.name + (c.reply ? ' 回复 ' + c.reply : '') + '：';
      return { ls: wrap(head + c.text, F.sans(400, 12.5), inner - 12), c };
    });
    let cmH = 0; cms.forEach(o => cmH += o.ls.length * 20 + 4);
    const panelH = (likeH || cmH) ? likeH + cmH + 14 : 0;
    const h = 26 + lines.length * 23 + imgH + (m.location ? 20 : 0) + 24 + panelH + 14;
    return mk(h + 18, (ctx, x, y) => {
      avatarShape(ctx, x, y, 40, m.name || '·', 'square');
      ctx.font = F.sans(600, 13.5); ctx.fillStyle = C.ink2;
      ctx.fillText(m.name || '', x + 52, y + 14);
      let yy = y + 26;
      ctx.font = tFont; ctx.fillStyle = C.ink;
      lines.forEach((ln, i) => ctx.fillText(ln, x + 52, yy + 16 + i * 23));
      yy += lines.length * 23 + 8;
      imgs.forEach((cap, i) => {
        const cx = x + 52 + (i % cols) * (cell + 5);
        const cy = yy + Math.floor(i / cols) * (cell + 5);
        ctx.save(); rr(ctx, cx, cy, cell, cell, 3); ctx.clip();
        const g = ctx.createLinearGradient(cx, cy, cx + cell, cy + cell);
        g.addColorStop(0, '#e0e0e5'); g.addColorStop(1, '#c8c8d0');
        ctx.fillStyle = g; ctx.fillRect(cx, cy, cell, cell);
        ctx.strokeStyle = 'rgba(255,255,255,0.42)';
        for (let j = -cell; j < cell; j += 11) { ctx.beginPath(); ctx.moveTo(cx + j, cy + cell); ctx.lineTo(cx + j + cell, cy); ctx.stroke(); }
        const cl = wrap(cap, F.sans(400, 9.5), cell - 12).slice(0, imgs.length === 1 ? 5 : 3);
        ctx.font = F.sans(400, 9.5); ctx.fillStyle = 'rgba(28,28,34,0.72)';
        cl.forEach((ln, k) => ctx.fillText(ln, cx + 6, cy + cell - 8 - (cl.length - 1 - k) * 12));
        ctx.restore();
      });
      if (imgH) yy += imgH;
      if (m.location) {
        ctx.font = F.sans(400, 11); ctx.fillStyle = C.mist2;
        ctx.fillText(m.location, x + 52, yy + 10); yy += 20;
      }
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(String(m.time || '').toUpperCase(), x + 52, yy + 12);
      ctx.fillStyle = 'rgba(20,20,26,0.06)';
      rr(ctx, x + BW - 34, yy + 2, 30, 15, 4); ctx.fill();
      icoDots(ctx, x + BW - 32, yy + 2, 15, C.mist);
      yy += 24;
      if (panelH) {
        rr(ctx, x + 52, yy, inner, panelH, 4);
        ctx.fillStyle = '#f2f2f5'; ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + 66, yy - 5); ctx.lineTo(x + 74, yy); ctx.lineTo(x + 58, yy); ctx.closePath(); ctx.fill();
        let py = yy + 8;
        if (likes) {
          ctx.save(); ctx.fillStyle = C.mist;
          ctx.beginPath();
          const hx = x + 62, hy = py + 8;
          ctx.moveTo(hx, hy + 4); ctx.bezierCurveTo(hx - 6, hy - 2, hx - 2, hy - 6, hx, hy - 2);
          ctx.bezierCurveTo(hx + 2, hy - 6, hx + 6, hy - 2, hx, hy + 4);
          ctx.fill(); ctx.restore();
          ctx.font = F.sans(400, 12); ctx.fillStyle = C.ink3;
          wrap(likes, F.sans(400, 12), inner - 34).forEach((ln, i) => ctx.fillText(ln, x + 74, py + 12 + i * 20));
          py += likeH;
          hair(ctx, x + 60, py - 4, inner - 16);
        }
        cms.forEach(o => {
          ctx.font = F.sans(400, 12.5);
          o.ls.forEach((ln, i) => {
            ctx.fillStyle = i === 0 ? C.ink : C.ink2;
            ctx.fillText(ln, x + 62, py + 12 + i * 20);
          });
          py += o.ls.length * 20 + 4;
        });
      }
      hair(ctx, x + 52, y + h - 4, BW - 52);
    });
  }

  /* 弹幕 */
  function danmuHead(d) {
    return mk(126, (ctx, x, y) => {
      rr(ctx, x, y, BW, 108, 12);
      const g = ctx.createLinearGradient(x, y, x + BW, y + 108);
      g.addColorStop(0, '#33333c'); g.addColorStop(1, '#17171c');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); rr(ctx, x, y, BW, 108, 12); ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.055)'; ctx.lineWidth = 1;
      for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(x - 40 + i * 34, y + 108); ctx.lineTo(x + 40 + i * 34, y); ctx.stroke(); }
      ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.moveTo(x + BW / 2 - 8, y + 40); ctx.lineTo(x + BW / 2 + 12, y + 52); ctx.lineTo(x + BW / 2 - 8, y + 64); ctx.closePath(); ctx.fill();
      ctx.font = F.sans(500, 13); ctx.fillStyle = 'rgba(255,255,255,0.94)';
      ctx.textAlign = 'center';
      ctx.fillText(String(d.video || '').slice(0, 22), x + BW / 2, y + 86);
      ctx.font = F.mono(400, 9); ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText('UP · ' + String(d.up || '').slice(0, 18), x + BW / 2, y + 100);
      ctx.textAlign = 'left';
      // 进度条
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 14, y + 100.5, BW - 28, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(x + 14, y + 100.5, (BW - 28) * 0.42, 2);
    });
  }
  function danmuBlock(d, i) {
    const f = F.sans(400, 14);
    const ls = wrap(d.text || '', f, BW - 74);
    const h = Math.max(30, ls.length * 22 + 14);
    return mk(h, (ctx, x, y) => {
      ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist2;
      ctx.fillText(d.t || '--:--', x, y + 15);
      ctx.fillStyle = i % 2 ? 'rgba(20,20,26,0.028)' : 'transparent';
      rr(ctx, x + 52, y - 2, BW - 52, h - 2, 6); ctx.fill();
      ctx.font = f; ctx.fillStyle = C.ink2;
      ls.forEach((ln, k) => ctx.fillText(ln, x + 62, y + 15 + k * 22));
    });
  }

  /* ================================================================
     体裁装配
  ================================================================ */
  const GENRE_META = {
    essay: { en: 'ESSAY / 随笔', maxH: 880 },
    diary: { en: 'DIARY / 日记', maxH: 880 },
    note: { en: 'NOTE / 便签', maxH: 900 },
    qa: { en: 'ASKBOX / 问答', maxH: 880 },
    forum: { en: 'FORUM / 论坛体', maxH: 900 },
    tweet: { en: 'TIMELINE / 推特体', maxH: 900 },
    weibo: { en: 'WEIBO / 微博体', maxH: 900 },
    chatlog: { en: 'CHATLOG / 捡到的手机', maxH: 760, chat: true },
    quote: { en: 'QUOTES / 语录', maxH: 860 },
    letter: { en: 'LETTER / 书信体', maxH: 920 },
    moments: { en: 'MOMENTS / 朋友圈', maxH: 900 },
    interview: { en: 'INTERVIEW / 访谈体', maxH: 880 },
    news: { en: 'DISPATCH / 报道体', maxH: 880 },
    danmu: { en: 'DANMAKU / 弹幕体', maxH: 880 }
  };

  function build(post) {
    const g = post.genre;
    const d = post.data || {};
    const bs = [];
    const A = post.cpA || '', B = post.cpB || '';

    if (g === 'essay') {
      bs.push(gap(4));
      bigTitle(bs, post.title || '无题', 27);
      bs.push(mk(30, (ctx, x, y) => {
        ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist;
        ctx.fillText(`${A} × ${B}`.toUpperCase(), x, y + 14);
        hair(ctx, x, y + 24, BW);
      }));
      (d.sections || []).forEach((s, i) => {
        if (s.h) heading(bs, s.h, { mt: i ? 22 : 14 }); else bs.push(gap(14));
        (s.body || []).forEach(p => { para(bs, p, { font: F.serif(400, 16), lh: 29 }); bs.push(gap(10)); });
      });
    }

    else if (g === 'news') {
      bs.push(mk(58, (ctx, x, y) => {
        ctx.font = F.serif(600, 21); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
        ctx.fillText(String(d.outlet || 'THE DISPATCH').toUpperCase(), x + BW / 2, y + 22);
        ctx.font = F.mono(400, 8.5); ctx.fillStyle = C.mist2;
        ctx.fillText([d.column, d.time].filter(Boolean).join('   ·   ').toUpperCase(), x + BW / 2, y + 38);
        ctx.textAlign = 'left';
        ctx.fillStyle = C.ink; ctx.fillRect(x, y + 46, BW, 2);
        ctx.fillRect(x, y + 50, BW, 0.6);
      }));
      bs.push(gap(10));
      bigTitle(bs, post.title || '无题', 25);
      bs.push(gap(8));
      if (d.lead) { para(bs, d.lead, { font: F.sans(500, 14), lh: 26, color: C.ink2 }); bs.push(gap(6)); }
      bs.push(mk(16, (ctx, x, y) => hair(ctx, x, y + 8, BW, C.line2)));
      (d.sections || []).forEach((s, i) => {
        if (s.h) heading(bs, s.h, { mt: i ? 20 : 12, font: F.sans(600, 14), lh: 24, rule: false });
        (s.body || []).forEach(p => { para(bs, p, { font: F.serif(400, 15.5), lh: 28 }); bs.push(gap(8)); });
      });
    }

    else if (g === 'diary') {
      (d.entries || []).forEach((e, i) => {
        if (i) bs.push(BRK());
        bs.push(mk(52, (ctx, x, y) => {
          ctx.font = F.serif(600, 24); ctx.fillStyle = C.ink;
          ctx.fillText(e.date || '某日', x, y + 26);
          ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist2;
          ctx.fillText([e.weather, e.mood].filter(Boolean).join('  ·  '), x, y + 44);
        }));
        bs.push(mk(16, (ctx, x, y) => hair(ctx, x, y + 6, BW)));
        (e.body || []).forEach(p => { para(bs, p, { font: F.serif(400, 16), lh: 29 }); bs.push(gap(10)); });
        if (e.ps) { bs.push(gap(6)); para(bs, 'P.S. ' + e.ps, { font: F.sans(400, 13.5), lh: 24, color: C.mist }); }
      });
    }

    else if (g === 'note') {
      (d.notes || []).forEach((n, i) => {
        if (i && i % 2 === 0) bs.push(BRK());
        bs.push(gap(i % 2 ? 8 : 10));
        bs.push(noteBlock(n));
      });
    }

    else if (g === 'qa') {
      bs.push(gap(4));
      bigTitle(bs, post.title || '提问箱', 24);
      bs.push(mk(28, (ctx, x, y) => hair(ctx, x, y + 16, BW)));
      (d.items || []).forEach((it, i) => {
        if (i && i % 3 === 0) bs.push(BRK());
        bs.push(qaBlock(it, i + 1)); bs.push(gap(12));
      });
    }

    else if (g === 'interview') {
      bs.push(mk(46, (ctx, x, y) => {
        ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
        ctx.fillText([d.outlet, d.column].filter(Boolean).join('  /  ').toUpperCase(), x, y + 13);
        hair(ctx, x, y + 24, BW, C.line2);
      }));
      bigTitle(bs, post.title || '专访', 25);
      bs.push(gap(10));
      if (d.lead) { para(bs, d.lead, { font: F.serif(400, 15), lh: 28, color: C.ink3 }); bs.push(gap(10)); }
      bs.push(mk(18, (ctx, x, y) => hair(ctx, x, y + 9, BW)));
      (d.qa || []).forEach((it, i) => {
        if (i && i % 3 === 0) bs.push(BRK());
        bs.push(qaBlock(it, i + 1)); bs.push(gap(10));
      });
    }

    else if (g === 'forum') {
      bs.push(mk(24, (ctx, x, y) => {
        ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist2;
        ctx.fillText(String(d.board || 'BOARD').toUpperCase(), x, y + 12);
      }));
      bigTitle(bs, post.title || '无标题', 23);
      bs.push(mk(34, (ctx, x, y) => {
        ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist;
        ctx.fillText(`浏览 ${d.view || 0}   回复 ${(d.floors || []).length}   ${d.time || ''}`, x, y + 14);
        hair(ctx, x, y + 26, BW, C.line2);
      }));
      (d.floors || []).forEach((f, i) => {
        if (i && i % 4 === 0) bs.push(BRK());
        bs.push(floorBlock(f, i + 1)); bs.push(gap(10));
      });
    }

    else if (g === 'tweet' || g === 'weibo') {
      const arr = d.tweets || d.posts || [];
      arr.forEach((t, i) => { if (i && i % 2 === 0) bs.push(BRK()); bs.push(tweetBlock(t, g)); });
    }

    else if (g === 'moments') {
      bs.push(mk(46, (ctx, x, y) => {
        ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
        ctx.fillText('MOMENTS · 朋友圈', x, y + 13);
        hair(ctx, x, y + 26, BW, C.line2);
      }));
      (d.moments || []).forEach((m, i) => { if (i && i % 2 === 0) bs.push(BRK()); bs.push(momentBlock(m)); });
    }

    else if (g === 'letter') {
      (d.letters || []).forEach((l, i) => { if (i) bs.push(BRK()); bs.push(gap(6)); bs.push(letterBlock(l)); });
    }

    else if (g === 'danmu') {
      bs.push(danmuHead(d));
      bs.push(mk(24, (ctx, x, y) => {
        ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
        ctx.fillText(`DANMAKU  ${(d.danmu || []).length} 条`, x, y + 13);
        hair(ctx, x, y + 20, BW);
      }));
      (d.danmu || []).forEach((x2, i) => { if (i && i % 10 === 0) bs.push(BRK()); bs.push(danmuBlock(x2, i)); });
    }

    else { // quote
      bs.push(gap(6));
      bigTitle(bs, post.title || '语录', 25);
      bs.push(gap(14));
      (d.lines || []).forEach((l, i) => {
        if (i && i % 4 === 0) bs.push(BRK());
        bs.push(mk(26, (ctx, x, y) => {
          ctx.font = F.mono(400, 11); ctx.fillStyle = C.mist3;
          ctx.fillText(String(i + 1).padStart(2, '0'), x, y + 14);
        }));
        para(bs, l.text || '', { font: F.serif(400, 17), lh: 30 });
        if (l.who) bs.push(mk(28, (ctx, x, y) => {
          ctx.font = F.sans(400, 11.5); ctx.fillStyle = C.mist;
          ctx.textAlign = 'right'; ctx.fillText('—— ' + l.who, x + BW, y + 14); ctx.textAlign = 'left';
        }));
        bs.push(mk(20, (ctx, x, y) => hair(ctx, x, y + 10, BW)));
      });
    }
    return bs;
  }

  /* ---------------- 装箱 ---------------- */
  function paginate(blocks, maxH) {
    const pages = []; let cur = [], h = 0;
    blocks.forEach(b => {
      if (b.brk) { if (cur.length) { pages.push(cur); cur = []; h = 0; } return; }
      if (cur.length && h + b.h > maxH) { pages.push(cur); cur = []; h = 0; }
      cur.push(b); h += b.h;
    });
    if (cur.length) pages.push(cur);
    return pages.filter(p => p.some(b => b.h > 6)).slice(0, MAXPAGE);
  }

  /* ---------------- 单页绘制 ---------------- */
  function drawPage(blocks, info) {
    let bodyH = 0; blocks.forEach(b => bodyH += b.h);
    const chat = info.chat;
    const headH = chat ? chat.skin.headerH : HEAD_H;
    const footH = chat ? chat.skin.footerH : FOOT_H;
    const H = Math.max(chat ? 720 : 560, Math.round(headH + bodyH + footH));
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    const ctx = cv.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';

    if (chat) {
      drawChatChrome(ctx, H, chat.skin, { title: chat.title, sub: chat.sub, clock: chat.clock });
      let y = headH + 4;
      blocks.forEach(b => { b.d(ctx, PAD, y, BW); y += b.h; });
      // 右下角极小的水印
      ctx.font = F.mono(400, 7.5); ctx.fillStyle = 'rgba(20,20,26,0.2)';
      ctx.textAlign = 'right'; ctx.fillText(`TANGGUAN  ${String(info.i).padStart(2, '0')}/${String(info.n).padStart(2, '0')}`, W - 16, H - 22); ctx.textAlign = 'left';
      return cv.toDataURL('image/jpeg', 0.93);
    }

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#fafafb'); g.addColorStop(1, '#eeeef1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r1 = ctx.createRadialGradient(W * 0.86, H * 0.06, 4, W * 0.86, H * 0.06, W * 0.7);
    r1.addColorStop(0, 'rgba(255,255,255,0.95)'); r1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
    const r2 = ctx.createRadialGradient(W * 0.1, H * 0.98, 4, W * 0.1, H * 0.98, W * 0.8);
    r2.addColorStop(0, 'rgba(150,150,162,0.16)'); r2.addColorStop(1, 'rgba(150,150,162,0)');
    ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);

    ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
    ctx.fillText(info.eyebrow.toUpperCase(), PAD, 34);
    ctx.textAlign = 'right';
    ctx.fillText(`${String(info.i).padStart(2, '0')} / ${String(info.n).padStart(2, '0')}`, W - PAD, 34);
    ctx.textAlign = 'left';
    hair(ctx, PAD, 46, BW, C.line);
    ctx.strokeStyle = 'rgba(20,20,26,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(W - 6, 6, 46, Math.PI * 0.5, Math.PI); ctx.stroke();

    let y = HEAD_H;
    blocks.forEach(b => { b.d(ctx, PAD, y, BW); y += b.h; });

    hair(ctx, PAD, H - FOOT_H + 18, BW, C.line);
    ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
    ctx.fillText('TANGGUAN · 糖罐', PAD, H - 22);
    ctx.textAlign = 'right';
    ctx.fillText(String(info.cp).toUpperCase(), W - PAD, H - 22);
    ctx.textAlign = 'left';
    return cv.toDataURL('image/jpeg', 0.93);
  }

  /* ---------------- 对外 ---------------- */
  function render(post) {
    try {
      const meta = GENRE_META[post.genre] || GENRE_META.essay;
      let chat = null, blocks;
      if (post.genre === 'chatlog') { chat = buildChat(post); blocks = chat.blocks; }
      else blocks = build(post);

      let pages = paginate(blocks, meta.maxH);
      let h = meta.maxH;
      while (pages.length < 2 && h > 300) { h = Math.round(h * 0.6); pages = paginate(blocks, h); }
      if (!pages.length) return [];
      const cp = `${post.cpA || ''} × ${post.cpB || ''}`;
      return pages.map((p, i) => drawPage(p, { eyebrow: meta.en, cp, i: i + 1, n: pages.length, chat }));
    } catch (e) {
      console.warn('[糖罐] 图片渲染异常，已降级：', e);
      return [];
    }
  }

  return { render, GENRE_META, W, wrap };
})();

window.tgRenderPost = p => TGCard.render(p);