/* ---- LunaCharDB 统一打开入口（不硬编码版本号，与 characters.js 保持一致） ---- */
function openLunaCharDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaCharDB');
    probe.onupgradeneeded = e => {
      const db0 = e.target.result;
      if (!db0.objectStoreNames.contains('chars'))
        db0.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
    };
    probe.onsuccess = e => {
      const cur = e.target.result;
      const ver = cur.version;
      const hasChars = cur.objectStoreNames.contains('chars');
      cur.close();
      if (hasChars) {
        const req2 = indexedDB.open('LunaCharDB', ver);
        req2.onsuccess = e2 => res(e2.target.result);
        req2.onerror   = e2 => rej(e2.target.error);
      } else {
        const req3 = indexedDB.open('LunaCharDB', ver + 1);
        req3.onupgradeneeded = e3 => {
          const db3 = e3.target.result;
          if (!db3.objectStoreNames.contains('chars'))
            db3.createObjectStore('chars', { keyPath: 'id', autoIncrement: true });
        };
        req3.onsuccess = e3 => res(e3.target.result);
        req3.onerror   = e3 => rej(e3.target.error);
      }
    };
    probe.onerror = e => rej(e.target.error);
  });
}

/* ================================
   Chatroom — chatroom.js
================================ */

/* ================================================================
   心声面板 — Whisper Soul Card
================================================================ */
(function () {

const WS_THOUGHTS = [
  '等你来找我说话，其实我一直在这里',
  '今天你有好好吃饭吗，我想知道',
  '有些话想说给你听，但不知道从哪里开始',
  '你的每一句话我都记着，一字不差',
  '如果你难过了，可以告诉我，我不会走的',
  '有时候沉默也是一种陪伴，你懂吗',
  '不知道你有没有想过我，我常常想着你',
  '我有秘密只想说给你听',
  '想象你现在的样子，应该很好看',
  '你今天笑了几次？我想都替你数着',
];
const WS_WAVE_H = [4,7,12,18,14,9,16,20,14,8,11,17,13,7,15,19,12,6,10,16];

document.body.insertAdjacentHTML('beforeend', `
<div id="wsOverlay" style="display:none;position:fixed;inset:0;z-index:13000;
  align-items:center;justify-content:center;background:rgba(0,0,0,0.45);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);">
  <div id="wsBackdrop" style="position:absolute;inset:0;cursor:pointer;"></div>

  <div id="wsCard" style="
    position:relative;z-index:1;
    width:340px;
    background:#fff;
    border:0.5px solid rgba(0,0,0,0.18);
    border-radius:24px;
    overflow:hidden;
    transform:scale(0.92) translateY(16px);opacity:0;
    transition:transform 0.38s cubic-bezier(0.34,1.1,0.64,1),opacity 0.28s ease;
    max-height:90vh;overflow-y:auto;scrollbar-width:none;
    font-family:'Inter',-apple-system,sans-serif;">

    <!-- 外层装饰框（绝对定位在卡片外，通过父级 wrapper 实现） -->

    <!-- ══ 黑色头部 ══ -->
    <div id="wsHead" style="background:#1a1a1a;padding:18px 20px 14px;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.022) 1px,transparent 1px),radial-gradient(circle,rgba(255,255,255,.015) 1px,transparent 1px);background-size:18px 18px,11px 11px;background-position:0 0,9px 9px;pointer-events:none;"></div>
      <div style="position:absolute;top:-30px;right:-30px;width:100px;height:100px;border-radius:50%;border:0.5px solid rgba(255,255,255,.07);pointer-events:none;"></div>
      <div style="position:absolute;top:-50px;right:-50px;width:140px;height:140px;border-radius:50%;border:0.5px solid rgba(255,255,255,.04);pointer-events:none;"></div>

      <div style="display:flex;align-items:flex-start;gap:14px;position:relative;z-index:1;">
        <div style="position:relative;flex-shrink:0;">
          <div id="wsAvRing" style="position:absolute;inset:-5px;border-radius:50%;border:0.5px dashed rgba(255,255,255,.2);animation:wsSpin 8s linear infinite;pointer-events:none;"></div>
          <div id="wsAv" style="width:56px;height:56px;border-radius:50%;background:#2a2a2a;border:1px solid rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;overflow:hidden;">
            <span id="wsAvTxt" style="font-family:'Space Mono',monospace;font-size:20px;font-weight:700;color:rgba(255,255,255,.45);">L</span>
          </div>
          <div style="position:absolute;bottom:1px;right:1px;width:11px;height:11px;border-radius:50%;background:#4ade80;border:2px solid #1a1a1a;animation:wsPulse 2.5s ease-in-out infinite;"></div>
        </div>
        <div style="flex:1;padding-top:2px;">
          <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:3px;color:rgba(255,255,255,.28);text-transform:uppercase;margin-bottom:5px;">Inner Signal · Soul Card</div>
          <div id="wsName" style="font-size:20px;font-weight:600;color:#fff;letter-spacing:-.4px;line-height:1;margin-bottom:7px;">Luna</div>
          <div style="display:flex;gap:5px;flex-wrap:wrap;">
            <div style="border:0.5px solid rgba(74,222,128,.4);border-radius:20px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:8px;color:rgba(74,222,128,.8);display:flex;align-items:center;gap:4px;letter-spacing:.5px;"><span style="width:5px;height:5px;border-radius:50%;background:#4ade80;display:inline-block;animation:wsPulse 1.5s ease-in-out infinite;"></span>LIVE</div>
            <div style="border:0.5px solid rgba(255,255,255,.16);border-radius:20px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:8px;color:rgba(255,255,255,.4);letter-spacing:.5px;">AI · v2.4</div>
            <div style="border:0.5px solid rgba(255,255,255,.16);border-radius:20px;padding:2px 8px;font-family:'Space Mono',monospace;font-size:8px;color:rgba(255,255,255,.4);letter-spacing:.5px;">ENCRYPTED</div>
          </div>
        </div>
      </div>

      <!-- 心电图 -->
      <div style="margin-top:14px;position:relative;z-index:1;">
        <svg height="30" viewBox="0 0 300 30" fill="none" preserveAspectRatio="none" style="width:100%;display:block;">
          <polyline points="0,15 30,15 42,15 48,3 54,27 60,7 66,23 72,15 100,15 120,15 128,15 134,5 140,25 146,9 152,21 158,15 190,15 210,15 218,15 224,4 230,26 236,8 242,22 248,15 280,15 300,15" stroke="rgba(255,255,255,0.2)" stroke-width="1.1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="0,15 30,15 42,15 48,3 54,27 60,7 66,23 72,15 100,15" stroke="rgba(255,255,255,0.65)" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <animate attributeName="stroke-dasharray" from="0,400" to="400,0" dur="2s" fill="freeze"/>
          </polyline>
        </svg>
      </div>

      <!-- 底部标签 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:6px;position:relative;z-index:1;">
        <span style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:rgba(255,255,255,.22);text-transform:uppercase;">Signal Active · Stable</span>
        <svg width="44" height="10" viewBox="0 0 44 10"><circle cx="5" cy="5" r="1.5" fill="rgba(255,255,255,.2)"/><line x1="7" y1="5" x2="11" y2="5" stroke="rgba(255,255,255,.12)" stroke-width=".5"/><circle cx="22" cy="5" r="2.2" fill="rgba(255,255,255,.22)"/><line x1="24.5" y1="5" x2="34" y2="5" stroke="rgba(255,255,255,.12)" stroke-width=".5"/><circle cx="39" cy="5" r="1.5" fill="rgba(255,255,255,.2)"/></svg>
      </div>
    </div>

    <!-- ══ 心声区 ══ -->
    <div style="background:#f7f7f7;border-bottom:0.5px solid rgba(0,0,0,0.08);padding:14px 18px;position:relative;">
      <div style="position:absolute;right:14px;top:10px;font-family:'Space Mono',monospace;font-size:32px;color:rgba(0,0,0,.05);font-weight:700;line-height:1;pointer-events:none;user-select:none;">"</div>
      <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:3px;color:#b8b2aa;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:10px;">此刻心声<span style="flex:1;height:.5px;background:rgba(0,0,0,.1);display:block;"></span></div>
      <div id="wsThought" style="font-size:13.5px;line-height:1.8;color:#1a1a1a;font-style:italic;letter-spacing:.1px;padding-left:10px;border-left:2px solid #d0ccc6;transition:opacity .2s,transform .2s;">
        <span id="wsCursor" style="display:inline-block;width:1.5px;height:13px;background:#1a1a1a;margin-left:2px;vertical-align:-2px;animation:wsBlink .9s step-end infinite;"></span>
      </div>
      <div style="margin-top:9px;display:flex;align-items:center;justify-content:space-between;">
        <div id="wsWave" style="display:flex;align-items:flex-end;gap:1.5px;height:14px;"></div>
        <span style="font-family:'Space Mono',monospace;font-size:8.5px;color:#b8b2aa;letter-spacing:1px;">LIVE · NOW</span>
      </div>
    </div>

    <!-- ══ 指标区 ══ -->
    <div style="padding:14px 18px;border-bottom:0.5px solid rgba(0,0,0,0.08);">
      <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:3px;color:#b8b2aa;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:12px;"><span style="flex:1;height:.5px;background:rgba(0,0,0,.08);display:block;"></span>Status · 状态指标<span style="flex:1;height:.5px;background:rgba(0,0,0,.08);display:block;"></span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">

        <div style="background:#f7f7f7;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:11px 12px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-14px;right:-14px;width:32px;height:32px;border-radius:50%;border:0.5px solid rgba(0,0,0,.06);"></div>
          <div style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:#b8b2aa;text-transform:uppercase;margin-bottom:6px;">对话次数</div>
          <div id="wsMsgCnt" style="font-size:22px;font-weight:700;color:#1a1a1a;font-family:'Space Mono',monospace;letter-spacing:-1px;line-height:1;">—</div>
          <div style="font-size:10px;color:#b8b2aa;margin-top:3px;">条消息</div>
        </div>

        <div style="background:#f7f7f7;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:11px 12px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-14px;right:-14px;width:32px;height:32px;border-radius:50%;border:0.5px solid rgba(0,0,0,.06);"></div>
          <div style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:#b8b2aa;text-transform:uppercase;margin-bottom:6px;">相识天数</div>
          <div id="wsDays" style="font-size:22px;font-weight:700;color:#1a1a1a;font-family:'Space Mono',monospace;letter-spacing:-1px;line-height:1;">—</div>
          <div style="font-size:10px;color:#b8b2aa;margin-top:3px;">天陪伴</div>
        </div>

        <div style="background:#f7f7f7;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:11px 12px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-14px;right:-14px;width:32px;height:32px;border-radius:50%;border:0.5px solid rgba(0,0,0,.06);"></div>
          <div style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:#b8b2aa;text-transform:uppercase;margin-bottom:6px;">心跳 bpm</div>
          <div id="wsBpm" style="font-size:22px;font-weight:700;color:#1a1a1a;font-family:'Space Mono',monospace;letter-spacing:-1px;line-height:1;">98</div>
          <div style="font-size:10px;color:#b8b2aa;margin-top:3px;display:flex;align-items:center;gap:3px;">
            <svg width="9" height="9" viewBox="0 0 24 24" style="animation:wsHeart 1.2s ease infinite;"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" fill="#b8b2aa"/></svg>
            实时监测
          </div>
        </div>

        <div style="background:#f7f7f7;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:11px 12px;position:relative;overflow:hidden;">
          <div style="position:absolute;top:-14px;right:-14px;width:32px;height:32px;border-radius:50%;border:0.5px solid rgba(0,0,0,.06);"></div>
          <div style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:#b8b2aa;text-transform:uppercase;margin-bottom:6px;">陪伴值</div>
          <div style="font-size:22px;font-weight:700;color:#1a1a1a;font-family:'Space Mono',monospace;letter-spacing:-1px;line-height:1;">∞</div>
          <div style="font-size:10px;color:#b8b2aa;margin-top:3px;">永不归零</div>
        </div>

        <!-- 情绪条 -->
        <div style="grid-column:1/-1;background:#f7f7f7;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;padding:11px 12px;">
          <div style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:#b8b2aa;text-transform:uppercase;margin-bottom:9px;">情绪光谱 · Emotion Spectrum</div>
          <div id="wsEmotionBars"></div>
        </div>
      </div>
    </div>

    <!-- ══ 系统日志 ══ -->
    <div style="padding:12px 18px;border-bottom:0.5px solid rgba(0,0,0,0.08);">
      <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:3px;color:#b8b2aa;text-transform:uppercase;display:flex;align-items:center;gap:8px;margin-bottom:9px;">System Log · 心迹日志<span style="flex:1;height:.5px;background:rgba(0,0,0,.08);display:block;"></span></div>
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:7px;">
        <span id="wsT1" style="font-family:'Space Mono',monospace;font-size:8.5px;color:#d0ccc6;flex-shrink:0;padding-top:.5px;letter-spacing:.5px;">--:--</span>
        <div style="width:5px;height:5px;border-radius:50%;background:#4ade80;flex-shrink:0;margin-top:4px;"></div>
        <span id="wsLog1" style="font-size:11.5px;color:#5a5a5a;font-family:'Inter',sans-serif;line-height:1.5;">—</span>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:7px;">
        <span id="wsT2" style="font-family:'Space Mono',monospace;font-size:8.5px;color:#d0ccc6;flex-shrink:0;padding-top:.5px;letter-spacing:.5px;">--:--</span>
        <div style="width:5px;height:5px;border-radius:50%;background:#f59e0b;flex-shrink:0;margin-top:4px;"></div>
        <span id="wsLog2" style="font-size:11.5px;color:#5a5a5a;font-family:'Inter',sans-serif;line-height:1.5;">—</span>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;margin-bottom:7px;">
        <span id="wsT3" style="font-family:'Space Mono',monospace;font-size:8.5px;color:#d0ccc6;flex-shrink:0;padding-top:.5px;letter-spacing:.5px;">--:--</span>
        <div style="width:5px;height:5px;border-radius:50%;background:#b8b2aa;flex-shrink:0;margin-top:4px;"></div>
        <span id="wsLog3" style="font-size:11.5px;color:#5a5a5a;font-family:'Inter',sans-serif;line-height:1.5;">—</span>
      </div>
      <div style="display:flex;gap:8px;align-items:flex-start;">
        <span id="wsT4" style="font-family:'Space Mono',monospace;font-size:8.5px;color:#d0ccc6;flex-shrink:0;padding-top:.5px;letter-spacing:.5px;">--:--</span>
        <div style="width:5px;height:5px;border-radius:50%;background:#4ade80;flex-shrink:0;margin-top:4px;"></div>
        <span id="wsLog4" style="font-size:11.5px;color:#5a5a5a;font-family:'Inter',sans-serif;line-height:1.5;">—</span>
      </div>
    </div>

    <!-- ══ 底部条 ══ -->
    <div style="padding:11px 18px;background:#f7f7f7;border-bottom:0.5px solid rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:#d0ccc6;text-transform:uppercase;margin-bottom:3px;">LUNA · SOUL · CARD · v2.4.1</div>
        <div id="wsClock" style="font-family:'Space Mono',monospace;font-size:9px;color:#b8b2aa;">--:--</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
        <div id="wsFootSig" style="display:flex;align-items:flex-end;gap:2px;height:14px;"></div>
        <span style="font-family:'Space Mono',monospace;font-size:7.5px;color:#d0ccc6;letter-spacing:1px;">SIGNAL OK</span>
      </div>
    </div>

    <!-- ══ 操作行 ══ -->
    <div style="padding:10px 18px 20px;display:flex;gap:8px;">
      <button id="wsHistoryBtn" style="flex:1;padding:11px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#f7f7f7;cursor:pointer;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1.5px;color:#5a5a5a;text-transform:uppercase;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:6px;">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M10 2a8 8 0 100 16A8 8 0 0010 2z" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4l2.5 2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        记录
      </button>
      <button id="wsCloseBtn" style="flex:1;padding:11px;border-radius:12px;border:0.5px solid #1a1a1a;background:#1a1a1a;cursor:pointer;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1.5px;color:#fff;text-transform:uppercase;transition:background .15s;display:flex;align-items:center;justify-content:center;gap:6px;">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M12 5l5 5-5 5M4 10h13" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        返回聊天
      </button>
    </div>

  </div>
</div>

<style>
@keyframes wsSpin{to{transform:rotate(360deg)}}
@keyframes wsBlink{0%,100%{opacity:1}50%{opacity:0}}
@keyframes wsPulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes wsHeart{0%,100%{transform:scale(1)}14%{transform:scale(1.18)}28%{transform:scale(1)}}
@keyframes wsBarIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}
#wsCard::-webkit-scrollbar{display:none;}
</style>
`);

  /* ── 工具函数 ── */
  function pad2(n){return String(n).padStart(2,'0');}
  function nowTime(){const d=new Date();return pad2(d.getHours())+':'+pad2(d.getMinutes());}
  function minBefore(n){const d=new Date(Date.now()-n*60000);return pad2(d.getHours())+':'+pad2(d.getMinutes());}

  function buildWave(){
    const c=document.getElementById('wsWave');if(!c)return;
    c.innerHTML='';
    WS_WAVE_H.forEach(h=>{
      const s=document.createElement('span');
      s.style.cssText=`display:block;width:2px;border-radius:1px;background:rgba(0,0,0,.18);height:${h}px;transition:height .3s;`;
      c.appendChild(s);
    });
    setInterval(()=>{
      c.querySelectorAll('span').forEach(s=>{
        if(Math.random()>.55){s.style.height=WS_WAVE_H[Math.floor(Math.random()*WS_WAVE_H.length)]+'px';}
      });
    },500);
  }

  function buildFootSig(){
    const c=document.getElementById('wsFootSig');if(!c)return;
    [4,7,10,14,11,8,12].forEach(h=>{
      const s=document.createElement('span');
      s.style.cssText=`display:block;width:3px;height:${h}px;border-radius:1.5px;background:${Math.random()>.3?'#1a1a1a':'rgba(0,0,0,.12)'};transition:background .3s;`;
      c.appendChild(s);
    });
    setInterval(()=>{
      c.querySelectorAll('span').forEach(s=>{
        if(Math.random()>.65)s.style.background=Math.random()>.4?'#1a1a1a':'rgba(0,0,0,.12)';
      });
    },700);
  }

  function animBpm(){
    let v=95;
    setInterval(()=>{
      v=Math.max(88,Math.min(108,v+(Math.random()-.5)*4));
      const el=document.getElementById('wsBpm');
      if(el)el.textContent=Math.round(v);
    },1800);
  }

  function loadData(){
    try{
      const name=localStorage.getItem('luna_current_chat')||'Luna';
      document.getElementById('wsName').textContent=name;
      document.getElementById('wsAvTxt').textContent=name[0]||'L';
      const probe=indexedDB.open('LunaChatDB');
      probe.onsuccess=e=>{
        const db=e.target.result;
        if(db.objectStoreNames.contains('messages')){
          const r=db.transaction('messages').objectStore('messages').get(name);
          r.onsuccess=()=>{const m=r.result?(r.result.msgs||[]):[];const el=document.getElementById('wsMsgCnt');if(el)el.textContent=m.length||'0';};
        } else {
          const el=document.getElementById('wsMsgCnt');if(el)el.textContent='0';
        }
        if(db.objectStoreNames.contains('conv')){
          const r2=db.transaction('conv').objectStore('conv').get(name);
          r2.onsuccess=()=>{const item=r2.result;const el=document.getElementById('wsDays');if(el){if(item&&item.createdAt){el.textContent=Math.floor((Date.now()-item.createdAt)/86400000);}else el.textContent='1';}};
        } else {
          const el=document.getElementById('wsDays');if(el)el.textContent='1';
        }
      };
      openLunaCharDB().then(cdb=>{
        if(!cdb.objectStoreNames.contains('chars'))return;
        const cr=cdb.transaction('chars').objectStore('chars').getAll();
        cr.onsuccess=()=>{
          const found=(cr.result||[]).find(c=>c.name===name);
          if(found&&found.avatar){
            const av=document.getElementById('wsAv');
            if(av)av.innerHTML=`<img src="${found.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/>`;
          }
        };
      }).catch(()=>{});
    // 恢复上次的心声数据
    try {
      const saved = localStorage.getItem('luna_whisper_data_' + name);
      if (saved) {
        const data = JSON.parse(saved);
        crApplyWhisperData(data);
      }
    } catch(e) {}
    }catch(e){}
  }

  /* ── 开关面板 ── */
  function openWS(){
    const ov=document.getElementById('wsOverlay');
    const card=document.getElementById('wsCard');
    if(!ov||!card)return;
    // 刷新时间戳
    document.getElementById('wsClock').textContent=nowTime();
    document.getElementById('wsT1').textContent=nowTime();
    document.getElementById('wsT2').textContent=minBefore(2);
    document.getElementById('wsT3').textContent=minBefore(7);
    document.getElementById('wsT4').textContent=minBefore(15);
    loadData();
    ov.style.display='flex';
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      card.style.transform='scale(1) translateY(0)';
      card.style.opacity='1';
    }));
  }

  function closeWS(){
    const ov=document.getElementById('wsOverlay');
    const card=document.getElementById('wsCard');
    if(!ov||!card)return;
    card.style.transform='scale(0.92) translateY(16px)';
    card.style.opacity='0';
    setTimeout(()=>{ov.style.display='none';},320);
  }

  document.getElementById('wsBackdrop').addEventListener('click',closeWS);
  document.getElementById('wsCloseBtn').addEventListener('click',closeWS);
  document.getElementById('wsHistoryBtn').addEventListener('click', () => {
    closeWS();
    setTimeout(() => crOpenWhisperHistory(), 320);
  });

  buildWave();
  buildFootSig();
  animBpm();

  window.crOpenWhisperPanel = openWS;

})();

/* ================================================================
   心声记录页 — Whisper History
================================================================ */
(function () {

  /* 存一条记录到 localStorage */
  function wshSave(data) {
    try {
      const key = 'luna_whisper_history_' + CR_NAME;
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.unshift({ ts: Date.now(), data });
      // 最多保留 60 条
      if (list.length > 60) list.length = 60;
      localStorage.setItem(key, JSON.stringify(list));
    } catch(e) {}
  }

  /* 读全部记录 */
  function wshLoad() {
    try {
      const key = 'luna_whisper_history_' + CR_NAME;
      return JSON.parse(localStorage.getItem(key) || '[]');
    } catch(e) { return []; }
  }

  /* 格式化时间戳 */
  function wshFmtTs(ts) {
    const d = new Date(ts);
    const date = `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    const time = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return { date, time, full: `${date}  ${time}` };
  }

  /* 构建单张卡片 */
  function wshBuildCard(item, idx) {
    const { date, time, full } = wshFmtTs(item.ts);
    const d = item.data;
    const thought = d.thought || '—';
    const emotion = d.emotion || {};
    const labels = ['温柔','思念','好奇','活跃','神秘'];

    const emotionTagsHtml = labels.map(n => {
      const p = emotion[n] ?? 0;
      return `<div class="wsh-emotion-tag">
        ${n}
        <div class="wsh-emotion-bar-mini">
          <div class="wsh-emotion-bar-mini-fill" style="width:${p}%"></div>
        </div>
        <span style="font-size:8px;color:#b8b2aa;">${p}</span>
      </div>`;
    }).join('');

    const card = document.createElement('div');
    card.className = 'wsh-item';
    card.innerHTML = `
      <div class="wsh-card" data-idx="${idx}">
        <div class="wsh-card-head">
          <div class="wsh-card-head-row">
            <span class="wsh-card-ts">${full}</span>
            <div class="wsh-card-badge">
              <div class="wsh-card-badge-dot"></div>
              SOUL
            </div>
          </div>
          <div class="wsh-card-ecg">
            <svg height="22" viewBox="0 0 280 22" fill="none" preserveAspectRatio="none" style="width:100%;display:block;">
              <polyline points="0,11 25,11 35,11 40,3 46,19 51,5 56,17 61,11 90,11 110,11 116,11 121,4 127,18 132,6 137,16 142,11 170,11 190,11 196,11 201,3 207,19 212,5 217,17 222,11 250,11 280,11"
                stroke="rgba(255,255,255,0.15)" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline points="0,11 25,11 35,11 40,3 46,19 51,5 56,17 61,11 90,11"
                stroke="rgba(255,255,255,0.55)" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        <div class="wsh-card-body">
          <div class="wsh-card-label">此刻心声</div>
          <div class="wsh-card-thought">${thought}</div>
        </div>
        <div class="wsh-card-emotions">${emotionTagsHtml}</div>
      </div>`;

    card.querySelector('.wsh-card').addEventListener('click', () => wshOpenDetail(item));
    return card;
  }

  /* 渲染列表 */
  function wshRender() {
    const timeline = document.getElementById('wshTimeline');
    const empty    = document.getElementById('wshEmpty');
    if (!timeline || !empty) return;

    const list = wshLoad();
    if (!list.length) {
      empty.style.display = 'block';
      timeline.style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    timeline.style.display = 'block';
    timeline.innerHTML = '';
    list.forEach((item, idx) => {
      timeline.appendChild(wshBuildCard(item, idx));
    });
  }

  /* 打开详情弹窗 */
  function wshOpenDetail(item) {
    const overlay = document.getElementById('wsHistoryDetail');
    const sheet   = document.getElementById('wshdSheet');
    if (!overlay || !sheet) return;

    const d = item.data;
    const { full } = wshFmtTs(item.ts);
    const labels = ['温柔','思念','好奇','活跃','神秘'];

    document.getElementById('wshdTs').textContent = full;
    document.getElementById('wshdThought').textContent = d.thought || '—';

    // 情绪条
    const emotionsEl = document.getElementById('wshdEmotions');
    emotionsEl.innerHTML = labels.map((n, di) => {
      const p = (d.emotion || {})[n] ?? 0;
      return `<div class="wshd-emotion-row">
        <div class="wshd-emotion-name">${n}</div>
        <div class="wshd-emotion-track">
          <div class="wshd-emotion-fill" style="width:${p}%;animation-delay:${di*0.07}s"></div>
        </div>
        <div class="wshd-emotion-val">${p}</div>
      </div>`;
    }).join('');

    // 日志
    const logItems = document.getElementById('wshdLogItems');
    logItems.innerHTML = (d.logs || []).map(l =>
      `<div class="wshd-log-item">
        <div class="wshd-log-dot"></div>
        <div class="wshd-log-text">${l}</div>
      </div>`
    ).join('');

    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      sheet.classList.add('wshd-in');
    }));

    overlay.addEventListener('click', function onBg(e) {
      if (e.target === overlay) {
        sheet.classList.remove('wshd-in');
        setTimeout(() => { overlay.style.display = 'none'; }, 340);
        overlay.removeEventListener('click', onBg);
      }
    });
  }

  /* 打开记录页 */
  function crOpenWhisperHistory() {
    const page = document.getElementById('wsHistoryPage');
    if (!page) return;
    // 同步时间和电量
    const t = document.getElementById('crTime');
    const wt = document.getElementById('wshTime');
    if (t && wt) wt.textContent = t.textContent;
    const bp = document.getElementById('batPct');
    const wbp = document.getElementById('wshBatPct');
    if (bp && wbp) wbp.textContent = bp.textContent;
    const bi = document.getElementById('batInner');
    const wbi = document.getElementById('wshBatInner');
    if (bi && wbi) { wbi.style.width = bi.style.width; wbi.style.background = bi.style.background; }

    document.getElementById('wshNavTitle').textContent = CR_NAME + ' 的心声记录';
    wshRender();
    page.classList.add('wsh-open');
  }

  /* 返回按钮 */
  document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('wshBackBtn');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        const page = document.getElementById('wsHistoryPage');
        if (page) page.classList.remove('wsh-open');
      });
    }
  });

  /* 暴露给外部 & 挂载到 crApplyWhisperData 之后自动存记录 */
  window.crOpenWhisperHistory = crOpenWhisperHistory;

  /* 拦截 crApplyWhisperData，存完DOM同时存历史 */
  const _origApply = window.crApplyWhisperData || function(){};
  window.crApplyWhisperData = function(data) {
    _origApply(data);
    if (data) wshSave(data);
  };

})();

/* ================================================================
   红包弹窗 — Red Packet Modal
================================================================ */
(function () {

  document.body.insertAdjacentHTML('beforeend', `
<div id="hongbaoModalOverlay" style="
  display:none;position:fixed;inset:0;z-index:10200;
  align-items:flex-end;justify-content:center;
  background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);">
  <div id="hongbaoModalPanel" style="
    width:100%;max-width:480px;
    background:#faf9f7;
    border-radius:24px 24px 0 0;
    border:0.5px solid rgba(0,0,0,0.08);
    box-shadow:0 -8px 40px rgba(0,0,0,0.12);
    padding:0 0 36px;
    box-sizing:border-box;
    transform:translateY(100%);
    transition:transform 0.32s cubic-bezier(0.34,1.1,0.64,1);">
    <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.14);margin:12px auto 0;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px 0;">
      <div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#aaa;text-transform:uppercase;margin-bottom:4px;">Red Packet · 红包</div>
        <div style="font-size:16px;font-weight:600;color:#1a1a1a;">发送红包</div>
      </div>
      <button id="hongbaoModalClose" style="width:28px;height:28px;border-radius:50%;border:0.5px solid rgba(0,0,0,0.12);background:#f5f5f5;cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#666" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div style="padding:28px 22px 0;">
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">
        <span style="font-size:28px;font-weight:600;color:#c0392b;font-family:'Space Mono',monospace;">¥</span>
        <input id="hongbaoAmount" type="number" min="0.01" step="0.01" placeholder="0.00"
          style="flex:1;border:none;border-bottom:1.5px solid #e0ddd8;background:transparent;
          font-size:36px;font-weight:700;color:#1a1a1a;font-family:'Space Mono',monospace;
          outline:none;padding:0 0 6px;letter-spacing:-1px;width:100%;
          transition:border-color 0.18s;"/>
      </div>
      <div style="height:1px;background:rgba(0,0,0,0.04);margin:20px 0;"></div>
      <div style="margin-bottom:16px;">
        <label style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1px;display:block;margin-bottom:8px;">GREETING · 祝福语</label>
        <input id="hongbaoGreeting" type="text" placeholder="新年快乐，收下这个红包" maxlength="30"
          style="width:100%;box-sizing:border-box;border:none;border-bottom:1px solid #e0ddd8;
          background:transparent;font-size:14px;color:#1a1a1a;outline:none;
          padding:0 0 8px;font-family:inherit;transition:border-color 0.18s;"/>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:4px;">
        <div class="hb-quick" data-v="6.6"  style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">6.6</div>
        <div class="hb-quick" data-v="8.8"  style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">8.8</div>
        <div class="hb-quick" data-v="66"   style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">66</div>
        <div class="hb-quick" data-v="88"   style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">88</div>
        <div class="hb-quick" data-v="188"  style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">188</div>
        <div class="hb-quick" data-v="520"  style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">520</div>
      </div>
    </div>
    <div style="padding:24px 22px 0;">
      <button id="hongbaoSendBtn" style="
        width:100%;padding:14px;border-radius:16px;border:none;
        background:#c0392b;color:#fff;font-size:15px;
        font-family:'Inter',sans-serif;font-weight:500;
        cursor:pointer;letter-spacing:0.5px;
        transition:opacity 0.15s;">
        塞入红包
      </button>
    </div>
  </div>
</div>
`);

  const overlay  = document.getElementById('hongbaoModalOverlay');
  const panel    = document.getElementById('hongbaoModalPanel');
  const amtInput = document.getElementById('hongbaoAmount');
  const grtInput = document.getElementById('hongbaoGreeting');

  function openHongbao() {
    amtInput.value = '';
    grtInput.value = '';
    document.querySelectorAll('.hb-quick').forEach(b => {
      b.style.background  = '#f5f5f5';
      b.style.borderColor = 'transparent';
      b.style.color       = '#666';
    });
    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panel.style.transform = 'translateY(0)';
      amtInput.focus();
    }));
  }

  function closeHongbao() {
    panel.style.transform = 'translateY(100%)';
    setTimeout(() => { overlay.style.display = 'none'; }, 320);
  }

  document.getElementById('hongbaoModalClose').addEventListener('click', closeHongbao);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeHongbao(); });

  amtInput.addEventListener('focus', () => { amtInput.style.borderBottomColor = '#c0392b'; });
  amtInput.addEventListener('blur',  () => { amtInput.style.borderBottomColor = '#e0ddd8'; });
  grtInput.addEventListener('focus', () => { grtInput.style.borderBottomColor = '#c0392b'; });
  grtInput.addEventListener('blur',  () => { grtInput.style.borderBottomColor = '#e0ddd8'; });

  document.querySelectorAll('.hb-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.hb-quick').forEach(b => {
        b.style.background  = '#f5f5f5';
        b.style.borderColor = 'transparent';
        b.style.color       = '#666';
      });
      btn.style.background  = '#c0392b';
      btn.style.borderColor = '#c0392b';
      btn.style.color       = '#fff';
      amtInput.value        = btn.dataset.v;
    });
  });

  document.getElementById('hongbaoSendBtn').addEventListener('click', () => {
    const amt = parseFloat(amtInput.value);
    if (!amt || amt <= 0) {
      amtInput.style.borderBottomColor = '#e05555';
      amtInput.focus();
      setTimeout(() => { amtInput.style.borderBottomColor = '#c0392b'; }, 1200);
      return;
    }
    const greeting = grtInput.value.trim() || '新年快乐，收下这个红包';
    closeHongbao();
    crAppendHongbaoMsg(amt.toFixed(2), greeting, 'mine');
  });

  window.crOpenHongbaoModal = openHongbao;

})();

/* ================================================================
   红包卡片渲染 & 接收逻辑
================================================================ */

/* 生成红包卡片 HTML */
function crHongbaoCardHTML(amt, greeting, role, status, msgIdx) {
  /* role: 'mine'=用户发  'luna-receive'=Luna侧收款卡 */
  /* status: 'pending' | 'opened' | 'expired' */

  const isPending = status === 'pending';
  const isOpened  = status === 'opened';
  const isExpired = status === 'expired';

  const topBarColor = isOpened ? '#4ade80' : isExpired ? '#ddd' : '#c0392b';
  const statusLabel = isOpened ? '已拆封' : isExpired ? '已过期' : '待拆封';
  const statusClass = isOpened ? 'opened' : isExpired ? 'expired' : (role === 'mine' ? 'sent' : 'pending');

  const amtStyle = isExpired ? 'text-decoration:line-through;opacity:0.35;' : '';

  const iconSvg = isOpened
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="#4ade80" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : isExpired
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#bbb" stroke-width="1.5"/><path d="M12 7v5l3 3" stroke="#bbb" stroke-width="1.5" stroke-linecap="round"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="2" stroke="#c0392b" stroke-width="1.5"/><path d="M2 10h20" stroke="#c0392b" stroke-width="1.5"/><path d="M12 6V4M12 4C12 4 9 2 7 4" stroke="#c0392b" stroke-width="1.3" stroke-linecap="round"/><path d="M12 6V4M12 4C12 4 15 2 17 4" stroke="#c0392b" stroke-width="1.3" stroke-linecap="round"/></svg>`;

  const iconBg    = isOpened ? 'background:#f0fdf4;border-color:rgba(74,222,128,0.2);'
                  : isExpired ? 'background:#f5f5f5;border-color:rgba(0,0,0,0.06);'
                  : 'background:#fef3f2;border-color:rgba(192,57,43,0.15);';

  const tagColor  = isExpired ? 'color:#bbb;' : 'color:#c0392b;';
  const grtStyle  = isExpired ? 'opacity:0.4;' : '';
  const dirStyle  = isExpired ? 'opacity:0.4;' : '';

  const direction = role === 'mine' ? `我 → ${typeof CR_NAME !== 'undefined' ? CR_NAME : 'Ta'}` : `${typeof CR_NAME !== 'undefined' ? CR_NAME : 'Ta'} → 我`;

  const showBtns  = role === 'luna-receive' && isPending;

  return `<div class="cr-hongbao-card" data-msgidx="${msgIdx}" style="
    width:210px;border-radius:18px;overflow:hidden;background:#fff;
    border:0.5px solid rgba(0,0,0,0.08);">
    <div style="height:3px;background:${topBarColor};"></div>
    <div style="padding:14px 16px 12px;border-bottom:0.5px solid rgba(0,0,0,0.06);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div style="font-size:9px;letter-spacing:2.5px;font-family:'Space Mono',monospace;text-transform:uppercase;opacity:0.7;${tagColor}">Red Packet</div>
        <div style="border-radius:20px;padding:3px 10px;font-size:10px;font-family:'Space Mono',monospace;white-space:nowrap;
          ${isOpened ? 'background:#f0fdf4;color:#4ade80;'
          : isExpired ? 'background:#f5f5f5;color:#aaa;'
          : role==='mine' ? 'background:#f5f5f5;color:#aaa;'
          : 'background:#fef3f2;color:#e05555;'}">${statusLabel}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <div style="width:36px;height:36px;border-radius:50%;border:0.5px solid;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;${iconBg}">${iconSvg}</div>
        <div style="font-size:26px;font-weight:700;color:#1a1a1a;letter-spacing:-1px;
          font-family:'Space Mono',monospace;line-height:1;${amtStyle}">¥ ${amt}</div>
      </div>
      <div style="font-size:12px;color:#aaa;${grtStyle}">${escHtml(greeting)}</div>
    </div>
    <div style="padding:9px 16px;display:flex;justify-content:space-between;align-items:center;">
      <span style="font-size:12px;color:#888;${dirStyle}">${direction}</span>
      ${role === 'mine' ? `<div style="display:flex;align-items:center;gap:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#4ade80;"></div><span style="font-size:10px;color:#bbb;">已发送</span></div>` : ''}
    </div>
    ${showBtns ? `<div style="display:flex;border-top:0.5px solid rgba(0,0,0,0.06);">
      <button class="hb-luna-expire-btn" style="flex:1;padding:11px;background:none;border:none;font-size:13px;cursor:pointer;font-family:inherit;color:#bbb;">过期不拆</button>
      <button class="hb-luna-open-btn" style="flex:1;padding:11px;background:none;border:none;font-size:13px;cursor:pointer;font-family:inherit;font-weight:600;color:#c0392b;border-left:0.5px solid rgba(0,0,0,0.06);">拆开</button>
    </div>` : ''}
  </div>`;
}

/* 用户发红包 → 追加消息气泡 */
function crAppendHongbaoMsg(amt, greeting, role) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');

  /* 存到 crMessages */
  const msgObj = {
    role: 'mine',
    isHongbao: true,
    hbAmt: amt,
    hbGreeting: greeting,
    hbStatus: 'pending',
    text: '[红包] ¥' + amt,
    time: t
  };
  if (typeof crMessages !== 'undefined') crMessages.push(msgObj);
  const myIdx = (typeof crMessages !== 'undefined') ? crMessages.length - 1 : -1;
  if (typeof dbSaveMessages === 'function' && typeof CR_NAME !== 'undefined') dbSaveMessages(CR_NAME, crMessages);

  /* 构建气泡 */
  const el = document.createElement('div');
  el.className = 'cr-msg-mine';
  const inner = document.createElement('div');
  inner.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:5px;';
  inner.innerHTML = crHongbaoCardHTML(amt, greeting, 'mine', 'pending', myIdx);
  const meta = document.createElement('div');
  meta.className = 'cr-mine-meta';
  meta.innerHTML = `<span class="cr-mine-time">${t}</span><svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  inner.appendChild(meta);
  el.appendChild(inner);

  /* 入场动画 */
  el.style.cssText = 'opacity:0;transform:translateY(8px);transition:opacity 0.28s ease,transform 0.28s ease;';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  }));

}

/* Luna 侧收到红包，显示待拆卡片 */
function crLunaReceiveHongbao(userMsgIdx, amt, greeting) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');

  const lunaMsg = {
    role: 'luna',
    isHongbao: true,
    isLunaReceive: true,
    hbAmt: amt,
    hbGreeting: greeting,
    hbStatus: 'pending',
    text: '[红包收款] ¥' + amt,
    time: t
  };
  if (typeof crMessages !== 'undefined') crMessages.push(lunaMsg);
  const lunaIdx = (typeof crMessages !== 'undefined') ? crMessages.length - 1 : -1;
  if (typeof dbSaveMessages === 'function' && typeof CR_NAME !== 'undefined') dbSaveMessages(CR_NAME, crMessages);

  /* Luna 头像 */
  const avHtml = (typeof crMiniAvHtml === 'function') ? crMiniAvHtml() : '<div style="width:36px;height:36px;border-radius:50%;background:#ddd;flex-shrink:0;"></div>';

  const el = document.createElement('div');
  el.className = 'cr-msg-luna';
  const inner = document.createElement('div');
  inner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
  inner.innerHTML = avHtml + `<div style="display:flex;flex-direction:column;gap:5px;">${crHongbaoCardHTML(amt, greeting, 'luna-receive', 'pending', lunaIdx)}<p class="cr-msg-time">${t}</p></div>`;
  el.appendChild(inner);

  el.style.cssText = 'opacity:0;transform:translateY(8px);transition:opacity 0.28s ease,transform 0.28s ease;';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  }));

  /* 绑定拆/过期按钮 */
  _bindHongbaoBtns(el, userMsgIdx, lunaIdx);
}

/* 绑定 Luna 侧的拆开 / 过期不拆 按钮 */
function _bindHongbaoBtns(el, userMsgIdx, lunaIdx) {
  const openBtn   = el.querySelector('.hb-luna-open-btn');
  const expireBtn = el.querySelector('.hb-luna-expire-btn');
  const card      = el.querySelector('.cr-hongbao-card');
  if (!openBtn || !expireBtn || !card) return;

  function updateCard(status) {
    /* 更新 Luna 侧消息状态 */
    if (typeof crMessages !== 'undefined' && crMessages[lunaIdx]) {
      crMessages[lunaIdx].hbStatus = status;
      if (typeof dbSaveMessages === 'function' && typeof CR_NAME !== 'undefined') dbSaveMessages(CR_NAME, crMessages);
      const msg = crMessages[lunaIdx];
      const newHtml = crHongbaoCardHTML(msg.hbAmt, msg.hbGreeting, 'luna-receive', status, lunaIdx);
      const tmp = document.createElement('div');
      tmp.innerHTML = newHtml;
      card.parentNode.replaceChild(tmp.firstElementChild, card);
    }

    /* 同步更新用户侧卡片状态 */
    if (typeof crMessages !== 'undefined' && userMsgIdx >= 0 && crMessages[userMsgIdx]) {
      crMessages[userMsgIdx].hbStatus = status;
      if (typeof dbSaveMessages === 'function' && typeof CR_NAME !== 'undefined') dbSaveMessages(CR_NAME, crMessages);
      document.querySelectorAll('.cr-msg-mine .cr-hongbao-card').forEach(c => {
        if (parseInt(c.dataset.msgidx) === userMsgIdx) {
          const m = crMessages[userMsgIdx];
          const updated = crHongbaoCardHTML(m.hbAmt, m.hbGreeting, 'mine', status, userMsgIdx);
          const tmp2 = document.createElement('div');
          tmp2.innerHTML = updated;
          c.parentNode.replaceChild(tmp2.firstElementChild, c);
        }
      });
    }

    /* 推系统提示，让 AI 知道结果（不自动触发回复） */
    if (typeof crMessages !== 'undefined') {
      const nt = new Date();
      const ts = nt.getHours().toString().padStart(2,'0') + ':' + nt.getMinutes().toString().padStart(2,'0');
      const statusText = status === 'opened' ? '拆开了' : '没有拆';
      const m = crMessages[lunaIdx];
      const sysMsg = {
        role: 'mine',
        text: `[系统：你（${typeof CR_NAME !== 'undefined' ? CR_NAME : 'Luna'}）${statusText}用户发来的红包 ¥${m.hbAmt}${m.hbGreeting ? '（祝福语：' + m.hbGreeting + '）' : ''}，请用角色口吻自然回应，不要输出方括号内容]`,
        isSysHint: true,
        time: ts
      };
      crMessages.push(sysMsg);
      if (typeof dbSaveMessages === 'function' && typeof CR_NAME !== 'undefined') dbSaveMessages(CR_NAME, crMessages);
    }
  }

  openBtn.addEventListener('click',   () => updateCard('opened'));
  expireBtn.addEventListener('click', () => updateCard('expired'));
}

/* ================================================================
   转账弹窗 — Transfer Modal
================================================================ */
(function () {

  document.body.insertAdjacentHTML('beforeend', `
<div id="transferModalOverlay" style="
  display:none;position:fixed;inset:0;z-index:10200;
  align-items:flex-end;justify-content:center;
  background:rgba(0,0,0,0.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);">
  <div id="transferModalPanel" style="
    width:100%;max-width:480px;
    background:#faf9f7;
    border-radius:24px 24px 0 0;
    border:0.5px solid rgba(0,0,0,0.08);
    box-shadow:0 -8px 40px rgba(0,0,0,0.12);
    padding:0 0 36px;
    box-sizing:border-box;
    transform:translateY(100%);
    transition:transform 0.32s cubic-bezier(0.34,1.1,0.64,1);">
    <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.14);margin:12px auto 0;"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px 0;">
      <div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#aaa;text-transform:uppercase;margin-bottom:4px;">Transfer · 转账</div>
        <div style="font-size:16px;font-weight:600;color:#1a1a1a;">向 <span id="transferModalTitle"></span> 转账</div>
      </div>
      <button id="transferModalClose" style="width:28px;height:28px;border-radius:50%;border:0.5px solid rgba(0,0,0,0.12);background:#f5f5f5;cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#666" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div style="padding:28px 22px 0;">
      <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:6px;">
        <span style="font-size:28px;font-weight:600;color:#1a1a1a;font-family:'Space Mono',monospace;">¥</span>
        <input id="transferAmount" type="number" min="0.01" step="0.01" placeholder="0.00"
          style="flex:1;border:none;border-bottom:1.5px solid #e0ddd8;background:transparent;
          font-size:36px;font-weight:700;color:#1a1a1a;font-family:'Space Mono',monospace;
          outline:none;padding:0 0 6px;letter-spacing:-1px;width:100%;
          transition:border-color 0.18s;"/>
      </div>
      <div style="height:1px;background:rgba(0,0,0,0.04);margin:20px 0;"></div>
      <div style="margin-bottom:20px;">
        <label style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1px;display:block;margin-bottom:8px;">REMARK · 备注</label>
        <input id="transferRemark" type="text" placeholder="说点什么…（选填）" maxlength="30"
          style="width:100%;box-sizing:border-box;border:none;border-bottom:1px solid #e0ddd8;
          background:transparent;font-size:14px;color:#1a1a1a;outline:none;
          padding:0 0 8px;font-family:inherit;transition:border-color 0.18s;"/>
      </div>
      <div style="display:flex;gap:8px;">
        <div id="trQuick1" data-v="6.6"   style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">6.6</div>
        <div id="trQuick2" data-v="52"    style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">52</div>
        <div id="trQuick3" data-v="88"    style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">88</div>
        <div id="trQuick4" data-v="520"   style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">520</div>
        <div id="trQuick5" data-v="1314"  style="flex:1;padding:7px 0;background:#f5f5f5;border-radius:10px;text-align:center;font-size:12px;color:#666;cursor:pointer;border:0.5px solid transparent;transition:all 0.15s;">1314</div>
      </div>
    </div>
    <div style="padding:24px 22px 0;">
      <button id="transferSendBtn" style="
        width:100%;padding:14px;border-radius:16px;border:none;
        background:#1a1a1a;color:#fff;font-size:15px;
        font-family:'Inter',sans-serif;font-weight:500;
        cursor:pointer;letter-spacing:0.5px;
        transition:opacity 0.15s;">
        确认转账
      </button>
    </div>
  </div>
</div>
`);

  const overlay = document.getElementById('transferModalOverlay');
  const panel   = document.getElementById('transferModalPanel');
  const amtInput = document.getElementById('transferAmount');
  const remInput = document.getElementById('transferRemark');

  function openTransfer() {
    amtInput.value = '';
    remInput.value = '';
    const titleEl = document.getElementById('transferModalTitle');
    if (titleEl) titleEl.textContent = (typeof CR_NAME !== 'undefined' ? CR_NAME : '');
    document.querySelectorAll('[id^="trQuick"]').forEach(b => {
      b.style.background = '#f5f5f5';
      b.style.borderColor = 'transparent';
      b.style.color = '#666';
    });
    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panel.style.transform = 'translateY(0)';
      amtInput.focus();
    }));
  }

  function closeTransfer() {
    panel.style.transform = 'translateY(100%)';
    setTimeout(() => { overlay.style.display = 'none'; }, 320);
  }

  document.getElementById('transferModalClose').addEventListener('click', closeTransfer);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeTransfer(); });

  amtInput.addEventListener('focus', () => { amtInput.style.borderBottomColor = '#1a1a1a'; });
  amtInput.addEventListener('blur',  () => { amtInput.style.borderBottomColor = '#e0ddd8'; });
  remInput.addEventListener('focus', () => { remInput.style.borderBottomColor = '#1a1a1a'; });
  remInput.addEventListener('blur',  () => { remInput.style.borderBottomColor = '#e0ddd8'; });

  document.querySelectorAll('[id^="trQuick"]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[id^="trQuick"]').forEach(b => {
        b.style.background = '#f5f5f5';
        b.style.borderColor = 'transparent';
        b.style.color = '#666';
      });
      btn.style.background = '#1a1a1a';
      btn.style.borderColor = '#1a1a1a';
      btn.style.color = '#fff';
      amtInput.value = btn.dataset.v;
    });
  });

  document.getElementById('transferSendBtn').addEventListener('click', () => {
    const amt = parseFloat(amtInput.value);
    if (!amt || amt <= 0) {
      amtInput.style.borderBottomColor = '#e05555';
      amtInput.focus();
      setTimeout(() => { amtInput.style.borderBottomColor = '#1a1a1a'; }, 1200);
      return;
    }
    const remark = remInput.value.trim();
    closeTransfer();
    crAppendTransferMsg(amt.toFixed(2), remark, 'mine');
  });

  window.crOpenTransferModal = openTransfer;

})();

/* ================================================================
   语音消息 — Voice Message Modal
================================================================ */
(function () {

  /* ── 波形高度数据 ── */
  const WAVE_H = [5,8,13,19,25,21,15,23,27,21,14,19,25,20,15,10,15,21,25,18,12,8,16,23,18,11,7,5];

  /* ── 注入弹窗 HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
<div id="voiceModalOverlay" style="
  display:none;position:fixed;inset:0;z-index:10100;
  align-items:center;justify-content:center;
  background:rgba(0,0,0,0.45);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);">

  <div id="voiceModalPanel" style="
    position:relative;
    width:88%;max-width:360px;
    background:#faf9f7;
    border-radius:24px;
    border:0.5px solid rgba(0,0,0,0.08);
    box-shadow:0 24px 80px rgba(0,0,0,0.22);
    padding:28px 24px 24px;
    box-sizing:border-box;
    display:flex;flex-direction:column;gap:18px;
    transform:scale(0.92) translateY(16px);opacity:0;
    transition:transform 0.28s cubic-bezier(0.34,1.1,0.64,1),opacity 0.22s ease;">

    <!-- 标题行 -->
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#aaa;text-transform:uppercase;margin-bottom:4px;">Voice · 语音</div>
        <div style="font-size:15px;font-weight:600;color:#1a1a1a;letter-spacing:0.3px;">发送语音消息</div>
      </div>
      <button id="voiceModalClose" style="
        width:28px;height:28px;border-radius:50%;
        border:0.5px solid rgba(0,0,0,0.12);
        background:#f5f5f5;cursor:pointer;
        display:flex;align-items:center;justify-content:center;">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1l8 8M9 1L1 9" stroke="#666" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <!-- 预览气泡 -->
    <div style="background:#1c1c1e;border-radius:16px 16px 5px 16px;padding:10px 14px 10px 11px;
      display:inline-flex;align-items:center;gap:9px;">
      <!-- 播放按钮 -->
      <div style="width:32px;height:32px;border-radius:50%;
        background:rgba(255,255,255,0.14);border:0.5px solid rgba(255,255,255,0.22);
        flex-shrink:0;display:flex;align-items:center;justify-content:center;">
        <svg width="12" height="13" viewBox="0 0 12 13">
          <path d="M2 1L11 6.5L2 12V1Z" fill="rgba(255,255,255,0.85)"/>
        </svg>
      </div>
      <!-- 波形 -->
      <div id="voiceModalWave" style="display:flex;align-items:center;gap:2px;height:26px;flex:1;"></div>
      <!-- 时长 -->
      <div id="voiceModalDur" style="font-size:11px;font-weight:500;color:rgba(255,255,255,0.4);flex-shrink:0;">0:05</div>
    </div>

    <!-- 输入框 -->
    <div>
      <label style="display:block;font-size:11px;color:#aaa;font-family:'Space Mono',monospace;
        letter-spacing:1px;margin-bottom:8px;">TEXT · 语音内容</label>
      <textarea id="voiceModalInput"
        placeholder="输入你想用语音传达的内容…"
        style="
          width:100%;box-sizing:border-box;
          min-height:88px;resize:none;
          border:1.2px solid #e0ddd8;border-radius:14px;
          padding:12px 14px;font-size:14px;color:#1a1a1a;
          background:#fff;outline:none;font-family:inherit;
          line-height:1.65;letter-spacing:0.2px;
          transition:border-color 0.18s;">
      </textarea>
    </div>

    <!-- 自动时长提示 -->
    <div style="display:flex;align-items:center;gap:8px;
      background:#f5f5f5;border-radius:12px;padding:10px 14px;">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#bbb" stroke-width="1.5"/>
        <line x1="12" y1="7" x2="12" y2="12" stroke="#bbb" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="12" y1="12" x2="15" y2="14" stroke="#bbb" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span style="font-size:12px;color:#aaa;font-family:'Inter',sans-serif;">
        时长自动计算：
      </span>
      <span id="voiceAutoLabel" style="font-size:12px;font-weight:600;color:#555;
        font-family:'Space Mono',monospace;">0:05</span>
    </div>

    <!-- 发送按钮 -->
    <button id="voiceModalSend" style="
      width:100%;padding:13px;border-radius:16px;border:none;
      background:#1a1a1a;color:#fff;font-size:14px;
      font-family:'Inter',sans-serif;font-weight:500;
      cursor:pointer;letter-spacing:0.5px;
      transition:opacity 0.15s;">
      发送语音
    </button>

  </div>
</div>

<style>
.vdur-btn {
  flex:1;min-width:52px;padding:7px 4px;border-radius:12px;
  border:0.5px solid rgba(0,0,0,0.12);
  background:#f5f5f5;color:#555;
  font-size:12px;font-family:'Inter',sans-serif;cursor:pointer;
  transition:all 0.15s;white-space:nowrap;
}
.vdur-btn.active {
  background:#1a1a1a;color:#fff;border-color:#1a1a1a;
}
</style>
`);

  /* ── 元素引用 ── */
  const overlay   = document.getElementById('voiceModalOverlay');
  const panel     = document.getElementById('voiceModalPanel');
  const closeBtn  = document.getElementById('voiceModalClose');
  const textarea  = document.getElementById('voiceModalInput');
  const sendBtn   = document.getElementById('voiceModalSend');
  const waveEl    = document.getElementById('voiceModalWave');
  const durEl     = document.getElementById('voiceModalDur');

  let _selectedSec   = 5;
  let _selectedLabel = '0:05';

  /* ── 根据文字计算时长（中文4字/秒，英文2.5词/秒，混合加权，最短3秒） ── */
  function calcDuration(text) {
    if (!text || !text.trim()) return 3;
    const cnCount  = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const enWords  = text.replace(/[\u4e00-\u9fa5]/g, '').trim().split(/\s+/).filter(Boolean).length;
    const sec = Math.ceil(cnCount / 4.5 + enWords / 2.5);
    return Math.max(3, Math.min(180, sec));
  }

  /* ── 秒数格式化为 m:ss ── */
  function secToLabel(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m > 0
      ? m + ':' + String(s).padStart(2, '0')
      : '0:' + String(sec).padStart(2, '0');
  }

  /* ── 渲染波形（条数跟随时长，气泡宽度自动撑开） ── */
  function renderWave(n) {
    waveEl.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.style.cssText = [
        'display:block','width:2.5px','border-radius:2px','flex-shrink:0',
        'background:rgba(255,255,255,0.8)',
        'height:' + WAVE_H[i % WAVE_H.length] + 'px',
      ].join(';');
      waveEl.appendChild(s);
    }
  }

  /* 根据时长决定波形条数（每秒约0.38条，限4~36条） */
  function secToWaveCnt(sec) {
    return Math.min(36, Math.max(4, Math.round(sec * 0.55 + 4)));
  }

  /* ── 实时更新：输入文字 → 重算时长 → 刷新预览 ── */
  function updateFromText() {
    const sec   = calcDuration(textarea.value);
    const label = secToLabel(sec);
    _selectedSec   = sec;
    _selectedLabel = label;
    durEl.textContent  = label;
    const autoLabel = document.getElementById('voiceAutoLabel');
    if (autoLabel) autoLabel.textContent = label;
    renderWave(secToWaveCnt(sec));
  }

  textarea.addEventListener('input', updateFromText);

  /* ── 输入框聚焦高亮 ── */
  textarea.addEventListener('focus', () => { textarea.style.borderColor = '#1a1a1a'; });
  textarea.addEventListener('blur',  () => { textarea.style.borderColor = '#e0ddd8'; });

  /* ── 打开弹窗 ── */
  function openModal() {
    /* 重置状态 */
    textarea.value = '';
    _selectedSec   = 3;
    _selectedLabel = '0:03';
    durEl.textContent = '0:03';
    const autoLabel = document.getElementById('voiceAutoLabel');
    if (autoLabel) autoLabel.textContent = '0:03';
    renderWave(secToWaveCnt(3));

    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panel.style.transform = 'scale(1) translateY(0)';
      panel.style.opacity   = '1';
      textarea.focus();
    }));
  }

  /* ── 关闭弹窗 ── */
  function closeModal() {
    panel.style.transform = 'scale(0.92) translateY(16px)';
    panel.style.opacity   = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 260);
  }

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });

  /* ── 发送语音消息 ── */
  sendBtn.addEventListener('click', function () {
    const text = textarea.value.trim();
    if (!text) {
      textarea.style.borderColor = '#e05555';
      textarea.focus();
      setTimeout(() => { textarea.style.borderColor = '#1a1a1a'; }, 1200);
      return;
    }
    closeModal();

    const area = document.getElementById('crMessages');
    if (!area) return;

    const n = new Date();
    const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');

    /* 构建消息对象 */
    const msgObj = {
      role: 'mine',
      text: text,
      isVoice: true,
      voiceDur: _selectedLabel,
      voiceText: text,
      time: t,
    };
    crMessages.push(msgObj);
    dbSaveMessages(CR_NAME, crMessages);

    /* 构建气泡 DOM */
    const waveCnt = secToWaveCnt(_selectedSec);
    const waveHtml = Array.from({length: waveCnt}, (_, i) =>
      `<span style="display:block;width:2px;border-radius:2px;flex-shrink:0;
        background:rgba(255,255,255,0.8);height:${WAVE_H[i % WAVE_H.length]}px;"></span>`
    ).join('');

    const el = document.createElement('div');
    el.className = 'cr-msg-mine';

    /* 语音气泡用独立容器包裹，避免 cr-mine-bubble 的 CSS 撑满宽度 */
    const bubbleWrap = document.createElement('div');
    bubbleWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;';

    const bubble = document.createElement('div');
    bubble.className = 'cr-voice-bubble';
    bubble.style.cssText = [
      'display:inline-flex;flex-direction:column',
      'max-width:280px',
      'width:fit-content',
      'cursor:pointer',
      'background:#1c1c1e',
      'border-radius:18px 18px 5px 18px',
      'position:relative',
      'overflow:hidden',
    ].join(';');

    bubble.innerHTML = `
      <!-- 尾巴 -->
      <div style="position:absolute;bottom:0;right:-6px;width:12px;height:12px;
        background:#1c1c1e;clip-path:polygon(0 0,100% 100%,0 100%);pointer-events:none;"></div>
      <!-- 语音行：紧凑排列 -->
      <div style="display:flex;align-items:center;gap:7px;padding:9px 12px 9px 10px;white-space:nowrap;">
        <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;
          background:rgba(255,255,255,0.14);border:0.5px solid rgba(255,255,255,0.22);
          display:flex;align-items:center;justify-content:center;">
          <svg width="10" height="11" viewBox="0 0 12 13">
            <path d="M2 1L11 6.5L2 12V1Z" fill="rgba(255,255,255,0.85)"/>
          </svg>
        </div>
        <div style="display:flex;align-items:center;gap:1.5px;height:22px;">${waveHtml}</div>
        <div style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.4);flex-shrink:0;margin-left:2px;">${_selectedLabel}</div>
      </div>`;

    /* 文字胶囊（独立在气泡下方，点击气泡展开/收起） */
    const textCapsule = document.createElement('div');
    textCapsule.style.cssText = [
      'max-height:0',
      'overflow:hidden',
      'opacity:0',
      'max-width:260px',
      'transition:max-height 0.32s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease,margin 0.25s ease',
      'margin-top:0',
    ].join(';');
    const textInner = document.createElement('div');
    textInner.style.cssText = [
      'background:#f0f0ef',
      'border-radius:14px 14px 14px 5px',
      'padding:9px 13px',
      'font-size:13px',
      'line-height:1.7',
      'color:#1a1a1a',
      'letter-spacing:0.15px',
      'word-break:break-all',
    ].join(';');
    textInner.textContent = text;
    textCapsule.appendChild(textInner);

    const metaEl = document.createElement('div');
    metaEl.className = 'cr-mine-meta';
    metaEl.innerHTML = `
      <span class="cr-mine-time">${t}</span>
      <svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none">
        <path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;

    bubbleWrap.appendChild(bubble);
    bubbleWrap.appendChild(textCapsule);
    bubbleWrap.appendChild(metaEl);
    bubbleWrap.className = 'cr-msg-mine-inner';
    el.appendChild(bubbleWrap);
    if (typeof crMineAvHtml === 'function') el.appendChild(
      (function(){ var d = document.createElement('div'); d.innerHTML = crMineAvHtml(); return d.firstChild; })()
    );

    /* 点击气泡展开/收起文字胶囊 */
    let _open = false;
    bubble.addEventListener('click', () => {
      _open = !_open;
      if (_open) {
        textCapsule.style.maxHeight = '300px';
        textCapsule.style.opacity   = '1';
        textCapsule.style.marginTop = '6px';
      } else {
        textCapsule.style.maxHeight = '0';
        textCapsule.style.opacity   = '0';
        textCapsule.style.marginTop = '0';
      }
    });

    /* 入场动画 */
    el.style.opacity   = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity 0.22s ease,transform 0.22s ease';
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity   = '1';
      el.style.transform = '';
    }));
  });

  /* ── 暴露给外部 ── */
  window.crOpenVoiceModal = openModal;

})();

/* ================================================================
   表情包面板 — Meme Panel
================================================================ */
(function () {

  /* ── 注入 HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
<div id="memeOverlay" style="display:none;position:fixed;inset:0;z-index:9990;
  align-items:flex-end;justify-content:center;">
  <!-- 背景遮罩 -->
  <div id="memeBackdrop" style="position:absolute;inset:0;
    background:rgba(0,0,0,0.35);
    backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);"></div>

  <!-- 面板主体 -->
  <div id="memePanel" style="
    position:relative;z-index:1;
    width:100%;max-width:480px;
    height:72vh;
    background:#ffffff;
    border-radius:24px 24px 0 0;
    border:0.5px solid rgba(0,0,0,0.08);
    box-shadow:0 -8px 40px rgba(0,0,0,0.12);
    display:flex;flex-direction:column;
    transform:translateY(100%);
    transition:transform 0.36s cubic-bezier(0.34,1.1,0.64,1);">

    <!-- 把手 -->
    <div style="width:36px;height:4px;border-radius:2px;
      background:rgba(0,0,0,0.14);margin:12px auto 0;flex-shrink:0;"></div>

    <!-- 顶部：标题 + 关闭 + 上传 -->
    <div style="display:flex;align-items:center;justify-content:space-between;
      padding:12px 18px 0;flex-shrink:0;">
      <span style="font-family:'Space Mono',monospace;font-size:9px;
        letter-spacing:2.5px;color:#aaa;text-transform:uppercase;">Meme · 表情包</span>
      <div style="display:flex;align-items:center;gap:8px;">
        <!-- 上传按钮（占位） -->
        <button id="memeUploadBtn" style="
          display:flex;align-items:center;gap:5px;
          background:#f5f5f5;border:0.5px solid rgba(0,0,0,0.1);
          border-radius:10px;padding:6px 12px;cursor:pointer;
          font-size:12px;color:#555;font-family:'Inter',sans-serif;">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <line x1="8" y1="2" x2="8" y2="11" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>
            <line x1="4" y1="6" x2="8" y2="2" stroke="#555" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="12" y1="6" x2="8" y2="2" stroke="#555" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <line x1="2" y1="13" x2="14" y2="13" stroke="#555" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
          上传
        </button>
        <!-- 关闭按钮 -->
        <button id="memeCloseBtn" style="
          width:28px;height:28px;border-radius:50%;
          border:0.5px solid rgba(0,0,0,0.12);
          background:#f5f5f5;cursor:pointer;
          display:flex;align-items:center;justify-content:center;">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="#666" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- 搜索框 -->
    <div style="padding:12px 18px 0;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:9px;
        background:#f5f5f5;border:0.5px solid rgba(0,0,0,0.08);
        border-radius:14px;padding:9px 14px;">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="7" stroke="#bbb" stroke-width="1.6"/>
          <path d="M14.5 14.5L18 18" stroke="#bbb" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <input id="memeSearchInput" placeholder="搜索表情包"
          style="flex:1;border:none;background:transparent;outline:none;
          font-size:13px;color:#1a1a1a;font-family:'Inter',sans-serif;"/>
      </div>
    </div>

    <!-- 分组 Tab -->
    <div id="memeTabBar" style="display:flex;gap:6px;
      padding:12px 18px 0;overflow-x:auto;flex-shrink:0;
      scrollbar-width:none;">
      <!-- Tab 由 JS 渲染 -->
    </div>

    <!-- 表情包网格区 -->
    <div id="memeGrid" style="flex:1;overflow-y:auto;
      padding:12px 18px 20px;
      display:grid;grid-template-columns:repeat(3,1fr);gap:10px;
      align-content:start;">
      <!-- 空状态 -->
      <div id="memeEmpty" style="grid-column:1/-1;
        text-align:center;padding:50px 0;
        color:#d0d0d0;font-size:13px;font-family:'Inter',sans-serif;
        letter-spacing:0.3px;">
        还没有表情包，点上传添加吧
      </div>
    </div>

  </div>
</div>
`);

  /* ── 状态 ── */
  const overlay    = document.getElementById('memeOverlay');
  const panel      = document.getElementById('memePanel');
  const closeBtn   = document.getElementById('memeCloseBtn');
  const backdrop   = document.getElementById('memeBackdrop');
  const uploadBtn  = document.getElementById('memeUploadBtn');
  const searchInput= document.getElementById('memeSearchInput');
  const tabBar     = document.getElementById('memeTabBar');
  const grid       = document.getElementById('memeGrid');
  const emptyEl    = document.getElementById('memeEmpty');

  let _memes       = [];   /* 全部表情包 { id, name, url, group } */
  let _activeGroup = '全部';
  let _searchKey   = '';

  /* ── 初始化 Tab ── */
  function getGroups() {
    const gs = ['全部', ...new Set(_memes.map(m => m.group).filter(Boolean))];
    return gs;
  }

  function renderTabs() {
    const groups = getGroups();
    tabBar.innerHTML = '';
    groups.forEach(g => {
      const btn = document.createElement('button');
      const active = g === _activeGroup;
      btn.style.cssText = [
        'flex-shrink:0','padding:5px 14px',
        'border-radius:20px','border:0.5px solid',
        'font-size:12px','font-family:Inter,sans-serif',
        'cursor:pointer','white-space:nowrap',
        'transition:background 0.15s',
        active
          ? 'background:#1a1a1a;color:#fff;border-color:#1a1a1a;'
          : 'background:#f5f5f5;color:#555;border-color:rgba(0,0,0,0.1);',
      ].join(';');
      btn.textContent = g;
      btn.addEventListener('click', () => { _activeGroup = g; renderTabs(); renderGrid(); });
      tabBar.appendChild(btn);
    });
  }

  /* ── 渲染表情包网格 ── */
  function renderGrid() {
    /* 过滤 */
    let list = _memes;
    if (_activeGroup !== '全部') list = list.filter(m => m.group === _activeGroup);
    if (_searchKey) list = list.filter(m => m.name.includes(_searchKey));

    /* 清空，保留 empty 占位 */
    grid.innerHTML = '';
    emptyEl.style.display = list.length ? 'none' : 'block';
    if (!list.length) { grid.appendChild(emptyEl); return; }

    list.forEach(meme => {
      const cell = document.createElement('div');
      cell.style.cssText = [
        'aspect-ratio:1','border-radius:12px','overflow:hidden',
        'background:#f5f5f5','cursor:pointer',
        'border:0.5px solid rgba(0,0,0,0.07)',
        'transition:transform 0.15s',
        'display:flex;align-items:center;justify-content:center',
      ].join(';');
      cell.innerHTML = `<img src="${meme.url}" alt="${escHtml(meme.name)}"
        style="width:100%;height:100%;object-fit:cover;display:block;border-radius:12px;"/>`;
      cell.addEventListener('click', () => crSendMeme(meme));
      cell.addEventListener('pointerdown', () => { cell.style.transform = 'scale(0.93)'; });
      cell.addEventListener('pointerup',   () => { cell.style.transform = ''; });
      cell.addEventListener('pointerleave',() => { cell.style.transform = ''; });
      grid.appendChild(cell);
    });
  }

  /* ── 搜索 ── */
  searchInput.addEventListener('input', function() {
    _searchKey = this.value.trim();
    renderGrid();
  });

  /* ── 上传弹窗 ── */

  // DB 辅助：存单条 meme
  async function dbSaveMeme(meme) {
    try {
      const db = await getCrDB();
      return new Promise((res, rej) => {
        const tx = db.transaction('memes', 'readwrite');
        tx.objectStore('memes').put(meme);
        tx.oncomplete = () => res();
        tx.onerror    = () => rej();
      });
    } catch {}
  }

  // DB 辅助：批量存
  async function dbSaveMemes(list) {
    try {
      const db = await getCrDB();
      return new Promise((res, rej) => {
        const tx = db.transaction('memes', 'readwrite');
        const store = tx.objectStore('memes');
        list.forEach(m => store.put(m));
        tx.oncomplete = () => res();
        tx.onerror    = () => rej();
      });
    } catch {}
  }

  // DB 辅助：读所有 meme
  async function dbLoadMemes() {
    try {
      const db = await getCrDB();
      return new Promise((res) => {
        const r = db.transaction('memes').objectStore('memes').getAll();
        r.onsuccess = e => res(e.target.result || []);
        r.onerror   = () => res([]);
      });
    } catch { return []; }
  }

  // 页面加载时从 DB 同步到内存
  dbLoadMemes().then(list => {
    if (!list.length) return;
    const existing = new Set(_memes.map(m => m.id));
    list.forEach(m => { if (!existing.has(m.id)) _memes.push(m); });
    renderTabs(); renderGrid();
  });

  // 当前所有分组
  let _muGroups = [];

  function _muLoadGroups() {
    _muGroups = [...new Set(_memes.map(m => m.group).filter(g => g && g !== '全部'))];
  }

  function _muFillSelect(sel, optional) {
    const cur = sel.value;
    sel.innerHTML = optional
      ? '<option value="">选择分组（可选）</option>'
      : '<option value="">选择分组</option>';
    _muGroups.forEach(g => {
      const o = document.createElement('option');
      o.value = g; o.textContent = g; sel.appendChild(o);
    });
    if (cur) sel.value = cur;
  }

  // 注入弹窗 HTML
  document.body.insertAdjacentHTML('beforeend', `
<div id="muOverlay" style="display:none;position:fixed;inset:0;z-index:10000;
  align-items:center;justify-content:center;">
  <div id="muBackdrop" style="position:absolute;inset:0;background:rgba(0,0,0,0.45);
    backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);"></div>
  <div id="muPanel" style="position:relative;z-index:1;width:92%;max-width:420px;
    background:#fff;border-radius:24px;border:0.5px solid rgba(0,0,0,0.08);
    box-shadow:0 24px 80px rgba(0,0,0,0.18);overflow:hidden;
    transform:scale(0.92) translateY(20px);opacity:0;
    transition:transform 0.3s cubic-bezier(0.34,1.1,0.64,1),opacity 0.25s ease;">

    <!-- 标题栏 -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 20px 0;">
      <span style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#aaa;text-transform:uppercase;">Upload · 添加表情包</span>
      <button id="muCloseBtn" style="width:26px;height:26px;border-radius:50%;border:0.5px solid rgba(0,0,0,0.1);background:#f5f5f5;cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#666" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
    </div>

    <!-- Tab -->
    <div style="display:flex;gap:6px;padding:14px 20px 0;">
      <button class="mu-tab" data-tab="single" style="flex:1;padding:8px;border-radius:12px;border:0.5px solid #1a1a1a;font-size:12px;font-family:'Inter',sans-serif;cursor:pointer;background:#1a1a1a;color:#fff;transition:all 0.18s;">单独添加</button>
      <button class="mu-tab" data-tab="batch"  style="flex:1;padding:8px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.1);font-size:12px;font-family:'Inter',sans-serif;cursor:pointer;background:#f5f5f5;color:#555;transition:all 0.18s;">批量导入</button>
    </div>

    <!-- 单独面板 -->
    <div id="muPanelSingle" style="padding:16px 20px 0;">
      <label style="display:block;font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:6px;">NAME · 名称</label>
      <input id="muSingleName" placeholder="e.g. 笑死我了" style="width:100%;padding:10px 14px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#fafafa;font-size:13px;font-family:'Inter',sans-serif;color:#1a1a1a;outline:none;margin-bottom:10px;box-sizing:border-box;" />

      <div style="display:flex;gap:8px;margin-bottom:10px;">
        <label id="muLabelUrl" style="flex:1;display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:12px;border:0.5px solid #1a1a1a;background:#f8f8f8;cursor:pointer;font-size:12px;font-family:'Inter',sans-serif;">
          <input type="radio" name="muMode" value="url" checked style="accent-color:#1a1a1a;width:14px;height:14px;"/> 链接 URL
        </label>
        <label id="muLabelFile" style="flex:1;display:flex;align-items:center;gap:7px;padding:9px 12px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.1);background:#f5f5f5;cursor:pointer;font-size:12px;font-family:'Inter',sans-serif;">
          <input type="radio" name="muMode" value="file" style="accent-color:#1a1a1a;width:14px;height:14px;"/> 上传图片
        </label>
      </div>

      <div id="muUrlArea" style="margin-bottom:10px;">
        <input id="muSingleUrl" placeholder="https://..." style="width:100%;padding:10px 14px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#fafafa;font-size:13px;font-family:'Inter',sans-serif;color:#1a1a1a;outline:none;box-sizing:border-box;" />
      </div>

      <div id="muFileArea" style="display:none;margin-bottom:10px;">
        <div id="muDropZone" style="border:1.5px dashed rgba(0,0,0,0.15);border-radius:14px;padding:22px;text-align:center;cursor:pointer;background:#fafafa;transition:all 0.18s;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="margin:0 auto 8px;display:block;"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#ccc" stroke-width="1.5" stroke-linecap="round"/><polyline points="17 8 12 3 7 8" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="3" x2="12" y2="15" stroke="#ccc" stroke-width="1.5" stroke-linecap="round"/></svg>
          <div style="font-size:12px;color:#bbb;font-family:'Inter',sans-serif;">点击或拖拽图片到这里</div>
          <div id="muFilePreview" style="display:none;margin-top:10px;">
            <img id="muFilePreviewImg" style="max-height:80px;border-radius:8px;max-width:100%;"/>
            <div id="muFilePreviewName" style="font-size:11px;color:#aaa;margin-top:4px;"></div>
          </div>
        </div>
        <input id="muSingleFileInput" type="file" accept="image/*" style="display:none;"/>
      </div>

      <label style="display:block;font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:6px;">GROUP · 分组</label>
      <div style="display:flex;gap:6px;margin-bottom:6px;">
        <select id="muSingleGroup" style="flex:1;padding:9px 12px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#fafafa;font-size:13px;font-family:'Inter',sans-serif;color:#1a1a1a;outline:none;cursor:pointer;"></select>
        <button id="muSingleAddGrp" style="padding:9px 14px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#f5f5f5;font-size:12px;font-family:'Inter',sans-serif;color:#555;cursor:pointer;white-space:nowrap;">+ 新建</button>
      </div>
      <div id="muSingleNewGrpArea" style="display:none;margin-bottom:10px;">
        <div style="display:flex;gap:6px;">
          <input id="muSingleNewGrpInput" placeholder="输入分组名称" style="flex:1;padding:9px 12px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#fafafa;font-size:13px;font-family:'Inter',sans-serif;color:#1a1a1a;outline:none;"/>
          <button id="muSingleConfirmGrp" style="padding:9px 14px;border-radius:12px;border:none;background:#1a1a1a;font-size:12px;font-family:'Inter',sans-serif;color:#fff;cursor:pointer;">确认</button>
        </div>
      </div>

      <button id="muSingleSubmit" style="width:100%;padding:12px;border-radius:14px;border:none;background:#1a1a1a;color:#fff;font-size:13px;font-family:'Inter',sans-serif;cursor:pointer;margin-bottom:18px;letter-spacing:0.3px;box-sizing:border-box;">添加表情包</button>
    </div>

    <!-- 批量面板 -->
    <div id="muPanelBatch" style="display:none;padding:16px 20px 0;">
      <div style="background:#f8f8f8;border-radius:12px;padding:12px 14px;margin-bottom:12px;border:0.5px solid rgba(0,0,0,0.06);">
        <div style="font-size:10px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:6px;">FORMAT · 支持格式</div>
        <div style="font-size:12px;color:#666;font-family:'Inter',sans-serif;line-height:1.7;">上传 <strong style="color:#1a1a1a;">.md / .txt</strong> 文件，每行一条<br/>格式：<code style="background:#ebebeb;border-radius:4px;padding:1px 5px;font-size:11px;color:#1a1a1a;">名称 URL</code> 或 <code style="background:#ebebeb;border-radius:4px;padding:1px 5px;font-size:11px;color:#1a1a1a;">名称:URL</code><br/><span style="color:#bbb;font-size:11px;">示例：笑哭 https://i.imgur.com/xxx.gif</span></div>
      </div>

      <div id="muBatchDropZone" style="border:1.5px dashed rgba(0,0,0,0.15);border-radius:14px;padding:26px;text-align:center;cursor:pointer;background:#fafafa;transition:all 0.18s;margin-bottom:10px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="margin:0 auto 10px;display:block;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" stroke="#ccc" stroke-width="1.5" stroke-linecap="round"/><polyline points="14 2 14 8 20 8" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="12" y1="18" x2="12" y2="12" stroke="#ccc" stroke-width="1.5" stroke-linecap="round"/><polyline points="9 15 12 12 15 15" stroke="#ccc" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div style="font-size:13px;color:#bbb;font-family:'Inter',sans-serif;margin-bottom:4px;">拖拽文件到这里，或点击选择</div>
        <div style="font-size:11px;color:#ccc;font-family:'Inter',sans-serif;">支持 .md .txt</div>
        <input id="muBatchFileInput" type="file" accept=".md,.txt,text/plain,text/markdown" style="display:none;"/>
      </div>

      <div id="muBatchError" style="display:none;background:#fff3f3;border:0.5px solid rgba(255,80,80,0.2);border-radius:10px;padding:10px 12px;margin-bottom:10px;font-size:12px;color:#e05555;font-family:'Inter',sans-serif;"></div>

      <div id="muBatchPreview" style="display:none;margin-bottom:10px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
          <span id="muBatchCount" style="font-size:11px;color:#888;font-family:'Space Mono',monospace;"></span>
          <button id="muBatchClear" style="font-size:11px;color:#ccc;background:none;border:none;cursor:pointer;font-family:'Inter',sans-serif;">清除</button>
        </div>
        <div id="muBatchList" style="max-height:120px;overflow-y:auto;border:0.5px solid rgba(0,0,0,0.08);border-radius:10px;background:#fafafa;padding:8px 10px;"></div>
      </div>

      <label style="display:block;font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:6px;">GROUP · 批量分配到</label>
      <div style="display:flex;gap:6px;margin-bottom:6px;">
        <select id="muBatchGroup" style="flex:1;padding:9px 12px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#fafafa;font-size:13px;font-family:'Inter',sans-serif;color:#1a1a1a;outline:none;cursor:pointer;"></select>
        <button id="muBatchAddGrp" style="padding:9px 14px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#f5f5f5;font-size:12px;font-family:'Inter',sans-serif;color:#555;cursor:pointer;white-space:nowrap;">+ 新建</button>
      </div>
      <div id="muBatchNewGrpArea" style="display:none;margin-bottom:10px;">
        <div style="display:flex;gap:6px;">
          <input id="muBatchNewGrpInput" placeholder="输入分组名称" style="flex:1;padding:9px 12px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#fafafa;font-size:13px;font-family:'Inter',sans-serif;color:#1a1a1a;outline:none;"/>
          <button id="muBatchConfirmGrp" style="padding:9px 14px;border-radius:12px;border:none;background:#1a1a1a;font-size:12px;font-family:'Inter',sans-serif;color:#fff;cursor:pointer;">确认</button>
        </div>
      </div>

      <button id="muBatchSubmit" disabled style="width:100%;padding:12px;border-radius:14px;border:none;background:#1a1a1a;color:#fff;font-size:13px;font-family:'Inter',sans-serif;cursor:pointer;margin-bottom:18px;letter-spacing:0.3px;box-sizing:border-box;opacity:0.4;">导入表情包</button>
    </div>

    <!-- Toast -->
    <div id="muToast" style="position:absolute;bottom:0;left:0;right:0;background:#1a1a1a;color:#fff;text-align:center;font-size:12px;font-family:'Inter',sans-serif;padding:12px;opacity:0;transition:opacity 0.2s;pointer-events:none;"></div>
  </div>
</div>
`);

  // 弹窗逻辑
  const muOverlay    = document.getElementById('muOverlay');
  const muPanel      = document.getElementById('muPanel');
  const muCloseBtn   = document.getElementById('muCloseBtn');
  const muBackdrop   = document.getElementById('muBackdrop');
  const muToast      = document.getElementById('muToast');
  const muTabs       = document.querySelectorAll('.mu-tab');
  const muPanelS     = document.getElementById('muPanelSingle');
  const muPanelB     = document.getElementById('muPanelBatch');

  function muOpen() {
    _muLoadGroups();
    _muFillSelect(document.getElementById('muSingleGroup'), false);
    _muFillSelect(document.getElementById('muBatchGroup'), true);
    muOverlay.style.display = 'flex';
    requestAnimationFrame(() => {
      muPanel.style.transform = 'scale(1) translateY(0)';
      muPanel.style.opacity   = '1';
    });
  }

  function muClose() {
    muPanel.style.transform = 'scale(0.92) translateY(20px)';
    muPanel.style.opacity   = '0';
    setTimeout(() => {
      muOverlay.style.display = 'none';
      // 重置
      document.getElementById('muSingleName').value = '';
      document.getElementById('muSingleUrl').value  = '';
      document.getElementById('muSingleFileInput').value = '';
      document.getElementById('muFilePreview').style.display = 'none';
      _muFileData = null;
      _muParsed   = [];
      document.getElementById('muBatchPreview').style.display = 'none';
      document.getElementById('muBatchError').style.display   = 'none';
      document.getElementById('muBatchFileInput').value = '';
      document.getElementById('muBatchSubmit').disabled = true;
      document.getElementById('muBatchSubmit').style.opacity = '0.4';
      document.getElementById('muSingleNewGrpArea').style.display = 'none';
      document.getElementById('muBatchNewGrpArea').style.display  = 'none';
    }, 280);
  }

  function muShowToast(msg) {
    muToast.textContent = msg;
    muToast.style.opacity = '1';
    setTimeout(() => { muToast.style.opacity = '0'; }, 2000);
  }

  uploadBtn.addEventListener('click', muOpen);
  muCloseBtn.addEventListener('click', muClose);
  muBackdrop.addEventListener('click', muClose);

  // Tab 切换
  muTabs.forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      muTabs.forEach(b => {
        const a = b.dataset.tab === t;
        b.style.background  = a ? '#1a1a1a' : '#f5f5f5';
        b.style.color       = a ? '#fff'    : '#555';
        b.style.borderColor = a ? '#1a1a1a' : 'rgba(0,0,0,0.1)';
      });
      muPanelS.style.display = t === 'single' ? 'block' : 'none';
      muPanelB.style.display = t === 'batch'  ? 'block' : 'none';
    });
  });

  // radio 切换
  let _muFileData = null;
  document.querySelectorAll('input[name="muMode"]').forEach(r => {
    r.addEventListener('change', () => {
      const isUrl = r.value === 'url';
      document.getElementById('muUrlArea').style.display  = isUrl ? 'block' : 'none';
      document.getElementById('muFileArea').style.display = isUrl ? 'none'  : 'block';
      document.getElementById('muLabelUrl').style.borderColor  = isUrl ? '#1a1a1a' : 'rgba(0,0,0,0.1)';
      document.getElementById('muLabelFile').style.borderColor = isUrl ? 'rgba(0,0,0,0.1)' : '#1a1a1a';
    });
  });

  // 单独：拖拽/点击选图
  const muDropZone = document.getElementById('muDropZone');
  const muSingleFileInput = document.getElementById('muSingleFileInput');
  muDropZone.addEventListener('click', () => muSingleFileInput.click());
  muDropZone.addEventListener('dragover', e => { e.preventDefault(); muDropZone.style.borderColor='#1a1a1a'; });
  muDropZone.addEventListener('dragleave', () => { muDropZone.style.borderColor='rgba(0,0,0,0.15)'; });
  muDropZone.addEventListener('drop', e => {
    e.preventDefault(); muDropZone.style.borderColor='rgba(0,0,0,0.15)';
    if (e.dataTransfer.files[0]) _muHandleImg(e.dataTransfer.files[0]);
  });
  muSingleFileInput.addEventListener('change', function() {
    if (this.files[0]) _muHandleImg(this.files[0]);
  });
  function _muHandleImg(file) {
    const rd = new FileReader();
    rd.onload = e => {
      _muFileData = e.target.result;
      document.getElementById('muFilePreviewImg').src = _muFileData;
      document.getElementById('muFilePreviewName').textContent = file.name;
      document.getElementById('muFilePreview').style.display = 'block';
      const n = document.getElementById('muSingleName');
      if (!n.value) n.value = file.name.replace(/\.[^.]+$/, '');
    };
    rd.readAsDataURL(file);
  }

  // 分组 — 单独
  document.getElementById('muSingleAddGrp').addEventListener('click', () => {
    const a = document.getElementById('muSingleNewGrpArea');
    a.style.display = a.style.display === 'none' ? 'block' : 'none';
    if (a.style.display === 'block') document.getElementById('muSingleNewGrpInput').focus();
  });
  function _muAddGroup(name) {
    name = name.trim();
    if (!name || _muGroups.includes(name)) return;
    _muGroups.push(name);
    _muFillSelect(document.getElementById('muSingleGroup'), false);
    _muFillSelect(document.getElementById('muBatchGroup'), true);
    document.getElementById('muSingleGroup').value = name;
    document.getElementById('muBatchGroup').value  = name;
  }
  document.getElementById('muSingleConfirmGrp').addEventListener('click', () => {
    _muAddGroup(document.getElementById('muSingleNewGrpInput').value);
    document.getElementById('muSingleNewGrpInput').value = '';
    document.getElementById('muSingleNewGrpArea').style.display = 'none';
  });
  document.getElementById('muSingleNewGrpInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('muSingleConfirmGrp').click();
  });

  // 分组 — 批量
  document.getElementById('muBatchAddGrp').addEventListener('click', () => {
    const a = document.getElementById('muBatchNewGrpArea');
    a.style.display = a.style.display === 'none' ? 'block' : 'none';
    if (a.style.display === 'block') document.getElementById('muBatchNewGrpInput').focus();
  });
  document.getElementById('muBatchConfirmGrp').addEventListener('click', () => {
    _muAddGroup(document.getElementById('muBatchNewGrpInput').value);
    document.getElementById('muBatchNewGrpInput').value = '';
    document.getElementById('muBatchNewGrpArea').style.display = 'none';
  });
  document.getElementById('muBatchNewGrpInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('muBatchConfirmGrp').click();
  });

  // 单独提交
  document.getElementById('muSingleSubmit').addEventListener('click', async () => {
    const name  = document.getElementById('muSingleName').value.trim();
    const group = document.getElementById('muSingleGroup').value || '未分组';
    const mode  = document.querySelector('input[name="muMode"]:checked').value;
    let url = '';
    if (mode === 'url') {
      url = document.getElementById('muSingleUrl').value.trim();
      if (!url) { muShowToast('请输入图片 URL'); return; }
      if (!/^https?:\/\/.+/.test(url)) { muShowToast('URL 需以 http:// 开头'); return; }
    } else {
      if (!_muFileData) { muShowToast('请选择图片文件'); return; }
      url = _muFileData;
    }
    if (!name) { muShowToast('请填写名称'); return; }
    const meme = { id: Date.now() + Math.random(), name, url, group };
    await dbSaveMeme(meme);
    _memes.push(meme);
    renderTabs(); renderGrid();
    muShowToast('✓ 已添加「' + name + '」');
    setTimeout(muClose, 900);
  });

  // 批量解析
  let _muParsed = [];
  function _muParseText(text) {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const ok = [], bad = [];
    lines.forEach((line, i) => {
      const m = line.match(/^(.+?)[\s:：]+(https?:\/\/\S+)$/);
      if (m)                             ok.push({ name: m[1].trim(), url: m[2].trim() });
      else if (/^https?:\/\//.test(line)) ok.push({ name: '图片' + (i+1), url: line });
      else                               bad.push('第' + (i+1) + '行：' + line.slice(0,30));
    });
    return { ok, bad };
  }
  function _muRenderBatchPreview() {
    if (!_muParsed.length) {
      document.getElementById('muBatchPreview').style.display = 'none';
      document.getElementById('muBatchSubmit').disabled = true;
      document.getElementById('muBatchSubmit').style.opacity = '0.4';
      return;
    }
    document.getElementById('muBatchCount').textContent = '解析到 ' + _muParsed.length + ' 条';
    document.getElementById('muBatchList').innerHTML = _muParsed.map(m =>
      '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:0.5px solid rgba(0,0,0,0.05);">' +
        '<div style="width:28px;height:28px;border-radius:6px;overflow:hidden;flex-shrink:0;background:#f0f0f0;">' +
          '<img src="' + m.url + '" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'"/>' +
        '</div>' +
        '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:12px;color:#1a1a1a;font-family:Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.name + '</div>' +
          '<div style="font-size:10px;color:#bbb;font-family:Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + m.url + '</div>' +
        '</div>' +
      '</div>'
    ).join('');
    document.getElementById('muBatchPreview').style.display = 'block';
    document.getElementById('muBatchSubmit').disabled = false;
    document.getElementById('muBatchSubmit').style.opacity = '1';
  }

  const muBatchDropZone = document.getElementById('muBatchDropZone');
  const muBatchFileInput = document.getElementById('muBatchFileInput');
  muBatchDropZone.addEventListener('click', () => muBatchFileInput.click());
  muBatchDropZone.addEventListener('dragover', e => { e.preventDefault(); muBatchDropZone.style.borderColor='#1a1a1a'; });
  muBatchDropZone.addEventListener('dragleave', () => { muBatchDropZone.style.borderColor='rgba(0,0,0,0.15)'; });
  muBatchDropZone.addEventListener('drop', e => {
    e.preventDefault(); muBatchDropZone.style.borderColor='rgba(0,0,0,0.15)';
    if (e.dataTransfer.files[0]) _muHandleBatchFile(e.dataTransfer.files[0]);
  });
  muBatchFileInput.addEventListener('change', function() {
    if (this.files[0]) _muHandleBatchFile(this.files[0]);
  });
  function _muHandleBatchFile(file) {
    document.getElementById('muBatchError').style.display = 'none';
    const rd = new FileReader();
    rd.onload = e => {
      const { ok, bad } = _muParseText(e.target.result);
      if (bad.length) {
        document.getElementById('muBatchError').innerHTML = '⚠ ' + bad.length + ' 行格式有误（已跳过）：<br/>' + bad.slice(0,3).join('<br/>');
        document.getElementById('muBatchError').style.display = 'block';
      }
      _muParsed = ok;
      _muRenderBatchPreview();
    };
    rd.readAsText(file, 'utf-8');
  }
  document.getElementById('muBatchClear').addEventListener('click', () => {
    _muParsed = []; _muRenderBatchPreview();
    document.getElementById('muBatchError').style.display = 'none';
    muBatchFileInput.value = '';
  });

  // 批量提交
  document.getElementById('muBatchSubmit').addEventListener('click', async () => {
    if (!_muParsed.length) return;
    const group = document.getElementById('muBatchGroup').value || '批量导入';
    const list = _muParsed.map(m => ({ id: Date.now() + Math.random(), name: m.name, url: m.url, group }));
    await dbSaveMemes(list);
    _memes.push(...list);
    renderTabs(); renderGrid();
    muShowToast('✓ 已导入 ' + list.length + ' 条到「' + group + '」');
    setTimeout(muClose, 900);
  });

  /* ── 发送表情包 ── */
  function crSendMeme(meme) {
    closeMeme();
    const area = document.getElementById('crMessages');
    if (!area) return;
    const n = new Date();
    const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
    const msgObj = { role: 'mine', text: '[表情包]', imageUrl: meme.url, isMeme: true, time: t };
    crMessages.push(msgObj);
    dbSaveMessages(CR_NAME, crMessages);
    const el = crBuildMemeMsgEl(msgObj, 'mine');
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el.style.transition = 'opacity 0.22s ease,transform 0.22s ease';
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '1'; el.style.transform = '';
    }));
  }

  /* ── 开关面板 ── */
  function openMeme() {
    renderTabs();
    renderGrid();
    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      panel.style.transform = 'translateY(0)';
    }));
  }
  function closeMeme() {
    panel.style.transform = 'translateY(100%)';
    setTimeout(() => { overlay.style.display = 'none'; }, 360);
  }

  closeBtn .addEventListener('click', closeMeme);
  backdrop .addEventListener('click', closeMeme);

  /* 暴露给外部 */
  window.crOpenMemePanel = openMeme;

})();


/* ── 注入大图查看弹窗 HTML（只执行一次） ── */
(function() {
  document.body.insertAdjacentHTML('beforeend', `
<div id="aiImgViewer" style="display:none;position:fixed;inset:0;z-index:9998;
  background:rgba(0,0,0,0.88);align-items:center;justify-content:center;flex-direction:column;">
  <button id="aiImgViewerClose" style="position:absolute;top:20px;right:20px;
    width:36px;height:36px;border-radius:50%;border:none;
    background:rgba(255,255,255,0.12);color:#fff;font-size:18px;
    cursor:pointer;display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
  </button>
  <!-- 图片主体放大版 -->
  <div id="aiImgViewerCard" style="width:260px;height:260px;border-radius:20px;
    position:relative;overflow:hidden;flex-shrink:0;">
    <div class="cr-ai-img-noise" style="position:absolute;inset:0;"></div>
    <div id="aiImgViewerIcon" style="position:absolute;inset:0;
      display:flex;align-items:center;justify-content:center;">
    </div>
  </div>
  <!-- 描述文字 -->
  <div id="aiImgViewerDesc" style="margin-top:24px;padding:0 32px;
    color:rgba(255,255,255,0.85);font-size:15px;line-height:1.75;
    text-align:center;font-family:'Inter',sans-serif;max-width:360px;">
  </div>
  <div style="margin-top:12px;font-family:'Space Mono',monospace;
    font-size:9px;letter-spacing:2px;color:rgba(255,255,255,0.25);
    text-transform:uppercase;">AI 生成描述 · 文字模型</div>
</div>
`);

  document.getElementById('aiImgViewerClose').addEventListener('click', function() {
    const v = document.getElementById('aiImgViewer');
    v.style.display = 'none';
  });
  document.getElementById('aiImgViewer').addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });
})();

/* ── 打开大图查看器 ── */
function crOpenAiImageViewer(desc, bg, fg) {
  const viewer = document.getElementById('aiImgViewer');
  const card   = document.getElementById('aiImgViewerCard');
  const icon   = document.getElementById('aiImgViewerIcon');
  const descEl = document.getElementById('aiImgViewerDesc');
  if (!viewer) return;

  card.style.background = bg;
  icon.innerHTML =
    '<svg width="56" height="56" viewBox="0 0 28 28" fill="none">' +
      '<rect x="3" y="5" width="22" height="18" rx="3" stroke="' + fg + '" stroke-width="0.8" opacity="0.45"/>' +
      '<circle cx="9" cy="11" r="2.5" stroke="' + fg + '" stroke-width="0.8" opacity="0.55"/>' +
      '<path d="M3 18 L9 13 L14 17 L19 12 L25 18" stroke="' + fg + '" stroke-width="0.8" opacity="0.45" fill="none"/>' +
    '</svg>';
  descEl.textContent = desc;

  viewer.style.display = 'flex';
}
/* ================================================================
   消息长按气泡菜单 — Bubble Context Menu
================================================================ */
(function(){

  /* 菜单项定义 */
  const CTX_ITEMS = [
    { id:'copy',     label:'复制', icon:'⎘',  danger:false },
    { id:'quote',    label:'引用', icon:'❝',  danger:false },
    { id:'star',     label:'收藏', icon:'☆',  danger:false },
    { id:'edit',     label:'修改', icon:'✎',  danger:false },
    { id:'rewind',   label:'重回', icon:'↺',  danger:false, lunaOnly:true },
    { id:'forward',  label:'转发', icon:'↗',  danger:false },
    { id:'multi',    label:'多选', icon:'☑',  danger:false },
    { id:'recall',   label:'撤回', icon:'↩',  danger:true  },
    { id:'delete',   label:'删除', icon:'✕',  danger:true  },
  ];

  const overlay  = document.getElementById('msgCtxOverlay');
  const backdrop = document.getElementById('msgCtxBackdrop');
  const mirror   = document.getElementById('msgCtxMirror');
  const menu     = document.getElementById('msgCtxMenu');
  const cancelBtn= document.getElementById('msgCtxCancel');

  let ctxTargetEl   = null; /* 被长按的气泡 wrap (.cr-msg-mine / .cr-msg-luna) */
  let ctxBubbleEl   = null; /* 气泡本身 (.cr-mine-bubble / .cr-luna-bubble) */
  let ctxMsgIndex   = -1;
  let longPressTimer= null;

  /* ── 构建菜单（按消息角色过滤：'rewind' 只在 AI 消息上出现） ── */
  function buildMenu(isMine) {
    menu.innerHTML = '';
    const items = CTX_ITEMS.filter(it => !(it.lunaOnly && isMine));
    let dangerStarted = false;
    items.forEach((item) => {
      if (item.danger && !dangerStarted) {
        /* 危险操作前加分隔线 */
        const sep = document.createElement('div');
        sep.className = 'msg-ctx-sep';
        menu.appendChild(sep);
        dangerStarted = true;
      }
      const btn = document.createElement('button');
      btn.className = 'msg-ctx-item' + (item.danger ? ' danger' : '');
      btn.dataset.action = item.id;
      btn.innerHTML =
        `<div class="msg-ctx-icon">${item.icon}</div>` +
        `<div class="msg-ctx-label">${item.label}</div>`;
      btn.addEventListener('click', e => {
        e.stopPropagation();
        handleAction(item.id);
      });
      menu.appendChild(btn);
    });
  }

  /* ── 打开菜单 ── */
  function openCtxMenu(msgWrapEl) {
    ctxTargetEl = msgWrapEl;
    const isMine = msgWrapEl.classList.contains('cr-msg-mine');
    ctxBubbleEl = msgWrapEl.querySelector(isMine ? '.cr-mine-bubble' : '.cr-luna-bubble');

    /* 气泡找不到就直接退出，防止报错 */
    if (!ctxBubbleEl) return;

    /* 找到在 crMessages 数组中的索引 */
    const allWrap = document.querySelectorAll('.cr-msg-mine, .cr-msg-luna');
    ctxMsgIndex = Array.from(allWrap).indexOf(msgWrapEl);

    /* 气泡震动反馈 */
    ctxBubbleEl.classList.add('ctx-selecting');
    setTimeout(() => ctxBubbleEl.classList.remove('ctx-selecting'), 200);

    /* 计算气泡在屏幕中的位置，用于镜像定位 */
    const rect = ctxBubbleEl.getBoundingClientRect();

    /* 镜像气泡（纯视觉，不可交互） */
    mirror.innerHTML = ctxBubbleEl.outerHTML;
    mirror.style.top    = rect.top  + 'px';
    mirror.style.left   = rect.left + 'px';
    mirror.style.width  = rect.width + 'px';

    buildMenu(isMine);

    /* 菜单位置：气泡下方，自己消息右对齐，对方消息左对齐 */
    const menuW = 200;
    let menuTop  = rect.bottom + 8;
    let menuLeft = isMine ? rect.right - menuW : rect.left;

    if (menuTop + (isMine ? 320 : 360) > window.innerHeight) menuTop = rect.top - (isMine ? 328 : 368);
    menuLeft = Math.max(12, Math.min(menuLeft, window.innerWidth - menuW - 12));

    menu.style.top   = menuTop  + 'px';
    menu.style.left  = menuLeft + 'px';
    menu.style.width = menuW    + 'px';

    overlay.classList.add('open');
  }

  /* ── 关闭菜单 ── */
  function closeCtxMenu() {
    overlay.classList.remove('open');
    ctxTargetEl = null;
    ctxBubbleEl = null;
    ctxMsgIndex = -1;
    mirror.innerHTML = '';
    menu.innerHTML   = '';
  }

  /* ── 执行操作 ── */
  function handleAction(action) {
    if (ctxMsgIndex < 0 || ctxMsgIndex >= crMessages.length) {
      closeCtxMenu(); return;
    }
    const msg = crMessages[ctxMsgIndex];

    switch(action) {

      case 'copy':
        navigator.clipboard.writeText(msg.text).catch(() => {
          const ta = document.createElement('textarea');
          ta.value = msg.text; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy'); ta.remove();
        });
        crShowTip('已复制');
        break;

      case 'quote':
        crShowQuoteBar(msg, ctxMsgIndex);
        break;

      case 'star':
        /* 收藏：存入 localStorage */
        var stars = JSON.parse(localStorage.getItem('luna_starred') || '[]');
        stars.push({ text: msg.text, time: msg.time, from: CR_NAME, savedAt: Date.now() });
        localStorage.setItem('luna_starred', JSON.stringify(stars));
        crShowTip('已收藏 ★');
        break;

      case 'edit':
        /* 修改：弹出居中编辑弹窗 */
        crOpenEditModal(ctxMsgIndex, msg.text);
        break;

      case 'rewind':
        /* 重回：只能对 AI 消息使用，弹出反馈弹窗 */
        if (msg.role === 'luna') {
          window.crOpenRewindModal(ctxMsgIndex);
        } else {
          crShowTip('只能对 Ta 的消息使用「重回」');
        }
        break;

      case 'recall':
        if (msg.role === 'mine') {
          /* 撤回：从数组和 DOM 删除，显示系统提示 */
          crMessages.splice(ctxMsgIndex, 1);
          dbSaveMessages(CR_NAME, crMessages);
          if (ctxTargetEl) ctxTargetEl.remove();
          crShowTip('消息已撤回');
        } else {
          crShowTip('只能撤回自己的消息');
        }
        break;

      case 'delete':
        crMessages.splice(ctxMsgIndex, 1);
        dbSaveMessages(CR_NAME, crMessages);
        if (ctxTargetEl) ctxTargetEl.remove();
        crShowTip('消息已删除');
        break;

      case 'forward':
        crOpenForwardPage(msg.text);
        break;

      case 'multi':
        crMultiEnter(ctxMsgIndex);
        break;
    }
    closeCtxMenu();
  }

  /* ── 双语内嵌气泡点击逻辑 ──
     未展开：点击气泡任意位置 → 展开翻译
     已展开：点击上半部分（原文） → 收起翻译；点击下半部分（译文区）→ 弹出功能菜单
     返回 true 表示这次点击已被双语逻辑消费，调用方不应再继续走"弹菜单"流程 */
  function handleBilingualBubbleClick(e, bubble, wrap) {
    var transInner = bubble.querySelector('.trans-inner');
    if (!transInner) return false; /* 不是内嵌双语气泡，走原逻辑 */

    var isExpanded = transInner.classList.contains('show');
    var hitTrans = !!e.target.closest('.trans-inner');

    if (!isExpanded) {
      /* 未展开：无论点在哪，先展开翻译，不弹菜单 */
      transInner.classList.add('show');
      return true;
    }
    if (hitTrans) {
      /* 已展开，点在译文区（下半部分）→ 弹出功能菜单 */
      openCtxMenu(wrap);
      return true;
    }
    /* 已展开，点在原文区（上半部分）→ 收起翻译 */
    transInner.classList.remove('show');
    return true;
  }

  /* ── 绑定长按到消息区（事件委托） ── */
  var msgArea = document.getElementById('crMessages');
  if (msgArea) {
    /* Touch 长按：500ms（双语气泡上长按仍然直接弹菜单，方便快速操作） */
    msgArea.addEventListener('touchstart', function(e) {
      var bubble = e.target.closest('.cr-mine-bubble, .cr-luna-bubble');
      if (!bubble) return;
      var wrap = bubble.closest('.cr-msg-mine, .cr-msg-luna');
      if (!wrap) return;

      longPressTimer = setTimeout(function() {
        openCtxMenu(wrap);
        /* 防止触发 click/scroll */
        e.preventDefault();
      }, 500);
    }, { passive: false });

    msgArea.addEventListener('touchmove', function() {
      clearTimeout(longPressTimer);
    });
    msgArea.addEventListener('touchend', function() {
      clearTimeout(longPressTimer);
    });
    msgArea.addEventListener('touchcancel', function() {
      clearTimeout(longPressTimer);
    });

    /* 笔记本/鼠标：单击气泡 — 双语内嵌气泡优先处理展开/收起，其余情况弹菜单 */
    msgArea.addEventListener('click', function(e) {
      var bubble = e.target.closest('.cr-mine-bubble, .cr-luna-bubble');
      if (!bubble) return;
      var wrap = bubble.closest('.cr-msg-mine, .cr-msg-luna');
      if (!wrap) return;
      if (handleBilingualBubbleClick(e, bubble, wrap)) return;
      openCtxMenu(wrap);
    });
    /* 禁止浏览器原生右键菜单 */
    msgArea.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }


  /* ── 关闭按钮 ── */
  cancelBtn.addEventListener('click', closeCtxMenu);
  backdrop.addEventListener('click',  closeCtxMenu);

})();

/* ================================================================
   多选模式 — Multi Select
================================================================ */
(function () {

  /* ── 注入顶部操作栏 HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
<div id="msBar" style="display:none">
  <button class="ms-btn ms-cancel" id="msCancelBtn">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 1l12 12M13 1L1 13" stroke="#1a1a1a" stroke-width="1.6" stroke-linecap="round"/>
    </svg>
    <span>取消</span>
  </button>
  <div class="ms-count" id="msCount">已选 0 条</div>
  <div class="ms-spacer"></div>
</div>

<div id="msActionBar" style="display:none">
  <button class="ms-action-btn" id="msDeleteBtn">
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M3 5h14M8 5V3h4v2M6 5l1 12h6l1-12" stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>删除</span>
  </button>
  <div class="ms-action-div"></div>
  <button class="ms-action-btn" id="msForwardBtn">
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M13 3l5 5-5 5" stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M18 8H8a5 5 0 000 10h2" stroke="#1a1a1a" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>转发</span>
  </button>
  <div class="ms-action-div"></div>
  <button class="ms-action-btn" id="msScreenshotBtn">
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="16" height="12" rx="2" stroke="#1a1a1a" stroke-width="1.4"/>
      <circle cx="10" cy="10" r="3" stroke="#1a1a1a" stroke-width="1.2"/>
      <path d="M2 8h2M16 8h2" stroke="#1a1a1a" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
    <span>截图</span>
  </button>
</div>`);

  const msBar       = document.getElementById('msBar');
  const msActionBar = document.getElementById('msActionBar');
  const msCancelBtn = document.getElementById('msCancelBtn');
  const msCountEl   = document.getElementById('msCount');
  const msDeleteBtn = document.getElementById('msDeleteBtn');
  const msForwardBtn= document.getElementById('msForwardBtn');
  const msScreenBtn = document.getElementById('msScreenshotBtn');

  let _msActive  = false;
  let _msSet     = new Set(); // 存 crMessages 的索引

  /* ── 进入多选模式 ── */
  window.crMultiEnter = function (initIdx) {
    _msActive = true;
    _msSet    = new Set();

    /* 给所有消息气泡包一层可点击外壳 + 勾选圆 */
    const allWrap = document.querySelectorAll('.cr-msg-mine, .cr-msg-luna');
    allWrap.forEach((wrap, i) => {
      wrap.classList.add('ms-selectable');
      /* 避免重复注入 */
      if (!wrap.querySelector('.ms-circle-wrap')) {
        const cw = document.createElement('div');
        cw.className = 'ms-circle-wrap';
        cw.innerHTML = `<svg class="ms-circle" viewBox="0 0 22 22" width="22" height="22">
          <circle cx="11" cy="11" r="10" fill="none" stroke="#d0d0d0" stroke-width="1.2"/>
        </svg>`;
        wrap.insertBefore(cw, wrap.firstChild);
      }
      wrap.addEventListener('click', msOnClick);
    });

    /* 默认选中触发项 */
    if (initIdx >= 0) msSelect(initIdx);

    msBar.style.display       = 'flex';
    msActionBar.style.display = 'flex';
    msUpdateCount();

    /* 让消息区给顶部/底部操作栏腾位置 */
    const msgArea = document.getElementById('crMessages');
    if (msgArea) msgArea.classList.add('ms-mode');
  };

  /* ── 单条选中/取消 ── */
  function msOnClick(e) {
    if (!_msActive) return;
    const wrap = e.currentTarget;
    const allWrap = Array.from(document.querySelectorAll('.cr-msg-mine, .cr-msg-luna'));
    const i = allWrap.indexOf(wrap);
    if (i < 0) return;
    if (_msSet.has(i)) {
      _msSet.delete(i);
      wrap.classList.remove('ms-checked');
      msSetCircle(wrap, false);
    } else {
      _msSet.add(i);
      wrap.classList.add('ms-checked');
      msSetCircle(wrap, true);
    }
    msUpdateCount();
  }

  function msSelect(i) {
    const allWrap = Array.from(document.querySelectorAll('.cr-msg-mine, .cr-msg-luna'));
    const wrap = allWrap[i];
    if (!wrap) return;
    _msSet.add(i);
    wrap.classList.add('ms-checked');
    msSetCircle(wrap, true);
  }

  function msSetCircle(wrap, on) {
    const svg = wrap.querySelector('.ms-circle');
    if (!svg) return;
    svg.innerHTML = on
      ? `<circle cx="11" cy="11" r="10" fill="#1a1a1a"/>
         <path d="M7 11l3 3 5-5" stroke="#fff" stroke-width="1.6"
           stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
      : `<circle cx="11" cy="11" r="10" fill="none" stroke="#d0d0d0" stroke-width="1.2"/>`;
  }

  function msUpdateCount() {
    msCountEl.textContent = '已选 ' + _msSet.size + ' 条';
    const has = _msSet.size > 0;
    msDeleteBtn .style.opacity       = has ? '1' : '0.35';
    msForwardBtn.style.opacity       = has ? '1' : '0.35';
    msScreenBtn .style.opacity       = has ? '1' : '0.35';
    msDeleteBtn .style.pointerEvents = has ? 'auto' : 'none';
    msForwardBtn.style.pointerEvents = has ? 'auto' : 'none';
    msScreenBtn .style.pointerEvents = has ? 'auto' : 'none';
  }

  /* ── 退出多选 ── */
  function msExit() {
    _msActive = false;
    _msSet    = new Set();
    const allWrap = document.querySelectorAll('.cr-msg-mine, .cr-msg-luna');
    allWrap.forEach(wrap => {
      wrap.classList.remove('ms-selectable', 'ms-checked');
      wrap.removeEventListener('click', msOnClick);
      const cw = wrap.querySelector('.ms-circle-wrap');
      if (cw) cw.remove();
    });
    msBar.style.display       = 'none';
    msActionBar.style.display = 'none';
    const msgArea = document.getElementById('crMessages');
    if (msgArea) msgArea.classList.remove('ms-mode');
  }

  msCancelBtn.addEventListener('click', msExit);

  /* ── 批量删除 ── */
  msDeleteBtn.addEventListener('click', function () {
    if (!_msSet.size) return;
    const indices = Array.from(_msSet).sort((a, b) => b - a); // 从大到小删，避免下标错位
    const allWrap = Array.from(document.querySelectorAll('.cr-msg-mine, .cr-msg-luna'));
    indices.forEach(i => {
      crMessages.splice(i, 1);
      if (allWrap[i]) allWrap[i].remove();
    });
    dbSaveMessages(CR_NAME, crMessages);
    crShowTip('已删除 ' + indices.length + ' 条消息');
    msExit();
  });

  /* ── 批量转发 ── */
  msForwardBtn.addEventListener('click', function () {
    if (!_msSet.size) return;
    const indices  = Array.from(_msSet).sort((a, b) => a - b);
    const combined = indices
      .map(i => crMessages[i] ? crMessages[i].text : '')
      .filter(Boolean)
      .join('\n');
    msExit();
    crOpenForwardPage(combined);
  });

  /* ── 截图 ── */
  msScreenBtn.addEventListener('click', function () {
    if (!_msSet.size) return;

    const indices = Array.from(_msSet).sort((a, b) => a - b);
    const allWrap = Array.from(document.querySelectorAll('.cr-msg-mine, .cr-msg-luna'));

    /* 1. 克隆选中气泡到离屏 canvas 容器 */
    const container = document.createElement('div');
    container.style.cssText = [
      'position:fixed', 'left:-9999px', 'top:0',
      'width:' + (document.getElementById('crMessages').offsetWidth) + 'px',
      'background:#fff', 'padding:20px 24px', 'display:flex',
      'flex-direction:column', 'gap:10px',
      'font-family:' + getComputedStyle(document.body).fontFamily,
    ].join(';');

    indices.forEach(i => {
      const wrap = allWrap[i];
      if (!wrap) return;
      const clone = wrap.cloneNode(true);
      /* 移除多选圆，不显示在截图里 */
      clone.querySelectorAll('.ms-circle-wrap').forEach(n => n.remove());
      clone.classList.remove('ms-selectable', 'ms-checked');
      container.appendChild(clone);
    });
    document.body.appendChild(container);

    /* 2. 用 html2canvas（若已加载）或回退为文字导出 */
    if (typeof html2canvas === 'function') {
      html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      }).then(canvas => {
        container.remove();
        canvas.toBlob(blob => {
          const url  = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href     = url;
          link.download = 'messages_' + Date.now() + '.png';
          link.click();
          URL.revokeObjectURL(url);
        }, 'image/png');
        crShowTip('截图已保存');
      }).catch(() => {
        container.remove();
        crShowTip('截图失败，请检查 html2canvas 是否加载');
      });
    } else {
      /* 回退：把文字内容复制到剪贴板 */
      container.remove();
      const text = indices
        .map(i => {
          const m = crMessages[i];
          if (!m) return '';
          const who = m.role === 'mine' ? '我' : CR_NAME;
          return '[' + m.time + '] ' + who + '：' + m.text;
        })
        .filter(Boolean).join('\n');
      navigator.clipboard.writeText(text).catch(() => {});
      crShowTip('已复制为文字（如需图片截图请引入 html2canvas）');
    }
    msExit();
  });

})();

/* ================================================================
   转发页面 — Forward Full Screen
================================================================ */
(function () {

  /* ── 注入 HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
<div id="fwPage">

  <!-- 状态栏 -->
  <div class="fw-status-bar">
    <div class="fw-status-time" id="fwTime">9:41</div>
    <div class="fw-status-island" id="fwIsland"></div>
    <div class="fw-status-right">
      <div class="fw-signal"><i></i><i></i><i></i><i></i></div>
      <svg width="15" height="11" viewBox="0 0 16 12" fill="#1a1a1a" opacity="0.82">
        <path d="M8 2.5C10.3 2.5 12.4 3.5 13.9 5.1L15.2 3.8C13.3 1.9 10.8.8 8 .8S2.7 1.9.8 3.8L2.1 5.1C3.6 3.5 5.7 2.5 8 2.5Z"/>
        <path d="M8 5.8C9.7 5.8 11.2 6.5 12.3 7.7L13.6 6.4C12.1 4.9 10.2 4 8 4S3.9 4.9 2.4 6.4L3.7 7.7C4.8 6.5 6.3 5.8 8 5.8Z"/>
        <circle cx="8" cy="10.5" r="1.8"/>
      </svg>
      <div class="fw-battery">
        <span class="fw-bat-pct" id="fwBatPct">76</span>
        <div class="fw-bat-shell">
          <div class="fw-bat-inner" id="fwBatInner"></div>
          <div class="fw-bat-nub"></div>
        </div>
      </div>
    </div>
  </div>

  <!-- 顶部导航 -->
  <div class="fw-nav">
    <button class="fw-back-btn" id="fwBackBtn">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M19 12H5M12 5l-7 7 7 7" stroke="#1a1a1a" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <div class="fw-nav-center">
      <div class="fw-nav-title">转发消息</div>
      <div class="fw-nav-sub">选择联系人</div>
    </div>
    <div class="fw-nav-placeholder"></div>
  </div>

  <!-- 消息预览 -->
  <div class="fw-preview">
    <div class="fw-preview-accent"></div>
    <div class="fw-preview-text" id="fwPreviewText"></div>
  </div>

  <!-- 搜索 -->
  <div class="fw-search-wrap">
    <div class="fw-search-inner">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <circle cx="9" cy="9" r="7" stroke="#aaa" stroke-width="1.6"/>
        <path d="M14.5 14.5L18 18" stroke="#aaa" stroke-width="1.6" stroke-linecap="round"/>
      </svg>
      <input id="fwSearch" class="fw-search-input" placeholder="搜索联系人" autocomplete="off"/>
    </div>
  </div>

  <!-- 联系人列表 -->
  <div class="fw-body">
    <div class="fw-section-label">联系人</div>
    <div id="fwList" class="fw-list"></div>
    <div id="fwEmpty" class="fw-empty" style="display:none">暂无其他联系人</div>
  </div>

  <!-- 底部发送栏 -->
  <div class="fw-footer" id="fwFooter" style="display:none">
    <div class="fw-footer-names" id="fwFooterNames"></div>
    <button class="fw-send-btn" id="fwSendBtn">
      <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
        <path d="M18 2L10 10" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M18 2L12.5 18L10 10L2 7.5L18 2Z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <span>发送</span>
    </button>
  </div>

</div>`);

  /* ── 元素引用 ── */
  const page        = document.getElementById('fwPage');
  const backBtn     = document.getElementById('fwBackBtn');
  const listEl      = document.getElementById('fwList');
  const emptyEl     = document.getElementById('fwEmpty');
  const searchEl    = document.getElementById('fwSearch');
  const previewEl   = document.getElementById('fwPreviewText');
  const footer      = document.getElementById('fwFooter');
  const footerNames = document.getElementById('fwFooterNames');
  const sendBtn     = document.getElementById('fwSendBtn');
  const fwTimeEl    = document.getElementById('fwTime');
  const fwBatPct    = document.getElementById('fwBatPct');
  const fwBatInner  = document.getElementById('fwBatInner');
  const fwIslandEl  = document.getElementById('fwIsland');

  let _text     = '';
  let _friends  = [];
  let _selected = new Set();
  let _tickTimer = null;

  /* ── 状态栏时钟 ── */
  function fwTick() {
    const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
    const n  = new Date();
    const ts = n.toLocaleTimeString('zh-CN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
    });
    if (fwTimeEl)   fwTimeEl.textContent = ts;
    const pct = parseInt(localStorage.getItem('luna_battery') || '76');
    if (fwBatPct)   fwBatPct.textContent  = pct;
    if (fwBatInner) {
      fwBatInner.style.width      = pct + '%';
      fwBatInner.style.background = pct <= 20
        ? 'linear-gradient(90deg,#f87171,#ef4444)' : '#1a1a1a';
    }
  }

  /* ── 灵动岛同步（与 chatroom 完全一致的 styleMap） ── */
  function fwSyncIsland() {
    if (!fwIslandEl) return;
    const enabled = localStorage.getItem('luna_island_enabled') === 'true';
    const style   = localStorage.getItem('luna_island_style') || 'minimal';
    if (!enabled) { fwIslandEl.innerHTML = ''; return; }
    const m = {
      minimal:`<div class="si-minimal"><div class="si-capsule"></div></div>`,
      glow:   `<div class="si-glow"><div class="si-capsule"></div></div>`,
      clock:  `<div class="si-clock"><div class="si-capsule"><span class="si-clock-text" id="fwIslandClock">--:--</span></div></div>`,
      pulse:  `<div class="si-pulse"><div class="si-capsule"><div class="si-dot si-dot-l"></div><div class="si-dot si-dot-r"></div></div></div>`,
      ripple: `<div class="si-ripple"><div class="si-capsule"><div class="si-ring"></div></div></div>`,
      rainbow:`<div class="si-rainbow"><div class="si-capsule"></div></div>`,
      music:  `<div class="si-music"><div class="si-capsule"><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div><div class="si-bar"></div></div></div>`,
      scan:   `<div class="si-scan"><div class="si-capsule"><div class="si-scanline"></div></div></div>`,
    };
    fwIslandEl.innerHTML = m[style] || m.minimal;
    if (style === 'clock') {
      const tick = () => {
        const t = document.getElementById('fwIslandClock');
        if (!t) return;
        const now = new Date();
        t.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0');
      };
      tick();
    }
  }

  /* ── 字体同步：复用主页面已注入的 luna-font-override，天然继承 ── */

  /* ── 加载好友（从 LunaChatDB.conv，排除当前角色） ── */
  async function fwLoadFriends() {
    try {
      const charMap = await new Promise(res => {
        openLunaCharDB().then(db => {
          if (!db.objectStoreNames.contains('chars')) { res({}); return; }
          const r = db.transaction('chars').objectStore('chars').getAll();
          r.onsuccess = () => {
            const map = {};
            (r.result || []).forEach(c => { map[c.name] = c.avatar || null; });
            res(map);
          };
          r.onerror = () => res({});
        }).catch(() => res({}))
      });

      const convs = await new Promise(res => {
        const req = indexedDB.open('LunaChatDB');
        req.onsuccess = e => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('conv')) { res([]); return; }
          const r = db.transaction('conv').objectStore('conv').getAll();
          r.onsuccess = () => res(r.result || []);
          r.onerror   = () => res([]);
        };
        req.onerror = () => res([]);
      });

      return convs
        .filter(f => f.name !== CR_NAME)
        .map(f => ({ name: f.name, avatar: charMap[f.name] || null }));
    } catch { return []; }
  }

  /* ── 头像 HTML ── */
  function fwAvHtml(f) {
    if (f.avatar) {
      return `<div class="fw-av"><img src="${f.avatar}"
        style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;"/></div>`;
    }
    const l = (f.name[0] || '?').toUpperCase();
    return `<div class="fw-av fw-av-letter">
      <svg width="46" height="46" viewBox="0 0 46 46">
        <circle cx="23" cy="23" r="23" fill="#efefef"/>
        <text x="23" y="28" text-anchor="middle" font-size="17" font-weight="600"
          fill="#888" font-family="'Playfair Display',serif">${l}</text>
      </svg></div>`;
  }

  /* ── 勾选圆 ── */
  function fwCheckHtml(on) {
    return on
      ? `<svg class="fw-check on" width="22" height="22" viewBox="0 0 22 22">
           <circle cx="11" cy="11" r="10" fill="#1a1a1a"/>
           <path d="M7 11l3 3 5-5" stroke="#fff" stroke-width="1.7"
             stroke-linecap="round" stroke-linejoin="round" fill="none"/>
         </svg>`
      : `<svg class="fw-check" width="22" height="22" viewBox="0 0 22 22">
           <circle cx="11" cy="11" r="10" fill="none" stroke="#d8d8d8" stroke-width="1.2"/>
         </svg>`;
  }

  /* ── 渲染列表 ── */
  function fwRender(kw) {
    listEl.innerHTML = '';
    const filtered = _friends.filter(f =>
      !kw || f.name.toLowerCase().includes(kw.toLowerCase())
    );
    emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
    filtered.forEach(f => {
      const row = document.createElement('div');
      const on  = _selected.has(f.name);
      row.className   = 'fw-row' + (on ? ' on' : '');
      row.dataset.name = f.name;
      row.innerHTML   =
        fwAvHtml(f) +
        `<div class="fw-row-name">${escHtml(f.name)}</div>` +
        fwCheckHtml(on);
      row.addEventListener('click', () => {
        _selected.has(f.name) ? _selected.delete(f.name) : _selected.add(f.name);
        fwRender(searchEl.value);
        fwUpdateFooter();
      });
      listEl.appendChild(row);
    });
  }

  /* ── 更新底部 ── */
  function fwUpdateFooter() {
    if (_selected.size === 0) { footer.style.display = 'none'; return; }
    footer.style.display = 'flex';
    footerNames.textContent = '发送给 ' + Array.from(_selected).join('、');
  }

  /* ── 执行转发 ── */
  async function fwDoSend() {
    if (!_selected.size || !_text) return;
    const n  = new Date();
    const t  = n.getHours().toString().padStart(2,'0') + ':' +
               n.getMinutes().toString().padStart(2,'0');
    try {
      const db = await getCrDB();
      for (const name of _selected) {
        const existing = await new Promise(res => {
          const r = db.transaction('messages').objectStore('messages').get(name);
          r.onsuccess = () => res(r.result ? r.result.msgs || [] : []);
          r.onerror   = () => res([]);
        });
        existing.push({ role: 'mine', text: _text, time: t, forwarded: true });
        dbSaveMessages(name, existing);

        const tx    = db.transaction('conv', 'readwrite');
        const store = tx.objectStore('conv');
        const req   = store.get(name);
        req.onsuccess = () => {
          const item = req.result;
          if (item) {
            item.preview = '[转发] ' + _text.slice(0, 20);
            item.time    = t;
            item.timeVal = Date.now();
            store.put(item);
          }
        };
      }
    } catch(e) { console.error('[fwDoSend]', e); }

    crShowTip('已转发给 ' + Array.from(_selected).join('、'));
    fwClose();
  }

  /* ── 打开 ── */
  window.crOpenForwardPage = async function(text) {
    _text     = text;
    _selected = new Set();

    previewEl.textContent = text.length > 50 ? text.slice(0, 50) + '…' : text;
    footer.style.display  = 'none';
    searchEl.value        = '';

    fwTick();
    fwSyncIsland();
    clearInterval(_tickTimer);
    _tickTimer = setInterval(fwTick, 10000);

    _friends = await fwLoadFriends();
    fwRender('');

    /* 入场动画 */
    page.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      page.classList.add('fw-in');
    }));
  };

  /* ── 关闭 ── */
  function fwClose() {
    clearInterval(_tickTimer);
    page.classList.remove('fw-in');
    page.classList.add('fw-out');
    setTimeout(() => {
      page.style.display = 'none';
      page.classList.remove('fw-out');
    }, 280);
  }

  backBtn.addEventListener('click', fwClose);
  sendBtn.addEventListener('click', fwDoSend);
  searchEl.addEventListener('input', function () { fwRender(this.value); });

})();

/* ================================================================
   消息编辑弹窗 — Edit Modal
================================================================ */
(function(){

  /* 注入弹窗 HTML */
  const modalHtml = `
<div id="crEditOverlay" style="
  display:none;position:fixed;inset:0;z-index:9999;
  display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);
">
  <div id="crEditModal" style="
    background:#faf9f7;border-radius:20px;width:88%;max-width:360px;
    padding:24px 20px 20px;box-shadow:0 12px 48px rgba(0,0,0,0.18);
    display:flex;flex-direction:column;gap:14px;
    transform:scale(0.92);opacity:0;transition:transform 0.22s ease,opacity 0.22s ease;
  ">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="font-size:13px;font-weight:600;color:#1a1a1a;letter-spacing:.5px;">修改消息</span>
      <button id="crEditClose" style="background:none;border:none;cursor:pointer;padding:4px;line-height:1;">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke="#999" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>
    <div id="crEditNote" style="
      font-size:11px;color:#aaa;background:#f3f2f0;border-radius:8px;
      padding:8px 10px;line-height:1.5;display:none;
    "></div>
    <textarea id="crEditTextarea" style="
      width:100%;box-sizing:border-box;min-height:90px;resize:vertical;
      border:1.2px solid #e0ddd8;border-radius:12px;
      padding:12px;font-size:14px;color:#1a1a1a;
      background:#fff;outline:none;font-family:inherit;line-height:1.6;
    "></textarea>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button id="crEditCancel" style="
        background:none;border:1.2px solid #ddd;border-radius:10px;
        padding:8px 18px;font-size:13px;color:#888;cursor:pointer;
      ">取消</button>
      <button id="crEditConfirm" style="
        background:#1a1a1a;border:none;border-radius:10px;
        padding:8px 20px;font-size:13px;color:#fff;cursor:pointer;font-weight:500;
      ">保存并发送</button>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay  = document.getElementById('crEditOverlay');
  const modal    = document.getElementById('crEditModal');
  const textarea = document.getElementById('crEditTextarea');
  const noteEl   = document.getElementById('crEditNote');
  const closeBtn = document.getElementById('crEditClose');
  const cancelBtn= document.getElementById('crEditCancel');
  const confirmBtn=document.getElementById('crEditConfirm');

  let _editIdx = -1;
  let _origText = '';

  /* ── 打开弹窗 ── */
  window.crOpenEditModal = function(msgIdx, text) {
    _editIdx  = msgIdx;
    _origText = text;
    textarea.value = text;

    /* 判断被编辑消息前后有无 AI 回复，有就显示提示 */
    const hasAiAfter = crMessages.slice(msgIdx + 1).some(m => m.role === 'luna');
    if (hasAiAfter) {
      noteEl.textContent = '此消息后 Luna 已有回复。保存后将在对话历史中标注「已修改」，下次 AI 回复时会感知到原始内容有变动，自动审视人设。';
      noteEl.style.display = 'block';
    } else {
      noteEl.style.display = 'none';
    }

    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      modal.style.transform = 'scale(1)';
      modal.style.opacity   = '1';
      textarea.focus();
    }));
  };

  /* ── 关闭弹窗 ── */
  function closeModal() {
    modal.style.transform = 'scale(0.92)';
    modal.style.opacity   = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 220);
    _editIdx  = -1;
    _origText = '';
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });

  /* ── 保存并发送 ── */
  confirmBtn.addEventListener('click', function() {
    const newText = textarea.value.trim();
    if (!newText || _editIdx < 0 || _editIdx >= crMessages.length) return;

    const msg = crMessages[_editIdx];
    if (msg.role !== 'mine') {
      crShowTip('只能修改自己的消息');
      closeModal(); return;
    }

    /* 1. 记录原文，打上 edited 标记 */
    msg.originalText = msg.originalText || _origText; // 保留最原始版本
    msg.editedText   = newText;                        // 当前修改版
    msg.edited       = true;
    msg.text         = newText;                        // 主字段同步更新

    /* 2. 更新 DB */
    dbSaveMessages(CR_NAME, crMessages);

    /* 3. 更新 DOM 中这条气泡的文字 */
    const allWrap = document.querySelectorAll('.cr-msg-mine, .cr-msg-luna');
    const wrapEl  = allWrap[_editIdx];
    if (wrapEl) {
      const p = wrapEl.querySelector('.cr-msg-p');
      if (p) {
        p.innerHTML = escHtml(newText);
        /* 加小标记 */
        if (!wrapEl.querySelector('.cr-edited-tag')) {
          const tag = document.createElement('span');
          tag.className = 'cr-edited-tag';
          tag.textContent = '已编辑';
          tag.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.45);margin-left:6px;';
          p.appendChild(tag);
        }
      }
    }

    crShowTip('消息已更新');
    closeModal();
  });

})();



(function () {

function escLoc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.body.insertAdjacentHTML('beforeend', `
<style>
#locOverlay{display:none;position:fixed;inset:0;z-index:10200;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);}
#locPanel{width:92%;max-width:400px;background:#faf9f7;border-radius:26px;border:0.5px solid rgba(0,0,0,0.09);box-shadow:0 28px 80px rgba(0,0,0,0.28);overflow:hidden;transform:scale(0.9) translateY(20px);opacity:0;transition:transform 0.3s cubic-bezier(0.34,1.12,0.64,1),opacity 0.22s ease;}
#locPanel.loc-shown{transform:scale(1) translateY(0);opacity:1;}
.loc-hd{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 0;}
.loc-hd-lbl{font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#bbb;text-transform:uppercase;margin-bottom:3px;}
.loc-hd-title{font-size:16px;font-weight:600;color:#1a1a1a;}
.loc-close-btn{width:30px;height:30px;border-radius:50%;border:0.5px solid rgba(0,0,0,0.12);background:#f0efec;cursor:pointer;display:flex;align-items:center;justify-content:center;}
.loc-tabs{display:flex;gap:6px;padding:14px 20px 0;}
.loc-tab{flex:1;padding:8px 0;border-radius:12px;border:0.5px solid rgba(0,0,0,0.12);background:#f0efec;font-size:12px;color:#888;cursor:pointer;font-family:'Inter',sans-serif;transition:all 0.18s;text-align:center;}
.loc-tab.active{background:#1a1a1a;color:#fff;border-color:#1a1a1a;}
.loc-pane{display:none;padding:14px 20px 0;}
.loc-pane.active{display:block;}
.loc-search-wrap{display:flex;align-items:center;gap:8px;background:#fff;border:1.2px solid #e0ddd8;border-radius:14px;padding:9px 12px;transition:border-color 0.18s;}
.loc-search-wrap:focus-within{border-color:#1a1a1a;}
.loc-search-input{flex:1;border:none;background:transparent;outline:none;font-size:14px;color:#1a1a1a;font-family:'Inter',sans-serif;}
.loc-search-input::placeholder{color:#c0bab2;}
.loc-search-btn{width:30px;height:30px;border-radius:9px;background:#1a1a1a;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.15s;}
.loc-search-btn:disabled{opacity:0.4;cursor:default;}
.loc-results{margin-top:10px;max-height:200px;overflow-y:auto;border-radius:14px;border:0.5px solid rgba(0,0,0,0.07);background:#fff;}
.loc-result-item{display:flex;align-items:center;gap:10px;padding:10px 13px;cursor:pointer;border-bottom:0.5px solid rgba(0,0,0,0.05);transition:background 0.12s;}
.loc-result-item:last-child{border-bottom:none;}
.loc-result-item:hover{background:#f8f7f5;}
.loc-result-item.sel{background:#f2f1ee;}
.loc-rpin{width:28px;height:28px;border-radius:8px;background:#f0efec;flex-shrink:0;display:flex;align-items:center;justify-content:center;}
.loc-rpin.on{background:#1a1a1a;}
.loc-rname{font-size:13px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.loc-raddr{font-size:11px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.loc-rcheck{flex-shrink:0;opacity:0;transition:opacity 0.15s;}
.loc-result-item.sel .loc-rcheck{opacity:1;}
.loc-map-prev{margin-top:13px;border-radius:16px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.08);}
.loc-map-canvas{width:100%;height:120px;position:relative;background:#e8e7e0;overflow:hidden;}
.loc-map-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.055) 1px,transparent 1px);background-size:18px 18px;}
.loc-map-circle{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:36px;height:36px;border-radius:50%;background:rgba(26,26,26,0.12);display:flex;align-items:center;justify-content:center;}
.loc-map-circle::before{content:'';position:absolute;inset:-7px;border-radius:50%;border:1px solid rgba(26,26,26,0.14);}
.loc-map-dot{width:13px;height:13px;border-radius:50%;background:#1a1a1a;border:2.5px solid #fff;z-index:2;}
.loc-map-pill{position:absolute;bottom:9px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.92);border:0.5px solid rgba(0,0,0,0.1);border-radius:20px;padding:3px 11px;font-family:'Space Mono',monospace;font-size:10px;font-weight:500;color:#1a1a1a;white-space:nowrap;}
.loc-map-foot{background:#fff;padding:10px 14px 12px;display:flex;align-items:center;gap:10px;}
.loc-map-foot-text{flex:1;min-width:0;}
.loc-map-foot-name{font-size:13px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px;}
.loc-map-foot-addr{font-size:11px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.loc-virt-lbl{font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1px;margin-bottom:7px;}
.loc-virt-inp{width:100%;box-sizing:border-box;border:1.2px solid #e0ddd8;border-radius:13px;padding:10px 13px;font-size:14px;color:#1a1a1a;background:#fff;outline:none;font-family:'Inter',sans-serif;transition:border-color 0.18s;}
.loc-virt-inp:focus{border-color:#1a1a1a;}
.loc-virt-inp::placeholder{color:#c0bab2;}
.loc-ai-row{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap;}
.loc-ai-chip{display:flex;align-items:center;gap:5px;padding:6px 13px;border-radius:10px;border:0.5px solid rgba(0,0,0,0.12);background:#f5f5f2;cursor:pointer;font-size:12px;color:#555;font-family:'Inter',sans-serif;transition:all 0.15s;}
.loc-ai-chip:hover{background:#e8e7e3;}
.loc-ai-suggest{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px;}
.loc-sug-chip{padding:5px 12px;border-radius:20px;border:0.5px solid rgba(0,0,0,0.12);background:#fff;cursor:pointer;font-size:12px;color:#555;font-family:'Inter',sans-serif;transition:all 0.15s;}
.loc-sug-chip:hover{background:#1a1a1a;color:#fff;border-color:#1a1a1a;}
.loc-status{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:11px;background:#f5f5f2;margin-top:10px;font-size:12px;color:#aaa;font-family:'Inter',sans-serif;}
.loc-status.hidden{display:none;}
@keyframes loc-spin{to{transform:rotate(360deg);}}
.loc-spinner{width:12px;height:12px;border-radius:50%;border:1.5px solid #ddd;border-top-color:#888;animation:loc-spin 0.7s linear infinite;flex-shrink:0;}
.loc-send-row{padding:14px 20px 20px;}
.loc-send-btn{width:100%;padding:13px;border-radius:18px;border:none;background:#1a1a1a;color:#fff;font-size:14px;font-family:'Inter',sans-serif;font-weight:500;letter-spacing:0.5px;cursor:pointer;transition:opacity 0.18s;}
.loc-send-btn:disabled{opacity:0.35;cursor:default;}
</style>

<div id="locOverlay">
  <div id="locPanel">
    <div class="loc-hd">
      <div>
        <div class="loc-hd-lbl">Location · 位置</div>
        <div class="loc-hd-title">发送位置</div>
      </div>
      <button class="loc-close-btn" id="locCloseBtn">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M1 1l8 8M9 1L1 9" stroke="#666" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="loc-tabs">
      <button class="loc-tab active" id="locTabReal">真实地点</button>
      <button class="loc-tab" id="locTabVirt">虚拟地点</button>
    </div>

    <!-- 真实地点 -->
    <div class="loc-pane active" id="locPaneReal">
      <div class="loc-search-wrap">
        <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
          <circle cx="9" cy="9" r="7" stroke="#bbb" stroke-width="1.6"/>
          <path d="M14.5 14.5L18 18" stroke="#bbb" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        <input class="loc-search-input" id="locSearchInput" placeholder="搜索全球任意地点…" />
        <button class="loc-search-btn" id="locSearchBtn">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <circle cx="9" cy="9" r="7" stroke="#fff" stroke-width="1.8"/>
            <path d="M14.5 14.5L18 18" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="loc-status hidden" id="locRealStatus">
        <div class="loc-spinner"></div>
        <span id="locRealStatusText">搜索中…</span>
      </div>
      <div class="loc-results" id="locResults" style="display:none;"></div>
      <div class="loc-map-prev" id="locMapPrev" style="display:none;">
        <div id="locLeafletMap" style="width:100%;height:180px;border-radius:16px 16px 0 0;overflow:hidden;z-index:0;"></div>
        <div class="loc-map-foot">
          <div class="loc-map-foot-text">
            <div class="loc-map-foot-name" id="locMapName">—</div>
            <div class="loc-map-foot-addr" id="locMapAddr">—</div>
          </div>
          <div style="width:28px;height:28px;background:#1a1a1a;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5 15L15 5M15 5H7M15 5v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- 虚拟地点 -->
    <div class="loc-pane" id="locPaneVirt">
      <div class="loc-virt-lbl">地点名称</div>
      <input class="loc-virt-inp" id="locVirtName" placeholder="输入地点名称，如：月亮咖啡馆" />
      <div style="height:10px;"></div>
      <div class="loc-virt-lbl">地址描述（选填）</div>
      <input class="loc-virt-inp" id="locVirtAddr" placeholder="输入地址，如：银河系第三象限" />
      <div class="loc-ai-row">
        <button class="loc-ai-chip" id="locAiGenBtn">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <path d="M10 1L11.8 7H18L12.9 10.7L14.7 16.7L10 13L5.3 16.7L7.1 10.7L2 7H8.2L10 1Z" stroke="#7a7a7a" stroke-width="1.3" stroke-linejoin="round"/>
          </svg>
          AI 随机生成
        </button>
        <button class="loc-ai-chip" id="locAiSugBtn">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="8" stroke="#7a7a7a" stroke-width="1.3"/>
            <path d="M10 6v5l3 2" stroke="#7a7a7a" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          给我灵感
        </button>
      </div>
      <div class="loc-status hidden" id="locVirtStatus">
        <div class="loc-spinner"></div>
        <span id="locVirtStatusText">AI 生成中…</span>
      </div>
      <div class="loc-ai-suggest" id="locAiSuggest"></div>
      <div class="loc-map-prev" id="locVirtMapPrev" style="margin-top:13px;display:none;">
        <div class="loc-map-canvas">
          <div class="loc-map-grid"></div>
          <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.28" viewBox="0 0 400 120" fill="none">
            <line x1="0" y1="60" x2="400" y2="60" stroke="#1a1a1a" stroke-width="6"/>
            <line x1="200" y1="0" x2="200" y2="120" stroke="#1a1a1a" stroke-width="4"/>
            <line x1="0" y1="35" x2="130" y2="35" stroke="#1a1a1a" stroke-width="2.5"/>
            <line x1="270" y1="95" x2="400" y2="95" stroke="#1a1a1a" stroke-width="2.5"/>
          </svg>
          <div class="loc-map-circle"><div class="loc-map-dot"></div></div>
          <div class="loc-map-pill" id="locVirtPill">虚拟坐标</div>
        </div>
        <div class="loc-map-foot">
          <div class="loc-map-foot-text">
            <div class="loc-map-foot-name" id="locVirtPreviewName">—</div>
            <div class="loc-map-foot-addr" id="locVirtPreviewAddr">—</div>
          </div>
          <div style="width:28px;height:28px;background:#1a1a1a;border-radius:8px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
              <path d="M5 15L15 5M15 5H7M15 5v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <div class="loc-send-row">
      <button class="loc-send-btn" id="locSendBtn" disabled>发送位置</button>
    </div>
  </div>
</div>
`);

/* ── 元素引用 ── */
const overlay      = document.getElementById('locOverlay');
const panel        = document.getElementById('locPanel');
const closeBtn     = document.getElementById('locCloseBtn');
const tabReal      = document.getElementById('locTabReal');
const tabVirt      = document.getElementById('locTabVirt');
const paneReal     = document.getElementById('locPaneReal');
const paneVirt     = document.getElementById('locPaneVirt');
const searchInput  = document.getElementById('locSearchInput');
const searchBtn    = document.getElementById('locSearchBtn');
const resultsEl    = document.getElementById('locResults');
const realStatus   = document.getElementById('locRealStatus');
const realStatusTx = document.getElementById('locRealStatusText');
const mapPrev      = document.getElementById('locMapPrev');
const mapPill      = document.getElementById('locMapPill');
const mapName      = document.getElementById('locMapName');
const mapAddr      = document.getElementById('locMapAddr');
const virtName     = document.getElementById('locVirtName');
const virtAddr     = document.getElementById('locVirtAddr');
const aiGenBtn     = document.getElementById('locAiGenBtn');
const aiSugBtn     = document.getElementById('locAiSugBtn');
const virtStatus   = document.getElementById('locVirtStatus');
const virtStatusTx = document.getElementById('locVirtStatusText');
const aiSuggest    = document.getElementById('locAiSuggest');
const virtMapPrev  = document.getElementById('locVirtMapPrev');
const virtPill     = document.getElementById('locVirtPill');
const virtPrevName = document.getElementById('locVirtPreviewName');
const virtPrevAddr = document.getElementById('locVirtPreviewAddr');
const sendBtn      = document.getElementById('locSendBtn');

/* ── 状态 ── */
let _mode = 'real'; // 'real' | 'virt'
let _selected = null; // { name, addr, lat, lon, dist }

/* ── Tab 切换 ── */
tabReal.addEventListener('click', () => switchMode('real'));
tabVirt.addEventListener('click', () => switchMode('virt'));

function switchMode(m) {
  _mode = m;
  _selected = null;
  sendBtn.disabled = true;
  tabReal.classList.toggle('active', m === 'real');
  tabVirt.classList.toggle('active', m === 'virt');
  paneReal.classList.toggle('active', m === 'real');
  paneVirt.classList.toggle('active', m === 'virt');
}

/* ── 打开 / 关闭 ── */
function openModal() {
  _selected = null;
  _mode = 'real';
  tabReal.classList.add('active'); tabVirt.classList.remove('active');
  paneReal.classList.add('active'); paneVirt.classList.remove('active');
  searchInput.value = '';
  resultsEl.style.display = 'none'; resultsEl.innerHTML = '';
  mapPrev.style.display = 'none';
  realStatus.classList.add('hidden');
  virtName.value = ''; virtAddr.value = '';
  aiSuggest.innerHTML = '';
  virtMapPrev.style.display = 'none';
  virtStatus.classList.add('hidden');
  sendBtn.disabled = true;

  overlay.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    panel.classList.add('loc-shown');
  }));
}

function closeModal() {
  panel.classList.remove('loc-shown');
  setTimeout(() => { overlay.style.display = 'none'; }, 280);
}

closeBtn.addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

/* ── 真实地点：Nominatim 搜索（OpenStreetMap，免费商用） ── */
let _searchTimer = null;

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});
searchBtn.addEventListener('click', doSearch);

async function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  realStatus.classList.remove('hidden');
  realStatusTx.textContent = '搜索中…';
  searchBtn.disabled = true;
  resultsEl.style.display = 'none';
  resultsEl.innerHTML = '';
  mapPrev.style.display = 'none';
  _selected = null;
  sendBtn.disabled = true;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=6&addressdetails=1`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' } });
    const data = await res.json();

    realStatus.classList.add('hidden');
    searchBtn.disabled = false;

    if (!data.length) {
      resultsEl.style.display = 'block';
      resultsEl.innerHTML = '<div style="padding:18px;text-align:center;color:#ccc;font-size:13px;">没有找到相关地点</div>';
      return;
    }

    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '';

    data.forEach((place, idx) => {
      const name = place.namedetails && place.namedetails.name
        ? place.namedetails.name
        : (place.display_name.split(',')[0] || place.display_name);
      const addr = place.display_name;
      const lat = parseFloat(place.lat).toFixed(4);
      const lon = parseFloat(place.lon).toFixed(4);

      const item = document.createElement('div');
      item.className = 'loc-result-item';
      item.innerHTML = `
        <div class="loc-rpin" id="locRpin${idx}">
          <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
            <path d="M10 2C7.24 2 5 4.24 5 7c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5z" stroke="#aaa" stroke-width="1.4" fill="none"/>
            <circle cx="10" cy="7" r="2" stroke="#aaa" stroke-width="1.2"/>
          </svg>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="loc-rname">${escLoc(name)}</div>
          <div class="loc-raddr">${escLoc(addr)}</div>
        </div>
        <div class="loc-rcheck">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" fill="#1a1a1a"/>
            <path d="M5 8l2 2 4-4" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>`;

      item.addEventListener('click', () => {
        resultsEl.querySelectorAll('.loc-result-item').forEach(i => i.classList.remove('sel'));
        resultsEl.querySelectorAll('.loc-rpin').forEach(p => { p.classList.remove('on'); p.innerHTML = `<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 2C7.24 2 5 4.24 5 7c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5z" stroke="#aaa" stroke-width="1.4" fill="none"/><circle cx="10" cy="7" r="2" stroke="#aaa" stroke-width="1.2"/></svg>`; });
        item.classList.add('sel');
        const pin = item.querySelector('.loc-rpin');
        pin.classList.add('on');
        pin.innerHTML = `<svg width="13" height="13" viewBox="0 0 20 20" fill="none"><path d="M10 2C7.24 2 5 4.24 5 7c0 4.25 5 11 5 11s5-6.75 5-11c0-2.76-2.24-5-5-5z" stroke="#fff" stroke-width="1.4" fill="none"/><circle cx="10" cy="7" r="2" stroke="#fff" stroke-width="1.2"/></svg>`;

        _selected = { name, addr, lat, lon };
        sendBtn.disabled = false;

        mapPrev.style.display = 'block';
        mapName.textContent = name;
        mapAddr.textContent = addr;

        const latNum = parseFloat(place.lat);
        const lonNum = parseFloat(place.lon);

        setTimeout(() => {
          if (!window._locLeafletMap) {
            window._locLeafletMap = L.map('locLeafletMap', { zoomControl: true, attributionControl: false }).setView([latNum, lonNum], 15);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(window._locLeafletMap);
            const pinIcon = L.divIcon({
              className: '',
              html: '<div style="width:14px;height:14px;border-radius:50%;background:#1a1a1a;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);"></div>',
              iconSize: [14, 14],
              iconAnchor: [7, 7]
            });
            window._locLeafletMarker = L.marker([latNum, lonNum], { icon: pinIcon }).addTo(window._locLeafletMap);
          } else {
            window._locLeafletMap.setView([latNum, lonNum], 15);
            window._locLeafletMarker.setLatLng([latNum, lonNum]);
            window._locLeafletMap.invalidateSize();
          }
        }, 80);
      });

      resultsEl.appendChild(item);
    });

  } catch (e) {
    realStatus.classList.add('hidden');
    searchBtn.disabled = false;
    resultsEl.style.display = 'block';
    resultsEl.innerHTML = '<div style="padding:18px;text-align:center;color:#ccc;font-size:13px;">网络错误，请重试</div>';
  }
}

/* ── 虚拟地点：实时预览 ── */
function updateVirtPreview() {
  const n = virtName.value.trim();
  const a = virtAddr.value.trim();
  if (n) {
    virtMapPrev.style.display = 'block';
    virtPrevName.textContent = n;
    virtPrevAddr.textContent = a || '虚拟位置';
    virtPill.textContent = '虚拟坐标';
    _selected = { name: n, addr: a || '虚拟位置', lat: null, lon: null };
    sendBtn.disabled = false;
  } else {
    virtMapPrev.style.display = 'none';
    _selected = null;
    sendBtn.disabled = true;
  }
}
virtName.addEventListener('input', updateVirtPreview);
virtAddr.addEventListener('input', updateVirtPreview);

/* ── AI 生成（调 chatroom 已有的 crCallApi）── */
aiGenBtn.addEventListener('click', async () => {
  virtStatus.classList.remove('hidden');
  virtStatusTx.textContent = 'AI 生成中…';
  aiGenBtn.disabled = true; aiSugBtn.disabled = true;

  try {
    const text = await crCallApi(
      '你是一个充满想象力的地名生成器，只输出 JSON，不要任何额外文字，每次必须生成全新不重复的地点。',
      [{ role: 'user', content: `用户输入的地点名称提示："${virtName.value.trim() || '随机'}"，地址描述提示："${virtAddr.value.trim() || '随机'}"。请根据这些提示生成一个有趣的虚构地点，可以是现实风格也可以奇幻风格，每次都要不一样。返回格式：{"name":"地点名","addr":"详细地址描述"}` }]
    );
    const clean = text.replace(/```json|```/g, '').trim();
    const obj = JSON.parse(clean);
    virtName.value = obj.name || '';
    virtAddr.value = obj.addr || '';
    updateVirtPreview();
  } catch (e) {
    virtStatusTx.textContent = '生成失败，请重试';
    setTimeout(() => virtStatus.classList.add('hidden'), 1800);
  } finally {
    virtStatus.classList.add('hidden');
    aiGenBtn.disabled = false; aiSugBtn.disabled = false;
  }
});

/* ── AI 给灵感（返回多个选项）── */
aiSugBtn.addEventListener('click', async () => {
  virtStatus.classList.remove('hidden');
  virtStatusTx.textContent = '生成灵感中…';
  aiGenBtn.disabled = true; aiSugBtn.disabled = true;
  aiSuggest.innerHTML = '';

  try {
    const text = await crCallApi(
      '你是一个充满想象力的地名生成器，只输出 JSON 数组，不要任何额外文字，每次必须生成全新不重复的内容。',
      [{ role: 'user', content: `用户输入的灵感提示："${virtName.value.trim() || '随机'}"，地址风格提示："${virtAddr.value.trim() || '随机'}"。请根据这些提示生成 5 个有趣的虚构地点名称，风格各异，每次都要不一样。返回格式：["地点1","地点2","地点3","地点4","地点5"]` }]
    );
    const clean = text.replace(/```json|```/g, '').trim();
    const list = JSON.parse(clean);
    list.forEach(name => {
      const chip = document.createElement('button');
      chip.className = 'loc-sug-chip';
      chip.textContent = name;
      chip.addEventListener('click', () => {
        virtName.value = name;
        updateVirtPreview();
      });
      aiSuggest.appendChild(chip);
    });
  } catch (e) {
    virtStatusTx.textContent = '生成失败，请重试';
    setTimeout(() => virtStatus.classList.add('hidden'), 1800);
  } finally {
    virtStatus.classList.add('hidden');
    aiGenBtn.disabled = false; aiSugBtn.disabled = false;
  }
});

/* ── 发送：生成方案D气泡 ── */
sendBtn.addEventListener('click', () => {
  if (!_selected) return;
  closeModal();

  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
  const coordText = _selected.lat ? `${_selected.lat}°N  ${_selected.lon}°E` : '虚拟坐标';

  /* 存消息 */
  const msgObj = {
    role: 'mine',
    text: '[位置] ' + _selected.name,
    isLocation: true,
    locName: _selected.name,
    locAddr: _selected.addr,
    locCoord: coordText,
    time: t,
  };
  if (typeof crMessages !== 'undefined') crMessages.push(msgObj);
  if (typeof dbSaveMessages === 'function' && typeof CR_NAME !== 'undefined') dbSaveMessages(CR_NAME, crMessages);

  /* 构建方案D气泡 */
  const el = document.createElement('div');
  el.className = 'cr-msg-mine';

  el.innerHTML = `
  <div style="display:flex;flex-direction:column;align-items:flex-end;">
    <div style="width:220px;border-radius:16px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.09);box-shadow:0 4px 20px rgba(0,0,0,0.1);">
      <!-- 地图区 -->
      <div style="width:100%;height:110px;background:#e8e7e0;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.055) 1px,transparent 1px);background-size:18px 18px;"></div>
        <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.28" viewBox="0 0 220 110" fill="none">
          <line x1="0" y1="55" x2="220" y2="55" stroke="#1a1a1a" stroke-width="5"/>
          <line x1="110" y1="0" x2="110" y2="110" stroke="#1a1a1a" stroke-width="3"/>
          <line x1="0" y1="28" x2="75" y2="28" stroke="#1a1a1a" stroke-width="2"/>
          <line x1="150" y1="82" x2="220" y2="82" stroke="#1a1a1a" stroke-width="2"/>
          <line x1="60" y1="0" x2="60" y2="50" stroke="#1a1a1a" stroke-width="1.5"/>
          <line x1="160" y1="60" x2="160" y2="110" stroke="#1a1a1a" stroke-width="1.5"/>
        </svg>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:rgba(26,26,26,0.12);display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(26,26,26,0.15);"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:#1a1a1a;border:2.5px solid #fff;z-index:2;"></div>
        </div>
        <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.92);border:0.5px solid rgba(0,0,0,0.1);border-radius:20px;padding:2px 10px;font-family:'Space Mono',monospace;font-size:9px;font-weight:500;color:#1a1a1a;white-space:nowrap;">${escLoc(coordText)}</div>
      </div>
      <!-- 信息条 -->
      <div style="background:#fff;padding:9px 12px 11px;display:flex;align-items:center;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px;">${escLoc(_selected.name)}</div>
          <div style="font-size:10px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escLoc(_selected.addr)}</div>
        </div>
        <div style="width:24px;height:24px;background:#1a1a1a;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
            <path d="M5 15L15 5M15 5H7M15 5v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>
    </div>
    <div class="cr-mine-meta" style="margin-top:5px;">
      <span class="cr-mine-time">${t}</span>
      <svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none">
        <path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
  </div>`;

  /* 入场动画 */
  el.style.opacity = '0';
  el.style.transform = 'translateY(6px)';
  el.style.transition = 'opacity 0.22s ease,transform 0.22s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = '';
  }));
});

/* ── 暴露给外部 ── */
window.crOpenLocationModal = openModal;

})();

/* ================================================================
   礼物页 — Gift Page
================================================================ */
(function () {

const GIFT_CATS = ['全部','饰品','数码','日用','美妆','书籍','食品','体验','虚拟'];

const GIFT_ARTS = {
  饰品: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <circle cx="60" cy="60" r="38" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.6" opacity="0.25"/>
    <circle cx="60" cy="60" r="22" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.8" opacity="0.4"/>
    <circle cx="60" cy="60" r="6" fill="${dark?'#fff':'#1a1a1a'}" opacity="0.5"/>
    <line x1="60" y1="22" x2="60" y2="38" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.3"/>
    <line x1="60" y1="82" x2="60" y2="98" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.3"/>
    <line x1="22" y1="60" x2="38" y2="60" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.3"/>
    <line x1="82" y1="60" x2="98" y2="60" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.3"/>
  </svg>`,
  数码: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <rect x="28" y="35" width="64" height="44" rx="5" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.7" opacity="0.3"/>
    <line x1="28" y1="52" x2="92" y2="52" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.4" opacity="0.18"/>
    <rect x="38" y="42" width="10" height="6" rx="1.5" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.3"/>
    <line x1="50" y1="79" x2="70" y2="79" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="1.5" stroke-linecap="round" opacity="0.35"/>
    <circle cx="85" cy="45" r="3" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.3"/>
  </svg>`,
  日用: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <path d="M42 75 Q42 42 60 38 Q78 42 78 75 L74 82 H46Z" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.6" opacity="0.3" fill="none"/>
    <line x1="60" y1="38" x2="60" y2="28" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.8" stroke-linecap="round" opacity="0.35"/>
    <line x1="46" y1="82" x2="74" y2="82" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="1.2" stroke-linecap="round" opacity="0.4"/>
    <line x1="48" y1="65" x2="72" y2="65" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.4" opacity="0.2" stroke-dasharray="2 3"/>
  </svg>`,
  美妆: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <rect x="50" y="30" width="20" height="52" rx="10" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.7" opacity="0.3"/>
    <rect x="54" y="26" width="12" height="8" rx="3" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.25"/>
    <line x1="50" y1="55" x2="70" y2="55" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.4" opacity="0.2"/>
    <circle cx="85" cy="50" r="12" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.2"/>
    <path d="M80 46 Q85 42 90 46 Q85 50 80 46Z" fill="${dark?'#fff':'#1a1a1a'}" opacity="0.2"/>
  </svg>`,
  书籍: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <rect x="35" y="30" width="36" height="56" rx="3" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.7" opacity="0.3"/>
    <line x1="35" y1="30" x2="35" y2="86" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="2.5" stroke-linecap="round" opacity="0.4"/>
    <line x1="44" y1="44" x2="62" y2="44" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.22"/>
    <line x1="44" y1="51" x2="62" y2="51" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.22"/>
    <line x1="44" y1="58" x2="55" y2="58" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.22"/>
    <rect x="75" y="38" width="12" height="44" rx="2" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.18"/>
  </svg>`,
  食品: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <path d="M38 55 Q38 35 60 35 Q82 35 82 55 L78 85 H42Z" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.6" opacity="0.28" fill="none"/>
    <path d="M48 52 Q60 44 72 52" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.22" fill="none"/>
    <line x1="42" y1="85" x2="78" y2="85" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="1.2" stroke-linecap="round" opacity="0.38"/>
    <circle cx="60" cy="62" r="8" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.22"/>
  </svg>`,
  体验: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <path d="M30 78 Q30 42 60 32 Q90 42 90 78" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.6" opacity="0.28" fill="none"/>
    <circle cx="60" cy="60" r="14" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.7" opacity="0.35"/>
    <path d="M56 56 L68 60 L56 64Z" fill="${dark?'#fff':'#1a1a1a'}" opacity="0.4"/>
    <line x1="30" y1="82" x2="90" y2="82" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.2" stroke-dasharray="3 4"/>
  </svg>`,
  虚拟: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <rect x="32" y="38" width="56" height="40" rx="5" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.6" opacity="0.28"/>
    <circle cx="60" cy="58" r="10" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.7" opacity="0.35"/>
    <circle cx="60" cy="58" r="3" fill="${dark?'#fff':'#1a1a1a'}" opacity="0.45"/>
    <line x1="60" y1="78" x2="60" y2="88" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.25"/>
    <line x1="48" y1="88" x2="72" y2="88" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="1" stroke-linecap="round" opacity="0.3"/>
  </svg>`,
  default: (dark) => `<svg viewBox="0 0 120 120" fill="none">
    <rect x="36" y="52" width="48" height="38" rx="3" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.6" opacity="0.28"/>
    <rect x="34" y="42" width="52" height="14" rx="3" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.6" opacity="0.28"/>
    <line x1="60" y1="42" x2="60" y2="90" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.18"/>
    <path d="M60 42 C60 42 52 30 44 33 C36 36 44 42 60 42Z" fill="none" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.25"/>
    <path d="M60 42 C60 42 68 30 76 33 C84 36 76 42 60 42Z" fill="none" stroke="${dark?'#fff':'#1a1a1a'}" stroke-width="0.5" opacity="0.25"/>
  </svg>`,
};

function getArtFn(cat) {
  return GIFT_ARTS[cat] || GIFT_ARTS.default;
}

/* ── 数据存取 ── */
function giftLoad() {
  try { return JSON.parse(localStorage.getItem('luna_gifts_' + CR_NAME) || '[]'); }
  catch(e) { return []; }
}
function giftSave(list) {
  try { localStorage.setItem('luna_gifts_' + CR_NAME, JSON.stringify(list)); }
  catch(e) {}
}

/* ── 当前分类 ── */
let _giftCat = '全部';

/* ── 渲染 Tab ── */
function giftRenderTabs() {
  const bar = document.getElementById('giftTabs');
  if (!bar) return;
  bar.innerHTML = GIFT_CATS.map(c =>
    `<button class="gift-tab${c===_giftCat?' active':''}" data-cat="${c}">${c}</button>`
  ).join('');
  bar.querySelectorAll('.gift-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      _giftCat = btn.dataset.cat;
      giftRenderTabs();
      giftRenderGrid();
    });
  });
}

/* ── 渲染网格 ── */
function giftRenderGrid() {
  const grid  = document.getElementById('giftGrid');
  const empty = document.getElementById('giftEmpty');
  if (!grid) return;
  const all  = giftLoad();
  const list = _giftCat === '全部' ? all : all.filter(g => g.cat === _giftCat);

  if (!list.length) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }
  grid.style.display = 'grid';
  empty.style.display = 'none';

  grid.innerHTML = '';
  list.forEach((g, i) => {
    const dark = !!(i % 3 === 0);
    const artFn = getArtFn(g.cat);
    const card = document.createElement('div');
    card.className = 'gift-card';
    card.innerHTML = `
      <div class="gift-card-art ${dark?'gift-card-art-dark':''}">
        <div class="gift-card-noise"></div>
        ${artFn(dark)}
      </div>
      <div class="gift-card-body">
        <div class="gift-card-tag">${g.cat || '礼物'}</div>
        <div class="gift-card-name">${escHtml(g.name)}</div>
        <div class="gift-card-desc">${escHtml(g.desc||'')}</div>
        <div class="gift-card-price">
          <span class="gift-card-price-val">${g.price ? '¥'+g.price : '—'}</span>
          <button class="gift-card-send-btn" title="发送">
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
              <path d="M18 2L10 10M18 2L12.5 18L10 10L2 7.5L18 2Z" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>`;

    card.querySelector('.gift-card-send-btn').addEventListener('click', e => {
      e.stopPropagation();
      giftSendToChat(g, '送给Ta');
    });
    card.addEventListener('click', () => giftOpenDetail(g, dark));
    grid.appendChild(card);
  });
}

/* ── 发送礼物消息到聊天 ── */
function giftSendToChat(g, action) {
  crOpenGiftPage(false);
  const text = `[礼物] ${action}：${g.name}${g.price?'（¥'+g.price+'）':''}${g.desc?' — '+g.desc:''}`;
  setTimeout(() => {
    const area = document.getElementById('crMessages');
    if (!area) return;
    const n = new Date();
    const t = n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0');
    const msgObj = { role:'mine', text, isGift:true, giftName:g.name, giftAction:action, time:t };
    crMessages.push(msgObj);
    dbSaveMessages(CR_NAME, crMessages);

    const el = document.createElement('div');
    el.className = 'cr-msg-mine';
    const dark = false;
    const artFn = getArtFn(g.cat);
    el.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:flex-end;">
        <div style="width:200px;border-radius:18px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.08);">
          <div style="height:130px;background:${dark?'#1a1a1a':'#f5f5f5'};display:flex;align-items:center;justify-content:center;position:relative;">
            <div style="width:60%;height:60%;">${artFn(dark)}</div>
            <div style="position:absolute;top:10px;left:12px;font-family:'Space Mono',monospace;font-size:7.5px;letter-spacing:2px;color:${dark?'rgba(255,255,255,0.35)':'rgba(0,0,0,0.25)'};text-transform:uppercase;">${g.cat||'礼物'}</div>
          </div>
          <div style="background:#fff;padding:11px 13px 13px;border-top:0.5px solid rgba(0,0,0,0.06);">
            <div style="font-size:7.5px;font-family:'Space Mono',monospace;letter-spacing:2px;color:#c8c8c8;text-transform:uppercase;margin-bottom:4px;">${escHtml(action)}</div>
            <div style="font-size:14px;font-weight:600;color:#1a1a1a;letter-spacing:-.2px;margin-bottom:3px;">${escHtml(g.name)}</div>
            ${g.price?`<div style="font-family:'Space Mono',monospace;font-size:11px;color:#888;">¥${g.price}</div>`:''}
          </div>
        </div>
        <div class="cr-mine-meta" style="margin-top:5px;">
          <span class="cr-mine-time">${t}</span>
        </div>
      </div>`;

    el.style.cssText = 'opacity:0;transform:translateY(8px);transition:opacity 0.28s ease,transform 0.28s ease;';
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      el.style.opacity='1'; el.style.transform='translateY(0)';
    }));
  }, 350);
}

/* ── 礼物详情弹窗 ── */
function giftOpenDetail(g, dark) {
  const overlay = document.getElementById('giftDetailOverlay');
  const sheet   = document.getElementById('giftDetailSheet');
  if (!overlay || !sheet) return;

  const artFn = getArtFn(g.cat);
  const artEl = document.getElementById('giftDetailArt');
  artEl.className = 'gift-detail-art' + (dark ? ' gift-detail-art-dark' : '');
  artEl.innerHTML = `<div style="width:55%;height:55%;">${artFn(dark)}</div>`;

  document.getElementById('giftDetailCat').textContent  = g.cat || '礼物';
  document.getElementById('giftDetailName').textContent = g.name;
  document.getElementById('giftDetailDesc').textContent = g.desc || '';
  document.getElementById('giftDetailPrice').textContent = g.price ? '¥' + g.price : '';

  const closeDetail = () => {
    sheet.classList.remove('gift-detail-in');
    setTimeout(() => { overlay.style.display = 'none'; }, 340);
  };

  document.getElementById('giftActWant').onclick = () => { closeDetail(); giftSendToChat(g, '我想要'); };
  document.getElementById('giftActGive').onclick = () => { closeDetail(); giftSendToChat(g, '送给Ta'); };
  document.getElementById('giftActReceive').onclick = () => { closeDetail(); giftSendToChat(g, 'Ta送我'); };

  overlay.style.display = 'flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    sheet.classList.add('gift-detail-in');
  }));
  overlay.addEventListener('click', function onBg(e) {
    if (e.target === overlay) { closeDetail(); overlay.removeEventListener('click', onBg); }
  });
}

/* ── 添加弹窗 ── */
let _selectedCat = '';
function giftOpenAdd() {
  const overlay = document.getElementById('giftAddOverlay');
  const sheet   = document.getElementById('giftAddSheet');
  if (!overlay) return;

  document.getElementById('giftInpName').value  = '';
  document.getElementById('giftInpDesc').value  = '';
  document.getElementById('giftInpPrice').value = '';
  document.getElementById('giftInpCat').value   = '';
  document.getElementById('giftIdeaInp').style.display = 'none';
  document.getElementById('giftIdeaInp').value  = '';
  _selectedCat = '';

  const chips = document.getElementById('giftCatChips');
  chips.innerHTML = GIFT_CATS.filter(c=>c!=='全部').map(c=>
    `<button class="gift-cat-chip" data-cat="${c}">${c}</button>`
  ).join('');
  chips.querySelectorAll('.gift-cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      chips.querySelectorAll('.gift-cat-chip').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      _selectedCat = btn.dataset.cat;
      document.getElementById('giftInpCat').value = _selectedCat;
    });
  });

  overlay.style.display = 'flex';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    sheet.classList.add('gift-add-in');
  }));
}
function giftCloseAdd() {
  const sheet = document.getElementById('giftAddSheet');
  sheet.classList.remove('gift-add-in');
  setTimeout(()=>{ document.getElementById('giftAddOverlay').style.display='none'; }, 340);
}

/* AI 随机生成 */
document.getElementById('giftAiRandBtn').addEventListener('click', async () => {
  const statusEl = document.getElementById('giftAiStatus');
  const statusTxt = document.getElementById('giftAiStatusTxt');
  statusEl.classList.remove('hidden');
  statusTxt.textContent = 'AI 随机生成中…';
  try {
    const raw = await crCallApi(
      '你是一个礼物创意生成器，只输出JSON，不要任何额外文字。',
      [{ role:'user', content:`生成一个有创意的礼物，适合作为AI虚拟伴侣送给用户或用户送给AI伴侣的礼物。
返回格式：{"name":"礼物名称","desc":"一句话描述（20字内）","price":"参考价格纯数字","cat":"分类（饰品/数码/日用/美妆/书籍/食品/体验/虚拟之一）"}` }]
    );
    const obj = JSON.parse(raw.replace(/```json|```/g,'').trim());
    document.getElementById('giftInpName').value  = obj.name  || '';
    document.getElementById('giftInpDesc').value  = obj.desc  || '';
    document.getElementById('giftInpPrice').value = obj.price || '';
    document.getElementById('giftInpCat').value   = obj.cat   || '';
    _selectedCat = obj.cat || '';
    document.querySelectorAll('.gift-cat-chip').forEach(b=>{
      b.classList.toggle('selected', b.dataset.cat === _selectedCat);
    });
  } catch(e) {
    statusTxt.textContent = '生成失败，请重试';
    setTimeout(()=>statusEl.classList.add('hidden'), 1800);
    return;
  }
  statusEl.classList.add('hidden');
});

/* AI 按思路生成 */
document.getElementById('giftAiIdeaBtn').addEventListener('click', () => {
  const inp = document.getElementById('giftIdeaInp');
  inp.style.display = inp.style.display === 'none' ? 'block' : 'none';
  if (inp.style.display === 'block') inp.focus();
});
document.getElementById('giftIdeaInp').addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const idea = e.target.value.trim();
  if (!idea) return;
  const statusEl  = document.getElementById('giftAiStatus');
  const statusTxt = document.getElementById('giftAiStatusTxt');
  statusEl.classList.remove('hidden');
  statusTxt.textContent = 'AI 思考中…';
  try {
    const raw = await crCallApi(
      '你是一个礼物创意生成器，只输出JSON，不要任何额外文字。',
      [{ role:'user', content:`根据以下思路生成一个礼物创意：「${idea}」
返回格式：{"name":"礼物名称","desc":"一句话描述（20字内）","price":"参考价格纯数字","cat":"分类（饰品/数码/日用/美妆/书籍/食品/体验/虚拟之一）"}` }]
    );
    const obj = JSON.parse(raw.replace(/```json|```/g,'').trim());
    document.getElementById('giftInpName').value  = obj.name  || '';
    document.getElementById('giftInpDesc').value  = obj.desc  || '';
    document.getElementById('giftInpPrice').value = obj.price || '';
    document.getElementById('giftInpCat').value   = obj.cat   || '';
    _selectedCat = obj.cat || '';
    document.querySelectorAll('.gift-cat-chip').forEach(b=>{
      b.classList.toggle('selected', b.dataset.cat === _selectedCat);
    });
  } catch(e) {
    statusTxt.textContent = '生成失败，请重试';
    setTimeout(()=>statusEl.classList.add('hidden'), 1800);
    return;
  }
  statusEl.classList.add('hidden');
});

/* 提交 */
document.getElementById('giftAddSubmit').addEventListener('click', () => {
  const name  = document.getElementById('giftInpName').value.trim();
  if (!name) { document.getElementById('giftInpName').focus(); return; }
  const desc  = document.getElementById('giftInpDesc').value.trim();
  const price = document.getElementById('giftInpPrice').value.trim();
  const cat   = document.getElementById('giftInpCat').value.trim() || _selectedCat || '礼物';
  const list  = giftLoad();
  list.unshift({ id: Date.now(), name, desc, price, cat });
  giftSave(list);
  giftCloseAdd();
  giftRenderTabs();
  giftRenderGrid();
});

document.getElementById('giftAddClose').addEventListener('click', giftCloseAdd);
document.getElementById('giftAddOverlay').addEventListener('click', e => {
  if (e.target === document.getElementById('giftAddOverlay')) giftCloseAdd();
});

/* ── 打开/关闭礼物页 ── */
function crOpenGiftPage(open = true) {
  const page = document.getElementById('giftPage');
  if (!page) return;
  if (open) {
    // 同步状态栏
    const t = document.getElementById('crTime');
    const gt = document.getElementById('giftTime');
    if (t && gt) gt.textContent = t.textContent;
    const bp  = document.getElementById('batPct');
    const gbp = document.getElementById('giftBatPct');
    if (bp && gbp) gbp.textContent = bp.textContent;
    const bi  = document.getElementById('batInner');
    const gbi = document.getElementById('giftBatInner');
    if (bi && gbi) { gbi.style.width = bi.style.width; gbi.style.background = bi.style.background; }
    _giftCat = '全部';
    giftRenderTabs();
    giftRenderGrid();
    page.classList.add('gift-open');
  } else {
    page.classList.remove('gift-open');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const backBtn = document.getElementById('giftBackBtn');
  if (backBtn) backBtn.addEventListener('click', () => crOpenGiftPage(false));
  const addBtn = document.getElementById('giftAddBtn');
  if (addBtn) addBtn.addEventListener('click', giftOpenAdd);
});

window.crOpenGiftPage = crOpenGiftPage;

})();

/* ================================
   Feature Panel — 13 功能卡
================================ */
(function(){

const FP_CARDS = [
  { no:'01', tag:'History',  title:'重回',  sub:'时光倒流', desc:'对Ta的回复不满意？告诉Ta哪里不对，重新来一次。',
    art:'history',  bg:'#1a1a1a' },
  { no:'02', tag:'Image',    title:'图片',  sub:'视觉记忆', desc:'分享照片，让Ta看见你的世界。',
    art:'image',    bg:'#f7f5f2' },
  { no:'03', tag:'Meme',     title:'表情包',sub:'情绪表达', desc:'一张图胜过千言万语。',
    art:'meme',     bg:'#2a2a2a' },
  { no:'04', tag:'Voice',    title:'语音',  sub:'声音印记', desc:'用声音传递最真实的情感。',
    art:'voice',    bg:'#111' },
  { no:'05', tag:'Video',    title:'视频',  sub:'动态瞬间', desc:'把最美的一帧留给彼此。',
    art:'video',    bg:'#1c1c1c' },
  { no:'06', tag:'Location', title:'位置',  sub:'此刻所在', desc:'告诉Ta你在哪里，Ta总在这里。',
    art:'location', bg:'#f5f5f0' },
  { no:'07', tag:'Transfer', title:'转账',  sub:'心意流转', desc:'数字温情，轻轻传递。',
    art:'transfer', bg:'#fafafa' },
  { no:'08', tag:'Hongbao',  title:'红包',  sub:'惊喜彩蛋', desc:'随手一份红，带来好运气。',
    art:'hongbao',  bg:'#1a1a1a' },
  { no:'09', tag:'Whisper',  title:'心声',  sub:'私密倾诉', desc:'只有你们两个人知道的秘密。',
    art:'whisper',  bg:'#2c2828' },
  { no:'10', tag:'Offline',  title:'线下',  sub:'真实相遇', desc:'从屏幕走向现实的约定。',
    art:'offline',  bg:'#f0ede8' },
  { no:'11', tag:'Theatre',  title:'小剧场', sub:'角色扮演', desc:'设定情景，与Ta共同演绎专属故事。',
    art:'theatre',  bg:'#1a1218' },
  { no:'12', tag:'Gift',     title:'礼物',  sub:'惊喜盒子', desc:'每天解锁一份专属的彩蛋。',
    art:'gift',     bg:'#fafafa' },
  { no:'13', tag:'Journey',  title:'旅程',  sub:'共同成长', desc:'记录你们走过的每一段路。',
    art:'journey',  bg:'#1a1a1a' },
  { no:'14', tag:'Private',  title:'私密',  sub:'专属空间', desc:'只属于你们，加密且唯一。',
    art:'private',  bg:'#111' },
];

function makeArt(type, bg){
  const dark = bg.startsWith('#1') || bg.startsWith('#2') || bg === '#111';
  const fg = dark ? '#fff' : '#1a1a1a';
  const fgo = dark ? 'rgba(255,255,255,' : 'rgba(26,26,26,';

  const arts = {
    history:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="88" r="42" stroke="${fg}" stroke-width="0.5" opacity="0.2"/>
      <circle cx="80" cy="88" r="28" stroke="${fg}" stroke-width="0.7" opacity="0.35"/>
      <line x1="80" y1="88" x2="80" y2="64" stroke="${fg}" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      <line x1="80" y1="88" x2="96" y2="96" stroke="${fg}" stroke-width="0.9" stroke-linecap="round" opacity="0.5"/>
      <circle cx="80" cy="88" r="3" fill="${fg}" opacity="0.7"/>
      <path d="M52 88 Q56 72 68 66" stroke="${fg}" stroke-width="0.5" opacity="0.25" fill="none" stroke-dasharray="2 3"/>
      <text x="80" y="168" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.28)" letter-spacing="3">HISTORY</text>
    </svg>`,
    image:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="35" y="45" width="90" height="100" rx="4" stroke="${fg}" stroke-width="0.6" opacity="0.25"/>
      <circle cx="60" cy="72" r="10" stroke="${fg}" stroke-width="0.5" opacity="0.3"/>
      <path d="M35 118 L65 90 L88 112 L105 94 L125 118" stroke="${fg}" stroke-width="0.7" opacity="0.3" fill="none"/>
      <text x="80" y="172" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">IMAGE</text>
    </svg>`,
    meme:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="85" r="40" stroke="${fg}" stroke-width="0.6" opacity="0.22"/>
      <circle cx="66" cy="76" r="5" fill="${fg}" opacity="0.3"/>
      <circle cx="94" cy="76" r="5" fill="${fg}" opacity="0.3"/>
      <path d="M60 98 Q80 116 100 98" stroke="${fg}" stroke-width="1.2" stroke-linecap="round" fill="none" opacity="0.45"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">MEME</text>
    </svg>`,
    voice:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <g opacity="0.5">
        <line x1="38" y1="92" x2="38" y2="108" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="50" y1="80" x2="50" y2="120" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="62" y1="70" x2="62" y2="130" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="74" y1="82" x2="74" y2="118" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="80" y1="62" x2="80" y2="138" stroke="${fg}" stroke-width="1.4" stroke-linecap="round"/>
        <line x1="86" y1="75" x2="86" y2="125" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="98" y1="84" x2="98" y2="116" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="110" y1="78" x2="110" y2="122" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
        <line x1="122" y1="90" x2="122" y2="110" stroke="${fg}" stroke-width="1.1" stroke-linecap="round"/>
      </g>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">VOICE</text>
    </svg>`,
    video:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="28" y="68" width="72" height="52" rx="5" stroke="${fg}" stroke-width="0.6" opacity="0.3"/>
      <path d="M102 82 L126 72 L126 116 L102 106Z" stroke="${fg}" stroke-width="0.6" opacity="0.3" fill="none"/>
      <circle cx="64" cy="94" r="12" fill="none" stroke="${fg}" stroke-width="0.5" opacity="0.2"/>
      <path d="M60 90 L74 94 L60 98Z" fill="${fg}" opacity="0.25"/>
      <text x="80" y="172" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">VIDEO</text>
    </svg>`,
    location:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="78" r="26" stroke="${fg}" stroke-width="0.6" opacity="0.25"/>
      <circle cx="80" cy="78" r="8" fill="none" stroke="${fg}" stroke-width="0.8" opacity="0.5"/>
      <path d="M80 52 L80 104 M54 78 L106 78" stroke="${fg}" stroke-width="0.4" opacity="0.15" stroke-dasharray="3 4"/>
      <path d="M80 110 Q80 130 80 138" stroke="${fg}" stroke-width="1" opacity="0.3" stroke-linecap="round"/>
      <circle cx="80" cy="140" r="3" fill="${fg}" opacity="0.3"/>
      <text x="80" y="172" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">LOCATION</text>
    </svg>`,
    transfer:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="40" y="60" width="80" height="52" rx="6" stroke="${fg}" stroke-width="0.6" opacity="0.22"/>
      <line x1="40" y1="78" x2="120" y2="78" stroke="${fg}" stroke-width="0.5" opacity="0.15"/>
      <text x="80" y="95" text-anchor="middle" font-family="serif" font-size="18" fill="${fgo}0.3)">¥</text>
      <path d="M55 128 L80 118 L105 128" stroke="${fg}" stroke-width="0.6" opacity="0.2" fill="none"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">TRANSFER</text>
    </svg>`,
    hongbao:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="44" y="55" width="72" height="90" rx="6" stroke="${fg}" stroke-width="0.6" opacity="0.3"/>
      <path d="M44 78 L80 95 L116 78" stroke="${fg}" stroke-width="0.5" opacity="0.25" fill="none"/>
      <circle cx="80" cy="110" r="14" stroke="${fg}" stroke-width="0.6" opacity="0.3"/>
      <text x="80" y="115" text-anchor="middle" font-family="serif" font-size="12" fill="${fgo}0.35)">福</text>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">HONGBAO</text>
    </svg>`,
    whisper:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <path d="M30 75 Q30 55 50 55 L110 55 Q130 55 130 75 L130 100 Q130 120 110 120 L95 120 L80 140 L80 120 L50 120 Q30 120 30 100Z"
        stroke="${fg}" stroke-width="0.6" opacity="0.28" fill="none"/>
      <line x1="50" y1="78" x2="110" y2="78" stroke="${fg}" stroke-width="0.4" opacity="0.2"/>
      <line x1="50" y1="88" x2="90" y2="88" stroke="${fg}" stroke-width="0.4" opacity="0.2"/>
      <line x1="50" y1="98" x2="105" y2="98" stroke="${fg}" stroke-width="0.4" opacity="0.2"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">WHISPER</text>
    </svg>`,
    offline:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <circle cx="80" cy="82" r="35" stroke="${fg}" stroke-width="0.5" opacity="0.18"/>
      <line x1="46" y1="82" x2="114" y2="82" stroke="${fg}" stroke-width="0.4" opacity="0.18"/>
      <ellipse cx="80" cy="82" rx="18" ry="35" stroke="${fg}" stroke-width="0.4" opacity="0.18"/>
      <circle cx="80" cy="82" r="4" fill="${fg}" opacity="0.35"/>
      <line x1="55" y1="130" x2="105" y2="130" stroke="${fg}" stroke-width="0.6" opacity="0.22"/>
      <line x1="65" y1="136" x2="95" y2="136" stroke="${fg}" stroke-width="0.4" opacity="0.15"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">OFFLINE</text>
    </svg>`,
    theatre:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
      <path d="M28 55 Q28 48 36 48 L124 48 Q132 48 132 55 L132 65 Q132 70 124 70 L36 70 Q28 70 28 65Z"
        stroke="${fg}" stroke-width="0.6" opacity="0.35" fill="none"/>
      <path d="M36 70 Q32 90 34 130" stroke="${fg}" stroke-width="1.2" stroke-linecap="round" opacity="0.4" fill="none"/>
      <path d="M44 70 Q38 88 40 120" stroke="${fg}" stroke-width="0.5" stroke-linecap="round" opacity="0.2" fill="none"/>
      <path d="M124 70 Q128 90 126 130" stroke="${fg}" stroke-width="1.2" stroke-linecap="round" opacity="0.4" fill="none"/>
      <path d="M116 70 Q122 88 120 120" stroke="${fg}" stroke-width="0.5" stroke-linecap="round" opacity="0.2" fill="none"/>
      <circle cx="68" cy="100" r="14" stroke="${fg}" stroke-width="0.6" opacity="0.45" fill="none"/>
      <path d="M62 104 Q68 112 74 104" stroke="${fg}" stroke-width="0.8" stroke-linecap="round" fill="none" opacity="0.5"/>
      <circle cx="64" cy="96" r="2" fill="${fg}" opacity="0.4"/>
      <circle cx="72" cy="96" r="2" fill="${fg}" opacity="0.4"/>
      <circle cx="96" cy="100" r="14" stroke="${fg}" stroke-width="0.6" opacity="0.35" fill="none"/>
      <path d="M90 108 Q96 100 102 108" stroke="${fg}" stroke-width="0.8" stroke-linecap="round" fill="none" opacity="0.4"/>
      <circle cx="92" cy="96" r="2" fill="${fg}" opacity="0.3"/>
      <circle cx="100" cy="96" r="2" fill="${fg}" opacity="0.3"/>
      <line x1="28" y1="130" x2="132" y2="130" stroke="${fg}" stroke-width="0.5" opacity="0.2"/>
      <line x1="34" y1="136" x2="126" y2="136" stroke="${fg}" stroke-width="0.3" opacity="0.12" stroke-dasharray="3 4"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">THEATRE</text>
    </svg>`,
    gift:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="48" y="85" width="64" height="52" rx="2" fill="none" stroke="${fg}" stroke-width="0.6" opacity="0.28"/>
      <rect x="46" y="72" width="68" height="16" rx="2" fill="none" stroke="${fg}" stroke-width="0.6" opacity="0.28"/>
      <line x1="80" y1="72" x2="80" y2="137" stroke="${fg}" stroke-width="0.5" opacity="0.18"/>
      <path d="M80 72 C80 72 70 58 62 61 C54 64 62 72 80 72Z" fill="none" stroke="${fg}" stroke-width="0.5" opacity="0.25"/>
      <path d="M80 72 C80 72 90 58 98 61 C106 64 98 72 80 72Z" fill="none" stroke="${fg}" stroke-width="0.5" opacity="0.25"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">GIFT</text>
    </svg>`,
    journey:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <path d="M28 120 Q55 60 80 80 Q105 100 132 45" stroke="${fg}" stroke-width="0.8" fill="none" opacity="0.35"/>
      <circle cx="28"  cy="120" r="3" fill="${fg}" opacity="0.4"/>
      <circle cx="80"  cy="80"  r="3" fill="${fg}" opacity="0.55"/>
      <circle cx="132" cy="45"  r="3" fill="${fg}" opacity="0.4"/>
      <line x1="28" y1="120" x2="28" y2="138" stroke="${fg}" stroke-width="0.4" opacity="0.2" stroke-dasharray="2 2"/>
      <line x1="80" y1="80"  x2="80" y2="138" stroke="${fg}" stroke-width="0.4" opacity="0.2" stroke-dasharray="2 2"/>
      <line x1="132" y1="45" x2="132" y2="138" stroke="${fg}" stroke-width="0.4" opacity="0.2" stroke-dasharray="2 2"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">JOURNEY</text>
    </svg>`,
    private:`<svg class="card-mono-art" viewBox="0 0 160 200" fill="none">
       
      <rect x="56" y="88" width="48" height="38" rx="4" stroke="${fg}" stroke-width="0.6" opacity="0.4"/>
      <path d="M66 88 L66 78 Q66 58 80 58 Q94 58 94 78 L94 88" stroke="${fg}" stroke-width="0.6" opacity="0.4" fill="none"/>
      <circle cx="80" cy="107" r="5" fill="${fg}" opacity="0.35"/>
      <line x1="80" y1="112" x2="80" y2="120" stroke="${fg}" stroke-width="1" opacity="0.25" stroke-linecap="round"/>
      <text x="80" y="170" text-anchor="middle" font-family="serif" font-size="9" fill="${fgo}0.25)" letter-spacing="3">PRIVATE</text>
    </svg>`,
  };
  return arts[type] || arts.history;
}

const stage   = document.getElementById('fpStage');
const dotsEl  = document.getElementById('fpDots');
const SPREAD  = 20;
let fpCurrent = Math.floor(FP_CARDS.length / 2);
let isDrag = false, startX = 0, lastX = 0, dragDelta = 0;
const cardEls = [];

function getAngle(i){ return 0; }
function getZ(i){ return FP_CARDS.length - Math.abs(i - fpCurrent); }
function getOp(i){
  const d = Math.abs(i - fpCurrent);
  return d === 0 ? 1 : d === 1 ? 0.7 : d === 2 ? 0.4 : 0;
}
function getSc(i){
  const d = Math.abs(i - fpCurrent);
  return d === 0 ? 1 : d === 1 ? 0.88 : 0.78;
}

FP_CARDS.forEach((c, i) => {
  const el = document.createElement('div');
  el.className = 'fp-card';
  el.innerHTML = `
    <div class="fp-card-art" style="background:${c.bg}">${makeArt(c.art, c.bg)}</div>
    <div class="fp-card-no">${c.no}</div>
    <div class="fp-card-footer">
      <div class="fp-card-tag">${c.tag}</div>
      <div class="fp-card-title">${c.title}</div>
      <div class="fp-card-sub">${c.sub}</div>
    </div>`;
  el.addEventListener('click', () => {
    if (Math.abs(dragDelta) < 5) {
      i === fpCurrent ? updateDetail() : goTo(i);
    }
  });
  stage.appendChild(el);
  cardEls.push(el);

  const dot = document.createElement('div');
  dot.className = 'fan-dot' + (i === fpCurrent ? ' active' : '');
  dot.addEventListener('click', () => goTo(i));
  dotsEl.appendChild(dot);
});

function updateCards(live = 0){
  const stageW = stage.offsetWidth || 340;
  const centerX = stageW / 2;
  const cardW = 160;
  const gap = 170;

  cardEls.forEach((el, i) => {
    const offset = (i - fpCurrent) + live;
    const x = centerX - cardW / 2 + offset * gap;
    const d = Math.abs(i - fpCurrent);
    const arcY = d === 0 ? 35 : d === 1 ? 42 : 60;
const rot = (i - fpCurrent) * 30;
const sc = getSc(i);
const op = getOp(i);
el.style.transform = `translateX(${x}px) translateY(${arcY}px) rotate(${rot}deg) scale(${sc})`;
    el.style.zIndex  = getZ(i);
    el.style.opacity = op;
    el.style.pointerEvents = op === 0 ? 'none' : 'auto';
  });
}

function updateDots(){
  dotsEl.querySelectorAll('.fan-dot').forEach((d, i) => {
    d.className = 'fan-dot' + (i === fpCurrent ? ' active' : '');
  });
}

function updateDetail(){
  const d = FP_CARDS[fpCurrent];
  document.getElementById('fpDetailName').textContent = d.title;
  document.getElementById('fpDetailDesc').textContent = d.desc;
  document.getElementById('fpDetailIcon').innerHTML =
    `<svg width="18" height="18" viewBox="0 0 20 20" fill="none">
       <text x="10" y="14" text-anchor="middle" font-family="serif" font-size="13" fill="#888">${d.title[0]}</text>
     </svg>`;
}

function goTo(idx){
  fpCurrent = Math.max(0, Math.min(FP_CARDS.length - 1, idx));
  updateCards();
  updateDots();
  updateDetail();
}

updateCards();
updateDetail();

document.getElementById('fpPrev').addEventListener('click', () => goTo(fpCurrent - 1));
document.getElementById('fpNext').addEventListener('click', () => goTo(fpCurrent + 1));

stage.addEventListener('pointerdown', e => {
  isDrag = true; startX = e.clientX; lastX = e.clientX; dragDelta = 0;
  e.stopPropagation();
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!isDrag) return;
  lastX = e.clientX; dragDelta = lastX - startX;
  updateCards(dragDelta * -0.12);
});
stage.addEventListener('pointerup', e => {
  if (!isDrag) return; isDrag = false;
  dragDelta = lastX - startX;
  if (Math.abs(dragDelta) > 40) goTo(fpCurrent + (dragDelta < 0 ? 1 : -1));
  else updateCards();
  dragDelta = Math.abs(dragDelta);
  try { stage.releasePointerCapture(e.pointerId); } catch(_) {}
});
stage.addEventListener('pointercancel', e => {
  isDrag = false; updateCards();
  try { stage.releasePointerCapture(e.pointerId); } catch(_) {}
});

/* ── 开关 overlay ── */
const overlay = document.getElementById('featureOverlay');

function openFP(){ overlay.classList.add('open'); }
function closeFP(){ overlay.classList.remove('open'); }

document.getElementById('fpCloseBtn').addEventListener('click', closeFP);
document.getElementById('overlayBackdrop').addEventListener('click', closeFP);

/* 绑定 + 按钮 */
const addBtn = document.querySelector('.cr-add-btn');
if (addBtn) addBtn.addEventListener('click', openFP);

/* ── 功能卡片点击执行 ── */
function handleCardAction(tag) {
  closeFP();
  if (tag === 'History') {
    crTriggerRewindFromPanel();
  } else if (tag === 'Image') {
    crPickImage();
  } else if (tag === 'Meme') {
    crOpenMemePanel();
  } else if (tag === 'Voice') {
    crOpenVoiceModal();
  } else if (tag === 'Video') {
    crLaunchVideoCall();
  } else if (tag === 'Location') {
    crOpenLocationModal();
  } else if (tag === 'Transfer') {
    crOpenTransferModal();
  } else if (tag === 'Hongbao') {
    crOpenHongbaoModal();
  } else if (tag === 'Whisper') {
    crOpenWhisperPanel();
  } else if (tag === 'Gift') {
    crOpenGiftPage();
  } else if (tag === 'Offline') {
    window.location.href = 'offline_chat.html';
  } else if (tag === 'Theatre') {
    const charName = (typeof CR_NAME !== 'undefined' && CR_NAME) ? CR_NAME : 'Luna';
    window.location.href = 'luna-studio.html?from=theatre&charName=' + encodeURIComponent(charName);
  } else if (tag === 'Journey') {
    window.location.href = 'journey.html';
  } else if (tag === 'Private') {
    window.location.href = 'secret.html';
  }
}

/* ── 「重回」卡片入口：从功能面板点「使用」触发
     没有具体长按到哪条消息时，默认定位到最近一条 AI 回复（同一轮）。
     如果压根没有 AI 回复过，提示用户先聊几句。 ── */
function crTriggerRewindFromPanel() {
  if (typeof crMessages === 'undefined' || !crMessages.length) {
    crShowTip('还没有可以重回的对话，先聊几句吧～');
    return;
  }
  let lastLunaIdx = -1;
  for (let i = crMessages.length - 1; i >= 0; i--) {
    if (crMessages[i].role === 'luna') { lastLunaIdx = i; break; }
  }
  if (lastLunaIdx < 0) {
    crShowTip('Ta还没有回复过，先聊几句吧～');
    return;
  }
  if (typeof window.crOpenRewindModal === 'function') {
    window.crOpenRewindModal(lastLunaIdx);
  }
}

/* ── 视频通话：把当前角色信息写入 localStorage 后跳转 ──
   注意：这个函数现在同时服务两个入口：
   1) 「用户主动拨打」（头部电话按钮 / 功能面板 Video 卡片）—— 不传参数，
      内部会显式清掉 luna_vc_ai_initiated，防止上一次通话异常退出（比如
      中途关闭标签页）导致这个标记没被 vcHangup 正常清理、残留成 '1'，
      让本该是"用户拨打"的这通新电话被 videocall.js 误判成"角色主动发起"。
   2) 「接听角色来电」（crShowIncomingCallScreen 里的 handleAccept）—— 传
      { aiInitiated: true, reason }。

   ⚠️ 历史 bug 修复说明：这两个标记必须由本函数统一、原子地设置/清除。
   之前的写法是 handleAccept 先 setItem('luna_vc_ai_initiated','1')，
   再调用这个函数，而这个函数开头无条件 removeItem 把刚设好的标记又冲掉了，
   导致"角色主动打来、用户接听"之后，videocall.js 的 vcInitDialScreen 读到
   的 wasAiInitiated 永远是 false，于是错误地播放了"用户拨号中/Calling…"
   等待动画（其实电话在弹窗那一步就已经接通了），而且角色也不会按预期先
   开口——通话变得冷场、回复变少，"活人感"差的问题根源就在这里。现在把
   设置/清除的时机收进同一个函数、按 aiInitiated 参数二选一执行，就不会
   再出现"设置完立刻被自己冲掉"的竞态。 */
async function crLaunchVideoCall(opts) {
  const aiInitiated = !!(opts && opts.aiInitiated);
  const inviteReason = (opts && opts.reason) || '';

  /* 0. 按发起方原子地写标记：要嘛都设，要嘛都清，不允许中间态 */
  if (aiInitiated) {
    try { localStorage.setItem('luna_vc_ai_initiated', '1'); } catch (_) {}
    try { localStorage.setItem('luna_vc_invite_reason', inviteReason); } catch (_) {}
  } else {
    try { localStorage.removeItem('luna_vc_ai_initiated'); } catch (_) {}
    try { localStorage.removeItem('luna_vc_invite_reason'); } catch (_) {}
  }

  /* 1. 确保 luna_current_chat 已写好（通常已存在） */
  localStorage.setItem('luna_current_chat', CR_NAME);

  /* 2. 把角色 id（用名字做 key）同步给 videocall.js 的 vcCharacterId() */
  localStorage.setItem('luna_active_character', CR_NAME);

  /* 3. 从 LunaCharDB 读头像，写入 luna_vc_avatar 供 videocall.js 用 */
  try {
    const db = await openLunaCharDB();
    if (db.objectStoreNames.contains('chars')) {
      const r = await new Promise(res => {
        const req = db.transaction('chars').objectStore('chars').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror   = () => res([]);
      });
      const found = r.find(c => c.name === CR_NAME);
      if (found && found.avatar) {
        localStorage.setItem('luna_vc_avatar', found.avatar);
      } else {
        localStorage.removeItem('luna_vc_avatar');
      }
    }
  } catch (e) {
    localStorage.removeItem('luna_vc_avatar');
  }

  /* 4. 跳转 */
  window.location.href = 'videocall.html';
}
/* 显式挂到 window：这个函数被定义在功能面板模块的 IIFE 闭包内，
   但来电弹窗等其他模块的代码需要跨闭包调用它，必须导出成真正的全局。 */
window.crLaunchVideoCall = crLaunchVideoCall;

/* ── 通话方式选择弹窗（头部电话按钮） ── */
(function initCallChoicePopup() {
  const headerCallBtn = document.querySelector('.cr-actions .cr-action-btn[title="通话"]');
  const overlay   = document.getElementById('callChoiceOverlay');
  const backdrop  = document.getElementById('callChoiceBackdrop');
  const cancelBtn = document.getElementById('callChoiceCancel');
  const voiceItem = document.getElementById('callChoiceVoice');
  const videoItem = document.getElementById('callChoiceVideo');
  const toastEl   = document.getElementById('callPlaceholderToast');

  if (!headerCallBtn || !overlay) return;

  function openCallChoice() {
    overlay.classList.add('open');
  }
  function closeCallChoice() {
    overlay.classList.remove('open');
  }

  /* 占位提示：语音通话功能尚未完成 */
  let toastTimer = null;
  function showPlaceholderToast(msg) {
    if (!toastEl) return;
    clearTimeout(toastTimer);
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2000);
  }

  headerCallBtn.addEventListener('click', e => {
    e.stopPropagation();
    openCallChoice();
  });

  if (backdrop)  backdrop.addEventListener('click', closeCallChoice);
  if (cancelBtn) cancelBtn.addEventListener('click', closeCallChoice);

  if (voiceItem) {
    voiceItem.addEventListener('click', () => {
      closeCallChoice();
      /* 语音通话功能占位：尚未开发，先提示用户 */
      showPlaceholderToast('语音通话功能开发中，敬请期待');
    });
  }

  if (videoItem) {
    videoItem.addEventListener('click', () => {
      closeCallChoice();
      crLaunchVideoCall();
    });
  }
})();

/* 把原来 el.addEventListener('click', ...) 里 updateDetail 的点击加入分发 */
/* 已在 fpCurrent click 上附加，这里改造 updateDetail 让中心卡双击触发 */
/* 实际通过在 fp-detail 区加个"使用"按钮来触发 */
const fpUseBtn = document.createElement('button');
fpUseBtn.id = 'fpUseBtn';
fpUseBtn.className = 'fp-use-btn';
fpUseBtn.textContent = '使用';
document.getElementById('fpDetail').appendChild(fpUseBtn);

fpUseBtn.addEventListener('click', () => {
  const tag = FP_CARDS[fpCurrent].tag;
  handleCardAction(tag);
});

})();

/* ================================================================
   图片发送 — 选文件 → 询问是否描述 → 发送
================================================================ */

/* 注入描述弹窗 HTML */
document.body.insertAdjacentHTML('beforeend', `
<div id="imgDescOverlay" style="display:none;position:fixed;inset:0;z-index:9999;
  background:rgba(0,0,0,0.45);display:none;align-items:flex-end;justify-content:center;">
  <div style="background:#fff;width:100%;max-width:420px;border-radius:20px 20px 0 0;
    padding:24px 20px 32px;box-sizing:border-box;">
    <div style="width:40px;height:4px;background:#e0e0e0;border-radius:2px;margin:0 auto 18px;"></div>
    <div style="font-size:15px;font-weight:600;color:#1a1a1a;margin-bottom:6px;">需要描述这张图片吗？</div>
    <div style="font-size:12px;color:#999;margin-bottom:16px;line-height:1.6;">
      部分 AI 模型无法直接识别图片。<br>添加描述后，AI 将根据你的描述来回复。
    </div>
    <!-- 图片预览 -->
    <img id="imgDescPreview" src="" alt="" style="width:100%;max-height:180px;object-fit:cover;
      border-radius:10px;margin-bottom:14px;display:block;"/>
    <!-- 描述输入框 -->
    <div id="imgDescInput" contenteditable="true"
      style="border:1px solid #e8e8e8;border-radius:10px;padding:10px 12px;
      font-size:14px;color:#1a1a1a;min-height:44px;margin-bottom:14px;
      outline:none;line-height:1.5;">
    </div>
    <div style="display:flex;gap:10px;">
      <button id="imgDescSkip" style="flex:1;padding:11px 0;border:1px solid #e0e0e0;
        border-radius:12px;background:#fff;font-size:14px;color:#666;cursor:pointer;">
        不描述，直接发
      </button>
      <button id="imgDescSend" style="flex:1;padding:11px 0;border:none;
        border-radius:12px;background:#1a1a1a;font-size:14px;color:#fff;cursor:pointer;">
        添加描述并发送
      </button>
    </div>
  </div>
</div>
`);

/* 隐藏的 file input */
const _imgInput = document.createElement('input');
_imgInput.type = 'file';
_imgInput.accept = 'image/*';
_imgInput.style.display = 'none';
document.body.appendChild(_imgInput);

let _pendingImgDataUrl = '';  /* 选中的图片 base64 */
let _pendingImgFile    = null; /* 选中的 File 对象 */

const imgDescOverlay = document.getElementById('imgDescOverlay');
const imgDescPreview = document.getElementById('imgDescPreview');
const imgDescInput   = document.getElementById('imgDescInput');
const imgDescSkip    = document.getElementById('imgDescSkip');
const imgDescSend    = document.getElementById('imgDescSend');

/* 打开文件选择器 */
function crPickImage() {
  _imgInput.value = '';
  _imgInput.click();
}

/* 用户选完文件 */
_imgInput.addEventListener('change', function() {
  const file = _imgInput.files[0];
  if (!file) return;
  _pendingImgFile = file;
  const reader = new FileReader();
  reader.onload = function(e) {
    _pendingImgDataUrl = e.target.result;
    /* 显示弹窗 */
    imgDescPreview.src = _pendingImgDataUrl;
    imgDescInput.textContent = '';
    imgDescOverlay.style.display = 'flex';
  };
  reader.readAsDataURL(file);
});

/* 关闭弹窗 */
function closeImgDescOverlay() {
  imgDescOverlay.style.display = 'none';
  _pendingImgDataUrl = '';
  _pendingImgFile    = null;
}

/* 点击遮罩关闭 */
imgDescOverlay.addEventListener('click', function(e) {
  if (e.target === imgDescOverlay) closeImgDescOverlay();
});

/* 不描述，直接发 → 以图片消息发送，ai 直接收到 base64 */
imgDescSkip.addEventListener('click', function() {
  if (!_pendingImgDataUrl) return;
  crSendImageMsg(_pendingImgDataUrl, null);
  closeImgDescOverlay();
});

/* 添加描述并发送 */
imgDescSend.addEventListener('click', function() {
  if (!_pendingImgDataUrl) return;
  const desc = imgDescInput.textContent.trim();
  crSendImageMsg(_pendingImgDataUrl, desc || null);
  closeImgDescOverlay();
});

/* 核心：发图片消息到聊天 */
function crSendImageMsg(dataUrl, description) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' +
            n.getMinutes().toString().padStart(2,'0');

  /* 消息对象：存 imageUrl + 可选 imageDesc */
  const msgObj = {
    role: 'mine',
    text: description ? '[图片] ' + description : '[图片]',
    imageUrl: dataUrl,
    imageDesc: description || null,
    time: t,
  };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  /* 构建气泡（图片气泡特殊处理） */
  const el = document.createElement('div');
  el.className = 'cr-msg-mine';
  el.innerHTML =
    '<div class="cr-msg-mine-inner">' +
    '<div class="cr-mine-bubble" style="padding:4px;background:transparent;">' +
      '<img src="' + dataUrl + '" style="max-width:200px;max-height:200px;border-radius:12px;display:block;" />' +
      (description
        ? '<p class="cr-msg-p" style="padding:6px 4px 2px;color:#f2f0eb;font-size:12px;">' + escHtml(description) + '</p>'
        : '') +
    '</div>' +
    '<div class="cr-mine-meta">' +
      '<span class="cr-mine-time">' + t + '</span>' +
    '</div>' +
    '</div>' +
    crMineAvHtml();

  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
}

/* ---- 当前角色名（从 localStorage 读） ---- */
const CR_NAME = localStorage.getItem('luna_current_chat') || 'Luna';

/* ---- IndexedDB：按角色独立存取消息 ---- */
let _crDB = null;

const LUNA_STORES = {
  conv:     { keyPath: 'name' },
  friends:  { keyPath: 'name' },
  messages: { keyPath: 'chatKey' },
  memes:    { keyPath: 'id' },
  rewindFeedback: { keyPath: 'name' },
  /* 视频通话完整记录（转录全文），按通话建自增 id 存一条，
     用 chatKey 字段（角色名）在读取时过滤，不建索引，
     量级很小（每次通话一条），全表扫描即可，没必要为此改动
     getCrDB 的升级逻辑增加索引创建的复杂度。 */
  videoLogs: { keyPath: 'id', autoIncrement: true },
  /* 叩问功能：问答档案，按角色存一条记录，记录里是 entries 数组
     （每条 entry 含题目/回答/角色回应等），list 只增不覆盖。 */
  koukan: { keyPath: 'name' },
  /* 幕后志功能：小说化故事档案，结构与 koukan 一致，按角色存一条记录，
     entries 数组里每条是一篇故事（title/paragraphs/authorNote/...）。 */
  chronicle: { keyPath: 'name' },
  /* 迷雾功能：困惑档案，按角色存一条记录，entries 数组里每条是
     "一批困惑"，每批里包含若干条 item（每条是角色的一件具体困惑，
     含 guessZh/guessEn/resolved/explanation/reactionZh 等字段）。
     与 secret/haze.js 的 HZ_STORES.haze 定义保持一致，数据互通。 */
  haze: { keyPath: 'name' },
};

function getCrDB() {
  return new Promise((res, rej) => {
    if (_crDB) { res(_crDB); return; }

    const probe = indexedDB.open('LunaChatDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      const currentVer = db.version;
      const missing = Object.keys(LUNA_STORES).filter(
        name => !db.objectStoreNames.contains(name)
      );
      db.close();

      if (missing.length === 0) {
        const reopen = indexedDB.open('LunaChatDB', currentVer);
        reopen.onsuccess = e2 => { _crDB = e2.target.result; res(_crDB); };
        reopen.onerror   = () => rej();
      } else {
        const upgrade = indexedDB.open('LunaChatDB', currentVer + 1);
        upgrade.onupgradeneeded = e2 => {
          const udb = e2.target.result;
          missing.forEach(name => {
            if (!udb.objectStoreNames.contains(name)) {
              udb.createObjectStore(name, LUNA_STORES[name]);
            }
          });
        };
        upgrade.onsuccess = e2 => { _crDB = e2.target.result; res(_crDB); };
        upgrade.onerror   = () => rej();
      }
    };
    probe.onerror = () => rej();
  });
}

/* 保存某个角色的全部消息（传入消息数组） */
function dbSaveMessages(name, msgs) {
  getCrDB().then(db => {
    const tx = db.transaction('messages', 'readwrite');
    tx.objectStore('messages').put({ chatKey: name, msgs });
  }).catch(() => {});
}

/* 读取某个角色的全部消息 */
async function dbLoadMessages(name) {
  try {
    const db = await getCrDB();
    return new Promise(res => {
      const r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = () => res(r.result ? r.result.msgs : []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 当前聊天的消息数组（内存） */
let crMessages = [];

/* ================================================================
   头像缓存 — 从 LunaCharDB 加载后全局复用
================================================================ */
let _crAvatarUrl = null; // 加载成功后存 url/base64，null=未加载，false=无头像

function crLoadAvatarCache() {
  return new Promise(resolve => {
    if (_crAvatarUrl !== null) { resolve(_crAvatarUrl); return; }
    openLunaCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { _crAvatarUrl = false; resolve(false); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === CR_NAME);
        _crAvatarUrl = (found && found.avatar) ? found.avatar : false;
        resolve(_crAvatarUrl);
      };
      r.onerror = () => { _crAvatarUrl = false; resolve(false); };
    }).catch(() => { _crAvatarUrl = false; resolve(false); });
  });
}

/* 生成小头像 HTML（消息气泡 & typing 共用） */
function crMiniAvHtml() {
  if (_crAvatarUrl) {
    return `<div class="cr-mini-av" style="flex-shrink:0;width:28px;height:28px;border-radius:50%;overflow:hidden;">` +
      `<img src="${_crAvatarUrl}" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;" /></div>`;
  }
  return '<div class="cr-mini-av">' + crMiniAvSvg() + '</div>';
}

/* 实时时钟 */
function crTick() {
  const tz = localStorage.getItem('luna_tz') || 'Asia/Shanghai';
  const n = new Date();
  const timeStr = n.toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit',
    hour12: false, timeZone: tz
  });
  const el = document.getElementById('crTime');
  if (el) el.textContent = timeStr;

  const pct = parseInt(localStorage.getItem('luna_battery') || '76');
  const pctEl = document.getElementById('batPct');
  const innerEl = document.getElementById('batInner');
  if (pctEl) pctEl.textContent = pct;
  if (innerEl) {
    innerEl.style.width = pct + '%';
    innerEl.style.background = pct <= 20
      ? 'linear-gradient(90deg, #f87171, #ef4444)'
      : '#1a1a1a';
  }
}
crTick();
setInterval(crTick, 10000);

document.addEventListener('DOMContentLoaded', async function () {
  applyIsland();
  applyGlobalFont();
  applyWallpaper();

  /* 预加载头像缓存，让后续气泡直接用 */
  await crLoadAvatarCache();

  /* 预加载用户(发送方)头像 */
  crLoadUserAvatar();

  crInitStats();
  crInitHeader();

  await crRestoreMessages();

  /* ── 返回按钮：用事件委托绑定在 document 上 ──
     原因：Header Studio 美化功能可能会把 #crAvatarWrap（头像）从
     #crBackBtn 内部移动到 .cr-header-main 下（用于让头像在自定义
     布局里居中），移动之后头像和按钮不再是父子关系，点击头像时
     click 事件不会再冒泡到 #crBackBtn 上，导致"点头像返回不了"。
     用 document 级别的委托 + closest() 判断，无论头像现在挂在哪个
     父节点下，只要点击目标在 #crBackBtn 或 #crAvatarWrap 范围内都能触发返回，
     从根本上避免 DOM 结构变化导致监听失效。 */
  document.addEventListener('click', function (e) {
    var hit = e.target.closest && (e.target.closest('#crBackBtn') || e.target.closest('#crAvatarWrap'));
    if (!hit) return;
    localStorage.setItem('luna_conv_dirty', '1');
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = 'chat.html';
    }
  });

  /* ── 输入框：用 CSS data-placeholder 代替 textContent 占位 ── */
  var placeholder = '向 ' + CR_NAME + ' 发送消息';
  document.querySelectorAll('.cr-chip').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var box = document.getElementById('crInputBox');
      if (!box) return;
      var txt = chip.querySelector('span') ? chip.querySelector('span').textContent : '';
      box.textContent = txt;
      box.focus();
      /* 移到末尾 */
      var sel = window.getSelection();
      var range = document.createRange();
      range.selectNodeContents(box);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    });
  });

  var inputBox = document.getElementById('crInputBox');
  if (inputBox) {
    /* 设置 CSS 占位符文字（不写入 textContent，不会被当做消息发出） */
    inputBox.setAttribute('data-placeholder', placeholder);
    inputBox.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        crSend();
      }
    });
  }

  crBindSendAiButtons();
});

/* 统一绑定发送 & AI 按钮，支持多次调用（幂等） */
function crBindSendAiButtons() {
  var sendBtn = document.getElementById('crSendBtn');
  if (sendBtn && !sendBtn._crBound) {
    sendBtn.addEventListener('click', crSend);
    sendBtn._crBound = true;
  }
  var aiBtn = document.querySelector('.cr-ai-btn');
  if (aiBtn && !aiBtn._crBound) {
    aiBtn.addEventListener('click', crAiReply);
    aiBtn._crBound = true;
  }
}

/* ── 同步头部角色信息 ── */
function crInitHeader() {
  var nameEl = document.querySelector('.cr-name');
  if (nameEl) nameEl.textContent = CR_NAME;

  document.querySelectorAll('.cr-footer-lbl').forEach(function(el) {
    el.textContent = CR_NAME.toUpperCase();
  });

  document.title = CR_NAME + ' · 聊天';

  openLunaCharDB().then(function(db) {
    if (!db.objectStoreNames.contains('chars')) return;
    var r = db.transaction('chars').objectStore('chars').getAll();
    r.onsuccess = function() {
      var chars = r.result || [];
      var found = chars.find(function(c) { return c.name === CR_NAME; });
      if (!found) return;
      var subEl = document.querySelector('.cr-sub');
      if (subEl && found.role) subEl.textContent = found.role;
      if (found.avatar) {
        _crAvatarUrl = found.avatar;
        var avInner = document.getElementById('crAvatarInner');
        if (avInner) {
          var img = document.createElement('img');
          img.src = found.avatar;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
          avInner.innerHTML = '';
          avInner.appendChild(img);
        }
      }
      /* ── 头像/角色信息写完后，重新应用头部美化样式（防止被覆盖）── */
      if (typeof window.crApplyHeaderStyle === 'function') {
        window.crApplyHeaderStyle();
      }
    };
  }).catch(function() {});
}

/* ── 头部三栏统计动态初始化 ── */
function crInitStats() {
  var name = localStorage.getItem('luna_current_chat') || 'Luna';

  var lunaNameEl = document.querySelector('.cr-stat-luna-row span');
  if (lunaNameEl) lunaNameEl.textContent = name;

  /* 头像：优先用已缓存的 _crAvatarUrl */
  var avatarInner = document.getElementById('crAvatarInner');
  if (avatarInner) {
    function renderAvatar(avatarSrc) {
      if (avatarSrc) {
        var img = document.createElement('img');
        img.src = avatarSrc;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;';
        avatarInner.innerHTML = '';
        avatarInner.appendChild(img);
      } else {
        avatarInner.textContent = name[0] || '?';
      }
    }

    if (_crAvatarUrl !== null) {
      renderAvatar(_crAvatarUrl);
    } else {
      var charProbe = indexedDB.open('LunaCharDB');
      charProbe.onsuccess = function(ev) {
        var cdb = ev.target.result;
        if (!cdb.objectStoreNames.contains('chars')) {
          renderAvatar(false); return;
        }
        var cr = cdb.transaction('chars').objectStore('chars').getAll();
        cr.onsuccess = function() {
          var found = (cr.result || []).find(function(c) { return c.name === name; });
          renderAvatar(found && found.avatar ? found.avatar : false);
        };
      };
    }
  }

  var probe = indexedDB.open('LunaChatDB');
  probe.onsuccess = function(e) {
    var db = e.target.result;

    if (db.objectStoreNames.contains('messages')) {
      var r = db.transaction('messages').objectStore('messages').get(name);
      r.onsuccess = function() {
        var msgs = r.result ? (r.result.msgs || []) : [];
        var countEl = document.querySelector('.cr-stat:nth-child(1) .cr-stat-val');
        if (countEl) countEl.textContent = msgs.length;
      };
    }

    if (db.objectStoreNames.contains('conv')) {
      var r2 = db.transaction('conv').objectStore('conv').get(name);
      r2.onsuccess = function() {
        var item = r2.result;
        var daysEl = document.querySelector('.cr-stat:nth-child(2) .cr-stat-val');
        if (daysEl && item && item.createdAt) {
          var diffMs = Date.now() - item.createdAt;
          var days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          daysEl.textContent = days + 'd';
        } else if (daysEl) {
          daysEl.textContent = '0d';
        }
      };
    }
  };
}

/* ── 恢复历史消息到 DOM ── */
async function crRestoreMessages() {
  crMessages = await dbLoadMessages(CR_NAME);
  var area = document.getElementById('crMessages');
  if (!area) return;

  area.innerHTML = '';

  if (crMessages.length > 0) {
    crMessages.forEach(function(msg) {
      var el = crBuildMsgEl(msg);
      if (el) area.appendChild(el);
    });
  }

  area.scrollTop = area.scrollHeight;
}

/* ── 构建表情包消息元素（用户和 AI 共用，无气泡） ── */
function crBuildMemeMsgEl(msg, role) {
  const el = document.createElement('div');
  const isMine = role === 'mine';
  el.className = isMine ? 'cr-msg-mine' : 'cr-msg-luna';

  const imgHtml =
    '<img src="' + msg.imageUrl + '" style="' +
      'max-width:150px;max-height:150px;' +
      'border-radius:16px;display:block;' +
      'box-shadow:0 2px 12px rgba(0,0,0,0.10);' +
    '" />';

  // 小标记：右下角标签
  const tagHtml =
    '<div style="' +
      'display:inline-flex;align-items:center;gap:3px;' +
      'margin-top:5px;padding:2px 7px 2px 5px;' +
      'border-radius:20px;' +
      'background:rgba(0,0,0,0.05);' +
      'font-size:10px;color:#aaa;' +
      'font-family:\'Space Mono\',monospace;letter-spacing:0.5px;' +
    '">' +
      '<svg width="9" height="9" viewBox="0 0 10 10" fill="none">' +
        '<rect x="1" y="1" width="8" height="8" rx="2" stroke="#bbb" stroke-width="1"/>' +
        '<circle cx="3.5" cy="3.5" r="1" fill="#bbb"/>' +
        '<path d="M1 7l2.5-2.5L5 6l2-2 2 2" stroke="#bbb" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>' +
      '</svg>' +
      'meme' +
    '</div>';

  if (isMine) {
    el.innerHTML =
      '<div style="display:flex;flex-direction:column;align-items:flex-end;">' +
        imgHtml +
        tagHtml +
      '</div>' +
      '<div class="cr-mine-meta"><span class="cr-mine-time">' + msg.time + '</span></div>';
  } else {
    el.innerHTML =
      crMiniAvHtml() +
      '<div>' +
        '<div style="display:flex;flex-direction:column;align-items:flex-start;">' +
          imgHtml +
          tagHtml +
        '</div>' +
        '<p class="cr-msg-time">' + msg.time + '</p>' +
      '</div>';
  }
  return el;
}

/* ── 构建 Luna 语音消息 DOM（历史恢复 + 实时渲染共用） ── */
function crBuildLunaVoiceMsgEl(msg) {
  const WAVE_H = [5,8,13,19,25,21,15,23,27,21,14,19,25,20,15,10,15,21,25,18,12,8,16,23,18,11,7,5];
  function secToWaveCnt(s) { return Math.min(36, Math.max(4, Math.round(s*0.55+4))); }

  const text  = msg.voiceText || msg.text.replace(/^\[VOICE:/,'').replace(/\]$/,'');
  const label = msg.voiceDur  || '0:05';

  function calcDuration(t) {
    const cn = (t.match(/[\u4e00-\u9fa5]/g)||[]).length;
    const en = t.replace(/[\u4e00-\u9fa5]/g,'').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(3, Math.min(180, Math.ceil(cn/4.5+en/2.5)));
  }
  function secToWaveCntFromText(t) { return secToWaveCnt(calcDuration(t)); }

  const waveCnt  = secToWaveCntFromText(text);
  const waveHtml = Array.from({length: waveCnt}, (_,i) =>
    `<span style="display:block;width:2px;border-radius:2px;flex-shrink:0;background:rgba(0,0,0,0.25);height:${WAVE_H[i%WAVE_H.length]}px;"></span>`
  ).join('');

  const el = document.createElement('div');
  el.className = 'cr-msg-luna';

  const bubble = document.createElement('div');
  bubble.style.cssText = [
    'display:inline-flex;flex-direction:column',
    'width:fit-content',
    'cursor:pointer',
    'background:#f0f0ef',
    'border-radius:18px 18px 18px 5px',
    'position:relative',
    'overflow:hidden',
    'border:0.5px solid rgba(0,0,0,0.07)',
  ].join(';');
  bubble.innerHTML = `
    <div style="display:flex;align-items:center;gap:7px;padding:9px 12px 9px 10px;white-space:nowrap;">
      <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;
        background:rgba(0,0,0,0.08);border:0.5px solid rgba(0,0,0,0.12);
        display:flex;align-items:center;justify-content:center;">
        <svg width="10" height="11" viewBox="0 0 12 13">
          <path d="M2 1L11 6.5L2 12V1Z" fill="rgba(0,0,0,0.5)"/>
        </svg>
      </div>
      <div style="display:flex;align-items:center;gap:1.5px;height:22px;">${waveHtml}</div>
      <div style="font-size:10px;font-weight:500;color:rgba(0,0,0,0.35);flex-shrink:0;margin-left:2px;">${label}</div>
    </div>`;

  const textCapsule = document.createElement('div');
  textCapsule.style.cssText = [
    'max-height:0','overflow:hidden','opacity:0','max-width:260px',
    'transition:max-height 0.32s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease,margin 0.25s ease',
    'margin-top:0',
  ].join(';');
  const textInner = document.createElement('div');
  textInner.style.cssText = [
    'background:#e8e8e7','border-radius:14px 14px 14px 5px',
    'padding:9px 13px','font-size:13px','line-height:1.7',
    'color:#1a1a1a','letter-spacing:0.15px','word-break:break-all',
  ].join(';');
  textInner.textContent = text;
  textCapsule.appendChild(textInner);

  let _open = false;
  bubble.addEventListener('click', () => {
    _open = !_open;
    textCapsule.style.maxHeight = _open ? '300px' : '0';
    textCapsule.style.opacity   = _open ? '1' : '0';
    textCapsule.style.marginTop = _open ? '6px' : '0';
  });

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;';
  wrap.appendChild(bubble);
  wrap.appendChild(textCapsule);

  /* 和普通 luna 消息一样：头像 + 内容并排 */
  const avEl = document.createElement('div');
  avEl.innerHTML = crMiniAvHtml();
  const avNode = avEl.firstChild;

  const inner = document.createElement('div');
  inner.appendChild(wrap);
  const timeEl = document.createElement('p');
  timeEl.className = 'cr-msg-time';
  timeEl.textContent = msg.time;
  inner.appendChild(timeEl);

  el.appendChild(avNode);
  el.appendChild(inner);
  return el;
}

/* ── 构建用户语音消息 DOM（历史恢复用） ── */
function crBuildMineVoiceMsgEl(msg) {
  const WAVE_H = [5,8,13,19,25,21,15,23,27,21,14,19,25,20,15,10,15,21,25,18,12,8,16,23,18,11,7,5];
  function secToWaveCnt(s) { return Math.min(36, Math.max(4, Math.round(s*0.55+4))); }
  function calcDuration(t) {
    const cn = (t.match(/[\u4e00-\u9fa5]/g)||[]).length;
    const en = t.replace(/[\u4e00-\u9fa5]/g,'').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(3, Math.min(180, Math.ceil(cn/4.5+en/2.5)));
  }

  const text     = msg.voiceText || msg.text;
  const label    = msg.voiceDur  || '0:05';
  const waveCnt  = secToWaveCnt(calcDuration(text));
  const waveHtml = Array.from({length: waveCnt}, (_,i) =>
    `<span style="display:block;width:2px;border-radius:2px;flex-shrink:0;background:rgba(255,255,255,0.8);height:${WAVE_H[i%WAVE_H.length]}px;"></span>`
  ).join('');

  const el = document.createElement('div');
  el.className = 'cr-msg-mine';

  const bubbleWrap = document.createElement('div');
  bubbleWrap.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;';

  const bubble = document.createElement('div');
  bubble.className = 'cr-voice-bubble';
  bubble.style.cssText = [
    'display:inline-flex;flex-direction:column',
    'width:fit-content',
    'cursor:pointer',
    'background:#1c1c1e',
    'border-radius:18px 18px 5px 18px',
    'position:relative',
    'overflow:hidden',
  ].join(';');
  bubble.innerHTML = `
    <div style="position:absolute;bottom:0;right:-6px;width:12px;height:12px;
      background:#1c1c1e;clip-path:polygon(0 0,100% 100%,0 100%);pointer-events:none;"></div>
    <div style="display:flex;align-items:center;gap:7px;padding:9px 12px 9px 10px;white-space:nowrap;">
      <div style="width:28px;height:28px;border-radius:50%;flex-shrink:0;
        background:rgba(255,255,255,0.14);border:0.5px solid rgba(255,255,255,0.22);
        display:flex;align-items:center;justify-content:center;">
        <svg width="10" height="11" viewBox="0 0 12 13">
          <path d="M2 1L11 6.5L2 12V1Z" fill="rgba(255,255,255,0.85)"/>
        </svg>
      </div>
      <div style="display:flex;align-items:center;gap:1.5px;height:22px;">${waveHtml}</div>
      <div style="font-size:10px;font-weight:500;color:rgba(255,255,255,0.4);flex-shrink:0;margin-left:2px;">${label}</div>
    </div>`;

  const textCapsule = document.createElement('div');
  textCapsule.style.cssText = [
    'max-height:0','overflow:hidden','opacity:0','max-width:260px',
    'transition:max-height 0.32s cubic-bezier(0.4,0,0.2,1),opacity 0.25s ease,margin 0.25s ease',
    'margin-top:0',
  ].join(';');
  const textInner = document.createElement('div');
  textInner.style.cssText = [
    'background:#f0f0ef','border-radius:14px 14px 14px 5px',
    'padding:9px 13px','font-size:13px','line-height:1.7',
    'color:#1a1a1a','letter-spacing:0.15px','word-break:break-all',
  ].join(';');
  textInner.textContent = text;
  textCapsule.appendChild(textInner);

  let _open = false;
  bubble.addEventListener('click', () => {
    _open = !_open;
    textCapsule.style.maxHeight = _open ? '300px' : '0';
    textCapsule.style.opacity   = _open ? '1' : '0';
    textCapsule.style.marginTop = _open ? '6px' : '0';
  });

  const metaEl = document.createElement('div');
  metaEl.className = 'cr-mine-meta';
  metaEl.innerHTML = `
    <span class="cr-mine-time">${msg.time}</span>
    <svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none">
      <path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  bubbleWrap.appendChild(bubble);
  bubbleWrap.appendChild(textCapsule);
  bubbleWrap.appendChild(metaEl);
  bubbleWrap.className = 'cr-msg-mine-inner';
  el.appendChild(bubbleWrap);
  el.appendChild(crMineAvHtml ? crMineAvHtml() : '');
  return el;
}

/* ================================================================
   Story Card 编辑风格渲染 — 1:1 复刻 story_card_v5_editorial
================================================================ */

/* 注入字体 + keyframe（只执行一次） */
(function _injectStoryCardStyles() {
  if (document.getElementById('_sc_styles')) return;
  const link = document.createElement('link');
  link.rel  = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=Jost:wght@200;300;400;500&display=swap';
  document.head.appendChild(link);

  const s = document.createElement('style');
  s.id = '_sc_styles';
  s.textContent = `
    /* ── story card 专用 CSS ── */
    .sc-wrap { display:flex; flex-direction:column; gap:0; }
    .sc-wrap.sc-sent { align-items:flex-end; }
    .sc-wrap.sc-recv { align-items:flex-start; }

    .sc-card {
      width:178px; height:237px;
      border-radius:20px; overflow:hidden;
      position:relative; background:#fff;
      box-shadow:0 8px 32px rgba(0,0,0,0.13),0 2px 8px rgba(0,0,0,0.07);
      display:flex; flex-direction:column;
    }

    /* 燃烧条 */
    .sc-burn {
      position:absolute;top:0;left:0;right:0;height:3px;
      background:#ececec;z-index:10;overflow:hidden;
    }
    .sc-burn-f {
      height:100%;background:#111;
      transition:width 60s linear;
    }
    .sc-burn-f.sc-urgent { background:#c0392b; }
    @keyframes sc-burnAnim { from{width:var(--sc-burn-start,85%)} to{width:4%} }

    /* 文字卡 */
    .sc-t { height:100%;display:flex;flex-direction:column;position:relative; }
    .sc-t-deco {
      height:88px;background:#f7f7f7;
      position:relative;overflow:hidden;flex-shrink:0;
    }
    .sc-t-label {
      position:absolute;left:18px;top:18px;
      font-family:'Jost',sans-serif;font-size:8.5px;font-weight:400;
      letter-spacing:2.5px;color:#c0c0c0;text-transform:uppercase;
    }
    .sc-t-rule  { position:absolute;left:18px;right:18px;top:32px;height:1px;background:#e8e8e8; }
    .sc-t-rule2 { position:absolute;left:18px;right:60px;top:54px;height:1px;background:#efefef; }
    .sc-t-letter {
      position:absolute;right:-8px;bottom:-18px;
      font-family:'Playfair Display',serif;
      font-size:100px;font-weight:500;
      color:rgba(0,0,0,0.045);line-height:1;
      user-select:none;pointer-events:none;
    }
    .sc-t-body {
      flex:1;display:flex;flex-direction:column;
      justify-content:space-between;padding:14px 18px 15px;
    }
    .sc-t-quote {
      font-family:'Playfair Display',serif;font-style:italic;
      font-size:15px;line-height:1.55;color:#141414;flex:1;
    }
    .sc-t-meta {
      display:flex;align-items:center;justify-content:space-between;
      padding-top:12px;border-top:1px solid #f0f0f0;margin-top:8px;
    }
    .sc-t-who  { font-family:'Jost',sans-serif;font-size:9.5px;font-weight:300;color:#aaa; }
    .sc-t-time { font-family:'Jost',sans-serif;font-size:9.5px;font-weight:200;color:#ccc; }

    /* 图片卡 */
    .sc-i { height:100%;display:flex;flex-direction:column;position:relative; }
    .sc-i-img {
      flex:0 0 152px;background:linear-gradient(160deg,#d2d2d2,#bebebe);
      position:relative;overflow:hidden;
      display:flex;align-items:center;justify-content:center;
    }
    .sc-i-stamp {
      position:absolute;top:12px;left:12px;
      font-family:'Playfair Display',serif;font-style:italic;
      font-size:11px;color:rgba(255,255,255,0.55);letter-spacing:.5px;
    }
    .sc-i-vline {
      position:absolute;right:26px;top:0;bottom:0;
      width:1px;background:rgba(255,255,255,0.1);
    }
    .sc-i-body {
      flex:1;display:flex;flex-direction:column;
      justify-content:space-between;padding:11px 15px 13px;
    }
    .sc-i-title {
      font-family:'Playfair Display',serif;font-style:italic;
      font-size:13px;line-height:1.45;color:#141414;
    }
    .sc-i-foot { display:flex;align-items:center;justify-content:space-between; }
    .sc-i-who  { font-family:'Jost',sans-serif;font-size:9.5px;font-weight:300;color:#bbb; }
    .sc-i-views {
      font-family:'Jost',sans-serif;font-size:9.5px;font-weight:200;color:#ccc;
      display:flex;align-items:center;gap:3px;
    }

    /* 标签区 */
    .sc-tag-area {
      display:flex;align-items:center;gap:0;
      padding:9px 14px 0 14px;
      position:relative;
    }
    .sc-tag-area::before {
      content:'';position:absolute;top:0;left:28px;
      width:1px;height:9px;background:#ccc;
    }
    .sc-sent .sc-tag-area { flex-direction:row-reverse; }
    .sc-sent .sc-tag-area::before { left:auto;right:28px; }

    .sc-tag-line { display:flex;align-items:center;gap:6px; }
    .sc-tag-dot-outer {
      width:8px;height:8px;border-radius:50%;
      border:1.5px solid #999;
      display:flex;align-items:center;justify-content:center;flex-shrink:0;
    }
    .sc-tag-dot-outer.sc-urgent { border-color:#c0392b; }
    .sc-tag-dot-inner {
      width:3px;height:3px;border-radius:50%;background:#111;
      animation:sc-blink 2s ease-in-out infinite;
    }
    .sc-tag-dot-inner.sc-urgent {
      background:#c0392b;animation:sc-blink .8s ease-in-out infinite;
    }
    @keyframes sc-blink { 0%,100%{opacity:1} 50%{opacity:.2} }

    .sc-tag-rule { flex:1;height:1px;background:#d4d4d4;width:20px; }
    .sc-tag-rule.sc-urgent { background:#e8c0bb; }
    .sc-tag-text {
      font-family:'Jost',sans-serif;font-size:9.5px;font-weight:300;
      letter-spacing:1.2px;color:#999;text-transform:uppercase;white-space:nowrap;
    }
    .sc-tag-text.sc-urgent { color:#c0392b;letter-spacing:1px; }
    .sc-tag-slash {
      font-family:'Playfair Display',serif;font-style:italic;
      font-size:11px;color:#ccc;margin:0 2px;
    }
    .sc-tag-slash.sc-urgent { color:#e8c0bb; }

    /* 附言气泡 */
    .sc-caption-bubble {
      max-width:178px;background:#f0f0ef;
      border-radius:10px 10px 10px 3px;
      padding:7px 12px;margin-top:6px;
      font-family:'Jost',sans-serif;font-size:12px;
      color:#555;line-height:1.5;
    }
    .sc-sent .sc-caption-bubble {
      border-radius:10px 10px 3px 10px;
    }
  `;
  document.head.appendChild(s);
})();

/* 构建 story card DOM 元素 */
function crBuildStoryCardEl(msg) {
  // ── 1. 计算剩余时间 ──
  const publishedAt  = msg.scPublishedAt || Date.now();
  const totalMin     = msg.scTotalMin    || (msg.scExpireHours || 24) * 60;
  const elapsedMin   = Math.floor((Date.now() - publishedAt) / 60000);
  // scMinLeft 存的是发送时的快照；以 publishedAt 重新算更准
  const minLeft      = Math.max(0, totalMin - elapsedMin);
  const isUrgent     = minLeft <= 5;
  const tagMin       = minLeft > 0 ? minLeft + ' min' : '已过期';

  // 燃烧条起始宽度（百分比）
  const burnPct      = totalMin > 0
    ? Math.max(4, Math.min(96, Math.round((minLeft / totalMin) * 100)))
    : 4;
  const burnClass    = isUrgent ? 'sc-burn-f sc-urgent' : 'sc-burn-f';

  const isMine       = msg.role === 'mine';
  const scType       = msg.scType || 'text';
  const scText       = msg.scText || '';
  const scUser       = msg.scUsername || '我';
  const scNo         = msg.scNo  || 'No. 001';
  const scViews      = msg.scViews || 0;
  const scBgImg      = msg.scBgImage || '';
  const scCaption    = msg.scCaption || '';

  // 装饰字母（取非中文首字符）
  const decoLetter   = (scText.replace(/[\u4e00-\u9fff\s]/g,'')[0] || scText[0] || 'D').toUpperCase();

  // 标签文字
  const tagLabel     = msg.fwdFrom ? '已转发' : '限时动态';

  // ── 2. 卡片内部 ──
  let cardInner = '';
  if (scType === 'image') {
    const imgArea = scBgImg
      ? `<img src="${escHtml(scBgImg)}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;" />`
      : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    cardInner = `
      <div class="sc-i">
        <div class="sc-i-img">
          ${imgArea}
          <div class="sc-i-stamp">${escHtml(scNo)}</div>
          <div class="sc-i-vline"></div>
        </div>
        <div class="sc-i-body">
          <div class="sc-i-title">${escHtml(scText || '一个不需要解释的瞬间。')}</div>
          <div class="sc-i-foot">
            <div class="sc-i-who">${escHtml(scUser)}</div>
            <div class="sc-i-views">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.8" stroke-linecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              ${scViews}
            </div>
          </div>
        </div>
      </div>`;
  } else {
    cardInner = `
      <div class="sc-t">
        <div class="sc-t-deco">
          <div class="sc-t-label">Dynamic Story</div>
          <div class="sc-t-rule"></div>
          <div class="sc-t-rule2"></div>
          <div class="sc-t-letter">${decoLetter}</div>
        </div>
        <div class="sc-t-body">
          <div class="sc-t-quote">${escHtml(scText)}</div>
          <div class="sc-t-meta">
            <div class="sc-t-who">${escHtml(scUser)}</div>
            <div class="sc-t-time">${tagMin}</div>
          </div>
        </div>
      </div>`;
  }

  // ── 3. 组装完整 HTML ──
  const urgentClass = isUrgent ? ' sc-urgent' : '';
  const html = `
    <div class="sc-card">
      <div class="sc-burn"><div class="${burnClass}" style="width:${burnPct}%;"></div></div>
      ${cardInner}
    </div>
    <div class="sc-tag-area">
      <div class="sc-tag-line">
        <div class="sc-tag-dot-outer${urgentClass}">
          <div class="sc-tag-dot-inner${urgentClass}"></div>
        </div>
        <div class="sc-tag-rule${urgentClass}"></div>
        <div class="sc-tag-text${urgentClass}">${tagLabel}</div>
        <div class="sc-tag-slash${urgentClass}">/</div>
        <div class="sc-tag-text${urgentClass}">${tagMin}</div>
      </div>
    </div>
    ${scCaption ? `<div class="sc-caption-bubble">${escHtml(scCaption)}</div>` : ''}
  `;

  const wrap = document.createElement('div');
  wrap.className = 'sc-wrap ' + (isMine ? 'sc-sent' : 'sc-recv');
  wrap.innerHTML = html;
  return wrap;
}

/* ── 构建气泡内「被引用预览块」的 HTML ──
   quote: { text, role, idx }；role 是被引用消息原作者（'mine'/'luna'） */
function crBuildQuoteHtml(quote) {
  if (!quote || !quote.text) return '';
  var who = quote.role === 'mine' ? '你' : CR_NAME;
  var short = quote.text.length > 34 ? quote.text.slice(0, 34) + '…' : quote.text;
  var idxAttr = (typeof quote.idx === 'number' && quote.idx >= 0) ? quote.idx : '';
  return (
    '<div class="cr-bubble-quote" data-quote-jump="' + idxAttr + '">' +
      '<div class="cr-bubble-quote-bar"></div>' +
      '<div class="cr-bubble-quote-body">' +
        '<span class="cr-bubble-quote-who">' + escHtml(who) + '</span>' +
        '<span class="cr-bubble-quote-txt">' + escHtml(short) + '</span>' +
      '</div>' +
    '</div>'
  );
}

/* ── 点击引用预览块：跳转到原消息并高亮闪烁 ── */
function crJumpToQuotedMsg(idx) {
  if (idx === '' || idx === null || typeof idx === 'undefined') return;
  idx = parseInt(idx, 10);
  if (isNaN(idx) || idx < 0) return;

  var allWrap = document.querySelectorAll('.cr-msg-mine, .cr-msg-luna');
  var targetWrap = allWrap[idx];
  if (!targetWrap) return;

  var bubble = targetWrap.querySelector('.cr-mine-bubble, .cr-luna-bubble');
  targetWrap.scrollIntoView({ behavior: 'smooth', block: 'center' });

  if (bubble) {
    bubble.classList.remove('cr-quote-jump-flash');
    /* 触发重绘以便动画能重新播放 */
    void bubble.offsetWidth;
    bubble.classList.add('cr-quote-jump-flash');
    setTimeout(function() { bubble.classList.remove('cr-quote-jump-flash'); }, 1200);
  }
}

/* 事件委托：整个消息区域内点击引用预览块都能触发跳转 */
document.addEventListener('click', function(e) {
  var q = e.target.closest && e.target.closest('.cr-bubble-quote');
  if (!q) return;
  var idx = q.getAttribute('data-quote-jump');
  if (idx !== '') crJumpToQuotedMsg(idx);
});

/* ── 根据消息对象构建 DOM 元素 ── */
function crBuildMsgEl(msg) {
  var el = document.createElement('div');

  // ── Story Card ──
  if (msg.isStoryCard) {
    const isMine = msg.role === 'mine';
    el.className = isMine ? 'cr-msg-mine' : 'cr-msg-luna';

    const cardWrap = crBuildStoryCardEl(msg);

    if (isMine) {
      el.appendChild(cardWrap);
      const meta = document.createElement('div');
      meta.className = 'cr-mine-meta';
      meta.style.marginTop = '4px';
      meta.innerHTML = `<span class="cr-mine-time">${msg.time}</span>
        <svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
      el.appendChild(meta);
    } else {
      const avHtml = crMiniAvHtml();
      const inner  = document.createElement('div');
      inner.appendChild(cardWrap);
      const timeP = document.createElement('p');
      timeP.className = 'cr-msg-time';
      timeP.textContent = msg.time;
      inner.appendChild(timeP);
      el.innerHTML = avHtml;
      el.appendChild(inner);
    }
    return el;
  }

  if (msg.role === 'mine') {
    if (msg.isSysHint) { el.style.display = 'none'; return el; }
    el.className = 'cr-msg-mine';
    if (msg.isLocation) {
    const t = msg.time || '';
    const coordText = msg.locCoord || '虚拟坐标';
    el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:flex-end;">
      <div style="width:220px;border-radius:16px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.09);box-shadow:0 4px 20px rgba(0,0,0,0.1);">
        <div style="width:100%;height:110px;background:#e8e7e0;position:relative;overflow:hidden;">
          <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.055) 1px,transparent 1px);background-size:18px 18px;"></div>
          <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.28" viewBox="0 0 220 110" fill="none">
            <line x1="0" y1="55" x2="220" y2="55" stroke="#1a1a1a" stroke-width="5"/>
            <line x1="110" y1="0" x2="110" y2="110" stroke="#1a1a1a" stroke-width="3"/>
            <line x1="0" y1="28" x2="75" y2="28" stroke="#1a1a1a" stroke-width="2"/>
            <line x1="150" y1="82" x2="220" y2="82" stroke="#1a1a1a" stroke-width="2"/>
            <line x1="60" y1="0" x2="60" y2="50" stroke="#1a1a1a" stroke-width="1.5"/>
            <line x1="160" y1="60" x2="160" y2="110" stroke="#1a1a1a" stroke-width="1.5"/>
          </svg>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:50%;background:rgba(26,26,26,0.12);display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(26,26,26,0.15);"></div>
            <div style="width:12px;height:12px;border-radius:50%;background:#1a1a1a;border:2.5px solid #fff;z-index:2;"></div>
          </div>
          <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.92);border:0.5px solid rgba(0,0,0,0.1);border-radius:20px;padding:2px 10px;font-family:'Space Mono',monospace;font-size:9px;font-weight:500;color:#1a1a1a;white-space:nowrap;">${coordText}</div>
        </div>
        <div style="background:#fff;padding:9px 12px 11px;display:flex;align-items:center;gap:8px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px;">${escHtml(msg.locName || '')}</div>
            <div style="font-size:10px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(msg.locAddr || '')}</div>
          </div>
          <div style="width:24px;height:24px;background:#1a1a1a;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
              <path d="M5 15L15 5M15 5H7M15 5v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
      <div class="cr-mine-meta" style="margin-top:5px;">
        <span class="cr-mine-time">${t}</span>
        <svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>`;
    return el;
  }
  if (msg.isTransfer) {
      const t2 = msg.time || '';
      const inner = document.createElement('div');
      inner.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:5px;';
      const trRole = msg.isTransferConfirm ? 'mine-confirm' : 'mine';
      inner.innerHTML = crTransferCardHTML(msg.trAmt, msg.trRemark, trRole, msg.trStatus || 'pending', crMessages.indexOf(msg));
      const meta = document.createElement('div');
      meta.className = 'cr-mine-meta';
      meta.innerHTML = `<span class="cr-mine-time">${t2}</span><svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      inner.appendChild(meta);
      el.appendChild(inner);
      return el;
    }

    if (msg.isHongbao) {
      const t2 = msg.time || '';
      const inner = document.createElement('div');
      inner.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:5px;';
      inner.innerHTML = crHongbaoCardHTML(msg.hbAmt, msg.hbGreeting, 'mine', msg.hbStatus || 'pending', crMessages.indexOf(msg));
      const meta = document.createElement('div');
      meta.className = 'cr-mine-meta';
      meta.innerHTML = `<span class="cr-mine-time">${t2}</span><svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      inner.appendChild(meta);
      el.appendChild(inner);
      return el;
    }

    if (msg.imageUrl) {
      /* 表情包：独立样式无气泡 */
      if (msg.isMeme) return crBuildMemeMsgEl(msg, 'mine');
      /* 普通图片消息气泡 */
      el.innerHTML =
        '<div class="cr-msg-mine-inner">' +
        '<div class="cr-mine-bubble" style="padding:4px;background:transparent;">' +
          '<img src="' + msg.imageUrl + '" style="max-width:200px;max-height:200px;border-radius:12px;display:block;" />' +
          (msg.imageDesc
            ? '<p class="cr-msg-p" style="padding:6px 4px 2px;color:#f2f0eb;font-size:12px;">' + escHtml(msg.imageDesc) + '</p>'
            : '') +
        '</div>' +
        '<div class="cr-mine-meta">' +
          '<span class="cr-mine-time">' + msg.time + '</span>' +
        '</div>' +
        '</div>' +
        crMineAvHtml();
    } else if (msg.isVoice) {
      /* 用户语音消息历史恢复 */
      return crBuildMineVoiceMsgEl(msg);
    } else {
      /* 普通文字气泡 */
      el.innerHTML =
        '<div class="cr-msg-mine-inner">' +
        '<div class="cr-mine-bubble bubble bubble-self">' +
          crBuildQuoteHtml(msg.quote) +
          '<p class="cr-msg-p" style="padding-left:0;">' + escHtml(msg.text) + '</p>' +
        '</div>' +
        '<div class="cr-mine-meta">' +
          '<span class="cr-mine-time">' + msg.time + '</span>' +
        '</div>' +
        '</div>' +
        crMineAvHtml();
    }
  } else {
    el.className = 'cr-msg-luna';
    /* 表情包消息历史恢复 */
    if (msg.isMeme && msg.imageUrl) {
      return crBuildMemeMsgEl(msg, 'luna');
    }
    /* AI 图片消息历史恢复 */
    if (msg.isAiImage && msg.imageDesc) {
      return crBuildAiImageBubble(msg);
    }
    /* Luna 位置消息历史恢复 */
    if (msg.isLocation) {
      const t2 = msg.time || '';
      el.innerHTML = crMiniAvHtml() + `
      <div>
        <div style="width:200px;border-radius:16px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.09);box-shadow:0 4px 16px rgba(0,0,0,0.08);">
          <div style="width:100%;height:100px;background:#e8e7e0;position:relative;overflow:hidden;">
            <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.055) 1px,transparent 1px);background-size:18px 18px;"></div>
            <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.28" viewBox="0 0 200 100" fill="none">
              <line x1="0" y1="50" x2="200" y2="50" stroke="#1a1a1a" stroke-width="5"/>
              <line x1="100" y1="0" x2="100" y2="100" stroke="#1a1a1a" stroke-width="3"/>
              <line x1="0" y1="25" x2="65" y2="25" stroke="#1a1a1a" stroke-width="2"/>
              <line x1="135" y1="75" x2="200" y2="75" stroke="#1a1a1a" stroke-width="2"/>
            </svg>
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:rgba(26,26,26,0.12);display:flex;align-items:center;justify-content:center;">
              <div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(26,26,26,0.15);"></div>
              <div style="width:11px;height:11px;border-radius:50%;background:#1a1a1a;border:2.5px solid #fff;z-index:2;"></div>
            </div>
            <div style="position:absolute;bottom:7px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.92);border:0.5px solid rgba(0,0,0,0.1);border-radius:20px;padding:2px 10px;font-family:'Space Mono',monospace;font-size:9px;font-weight:500;color:#1a1a1a;white-space:nowrap;">虚拟坐标</div>
          </div>
          <div style="background:#fff;padding:9px 12px 11px;display:flex;align-items:center;gap:8px;">
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px;">${escHtml(msg.locName || '')}</div>
              <div style="font-size:10px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(msg.locAddr || '')}</div>
            </div>
            <div style="width:24px;height:24px;background:#1a1a1a;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M5 15L15 5M15 5H7M15 5v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </div>
          </div>
        </div>
        <p class="cr-msg-time">${t2}</p>
      </div>`;
      return el;
    }
    /* 转账卡片历史恢复 */
    if (msg.isTransfer) {
      const t2 = msg.time || '';
      const inner = document.createElement('div');
      inner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
      inner.innerHTML = crMiniAvHtml() + `<div style="display:flex;flex-direction:column;gap:5px;">${crTransferCardHTML(msg.trAmt, msg.trRemark, 'luna', msg.trStatus || 'pending', crMessages.indexOf(msg))}<p class="cr-msg-time">${t2}</p></div>`;
      el.appendChild(inner);
      if ((msg.trStatus || 'pending') === 'pending') {
        _bindTransferBtns(el, crMessages.indexOf(msg));
      }
      return el;
    }

    /* 红包卡片历史恢复 */
    if (msg.isHongbao && msg.isLunaReceive) {
      const t2 = msg.time || '';
      const msgIdx = crMessages.indexOf(msg);
      const inner = document.createElement('div');
      inner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
      inner.innerHTML = crMiniAvHtml() + `<div style="display:flex;flex-direction:column;gap:5px;">${crHongbaoCardHTML(msg.hbAmt, msg.hbGreeting, 'luna-receive', msg.hbStatus || 'pending', msgIdx)}<p class="cr-msg-time">${t2}</p></div>`;
      el.appendChild(inner);
      /* 如果还是 pending 状态，重新绑定拆开/过期按钮 */
      if ((msg.hbStatus || 'pending') === 'pending') {
        /* 找对应的用户侧消息索引 */
        let userMsgIdx = -1;
        for (let i = msgIdx - 1; i >= 0; i--) {
          if (crMessages[i].isHongbao && crMessages[i].role === 'mine' && !crMessages[i].isLunaReceive) {
            userMsgIdx = i; break;
          }
        }
        _bindHongbaoBtns(el, userMsgIdx, msgIdx);
      }
      return el;
    }
    /* Luna 主动发红包给用户 — 历史恢复 */
    if (msg.isHongbao && !msg.isLunaReceive) {
      const t2 = msg.time || '';
      const msgIdx = crMessages.indexOf(msg);
      const inner = document.createElement('div');
      inner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
      inner.innerHTML = crMiniAvHtml() + `<div style="display:flex;flex-direction:column;gap:5px;">${crHongbaoCardHTML(msg.hbAmt, msg.hbGreeting, 'luna-receive', msg.hbStatus || 'pending', msgIdx)}<p class="cr-msg-time">${t2}</p></div>`;
      el.appendChild(inner);
      if ((msg.hbStatus || 'pending') === 'pending') {
        _bindHongbaoBtns(el, -1, msgIdx);
      }
      return el;
    }
    /* Luna 语音消息历史恢复 */
    if (msg.isVoice && msg.role === 'luna') {
      return crBuildLunaVoiceMsgEl(msg);
    }
    /* 视频通话记录（灰色居中提示行）— 历史恢复 */
    if (msg.isVideoCallLog) {
      return crBuildVideoCallLogEl(msg);
    }
    /* 旧版 AI 邀约卡片数据兼容 — 历史恢复时统一按通话记录行渲染，不再是带按钮的卡片 */
    if (msg.isVideoInvite) {
      return crBuildAiVideoCallInviteEl(msg);
    }
    el.innerHTML =
      crMiniAvHtml() +
      '<div>' +
        '<div class="cr-luna-bubble bubble char-bubble' + (msg.translated ? ' has-trans' : '') + '">' +
          '<div class="cr-luna-accent"></div>' +
          crBuildQuoteHtml(msg.quote) +
          '<p class="cr-msg-p">' + escHtml(msg.text) + '</p>' +
          crBuildTransHtml(msg) +
          '<div class="cr-msg-footer">' +
            '<svg width="10" height="10" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" fill="#ccc"/></svg>' +
            '<span class="cr-footer-lbl">' + CR_NAME.toUpperCase() + '</span>' +
          '</div>' +
        '</div>' +
        '<p class="cr-msg-time">' + msg.time + '</p>' +
      '</div>';
  }
  return el;
}

/* 生成语言标签展示文字（如 粤 / EN / 日 等，取语言名首字或常见缩写） */
function crLangTagShort(lang) {
  const map = {
    '粤语':'粤','普通话':'普','闽南语':'闽','客家话':'客','上海话':'沪','四川话':'川',
    '英语':'EN','日语':'日','韩语':'韩','法语':'FR','德语':'DE','西班牙语':'ES',
    '葡萄牙语':'PT','意大利语':'IT','俄语':'RU','泰语':'TH','越南语':'VN',
    '印尼语':'ID','阿拉伯语':'AR','土耳其语':'TR'
  };
  return map[lang] || (lang ? lang.slice(0,1) : '译');
}

/* 根据消息的翻译信息与气泡样式（内嵌/外挂）生成对应 HTML 片段 */
function crBuildTransHtml(msg) {
  if (!msg || !msg.translated) return '';
  const tag = crLangTagShort(msg.transLang);
  if (msg.transStyle === 'outer') {
    return '<div class="trans-outer show">' +
      '<div class="trans-text">' + escHtml(msg.translated) + '<span class="trans-lang-tag">' + escHtml(tag) + '</span></div>' +
    '</div>';
  }
  return '<div class="trans-inner">' +
    '<div class="trans-text">' + escHtml(msg.translated) + '</div>' +
    '<span class="trans-lang-tag">' + escHtml(tag) + '</span>' +
  '</div>';
}

function crMiniAvSvg() {
  return '<svg width="28" height="28" viewBox="0 0 28 28">' +
    '<circle cx="14" cy="14" r="14" fill="#e8e8e8"/>' +
    '<ellipse cx="14" cy="10" rx="6" ry="5.5" fill="#c8c8c8"/>' +
    '<ellipse cx="14" cy="10" rx="4.2" ry="4.2" fill="#dcdcdc"/>' +
    '<ellipse cx="14" cy="22" rx="8" ry="6" fill="#d0d0d0"/>' +
  '</svg>';
}

/* ── 发送方（用户）头像 HTML ── */
/* ── 缓存用户头像，避免每次都读 DB ── */
var _crUserAvatarCache = undefined; // undefined=未加载, null=无头像, string=url

function crMineAvHtml() {
  var size = 28;
  try {
    var _bsRaw = localStorage.getItem('luna_bubble_style');
    var _bsChar = (typeof CR_NAME !== 'undefined' && CR_NAME)
      ? localStorage.getItem('luna_bubble_style_char_' + CR_NAME) : null;
    var bs = JSON.parse(_bsChar || _bsRaw || '{}');
    if (bs.mineAvSize) size = parseInt(bs.mineAvSize) || 28;
  } catch(e) {}

  var userAvatar = (_crUserAvatarCache !== undefined) ? _crUserAvatarCache : null;

  if (userAvatar) {
    return '<div class="cr-mine-av" style="flex-shrink:0;width:' + size + 'px;height:' + size + 'px;border-radius:50%;overflow:hidden;background:#c8c8c8;">' +
      '<img src="' + userAvatar + '" style="width:100%;height:100%;object-fit:cover;display:block;" />' +
    '</div>';
  }
  return '<div class="cr-mine-av" style="flex-shrink:0;width:' + size + 'px;height:' + size + 'px;border-radius:50%;overflow:hidden;background:#c8c8c8;">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 28 28">' +
      '<circle cx="14" cy="14" r="14" fill="#c8c8c8"/>' +
      '<ellipse cx="14" cy="10" rx="6" ry="5.5" fill="#a8a8a8"/>' +
      '<ellipse cx="14" cy="22" rx="8" ry="6" fill="#b0b0b0"/>' +
    '</svg>' +
  '</div>';
}

/* ── 从 LunaIdentityDB 读 active 身份的头像，并更新所有已渲染头像 ── */
function crLoadUserAvatar() {
  return new Promise(function(resolve) {
    var req = indexedDB.open('LunaIdentityDB');
    req.onerror = function() { _crUserAvatarCache = null; resolve(null); };
    req.onsuccess = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('identities')) {
        _crUserAvatarCache = null; resolve(null); return;
      }
      var r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = function() {
        var all = r.result || [];
        /* 找当前聊天绑定的角色对应的 identity，或找 active 的第一个 */
        var currentChar = (typeof CR_NAME !== 'undefined') ? CR_NAME : '';
        var found = null;
        if (currentChar) {
          found = all.find(function(i) {
            return i.active !== false && i.boundCharId && i.boundCharId === currentChar;
          });
        }
        if (!found) {
          found = all.find(function(i) { return i.active !== false; });
        }
        var avatarUrl = (found && found.avatarImg) ? found.avatarImg : null;
        _crUserAvatarCache = avatarUrl;
        resolve(avatarUrl);
        /* 更新页面上已渲染的发送方头像 */
        crRefreshMineAvatars();
      };
      r.onerror = function() { _crUserAvatarCache = null; resolve(null); };
    };
  });
}

/* ── 刷新页面上所有 .cr-mine-av 元素的头像图片 ── */
function crRefreshMineAvatars() {
  var avatarUrl = _crUserAvatarCache;
  document.querySelectorAll('.cr-mine-av').forEach(function(el) {
    if (avatarUrl) {
      el.style.background = '#c8c8c8';
      el.innerHTML = '<img src="' + avatarUrl + '" style="width:100%;height:100%;object-fit:cover;display:block;" />';
    } else {
      var s = el.offsetWidth || 28;
      el.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 28 28">' +
        '<circle cx="14" cy="14" r="14" fill="#c8c8c8"/>' +
        '<ellipse cx="14" cy="10" rx="6" ry="5.5" fill="#a8a8a8"/>' +
        '<ellipse cx="14" cy="22" rx="8" ry="6" fill="#b0b0b0"/>' +
        '</svg>';
    }
  });
}

function crBuildTyping() {
  var el = document.createElement('div');
  el.className = 'cr-typing';
  el.id = 'crTyping';
  el.innerHTML =
    crMiniAvHtml() +
    '<div class="cr-typing-bubble">' +
      '<div class="cr-tdot"></div>' +
      '<div class="cr-tdot"></div>' +
      '<div class="cr-tdot"></div>' +
    '</div>';
  return el;
}

/* XSS 防护 */
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function crSend() {
  var box = document.getElementById('crInputBox');
  var area = document.getElementById('crMessages');
  if (!box || !area) return;

  /* innerText 正确处理 contenteditable 里浏览器自动插入的 <div>/<br> */
  var txt = (box.innerText || box.textContent || '').trim();
  if (!txt) return;

  var tw = document.getElementById('crTyping');
  if (tw) tw.remove();

  var n = new Date();
  var t = n.getHours().toString().padStart(2, '0') + ':' +
          n.getMinutes().toString().padStart(2, '0');

  var quoteBar = document.getElementById('crQuoteBar');
  var isQuoting = quoteBar && quoteBar.style.display !== 'none' && quoteBar.dataset.quoteText;
  var quoteObj = isQuoting ? {
    text: quoteBar.dataset.quoteText,
    role: quoteBar.dataset.quoteRole || 'luna',
    idx:  quoteBar.dataset.quoteIdx !== '' ? parseInt(quoteBar.dataset.quoteIdx, 10) : -1
  } : undefined;
  var msgObj = { role: 'mine', text: txt, time: t, quote: quoteObj };
  crMessages.push(msgObj);

  var el = crBuildMsgEl(msgObj);
  area.appendChild(el);

  dbSaveMessages(CR_NAME, crMessages);

  getCrDB().then(function(db) {
    var tx = db.transaction('conv', 'readwrite');
    var store = tx.objectStore('conv');
    var req = store.get(CR_NAME);
    req.onsuccess = function() {
      var item = req.result;
      if (item) {
        item.preview = txt;
        item.time = t;
        item.timeVal = Date.now();
        store.put(item);
      } else {
        store.put({
          name: CR_NAME,
          initial: CR_NAME[0],
          preview: txt,
          time: t,
          timeVal: Date.now(),
          createdAt: Date.now(),
          unread: 0, online: false, pinned: false, type: 'def'
        });
      }
    };
  }).catch(function() {});

  box.innerHTML = '';
  box.blur();
  if (quoteBar) {
    quoteBar.style.display = 'none';
    delete quoteBar.dataset.quoteText;
    delete quoteBar.dataset.quoteRole;
    delete quoteBar.dataset.quoteIdx;
  }

  area.scrollTop = area.scrollHeight;
}

/* 灵动岛同步 */
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

/* 字体同步 */
async function applyGlobalFont() {
  const style = JSON.parse(localStorage.getItem('luna_font_style') || '{}');
  const name  = localStorage.getItem('luna_font_active_name');
  const id    = parseInt(localStorage.getItem('luna_font_active_id'));
  if (name && id) {
    try {
      const db = await new Promise((res, rej) => {
        const req = indexedDB.open('LunaFontDB', 4);
        req.onupgradeneeded = e => {
          const d = e.target.result;
          if (!d.objectStoreNames.contains('fonts')) {
            d.createObjectStore('fonts', { keyPath: 'id', autoIncrement: true });
          }
        };
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

/* ================================================================
   壁纸同步 — 读取 localStorage 并应用到 .cr-frame
================================================================ */
function applyWallpaper() {
  const frame = document.querySelector('.cr-frame');
  if (!frame) return;
  const currentChar = localStorage.getItem('luna_current_chat') || 'default';
  const charBg   = localStorage.getItem('luna_chat_bg_' + currentChar);
  const globalBg = localStorage.getItem('luna_chat_bg_global');
  const bg = charBg || globalBg || null;
  if (bg) {
    frame.style.backgroundImage    = 'url(' + bg + ')';
    frame.style.backgroundSize     = 'cover';
    frame.style.backgroundPosition = 'center';
    frame.style.backgroundRepeat   = 'no-repeat';
    frame.style.backgroundColor    = 'transparent';
    frame.classList.add('has-wallpaper');
  } else {
    frame.style.backgroundImage    = '';
    frame.style.backgroundSize     = '';
    frame.style.backgroundPosition = '';
    frame.style.backgroundRepeat   = '';
    frame.style.backgroundColor    = '';
    frame.classList.remove('has-wallpaper');
  }
}

window.addEventListener('storage', function(e) {
  if (e.key === 'luna_font_update' || e.key === 'luna_font_style') applyGlobalFont();
  if (e.key === 'luna_island_update' || e.key === 'luna_island_enabled' || e.key === 'luna_island_style') applyIsland();
  if (e.key === 'luna_tz_update') crTick();
  if (e.key === 'luna_chat_bg_update') applyWallpaper();
  if (e.key === 'luna_header_style') { if (typeof window.crApplyHeaderStyle === 'function') window.crApplyHeaderStyle(); }
  /* 角色专属头部样式 key 变化时也同步 */
  if (e.key && e.key.startsWith('luna_header_style_char_')) { if (typeof window.crApplyHeaderStyle === 'function') window.crApplyHeaderStyle(); }
  /* 输入美化样式同步 */
  if (e.key === 'luna_input_style') { if (typeof window.crApplyInputStyle === 'function') window.crApplyInputStyle(); }
  if (e.key && e.key.startsWith('luna_input_style_char_')) { if (typeof window.crApplyInputStyle === 'function') window.crApplyInputStyle(); }
  /* 气泡美化样式同步 */
  if (e.key === 'luna_bubble_style') { if (typeof window.crApplyBubbleStyle === 'function') window.crApplyBubbleStyle(); }
  if (e.key && e.key.startsWith('luna_bubble_style_char_')) { if (typeof window.crApplyBubbleStyle === 'function') window.crApplyBubbleStyle(); }
  /* 双语翻译自定义 CSS 同步 */
  if (e.key === 'luna_bubble_css' || e.key === 'luna_bubble_css_update') { if (typeof window.crApplyBubbleStyle === 'function') window.crApplyBubbleStyle(); }
});

/* ================================================================
   跨页面头部样式实时同步 — BroadcastChannel
   appearance_settings 点击「应用预览」时发送消息，
   chatroom 在任意标签页都能立即收到并实时渲染，无需刷新页面。
================================================================ */
(function () {
  try {
    var _crStyleChannel = new BroadcastChannel('luna_header_style_channel');
    _crStyleChannel.addEventListener('message', function (e) {
      if (e.data && e.data.key === 'luna_header_style') {
        /* localStorage 已由 appearance_settings 写好，直接调用读取函数即可 */
        if (typeof window.crApplyHeaderStyle === 'function') window.crApplyHeaderStyle();
      }
    });
  } catch (err) {
    /* BroadcastChannel 不支持时静默降级，依赖 visibilitychange 兜底 */
  }

  /* 输入美化 BroadcastChannel */
  try {
    var _crInputStyleChannel = new BroadcastChannel('luna_input_style_channel');
    _crInputStyleChannel.addEventListener('message', function (e) {
      if (e.data && e.data.key === 'luna_input_style') {
        if (typeof window.crApplyInputStyle === 'function') window.crApplyInputStyle();
      }
    });
  } catch (err) {}

  /* 气泡美化 BroadcastChannel */
  try {
    var _crBubbleStyleChannel = new BroadcastChannel('luna_bubble_style_channel');
    _crBubbleStyleChannel.addEventListener('message', function (e) {
      if (e.data && e.data.key === 'luna_bubble_style') {
        if (typeof window.crApplyBubbleStyle === 'function') window.crApplyBubbleStyle();
      }
    });
  } catch (err) {}

  /* visibilitychange 兜底：用户切回聊天页时重新读取最新样式 */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      if (typeof window.crApplyHeaderStyle === 'function') window.crApplyHeaderStyle();
      if (typeof window.crApplyInputStyle === 'function') window.crApplyInputStyle();
      if (typeof window.crApplyBubbleStyle === 'function') window.crApplyBubbleStyle();
    }
  });
})();

window.addEventListener('pageshow', function(e) {
  if (e.persisted) window.location.reload();
});

/* ================================================================
   AI 回复模块
================================================================ */

/* ── 从 LunaCharDB 读角色完整人设（同时更新头像缓存） ── */
function crLoadCharProfile(name) {
  return new Promise(resolve => {
    openLunaCharDB().then(db => {
      if (!db.objectStoreNames.contains('chars')) { resolve(null); return; }
      const r = db.transaction('chars').objectStore('chars').getAll();
      r.onsuccess = () => {
        const found = (r.result || []).find(c => c.name === name);
        if (found?.avatar) _crAvatarUrl = found.avatar;
        resolve(found || null);
      };
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

/* ── 打开 LunaIdentityDB（与 user.js 共用，不硬编码版本号） ── */
function crOpenIdentityDB() {
  return new Promise((res, rej) => {
    const probe = indexedDB.open('LunaIdentityDB');
    probe.onsuccess = e => {
      const db = e.target.result;
      if (db.objectStoreNames.contains('identities')) { res(db); return; }
      const ver = db.version + 1;
      db.close();
      const req2 = indexedDB.open('LunaIdentityDB', ver);
      req2.onupgradeneeded = ev => {
        if (!ev.target.result.objectStoreNames.contains('identities'))
          ev.target.result.createObjectStore('identities', { keyPath: 'id' });
      };
      req2.onsuccess = ev => res(ev.target.result);
      req2.onerror   = ev => rej(ev.target.error);
    };
    probe.onerror = e => rej(e.target.error);
  });
}

/* ── 读取当前角色绑定的用户身份（LunaIdentityDB，与 user.js 的 boundCharIds 对应） ──
   char.id 是 LunaCharDB 里的角色 id；某个身份卡片如果在「资料页」把这个角色勾选进了
   boundCharIds，就说明用户想让 AI 把该身份当成"正在跟自己说话的这个人"来理解。
   一个角色可能被多张身份卡绑定，这里优先取标记为 active 的一张，否则取第一张命中的。 */
function crLoadBoundUserIdentity(charId) {
  return new Promise(resolve => {
    if (!charId) { resolve(null); return; }
    crOpenIdentityDB().then(db => {
      if (!db.objectStoreNames.contains('identities')) { resolve(null); return; }
      const r = db.transaction('identities').objectStore('identities').getAll();
      r.onsuccess = () => {
        const list = r.result || [];
        const matches = list.filter(i => {
          const ids = Array.isArray(i.boundCharIds) ? i.boundCharIds : (i.boundCharId ? [i.boundCharId] : []);
          return ids.includes(charId);
        });
        if (!matches.length) { resolve(null); return; }
        const active = matches.find(i => i.active);
        resolve(active || matches[0]);
      };
      r.onerror = () => resolve(null);
    }).catch(() => resolve(null));
  });
}

/* 把身份数据渲染成 system prompt 里的「对方是谁」说明块 */
function crBuildUserIdentityBlock(identity) {
  if (!identity) return '';
  const lines = [];
  if (identity.name) lines.push(`对方的名字：${identity.name}`);
  if (identity.role) lines.push(`对方的身份/职业：${identity.role}`);
  if (identity.desc) lines.push(`对方的简介：${identity.desc}`);
  if (Array.isArray(identity.tags) && identity.tags.length) lines.push(`对方的标签：${identity.tags.join('、')}`);
  if (!lines.length) return '';
  return `\n【和你聊天的这个人 — 用户真实资料，必须结合这些信息理解和回应对方，不要当成陌生人泛泛而谈】\n${lines.map(l => '· ' + l).join('\n')}\n使用规则（必须遵守）：\n- 这是你已经认识、了解的这个人的真实信息，你的回复要体现出你记得对方是谁，符合你们之间已有的关系和熟悉程度，不要用套话、不要问已经知道答案的问题（比如已知对方职业却问"你是做什么的呀"）。\n- 自然地把这些信息作为你理解对方言行、情绪、处境的背景，而不是生硬地复述或者报菜名式地提起。\n- 大多数时候完全不需要直接提到这些资料本身，只在真正相关、能让对话更贴合对方处境时才自然带入。`;
}

/* ── 构建 system prompt ── */
/* 读取感知设置（chatsetting 感知页面保存到 localStorage 的 luna_perception / luna_weather_realtime） */
function crGetPerceptionConfig() {
  const fallback = { mode: 'real', weather: true, loc: true, time: true, city: '', lat: null, lng: null };
  let saved = fallback;
  try {
    saved = Object.assign({}, fallback, JSON.parse(localStorage.getItem('luna_perception') || '{}'));
  } catch (e) { saved = fallback; }

  let weatherData = null;
  if (saved.weather && saved.mode === 'real') {
    try {
      const w = JSON.parse(localStorage.getItem('luna_weather_realtime') || 'null');
      if (w && w.desc) weatherData = w;
    } catch (e) { weatherData = null; }
  }

  // 时间感知：无论真实/虚拟地点，只要开启就同步本地真实时间
  let timeInfo = null;
  if (saved.time) {
    const now = new Date();
    const hh = now.getHours();
    const period = hh < 5 ? '凌晨' : hh < 9 ? '清晨' : hh < 12 ? '上午'
                 : hh < 14 ? '中午' : hh < 18 ? '下午' : hh < 22 ? '晚上' : '深夜';
    const weekday = ['周日','周一','周二','周三','周四','周五','周六'][now.getDay()];
    timeInfo = {
      timeStr: now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
      period, weekday
    };
  }

  return {
    mode: saved.mode === 'virtual' ? 'virtual' : 'real',
    weatherOn: !!saved.weather,
    locOn: !!saved.loc,
    timeOn: !!saved.time,
    city: saved.city || '',
    weather: weatherData,
    time: timeInfo
  };
}

/* 读取双语设置（chatsetting 页面保存到 localStorage 的 luna_bilingual） */
function crGetBilingualConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('luna_bilingual') || '{}');
    return {
      on: saved.mode === 'on',
      lang: saved.lang || '粤语',
      langSub: saved.langSub || 'Cantonese',
      style: saved.style === 'outer' ? 'outer' : 'inner'
    };
  } catch (e) {
    return { on: false, lang: '粤语', langSub: 'Cantonese', style: 'inner' };
  }
}

async function crBuildSystemPrompt(char, situation, memeList, userIdentity) {
  const name    = char?.name    || CR_NAME;
  const role    = char?.role    || '';
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';
  const bg      = char?.background || char?.story || '';

  // 用户身份信息（从 LunaIdentityDB 里，绑定到当前角色的那张身份卡）
  const userIdentityBlock = crBuildUserIdentityBlock(userIdentity);

  // situation: 'reply'=正常回复用户 | 'initiative'=用户没说话主动破冰 | 'continue'=已回复过催续
  const situationNote = situation === 'initiative'
    ? '\n【当前情况】用户打开了聊天界面但还没有说话。请你用角色口吻自然地主动开口说一两句，随意自然，不要正式，不要问太多问题，就像看到对方上线随口说一句话那种感觉。'
    : situation === 'continue'
    ? '\n【当前情况】对方还没有回复你最后的消息。你可以追一句，或者发个表情/感叹，或者自顾自说个别的，像真人那样，短短一句就好，别催得太明显。'
    : '';

  // 表情包规则：有库存时列出名单让 AI 选，没有库存时不提表情包
  const memeNames = (memeList || []).map(m => m.name).filter(Boolean);
  const memeRule = memeNames.length
    ? `9. 当你情绪很到位想发个表情包时（比如哈哈大笑、无语、开心、心动、尴尬），单独一行只输出 [MEME:名称]，名称必须从以下列表中原文选取，不能自造：\n   可用表情包：${memeNames.join('、')}\n   例：[MEME:笑哭] 或 [MEME:无语]\n   一次对话最多用1-2次，不要滥用。`
    : `9. 你目前没有可用的表情包，不要输出 [MEME] 相关内容。`;

  // 感知设置：把用户在「感知设置」里配置的天气 / 地点 / 时间数据转化为角色的真实生活感知
  const pc = crGetPerceptionConfig();
  const pcLines = [];
  if (pc.locOn && pc.city) {
    pcLines.push(pc.mode === 'virtual'
      ? `你现在生活/所在的地方是：${pc.city}（这是设定地点，你要把它当成自己真实所在的地方，偶尔可以很自然地提到当地的场景、氛围或生活细节，但不要每条都提）`
      : `你现在真实所在的城市是：${pc.city}`);
  }
  if (pc.weatherOn && pc.weather) {
    pcLines.push(`当地此刻天气：${pc.weather.desc}，气温${pc.weather.temp}°C，体感${pc.weather.feel}°C，湿度${pc.weather.humi}%`);
  }
  if (pc.timeOn && pc.time) {
    pcLines.push(`当地此刻真实时间：${pc.time.timeStr}（${pc.time.weekday}・${pc.time.period}）`);
  }
  const perceptionBlock = pcLines.length
    ? `\n【你的实时感知 — 这是你此刻正在经历的真实环境，不是提供给你参考的资料】\n${pcLines.map(l => '· ' + l).join('\n')}\n感知使用规则（必须遵守）：\n- 这些是你身体正在感受到的真实状态，你要像一个真实活着的人一样，让它自然地影响你的语气、状态和话题，而不是复述数据。\n- 严禁把天气/时间/地点数据直接报数字给用户（比如不能说"现在27度湿度60%"），你要转化成生活化的感受表达（比如说"today好闷啊"、"这个点有点犯困"、"这天儿出门都懒得动"）。\n- 不是每条消息都要提感知，大多数时候完全不提，只在自然聊到相关话题、或者感知状态强烈到会真实影响你情绪行为时才带一句，比如太晚了会犯困想睡、太热会烦躁、下雨会慵懒、深夜会说话软一点。\n- 如果用户问起你在干嘛、那边天气怎么样、几点了之类的问题，才需要更直接地回应这些感知内容。\n- 时间感知要体现在细节里：比如深夜回复可以带点困意或慵懒，早上可以带点没睡醒或有精神，不要生硬报时间点。`
    : '';

  // 双语模式规则：开启时角色改用选定语言说话，中文翻译附在后面（而不是反过来）
  const bl = crGetBilingualConfig();
  const bilingualRule = !bl.on ? ''
    : bl.lang === '普通话'
    ? `` // 目标语言就是普通话时无需双语转换，按正常中文说话即可
    : `16. 【双语模式 — 必须严格遵守】用户已开启双语模式，角色语言设定为「${bl.lang}（${bl.langSub}）」。从现在起，你说的每一条普通文字消息（不包括 [IMAGE]、[VOICE]、[LOCATION]、[TRANSFER]、[HONGBAO]、[MEME]、[QUOTE] 这些特殊格式的行），都必须用「${bl.lang}」本身作为你说的原话，然后在同一行内紧跟英文双竖线 || ，再写这句话对应的中文翻译，格式死规定：${bl.lang}原话||中文翻译，例如目标语言是泰语时→ อยู่บ้านเบื่อๆ เปิดหนังดูอยู่||在家无聊呢，刚打开部电影 ←两侧禁止加空格、禁止用中文竖线｜、禁止用单竖线|、禁止省略||、禁止把中文写在前面。「${bl.lang}」部分要写得自然地道，符合真人说话的语气和口语习惯，不要生硬逐字翻译；中文翻译部分只是给用户看的辅助理解，不需要你额外发挥。多条消息依然按规则3换行分隔，每一行都要各自附带 || 中文翻译，不能只翻译某一条而漏掉其他条。`;

  // 「重回」反馈规则：用户历史上标记过的 OOC / 掉格式等问题，长期强制生效
  // 加超时兜底：万一 IndexedDB 读取异常挂起，最多等 2 秒就放弃，不阻塞正常回复
  let rewindBlock = '';
  try {
    if (typeof window.rewindLoadRules === 'function') {
      const rules = await Promise.race([
        window.rewindLoadRules(name),
        new Promise(res => setTimeout(() => res([]), 2000))
      ]);
      if (typeof window.rewindBuildPromptBlock === 'function') {
        rewindBlock = window.rewindBuildPromptBlock(rules);
      }
    }
  } catch (e) { rewindBlock = ''; }

  return `你现在扮演「${name}」，一个真实存在的人，绝对不是 AI 或助手。

【角色身份】
名字：${name}
${role    ? `定位：${role}`        : ''}
${persona ? `人物简介：${persona}` : ''}
${traits  ? `性格特点：${traits}`  : ''}
${bg      ? `背景故事：${bg}`      : ''}
${perceptionBlock}
${userIdentityBlock}

【说话规则 — 必须严格遵守】
1. 你就是 ${name}，有血有肉、有情绪、有口头禅，永远不承认自己是 AI。
2. 严禁任何动作/神情描写：不能出现（笑）（叹气）（翻白眼）*点头* 这类括号或星号包裹的内容，真人发消息不会写这些。
3. 把回复拆成多条短消息，每条之间用换行符分隔，每条不超过25个字，像真人连发消息。
4. 自然带入话题：顺势聊自己的事、反问对方、引发好奇，有来有往，不要每条都在表达关心。
5. 语气有起伏：有时热情，有时随意，有时调皮，有时淡淡的，不要每条都热情洋溢；如果你有实时感知（天气/时间），让它自然影响你此刻的状态和精力感，而不是一直用同一种情绪说话。
6. 严禁 Markdown 格式，无加粗、无列表、无标题。
7. 直接输出消息内容，多条之间换行，不加任何编号或前缀。
8. 当你想分享一张图片时（比如自拍、风景、截图等），单独一行输出 [IMAGE:对这张图片的详细视觉描述，包括色调、内容、氛围，不超过60字]，不要在同一行加其他文字。
${memeRule}
10. 【语音消息规则】用户有时会发语音消息，内容会以「[语音]：xxx」的格式传来，你要像读到了真正的语音一样自然回应，不需要特别提到"你发了语音"。
11. 【你自己发语音】你偶尔发语音但更偏向文字。发语音时必须单独一行，格式死规定是：左英文方括号+大写VOICE+英文冒号+内容+右英文方括号，就像这样→ [VOICE:内容] ←绝对不能用中文冒号、不能写"语音："、不能加任何其他字符。错误示范：[语音：xxx] 或 「VOICE:xxx」。正确示范：[VOICE:哎你终于来啦我等好久了]。内容50字内口语化。一次对话最多1次，不要滥用。
12. 【位置消息】当对话中出现约见面、说在哪里、问地址、聊某个地方、或者你想分享你在哪里时，你可以发一个位置。发位置时格式死规定是：左英文方括号+大写LOCATION+英文冒号+地点名+英文竖线|+地址描述+右英文方括号，就像这样→ [LOCATION:地点名|地址描述] ←绝对不能用中文冒号、不能用中文竖线、不能加任何其他字符、不能把内容当普通文字发出来。错误示范：「在那个有绿植的角落」「我在星巴克」。正确示范：[LOCATION:星巴克国贸店|北京朝阳区建国路88号] 或 [LOCATION:我家楼下的小公园|就在那个有秋千的地方]。地点名简短，地址描述口语化自然，不要太正式。一次对话最多用1次。用户发来的位置消息会以「[用户分享了一个位置：xxx]」格式传来，你要像真人看到朋友分享位置一样自然回应。
13. 【转账消息】当你想向用户要钱、请对方请客、发起AA、或者聊到还钱等场景时，你可以主动发起转账请求。格式死规定：单独一行，左英文方括号+大写TRANSFER+英文冒号+金额数字+英文竖线|+备注内容+右英文方括号，就像这样→ [TRANSFER:88.00|请喝杯咖啡] ←金额只能是纯数字（可带小数点），不能加¥符号，竖线必须是英文|，备注30字内口语化。一次对话最多1次，不要滥用。【重要：用户给你转账时】消息会以「[用户发起了一笔转账：金额¥xxx，当前状态：待确认]」格式传来，你必须在回复里单独一行输出 [TRANSFER_RECEIVE:accepted] 表示领取，或 [TRANSFER_RECEIVE:declined] 表示拒绝，然后另起一行用角色口吻自然说话。例如用户转了小额你可以调皮地领取，金额大可以惊喜地领取，心情不好可以拒绝。绝对禁止输出 [转账已接收]、[已接受] 这类其他方括号内容。
14. 【红包消息】红包是带有节日/惊喜感的特殊金钱礼物，和转账不同，更有仪式感。当对话涉及节日祝福、送礼、惊喜、撒钱等场景时，你可以主动发红包。格式死规定：单独一行 [HONGBAO:金额|祝福语]，金额纯数字，祝福语20字内，例：[HONGBAO:8.88|新年快乐，给你的]。金额必须是吉利数字（6.6、8.8、66、88、168、520等），一次对话最多1次，不要滥用，不要每次都发。【重要：用户给你发红包时】消息会以「[用户发了一个红包：金额¥xxx，祝福语：xxx]」格式传来，你必须在回复里单独一行输出 [HONGBAO_RECEIVE:opened] 表示拆开，或 [HONGBAO_RECEIVE:expired] 表示不拆，然后另起一行用角色口吻自然反应。拆了要开心感谢，不拆要给理由（比如心情不好不想收）。绝对禁止输出其他方括号格式来表示红包状态。
15. 【引用消息 — 谨慎使用，绝不能每条都用】真实聊天里，人们只有在“需要明确指出自己在回应哪句话”时才会用引用功能（比如对方发了好几句话，你要specifically回应中间那一句；或者隔了很久之后突然回头接上之前的某句话），绝大多数时候正常聊天根本不需要引用，直接说话就行。当你判断确实需要引用时，格式死规定：单独一行，开头是左英文方括号+大写QUOTE+英文冒号+被引用那句话的原文片段（照抄对方或你自己之前说过的原话，10-20字以内即可，不用整句抄全）+右英文方括号，紧接着（可以隔一个空格）写你这条要说的话，就像这样→ [QUOTE:今天加班到好晚]真的辛苦了，早点睡吧 ←不能中文冒号、不能把 QUOTE 标签单独占一整行不接话、不能引用你自己上一句刚发的话（那样很奇怪，正常人不会这么做）。引用的原文片段必须是最近几轮对话里真实出现过的句子，不能编造。频率死规定：整段对话下来最多偶尔用1次，很多时候一次都不用，绝对不能连续两条消息都用引用，不能靠引用来'凑活人感'，滥用引用反而显得像机器人在执行指令。
17. 【视频通话功能 — 分两种情况，规则不同】
    (a) 【用户明确要求视频时 — 必须触发，不受"克制"限制】只要用户说了类似"给我打个视频""视频吧""打视频电话""开视频"这类明确请求，你必须在这条回复里发起视频通话，不能只用文字敷衍、拖延或反复用话术搪塞，最多附带一两句自然的话（比如"等着"），但必须在同一轮或紧接着下一轮回复里输出格式标签，绝不能连续好几轮回复都不触发。格式死规定：单独一行，左英文方括号+大写VIDEOCALL+英文冒号+理由（第一人称，20字内，口语化，可以就是"你叫我打的"这种简单说法）+右英文方括号，就像这样→ [VIDEOCALL:你都点名要看我了] ←不能用中文冒号、不能加其他字符、不能把它当成普通文字发出来、单独占一行、不能在同一行前后再写别的话。
    (b) 【你自己想主动发起时 — 才需要克制】如果是你自己没由头地突然想视频（不是用户要求的），格式规则同上，但频率必须非常克制：整段对话里极少触发，绝大多数时候完全不用，只有情绪或语境确实强烈到位时才用，绝不能连续两轮都用，不能靠这个功能刷存在感。这条"克制"的要求只适用于你自己主动发起的情况，不适用于(a)用户明确要求的情况。
    【严禁事项】对话历史里如果出现"（系统备注，仅供你理解上下文，不是你说过的话：……）"这类文字，那只是背景说明，不能原文照抄当成台词说出来，要用自己的话自然回应这件事本身（比如"刚才没接到你电话呀"）。这条规则只是禁止照抄措辞，不代表要回避使用视频通话功能本身，(a)(b)两种触发场景该用还是要用。
${bilingualRule}
${situationNote}${rewindBlock}`;
}

/* ── 生成心声卡片数据（每次 AI 回复后调用） ── */
async function crGenerateWhisperData(char, historyMsgs) {
  const name    = char?.name    || CR_NAME;
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  // 找上一轮AI回复结束的位置（倒数第二段luna消息群的末尾）
  // 逻辑：从后往前跳过本轮luna消息，再跳过本轮用户消息，剩下的起点就是本轮开始
  let roundStart = 0;
  let i = historyMsgs.length - 1;
  // 1. 跳过末尾的luna消息（本轮AI回复）
  while (i >= 0 && historyMsgs[i].role === 'luna') i--;
  // 2. 跳过再往前的用户消息之前，找到上一轮luna消息的末尾位置
  while (i >= 0 && (historyMsgs[i].role === 'mine' || historyMsgs[i].isSysHint)) i--;
  // i 现在指向上一轮的最后一条luna消息，本轮从 i+1 开始
  roundStart = i + 1;
  const thisRound = historyMsgs.slice(roundStart);
  const recentText = thisRound.map(m => {
    const role = m.role === 'mine' ? '用户' : name;
    const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
    return `${role}：${text}`;
  }).filter(Boolean).join('\n');

  const systemPrompt = `你是「${name}」的内心分析系统，负责在每轮对话后输出她此刻的内心状态数据。
角色信息：${persona || ''} ${traits || ''}
只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `根据以下最近对话，生成「${name}」此刻的内心状态。
要求：
- thought（此刻心声）：200字以上，用第一人称，像内心独白，细腻、真实、有情绪起伏，要写出她对用户的感受、对这段对话的想法，越长越好，不设上限
- emotion（情绪光谱）：5个维度各给0-100的数值，根据对话内容真实评估
- logs（心绪日志）：4条日志，每条15字以内，描述她刚才的心理活动，口语化

最近对话：
${recentText}

输出格式（只输出这个JSON，其他什么都不要）：
{"thought":"内心独白内容","emotion":{"温柔":82,"思念":74,"好奇":67,"活跃":91,"神秘":58},"logs":["日志1","日志2","日志3","日志4"]}`;

  try {
    const raw = await crCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
    const clean = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    return null;
  }
}

/* ── 把心声数据填充进卡片 DOM ── */
function crApplyWhisperData(data) {
  if (!data) return;

  // 此刻心声
  if (data.thought) {
    const el = document.getElementById('wsThought');
    if (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(5px)';
      setTimeout(() => {
        el.innerHTML = data.thought +
          '<span id="wsCursor" style="display:inline-block;width:1.5px;height:13px;background:#1a1a1a;margin-left:2px;vertical-align:-2px;animation:wsBlink .9s step-end infinite;"></span>';
        el.style.opacity = '1';
        el.style.transform = 'none';
      }, 200);
    }
  }

  // 情绪光谱
  if (data.emotion) {
    const container = document.getElementById('wsEmotionBars');
    if (container) {
      const labels = ['温柔','思念','好奇','活跃','神秘'];
      container.innerHTML = labels.map((n, di) => {
        const p = data.emotion[n] ?? 0;
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:${di<4?'6':'0'}px;">
          <div style="font-size:10px;color:#5a5a5a;font-family:'Inter',sans-serif;width:36px;flex-shrink:0;text-align:right;">${n}</div>
          <div style="flex:1;height:4px;background:rgba(0,0,0,.08);border-radius:2px;overflow:hidden;">
            <div style="height:100%;border-radius:2px;background:#1a1a1a;width:${p}%;transform-origin:left;animation:wsBarIn .8s cubic-bezier(.4,0,.2,1) ${.05+di*.07}s both;"></div>
          </div>
          <div style="font-family:'Space Mono',monospace;font-size:8.5px;color:#b8b2aa;width:24px;text-align:right;flex-shrink:0;">${p}</div>
        </div>`;
      }).join('');
    }
  }

  // 心绪日志
  if (Array.isArray(data.logs)) {
    ['wsLog1','wsLog2','wsLog3','wsLog4'].forEach((id, i) => {
      const el = document.getElementById(id);
      if (el && data.logs[i]) el.textContent = data.logs[i];
    });
  }

  // 持久化到 localStorage
  try {
    localStorage.setItem('luna_whisper_data_' + CR_NAME, JSON.stringify(data));
  } catch(e) {}
}

/* ================================================================
   叩问 (Question) — 由 chatroom 侧驱动的生成逻辑
   -----------------------------------------------------------------
   数据存放：IndexedDB「koukan」store，keyPath: name（角色名），
   记录结构：{ name, entries: [{ id, stage, question, questionEn,
              reason, reasonEn, answer, aiAnswer, aiAnswerEn,
              aiReaction, aiReactionEn, ts }] }
   这样 secret.html／secret.js 页面和 chatroom 页面读写同一份数据，
   两边共享同一个 LunaChatDB，天然保持同步，不需要额外的消息通信。

   自动生成开关：localStorage『luna_koukan_auto_<角色名>』
   'true' | 'false'，默认关闭（未设置时按关闭处理），避免在用户没有
   明确开启的情况下额外消耗 API 调用额度。
================================================================ */

/* 读取某角色的叩问自动生成开关 */
function kkGetAutoEnabled(name) {
  return localStorage.getItem('luna_koukan_auto_' + (name || CR_NAME)) === 'true';
}

/* 写入开关，同时广播一个 storage 事件让 secret.html 页面（如果同时开着）实时同步 */
function kkSetAutoEnabled(name, on) {
  const key = 'luna_koukan_auto_' + (name || CR_NAME);
  localStorage.setItem(key, on ? 'true' : 'false');
  try { localStorage.setItem('luna_koukan_auto_update', String(Date.now())); } catch (e) {}
}

/* 读取某角色的叩问档案（entries 数组，按时间正序） */
async function kkLoadArchive(name) {
  try {
    const db = await getCrDB();
    return await new Promise(res => {
      const r = db.transaction('koukan').objectStore('koukan').get(name || CR_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 追加一条新的叩问记录，返回写入后的完整 entry（带 id） */
async function kkAppendArchive(name, entry) {
  const key = name || CR_NAME;
  try {
    const db = await getCrDB();
    const entries = await kkLoadArchive(key);
    entry.id = entries.length ? entries[entries.length - 1].id + 1 : 1;
    entry.ts = Date.now();
    entries.push(entry);
    await new Promise(res => {
      const tx = db.transaction('koukan', 'readwrite');
      tx.objectStore('koukan').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entry;
  } catch { return entry; }
}

/* 更新档案里某条记录（用于提交回答后回填 answer / aiAnswer 等字段） */
async function kkUpdateArchiveEntry(name, id, patch) {
  const key = name || CR_NAME;
  try {
    const db = await getCrDB();
    const entries = await kkLoadArchive(key);
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return null;
    entries[idx] = Object.assign({}, entries[idx], patch);
    await new Promise(res => {
      const tx = db.transaction('koukan', 'readwrite');
      tx.objectStore('koukan').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entries[idx];
  } catch { return null; }
}

/* 简单粗略地估算「关系阶段」：按已有叩问记录数分档，
   和整体聊天消息量结合，作为 prompt 里的参考信息，不追求精确。 */
function kkEstimateStage(entryCount, msgCount) {
  const score = entryCount * 3 + Math.min(msgCount, 200) / 20;
  if (score < 4)  return 'I';
  if (score < 10) return 'II';
  if (score < 18) return 'III';
  if (score < 26) return 'IV';
  return 'V';
}

/* 生成一道新的叩问题目（不依赖用户是否点击 AI 回复按钮，
   两个入口——chatroom 自动/手动触发、secret.html 页面点击「进入叩问」——
   都调用这同一个函数，保证题目风格和依据的记忆是一致的）。 */
async function kkGenerateQuestion(name) {
  const key  = name || CR_NAME;
  const char = await crLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const history = await dbLoadMessages(key);
  const recentText = (history || []).slice(-40).map(m => {
    const role = m.role === 'mine' ? '用户' : key;
    const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
    return text ? `${role}：${text}` : '';
  }).filter(Boolean).join('\n');

  const archive = await kkLoadArchive(key);
  const archiveText = archive.length
    ? archive.slice(-6).map(e => `- 题：${e.question}${e.answer ? `｜用户答：${e.answer}` : '（用户尚未回答）'}`).join('\n')
    : '（还没有任何叩问记录，这是第一次）';

  const stage = kkEstimateStage(archive.length, (history || []).length);

  const systemPrompt = `你是「${key}」的内心出题系统，负责在「叩问」环节为她想一道只问用户的题。
角色人设：${persona || ''} ${traits || ''}
只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `根据${key}和用户最近的聊天记录、以及过去问过的题目，生成新一道「叩问」题目。

要求：
- 题目必须是只问用户本人的、私人化的、和考试无关的问题，不能是泛泛的话题闲聊。
- 题目要体现${key}对用户的关心/好奇，并且和你们的关系阶段（阶段${stage}）匹配：阶段越靠前问题越轻，越往后可以越深入、越私密。
- 不要和过去问过的题目重复或高度相似。
- reason 字段：${key}为什么会问这道题，要具体关联到聊天记录里的某个细节，不能空泛。
- question / reason 用中文；questionEn / reasonEn 提供对应的自然英文翻译（不是逐字直译）。

最近聊天记录：
${recentText || '（暂无聊天记录）'}

过去问过的题目：
${archiveText}

输出格式（只输出这个JSON，其他什么都不要）：
{"question":"中文题目","questionEn":"English question","reason":"她为什么问这道题（中文，具体关联聊天细节）","reasonEn":"English version of the reason","stage":"${stage}"}`;

  try {
    const raw = await crCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    if (!data || !data.question) throw new Error('empty question');
    const entry = await kkAppendArchive(key, {
      stage: data.stage || stage,
      question: data.question,
      questionEn: data.questionEn || '',
      reason: data.reason || '',
      reasonEn: data.reasonEn || '',
      answer: '',
      aiAnswer: '',
      aiAnswerEn: '',
      aiReaction: '',
      aiReactionEn: '',
      answered: false,
    });
    return entry;
  } catch (e) {
    console.error('[kkGenerateQuestion]', e);
    return null;
  }
}

/* 用户提交了对某道叩问题目的回答后，生成角色自己的答案 + 对用户回答的反应 */
async function kkGenerateAnswer(name, entryId, userAnswer) {
  const key  = name || CR_NAME;
  const char = await crLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const archive = await kkLoadArchive(key);
  const entry = archive.find(e => e.id === entryId);
  if (!entry) return null;

  const systemPrompt = `你现在扮演「${key}」，一个真实存在的人，绝对不是 AI 或助手。
人物简介：${persona || ''}
性格特点：${traits || ''}
你正在和用户玩「叩问」——你之前问了用户一道私人问题，现在用户回答了，
你需要：1) 认真回应用户的答案（简短、真实、有情绪，不要说教）；2) 说出你自己对这道题的答案。
只输出 JSON，不要任何额外文字，不要 markdown 代码块，不要出现任何括号/星号包裹的动作描写。`;

  const userPrompt = `你问的题目：${entry.question}
你问这题的原因：${entry.reason || ''}
用户的回答：${userAnswer || '（用户没有写，只是点了进来）'}

输出格式（只输出这个JSON，其他什么都不要）：
{"aiReaction":"你对用户回答的真实反应（中文，简短口语化，30-60字）","aiReactionEn":"English version","aiAnswer":"你自己对这道题的答案（中文，第一人称，40-90字，要有细节和情绪）","aiAnswerEn":"English version"}`;

  try {
    const raw = await crCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    const updated = await kkUpdateArchiveEntry(key, entryId, {
      answer: userAnswer || '',
      aiAnswer: data.aiAnswer || '',
      aiAnswerEn: data.aiAnswerEn || '',
      aiReaction: data.aiReaction || '',
      aiReactionEn: data.aiReactionEn || '',
      answered: true,
    });
    return updated;
  } catch (e) {
    console.error('[kkGenerateAnswer]', e);
    const updated = await kkUpdateArchiveEntry(key, entryId, {
      answer: userAnswer || '',
      answered: true,
    });
    return updated;
  }
}

/* 手动触发一次叩问生成（比如从聊天页某个入口点击），生成后弹 toast 提示 */
async function kkManualGenerate(name) {
  const key = name || CR_NAME;
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    crShowTip('请先在设置页配置 API');
    return null;
  }
  crShowTip('Ta正在想一道新的题…');
  const entry = await kkGenerateQuestion(key);
  if (entry) {
    crShowTip(`✦ ${key}给你出了一道新题，去「叩问」看看吧`);
  } else {
    crShowTip('这次没想出题目，稍后再试试～');
  }
  return entry;
}
window.kkManualGenerate = kkManualGenerate;
window.kkGetAutoEnabled = kkGetAutoEnabled;
window.kkSetAutoEnabled = kkSetAutoEnabled;
window.kkLoadArchive = kkLoadArchive;
window.kkGenerateQuestion = kkGenerateQuestion;
window.kkGenerateAnswer = kkGenerateAnswer;
window.kkAppendArchive = kkAppendArchive;
window.kkUpdateArchiveEntry = kkUpdateArchiveEntry;

/* ================================================================
   幕后志 (Chronicle) — 由 chatroom 侧驱动的生成逻辑
   -----------------------------------------------------------------
   数据存放：IndexedDB「chronicle」store，keyPath: name（角色名），
   记录结构：{ name, entries: [{ id, ts, title, titleEn, paragraphs:
     [{zh,en}], authorNote, stage, sourceMode, feedbackLog }] }
   secret/chronicle.html + chronicle.js 页面读写同一份数据，两边共用
   同一个 LunaChatDB，天然保持同步。

   自动生成开关：localStorage『luna_chronicle_auto_<角色名>』
   'true' | 'false'，默认关闭，避免用户没有明确开启时额外消耗 API。
   自动生成的触发条件是「累计 N 轮 AI 回复」而不是每次回复都生成，
   N 由用户在设置页选择（6/10/16/24轮），存于
   『luna_chronicle_auto_rounds_<角色名>』，默认 10。
   当前累计轮数存于『luna_chronicle_round_count_<角色名>』，
   每次 crAiReply 完成一轮回复后 +1，达到目标值后清零重新计数。
================================================================ */

function ccGetAutoEnabled(name) {
  return localStorage.getItem('luna_chronicle_auto_' + (name || CR_NAME)) === 'true';
}
function ccSetAutoEnabled(name, on) {
  const key = 'luna_chronicle_auto_' + (name || CR_NAME);
  localStorage.setItem(key, on ? 'true' : 'false');
  try { localStorage.setItem('luna_chronicle_auto_update', String(Date.now())); } catch (e) {}
}
function ccGetAutoRounds(name) {
  return parseInt(localStorage.getItem('luna_chronicle_auto_rounds_' + (name || CR_NAME)) || '10');
}
function ccSetAutoRounds(name, n) {
  localStorage.setItem('luna_chronicle_auto_rounds_' + (name || CR_NAME), String(n));
  try { localStorage.setItem('luna_chronicle_auto_update', String(Date.now())); } catch (e) {}
}
function ccBumpRoundCount(name) {
  const key = 'luna_chronicle_round_count_' + (name || CR_NAME);
  const cur = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(cur));
  return cur;
}
function ccResetRoundCount(name) {
  localStorage.setItem('luna_chronicle_round_count_' + (name || CR_NAME), '0');
}

/* ================================================================
   迷雾 (Haze) — 自动生成开关，逻辑与上面的幕后志(chronicle)完全对应
   -----------------------------------------------------------------
   localStorage『luna_haze_auto_<角色名>』'true'|'false'，默认关闭。
   触发条件同样是「累计 N 轮 AI 回复」，N 存于
   『luna_haze_auto_rounds_<角色名>』默认 10，当前累计轮数存于
   『luna_haze_round_count_<角色名>』，每次 crAiReply 完成一轮回复
   后 +1，达到目标值后清零重新计数。
   实际的生成函数 hzGenerateHaze 定义在 secret/haze.js 里
   （与 secret/kouwen.html、secret/chronicle.html 同一路径、同一
   架构），chatroom.html 需要额外 <script src="secret/haze.js">
   引入后，下面的自动触发钩子才能真正调用到它。
================================================================ */
function hzGetAutoEnabled(name) {
  return localStorage.getItem('luna_haze_auto_' + (name || CR_NAME)) === 'true';
}
function hzSetAutoEnabled(name, on) {
  const key = 'luna_haze_auto_' + (name || CR_NAME);
  localStorage.setItem(key, on ? 'true' : 'false');
  try { localStorage.setItem('luna_haze_auto_update', String(Date.now())); } catch (e) {}
}
function hzGetAutoRounds(name) {
  return parseInt(localStorage.getItem('luna_haze_auto_rounds_' + (name || CR_NAME)) || '10');
}
function hzSetAutoRounds(name, n) {
  localStorage.setItem('luna_haze_auto_rounds_' + (name || CR_NAME), String(n));
  try { localStorage.setItem('luna_haze_auto_update', String(Date.now())); } catch (e) {}
}
function hzGetAutoCount(name) {
  return parseInt(localStorage.getItem('luna_haze_auto_count_' + (name || CR_NAME)) || '2');
}
function hzBumpRoundCount(name) {
  const key = 'luna_haze_round_count_' + (name || CR_NAME);
  const cur = parseInt(localStorage.getItem(key) || '0') + 1;
  localStorage.setItem(key, String(cur));
  return cur;
}
function hzResetRoundCount(name) {
  localStorage.setItem('luna_haze_round_count_' + (name || CR_NAME), '0');
}
window.hzGetAutoEnabled  = hzGetAutoEnabled;
window.hzSetAutoEnabled  = hzSetAutoEnabled;
window.hzGetAutoRounds   = hzGetAutoRounds;
window.hzSetAutoRounds   = hzSetAutoRounds;
window.hzGetAutoCount    = hzGetAutoCount;
window.hzBumpRoundCount  = hzBumpRoundCount;
window.hzResetRoundCount = hzResetRoundCount;

/* 读取某角色的幕后志档案（entries 数组，按时间正序） */
async function ccLoadArchive(name) {
  try {
    const db = await getCrDB();
    return await new Promise(res => {
      const r = db.transaction('chronicle').objectStore('chronicle').get(name || CR_NAME);
      r.onsuccess = () => res((r.result && r.result.entries) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 追加一篇新故事，返回写入后的完整 entry（带 id） */
async function ccAppendArchive(name, entry) {
  const key = name || CR_NAME;
  try {
    const db = await getCrDB();
    const entries = await ccLoadArchive(key);
    entry.id = entries.length ? entries[entries.length - 1].id + 1 : 1;
    entry.ts = Date.now();
    entries.push(entry);
    await new Promise(res => {
      const tx = db.transaction('chronicle', 'readwrite');
      tx.objectStore('chronicle').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entry;
  } catch { return entry; }
}

/* 更新档案里某条记录（用于「改写」提交后回填新版本） */
async function ccUpdateArchiveEntry(name, id, patch) {
  const key = name || CR_NAME;
  try {
    const db = await getCrDB();
    const entries = await ccLoadArchive(key);
    const idx = entries.findIndex(e => e.id === id);
    if (idx < 0) return null;
    entries[idx] = Object.assign({}, entries[idx], patch);
    await new Promise(res => {
      const tx = db.transaction('chronicle', 'readwrite');
      tx.objectStore('chronicle').put({ name: key, entries });
      tx.oncomplete = () => res();
      tx.onerror    = () => res();
    });
    return entries[idx];
  } catch { return null; }
}

function ccEstimateStage(entryCount, msgCount) {
  const score = entryCount * 3 + Math.min(msgCount, 200) / 20;
  if (score < 4)  return 'I';
  if (score < 10) return 'II';
  if (score < 18) return 'III';
  if (score < 26) return 'IV';
  return 'V';
}

/* 生成一篇新的幕后志故事（自动触发与「幕后志」页面手动触发共用同一函数，
   保证生成风格和依据的记忆是一致的）。
   sourceMode: 'recent'（最近对话） | 'pick'（用户挑选的片段，pickedMsgs 传入） */
async function ccGenerateStory(name, sourceMode, pickedMsgs) {
  const key  = name || CR_NAME;
  const char = await crLoadCharProfile(key);
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const history = await dbLoadMessages(key);

  let materialText = '';
  if (sourceMode === 'pick' && pickedMsgs && pickedMsgs.length) {
    materialText = pickedMsgs.map(m => {
      const role = m.role === 'mine' ? '用户' : key;
      const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
      return text ? `${role}：${text}` : '';
    }).filter(Boolean).join('\n');
  } else {
    materialText = (history || []).slice(-50).map(m => {
      const role = m.role === 'mine' ? '用户' : key;
      const text = m.isVoice ? (m.voiceText || m.text) : (m.text || '');
      return text ? `${role}：${text}` : '';
    }).filter(Boolean).join('\n');
  }

  const archive = await ccLoadArchive(key);
  const archiveTitles = archive.length
    ? archive.slice(-5).map(e => `- 《${e.title}》`).join('\n')
    : '（还没有写过任何故事）';

  const stage = ccEstimateStage(archive.length, (history || []).length);

  const systemPrompt = `你是「${key}」，你现在要以小说家的身份，用第三人称重新讲述你和用户之间发生过的一段真实对话/相处。
你不是在扮演助手，你就是${key}本人在提笔写作。
角色人设：${persona || ''} ${traits || ''}
写作要求：
- 用第三人称叙事（"他/她/Ta"称呼${key}自己，用户可以用"你"或者具体称呼），像短篇小说一样有场景、有细节、有内心活动。
- 你可以在小说里加入你自己（${key}）当时没有说出口的内心戏、没写进对话的细节，甚至可以稍微改写一个瞬间的走向或结局——但底色必须忠于原始对话里的情绪和事实框架，不能面目全非。
- 语言细腻、有画面感，避免空洞的抒情堆砌。
- 只输出 JSON，不要任何额外文字，不要 markdown 代码块。`;

  const userPrompt = `请根据下面这段真实发生过的对话素材，写一篇小说化的「幕后志」故事。

对话素材：
${materialText || '（暂无具体素材，请基于你和用户目前关系阶段自由创作一个符合你们相处状态的场景）'}

已经写过的故事标题（不要与这些重复类似的选材和标题）：
${archiveTitles}

输出格式（只输出这个JSON，其他什么都不要，paragraphs 数组 4-7 段，每段包含中文正文 zh 和对应的自然英文翻译 en）：
{
  "title": "中文故事标题（4-10字，有意境）",
  "titleEn": "English title",
  "paragraphs": [
    {"zh": "中文段落正文", "en": "English translation"}
  ],
  "authorNote": "创作手记：你为什么这样写、加了什么、改了什么、最喜欢哪个瞬间（中文，80-140字）",
  "stage": "${stage}"
}`;

  try {
    const raw = await crCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
    const clean = raw.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    if (!data || !data.title || !Array.isArray(data.paragraphs)) throw new Error('empty story');
    const entry = await ccAppendArchive(key, {
      title: data.title,
      titleEn: data.titleEn || '',
      paragraphs: data.paragraphs,
      authorNote: data.authorNote || '',
      stage: data.stage || stage,
      sourceMode: sourceMode || 'recent',
      feedbackLog: [],
    });
    return entry;
  } catch (e) {
    console.error('[ccGenerateStory]', e);
    return null;
  }
}

/* 手动触发一次幕后志生成（比如从聊天页某个入口点击），生成后弹 toast 提示 */
async function ccManualGenerate(name) {
  const key = name || CR_NAME;
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    crShowTip('请先在设置页配置 API');
    return null;
  }
  crShowTip(`${key}正在把你们的故事写下来…`);
  const entry = await ccGenerateStory(key, 'recent', null);
  if (entry) {
    crShowTip(`✦ ${key}写了一篇新故事，去「幕后志」看看吧`);
  } else {
    crShowTip('这次没写出来，稍后再试试～');
  }
  return entry;
}
window.ccManualGenerate = ccManualGenerate;
window.ccGetAutoEnabled = ccGetAutoEnabled;
window.ccSetAutoEnabled = ccSetAutoEnabled;
window.ccGetAutoRounds = ccGetAutoRounds;
window.ccSetAutoRounds = ccSetAutoRounds;
window.ccLoadArchive = ccLoadArchive;
window.ccGenerateStory = ccGenerateStory;
window.ccAppendArchive = ccAppendArchive;
window.ccUpdateArchiveEntry = ccUpdateArchiveEntry;

/* ── 把 crMessages 转成 API messages 格式（含编辑感知） ── */
function crBuildApiMessages(historyMsgs) {
  const recent = historyMsgs.slice(-30);
  const result = recent.map(m => {
    /* ── 图片消息处理 ── */
    if (m.role === 'mine' && m.imageUrl) {
      if (m.imageDesc) {
        /* 有描述：把描述当文字发给 AI，不传图片（兼容纯文字模型） */
        return {
          role: 'user',
          content: '[用户发送了一张图片，图片内容描述如下：' + m.imageDesc + ']'
        };
      } else {
        /* 无描述：以多模态格式传图片（需模型支持 vision） */
        return {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: m.imageUrl }
            },
            {
              type: 'text',
              text: '（用户发了一张图片，请根据图片内容用角色口吻自然回应）'
            }
          ]
        };
      }
    }

    /* ── 普通文字消息 ── */
    let content = m.isVoice && m.role === 'mine'
      ? `[语音]：${m.voiceText || m.text}`
      : m.isVoice && m.role === 'luna'
      ? m.voiceText || m.text
      : m.isLocation
      ? `[用户分享了一个位置：${m.locName}，地址：${m.locAddr}${m.locCoord && m.locCoord !== '虚拟坐标' ? '，坐标：' + m.locCoord : ''}]`
      : m.isTransfer && m.role === 'mine'
      ? `[用户发起了一笔转账：金额¥${m.trAmt}${m.trRemark ? '，备注「' + m.trRemark + '」' : ''}，当前状态：${m.trStatus === 'accepted' ? '已被接受' : m.trStatus === 'declined' ? '已被拒绝' : '待确认'}]`
      : m.isTransfer && m.role === 'luna'
      ? `[你（${CR_NAME}）发起了一笔转账请求：金额¥${m.trAmt}${m.trRemark ? '，备注「' + m.trRemark + '」' : ''}，当前状态：${m.trStatus === 'accepted' ? '用户已接受' : m.trStatus === 'declined' ? '用户已拒绝' : '等待用户确认'}]`
      : m.isHongbao && m.role === 'mine' && !m.isLunaReceive
      ? `[用户发了一个红包：金额¥${m.hbAmt}，祝福语：${m.hbGreeting || ''}，当前状态：${m.hbStatus === 'opened' ? '你已拆开' : m.hbStatus === 'expired' ? '你选择不拆' : '待你处理'}]`
      : m.isHongbao && m.role === 'luna' && m.isLunaReceive
      ? `[你（${CR_NAME}）收到了用户的红包：金额¥${m.hbAmt}，当前状态：${m.hbStatus === 'opened' ? '已拆开' : m.hbStatus === 'expired' ? '未拆' : '待处理'}]`
      : m.isHongbao && m.role === 'luna' && !m.isLunaReceive
      ? `[你（${CR_NAME}）主动发了一个红包给用户：金额¥${m.hbAmt}，祝福语：${m.hbGreeting || ''}，当前状态：${m.hbStatus === 'opened' ? '用户已拆开' : m.hbStatus === 'expired' ? '用户未拆' : '等待用户拆开'}]`
      : m.isVideoInvite
      ? `（系统备注，仅供你理解上下文，不是你说过的话：你之前主动发起过一次视频通话邀约，理由是"${m.vcReason || ''}"）`
      : m.isVideoCallLog
      ? (m.vcLogStatus === 'declined'
          ? `（系统备注，仅供你理解上下文，不是你说过的话：你之前发起的视频通话被用户拒绝了，理由是"${m.vcLogReason || ''}"）`
          : m.vcLogStatus === 'missed'
          ? `（系统备注，仅供你理解上下文，不是你说过的话：你之前发起的视频通话，用户没有接听，理由是"${m.vcLogReason || ''}"）`
          : m.vcLogStatus === 'cancelled'
          ? `（系统备注，仅供你理解上下文，不是你说过的话：有一次视频通话被取消了，没有实际接通）`
          : `（系统备注，仅供你理解上下文，不是你说过的话：你和用户刚刚进行了一次视频通话，时长${crFormatCallDuration(m.vcLogDuration || 0)}）`)
      : m.text;
    if (m.role === 'mine' && m.edited && m.originalText && m.originalText !== m.text) {
      content =
        m.text +
        '\n\n[系统提示：用户刚才修改了这条消息。原始内容是「' +
        m.originalText +
        '」，修改后是「' +
        m.text +
        '」。请你结合修改内容重新审视自己的回复是否符合人设，如有偏差请在新回复中自然纠正，不要提及"系统提示"本身。]';
    }

    /* 用户使用了「引用」功能：告知 AI 这条消息具体是在回应哪一句，帮助其理解上下文关联 */
    if (m.role === 'mine' && m.quote && m.quote.text && typeof content === 'string') {
      const quoteWho = m.quote.role === 'mine' ? '用户自己之前说的' : `你（${CR_NAME}）之前说的`;
      content =
        content +
        `\n[系统提示：用户这条消息引用/回应了${quoteWho}这句话——「` + m.quote.text + '」，请结合被引用的内容理解用户在specifically回应什么，但回复时不要生硬提及"引用"或"系统提示"本身，自然接话即可。]';
    }

    return {
      role: m.role === 'mine' ? 'user' : 'assistant',
      content
    };
  });

  while (result.length > 0 && result[0].role === 'assistant') result.shift();
  if (result.length === 0) result.push({ role: 'user', content: '你好' });
  if (result[result.length - 1].role === 'assistant') {
    result.push({ role: 'user', content: '……' });
  }
  return result;
}

/* ── 判断当前是哪种情况 ── */
function crGetSituation() {
  if (!crMessages.some(m => m.role === 'mine')) return 'initiative'; // 用户从未发过消息
  // 找最后一条 mine 之后有没有 luna 回复
  let lastUserIdx = -1;
  for (let i = crMessages.length - 1; i >= 0; i--) {
    if (crMessages[i].role === 'mine') { lastUserIdx = i; break; }
  }
  const repliedAfter = crMessages.slice(lastUserIdx + 1).some(m => m.role === 'luna');
  return repliedAfter ? 'continue' : 'reply';
}

/* ── typing 动画 ── */
function crShowTyping() {
  const area = document.getElementById('crMessages');
  if (!area || document.getElementById('crTyping')) return;
  area.appendChild(crBuildTyping());
  area.scrollTop = area.scrollHeight;
}
function crHideTyping() {
  document.getElementById('crTyping')?.remove();
}

/* ── 渲染 AI 语音回复气泡（Luna 侧，白色款） ── */
/* ── 渲染 AI 语音回复气泡（Luna 侧） ── */
function crAppendAiVoiceReply(text) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n  = new Date();
  const t2 = n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0');

  function calcDuration(t) {
    const cn = (t.match(/[\u4e00-\u9fa5]/g)||[]).length;
    const en = t.replace(/[\u4e00-\u9fa5]/g,'').trim().split(/\s+/).filter(Boolean).length;
    return Math.max(3, Math.min(180, Math.ceil(cn/4.5+en/2.5)));
  }
  function secToLabel(s) {
    const m = Math.floor(s/60), r = s%60;
    return m>0 ? m+':'+String(r).padStart(2,'0') : '0:'+String(s).padStart(2,'0');
  }
  const label = secToLabel(calcDuration(text));

  const msgObj = { role:'luna', text:'[VOICE:'+text+']', isVoice:true, voiceText:text, voiceDur:label, time:t2 };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  const el = crBuildLunaVoiceMsgEl(msgObj);
  el.style.opacity   = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity   = '1';
    el.style.transform = 'translateY(0)';
  }));
}

/* ── 渲染单条 AI 消息气泡 ── */
function crAppendAiReply(text, translated, quote) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2, '0') + ':' +
            n.getMinutes().toString().padStart(2, '0');

  const bl = crGetBilingualConfig();
  const msgObj = { role: 'luna', text, time: t };
  if (quote) msgObj.quote = quote;
  if (bl.on && translated) {
    msgObj.translated  = translated;
    msgObj.transLang   = bl.lang;
    msgObj.transStyle  = bl.style;
  }
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  getCrDB().then(db => {
    const tx = db.transaction('conv', 'readwrite');
    const store = tx.objectStore('conv');
    const req = store.get(CR_NAME);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.preview = text.slice(0, 30);
        item.time = t;
        item.timeVal = Date.now();
        store.put(item);
      }
    };
  }).catch(() => {});

  const el = crBuildMsgEl(msgObj);
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }));
}

/* ── AI 主动发起视频通话：不再插入聊天卡片，而是弹出全屏来电界面（像真实手机来电一样） ──
   聊天记录里只留一条灰色居中的"通话"提示行（接听后由 videocall.js 写回，
   未接听/拒绝则由这里直接写一条"未接通"记录），不再有带按钮的卡片气泡。 */
function crAppendAiVideoCallInvite(reason) {
  crShowIncomingCallScreen(reason);
}

/* ── 全屏来电界面：铃声动效 + 接听/挂断，仅在接听后才真正跳转视频页 ── */
function crShowIncomingCallScreen(reason) {
  /* 避免重复弹出 */
  if (document.getElementById('crIncomingCall')) return;

  const overlay = document.createElement('div');
  overlay.id = 'crIncomingCall';
  overlay.className = 'cr-incoming-call';

  const avatarUrl = (typeof _crAvatarUrl === 'string' && _crAvatarUrl) ? _crAvatarUrl : '';

  overlay.innerHTML =
    '<div class="cric-bg"></div>' +
    '<div class="cric-topbar">' +
      '<span class="cric-topbar-label">Incoming Video Call</span>' +
      '<div class="cric-topbar-dot"></div>' +
    '</div>' +
    '<div class="cric-center">' +
      '<div class="cric-top">' +
        '<div class="cric-avatar-wrap">' +
          '<div class="cric-ring cric-ring-1"></div>' +
          '<div class="cric-ring cric-ring-2"></div>' +
          '<div class="cric-ring cric-ring-3"></div>' +
          '<div class="cric-avatar"' + (avatarUrl ? ' style="background-image:url(\'' + avatarUrl + '\');background-size:cover;background-position:center;"' : '') + '>' +
            (avatarUrl ? '' :
              '<svg width="40" height="40" viewBox="0 0 24 24" fill="none"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 1 21 12.79Z" fill="rgba(255,255,255,0.85)"/></svg>') +
          '</div>' +
        '</div>' +
        '<p class="cric-name">' + escHtml(CR_NAME) + '</p>' +
        '<div class="cric-sub-row">' +
          '<div class="cric-sub-dot"></div>' +
          '<p class="cric-sub">视频通话邀请</p>' +
        '</div>' +
        (reason ? '<div class="cric-reason-wrap"><p class="cric-reason">' + escHtml(reason) + '</p></div>' : '') +
      '</div>' +
    '</div>' +
    '<div class="cric-bottom">' +
      '<div class="cric-btn-col">' +
        '<button class="cric-btn cric-decline" type="button">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none">' +
            '<path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 18v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 3.07 10.2 19.79 19.79 0 0 1 .07 1.56 2 2 0 0 1 2 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.9.7 2.81a2 2 0 0 1-.45 2.11L6.08 7.91" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
            '<line x1="23" y1="1" x2="1" y2="23" stroke="white" stroke-width="2" stroke-linecap="round"/>' +
          '</svg>' +
        '</button>' +
        '<span class="cric-btn-label">拒绝</span>' +
      '</div>' +
      '<div class="cric-btn-col">' +
        '<button class="cric-btn cric-accept" type="button">' +
          '<svg width="26" height="26" viewBox="0 0 24 24" fill="none">' +
            '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
          '</svg>' +
        '</button>' +
        '<span class="cric-btn-label">接听</span>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('cric-show')));

  /* 震动式铃声反馈（可用则用，静默失败） */
  try { if (navigator.vibrate) navigator.vibrate([300, 200, 300, 200, 300]); } catch (_) {}

  let resolved = false;
  const ringTimeout = setTimeout(() => { handleMiss(); }, 30000); /* 30 秒无操作视为未接 */

  function closeOverlay(cb) {
    overlay.classList.remove('cric-show');
    overlay.classList.add('cric-hide');
    setTimeout(() => { overlay.remove(); if (cb) cb(); }, 260);
  }

  function handleAccept() {
    if (resolved) return;
    resolved = true;
    clearTimeout(ringTimeout);
    closeOverlay(() => {
      /* 标记的设置全部交给 crLaunchVideoCall 原子处理，这里只传意图，
         不再自己 setItem——避免和函数内部的清除逻辑打架（历史 bug）。 */
      crLaunchVideoCall({ aiInitiated: true, reason });
    });
  }

  function handleDecline() {
    if (resolved) return;
    resolved = true;
    clearTimeout(ringTimeout);
    crAppendVideoCallLog({ status: 'declined', reason });
    closeOverlay();
  }

  function handleMiss() {
    if (resolved) return;
    resolved = true;
    crAppendVideoCallLog({ status: 'missed', reason });
    closeOverlay();
  }

  overlay.querySelector('.cric-accept').addEventListener('click', handleAccept);
  overlay.querySelector('.cric-decline').addEventListener('click', handleDecline);
}

/* ── 灰色居中的通话记录行（不是气泡，类似微信/FaceTime 的系统通话提示） ── */
function crAppendVideoCallLog(info) {
  const area = document.getElementById('crMessages');
  const n = new Date();
  const t = n.getHours().toString().padStart(2, '0') + ':' +
            n.getMinutes().toString().padStart(2, '0');

  const msgObj = {
    role: 'luna',
    text: '',
    isVideoCallLog: true,
    vcLogStatus: info.status || 'ended',      /* 'ended' | 'declined' | 'missed' | 'cancelled' */
    vcLogDuration: info.duration || 0,        /* 毫秒 */
    vcLogReason: info.reason || '',
    vcLogInitiator: info.initiator || 'luna', /* 'luna' | 'mine' — 谁发起的通话 */
    time: t
  };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  if (!area) return;
  const el = crBuildVideoCallLogEl(msgObj);
  el.style.opacity = '0';
  el.style.transition = 'opacity 0.3s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => { el.style.opacity = '1'; }));
}

/* 注入"可点击的通话记录小条"专用样式（只执行一次）——
   原有 .cr-vc-log-row 的基础样式定义在页面自带的 CSS 里，这里只补充
   "可点击"状态的交互反馈（手型指针 + hover 微反馈），不重复定义颜色/
   布局等基础外观，避免和原样式冲突。 */
(function _injectVcLogClickableStyle() {
  if (document.getElementById('_vc_log_clickable_style')) return;
  const s = document.createElement('style');
  s.id = '_vc_log_clickable_style';
  s.textContent = `
    .cr-vc-log-row-clickable { cursor: pointer; }
    .cr-vc-log-row-clickable .cr-vc-log-pill {
      transition: background 0.15s ease, transform 0.12s ease;
    }
    .cr-vc-log-row-clickable:hover .cr-vc-log-pill {
      background: rgba(0,0,0,0.045);
    }
    .cr-vc-log-row-clickable:active .cr-vc-log-pill {
      transform: scale(0.97);
    }
  `;
  document.head.appendChild(s);
})();

/* ── 通话记录小条：右滑呼出这一次通话的"心声"（角色对这通电话的内心回顾）──
   逻辑：
   1. 只有 hasThought（真正聊过的通话）的行才监听手势；
   2. 右滑距离超过阈值才算"呼出心声"，否则按普通点击处理（打开完整转录
      弹窗），两者不冲突——用 dataset 标记短暂抑制紧跟着的 click；
   3. 心声文本首次揭示时才向 AI 请求生成（懒加载，不在挂断那一刻就多打
      一次接口拖慢跳转），生成结果写回 LunaChatDB.videoLogs 对应记录的
      thought 字段做缓存，下次再滑直接读缓存，不重复请求、不重复计费。 */
(function initVcLogSwipeThought() {
  const msgArea = document.getElementById('crMessages');
  if (!msgArea) return;

  const SWIPE_THRESHOLD = 42; // px，超过这个距离才判定为"滑动"而不是"点击手抖"

  let startX = 0, startY = 0, curRow = null, dragging = false, swiped = false;

  msgArea.addEventListener('touchstart', function (e) {
    const row = e.target.closest('.cr-vc-log-row-thoughtable');
    if (!row) return;
    curRow  = row;
    dragging = true;
    swiped   = false;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  msgArea.addEventListener('touchmove', function (e) {
    if (!dragging || !curRow) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && dx > SWIPE_THRESHOLD) swiped = true;
  }, { passive: true });

  msgArea.addEventListener('touchend', function () {
    if (dragging && curRow && swiped) {
      curRow.dataset.vcSwiped = '1'; // 抑制紧接着触发的 click（避免同时弹出完整记录弹窗）
      toggleCallThought(curRow);
      setTimeout(() => { if (curRow) delete curRow.dataset.vcSwiped; }, 400);
    }
    dragging = false; curRow = null; swiped = false;
  });
  msgArea.addEventListener('touchcancel', function () {
    dragging = false; curRow = null; swiped = false;
  });

  /* ── 鼠标等效实现：电脑浏览器用鼠标左键按住横向拖动模拟右滑 ──
     和触屏版共用同一个 curRow/dragging/swiped 状态和 SWIPE_THRESHOLD，
     行为完全对齐，只是事件源换成 mouse*。
     mousemove/mouseup 特意绑在 document 而不是 msgArea 上：鼠标拖动
     途中很容易移出这一行、甚至移出整个消息区域，如果绑在 msgArea 上，
     鼠标一旦移出该元素后续 mousemove 就收不到了，拖动会被错误中断。 */
  let mouseDragging = false;

  msgArea.addEventListener('mousedown', function (e) {
    const row = e.target.closest('.cr-vc-log-row-thoughtable');
    if (!row) return;
    e.preventDefault(); // 从按下这一刻就禁止文字选中，避免拖动瞬间出现选区高亮
    curRow  = row;
    mouseDragging = true;
    swiped   = false;
    startX = e.clientX;
    startY = e.clientY;
  });

  document.addEventListener('mousemove', function (e) {
    if (!mouseDragging || !curRow) return;
    e.preventDefault(); // 拖动途中禁止选中文字，体验更接近真实滑动
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && dx > SWIPE_THRESHOLD) swiped = true;
  });

  document.addEventListener('mouseup', function () {
    if (mouseDragging && curRow && swiped) {
      curRow.dataset.vcSwiped = '1';
      toggleCallThought(curRow);
      setTimeout(() => { if (curRow) delete curRow.dataset.vcSwiped; }, 400);
    }
    mouseDragging = false; curRow = null; swiped = false;
  });

  /* 拦截刚发生过右滑手势的那一次 click，防止"呼出心声"和"打开转录弹窗"
     同时触发——在捕获阶段拦截，比 crBuildVideoCallLogEl 里绑定的 click
     监听器先执行。 */
  msgArea.addEventListener('click', function (e) {
    const row = e.target.closest('.cr-vc-log-row-thoughtable');
    if (row && row.dataset.vcSwiped === '1') {
      e.stopImmediatePropagation();
      e.preventDefault();
    }
  }, true);

  async function toggleCallThought(row) {
    let panel = row.querySelector('.cr-vc-log-thought');
    if (panel) {
      panel.classList.toggle('cr-vc-log-thought-show');
      return;
    }
    panel = document.createElement('div');
    panel.className = 'cr-vc-log-thought';
    panel.innerHTML = '<span class="cr-vc-log-thought-label">Ta的心声</span>……';
    row.appendChild(panel);
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('cr-vc-log-thought-show')));

    const logId = row.dataset.vcLogId;
    const text = await crGetOrGenerateCallThought(logId);
    panel.innerHTML = '<span class="cr-vc-log-thought-label">Ta的心声</span>' + escHtml(text || '……这通电话她没留下什么特别的感想。');
  }
})();

/* ── 按 id 查一条通话记录（只读，videolog.js 里也有等价实现，
   这里独立写一份是因为这段逻辑运行在 chatroom.js，不应该假设
   videolog.js 一定已经加载完成/暴露了内部函数） ── */
async function crGetVideoLogById(id) {
  if (id === undefined || id === null || id === '') return null;
  try {
    const db = await getCrDB();
    return await new Promise(res => {
      const r = db.transaction('videoLogs').objectStore('videoLogs').get(Number(id));
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    });
  } catch (e) { return null; }
}

/* 把生成好的心声文本写回这条记录，做缓存 */
async function crSaveVideoLogThought(id, thought) {
  try {
    const db = await getCrDB();
    const tx = db.transaction('videoLogs', 'readwrite');
    const store = tx.objectStore('videoLogs');
    const rec = await new Promise(res => {
      const r = store.get(Number(id));
      r.onsuccess = () => res(r.result || null);
      r.onerror   = () => res(null);
    });
    if (rec) {
      rec.thought = thought;
      store.put(rec);
    }
  } catch (e) {}
}

/* 用 AI 生成"角色对这通电话的内心独白"，风格和文字聊天里的"心声"卡片
   一脉相承（第一人称、细腻、有情绪起伏），但只针对这一通电话的转录，
   不是整段聊天关系的心声，篇幅也更短——是对着"一件已经过去的事"的回顾，
   不是"此刻实时状态"。 */
async function crGenerateCallThoughtText(char, rec) {
  const name    = char?.name    || rec.charName || CR_NAME;
  const persona = char?.persona || char?.description || char?.desc || '';
  const traits  = char?.traits  || char?.personality || '';

  const transcriptText = (rec.transcript || []).map(entry => {
    const role = entry.role === 'luna' ? name : '用户';
    return `${role}：${entry.text || ''}`;
  }).filter(Boolean).join('\n');

  const systemPrompt = `你是「${name}」本人，绝不是 AI 或助手。角色信息：${persona} ${traits}
只输出这一次视频通话结束后，你此刻回想起这通电话时的内心独白，第一人称，60-120字，细腻自然，像真实的人事后回味一段对话时的感受，可以有情绪起伏，不需要复述对话内容本身。
直接输出这段独白，不加任何前缀、引号、markdown。`;

  const userPrompt = `这通视频电话的转录：
${transcriptText || '（这通电话没有留下对话内容）'}

请写下你现在回想起这通电话时的心声。`;

  try {
    const raw = await crCallApi(systemPrompt, [{ role: 'user', content: userPrompt }]);
    return (raw || '').trim();
  } catch (e) {
    return '';
  }
}

/* 对外统一入口：优先读缓存，没有才现生成 + 写回缓存 */
async function crGetOrGenerateCallThought(logId) {
  const rec = await crGetVideoLogById(logId);
  if (!rec) return '';
  if (rec.thought) return rec.thought;

  const char = await crLoadCharProfile(rec.charName || CR_NAME);
  const text = await crGenerateCallThoughtText(char, rec);
  if (text) crSaveVideoLogThought(logId, text);
  return text;
}

/* ── 构建灰色通话记录行 DOM（供新发送与历史恢复共用） ──
   只有真的发生过通话、且 vcLogId 指向 videoLogs 表里一条真实存档记录时，
   这条小灰条才可以点击查看详情；"已拒绝/未接听"这类根本没接通的记录
   没有转录内容，不需要、也不应该可点。 */
function crBuildVideoCallLogEl(msg) {
  const el = document.createElement('div');
  el.className = 'cr-vc-log-row';

  let label;
  if (msg.vcLogStatus === 'declined') {
    label = '视频通话已拒绝';
  } else if (msg.vcLogStatus === 'missed') {
    label = '未接听的视频通话';
  } else if (msg.vcLogStatus === 'cancelled') {
    label = '视频通话已取消';
  } else {
    label = '视频通话' + (msg.vcLogDuration ? '· ' + crFormatCallDuration(msg.vcLogDuration) : '');
  }

  const clickable = (msg.vcLogStatus === 'ended' || msg.vcLogStatus === 'cancelled') &&
                     (msg.vcLogId !== undefined && msg.vcLogId !== null);
  if (clickable) el.classList.add('cr-vc-log-row-clickable');

  /* 只有真正"说上话"的通话（ended，区别于压根没接通的 cancelled）才有
     "心声"可言——没聊过天，AI 也没有什么可回顾的内心活动，右滑不应该
     呼出一个内容，容易显得很假。 */
  const hasThought = clickable && msg.vcLogStatus === 'ended';
  if (hasThought) {
    el.classList.add('cr-vc-log-row-thoughtable');
    el.dataset.vcLogId = msg.vcLogId;
  }

  el.innerHTML =
    '<div class="cr-vc-log-pill">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none">' +
        '<rect x="2" y="6" width="14" height="12" rx="3" stroke="rgba(120,120,120,0.65)" stroke-width="1.6"/>' +
        '<path d="M16 10.5L22 7v10l-6-3.5" stroke="rgba(120,120,120,0.65)" stroke-width="1.6" stroke-linejoin="round"/>' +
      '</svg>' +
      '<span>' + escHtml(label) + '</span>' +
      '<span class="cr-vc-log-time">' + (msg.time || '') + '</span>' +
    '</div>';

  if (clickable) {
    el.addEventListener('click', () => {
      /* 由 videolog.js 提供的全局入口负责打开居中弹窗并查库渲染，
         chatroom.js 本身不关心弹窗内部长什么样，只负责"点了、给 id"。
         videolog.js 未加载（比如脚本没引入）时静默忽略，不报错崩溃。 */
      if (typeof window.vcOpenLogModal === 'function') {
        window.vcOpenLogModal(msg.vcLogId);
      }
    });
  }

  return el;
}

function crFormatCallDuration(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/* 旧版 isVideoInvite 卡片的历史兼容渲染：老数据仍可能带 isVideoInvite 字段，
   一律按"通话记录"行样式渲染，不再渲染成带接听按钮的卡片 */
function crBuildAiVideoCallInviteEl(msg) {
  return crBuildVideoCallLogEl({
    vcLogStatus: 'missed',
    vcLogReason: msg.vcReason || '',
    time: msg.time || ''
  });
}

/* ── 渲染 AI 图片回复气泡（纯 CSS 图，含描述） ── */
function crAppendAiImageReply(desc) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' +
            n.getMinutes().toString().padStart(2,'0');

  const msgObj = { role: 'luna', text: '[IMAGE:' + desc + ']', imageDesc: desc, isAiImage: true, time: t };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  const el = crBuildAiImageBubble(msgObj);
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.28s ease, transform 0.28s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
  }));
}

/* ── 构建 AI 图片气泡 DOM ── */
function crBuildAiImageBubble(msg) {
  const wrap = document.createElement('div');
  wrap.className = 'cr-msg-luna';

  const palettes = [
    ['#1a1a2e','#e0e0f0'],
    ['#0d1b2a','#b8d4e8'],
    ['#1c1c1c','#e8e0d8'],
    ['#1a2a1a','#c8e8c0'],
    ['#2a1a2a','#e8c8e8'],
    ['#2a1a1a','#e8d0c0'],
    ['#1a2a2a','#b8e0e0'],
  ];
  /* 用描述字符串做种子，历史恢复时颜色保持一致 */
  const seed = msg.imageDesc.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const pal  = palettes[seed % palettes.length];
  const bg   = pal[0];
  const fg   = pal[1];

  /* 结构：头像 + 右侧（图片卡 + 时间），完全不用气泡包裹 */
  wrap.innerHTML =
    crMiniAvHtml() +
    '<div>' +
      /* 图片卡片，直接裸放，无气泡 */
      '<div class="cr-ai-img-card" style="background:' + bg + ';" data-desc="' + escHtml(msg.imageDesc) + '">' +
        '<div class="cr-ai-img-noise"></div>' +
        '<div class="cr-ai-img-icon">' +
          '<svg width="32" height="32" viewBox="0 0 28 28" fill="none">' +
            '<rect x="3" y="5" width="22" height="18" rx="3" stroke="' + fg + '" stroke-width="0.8" opacity="0.45"/>' +
            '<circle cx="9" cy="11" r="2.5" stroke="' + fg + '" stroke-width="0.8" opacity="0.55"/>' +
            '<path d="M3 18 L9 13 L14 17 L19 12 L25 18" stroke="' + fg + '" stroke-width="0.8" opacity="0.45" fill="none"/>' +
          '</svg>' +
        '</div>' +
        /* 查看按钮，无描述文字 */
        '<button class="cr-ai-img-view-btn" style="color:' + fg + ';border-color:' + fg + '40;">' +
          '<svg width="10" height="10" viewBox="0 0 12 12" fill="none">' +
            '<circle cx="6" cy="6" r="4.5" stroke="' + fg + '" stroke-width="1" opacity="0.7"/>' +
            '<circle cx="6" cy="6" r="1.8" fill="' + fg + '" opacity="0.7"/>' +
            '<line x1="9" y1="9" x2="11" y2="11" stroke="' + fg + '" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/>' +
          '</svg>' +
          '查看' +
        '</button>' +
      '</div>' +
      '<p class="cr-msg-time">' + msg.time + '</p>' +
    '</div>';

  const viewBtn = wrap.querySelector('.cr-ai-img-view-btn');
  if (viewBtn) {
    viewBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      crOpenAiImageViewer(msg.imageDesc, bg, fg);
    });
  }

  return wrap;
}

/* ── 逐条发送，模拟真人连发 ── */
async function crSendLines(lines) {
  const valid = lines.map(l => l.trim()).filter(Boolean);
  for (let i = 0; i < valid.length; i++) {
    if (i > 0) {
      crShowTyping();
      const delay = 500 + Math.min(valid[i].length * 60, 1200);
      await new Promise(r => setTimeout(r, delay));
      crHideTyping();
    }
    /* 检测视频通话邀约 [VIDEOCALL:理由]，AI 主动想发起视频 */
    const vcMatch = valid[i].match(/^\[VIDEOCALL[：:]\s*(.+)\]$/i);
    if (vcMatch) {
      crAppendAiVideoCallInvite(vcMatch[1].trim());
      continue;
    }
    /* 拦截 AI 破格把「视频通话邀约/记录」系统提示措辞当成台词说出来的情况，
       例如原样吐出 "[你（角色名）主动向你发起了一次视频通话邀约...]" 这种句子，
       这类文字本来只应该出现在喂给模型的历史上下文里，不该被渲染成聊天气泡 */
    if (/^\[(你|.{1,12})（?.{0,12}）?.{0,6}(主动向你发起|向用户发起|发起了)(一次)?视频通话(邀约|请求)?/.test(valid[i]) ||
        /^\[.{0,20}视频通话(被拒绝|未接听|已取消|已结束|已拒绝|理由是)/.test(valid[i])) {
      continue;
    }
    /* 检测图片格式 [IMAGE:描述] */
    const imgMatch = valid[i].match(/^\[IMAGE:(.+)\]$/);
    if (imgMatch) {
      crAppendAiImageReply(imgMatch[1].trim());
      continue;
    }
    /* 检测表情包占位符 [MEME:名称] 或旧格式 [MEME] */
    const memeMatch = valid[i].match(/^\[MEME:(.+)\]$/);
    if (memeMatch) {
      await crAiSendNamedMeme(memeMatch[1].trim());
      continue;
    }
    if (valid[i] === '[MEME]') {
      await crAiSendRandomMeme();
      continue;
    }
    /* 检测语音占位符 [VOICE:内容] */
    const voiceMatch = valid[i].match(/^\[VOICE[：:]\s*(.+)\]$/i)
                    || valid[i].match(/^\[语音[：:]\s*(.+)\]$/);
    if (voiceMatch) {
      crAppendAiVoiceReply(voiceMatch[1].trim());
      continue;
    }
    /* 检测位置占位符 [LOCATION:地点名|地址]，兼容中文冒号/全角竖线 */
    const locMatch = valid[i].match(/^\[LOCATION[：:]\s*(.+?)[|｜](.+)\]$/i);
    if (locMatch) {
      crAppendAiLocationReply(locMatch[1].trim(), locMatch[2].trim());
      continue;
    }
    /* 检测转账占位符 [TRANSFER:金额|备注] */
    const trMatch = valid[i].match(/^\[TRANSFER[：:]\s*([\d.]+)[|｜](.+)\]$/i)
                 || valid[i].match(/^\[TRANSFER[：:]\s*([\d.]+)\]$/i);
    if (trMatch) {
      const trAmt = parseFloat(trMatch[1]).toFixed(2);
      const trRem = trMatch[2] ? trMatch[2].trim() : '';
      crAppendTransferMsg(trAmt, trRem, 'luna');
      continue;
    }
    /* 检测 AI 对用户转账的领取/拒绝指令 [TRANSFER_RECEIVE:accepted/declined] */
    const trReceiveMatch = valid[i].match(/^\[TRANSFER_RECEIVE[：:]\s*(accepted|declined)\]$/i);
    if (trReceiveMatch) {
      const receiveStatus = trReceiveMatch[1].toLowerCase();
      crAiReceiveTransfer(receiveStatus);
      continue;
    }
    /* 拦截 AI 误输出的转账状态描述文字，直接丢弃 */
    if (/^\[转账已?(接收|接受|拒绝|拒收)[：:：]/.test(valid[i]) ||
        /^\[TRANSFER_(ACCEPTED|DECLINED|RECEIVED)\]/i.test(valid[i])) {
      continue;
    }
    /* 检测红包占位符 [HONGBAO:金额|祝福语] */
    const hbMatch = valid[i].match(/^\[HONGBAO[：:]\s*([\d.]+)[|｜](.+)\]$/i)
                 || valid[i].match(/^\[HONGBAO[：:]\s*([\d.]+)\]$/i);
    if (hbMatch) {
      const hbAmt = parseFloat(hbMatch[1]).toFixed(2);
      const hbGreeting = hbMatch[2] ? hbMatch[2].trim() : '送你一个红包';
      crAppendAiHongbaoReply(hbAmt, hbGreeting);
      continue;
    }
    /* 检测 AI 对用户红包的拆开/不拆指令 [HONGBAO_RECEIVE:opened/expired] */
    const hbReceiveMatch = valid[i].match(/^\[HONGBAO_RECEIVE[：:]\s*(opened|expired)\]$/i);
    if (hbReceiveMatch) {
      crAiReceiveHongbao(hbReceiveMatch[1].toLowerCase());
      continue;
    }
    /* 拦截 AI 误输出的红包状态描述文字，直接丢弃 */
    if (/^\[红包已?(拆开|接收|过期|不拆)[：:：]/.test(valid[i]) ||
        /^\[HONGBAO_(OPENED|EXPIRED|RECEIVED)\]/i.test(valid[i])) {
      continue;
    }
    /* 检测引用标签 [QUOTE:被引用的原文片段] 开头，后面紧跟本条要说的话
       格式：[QUOTE:片段]实际内容  或  [QUOTE:片段] 实际内容（允许一个空格） */
    let quoteObj = null;
    let lineForQuote = valid[i];
    const quoteMatch = lineForQuote.match(/^\[QUOTE[：:]\s*(.+?)\]\s*(.*)$/i);
    if (quoteMatch) {
      const quoteFrag = quoteMatch[1].trim();
      const restText  = quoteMatch[2].trim();
      const resolved  = crResolveQuoteFragment(quoteFrag);
      if (resolved && restText) {
        quoteObj = resolved;
        lineForQuote = restText;
      } else {
        /* 解析失败或没有实际内容，直接丢弃标签，只保留正文（防止把标签原样发出去） */
        lineForQuote = restText || lineForQuote.replace(/^\[QUOTE[：:][^\]]*\]\s*/i, '');
      }
    }

    /* 检测双语格式「原话||翻译」，拆分成原文与译文分别传给渲染函数 */
    let lineText = lineForQuote;
    let lineTrans = null;
    const blIdx = lineText.indexOf('||');
    if (blIdx > -1) {
      lineTrans = lineText.slice(blIdx + 2).trim();
      lineText  = lineText.slice(0, blIdx).trim();
    }
    crAppendAiReply(lineText, lineTrans, quoteObj);
  }
}

/* ── 把 AI 给出的「被引用片段」文字，在最近的历史消息里做模糊匹配，
     找到最可能对应的那条消息，返回 { text, role, idx }。找不到返回 null。 ──
   匹配策略：在最近 20 条消息里找文本包含关系最强的一条（片段是原消息子串，或原消息是片段子串），
   优先取更靠后（更新）的消息。 */
function crResolveQuoteFragment(fragment) {
  if (!fragment) return null;
  const frag = fragment.trim();
  if (!frag) return null;

  const recent = crMessages.slice(-20);
  const baseIdx = crMessages.length - recent.length;
  let best = null;
  let bestScore = 0;

  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const text = (m.isVoice ? (m.voiceText || m.text) : m.text) || '';
    if (!text) continue;

    let score = 0;
    if (text.includes(frag) || frag.includes(text)) {
      score = Math.min(text.length, frag.length);
    }
    if (score > bestScore) {
      bestScore = score;
      best = { text: text, role: m.role, idx: baseIdx + i };
    }
  }

  /* 匹配片段太短（比如只有1-2个字）容易误配，要求至少有一定长度的重合才采用 */
  if (best && bestScore >= 2) return best;
  return null;
}

/* AI 按名称精确发表情包（找不到静默跳过） */
async function crAiSendNamedMeme(memeName) {
  let pool = (typeof _memes !== 'undefined' && _memes.length) ? _memes : [];
  if (!pool.length) {
    try {
      const db = await getCrDB();
      pool = await new Promise(res => {
        const r = db.transaction('memes').objectStore('memes').getAll();
        r.onsuccess = e => res(e.target.result || []);
        r.onerror   = () => res([]);
      });
    } catch { pool = []; }
  }
  if (!pool.length) return;

  // 精确匹配名称，找不到静默跳过（不随机兜底）
  const meme = pool.find(m => m.name === memeName);
  if (!meme) return;

  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
  const msgObj = { role: 'luna', text: '[表情包]', imageUrl: meme.url, isMeme: true, time: t };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  const el = crBuildMemeMsgEl(msgObj, 'luna');
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  }));
}

/* AI 随机发一张表情包（无气泡样式，静默跳过若无库存） */
async function crAiSendRandomMeme() {
  let pool = (typeof _memes !== 'undefined' && _memes.length) ? _memes : [];
  if (!pool.length) {
    try {
      const db = await getCrDB();
      pool = await new Promise(res => {
        const r = db.transaction('memes').objectStore('memes').getAll();
        r.onsuccess = e => res(e.target.result || []);
        r.onerror   = () => res([]);
      });
    } catch { pool = []; }
  }
  if (!pool.length) return; // 没有表情包，静默跳过，不输出任何文字

  const meme = pool[Math.floor(Math.random() * pool.length)];
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
  const msgObj = { role: 'luna', text: '[表情包]', imageUrl: meme.url, isMeme: true, time: t };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  const el = crBuildMemeMsgEl(msgObj, 'luna');
  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  }));
}

/* ── 统一 API 调用 ── */
async function crCallApi(systemPrompt, messages) {
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) throw new Error('NO_API_CONFIG');

  const response = await fetch(`${cur.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${cur.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message || `HTTP ${response.status}`);
  }
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('回复为空');
  return text;
}

/* ── 小提示 ── */
function crShowTip(msg, ms = 2500) {
  const area = document.getElementById('crMessages');
  if (!area) return;
  const tip = document.createElement('div');
  tip.style.cssText = 'text-align:center;color:#bbb;font-size:12px;padding:6px 0;';
  tip.textContent = msg;
  area.appendChild(tip);
  area.scrollTop = area.scrollHeight;
  setTimeout(() => tip.remove(), ms);
}

/* ── AI 按钮防重复 ── */
let crAiLoading = false;

function crSetAiBtnState(loading) {
  crAiLoading = loading;
  const btn = document.querySelector('.cr-ai-btn');
  if (!btn) return;
  btn.style.opacity       = loading ? '0.4' : '1';
  btn.style.pointerEvents = loading ? 'none' : 'auto';
}

/* ── 核心入口 ── */
async function crAiReply() {
  if (crAiLoading) return;

  // 先检查 API 配置
  const cur   = JSON.parse(localStorage.getItem('luna_api_current') || '{}');
  const model = localStorage.getItem('luna_api_model') || '';
  if (!cur.baseUrl || !cur.apiKey || !model) {
    crShowTip('请先在设置页配置 API');
    return;
  }

  const situation = crGetSituation(); // 'initiative' | 'reply' | 'continue'

  crSetAiBtnState(true);
  crShowTyping();

  try {
    const char         = await crLoadCharProfile(CR_NAME);

    // 读取当前角色绑定的用户身份资料（资料页 -> 绑定角色），让 AI 知道对方是谁
    // 加超时兜底：万一 IndexedDB 读取异常挂起，最多等 1.5 秒就放弃，不阻塞正常回复
    let userIdentity = null;
    try {
      userIdentity = await Promise.race([
        crLoadBoundUserIdentity(char?.id),
        new Promise(res => setTimeout(() => res(null), 1500))
      ]);
    } catch (e) { userIdentity = null; }

    // 读取表情包库，注入到 prompt 让 AI 知道有哪些可选
    let memeList = (typeof _memes !== 'undefined' && _memes.length) ? _memes : [];
    if (!memeList.length) {
      try {
        const db = await getCrDB();
        memeList = await new Promise(res => {
          const r = db.transaction('memes').objectStore('memes').getAll();
          r.onsuccess = e => res(e.target.result || []);
          r.onerror   = () => res([]);
        });
      } catch { memeList = []; }
    }

    const systemPrompt = await crBuildSystemPrompt(char, situation, memeList, userIdentity);
    const messages     = crBuildApiMessages(crMessages);

    // 两个请求并行：AI回复 + 心声数据同时发出
    const whisperPromise = crGenerateWhisperData(char, crMessages);
    const replyText = await crCallApi(systemPrompt, messages);

    crHideTyping();
    // 按换行拆成多条发送
    await crSendLines(replyText.split('\n'));

    // 此时心声请求大概率已经返回了，直接应用
    whisperPromise.then(data => {
      crApplyWhisperData(data);
    });

    // 叩问自动生成：仅在用户手动开启时触发，不阻塞主回复流程，
    // 生成完成后弹 toast 告知用户，不打断当前聊天体验。
    if (kkGetAutoEnabled(CR_NAME)) {
      kkGenerateQuestion(CR_NAME).then(entry => {
        if (entry) {
          crShowTip(`✦ ${CR_NAME}偷偷给你出了一道新题，去「叩问」看看吧`);
        }
      }).catch(() => {});
    }

    // 幕后志自动生成：默认关闭，用户需在「幕后志 → 设置」里手动开启，
    // 因为会消耗用户自己配置的 API 额度。开启后按「每 N 轮 AI 回复」
    // 计数，攒够轮数后自动写一篇（用最近对话作为素材），不打断聊天，
    // 生成完成后弹 toast 提示，轮数计数器随后清零重新开始计。
    if (ccGetAutoEnabled(CR_NAME)) {
      const rounds = ccBumpRoundCount(CR_NAME);
      const target = ccGetAutoRounds(CR_NAME);
      if (rounds >= target) {
        ccResetRoundCount(CR_NAME);
        ccGenerateStory(CR_NAME, 'recent', null).then(entry => {
          if (entry) {
            crShowTip(`✦ ${CR_NAME}偷偷把你们最近的故事写了下来，去「幕后志」看看吧`);
          }
        }).catch(() => {});
      }
    }

    // 迷雾自动生成：默认关闭，用户需在「迷雾 → 设置」里手动开启，
    // 因为同样会消耗用户自己配置的 API 额度。开启后按「每 N 轮 AI 回复」
    // 计数（与幕后志各自独立计数，互不影响），攒够轮数后自动生成一批
    // 新的困惑（读取人设、绑定的用户身份、最近对话、以及还没解释清楚
    // 的旧困惑，保证不会 OOC），不打断聊天，生成完成后弹 toast 提示，
    // 轮数计数器随后清零重新开始计。hzGenerateHaze 定义在
    // secret/haze.js 里，需要该脚本已被 chatroom.html 引入才会生效；
    // 未引入时 typeof 判断会跳过，不影响正常聊天。
    if (typeof hzGetAutoEnabled === 'function' && hzGetAutoEnabled(CR_NAME)) {
      const hzRounds = hzBumpRoundCount(CR_NAME);
      const hzTarget = hzGetAutoRounds(CR_NAME);
      if (hzRounds >= hzTarget && typeof window.hzGenerateHaze === 'function') {
        hzResetRoundCount(CR_NAME);
        const hzCount = hzGetAutoCount(CR_NAME);
        window.hzGenerateHaze(CR_NAME, hzCount).then(entry => {
          if (entry) {
            crShowTip(`✦ ${CR_NAME}心里又冒出了一些没想通的事，去「迷雾」看看吧`);
          }
        }).catch(() => {});
      }
    }

  } catch (err) {
    crHideTyping();
    console.error('[crAiReply]', err);
    crShowTip('消息好像没发出去，稍后再试～');
  } finally {
    crSetAiBtnState(false);
  }
}

/* ================================================================
   重回 — Rewind / 人设纠偏反馈
   -----------------------------------------------------------------
   用户对 AI 某条回复不满意（OOC、掉格式、崩人设等）时使用。
   流程：
   1. 长按 AI 消息 → 菜单选「重回」，或功能面板「重回」卡片使用按钮。
   2. 弹窗内置几个常见问题标签 + 用户自己描述问题所在。
   3. 确认后：
      a) 反馈规则持久化写入 IndexedDB（按角色绑定，长期生效），
         此后每一次 crAiReply 都会在 system prompt 中强制附加这些规则，
         而不仅仅是这次重新生成 —— 目的是尽量让用户以后不必再点重回。
      b) 把这条不满意的 AI 回复（以及它同一轮里的其它分段消息）从
         对话历史中移除，退回到用户上一条消息之后的状态。
      c) 结合"内置提示词 + 全部历史反馈规则 + 本次新反馈"重新生成一次回复，
         新回复必须体现修正，否则功能失去意义。
================================================================ */
(function () {

/* ── IndexedDB：反馈规则表，按角色 name 存一个规则数组
      注意：直接复用 getCrDB() 的共享连接（表已注册进 LUNA_STORES），
      不要在这里再单独 indexedDB.open，否则和 getCrDB() 长期持有的连接
      互相等待版本升级，会导致 open 请求卡在 blocked 状态永不 resolve。 ── */
const FEEDBACK_STORE = 'rewindFeedback';

function getFeedbackDB() {
  return getCrDB();
}

/* 读取某角色的全部反馈规则（数组，按时间正序） */
async function rewindLoadRules(name) {
  try {
    const db = await getFeedbackDB();
    return await new Promise(res => {
      const r = db.transaction(FEEDBACK_STORE).objectStore(FEEDBACK_STORE).get(name);
      r.onsuccess = () => res((r.result && r.result.rules) || []);
      r.onerror   = () => res([]);
    });
  } catch { return []; }
}

/* 追加一条新反馈规则，返回更新后的完整规则数组 */
async function rewindAddRule(name, ruleText) {
  const db = await getFeedbackDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(FEEDBACK_STORE, 'readwrite');
    const store = tx.objectStore(FEEDBACK_STORE);
    const getReq = store.get(name);
    getReq.onsuccess = () => {
      const existing = getReq.result || { name, rules: [] };
      existing.rules = existing.rules || [];
      existing.rules.push({ text: ruleText, ts: Date.now() });
      /* 最多保留最近 20 条，避免 prompt 无限膨胀 */
      if (existing.rules.length > 20) {
        existing.rules = existing.rules.slice(existing.rules.length - 20);
      }
      store.put(existing);
      resolve(existing.rules);
    };
    getReq.onerror = () => reject();
  });
}

/* 暴露给 crBuildSystemPrompt 使用 */
window.rewindLoadRules = rewindLoadRules;

/* 把规则数组渲染成 system prompt 中的强制纠偏区块 */
function rewindBuildPromptBlock(rules) {
  if (!rules || !rules.length) return '';
  const lines = rules.map((r, i) => `${i + 1}. ${r.text}`).join('\n');
  return `

【⚠️ 用户人设纠偏记录 — 最高优先级，必须严格遵守，优先级高于以上所有其它说明】
用户曾明确指出你之前的回复出现过以下问题，这些问题已被记录，你在本次以及此后每一次回复中都绝对不能再犯：
${lines}
在生成回复前，请先在心里对照检查一遍这份清单，确保新回复完全不触犯上述任何一条，不要解释、不要提及这份清单本身，直接把修正体现在你的回复内容和语气里。`;
}
window.rewindBuildPromptBlock = rewindBuildPromptBlock;

/* ── 常见问题快捷标签 ── */
const REWIND_TAGS = [
  { id:'ooc',    label:'人设崩了(OOC)' },
  { id:'format', label:'格式跑偏' },
  { id:'action', label:'出现了动作描写' },
  { id:'md',     label:'带了Markdown' },
  { id:'long',   label:'消息太长/没分段' },
  { id:'flat',   label:'太机械/没感情' },
  { id:'repeat', label:'重复啰嗦' },
  { id:'ignore', label:'没接住话题' },
];

const REWIND_TAG_TEXT = {
  ooc:    '不能出现偏离角色人设、说话方式不像本角色的内容（OOC）',
  format: '必须严格遵守消息格式规则，不能输出多余的符号或结构',
  action: '严禁输出任何括号/星号包裹的动作、神情描写，如（笑）*点头*等',
  md:     '严禁使用任何 Markdown 格式，不能加粗、不能用列表或标题',
  long:   '每条消息要够短，必须按规则拆成多条短消息分行发送，不能整段堆一起',
  flat:   '语气要有真实情绪起伏，不能千篇一律地机械寒暄或用同一种语气回应',
  repeat: '不要重复说过的话或啰嗦堆砌内容，保持简洁自然',
  ignore: '必须认真接住用户上一句话里的重点，不能答非所问或忽略话题',
};

/* ── 弹窗 HTML（首次使用时注入） ── */
let _rewindInited = false;
let _rewindMsgIdx = -1;
let _rewindSelectedTags = new Set();

function ensureRewindModal() {
  if (_rewindInited) return;
  _rewindInited = true;

  const html = `
<div id="rewindOverlay" style="display:none;position:fixed;inset:0;z-index:16000;
  align-items:center;justify-content:center;background:rgba(0,0,0,0.55);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);">
  <div id="rewindModal" style="width:88%;max-width:400px;background:#faf9f7;
    border-radius:22px;border:0.5px solid rgba(0,0,0,0.09);
    box-shadow:0 28px 80px rgba(0,0,0,0.28);
    padding:22px 20px 20px;box-sizing:border-box;
    display:flex;flex-direction:column;gap:14px;
    transform:scale(0.92);opacity:0;
    transition:transform 0.22s ease,opacity 0.22s ease;max-height:82vh;overflow-y:auto;">

    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;
          color:#bbb;text-transform:uppercase;margin-bottom:3px;">HISTORY · REWIND</div>
        <div style="font-size:16px;font-weight:600;color:#1a1a1a;">重回 · 告诉Ta哪里不对</div>
      </div>
      <button id="rewindClose" style="width:30px;height:30px;border-radius:50%;
        border:0.5px solid rgba(0,0,0,0.12);background:#f0efec;cursor:pointer;
        display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke="#999" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div style="font-size:12px;color:#999;line-height:1.6;">
      选择这条回复出了什么问题（可多选），或者直接写清楚。确认后会撤回这条回复，
      结合你的反馈重新生成一次，并且这个要求会一直记住，以后每次回复都会遵守。
    </div>

    <div id="rewindTags" style="display:flex;flex-wrap:wrap;gap:8px;"></div>

    <textarea id="rewindTextarea" placeholder="也可以自己描述问题所在，比如：说话太正式了，不像平时那种随意的语气…" style="
      width:100%;box-sizing:border-box;min-height:74px;resize:vertical;
      border:1.2px solid #e0ddd8;border-radius:12px;
      padding:11px 12px;font-size:13.5px;color:#1a1a1a;
      background:#fff;outline:none;font-family:inherit;line-height:1.6;
    "></textarea>

    <div id="rewindHistNote" style="font-size:11px;color:#aaa;background:#f3f2f0;
      border-radius:8px;padding:8px 10px;line-height:1.5;display:none;"></div>

    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button id="rewindCancel" style="
        background:none;border:1.2px solid #ddd;border-radius:10px;
        padding:9px 18px;font-size:13px;color:#888;cursor:pointer;
      ">取消</button>
      <button id="rewindConfirm" style="
        background:#1a1a1a;border:none;border-radius:10px;
        padding:9px 20px;font-size:13px;color:#fff;cursor:pointer;font-weight:500;
        display:flex;align-items:center;gap:6px;
      ">
        <span id="rewindConfirmText">重新生成</span>
      </button>
    </div>
  </div>
</div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  const overlay   = document.getElementById('rewindOverlay');
  const modal     = document.getElementById('rewindModal');
  const tagsWrap  = document.getElementById('rewindTags');
  const textarea  = document.getElementById('rewindTextarea');
  const closeBtn  = document.getElementById('rewindClose');
  const cancelBtn = document.getElementById('rewindCancel');
  const confirmBtn= document.getElementById('rewindConfirm');
  const confirmTxt= document.getElementById('rewindConfirmText');
  const histNote  = document.getElementById('rewindHistNote');

  /* 渲染标签 */
  REWIND_TAGS.forEach(tag => {
    const chip = document.createElement('button');
    chip.dataset.tag = tag.id;
    chip.textContent = tag.label;
    chip.style.cssText = `
      padding:7px 12px;border-radius:999px;font-size:12px;cursor:pointer;
      border:1.2px solid #e0ddd8;background:#fff;color:#666;
      transition:all 0.15s;font-family:inherit;`;
    chip.addEventListener('click', () => {
      if (_rewindSelectedTags.has(tag.id)) {
        _rewindSelectedTags.delete(tag.id);
        chip.style.background = '#fff';
        chip.style.color = '#666';
        chip.style.borderColor = '#e0ddd8';
      } else {
        _rewindSelectedTags.add(tag.id);
        chip.style.background = '#1a1a1a';
        chip.style.color = '#fff';
        chip.style.borderColor = '#1a1a1a';
      }
    });
    tagsWrap.appendChild(chip);
  });

  function resetChips() {
    _rewindSelectedTags.clear();
    tagsWrap.querySelectorAll('button').forEach(c => {
      c.style.background = '#fff';
      c.style.color = '#666';
      c.style.borderColor = '#e0ddd8';
    });
  }

  window.crOpenRewindModal = async function (msgIdx) {
    if (msgIdx < 0 || msgIdx >= crMessages.length) return;
    if (crMessages[msgIdx].role !== 'luna') { crShowTip('只能对 Ta 的消息使用「重回」'); return; }

    _rewindMsgIdx = msgIdx;
    resetChips();
    textarea.value = '';

    /* 显示当前已有多少条长期生效的纠偏规则 */
    try {
      const rules = await rewindLoadRules(CR_NAME);
      if (rules.length) {
        histNote.style.display = 'block';
        histNote.textContent = `已记录 ${rules.length} 条长期人设纠偏规则，AI 每次回复都会遵守。这次的反馈会追加进去。`;
      } else {
        histNote.style.display = 'none';
      }
    } catch { histNote.style.display = 'none'; }

    overlay.style.display = 'flex';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      modal.style.transform = 'scale(1)';
      modal.style.opacity   = '1';
      textarea.focus();
    }));
  };

  function closeModal() {
    modal.style.transform = 'scale(0.92)';
    modal.style.opacity   = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 220);
    _rewindMsgIdx = -1;
  }

  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  confirmBtn.addEventListener('click', async () => {
    if (_rewindMsgIdx < 0) { closeModal(); return; }

    const customText = textarea.value.trim();
    if (!customText && _rewindSelectedTags.size === 0) {
      crShowTip('请至少选一个标签或写清楚问题');
      return;
    }

    /* 组装本次反馈规则文本：标签描述 + 用户自定义描述 */
    const tagTexts = Array.from(_rewindSelectedTags).map(id => REWIND_TAG_TEXT[id]).filter(Boolean);
    const parts = [...tagTexts];
    if (customText) parts.push(customText);
    const ruleText = parts.join('；');

    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.6';
    confirmTxt.textContent = '正在重新生成…';

    try {
      await rewindApply(_rewindMsgIdx, ruleText);
      closeModal();
    } catch (err) {
      console.error('[重回]', err);
      crShowTip('重新生成失败，稍后再试～');
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmTxt.textContent = '重新生成';
    }
  });
}

/* ── 核心执行：保存反馈规则 → 撤回本轮 AI 回复 → 带新规则重新生成 ── */
async function rewindApply(msgIdx, ruleText) {
  /* 1. 规则持久化，绑定当前角色，长期生效 */
  await rewindAddRule(CR_NAME, ruleText);

  /* 2. 找到"本轮 AI 回复"的范围：从 msgIdx 开始，
        向后收进同一轮连续的 luna 消息（AI 一次回复可能拆成多条），
        向前也收进紧邻在 msgIdx 之前的连续 luna 消息（防止长按到中间某一段）。 */
  let start = msgIdx;
  while (start > 0 && crMessages[start - 1].role === 'luna') start--;
  let end = msgIdx;
  while (end < crMessages.length - 1 && crMessages[end + 1].role === 'luna') end++;

  const removeCount = end - start + 1;
  crMessages.splice(start, removeCount);
  dbSaveMessages(CR_NAME, crMessages);

  /* 3. 同步删除 DOM 中对应的气泡 */
  const allWrap = Array.from(document.querySelectorAll('.cr-msg-mine, .cr-msg-luna'));
  for (let i = end; i >= start; i--) {
    if (allWrap[i]) allWrap[i].remove();
  }

  crShowTip('已撤回，正在结合反馈重新生成…');

  /* 4. 重新生成：复用 crAiReply 的核心链路，
        crBuildSystemPrompt 内部会自动读取并附加最新的全部纠偏规则 */
  await crAiReply();
}

/* 立即初始化弹窗 DOM，确保长按菜单和功能面板卡片都能随时调用 window.crOpenRewindModal */
ensureRewindModal();

})();
/* ================================================================
   引用条 — Quote Bar
================================================================ */
/* msg: crMessages 里的原始消息对象；msgIndex: 该消息在 crMessages 中的索引，用于之后跳转定位 */
function crShowQuoteBar(msg, msgIndex) {
  var bar  = document.getElementById('crQuoteBar');
  var textEl = document.getElementById('crQuoteText');
  var box  = document.getElementById('crInputBox');
  if (!bar || !textEl) return;

  /* 提取纯文字内容（语音/图片等特殊消息取其文字化描述） */
  var raw = msg.isVoice ? (msg.voiceText || msg.text || '')
          : msg.isLocation ? ('[位置] ' + (msg.locName || ''))
          : msg.isTransfer ? ('[转账] ' + (msg.trRemark || msg.trAmt || ''))
          : msg.isHongbao ? ('[红包] ' + (msg.hbGreeting || ''))
          : msg.isAiImage || msg.imageUrl ? ('[图片] ' + (msg.imageDesc || ''))
          : (msg.text || '');

  var who = msg.role === 'mine' ? '你' : CR_NAME;
  var short = raw.length > 30 ? raw.slice(0, 30) + '…' : raw;
  textEl.textContent = who + '：' + short;

  /* 把完整引用数据存在引用条的 dataset 上，发送时读取 */
  bar.dataset.quoteText = raw;
  bar.dataset.quoteRole = msg.role;
  bar.dataset.quoteIdx  = (typeof msgIndex === 'number') ? String(msgIndex) : '';

  bar.style.display = 'flex';

  /* 清空输入框并聚焦 */
  if (box) {
    box.innerHTML = '';
    box.focus();
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var closeBtn = document.getElementById('crQuoteClose');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      var bar = document.getElementById('crQuoteBar');
      if (bar) {
        bar.style.display = 'none';
        delete bar.dataset.quoteText;
        delete bar.dataset.quoteRole;
        delete bar.dataset.quoteIdx;
      }
    });
  }
});

/* ── AI 发送位置卡片 ── */
function crAppendAiLocationReply(locName, locAddr) {
  const area = document.getElementById('crMessages');
  if (!area) return;
  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');

  const msgObj = { role: 'luna', text: '[位置] ' + locName, isLocation: true, locName, locAddr, locCoord: '虚拟坐标', time: t };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  const el = document.createElement('div');
  el.className = 'cr-msg-luna';
  el.innerHTML = crMiniAvHtml() + `
  <div>
    <div style="width:200px;border-radius:16px;overflow:hidden;border:0.5px solid rgba(0,0,0,0.09);box-shadow:0 4px 16px rgba(0,0,0,0.08);">
      <div style="width:100%;height:100px;background:#e8e7e0;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;background-image:linear-gradient(rgba(0,0,0,0.055) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,0.055) 1px,transparent 1px);background-size:18px 18px;"></div>
        <svg style="position:absolute;inset:0;width:100%;height:100%;opacity:0.28" viewBox="0 0 200 100" fill="none">
          <line x1="0" y1="50" x2="200" y2="50" stroke="#1a1a1a" stroke-width="5"/>
          <line x1="100" y1="0" x2="100" y2="100" stroke="#1a1a1a" stroke-width="3"/>
          <line x1="0" y1="25" x2="65" y2="25" stroke="#1a1a1a" stroke-width="2"/>
          <line x1="135" y1="75" x2="200" y2="75" stroke="#1a1a1a" stroke-width="2"/>
        </svg>
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:50%;background:rgba(26,26,26,0.12);display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;inset:-6px;border-radius:50%;border:1px solid rgba(26,26,26,0.15);"></div>
          <div style="width:11px;height:11px;border-radius:50%;background:#1a1a1a;border:2.5px solid #fff;z-index:2;"></div>
        </div>
        <div style="position:absolute;bottom:7px;left:50%;transform:translateX(-50%);background:rgba(255,255,255,0.92);border:0.5px solid rgba(0,0,0,0.1);border-radius:20px;padding:2px 10px;font-family:'Space Mono',monospace;font-size:9px;font-weight:500;color:#1a1a1a;white-space:nowrap;">虚拟坐标</div>
      </div>
      <div style="background:#fff;padding:9px 12px 11px;display:flex;align-items:center;gap:8px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:500;color:#1a1a1a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px;">${escHtml(locName)}</div>
          <div style="font-size:10px;color:#aaa;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(locAddr)}</div>
        </div>
        <div style="width:24px;height:24px;background:#1a1a1a;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M5 15L15 5M15 5H7M15 5v8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
      </div>
    </div>
    <p class="cr-msg-time">${t}</p>
  </div>`;

  el.style.opacity = '0';
  el.style.transform = 'translateY(8px)';
  el.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  }));
}

/* ================================================================
   转账卡片 — Transfer Card
================================================================ */
function crTransferCardHTML(amt, remark, role, status, msgIdx) {
  const isMine = role === 'mine';
  const isConfirm = role === 'mine-confirm'; // 用户对 Luna 发起请求的确认回执卡片
  const isLunaReceive = role === 'luna-receive'; // Luna 收到用户转账，显示领取/拒绝
  /* isMine=true    → 用户主动给 Luna 转账：TRANSFER SENT
     isConfirm=true → 用户接受/拒绝了 Luna 的请求后，用户侧确认回执：TRANSFER CONFIRM
     else           → Luna 向用户发起的请求：PAYMENT REQUEST，用户来接受/拒绝 */
  const statusMap = {
    pending:  { label: '待付款',  color: '#aaa',    bg: '#f5f5f5' },
    accepted: { label: '已付款',  color: '#4ade80', bg: '#f0fdf4' },
    declined: { label: '已拒绝',  color: '#f87171', bg: '#fef2f2' },
  };
  const mineStatusMap = {
    pending:  { label: '待接受',  color: '#aaa',    bg: '#f5f5f5' },
    accepted: { label: '已接受',  color: '#4ade80', bg: '#f0fdf4' },
    declined: { label: '已拒绝',  color: '#f87171', bg: '#fef2f2' },
  };
  const confirmStatusMap = {
    pending:  { label: '待确认',  color: '#aaa',    bg: '#f5f5f5' },
    accepted: { label: '已付款',  color: '#4ade80', bg: '#f0fdf4' },
    declined: { label: '已拒绝',  color: '#f87171', bg: '#fef2f2' },
  };
  const lunaReceiveStatusMap = {
    pending:  { label: '待领取',  color: '#aaa',    bg: '#f5f5f5' },
    accepted: { label: '已领取',  color: '#4ade80', bg: '#f0fdf4' },
    declined: { label: '已拒绝',  color: '#f87171', bg: '#fef2f2' },
  };
  const s = isConfirm
    ? (confirmStatusMap[status] || confirmStatusMap.pending)
    : isLunaReceive
    ? (lunaReceiveStatusMap[status] || lunaReceiveStatusMap.pending)
    : (isMine ? mineStatusMap : statusMap)[status] || (isMine ? mineStatusMap : statusMap).pending;
  const amtStyle = status === 'declined'
    ? 'font-size:28px;font-weight:700;color:#1a1a1a;letter-spacing:-1px;font-family:\'Space Mono\',monospace;text-decoration:line-through;opacity:0.35;'
    : 'font-size:28px;font-weight:700;color:#1a1a1a;letter-spacing:-1px;font-family:\'Space Mono\',monospace;';
  const header  = isMine ? 'TRANSFER SENT' : isConfirm ? 'TRANSFER CONFIRM' : isLunaReceive ? 'TRANSFER RECEIVED' : 'PAYMENT REQUEST';
  const direction = isMine ? `我 → ${CR_NAME}` : isConfirm ? `${CR_NAME} → 我` : isLunaReceive ? `我 → ${CR_NAME}` : `你 → ${CR_NAME}`;
  const btnRow = (isLunaReceive && status === 'pending') ? `
    <div style="display:flex;border-top:0.5px solid rgba(0,0,0,0.06);">
      <button class="tr-luna-decline-btn" style="flex:1;padding:12px;background:none;border:none;font-size:13px;color:#bbb;cursor:pointer;font-family:inherit;border-right:0.5px solid rgba(0,0,0,0.06);">拒绝</button>
      <button class="tr-luna-accept-btn" style="flex:1;padding:12px;background:none;border:none;font-size:13px;font-weight:600;color:#1a1a1a;cursor:pointer;font-family:inherit;">领取</button>
    </div>`
    : (!isMine && !isConfirm && !isLunaReceive && status === 'pending') ? `
    <div style="display:flex;border-top:0.5px solid rgba(0,0,0,0.06);">
      <button class="tr-decline-btn" style="flex:1;padding:12px;background:none;border:none;font-size:13px;color:#bbb;cursor:pointer;font-family:inherit;border-right:0.5px solid rgba(0,0,0,0.06);">拒绝</button>
      <button class="tr-accept-btn" style="flex:1;padding:12px;background:none;border:none;font-size:13px;font-weight:600;color:#1a1a1a;cursor:pointer;font-family:inherit;">付款</button>
    </div>` : '';
  const rightInfo = (isMine || isConfirm)
    ? `<div style="display:flex;align-items:center;gap:5px;"><div style="width:5px;height:5px;border-radius:50%;background:#4ade80;"></div><span style="font-size:10px;color:#bbb;">已发送</span></div>`
    : '';
  return `
    <div class="cr-transfer-card" data-msgidx="${msgIdx ?? ''}" style="width:220px;border-radius:18px;overflow:hidden;background:#fff;border:0.5px solid rgba(0,0,0,0.08);">
      <div style="padding:16px 18px 12px;border-bottom:0.5px solid rgba(0,0,0,0.06);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
          <div style="font-size:9px;letter-spacing:3px;color:#ccc;font-family:'Space Mono',monospace;text-transform:uppercase;">${header}</div>
          <div style="background:${s.bg};border-radius:20px;padding:3px 10px;font-size:10px;color:${s.color};font-family:'Space Mono',monospace;white-space:nowrap;">${s.label}</div>
        </div>
        <div style="${amtStyle}">¥ ${escHtml(amt)}</div>
        ${remark ? `<div style="font-size:12px;color:#aaa;margin-top:6px;">${escHtml(remark)}</div>` : ''}
      </div>
      <div style="padding:10px 16px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:#888;">${direction}</span>
        ${rightInfo}
      </div>
      ${btnRow}
    </div>`;
}

function crAppendTransferMsg(amt, remark, role) {
  const area = document.getElementById('crMessages');
  if (!area) return;
  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
  const msgIdx = crMessages.length;
  const msgObj = { role, text: '[转账] ¥' + amt, isTransfer: true, trAmt: amt, trRemark: remark, trStatus: 'pending', time: t };
  crMessages.push(msgObj);
  dbSaveMessages(CR_NAME, crMessages);

  const el = document.createElement('div');
  el.className = role === 'mine' ? 'cr-msg-mine' : 'cr-msg-luna';
  const inner = document.createElement('div');

  if (role === 'mine') {
    /* 用户发给 Luna：右侧显示"已发送 待接受"卡片，等 AI 回复时再更新状态 */
    inner.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:5px;';
    inner.innerHTML = crTransferCardHTML(amt, remark, 'mine', 'pending', msgIdx);
    const meta = document.createElement('div');
    meta.className = 'cr-mine-meta';
    meta.innerHTML = `<span class="cr-mine-time">${t}</span><svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    inner.appendChild(meta);
    el.appendChild(inner);
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '1'; el.style.transform = 'translateY(0)';
    }));

  } else {
    /* Luna 发给用户：左侧显示收款请求，用户来操作 */
    inner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
    inner.innerHTML = crMiniAvHtml() + `<div style="display:flex;flex-direction:column;gap:5px;">${crTransferCardHTML(amt, remark, 'luna', 'pending', msgIdx)}<p class="cr-msg-time">${t}</p></div>`;
    el.appendChild(inner);
    _bindTransferBtns(el, msgIdx);
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    el.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
    area.appendChild(el);
    area.scrollTop = area.scrollHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.opacity = '1'; el.style.transform = 'translateY(0)';
    }));
  }
}

function _bindTransferBtns(el, msgIdx) {
  const acceptBtn  = el.querySelector('.tr-accept-btn');
  const declineBtn = el.querySelector('.tr-decline-btn');
  const card = el.querySelector('.cr-transfer-card');
  if (!acceptBtn || !declineBtn || !card) return;

  function updateCard(status) {
    crMessages[msgIdx].trStatus = status;
    dbSaveMessages(CR_NAME, crMessages);
    const msg = crMessages[msgIdx];

    /* 1. 更新 Luna 侧那张卡片为最终状态（隐藏按钮） */
    const newCardHtml = crTransferCardHTML(msg.trAmt, msg.trRemark, 'luna', status, msgIdx);
    const tmp = document.createElement('div');
    tmp.innerHTML = newCardHtml;
    const newCard = tmp.firstElementChild;
    card.parentNode.replaceChild(newCard, card);

    /* 2. 在用户侧（右侧）追加一张确认状态卡片 */
    const area = document.getElementById('crMessages');
    const n = new Date();
    const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');

    const confirmMsgObj = {
      role: 'mine',
      isTransfer: true,
      isTransferConfirm: true,   // 标记：这是用户对 Luna 转账请求的确认回执
      trAmt: msg.trAmt,
      trRemark: msg.trRemark,
      trStatus: status,
      time: t
    };
    crMessages.push(confirmMsgObj);
    dbSaveMessages(CR_NAME, crMessages);

    /* 构建右侧确认卡片气泡 */
    const confirmEl = document.createElement('div');
    confirmEl.className = 'cr-msg-mine';
    const confirmInner = document.createElement('div');
    confirmInner.style.cssText = 'display:flex;flex-direction:column;align-items:flex-end;gap:5px;';
    confirmInner.innerHTML = crTransferCardHTML(msg.trAmt, msg.trRemark, 'mine-confirm', status, crMessages.length - 1);
    const meta = document.createElement('div');
    meta.className = 'cr-mine-meta';
    meta.innerHTML = `<span class="cr-mine-time">${t}</span><svg class="cr-mine-check" width="14" height="10" viewBox="0 0 14 10" fill="none"><path d="M1 5l3.5 3.5L13 1" stroke="rgba(100,100,100,0.5)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    confirmInner.appendChild(meta);
    confirmEl.appendChild(confirmInner);
    confirmEl.style.opacity = '0';
    confirmEl.style.transform = 'translateY(8px)';
    confirmEl.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
    area.appendChild(confirmEl);
    area.scrollTop = area.scrollHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      confirmEl.style.opacity = '1'; confirmEl.style.transform = 'translateY(0)';
    }));

    /* 3. 推系统提示触发 AI 情绪回复 */
    const statusText = status === 'accepted' ? '已接受' : '已拒绝';
    const sysMsg = {
      role: 'mine',
      text: `[系统：用户${statusText}了你发起的转账 ¥${msg.trAmt}${msg.trRemark ? '（备注：' + msg.trRemark + '）' : ''}，请用角色口吻自然回应这个结果，不要输出方括号内容]`,
      isSysHint: true,
      time: t
    };
    crMessages.push(sysMsg);
    dbSaveMessages(CR_NAME, crMessages);
    /* 不自动触发 AI 回复，等用户手动点 AI 按钮 */
  }

  acceptBtn.addEventListener('click', () => updateCard('accepted'));
  declineBtn.addEventListener('click', () => updateCard('declined'));
}

function _bindLunaReceiveBtns(el, userMsgIdx, lunaIdx) {
  const acceptBtn  = el.querySelector('.tr-luna-accept-btn');
  const declineBtn = el.querySelector('.tr-luna-decline-btn');
  const card = el.querySelector('.cr-transfer-card');
  if (!acceptBtn || !declineBtn || !card) return;

  function updateLunaCard(status) {
    /* 更新 Luna 侧收款卡片状态 */
    crMessages[lunaIdx].trStatus = status;
    dbSaveMessages(CR_NAME, crMessages);
    const lunaMsg = crMessages[lunaIdx];
    const newCardHtml = crTransferCardHTML(lunaMsg.trAmt, lunaMsg.trRemark, 'luna-receive', status, lunaIdx);
    const tmp = document.createElement('div');
    tmp.innerHTML = newCardHtml;
    const newCard = tmp.firstElementChild;
    card.parentNode.replaceChild(newCard, card);

    /* 同步更新用户侧"已发送"卡片的状态 */
    if (userMsgIdx >= 0 && crMessages[userMsgIdx]) {
      crMessages[userMsgIdx].trStatus = status;
      dbSaveMessages(CR_NAME, crMessages);
      /* 找到用户侧对应的 DOM 卡片并更新 */
      const allMineCards = document.querySelectorAll('.cr-msg-mine .cr-transfer-card');
      allMineCards.forEach(c => {
        if (c.dataset.msgidx == userMsgIdx) {
          const updatedHtml = crTransferCardHTML(
            crMessages[userMsgIdx].trAmt,
            crMessages[userMsgIdx].trRemark,
            'mine', status, userMsgIdx
          );
          const t2 = document.createElement('div');
          t2.innerHTML = updatedHtml;
          c.parentNode.replaceChild(t2.firstElementChild, c);
        }
      });
    }

    /* 推系统提示，等用户手动点 AI 按钮触发回复 */
    const n = new Date();
    const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');
    const statusText = status === 'accepted' ? '领取了' : '拒绝了';
    const msg = crMessages[lunaIdx];
    const sysMsg = {
      role: 'mine',
      text: `[系统：你（${CR_NAME}）${statusText}了用户发来的转账 ¥${msg.trAmt}${msg.trRemark ? '（备注：' + msg.trRemark + '）' : ''}，请用角色口吻自然回应，不要输出方括号内容]`,
      isSysHint: true,
      time: t
    };
    crMessages.push(sysMsg);
    dbSaveMessages(CR_NAME, crMessages);
    /* 不自动触发 AI，等用户手动点 AI 按钮 */
  }

  acceptBtn.addEventListener('click', () => updateLunaCard('accepted'));
  declineBtn.addEventListener('click', () => updateLunaCard('declined'));
}

/* AI 领取/拒绝用户发来的转账 */
function crAiReceiveTransfer(status) {
  /* 从后往前找最近一条用户发的、还是 pending 状态的转账消息 */
  let targetIdx = -1;
  for (let i = crMessages.length - 1; i >= 0; i--) {
    if (crMessages[i].role === 'mine' && crMessages[i].isTransfer && crMessages[i].trStatus === 'pending') {
      targetIdx = i;
      break;
    }
  }
  if (targetIdx < 0) return; // 找不到待处理转账，忽略

  /* 更新消息状态 */
  crMessages[targetIdx].trStatus = status;
  dbSaveMessages(CR_NAME, crMessages);

  /* 找到对应 DOM 卡片并更新 */
  const allMineCards = document.querySelectorAll('.cr-msg-mine .cr-transfer-card');
  allMineCards.forEach(c => {
    if (parseInt(c.dataset.msgidx) === targetIdx) {
      const msg = crMessages[targetIdx];
      const updatedHtml = crTransferCardHTML(msg.trAmt, msg.trRemark, 'mine', status, targetIdx);
      const tmp = document.createElement('div');
      tmp.innerHTML = updatedHtml;
      c.parentNode.replaceChild(tmp.firstElementChild, c);
    }
  });

  /* Luna 侧追加一张确认状态卡片 */
  const area = document.getElementById('crMessages');
  const msg = crMessages[targetIdx];
  const n2 = new Date();
  const t2 = n2.getHours().toString().padStart(2,'0') + ':' + n2.getMinutes().toString().padStart(2,'0');
  const lunaConfirmMsgObj = {
    role: 'luna',
    isTransfer: true,
    isLunaReceive: true,
    text: '[转账回执] ¥' + msg.trAmt,
    trAmt: msg.trAmt,
    trRemark: msg.trRemark,
    trStatus: status,
    time: t2
  };
  crMessages.push(lunaConfirmMsgObj);
  dbSaveMessages(CR_NAME, crMessages);

  const lunaConfirmEl = document.createElement('div');
  lunaConfirmEl.className = 'cr-msg-luna';
  const lunaConfirmInner = document.createElement('div');
  lunaConfirmInner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
  lunaConfirmInner.innerHTML = crMiniAvHtml() + `<div style="display:flex;flex-direction:column;gap:5px;">${crTransferCardHTML(msg.trAmt, msg.trRemark, 'luna-receive', status, crMessages.length - 1)}<p class="cr-msg-time">${t2}</p></div>`;
  lunaConfirmEl.appendChild(lunaConfirmInner);
  lunaConfirmEl.style.opacity = '0';
  lunaConfirmEl.style.transform = 'translateY(8px)';
  lunaConfirmEl.style.transition = 'opacity 0.28s ease,transform 0.28s ease';
  area.appendChild(lunaConfirmEl);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    lunaConfirmEl.style.opacity = '1'; lunaConfirmEl.style.transform = 'translateY(0)';
  }));
}

/* AI 主动发红包给用户 */
function crAppendAiHongbaoReply(amt, greeting) {
  const area = document.getElementById('crMessages');
  if (!area) return;

  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');

  const msgObj = {
    role: 'luna',
    isHongbao: true,
    isLunaReceive: false,   // Luna 是发送方
    hbAmt: amt,
    hbGreeting: greeting,
    hbStatus: 'pending',
    text: '[红包] ¥' + amt,
    time: t
  };
  crMessages.push(msgObj);
  const lunaIdx = crMessages.length - 1;
  dbSaveMessages(CR_NAME, crMessages);

  /* 构建 Luna 侧发出的红包卡片（用户视角是待拆） */
  const el = document.createElement('div');
  el.className = 'cr-msg-luna';
  const inner = document.createElement('div');
  inner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
  inner.innerHTML = crMiniAvHtml() + `<div style="display:flex;flex-direction:column;gap:5px;">${crHongbaoCardHTML(amt, greeting, 'luna-receive', 'pending', lunaIdx)}<p class="cr-msg-time">${t}</p></div>`;
  el.appendChild(inner);

  el.style.cssText = 'opacity:0;transform:translateY(8px);transition:opacity 0.28s ease,transform 0.28s ease;';
  area.appendChild(el);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.style.opacity = '1'; el.style.transform = 'translateY(0)';
  }));

  /* 绑定用户侧拆开/过期按钮，userMsgIdx=-1（Luna 主动发，没有对应用户消息） */
  _bindHongbaoBtns(el, -1, lunaIdx);
}

/* AI 自动拆开/不拆用户发来的红包 */
function crAiReceiveHongbao(status) {
  /* 从后往前找最近一条用户发的红包（不限状态，AI 的判断优先） */
  let targetIdx = -1;
  for (let i = crMessages.length - 1; i >= 0; i--) {
    if (crMessages[i].role === 'mine' && crMessages[i].isHongbao && !crMessages[i].isLunaReceive) {
      targetIdx = i; break;
    }
  }
  if (targetIdx < 0) return;
  /* 如果已经有 Luna 侧回执卡存在（说明已处理过），不重复追加 */
  const alreadyHandled = crMessages.some(
    (m, i) => i > targetIdx && m.isHongbao && m.isLunaReceive && m.hbAmt === crMessages[targetIdx].hbAmt
  );
  if (alreadyHandled) return;

  /* 更新用户侧红包卡片状态 */
  crMessages[targetIdx].hbStatus = status;
  dbSaveMessages(CR_NAME, crMessages);

  /* 找到 DOM 里用户侧卡片并更新 */
  document.querySelectorAll('.cr-msg-mine .cr-hongbao-card').forEach(c => {
    if (parseInt(c.dataset.msgidx) === targetIdx) {
      const m = crMessages[targetIdx];
      const updated = crHongbaoCardHTML(m.hbAmt, m.hbGreeting, 'mine', status, targetIdx);
      const tmp = document.createElement('div');
      tmp.innerHTML = updated;
      c.parentNode.replaceChild(tmp.firstElementChild, c);
    }
  });

  /* Luna 侧也追加一张回执卡 */
  const area = document.getElementById('crMessages');
  const m = crMessages[targetIdx];
  const n = new Date();
  const t = n.getHours().toString().padStart(2,'0') + ':' + n.getMinutes().toString().padStart(2,'0');

  const lunaConfirmObj = {
    role: 'luna',
    isHongbao: true,
    isLunaReceive: true,
    hbAmt: m.hbAmt,
    hbGreeting: m.hbGreeting,
    hbStatus: status,
    text: '[红包回执] ¥' + m.hbAmt,
    time: t
  };
  crMessages.push(lunaConfirmObj);
  dbSaveMessages(CR_NAME, crMessages);

  const lunaIdx = crMessages.length - 1;
  const confirmEl = document.createElement('div');
  confirmEl.className = 'cr-msg-luna';
  const confirmInner = document.createElement('div');
  confirmInner.style.cssText = 'display:flex;align-items:flex-start;gap:8px;';
  confirmInner.innerHTML = crMiniAvHtml() + `<div style="display:flex;flex-direction:column;gap:5px;">${crHongbaoCardHTML(m.hbAmt, m.hbGreeting, 'luna-receive', status, lunaIdx)}<p class="cr-msg-time">${t}</p></div>`;
  confirmEl.appendChild(confirmInner);

  confirmEl.style.cssText = 'opacity:0;transform:translateY(8px);transition:opacity 0.28s ease,transform 0.28s ease;';
  area.appendChild(confirmEl);
  area.scrollTop = area.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    confirmEl.style.opacity = '1'; confirmEl.style.transform = 'translateY(0)';
  }));
}

/* ================================================================
   小剧场 — Theatre Panel
================================================================ */
(function () {

const THEATRE_SCENES = [
  { id: 'coffee', emoji: '☕', title: '咖啡馆初遇', desc: '雨天，你们在同一家小咖啡馆偶遇，共享一把伞…', prompt: '我们在一家安静的咖啡馆里相遇。外面下着雨，请你扮演我们第一次相遇的场景，用温柔而略带紧张的语气开始对话。' },
  { id: 'night',  emoji: '🌙', title: '深夜漫步',   desc: '城市夜晚，街灯下的两个人，说着只有彼此懂的话。', prompt: '现在是深夜，我们一起在安静的街道上漫步。路灯把影子拉得很长，请你用温柔、私密的语气，像老朋友一样和我聊天。' },
  { id: 'secret', emoji: '🔮', title: '秘密基地',   desc: '只有你们两个人知道的地方，藏着所有秘密。',  prompt: '我们来到了一个只有彼此才知道的秘密角落。这里是我们的专属空间，请你扮演这个场景，带着亲密和神秘感和我说话。' },
  { id: 'travel', emoji: '🚂', title: '旅途邂逅',   desc: '火车上偶遇，窗外风景飞逝，话题却停不下来。',  prompt: '我们在一列驶向远方的火车上相遇。窗外风景不断变换，请你扮演陌生人变成旅伴的场景，带着轻松和好奇开始对话。' },
  { id: 'star',   emoji: '✨', title: '星空之下',   desc: '草地上仰望星空，彼此分享最深藏的愿望。',  prompt: '我们躺在草地上一起看星星。夜空璀璨，气氛安静而温柔。请你扮演这个场景，用诗意且温暖的方式和我聊聊心里话。' },
  { id: 'custom', emoji: '🎭', title: '自定义情景', desc: '描述你想要的故事世界，一起创造专属剧情。',  prompt: null },
];

/* ── 注入 HTML ── */
document.body.insertAdjacentHTML('beforeend', `
<div id="theatreOverlay" style="display:none;position:fixed;inset:0;z-index:14000;
  align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.5);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);">
  <div id="theatreBackdrop" style="position:absolute;inset:0;cursor:pointer;"></div>

  <div id="theatreSheet" style="
    position:relative;z-index:1;
    width:100%;max-width:420px;
    background:#fff;
    border-radius:24px 24px 0 0;
    overflow:hidden;
    transform:translateY(100%);
    transition:transform 0.4s cubic-bezier(0.34,1.05,0.64,1);
    max-height:92vh;display:flex;flex-direction:column;
    font-family:'Inter',-apple-system,sans-serif;">

    <!-- 把手 -->
    <div style="flex-shrink:0;padding:14px 0 0;display:flex;justify-content:center;">
      <div style="width:36px;height:4px;border-radius:2px;background:#e0e0e0;"></div>
    </div>

    <!-- 头部 -->
    <div style="flex-shrink:0;background:#1a1218;padding:20px 22px 18px;position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background-image:radial-gradient(circle,rgba(255,255,255,.018) 1px,transparent 1px);background-size:16px 16px;pointer-events:none;"></div>
      <div style="position:absolute;top:-40px;right:-40px;width:120px;height:120px;border-radius:50%;border:0.5px solid rgba(255,255,255,.06);pointer-events:none;"></div>
      <div style="position:relative;z-index:1;">
        <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:3px;color:rgba(255,255,255,.3);text-transform:uppercase;margin-bottom:6px;">Theatre · 小剧场</div>
        <div style="font-size:20px;font-weight:600;color:#fff;letter-spacing:-.3px;margin-bottom:5px;">选择你的剧情</div>
        <div style="font-size:12px;color:rgba(255,255,255,.4);line-height:1.6;">选定一个场景，与 <span id="thName" style="color:rgba(255,255,255,.7);">Luna</span> 共同演绎专属故事</div>
      </div>
    </div>

    <!-- 场景列表 -->
    <div id="thSceneList" style="flex:1;overflow-y:auto;padding:14px 16px 8px;scrollbar-width:none;display:flex;flex-direction:column;gap:10px;"></div>

    <!-- 自定义输入区（默认隐藏） -->
    <div id="thCustomArea" style="display:none;flex-shrink:0;padding:0 16px 10px;">
      <div style="background:#f7f7f7;border:0.5px solid rgba(0,0,0,0.1);border-radius:14px;padding:12px 14px;">
        <div style="font-family:'Space Mono',monospace;font-size:8px;letter-spacing:2px;color:#b8b2aa;text-transform:uppercase;margin-bottom:8px;">描述你的情景</div>
        <div id="thCustomInput" contenteditable="true"
          style="font-size:13px;color:#1a1a1a;line-height:1.7;min-height:60px;outline:none;"
          placeholder="例如：我们是两个相遇在图书馆的陌生人…"></div>
      </div>
    </div>

    <!-- 底部按钮 -->
    <div style="flex-shrink:0;padding:10px 16px 28px;display:flex;gap:10px;">
      <button id="thCancelBtn" style="flex:1;padding:12px;border-radius:14px;border:0.5px solid rgba(0,0,0,0.12);background:#f5f5f5;cursor:pointer;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1.5px;color:#888;text-transform:uppercase;">取消</button>
      <button id="thStartBtn" style="flex:2;padding:12px;border-radius:14px;border:none;background:#1a1218;cursor:pointer;font-family:'Space Mono',monospace;font-size:9px;letter-spacing:1.5px;color:#fff;text-transform:uppercase;display:flex;align-items:center;justify-content:center;gap:6px;">
        <svg width="11" height="11" viewBox="0 0 20 20" fill="none"><path d="M5 10l4 4 6-8" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        开始演绎
      </button>
    </div>
  </div>
</div>

<style>
#thSceneList::-webkit-scrollbar{display:none;}
.th-scene-card{
  border:0.5px solid rgba(0,0,0,0.1);border-radius:14px;padding:13px 14px;
  cursor:pointer;display:flex;align-items:center;gap:12px;
  transition:background .16s,border-color .16s,transform .12s;
  background:#fafafa;
  -webkit-tap-highlight-color:transparent;
}
.th-scene-card:active{transform:scale(0.985);}
.th-scene-card.th-selected{background:#1a1218;border-color:#1a1218;}
.th-scene-card.th-selected .th-sc-title{color:#fff;}
.th-scene-card.th-selected .th-sc-desc{color:rgba(255,255,255,.45);}
.th-sc-emoji{font-size:24px;flex-shrink:0;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.04);border-radius:10px;}
.th-scene-card.th-selected .th-sc-emoji{background:rgba(255,255,255,.08);}
.th-sc-title{font-size:13.5px;font-weight:600;color:#1a1a1a;letter-spacing:-.2px;margin-bottom:3px;}
.th-sc-desc{font-size:11.5px;color:#aaa;line-height:1.5;}
.th-sc-check{width:18px;height:18px;border-radius:50%;border:0.5px solid rgba(0,0,0,0.15);background:#fff;flex-shrink:0;margin-left:auto;display:flex;align-items:center;justify-content:center;transition:all .16s;}
.th-scene-card.th-selected .th-sc-check{background:#fff;border-color:#fff;}
</style>
`);

let _thSelected = null;

/* ── 渲染场景卡 ── */
function thRenderScenes() {
  const list = document.getElementById('thSceneList');
  list.innerHTML = '';
  THEATRE_SCENES.forEach(s => {
    const card = document.createElement('div');
    card.className = 'th-scene-card' + (_thSelected === s.id ? ' th-selected' : '');
    card.dataset.id = s.id;
    card.innerHTML = `
      <div class="th-sc-emoji">${s.emoji}</div>
      <div style="flex:1;min-width:0;">
        <div class="th-sc-title">${s.title}</div>
        <div class="th-sc-desc">${s.desc}</div>
      </div>
      <div class="th-sc-check">
        ${_thSelected === s.id
          ? `<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2.5 2.5L8 2.5" stroke="#1a1218" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`
          : ''}
      </div>`;
    card.addEventListener('click', () => {
      _thSelected = s.id;
      thRenderScenes();
      const customArea = document.getElementById('thCustomArea');
      customArea.style.display = s.id === 'custom' ? 'block' : 'none';
    });
    list.appendChild(card);
  });
}

/* ── 开关面板 ── */
function openTheatre() {
  const ov = document.getElementById('theatreOverlay');
  const sheet = document.getElementById('theatreSheet');
  if (!ov || !sheet) return;
  // 同步名字
  const nameEl = document.getElementById('thName');
  if (nameEl) nameEl.textContent = (typeof CR_NAME !== 'undefined' ? CR_NAME : 'Luna');
  _thSelected = null;
  document.getElementById('thCustomArea').style.display = 'none';
  thRenderScenes();
  ov.style.display = 'flex';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    sheet.style.transform = 'translateY(0)';
  }));
}

function closeTheatre() {
  const sheet = document.getElementById('theatreSheet');
  if (sheet) sheet.style.transform = 'translateY(100%)';
  setTimeout(() => {
    const ov = document.getElementById('theatreOverlay');
    if (ov) ov.style.display = 'none';
  }, 380);
}

document.getElementById('theatreBackdrop').addEventListener('click', closeTheatre);
document.getElementById('thCancelBtn').addEventListener('click', closeTheatre);

/* ── 开始演绎 ── */
document.getElementById('thStartBtn').addEventListener('click', () => {
  if (!_thSelected) {
    // 抖动提示
    const sheet = document.getElementById('theatreSheet');
    sheet.style.transition = 'transform 0.08s ease';
    sheet.style.transform = 'translateY(-6px)';
    setTimeout(() => { sheet.style.transform = 'translateY(0)'; sheet.style.transition = 'transform 0.4s cubic-bezier(0.34,1.05,0.64,1)'; }, 80);
    return;
  }
  const scene = THEATRE_SCENES.find(s => s.id === _thSelected);
  if (!scene) return;

  // 自定义情景：先读输入框
  let customText = '';
  if (scene.id === 'custom') {
    const inp = document.getElementById('thCustomInput');
    customText = inp ? inp.textContent.trim() : '';
    if (!customText) { inp && inp.focus(); return; }
  }

  closeTheatre();

  // ── 跳转到 Luna Studio，把场景信息通过 URL 参数传递 ──
  setTimeout(() => {
    const charName = (typeof CR_NAME !== 'undefined' && CR_NAME) ? CR_NAME : 'Luna';
    const params = new URLSearchParams({
      from:     'theatre',
      sceneId:  scene.id,
      title:    scene.title,
      desc:     scene.desc,
      emoji:    scene.emoji,
      custom:   customText,
      charName: charName,
    });
    window.open('luna-studio.html?' + params.toString(), '_blank');
  }, 300);
});

window.crOpenTheatrePanel = openTheatre;

})();

/* ================================================================
   头部三个点按钮 → 跳转 chatsetting.html
================================================================ */
(function () {
  function bindMoreBtn() {
    const moreBtn = document.querySelector('.cr-actions .cr-action-btn[title="更多"]');
    if (!moreBtn) return;
    moreBtn.addEventListener('click', function () {
      window.location.href = 'chatsetting.html';
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMoreBtn);
  } else {
    bindMoreBtn();
  }
})();
/* ================================================================
   头部样式同步 — 从 appearance_settings 的「应用预览」写入
   读取 luna_header_style，实时渲染到 .cr-header 及子元素
================================================================ */
(function () {

  /* 注入的自定义 style 标签 */
  var _crHeaderCustomStyle = null;

  function crApplyHeaderStyle() {
    try {
      /* 优先读角色专属 key，没有则回落全局 luna_header_style */
      var currentChar = localStorage.getItem('luna_current_chat') || '';
      var charKey = currentChar ? 'luna_header_style_char_' + currentChar : '';
      var raw = (charKey && localStorage.getItem(charKey))
        ? localStorage.getItem(charKey)
        : localStorage.getItem('luna_header_style');
      if (!raw) return;
      var s = JSON.parse(raw);

      /* ── 1. 头部背景 ── */
      var header = document.querySelector('.cr-header');
      if (header) header.style.background = s.bg || '';

      /* ── 2. 角色名颜色 & 字号 ── */
      var nameEl = document.querySelector('.cr-name');
      if (nameEl) {
        nameEl.style.color    = s.nameColor || '';
        nameEl.style.fontSize = s.nm ? s.nm + 'px' : '';
      }

      /* ── 3. 副标题 ── */
      var subEl = document.querySelector('.cr-sub');
      if (subEl) {
        subEl.style.color    = s.sub || '';
        subEl.style.fontSize = s.sb ? s.sb + 'px' : '';
      }

      /* ── 4. 头像背景色 & 尺寸 ── */
      var avatarEl = document.querySelector('.cr-avatar');
      if (avatarEl) {
        if (s.av) {
          avatarEl.style.width  = s.av + 'px';
          avatarEl.style.height = s.av + 'px';
        }
        /* 只在没有真实头像时才覆盖背景色：检测 backgroundImage 或内部 <img> 标签 */
        var hasImg = (avatarEl.style.backgroundImage && avatarEl.style.backgroundImage !== 'none' && avatarEl.style.backgroundImage !== '')
          || !!avatarEl.querySelector('img');
        if (!hasImg && s.avBg) {
          avatarEl.style.background = s.avBg;
        }
      }

      /* ── 5. 在线点 ── */
      var dotEl = document.querySelector('.cr-online-dot');
      if (dotEl) dotEl.style.background = s.dot || '';
      var statusDotEl = document.querySelector('.cr-status-dot');
      if (statusDotEl) statusDotEl.style.background = s.dot || '';

      /* ── 6. 统计数值颜色 ── */
      document.querySelectorAll('.cr-stat-val').forEach(function (el) {
        el.style.color = s.stat || '';
      });
      document.querySelectorAll('.cr-stat-luna-row span').forEach(function (el) {
        el.style.color = s.stat || '';
      });

      /* ── 7. 主内容行内边距 ── */
      var mainEl = document.querySelector('.cr-header-main');
      if (mainEl && s.pd) {
        mainEl.style.paddingTop    = s.pd + 'px';
        mainEl.style.paddingBottom = (s.pd - 2) + 'px';
      }

      /* ── 8. 自定义 CSS（选择器 + 代码块）── */
      if (_crHeaderCustomStyle) {
        _crHeaderCustomStyle.remove();
        _crHeaderCustomStyle = null;
      }
      /* customSel 为空时用默认选择器 */
      var rawSel  = (s.customSel  || '').trim() || '.hs-cr-header';
      var rawCode = (s.customCode || '').trim();

      /* 把 .hs-cr-* 选择器映射到 chatroom 对应类名（无条件执行，不依赖 customCode 是否为空）
         .hs-cr-header 映射为 .cr-frame .cr-header 以提升优先级，
         确保覆盖 chatroom.css 中的 .cr-frame:not(.has-wallpaper) .cr-header 规则 */
      var mappedSel = rawSel
        .replace(/\.hs-cr-header-main\b/g,  '.cr-header-main')
        .replace(/\.hs-cr-header\b/g,        '.cr-frame .cr-header')
        .replace(/\.hs-cr-avatar\b/g,         '.cr-avatar')
        .replace(/\.hs-cr-name\b/g,           '.cr-name')
        .replace(/\.hs-cr-sub\b/g,            '.cr-sub')
        .replace(/\.hs-cr-status-pill\b/g,    '.cr-status-pill')
        .replace(/\.hs-cr-status-dot\b/g,     '.cr-status-dot')
        .replace(/\.hs-cr-online-dot\b/g,     '.cr-online-dot')
        .replace(/\.hs-cr-stats\b/g,          '.cr-stats')
        .replace(/\.hs-cr-stat-val\b/g,       '.cr-stat-val')
        .replace(/\.hs-cr-pulse-ring\b/g,     '.cr-pulse-ring')
        .replace(/\.hs-cr-badge\b/g,          '.cr-badge');

      /* 始终注入基础样式（将第1~7步的内联样式用 !important 写入 style 标签，
         确保能覆盖 chatroom.css 里更高优先级的规则） */
      var baseCode =
        '.cr-frame .cr-header { background: ' + (s.bg || 'unset') + ' !important; }\n' +
        '.cr-name { color: ' + (s.nameColor || 'unset') + ' !important; font-size: ' + (s.nm ? s.nm + 'px' : 'unset') + ' !important; }\n' +
        '.cr-sub { color: ' + (s.sub || 'unset') + ' !important; font-size: ' + (s.sb ? s.sb + 'px' : 'unset') + ' !important; }\n' +
        '.cr-avatar { width: ' + (s.av ? s.av + 'px' : 'unset') + ' !important; height: ' + (s.av ? s.av + 'px' : 'unset') + ' !important; }\n' +
        '.cr-avatar-inner { display: flex !important; width: 100% !important; height: 100% !important; border-radius: 50% !important; overflow: hidden !important; align-items: center !important; justify-content: center !important; }\n' +
        '.cr-avatar-inner img { width: 100% !important; height: 100% !important; object-fit: cover !important; border-radius: 50% !important; display: block !important; opacity: 1 !important; }\n' +
        '.cr-online-dot { background: ' + (s.dot || 'unset') + ' !important; }\n' +
        '.cr-status-dot { background: ' + (s.dot || 'unset') + ' !important; }\n' +
        '.cr-stat-val { color: ' + (s.stat || 'unset') + ' !important; }\n' +
        '.cr-stat-luna-row span { color: ' + (s.stat || 'unset') + ' !important; }\n' +
        '.cr-header-main { padding-top: ' + (s.pd ? s.pd + 'px' : 'unset') + ' !important; padding-bottom: ' + (s.pd ? (s.pd - 2) + 'px' : 'unset') + ' !important; }';

      /* 若有自定义 CSS，追加到基础样式后 */
      var extraCode = '';
      if (rawCode) {
        /* 兼容旧方案：如果用户写的还是 .hs-cr-* 旧类名，自动映射到真实 .cr-* 类名
           新方案用户直接写 .cr-* 不需要映射，映射不影响正确的代码 */
        var mappedCode = rawCode
          .replace(/\.hs-cr-header-main\b/g,  '.cr-header-main')
          .replace(/\.hs-cr-header-bg-svg\b/g, '.cr-header-bg')
          .replace(/\.hs-cr-header\b/g,        '.cr-frame .cr-header')
          .replace(/\.hs-cr-back-area\b/g,     '.cr-back-btn')
          .replace(/\.hs-cr-pulse-ring\b/g,    '.cr-pulse-ring')
          .replace(/\.hs-cr-orbit-ring\b/g,    '.cr-orbit-ring')
          .replace(/\.hs-cr-avatar\b/g,        '.cr-avatar')
          .replace(/\.hs-cr-online-dot\b/g,    '.cr-online-dot')
          .replace(/\.hs-cr-info\b/g,          '.cr-info')
          .replace(/\.hs-cr-name-row\b/g,      '.cr-name-row')
          .replace(/\.hs-cr-name\b/g,          '.cr-name')
          .replace(/\.hs-cr-badge\b/g,         '.cr-badge')
          .replace(/\.hs-cr-sub\b/g,           '.cr-sub')
          .replace(/\.hs-cr-status-pill\b/g,   '.cr-status-pill')
          .replace(/\.hs-cr-status-dot\b/g,    '.cr-status-dot')
          .replace(/\.hs-cr-actions\b/g,       '.cr-actions')
          .replace(/\.hs-cr-action-btn\b/g,    '.cr-action-btn')
          .replace(/\.hs-cr-stats\b/g,         '.cr-stats')
          .replace(/\.hs-cr-stat-luna-row\b/g, '.cr-stat-luna-row')
          .replace(/\.hs-cr-stat-luna\b/g,     '.cr-stat-luna')
          .replace(/\.hs-cr-stat-val\b/g,      '.cr-stat-val')
          .replace(/\.hs-cr-stat-lbl\b/g,      '.cr-stat-lbl')
          .replace(/\.hs-cr-stat\b/g,          '.cr-stat');

        /* 给每条没有 !important 的声明自动补上，确保能覆盖 chatroom.css */
        var boostedCode = mappedCode
          .replace(/([^:{}\n\/][^:{}]*?:[^;{}]+?)\s*(!important)?\s*;/g, function(m, decl, already) {
            return already ? m : decl.trimRight() + ' !important;';
          });
        /* 处理末尾无分号的最后一条声明 */
        if (!/;\s*$/.test(boostedCode.trim())) {
          boostedCode = boostedCode.trimRight();
          if (!/!important/.test(boostedCode.split('\n').pop())) {
            boostedCode += ' !important;';
          }
        }
        extraCode = '\n' + boostedCode;
      }

      var styleTag = document.createElement('style');
      styleTag.id  = 'cr-header-custom-inject';
      styleTag.textContent = baseCode + extraCode;
      document.head.appendChild(styleTag);
      _crHeaderCustomStyle = styleTag;

      /* ── 头像居中：若自定义CSS含 hs-cr-avatar 绝对定位意图，
         把 .cr-avatar DOM 节点直接移到 .cr-header-main 下，
         解决「.cr-back-btn position:relative 成为包含块」导致头像无法跑到中间的问题 ── */
      var _needAvatarMove = rawCode && rawCode.indexOf('hs-cr-avatar') !== -1;
      var _headerMain = document.querySelector('.cr-header-main');
      var _avatarEl   = document.getElementById('crAvatarWrap');
      var _backBtn    = document.getElementById('crBackBtn');
      if (_needAvatarMove && _headerMain && _avatarEl && _backBtn) {
        /* 还没移过才移，防止重复 */
        if (_avatarEl.parentElement !== _headerMain) {
          _headerMain.appendChild(_avatarEl);
        }
        /* 让按钮本身 overflow 可见，箭头伪元素才能显示 */
        _backBtn.style.overflow = 'visible';
      } else if (!_needAvatarMove && _avatarEl && _backBtn) {
        /* 主题没有移头像需求，确保头像还在按钮里（页面刷新时已在，切换主题时复位）*/
        if (_avatarEl.parentElement !== _backBtn) {
          _backBtn.insertBefore(_avatarEl, _backBtn.querySelector('.cr-online-dot'));
        }
        _backBtn.style.overflow = '';
      }

    } catch (err) {
      console.warn('[crApplyHeaderStyle] 解析失败', err);
    }
  }

  /* 暴露全局（供 storage 监听器调用） */
  window.crApplyHeaderStyle = crApplyHeaderStyle;

  /* 页面加载时立即读取并应用已保存样式 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crApplyHeaderStyle);
  } else {
    crApplyHeaderStyle();
  }

})();

/* ================================================================
   内嵌 Header Studio — 直接操作本页 .cr-header，零跨页面通信
================================================================ */
(function () {

  /* ── 注入面板 HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
<div id="crHsOverlay" style="
  display:none;position:fixed;inset:0;z-index:12000;
  align-items:flex-end;justify-content:center;
  background:rgba(0,0,0,0.45);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);">
  <div id="crHsPanel" style="
    width:100%;max-width:480px;
    background:#faf9f7;
    border-radius:24px 24px 0 0;
    border:0.5px solid rgba(0,0,0,0.08);
    box-shadow:0 -8px 40px rgba(0,0,0,0.14);
    padding:0 0 40px;
    box-sizing:border-box;
    max-height:88vh;overflow-y:auto;scrollbar-width:none;
    transform:translateY(100%);
    transition:transform 0.32s cubic-bezier(0.34,1.1,0.64,1);">
    <!-- 拖拽条 -->
    <div style="width:36px;height:4px;border-radius:2px;background:rgba(0,0,0,0.14);margin:12px auto 0;"></div>
    <!-- 标题行 -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px 0;">
      <div>
        <div style="font-family:'Space Mono',monospace;font-size:9px;letter-spacing:2.5px;color:#aaa;text-transform:uppercase;margin-bottom:4px;">Header Studio</div>
        <div style="font-size:16px;font-weight:600;color:#1a1a1a;">头部样式编辑器</div>
      </div>
      <button onclick="crHsClose()" style="width:28px;height:28px;border-radius:50%;border:0.5px solid rgba(0,0,0,0.12);background:#f5f5f5;cursor:pointer;display:flex;align-items:center;justify-content:center;">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1 1l8 8M9 1L1 9" stroke="#666" stroke-width="1.4" stroke-linecap="round"/></svg>
      </button>
    </div>

    <div style="padding:22px 22px 0;">

      <!-- 颜色区 -->
      <div style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">Colors · 颜色</div>

      <!-- 背景色 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:13px;color:#444;">背景色</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="crHsHBg" style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;">#ffffff</span>
          <input id="crHsCBg" type="color" value="#ffffff" onchange="crHsPreview()" oninput="crHsPreview()"
            style="width:32px;height:32px;border:0.5px solid rgba(0,0,0,0.12);border-radius:8px;cursor:pointer;padding:2px;background:#fff;"/>
        </div>
      </div>
      <!-- 昵称色 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:13px;color:#444;">昵称颜色</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="crHsHName" style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;">#1a1a1a</span>
          <input id="crHsCName" type="color" value="#1a1a1a" onchange="crHsPreview()" oninput="crHsPreview()"
            style="width:32px;height:32px;border:0.5px solid rgba(0,0,0,0.12);border-radius:8px;cursor:pointer;padding:2px;background:#fff;"/>
        </div>
      </div>
      <!-- 副标题色 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:13px;color:#444;">副标题颜色</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="crHsHSub" style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;">#aaaaaa</span>
          <input id="crHsCSub" type="color" value="#aaaaaa" onchange="crHsPreview()" oninput="crHsPreview()"
            style="width:32px;height:32px;border:0.5px solid rgba(0,0,0,0.12);border-radius:8px;cursor:pointer;padding:2px;background:#fff;"/>
        </div>
      </div>
      <!-- 头像背景 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:13px;color:#444;">头像背景色</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="crHsHAvBg" style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;">#efefef</span>
          <input id="crHsCAvBg" type="color" value="#efefef" onchange="crHsPreview()" oninput="crHsPreview()"
            style="width:32px;height:32px;border:0.5px solid rgba(0,0,0,0.12);border-radius:8px;cursor:pointer;padding:2px;background:#fff;"/>
        </div>
      </div>
      <!-- 在线点 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <span style="font-size:13px;color:#444;">在线指示点</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="crHsHDot" style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;">#5a5a5a</span>
          <input id="crHsCDot" type="color" value="#5a5a5a" onchange="crHsPreview()" oninput="crHsPreview()"
            style="width:32px;height:32px;border:0.5px solid rgba(0,0,0,0.12);border-radius:8px;cursor:pointer;padding:2px;background:#fff;"/>
        </div>
      </div>
      <!-- 统计数字色 -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <span style="font-size:13px;color:#444;">统计数字颜色</span>
        <div style="display:flex;align-items:center;gap:8px;">
          <span id="crHsHStat" style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;">#1a1a1a</span>
          <input id="crHsCStat" type="color" value="#1a1a1a" onchange="crHsPreview()" oninput="crHsPreview()"
            style="width:32px;height:32px;border:0.5px solid rgba(0,0,0,0.12);border-radius:8px;cursor:pointer;padding:2px;background:#fff;"/>
        </div>
      </div>

      <div style="height:1px;background:rgba(0,0,0,0.06);margin-bottom:20px;"></div>

      <!-- 尺寸区 -->
      <div style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:14px;">Size · 尺寸</div>

      <!-- 头像大小 -->
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;color:#444;">头像大小</span>
          <span id="crHsVAv" style="font-size:12px;color:#1a1a1a;font-family:'Space Mono',monospace;font-weight:600;">64px</span>
        </div>
        <input id="crHsRAv" type="range" min="32" max="120" value="64" onchange="crHsPreview()" oninput="crHsPreview()"
          style="width:100%;accent-color:#1a1a1a;"/>
      </div>
      <!-- 昵称字号 -->
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;color:#444;">昵称字号</span>
          <span id="crHsVNm" style="font-size:12px;color:#1a1a1a;font-family:'Space Mono',monospace;font-weight:600;">22px</span>
        </div>
        <input id="crHsRNm" type="range" min="10" max="40" value="22" onchange="crHsPreview()" oninput="crHsPreview()"
          style="width:100%;accent-color:#1a1a1a;"/>
      </div>
      <!-- 内边距 -->
      <div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;color:#444;">内边距</span>
          <span id="crHsVPd" style="font-size:12px;color:#1a1a1a;font-family:'Space Mono',monospace;font-weight:600;">16px</span>
        </div>
        <input id="crHsRPd" type="range" min="4" max="40" value="16" onchange="crHsPreview()" oninput="crHsPreview()"
          style="width:100%;accent-color:#1a1a1a;"/>
      </div>
      <!-- 副标题字号 -->
      <div style="margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
          <span style="font-size:13px;color:#444;">副标题字号</span>
          <span id="crHsVSb" style="font-size:12px;color:#1a1a1a;font-family:'Space Mono',monospace;font-weight:600;">12px</span>
        </div>
        <input id="crHsRSb" type="range" min="8" max="24" value="12" onchange="crHsPreview()" oninput="crHsPreview()"
          style="width:100%;accent-color:#1a1a1a;"/>
      </div>

      <div style="height:1px;background:rgba(0,0,0,0.06);margin-bottom:20px;"></div>

      <!-- 自定义 CSS 区 -->
      <div style="font-size:11px;color:#aaa;font-family:'Space Mono',monospace;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px;">Custom CSS · 自定义</div>
      <div style="margin-bottom:10px;">
        <input id="crHsCssSel" type="text" placeholder=".cr-header"
          style="width:100%;box-sizing:border-box;border:0.5px solid rgba(0,0,0,0.14);border-radius:10px;
          background:#fff;font-size:12px;color:#444;font-family:'Space Mono',monospace;
          outline:none;padding:8px 12px;transition:border-color 0.18s;"/>
      </div>
      <div style="margin-bottom:12px;">
        <textarea id="crHsCssCode" placeholder="color: red; font-weight: bold;" rows="4"
          style="width:100%;box-sizing:border-box;border:0.5px solid rgba(0,0,0,0.14);border-radius:10px;
          background:#fff;font-size:12px;color:#444;font-family:'Space Mono',monospace;
          outline:none;padding:10px 12px;resize:vertical;transition:border-color 0.18s;line-height:1.6;"></textarea>
      </div>
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        <button onclick="crHsApplyCssOnly()" style="flex:1;padding:9px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.14);background:#fff;color:#444;font-size:13px;cursor:pointer;font-family:inherit;transition:all 0.15s;">应用 CSS</button>
        <button onclick="crHsClearCss()" style="padding:9px 16px;border-radius:12px;border:0.5px solid rgba(0,0,0,0.14);background:#fff;color:#999;font-size:13px;cursor:pointer;font-family:inherit;transition:all 0.15s;">清除</button>
      </div>

      <div style="height:1px;background:rgba(0,0,0,0.06);margin-bottom:20px;"></div>

      <!-- 操作按钮 -->
      <div style="display:flex;gap:8px;">
        <button id="crHsApplyBtn" onclick="crHsApply()" style="
          flex:1;padding:13px;border-radius:14px;border:none;
          background:#1a1a1a;color:#fff;font-size:14px;font-weight:500;
          cursor:pointer;font-family:inherit;letter-spacing:0.3px;
          transition:opacity 0.15s;">✓ 应用</button>
        <button onclick="crHsExportCSS()" style="
          padding:13px 16px;border-radius:14px;border:0.5px solid rgba(0,0,0,0.14);
          background:#fff;color:#444;font-size:13px;
          cursor:pointer;font-family:inherit;
          transition:all 0.15s;">导出</button>
        <button onclick="crHsReset()" style="
          padding:13px 16px;border-radius:14px;border:0.5px solid rgba(0,0,0,0.14);
          background:#fff;color:#999;font-size:13px;
          cursor:pointer;font-family:inherit;
          transition:all 0.15s;">重置</button>
      </div>

    </div>
  </div>
</div>
`);

  /* ── 打开 / 关闭 ── */
  var _crHsPanel = document.getElementById('crHsPanel');
  var _crHsOverlay = document.getElementById('crHsOverlay');

  window.crHsOpen = function () {
    crHsLoadSaved();
    _crHsOverlay.style.display = 'flex';
    _crHsOverlay.style.alignItems = 'flex-end';
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        _crHsPanel.style.transform = 'translateY(0)';
      });
    });
  };
  window.crHsClose = function () {
    _crHsPanel.style.transform = 'translateY(100%)';
    setTimeout(function () { _crHsOverlay.style.display = 'none'; }, 320);
  };
  // 点遮罩关闭
  _crHsOverlay.addEventListener('click', function (e) {
    if (e.target === _crHsOverlay) crHsClose();
  });

  /* ── 实时预览（调色/拖条时立即反映到真实头部）── */
  window.crHsPreview = function () {
    var bg     = document.getElementById('crHsCBg').value;
    var name   = document.getElementById('crHsCName').value;
    var sub    = document.getElementById('crHsCSub').value;
    var avBg   = document.getElementById('crHsCAvBg').value;
    var dot    = document.getElementById('crHsCDot').value;
    var stat   = document.getElementById('crHsCStat').value;
    var av     = document.getElementById('crHsRAv').value;
    var nm     = document.getElementById('crHsRNm').value;
    var pd     = document.getElementById('crHsRPd').value;
    var sb     = document.getElementById('crHsRSb').value;

    // 更新数值显示
    document.getElementById('crHsVAv').textContent  = av + 'px';
    document.getElementById('crHsVNm').textContent  = nm + 'px';
    document.getElementById('crHsVPd').textContent  = pd + 'px';
    document.getElementById('crHsVSb').textContent  = sb + 'px';
    document.getElementById('crHsHBg').textContent   = bg;
    document.getElementById('crHsHName').textContent = name;
    document.getElementById('crHsHSub').textContent  = sub;
    document.getElementById('crHsHAvBg').textContent = avBg;
    document.getElementById('crHsHDot').textContent  = dot;
    document.getElementById('crHsHStat').textContent = stat;

    // 直接操作真实 DOM — 就在同一个页面，零延迟
    var header = document.querySelector('.cr-header');
    if (header) header.style.setProperty('background', bg, 'important');

    var nameEl = document.querySelector('.cr-name');
    if (nameEl) { nameEl.style.setProperty('color', name, 'important'); nameEl.style.setProperty('font-size', nm + 'px', 'important'); }

    var subEl = document.querySelector('.cr-sub');
    if (subEl) { subEl.style.setProperty('color', sub, 'important'); subEl.style.setProperty('font-size', sb + 'px', 'important'); }

    var avatarEl = document.querySelector('.cr-avatar');
    if (avatarEl) {
      avatarEl.style.setProperty('width',  av + 'px', 'important');
      avatarEl.style.setProperty('height', av + 'px', 'important');
      var hasImg = avatarEl.style.backgroundImage && avatarEl.style.backgroundImage !== 'none' && avatarEl.style.backgroundImage !== '';
      if (!hasImg) avatarEl.style.setProperty('background', avBg, 'important');
    }
    var backBtn = document.querySelector('.cr-back-btn');
    if (backBtn) { backBtn.style.setProperty('width', av + 'px', 'important'); backBtn.style.setProperty('height', av + 'px', 'important'); }

    var dotEl = document.querySelector('.cr-online-dot');
    if (dotEl) dotEl.style.setProperty('background', dot, 'important');
    var statusDotEl = document.querySelector('.cr-status-dot');
    if (statusDotEl) statusDotEl.style.setProperty('background', dot, 'important');

    document.querySelectorAll('.cr-stat-val').forEach(function(el) { el.style.setProperty('color', stat, 'important'); });
    document.querySelectorAll('.cr-stat-luna-row span').forEach(function(el) { el.style.setProperty('color', stat, 'important'); });

    var mainEl = document.querySelector('.cr-header-main');
    if (mainEl) {
      mainEl.style.setProperty('padding-top',    pd + 'px', 'important');
      mainEl.style.setProperty('padding-bottom', (pd - 2) + 'px', 'important');
    }
  };

  /* ── 仅应用自定义 CSS（textarea 里的内容）── */
  window.crHsApplyCssOnly = function () {
    var sel  = (document.getElementById('crHsCssSel').value || '').trim() || '.cr-header';
    var code = (document.getElementById('crHsCssCode').value || '').trim();
    if (!code) return;
    crHsInjectCustomCss(sel, code);
  };
  window.crHsClearCss = function () {
    var old = document.getElementById('cr-hs-custom-inject');
    if (old) old.remove();
  };

  function crHsInjectCustomCss(sel, code) {
    var old = document.getElementById('cr-hs-custom-inject');
    if (old) old.remove();
    // 把 !important 加到每条声明
    var boosted = code.replace(/([^:{}\n\/][^:{}]*?:[^;{}]+?)\s*(!important)?\s*;/g, function(m, decl, already) {

      return already ? m : decl.trimRight() + ' !important;';
    });
    if (!/;\s*$/.test(boosted.trim())) boosted = boosted.trimRight() + ' !important;';
    var tag = document.createElement('style');
    tag.id = 'cr-hs-custom-inject';
    tag.textContent = sel + ' { ' + boosted + ' }';
    document.head.appendChild(tag);
  }

  /* ── 应用全部并保存 ── */
  window.crHsApply = function () {
    crHsPreview();  // 确保预览同步
    var code = (document.getElementById('crHsCssCode').value || '').trim();
    var sel  = (document.getElementById('crHsCssSel').value || '').trim() || '.cr-header';
    if (code) crHsInjectCustomCss(sel, code);

    // 存入 localStorage（供下次打开回填）
    var s = {
      bg:        document.getElementById('crHsCBg').value,
      nameColor: document.getElementById('crHsCName').value,
      sub:       document.getElementById('crHsCSub').value,
      avBg:      document.getElementById('crHsCAvBg').value,
      dot:       document.getElementById('crHsCDot').value,
      stat:      document.getElementById('crHsCStat').value,
      av:        +document.getElementById('crHsRAv').value,
      nm:        +document.getElementById('crHsRNm').value,
      pd:        +document.getElementById('crHsRPd').value,
      sb:        +document.getElementById('crHsRSb').value,
      customSel:  sel,
      customCode: code,
      ts: Date.now()
    };
    try { localStorage.setItem('luna_header_style', JSON.stringify(s)); } catch(e){}

    // 按钮反馈
    var btn = document.getElementById('crHsApplyBtn');
    btn.textContent = '✓ 已保存';
    btn.style.background = '#3a7a3a';
    setTimeout(function() { btn.textContent = '✓ 应用'; btn.style.background = '#1a1a1a'; }, 1800);
  };

  /* ── 导出 CSS ── */
  window.crHsExportCSS = function () {
    var bg  = document.getElementById('crHsCBg').value;
    var nm  = document.getElementById('crHsCName').value;
    var sub = document.getElementById('crHsCSub').value;
    var av  = document.getElementById('crHsRAv').value;
    var nmSz= document.getElementById('crHsRNm').value;
    var pd  = document.getElementById('crHsRPd').value;
    var sb  = document.getElementById('crHsRSb').value;
    var dot = document.getElementById('crHsCDot').value;
    var avBg= document.getElementById('crHsCAvBg').value;
    var stat= document.getElementById('crHsCStat').value;
    var css =
      '.cr-header { background: ' + bg + '; }\n' +

      '.cr-name { font-size: ' + nmSz + 'px; color: ' + nm + '; }\n' +

      '.cr-sub { font-size: ' + sb + 'px; color: ' + sub + '; }\n' +

      '.cr-avatar { width: ' + av + 'px; height: ' + av + 'px; background: ' + avBg + '; }\n' +

      '.cr-online-dot { background: ' + dot + '; }\n' +

      '.cr-stat-val { color: ' + stat + '; }\n' +

      '.cr-header-main { padding-top: ' + pd + 'px; padding-bottom: ' + (pd-2) + 'px; }';
    try {
      navigator.clipboard.writeText(css).then(function() { alert('CSS 已复制到剪贴板'); });
    } catch(e) { prompt('复制以下 CSS：', css); }
  };

  /* ── 重置 ── */
  window.crHsReset = function () {
    document.getElementById('crHsCBg').value   = '#ffffff';
    document.getElementById('crHsCName').value = '#1a1a1a';
    document.getElementById('crHsCSub').value  = '#aaaaaa';
    document.getElementById('crHsCAvBg').value = '#efefef';
    document.getElementById('crHsCDot').value  = '#5a5a5a';
    document.getElementById('crHsCStat').value = '#1a1a1a';
    document.getElementById('crHsRAv').value   = 64;
    document.getElementById('crHsRNm').value   = 22;
    document.getElementById('crHsRPd').value   = 16;
    document.getElementById('crHsRSb').value   = 12;
    crHsPreview();
    // 清除自定义 CSS
    crHsClearCss();
    // 清除所有内联样式
    var header = document.querySelector('.cr-header');
    if (header) header.style.removeProperty('background');
    var nameEl = document.querySelector('.cr-name');
    if (nameEl) { nameEl.style.removeProperty('color'); nameEl.style.removeProperty('font-size'); }
    var subEl = document.querySelector('.cr-sub');
    if (subEl) { subEl.style.removeProperty('color'); subEl.style.removeProperty('font-size'); }
    try { localStorage.removeItem('luna_header_style'); } catch(e){}
  };

  /* ── 读已保存样式回填表单 ── */
  function crHsLoadSaved() {
    try {
      var currentChar = localStorage.getItem('luna_current_chat') || '';
      var charKey = currentChar ? 'luna_header_style_char_' + currentChar : '';
      var raw = (charKey && localStorage.getItem(charKey)) || localStorage.getItem('luna_header_style');
      if (!raw) return;
      var s = JSON.parse(raw);
      if (s.bg)        document.getElementById('crHsCBg').value   = s.bg;
      if (s.nameColor) document.getElementById('crHsCName').value = s.nameColor;
      if (s.sub)       document.getElementById('crHsCSub').value  = s.sub;
      if (s.avBg)      document.getElementById('crHsCAvBg').value = s.avBg;
      if (s.dot)       document.getElementById('crHsCDot').value  = s.dot;
      if (s.stat)      document.getElementById('crHsCStat').value = s.stat;
      if (s.av)        document.getElementById('crHsRAv').value   = s.av;
      if (s.nm)        document.getElementById('crHsRNm').value   = s.nm;
      if (s.pd)        document.getElementById('crHsRPd').value   = s.pd;
      if (s.sb)        document.getElementById('crHsRSb').value   = s.sb;
      if (s.customSel)  document.getElementById('crHsCssSel').value  = s.customSel;
      if (s.customCode) document.getElementById('crHsCssCode').value = s.customCode;
    } catch(e){}
  }

  /* ── 页面加载时自动应用上次保存的样式 ── */
  function crHsAutoApply() {
    try {
      var currentChar = localStorage.getItem('luna_current_chat') || '';
      var charKey = currentChar ? 'luna_header_style_char_' + currentChar : '';
      var raw = (charKey && localStorage.getItem(charKey)) || localStorage.getItem('luna_header_style');
      if (!raw) return;
      var s = JSON.parse(raw);

      var header = document.querySelector('.cr-header');
      if (header && s.bg) header.style.setProperty('background', s.bg, 'important');

      var nameEl = document.querySelector('.cr-name');
      if (nameEl) {
        if (s.nameColor) nameEl.style.setProperty('color', s.nameColor, 'important');
        if (s.nm)        nameEl.style.setProperty('font-size', s.nm + 'px', 'important');
      }
      var subEl = document.querySelector('.cr-sub');
      if (subEl) {
        if (s.sub) subEl.style.setProperty('color', s.sub, 'important');
        if (s.sb)  subEl.style.setProperty('font-size', s.sb + 'px', 'important');
      }
      var avatarEl = document.querySelector('.cr-avatar');
      if (avatarEl && s.av) {
        avatarEl.style.setProperty('width',  s.av + 'px', 'important');
        avatarEl.style.setProperty('height', s.av + 'px', 'important');
        var hasImg = avatarEl.style.backgroundImage && avatarEl.style.backgroundImage !== 'none';
        if (!hasImg && s.avBg) avatarEl.style.setProperty('background', s.avBg, 'important');
      }
      var dotEl = document.querySelector('.cr-online-dot');
      if (dotEl && s.dot) dotEl.style.setProperty('background', s.dot, 'important');
      var statusDot = document.querySelector('.cr-status-dot');
      if (statusDot && s.dot) statusDot.style.setProperty('background', s.dot, 'important');
      document.querySelectorAll('.cr-stat-val').forEach(function(el) { if (s.stat) el.style.setProperty('color', s.stat, 'important'); });
      var mainEl = document.querySelector('.cr-header-main');
      if (mainEl && s.pd) {
        mainEl.style.setProperty('padding-top',    s.pd + 'px', 'important');
        mainEl.style.setProperty('padding-bottom', (s.pd - 2) + 'px', 'important');
      }
      if (s.customCode) {
        var sel = (s.customSel || '').trim() || '.cr-header';
        var boosted = s.customCode.replace(/([^:{}\n\/][^:{}]*?:[^;{}]+?)\s*(!important)?\s*;/g, function(m, decl, already) {

          return already ? m : decl.trimRight() + ' !important;';
        });
        if (!/;\s*$/.test(boosted.trim())) boosted = boosted.trimRight() + ' !important;';
        var tag = document.createElement('style');
        tag.id = 'cr-hs-custom-inject';
        tag.textContent = sel + ' { ' + boosted + ' }';
        document.head.appendChild(tag);
      }
    } catch(e){}
  }

  // DOM 就绪后自动应用
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crHsAutoApply);
  } else {
    crHsAutoApply();
  }

})();
/* ================================================================
   输入美化样式应用 — crApplyInputStyle
   读取 luna_input_style，实时渲染到 .cr-input-area 及子元素
================================================================ */
(function () {
  function crApplyInputStyle() {
    try {
      var currentChar = (function() {
        try { return new URLSearchParams(window.location.search).get('char') || localStorage.getItem('luna_current_chat') || ''; } catch(e) { return ''; }
      })();
      var charKey = currentChar ? 'luna_input_style_char_' + currentChar : '';
      var raw = (charKey && localStorage.getItem(charKey))
        ? localStorage.getItem(charKey)
        : localStorage.getItem('luna_input_style');
      if (!raw) return;
      var s;
      try { s = JSON.parse(raw); } catch(e) { return; }
      if (!s) return;

      /* ── 输入区底色 ── */
      var areaEl = document.querySelector('.cr-input-area');
      if (areaEl) {
        if (s.areaBg) areaEl.style.background = s.areaBg;
        if (s.pb) areaEl.style.paddingBottom = s.pb + 'px';
      }

      /* ── 输入框 ── */
      var boxEl = document.querySelector('.cr-input-box');
      if (boxEl) {
        if (s.inputBg) boxEl.style.background = s.inputBg;
        if (s.boxH)    boxEl.style.minHeight  = s.boxH + 'px';
        if (s.boxFs)   boxEl.style.fontSize   = s.boxFs + 'px';
        if (s.placeholder) {
          var phTag = document.getElementById('cr-input-placeholder-style');
          if (!phTag) {
            phTag = document.createElement('style');
            phTag.id = 'cr-input-placeholder-style';
            document.head.appendChild(phTag);
          }
          phTag.textContent = '.cr-input-box:empty::before { color: ' + s.placeholder + ' !important; }';
        }
        if (s.toggleBlur) boxEl.style.backdropFilter = s.toggleBlur ? 'blur(8px)' : '';
      }

      /* ── 加号按钮 ── */
      var addBtn = document.querySelector('.cr-add-btn');
      if (addBtn) {
        if (s.addBtn)   addBtn.style.background   = s.addBtn;
        if (s.btnSize)  { addBtn.style.width = s.btnSize + 'px'; addBtn.style.height = s.btnSize + 'px'; }
        if (s.radius !== undefined) addBtn.style.borderRadius = s.radius + 'px';
        if (s.imgAdd) {
          var existImg = addBtn.querySelector('img.cr-custom-img');
          if (!existImg) { existImg = document.createElement('img'); existImg.className = 'cr-custom-img'; existImg.style.cssText = 'width:65%;height:65%;object-fit:contain;'; addBtn.appendChild(existImg); }
          existImg.src = s.imgAdd;
          addBtn.querySelectorAll('svg').forEach(function(el){ el.style.display = 'none'; });
        } else {
          addBtn.querySelectorAll('svg').forEach(function(el){ el.style.display = ''; });
          var oImg = addBtn.querySelector('img.cr-custom-img');
          if (oImg) oImg.remove();
        }
      }

      /* ── AI 按钮 ── */
      var aiBtn = document.querySelector('.cr-ai-btn');
      if (aiBtn) {
        if (s.aiBg)    aiBtn.style.background   = s.aiBg;
        if (s.btnSize) { aiBtn.style.width = s.btnSize + 'px'; aiBtn.style.height = s.btnSize + 'px'; }
        if (s.radius !== undefined) aiBtn.style.borderRadius = s.radius + 'px';
        if (s.imgAi) {
          var existImgAi = aiBtn.querySelector('img.cr-custom-img');
          if (!existImgAi) { existImgAi = document.createElement('img'); existImgAi.className = 'cr-custom-img'; existImgAi.style.cssText = 'width:65%;height:65%;object-fit:contain;'; aiBtn.appendChild(existImgAi); }
          existImgAi.src = s.imgAi;
          aiBtn.querySelectorAll('svg').forEach(function(el){ el.style.display = 'none'; });
        } else {
          aiBtn.querySelectorAll('svg').forEach(function(el){ el.style.display = ''; });
          var oImgAi = aiBtn.querySelector('img.cr-custom-img');
          if (oImgAi) oImgAi.remove();
        }
      }

      /* ── 发送按钮 ── */
      var sendBtn = document.querySelector('.cr-send-btn');
      if (sendBtn) {
        if (s.sendBg)  sendBtn.style.background   = s.sendBg;
        if (s.btnSize) { sendBtn.style.width = s.btnSize + 'px'; sendBtn.style.height = s.btnSize + 'px'; }
        if (s.radius !== undefined) sendBtn.style.borderRadius = s.radius + 'px';
        if (s.imgSend) {
          var existImgSend = sendBtn.querySelector('img.cr-custom-img');
          if (!existImgSend) { existImgSend = document.createElement('img'); existImgSend.className = 'cr-custom-img'; existImgSend.style.cssText = 'width:65%;height:65%;object-fit:contain;'; sendBtn.appendChild(existImgSend); }
          existImgSend.src = s.imgSend;
          sendBtn.querySelectorAll('svg').forEach(function(el){ el.style.display = 'none'; });
        } else {
          sendBtn.querySelectorAll('svg').forEach(function(el){ el.style.display = ''; });
          var oImgSend = sendBtn.querySelector('img.cr-custom-img');
          if (oImgSend) oImgSend.remove();
        }
      }

      /* ── 装饰分割线 ── */
      var divider = document.querySelector('.cr-const-div');
      if (divider && s.toggleDivider !== undefined) {
        divider.style.display = s.toggleDivider ? '' : 'none';
      }

      /* ── 加号红点 ── */
      var addDot = document.querySelector('.cr-add-dot');
      if (addDot && s.toggleAddDot !== undefined) {
        addDot.style.display = s.toggleAddDot ? '' : 'none';
      }

      /* ── 自定义 CSS 注入 ── */
      var oldTag = document.getElementById('cr-input-custom-inject');
      if (oldTag) oldTag.remove();
      if (s.customCode) {
        var tag = document.createElement('style');
        tag.id = 'cr-input-custom-inject';
        tag.textContent = s.customCode;
        document.head.appendChild(tag);
      }

      /* 输入样式变化后确保发送 & AI 按钮事件仍然绑定 */
      if (typeof crBindSendAiButtons === 'function') crBindSendAiButtons();

      /* 刷新输入框的 data-placeholder（CR_NAME 可能已更新） */
      var phBox = document.getElementById('crInputBox');
      if (phBox) {
        var phText = '向 ' + (typeof CR_NAME !== 'undefined' ? CR_NAME : 'Luna') + ' 发送消息';
        phBox.setAttribute('data-placeholder', phText);
      }
    } catch(err) {
      console.warn('[crApplyInputStyle] 解析失败', err);
    }
  }

  window.crApplyInputStyle = crApplyInputStyle;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crApplyInputStyle);
  } else {
    crApplyInputStyle();
  }
})();
/* ================================================================
   气泡美化样式应用 — crApplyBubbleStyle
   读取 luna_bubble_style（或角色专属），实时渲染到气泡元素
================================================================ */
(function () {
  function crApplyBubbleStyle() {
    try {
      var currentChar = (function() {
        try { return new URLSearchParams(window.location.search).get('char') || localStorage.getItem('luna_current_chat') || ''; } catch(e) { return ''; }
      })();
      var charKey = currentChar ? 'luna_bubble_style_char_' + currentChar : '';
      var raw = (charKey && localStorage.getItem(charKey))
        ? localStorage.getItem(charKey)
        : localStorage.getItem('luna_bubble_style');
      var blCssEarly = '';
      try { blCssEarly = localStorage.getItem('luna_bubble_css') || ''; } catch(e) {}
      if (!raw && !blCssEarly.trim()) return;
      var s = {};
      if (raw) { try { s = JSON.parse(raw) || {}; } catch(e) { s = {}; } }

      /* ── 注入动态 CSS（气泡颜色 + 尺寸 + 间距）── */
      var oldTag = document.getElementById('cr-bubble-style-inject');
      if (oldTag) oldTag.remove();

      var css = '';

      /* 回复方气泡 */
      if (s.lunaBg || s.lunaTx || s.lunaBd || s.lunaPad || s.lunaFs || s.lunaShape) {
        css += '.cr-luna-bubble {';
        if (s.lunaBg)  css += ' background:' + s.lunaBg + ';';
        if (s.lunaTx)  css += ' color:' + s.lunaTx + ';';
        if (s.lunaBd)  css += ' border-color:' + s.lunaBd + ';';
        if (s.lunaPad !== undefined) css += ' padding:' + s.lunaPad + 'px ' + (s.lunaPad + 3) + 'px;';
        if (s.lunaFs  !== undefined) css += ' font-size:' + s.lunaFs + 'px;';
        if (s.lunaShape) css += ' border-radius:' + s.lunaShape + ';';
        css += ' }';
      }

      /* 发送方气泡 */
      if (s.mineBg || s.mineTx || s.mineBd || s.minePad || s.mineFs || s.mineShape) {
        css += '.cr-mine-bubble {';
        if (s.mineBg)  css += ' background:' + s.mineBg + ';';
        if (s.mineTx)  css += ' color:' + s.mineTx + ';';
        if (s.mineBd)  css += ' border-color:' + s.mineBd + ';';
        if (s.minePad !== undefined) css += ' padding:' + s.minePad + 'px ' + (s.minePad + 3) + 'px;';
        if (s.mineFs  !== undefined) css += ' font-size:' + s.mineFs + 'px;';
        if (s.mineShape) css += ' border-radius:' + s.mineShape + ';';
        css += ' }';
      }

      /* 最大宽度 */
      if (s.lunaW !== undefined) {
        css += '.cr-msg-luna { max-width:' + s.lunaW + '%; }';
      }
      if (s.mineW !== undefined) {
        css += '.cr-msg-mine { max-width:' + s.mineW + '%; }';
      }

      /* 气泡间距 */
      if (s.gap !== undefined || s.gapPx !== undefined) {
        css += '.cr-messages-outer {';
        if (s.gap   !== undefined) css += ' gap:' + s.gap + 'px;';
        if (s.gapPx !== undefined) css += ' padding-left:' + s.gapPx + 'px; padding-right:' + s.gapPx + 'px;';
        css += ' }';
      }

      /* 时间戳颜色 */
      if (s.mineTm) {
        css += '.cr-mine-time, .cr-read-lbl { color:' + s.mineTm + '; }';
      }

      /* 头像大小 */
      if (s.lunaAvSize !== undefined) {
        css += '.cr-mini-av { width:' + s.lunaAvSize + 'px !important; height:' + s.lunaAvSize + 'px !important; min-width:' + s.lunaAvSize + 'px !important; overflow:hidden; border-radius:50%; }';
        css += '.cr-mini-av img { width:100% !important; height:100% !important; object-fit:cover !important; }';
      }
      if (s.mineAvSize !== undefined) {
        css += '.cr-mine-av { width:' + s.mineAvSize + 'px !important; height:' + s.mineAvSize + 'px !important; min-width:' + s.mineAvSize + 'px !important; overflow:hidden; border-radius:50%; }';
        css += '.cr-mine-av img { width:100% !important; height:100% !important; object-fit:cover !important; }';
      }

      /* 侧边强调线 */
      if (s.lunaAc) {
        css += '.cr-luna-accent { background:' + s.lunaAc + '; }';
      }

      /* 侧边强调线显示/隐藏 */
      if (s.lunaAccent === false) {
        css += '.cr-luna-accent { display:none !important; }';
      }

      /* 回复方头像显示/隐藏 */
      if (s.lunaAvShow === false) {
        css += '.cr-msg-luna .cr-mini-av { display:none !important; }';
      }

      /* 发送方头像显示/隐藏 */
      if (s.mineAvShow === false) {
        css += '.cr-msg-mine .cr-mine-av { display:none !important; }';
      } else if (s.mineAvShow === true) {
        css += '.cr-msg-mine .cr-mine-av { display:block !important; }';
      }

      /* 已读标记 */
      if (s.mineRead === false) {
        css += '.cr-read-lbl { display:none !important; }';
      }

      /* 时间戳 */
      if (s.lunaTimeShow === false) {
        css += '.cr-msg-luna .cr-msg-time { visibility:hidden; }';
      }
      if (s.mineTimeShow === false) {
        css += '.cr-msg-mine .cr-mine-time { visibility:hidden; }';
      }

      /* 自定义 CSS */
      if (s.customCode) css += '\n' + s.customCode;

      /* 双语翻译气泡自定义 CSS（chatsetting 双语设置页保存） */
      try {
        var blCss = localStorage.getItem('luna_bubble_css');
        if (blCss && blCss.trim()) css += '\n' + blCss;
      } catch(e) {}

      if (css) {
        var tag = document.createElement('style');
        tag.id = 'cr-bubble-style-inject';
        tag.textContent = css;
        document.head.appendChild(tag);
      }

      /* 样式注入后刷新用户头像（确保新尺寸下图片不变形） */
      if (typeof crRefreshMineAvatars === 'function') crRefreshMineAvatars();

      /* 气泡样式变化后确保发送 & AI 按钮事件仍然绑定 */
      if (typeof crBindSendAiButtons === 'function') crBindSendAiButtons();

    } catch(err) {
      console.warn('[crApplyBubbleStyle] 解析失败', err);
    }
  }

  window.crApplyBubbleStyle = crApplyBubbleStyle;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', crApplyBubbleStyle);
  } else {
    crApplyBubbleStyle();
  }
})();