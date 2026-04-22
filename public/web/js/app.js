// ============================================================
// App 状态机总控
// 请安：user 输入 → ChatState.addUser → ApiClient.chatStream
//      → openDeityStream 增量写入 → commit
// 许愿：user 输入 → "摔圣杯中…" → throwJiaobei →
//      core/persona.buildWishUserMessage 把结果缝进 user 消息
//      → 老爷流式回应（LLM 历史保留完整上下文）
// ============================================================
import { mountDeity, setDeityState } from './deity-view.js';
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

import { ChatState } from '/core/chat-state.js';
import { ApiClient } from '/core/api-client.js';
import { buildWishUserMessage } from '/core/persona.js';
import { fetchTransport } from './fetch-transport.js';

const chatState = new ChatState({ maxTurns: 10 });
const api = new ApiClient(fetchTransport);

let inflight = null; // AbortController：同时只允许一条本爷回复在吐

/**
 * 向老爷请示一次。wishCtx 非空时走许愿模式。
 * @param {string} displayText UI 气泡中展示的用户原文（许愿时已在外部写过）
 * @param {string} llmText 真正发给 LLM 的 user content（许愿模式下含摔杯结果）
 * @param {boolean} alreadyShown 外部已渲染过 user 气泡则跳过
 */
async function askDeity(displayText, llmText, alreadyShown = false) {
  // 1. UI + 历史：确保一致（史官记的是 LLM 看到的版本）
  if (!alreadyShown) appendUser(displayText);
  chatState.addUser(llmText);

  // 2. 打开流式气泡 + 老爷开口
  const uiStream = openDeityStream();
  const historyCursor = chatState.openAssistant();
  setDeityState('talking');

  // 3. 发请求
  inflight?.abort();
  inflight = new AbortController();

  try {
    await api.chatStream(
      { messages: chatState.toMessages().slice(0, -1) },
      {
        signal: inflight.signal,
        onDelta: (chunk) => {
          uiStream.append(chunk);
          historyCursor.append(chunk);
        },
        onDone: () => {
          uiStream.done();
          historyCursor.commit();
        },
        onError: (msg) => {
          console.error('[askDeity] transport error:', msg);
        },
      },
    );
  } catch (err) {
    console.error('[askDeity]', err);
    uiStream.append('\n（本爷今日失声，稍后再来叩问。）');
    uiStream.done();
    historyCursor.cancel();
    appendSystem('— 连线老爷失败 —');
  } finally {
    setDeityState('idle');
    inflight = null;
  }
}

async function handleWish(wishText) {
  appendUser(`【许愿】${wishText}`);
  appendSystem('摔圣杯中……');
  const result = await throwJiaobei();
  await new Promise((r) => setTimeout(r, 1200));
  dismissJiaobei();
  const llmText = buildWishUserMessage(wishText, result);
  await askDeity(`【许愿】${wishText}`, llmText, /*alreadyShown=*/ true);
}

async function handleChat(text) {
  await askDeity(text, text);
}

document.addEventListener('DOMContentLoaded', () => {
  mountDeity();
  mountJiaobei();
  mountChat(null, {
    onSend: handleChat,
    onWish: handleWish,
  });

  const deity = document.getElementById('deity-container');
  deity?.addEventListener('click', () => {
    const drawer = document.getElementById('chat-drawer');
    if (drawer.classList.contains('collapsed')) {
      expandDrawer();
    }
  });

  console.log('🛕 老爷已驾到');
});

// 调试挂出
window.__app = { setDeityState, throwJiaobei, expandDrawer, collapseDrawer, setMode, chatState };
