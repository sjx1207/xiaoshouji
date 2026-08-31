/* ==========================================================
   共读屿 · gd-upload.js
   文档解析（TXT / MD / HTML / DOCX）+ 封面 + 专属档案 + 入库
   ========================================================== */

const TYPES  = ['甜文','虐文','HE','BE','OE','ABO','年下','年上','校园','都市','古风','末世','奇幻','悬疑','日常','互攻','救赎','破镜重圆','暗恋','双向奔赴','团宠','强强','伪骨科','未来'];
const WARNS  = ['刀','OOC','私设','慎入','血腥','三观不正','be预警','含原创角色','未完待续'];
const RATING = ['全年龄','R15','R18'];
const STATUS = ['单篇完结','连载中','长篇完结','片段'];
const READST = ['未读','在读','读过','珍藏'];

let PARSED = { name: '', ext: '', size: 0 };
let COVER = '';
let EDIT_ID = null;
const sel = { types: new Set(), warns: new Set(), rating: '全年龄', status: '单篇完结', read: '未读' };

document.addEventListener('DOMContentLoaded', async () => {
  GD.mountStatusBar();
  buildChips();
  bindDrop();
  bindCover();
  bindBody();
  document.getElementById('saveBtn').addEventListener('click', save);
  document.getElementById('aiSummary').addEventListener('click', genSummary);

  const q = new URLSearchParams(location.search);
  if (q.get('edit')) await loadForEdit(parseInt(q.get('edit')));
});

/* ---------------- 标签 ---------------- */
function chipHTML(list, on) {
  return list.map(x => `<div class="gd-chip ${on(x) ? 'on' : ''}" data-v="${GD.esc(x)}">${GD.esc(x)}</div>`).join('');
}
function buildChips() {
  const T = document.getElementById('tTypes'), W = document.getElementById('tWarns'),
        R = document.getElementById('tRating'), S = document.getElementById('tStatus'), D = document.getElementById('tRead');
  T.innerHTML = chipHTML(TYPES, x => sel.types.has(x));
  W.innerHTML = chipHTML(WARNS, x => sel.warns.has(x));
  R.innerHTML = chipHTML(RATING, x => sel.rating === x);
  S.innerHTML = chipHTML(STATUS, x => sel.status === x);
  D.innerHTML = chipHTML(READST, x => sel.read === x);

  const multi = (el, set) => el.querySelectorAll('.gd-chip').forEach(c => c.onclick = () => {
    const v = c.dataset.v;
    set.has(v) ? set.delete(v) : set.add(v);
    c.classList.toggle('on');
  });
  const single = (el, key) => el.querySelectorAll('.gd-chip').forEach(c => c.onclick = () => {
    sel[key] = c.dataset.v;
    el.querySelectorAll('.gd-chip').forEach(x => x.classList.toggle('on', x === c));
  });
  multi(T, sel.types); multi(W, sel.warns);
  single(R, 'rating'); single(S, 'status'); single(D, 'read');
}

/* ---------------- 文档解析 ---------------- */
function bindDrop() {
  const drop = document.getElementById('drop'), input = document.getElementById('fileInput');
  drop.addEventListener('click', () => input.click());
  input.addEventListener('change', e => { if (e.target.files[0]) handleFile(e.target.files[0]); });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('hot'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('hot'); }));
  drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
}

async function handleFile(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  PARSED = { name: file.name, ext: ext.toUpperCase(), size: file.size };
  GD.toast('正在解析 ' + file.name);
  let text = '', title = '';
  try {
    if (ext === 'docx') {
      const r = await parseDocx(file);
      text = r.text; title = r.title;
    } else if (ext === 'html' || ext === 'htm') {
      const raw = await readText(file);
      const doc = new DOMParser().parseFromString(raw, 'text/html');
      title = (doc.querySelector('h1,h2')?.textContent || doc.title || '').trim();
      doc.querySelectorAll('script,style').forEach(n => n.remove());
      text = (doc.body ? doc.body.innerText || doc.body.textContent : raw).trim();
    } else {
      text = await readText(file);
      if (ext === 'md' || ext === 'markdown') {
        const m = text.match(/^#{1,3}\s+(.+)$/m);
        if (m) title = m[1].trim();
        text = text.replace(/^#{1,6}\s+/gm, '').replace(/\*\*|__|`/g, '');
      }
    }
  } catch (e) {
    GD.toast('解析失败：' + e.message + '，可直接粘贴正文');
    return;
  }
  text = normalize(text);
  if (!text) { GD.toast('没读到正文内容，试试直接粘贴'); return; }

  if (!title) title = guessTitle(text, file.name);
  document.getElementById('fBody').value = text;
  if (!document.getElementById('fTitle').value.trim()) document.getElementById('fTitle').value = title;
  document.getElementById('titleHint').textContent = title
    ? `已识别篇名「${title}」，可直接修改` : '未识别到篇名，请手动填写';
  syncMetrics();
  showParsed();
}

function readText(file) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => {
      let t = fr.result;
      // 乱码兜底：尝试 GBK 重解
      if (/\ufffd/.test(t.slice(0, 400))) {
        const fr2 = new FileReader();
        fr2.onload = () => {
          try { res(new TextDecoder('gbk').decode(fr2.result)); } catch (e) { res(t); }
        };
        fr2.onerror = () => res(t);
        fr2.readAsArrayBuffer(file);
      } else res(t);
    };
    fr.onerror = rej;
    fr.readAsText(file, 'utf-8');
  });
}

/* ---- DOCX：浏览器原生解压，无第三方依赖 ---- */
async function parseDocx(file) {
  const buf = await file.arrayBuffer();
  const xml = await unzipEntry(buf, 'word/document.xml');
  if (!xml) throw new Error('不是有效的 docx');
  const s = new TextDecoder('utf-8').decode(xml);

  // 标题：取第一个 Heading 样式段落
  let title = '';
  const hm = s.match(/<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*?w:pStyle w:val="(?:Heading1|Heading2|1|2|Title)"[\s\S]*?<\/w:p>/);
  if (hm) title = stripW(hm[0]).trim();

  const paras = s.split(/<\/w:p>/).map(p => {
    let t = stripW(p);
    return t;
  });
  return { text: paras.join('\n'), title };
}
function stripW(p) {
  return p
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

/** 极简 ZIP 读取：定位中央目录 → 找到目标条目 → deflate-raw 解压 */
async function unzipEntry(buf, target) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  // End of Central Directory
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('压缩包结构异常');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder('utf-8');

  for (let i = 0; i < count; i++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true);
    const compSize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const cmtLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));
    if (name === target) {
      const lNameLen = dv.getUint16(lho + 26, true);
      const lExtraLen = dv.getUint16(lho + 28, true);
      const start = lho + 30 + lNameLen + lExtraLen;
      const raw = u8.subarray(start, start + compSize);
      if (method === 0) return raw;
      if (typeof DecompressionStream === 'undefined')
        throw new Error('当前浏览器不支持解压，请粘贴正文');
      const ds = new DecompressionStream('deflate-raw');
      const out = new Response(new Blob([raw]).stream().pipeThrough(ds));
      return new Uint8Array(await out.arrayBuffer());
    }
    off += 46 + nameLen + extraLen + cmtLen;
  }
  return null;
}

function normalize(t) {
  return String(t || '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}
function guessTitle(text, fileName) {
  const first = text.split('\n').map(s => s.trim()).find(Boolean) || '';
  if (first && first.length <= 30 && !/[。！？，]$/.test(first)) return first;
  return (fileName || '').replace(/\.[^.]+$/, '') || '';
}

function showParsed() {
  document.getElementById('parsed').classList.add('show');
  document.getElementById('pFx').textContent = PARSED.ext || 'TXT';
  document.getElementById('pFn').textContent = PARSED.name || '粘贴的正文';
  document.getElementById('pFs').textContent =
    (PARSED.size ? (PARSED.size / 1024).toFixed(1) + ' KB · ' : '') + '解析成功';
}

/* ---------------- 指标同步 ---------------- */
function bindBody() {
  const b = document.getElementById('fBody');
  b.addEventListener('input', () => {
    if (!document.getElementById('parsed').classList.contains('show') && b.value.trim()) {
      PARSED = { name: '手动粘贴', ext: 'TEXT', size: 0 }; showParsed();
    }
    syncMetrics();
  });
}
function segmentsOf(text) {
  const marks = text.split('\n').filter(l => /^\s*(第[一二三四五六七八九十百零\d]+[章节幕]|[-—*·=~]{3,}|\d+\s*$|【.+】)\s*$/.test(l));
  const blank = text.split(/\n\s*\n\s*\n/).length;
  return Math.max(1, marks.length || blank);
}
function syncMetrics() {
  const text = document.getElementById('fBody').value;
  const w = GD.countWords(text);
  const paras = text.split(/\n\s*\n/).filter(s => s.trim()).length || text.split('\n').filter(s => s.trim()).length;
  const dialog = (text.match(/[「“"『][^」”"』]{1,200}[」”"』]/g) || []).length;
  document.getElementById('pWords').textContent = GD.fmtWords(w);
  document.getElementById('pParas').textContent = paras;
  document.getElementById('pDialog').textContent = dialog;
  document.getElementById('pMin').textContent = Math.max(1, Math.round(w / 400));
  document.getElementById('fWords').value = w;
  document.getElementById('fSegs').value = segmentsOf(text) + ' 节';
  document.getElementById('upInfo').textContent =
    w ? `${GD.fmtWords(w)} 字 · ${dialog} 处对白 · 约 ${Math.max(1, Math.round(w / 400))} 分钟` : 'WAITING FOR TEXT';
}

/* ---------------- 封面 ---------------- */
function bindCover() {
  const input = document.getElementById('coverInput');
  const pick = () => input.click();
  document.getElementById('coverPick').addEventListener('click', pick);
  document.getElementById('coverPrev').addEventListener('click', pick);
  document.getElementById('coverClear').addEventListener('click', () => { COVER = ''; paintCover(); });
  input.addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    COVER = await GD.readImage(f, 900, 0.85);
    paintCover(); e.target.value = '';
  });
}
function paintCover() {
  const el = document.getElementById('coverPrev');
  el.innerHTML = COVER
    ? `<img src="${COVER}"><div class="spine"></div>`
    : `<div class="mask">
         <svg viewBox="0 0 32 32" width="26" height="26" fill="none">
           <rect x="4" y="7" width="24" height="18" rx="2" stroke="#868d97" stroke-width="1.3"/>
           <path d="M4 20l7-6 5 4 4-3 8 7" stroke="#868d97" stroke-width="1.3" stroke-linejoin="round"/>
           <circle cx="11" cy="13" r="1.8" fill="#868d97"/>
         </svg><div class="t">UPLOAD COVER</div>
       </div><div class="spine"></div>`;
}

/* ---------------- AI 卷首语 ---------------- */
async function genSummary() {
  const text = document.getElementById('fBody').value.trim();
  if (!text) { GD.toast('先放进正文'); return; }
  if (!GD.apiReady()) { GD.toast('还没配置 API：请先在「设置 → API」里填好接口与密钥'); return; }
  const btn = document.getElementById('aiSummary');
  btn.style.opacity = '.5'; btn.textContent = '正在读…';
  try {
    const out = await GD.ai([
      { role: 'system', content: '你是同人圈里一个很会写文案的读者。用中文写一句 30 字以内的卷首语，抓住这篇文的情绪与关系张力，不要剧透结局，不要用"这是一篇"这种句式，不要加引号，不要写标题。只输出这一句话。' },
      { role: 'user', content: text.slice(0, 3000) }
    ], { max_tokens: 120, temperature: 1 });
    document.getElementById('fSummary').value = out.trim().replace(/^["“]|["”]$/g, '');
  } catch (e) {
    GD.toast('卷首语生成失败：' + e.message, 3200);
    console.error('[共读屿] 卷首语生成失败', e);
  } finally {
    btn.style.opacity = '1';
    btn.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none"><path d="M12 4l1.8 5.2L19 11l-5.2 1.8L12 18l-1.8-5.2L5 11l5.2-1.8Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg> 让 AI 读一遍，替我拟一句卷首语`;
  }
}

/* ---------------- 编辑模式 ---------------- */
async function loadForEdit(id) {
  const w = await GD.workGet(id); if (!w) return;
  EDIT_ID = id;
  document.getElementById('pageTitle').textContent = '编 辑 档 案';
  document.getElementById('fBody').value = w.content || '';
  document.getElementById('fTitle').value = w.title || '';
  document.getElementById('fSummary').value = w.summary || '';
  document.getElementById('fNote').value = w.note || '';
  COVER = w.cover || ''; paintCover();
  const t = w.tags || {};
  document.getElementById('tCp').value = t.cp || '';
  document.getElementById('tFandom').value = t.fandom || '';
  document.getElementById('tAuthor').value = t.author || '';
  document.getElementById('tSource').value = t.source || '';
  document.getElementById('tShelf').value = t.shelf || '';
  document.getElementById('tCustom').value = (t.custom || []).join(', ');
  sel.types = new Set(t.types || []); sel.warns = new Set(t.warns || []);
  sel.rating = t.rating || '全年龄'; sel.status = t.status || '单篇完结'; sel.read = t.read || '未读';
  buildChips();
  PARSED = { name: '档案 №' + String(id).padStart(3, '0'), ext: 'FILE', size: 0 };
  showParsed(); syncMetrics();
}

/* ---------------- 入库 ---------------- */
async function save() {
  const content = document.getElementById('fBody').value.trim();
  let title = document.getElementById('fTitle').value.trim();
  if (!content) { GD.toast('正文还是空的'); return; }
  if (!title) title = guessTitle(content, PARSED.name) || '未命名篇目';

  const custom = document.getElementById('tCustom').value.split(/[,，]/).map(s => s.trim()).filter(Boolean);
  const wordCount = parseInt(document.getElementById('fWords').value) || GD.countWords(content);
  const cp = document.getElementById('tCp').value.trim();

  const base = EDIT_ID ? (await GD.workGet(EDIT_ID)) || {} : {};
  const work = Object.assign({}, base, {
    title, content, cover: COVER, wordCount,
    segments: segmentsOf(content),
    summary: document.getElementById('fSummary').value.trim(),
    note: document.getElementById('fNote').value.trim(),
    tags: {
      cp,
      fandom: document.getElementById('tFandom').value.trim(),
      author: document.getElementById('tAuthor').value.trim(),
      source: document.getElementById('tSource').value.trim(),
      shelf: document.getElementById('tShelf').value.trim() || cp || '散篇',
      types: [...sel.types], warns: [...sel.warns],
      rating: sel.rating, status: sel.status, read: sel.read,
      custom
    },
    createdAt: base.createdAt || Date.now(),
    updatedAt: Date.now(),
    progress: base.progress || 0,
    readMs: base.readMs || 0,
    lastReadAt: base.lastReadAt || 0
  });
  if (EDIT_ID) work.id = EDIT_ID;

  await GD.workPut(work);
  GD.toast(EDIT_ID ? '档案已更新' : '已封存入粮仓');
  setTimeout(() => GD.go('gongduyu.html'), 620);
}