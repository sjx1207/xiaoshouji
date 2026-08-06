/* ================================================================
   世界书运行时共享模块 — worldbook-runtime.js
   ------------------------------------------------------------------
   这是 worldbook.js（世界书管理页）与 chatsetting.js（世界书设置面板）
   chatroom.js（实际对话生成）三者之间缺失的"中间层"。

   职责：
   1. 读取 LunaWorldBookDB(entries)，与 LunaCharDB(chars) 做关联；
   2. 按「角色」维度读写世界书配置（luna_wb_config_<charId>），
      做到真正的「保存后专属于该角色」；
   3. 在每一轮 AI 回复前，根据配置 + 关键词扫描 + 概率 + 常驻规则，
      解析出这一轮应该生效的条目列表；
   4. 把条目列表拼成一段可注入 prompt 的文本块，注入强度与人设
      持平（不高于、不破坏人设本身），主要起"设定补全"和"防止
      OOC/掉设定"的作用，而不是越权改写角色人格或进行越狱。

   全局角色 vs 专属角色：
   - 条目 e.chars 为空数组或未设置 → 全局条目，对所有角色生效；
   - 条目 e.chars 包含某个 charId → 仅对该角色生效（专属角色可以
     同时勾选多个角色，逻辑上仍视为"专属"，只是专属给这几个角色）。

   本文件不依赖 worldbook.js 内部变量，只通过同一个 IndexedDB
   （LunaWorldBookDB / LunaCharDB）读取数据，可以被世界书页、
   世界书设置页、聊天页三处同时引入，互不冲突。
================================================================ */

(function (global) {
  'use strict';

  /* ── IndexedDB：世界书条目（与 worldbook.js 保持同名同版本，读同一份数据） ── */
  let _rtWbDb = null;
  function rtOpenWbDB() {
    return new Promise((resolve, reject) => {
      if (_rtWbDb) { resolve(_rtWbDb); return; }
      const req = indexedDB.open('LunaWorldBookDB', 2);
      req.onupgradeneeded = e => {
        if (!e.target.result.objectStoreNames.contains('entries')) {
          e.target.result.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = e => { _rtWbDb = e.target.result; resolve(_rtWbDb); };
      req.onerror   = () => reject('WB Runtime DB Error');
    });
  }

  async function rtGetAllEntries() {
    try {
      const db = await rtOpenWbDB();
      if (!db.objectStoreNames.contains('entries')) return [];
      return await new Promise(res => {
        const r = db.transaction('entries').objectStore('entries').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror   = () => res([]);
      });
    } catch (e) { return []; }
  }

  /* 写入/更新一条条目（有 id 则更新，否则新增），与 worldbook.js 的 saveEntry_db 行为一致，
     供 chatsetting.js 的「导入世界书」在设置面板内直接写入使用，不需要跳转到世界书页。 */
  async function rtSaveEntry(data) {
    try {
      const db = await rtOpenWbDB();
      return await new Promise(res => {
        const tx    = db.transaction('entries', 'readwrite');
        const store = tx.objectStore('entries');
        const req   = data.id ? store.put(data) : store.add(data);
        req.onsuccess = () => res(req.result);
        req.onerror   = () => res(null);
      });
    } catch (e) { return null; }
  }

  async function rtDeleteEntry(id) {
    try {
      const db = await rtOpenWbDB();
      return await new Promise(res => {
        const tx = db.transaction('entries', 'readwrite');
        tx.objectStore('entries').delete(id);
        tx.oncomplete = () => res(true);
        tx.onerror    = () => res(false);
      });
    } catch (e) { return false; }
  }

  /* ── IndexedDB：角色档案（只读，用于校验 charId、展示角色名等） ── */
  function rtOpenCharDB() {
    return new Promise((resolve, reject) => {
      const probe = indexedDB.open('LunaCharDB');
      probe.onsuccess = e => resolve(e.target.result);
      probe.onerror   = e => reject(e.target.error);
    });
  }

  async function rtGetAllChars() {
    try {
      const db = await rtOpenCharDB();
      if (!db.objectStoreNames.contains('chars')) return [];
      return await new Promise(res => {
        const r = db.transaction('chars').objectStore('chars').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror   = () => res([]);
      });
    } catch (e) { return []; }
  }

  /* ================================================================
     每角色配置：luna_wb_config_<charId>（未识别到角色时用 luna_wb_config_global）
     字段：enabled / global / trigger / dedup / maxEntries / maxToken /
           position('before'|'after'|'system') / disabledIds(number[])
  ================================================================ */
  const DEFAULT_CONFIG = {
    enabled: true,
    global: true,
    trigger: true,
    dedup: true,
    maxEntries: 10,
    maxToken: 2000,
    position: 'before',
    disabledIds: [],
  };

  function rtConfigKey(charId) {
    return charId ? `luna_wb_config_${charId}` : 'luna_wb_config_global';
  }

  function getConfig(charId) {
    try {
      const raw = localStorage.getItem(rtConfigKey(charId));
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed, disabledIds: Array.isArray(parsed.disabledIds) ? parsed.disabledIds : [] };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function setConfig(charId, cfg) {
    try {
      localStorage.setItem(rtConfigKey(charId), JSON.stringify({ ...DEFAULT_CONFIG, ...cfg }));
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ── 取与某角色相关的条目：全局条目 + 专属绑定该角色的条目，按配置过滤 enabled/disabledIds ── */
  async function getForChar(charId) {
    const [entries, cfg] = await Promise.all([rtGetAllEntries(), Promise.resolve(getConfig(charId))]);
    return entries.filter(e => {
      const scopedToChars = Array.isArray(e.chars) && e.chars.length > 0;
      if (scopedToChars) {
        // 专属条目：只有绑定了当前角色才可见
        if (!charId || !e.chars.includes(charId)) return false;
      } else {
        // 全局条目：受"全局作用范围"开关控制
        if (!cfg.global) return false;
      }
      return true;
    });
  }

  /* ================================================================
     关键词匹配
     - 主关键词（keywords）：任意一个命中即可触发；
     - 副关键词（keywordsSec）：可选的"必须同时命中"的二次过滤，
       用于更精确的触发（例如主词"深夜"+副词"睡不着"才触发某条）。
       若副关键词为空，则只按主关键词判断。
  ================================================================ */
  function rtSplitKw(s) {
    return String(s || '').split(',').map(x => x.trim()).filter(Boolean);
  }

  function rtTextHasAny(text, kws) {
    if (!kws.length) return false;
    const lower = text.toLowerCase();
    return kws.some(k => lower.includes(k.toLowerCase()));
  }

  /* ================================================================
     解析当前应生效的条目（核心逻辑）
     参数：
       charId    — 当前角色 id（可能为 null，未识别到角色时按全局处理）
       scanText  — 最近若干条对话拼接文本，用于关键词扫描
     返回：{ entries: Entry[] }，已按优先级排序、按 maxEntries/maxToken 截断
  ================================================================ */
  async function resolveActiveEntries(charId, scanText) {
    const cfg = getConfig(charId);
    if (!cfg.enabled) return { entries: [] };

    const candidates = await getForChar(charId);
    const text = String(scanText || '');

    let active = candidates.filter(e => {
      if (e.enabled === false) return false;
      if (cfg.disabledIds.includes(e.id)) return false; // 该角色下被单独关闭

      if (e.mode === 'constant') return true; // 常驻条目必定候选

      if (!cfg.trigger) return false; // 关键词扫描总开关关闭时，非常驻条目一律不触发

      const primary = rtSplitKw(e.keywords);
      const secondary = rtSplitKw(e.keywordsSec);
      if (!primary.length) return false;

      const hitPrimary = rtTextHasAny(text, primary);
      if (!hitPrimary) return false;
      if (secondary.length && !rtTextHasAny(text, secondary)) return false;

      return true;
    });

    // 概率过滤（仅对非常驻条目生效；常驻条目视为规则铁律，不应被随机跳过）
    active = active.filter(e => {
      if (e.mode === 'constant') return true;
      const p = typeof e.probability === 'number' ? e.probability : 100;
      if (p >= 100) return true;
      return (Math.random() * 100) < p;
    });

    // 互斥组：同一 group 内只保留优先级最高的一条，避免设定冲突
    if (cfg.dedup) {
      const byGroup = new Map();
      const noGroup = [];
      active.forEach(e => {
        const g = (e.group || '').trim();
        if (!g) { noGroup.push(e); return; }
        const cur = byGroup.get(g);
        if (!cur || (e.priority ?? 5) > (cur.priority ?? 5)) byGroup.set(g, e);
      });
      active = [...noGroup, ...byGroup.values()];
    }

    // 排序：常驻优先，其次按优先级降序
    active.sort((a, b) => {
      const ac = a.mode === 'constant' ? 0 : 1;
      const bc = b.mode === 'constant' ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return (b.priority ?? 5) - (a.priority ?? 5);
    });

    // 按条目数上限截断
    if (active.length > cfg.maxEntries) active = active.slice(0, cfg.maxEntries);

    // 按 Token 预算截断（粗略估算：中文约 1.6 字/token，保守用 1.5 字/token 估算）
    let budget = cfg.maxToken;
    const withinBudget = [];
    for (const e of active) {
      const len = (e.detail || '').length + (e.title || '').length + (e.sub || '').length;
      const estTokens = Math.ceil(len / 1.5);
      if (estTokens > budget && withinBudget.length > 0) break; // 至少保留一条，避免完全清空
      withinBudget.push(e);
      budget -= estTokens;
      if (budget <= 0) break;
    }

    return { entries: withinBudget, position: cfg.position };
  }

  /* ================================================================
     拼接 prompt 文本块
     设计原则（对应"执行级别调高但要和人设齐平"的需求）：
     - 不使用"最高优先级""必须无条件服从"这类会压过角色人设本身的
       措辞，世界书的定位是"角色本就知道的背景设定"，不是外挂指令；
     - 常驻条目（通常是人设铁律/格式规范）单独归入【核心设定】，
       视为人设的延伸而非独立指令层，从而与人设保持同一权重，
       避免互相打架导致 OOC；
     - 触发类条目归入【相关背景】，标注为该角色本就知晓的背景知识，
       供角色自然地"记得"这些设定，而不是生硬复述；
     - 完全不包含任何越狱/破限话术——因为条目已经和人设同权重注入，
       正常情况下不需要额外的"强制扮演"话术也能贴合人设。
  ================================================================ */
  function buildPromptBlock(entries) {
    if (!Array.isArray(entries) || entries.length === 0) return '';

    const constant = entries.filter(e => e.mode === 'constant');
    const triggered = entries.filter(e => e.mode !== 'constant');

    const fmt = (e) => {
      const head = e.title ? `· ${e.title}` : '· 未命名设定';
      const sub = e.sub ? `（${e.sub}）` : '';
      const body = (e.detail || '').trim();
      return body ? `${head}${sub}\n${body}` : `${head}${sub}`;
    };

    let block = `\n【你已知的世界设定 — 这些是你本就知道、内化于身的背景信息，不是外部资料，说话时自然地把它当成常识来用，不要机械复述或逐条对照】\n`;

    if (constant.length) {
      block += `\n〔核心设定 · 与你的人设同等重要，遵循时不要显得刻意〕\n`;
      block += constant.map(fmt).join('\n\n');
    }

    if (triggered.length) {
      block += `\n\n〔相关背景 · 当前话题触发的设定，仅在自然聊到相关内容时体现〕\n`;
      block += triggered.map(fmt).join('\n\n');
    }

    block += `\n\n以上设定的优先级与你的角色人设一致：如果某条设定与你的核心人格、说话方式明显冲突，以人设为准，不要因为世界设定而OOC；如果不冲突，则自然地让这些设定体现在你的言行、记忆和反应里。`;

    return block;
  }

  /* ================================================================
     清空「当前角色」下的世界书关联（供聊天设置页的「清空当前角色条目」使用）
     不是物理删库，规则如下：
     - 全局条目（chars 为空）：不删除条目本身，只把它加进该角色的
       disabledIds，做到"仅本角色下不再生效"，不影响其他角色；
     - 专属条目（chars 包含该角色）：
       · 如果只绑定了这一个角色 → 物理删除（不会有其他角色再用到它）；
       · 如果同时绑定了其他角色 → 只把当前角色从 chars[] 里摘掉，
         条目本身连同对其他角色的绑定继续保留。
     返回 { affected } 表示受影响的条目数，便于 UI 提示。
  ================================================================ */
  async function clearForChar(charId) {
    const entries = await getForChar(charId);
    const cfg = getConfig(charId);
    const disabledSet = new Set(cfg.disabledIds || []);
    let affected = 0;

    for (const e of entries) {
      const scopedToChars = Array.isArray(e.chars) && e.chars.length > 0;
      if (!scopedToChars) {
        // 全局条目：仅在该角色下加入禁用列表
        if (!disabledSet.has(e.id)) { disabledSet.add(e.id); affected++; }
        continue;
      }
      if (!charId) continue;
      if (e.chars.length === 1 && e.chars[0] === charId) {
        // 仅绑定了当前角色，直接删除条目本身
        await rtDeleteEntry(e.id);
        affected++;
      } else if (e.chars.includes(charId)) {
        // 同时绑定了其他角色，只摘掉当前角色
        const updated = { ...e, chars: e.chars.filter(id => id !== charId) };
        await rtSaveEntry(updated);
        affected++;
      }
    }

    setConfig(charId, { ...cfg, disabledIds: [...disabledSet] });
    return { affected };
  }

  /* ── 暴露全局接口 ── */
  global.LunaWorldBookRuntime = {
    getConfig,
    setConfig,
    getForChar,
    resolveActiveEntries,
    buildPromptBlock,
    clearForChar,
    // 供调试/扩展及 chatsetting.js 导入功能使用
    _getAllEntries: rtGetAllEntries,
    _getAllChars: rtGetAllChars,
    _saveEntry: rtSaveEntry,
    _deleteEntry: rtDeleteEntry,
  };

})(window);