/* ================================
   Luna Moments Feed — moments-feed.js
   同步好友数据 · 动态流渲染 · 点赞 / 评论 / 收藏逻辑
================================ */

/* ---- 内存态：本次会话的动态数据 ---- */
let MOMENTS_FEED = [];          // [{id, author, avatarInitial, avatarImg, avatarBg, time, audience, text, images[], location, mood, liked, likeCount, likedBy[], comments[], saved}]
let _momentsFeedReady = false;
let _momentsCommentTargetId = null;

/* ================================
   初始化：DOM 就绪后调用一次
================================ */
function momentsFeedInit() {
  if (_momentsFeedReady) return;
  _momentsFeedReady = true;
  momentsLoadAndRender();
}

/* 从 IndexedDB 载入已保存动态。
   Feed 的内容只由两部分组成：
   1. 用户自己发布的帖子（isMine）
   2. 好友在剧情/聊天中真实"发生"过的动态（由其他功能显式调用 momentsPublishPost 或
      等价接口写入，例如好友互动系统生成的内容）
   绝不会在初始化时凭空为好友编造一条"种子帖子"——哪怕好友是真实存在的。
   如果 Feed 是空的，就应该原样显示空状态，这才是"初始化"该有的样子。 */
async function momentsLoadAndRender() {
  const saved = await momentsDbLoadAll();
  MOMENTS_FEED = saved.sort((a, b) => b.createdAt - a.createdAt);

  // 一次性清理：早期版本会自动生成 id 以 "seed_" 开头的假帖子并存入 IndexedDB，
  // 这些是历史遗留的伪造数据，不是用户真实产生的内容，这里连同其评论区里
  // 混入的假互动一起清除，且只做一次，清过之后不会再重复执行。
  if (localStorage.getItem('luna_moments_seed_purged') !== '1') {
    const before = MOMENTS_FEED.length;
    MOMENTS_FEED = MOMENTS_FEED.filter(p => !(p.id && p.id.indexOf('seed_') === 0));
    localStorage.setItem('luna_moments_seed_purged', '1');
    if (MOMENTS_FEED.length !== before) {
      await momentsDbSaveAll(MOMENTS_FEED);
    }
  }

  momentsPruneRemovedFriends();
  momentsRenderFeed();
  momentsUpdateHeaderStats();
}

/* 好友列表变化时调用：只做"清理"，不做"补种"——
   移除已经不是好友的人留下的动态（不动用户自己发布的 isMine 内容），
   不会为任何好友（无论新旧）自动生成动态。 */
function momentsPruneRemovedFriends() {
  const friendNames = new Set((typeof friendsData !== 'undefined' ? friendsData : []).map(f => f.name));
  const before = MOMENTS_FEED.length;
  MOMENTS_FEED = MOMENTS_FEED.filter(p => p.isMine || friendNames.has(p.author));
  if (MOMENTS_FEED.length !== before) {
    momentsDbSaveAll(MOMENTS_FEED);
  }
  momentsUpdateHeaderStats();
}

/* 保留旧函数名作为别名，避免其他文件里遗留的调用报错；行为已改为"只清理不补种" */
function momentsSyncWithFriends() {
  momentsPruneRemovedFriends();
}

/* ================================
   渲染信息流
================================ */
/* ================================
   头部真实统计（替代 HTML 里硬编码的占位数字）
   Posts：当前 Feed 中的帖子总数
   Visitors：基于帖子互动量（赞+评论）估算的一个只读展示型数字，
             并非可点击操作，纯粹反映当前数据的真实规模，不是凭空写死的
================================ */
function momentsUpdateHeaderStats() {
  const postsEl = document.getElementById('mmtStatPosts');
  const visitEl = document.getElementById('mmtStatVisitors');
  if (!postsEl && !visitEl) return;

  const postCount = MOMENTS_FEED.length;
  if (postsEl) postsEl.textContent = String(postCount);

  if (visitEl) {
    const interactionSum = MOMENTS_FEED.reduce((sum, p) => {
      return sum + (p.likeCount || 0) + (p.comments ? p.comments.length : 0);
    }, 0);
    // 无内容时如实显示 0，不伪造流量
    visitEl.textContent = interactionSum >= 1000
      ? (interactionSum / 1000).toFixed(1) + 'k'
      : String(interactionSum);
  }
}

function momentsRenderFeed() {
  const list = document.getElementById('mmtFeedList');
  if (!list) return;

  if (MOMENTS_FEED.length === 0) {
    list.innerHTML = `
      <div class="mmt-feed-empty">
        <div class="mmt-feed-empty-title">还没有动态</div>
        <div class="mmt-feed-empty-sub">添加好友或发布你的第一条动态吧</div>
      </div>`;
    return;
  }

  list.innerHTML = MOMENTS_FEED.map(post => momentsCardHtml(post)).join('');
}

function momentsTimeAgo(ts) {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return `${day} day${day > 1 ? 's' : ''} ago`;
}

const MOMENTS_AUDIENCE_LABEL = { public: 'Public', friends: 'Friends', private: 'Only me' };

function momentsCardHtml(post) {
  const cachedAvatar = post.isMine
    ? momentsGetMyAvatar()
    : (typeof _avatarCache !== 'undefined' && _avatarCache ? _avatarCache[post.author] : null);

  const avatarHtml = cachedAvatar
    ? `<img src="${cachedAvatar}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:inherit;" alt=""/>`
    : (post.avatarInitial || (post.author || '?')[0].toUpperCase());

  const audienceText = MOMENTS_AUDIENCE_LABEL[post.audience] || 'Friends';
  const locText = post.location ? ` · ${post.location.name || post.location}` : '';
  const moodText = post.mood ? ` · ${post.mood.emoji} ${post.mood.label}` : '';

  const mediaHtml = momentsMediaHtml(post);
  const textHtml = post.text
    ? momentsEscapeAndTag(post.text) + (post.tag ? ` <span class="mmt-card-ht">${post.tag}</span>` : '')
    : '';

  const commentCount = post.comments ? post.comments.length : 0;
  const reactHtml = momentsReactRowHtml(post);

  return `
    <div class="mmt-card" data-post-id="${post.id}">
      <div class="mmt-card-top">
        <div class="mmt-card-av" style="${cachedAvatar ? 'position:relative;overflow:hidden;' : ''}">${avatarHtml}</div>
        <div class="mmt-card-info">
          <div class="mmt-card-name">${post.author}</div>
          <div class="mmt-card-meta">${momentsTimeAgo(post.createdAt)} · ${audienceText}${locText}${moodText}</div>
        </div>
        <div class="mmt-card-more" onclick="momentsOpenPostMenu('${post.id}')">
          <div class="mmt-dot"></div><div class="mmt-dot"></div><div class="mmt-dot"></div>
        </div>
      </div>
      ${mediaHtml}
      ${textHtml ? `<div class="mmt-card-body"><div class="mmt-card-text">${textHtml}</div></div>` : ''}
      ${reactHtml}
      <div class="mmt-card-foot">
        <div class="mmt-cb-act" onclick="momentsToggleLike('${post.id}')">
          <div class="mmt-cb-icon ${post.liked ? 'liked' : ''}" id="mmtLikeIcon-${post.id}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="${post.liked ? 'rgba(255,255,255,0.85)' : 'none'}" stroke="${post.liked ? 'none' : 'rgba(10,10,15,0.45)'}" stroke-width="1.8" stroke-linecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          </div>
          <div class="mmt-cb-n" id="mmtLikeCount-${post.id}">${post.likeCount}</div>
        </div>
        <div class="mmt-cb-act" onclick="momentsOpenComments('${post.id}')">
          <div class="mmt-cb-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(10,10,15,0.45)" stroke-width="1.8" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <div class="mmt-cb-n" id="mmtCommentCount-${post.id}">${commentCount}</div>
        </div>
        <div class="mmt-cb-act" onclick="momentsSharePost('${post.id}')">
          <div class="mmt-cb-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(10,10,15,0.45)" stroke-width="1.8" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/></svg>
          </div>
          <div class="mmt-cb-n">0</div>
        </div>
        <div class="mmt-cb-save ${post.saved ? 'saved' : ''}" id="mmtSaveIcon-${post.id}" onclick="momentsToggleSave('${post.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="${post.saved ? 'rgba(10,10,15,0.85)' : 'none'}" stroke="rgba(10,10,15,0.4)" stroke-width="1.8" stroke-linecap="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </div>
      </div>
    </div>`;
}

/* 文字动态 vs 图片动态：图片动态渲染真实图片九宫格/单图，文字动态无媒体区 */
function momentsMediaHtml(post) {
  if (!post.images || post.images.length === 0) return '';

  if (post.images.length === 1) {
    return `
      <div class="mmt-card-media">
        <img src="${post.images[0]}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" alt=""/>
      </div>`;
  }

  const cols = post.images.length === 2 ? 2 : 3;
  const thumbs = post.images.slice(0, 9).map(src =>
    `<div style="position:relative;overflow:hidden;background:#eee;"><img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" alt=""/></div>`
  ).join('');

  return `
    <div class="mmt-card-media" style="height:auto;aspect-ratio:${cols === 2 ? '2/1.1' : '1/1'};display:grid;grid-template-columns:repeat(${cols},1fr);gap:2px;">
      ${thumbs}
    </div>`;
}

function momentsReactRowHtml(post) {
  if (!post.likeCount || post.likeCount === 0) return '';
  const names = momentsSampleLikerNames(post);
  const avatars = names.slice(0, 3).map((n, i) => {
    const cls = ['mmt-rav1', 'mmt-rav2', 'mmt-rav3'][i % 3];
    return `<div class="mmt-react-av ${cls}">${(n || '?')[0]}</div>`;
  }).join('');

  const extra = post.likeCount - names.length;
  const nameLine = names.slice(0, 2).join(', ') + (extra > 0 ? ` + ${extra} others` : '');

  return `
    <div class="mmt-card-react">
      <div class="mmt-react-avs">${avatars}</div>
      <div class="mmt-react-txt">${nameLine} liked this</div>
    </div>`;
}

function momentsSampleLikerNames(post) {
  const pool = friendsData.map(f => f.name);
  const n = Math.min(3, pool.length, post.likeCount);
  return pool.slice(0, n);
}

function momentsEscapeAndTag(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}

function momentsGetMyAvatar() {
  const igAvEl = document.querySelector('.ig-av img');
  return igAvEl ? igAvEl.src : null;
}

/* ================================
   点赞
================================ */
function momentsToggleLike(id) {
  const post = MOMENTS_FEED.find(p => p.id === id);
  if (!post) return;
  post.liked = !post.liked;
  post.likeCount += post.liked ? 1 : -1;
  if (post.likeCount < 0) post.likeCount = 0;

  const icon = document.getElementById(`mmtLikeIcon-${id}`);
  const count = document.getElementById(`mmtLikeCount-${id}`);
  if (icon) {
    icon.classList.toggle('liked', post.liked);
    const svg = icon.querySelector('svg');
    svg.setAttribute('fill', post.liked ? 'rgba(255,255,255,0.85)' : 'none');
    svg.setAttribute('stroke', post.liked ? 'none' : 'rgba(10,10,15,0.45)');
    if (post.liked) {
      icon.classList.add('mmt-like-pop');
      setTimeout(() => icon.classList.remove('mmt-like-pop'), 260);
    }
  }
  if (count) count.textContent = post.likeCount;

  // 重新渲染这张卡片的反应行（谁点了赞）
  const card = document.querySelector(`.mmt-card[data-post-id="${id}"]`);
  if (card) {
    const existingReact = card.querySelector('.mmt-card-react');
    const newReactHtml = momentsReactRowHtml(post);
    if (existingReact && !newReactHtml) {
      existingReact.remove();
    } else if (existingReact && newReactHtml) {
      existingReact.outerHTML = newReactHtml;
    } else if (!existingReact && newReactHtml) {
      const body = card.querySelector('.mmt-card-body') || card.querySelector('.mmt-card-media') || card.querySelector('.mmt-card-top');
      body.insertAdjacentHTML('afterend', newReactHtml);
    }
  }

  momentsDbSaveAll(MOMENTS_FEED);
  momentsUpdateHeaderStats();
}

/* ================================
   收藏
================================ */
function momentsToggleSave(id) {
  const post = MOMENTS_FEED.find(p => p.id === id);
  if (!post) return;
  post.saved = !post.saved;

  const el = document.getElementById(`mmtSaveIcon-${id}`);
  if (el) {
    el.classList.toggle('saved', post.saved);
    const svg = el.querySelector('svg');
    svg.setAttribute('fill', post.saved ? 'rgba(10,10,15,0.85)' : 'none');
  }
  momentsToast(post.saved ? '已收藏' : '已取消收藏');
  momentsDbSaveAll(MOMENTS_FEED);
}

/* ================================
   分享 —— 朋友圈「帖子」转发进聊天
   注意：这与 Story（限时动态，svDb / fwdOpen）是两套完全独立的转发逻辑：
   - Story 转发 (fwdOpen / fwdDoSend)：针对 24 小时限时动态，转发对象是"故事"，
     转发后触发好友对故事的模拟互动（点赞/评论/再转发），数据存在 luna_my_story_db。
   - Moments 帖子转发 (本函数)：针对朋友圈里的常态帖子(MOMENTS_FEED)，
     转发目标是"聊天对象"，把帖子作为一张卡片消息发进某个聊天窗口，
     由 chatroom.js 里的 crBuildApiMessages 识别 isMomentShare 并把帖子内容
     喂给 AI，让 AI 能读懂你转发的这条朋友圈说的是什么。
================================ */
function momentsSharePost(id) {
  const post = MOMENTS_FEED.find(p => p.id === id);
  if (!post) return;
  if (typeof momentsOpenForwardPicker === 'function') {
    momentsOpenForwardPicker(post);
  } else {
    momentsToast('分享功能开发中');
  }
}

/* 打开"转发到聊天"好友选择面板（复用 chatroom.js 的好友列表数据） */
function momentsOpenForwardPicker(post) {
  let overlay = document.getElementById('mmtFwdOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'mmtFwdOverlay';
    overlay.className = 'mmt-comment-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) momentsCloseForwardPicker(); };
    document.body.appendChild(overlay);

    const sheet = document.createElement('div');
    sheet.id = 'mmtFwdSheet';
    sheet.className = 'mmt-comment-sheet';
    sheet.innerHTML = `
      <div class="mmt-comment-handle"></div>
      <div class="mmt-comment-hdr">
        <div class="mmt-comment-hdr-title">转发到聊天</div>
        <div class="mmt-comment-hdr-close" onclick="momentsCloseForwardPicker()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </div>
      </div>
      <div class="mmt-comment-list" id="mmtFwdFriendList"></div>`;
    document.body.appendChild(sheet);
  }

  const list = document.getElementById('mmtFwdFriendList');
  const friends = (typeof friendsData !== 'undefined' ? friendsData : []);
  if (friends.length === 0) {
    list.innerHTML = `<div class="mmt-comment-empty">还没有可转发的聊天对象</div>`;
  } else {
    list.innerHTML = friends.map(f => `
      <div class="mmt-comment-item" style="cursor:pointer;align-items:center;" onclick="momentsForwardToChat('${post.id}','${f.name.replace(/'/g, "\\'")}')">
        <div class="mmt-comment-av">${(f.name || '?')[0]}</div>
        <div class="mmt-comment-body">
          <div class="mmt-comment-name">${f.name}</div>
        </div>
      </div>`).join('');
  }

  document.getElementById('mmtFwdOverlay').classList.add('show');
  document.getElementById('mmtFwdSheet').classList.add('show');
}

function momentsCloseForwardPicker() {
  document.getElementById('mmtFwdOverlay')?.classList.remove('show');
  document.getElementById('mmtFwdSheet')?.classList.remove('show');
}

/* 把帖子作为一张卡片消息发进目标聊天窗口。
   仅在用户主动点选好友后才执行 —— 不涉及任何未经用户确认的自动行为。
   chatroom.js 运行在独立页面(chatroom.html)，这里通过 localStorage 暂存待转发的
   帖子卡片数据，再跳转过去，由 chatroom.js 加载时读取并插入一条消息。 */
function momentsForwardToChat(postId, friendName) {
  const post = MOMENTS_FEED.find(p => p.id === postId);
  if (!post) return;
  momentsCloseForwardPicker();

  localStorage.setItem('luna_pending_moment_share', JSON.stringify({
    friendName,
    card: momentsBuildShareCard(post),
    ts: Date.now(),
  }));

  momentsToast('已转发给 ' + friendName);
  setTimeout(() => {
    if (typeof openChatroom === 'function') {
      openChatroom(friendName);
    }
  }, 500);
}

/* 把 moments 帖子转成一份可跨模块传递的纯数据卡片（不含DOM），
   供 chatroom.js 存进消息对象、以及 AI 上下文解析使用 */
function momentsBuildShareCard(post) {
  return {
    postId: post.id,
    author: post.author,
    text: post.text || '',
    tag: post.tag || '',
    hasImage: !!(post.images && post.images.length > 0),
    imageCount: post.images ? post.images.length : 0,
    coverImage: post.images && post.images[0] ? post.images[0] : null,
    createdAt: post.createdAt,
  };
}

/* ================================
   动态右上角菜单（占位：作者本人可删除）
================================ */
function momentsOpenPostMenu(id) {
  const post = MOMENTS_FEED.find(p => p.id === id);
  if (!post) return;
  if (!post.isMine) {
    momentsToast('已举报该动态');
    return;
  }
  if (confirm('删除这条动态吗？')) {
    momentsDeletePost(id);
  }
}

function momentsDeletePost(id) {
  MOMENTS_FEED = MOMENTS_FEED.filter(p => p.id !== id);
  momentsRenderFeed();
  momentsDbSaveAll(MOMENTS_FEED);
  momentsUpdateHeaderStats();
  momentsToast('已删除');
}

/* ================================
   评论弹层
================================ */
function momentsOpenComments(id) {
  _momentsCommentTargetId = id;
  const overlay = document.getElementById('mmtCommentOverlay');
  const sheet   = document.getElementById('mmtCommentSheet');
  overlay.classList.add('show');
  sheet.classList.add('show');
  momentsRenderCommentList();
  setTimeout(() => document.getElementById('mmtCommentInput')?.focus(), 260);
}

function momentsCloseComments() {
  document.getElementById('mmtCommentOverlay').classList.remove('show');
  document.getElementById('mmtCommentSheet').classList.remove('show');
  _momentsCommentTargetId = null;
}

function momentsRenderCommentList() {
  const post = MOMENTS_FEED.find(p => p.id === _momentsCommentTargetId);
  const list = document.getElementById('mmtCommentList');
  const countEl = document.getElementById('mmtCommentSheetCount');
  if (!post || !list) return;

  countEl.textContent = `${post.comments.length} 条评论`;

  if (post.comments.length === 0) {
    list.innerHTML = `<div class="mmt-comment-empty">还没有评论，来说第一句吧</div>`;
    return;
  }

  list.innerHTML = post.comments.map(c => `
    <div class="mmt-comment-item">
      <div class="mmt-comment-av">${(c.author || '?')[0]}</div>
      <div class="mmt-comment-body">
        <div class="mmt-comment-name">${c.author}</div>
        <div class="mmt-comment-text">${momentsEscapeAndTag(c.text)}</div>
        <div class="mmt-comment-time">${momentsTimeAgo(c.createdAt)}</div>
      </div>
    </div>
  `).join('');
}

function momentsSubmitComment() {
  const input = document.getElementById('mmtCommentInput');
  const text = input.value.trim();
  if (!text) return;

  const post = MOMENTS_FEED.find(p => p.id === _momentsCommentTargetId);
  if (!post) return;

  post.comments.push({
    author: 'Luna',       // 当前用户发的评论
    text,
    createdAt: Date.now(),
  });

  input.value = '';
  momentsRenderCommentList();

  const countEl = document.getElementById(`mmtCommentCount-${post.id}`);
  if (countEl) countEl.textContent = post.comments.length;

  momentsDbSaveAll(MOMENTS_FEED);
  momentsUpdateHeaderStats();
}

/* ================================
   发布新动态：由 post-editor.js 调用
================================ */
function momentsPublishPost({ text, images, location, mood, audience }) {
  const post = {
    id: 'mine_' + Date.now(),
    isMine: true,
    author: momentsGetMyName(),
    avatarInitial: (momentsGetMyName() || '我')[0].toUpperCase(),
    avatarImg: null,
    audience: audience || 'public',
    text: text || '',
    tag: '',
    images: images || [],
    location: location || null,
    mood: mood || null,
    createdAt: Date.now(),
    likeCount: 0,
    liked: false,
    comments: [],
    saved: false,
  };

  MOMENTS_FEED.unshift(post);
  momentsRenderFeed();
  momentsDbSaveAll(MOMENTS_FEED);
  momentsUpdateHeaderStats();
  return post;
}

function momentsGetMyName() {
  const nameEl = document.querySelector('#pageProfile .pf-name, #pageProfile .pf-display-name');
  return (nameEl && nameEl.textContent.trim()) || 'Luna';
}

/* ================================
   IndexedDB 持久化（复用 LunaChatDB，新增 moments 表）
================================ */
async function momentsDbLoadAll() {
  try {
    const db = await getLunaChatDB();
    if (!db.objectStoreNames.contains('moments')) return [];
    return new Promise(res => {
      const r = db.transaction('moments').objectStore('moments').getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

function momentsDbSaveAll(list) {
  getLunaChatDB().then(db => {
    if (!db.objectStoreNames.contains('moments')) return;
    const tx = db.transaction('moments', 'readwrite');
    const store = tx.objectStore('moments');
    store.clear();
    list.forEach(p => store.put(p));
  }).catch(() => {});
}

/* ================================
   轻提示（独立于 post-editor 的 toast，供好友页 / 主 feed 使用）
================================ */
function momentsToast(msg) {
  let el = document.getElementById('mmtToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'mmtToast';
    el.className = 'mmt-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(momentsToast._t);
  momentsToast._t = setTimeout(() => el.classList.remove('show'), 1600);
}