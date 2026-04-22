// ============================================================
// core/chat-state.js — 对话历史管理（平台无关）
// ⚠️ 禁止依赖 DOM / window / fetch
//
// 内存中保留滚动窗口（默认最近 10 轮）用于发给 LLM。
// 老爷的回复用 append 分段写入，支持流式累积。
// ============================================================

const DEFAULT_MAX_TURNS = 10; // 一"轮" = user + assistant 各一条

export class ChatState {
  /**
   * @param {object} [opts]
   * @param {number} [opts.maxTurns]
   */
  constructor({ maxTurns = DEFAULT_MAX_TURNS } = {}) {
    this.maxTurns = maxTurns;
    /** @type {{role:'user'|'assistant', content:string}[]} */
    this._messages = [];
  }

  /** 追加一条用户消息。 */
  addUser(content) {
    this._messages.push({ role: 'user', content });
    this._trim();
  }

  /** 开启一条空 assistant 消息，返回游标以便流式追加。 */
  openAssistant() {
    const entry = { role: 'assistant', content: '' };
    this._messages.push(entry);
    return {
      append: (chunk) => { entry.content += chunk; },
      commit: () => {
        if (!entry.content) {
          // 从未写入任何内容，丢弃该空消息以免后续请求失败
          const idx = this._messages.lastIndexOf(entry);
          if (idx >= 0) this._messages.splice(idx, 1);
        }
        this._trim();
      },
      cancel: () => {
        const idx = this._messages.lastIndexOf(entry);
        if (idx >= 0) this._messages.splice(idx, 1);
      },
      entry,
    };
  }

  /** 直接写入一条 assistant 完整消息。 */
  addAssistant(content) {
    if (!content) return;
    this._messages.push({ role: 'assistant', content });
    this._trim();
  }

  /** 发送给 LLM 的消息数组（不含 system）。 */
  toMessages() {
    return this._messages.map((m) => ({ role: m.role, content: m.content }));
  }

  /** 当前轮数（向下取整）。 */
  get turns() {
    return Math.floor(this._messages.length / 2);
  }

  clear() {
    this._messages = [];
  }

  // ---- 内部：滚动窗口裁剪 ----
  _trim() {
    const max = this.maxTurns * 2;
    if (this._messages.length <= max) return;
    // 从头丢弃最早的，但保证首条是 user 以避免 API 报错
    while (this._messages.length > max) this._messages.shift();
    while (this._messages.length && this._messages[0].role !== 'user') this._messages.shift();
  }
}
