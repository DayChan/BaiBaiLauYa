// ============================================================
// web/fetch-transport.js — ApiClient 的浏览器端实现
// 职责：fetch POST /api/chat，解析 SSE 流，输出标准化 StreamEvent
// ============================================================

const ENDPOINT = '/api/chat';

/**
 * 解析单个 SSE 事件块（形如 `event: delta\ndata: {...}`）。
 * @param {string} block
 * @returns {{ event?: string, data?: string } | null}
 */
function parseSseBlock(block) {
  if (!block) return null;
  let event;
  const dataLines = [];
  for (const line of block.split('\n')) {
    if (!line || line.startsWith(':')) continue; // comment / heartbeat
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

export const fetchTransport = {
  /**
   * @param {object} payload
   * @param {{ signal?: AbortSignal }} [opts]
   */
  async *streamChat(payload, { signal } = {}) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(payload),
      signal,
    });

    if (!res.ok || !res.body) {
      let message = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) message = j.error;
      } catch { /* ignore */ }
      yield { type: 'error', message };
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE 事件以 \n\n 分隔
        let sepIdx;
        while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          const parsed = parseSseBlock(block);
          if (!parsed?.data) continue;

          let payloadObj;
          try { payloadObj = JSON.parse(parsed.data); } catch { continue; }

          if (parsed.event === 'delta' && typeof payloadObj.text === 'string') {
            yield { type: 'delta', text: payloadObj.text };
          } else if (parsed.event === 'done') {
            yield { type: 'done', stopReason: payloadObj.stop_reason };
          } else if (parsed.event === 'error') {
            yield { type: 'error', message: payloadObj.message ?? '未知错误' };
            return;
          }
        }
      }
      // 残余 buffer 一般是空或注释，丢弃
    } finally {
      reader.releaseLock?.();
    }
  },
};
