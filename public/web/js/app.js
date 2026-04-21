// ============================================================
// App 状态机总控（分步接入，当前只挂载角色动画）
// ============================================================
import { mountDeity, setDeityState, talkFor } from './deity-view.js';

document.addEventListener('DOMContentLoaded', () => {
  mountDeity();

  // 临时：点击老爷会说话 1.5s，用于测试 talking 动画
  // 后续步骤会被 app 状态机接管
  const deity = document.getElementById('deity-container');
  deity?.addEventListener('click', () => talkFor(1500));

  console.log('🛕 老爷已驾到');
});

// 调试用：暴露到 window 方便控制台测试四种状态
window.__deity = { setDeityState, talkFor };
