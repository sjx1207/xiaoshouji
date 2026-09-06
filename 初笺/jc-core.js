/* ==========================================================================
   角初笺 · JUECHUJIAN — jc-core.js
   全站共用运行时：状态栏 / 数据库 / AI 调用 / 素材库 / 预设 / 我的资料 / 转场
   —— AI 配置一律复用 settings.js 已写入的 localStorage 键，绝不另起一套：
      luna_api_current = { baseUrl, apiKey }
      luna_api_model   = "模型 id"
      luna_tz          = 时区
========================================================================== */
(function (global) {
  'use strict';

  /* ============ 状态栏（与 index.html 完全同款逻辑） ============ */
  function updateTime() {
    var el = document.getElementById('statusTime');
    if (!el) return;
    var tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    var s;
    try {
      s = new Date().toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: false });
    } catch (e) {
      s = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
    }
    el.textContent = s;
  }

  function updateBattery() {
    var pctEl = document.getElementById('batPct');
    var innerEl = document.getElementById('batInner');
    function render(pct) {
      if (pctEl) pctEl.textContent = Math.round(pct);
      if (innerEl) innerEl.style.width = Math.max(6, Math.round(pct)) + '%';
    }
    if (navigator.getBattery) {
      navigator.getBattery().then(function (b) {
        render(b.level * 100);
        b.addEventListener('levelchange', function () { render(b.level * 100); });
      }).catch(function () { render(76); });
    } else { render(76); }
  }

  function bootChrome() {
    updateTime();
    updateBattery();
    setInterval(updateTime, 10000);
    document.body.classList.add('jc-enter');
    applyIsland();
  }

  /* 灵动岛样式同步（沿用 settings.js 的开关键） */
  function applyIsland() {
    var enabled = localStorage.getItem('luna_island_enabled') === 'true';
    var cap = document.querySelector('.si-minimal-capsule');
    if (!cap) return;
    cap.style.display = enabled === false ? '' : '';
  }

  /* ============ IndexedDB ============ */
  var DB_NAME = 'JueChuJianDB', DB_VER = 3, _db = null;
  var STORES = ['cards', 'assets', 'kv', 'convos', 'moments', 'vault', 'memories'];

  function openDB() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (res, rej) {
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        STORES.forEach(function (s) {
          if (!db.objectStoreNames.contains(s)) {
            if (s === 'kv') db.createObjectStore('kv');
            else db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
          }
        });
      };
      req.onsuccess = function () { _db = req.result; res(_db); };
      req.onerror = function () { rej(req.error); };
    });
  }

  function tx(store, mode) {
    return openDB().then(function (db) { return db.transaction(store, mode).objectStore(store); });
  }
  function wrap(request) {
    return new Promise(function (res, rej) {
      request.onsuccess = function () { res(request.result); };
      request.onerror = function () { rej(request.error); };
    });
  }

  var DB = {
    all: function (store) { return tx(store, 'readonly').then(function (s) { return wrap(s.getAll()); }); },
    get: function (store, id) { return tx(store, 'readonly').then(function (s) { return wrap(s.get(id)); }); },
    put: function (store, val) {
      return tx(store, 'readwrite').then(function (s) { return wrap(val.id ? s.put(val) : s.add(val)); });
    },
    del: function (store, id) { return tx(store, 'readwrite').then(function (s) { return wrap(s.delete(id)); }); },
    clear: function (store) { return tx(store, 'readwrite').then(function (s) { return wrap(s.clear()); }); },
    kvGet: function (k, def) {
      return tx('kv', 'readonly').then(function (s) { return wrap(s.get(k)); })
        .then(function (v) { return v === undefined ? def : v; })
        .catch(function () { return def; });
    },
    kvSet: function (k, v) { return tx('kv', 'readwrite').then(function (s) { return wrap(s.put(v, k)); }); }
  };

  /* ============ AI —— 复用 settings.js 的配置，不新写任何配置项 ============
     针对「各大模型输出格式不稳定」做了四层防线：
       1) 尽量走 response_format=json_object，网关不支持时自动降级重发
       2) 十级递进式文本清洗（代码块 / 前后废话 / 全角标点 / 单引号 / 尾逗号 /
          字符串内裸换行 / 截断补全）
       3) 解析失败后把原文丢回模型，要求「只重排为合法 JSON，不得改写内容」
       4) 仍失败则整轮重试，最多 3 轮，温度逐轮下调
  ============================================================== */
  var AI = {
    conf: function () {
      var cur = {};
      try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch (e) { cur = {}; }
      return {
        baseUrl: (cur.baseUrl || '').replace(/\/$/, ''),
        apiKey: cur.apiKey || '',
        model: localStorage.getItem('luna_api_model') || ''
      };
    },
    ready: function () {
      var c = AI.conf();
      return !!(c.baseUrl && c.apiKey && c.model);
    },

    _post: function (body) {
      var c = AI.conf();
      return fetch(c.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + c.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function (r) {
        if (!r.ok) {
          return r.text().then(function (t) {
            var e = new Error('HTTP ' + r.status + (t ? ' · ' + t.slice(0, 160) : ''));
            e.status = r.status; e.body = t;
            throw e;
          });
        }
        return r.json();
      }).then(function (d) {
        if (d && d.error) throw new Error(d.error.message || '接口返回错误');
        var m = d && d.choices && d.choices[0] && d.choices[0].message;
        var txt = (m && (m.content || m.reasoning_content)) || '';
        if (Array.isArray(txt)) {
          txt = txt.map(function (x) { return typeof x === 'string' ? x : (x.text || ''); }).join('');
        }
        return String(txt || '');
      });
    },

    /** 通用对话调用，返回纯文本 */
    chat: function (messages, opts) {
      opts = opts || {};
      if (!AI.ready()) return Promise.reject(new Error('尚未在「设置 · API」中完成接口配置'));
      var c = AI.conf();
      var base = {
        model: c.model,
        messages: messages,
        temperature: opts.temperature != null ? opts.temperature : 0.96,
        max_tokens: opts.max_tokens || 2600
      };
      if (opts.top_p != null) base.top_p = opts.top_p;

      var withFmt = opts.jsonMode ? Object.assign({}, base, { response_format: { type: 'json_object' } }) : base;

      return AI._post(withFmt).catch(function (err) {
        // 网关不认 response_format / 参数不兼容 → 降级重发
        if (opts.jsonMode) return AI._post(base);
        throw err;
      }).then(function (txt) {
        if (!txt || !txt.trim()) throw new Error('模型返回了空内容');
        return txt;
      });
    },

    /** 纯文本产出（HTML / CSS 之类），自动剥掉代码块围栏 */
    code: function (messages, opts) {
      return AI.chat(messages, opts).then(function (t) {
        return String(t).replace(/^[\s\S]*?```(?:html|css|js|javascript|xml)?\s*/i, function (m) {
          return /```/.test(m) ? '' : m;
        }).replace(/```[\s\S]*$/, '').trim() || String(t).trim();
      });
    },

    /**
     * 要求模型返回 JSON。失败会自动清洗 → 让模型自修 → 整轮重试。
     * opts.tries 默认 3
     */
    json: function (messages, opts) {
      opts = opts || {};
      var tries = opts.tries || 3;
      var baseTemp = opts.temperature != null ? opts.temperature : 0.96;

      function attempt(n) {
        var o = Object.assign({}, opts, {
          jsonMode: true,
          temperature: Math.max(0.35, baseTemp - n * 0.22)
        });
        return AI.chat(messages, o).then(function (txt) {
          try { return AI.parseJSON(txt); }
          catch (e) {
            if (n >= tries - 1) throw e;
            // 第三层：让模型自己把这段东西重排成合法 JSON
            return AI.chat([
              { role: 'system', content: '你是 JSON 修复器。把用户给你的内容原样重排为一个合法的 JSON 对象。严禁改写、删减、翻译任何实际内容，严禁添加解释，严禁使用 markdown 代码块，只输出 JSON 本身。所有标点必须是半角。' },
              { role: 'user', content: String(txt).slice(0, 12000) }
            ], { temperature: 0, max_tokens: o.max_tokens || 2600, jsonMode: true })
              .then(function (fixed) {
                try { return AI.parseJSON(fixed); }
                catch (e2) { return attempt(n + 1); }
              })
              .catch(function () { return attempt(n + 1); });
          }
        }).catch(function (e) {
          if (n >= tries - 1) throw e;
          return attempt(n + 1);
        });
      }
      return attempt(0);
    },

    /** 十级递进清洗，任一级能 parse 就返回 */
    parseJSON: function (txt) {
      if (txt == null) throw new Error('空回复');
      var raw = String(txt);
      var cands = [];
      function push(s) { if (s && cands.indexOf(s) < 0) cands.push(s); }

      var s = raw.replace(/^\uFEFF/, '').replace(/[\u200B-\u200D\u2060]/g, '').trim();
      push(s);

      // 1 · 剥代码块
      var fence = s.match(/```(?:json|javascript|js)?\s*([\s\S]*?)```/i);
      if (fence) { s = fence[1].trim(); push(s); }
      s = s.replace(/^```(?:json|javascript|js)?/i, '').replace(/```$/, '').trim();
      push(s);

      // 2 · 剥掉 JSON 前后的自然语言
      var oi = s.indexOf('{'), oj = s.lastIndexOf('}');
      var ai_ = s.indexOf('['), aj = s.lastIndexOf(']');
      var objSeg = (oi > -1 && oj > oi) ? s.slice(oi, oj + 1) : '';
      var arrSeg = (ai_ > -1 && aj > ai_) ? s.slice(ai_, aj + 1) : '';
      // 谁在外层用谁
      var core = objSeg;
      if (arrSeg && (oi < 0 || (ai_ > -1 && ai_ < oi))) core = arrSeg;
      push(core);

      var work = core || s;

      // 3 · 全角标点归位（只动 JSON 骨架符号）
      var fw = work
        .replace(/[\u201C\u201D\u2033]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\uFF1A/g, ':')
        .replace(/\uFF0C(?=\s*[""\{\[\]\}])/g, ',')
        .replace(/\uFF08/g, '(').replace(/\uFF09/g, ')');
      push(fw); work = fw;

      // 4 · 去掉行注释与尾逗号
      var nc = work.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1');
      push(nc); work = nc;

      // 5 · 单引号键值 → 双引号
      var sq = work
        .replace(/([{,]\s*)'([^'\n]+)'\s*:/g, '$1"$2":')
        .replace(/:\s*'([^'\n]*)'/g, function (m, v) { return ': "' + v.replace(/"/g, '\\"') + '"'; })
        .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":');
      push(sq);

      // 6 · 字符串内的裸换行 / 制表符转义
      function escInStr(str) {
        var out = '', inS = false, esc = false;
        for (var i = 0; i < str.length; i++) {
          var ch = str[i];
          if (esc) { out += ch; esc = false; continue; }
          if (ch === '\\') { out += ch; esc = true; continue; }
          if (ch === '"') { inS = !inS; out += ch; continue; }
          if (inS && ch === '\n') { out += '\\n'; continue; }
          if (inS && ch === '\r') { continue; }
          if (inS && ch === '\t') { out += '\\t'; continue; }
          out += ch;
        }
        return out;
      }
      var en = escInStr(work); push(en);
      var en2 = escInStr(sq); push(en2);

      // 7 · 截断补全（模型被 max_tokens 砍断时最常见）
      function repair(str) {
        var stack = [], inS = false, esc = false, i;
        for (i = 0; i < str.length; i++) {
          var ch = str[i];
          if (esc) { esc = false; continue; }
          if (ch === '\\') { esc = true; continue; }
          if (ch === '"') { inS = !inS; continue; }
          if (inS) continue;
          if (ch === '{' || ch === '[') stack.push(ch);
          else if (ch === '}' || ch === ']') stack.pop();
        }
        var out = str;
        if (inS) out += '"';
        out = out.replace(/,\s*$/, '');
        // 半截的 "key":  → 补 null
        out = out.replace(/"([^"]*)"\s*:\s*$/, '"$1": null');
        for (i = stack.length - 1; i >= 0; i--) out += (stack[i] === '{' ? '}' : ']');
        return out.replace(/,\s*([}\]])/g, '$1');
      }
      push(repair(en)); push(repair(en2)); push(repair(work));

      for (var k = 0; k < cands.length; k++) {
        try {
          var v = JSON.parse(cands[k]);
          if (v && typeof v === 'object') return v;
        } catch (e) {}
      }
      var err = new Error('模型输出的格式不合法（已尝试 ' + cands.length + ' 种修复）');
      err.raw = raw.slice(0, 400);
      throw err;
    },

    /** 从任意结构里捞出第一个数组，兼容模型乱套外层键的情况 */
    firstArray: function (data, keys) {
      if (Array.isArray(data)) return data;
      if (!data || typeof data !== 'object') return [];
      var i, k;
      keys = keys || [];
      for (i = 0; i < keys.length; i++) {
        if (Array.isArray(data[keys[i]])) return data[keys[i]];
      }
      var ks = Object.keys(data);
      for (i = 0; i < ks.length; i++) {
        if (Array.isArray(data[ks[i]])) return data[ks[i]];
      }
      for (i = 0; i < ks.length; i++) {
        if (data[ks[i]] && typeof data[ks[i]] === 'object') {
          var r = AI.firstArray(data[ks[i]], keys);
          if (r.length) return r;
        }
      }
      return [];
    }
  };

  /* ============ 素材库（背景 / 头像） ============ */
  var Gallery = {
    all: function () { return DB.all('assets'); },
    byType: function (type) {
      return DB.all('assets').then(function (list) {
        return list.filter(function (a) { return a.type === type; });
      });
    },
    add: function (type, dataUrl, name) {
      return DB.put('assets', { type: type, data: dataUrl, name: name || '', ts: Date.now() });
    },
    del: function (id) { return DB.del('assets', id); },
    /** 随机取一张，用于角色卡生成 */
    pick: function (type, excludeSet) {
      return Gallery.byType(type).then(function (list) {
        if (!list.length) return null;
        var pool = list;
        if (excludeSet && excludeSet.size && list.length > excludeSet.size) {
          pool = list.filter(function (a) { return !excludeSet.has(a.id); });
          if (!pool.length) pool = list;
        }
        return pool[Math.floor(Math.random() * pool.length)];
      });
    }
  };

  /* ============ 预设 ============ */
  var PRESET_DEFAULT = {
    ageRange: [],        // 多选
    gender: [],
    mbti: [],
    persona: [],         // 性格
    lang: [],
    identity: [],        // 身份职业
    genre: [],           // 题材风格
    era: [],             // 时代背景
    look: [],            // 外貌气质
    tone: [],            // 情感浓度
    relationBias: [],    // 关系倾向
    nameStyle: [],       // 名字风格
    address: [],         // 称呼偏好
    avoid: '',           // 排除项（自由输入）
    extra: ''            // 补充要求
  };
  var Preset = {
    get: function () {
      return DB.kvGet('preset', null).then(function (p) {
        return Object.assign({}, PRESET_DEFAULT, p || {});
      });
    },
    set: function (p) { return DB.kvSet('preset', p); },
    /** 转成给模型的自然语言约束 */
    toPrompt: function (p) {
      var L = [];
      function push(label, arr) {
        if (arr && arr.length) L.push('· ' + label + '：' + arr.join('、') + '（必须从中取值）');
      }
      push('年龄区间', p.ageRange);
      push('性别', p.gender);
      push('MBTI 人格', p.mbti);
      push('性格基调', p.persona);
      push('母语 / 使用语言', p.lang);
      push('身份职业', p.identity);
      push('题材风格', p.genre);
      push('时代与地域背景', p.era);
      push('外貌气质', p.look);
      push('情感浓度', p.tone);
      push('潜在关系倾向', p.relationBias);
      push('姓名风格', p.nameStyle);
      push('习惯称呼方式', p.address);
      if (p.avoid) L.push('· 明确排除：' + p.avoid);
      if (p.extra) L.push('· 额外要求：' + p.extra);
      return L.length ? L.join('\n') : '（用户未设定预设，自由发挥，但仍须遵守言情向硬性规则）';
    }
  };

  /* ============ 我的资料（供 AI 读取） ============ */
  var PROFILE_DEFAULT = {
    name: '未署名', handle: 'juechu', bio: '', avatar: '', cover: '',
    gender: '', age: '', mbti: '', tags: [],
    personaId: null, personas: []   // 人设存档
  };
  var Profile = {
    get: function () {
      return DB.kvGet('profile', null).then(function (p) {
        return Object.assign({}, PROFILE_DEFAULT, p || {});
      });
    },
    set: function (p) { return DB.kvSet('profile', p); },
    activePersona: function (p) {
      if (!p || !p.personas || !p.personas.length) return null;
      var found = p.personas.filter(function (x) { return x.id === p.personaId; })[0];
      return found || p.personas[0];
    },
    toPrompt: function (p) {
      var per = Profile.activePersona(p);
      var L = ['用户在本平台的资料：'];
      L.push('· 昵称：' + (p.name || '未署名') + '（@' + (p.handle || 'juechu') + '）');
      if (p.gender) L.push('· 性别：' + p.gender);
      if (p.age) L.push('· 年龄：' + p.age);
      if (p.mbti) L.push('· MBTI：' + p.mbti);
      if (p.bio) L.push('· 简介：' + p.bio);
      if (p.tags && p.tags.length) L.push('· 标签：' + p.tags.join('、'));
      if (per) {
        L.push('· 当前启用人设「' + per.title + '」：' + (per.body || ''));
      }
      return L.join('\n');
    }
  };

  /* ============ 言情向硬性规则（全站生成共用） ============ */
  var ROMANCE_RULE = [
    '【世界观硬性规则】',
    '1. 只生成言情小说 / 都市情感 / 古风言情 / 幻想言情 向的虚构角色，禁止写实纪实向、禁止普通路人化的现实人物设定。',
    '2. 姓名必须具备小说质感：讲究音韵与字面美感，可中式（如 沈砚辞、江晚吟、裴予安）、可西式（如 Elias Rhode、Verena Sole）、可日韩式，但一律禁止「张伟」「李娜」「王强」这类现实户籍化的大众姓名。',
    '3. 人物需具备戏剧张力：身份反差、隐秘往事、情感钝感或炽烈、克制或占有欲等，至少一处令人过目不忘的记忆点。',
    '4. 语气与文风偏文学化、有画面感，避免说明书式的干瘪罗列。',
    '5. 禁止在任何字段里出现 emoji；禁止出现「作为AI」「语言模型」等出戏表述。',
    '6. 严禁生成任何与用户的既有关系（如"你的青梅竹马""暗恋你三年"）——该角色与用户此刻尚未相识。'
  ].join('\n');

  /* ============ 时间感知（全站 AI 共用，避免夜里说白天） ============ */
  var Time = {
    tz: function () { return localStorage.getItem('luna_tz') || 'Asia/Shanghai'; },
    parts: function (ts) {
      var d = ts ? new Date(ts) : new Date();
      var f;
      try {
        f = new Intl.DateTimeFormat('zh-CN', {
          timeZone: Time.tz(), year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', weekday: 'long', hour12: false
        }).formatToParts(d);
      } catch (e) {
        f = new Intl.DateTimeFormat('zh-CN', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', weekday: 'long', hour12: false
        }).formatToParts(d);
      }
      var o = {};
      f.forEach(function (x) { o[x.type] = x.value; });
      o.hour = String(parseInt(o.hour, 10) % 24);
      return o;
    },
    band: function (h) {
      h = Number(h);
      if (h < 5) return { cn: '凌晨', mood: '万籁俱寂，此刻还醒着的人多半有心事' };
      if (h < 8) return { cn: '清晨', mood: '天刚亮，街上还很空' };
      if (h < 11) return { cn: '上午', mood: '一天刚铺开' };
      if (h < 13) return { cn: '正午', mood: '日头最盛，多半在吃饭或午歇' };
      if (h < 17) return { cn: '午后', mood: '光线偏暖，容易走神' };
      if (h < 19) return { cn: '傍晚', mood: '天色正在落下来' };
      if (h < 23) return { cn: '夜里', mood: '灯都亮着，是最容易说真话的时段' };
      return { cn: '深夜', mood: '该睡而未睡，情绪比白天薄一层' };
    },
    /** 供 system prompt 使用的一段时间说明 */
    prompt: function () {
      var p = Time.parts();
      var b = Time.band(p.hour);
      return [
        '【当前真实时间 —— 必须据此说话，禁止与之矛盾】',
        p.year + ' 年 ' + p.month + ' 月 ' + p.day + ' 日 ' + (p.weekday || '') + ' ' +
          p.hour + ':' + p.minute + '（' + b.cn + '）',
        '时段感受：' + b.mood + '。',
        '你的问候、作息、正在做的事、提到的光线与声音，都必须与这个时刻相符；' +
          '深夜就不要说早安，白天就不要说"这么晚还没睡"。'
      ].join('\n');
    },
    clock: function (ts) {
      var p = Time.parts(ts);
      return p.hour + ':' + p.minute;
    },
    dayKey: function (ts) {
      var p = Time.parts(ts);
      return p.year + '-' + p.month + '-' + p.day;
    }
  };

  /* ============ 生成库 —— 凡是花过额度生成的，一律留档 ============
     不管用户喜不喜欢、有没有收进存档，只要模型吐出来过就进这里。
     状态：new 未处理 / liked 已收藏(同时进 cards) / passed 已划走 / trashed 手动清除
  ============================================================== */
  var Vault = {
    add: function (card, meta) {
      var rec = Object.assign({}, card);
      delete rec.id;
      rec.vaultTs = Date.now();
      rec.state = (meta && meta.state) || 'new';
      rec.origin = (meta && meta.origin) || 'meet';
      rec.model = localStorage.getItem('luna_api_model') || '';
      rec.batch = (meta && meta.batch) || '';
      return DB.put('vault', rec);
    },
    addMany: function (arr, meta) {
      var batch = JC_uid();
      return Promise.all(arr.map(function (c) {
        return Vault.add(c, Object.assign({ batch: batch }, meta || {}));
      })).then(function () { return batch; });
    },
    all: function () {
      return DB.all('vault').then(function (l) {
        return l.filter(function (x) { return x.state !== 'trashed'; })
                .sort(function (a, b) { return b.vaultTs - a.vaultTs; });
      });
    },
    mark: function (uidOrId, state) {
      return DB.all('vault').then(function (l) {
        var hit = l.filter(function (x) { return x.id === uidOrId || x.uid === uidOrId; })[0];
        if (!hit) return null;
        hit.state = state;
        return DB.put('vault', hit);
      });
    },
    del: function (id) { return DB.del('vault', id); }
  };

  /* ============ 聊天全局设置（背景 / 字体 / 行为） ============ */
  var CHAT_CFG_DEFAULT = {
    bg: '',              // dataURL；空则用角色卡背景
    bgScope: 'global',   // global 全局 / perChar 按角色
    bgFit: 'cover',
    bgDim: 0,            // 0 = 完全不加任何遮罩（默认）
    font: 'song',        // song / hei / kai / mono / serifEn
    fontSize: 14.5,
    bubbleAlpha: 0.9,
    showInner: true,     // 心声状态栏
    voiceRate: 0.18,     // AI 发语音的概率上限
    autoMemory: true,
    memoryEvery: 24      // 每积累多少条消息自动归档一次
  };
  var ChatCfg = {
    get: function () {
      return DB.kvGet('chatcfg', null).then(function (v) {
        return Object.assign({}, CHAT_CFG_DEFAULT, v || {});
      });
    },
    set: function (v) { return DB.kvSet('chatcfg', v); },
    FONTS: {
      song: { cn: '宋体 · 书卷', css: '"Songti SC","Source Han Serif SC","Noto Serif SC",serif' },
      hei:  { cn: '黑体 · 清峻', css: '"PingFang SC","Inter","Helvetica Neue",sans-serif' },
      kai:  { cn: '楷体 · 手书', css: '"Kaiti SC","STKaiti",serif' },
      mono: { cn: '等宽 · 冷调', css: '"Space Mono","SF Mono",monospace' },
      serifEn: { cn: '西文衬线', css: '"Cormorant Garamond","Songti SC",serif' }
    }
  };

  /* ============ 记忆系统 ============
     auto  —— 每积累 N 条消息由模型自动压缩归档
     manual—— 用户在聊天设置里手动「立此存照」
     pin   —— 用户手动钉住的关键事实，永远进上下文
  ============================================================== */
  var Memory = {
    list: function (convoId) {
      return DB.all('memories').then(function (l) {
        return l.filter(function (m) { return m.convoId === convoId; })
                .sort(function (a, b) { return b.ts - a.ts; });
      });
    },
    add: function (convoId, rec) {
      return DB.put('memories', Object.assign({
        convoId: convoId, ts: Date.now(), kind: 'auto', title: '', body: '', pinned: false
      }, rec));
    },
    del: function (id) { return DB.del('memories', id); },
    toggle: function (id) {
      return DB.get('memories', id).then(function (m) {
        if (!m) return null; m.pinned = !m.pinned; return DB.put('memories', m);
      });
    },
    /** 拼进 system prompt 的记忆块：钉住的全给，其余给最近若干条 */
    toPrompt: function (list, keep) {
      if (!list || !list.length) return '';
      var pin = list.filter(function (m) { return m.pinned; });
      var rest = list.filter(function (m) { return !m.pinned; }).slice(0, keep || 6);
      var L = ['【长期记忆 —— 这些都真实发生过，说话时必须与之一致】'];
      pin.forEach(function (m) { L.push('◆［钉］' + (m.title ? m.title + '：' : '') + m.body); });
      rest.forEach(function (m) { L.push('· ' + (m.title ? m.title + '：' : '') + m.body); });
      return L.join('\n');
    }
  };

  /* ============ 语音时长模拟 ============
     按语种字符密度估算说完这段话要多久，比固定值真实得多。
  ============================================================== */
  function voiceSeconds(text) {
    var t = String(text || '').trim();
    if (!t) return 1;
    var cjk = (t.match(/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
    var latin = (t.match(/[A-Za-z]+/g) || []).join(' ').split(/\s+/).filter(Boolean).length;
    var punct = (t.match(/[，。！？、…—,.!?;:]/g) || []).length;
    var sec = cjk / 4.4 + latin / 2.6 + punct * 0.22 + 0.8;
    sec = sec * (0.92 + Math.random() * 0.2);           // 人不是节拍器
    return Math.max(1, Math.min(120, Math.round(sec)));
  }

  /* ============ 工具 ============ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, ms) {
    var el = document.getElementById('jcToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jcToast'; el.className = 'jc-toast';
      (document.querySelector('.phone-frame') || document.body).appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2200);
  }
  /** 丝滑跳转：先淡出遮罩再换页 */
  function go(url) {
    var v = document.getElementById('jcVeil');
    if (!v) {
      v = document.createElement('div');
      v.id = 'jcVeil'; v.className = 'jc-veil';
      document.body.appendChild(v);
    }
    requestAnimationFrame(function () {
      v.classList.add('on');
      setTimeout(function () { location.href = url; }, 300);
    });
  }
  function back(fallback) {
    if (history.length > 1) { history.back(); }
    else go(fallback || 'juechu.html');
  }
  function fileToDataURL(file, maxW) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () {
        if (!maxW) return res(fr.result);
        var img = new Image();
        img.onload = function () {
          var scale = Math.min(1, maxW / img.width);
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = function () { res(fr.result); };
        img.src = fr.result;
      };
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });
  }
  function JC_uid() { return uid(); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function rand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function timeAgo(ts) {
    var d = (Date.now() - ts) / 1000;
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    if (d < 604800) return Math.floor(d / 86400) + ' 天前';
    var dt = new Date(ts);
    return (dt.getMonth() + 1) + ' 月 ' + dt.getDate() + ' 日';
  }

  /* 页面从 bfcache 回来时刷新一次，保持数据实时 */
  window.addEventListener('pageshow', function (e) { if (e.persisted) location.reload(); });

  global.JC = {
    bootChrome: bootChrome, updateTime: updateTime, updateBattery: updateBattery,
    DB: DB, AI: AI, Gallery: Gallery, Preset: Preset, Profile: Profile,
    Time: Time, Vault: Vault, ChatCfg: ChatCfg, Memory: Memory,
    CHAT_CFG_DEFAULT: CHAT_CFG_DEFAULT, voiceSeconds: voiceSeconds,
    ROMANCE_RULE: ROMANCE_RULE, PRESET_DEFAULT: PRESET_DEFAULT,
    esc: esc, toast: toast, go: go, back: back,
    fileToDataURL: fileToDataURL, uid: uid, rand: rand, pick: pick, timeAgo: timeAgo
  };
})(window);