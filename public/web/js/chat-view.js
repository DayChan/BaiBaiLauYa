// ============================================================
// Chat view（Web 专属）
// 职责：
//   - 渲染抽屉 UI、管理 expanded/collapsed 两态
//   - 渲染消息气泡（支持流式增量更新）
//   - 捕获用户输入并通过回调上报给 app.js
// 不做：对话历史、API 调用、人格 prompt —— 那些归 core/
// ============================================================

function el(tag, { className, text, attrs } = {}) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

let drawer = null;
let messagesEl = null;
let inputEl = null;
let sendBtn = null;
let chatBtn = null;
let wishBtn = null;
let inputRow = null;
let callbacks = { onSend: null, onWish: null };
let mode = 'chat'; // 'chat' | 'wish'

/**
 * 挂载聊天抽屉。
 * @param {{ onSend: (text:string)=>void, onWish: (text:string)=>void }} cbs
 */
export function mountChat(root, cbs = {}) {
  drawer = root ?? document.getElementById('chat-drawer');
  if (!drawer) throw new Error('chat drawer not found');
  callbacks = { ...callbacks, ...cbs };

  drawer.textContent = '';

  // 把手区（collapsed 状态唯一可见）
  drawer.appendChild(el('span', { className: 'chat-grip' }));
  const handle = el('div', { className: 'chat-handle' });
  chatBtn = el('button', { className: 'chat-action', text: '请 安', attrs: { type: 'button', 'data-mode': 'chat' } });
  wishBtn = el('button', { className: 'chat-action', text: '许 愿', attrs: { type: 'button', 'data-mode': 'wish' } });
  handle.append(chatBtn, wishBtn);
  drawer.appendChild(handle);

  // 消息列表
  messagesEl = el('div', { className: 'chat-messages' });
  drawer.appendChild(messagesEl);

  // 输入栏
  inputRow = el('div', { className: 'chat-input-row' });
  inputEl = el('input', {
    className: 'chat-input',
    attrs: {
      type: 'text',
      autocomplete: 'off',
      autocorrect: 'off',
      spellcheck: 'false',
      placeholder: '说点什么…',
      maxlength: '200',
      enterkeyhint: 'send',
    },
  });
  sendBtn = el('button', { className: 'chat-send', text: '送', attrs: { type: 'button', disabled: 'disabled' } });
  inputRow.append(inputEl, sendBtn);
  drawer.appendChild(inputRow);

  // 事件
  chatBtn.addEventListener('click', () => setMode('chat', true));
  wishBtn.addEventListener('click', () => setMode('wish', true));

  inputEl.addEventListener('input', () => {
    sendBtn.disabled = inputEl.value.trim().length === 0;
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      triggerSend();
    }
  });
  sendBtn.addEventListener('click', triggerSend);

  // 点击抽屉外部可折叠（TODO：app.js 可控）
  return drawer;
}

function triggerSend() {
  const text = inputEl.value.trim();
  if (!text) return;
  inputEl.value = '';
  sendBtn.disabled = true;
  const cb = mode === 'wish' ? callbacks.onWish : callbacks.onSend;
  cb?.(text);
  // 许愿发出后自动回普通聊天模式
  if (mode === 'wish') setMode('chat', false);
}

/** 切换聊天 / 许愿模式；expand=true 时顺便展开抽屉 */
export function setMode(next, expand) {
  mode = next === 'wish' ? 'wish' : 'chat';
  inputRow.classList.toggle('wish-mode', mode === 'wish');
  inputEl.placeholder = mode === 'wish' ? '输入愿望，老爷替你掷一掷…' : '说点什么…';
  if (expand) expandDrawer();
  inputEl.focus({ preventScroll: true });
}

export function expandDrawer() {
  drawer.classList.remove('collapsed');
  drawer.classList.add('expanded');
}

export function collapseDrawer() {
  drawer.classList.remove('expanded');
  drawer.classList.add('collapsed');
}

// ------------------------------------------------------------
// 消息渲染
// ------------------------------------------------------------

/** 追加一条用户消息 */
export function appendUser(text) {
  const node = el('div', { className: 'chat-msg user', text });
  messagesEl.appendChild(node);
  scrollToBottom();
  return node;
}

/** 追加一条系统提示（如"摔圣杯中…"） */
export function appendSystem(text) {
  const node = el('div', { className: 'chat-msg system', text });
  messagesEl.appendChild(node);
  scrollToBottom();
  return node;
}

/**
 * 开一条老爷的流式消息。
 * 返回一个 handle，调用 .append(chunk) 增量追加，.done() 结束打字机。
 */
export function openDeityStream() {
  const node = el('div', { className: 'chat-msg deity streaming' });
  messagesEl.appendChild(node);
  scrollToBottom();
  return {
    append(chunk) {
      node.textContent += chunk;
      scrollToBottom();
    },
    done() {
      node.classList.remove('streaming');
    },
    el: node,
  };
}

function scrollToBottom() {
  // 使用 rAF 确保在最新 DOM 应用后滚动
  requestAnimationFrame(() => {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  });
}
