/* ==========================================================
   dn-store.js — 数据层（IndexedDB 书籍库 + localStorage 配置）
   ========================================================== */
(function () {
  const DB_NAME = 'LunaDialogNovelDB';
  const STORE = 'books';
  let _db = null;

  function open() {
    return new Promise((res, rej) => {
      if (_db) return res(_db);
      const req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror = () => rej(req.error);
    });
  }

  async function all() {
    const db = await open();
    return new Promise((res, rej) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      r.onsuccess = () => res((r.result || []).sort((a, b) => b.time - a.time));
      r.onerror = () => rej(r.error);
    });
  }
  async function get(id) {
    const db = await open();
    return new Promise((res, rej) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    });
  }
  async function put(book) {
    const db = await open();
    return new Promise((res, rej) => {
      const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(book);
      r.onsuccess = () => res(book);
      r.onerror = () => rej(r.error);
    });
  }
  async function del(id) {
    const db = await open();
    return new Promise((res, rej) => {
      const r = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
  }

  /* ---------- 阅读设置：全局 / 单本 ---------- */
  const GK = 'dn_reader_global';
  function globalSettings() {
    try { return JSON.parse(localStorage.getItem(GK) || '{}'); } catch (e) { return {}; }
  }
  function saveGlobal(s) { localStorage.setItem(GK, JSON.stringify(s)); }

  const DEFAULT_RS = {
    size: 16,
    font: "'Noto Serif SC',serif",
    color: '#2A2A31',
    bg: ''
  };
  function mergedSettings(book) {
    const g = Object.assign({}, DEFAULT_RS, globalSettings());
    if (book && book.readerSettings && book.readerSettings.scope === 'book') {
      return Object.assign({}, g, book.readerSettings);
    }
    return g;
  }

  /* ---------- 个人资料 ---------- */
  const PK = 'dn_profile';
  function profile() {
    try {
      return Object.assign({ name: '未命名读者', sign: '轻触以编辑署名', avatar: '', cover: '' },
        JSON.parse(localStorage.getItem(PK) || '{}'));
    } catch (e) { return { name: '未命名读者', sign: '', avatar: '', cover: '' }; }
  }
  function saveProfile(p) { localStorage.setItem(PK, JSON.stringify(p)); }

  window.DNStore = {
    all, get, put, del,
    globalSettings, saveGlobal, mergedSettings, DEFAULT_RS,
    profile, saveProfile,
    uid: () => 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
  };
})();
