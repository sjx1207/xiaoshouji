/* ==========================================================================
   chat-conversation.js
   单聊创建 · 现在只做一件事：

   从角色书选中角色 → 自动同步该角色为好友，归入内置的
   "全部好友 / ALL FRIENDS" 分类标签（与星标挚友/我的好友并列常驻）。

   不再创建任何会话、不再写入消息列表、不再打开聊天室 UI——
   聊天室页面还需要单独设计，暂不在本文件中实现，避免出现
   "半成品聊天界面"抢先上线。

   所有数据落盘于 chat.js 已建立的 LunaDB（IndexedDB 简易 KV 封装），
   与好友分组共用同一套持久化机制，刷新后不丢失。
========================================================================== */
(function () {
  'use strict';

  /* ==========================================================================
     创建单聊 · 现仅执行"同步为好友"，不建会话、不进聊天室
  ========================================================================== */
  function createSingleChat(character) {
    return syncFriendFromCharacter(character);
  }

  /* ==========================================================================
     好友同步：角色书里被选中创建单聊的角色，自动成为好友，
     归入"全部好友"分类标签（内置常驻分组，不需要用户手动创建）。
     若该角色已存在于其它分组（如"星标挚友"），不重复添加，
     只确保"全部好友"分组里也能看到（因为它承担"聚合视图"职责）。
  ========================================================================== */
  function syncFriendFromCharacter(character) {
    if (!window.LunaFriends) return Promise.resolve();

    var groups = window.LunaFriends.groups;
    var allGroup = null;
    groups.forEach(function (g) { if (g.id === '__all__') allGroup = g; });

    if (!allGroup) {
      allGroup = { id: '__all__', cn: '全部好友', en: 'ALL FRIENDS', collapsed: false, friends: [] };
      // "全部好友"作为聚合入口，置于分组列表最前，始终可见
      groups.unshift(allGroup);
    }

    var already = allGroup.friends.some(function (f) { return f.charId === character.id; });
    if (!already) {
      allGroup.friends.push({
        charId: character.id,
        name: character.name || '未命名角色',
        avatar: character.avatar || '',
        note: character.role || '来自角色书',
        online: true
      });
    } else {
      // 角色资料可能在角色书里被编辑过（改名/换头像），同步刷新
      allGroup.friends.forEach(function (f) {
        if (f.charId === character.id) {
          f.name = character.name || f.name;
          f.avatar = character.avatar || f.avatar;
          f.note = character.role || f.note;
        }
      });
    }

    window.LunaFriends.groups = groups;
    window.LunaFriends.save();
    return Promise.resolve();
  }

  /* ==========================================================================
     绑定"加好友"弹窗里的"单聊"卡片：点击后打开角色选择页
  ========================================================================== */
  function bindAddModalSingleTile() {
    var tile = document.querySelector('.add-tile[data-add="single"]');
    var addModal = document.getElementById('addModal');
    if (!tile) return;
    tile.addEventListener('click', function () {
      if (addModal) addModal.classList.remove('open');
      if (window.LunaCharPicker) window.LunaCharPicker.open();
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindAddModalSingleTile);
  } else {
    bindAddModalSingleTile();
  }

  window.LunaConversations = {
    createSingleChat: createSingleChat
  };
})();