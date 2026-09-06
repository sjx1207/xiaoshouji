/* ==========================================================
   dn-ai.js — AI 调用层
   复用 Luna「设置 → API」里保存的配置：
     localStorage.luna_api_current = { baseUrl, apiKey }
     localStorage.luna_api_model   = 模型名
   注意：全局只有「评论区」会自动调用；其余一律由用户主动触发。
   ========================================================== */
(function () {

  function cfg() {
    let c = {};
    try { c = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch (e) { }
    return {
      baseUrl: (c.baseUrl || '').trim().replace(/\/$/, ''),
      apiKey: (c.apiKey || '').trim(),
      model: (localStorage.getItem('luna_api_model') || '').trim()
    };
  }

  function ready() {
    const c = cfg();
    return !!(c.baseUrl && c.apiKey && c.model);
  }

  /**
   * 基础对话
   * @param {Array} messages  [{role,content}]
   * @param {Object} opt      { maxTokens, temperature }
   */
  async function chat(messages, opt) {
    opt = opt || {};
    const c = cfg();
    if (!ready()) throw new Error('尚未配置 AI 接口（设置 → API）');

    const body = {
      model: c.model,
      messages,
      // token 给足冗余，避免长人设 / 长正文被截断导致格式崩掉
      max_tokens: opt.maxTokens || 8000,
      temperature: typeof opt.temperature === 'number' ? opt.temperature : 0.95,
      top_p: 0.95
    };

    const resp = await fetch(c.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + c.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      let t = '';
      try { t = (await resp.text()).slice(0, 160); } catch (e) { }
      throw new Error('HTTP ' + resp.status + (t ? ' · ' + t : ''));
    }
    const data = await resp.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    let out = (msg && (msg.content || msg.reasoning_content)) || '';
    if (Array.isArray(out)) out = out.map(x => x.text || '').join('');
    if (!out) throw new Error('模型没有返回内容');
    return out.trim();
  }

  /* ---------- JSON 抽取（容错） ---------- */
  function extractJSON(text) {
    if (!text) return null;
    let s = text.trim();
    s = s.replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    // 直接可解析
    try { return JSON.parse(s); } catch (e) { }
    // 找最外层 { } 或 [ ]
    const tryRange = (open, close) => {
      const a = s.indexOf(open);
      const b = s.lastIndexOf(close);
      if (a === -1 || b === -1 || b <= a) return null;
      let frag = s.slice(a, b + 1);
      try { return JSON.parse(frag); } catch (e) { }
      // 常见毛病修复：尾逗号 / 中文引号 / 单引号
      frag = frag
        .replace(/[""]/g, '"').replace(/['']/g, "'")
        .replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(frag); } catch (e) { }
      return null;
    };
    return tryRange('[', ']') || tryRange('{', '}');
  }

  /**
   * 要求模型返回 JSON。失败会自动重试一次（追加更严格的指令）。
   */
  async function json(sys, user, opt) {
    opt = opt || {};
    const strict = '\n\n【输出格式硬性要求】只输出一个合法 JSON，不要任何解释、前后缀或 Markdown 代码块标记。所有字符串使用英文双引号，不要出现未转义换行以外的控制字符。';
    let raw = await chat([
      { role: 'system', content: sys + strict },
      { role: 'user', content: user }
    ], opt);
    let obj = extractJSON(raw);
    if (obj) return obj;

    raw = await chat([
      { role: 'system', content: sys + strict },
      { role: 'user', content: user },
      { role: 'assistant', content: raw.slice(0, 500) },
      { role: 'user', content: '上面的输出不是合法 JSON。请只重新输出一次纯 JSON，不要任何其他文字。' }
    ], { maxTokens: opt.maxTokens || 8000, temperature: 0.6 });
    obj = extractJSON(raw);
    if (!obj) throw new Error('返回格式无法解析，请重试');
    return obj;
  }

  window.DNAI = { chat, json, ready, cfg, extractJSON };
})();
