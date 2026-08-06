/* ==========================================================================
   Shopping · Luna OS  —  script.js
   1) 状态栏时间 / 电量：读取与主屏 index.html 相同的 localStorage('luna_tz')
      与 Battery API，保证多个 App 之间状态栏数值完全同步，不产生割裂感。
   2) 导航栏交互：液态滑块跟随选中项位移、板块切换动画、物流侧翼独立态。
========================================================================== */

(function statusBarSync(){
  function updateTime(){
    var el = document.getElementById('statusTime');
    if (!el) return;
    var tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    var now = new Date();
    var str = now.toLocaleTimeString('zh-CN', {
      timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false
    });
    el.textContent = str;
  }
  updateTime();
  setInterval(updateTime, 1000);

  function updateBattery(){
    var pctEl = document.getElementById('batPct');
    var innerEl = document.getElementById('batInner');

    function render(pct){
      var p = Math.round(pct);
      if (pctEl) pctEl.textContent = p;
      if (innerEl){
        innerEl.style.width = p + '%';
        innerEl.style.background = p <= 20
          ? 'linear-gradient(90deg, #f87171, #ef4444)'
          : 'linear-gradient(90deg, #6ee7b7, #34d399)';
      }
    }

    if ('getBattery' in navigator){
      navigator.getBattery().then(function(battery){
        render(battery.level * 100);
        battery.addEventListener('levelchange', function(){
          render(battery.level * 100);
        });
      }).catch(function(){ render(76); });
    } else {
      render(76);
    }
  }
  updateBattery();
})();

/* ==========================================================================
   导航栏 + 板块切换
========================================================================== */
(function orbitNav(){
  var META = {
    mall:      { title: '商城',   sub: 'Curated Marketplace' },
    delivery:  { title: '外卖',   sub: 'Fresh & Fast Delivery' },
    logistics: { title: '物流',   sub: 'Track Every Step' },
    cart:      { title: '购物车', sub: 'Your Selections' },
    messages:  { title: '私信',   sub: 'Conversations' },
    profile:   { title: '个人中心', sub: 'Your Space' }
  };

  var navItems   = Array.prototype.slice.call(document.querySelectorAll('.nav-item[data-view]'));
  var navWing    = document.getElementById('logisticsWing');
  var liquid     = document.getElementById('navLiquid');
  var navGlass   = document.querySelector('.nav-glass');
  var panels     = Array.prototype.slice.call(document.querySelectorAll('.view-panel[data-view]'));
  var titleEl    = document.getElementById('sectionTitle');
  var subEl      = document.getElementById('sectionSub');

  var current = 'mall';

  function moveLiquidTo(btn){
    if (!btn || !navGlass || !liquid) return;
    
    if (btn === navWing || btn.classList.contains('nav-item--core')){
      liquid.classList.add('is-core');
      return;
    }
    
    liquid.classList.remove('is-core');
    
    var glassRect = navGlass.getBoundingClientRect();
    var btnRect = btn.getBoundingClientRect();
    
    // 1. 精确计算按钮的几何中心点相对于 navGlass 的位置
    var btnCenterX = (btnRect.left - glassRect.left) + (btnRect.width / 2);
    
    // 2. 动态设置滑块的宽度（比按钮稍微缩一点，视觉上包裹感更高级）
    var targetWidth = Math.max(btnRect.width - 8, 52); 
    liquid.style.width = targetWidth + 'px';
    
    // 3. 计算使滑块中心与按钮中心重合的 translateX X轴偏移量
    var offsetX = btnCenterX - (targetWidth / 2);
    
    // 4. 应用变换 (包含 CSS 中的 -50% 垂直居中)
    liquid.style.transform = 'translate(' + offsetX + 'px, -50%)';
  }

  function setActive(view, opts){
    opts = opts || {};
    current = view;

    // 面板切换
    panels.forEach(function(p){
      p.classList.toggle('is-active', p.dataset.view === view);
    });

    // 标题栏（带轻微上滑+淡出再淡入的节奏感，而非硬切）
    var meta = META[view];
    if (meta && titleEl && subEl){
      titleEl.style.opacity = '0';
      titleEl.style.transform = 'translateY(4px)';
      subEl.style.opacity = '0';
      setTimeout(function(){
        titleEl.textContent = meta.title;
        subEl.textContent = meta.sub;
        titleEl.style.transform = 'translateY(0)';
        titleEl.style.opacity = '1';
        subEl.style.opacity = '1';
      }, 140);
    }

    // 底部导航按钮态
    navItems.forEach(function(b){
      b.classList.toggle('is-selected', b.dataset.view === view);
    });
    if (navWing){
      navWing.classList.toggle('is-selected', view === 'logistics');
    }

    // 液态光带位置
    var activeBtn = navItems.filter(function(b){ return b.dataset.view === view; })[0];
    if (view === 'logistics'){
      moveLiquidTo(navWing);
    } else {
      moveLiquidTo(activeBtn);
    }

    if (!opts.silent && navigator.vibrate){
      try { navigator.vibrate(6); } catch(e){}
    }
  }

  navItems.forEach(function(btn){
    btn.addEventListener('click', function(){
      if (btn.dataset.view === current) return;
      setActive(btn.dataset.view);
    });
  });

  if (navWing){
    navWing.addEventListener('click', function(){
      if (current === 'logistics') return;
      setActive('logistics');
    });
  }

  // 初始定位（等布局稳定后再计算一次，避免首帧位置为 0）
  window.addEventListener('load', function(){
    setActive('mall', { silent: true });
  });
  // 兜底：部分环境 load 触发较晚
  setTimeout(function(){ setActive(current, { silent: true }); }, 60);

  // 视口变化时重新校准液态滑块位置
  window.addEventListener('resize', function(){
    var activeBtn = navItems.filter(function(b){ return b.dataset.view === current; })[0];
    if (current === 'logistics'){
      moveLiquidTo(navWing);
    } else {
      moveLiquidTo(activeBtn);
    }
  });
})();

/* ==========================================================================
   顶部图标按钮的轻交互反馈（图片来源设置 / 返回），返回按钮额外跳转主屏
========================================================================== */
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.icon-btn[data-action]').forEach(function(btn){
    btn.addEventListener('click', function(){
      btn.style.transform = 'scale(0.85)';
      setTimeout(function(){ btn.style.transform = ''; }, 160);

      if (btn.dataset.action === 'back-home'){
        window.location.href = 'index.html';
      }
    });
  });
});

/* ==========================================================================
   商城 · AI 选品与生图
   链路：
     1) 读取 settings.js 落下的文本模型配置 (luna_api_current / luna_api_model)
        与生图模型配置 (luna_image_provider / luna_image_current)
     2) 用户输入一句话描述 → 调用文本模型，按约定 JSON 结构扩写为 4~6 件具体商品
        （名称 / 一句话卖点 / 价格 / 风格标签 / 用于取图的关键词）
     3) 逐件商品取图，按优先级尝试：
        a) 已配置生图模型 → 用 AI 生图（贴合商品描述，风格可控）
        b) 未配置生图模型 / 生图失败 → 退化为真实图片搜索（Unsplash 免 Key 接口）
        c) 图片搜索也失败 → 本地兜底占位图（纯前端绘制，不依赖任何网络请求）
        因此商城不会因为「没有配置生图 Key」而完全无法使用。
     4) 结果与关键词持久化到 localStorage('luna_shop_last')，
        重新进入商城页 / 刷新后仍能看到上次的生成结果
========================================================================== */
(function mallAI(){

  // 存档结构从「只存最后一次」升级为「按关键词缓存多份」：
  //   luna_shop_cache = { entries: { [keyword]: { products, time } }, order: [keyword,...] }
  // 好处：来回切换搜索词（比如 A→B→A）时，命中缓存直接秒开渲染，
  // 完全不再调用文本模型 / 生图接口，不浪费任何 token，也不会丢结果。
  var CACHE_KEY = 'luna_shop_cache';
  var LEGACY_KEY = 'luna_shop_last'; // 兼容旧版本单槽存档，首次读取时自动迁移
  var MAX_CACHE_ENTRIES = 20;

  var els = {};
  var isGenerating = false;
  var generationBatch = 0; // 每次点击生成自增，用于识别/丢弃过期批次的异步回调
  var currentKeyword = '';

  function cacheEls(){
    els.searchBar     = document.getElementById('mallSearchBar');
    els.searchInput   = document.getElementById('mallSearchInput');
    els.searchClear   = document.getElementById('mallSearchClear');
    els.generateBtn   = document.getElementById('mallGenerateBtn');
    els.spinner       = document.getElementById('mallGenerateSpinner');
    els.hintRow       = document.getElementById('mallHintRow');
    els.historyRow    = document.getElementById('mallHistoryRow');
    els.historyList   = document.getElementById('mallHistoryList');
    els.scroll        = document.getElementById('mallScroll');
    els.emptyState     = document.getElementById('mallEmptyState');
    els.errorState    = document.getElementById('mallErrorState');
    els.errorDesc     = document.getElementById('mallErrorDesc');
    els.retryBtn      = document.getElementById('mallRetryBtn');
    els.grid          = document.getElementById('mallGrid');
    els.toast         = document.getElementById('mallToast');
    els.toastText     = document.getElementById('mallToastText');
    els.cartBadge     = document.getElementById('cartBadge');
  }

  /* ---------------- 读取已保存的模型配置 ---------------- */

  function getTextConfig(){
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem('luna_api_current') || '{}'); } catch(e){}
    var model = localStorage.getItem('luna_api_model') || '';
    if (!cur.baseUrl || !cur.apiKey || !model) return null;
    return { baseUrl: cur.baseUrl.replace(/\/$/, ''), apiKey: cur.apiKey, model: model };
  }

  // 与 settings.js 中 IMAGE_PROVIDERS 保持一致的最小复刻，
  // 避免跨文件依赖；若 settings.js 已在同页加载过则直接复用其定义。
  var IMAGE_PROVIDERS_FALLBACK = {
    'gpt-image-2': {
      baseUrl: 'https://api.openai.com/v1', path: '/images/generations',
      auth: 'bearer', model: 'gpt-image-2',
      buildBody: function(cfg){ return { model: this.model, prompt: cfg.prompt, size: '1024x1024', quality: 'medium', n: 1 }; },
      parseImages: function(data){ return (data.data || []).map(function(i){ return { url: i.url || null, b64: i.b64_json || null }; }); }
    },
    'nano-banana-pro': {
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta', path: '/models/nano-banana-pro:generateImages',
      auth: 'query', model: 'nano-banana-pro',
      buildBody: function(cfg){ return { prompt: cfg.prompt, aspectRatio: '1:1', sampleCount: 1 }; },
      parseImages: function(data){
        var list = data.images || data.generatedImages || [];
        return list.map(function(i){ return { url: i.url || null, b64: i.imageBytes || i.b64_json || null }; });
      }
    },
    seedream: {
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', path: '/images/generations',
      auth: 'bearer', model: 'doubao-seedream',
      buildBody: function(cfg){ return { model: this.model, prompt: cfg.prompt, size: '1024x1024', n: 1, response_format: 'url' }; },
      parseImages: function(data){ return (data.data || []).map(function(i){ return { url: i.url || null, b64: i.b64_json || null }; }); }
    },
    custom: {
      baseUrl: '', path: '/images/generations', auth: 'bearer', model: '',
      buildBody: function(cfg){ return { model: this.model || cfg.customModel, prompt: cfg.prompt, size: '1024x1024', quality: 'medium', n: 1 }; },
      parseImages: function(data){ return (data.data || []).map(function(i){ return { url: i.url || null, b64: i.b64_json || null }; }); }
    }
  };

  // 图片搜索（Pexels）配置读取：独立于生图模型，存储 key 为 luna_search_current
  function getSearchConfig(){
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem('luna_search_current') || '{}'); } catch(e){}
    if (!cur.apiKey) return null;
    return { apiKey: cur.apiKey };
  }

  function hasSearchConfig(){
    return !!getSearchConfig();
  }

  function getImageConfig(){
    var providerId = localStorage.getItem('luna_image_provider') || '';
    if (!providerId) return null;
    var specs = (typeof IMAGE_PROVIDERS !== 'undefined') ? IMAGE_PROVIDERS : IMAGE_PROVIDERS_FALLBACK;
    var spec = specs[providerId];
    if (!spec) return null;

    var cur = {};
    try { cur = JSON.parse(localStorage.getItem('luna_image_current') || '{}'); } catch(e){}
    if (!cur.apiKey) return null;

    if (providerId === 'custom'){
      if (!cur.customUrl || !cur.customModel) return null;
      return {
        spec: spec, providerId: providerId, apiKey: cur.apiKey,
        url: cur.customUrl.replace(/\/$/, '') + spec.path,
        model: cur.customModel
      };
    }
    return {
      spec: spec, providerId: providerId, apiKey: cur.apiKey,
      url: spec.auth === 'query'
        ? spec.baseUrl + spec.path + '?key=' + encodeURIComponent(cur.apiKey)
        : spec.baseUrl + spec.path,
      model: spec.model
    };
  }

  function hasImageModelConfig(){
    return !!getImageConfig();
  }

  /* ---------------- 文本模型：一句话 → 结构化商品列表 ---------------- */

  function buildPlannerPrompt(keyword){
    return '你是一个极简韩系风格电商平台的选品编辑。用户想找："' + keyword + '"。\n' +
      '请构思 5 件与之相关、但风格各异、有细分差异的具体商品（不要重复同一款）。\n' +
      '只输出一个 JSON 数组，不要输出任何解释文字、不要用 Markdown 代码块包裹，数组每项字段如下：\n' +
      '{\n' +
      '  "name": "商品中文名，10字以内，具体到材质或设计特征",\n' +
      '  "tag": "两到四字的韩系风格标签，例如 限定 / 黑标 / 联名 / 新品 / 断货王，不要用英文",\n' +
      '  "price": 整数，人民币价格，符合该品类真实市场行情,\n' +
      '  "imagePrompt": "英文视觉描述，用于图像生成模型，描述该商品单独出现在极简白色或浅灰背景摄影棚场景中的样子，突出材质与光影，不要出现文字、水印、人物",\n' +
      '  "searchKeyword": "2到4个英文单词，用于图片搜索引擎检索该商品的真实产品图，例如 minimalist ceramic mug"\n' +
      '}\n' +
      '只返回 JSON 数组本身。';
  }

  function extractJsonArray(text){
    if (!text) return null;
    var cleaned = text.trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
    var start = cleaned.indexOf('[');
    var end = cleaned.lastIndexOf(']');
    if (start === -1 || end === -1 || end < start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch(e){ return null; }
  }

  function planProducts(keyword){
    var cfg = getTextConfig();
    if (!cfg) return Promise.resolve(planProductsLocally(keyword));

    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: buildPlannerPrompt(keyword) }],
        max_tokens: 1200,
        temperature: 0.9
      })
    }).then(function(resp){
      if (!resp.ok) throw new Error('文本模型请求失败 HTTP ' + resp.status);
      return resp.json();
    }).then(function(data){
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      var list = extractJsonArray(content);
      if (!list || !list.length) throw new Error('未能解析出商品列表，请重试或更换模型');
      return list.slice(0, 6).map(function(item, idx){
        var price = Math.max(1, Math.round(Number(item.price) || (99 + idx * 40)));
        return enrichProduct({
          id: 'p' + Date.now() + '_' + idx,
          name: String(item.name || '未命名商品').slice(0, 24),
          tag: String(item.tag || '新品').slice(0, 6),
          price: price,
          imagePrompt: String(item.imagePrompt || item.name || keyword),
          searchKeyword: String(item.searchKeyword || item.name || keyword)
        });
      });
    });
  }

  // 电商信任感字段：好评率 / 月销量 / 划线原价。
  // 用带随机种子的确定性生成（基于商品 id），保证同一件商品从缓存复渲染时数值不跳动。
  function seededRandom(seedStr){
    var h = 0;
    for (var i = 0; i < seedStr.length; i++){
      h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    }
    return function(){
      h = (h * 1103515245 + 12345) >>> 0;
      return (h % 10000) / 10000;
    };
  }

  function enrichProduct(product){
    var rand = seededRandom(product.id);
    var rate = (95 + Math.floor(rand() * 5)) + '%'; // 95%~99% 好评率
    var salesRaw = Math.floor(rand() * 4200) + 60;
    var sales = salesRaw >= 1000 ? (salesRaw / 1000).toFixed(1) + 'k+已拼' : salesRaw + '人付款';
    var hasDiscount = rand() > 0.35;
    var original = hasDiscount ? Math.round(product.price * (1.15 + rand() * 0.35)) : null;

    product.rate = rate;
    product.sales = sales;
    product.originalPrice = original;
    return product;
  }

  // 未配置文本模型时的纯本地选品：不调用任何网络接口，
  // 用固定风格标签词库 + 简单价格规则拼出一组"看起来像样"的商品，
  // 保证搜索框在零配置下依然可用（图片走搜索/占位兜底）。
  var LOCAL_TAGS = ['新品', '限定', '黑标', '断货王', '联名'];
  var LOCAL_QUALIFIERS = ['极简款', '基础款', '手工款', '进阶款', '收藏款'];

  function planProductsLocally(keyword){
    var base = keyword || '精选好物';
    var products = [];
    for (var i = 0; i < 5; i++){
      products.push(enrichProduct({
        id: 'p' + Date.now() + '_' + i,
        name: (base + ' · ' + LOCAL_QUALIFIERS[i % LOCAL_QUALIFIERS.length]).slice(0, 24),
        tag: LOCAL_TAGS[i % LOCAL_TAGS.length],
        price: 89 + i * 46,
        imagePrompt: 'minimalist studio product photo of ' + base + ', clean gray background, soft light',
        searchKeyword: base
      }));
    }
    return products;
  }

  /* ---------------- 生图模型：逐件商品并发生成 ---------------- */

  function generateOneImage(product){
    var cfg = getImageConfig();
    var spec = cfg.spec;
    var body = spec.buildBody({ prompt: product.imagePrompt, customModel: cfg.model });
    var headers = { 'Content-Type': 'application/json' };
    if (spec.auth === 'bearer') headers['Authorization'] = 'Bearer ' + cfg.apiKey;

    return fetch(cfg.url, { method: 'POST', headers: headers, body: JSON.stringify(body) })
      .then(function(resp){
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function(data){
        var images = spec.parseImages(data);
        var first = images && images[0];
        if (!first) throw new Error('未返回图片');
        var src = first.url || (first.b64 ? 'data:image/png;base64,' + first.b64 : '');
        if (!src) throw new Error('图片数据为空');
        return src;
      });
  }

  /* ---------------- 图片搜索兜底：Pexels 官方 API，按关键词取真实商品图 ---------------- */
  /* 需要用户在「图片来源」面板配置免费申请的 Pexels API Key（luna_search_current）。
     文档：https://www.pexels.com/api/documentation/
     GET https://api.pexels.com/v1/search?query=xxx&per_page=1
     Header: Authorization: <API_KEY>（注意 Pexels 不用 Bearer 前缀） */
  function pexelsSearch(query, perPage){
    var cfg = getSearchConfig();
    if (!cfg) return Promise.reject(new Error('未配置图片搜索服务'));

    var url = 'https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) +
      '&per_page=' + (perPage || 1) + '&orientation=square';

    return fetch(url, { headers: { 'Authorization': cfg.apiKey } })
      .then(function(resp){
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        return resp.json();
      })
      .then(function(data){
        var photos = data.photos || [];
        if (!photos.length) throw new Error('未搜索到相关图片');
        return photos.map(function(p){
          return (p.src && (p.src.medium || p.src.large || p.src.original)) || null;
        }).filter(Boolean);
      });
  }

  function searchOneImage(product){
    var kw = product.searchKeyword || product.name;
    return pexelsSearch(kw, 1).then(function(urls){
      if (!urls.length) throw new Error('未搜索到相关图片');
      return urls[0];
    });
  }

  /* ---------------- 本地占位图兜底：不发起任何网络请求 ---------------- */
  /* 用商品名首字生成一张黑白灰几何 SVG，转 data URI 直接可用作 <img src>，
     确保即使断网 / 两级图片来源都失败，卡片也不会显示破图。 */
  function localPlaceholderImage(product){
    var initial = (product.name || '?').trim().charAt(0) || '?';
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">' +
        '<defs>' +
          '<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0%" stop-color="#eeeef0"/>' +
            '<stop offset="100%" stop-color="#d8d8dc"/>' +
          '</linearGradient>' +
        '</defs>' +
        '<rect width="640" height="640" fill="url(#g)"/>' +
        '<circle cx="320" cy="320" r="120" fill="none" stroke="#b8b8bd" stroke-width="2"/>' +
        '<text x="320" y="345" font-family="Inter, sans-serif" font-size="120" font-weight="700" fill="#9a9aa1" text-anchor="middle">' + initial + '</text>' +
      '</svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  /* ---------------- 统一取图调度：AI 生图 → 图片搜索 → 本地占位，逐级兜底 ---------------- */
  function resolveOneImage(product){
    var chain = Promise.reject();

    if (hasImageModelConfig()){
      chain = generateOneImage(product);
    }

    return chain
      .catch(function(){ return searchOneImage(product); })
      .catch(function(){ return localPlaceholderImage(product); });
  }

  /* ---------------- 渲染 ---------------- */

  // 根据当前配置程度，动态调整空态提示文案，
  // 让用户清楚知道「现在能用什么、配置了会更好在哪」，而不是被拦在门外。
  function updateEmptyStateHint(){
    var desc = els.emptyState.querySelector('.mall-state-desc');
    if (!desc) return;
    var hasText = !!getTextConfig();
    var hasImg = hasImageModelConfig();
    var hasSearch = hasSearchConfig();

    while (desc.firstChild) desc.removeChild(desc.firstChild);

    var text;
    if (hasImg){
      text = 'AI 将为你构思一组商品并生成对应图片';
    } else if (hasSearch){
      text = (hasText ? 'AI 将为你构思商品，' : '') + '图片将取自真实商品图库';
    } else {
      text = (hasText ? 'AI 将为你构思商品，' : '') + '暂未配置图片来源，将显示占位图，可配置图片搜索获取真实商品图';
    }
    desc.appendChild(document.createTextNode(text));

    if (!hasImg && !hasSearch){
      var link = document.createElement('button');
      link.className = 'mall-inline-link';
      link.textContent = '配置图片来源';
      link.addEventListener('click', function(){
        var btn = document.getElementById('imageSourceBtn');
        if (btn) btn.click();
      });
      desc.appendChild(document.createElement('br'));
      desc.appendChild(link);
    }
  }

  function showState(name){
    [els.emptyState, els.errorState].forEach(function(el){
      if (el) el.classList.remove('is-active');
    });
    els.grid.style.display = 'none';
    if (name === 'grid'){
      els.grid.style.display = '';
      return;
    }
    var map = { empty: els.emptyState, error: els.errorState };
    var target = map[name];
    if (target) target.classList.add('is-active');
  }

  function renderSkeletons(count){
    var html = '';
    for (var i = 0; i < count; i++){
      html += '<div class="mall-skel">' +
                '<div class="mall-skel-media"></div>' +
                '<div class="mall-skel-line"></div>' +
                '<div class="mall-skel-line"></div>' +
              '</div>';
    }
    els.grid.innerHTML = html;
    showState('grid');
  }

  var EMPHASIS_TAGS = ['限定', '断货王', '黑标'];

  function cardHtml(product){
    var img = product.image
      ? '<img src="' + product.image + '" alt="' + escapeHtml(product.name) + '" loading="lazy" />'
      : '';
    var isEmphasis = EMPHASIS_TAGS.indexOf(product.tag) !== -1;
    var originalHtml = product.originalPrice
      ? '<span class="mall-card-price-original">¥' + product.originalPrice + '</span>'
      : '';
    return (
      '<div class="mall-card" data-id="' + product.id + '">' +
        '<div class="mall-card-media">' +
          '<span class="mall-card-tag"' + (isEmphasis ? ' data-emphasis="true"' : '') + '>' + escapeHtml(product.tag) + '</span>' +
          img +
        '</div>' +
        '<div class="mall-card-body">' +
          '<div class="mall-card-name">' + escapeHtml(product.name) + '</div>' +
          '<div class="mall-card-meta">' +
            '<span class="meta-rate">' + escapeHtml(product.rate || '98%') + '好评</span>' +
            '<span class="meta-dot"></span>' +
            '<span class="meta-sales">' + escapeHtml(product.sales || '') + '</span>' +
          '</div>' +
          '<div class="mall-card-foot">' +
            '<div class="mall-card-price-group">' +
              '<span class="mall-card-price">' + product.price + '</span>' +
              originalHtml +
            '</div>' +
            '<button class="mall-card-add" aria-label="加入购物车" data-name="' + escapeHtml(product.name) + '">' +
              '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, function(c){
      return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c];
    });
  }

  function renderProducts(products){
    els.grid.innerHTML = products.map(cardHtml).join('');
    showState('grid');
    indexProducts(products);
  }

  /* ---------------- 加入购物车：轻提示 + 徽标计数，贴近真实电商反馈感 ---------------- */

  var toastTimer = null;
  function showToast(text){
    if (!els.toast) return;
    els.toastText.textContent = text;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      els.toast.classList.remove('show');
    }, 1600);
  }

  function bumpCartBadge(){
    if (!els.cartBadge) return;
    var n = parseInt(els.cartBadge.textContent, 10) || 0;
    els.cartBadge.textContent = n + 1;
  }

  function bindCartDelegation(){
    els.grid.addEventListener('click', function(e){
      var addBtn = e.target.closest ? e.target.closest('.mall-card-add') : null;
      if (addBtn){
        addBtn.classList.add('is-added');
        setTimeout(function(){ addBtn.classList.remove('is-added'); }, 900);
        var addCard = addBtn.closest('.mall-card');
        var addProduct = addCard ? currentProductsById[addCard.dataset.id] : null;
        if (addProduct && window.LunaShop && window.LunaShop.cartAddItem){
          window.LunaShop.cartAddItem(addProduct);
        } else {
          bumpCartBadge();
        }
        showToast('已加入购物车 · ' + (addBtn.dataset.name || ''));
        if (navigator.vibrate){ try { navigator.vibrate(8); } catch(err){} }
        return;
      }
      // 点击卡片其余区域（非加购按钮）→ 进入商品详情页
      var card = e.target.closest ? e.target.closest('.mall-card') : null;
      if (card && window.LunaShop && window.LunaShop.openDetail){
        var product = currentProductsById[card.dataset.id];
        if (product) window.LunaShop.openDetail(product);
      }
    });
  }

  // 维护一份「当前渲染商品」的 id 索引，供详情页 / 推荐区按 id 反查完整商品对象
  var currentProductsById = {};
  function indexProducts(products){
    currentProductsById = {};
    products.forEach(function(p){ currentProductsById[p.id] = p; });
  }

  function updateOneCard(product){
    var card = els.grid.querySelector('.mall-card[data-id="' + product.id + '"]');
    if (!card) return;
    var media = card.querySelector('.mall-card-media');
    if (product.image){
      var img = document.createElement('img');
      img.src = product.image;
      img.alt = product.name;
      img.loading = 'lazy';
      media.appendChild(img);
    } else {
      media.classList.add('mall-card-media--failed');
    }
  }

  /* ---------------- 持久化：按关键词缓存，避免重复生成浪费 token ---------------- */

  function readCache(){
    try {
      var raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (raw && raw.entries) return raw;
    } catch(e){}

    // 迁移旧版单槽存档，避免升级后用户之前的一次生成结果直接消失
    try {
      var legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (legacy && legacy.keyword && legacy.products && legacy.products.length){
        var migrated = { entries: {}, order: [legacy.keyword] };
        migrated.entries[legacy.keyword] = { products: legacy.products, time: legacy.time || Date.now() };
        return migrated;
      }
    } catch(e){}

    return { entries: {}, order: [] };
  }

  function writeCache(cache){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch(e){}
  }

  // 保存本轮结果：写入以关键词为 key 的缓存表，并把该关键词顶到「最近搜索」最前面。
  // 超出上限时淘汰最久未使用的一条，防止 localStorage 无限增长。
  function saveResult(keyword, products){
    var cache = readCache();
    cache.entries[keyword] = { products: products, time: Date.now() };
    cache.order = [keyword].concat(cache.order.filter(function(k){ return k !== keyword; }));
    if (cache.order.length > MAX_CACHE_ENTRIES){
      var dropped = cache.order.slice(MAX_CACHE_ENTRIES);
      cache.order = cache.order.slice(0, MAX_CACHE_ENTRIES);
      dropped.forEach(function(k){ delete cache.entries[k]; });
    }
    writeCache(cache);
    renderHistory();
  }

  // 命中缓存则直接返回，不触发任何网络请求；未命中返回 null，交由上层触发真正生成
  function loadFromCache(keyword){
    var cache = readCache();
    var hit = cache.entries[keyword];
    return hit && hit.products && hit.products.length ? hit : null;
  }

  function loadResult(){
    var cache = readCache();
    if (!cache.order.length) return null;
    var latestKeyword = cache.order[0];
    var hit = cache.entries[latestKeyword];
    if (!hit) return null;
    return { keyword: latestKeyword, products: hit.products, time: hit.time };
  }

  function removeFromCache(keyword){
    var cache = readCache();
    delete cache.entries[keyword];
    cache.order = cache.order.filter(function(k){ return k !== keyword; });
    writeCache(cache);
    renderHistory();
  }

  /* ---------------- 最近搜索：点击直接从缓存渲染，秒开且零消耗 ---------------- */

  function renderHistory(){
    if (!els.historyRow || !els.historyList) return;
    var cache = readCache();
    var list = cache.order.slice(0, 8);

    if (!list.length){
      els.historyRow.classList.add('is-empty');
      els.historyList.innerHTML = '';
      return;
    }
    els.historyRow.classList.remove('is-empty');

    els.historyList.innerHTML = list.map(function(kw){
      var isCurrent = kw === currentKeyword;
      return '<button class="mall-history-chip' + (isCurrent ? ' is-current' : '') + '" data-kw="' + escapeHtml(kw) + '">' +
        '<span class="hc-cached-dot"></span>' + escapeHtml(kw) +
      '</button>';
    }).join('');

    Array.prototype.slice.call(els.historyList.querySelectorAll('.mall-history-chip')).forEach(function(chip){
      chip.addEventListener('click', function(){
        var kw = chip.dataset.kw;
        els.searchInput.value = kw;
        els.searchClear.classList.add('is-visible');
        runGenerate(kw); // 内部会先查缓存，命中则不再重新生成
      });
    });
  }

  /* ---------------- 主流程 ---------------- */

  function setLoading(loading){
    isGenerating = loading;
    els.generateBtn.classList.toggle('is-loading', loading);
    els.generateBtn.disabled = loading;
  }

  function runGenerate(keyword, opts){
    keyword = (keyword || '').trim();
    if (!keyword || isGenerating) return;
    opts = opts || {};

    // 关键字命中缓存：直接渲染，不发起任何文本/图像请求，
    // 这正是解决「换个词生成、换回来又要重新生成」浪费 token 的核心逻辑。
    if (!opts.forceRegenerate){
      var cached = loadFromCache(keyword);
      if (cached){
        currentKeyword = keyword;
        ++generationBatch; // 让任何仍在飞行中的旧请求作废
        renderProducts(cached.products);
        renderHistory();
        return;
      }
    }

    // 每次生成打一个唯一批次号，配合下方判断丢弃过期批次的回调，
    // 避免用户连续点击生成时，旧一轮的图片请求在新一轮渲染完之后才回来，
    // 把界面状态搅乱（这正是"生成完一闪又消失"的根因之一）。
    var batchId = ++generationBatch;
    currentKeyword = keyword;

    // 选品与取图均自带本地兜底，因此这里不再强制要求任何配置，
    // 未配置时依然可以正常生成（文本走本地规则，图片走搜索/占位）。
    setLoading(true);
    renderSkeletons(5);

    planProducts(keyword)
      .then(function(products){
        if (batchId !== generationBatch) return; // 已有更新的一轮生成在跑，丢弃这轮结果
        renderProducts(products);

        var imageTasks = products.map(function(product){
          return resolveOneImage(product)
            .then(function(src){ product.image = src; })
            .catch(function(){ product.image = null; })
            .then(function(){
              // 单张图片的渲染即便抛错也只记录，绝不让它冒泡打断整批流程
              if (batchId !== generationBatch) return;
              try { updateOneCard(product); }
              catch(e){ console.error('商品卡片渲染出错', e); }
            });
        });

        return Promise.all(imageTasks).then(function(){
          if (batchId !== generationBatch) return;
          saveResult(keyword, products);
        });
      })
      .catch(function(err){
        if (batchId !== generationBatch) return;
        // 只有「选品阶段」失败（没有渲染出任何商品）时才展示整屏错误态；
        // 图片阶段的失败已在内层吞掉，不应清空已经成功渲染的商品列表。
        if (!els.grid.children.length){
          els.errorDesc.textContent = err && err.message ? err.message : '请求未能完成，请检查网络或服务配置';
          showState('error');
        } else {
          console.error('部分生成流程出错，但商品已渲染，忽略：', err);
        }
      })
      .finally(function(){
        if (batchId !== generationBatch) return;
        setLoading(false);
      });
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents(){
    els.generateBtn.addEventListener('click', function(){
      runGenerate(els.searchInput.value);
    });

    els.searchInput.addEventListener('input', function(){
      els.searchClear.classList.toggle('is-visible', !!els.searchInput.value);
      els.hintRow.querySelectorAll('.mall-hint-chip').forEach(function(c){
        c.classList.remove('is-active');
      });
    });
    els.searchInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ runGenerate(els.searchInput.value); }
    });
    els.searchClear.addEventListener('click', function(){
      els.searchInput.value = '';
      els.searchClear.classList.remove('is-visible');
      els.searchInput.focus();
    });

    els.hintRow.querySelectorAll('.mall-hint-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        var val = chip.dataset.hint;
        els.searchInput.value = val;
        els.searchClear.classList.add('is-visible');
        els.hintRow.querySelectorAll('.mall-hint-chip').forEach(function(c){
          c.classList.toggle('is-active', c === chip);
        });
        runGenerate(val);
      });
    });

    els.retryBtn.addEventListener('click', function(){
      // 重试视为用户主动要求重新生成（例如上次选品/生图确实失败了），
      // 跳过缓存直接发起新一轮请求
      runGenerate(els.searchInput.value, { forceRegenerate: true });
    });

    bindCartDelegation();
  }

  function init(){
    cacheEls();
    if (!els.grid) return; // 非商城页或结构缺失，静默跳过

    bindEvents();
    renderHistory();

    var last = loadResult();
    if (last && last.products && last.products.length){
      currentKeyword = last.keyword || '';
      els.searchInput.value = last.keyword || '';
      els.searchClear.classList.toggle('is-visible', !!last.keyword);
      renderProducts(last.products);
      renderHistory();
    } else {
      showState('empty');
      updateEmptyStateHint();
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 暴露给商品详情页模块复用：文本模型 / 取图链路 / 购物车与格式化工具，
  // 避免重复实现同一套「模型配置读取 → 兜底链」逻辑。
  window.LunaShop = window.LunaShop || {};
  window.LunaShop.getTextConfig   = getTextConfig;
  window.LunaShop.extractJsonArray = extractJsonArray;
  window.LunaShop.resolveOneImage = resolveOneImage;
  window.LunaShop.pexelsSearch    = pexelsSearch;
  window.LunaShop.hasSearchConfig = hasSearchConfig;
  window.LunaShop.hasImageModelConfig = hasImageModelConfig;
  window.LunaShop.localPlaceholderImage = localPlaceholderImage;
  window.LunaShop.escapeHtml      = escapeHtml;
  window.LunaShop.seededRandom    = seededRandom;
  window.LunaShop.showToast       = showToast;
  window.LunaShop.bumpCartBadge   = bumpCartBadge;
  window.LunaShop.getProductById  = function(id){ return currentProductsById[id]; };
  window.LunaShop.getAllCurrentProducts = function(){
    return Object.keys(currentProductsById).map(function(k){ return currentProductsById[k]; });
  };
})();

/* ==========================================================================
   外卖 · AI 门店与菜单生成
   与商城复用同一套基础设施（window.LunaShop：文本规划兜底 / 取图三级兜底链 /
   购物车统一写入 / toast / escapeHtml / seededRandom），链路完全一致：
     1) 一句话描述 → 文本模型扩写为 4~5 家具体餐厅（未配置则走本地规则兜底）
     2) 逐店取门店图：AI 生图 → 图片搜索 → 本地占位，逐级兜底
     3) 结果按关键词缓存到 localStorage('luna_delivery_cache')，来回切词秒开
     4) 点击餐厅卡片 → 打开点餐页，同一文本模型按该餐厅风味扩写 4~6 道菜品，
        并按菜品结果缓存到 localStorage('luna_delivery_menu_cache')
     5) 菜品加购统一走 window.LunaShop.cartAddItem，与商城商品共用同一个购物车，
        订单信息里额外携带 restaurantName 字段用于购物车分组展示
========================================================================== */
(function deliveryAI(){

  var CACHE_KEY = 'luna_delivery_cache';
  var MENU_CACHE_KEY = 'luna_delivery_menu_cache';
  var MAX_CACHE_ENTRIES = 20;

  var els = {};
  var isGenerating = false;
  var generationBatch = 0;
  var currentKeyword = '';
  var currentRestaurantsById = {};

  function cacheEls(){
    els.searchBar    = document.getElementById('dvSearchBar');
    els.searchInput  = document.getElementById('dvSearchInput');
    els.searchClear  = document.getElementById('dvSearchClear');
    els.generateBtn  = document.getElementById('dvGenerateBtn');
    els.spinner      = document.getElementById('dvGenerateSpinner');
    els.hintRow      = document.getElementById('dvHintRow');
    els.historyRow   = document.getElementById('dvHistoryRow');
    els.historyList  = document.getElementById('dvHistoryList');
    els.scroll       = document.getElementById('dvScroll');
    els.emptyState   = document.getElementById('dvEmptyState');
    els.errorState   = document.getElementById('dvErrorState');
    els.errorDesc    = document.getElementById('dvErrorDesc');
    els.retryBtn     = document.getElementById('dvRetryBtn');
    els.list         = document.getElementById('dvList');
    els.toast        = document.getElementById('dvToast');
    els.toastText    = document.getElementById('dvToastText');
    els.onlineEntry  = document.getElementById('dvOnlineRestEntry');
  }

  function LS(){ return window.LunaShop || {}; }
  function esc(s){ return LS().escapeHtml ? LS().escapeHtml(s) : String(s == null ? '' : s); }

  /* ---------------- 文本模型：一句话 → 结构化餐厅列表 ---------------- */

  function buildRestaurantPlannerPrompt(keyword){
    return '你是一个极简韩系风格外卖平台的餐厅编辑。用户想吃："' + keyword + '"。\n' +
      '请构思 5 家与之相关、但风格与定位各异的具体餐厅（不要重复同一家）。\n' +
      '只输出一个 JSON 数组，不要输出任何解释文字、不要用 Markdown 代码块包裹，数组每项字段如下：\n' +
      '{\n' +
      '  "name": "餐厅中文名，8字以内，可带门店风格暗示",\n' +
      '  "cuisine": "两到四字菜系标签，例如 日式 / 法式 / 韩式 / 融合",\n' +
      '  "desc": "12字以内一句话卖点",\n' +
      '  "rate": 4.2到5.0之间一位小数,\n' +
      '  "deliveryFee": 整数，人民币配送费，2到8之间,\n' +
      '  "minOrder": 整数，人民币起送价，15到40之间,\n' +
      '  "etaMinutes": 整数，预计送达分钟数，20到55之间,\n' +
      '  "imagePrompt": "英文视觉描述，用于图像生成模型，描述该餐厅门店或代表菜品在自然光下的样子，突出质感与氛围，不要出现文字、水印、人物",\n' +
      '  "searchKeyword": "2到4个英文单词，用于图片搜索引擎检索该类餐厅/菜品的真实图片，例如 japanese ramen restaurant"\n' +
      '}\n' +
      '只返回 JSON 数组本身。';
  }

  function buildMenuPlannerPrompt(restaurant){
    return '你是"' + restaurant.name + '"（' + (restaurant.cuisine || '') + '菜系）的菜单编辑。\n' +
      '请构思 5 道该餐厅具体会售卖的菜品（不要重复同一道），风格贴合餐厅定位。\n' +
      '只输出一个 JSON 数组，不要输出任何解释文字、不要用 Markdown 代码块包裹，数组每项字段如下：\n' +
      '{\n' +
      '  "name": "菜品中文名，10字以内，具体到做法或食材",\n' +
      '  "desc": "16字以内的一句话描述，突出口感或食材",\n' +
      '  "price": 整数，人民币价格，15到88之间，符合该菜系真实行情,\n' +
      '  "imagePrompt": "英文视觉描述，用于图像生成模型，描述该菜品单独出现在自然光餐桌摆盘中的样子，突出食材与光影，不要出现文字、水印、人物",\n' +
      '  "searchKeyword": "2到4个英文单词，用于图片搜索引擎检索该菜品的真实图片，例如 tonkotsu ramen bowl"\n' +
      '}\n' +
      '只返回 JSON 数组本身。';
  }

  function buildStoreDetailPrompt(restaurant){
    return '你是"' + restaurant.name + '"（' + (restaurant.cuisine || '') + '菜系外卖店）的运营编辑。\n' +
      '请围绕这家店生成一份详情数据，只输出一个 JSON 对象，不要任何解释文字、不要 Markdown 代码块包裹，字段如下：\n' +
      '{\n' +
      '  "notice": "18字以内的商家公告，例如满减/新品/配送提示，语气自然，不要用感叹号刷屏",\n' +
      '  "reviewTags": ["3到5个简短评价关键词，如 分量足 / 味道正宗 / 送餐快"],\n' +
      '  "reviews": [{"name":"中文昵称（打码风格，如 用户a**2）","stars":1到5的整数,"date":"月/日 格式","text":"20到50字真实感评价文字，可略带口语化，围绕口味/分量/配送速度/包装展开","dish":"该用户点的一道菜名，与本店菜系相符"}]，共4到5条,\n' +
      '  "recoKeyword": "1个2到4字的中文关键词，用于生成本店的人气推荐菜品"\n' +
      '}\n只返回 JSON 对象本身。';
  }

  function planStoreDetailLocally(restaurant){
    var base = restaurant.name || '这家店';
    return {
      notice: '新客立减 · 每日现做现送',
      reviewTags: ['分量足', '味道正宗', '送餐快'],
      reviews: [
        { name: '用户a**2', stars: 5, date: '07/18', text: '味道很不错，分量也足，包装也没有漏汤，会回购。', dish: '招牌套餐' },
        { name: '用户j**8', stars: 4, date: '07/09', text: '送餐速度挺快的，比预计时间提前了十分钟。', dish: '人气推荐' },
        { name: '用户w**5', stars: 5, date: '06/28', text: '口味正宗，第一次点就很满意，下次还会再来。', dish: '主厨精选' },
        { name: '用户l**1', stars: 4, date: '06/20', text: '性价比不错，配送也很及时，包装用心。', dish: '经典款' }
      ],
      recoKeyword: base.slice(0, 4)
    };
  }

  function normalizeStoreDetail(obj, restaurant){
    var fallback = planStoreDetailLocally(restaurant);
    return {
      notice: String(obj.notice || fallback.notice).slice(0, 30),
      reviewTags: Array.isArray(obj.reviewTags) && obj.reviewTags.length ? obj.reviewTags.slice(0, 6) : fallback.reviewTags,
      reviews: Array.isArray(obj.reviews) && obj.reviews.length ? obj.reviews.slice(0, 6) : fallback.reviews,
      recoKeyword: String(obj.recoKeyword || fallback.recoKeyword).slice(0, 8)
    };
  }

  function planStoreDetail(restaurant){
    var LSApi = LS();
    var cfg = LSApi.getTextConfig && LSApi.getTextConfig();
    if (!cfg) return Promise.resolve(planStoreDetailLocally(restaurant));

    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: buildStoreDetailPrompt(restaurant) }],
        max_tokens: 900,
        temperature: 0.9
      })
    }).then(function(resp){
      if (!resp.ok) throw new Error('店铺详情生成请求失败 HTTP ' + resp.status);
      return resp.json();
    }).then(function(data){
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      var cleaned = (content || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
      var start = cleaned.indexOf('{');
      var end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('未能解析店铺详情数据');
      var obj;
      try { obj = JSON.parse(cleaned.slice(start, end + 1)); } catch(e){ throw new Error('店铺详情数据解析失败'); }
      return normalizeStoreDetail(obj, restaurant);
    }).catch(function(err){
      console.error('店铺详情生成失败，使用本地兜底：', err);
      return planStoreDetailLocally(restaurant);
    });
  }

  function planRestaurants(keyword){
    var LSApi = LS();
    var cfg = LSApi.getTextConfig && LSApi.getTextConfig();
    if (!cfg) return Promise.resolve(planRestaurantsLocally(keyword));

    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: buildRestaurantPlannerPrompt(keyword) }],
        max_tokens: 1400,
        temperature: 0.9
      })
    }).then(function(resp){
      if (!resp.ok) throw new Error('文本模型请求失败 HTTP ' + resp.status);
      return resp.json();
    }).then(function(data){
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      var list = LSApi.extractJsonArray && LSApi.extractJsonArray(content);
      if (!list || !list.length) throw new Error('未能解析出餐厅列表，请重试或更换模型');
      return list.slice(0, 6).map(function(item, idx){
        return enrichRestaurant({
          id: 'r' + Date.now() + '_' + idx,
          name: String(item.name || '未命名餐厅').slice(0, 16),
          cuisine: String(item.cuisine || '融合').slice(0, 6),
          desc: String(item.desc || '').slice(0, 20),
          rate: Math.min(5, Math.max(3.5, Number(item.rate) || 4.6)),
          deliveryFee: Math.max(0, Math.round(Number(item.deliveryFee) || 3)),
          minOrder: Math.max(0, Math.round(Number(item.minOrder) || 20)),
          etaMinutes: Math.max(15, Math.round(Number(item.etaMinutes) || 30)),
          imagePrompt: String(item.imagePrompt || item.name || keyword),
          searchKeyword: String(item.searchKeyword || item.name || keyword)
        });
      });
    });
  }

  function enrichRestaurant(restaurant){
    var rand = (LS().seededRandom || function(){ return function(){ return 0.5; }; })(restaurant.id);
    var salesRaw = Math.floor(rand() * 3000) + 80;
    restaurant.monthlySales = salesRaw >= 1000 ? (salesRaw / 1000).toFixed(1) + 'k+月售' : '月售 ' + salesRaw;
    restaurant.distance = (0.3 + rand() * 2.6).toFixed(1) + 'km';
    return restaurant;
  }

  var LOCAL_CUISINES = ['融合', '家常', '轻食', '手作', '匠心'];
  var LOCAL_QUALIFIERS = ['小馆', '食堂', '厨房', '工坊', '灶台'];

  function planRestaurantsLocally(keyword){
    var base = keyword || '精选美食';
    var list = [];
    for (var i = 0; i < 5; i++){
      list.push(enrichRestaurant({
        id: 'r' + Date.now() + '_' + i,
        name: (base + LOCAL_QUALIFIERS[i % LOCAL_QUALIFIERS.length]).slice(0, 16),
        cuisine: LOCAL_CUISINES[i % LOCAL_CUISINES.length],
        desc: '用心烹制 · 现点现做',
        rate: (4.3 + (i % 5) * 0.12),
        deliveryFee: 3 + (i % 4),
        minOrder: 20 + i * 4,
        etaMinutes: 25 + i * 5,
        imagePrompt: 'natural light photo of a cozy restaurant serving ' + base + ', warm ambience, no text',
        searchKeyword: base + ' restaurant'
      }));
    }
    return list;
  }

  function planDishesLocally(restaurant){
    var base = restaurant.name || '精选菜品';
    var dishes = [];
    for (var i = 0; i < 5; i++){
      dishes.push({
        id: 'd' + Date.now() + '_' + i,
        name: (base + ' 招牌 ' + (i + 1) + '号').slice(0, 20),
        desc: '选用新鲜食材，现做现售',
        price: 28 + i * 12,
        imagePrompt: 'natural light food photography of a dish from ' + base + ', clean plating, no text',
        searchKeyword: (restaurant.searchKeyword || base) + ' dish'
      });
    }
    return dishes;
  }

  function planDishes(restaurant){
    var LSApi = LS();
    var cfg = LSApi.getTextConfig && LSApi.getTextConfig();
    if (!cfg) return Promise.resolve(planDishesLocally(restaurant));

    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: buildMenuPlannerPrompt(restaurant) }],
        max_tokens: 1200,
        temperature: 0.9
      })
    }).then(function(resp){
      if (!resp.ok) throw new Error('文本模型请求失败 HTTP ' + resp.status);
      return resp.json();
    }).then(function(data){
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      var list = LSApi.extractJsonArray && LSApi.extractJsonArray(content);
      if (!list || !list.length) throw new Error('未能解析出菜单，请重试或更换模型');
      return list.slice(0, 6).map(function(item, idx){
        var price = Math.max(1, Math.round(Number(item.price) || (28 + idx * 12)));
        return {
          id: 'd' + Date.now() + '_' + idx,
          name: String(item.name || '未命名菜品').slice(0, 20),
          desc: String(item.desc || '').slice(0, 24),
          price: price,
          imagePrompt: String(item.imagePrompt || item.name || restaurant.name),
          searchKeyword: String(item.searchKeyword || item.name || restaurant.name)
        };
      });
    });
  }

  /* ---------------- 渲染：空态 / 错误态 / 骨架 / 列表 ---------------- */

  function updateEmptyStateHint(){
    var desc = els.emptyState.querySelector('.dv-state-desc');
    if (!desc) return;
    var LSApi = LS();
    var hasText = !!(LSApi.getTextConfig && LSApi.getTextConfig());
    var hasImg = !!(LSApi.hasImageModelConfig && LSApi.hasImageModelConfig());
    var hasSearch = !!(LSApi.hasSearchConfig && LSApi.hasSearchConfig());

    var text;
    if (hasImg){
      text = 'AI 将为你构思一组餐厅并生成对应门店图';
    } else if (hasSearch){
      text = (hasText ? 'AI 将为你构思餐厅，' : '') + '图片将取自真实门店图库';
    } else {
      text = (hasText ? 'AI 将为你构思餐厅，' : '') + '暂未配置图片来源，将显示占位图';
    }
    desc.textContent = text;
  }

  function showState(name){
    [els.emptyState, els.errorState].forEach(function(el){
      if (el) el.classList.remove('is-active');
    });
    els.list.style.display = 'none';
    if (name === 'list'){
      els.list.style.display = '';
      return;
    }
    var map = { empty: els.emptyState, error: els.errorState };
    var target = map[name];
    if (target) target.classList.add('is-active');
  }

  function renderSkeletons(count){
    var html = '';
    for (var i = 0; i < count; i++){
      html += '<div class="dv-skel">' +
                '<div class="dv-skel-media"></div>' +
                '<div class="dv-skel-lines">' +
                  '<div class="dv-skel-line w-60"></div>' +
                  '<div class="dv-skel-line w-40"></div>' +
                  '<div class="dv-skel-line w-80"></div>' +
                '</div>' +
              '</div>';
    }
    els.list.innerHTML = html;
    showState('list');
  }

  function restaurantCardHtml(r){
    var img = r.image
      ? '<img src="' + r.image + '" alt="' + esc(r.name) + '" loading="lazy" />'
      : '';
    return (
      '<div class="dv-restaurant" data-id="' + r.id + '">' +
        '<div class="dv-restaurant-media">' +
          img +
          '<span class="dv-restaurant-badge">' + esc(r.cuisine) + '</span>' +
        '</div>' +
        '<div class="dv-restaurant-body">' +
          '<div class="dv-restaurant-top">' +
            '<span class="dv-restaurant-name">' + esc(r.name) + '</span>' +
            '<span class="dv-restaurant-cuisine">' + esc(r.distance || '') + '</span>' +
          '</div>' +
          '<p class="dv-restaurant-desc">' + esc(r.desc || '') + '</p>' +
          '<div class="dv-restaurant-meta">' +
            '<span class="meta-rate">' + esc((r.rate || 4.6).toFixed(1)) + '分</span>' +
            '<span class="meta-dot"></span>' +
            '<span class="meta-sales">' + esc(r.monthlySales || '') + '</span>' +
          '</div>' +
          '<div class="dv-restaurant-foot">' +
            '<span class="dv-restaurant-fee">配送 <b>¥' + r.deliveryFee + '</b> · 起送 <b>¥' + r.minOrder + '</b></span>' +
            '<span class="dv-restaurant-eta">' + r.etaMinutes + '分钟</span>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderRestaurants(list){
    els.list.innerHTML = list.map(restaurantCardHtml).join('');
    showState('list');
    currentRestaurantsById = {};
    list.forEach(function(r){ currentRestaurantsById[r.id] = r; });
  }

  function updateOneCard(r){
    var card = els.list.querySelector('.dv-restaurant[data-id="' + r.id + '"]');
    if (!card) return;
    var media = card.querySelector('.dv-restaurant-media');
    if (r.image){
      var img = document.createElement('img');
      img.src = r.image;
      img.alt = r.name;
      img.loading = 'lazy';
      media.insertBefore(img, media.firstChild);
    } else {
      media.classList.add('dv-restaurant-media--failed');
    }
  }

  var toastTimer = null;
  function showToast(text){
    if (!els.toast) return;
    els.toastText.textContent = text;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){
      els.toast.classList.remove('show');
    }, 1600);
  }

  function bindListDelegation(){
    els.list.addEventListener('click', function(e){
      var card = e.target.closest ? e.target.closest('.dv-restaurant') : null;
      if (!card) return;
      var restaurant = currentRestaurantsById[card.dataset.id];
      if (restaurant && window.LunaDelivery && window.LunaDelivery.openRestaurant){
        window.LunaDelivery.openRestaurant(restaurant);
      }
    });
  }

  /* ---------------- 持久化：按关键词缓存餐厅列表 ---------------- */

  function readCache(){
    try {
      var raw = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (raw && raw.entries) return raw;
    } catch(e){}
    return { entries: {}, order: [] };
  }
  function writeCache(cache){
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch(e){}
  }
  function saveResult(keyword, list){
    var cache = readCache();
    cache.entries[keyword] = { list: list, time: Date.now() };
    cache.order = [keyword].concat(cache.order.filter(function(k){ return k !== keyword; }));
    if (cache.order.length > MAX_CACHE_ENTRIES){
      var dropped = cache.order.slice(MAX_CACHE_ENTRIES);
      cache.order = cache.order.slice(0, MAX_CACHE_ENTRIES);
      dropped.forEach(function(k){ delete cache.entries[k]; });
    }
    writeCache(cache);
    renderHistory();
  }
  function loadFromCache(keyword){
    var cache = readCache();
    var hit = cache.entries[keyword];
    return hit && hit.list && hit.list.length ? hit : null;
  }
  function loadResult(){
    var cache = readCache();
    if (!cache.order.length) return null;
    var latestKeyword = cache.order[0];
    var hit = cache.entries[latestKeyword];
    if (!hit) return null;
    return { keyword: latestKeyword, list: hit.list, time: hit.time };
  }

  function renderHistory(){
    if (!els.historyRow || !els.historyList) return;
    var cache = readCache();
    var list = cache.order.slice(0, 8);

    if (!list.length){
      els.historyRow.classList.add('is-empty');
      els.historyList.innerHTML = '';
      return;
    }
    els.historyRow.classList.remove('is-empty');

    els.historyList.innerHTML = list.map(function(kw){
      var isCurrent = kw === currentKeyword;
      return '<button class="dv-history-chip' + (isCurrent ? ' is-current' : '') + '" data-kw="' + esc(kw) + '">' +
        '<span class="hc-cached-dot"></span>' + esc(kw) +
      '</button>';
    }).join('');

    Array.prototype.slice.call(els.historyList.querySelectorAll('.dv-history-chip')).forEach(function(chip){
      chip.addEventListener('click', function(){
        var kw = chip.dataset.kw;
        els.searchInput.value = kw;
        els.searchClear.classList.add('is-visible');
        runGenerate(kw);
      });
    });
  }

  /* ---------------- 主流程 ---------------- */

  function setLoading(loading){
    isGenerating = loading;
    els.generateBtn.classList.toggle('is-loading', loading);
    els.generateBtn.disabled = loading;
  }

  function runGenerate(keyword, opts){
    keyword = (keyword || '').trim();
    if (!keyword || isGenerating) return;
    opts = opts || {};

    if (!opts.forceRegenerate){
      var cached = loadFromCache(keyword);
      if (cached){
        currentKeyword = keyword;
        ++generationBatch;
        renderRestaurants(cached.list);
        renderHistory();
        return;
      }
    }

    var batchId = ++generationBatch;
    currentKeyword = keyword;

    setLoading(true);
    renderSkeletons(5);

    var LSApi = LS();

    planRestaurants(keyword)
      .then(function(list){
        if (batchId !== generationBatch) return;
        renderRestaurants(list);

        var imageTasks = list.map(function(r){
          var resolve = LSApi.resolveOneImage ? LSApi.resolveOneImage(r) : Promise.resolve(null);
          return resolve
            .then(function(src){ r.image = src; })
            .catch(function(){ r.image = null; })
            .then(function(){
              if (batchId !== generationBatch) return;
              try { updateOneCard(r); }
              catch(e){ console.error('餐厅卡片渲染出错', e); }
            });
        });

        return Promise.all(imageTasks).then(function(){
          if (batchId !== generationBatch) return;
          saveResult(keyword, list);
        });
      })
      .catch(function(err){
        if (batchId !== generationBatch) return;
        if (!els.list.children.length){
          els.errorDesc.textContent = err && err.message ? err.message : '请求未能完成，请检查网络或服务配置';
          showState('error');
        } else {
          console.error('部分生成流程出错，但餐厅已渲染，忽略：', err);
        }
      })
      .finally(function(){
        if (batchId !== generationBatch) return;
        setLoading(false);
      });
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents(){
    els.generateBtn.addEventListener('click', function(){
      runGenerate(els.searchInput.value);
    });
    els.searchInput.addEventListener('input', function(){
      els.searchClear.classList.toggle('is-visible', !!els.searchInput.value);
      els.hintRow.querySelectorAll('.dv-hint-chip').forEach(function(c){
        c.classList.remove('is-active');
      });
    });
    els.searchInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter'){ runGenerate(els.searchInput.value); }
    });
    els.searchClear.addEventListener('click', function(){
      els.searchInput.value = '';
      els.searchClear.classList.remove('is-visible');
      els.searchInput.focus();
    });
    els.hintRow.querySelectorAll('.dv-hint-chip').forEach(function(chip){
      chip.addEventListener('click', function(){
        var val = chip.dataset.hint;
        els.searchInput.value = val;
        els.searchClear.classList.add('is-visible');
        els.hintRow.querySelectorAll('.dv-hint-chip').forEach(function(c){
          c.classList.toggle('is-active', c === chip);
        });
        runGenerate(val);
      });
    });
    els.retryBtn.addEventListener('click', function(){
      runGenerate(els.searchInput.value, { forceRegenerate: true });
    });

    // 线上餐厅：占位入口，打开独立占位全屏面板
    if (els.onlineEntry){
      els.onlineEntry.addEventListener('click', function(){
        var mask = document.getElementById('onlMask');
        if (mask) mask.classList.add('show');
        document.documentElement.style.overflow = 'hidden';
      });
    }

    bindListDelegation();
  }

  function init(){
    cacheEls();
    if (!els.list) return; // 非外卖页或结构缺失，静默跳过

    bindEvents();
    renderHistory();

    var last = loadResult();
    if (last && last.list && last.list.length){
      currentKeyword = last.keyword || '';
      els.searchInput.value = last.keyword || '';
      els.searchClear.classList.toggle('is-visible', !!last.keyword);
      renderRestaurants(last.list);
      renderHistory();
    } else {
      showState('empty');
      updateEmptyStateHint();
    }
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ---------------- 菜单缓存：按餐厅 id 缓存菜品列表 ---------------- */

  function readMenuCache(){
    try {
      var raw = JSON.parse(localStorage.getItem(MENU_CACHE_KEY) || 'null');
      if (raw) return raw;
    } catch(e){}
    return {};
  }
  function writeMenuCache(cache){
    try { localStorage.setItem(MENU_CACHE_KEY, JSON.stringify(cache)); } catch(e){}
  }
  function loadMenuFromCache(restaurantId){
    var cache = readMenuCache();
    return cache[restaurantId] || null;
  }
  function saveMenuResult(restaurantId, dishes){
    var cache = readMenuCache();
    cache[restaurantId] = { dishes: dishes, time: Date.now() };
    writeMenuCache(cache);
  }

  /* ---------------- 店铺详情缓存：评价 / 公告 / 推荐菜品，按餐厅 id 持久化 ---------------- */

  var STORE_DETAIL_CACHE_KEY = 'luna_delivery_store_detail_cache';

  function readStoreDetailCache(){
    try {
      var raw = JSON.parse(localStorage.getItem(STORE_DETAIL_CACHE_KEY) || 'null');
      if (raw) return raw;
    } catch(e){}
    return {};
  }
  function writeStoreDetailCache(cache){
    try { localStorage.setItem(STORE_DETAIL_CACHE_KEY, JSON.stringify(cache)); } catch(e){}
  }
  function loadStoreDetailFromCache(restaurantId){
    var cache = readStoreDetailCache();
    return cache[restaurantId] || null;
  }
  function mergeStoreDetailCache(restaurantId, patch){
    var cache = readStoreDetailCache();
    var entry = cache[restaurantId] || {};
    for (var k in patch) entry[k] = patch[k];
    cache[restaurantId] = entry;
    writeStoreDetailCache(cache);
  }

  // 暴露给餐厅点餐页模块复用
  window.LunaDelivery = window.LunaDelivery || {};
  window.LunaDelivery.planDishes = planDishes;
  window.LunaDelivery.planDishesLocally = planDishesLocally;
  window.LunaDelivery.loadMenuFromCache = loadMenuFromCache;
  window.LunaDelivery.saveMenuResult = saveMenuResult;
  window.LunaDelivery.loadStoreDetailFromCache = loadStoreDetailFromCache;
  window.LunaDelivery.mergeStoreDetailCache = mergeStoreDetailCache;
  window.LunaDelivery.planStoreDetail = planStoreDetail;
  window.LunaDelivery.showToast = showToast;
  window.LunaDelivery.esc = esc;
})();

/* ==========================================================================
   外卖 · 餐厅点餐页（全屏覆盖层）
   结构与商品详情页同构：骨架先行 → AI 异步补齐菜单 → 步进器加购 → 底部结算条
   点击「去结算」时，把已加购的本店菜品统一交给 LunaShop 的购物车结算弹层，
   与商城商品共用同一套钱包扣款链路，只是行项携带 restaurantName 标记来源。
========================================================================== */
(function deliveryDetail(){

  var els = {};
  var currentRestaurant = null;
  var currentDishes = [];
  var dishQtyMap = {}; // { dishId: qty }，仅本店本次会话内的加购态，未提交购物车前的草稿
  var storeDetailBatch = 0; // 每次打开新店铺自增，避免异步结果串店铺

  function cacheEls(){
    els.mask       = document.getElementById('dvdMask');
    els.sheet      = document.getElementById('dvdSheet');
    els.scroll     = document.getElementById('dvdScroll');
    els.backBtn    = document.getElementById('dvdBackBtn');
    els.cartBtn    = document.getElementById('dvdCartBtn');
    els.floatBadge = document.getElementById('dvdFloatBadge');

    els.heroImg    = document.getElementById('dvdHeroImg');
    els.title      = document.getElementById('dvdTitle');
    els.cuisine    = document.getElementById('dvdCuisine');
    els.rate       = document.getElementById('dvdRate');
    els.monthlySales = document.getElementById('dvdMonthlySales');
    els.distance   = document.getElementById('dvdDistance');
    els.eta        = document.getElementById('dvdEta');
    els.deliveryFee= document.getElementById('dvdDeliveryFee');
    els.minOrder   = document.getElementById('dvdMinOrder');

    els.menuList   = document.getElementById('dvdMenuList');

    els.notice     = document.getElementById('dvdNotice');
    els.noticeText = document.getElementById('dvdNoticeText');

    els.reviewBlock   = document.getElementById('dvdReviewBlock');
    els.reviewSummary = document.getElementById('dvdReviewSummary');
    els.reviewTags    = document.getElementById('dvdReviewTags');
    els.reviewList    = document.getElementById('dvdReviewList');

    els.recoBlock  = document.getElementById('dvdRecoBlock');
    els.recoScroll = document.getElementById('dvdRecoScroll');

    els.settleBar  = document.getElementById('dvdSettleBar');
    els.settleTotal= document.getElementById('dvdSettleTotal');
    els.settleHint = document.getElementById('dvdSettleHint');
    els.settleBtn  = document.getElementById('dvdSettleBtn');

    els.dvdStatusTime = document.getElementById('dvdStatusTime');
    els.dvdBatPct     = document.getElementById('dvdBatPct');
    els.dvdBatInner   = document.getElementById('dvdBatInner');
  }

  function syncStatusBar(){
    var mainTime = document.getElementById('statusTime');
    var mainPct  = document.getElementById('batPct');
    var mainInner= document.getElementById('batInner');
    if (els.dvdStatusTime && mainTime) els.dvdStatusTime.textContent = mainTime.textContent;
    if (els.dvdBatPct && mainPct) els.dvdBatPct.textContent = mainPct.textContent;
    if (els.dvdBatInner && mainInner){
      els.dvdBatInner.style.width = mainInner.style.width;
      els.dvdBatInner.style.background = mainInner.style.background;
    }
  }
  var statusSyncTimer = null;

  function esc(s){ return (window.LunaShop && window.LunaShop.escapeHtml) ? window.LunaShop.escapeHtml(s) : String(s == null ? '' : s); }

  function syncCartBadge(){
    var badge = document.getElementById('cartBadge');
    if (els.floatBadge && badge) els.floatBadge.textContent = badge.textContent;
  }

  /* ---------------- 打开 / 关闭 ---------------- */

  function openRestaurant(restaurant){
    if (!restaurant) return;
    currentRestaurant = restaurant;
    currentDishes = [];
    dishQtyMap = {};
    storeDetailBatch++;

    els.mask.classList.add('show');
    document.documentElement.style.overflow = 'hidden';
    syncStatusBar();
    statusSyncTimer = setInterval(syncStatusBar, 1000);
    syncCartBadge();

    els.scroll.scrollTop = 0;
    renderHeader(restaurant);
    renderMenuSkeleton();
    renderReviewSkeleton();
    renderRecoSkeleton();
    if (els.notice) els.notice.style.display = 'none';
    updateSettleBar();

    runMenuGeneration(restaurant);
    runStoreDetailGeneration(restaurant);
  }

  function closeRestaurant(){
    els.mask.classList.remove('show');
    document.documentElement.style.overflow = '';
    clearInterval(statusSyncTimer);
  }

  /* ---------------- 头部信息 ---------------- */

  function renderHeader(r){
    els.heroImg.src = r.image || '';
    els.heroImg.alt = r.name || '';
    els.title.textContent = r.name || '';
    els.cuisine.textContent = r.cuisine || '';
    els.rate.textContent = (r.rate || 4.6).toFixed(1);
    els.monthlySales.textContent = r.monthlySales || '';
    els.distance.textContent = r.distance || '';
    els.eta.textContent = (r.etaMinutes || 30) + '分钟送达';
    els.deliveryFee.textContent = '配送费 ¥' + (r.deliveryFee != null ? r.deliveryFee : 3);
    els.minOrder.textContent = '起送 ¥' + (r.minOrder != null ? r.minOrder : 20);
  }

  /* ---------------- 菜单渲染 ---------------- */

  function renderMenuSkeleton(){
    var html = '';
    for (var i = 0; i < 4; i++){
      html += '<div class="dvd-skel-row"></div>';
    }
    els.menuList.innerHTML = html;
  }

  function dishRowHtml(d){
    var img = d.image
      ? '<img src="' + d.image + '" alt="' + esc(d.name) + '" loading="lazy" />'
      : '';
    var qty = dishQtyMap[d.id] || 0;
    var ctrlHtml = qty > 0
      ? '<div class="dvd-dish-stepper" data-id="' + d.id + '">' +
          '<button class="is-minus" data-act="minus" aria-label="减少">－</button>' +
          '<span class="num">' + qty + '</span>' +
          '<button class="is-plus" data-act="plus" aria-label="增加">＋</button>' +
        '</div>'
      : '<button class="dvd-dish-add" data-id="' + d.id + '" aria-label="加入购物车">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button>';

    return (
      '<div class="dvd-dish" data-id="' + d.id + '">' +
        '<div class="dvd-dish-media">' + img + '</div>' +
        '<div class="dvd-dish-body">' +
          '<div class="dvd-dish-name">' + esc(d.name) + '</div>' +
          '<p class="dvd-dish-desc">' + esc(d.desc || '') + '</p>' +
          '<div class="dvd-dish-foot">' +
            '<span class="dvd-dish-price">' + d.price + '</span>' +
            ctrlHtml +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderMenu(){
    els.menuList.innerHTML = currentDishes.map(dishRowHtml).join('');
  }

  function updateOneDishMedia(d){
    var row = els.menuList.querySelector('.dvd-dish[data-id="' + d.id + '"]');
    if (!row) return;
    var media = row.querySelector('.dvd-dish-media');
    if (d.image && !media.querySelector('img')){
      var img = document.createElement('img');
      img.src = d.image;
      img.alt = d.name;
      img.loading = 'lazy';
      media.appendChild(img);
    }
  }

  /* ---------------- 菜品生成 ---------------- */

  function runMenuGeneration(restaurant){
    var LD = window.LunaDelivery || {};
    var LSApi = window.LunaShop || {};

    var cached = LD.loadMenuFromCache && LD.loadMenuFromCache(restaurant.id);
    if (cached && cached.dishes && cached.dishes.length){
      currentDishes = cached.dishes;
      renderMenu();
      updateSettleBar();
      return;
    }

    var plan = LD.planDishes ? LD.planDishes(restaurant) : Promise.resolve(LD.planDishesLocally ? LD.planDishesLocally(restaurant) : []);

    plan.then(function(dishes){
      currentDishes = dishes;
      renderMenu();
      updateSettleBar();

      var imageTasks = dishes.map(function(d){
        var resolve = LSApi.resolveOneImage ? LSApi.resolveOneImage(d) : Promise.resolve(null);
        return resolve
          .then(function(src){ d.image = src; })
          .catch(function(){ d.image = null; })
          .then(function(){
            try { updateOneDishMedia(d); }
            catch(e){ console.error('菜品图片渲染出错', e); }
          });
      });

      return Promise.all(imageTasks).then(function(){
        if (LD.saveMenuResult) LD.saveMenuResult(restaurant.id, dishes);
      });
    }).catch(function(err){
      console.error('菜单生成失败', err);
      els.menuList.innerHTML = '<p style="padding:20px 0;font-size:12px;color:var(--c-ink-4);text-align:center;">菜单生成失败，请返回重试</p>';
    });
  }

  /* ---------------- 店铺详情：公告 + 用户评价 + 人气推荐菜品 ---------------- */

  function renderReviewSkeleton(){
    if (!els.reviewSummary) return;
    els.reviewSummary.textContent = '生成中';
    els.reviewTags.innerHTML = '';
    var html = '<div class="dvd-review-skel">';
    for (var i = 0; i < 3; i++){
      html += '<div class="dvd-review-skel-item"><div class="dvd-review-skel-avatar"></div>' +
        '<div class="dvd-review-skel-lines"><i></i><i></i><i></i></div></div>';
    }
    html += '</div>';
    els.reviewList.innerHTML = html;
  }

  function renderRecoSkeleton(){
    if (!els.recoScroll) return;
    var html = '';
    for (var i = 0; i < 4; i++){
      html += '<div class="dvd-reco-card"><div class="dvd-reco-media" style="background:linear-gradient(100deg,#ececee 30%,#f6f6f7 50%,#ececee 70%);background-size:200% 100%;animation:dvShimmer 1.5s ease-in-out infinite;"></div>' +
        '<div class="dvd-reco-info"><div class="dvd-review-skel-lines"><i></i><i style="width:70%;"></i></div></div></div>';
    }
    els.recoScroll.innerHTML = html;
  }

  function runStoreDetailGeneration(restaurant){
    var LD = window.LunaDelivery || {};
    var batchId = storeDetailBatch;

    var cached = LD.loadStoreDetailFromCache && LD.loadStoreDetailFromCache(restaurant.id);
    if (cached && cached.notice != null){
      renderStoreNotice(cached.notice);
      renderReviews(cached.reviewTags || [], cached.reviews || []);
      renderRecommendedDishes(restaurant, cached.recoDishes, cached.recoImages);
      return;
    }

    var plan = LD.planStoreDetail ? LD.planStoreDetail(restaurant) : Promise.resolve(null);
    plan.then(function(detail){
      if (batchId !== storeDetailBatch || !detail) return;
      renderStoreNotice(detail.notice);
      renderReviews(detail.reviewTags, detail.reviews);
      if (LD.mergeStoreDetailCache){
        LD.mergeStoreDetailCache(restaurant.id, {
          notice: detail.notice,
          reviewTags: detail.reviewTags,
          reviews: detail.reviews
        });
      }
      renderRecommendedDishes(restaurant, null, null, detail.recoKeyword);
    }).catch(function(err){
      console.error('店铺详情生成失败', err);
      if (batchId !== storeDetailBatch) return;
      els.reviewSummary.textContent = '';
      els.reviewList.innerHTML = '<p style="padding:8px 0;font-size:12px;color:var(--c-ink-4);text-align:center;">评价加载失败</p>';
      renderRecommendedDishes(restaurant, null, null, restaurant.name);
    });
  }

  function renderStoreNotice(notice){
    if (!els.notice) return;
    if (!notice){ els.notice.style.display = 'none'; return; }
    els.noticeText.textContent = notice;
    els.notice.style.display = '';
  }

  function renderReviews(tags, reviews){
    if (!els.reviewList) return;
    tags = tags || [];
    reviews = reviews || [];

    var rateNum = (currentRestaurant && currentRestaurant.rate) || 4.6;
    var pct = Math.round(Math.min(100, Math.max(80, (rateNum / 5) * 100)));
    els.reviewSummary.textContent = pct + '% 好评 · ' + reviews.length + '+ 条精选';

    els.reviewTags.innerHTML = tags.map(function(t){
      return '<span class="dvd-review-tag">' + esc(t) + '</span>';
    }).join('');

    els.reviewList.innerHTML = reviews.map(function(r){
      var initial = (r.name || '?').replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').charAt(0) || '匿';
      var stars = '';
      for (var i = 0; i < 5; i++){
        stars += i < (r.stars || 5)
          ? '<svg viewBox="0 0 24 24" fill="#17171a"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8L2.2 9.5l6.9-.7L12 2.5Z"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8L2.2 9.5l6.9-.7L12 2.5Z" stroke="#d8d8dc" stroke-width="1.4"/></svg>';
      }
      return '<div class="dvd-review-item">' +
        '<div class="dvd-review-avatar">' + esc(initial) + '</div>' +
        '<div class="dvd-review-body">' +
          '<div class="dvd-review-top"><span class="dvd-review-name">' + esc(r.name) + '</span><span class="dvd-review-date">' + esc(r.date || '') + '</span></div>' +
          '<div class="dvd-review-stars">' + stars + '</div>' +
          '<div class="dvd-review-text">' + esc(r.text) + '</div>' +
          (r.dish ? '<div class="dvd-review-dish">' + esc(r.dish) + '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ---------------- 猜你喜欢：本店人气推荐菜品，复用菜单生成链路，可直接加购 ---------------- */

  function renderRecommendedDishes(restaurant, cachedDishes, cachedImages, recoKeyword){
    var LD = window.LunaDelivery || {};
    var LSApi = window.LunaShop || {};
    var batchId = storeDetailBatch;

    if (cachedDishes && cachedDishes.length){
      renderRecoCards(cachedDishes, cachedImages || {});
      return;
    }

    var recoRestaurant = {
      id: restaurant.id + '_reco',
      name: recoKeyword || restaurant.name,
      cuisine: restaurant.cuisine,
      searchKeyword: restaurant.searchKeyword
    };
    var plan = LD.planDishes ? LD.planDishes(recoRestaurant) : Promise.resolve(LD.planDishesLocally ? LD.planDishesLocally(recoRestaurant) : []);

    plan.then(function(dishes){
      if (batchId !== storeDetailBatch) return;
      dishes = (dishes || []).slice(0, 4);
      renderRecoCards(dishes, {});

      var images = {};
      var pending = dishes.length;
      if (!pending) return;
      dishes.forEach(function(d){
        var resolve = LSApi.resolveOneImage ? LSApi.resolveOneImage(d) : Promise.resolve(null);
        resolve.then(function(src){
          if (batchId !== storeDetailBatch) return;
          d.image = src;
          images[d.id] = src;
          var img = els.recoScroll.querySelector('.dvd-reco-card[data-id="' + d.id + '"] img');
          if (img) img.src = src;
        }).catch(function(){}).then(function(){
          pending--;
          if (pending === 0 && LD.mergeStoreDetailCache){
            LD.mergeStoreDetailCache(restaurant.id, { recoDishes: dishes, recoImages: images });
          }
        });
      });
    }).catch(function(err){
      console.error('推荐菜品生成失败', err);
      if (batchId !== storeDetailBatch) return;
      els.recoScroll.innerHTML = '';
    });
  }

  function recoDishAddHtml(d){
    return '<button class="dvd-reco-add" data-id="' + d.id + '" aria-label="加入购物车">' +
      '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    '</button>';
  }

  function renderRecoCards(dishes, images){
    els.recoScroll.innerHTML = dishes.map(function(d){
      var src = (images && images[d.id]) || d.image;
      return '<div class="dvd-reco-card" data-id="' + d.id + '">' +
        '<div class="dvd-reco-media"><img' + (src ? (' src="' + src + '"') : '') + ' alt="" loading="lazy"/></div>' +
        '<div class="dvd-reco-info">' +
          '<div class="dvd-reco-name">' + esc(d.name) + '</div>' +
          '<div class="dvd-reco-foot">' +
            '<span class="dvd-reco-price">' + d.price + '</span>' +
            recoDishAddHtml(d) +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var byId = {};
    dishes.forEach(function(d){ byId[d.id] = d; });

    Array.prototype.slice.call(els.recoScroll.querySelectorAll('.dvd-reco-add')).forEach(function(btn){
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        var d = byId[btn.dataset.id];
        if (!d) return;
        // 推荐菜品不在当前店铺原生菜单里，直接作为独立行项加入购物车，
        // 携带当前店铺名作为来源标记，与菜单加购走同一套结算链路。
        var LSApi = window.LunaShop || {};
        if (!LSApi.cartAddItem || !currentRestaurant) return;
        LSApi.cartAddItem({
          id: 'dv_' + currentRestaurant.id + '_reco_' + d.id,
          name: d.name,
          price: d.price,
          image: d.image,
          tag: currentRestaurant.name
        }, { qty: 1 });
        syncCartBadge();
        var LD = window.LunaDelivery || {};
        if (LD.showToast) LD.showToast('已加入购物车 · ' + d.name);
        if (navigator.vibrate){ try { navigator.vibrate(8); } catch(err){} }
      });
    });
  }

  /* ---------------- 加购 / 步进器 ---------------- */

  function findDish(id){
    for (var i = 0; i < currentDishes.length; i++){
      if (currentDishes[i].id === id) return currentDishes[i];
    }
    return null;
  }

  function updateSettleBar(){
    var totalQty = 0, totalPrice = 0;
    Object.keys(dishQtyMap).forEach(function(id){
      var qty = dishQtyMap[id];
      var dish = findDish(id);
      if (dish && qty > 0){
        totalQty += qty;
        totalPrice += dish.price * qty;
      }
    });
    els.settleTotal.textContent = totalPrice;

    var minOrder = (currentRestaurant && currentRestaurant.minOrder) || 0;
    if (totalQty === 0){
      els.settleHint.textContent = minOrder ? ('起送 ¥' + minOrder) : '';
      els.settleBtn.disabled = true;
    } else if (totalPrice < minOrder){
      els.settleHint.textContent = '还差 ¥' + (minOrder - totalPrice) + ' 起送';
      els.settleBtn.disabled = true;
    } else {
      els.settleHint.textContent = '共 ' + totalQty + ' 件';
      els.settleBtn.disabled = false;
    }
  }

  function setDishQty(id, qty){
    qty = Math.max(0, qty);
    if (qty === 0){
      delete dishQtyMap[id];
    } else {
      dishQtyMap[id] = qty;
    }
    var row = els.menuList.querySelector('.dvd-dish[data-id="' + id + '"] .dvd-dish-foot');
    if (!row) return;
    var oldCtrl = row.querySelector('.dvd-dish-stepper, .dvd-dish-add');
    if (oldCtrl) oldCtrl.remove();

    var dish = findDish(id);
    var ctrlHtml = qty > 0
      ? '<div class="dvd-dish-stepper" data-id="' + id + '">' +
          '<button class="is-minus" data-act="minus" aria-label="减少">－</button>' +
          '<span class="num">' + qty + '</span>' +
          '<button class="is-plus" data-act="plus" aria-label="增加">＋</button>' +
        '</div>'
      : '<button class="dvd-dish-add" data-id="' + id + '" aria-label="加入购物车">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
        '</button>';
    row.insertAdjacentHTML('beforeend', ctrlHtml);

    updateSettleBar();
  }

  function bindMenuDelegation(){
    els.menuList.addEventListener('click', function(e){
      var addBtn = e.target.closest ? e.target.closest('.dvd-dish-add') : null;
      if (addBtn){
        setDishQty(addBtn.dataset.id, 1);
        if (navigator.vibrate){ try { navigator.vibrate(8); } catch(err){} }
        return;
      }
      var stepBtn = e.target.closest ? e.target.closest('.dvd-dish-stepper button') : null;
      if (stepBtn){
        var wrap = stepBtn.closest('.dvd-dish-stepper');
        var id = wrap.dataset.id;
        var cur = dishQtyMap[id] || 0;
        setDishQty(id, stepBtn.dataset.act === 'plus' ? cur + 1 : cur - 1);
        return;
      }
    });
  }

  /* ---------------- 结算：把已勾选菜品统一写入购物车，携带餐厅来源标记 ---------------- */

  function submitToCart(){
    var LSApi = window.LunaShop || {};
    if (!LSApi.cartAddItem || !currentRestaurant) return;

    var addedNames = [];
    Object.keys(dishQtyMap).forEach(function(id){
      var qty = dishQtyMap[id];
      var dish = findDish(id);
      if (!dish || qty <= 0) return;
      LSApi.cartAddItem({
        id: 'dv_' + currentRestaurant.id + '_' + dish.id,
        name: dish.name,
        price: dish.price,
        image: dish.image,
        tag: currentRestaurant.name
      }, { qty: qty });
      addedNames.push(dish.name);
    });

    if (!addedNames.length) return;

    dishQtyMap = {};
    renderMenu();
    updateSettleBar();
    syncCartBadge();

    var LD = window.LunaDelivery || {};
    if (LD.showToast) LD.showToast('已加入购物车 · ' + currentRestaurant.name);
    if (navigator.vibrate){ try { navigator.vibrate(8); } catch(err){} }
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents(){
    els.backBtn.addEventListener('click', closeRestaurant);
    els.cartBtn.addEventListener('click', function(){
      closeRestaurant();
      var navCart = document.querySelector('.nav-item[data-view="cart"]');
      if (navCart) navCart.click();
    });
    els.settleBtn.addEventListener('click', submitToCart);
    bindMenuDelegation();
  }

  function init(){
    cacheEls();
    if (!els.mask) return;
    bindEvents();

    window.LunaDelivery = window.LunaDelivery || {};
    window.LunaDelivery.openRestaurant = openRestaurant;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================================================
   线上餐厅 —— 占位面板交互（返回按钮），内容主体后续版本接入
========================================================================== */
(function onlineRestaurantPlaceholder(){
  function init(){
    var mask = document.getElementById('onlMask');
    var backBtn = document.getElementById('onlBackBtn');
    if (!mask || !backBtn) return;
    backBtn.addEventListener('click', function(){
      mask.classList.remove('show');
      document.documentElement.style.overflow = '';
    });
  }
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================================================
   购物车模块（CartStore）
   数据结构：localStorage('luna_cart_items') = [
     { cartItemId, productId, name, price, originalPrice, image, tag,
       size, color, qty, checked, addedAt }
   ]
   职责：
   1) 统一的加购入口（商城网格「+」、详情页「加入购物车」都落到这里）
   2) 购物车视图渲染：分组（按 tag 归为一个「精选来源」分组做视觉分区）、
      勾选 / 全选、步进器改数量、左滑删除
   3) 结算：勾选商品走与详情页结算弹层相同的钱包扣款链路
   4) 徽标同步：主导航徽标与详情页悬浮徽标始终反映购物车真实件数
========================================================================== */
(function cartStore(){

  var STORAGE_KEY = 'luna_cart_items';
  var LS = null;
  var els = {};
  var isEditing = false;
  var swipedItemId = null; // 当前处于「左滑露出删除」态的行，同一时间只允许一行

  function cacheEls(){
    els.panel        = document.querySelector('.cart-panel');
    els.statCount     = document.getElementById('cartStatCount');
    els.editBtn      = document.getElementById('cartEditBtn');
    els.editBtnText  = document.getElementById('cartEditBtnText');
    els.scroll       = document.getElementById('cartScroll');
    els.empty        = document.getElementById('cartEmpty');
    els.goMallBtn    = document.getElementById('cartGoMallBtn');
    els.groupList    = document.getElementById('cartGroupList');
    els.settleBar    = document.getElementById('cartSettleBar');
    els.selectAllBtn = document.getElementById('cartSelectAllBtn');
    els.selectAllCheck = document.getElementById('cartSelectAllCheck');
    els.settleTotal  = document.getElementById('cartSettleTotal');
    els.settleBtn    = document.getElementById('cartSettleBtn');
    els.mainBadge    = document.getElementById('cartBadge');
  }

  /* ---------------- 读写持久化 ---------------- */

  function readItems(){
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch(e){ return []; }
  }
  function writeItems(items){
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch(e){}
  }

  // 同一商品 + 同一规格（尺码/颜色）视为同一行，重复加购只累加数量，
  // 与真实电商购物车行为一致，避免清单里出现大量重复行。
  function findMatchIndex(items, entry){
    for (var i = 0; i < items.length; i++){
      var it = items[i];
      if (it.productId === entry.productId && it.size === entry.size && it.color === entry.color){
        return i;
      }
    }
    return -1;
  }

  // 统一加购入口：product 为完整商品对象（来自 mall-card 索引或商品详情），
  // opts 可携带 { size, color, qty, image }，均为可选。
  function addItem(product, opts){
    opts = opts || {};
    if (!product || !product.id) return;
    var items = readItems();
    var entry = {
      productId: product.id,
      name: product.name || '未命名商品',
      price: Number(product.price) || 0,
      originalPrice: product.originalPrice || null,
      image: opts.image || product.image || '',
      tag: product.tag || '',
      size: opts.size || '',
      color: opts.color || '',
      qty: Math.max(1, opts.qty || 1)
    };
    var idx = findMatchIndex(items, entry);
    if (idx !== -1){
      items[idx].qty += entry.qty;
      // 图片/价格可能在再次加购时已刷新（如详情页重新生成），保持展示最新
      items[idx].image = entry.image || items[idx].image;
      items[idx].price = entry.price || items[idx].price;
      items[idx].originalPrice = entry.originalPrice;
    } else {
      entry.cartItemId = 'ci_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      entry.checked = true;
      entry.addedAt = Date.now();
      items.unshift(entry);
    }
    writeItems(items);
    syncBadges();
    if (els.panel) render();
    return items;
  }

  function removeItem(cartItemId){
    var items = readItems().filter(function(it){ return it.cartItemId !== cartItemId; });
    writeItems(items);
    syncBadges();
    render();
  }

  function updateQty(cartItemId, delta){
    var items = readItems();
    var it = items.filter(function(x){ return x.cartItemId === cartItemId; })[0];
    if (!it) return;
    it.qty = Math.max(1, Math.min(99, it.qty + delta));
    writeItems(items);
    render();
  }

  function toggleChecked(cartItemId){
    var items = readItems();
    var it = items.filter(function(x){ return x.cartItemId === cartItemId; })[0];
    if (!it) return;
    it.checked = !it.checked;
    writeItems(items);
    render();
  }

  function toggleGroupChecked(tag){
    var items = readItems();
    var group = items.filter(function(x){ return (x.tag || '未分组') === tag; });
    var allChecked = group.length > 0 && group.every(function(x){ return x.checked; });
    items.forEach(function(x){
      if ((x.tag || '未分组') === tag) x.checked = !allChecked;
    });
    writeItems(items);
    render();
  }

  function toggleSelectAll(){
    var items = readItems();
    var allChecked = items.length > 0 && items.every(function(x){ return x.checked; });
    items.forEach(function(x){ x.checked = !allChecked; });
    writeItems(items);
    render();
  }

  function totalCount(){
    return readItems().reduce(function(sum, it){ return sum + it.qty; }, 0);
  }

  function checkedTotalPrice(){
    return readItems().reduce(function(sum, it){
      return it.checked ? sum + it.price * it.qty : sum;
    }, 0);
  }

  /* ---------------- 徽标同步：主导航 + 商品详情页悬浮徽标 ---------------- */

  function syncBadges(){
    var n = totalCount();
    if (els.mainBadge) els.mainBadge.textContent = n;
    var floatBadge = document.getElementById('pdFloatBadge');
    if (floatBadge) floatBadge.textContent = n;
  }

  /* ---------------- 渲染 ---------------- */

  function groupHtml(tag, group){
    var groupChecked = group.every(function(x){ return x.checked; });
    var rowsHtml = group.map(itemHtml).join('');
    return (
      '<div class="cart-group" data-tag="' + LS.escapeHtml(tag) + '">' +
        '<div class="cart-group-head">' +
          '<span class="cart-group-check' + (groupChecked ? ' is-checked' : '') + '" data-group-check="' + LS.escapeHtml(tag) + '">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</span>' +
          '<span class="cart-group-name"><span class="dot"></span>' + LS.escapeHtml(tag) + '</span>' +
        '</div>' +
        rowsHtml +
      '</div>'
    );
  }

  function itemHtml(it){
    var img = it.image
      ? '<img src="' + it.image + '" alt="' + LS.escapeHtml(it.name) + '" loading="lazy"/>'
      : '';
    var specParts = [];
    if (it.size) specParts.push(it.size + ' 码');
    if (it.color) specParts.push(it.color);
    var specHtml = specParts.length
      ? '<span class="cart-item-spec">' + LS.escapeHtml(specParts.join(' · ')) + '</span>'
      : '';
    var originalHtml = it.originalPrice
      ? '<span class="cart-item-price-original">¥' + it.originalPrice + '</span>'
      : '';
    return (
      '<div class="cart-item" data-id="' + it.cartItemId + '">' +
        '<div class="cart-item-track">' +
          '<span class="cart-item-check' + (it.checked ? ' is-checked' : '') + '" data-check="' + it.cartItemId + '">' +
            '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</span>' +
          '<div class="cart-item-media" data-open="' + it.cartItemId + '">' +
            (it.tag ? '<span class="cart-item-media-tag">' + LS.escapeHtml(it.tag) + '</span>' : '') +
            img +
          '</div>' +
          '<div class="cart-item-info" data-open="' + it.cartItemId + '">' +
            '<div class="cart-item-name">' + LS.escapeHtml(it.name) + '</div>' +
            specHtml +
            '<div class="cart-item-bottom">' +
              '<div class="cart-item-price-group">' +
                '<span class="cart-item-price">' + it.price + '</span>' +
                originalHtml +
              '</div>' +
              '<div class="cart-qty-ctrl">' +
                '<button class="cart-qty-btn" data-qty-minus="' + it.cartItemId + '"' + (it.qty <= 1 ? ' disabled' : '') + '>－</button>' +
                '<span class="cart-qty-num">' + it.qty + '</span>' +
                '<button class="cart-qty-btn" data-qty-plus="' + it.cartItemId + '">＋</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button class="cart-item-delete" data-delete="' + it.cartItemId + '" aria-label="删除">' +
          '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</button>' +
      '</div>'
    );
  }

  function render(){
    if (!els.groupList || !LS) return;
    var items = readItems();

    els.statCount.textContent = items.reduce(function(s, it){ return s + it.qty; }, 0);

    if (!items.length){
      els.empty.classList.add('is-active');
      els.groupList.innerHTML = '';
      els.settleBar.style.display = 'none';
      isEditing = false;
      els.editBtn.classList.remove('is-editing');
      els.editBtnText.textContent = '管理';
      return;
    }

    els.empty.classList.remove('is-active');
    els.settleBar.style.display = 'flex';

    // 按 tag 分组，无 tag 归为「精选好物」，保持列表在视觉上有呼吸区块
    var groups = {};
    var order = [];
    items.forEach(function(it){
      var tag = it.tag || '精选好物';
      if (!groups[tag]){ groups[tag] = []; order.push(tag); }
      groups[tag].push(it);
    });
    els.groupList.innerHTML = order.map(function(tag){ return groupHtml(tag, groups[tag]); }).join('');

    // 若有行处于滑动露出删除态，渲染后恢复该状态（否则每次渲染都会被重置）
    if (swipedItemId){
      var row = els.groupList.querySelector('.cart-item[data-id="' + swipedItemId + '"]');
      if (row) row.classList.add('is-swiped');
    }

    var allChecked = items.every(function(it){ return it.checked; });
    els.selectAllCheck.classList.toggle('is-checked', allChecked);

    var total = checkedTotalPrice();
    els.settleTotal.textContent = total;
    var anyChecked = items.some(function(it){ return it.checked; });
    els.settleBtn.disabled = !anyChecked;
  }

  /* ---------------- 交互绑定 ---------------- */

  function closeSwipe(){
    if (!swipedItemId) return;
    var row = els.groupList.querySelector('.cart-item[data-id="' + swipedItemId + '"]');
    if (row) row.classList.remove('is-swiped');
    swipedItemId = null;
  }

  function bindSwipeGestures(){
    var startX = null, startY = null, dragging = false, activeRow = null;

    els.groupList.addEventListener('touchstart', function(e){
      var row = e.target.closest ? e.target.closest('.cart-item') : null;
      if (!row) return;
      // 已有其它行处于滑开态时，先收起，避免多行同时露出删除背板
      if (swipedItemId && swipedItemId !== row.dataset.id) closeSwipe();
      activeRow = row;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      dragging = false;
    }, { passive: true });

    els.groupList.addEventListener('touchmove', function(e){
      if (!activeRow || startX == null) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      if (!dragging && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) dragging = true;
      if (!dragging) return;
      if (dx < -18){
        activeRow.classList.add('is-swiped');
        swipedItemId = activeRow.dataset.id;
      } else if (dx > 18){
        activeRow.classList.remove('is-swiped');
        if (swipedItemId === activeRow.dataset.id) swipedItemId = null;
      }
    }, { passive: true });

    els.groupList.addEventListener('touchend', function(){
      activeRow = null; startX = null; startY = null; dragging = false;
    }, { passive: true });
  }

  function bindEvents(){
    els.editBtn.addEventListener('click', function(){
      isEditing = !isEditing;
      els.editBtn.classList.toggle('is-editing', isEditing);
      els.editBtnText.textContent = isEditing ? '完成' : '管理';
    });

    els.goMallBtn.addEventListener('click', function(){
      var mallNav = document.querySelector('.nav-item[data-view="mall"]');
      if (mallNav) mallNav.click();
    });

    els.selectAllBtn.addEventListener('click', toggleSelectAll);
    els.settleBtn.addEventListener('click', openCartCheckout);

    els.groupList.addEventListener('click', function(e){
      var t = e.target;
      var groupCheck = t.closest ? t.closest('[data-group-check]') : null;
      if (groupCheck){ toggleGroupChecked(groupCheck.dataset.groupCheck); return; }

      var check = t.closest ? t.closest('[data-check]') : null;
      if (check){ toggleChecked(check.dataset.check); return; }

      var minus = t.closest ? t.closest('[data-qty-minus]') : null;
      if (minus){ updateQty(minus.dataset.qtyMinus, -1); return; }

      var plus = t.closest ? t.closest('[data-qty-plus]') : null;
      if (plus){ updateQty(plus.dataset.qtyPlus, 1); return; }

      var del = t.closest ? t.closest('[data-delete]') : null;
      if (del){
        var id = del.dataset.delete;
        var row = del.closest('.cart-item');
        if (row){
          row.classList.add('is-removing');
          setTimeout(function(){ removeItem(id); }, 300);
        } else {
          removeItem(id);
        }
        return;
      }

      // 滑开态下点击行主体先收起，不直接跳转，避免误触详情页
      var open = t.closest ? t.closest('[data-open]') : null;
      if (open){
        var openRow = open.closest('.cart-item');
        if (openRow && openRow.classList.contains('is-swiped')){
          openRow.classList.remove('is-swiped');
          swipedItemId = null;
          return;
        }
        var items = readItems();
        var it = items.filter(function(x){ return x.cartItemId === open.dataset.open; })[0];
        if (it && window.LunaShop && window.LunaShop.openDetail){
          var product = LS.getProductById(it.productId) || {
            id: it.productId, name: it.name, price: it.price,
            originalPrice: it.originalPrice, image: it.image, tag: it.tag
          };
          window.LunaShop.openDetail(product);
        }
      }
    });

    bindSwipeGestures();
  }

  /* ---------------- 结算：勾选商品合并为一笔订单，复用钱包扣款逻辑 ---------------- */

  function openCartCheckout(){
    var items = readItems().filter(function(it){ return it.checked; });
    if (!items.length) return;
    var total = checkedTotalPrice();

    if (window.LunaShop && window.LunaShop.openCartSettlement){
      window.LunaShop.openCartSettlement(items, total).then(function(success){
        if (success){
          // 支付成功后移除已结算商品，保留未勾选行
          var remaining = readItems().filter(function(it){ return !it.checked; });
          writeItems(remaining);
          syncBadges();
          render();
        }
      });
    }
  }

  /* ---------------- 初始化 ---------------- */

  function init(){
    cacheEls();
    if (!els.groupList) return; // 非商城页，静默跳过

    LS = window.LunaShop;
    if (!LS){
      console.error('LunaShop 未初始化，购物车模块依赖 mallAI 模块先加载');
      return;
    }

    bindEvents();
    syncBadges();
    render();

    // 每次切换到「购物车」板块时重新渲染，保证与商城/详情页的加购动作即时同步
    document.querySelectorAll('.nav-item[data-view="cart"], .nav-wing[data-view="cart"]').forEach(function(btn){
      btn.addEventListener('click', render);
    });

    window.LunaShop.cartAddItem = addItem;
    window.LunaShop.cartRender = render;
    window.LunaShop.cartSyncBadges = syncBadges;
    window.LunaShop.cartTotalCount = totalCount;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ==========================================================================
   图片来源（Pexels）设置弹层
   独立模块：打开/关闭、Key 显隐、测试搜索、保存配置
   数据落地：localStorage('luna_search_current') = { apiKey }
   与主商城生成流程完全解耦，商城页只在需要取图时读取这个 key。
========================================================================== */
(function imageSourcePanel(){

  var STORAGE_KEY = 'luna_search_current';
  var els = {};

  function cacheEls(){
    els.trigger    = document.getElementById('imageSourceBtn');
    els.mask       = document.getElementById('imgSrcMask');
    els.close      = document.getElementById('imgSrcClose');
    els.apiKey     = document.getElementById('searchApiKey');
    els.keyToggle  = document.getElementById('searchKeyToggle');
    els.testWrap   = document.getElementById('searchTestWrap');
    els.testInput  = document.getElementById('searchTestKeyword');
    els.testBtn    = document.getElementById('searchTestBtn');
    els.testOutput = document.getElementById('searchTestOutput');
    els.saveBtn    = document.getElementById('searchSaveBtn');
    els.status     = document.getElementById('imgSrcStatus');
  }

  function loadSaved(){
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e){}
    if (cur.apiKey){
      els.apiKey.value = cur.apiKey;
      els.testWrap.style.display = '';
    }
    onKeyInput();
  }

  function open(){
    els.mask.classList.add('show');
    loadSaved();
  }
  function close(){
    els.mask.classList.remove('show');
  }

  function onKeyInput(){
    var has = !!els.apiKey.value.trim();
    els.testWrap.style.display = has ? '' : 'none';
    els.saveBtn.disabled = !has;
  }

  function toggleKeyVisible(){
    els.apiKey.type = els.apiKey.type === 'password' ? 'text' : 'password';
  }

  function runTestSearch(){
    var key = els.apiKey.value.trim();
    var query = els.testInput.value.trim() || 'minimalist product';
    if (!key) return;

    els.testBtn.disabled = true;
    els.testOutput.innerHTML = '<div class="img-src-test-msg">搜索中...</div>';

    fetch('https://api.pexels.com/v1/search?query=' + encodeURIComponent(query) + '&per_page=3&orientation=square', {
      headers: { 'Authorization': key }
    })
      .then(function(resp){
        if (!resp.ok) throw new Error('HTTP ' + resp.status + '，请检查 Key 是否正确');
        return resp.json();
      })
      .then(function(data){
        var photos = data.photos || [];
        if (!photos.length){
          els.testOutput.innerHTML = '<div class="img-src-test-msg">未搜索到相关图片，换个关键词试试</div>';
          return;
        }
        els.testOutput.innerHTML = photos.map(function(p){
          var src = p.src && (p.src.medium || p.src.small);
          return src ? '<img src="' + src + '" alt="test" />' : '';
        }).join('');
      })
      .catch(function(err){
        els.testOutput.innerHTML = '<div class="img-src-test-msg is-error">' + (err.message || '请求失败') + '</div>';
      })
      .finally(function(){
        els.testBtn.disabled = false;
      });
  }

  function saveConfig(){
    var key = els.apiKey.value.trim();
    if (!key) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey: key }));
      els.status.textContent = '已保存，商城取图将优先尝试真实图片搜索';
      els.status.className = 'img-src-status is-success';
    } catch(e){
      els.status.textContent = '保存失败：' + e.message;
      els.status.className = 'img-src-status is-error';
    }
  }

  function bindEvents(){
    if (els.trigger) els.trigger.addEventListener('click', open);
    if (els.close) els.close.addEventListener('click', close);
    if (els.mask) els.mask.addEventListener('click', function(e){
      if (e.target === els.mask) close();
    });
    if (els.apiKey) els.apiKey.addEventListener('input', onKeyInput);
    if (els.keyToggle) els.keyToggle.addEventListener('click', toggleKeyVisible);
    if (els.testBtn) els.testBtn.addEventListener('click', runTestSearch);
    if (els.saveBtn) els.saveBtn.addEventListener('click', saveConfig);
  }

  function init(){
    cacheEls();
    if (!els.mask) return; // 非商城页，静默跳过
    bindEvents();
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
/* ==========================================================================
   商品详情页 · Product Detail
   点击任意商品卡片进入。链路：
     1) 复用 mallAI 的文本模型配置，向模型请求一份「详情扩写」JSON：
        长文案 / 材质规格 / 是否服装（含尺码表） / 颜色款式 / 评价 / 推荐搜索词
     2) 多图相册：以商品的 imagePrompt / searchKeyword 为基础派生 4~5 条
        不同角度/细节的检索词（正面、细节、材质特写、场景实拍……），
        分别取图，避免"一张图复制四遍"；取图链路与商城主流程一致
        （AI 生图 → 真实图片搜索 → 本地占位，逐级兜底）。
     3) 推荐商品：基于当前商品品类，复用「选品」链路生成一组关联商品，
        点击可继续下钻（详情页内可再次跳转到新的详情页）。
     4) 结算：加入购物车 / 立即购买 弹出结算面板，
        可选「自己购买」或「赠送给角色」（读取 LunaCharDB 角色库），
        付款方可选「本人」或「对方（角色）代付」——因为虚拟角色没有
        真实余额，「对方代付」在本产品语境下等价于豁免本人扣款，
        并在账单摘要中如实注明"由角色代付"，不伪造角色侧扣款记录。
        本人支付时複用钱包（LunaWalletHomeDB）余额扣减与支付密码校验，
        与钱包 App 内其他扣款场景保持同一套资金真实性规则。
========================================================================== */
(function productDetail(){

  var els = {};
  var LS = null; // window.LunaShop 引用，init 时确认存在
  var currentProduct = null;
  var currentDetail = null; // AI 生成的详情扩写结果
  var currentGalleryUrls = [];
  var galleryIndex = 0;
  var selectedSize = null;
  var selectedColor = null;
  var isFav = false;
  var detailBatch = 0;

  var CHECKOUT_MODE = 'self'; // self | gift
  var CHECKOUT_PAYER = 'me';  // me | other
  var checkoutQty = 1;
  var isCartSettlement = false; // true 时表示当前结算弹层由购物车「结算」按钮触发（多商品合并支付）
  var cartSettlementItems = [];
  var cartSettlementTotal = 0;
  var cartSettlementResolve = null;
  var selectedGiftCharId = null;
  var giftCharacters = [];

  /* ---------------- 详情页持久化缓存 ----------------
     问题：此前每次打开详情页（哪怕是同一件商品反复点开、或从推荐位
     绕回原商品）都会重新调用文本模型 + 生图，白白浪费 token。
     方案：按 product.id 缓存「AI 详情扩写结果 + 相册图 URL + 推荐商品列表」，
     写入 localStorage 持久化；下次打开同一商品直接命中缓存秒开渲染，
     不再发起任何网络请求。
  ========================================================================= */
  var DETAIL_CACHE_KEY = 'luna_shop_detail_cache';
  var MAX_DETAIL_CACHE_ENTRIES = 40;

  function loadDetailCacheStore(){
    try {
      var raw = localStorage.getItem(DETAIL_CACHE_KEY);
      if (!raw) return { entries: {}, order: [] };
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return { entries: {}, order: [] };
      parsed.entries = parsed.entries || {};
      parsed.order = Array.isArray(parsed.order) ? parsed.order : [];
      return parsed;
    } catch(e){ return { entries: {}, order: [] }; }
  }

  function saveDetailCacheStore(store){
    try { localStorage.setItem(DETAIL_CACHE_KEY, JSON.stringify(store)); }
    catch(e){ /* 存储失败（容量满等）不影响当前渲染，静默忽略 */ }
  }

  function getDetailCacheEntry(productId){
    var store = loadDetailCacheStore();
    return store.entries[productId] || null;
  }

  function setDetailCacheEntry(productId, data){
    var store = loadDetailCacheStore();
    store.entries[productId] = { data: data, time: Date.now() };
    var idx = store.order.indexOf(productId);
    if (idx !== -1) store.order.splice(idx, 1);
    store.order.push(productId);
    while (store.order.length > MAX_DETAIL_CACHE_ENTRIES){
      var oldest = store.order.shift();
      delete store.entries[oldest];
    }
    saveDetailCacheStore(store);
  }

  function cacheEls(){
    els.mask        = document.getElementById('pdMask');
    els.sheet       = document.getElementById('pdSheet');
    els.scroll      = document.getElementById('pdScroll');
    els.backBtn     = document.getElementById('pdBackBtn');
    els.shareBtn    = document.getElementById('pdShareBtn');
    els.cartBtn     = document.getElementById('pdCartBtn');
    els.floatBadge  = document.getElementById('pdFloatBadge');

    els.galleryTrack = document.getElementById('pdGalleryTrack');
    els.galleryDots  = document.getElementById('pdGalleryDots');
    els.galleryTag   = document.getElementById('pdGalleryTag');

    els.price       = document.getElementById('pdPrice');
    els.priceOrig   = document.getElementById('pdPriceOriginal');
    els.priceBadges = document.getElementById('pdPriceBadges');
    els.title       = document.getElementById('pdTitle');
    els.subtitle    = document.getElementById('pdSubtitle');
    els.rate        = document.getElementById('pdRate');
    els.sales       = document.getElementById('pdSales');
    els.reviewCount = document.getElementById('pdReviewCount');

    els.sizeBlock   = document.getElementById('pdSizeBlock');
    els.sizeRow     = document.getElementById('pdSizeRow');
    els.sizeHint    = document.getElementById('pdSizeHint');
    els.sizeGuideBtn= document.getElementById('pdSizeGuideBtn');

    els.colorBlock  = document.getElementById('pdColorBlock');
    els.colorRow    = document.getElementById('pdColorRow');

    els.descText    = document.getElementById('pdDescText');
    els.specGrid    = document.getElementById('pdSpecGrid');
    els.detailImgs  = document.getElementById('pdDetailImgs');

    els.sizeTableBlock = document.getElementById('pdSizeTableBlock');
    els.sizeTable   = document.getElementById('pdSizeTable');
    els.sizeNote    = document.getElementById('pdSizeNote');

    els.reviewSummary = document.getElementById('pdReviewSummary');
    els.reviewTags  = document.getElementById('pdReviewTags');
    els.reviewList  = document.getElementById('pdReviewList');

    els.recoGrid    = document.getElementById('pdRecoGrid');

    els.csBtn       = document.getElementById('pdCsBtn');
    els.favBtn      = document.getElementById('pdFavBtn');
    els.favLabel    = document.getElementById('pdFavLabel');
    els.addCartBtn  = document.getElementById('pdAddCartBtn');
    els.buyBtn      = document.getElementById('pdBuyBtn');

    els.pdStatusTime = document.getElementById('pdStatusTime');
    els.pdBatPct     = document.getElementById('pdBatPct');
    els.pdBatInner   = document.getElementById('pdBatInner');

    // 结算弹层
    els.chkMask     = document.getElementById('chkMask');
    els.chkSheet    = document.getElementById('chkSheet');
    els.chkCloseBtn = document.getElementById('chkCloseBtn');
    els.chkTitle    = document.getElementById('chkTitle');
    els.chkProductImg  = document.getElementById('chkProductImg');
    els.chkProductName = document.getElementById('chkProductName');
    els.chkProductSpec = document.getElementById('chkProductSpec');
    els.chkProductPrice= document.getElementById('chkProductPrice');
    els.chkModeRow  = document.getElementById('chkModeRow');
    els.chkGiftSection = document.getElementById('chkGiftSection');
    els.chkGiftList = document.getElementById('chkGiftList');
    els.chkGiftNote = document.getElementById('chkGiftNote');
    els.chkPayerRow = document.getElementById('chkPayerRow');
    els.chkPayerOtherBtn = document.getElementById('chkPayerOtherBtn');
    els.chkPayerHint= document.getElementById('chkPayerHint');
    els.chkQtyMinus = document.getElementById('chkQtyMinus');
    els.chkQtyPlus  = document.getElementById('chkQtyPlus');
    els.chkQtyNum   = document.getElementById('chkQtyNum');
    els.chkTotalNum = document.getElementById('chkTotalNum');
    els.chkSubmitBtn= document.getElementById('chkSubmitBtn');
    els.chkResult   = document.getElementById('chkResult');
    els.chkResultIcon = document.getElementById('chkResultIcon');
    els.chkResultTitle = document.getElementById('chkResultTitle');
    els.chkResultDesc  = document.getElementById('chkResultDesc');
    els.chkResultBtn   = document.getElementById('chkResultBtn');
  }

  /* ---------------- 状态栏同步（详情页浮层自带一份，跟随主状态栏数值） ---------------- */
  function syncStatusBar(){
    var mainTime = document.getElementById('statusTime');
    var mainPct  = document.getElementById('batPct');
    var mainInner= document.getElementById('batInner');
    if (els.pdStatusTime && mainTime) els.pdStatusTime.textContent = mainTime.textContent;
    if (els.pdBatPct && mainPct) els.pdBatPct.textContent = mainPct.textContent;
    if (els.pdBatInner && mainInner){
      els.pdBatInner.style.width = mainInner.style.width;
      els.pdBatInner.style.background = mainInner.style.background;
    }
  }
  var statusSyncTimer = null;

  /* ---------------- 打开 / 关闭 ---------------- */

  function openDetail(product){
    if (!product) return;
    currentProduct = product;
    currentDetail = null;
    selectedSize = null;
    selectedColor = null;
    isFav = false;
    galleryIndex = 0;
    currentGalleryUrls = [];

    els.mask.classList.add('show');
    document.body && (document.documentElement.style.overflow = 'hidden');
    syncStatusBar();
    statusSyncTimer = setInterval(syncStatusBar, 1000);

    renderSkeletonState(product);
    els.scroll.scrollTop = 0;

    var badge = document.getElementById('cartBadge');
    if (els.floatBadge && badge) els.floatBadge.textContent = badge.textContent;

    runDetailGeneration(product);
  }

  function closeDetail(){
    els.mask.classList.remove('show');
    document.documentElement.style.overflow = '';
    clearInterval(statusSyncTimer);
  }

  /* ---------------- 骨架态：先渲染已知字段，AI 内容异步补齐 ---------------- */

  function renderSkeletonState(product){
    els.price.textContent = product.price;
    els.priceOrig.textContent = product.originalPrice ? ('¥' + product.originalPrice) : '';
    els.priceBadges.innerHTML = product.tag ? ('<span>' + LS.escapeHtml(product.tag) + '</span>') : '';
    els.title.textContent = product.name;
    els.subtitle.textContent = '';
    els.rate.textContent = product.rate || '98%';
    els.sales.textContent = product.sales || '';
    els.reviewCount.textContent = '评价 · 生成中';

    els.sizeBlock.style.display = 'none';
    els.colorBlock.style.display = 'none';
    els.sizeTableBlock.style.display = 'none';

    els.descText.innerHTML =
      '<div class="pd-skel-line"></div><div class="pd-skel-line"></div><div class="pd-skel-line short"></div>';
    els.specGrid.innerHTML = '';
    els.detailImgs.innerHTML = '';

    els.reviewSummary.textContent = '';
    els.reviewTags.innerHTML = '';
    els.reviewList.innerHTML =
      '<div class="pd-skel-line"></div><div class="pd-skel-line"></div>';

    els.recoGrid.innerHTML = '';

    els.favLabel.textContent = '收藏';
    els.favBtn.classList.remove('is-fav');

    // 画廊骨架：先放 1 张灰色占位，待图片解析完成后整体替换
    els.galleryTag.textContent = product.tag || '';
    els.galleryTrack.innerHTML = '<div class="pd-gallery-slide is-skel"></div>';
    els.galleryDots.innerHTML = '';
  }

  /* ---------------- 派生多角度检索/生图关键词，避免相册图片重复 ---------------- */

  function buildGalleryQueries(product){
    var base = product.searchKeyword || product.name;
    var basePrompt = product.imagePrompt || ('studio product photo of ' + base);
    return [
      { searchQuery: base, imagePrompt: basePrompt + ', front view, centered composition' },
      { searchQuery: base + ' detail', imagePrompt: basePrompt + ', close-up detail shot, texture focus' },
      { searchQuery: base + ' material texture', imagePrompt: basePrompt + ', macro material texture shot' },
      { searchQuery: base + ' lifestyle', imagePrompt: basePrompt + ', in-use lifestyle scene, soft natural light' },
      { searchQuery: base + ' side angle', imagePrompt: basePrompt + ', side angle view, minimal gray backdrop' }
    ];
  }

  function resolveGalleryImage(q){
    // 复用商城主流程同一套「生图 → 搜索 → 占位」兜底链，
    // 保证详情页图片与商城卡片图片来源优先级完全一致。
    return LS.resolveOneImage({ imagePrompt: q.imagePrompt, searchKeyword: q.searchQuery, id: 'gallery_' + q.searchQuery })
      .catch(function(){ return LS.localPlaceholderImage({ name: q.searchQuery }); });
  }

  function resolveGalleryImagesWithCache(product, cachedUrls){
    // 命中缓存：直接复用已经生成/搜索过的相册图 URL，不再触发任何生图或搜图请求。
    if (cachedUrls && cachedUrls.length){
      return Promise.resolve(cachedUrls);
    }
    var galleryQueries = buildGalleryQueries(product);
    return Promise.all(galleryQueries.map(resolveGalleryImage));
  }

  function renderGallery(urls){
    currentGalleryUrls = urls;
    els.galleryTrack.innerHTML = urls.map(function(u){
      return '<div class="pd-gallery-slide"><img src="' + u + '" loading="lazy" alt=""/></div>';
    }).join('');
    els.galleryDots.innerHTML = urls.map(function(_, i){
      return '<span' + (i === 0 ? ' class="is-active"' : '') + '></span>';
    }).join('');
    els.galleryTrack.scrollLeft = 0;
    galleryIndex = 0;
  }

  function bindGalleryScroll(){
    els.galleryTrack.addEventListener('scroll', function(){
      var w = els.galleryTrack.clientWidth || 1;
      var idx = Math.round(els.galleryTrack.scrollLeft / w);
      if (idx === galleryIndex) return;
      galleryIndex = idx;
      var dots = els.galleryDots.querySelectorAll('span');
      dots.forEach(function(d, i){ d.classList.toggle('is-active', i === idx); });
    });
  }

  /* ---------------- AI 详情扩写：文本模型 Prompt ---------------- */

  function buildDetailPrompt(product){
    return '你是一个极简韩系风格电商平台的商品详情编辑。以下是一件商品的基础信息：\n' +
      '名称：' + product.name + '\n标签：' + (product.tag || '') + '\n价格：¥' + product.price + '\n' +
      '请围绕它扩写一份完整的商品详情数据，只输出一个 JSON 对象，不要任何解释文字、不要 Markdown 代码块包裹，字段如下：\n' +
      '{\n' +
      '  "subtitle": "15字以内的一句话卖点副标题",\n' +
      '  "isApparel": true或false，判断该商品是否为服装/鞋帽/箱包等需要尺码的品类,\n' +
      '  "descParagraphs": ["详情长文案，分3到4段，每段2到3句话，语气高级、克制、有质感，不使用夸张感叹号或emoji"],\n' +
      '  "specs": [{"k":"规格名，如材质/工艺/产地/适用场景","v":"对应值"}]，共4到6条,\n' +
      '  "colors": ["2到4个款式/颜色名称，中文，如 雾灰 / 燕麦白 / 墨黑，若商品无款式区分则返回空数组"],\n' +
      '  "sizeGuideNote": "若 isApparel 为 true，给一句18字以内的选码建议；否则为空字符串",\n' +
      '  "sizeTable": {"columns":["尺码","肩宽","衣长","胸围"],"rows":[["S","..","..",".."],["M","..","..",".."],["L","..","..",".."]]}，若 isApparel 为 false 则为 null，单位统一用 cm 数值字符串,\n' +
      '  "reviewTags": ["3到5个简短评价关键词，如 质感好 / 版型正 / 发货快"],\n' +
      '  "reviews": [{"name":"中文昵称（打码风格，如 用户a**2）","stars":1到5的整数,"date":"月/日 格式","text":"20到50字真实感评价文字，可略带口语化","spec":"该用户购买的规格，如 M码 / 雾灰 色"}]，共4到5条,\n' +
      '  "recoKeyword": "1个2到4字的中文关键词，用于生成与本商品同品类的推荐商品列表"\n' +
      '}\n只返回 JSON 对象本身。';
  }

  function planDetailLocally(product){
    // 未配置文本模型时的本地兜底：不发起网络请求，用规则拼出一份合理详情，
    // 保证详情页在零配置下也完整可用。
    var isApparel = /衫|裤|裙|外套|夹克|鞋|靴|包|帽|袜|内衣|连衣裙|卫衣|风衣/.test(product.name);
    return {
      subtitle: '精工细作 · 质感呈现日常之美',
      isApparel: isApparel,
      descParagraphs: [
        product.name + '，采用严选材料制作，注重细节与手感，力求在简约中呈现质感。',
        '设计上遵循克制美学，弱化多余装饰，让工艺与材质本身成为焦点，适合日常多种场景搭配使用。',
        '每一件出厂前均经过品控检验，确保到手品质与描述一致，售后无忧。'
      ],
      specs: [
        { k: '材质', v: '优选材料' },
        { k: '工艺', v: '精细制作' },
        { k: '产地', v: '国内生产' },
        { k: '适用场景', v: '日常 / 通勤' }
      ],
      colors: isApparel ? ['雾灰', '燕麦白', '墨黑'] : [],
      sizeGuideNote: isApparel ? '建议按日常穿着习惯选择常规码' : '',
      sizeTable: isApparel ? {
        columns: ['尺码', '肩宽', '衣长', '胸围'],
        rows: [['S', '42', '65', '92'], ['M', '44', '67', '96'], ['L', '46', '69', '100']]
      } : null,
      reviewTags: ['质感好', '发货快', '性价比高'],
      reviews: [
        { name: '用户a**2', stars: 5, date: '07/12', text: '实物比图片还要好看，质感很不错，物流也快。', spec: '默认规格' },
        { name: '用户j**8', stars: 4, date: '06/30', text: '整体满意，细节处理到位，值这个价。', spec: '默认规格' },
        { name: '用户w**5', stars: 5, date: '06/21', text: '朋友推荐来的，用了一段时间感觉不错，会回购。', spec: '默认规格' },
        { name: '用户l**1', stars: 4, date: '06/15', text: '包装很用心，客服回复也及时，五星好评。', spec: '默认规格' }
      ],
      recoKeyword: product.name.slice(0, 4)
    };
  }

  function planDetail(product){
    var cached = getDetailCacheEntry(product.id);
    if (cached && cached.data && cached.data.detail){
      return Promise.resolve(cached.data.detail);
    }

    var cfg = LS.getTextConfig();
    if (!cfg) return Promise.resolve(planDetailLocally(product));

    return fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: cfg.model,
        messages: [{ role: 'user', content: buildDetailPrompt(product) }],
        max_tokens: 1800,
        temperature: 0.85
      })
    }).then(function(resp){
      if (!resp.ok) throw new Error('详情生成请求失败 HTTP ' + resp.status);
      return resp.json();
    }).then(function(data){
      var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
      var cleaned = (content || '').trim().replace(/^```json/i, '').replace(/^```/, '').replace(/```$/, '').trim();
      var start = cleaned.indexOf('{');
      var end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('未能解析详情数据');
      var obj;
      try { obj = JSON.parse(cleaned.slice(start, end + 1)); } catch(e){ throw new Error('详情数据解析失败'); }
      return normalizeDetail(obj, product);
    }).catch(function(err){
      console.error('详情生成失败，使用本地兜底：', err);
      return planDetailLocally(product);
    });
  }

  function normalizeDetail(obj, product){
    var fallback = planDetailLocally(product);
    return {
      subtitle: String(obj.subtitle || fallback.subtitle).slice(0, 30),
      isApparel: !!obj.isApparel,
      descParagraphs: Array.isArray(obj.descParagraphs) && obj.descParagraphs.length ? obj.descParagraphs.slice(0, 5) : fallback.descParagraphs,
      specs: Array.isArray(obj.specs) && obj.specs.length ? obj.specs.slice(0, 6) : fallback.specs,
      colors: Array.isArray(obj.colors) ? obj.colors.slice(0, 5) : [],
      sizeGuideNote: String(obj.sizeGuideNote || ''),
      sizeTable: (obj.isApparel && obj.sizeTable && Array.isArray(obj.sizeTable.rows)) ? obj.sizeTable : (obj.isApparel ? fallback.sizeTable : null),
      reviewTags: Array.isArray(obj.reviewTags) && obj.reviewTags.length ? obj.reviewTags.slice(0, 6) : fallback.reviewTags,
      reviews: Array.isArray(obj.reviews) && obj.reviews.length ? obj.reviews.slice(0, 6) : fallback.reviews,
      recoKeyword: String(obj.recoKeyword || fallback.recoKeyword).slice(0, 8)
    };
  }

  /* ---------------- 渲染 AI 详情结果 ---------------- */

  function renderDetail(detail, product){
    currentDetail = detail;
    els.subtitle.textContent = detail.subtitle;

    var reviewN = 60 + (LS.seededRandom(product.id)() * 400 | 0);
    els.reviewCount.textContent = '评价 ' + reviewN;

    // 尺码
    if (detail.isApparel && detail.sizeTable && detail.sizeTable.rows.length){
      els.sizeBlock.style.display = '';
      var sizes = detail.sizeTable.rows.map(function(r){ return r[0]; });
      els.sizeRow.innerHTML = sizes.map(function(s, i){
        return '<button class="pd-size-chip" data-size="' + LS.escapeHtml(s) + '">' + LS.escapeHtml(s) + '</button>';
      }).join('');
      els.sizeHint.textContent = detail.sizeGuideNote || '';
      bindSizeChips();

      els.sizeTableBlock.style.display = '';
      var cols = detail.sizeTable.columns || ['尺码'];
      var thead = '<thead><tr>' + cols.map(function(c){ return '<th>' + LS.escapeHtml(c) + '</th>'; }).join('') + '</tr></thead>';
      var tbody = '<tbody>' + detail.sizeTable.rows.map(function(r){
        return '<tr>' + r.map(function(cell){ return '<td>' + LS.escapeHtml(String(cell)) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody>';
      els.sizeTable.innerHTML = thead + tbody;
      els.sizeNote.textContent = '单位：cm · 均为平铺测量，允许1-2cm误差';
    } else {
      els.sizeBlock.style.display = 'none';
      els.sizeTableBlock.style.display = 'none';
    }

    // 颜色/款式
    if (detail.colors && detail.colors.length){
      els.colorBlock.style.display = '';
      var swatches = ['#2a2a2e', '#c9c9cd', '#8f8f94', '#efeeec', '#5c5c60'];
      els.colorRow.innerHTML = detail.colors.map(function(c, i){
        return '<button class="pd-color-chip" data-color="' + LS.escapeHtml(c) + '">' +
          '<span class="pd-color-swatch" style="background:' + swatches[i % swatches.length] + ';"></span>' +
          '<span class="pd-color-name">' + LS.escapeHtml(c) + '</span>' +
        '</button>';
      }).join('');
      bindColorChips();
    } else {
      els.colorBlock.style.display = 'none';
    }

    // 详情文案
    els.descText.innerHTML = detail.descParagraphs.map(function(p){
      return '<p>' + LS.escapeHtml(p) + '</p>';
    }).join('');

    // 规格网格
    els.specGrid.innerHTML = detail.specs.map(function(s){
      return '<div class="pd-spec-item"><div class="pd-spec-k">' + LS.escapeHtml(s.k) + '</div><div class="pd-spec-v">' + LS.escapeHtml(s.v) + '</div></div>';
    }).join('');

    // 详情大图：服装类展示 2 张细节图，复用相册后两张
    if (detail.isApparel && currentGalleryUrls.length >= 4){
      els.detailImgs.innerHTML =
        '<img src="' + currentGalleryUrls[2] + '" loading="lazy" alt=""/>' +
        '<img src="' + currentGalleryUrls[3] + '" loading="lazy" alt=""/>';
    } else {
      els.detailImgs.innerHTML = '';
    }

    // 评价
    var rate = product.rate || '98%';
    els.reviewSummary.textContent = rate + ' 好评 · ' + detail.reviews.length + '+ 条精选';
    els.reviewTags.innerHTML = detail.reviewTags.map(function(t){
      return '<span class="pd-review-tag">' + LS.escapeHtml(t) + '</span>';
    }).join('');
    els.reviewList.innerHTML = detail.reviews.map(function(r){
      var initial = (r.name || '?').replace(/[^\u4e00-\u9fa5a-zA-Z]/g, '').charAt(0) || '匿';
      var stars = '';
      for (var i = 0; i < 5; i++){
        stars += i < (r.stars || 5)
          ? '<svg viewBox="0 0 24 24" fill="#17171a"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8L2.2 9.5l6.9-.7L12 2.5Z"/></svg>'
          : '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8L2.2 9.5l6.9-.7L12 2.5Z" stroke="#d8d8dc" stroke-width="1.4"/></svg>';
      }
      return '<div class="pd-review-item">' +
        '<div class="pd-review-avatar">' + LS.escapeHtml(initial) + '</div>' +
        '<div class="pd-review-body">' +
          '<div class="pd-review-top"><span class="pd-review-name">' + LS.escapeHtml(r.name) + '</span><span class="pd-review-date">' + LS.escapeHtml(r.date || '') + '</span></div>' +
          '<div class="pd-review-stars">' + stars + '</div>' +
          '<div class="pd-review-text">' + LS.escapeHtml(r.text) + '</div>' +
          '<div class="pd-review-spec">' + LS.escapeHtml(r.spec || '') + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    // 推荐商品：复用商城选品链路，生成同品类关联商品；
    // 若该商品详情已有缓存，一并复用其推荐商品列表与图片，不再重新生成。
    var cacheEntry = getDetailCacheEntry(product.id);
    var cachedReco = cacheEntry && cacheEntry.data;
    renderRecommendations(detail.recoKeyword, cachedReco && cachedReco.recoItems, cachedReco && cachedReco.recoImages);
  }

  function bindSizeChips(){
    Array.prototype.slice.call(els.sizeRow.querySelectorAll('.pd-size-chip')).forEach(function(chip){
      chip.addEventListener('click', function(){
        els.sizeRow.querySelectorAll('.pd-size-chip').forEach(function(c){ c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        selectedSize = chip.dataset.size;
      });
    });
  }
  function bindColorChips(){
    Array.prototype.slice.call(els.colorRow.querySelectorAll('.pd-color-chip')).forEach(function(chip){
      chip.addEventListener('click', function(){
        els.colorRow.querySelectorAll('.pd-color-chip').forEach(function(c){ c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        selectedColor = chip.dataset.color;
      });
    });
  }

  /* ---------------- 推荐商品：复用选品文本 Prompt 思路，生成 4 件关联商品 ---------------- */

  function renderRecommendations(keyword, cachedItems, cachedImages){
    var placeholderCount = 4;
    var skelHtml = '';
    for (var i = 0; i < placeholderCount; i++){
      skelHtml += '<div class="pd-reco-card"><div class="pd-reco-media" style="background:linear-gradient(100deg,#ececee 30%,#f6f6f7 50%,#ececee 70%);background-size:200% 100%;animation:mallShimmer 1.5s ease-in-out infinite;"></div><div class="pd-reco-info"><div class="pd-skel-line" style="margin:0 0 6px;"></div></div></div>';
    }
    els.recoGrid.innerHTML = skelHtml;

    // 命中缓存：推荐商品列表直接复用，不再调用文本模型
    if (cachedItems && cachedItems.length){
      renderRecommendationCards(cachedItems, cachedImages || {});
      return;
    }

    var cfg = LS.getTextConfig();
    var recoPromise;
    if (cfg){
      var prompt = '你是韩系风格电商选品编辑。请围绕关键词"' + keyword + '"构思4件相关联的具体商品（不要与原商品完全相同）。' +
        '只输出JSON数组，每项字段：{"name":"商品中文名,10字以内","price":整数人民币价格,"searchKeyword":"2到4个英文单词用于图片搜索","imagePrompt":"英文视觉描述，极简摄影棚背景"}。只返回JSON数组本身。';
      recoPromise = fetch(cfg.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + cfg.apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }], max_tokens: 600, temperature: 0.9 })
      }).then(function(resp){
        if (!resp.ok) throw new Error('推荐生成失败');
        return resp.json();
      }).then(function(data){
        var content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        var list = LS.extractJsonArray(content);
        if (!list || !list.length) throw new Error('推荐解析失败');
        return list.slice(0, 4).map(function(item, idx){
          return {
            id: 'reco' + Date.now() + '_' + idx,
            name: String(item.name || keyword).slice(0, 24),
            price: Math.max(1, Math.round(Number(item.price) || 99)),
            searchKeyword: String(item.searchKeyword || keyword),
            imagePrompt: String(item.imagePrompt || keyword)
          };
        });
      }).catch(function(){ return planRecoLocally(keyword); });
    } else {
      recoPromise = Promise.resolve(planRecoLocally(keyword));
    }

    var batchId = ++detailBatch;
    recoPromise.then(function(items){
      if (batchId !== detailBatch) return;
      renderRecommendationCards(items, {});

      // 新生成的推荐商品图片逐一取图（采用与商城主流程同一套兜底链），
      // 每张图取到后连同商品列表一起写回详情缓存，供下次打开秒开复用。
      var images = {};
      var pending = items.length;
      items.forEach(function(p){
        LS.resolveOneImage(p).then(function(src){
          if (batchId !== detailBatch) return;
          images[p.id] = src;
          var card = els.recoGrid.querySelector('.pd-reco-card[data-id="' + p.id + '"] img');
          if (card) card.src = src;
        }).catch(function(){}).then(function(){
          pending--;
          if (pending === 0 && currentProduct){
            mergeDetailCache(currentProduct.id, { recoItems: items, recoImages: images });
          }
        });
      });
    }).catch(function(){});
  }

  function renderRecommendationCards(items, images){
    els.recoGrid.innerHTML = items.map(function(p){
      var src = images && images[p.id];
      return '<div class="pd-reco-card" data-id="' + p.id + '">' +
        '<div class="pd-reco-media"><img' + (src ? (' src="' + src + '"') : ' data-src-pending="1"') + ' alt=""/></div>' +
        '<div class="pd-reco-info">' +
          '<div class="pd-reco-name">' + LS.escapeHtml(p.name) + '</div>' +
          '<div class="pd-reco-price">' + p.price + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    var recoById = {};
    items.forEach(function(p){ recoById[p.id] = p; });

    // 点击推荐商品：无缝下钻到该商品的详情页（自身也走同一套缓存优先逻辑）
    Array.prototype.slice.call(els.recoGrid.querySelectorAll('.pd-reco-card')).forEach(function(card){
      card.addEventListener('click', function(){
        var p = recoById[card.dataset.id];
        if (!p) return;
        var enriched = LS.getProductById(p.id) || p;
        enriched.rate = enriched.rate || ((95 + Math.floor(LS.seededRandom(p.id)() * 5)) + '%');
        enriched.sales = enriched.sales || '新品上架';
        openDetail(enriched);
      });
    });
  }

  // 合并写入详情缓存：详情扩写 / 相册图 / 推荐商品三部分可能异步到达，
  // 用合并而非整体覆盖，避免后到的分片把先到的分片冲掉。
  function mergeDetailCache(productId, patch){
    var existing = getDetailCacheEntry(productId);
    var data = (existing && existing.data) || {};
    for (var k in patch) data[k] = patch[k];
    setDetailCacheEntry(productId, data);
  }

  function planRecoLocally(keyword){
    var qualifiers = ['新配色款', '升级款', '联名款', '基础款'];
    var items = [];
    for (var i = 0; i < 4; i++){
      items.push({
        id: 'reco' + Date.now() + '_' + i,
        name: (keyword + ' · ' + qualifiers[i % qualifiers.length]).slice(0, 24),
        price: 89 + i * 40,
        searchKeyword: keyword,
        imagePrompt: 'minimalist studio product photo of ' + keyword + ', clean gray background'
      });
    }
    return items;
  }

  /* ---------------- 主流程：打开详情页后并发跑「详情扩写」+「相册取图」 ---------------- */

  function runDetailGeneration(product){
    var batchId = ++detailBatch;
    var cacheEntry = getDetailCacheEntry(product.id);
    var cached = (cacheEntry && cacheEntry.data) || null;

    // 详情文案：命中缓存则直接复用（不再调用文本模型），
    // 未命中则调用一次，结果写回缓存供下次复用。
    var isDetailFromCache = !!(cached && cached.detail);
    var detailTask = planDetail(product).then(function(detail){
      if (batchId !== detailBatch) return;
      renderDetail(detail, product);
      if (!isDetailFromCache){
        mergeDetailCache(product.id, { detail: detail });
      }
    }).catch(function(err){
      if (batchId !== detailBatch) return;
      console.error('商品详情渲染出错', err);
    });

    // 相册图：命中缓存则直接复用已有 URL（不再重新生图/搜图），
    // 未命中则走原有兜底链生成后写回缓存。
    var isGalleryFromCache = !!(cached && cached.galleryUrls && cached.galleryUrls.length);
    var galleryTask = resolveGalleryImagesWithCache(product, cached && cached.galleryUrls).then(function(urls){
      if (batchId !== detailBatch) return;
      renderGallery(urls);
      if (!isGalleryFromCache){
        mergeDetailCache(product.id, { galleryUrls: urls });
      }
      // 若详情已先渲染完成（isApparel 详情大图依赖相册），此时相册可能后到，
      // 重新触发一次详情大图渲染，保证顺序不影响最终展示。
      if (currentDetail) renderDetail(currentDetail, product);
    }).catch(function(){
      if (batchId !== detailBatch) return;
      renderGallery([LS.localPlaceholderImage(product)]);
    });

    Promise.all([detailTask, galleryTask]).catch(function(){});
  }

  /* ---------------- 收藏 / 客服（轻量占位反馈，保持交互完整闭环） ---------------- */

  function toggleFav(){
    isFav = !isFav;
    els.favBtn.classList.toggle('is-fav', isFav);
    els.favLabel.textContent = isFav ? '已收藏' : '收藏';
    if (navigator.vibrate){ try { navigator.vibrate(6); } catch(e){} }
  }

  /* ============================================================
     结算弹层：加入购物车 / 立即购买 → 赠送对象 / 付款方 → 提交
  ============================================================ */

  function loadCharactersForGift(){
    return new Promise(function(resolve){
      var req = indexedDB.open('LunaCharDB');
      req.onsuccess = function(e){
        var db = e.target.result;
        if (!db.objectStoreNames.contains('characters')){ resolve([]); return; }
        var r = db.transaction('characters').objectStore('characters').getAll();
        r.onsuccess = function(){ resolve(r.result || []); };
        r.onerror = function(){ resolve([]); };
      };
      req.onerror = function(){ resolve([]); };
    });
  }

  function openCheckout(mode){
    isCartSettlement = false;
    CHECKOUT_MODE = 'self';
    CHECKOUT_PAYER = 'me';
    checkoutQty = 1;
    selectedGiftCharId = null;

    els.chkTitle.textContent = mode === 'buy' ? '确认订单' : '加入购物车';
    els.chkSubmitBtn.textContent = mode === 'buy' ? '确认支付' : '确认加入';
    els.chkSubmitBtn.dataset.mode = mode;

    var img = currentGalleryUrls[0] || LS.localPlaceholderImage(currentProduct);
    els.chkProductImg.innerHTML = '<img src="' + img + '" alt=""/>';
    els.chkProductName.textContent = currentProduct.name;
    var specParts = [];
    if (selectedSize) specParts.push(selectedSize + ' 码');
    if (selectedColor) specParts.push(selectedColor);
    els.chkProductSpec.textContent = specParts.length ? specParts.join(' · ') : '默认规格';
    els.chkProductPrice.textContent = currentProduct.price;

    els.chkModeRow.querySelectorAll('.chk-mode-btn').forEach(function(b){ b.classList.toggle('is-active', b.dataset.mode === 'self'); });
    els.chkGiftSection.style.display = 'none';
    els.chkGiftNote.value = '';
    els.chkModeRow.closest('.chk-section').style.display = '';

    els.chkPayerRow.querySelectorAll('.chk-payer-btn').forEach(function(b){ b.classList.toggle('is-active', b.dataset.payer === 'me'); });
    els.chkPayerOtherBtn.disabled = true;
    els.chkPayerHint.textContent = '从钱包余额中扣除，将生成一笔支出记录';

    els.chkQtyMinus.closest('.chk-qty-row').style.display = '';
    els.chkQtyNum.textContent = checkoutQty;
    updateCheckoutTotal();

    els.chkResult.classList.remove('show');
    els.chkMask.classList.add('show');

    loadCharactersForGift().then(function(list){
      giftCharacters = list;
      renderGiftList();
    });
  }

  // 购物车「结算」入口：合并多件已勾选商品为一笔订单，走与单品购买相同的
  // 钱包扣款链路。不涉及尺码/赠送角色等单品专属流程，弹层简化为纯汇总展示。
  // 返回一个 Promise：resolve(true) 表示支付成功（调用方据此清空已结算的购物车行）。
  function openCartSettlement(items, total){
    return new Promise(function(resolve){
      isCartSettlement = true;
      cartSettlementItems = items;
      cartSettlementTotal = total;
      cartSettlementResolve = resolve;
      CHECKOUT_MODE = 'self';
      CHECKOUT_PAYER = 'me';
      selectedGiftCharId = null;

      var firstImg = items[0].image || LS.localPlaceholderImage({ name: items[0].name });
      els.chkTitle.textContent = '确认订单';
      els.chkSubmitBtn.textContent = '确认支付';
      els.chkSubmitBtn.dataset.mode = 'buy';

      els.chkProductImg.innerHTML = '<img src="' + firstImg + '" alt=""/>';
      els.chkProductName.textContent = items.length > 1
        ? (items[0].name + ' 等 ' + items.length + ' 件商品')
        : items[0].name;
      var totalQty = items.reduce(function(s, it){ return s + it.qty; }, 0);
      els.chkProductSpec.textContent = '共 ' + totalQty + ' 件';
      els.chkProductPrice.textContent = total;

      // 多商品合并结算：隐藏「赠送角色」与单品数量步进器，避免语义混乱
      els.chkModeRow.closest('.chk-section').style.display = 'none';
      els.chkGiftSection.style.display = 'none';
      els.chkQtyMinus.closest('.chk-qty-row').style.display = 'none';

      els.chkPayerRow.querySelectorAll('.chk-payer-btn').forEach(function(b){ b.classList.toggle('is-active', b.dataset.payer === 'me'); });
      els.chkPayerOtherBtn.disabled = true;
      els.chkPayerHint.textContent = '从钱包余额中扣除，将生成一笔支出记录';

      els.chkTotalNum.textContent = total;

      els.chkResult.classList.remove('show');
      els.chkMask.classList.add('show');
    });
  }

  function closeCheckout(){
    els.chkMask.classList.remove('show');
    if (isCartSettlement && cartSettlementResolve){
      // 未支付成功即关闭：resolve(false)，购物车数据保持不变
      cartSettlementResolve(false);
      cartSettlementResolve = null;
      isCartSettlement = false;
    }
  }

  function renderGiftList(){
    if (!giftCharacters.length){
      els.chkGiftList.innerHTML = '<p class="chk-gift-empty">暂无角色，可前往「角色」创建后再赠送</p>';
      return;
    }
    els.chkGiftList.innerHTML = giftCharacters.map(function(c){
      var letter = (c.name || '?')[0] ? (c.name || '?')[0].toUpperCase() : '?';
      var avatarInner = c.avatarImg
        ? '<img src="' + c.avatarImg + '" alt=""/>'
        : LS.escapeHtml(letter);
      return '<div class="chk-gift-chip" data-id="' + c.id + '">' +
        '<div class="chk-gift-avatar"' + (c.avatarColor && !c.avatarImg ? ' style="background:' + c.avatarColor + ';"' : '') + '>' + avatarInner + '</div>' +
        '<div class="chk-gift-name">' + LS.escapeHtml(c.name || '') + '</div>' +
      '</div>';
    }).join('');

    Array.prototype.slice.call(els.chkGiftList.querySelectorAll('.chk-gift-chip')).forEach(function(chip){
      chip.addEventListener('click', function(){
        els.chkGiftList.querySelectorAll('.chk-gift-chip').forEach(function(c){ c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        selectedGiftCharId = chip.dataset.id;
        els.chkPayerOtherBtn.disabled = false;
      });
    });
  }

  function updateCheckoutTotal(){
    var total = currentProduct.price * checkoutQty;
    els.chkTotalNum.textContent = total;
  }

  function bindCheckoutEvents(){
    els.chkCloseBtn.addEventListener('click', closeCheckout);
    els.chkMask.addEventListener('click', function(e){ if (e.target === els.chkMask) closeCheckout(); });

    els.chkModeRow.addEventListener('click', function(e){
      var btn = e.target.closest ? e.target.closest('.chk-mode-btn') : null;
      if (!btn) return;
      CHECKOUT_MODE = btn.dataset.mode;
      els.chkModeRow.querySelectorAll('.chk-mode-btn').forEach(function(b){ b.classList.toggle('is-active', b === btn); });
      els.chkGiftSection.style.display = CHECKOUT_MODE === 'gift' ? '' : 'none';
      if (CHECKOUT_MODE === 'self'){
        selectedGiftCharId = null;
        els.chkPayerOtherBtn.disabled = true;
        if (CHECKOUT_PAYER === 'other'){
          CHECKOUT_PAYER = 'me';
          els.chkPayerRow.querySelectorAll('.chk-payer-btn').forEach(function(b){ b.classList.toggle('is-active', b.dataset.payer === 'me'); });
          els.chkPayerHint.textContent = '从钱包余额中扣除，将生成一笔支出记录';
        }
      }
    });

    els.chkPayerRow.addEventListener('click', function(e){
      var btn = e.target.closest ? e.target.closest('.chk-payer-btn') : null;
      if (!btn || btn.disabled) return;
      CHECKOUT_PAYER = btn.dataset.payer;
      els.chkPayerRow.querySelectorAll('.chk-payer-btn').forEach(function(b){ b.classList.toggle('is-active', b === btn); });
      els.chkPayerHint.textContent = CHECKOUT_PAYER === 'other'
        ? '由赠送对象代付，本人钱包不扣款，订单将标注"对方代付"'
        : '从钱包余额中扣除，将生成一笔支出记录';
    });

    els.chkQtyMinus.addEventListener('click', function(){
      if (checkoutQty <= 1) return;
      checkoutQty--; els.chkQtyNum.textContent = checkoutQty; updateCheckoutTotal();
    });
    els.chkQtyPlus.addEventListener('click', function(){
      if (checkoutQty >= 99) return;
      checkoutQty++; els.chkQtyNum.textContent = checkoutQty; updateCheckoutTotal();
    });

    els.chkSubmitBtn.addEventListener('click', submitCheckout);
    els.chkResultBtn.addEventListener('click', function(){
      closeCheckout();
    });
  }

  /* ---------------- 提交：加购 / 支付，本人支付时走钱包真实扣款链路 ---------------- */

  function openHomeDB(){
    return new Promise(function(res, rej){
      var req = indexedDB.open('LunaWalletHomeDB', 1);
      req.onupgradeneeded = function(e){ e.target.result.createObjectStore('home', { keyPath: 'id' }); };
      req.onsuccess = function(e){ res(e.target.result); };
      req.onerror = function(e){ rej(e.target.error); };
    });
  }
  function loadWalletAccount(){
    return new Promise(function(res){
      var req = indexedDB.open('LunaWalletAccountDB', 1);
      req.onupgradeneeded = function(e){ e.target.result.createObjectStore('accounts', { keyPath: 'id' }); };
      req.onsuccess = function(e){
        var db = e.target.result;
        var r = db.transaction('accounts').objectStore('accounts').get('main');
        r.onsuccess = function(){ res(r.result || null); };
        r.onerror = function(){ res(null); };
      };
      req.onerror = function(){ res(null); };
    });
  }
  function currentHomeIdentityKey(){
    return loadWalletAccount().then(function(account){
      var boundId = (account && account.boundIdentityId) || 'default';
      return 'identity_' + boundId;
    }).catch(function(){ return 'identity_default'; });
  }
  function loadHomeData(){
    return openHomeDB().then(function(db){
      return currentHomeIdentityKey().then(function(key){
        return new Promise(function(res){
          var r = db.transaction('home').objectStore('home').get(key);
          r.onsuccess = function(){
            res(r.result || { id: key, balance: 0, income: 0, spend: 0, transactions: [] });
          };
          r.onerror = function(){ res({ id: key, balance: 0, income: 0, spend: 0, transactions: [] }); };
        });
      });
    });
  }
  function saveHomeData(data){
    return openHomeDB().then(function(db){
      return currentHomeIdentityKey().then(function(key){
        return new Promise(function(res, rej){
          var tx = db.transaction('home', 'readwrite');
          var payload = {}; for (var k in data) payload[k] = data[k];
          payload.id = key;
          tx.objectStore('home').put(payload);
          tx.oncomplete = function(){ res(true); };
          tx.onerror = function(){ rej(false); };
        });
      });
    });
  }

  // 本人支付：走钱包真实余额扣减 + 交易记录，与钱包 App 内规则一致；
  // 余额不足则支付失败并提示，不允许"透支"式的虚假成功。
  function chargeFromWallet(amount, txName){
    return loadHomeData().then(function(home){
      var balance = Number(home.balance || 0);
      if (balance < amount){
        return { ok: false, reason: '余额不足，请先在钱包为账户充值' };
      }
      var now = new Date();
      var dateStr = String(now.getMonth() + 1).padStart(2, '0') + '/' + String(now.getDate()).padStart(2, '0') + ' · ' +
        String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      var txList = Array.isArray(home.transactions) ? home.transactions.slice() : [];
      txList.unshift({ dir: 'out', name: txName, date: dateStr, ts: now.getTime(), amount: amount });
      return saveHomeData({
        balance: balance - amount,
        income: home.income || 0,
        spend: (Number(home.spend) || 0) + amount,
        card: home.card,
        transactions: txList,
        spendOverview: home.spendOverview
      }).then(function(){ return { ok: true }; });
    });
  }

  // 购物车合并结算：不涉及尺码/赠送角色，只走「本人支付」与钱包扣款
  function submitCartSettlement(){
    els.chkSubmitBtn.disabled = true;
    var itemNames = cartSettlementItems.map(function(it){ return it.name; }).join('、');
    var txName = '购物车结算 · ' + (cartSettlementItems.length > 1 ? (cartSettlementItems.length + ' 件商品') : itemNames);
    chargeFromWallet(cartSettlementTotal, txName).then(function(result){
      els.chkSubmitBtn.disabled = false;
      if (result.ok){
        showResult(true, '支付成功', '已从钱包支付 ¥' + cartSettlementTotal + '，共 ' + cartSettlementItems.reduce(function(s, it){ return s + it.qty; }, 0) + ' 件商品');
        if (cartSettlementResolve){ cartSettlementResolve(true); cartSettlementResolve = null; }
      } else {
        showResult(false, '支付失败', result.reason || '请稍后重试');
      }
    }).catch(function(){
      els.chkSubmitBtn.disabled = false;
      showResult(false, '支付失败', '钱包数据读取出错，请稍后重试');
    });
  }

  function submitCheckout(){
    if (isCartSettlement){ submitCartSettlement(); return; }

    var mode = els.chkSubmitBtn.dataset.mode; // 'buy' | 'cart'
    var total = currentProduct.price * checkoutQty;
    var giftChar = selectedGiftCharId ? giftCharacters.filter(function(c){ return String(c.id) === String(selectedGiftCharId); })[0] : null;

    if (CHECKOUT_MODE === 'gift' && !giftChar){
      els.chkPayerHint.textContent = '请先选择一位赠送对象';
      els.chkPayerHint.style.color = '#8a2f2f';
      return;
    }

    // 加入购物车：不涉及扣款，直接写入购物车数据并反馈成功
    if (mode === 'cart'){
      if (LS.cartAddItem){
        var cartImg = currentGalleryUrls[0] || currentProduct.image || '';
        LS.cartAddItem(currentProduct, {
          size: selectedSize || '',
          color: selectedColor || '',
          qty: checkoutQty,
          image: cartImg
        });
      } else {
        LS.bumpCartBadge();
      }
      showResult(true, '已加入购物车', CHECKOUT_MODE === 'gift' && giftChar ? ('已为赠送 ' + giftChar.name + ' 预留该商品') : (currentProduct.name));
      if (els.floatBadge && LS.cartTotalCount) els.floatBadge.textContent = LS.cartTotalCount();
      return;
    }

    // 立即购买
    els.chkSubmitBtn.disabled = true;

    if (CHECKOUT_PAYER === 'other'){
      // 「对方（角色）代付」：虚拟角色无真实资金账户，此处如实呈现为
      // 本人钱包不扣款、订单标注代付关系，不伪造角色侧的扣款记录。
      var desc = giftChar ? ('由 ' + giftChar.name + ' 代付 · 赠送给 ' + giftChar.name) : '由对方代付';
      els.chkSubmitBtn.disabled = false;
      showResult(true, '支付成功', desc + ' · 共 ¥' + total);
      return;
    }

    var txName = (CHECKOUT_MODE === 'gift' && giftChar) ? ('赠送 ' + giftChar.name + ' · ' + currentProduct.name) : ('购买 · ' + currentProduct.name);
    chargeFromWallet(total, txName).then(function(result){
      els.chkSubmitBtn.disabled = false;
      if (result.ok){
        var okDesc = (CHECKOUT_MODE === 'gift' && giftChar)
          ? ('已从钱包支付 ¥' + total + '，将赠送给 ' + giftChar.name)
          : ('已从钱包支付 ¥' + total);
        showResult(true, '支付成功', okDesc);
      } else {
        showResult(false, '支付失败', result.reason || '请稍后重试');
      }
    }).catch(function(){
      els.chkSubmitBtn.disabled = false;
      showResult(false, '支付失败', '钱包数据读取出错，请稍后重试');
    });
  }

  function showResult(success, title, desc){
    els.chkResultIcon.className = 'chk-result-icon ' + (success ? 'is-success' : 'is-error');
    els.chkResultIcon.innerHTML = success
      ? '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12.5l5 5L20 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/><path d="M12 7.5v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16.3" r="1" fill="currentColor"/></svg>';
    els.chkResultTitle.textContent = title;
    els.chkResultDesc.textContent = desc || '';
    els.chkResult.classList.add('show');
    if (navigator.vibrate){ try { navigator.vibrate(success ? [8, 40, 8] : 14); } catch(e){} }
  }

  /* ---------------- 详情页顶层事件绑定 ---------------- */

  function bindEvents(){
    els.backBtn.addEventListener('click', closeDetail);
    els.cartBtn.addEventListener('click', closeDetail);
    els.shareBtn.addEventListener('click', function(){
      LS.showToast('已复制商品链接');
    });
    els.csBtn.addEventListener('click', function(){
      LS.showToast('客服功能建设中');
    });
    els.favBtn.addEventListener('click', toggleFav);

    els.addCartBtn.addEventListener('click', function(){ openCheckout('cart'); });
    els.buyBtn.addEventListener('click', function(){ openCheckout('buy'); });

    bindGalleryScroll();
    bindCheckoutEvents();

    // 触屏下拉一定距离关闭详情页（简化为点击返回按钮为主，滑动仅做轻量支持）
    var startY = null;
    els.sheet.addEventListener('touchstart', function(e){
      if (els.scroll.scrollTop > 4) { startY = null; return; }
      startY = e.touches[0].clientY;
    }, { passive: true });
    els.sheet.addEventListener('touchend', function(e){
      if (startY == null) return;
      var endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : startY;
      if (endY - startY > 90) closeDetail();
      startY = null;
    }, { passive: true });
  }

  function init(){
    cacheEls();
    if (!els.mask) return; // 非商城页，静默跳过

    LS = window.LunaShop;
    if (!LS){
      console.error('LunaShop 未初始化，商品详情页依赖 mallAI 模块先加载');
      return;
    }

    bindEvents();

    window.LunaShop.openDetail = openDetail;
    window.LunaShop.openCartSettlement = openCartSettlement;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
/* ==========================================================================
   私信 · 会话列表 + 聊天页面
   链路：
     1) Luna 系统助手为固定置顶条目，独立于普通联系人数组，首次进入即有一条
        欢迎语；后续会话记录落 localStorage('luna_msg_thread_' + convId)，
        刷新不丢失。
     2) 普通联系人为演示数据（少量商家 / 好友示例），用于验证列表布局；
        真实联系人接入时替换 DEMO_CONTACTS 数据源即可，渲染与交互逻辑不变。
     3) 聊天页「AI 回复」按钮当前为占位：点击后仅插入一条待接入提示气泡，
        预留 window.LunaShop.requestAiReply(convId, history) 挂载点供后续
        接入真实模型调用。
========================================================================== */
(function messagesModule(){

  var DEMO_CONTACTS = [
    { id: 'shop-atelier',  name: '素岛工坊·店主', preview: '您上次咨询的羊毛开衫已补货，欢迎选购～', time: '昨天', unread: 0 },
    { id: 'friend-yueyue', name: '悦悦',           preview: '这个马克杯也太好看了吧，链接发我一下', time: '周二', unread: 2 },
    { id: 'shop-logistics',name: '顺丰快递',        preview: '您的包裹已到达本地网点，预计今日送达', time: '周一', unread: 0 }
  ];

  var LUNA_ID = 'luna-system';
  var LUNA_WELCOME = '你好，我是 Luna，你的专属购物助手 —— 有任何选品、订单或搭配上的问题，随时找我。';

  var els = {};
  var LS = null;
  var activeConv = null;

  function cacheEls(){
    els.msgScroll        = document.getElementById('msgScroll');
    els.msgStatCount     = document.getElementById('msgStatCount');
    els.msgLunaRow        = document.getElementById('msgLunaRow');
    els.msgLunaPreview    = document.getElementById('msgLunaPreview');
    els.msgLunaTime       = document.getElementById('msgLunaTime');
    els.msgLunaUnread     = document.getElementById('msgLunaUnread');
    els.msgContactList    = document.getElementById('msgContactList');
    els.msgContactEmpty   = document.getElementById('msgContactEmpty');

    els.msgcMask   = document.getElementById('msgcMask');
    els.msgcSheet  = document.getElementById('msgcSheet');
    els.msgcStatusTime = document.getElementById('msgcStatusTime');
    els.msgcBatPct      = document.getElementById('msgcBatPct');
    els.msgcBatInner    = document.getElementById('msgcBatInner');
    els.msgcBackBtn= document.getElementById('msgcBackBtn');
    els.msgcHeadAvatar = document.getElementById('msgcHeadAvatar');
    els.msgcHeadName   = document.getElementById('msgcHeadName');
    els.msgcHeadStatus = document.getElementById('msgcHeadStatus');
    els.msgcScroll = document.getElementById('msgcScroll');
    els.msgcList   = document.getElementById('msgcList');
    els.msgcTyping = document.getElementById('msgcTyping');
    els.msgcTypingAvatar = document.getElementById('msgcTypingAvatar');
    els.msgcInput  = document.getElementById('msgcInput');
    els.msgcSendBtn= document.getElementById('msgcSendBtn');
    els.msgcAiReplyBtn = document.getElementById('msgcAiReplyBtn');
  }

  /* ---------------- 会话数据存取（localStorage） ---------------- */

  function threadKey(convId){ return 'luna_msg_thread_' + convId; }

  function loadThread(convId){
    try {
      var raw = localStorage.getItem(threadKey(convId));
      if (raw) return JSON.parse(raw);
    } catch(e){}
    return null;
  }

  function saveThread(convId, thread){
    try { localStorage.setItem(threadKey(convId), JSON.stringify(thread)); } catch(e){}
  }

  function ensureLunaThread(){
    var thread = loadThread(LUNA_ID);
    if (thread && thread.length) return thread;
    thread = [{ role: 'in', text: LUNA_WELCOME, time: nowLabel() }];
    saveThread(LUNA_ID, thread);
    return thread;
  }

  function getContactMeta(convId){
    if (convId === LUNA_ID){
      return { name: 'Luna', isSystem: true, status: '在线 · 即时回复' };
    }
    var c = DEMO_CONTACTS.filter(function(x){ return x.id === convId; })[0];
    return c ? { name: c.name, isSystem: false, status: '对方最近活跃' } : { name: '会话', isSystem: false, status: '' };
  }

  function nowLabel(){
    var d = new Date();
    var hh = ('0' + d.getHours()).slice(-2);
    var mm = ('0' + d.getMinutes()).slice(-2);
    return hh + ':' + mm;
  }

  /* ---------------- 渲染：会话列表 ---------------- */

  function esc(s){ return (LS && LS.escapeHtml) ? LS.escapeHtml(s) : String(s == null ? '' : s); }

  function renderList(){
    var lunaThread = ensureLunaThread();
    var lastLuna = lunaThread[lunaThread.length - 1];
    els.msgLunaPreview.textContent = lastLuna.text;
    els.msgLunaTime.textContent = lastLuna.time || '刚刚';

    var lunaUnread = 0;
    try { lunaUnread = parseInt(localStorage.getItem('luna_msg_unread_' + LUNA_ID) || '1', 10) || 0; } catch(e){ lunaUnread = 1; }
    if (lunaUnread > 0){
      els.msgLunaUnread.style.display = 'flex';
      els.msgLunaUnread.textContent = lunaUnread > 99 ? '99+' : String(lunaUnread);
    } else {
      els.msgLunaUnread.style.display = 'none';
    }

    var html = DEMO_CONTACTS.map(function(c){
      var initial = c.name.slice(0, 1);
      return (
        '<button class="msg-row" data-conv="' + c.id + '">' +
          '<span class="msg-avatar">' + esc(initial) + '</span>' +
          '<span class="msg-row-body">' +
            '<span class="msg-row-top">' +
              '<span class="msg-row-name">' + esc(c.name) + '</span>' +
              '<span class="msg-row-time">' + esc(c.time) + '</span>' +
            '</span>' +
            '<span class="msg-row-preview">' + esc(c.preview) + '</span>' +
          '</span>' +
          (c.unread > 0 ? '<span class="msg-row-unread">' + c.unread + '</span>' : '') +
        '</button>'
      );
    }).join('');
    els.msgContactList.innerHTML = html;
    els.msgContactEmpty.classList.toggle('is-hidden', DEMO_CONTACTS.length > 0);

    var totalConv = 1 + DEMO_CONTACTS.length;
    els.msgStatCount.textContent = totalConv;

    els.msgContactList.querySelectorAll('.msg-row[data-conv]').forEach(function(btn){
      btn.addEventListener('click', function(){ openChat(btn.dataset.conv); });
    });
  }

  /* ---------------- 状态栏同步（聊天页浮层自带一份，跟随主状态栏数值） ---------------- */
  function syncChatStatusBar(){
    var mainTime = document.getElementById('statusTime');
    var mainPct  = document.getElementById('batPct');
    var mainInner= document.getElementById('batInner');
    if (els.msgcStatusTime && mainTime) els.msgcStatusTime.textContent = mainTime.textContent;
    if (els.msgcBatPct && mainPct) els.msgcBatPct.textContent = mainPct.textContent;
    if (els.msgcBatInner && mainInner){
      els.msgcBatInner.style.width = mainInner.style.width;
      els.msgcBatInner.style.background = mainInner.style.background;
    }
  }
  var chatStatusSyncTimer = null;

  /* ---------------- 聊天页：打开 / 关闭 ---------------- */

  function avatarMarkup(meta){
    if (meta.isSystem){
      return '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.2c1.4 2.7 1.4 5.9 0 8.4-1.4-2.5-1.4-5.7 0-8.4Z" fill="currentColor"/><path d="M12 12.4c1.4 2.7 1.4 5.9 0 8.4-1.4-2.5-1.4-5.7 0-8.4Z" fill="currentColor"/></svg>';
    }
    return esc(meta.name.slice(0, 1));
  }

  function renderBubbles(thread){
    var meta = getContactMeta(activeConv);
    var html = thread.map(function(m){
      var isOut = m.role === 'out';
      var avatar = isOut ? '' : '<span class="msgc-bubble-avatar">' + avatarMarkup(meta) + '</span>';
      return (
        '<div class="msgc-bubble-row ' + (isOut ? 'is-out' : 'is-in') + '">' +
          avatar +
          '<div class="msgc-bubble">' + esc(m.text) + '<span class="msgc-bubble-time">' + esc(m.time || '') + '</span></div>' +
        '</div>'
      );
    }).join('');
    els.msgcList.innerHTML = html;
    els.msgcTypingAvatar.innerHTML = avatarMarkup(meta);
    els.msgcScroll.scrollTop = els.msgcScroll.scrollHeight;
  }

  function openChat(convId){
    activeConv = convId;
    var meta = getContactMeta(convId);

    els.msgcHeadName.textContent = meta.name;
    els.msgcHeadStatus.textContent = meta.status;
    els.msgcHeadAvatar.innerHTML = avatarMarkup(meta);
    els.msgcHeadAvatar.style.background = meta.isSystem
      ? 'radial-gradient(circle at 32% 26%, #2c2c30, #0a0a0c 88%)'
      : 'linear-gradient(160deg, #f2f2f4, #dcdce0 120%)';
    els.msgcHeadAvatar.style.color = meta.isSystem ? '#fff' : 'var(--c-ink-1)';

    var thread = loadThread(convId);
    if (!thread){
      thread = meta.isSystem ? ensureLunaThread() : [{ role: 'in', text: '你好呀～', time: nowLabel() }];
      saveThread(convId, thread);
    }
    renderBubbles(thread);

    if (convId === LUNA_ID){
      try { localStorage.setItem('luna_msg_unread_' + LUNA_ID, '0'); } catch(e){}
    }

    els.msgcMask.classList.add('show');
    syncChatStatusBar();
    if (chatStatusSyncTimer) clearInterval(chatStatusSyncTimer);
    chatStatusSyncTimer = setInterval(syncChatStatusBar, 1000);
    if (navigator.vibrate){ try { navigator.vibrate(6); } catch(e){} }
  }

  function closeChat(){
    els.msgcMask.classList.remove('show');
    if (chatStatusSyncTimer){ clearInterval(chatStatusSyncTimer); chatStatusSyncTimer = null; }
    activeConv = null;
    renderList();
  }

  /* ---------------- 发送消息 ---------------- */

  function appendMessage(role, text){
    if (!activeConv) return;
    var thread = loadThread(activeConv) || [];
    thread.push({ role: role, text: text, time: nowLabel() });
    saveThread(activeConv, thread);
    renderBubbles(thread);
    return thread;
  }

  function sendCurrentInput(){
    var text = (els.msgcInput.value || '').trim();
    if (!text || !activeConv) return;
    appendMessage('out', text);
    els.msgcInput.value = '';
    els.msgcInput.style.height = 'auto';
    els.msgcSendBtn.disabled = true;
    if (navigator.vibrate){ try { navigator.vibrate(8); } catch(e){} }
  }

  /* AI 回复占位：预留真实模型接入点。
     后续实现方式：将 window.LunaShop.requestAiReply 替换为真实调用
     （复用商城模块已有的 getTextConfig() 读取用户配置的文本模型），
     再把 typing 指示与 appendMessage('in', reply) 接到返回结果上即可，
     当前先做好占位 UI 与交互节奏。 */
  function handleAiReplyPlaceholder(){
    if (!activeConv) return;
    if (els.msgcAiReplyBtn.disabled) return;

    els.msgcAiReplyBtn.disabled = true;
    els.msgcTyping.style.display = 'flex';
    els.msgcScroll.scrollTop = els.msgcScroll.scrollHeight;

    if (window.LunaShop && typeof window.LunaShop.requestAiReply === 'function'){
      var thread = loadThread(activeConv) || [];
      window.LunaShop.requestAiReply(activeConv, thread).then(function(replyText){
        els.msgcTyping.style.display = 'none';
        appendMessage('in', replyText);
        els.msgcAiReplyBtn.disabled = false;
      }).catch(function(){
        els.msgcTyping.style.display = 'none';
        appendMessage('in', 'AI 回复功能暂时不可用，请稍后重试。');
        els.msgcAiReplyBtn.disabled = false;
      });
      return;
    }

    setTimeout(function(){
      els.msgcTyping.style.display = 'none';
      appendMessage('in', 'AI 回复功能即将上线，敬请期待。');
      els.msgcAiReplyBtn.disabled = false;
    }, 900);
  }

  /* ---------------- 事件绑定 ---------------- */

  function bindEvents(){
    els.msgLunaRow.addEventListener('click', function(){ openChat(LUNA_ID); });

    els.msgcBackBtn.addEventListener('click', closeChat);

    els.msgcSendBtn.addEventListener('click', sendCurrentInput);
    els.msgcInput.addEventListener('input', function(){
      els.msgcSendBtn.disabled = !els.msgcInput.value.trim();
      els.msgcInput.style.height = 'auto';
      els.msgcInput.style.height = Math.min(els.msgcInput.scrollHeight, 88) + 'px';
    });
    els.msgcInput.addEventListener('keydown', function(e){
      if (e.key === 'Enter' && !e.shiftKey){
        e.preventDefault();
        sendCurrentInput();
      }
    });

    els.msgcAiReplyBtn.addEventListener('click', handleAiReplyPlaceholder);

    // 触屏下拉关闭聊天页，与商品详情页手势保持一致
    var startY = null;
    els.msgcSheet.addEventListener('touchstart', function(e){
      if (els.msgcScroll.scrollTop > 4) { startY = null; return; }
      startY = e.touches[0].clientY;
    }, { passive: true });
    els.msgcSheet.addEventListener('touchend', function(e){
      if (startY == null) return;
      var endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : startY;
      if (endY - startY > 90) closeChat();
      startY = null;
    }, { passive: true });
  }

  function init(){
    cacheEls();
    if (!els.msgScroll || !els.msgcMask) return; // 私信板块未挂载，静默跳过

    LS = window.LunaShop || {};
    bindEvents();
    renderList();

    window.LunaShop = window.LunaShop || {};
    window.LunaShop.openChat = openChat;
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();