// ============================================================
// core/api-client.js — 与"本爷"对话的抽象客户端（平台无关）
// ⚠️ 禁止依赖 DOM / window / fetch
//
// 依赖注入一个 transport 对象，由具体平台实现：
//   transport.streamChat(payload, { signal }) => AsyncIterable<Event>
// 其中 Event 是 { type: 'delta', text } | { type: 'done', stopReason } | { type: 'error', message }
// ============================================================

/**
 * @typedef {{ type: 'delta', text: string }
 *          | { type: 'done', stopReason?: string }
 *          | { type: 'error', message: string }} StreamEvent
 *
 * @typedef {{
 *   streamChat: (
 *     payload: {
 *       messages: {role:'user'|'assistant', content:string}[],
 *       wishMode?: boolean,
 *       wishText?: string,
 *       jiaobeiResult?: 'sheng'|'xiao'|'yin',
 *     },
 *     opts?: { signal?: AbortSignal }
 *   ) => AsyncIterable<StreamEvent>
 * }} Transport
 */

export class ApiClient {
  /** @param {Transport} transport */
  constructor(transport) {
    if (!transport || typeof transport.streamChat !== 'function') {
      throw new Error('ApiClient: transport.streamChat 必须是 async iterable 函数');
    }
    this.transport = transport;
  }

  /**
   * 发起一次流式对话。
   * @param {{
   *   messages: {role:'user'|'assistant', content:string}[],
   *   wishMode?: boolean,
   *   wishText?: string,
   *   jiaobeiResult?: 'sheng'|'xiao'|'yin',
   * }} payload
   * @param {{
   *   onDelta?: (text:string)=>void,
   *   onDone?: (stopReason?:string)=>void,
   *   onError?: (message:string)=>void,
   *   signal?: AbortSignal,
   * }} [handlers]
   * @returns {Promise<{ text: string, stopReason?: string }>} 累积全文
   */
  async chatStream(payload, handlers = {}) {
    const { onDelta, onDone, onError, signal } = handlers;
    let text = '';
    let stopReason;
    try {
      for await (const ev of this.transport.streamChat(payload, { signal })) {
        if (ev.type === 'delta') {
          text += ev.text;
          onDelta?.(ev.text);
        } else if (ev.type === 'done') {
          stopReason = ev.stopReason;
          onDone?.(stopReason);
        } else if (ev.type === 'error') {
          onError?.(ev.message);
          throw new Error(ev.message);
        }
      }
      return { text, stopReason };
    } catch (err) {
      if (err?.name === 'AbortError') {
        onDone?.('aborted');
        return { text, stopReason: 'aborted' };
      }
      throw err;
    }
  }
}
