/* ==========================================================
   dn-relation.js — 关系网（力导向布局 + 缩放拖拽 + 卡片同步）
   ========================================================== */

/* ---------- 力导向布局：避免拥挤与重叠 ---------- */
function relLayout(nodes, links, W_, H_) {
  const n = nodes.length;
  const cx = W_ / 2, cy = H_ / 2;
  const R = Math.min(W_, H_) * 0.33;
  nodes.forEach((nd, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    nd.x = cx + Math.cos(a) * R * (0.85 + (i % 2) * 0.3);
    nd.y = cy + Math.sin(a) * R * (0.85 + (i % 2) * 0.3);
    nd.vx = 0; nd.vy = 0;
  });
  const idx = {};
  nodes.forEach((nd, i) => idx[nd.id] = i);
  const MIN = 108;                     // 最小间距，防拥挤
  for (let it = 0; it < 420; it++) {
    const k = 1 - it / 420;
    // 斥力
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = b.x - a.x, dy = b.y - a.y;
      let d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = (MIN * MIN * 1.5) / (d * d);
      const ux = dx / d, uy = dy / d;
      a.vx -= ux * f * 0.5; a.vy -= uy * f * 0.5;
      b.vx += ux * f * 0.5; b.vy += uy * f * 0.5;
      if (d < MIN) {                   // 硬性排开
        const push = (MIN - d) * 0.5;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
      }
    }
    // 弹簧
    links.forEach(l => {
      const a = nodes[idx[l.source]], b = nodes[idx[l.target]];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const rest = l.type === 'cp' ? 132 : 178;
      const f = (d - rest) * 0.02;
      const ux = dx / d, uy = dy / d;
      a.vx += ux * f; a.vy += uy * f;
      b.vx -= ux * f; b.vy -= uy * f;
    });
    // 向心
    nodes.forEach(nd => {
      nd.vx += (cx - nd.x) * 0.006;
      nd.vy += (cy - nd.y) * 0.006;
      nd.x += nd.vx * k; nd.y += nd.vy * k;
      nd.vx *= 0.82; nd.vy *= 0.82;
      nd.x = Math.max(62, Math.min(W_ - 62, nd.x));
      nd.y = Math.max(56, Math.min(H_ - 56, nd.y));
    });
  }
}

/* ---------- 渲染 ---------- */
function relRender(svg, data, opt) {
  opt = opt || {};
  const vb = (svg.getAttribute('viewBox') || '0 0 600 460').split(' ').map(Number);
  const W_ = vb[2], H_ = vb[3];
  const nodes = data.nodes.map(n => Object.assign({}, n));
  const links = data.links.map(l => Object.assign({}, l));
  relLayout(nodes, links, W_, H_);
  const pos = {}; nodes.forEach(n => pos[n.id] = n);

  const defs = nodes.filter(n => n.avatar).map(n =>
    `<clipPath id="clip-${n.id}"><circle cx="0" cy="0" r="24"/></clipPath>`).join('');

  const linkEls = links.map((l, i) => {
    const a = pos[l.source], b = pos[l.target];
    if (!a || !b) return '';
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const off = 16;
    const nx = -dy, ny = dx;
    const len = Math.sqrt(nx * nx + ny * ny) || 1;
    const qx = mx + (nx / len) * off, qy = my + (ny / len) * off;
    const lx = mx + (nx / len) * (off * 0.75), ly = my + (ny / len) * (off * 0.75);
    return `<g class="rn-edge" data-i="${i}">
      <path class="rn-link ${l.type === 'cp' ? 'cp' : ''}" d="M${a.x} ${a.y} Q${qx} ${qy} ${b.x} ${b.y}"
        stroke-dasharray="${l.type === 'cp' ? '' : '4 5'}" stroke-width="${l.type === 'cp' ? 1.7 : 1.1}"/>
      <text class="rn-lbl" x="${lx}" y="${ly - 3}" text-anchor="middle">${dnEsc(l.label || '')}</text>
    </g>`;
  }).join('');

  const nodeEls = nodes.map(n => `
    <g class="rn-node" data-id="${n.id}" transform="translate(${n.x},${n.y})">
      <circle class="halo" r="33" fill="rgba(20,20,32,.04)"/>
      <circle class="bg" r="25" stroke-width="1.2"/>
      ${n.avatar
      ? `<image href="${n.avatar}" x="-24" y="-24" width="48" height="48" preserveAspectRatio="xMidYMid slice" clip-path="url(#clip-${n.id})"/>`
      : `<text y="5" class="rn-name" style="font-size:15px">${dnEsc((n.name || '?').slice(0, 1))}</text>`}
      <text class="rn-name" y="43">${dnEsc(n.name)}</text>
      <text class="rn-role" y="55">${dnEsc(n.role || '')}</text>
    </g>`).join('');

  svg.innerHTML = `<defs>${defs}</defs><g class="rn-zoom">${linkEls}${nodeEls}</g>`;

  if (opt.onNode) {
    svg.querySelectorAll('.rn-node').forEach(g => {
      g.style.cursor = 'pointer';
      g.onclick = () => opt.onNode(g.dataset.id);
    });
  }
  if (opt.interactive !== false) attachZoom(svg);
  return { nodes, links };
}

/* ---------- 缩放 / 拖拽 ---------- */
function attachZoom(svg) {
  const g = svg.querySelector('.rn-zoom');
  if (!g) return;
  const st = { k: 1, x: 0, y: 0 };
  svg._zoomState = st;
  const apply = () => g.setAttribute('transform', `translate(${st.x},${st.y}) scale(${st.k})`);
  svg._zoomApply = apply;

  let pts = new Map(), startD = 0, startK = 1, last = null;
  svg.addEventListener('pointerdown', e => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) last = { x: e.clientX, y: e.clientY };
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      startD = Math.hypot(a.x - b.x, a.y - b.y);
      startK = st.k;
    }
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      st.k = Math.max(0.5, Math.min(3.2, startK * (d / (startD || d))));
      apply();
    } else if (pts.size === 1 && last) {
      st.x += e.clientX - last.x;
      st.y += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
      apply();
    }
  });
  const up = e => { pts.delete(e.pointerId); last = null; };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);
}
function relZoom(svg, dir) {
  const st = svg._zoomState;
  if (!st) return;
  if (dir === 'fit') { st.k = 1; st.x = 0; st.y = 0; }
  else st.k = Math.max(0.5, Math.min(3.2, st.k * (dir === 'in' ? 1.22 : 0.82)));
  svg._zoomApply();
}

/* ---------- 卡片同步 ---------- */
function renderRelCards(data, chars) {
  const box = document.getElementById('relCards');
  const nameOf = id => (chars.find(c => c.id === id) || {}).name || id;
  box.innerHTML = data.links.map((l, i) => `
    <div class="rcard" data-i="${i}" data-a="${l.source}" data-b="${l.target}" style="animation-delay:${i * 40}ms">
      <div class="rc-pair"><span class="rc-dot"></span>
        <span class="rc-names">${dnEsc(nameOf(l.source))} — ${dnEsc(nameOf(l.target))}</span></div>
      <span class="rc-type">${l.type === 'cp' ? 'CP' : '关系'}</span>
      <span class="rc-rel">${dnEsc(l.label || '')}</span>
    </div>`).join('');
  box.querySelectorAll('.rcard').forEach(el => {
    el.onclick = () => {
      box.querySelectorAll('.rcard').forEach(c => c.classList.remove('hi'));
      el.classList.add('hi');
      const svg = document.getElementById('relSvg');
      svg.querySelectorAll('.rn-node').forEach(g => {
        g.classList.toggle('hi', g.dataset.id === el.dataset.a || g.dataset.id === el.dataset.b);
      });
      svg.querySelectorAll('.rn-edge').forEach(g => {
        g.style.opacity = g.dataset.i === el.dataset.i ? '1' : '.24';
      });
    };
  });
}

/* ---------- 生成 ---------- */
function initRelation() {
  document.getElementById('relGenBtn').onclick = async function () {
    if (!W.chars.length) return dnToast('请先在第四步生成人物');
    this.classList.add('on', 'busy');
    dnLoad(true, '梳理关系');
    try {
      const roster = W.chars.map(c => `${c.name}｜${c.group}｜${c.identity}`).join('\n');
      const cpList = W.pairs.map(p => p.names.join(' × ')).join('、');
      const data = await DNAI.json(
        '你是小说人物关系分析师。你要输出一张干净、合理、不冗余的关系网：CP 之间必须连线；其余角色与主要人物之间只保留真正重要的关系，避免所有人两两互连造成拥挤。关系标签 2–6 个字。',
        `角色名单：\n${roster}\n\n已确定 CP：${cpList}\n\n请输出关系网。要求：\n1. 每对 CP 一条 type 为 "cp" 的连线；\n2. 其他关系 type 为 "other"，总数控制在 ${Math.max(2, W.chars.length)} 条以内；\n3. 每个角色至少有一条连线，但不要让任何角色超过 4 条；\n4. name 必须与名单完全一致。\n\n返回 JSON：{"links":[{"a":"角色名","b":"角色名","label":"关系标签","type":"cp或other"}]}`,
        { maxTokens: 3000 });

      const byName = {};
      W.chars.forEach(c => byName[c.name] = c.id);
      const links = [];
      const seen = new Set();
      (data.links || []).forEach(l => {
        const s = byName[l.a], t = byName[l.b];
        if (!s || !t || s === t) return;
        const key = [s, t].sort().join('-');
        if (seen.has(key)) return;
        seen.add(key);
        links.push({ source: s, target: t, label: l.label || '', type: l.type === 'cp' ? 'cp' : 'other' });
      });
      // 保底：CP 连线必然存在
      W.pairs.forEach(p => {
        if (p.ids.length === 2) {
          const key = [p.ids[0], p.ids[1]].sort().join('-');
          if (!seen.has(key)) {
            seen.add(key);
            links.push({ source: p.ids[0], target: p.ids[1], label: p.relation ? p.relation.slice(0, 6) : '恋人', type: 'cp' });
          } else {
            const ex = links.find(x => [x.source, x.target].sort().join('-') === key);
            if (ex) ex.type = 'cp';
          }
        }
      });

      const nodes = W.chars.map(c => ({
        id: c.id, name: c.name, role: c.solo ? '独立角色' : c.group, avatar: c.avatar || ''
      }));
      W.relation = { nodes, links };
      document.getElementById('relStage').classList.add('ready');
      relRender(document.getElementById('relSvg'), W.relation, {
        onNode: id => {
          const cards = document.getElementById('relCards');
          const hit = [...cards.querySelectorAll('.rcard')].find(el => el.dataset.a === id || el.dataset.b === id);
          if (hit) hit.click();
        }
      });
      renderRelCards(W.relation, W.chars);
      this.querySelector('b').textContent = '重新生成关系网';
    } catch (e) { dnToast(e.message); }
    finally { this.classList.remove('busy'); dnLoad(false); }
  };

  document.querySelectorAll('.rel-zoom span').forEach(el => {
    el.onclick = () => relZoom(document.getElementById('relSvg'), el.dataset.z);
  });
  document.getElementById('relExpand').onclick = () => {
    if (!W.relation) return dnToast('尚未生成');
    document.getElementById('relFull').classList.add('show');
    relRender(document.getElementById('relFullSvg'), W.relation, {});
  };
  document.getElementById('rfClose').onclick = () => document.getElementById('relFull').classList.remove('show');
}
document.addEventListener('DOMContentLoaded', initRelation);
