// ============================================================
// App 状态机总控（分步接入）
// 当前已接入：deity 动画、jiaobei 抛掷
// ============================================================
import { mountDeity, setDeityState, talkFor } from './deity-view.js';
import { mountJiaobei, throwJiaobei, dismissJiaobei } from './jiaobei-view.js';

document.addEventListener('DOMContentLoaded', () => {
  mountDeity();
  mountJiaobei();

  // 临时测试：点击老爷 = 说话 1.5s；长按老爷 = 摔一次圣杯
  const deity = document.getElementById('deity-container');

  let pressTimer = null;
  const clearPress = () => { clearTimeout(pressTimer); pressTimer = null; };

  deity?.addEventListener('pointerdown', () => {
    pressTimer = setTimeout(async () => {
      pressTimer = 'fired';
      const result = await throwJiaobei();
      console.log('[jiaobei]', result);
      setDeityState('talking');
      setTimeout(() => {
        setDeityState('idle');
        dismissJiaobei();
      }, 2600);
    }, 450);
  });
  deity?.addEventListener('pointerup', () => {
    if (pressTimer && pressTimer !== 'fired') talkFor(1500);
    clearPress();
  });
  deity?.addEventListener('pointerleave', clearPress);
  deity?.addEventListener('pointercancel', clearPress);

  console.log('🛕 老爷已驾到（点击→说话；长按→摔圣杯）');
});

// 调试：暴露到 window
window.__deity = { setDeityState, talkFor };
window.__jiaobei = { throwJiaobei, dismissJiaobei };
