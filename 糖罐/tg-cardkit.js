/* ================================================================
   糖罐 TANGGUAN — tg-cardkit.js
   帖子长图渲染引擎（纯 Canvas，零依赖、零外链、零 emoji）

   设计要点
   1. 所有内容先被拆成「原子块」，再按页高装箱 —— 任何一行、任何一个
      气泡、任何一张便签都不会被裁成一半，这是硬保证。
   2. 页高自适应：单页高度 = 内容实际高度 + 页眉页脚，不会出现半页留白。
   3. 一个帖子最多 9 张图，最少 2 张（内容不足时会按体裁规则补足分页）。
   4. 全部黑白灰浅色系，衬线标题 + 等宽标注 + 细分隔，不使用任何 emoji。
================================================================ */

const TGCard = (function () {

  /* ---------------- 基础常量 ---------------- */
  const W = 480;          // 逻辑宽
  const PAD = 34;         // 页边距
  const BW = W - PAD * 2; // 正文宽
  const SCALE = 2;        // 输出 2 倍图
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
  function mctx() {
    if (!_m) _m = document.createElement('canvas').getContext('2d');
    return _m;
  }
  function tw(text, font) { const c = mctx(); c.font = font; return c.measureText(text).width; }

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
        if (c.measureText(tok).width > maxW) {           // 超长英数硬切
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
    const k = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + k, y);
    ctx.arcTo(x + w, y, x + w, y + h, k);
    ctx.arcTo(x + w, y + h, x, y + h, k);
    ctx.arcTo(x, y + h, x, y, k);
    ctx.arcTo(x, y, x + w, y, k);
    ctx.closePath();
  }
  function hash(s) { let h = 0; for (const ch of String(s || 'x')) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }
  function avatar(ctx, x, y, d, name) {
    const h = hash(name) % 100;
    const g = ctx.createLinearGradient(x, y, x + d, y + d);
    const a = 32 + (h % 26), b = 96 + (h % 60);
    g.addColorStop(0, `rgb(${a + 26},${a + 26},${a + 32})`);
    g.addColorStop(1, `rgb(${b},${b},${b + 8})`);
    ctx.save();
    ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2, 0, 7); ctx.closePath();
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
  function chip(ctx, x, y, txt, dark) {
    const f = F.mono(400, 9.5);
    const w = tw(txt, f) + 18;
    rr(ctx, x, y, w, 19, 9.5);
    ctx.fillStyle = dark ? C.ink : C.soft; ctx.fill();
    ctx.font = f; ctx.fillStyle = dark ? '#fff' : C.mist;
    ctx.fillText(txt, x + 9, y + 13.2);
    return w;
  }
  function hair(ctx, x, y, w, col) {
    ctx.fillStyle = col || C.line;
    ctx.fillRect(x, y, w, 1);
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
    const lines = wrap(text, font, wid);
    lines.forEach(ln => bs.push(mk(lh, (ctx, x, y) => {
      if (!ln) return;
      ctx.font = font; ctx.fillStyle = col; ctx.textAlign = o.align || 'left';
      const tx = o.align === 'center' ? x + wid / 2 : x + (o.indent || 0);
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
    if (o.rule !== false) bs.push(mk(14, (ctx, x, y) => {
      ctx.fillStyle = C.ink; ctx.fillRect(x, y + 7, 26, 1.6);
    }));
    else bs.push(gap(6));
  }
  function label(bs, text) {
    bs.push(mk(20, (ctx, x, y) => {
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(String(text).toUpperCase(), x, y + 12);
    }));
  }

  /* ---------------- 复合块：气泡 / 便签 / 楼层 / 推文 ---------------- */
  function bubbleBlock(m, skin) {
    const me = m.side === 'me';
    const font = F.sans(400, 15);
    const maxW = BW * 0.62;
    const lines = wrap(m.text || '', font, maxW - 30);
    let wmax = 0; lines.forEach(l => wmax = Math.max(wmax, tw(l, font)));
    const bw = Math.max(58, wmax + 30);
    const bh = lines.length * 25 + 20;
    const nameH = me ? 0 : 18;
    const h = bh + nameH + 16;
    const rad = skin === 'wechat' ? 9 : (skin === 'line' ? 18 : 20);
    return mk(h, (ctx, x, y) => {
      const av = 32;
      const bx = me ? x + BW - av - 10 - bw : x + av + 10;
      const ay = y + nameH;
      avatar(ctx, me ? x + BW - av : x, ay, av, me ? (m.meName || '我') : (m.name || '·'));
      if (!me) {
        ctx.font = F.sans(500, 10.5); ctx.fillStyle = C.mist2;
        ctx.fillText(m.name || '', x + av + 12, y + 11);
      }
      ctx.save();
      if (me) {
        const g = ctx.createLinearGradient(bx, ay, bx + bw, ay + bh);
        g.addColorStop(0, '#31313b'); g.addColorStop(1, '#55555f');
        rr(ctx, bx, ay, bw, bh, rad); ctx.fillStyle = g; ctx.fill();
      } else {
        rr(ctx, bx, ay, bw, bh, rad);
        ctx.fillStyle = skin === 'imessage' ? '#eaeaee' : C.snow; ctx.fill();
        ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.restore();
      ctx.font = font; ctx.fillStyle = me ? '#fff' : C.ink2;
      lines.forEach((ln, i) => ctx.fillText(ln, bx + 15, ay + 26 + i * 25));
    });
  }
  function sysBlock(text) {
    return mk(34, (ctx, x, y) => {
      const f = F.sans(400, 11);
      const w = tw(text, f) + 22;
      rr(ctx, x + (BW - w) / 2, y + 6, w, 22, 11);
      ctx.fillStyle = 'rgba(20,20,26,0.06)'; ctx.fill();
      ctx.font = f; ctx.fillStyle = C.mist; ctx.textAlign = 'center';
      ctx.fillText(text, x + BW / 2, y + 21);
      ctx.textAlign = 'left';
    });
  }
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
      // 胶带
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#d9d9df';
      ctx.translate(x + BW / 2, y); ctx.rotate(-0.04);
      ctx.fillRect(-34, -8, 68, 17);
      ctx.restore();
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText((n.tag || 'NOTE').toUpperCase(), x + 22, y + 30);
      ctx.font = tFont; ctx.fillStyle = C.ink;
      ctx.fillText(n.title || '', x + 22, y + 50);
      ctx.font = bFont; ctx.fillStyle = C.ink2;
      lines.forEach((ln, i) => ctx.fillText(ln, x + 22, y + 76 + i * 27));
      if (n.from) {
        ctx.font = F.sans(400, 11); ctx.fillStyle = C.mist;
        ctx.textAlign = 'right';
        ctx.fillText('—— ' + n.from, x + BW - 22, y + h - 14);
        ctx.textAlign = 'left';
      }
    });
  }
  function floorBlock(f, idx) {
    const nFont = F.sans(600, 12.5);
    const bFont = F.sans(400, 15);
    const lines = wrap(f.text || '', bFont, BW - 54);
    const h = 30 + lines.length * 26 + 26;
    return mk(h, (ctx, x, y) => {
      avatar(ctx, x, y + 2, 30, f.user || '匿');
      ctx.font = nFont; ctx.fillStyle = C.ink;
      ctx.fillText(f.user || '匿名', x + 40, y + 13);
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(`${idx}F · ${f.time || ''}`, x + 40, y + 27);
      ctx.font = bFont; ctx.fillStyle = C.ink2;
      lines.forEach((ln, i) => ctx.fillText(ln, x + 40, y + 50 + i * 26));
      const fy = y + h - 16;
      ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
      ctx.fillText(`赞 ${f.like == null ? 0 : f.like}   回复 ${f.reply == null ? 0 : f.reply}`, x + 40, fy);
      hair(ctx, x + 40, y + h - 4, BW - 40);
    });
  }
  function tweetBlock(t, kind) {
    const bFont = F.sans(400, 15.5);
    const inner = BW - 32;
    const lines = wrap(t.text || '', bFont, inner - 46);
    const reps = (t.replies || []).slice(0, 3).map(r => ({
      r, ls: wrap(r.text || '', F.sans(400, 13.5), inner - 62)
    }));
    let repH = 0; reps.forEach(o => repH += 22 + o.ls.length * 22 + 12);
    const h = 62 + lines.length * 27 + 34 + (repH ? repH + 14 : 0) + 16;
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
      ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist;
      const s = t.stats || {};
      ctx.fillText(
        kind === 'weibo'
          ? `转发 ${s.repost || 0}    评论 ${s.comment || 0}    赞 ${s.like || 0}`
          : `${s.reply || 0} 回复    ${s.repost || 0} 转推    ${s.like || 0} 喜欢`,
        x + 60, yy + 10);
      yy += 26;
      if (reps.length) {
        hair(ctx, x + 60, yy, BW - 76);
        yy += 14;
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
    const h = qh + 16 + als.length * 28 + 24;
    return mk(h, (ctx, x, y) => {
      rr(ctx, x, y, BW, qh, 12);
      ctx.fillStyle = C.soft; ctx.fill();
      ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist2;
      ctx.fillText('Q' + String(n).padStart(2, '0'), x + 16, y + 22);
      ctx.font = qFont; ctx.fillStyle = C.ink2;
      qls.forEach((ln, i) => ctx.fillText(ln, x + 48, y + 22 + i * 25));
      ctx.font = aFont; ctx.fillStyle = C.ink;
      als.forEach((ln, i) => ctx.fillText(ln, x + 12, y + qh + 32 + i * 28));
      ctx.fillStyle = C.ink; ctx.fillRect(x, y + qh + 16, 2, als.length * 28 + 4);
      hair(ctx, x, y + h - 12, BW);
    });
  }

  /* ---------------- 体裁装配 ---------------- */
  const GENRE_META = {
    essay: { en: 'ESSAY / 随笔', maxH: 880 },
    diary: { en: 'DIARY / 日记', maxH: 880 },
    note: { en: 'NOTE / 便签', maxH: 900 },
    qa: { en: 'ASKBOX / 问答', maxH: 880 },
    forum: { en: 'FORUM / 论坛', maxH: 900 },
    tweet: { en: 'TIMELINE / 推特体', maxH: 900 },
    weibo: { en: 'WEIBO / 微博体', maxH: 900 },
    chatlog: { en: 'CHATLOG / 捡到的手机', maxH: 820 },
    quote: { en: 'QUOTES / 语录', maxH: 860 }
  };

  function build(post) {
    const g = post.genre;
    const d = post.data || {};
    const bs = [];
    const A = (post.cpA || ''), B = (post.cpB || '');

    if (g === 'essay') {
      bs.push(gap(4));
      wrap(post.title || '无题', F.serif(600, 27), BW).forEach(ln =>
        bs.push(mk(38, (ctx, x, y) => { ctx.font = F.serif(600, 27); ctx.fillStyle = C.ink; ctx.fillText(ln, x, y + 29); })));
      bs.push(mk(30, (ctx, x, y) => {
        ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist;
        ctx.fillText(`${A} × ${B}`.toUpperCase(), x, y + 14);
        hair(ctx, x, y + 24, BW);
      }));
      (d.sections || []).forEach((s, i) => {
        if (s.h) heading(bs, s.h, { mt: i ? 22 : 14 });
        else bs.push(gap(14));
        (Array.isArray(s.body) ? s.body : [s.body || '']).forEach(p => {
          para(bs, p, { font: F.serif(400, 16), lh: 29 });
          bs.push(gap(10));
        });
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
        (Array.isArray(e.body) ? e.body : [e.body || '']).forEach(p => {
          para(bs, p, { font: F.serif(400, 16), lh: 29 });
          bs.push(gap(10));
        });
        if (e.ps) {
          bs.push(gap(6));
          para(bs, 'P.S. ' + e.ps, { font: F.sans(400, 13.5), lh: 24, color: C.mist });
        }
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
      wrap(post.title || '提问箱', F.serif(600, 24), BW).forEach(ln =>
        bs.push(mk(34, (ctx, x, y) => { ctx.font = F.serif(600, 24); ctx.fillStyle = C.ink; ctx.fillText(ln, x, y + 26); })));
      bs.push(mk(28, (ctx, x, y) => { hair(ctx, x, y + 16, BW); }));
      (d.items || []).forEach((it, i) => {
        if (i && i % 3 === 0) bs.push(BRK());
        bs.push(qaBlock(it, i + 1));
        bs.push(gap(12));
      });
    }

    else if (g === 'forum') {
      bs.push(mk(24, (ctx, x, y) => {
        ctx.font = F.mono(400, 10); ctx.fillStyle = C.mist2;
        ctx.fillText((d.board || 'BOARD').toUpperCase(), x, y + 12);
      }));
      wrap(post.title || '无标题', F.serif(600, 23), BW).forEach(ln =>
        bs.push(mk(33, (ctx, x, y) => { ctx.font = F.serif(600, 23); ctx.fillStyle = C.ink; ctx.fillText(ln, x, y + 25); })));
      bs.push(mk(34, (ctx, x, y) => {
        ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist;
        ctx.fillText(`浏览 ${d.view || 0}   回复 ${(d.floors || []).length}   ${d.time || ''}`, x, y + 14);
        hair(ctx, x, y + 26, BW, C.line2);
      }));
      (d.floors || []).forEach((f, i) => {
        if (i && i % 4 === 0) bs.push(BRK());
        bs.push(floorBlock(f, i + 1));
        bs.push(gap(10));
      });
    }

    else if (g === 'tweet' || g === 'weibo') {
      const arr = d.tweets || d.posts || [];
      arr.forEach((t, i) => {
        if (i && i % 2 === 0) bs.push(BRK());
        bs.push(tweetBlock(t, g));
      });
    }

    else if (g === 'chatlog') {
      const skin = d.skin || 'imessage';
      const msgs = d.messages || [];
      bs.push(mk(56, (ctx, x, y) => {
        rr(ctx, x - 10, y, BW + 20, 46, 14);
        ctx.fillStyle = 'rgba(255,255,255,0.86)'; ctx.fill();
        ctx.strokeStyle = C.line; ctx.stroke();
        ctx.font = F.sans(600, 14); ctx.fillStyle = C.ink; ctx.textAlign = 'center';
        ctx.fillText(d.title || (A + ' 的对话'), x + BW / 2, y + 24);
        ctx.font = F.mono(400, 9); ctx.fillStyle = C.mist2;
        ctx.fillText(({ wechat: 'WECHAT', line: 'LINE', imessage: 'IMESSAGE', qq: 'QQ' }[skin] || 'MESSAGES'), x + BW / 2, y + 38);
        ctx.textAlign = 'left';
      }));
      msgs.forEach(m => {
        if (m.type === 'time' || m.type === 'system') bs.push(sysBlock(m.text || ''));
        else bs.push(bubbleBlock(m, skin));
      });
    }

    else { // quote
      bs.push(gap(6));
      wrap(post.title || '语录', F.serif(600, 25), BW).forEach(ln =>
        bs.push(mk(36, (ctx, x, y) => { ctx.font = F.serif(600, 25); ctx.fillStyle = C.ink; ctx.fillText(ln, x, y + 27); })));
      bs.push(gap(14));
      (d.lines || []).forEach((l, i) => {
        if (i && i % 4 === 0) bs.push(BRK());
        const txt = typeof l === 'string' ? l : (l.text || '');
        const who = typeof l === 'string' ? '' : (l.who || '');
        bs.push(mk(26, (ctx, x, y) => {
          ctx.font = F.mono(400, 11); ctx.fillStyle = C.mist3;
          ctx.fillText(String(i + 1).padStart(2, '0'), x, y + 14);
        }));
        para(bs, txt, { font: F.serif(400, 17), lh: 30 });
        if (who) bs.push(mk(28, (ctx, x, y) => {
          ctx.font = F.sans(400, 11.5); ctx.fillStyle = C.mist;
          ctx.textAlign = 'right'; ctx.fillText('—— ' + who, x + BW, y + 14); ctx.textAlign = 'left';
        }));
        bs.push(mk(20, (ctx, x, y) => hair(ctx, x, y + 10, BW)));
      });
    }
    return bs;
  }

  /* ---------------- 装箱：不裁断任何原子块 ---------------- */
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
    const H = Math.max(560, Math.round(HEAD_H + bodyH + FOOT_H));
    const cv = document.createElement('canvas');
    cv.width = W * SCALE; cv.height = H * SCALE;
    const ctx = cv.getContext('2d');
    ctx.scale(SCALE, SCALE);
    ctx.textBaseline = 'alphabetic';

    // 背景
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, '#fafafb'); g.addColorStop(1, '#eeeef1');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const r1 = ctx.createRadialGradient(W * 0.86, H * 0.06, 4, W * 0.86, H * 0.06, W * 0.7);
    r1.addColorStop(0, 'rgba(255,255,255,0.95)'); r1.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = r1; ctx.fillRect(0, 0, W, H);
    const r2 = ctx.createRadialGradient(W * 0.1, H * 0.98, 4, W * 0.1, H * 0.98, W * 0.8);
    r2.addColorStop(0, 'rgba(150,150,162,0.16)'); r2.addColorStop(1, 'rgba(150,150,162,0)');
    ctx.fillStyle = r2; ctx.fillRect(0, 0, W, H);

    // 页眉
    ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
    ctx.fillText(info.eyebrow.toUpperCase(), PAD, 34);
    ctx.textAlign = 'right';
    ctx.fillText(`${String(info.i).padStart(2, '0')} / ${String(info.n).padStart(2, '0')}`, W - PAD, 34);
    ctx.textAlign = 'left';
    hair(ctx, PAD, 46, BW, C.line);
    // 角标弧线
    ctx.strokeStyle = 'rgba(20,20,26,0.08)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(W - 6, 6, 46, Math.PI * 0.5, Math.PI); ctx.stroke();

    // 正文
    let y = HEAD_H;
    blocks.forEach(b => { b.d(ctx, PAD, y, BW); y += b.h; });

    // 页脚
    hair(ctx, PAD, H - FOOT_H + 18, BW, C.line);
    ctx.font = F.mono(400, 9.5); ctx.fillStyle = C.mist2;
    ctx.fillText('TANGGUAN · 糖罐', PAD, H - 22);
    ctx.textAlign = 'right';
    ctx.fillText(info.cp.toUpperCase(), W - PAD, H - 22);
    ctx.textAlign = 'left';

    return cv.toDataURL('image/jpeg', 0.93);
  }

  /* ---------------- 对外：渲染一个帖子 ---------------- */
  function render(post) {
    try {
      const meta = GENRE_META[post.genre] || GENRE_META.essay;
      let blocks = build(post);
      let pages = paginate(blocks, meta.maxH);
      // 少于两页时降低页高再切，保证「一定不止一张」
      let h = meta.maxH;
      while (pages.length < 2 && h > 300) {
        h = Math.round(h * 0.6);
        pages = paginate(blocks, h);
      }
      if (!pages.length) return [];
      const cp = `${post.cpA || ''} × ${post.cpB || ''}`;
      return pages.map((p, i) => drawPage(p, {
        eyebrow: meta.en, cp, i: i + 1, n: pages.length
      }));
    } catch (e) {
      console.warn('[糖罐] 图片渲染异常，已降级：', e);
      return [];
    }
  }

  return { render, GENRE_META, W, wrap };
})();

window.tgRenderPost = p => TGCard.render(p);
