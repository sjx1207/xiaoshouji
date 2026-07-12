/* ================================
   luna-system-messages.js
   跨 App 共享的「系统消息」存取模块

   用途：
     钱包 App（或其他 App）完成某个动作后（例如办卡成功），可以调用
     window.LunaSystemMessages.push({...}) 写入一条系统通知；
     信息 App（messages.js）读取同一份列表，渲染进「系统」分组。

   存储：
     localStorage['luna_system_messages'] = JSON 数组，每项：
       { id, app, title, message, time, read }
     localStorage['luna_system_messages_update'] = 时间戳，
       供其他已打开的页面通过 storage 事件实时感知变化。

   用法示例（wallet.js 办卡成功后）：
     window.LunaSystemMessages.push({
       app: 'Wallet',
       title: '办卡成功',
       message: '你的新卡已添加到卡包，可前往「卡包」查看'
     });

   用法示例（messages.js 渲染系统分组）：
     const list = window.LunaSystemMessages.getAll();
     window.addEventListener('storage', e => {
       if (e.key === 'luna_system_messages_update') { ...重新渲染... }
     });
================================ */

(function () {
  if (window.LunaSystemMessages) return; // 避免重复注入

  const STORE_KEY  = 'luna_system_messages';
  const UPDATE_KEY = 'luna_system_messages_update';
  const MAX_KEEP   = 50; // 最多保留最近 50 条，避免 localStorage 无限增长

  function readList() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (e) {
      return [];
    }
  }

  function writeList(list) {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, MAX_KEEP)));
    localStorage.setItem(UPDATE_KEY, Date.now().toString());
  }

  window.LunaSystemMessages = {
    /* 写入一条系统消息，返回新写入的消息对象
       参数：{ app, title, message } */
    push(opts) {
      const { app = 'Luna', title = '', message = '' } = opts || {};
      const item = {
        id: 'sysmsg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        app,
        title,
        message,
        time: Date.now(),
        read: false
      };
      const list = readList();
      list.unshift(item);
      writeList(list);
      return item;
    },

    /* 获取全部系统消息（按时间倒序） */
    getAll() {
      return readList().sort((a, b) => (b.time || 0) - (a.time || 0));
    },

    /* 未读消息数量 */
    getUnreadCount() {
      return readList().filter(m => !m.read).length;
    },

    /* 将某条消息标记为已读 */
    markRead(id) {
      const list = readList();
      const target = list.find(m => m.id === id);
      if (!target || target.read) return false;
      target.read = true;
      writeList(list);
      return true;
    },

    /* 清空全部系统消息（预留：设置里若要提供“清空通知”功能可直接调用） */
    clearAll() {
      writeList([]);
    }
  };
})();
