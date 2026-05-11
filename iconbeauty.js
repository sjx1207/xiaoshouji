/* ================================
   Icon Beauty — iconbeauty.js
   图标自定义 · IndexedDB 持久化
================================ */

/* ================================
   App 定义表 — 对应 index.html 所有 app
================================ */
const IB_APPS = [
  /* ── 第一页 ── */
  {
    id: 'wallpaper',
    name: '壁纸',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(167,139,250,0.18)" stroke="rgba(167,139,250,0.7)" stroke-width="1.4"/>
      <circle cx="8.5" cy="8.5" r="2" fill="rgba(251,191,36,0.85)"/>
      <path d="M3 15l5-4 4 4 3-3 6 5" stroke="rgba(99,102,241,0.75)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'settings',
    name: '设置',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="12" cy="12" r="3" stroke="rgba(100,116,139,0.8)" stroke-width="1.5"/>
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="rgba(100,116,139,0.75)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'chat',
    name: '聊天',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="rgba(99,102,241,0.12)" stroke="rgba(99,102,241,0.7)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M8 10h8M8 13h5" stroke="rgba(99,102,241,0.7)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'music',
    name: '音乐',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M9 18V6l10-2v12" stroke="rgba(251,146,60,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="7" cy="18" r="2.5" fill="rgba(251,146,60,0.7)"/>
      <circle cx="17" cy="16" r="2.5" fill="rgba(251,146,60,0.7)"/>
    </svg>`
  },
  {
    id: 'phone',
    name: '电话',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V17c0 .6-.4 1-1 1C10.6 18 4 11.4 4 7c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" fill="rgba(34,197,94,0.15)" stroke="rgba(34,197,94,0.8)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'sms',
    name: '短信',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fill="rgba(56,189,248,0.12)" stroke="rgba(56,189,248,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M8 10h8M8 13h5" stroke="rgba(56,189,248,0.75)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'photos',
    name: '相册',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="3" fill="rgba(251,191,36,0.12)" stroke="rgba(251,191,36,0.75)" stroke-width="1.4"/>
      <circle cx="8.5" cy="8.5" r="2" fill="rgba(251,191,36,0.7)"/>
      <path d="M3 15l5-4 4 4 3-3 6 5" stroke="rgba(251,191,36,0.75)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'archive',
    name: '档案',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" fill="rgba(168,85,247,0.12)" stroke="rgba(168,85,247,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M9 13h6M12 10v6" stroke="rgba(168,85,247,0.75)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  /* ── 第二页 ── */
  {
    id: 'forum',
    name: '论坛',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="3" y="4" width="18" height="3" rx="1" fill="rgba(239,68,68,0.15)" stroke="rgba(239,68,68,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <rect x="3" y="10" width="18" height="11" rx="2" fill="rgba(239,68,68,0.08)" stroke="rgba(239,68,68,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M9 15h6M9 18h4" stroke="rgba(239,68,68,0.75)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'beautify',
    name: '美化',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="12" cy="10" r="4" fill="rgba(236,72,153,0.12)" stroke="rgba(236,72,153,0.75)" stroke-width="1.4"/>
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="rgba(236,72,153,0.75)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M17 4l1.5 1.5M19.5 2.5l-1.5 1.5" stroke="rgba(236,72,153,0.75)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'diary',
    name: '日记',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="4" y="3" width="14" height="18" rx="2" fill="rgba(251,146,60,0.1)" stroke="rgba(251,146,60,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M8 8h6M8 12h6M8 16h4" stroke="rgba(251,146,60,0.75)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M17 5c.8-.6 2-.4 2.5.5s.2 2-.6 2.5L13 12l-2 .5.5-2 6-5.5z" stroke="rgba(251,146,60,0.75)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'wallet',
    name: '钱包',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="2" y="6" width="20" height="14" rx="2" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M2 10h20" stroke="rgba(34,197,94,0.75)" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="15" y="13" width="4" height="3" rx="1" stroke="rgba(34,197,94,0.75)" stroke-width="1.4"/>
      <path d="M6 6V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" stroke="rgba(34,197,94,0.75)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'itinerary',
    name: '行程',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="3" y="4" width="18" height="17" rx="2" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M3 9h18" stroke="rgba(56,189,248,0.75)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M8 2v4M16 2v4" stroke="rgba(56,189,248,0.75)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M7 13h4M7 16h6" stroke="rgba(56,189,248,0.75)" stroke-width="1.4" stroke-linecap="round"/>
      <circle cx="16" cy="14.5" r="2.5" stroke="rgba(56,189,248,0.75)" stroke-width="1.4"/>
    </svg>`
  },
  {
    id: 'shop',
    name: '购物',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.75)" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M3 6h18" stroke="rgba(168,85,247,0.75)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M16 10a4 4 0 0 1-8 0" stroke="rgba(168,85,247,0.75)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  /* ── 第三页 ── */
  {
    id: 'novel',
    name: '小说',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke="rgba(251,146,60,0.8)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke="rgba(251,146,60,0.75)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9 7h6M9 10.5h8M9 14h5" stroke="rgba(251,146,60,0.75)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'live',
    name: '直播',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="12" cy="12" r="3" fill="rgba(239,68,68,0.2)" stroke="rgba(239,68,68,0.8)" stroke-width="1.5"/>
      <path d="M6.34 6.34a8 8 0 0 0 0 11.32" stroke="rgba(239,68,68,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M17.66 6.34a8 8 0 0 1 0 11.32" stroke="rgba(239,68,68,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M3.51 3.51a13.5 13.5 0 0 0 0 16.97" stroke="rgba(239,68,68,0.4)" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M20.49 3.51a13.5 13.5 0 0 1 0 16.97" stroke="rgba(239,68,68,0.4)" stroke-width="1.3" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'game',
    name: '游戏',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="2" y="7" width="20" height="12" rx="4" fill="rgba(99,102,241,0.1)" stroke="rgba(99,102,241,0.75)" stroke-width="1.5"/>
      <path d="M9 11v4M7 13h4" stroke="rgba(99,102,241,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="15" cy="12" r="1" fill="rgba(99,102,241,0.8)"/>
      <circle cx="17" cy="14" r="1" fill="rgba(99,102,241,0.8)"/>
    </svg>`
  },
  {
    id: 'phonecheck',
    name: '查手机',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="7" y="2" width="10" height="18" rx="2.5" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.75)" stroke-width="1.5"/>
      <path d="M10 5h4" stroke="rgba(56,189,248,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="17" r="1" fill="rgba(56,189,248,0.8)"/>
      <path d="M10 10l1.5 1.5L14 8.5" stroke="rgba(56,189,248,0.75)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'social',
    name: '社交',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="9" cy="8" r="3" fill="rgba(236,72,153,0.1)" stroke="rgba(236,72,153,0.75)" stroke-width="1.5"/>
      <circle cx="17" cy="6" r="2.5" stroke="rgba(236,72,153,0.75)" stroke-width="1.5"/>
      <path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="rgba(236,72,153,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M17 11c1.657 0 3 1.567 3 3.5" stroke="rgba(236,72,153,0.75)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'dialognovel',
    name: '对话小说',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M3 6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H8l-3 3V6z" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.75)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M15 9h2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-1l-2 2v-2h-1" stroke="rgba(34,197,94,0.75)" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'mail',
    name: '邮箱',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="2" y="5" width="20" height="14" rx="2" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.75)" stroke-width="1.5"/>
      <path d="M2 8l10 6 10-6" stroke="rgba(56,189,248,0.75)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`
  },
  {
    id: 'radio',
    name: '电台',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="12" cy="13" r="3" fill="rgba(251,191,36,0.15)" stroke="rgba(251,191,36,0.8)" stroke-width="1.5"/>
      <path d="M5.5 7.5A9 9 0 0 1 18.5 7.5" stroke="rgba(251,191,36,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M8 10.5a5 5 0 0 1 8 0" stroke="rgba(251,191,36,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="12" y1="13" x2="12" y2="19" stroke="rgba(251,191,36,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <line x1="9" y1="19" x2="15" y2="19" stroke="rgba(251,191,36,0.75)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'parallel',
    name: '平行时空',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="12" cy="12" r="9" fill="rgba(99,102,241,0.08)" stroke="rgba(99,102,241,0.7)" stroke-width="1.5"/>
      <ellipse cx="12" cy="12" rx="4" ry="9" stroke="rgba(99,102,241,0.65)" stroke-width="1.5"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke="rgba(99,102,241,0.65)" stroke-width="1.5" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.5" fill="rgba(99,102,241,0.85)"/>
    </svg>`
  },
  {
    id: 'company',
    name: '公司',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M3 21V7a2 2 0 0 1 2-2h6v16" fill="rgba(100,116,139,0.08)" stroke="rgba(100,116,139,0.75)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M13 21V11h6a2 2 0 0 1 2 2v8" stroke="rgba(100,116,139,0.75)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M3 21h18" stroke="rgba(100,116,139,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M7 9h2M7 13h2M7 17h2M15 15h2" stroke="rgba(100,116,139,0.7)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'user',
    name: 'Luna User',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <circle cx="12" cy="8" r="3.5" fill="rgba(168,85,247,0.1)" stroke="rgba(168,85,247,0.75)" stroke-width="1.5"/>
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="rgba(168,85,247,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M16 6.5c.8.6 1.5 1.5 1.5 3" stroke="rgba(168,85,247,0.6)" stroke-width="1.4" stroke-linecap="round"/>
      <path d="M8 6.5C7.2 7.1 6.5 8 6.5 9.5" stroke="rgba(168,85,247,0.6)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  /* ── Dock ── */
  {
    id: 'characters',
    name: '角色',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="4" y="2" width="16" height="20" rx="2" fill="rgba(167,139,250,0.12)" stroke="rgba(167,139,250,0.75)" stroke-width="1.8"/>
      <rect x="4" y="2" width="16" height="7" rx="2" fill="rgba(167,139,250,0.3)"/>
      <circle cx="12" cy="13" r="3" stroke="rgba(167,139,250,0.8)" stroke-width="1.6"/>
      <path d="M7 20.5 Q12 17 17 20.5" stroke="rgba(167,139,250,0.75)" stroke-width="1.6" stroke-linecap="round" fill="none"/>
    </svg>`
  },
  {
    id: 'worldbook',
    name: '世界书',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M2 6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6z" fill="rgba(251,113,133,0.1)" stroke="rgba(251,113,133,0.75)" stroke-width="1.6"/>
      <path d="M7 10h10M7 14h6" stroke="rgba(251,113,133,0.75)" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="17" cy="14" r="2" stroke="rgba(251,113,133,0.75)" stroke-width="1.4"/>
      <path d="M6 6V4M18 6V4" stroke="rgba(251,113,133,0.7)" stroke-width="1.4" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'memory',
    name: '记忆',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6l-.7.4V18a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2.6l-.7-.4A7 7 0 0 1 12 2z" fill="rgba(45,212,191,0.12)" stroke="rgba(45,212,191,0.75)" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M9 18h6" stroke="rgba(45,212,191,0.75)" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M10 21h4" stroke="rgba(45,212,191,0.75)" stroke-width="1.5" stroke-linecap="round"/>
    </svg>`
  },
  {
    id: 'iconbeauty',
    name: 'Icon Beauty',
    defaultSvg: `<svg viewBox="0 0 24 24" width="27" height="27" fill="none">
      <rect x="3" y="3" width="18" height="18" rx="4" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.75)" stroke-width="1.5"/>
      <circle cx="8" cy="12" r="1" fill="rgba(56,189,248,0.8)"/>
      <circle cx="12" cy="12" r="1" fill="rgba(56,189,248,0.8)"/>
      <circle cx="16" cy="12" r="1" fill="rgba(56,189,248,0.8)"/>
    </svg>`
  }
];

/* ================================
   IndexedDB
================================ */
let _ibDb = null;

function openIbDB() {
  return new Promise((res, rej) => {
    if (_ibDb) return res(_ibDb);
    const req = indexedDB.open('LunaIconBeautyDB', 4);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('icons', { keyPath: 'appId' });
    };
    req.onsuccess = e => { _ibDb = e.target.result; res(_ibDb); };
    req.onerror = () => rej('IB DB Error');
  });
}

async function ibSaveIconDB(appId, imageData) {
  const db = await openIbDB();
  return new Promise(res => {
    const tx = db.transaction('icons', 'readwrite');
    tx.objectStore('icons').put({ appId, imageData });
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
}

async function ibDeleteIconDB(appId) {
  const db = await openIbDB();
  return new Promise(res => {
    const tx = db.transaction('icons', 'readwrite');
    tx.objectStore('icons').delete(appId);
    tx.oncomplete = () => res(true);
    tx.onerror = () => res(false);
  });
}

async function ibGetAllIcons() {
  const db = await openIbDB();
  return new Promise(res => {
    const req = db.transaction('icons').objectStore('icons').getAll();
    req.onsuccess = () => res(req.result || []);
    req.onerror = () => res([]);
  });
}

/* ================================
   状态
================================ */
let _selectedAppId = null;
let _pendingImageData = null;
let _customIcons = {};  // appId -> imageData

/* ================================
   初始化
================================ */
document.addEventListener('DOMContentLoaded', async () => {
  updateIbTime();
  setInterval(updateIbTime, 1000);
  updateIbBattery();
  applyIsland();
  applyGlobalFont();

  // 加载已保存的图标
  const saved = await ibGetAllIcons();
  saved.forEach(row => { _customIcons[row.appId] = row.imageData; });

  renderAppGrid();

  // 拖拽上传
  const zone = document.getElementById('ibUploadZone');
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) readFileAsDataUrl(file);
  });
});

/* ================================
   渲染 App 网格
================================ */
function renderAppGrid() {
  const grid = document.getElementById('ibAppGrid');
  grid.innerHTML = '';

  IB_APPS.forEach(app => {
    const div = document.createElement('div');
    div.className = 'ib-app-item' + (_customIcons[app.id] ? ' has-custom' : '');
    div.dataset.appId = app.id;
    div.onclick = () => selectApp(app.id);

    const face = document.createElement('div');
    face.className = 'ib-app-face';

    if (_customIcons[app.id]) {
      const img = document.createElement('img');
      img.src = _customIcons[app.id];
      img.alt = app.name;
      face.appendChild(img);
    } else {
      face.innerHTML = app.defaultSvg;
    }

    const label = document.createElement('div');
    label.className = 'ib-app-name';
    label.textContent = app.name;

    div.appendChild(face);
    div.appendChild(label);
    grid.appendChild(div);
  });
}

/* ================================
   选择 App
================================ */
function selectApp(appId) {
  _selectedAppId = appId;
  _pendingImageData = null;

  // 更新选中态
  document.querySelectorAll('.ib-app-item').forEach(el => {
    el.classList.toggle('active', el.dataset.appId === appId);
  });

  const app = IB_APPS.find(a => a.id === appId);
  if (!app) return;

  // 显示预览
  const previewZone = document.getElementById('ibPreviewZone');
  const editPanel = document.getElementById('ibEditPanel');
  previewZone.style.display = 'block';
  editPanel.style.display = 'block';

  // 更新原始图标预览
  const prevIcon = document.getElementById('ibPreviewIcon');
  if (_customIcons[appId]) {
    prevIcon.innerHTML = `<img src="${_customIcons[appId]}" alt="${app.name}"/>`;
  } else {
    prevIcon.innerHTML = app.defaultSvg;
  }

  // 重置新图标预览
  const prevNew = document.getElementById('ibPreviewNew');
  prevNew.innerHTML = `<div class="ib-preview-placeholder">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </div>`;

  document.getElementById('ibPreviewLabel').textContent = app.name;

  // 重置按钮状态
  document.getElementById('ibBtnSave').disabled = true;

  // 清空输入
  document.getElementById('ibUrlInput').value = '';
  document.getElementById('ibFileInput').value = '';
}

/* ================================
   Tab 切换
================================ */
function ibSwitchTab(btn) {
  const tab = btn.dataset.tab;
  document.querySelectorAll('.ib-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.ib-tab-panel').forEach(p => p.style.display = 'none');
  const panel = document.getElementById('ib-tab-' + tab);
  if (panel) panel.style.display = 'block';
}

/* ================================
   文件上传处理
================================ */
function ibHandleFile(input) {
  const file = input.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    ibShowToastError('请选择图片文件');
    return;
  }
  readFileAsDataUrl(file);
}

function readFileAsDataUrl(file) {
  const reader = new FileReader();
  reader.onload = e => {
    setPreviewImage(e.target.result);
  };
  reader.onerror = () => ibShowToastError('文件读取失败');
  reader.readAsDataURL(file);
}

/* ================================
   URL 加载
================================ */
async function ibLoadUrl() {
  const url = document.getElementById('ibUrlInput').value.trim();
  if (!url) { ibShowToastError('请输入图片链接'); return; }

  // 用 Image 验证图片能否加载
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    // 转为 base64 以便存储
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    try {
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setPreviewImage(dataUrl);
    } catch(e) {
      // 跨域图片无法转 base64，直接用 url
      setPreviewImage(url);
    }
  };
  img.onerror = () => ibShowToastError('图片加载失败，请检查链接或跨域权限');
  img.src = url;
}

/* ================================
   设置预览图
================================ */
function setPreviewImage(src) {
  if (!_selectedAppId) return;
  _pendingImageData = src;

  const prevNew = document.getElementById('ibPreviewNew');
  prevNew.innerHTML = `<img src="${src}" alt="预览" style="width:100%;height:100%;object-fit:cover;border-radius:16px;"/>`;

  document.getElementById('ibBtnSave').disabled = false;
}

/* ================================
   保存图标
================================ */
async function ibSaveIcon() {
  if (!_selectedAppId || !_pendingImageData) return;

  const ok = await ibSaveIconDB(_selectedAppId, _pendingImageData);
  if (!ok) { ibShowToastError('保存失败，请重试'); return; }

  _customIcons[_selectedAppId] = _pendingImageData;

  // 更新网格显示
  renderAppGrid();
  // 重新激活选中
  document.querySelectorAll('.ib-app-item').forEach(el => {
    el.classList.toggle('active', el.dataset.appId === _selectedAppId);
  });

  // 更新左侧预览为新图标
  const prevIcon = document.getElementById('ibPreviewIcon');
  prevIcon.innerHTML = `<img src="${_pendingImageData}" alt=""/>`;

  _pendingImageData = null;
  document.getElementById('ibBtnSave').disabled = true;

  ibShowToast('ibToastSaved');

  // 通知 localStorage 让 index.html 监听同步
  localStorage.setItem('luna_icon_update', Date.now().toString());
}

/* ================================
   恢复原始确认
================================ */
function ibConfirmReset() {
  if (!_selectedAppId) return;
  document.getElementById('ibResetOverlay').classList.add('show');
  document.getElementById('ibResetModal').classList.add('show');
}
function ibCloseReset() {
  document.getElementById('ibResetOverlay').classList.remove('show');
  document.getElementById('ibResetModal').classList.remove('show');
}
async function ibDoReset() {
  if (!_selectedAppId) return;
  ibCloseReset();

  await ibDeleteIconDB(_selectedAppId);
  delete _customIcons[_selectedAppId];

  const app = IB_APPS.find(a => a.id === _selectedAppId);
  if (!app) return;

  // 还原预览
  const prevIcon = document.getElementById('ibPreviewIcon');
  prevIcon.innerHTML = app.defaultSvg;

  // 重置新图标区
  const prevNew = document.getElementById('ibPreviewNew');
  prevNew.innerHTML = `<div class="ib-preview-placeholder">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 3"/>
      <path d="M12 8v8M8 12h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
    </svg>
  </div>`;

  _pendingImageData = null;
  document.getElementById('ibBtnSave').disabled = true;

  renderAppGrid();
  document.querySelectorAll('.ib-app-item').forEach(el => {
    el.classList.toggle('active', el.dataset.appId === _selectedAppId);
  });

  // 通知 index 同步
  localStorage.setItem('luna_icon_update', Date.now().toString());

  ibShowToast('ibToastSaved');
}

/* ================================
   Toast 显示
================================ */
function ibShowToast(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}
function ibShowToastError(msg) {
  const el = document.getElementById('ibToastError');
  const txt = document.getElementById('ibToastErrorText');
  if (txt) txt.textContent = msg;
  if (!el) return;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2400);
}

/* ================================
   返回首页
================================ */
function goBack() {
  const mask = document.createElement('div');
  mask.style.cssText = 'position:fixed;inset:0;background:rgba(232,244,235,0.97);opacity:0;z-index:9999;transition:opacity 0.28s ease;pointer-events:all;';
  document.body.appendChild(mask);
  requestAnimationFrame(() => { mask.style.opacity = '1'; });
  setTimeout(() => { window.location.href = 'index.html'; }, 260);
}

/* ================================
   时间 / 电量 / 灵动岛 — 同步 index
================================ */
function updateIbTime() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const now = new Date();
  const s = now.toLocaleTimeString('zh-CN', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
  document.querySelectorAll('.status-time').forEach(el => el.textContent = s);
}

function updateIbBattery() {
  function render(pct) {
    const p = Math.round(pct);
    document.querySelectorAll('.bat-pct').forEach(el => el.textContent = p);
    document.querySelectorAll('.bat-inner').forEach(el => {
      el.style.width = p + '%';
      el.style.background = p <= 20 ? 'linear-gradient(90deg,#f87171,#ef4444)' : 'linear-gradient(90deg,#86c99a,#4fa868)';
    });
  }
  if ('getBattery' in navigator) {
    navigator.getBattery().then(b => {
      render(b.level * 100);
      b.addEventListener('levelchange', () => render(b.level * 100));
    });
  } else { render(76); }
}

function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
  };
  document.querySelectorAll('.status-island').forEach(el => {
    el.innerHTML = enabled ? (styleMap[style] || styleMap.minimal) : '';
  });
}

async function applyGlobalFont() {
  const name = localStorage.getItem('luna_font_active_name');
  const id   = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onsuccess = e => res(e.target.result);
        req.onerror = () => rej();
      });
      const all = await new Promise(res => {
        const r = db.transaction('fonts').objectStore('fonts').getAll();
        r.onsuccess = () => res(r.result || []);
        r.onerror   = () => res([]);
      });
      const f = all.find(x => x.id === id);
      if (f) {
        const face = new FontFace(name, `url(${f.data})`);
        await face.load();
        document.fonts.add(face);
      }
    } catch(e) {}
  }
  let tag = document.getElementById('luna-font-override');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'luna-font-override';
    document.head.appendChild(tag);
  }
  const familyRule = name ? `font-family: '${name}', sans-serif !important;` : '';
  tag.textContent = `* { ${familyRule} }`;
}

function applyIsland() {
  const enabled = localStorage.getItem('luna_island_enabled') === 'true';
  const style   = localStorage.getItem('luna_island_style') || 'minimal';
  const el      = document.getElementById('statusIsland');
  if (!el) return;

  if (!enabled) { el.innerHTML = ''; return; }

  const styleMap = {
    minimal: `<div class="si-minimal"><div class="si-capsule"></div></div>`,
    glow:    `<div class="si-glow"><div class="si-capsule"></div></div>`,
    clock:   `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="siClockText">--:--</span></div></div>`,
    pulse:   `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
    ripple:  `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
    rainbow: `<div class="si-rainbow"><div class="si-capsule"></div></div>`,
    music:   `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
    scan:    `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
  };

  el.innerHTML = styleMap[style] || styleMap.minimal;

  clearInterval(window._siClockTimer);
  if (style === 'clock') {
    const tick = () => {
      const t = document.getElementById('siClockText');
      if (!t) return;
      const now = new Date();
      t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
    };
    tick();
    window._siClockTimer = setInterval(tick, 10000);
  }
}

/* ================================
   index.html 图标同步读取（供 index 调用）
   index.html 的 script.js 监听 localStorage 事件后
   调用 applyCustomIcons() 即可刷新图标显示
================================ */
window.addEventListener('storage', e => {
  if (e.key === 'luna_island_update') applyIsland();
  if (e.key === 'luna_tz_update')     updateIbTime();
  if (e.key === 'luna_font_update')   applyGlobalFont();
});