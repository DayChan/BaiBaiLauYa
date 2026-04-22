import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

import { SYSTEM_PROMPT, buildWishUserMessage } from './public/core/persona.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

const anthropic = new Anthropic();

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  extensions: ['html'],
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  },
}));

app.get('/healthz', (_req, res) => res.json({ ok: true }));

/**
 * POST /api/chat
 * body: {
 *   messages: [{role:'user'|'assistant', content:string}, ...]  // 历史，最后一条可能是空占位
 *   wishMode?: boolean,
 *   wishText?: string,
 *   jiaobeiResult?: 'sheng'|'xiao'|'yin',
 * }
 *
 * 若 wishMode=true，服务端会用 buildWishUserMessage 替换最后一条 user 消息
 * （或直接追加），以保证 LLM 同时拿到愿望原文与摔杯结果。
 *
 * SSE 事件：
 *   event: delta  data: {"text":"..."}
 *   event: done   data: {"stop_reason":"end_turn"}
 *   event: error  data: {"message":"..."}
 */
app.post('/api/chat', async (req, res) => {
  const { messages = [], wishMode = false, wishText, jiaobeiResult } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages 不得为空' });
    return;
  }

  // 许愿模式：把最后一条 user 消息替换成带结果的模板
  const finalMessages = messages.slice();
  if (wishMode && wishText && jiaobeiResult) {
    const wishMsg = { role: 'user', content: buildWishUserMessage(wishText, jiaobeiResult) };
    if (finalMessages.length && finalMessages[finalMessages.length - 1].role === 'user') {
      finalMessages[finalMessages.length - 1] = wishMsg;
    } else {
      finalMessages.push(wishMsg);
    }
  }

  // SSE 头
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // 防 nginx 缓冲
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // 客户端中途断开
  let aborted = false;
  req.on('close', () => { aborted = true; });

  try {
    const stream = anthropic.messages.stream({
      model: 'claude-opus-4-7',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: finalMessages,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
    });

    for await (const event of stream) {
      if (aborted) break;
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        send('delta', { text: event.delta.text });
      }
    }

    if (!aborted) {
      const finalMsg = await stream.finalMessage();
      send('done', { stop_reason: finalMsg.stop_reason ?? 'end_turn' });
    }
    res.end();
  } catch (err) {
    const status = err?.status ?? 500;
    const message = err?.message ?? '本爷今日不言';
    console.error('[/api/chat] error', status, message);
    if (!res.headersSent) {
      res.status(status).json({ error: message });
      return;
    }
    send('error', { message });
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`🛕 老爷神坛已开光 → http://localhost:${PORT}`);
});
