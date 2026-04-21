// ============================================================
// App 状态机总控（分步接入）
// 已接入：deity 动画、jiaobei 抛掷、chat 抽屉
// 待接入：core/chat-state、core/persona、fetch-transport（对话 LLM）
// ============================================================
import { mountDeity, setDeityState, talkFor } from './deity-view.js';
import { mountJiaobei, throwJiaobei, dismissJiaobei } from './jiaobei-view.js';
import {
  mountChat,
  setMode,
  expandDrawer,
  collapseDrawer,
  appendUser,
  appendSystem,
  openDeityStream,
} from './chat-view.js';

import { RESULT_LABEL, RESULT_MEANING } from '/core/jiaobei.js';

// ---- 占位"假老爷"：尚未接 LLM，先用本地字符串 stub ----
// 第 7、8、9 步会把它替换为流式 API 调用
async function fakeDeityReply({ userText, wishResult } = {}) {
  const stream = openDeityStream();
  setDeityState('talking');

  const base = wishResult
    ? `汝许此愿："${userText}"。本爷为汝掷杯——${RESULT_LABEL[wishResult]}，${RESULT_MEANING[wishResult]}。且待真言入主之时，本爷再赐详解。`
    : `汝问："${userText}"。此乃占位回应，真言待本爷接入大模型之后再说。`;

  // 模拟打字机：逐字节吐
  for (const ch of base) {
    await new Promise((r) => setTimeout(r, 28));
    stream.append(ch);
  }
  stream.done();
  setDeityState('idle');
}

async function handleWish(wishText) {
  appendUser(`【许愿】${wishText}`);
  appendSystem('摔圣杯中……');
  const result = await throwJiaobei();
  // 短停顿让用户看清结果横幅
  await new Promise((r) => setTimeout(r, 1200));
  dismissJiaobei();
  await fakeDeityReply({ userText: wishText, wishResult: result });
}

async function handleChat(text) {
  appendUser(text);
  await fakeDeityReply({ userText: text });
}

document.addEventListener('DOMContentLoaded', () => {
  mountDeity();
  mountJiaobei();
  mountChat(null, {
    onSend: handleChat,
    onWish: handleWish,
  });

  // 点击老爷：如果抽屉关着就打开，否则切来让老爷吐一下气
  const deity = document.getElementById('deity-container');
  deity?.addEventListener('click', () => {
    const drawer = document.getElementById('chat-drawer');
    if (drawer.classList.contains('collapsed')) {
      expandDrawer();
    } else {
      talkFor(800);
    }
  });

  console.log('🛕 老爷已驾到');
});

// 调试挂出
window.__app = { setDeityState, throwJiaobei, expandDrawer, collapseDrawer, setMode };
