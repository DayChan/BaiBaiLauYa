// ============================================================
// Deity view controller（Web 专属）
// —— 唯一职责：根据业务状态切换 #deity-container 的 data-state
// —— core/ 层的对话逻辑调用 setDeityState('talking') 即可驱动动画
// ============================================================

const STATES = new Set(['idle', 'talking', 'laughing', 'angry']);

let container = null;

export function mountDeity(el) {
  container = el ?? document.getElementById('deity-container');
  if (!container) throw new Error('deity container not found');
  setDeityState('idle');
  return container;
}

export function setDeityState(state) {
  if (!container) return;
  if (!STATES.has(state)) state = 'idle';
  container.dataset.state = state;
}

// 便捷：说一句话后自动回 idle
export function talkFor(ms = 1500) {
  setDeityState('talking');
  setTimeout(() => setDeityState('idle'), ms);
}
