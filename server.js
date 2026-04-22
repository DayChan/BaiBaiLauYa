import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';

import { SYSTEM_PROMPT } from './public/core/persona.js';

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
 * body: { messages: [{role:'user'|'assistant', content:string}, ...] }
 *
 * SSE 事件：
 *   event: delta  data: {"text":"..."}
 *   event: done   data: {"stop_reason":"end_turn"}
 *   event: error  data: {"message":"..."}
 */
app.post('/api/chat', async (req, res) => {
  const { messages = [] } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'messages 不得为空' });
    return;
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
      messages,
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
