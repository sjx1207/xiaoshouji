/* ==========================================================
   共读屿 · 勋章体系 gd-badges.js
   —— 「屿光值」三十级，每一级独立命名 + 独立造型
   ==========================================================
   屿光值计算规则（主打时间陪伴 + 阅读积累）：
     阅读时长      每 1 分钟          + 1.0
     阅读字数      每 1000 字         + 2.0
     连续到访      每 1 天连续        + 15
     收录篇目      每 1 篇入库        + 20
     互动         每 1 条评论/回复    + 2.0
     共读陪伴      每 1 分钟共读      + 1.5
   连续天数断掉时，已获得的等级永久保留（只涨不退），
   但「连续加成」按当前 streak 实时计算，鼓励回来。
   ========================================================== */

const GDBadge = (() => {

const W = { minute: 1, kiloWord: 2, streakDay: 15, work: 20, interaction: 2, coreadMinute: 1.5 };

function value(st, workCount, coreadMs) {
  const min = (st.totalMs || 0) / 60000;
  const kw = (st.words || 0) / 1000;
  return Math.floor(
    min * W.minute +
    kw * W.kiloWord +
    (st.streak || 0) * W.streakDay +
    (workCount || 0) * W.work +
    (st.interactions || 0) * W.interaction +
    ((coreadMs || 0) / 60000) * W.coreadMinute
  );
}

/* 三十级门槛 */
const NEED = [0,30,80,160,280,450,680,980,1350,1800,2350,3000,3800,4750,5850,7100,
              8550,10200,12100,14300,16800,19700,23000,26800,31200,36200,42000,48600,56200,65000,75000];

const NAMES = [
  ['初抵浅滩','FIRST SHORE'],   ['拾贝的人','SHELL PICKER'], ['潮痕记事','TIDE MARKS'],
  ['灯下候读','LAMP VIGIL'],    ['纸页微光','PAPER GLIM'],   ['长夜副本','NIGHT COPY'],
  ['折角为记','DOG-EAR'],       ['墨迹未干','WET INK'],      ['引号收藏家','QUOTE HOARD'],
  ['半页知己','HALF PAGE'],     ['深读者','DEEP READER'],    ['雨季常客','RAIN REGULAR'],
  ['屿上守夜人','ISLE WATCH'],  ['章节摆渡','CHAPTER FERRY'],['与你同页','SAME PAGE'],
  ['白噪灯塔','WHITE NOISE'],   ['千字为舟','THOUSAND RAFT'],['旧稿修复师','RESTORER'],
  ['破晓同读','DAWN DUET'],     ['静默共振','SILENT RESON'], ['万字长风','LONG WIND'],
  ['情节考据者','PLOT SCHOLAR'],['心跳频段','HEART BAND'],   ['无人区回声','ECHO ZONE'],
  ['时间的胶片','TIME FILM'],   ['群星编目','STAR INDEX'],   ['长夜不落','NEVER DUSK'],
  ['屿心恒温','ISLE CORE'],     ['引力共读','GRAVITY READ'], ['与屿同名','NAMED ISLE']
];

/* 每级独立造型：外框形状 + 内部构图 + 层级配色，共 30 套 */
const FRAMES = ['disc','scallop','arch','shield','lozenge','hex','plate','drop','octa','banner',
                'ring','seal','gear','flag','tower','wave','crest','beam','orbit','prism',
                'sail','lantern','compass','vault','film','constel','eclipse','core','spiral','monolith'];

/* 六段色阶：越高越深越华丽 */
function palette(lv) {
  const t = [
    { a:'#c9ced6', b:'#eef0f3', ink:'#5c636d', line:'#aab1ba' }, // 1-5
    { a:'#aeb5bf', b:'#e6e8ec', ink:'#4a515b', line:'#98a0aa' }, // 6-10
    { a:'#8d949f', b:'#dfe2e7', ink:'#3b424b', line:'#7d848f' }, // 11-15
    { a:'#6c737e', b:'#d7dade', ink:'#2c323a', line:'#5f6672' }, // 16-20
    { a:'#4c525c', b:'#cdd1d7', ink:'#1e232a', line:'#454b55' }, // 21-25
    { a:'#2a2e35', b:'#c3c8cf', ink:'#101318', line:'#2f343c' }  // 26-30
  ];
  return t[Math.min(5, Math.floor((lv - 1) / 5))];
}

/* ---------- 外框路径 ---------- */
function frameShape(kind, p, gid) {
  const S = `fill="url(#${gid})" stroke="${p.line}" stroke-width="1.4"`;
  switch (kind) {
    case 'disc':     return `<circle cx="48" cy="48" r="38" ${S}/>`;
    case 'scallop':  { let d=''; for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const x=48+Math.cos(a)*38,y=48+Math.sin(a)*38;d+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="6" fill="url(#${gid})" stroke="${p.line}" stroke-width="1"/>`;} return d+`<circle cx="48" cy="48" r="35" ${S}/>`; }
    case 'arch':     return `<path d="M14 84V44a34 34 0 0 1 68 0v40Z" ${S}/>`;
    case 'shield':   return `<path d="M48 8 84 20v30c0 22-16 34-36 42C28 84 12 72 12 50V20Z" ${S}/>`;
    case 'lozenge':  return `<path d="M48 6 88 48 48 90 8 48Z" ${S}/>`;
    case 'hex':      return `<path d="M48 8 82 27v42L48 88 14 69V27Z" ${S}/>`;
    case 'plate':    return `<rect x="12" y="12" width="72" height="72" rx="10" ${S}/><rect x="19" y="19" width="58" height="58" rx="6" fill="none" stroke="${p.line}" stroke-width=".8" opacity=".5"/>`;
    case 'drop':     return `<path d="M48 6c18 20 30 32 30 46a30 30 0 0 1-60 0c0-14 12-26 30-46Z" ${S}/>`;
    case 'octa':     return `<path d="M32 8h32l24 24v32L64 88H32L8 64V32Z" ${S}/>`;
    case 'banner':   return `<path d="M16 10h64v62L48 90 16 72Z" ${S}/>`;
    case 'ring':     return `<circle cx="48" cy="48" r="38" ${S}/><circle cx="48" cy="48" r="27" fill="none" stroke="${p.line}" stroke-width="3" opacity=".55"/>`;
    case 'seal':     { let d=`<circle cx="48" cy="48" r="37" ${S}/>`; for(let i=0;i<24;i++){const a=i/24*Math.PI*2;d+=`<rect x="47.2" y="6" width="1.6" height="7" fill="${p.line}" opacity=".55" transform="rotate(${(i/24*360).toFixed(1)} 48 48)"/>`;} return d; }
    case 'gear':     { let d=''; for(let i=0;i<10;i++){d+=`<rect x="44" y="4" width="8" height="13" rx="2" fill="url(#${gid})" stroke="${p.line}" stroke-width="1" transform="rotate(${i*36} 48 48)"/>`;} return d+`<circle cx="48" cy="48" r="34" ${S}/>`; }
    case 'flag':     return `<path d="M14 12h68l-12 22 12 22H14Z" ${S}/><rect x="11" y="12" width="4" height="76" rx="2" fill="${p.a}"/>`;
    case 'tower':    return `<path d="M34 88V34l14-26 14 26v54Z" ${S}/><rect x="26" y="80" width="44" height="9" rx="3" ${S}/>`;
    case 'wave':     return `<path d="M10 48c0-21 17-38 38-38s38 17 38 38c0 24-17 40-38 40S10 72 10 48Z" ${S}/><path d="M12 58c10-9 18 9 28 0s18 9 28 0 12 5 16 2" fill="none" stroke="${p.line}" stroke-width="1.4" opacity=".6"/>`;
    case 'crest':    return `<path d="M48 6 78 18v26c0 24-14 38-30 46-16-8-30-22-30-46V18Z" ${S}/><path d="M48 6v84" stroke="${p.line}" stroke-width=".7" opacity=".35"/>`;
    case 'beam':     return `<path d="M48 4 60 30l28 4-20 20 6 28-26-14-26 14 6-28L8 34l28-4Z" ${S}/>`;
    case 'orbit':    return `<ellipse cx="48" cy="48" rx="40" ry="24" fill="none" stroke="${p.line}" stroke-width="1.4"/><ellipse cx="48" cy="48" rx="24" ry="40" fill="none" stroke="${p.line}" stroke-width="1.4" opacity=".55"/><circle cx="48" cy="48" r="26" ${S}/>`;
    case 'prism':    return `<path d="M48 6 88 76H8Z" ${S}/><path d="M48 20 76 70H20Z" fill="none" stroke="${p.line}" stroke-width=".8" opacity=".5"/>`;
    case 'sail':     return `<path d="M48 6v72H16Z" ${S}/><path d="M54 22 84 78H54Z" ${S} opacity=".9"/><rect x="10" y="80" width="76" height="7" rx="3" ${S}/>`;
    case 'lantern':  return `<rect x="24" y="20" width="48" height="56" rx="12" ${S}/><rect x="30" y="10" width="36" height="10" rx="4" ${S}/><rect x="30" y="76" width="36" height="10" rx="4" ${S}/>`;
    case 'compass':  { let d=`<circle cx="48" cy="48" r="37" ${S}/>`; for(let i=0;i<4;i++)d+=`<path d="M48 12 53 43 48 48 43 43Z" fill="${p.a}" opacity=".8" transform="rotate(${i*90} 48 48)"/>`; return d; }
    case 'vault':    return `<path d="M18 86V40a30 30 0 0 1 60 0v46Z" ${S}/><rect x="18" y="60" width="60" height="1.2" fill="${p.line}" opacity=".5"/><rect x="18" y="72" width="60" height="1.2" fill="${p.line}" opacity=".4"/>`;
    case 'film':     { let d=`<rect x="10" y="18" width="76" height="60" rx="6" ${S}/>`; for(let i=0;i<6;i++){d+=`<rect x="${14+i*12}" y="22" width="7" height="6" rx="1.5" fill="${p.line}" opacity=".45"/><rect x="${14+i*12}" y="68" width="7" height="6" rx="1.5" fill="${p.line}" opacity=".45"/>`;} return d; }
    case 'constel':  return `<circle cx="48" cy="48" r="39" fill="url(#${gid})" stroke="${p.line}" stroke-width="1" stroke-dasharray="3 4"/><circle cx="48" cy="48" r="30" ${S}/>`;
    case 'eclipse':  return `<circle cx="48" cy="48" r="38" ${S}/><path d="M48 10a38 38 0 0 0 0 76 26 26 0 0 1 0-76Z" fill="${p.a}" opacity=".35"/>`;
    case 'core':     return `<circle cx="48" cy="48" r="38" ${S}/><circle cx="48" cy="48" r="30" fill="none" stroke="${p.line}" stroke-width=".8" opacity=".5"/><circle cx="48" cy="48" r="21" fill="none" stroke="${p.line}" stroke-width=".8" opacity=".4"/>`;
    case 'spiral':   { let d=`<circle cx="48" cy="48" r="38" ${S}/><path fill="none" stroke="${p.line}" stroke-width="1.3" opacity=".7" d="`; for(let i=0;i<160;i++){const a=i/160*Math.PI*6,r=4+i/160*28;const x=48+Math.cos(a)*r,y=48+Math.sin(a)*r;d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);} return d+`"/>`; }
    case 'monolith': return `<rect x="24" y="6" width="48" height="84" rx="6" ${S}/><rect x="31" y="14" width="34" height="68" rx="3" fill="none" stroke="${p.line}" stroke-width=".9" opacity=".55"/>`;
    default:         return `<circle cx="48" cy="48" r="38" ${S}/>`;
  }
}

/* ---------- 每级独有的内部图形（30 种不同构图） ---------- */
function inner(lv, p) {
  const I = p.ink, L = p.line;
  const A = {
    1:  `<path d="M26 58q10-8 22 0t22-6" fill="none" stroke="${I}" stroke-width="2" stroke-linecap="round"/><circle cx="48" cy="40" r="5" fill="${I}"/>`,
    2:  `<path d="M48 34c9 0 15 8 15 16H33c0-8 6-16 15-16Z" fill="${I}" opacity=".85"/><path d="M40 50v-8M48 50v-11M56 50v-8" stroke="${p.b}" stroke-width="1.6"/>`,
    3:  `<path d="M22 44h52M26 52h44M32 60h32" stroke="${I}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>`,
    4:  `<path d="M48 28v10M40 62h16l-4-22h-8Z" fill="${I}"/><path d="M34 68h28" stroke="${I}" stroke-width="2.4" stroke-linecap="round"/>`,
    5:  `<rect x="32" y="30" width="32" height="38" rx="3" fill="none" stroke="${I}" stroke-width="2"/><path d="M38 40h20M38 48h20M38 56h13" stroke="${I}" stroke-width="1.6" opacity=".7"/>`,
    6:  `<circle cx="48" cy="46" r="14" fill="none" stroke="${I}" stroke-width="2"/><path d="M48 32a14 14 0 0 0 0 28Z" fill="${I}"/><path d="M28 70h40" stroke="${I}" stroke-width="2" opacity=".5"/>`,
    7:  `<path d="M34 28h28v40l-14-10-14 10Z" fill="none" stroke="${I}" stroke-width="2"/><path d="M62 28 48 42l14 8Z" fill="${I}" opacity=".8"/>`,
    8:  `<path d="M36 62c6-22 12-28 20-32 2 10-2 26-12 32Z" fill="${I}" opacity=".85"/><circle cx="38" cy="66" r="4" fill="${I}"/>`,
    9:  `<path d="M34 36c-6 4-8 12-2 16 5 3 10-1 9-6-1-4-6-4-7-1" fill="none" stroke="${I}" stroke-width="2.4"/><path d="M62 36c-6 4-8 12-2 16 5 3 10-1 9-6-1-4-6-4-7-1" fill="none" stroke="${I}" stroke-width="2.4"/><path d="M32 66h32" stroke="${I}" stroke-width="1.6" opacity=".5"/>`,
    10: `<path d="M48 30v38" stroke="${I}" stroke-width="1.6" opacity=".45"/><path d="M46 30H32a4 4 0 0 0-4 4v30a4 4 0 0 0 4 4h14Z" fill="${I}" opacity=".85"/><path d="M50 30h14a4 4 0 0 1 4 4v30a4 4 0 0 1-4 4H50Z" fill="none" stroke="${I}" stroke-width="2"/>`,
    11: `<path d="M24 40h48M28 48h40M32 56h32M38 64h20M42 70h12" stroke="${I}" stroke-width="2" stroke-linecap="round" opacity=".9"/>`,
    12: `<path d="M34 32c0 0-8 10-8 16a8 8 0 0 0 16 0c0-6-8-16-8-16Z" fill="${I}" opacity=".8"/><path d="M60 40c0 0-7 9-7 14a7 7 0 0 0 14 0c0-5-7-14-7-14Z" fill="none" stroke="${I}" stroke-width="2"/><path d="M30 70h36" stroke="${I}" stroke-width="1.8" opacity=".5"/>`,
    13: `<path d="M48 26 40 44h16Z" fill="${I}"/><rect x="42" y="44" width="12" height="24" fill="none" stroke="${I}" stroke-width="2"/><path d="M22 40 40 34M74 40 56 34" stroke="${I}" stroke-width="1.6" opacity=".6"/>`,
    14: `<path d="M22 60h52l-8 12H30Z" fill="${I}" opacity=".85"/><path d="M48 26v30M48 30l16 6M48 30l-16 6" fill="none" stroke="${I}" stroke-width="2"/>`,
    15: `<rect x="22" y="34" width="24" height="32" rx="2" fill="${I}" opacity=".85"/><rect x="50" y="34" width="24" height="32" rx="2" fill="none" stroke="${I}" stroke-width="2"/><circle cx="48" cy="50" r="3" fill="${I}"/>`,
    16: `<circle cx="48" cy="50" r="6" fill="${I}"/><circle cx="48" cy="50" r="14" fill="none" stroke="${I}" stroke-width="1.6" opacity=".7"/><circle cx="48" cy="50" r="22" fill="none" stroke="${I}" stroke-width="1.2" opacity=".4"/><path d="M48 22v6M48 72v6M20 50h6M70 50h6" stroke="${I}" stroke-width="2"/>`,
    17: `<path d="M26 62h44l-10 10H36Z" fill="${I}"/><path d="M48 24v34" stroke="${I}" stroke-width="2"/><path d="M48 28h18l-6 8 6 8H48Z" fill="${I}" opacity=".7"/>`,
    18: `<rect x="28" y="32" width="40" height="34" rx="3" fill="none" stroke="${I}" stroke-width="2"/><path d="M28 44h40" stroke="${I}" stroke-width="1.4" opacity=".6"/><path d="M40 32v34" stroke="${I}" stroke-width="1.4" stroke-dasharray="3 3"/><path d="M56 52l8 8m0-8-8 8" stroke="${I}" stroke-width="2"/>`,
    19: `<path d="M20 62h56" stroke="${I}" stroke-width="2.4"/><path d="M28 62a20 20 0 0 1 40 0Z" fill="${I}" opacity=".8"/><path d="M48 24v10M30 34l6 7M66 34l-6 7" stroke="${I}" stroke-width="2" stroke-linecap="round"/>`,
    20: `<circle cx="36" cy="48" r="12" fill="none" stroke="${I}" stroke-width="2"/><circle cx="60" cy="48" r="12" fill="none" stroke="${I}" stroke-width="2"/><path d="M42 48h12" stroke="${I}" stroke-width="3"/>`,
    21: `<path d="M18 40c14-8 26 8 40 0s18 4 22 2" fill="none" stroke="${I}" stroke-width="2.6" stroke-linecap="round"/><path d="M18 54c14-8 26 8 40 0s18 4 22 2" fill="none" stroke="${I}" stroke-width="2.2" opacity=".7" stroke-linecap="round"/><path d="M18 68c14-8 26 8 40 0s18 4 22 2" fill="none" stroke="${I}" stroke-width="1.8" opacity=".45" stroke-linecap="round"/>`,
    22: `<circle cx="44" cy="46" r="15" fill="none" stroke="${I}" stroke-width="2.4"/><path d="M55 57 70 72" stroke="${I}" stroke-width="3" stroke-linecap="round"/><path d="M38 46h12M44 40v12" stroke="${I}" stroke-width="1.6" opacity=".7"/>`,
    23: `<path d="M20 52h12l6-14 8 28 7-20 5 6h18" fill="none" stroke="${I}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
    24: `<path d="M48 30v40" stroke="${I}" stroke-width="2"/><path d="M34 38a20 20 0 0 0 0 24M62 38a20 20 0 0 1 0 24" fill="none" stroke="${I}" stroke-width="2" opacity=".75"/><path d="M24 32a34 34 0 0 0 0 36M72 32a34 34 0 0 1 0 36" fill="none" stroke="${I}" stroke-width="1.4" opacity=".45"/>`,
    25: `<rect x="24" y="34" width="48" height="30" rx="3" fill="none" stroke="${I}" stroke-width="2"/><path d="M24 44h48M24 54h48" stroke="${I}" stroke-width="1.2" opacity=".5"/><circle cx="48" cy="49" r="7" fill="${I}" opacity=".85"/>`,
    26: `<path d="M48 24l4 12 12 4-12 4-4 12-4-12-12-4 12-4Z" fill="${I}"/><circle cx="28" cy="64" r="3.4" fill="${I}" opacity=".8"/><circle cx="66" cy="62" r="2.6" fill="${I}" opacity=".7"/><circle cx="56" cy="72" r="2" fill="${I}" opacity=".55"/><path d="M28 64 48 40 66 62 56 72Z" fill="none" stroke="${I}" stroke-width=".9" opacity=".4"/>`,
    27: `<circle cx="48" cy="50" r="13" fill="${I}"/>${Array.from({length:12},(_,i)=>`<rect x="47" y="20" width="2" height="9" rx="1" fill="${I}" opacity=".8" transform="rotate(${i*30} 48 50)"/>`).join('')}`,
    28: `<path d="M48 26c10 10 16 18 16 26a16 16 0 0 1-32 0c0-8 6-16 16-26Z" fill="none" stroke="${I}" stroke-width="2.2"/><path d="M48 40c5 6 8 10 8 14a8 8 0 0 1-16 0c0-4 3-8 8-14Z" fill="${I}"/>`,
    29: `<circle cx="48" cy="50" r="8" fill="${I}"/><ellipse cx="48" cy="50" rx="26" ry="11" fill="none" stroke="${I}" stroke-width="1.8" transform="rotate(-25 48 50)"/><ellipse cx="48" cy="50" rx="26" ry="11" fill="none" stroke="${I}" stroke-width="1.8" opacity=".6" transform="rotate(35 48 50)"/>`,
    30: `<path d="M48 20 62 44H34Z" fill="${I}"/><path d="M30 50h36l6 22H24Z" fill="none" stroke="${I}" stroke-width="2.2"/><path d="M40 58h16M37 66h22" stroke="${I}" stroke-width="1.6" opacity=".65"/>`
  };
  return A[lv] || A[1];
}

/** 生成一枚勋章的完整 SVG（size 默认 96） */
function svg(lv, size = 96, locked = false) {
  const p = palette(lv);
  const id = 'gdm' + lv, fid = 'gds' + lv;
  const body = `
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"  stop-color="#ffffff"/>
        <stop offset="45%" stop-color="${p.b}"/>
        <stop offset="100%" stop-color="${p.a}"/>
      </linearGradient>
      <filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#14161a" flood-opacity="0.22"/>
      </filter>
    </defs>
    <g filter="url(#${fid})">${frameShape(FRAMES[lv - 1], p, id)}</g>
    <g>${inner(lv, p)}</g>
    <text x="48" y="93" text-anchor="middle" font-family="'Space Mono',monospace" font-size="8"
          letter-spacing="1.2" fill="${p.ink}" opacity=".75">${String(lv).padStart(2, '0')}</text>`;
  return `<svg viewBox="0 0 96 100" width="${size}" height="${Math.round(size * 100 / 96)}"
    style="display:block;${locked ? 'filter:grayscale(1) opacity(.34) contrast(.8);' : ''}">${body}</svg>`;
}

function levelOf(v) {
  let lv = 0;
  for (let i = 1; i <= 30; i++) if (v >= NEED[i]) lv = i;
  return lv;
}
function info(lv) {
  const i = Math.max(1, Math.min(30, lv));
  return { lv: i, name: NAMES[i - 1][0], en: NAMES[i - 1][1], need: NEED[i], frame: FRAMES[i - 1] };
}
function progress(v) {
  const lv = levelOf(v);
  const cur = NEED[lv] || 0;
  const next = lv >= 30 ? null : NEED[lv + 1];
  return {
    lv, value: v, cur, next,
    pct: next ? Math.max(0, Math.min(1, (v - cur) / (next - cur))) : 1,
    remain: next ? next - v : 0
  };
}
const all = () => Array.from({ length: 30 }, (_, i) => info(i + 1));

return { W, value, NEED, NAMES, svg, levelOf, info, progress, all };
})();
window.GDBadge = GDBadge;
