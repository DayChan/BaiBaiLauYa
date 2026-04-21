// ============================================================
// Jiaobei view（Web 专属渲染层）
// —— 调用 core/jiaobei 获取随机结果
// —— 操作 DOM + CSS 变量驱动抛掷动画
// ============================================================
import {
  JiaobeiResult,
  drawResult,
  faces,
  RESULT_LABEL,
  RESULT_MEANING,
} from '/core/jiaobei.js';

let overlay = null;
let leftEl = null;
let rightEl = null;
let resultEl = null;
let resultLabelEl = null;
let resultMeaningEl = null;

function createEl(tag, { className, id } = {}) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (id) el.id = id;
  return el;
}

/** 首次挂载：在 #jiaobei-overlay 里填充结构 */
export function mountJiaobei(el) {
  overlay = el ?? document.getElementById('jiaobei-overlay');
  if (!overlay) throw new Error('jiaobei overlay not found');

  overlay.textContent = ''; // 清空
  overlay.appendChild(createEl('div', { className: 'jiaobei-stage' }));

  leftEl  = createEl('div', { className: 'jiaobei left',  id: 'jiaobei-left' });
  rightEl = createEl('div', { className: 'jiaobei right', id: 'jiaobei-right' });
  overlay.append(leftEl, rightEl);

  resultEl = createEl('div', { id: 'jiaobei-result' });
  resultLabelEl = createEl('span', { className: 'result-label' });
  resultMeaningEl = createEl('span', { className: 'result-meaning' });
  resultEl.append(resultLabelEl, resultMeaningEl);
  overlay.appendChild(resultEl);

  return overlay;
}

/**
 * 执行一次摔圣杯。
 * @returns {Promise<string>} 返回 JiaobeiResult
 */
export function throwJiaobei() {
  if (!overlay) mountJiaobei();
  return new Promise((resolve) => {
    const result = drawResult();
    const orientation = faces(result); // { left: 'up'|'down', right: ... }

    // 重置
    leftEl.className = 'jiaobei left';
    rightEl.className = 'jiaobei right';
    resultEl.className = '';
    resultEl.removeAttribute('data-result');

    // 打开遮罩，强制 reflow 以确保下一帧 class 加上后动画能重新播放
    overlay.classList.remove('hidden');
    void overlay.offsetHeight;

    // 设定最终落地朝向
    leftEl.classList.add(orientation.left === 'up' ? 'face-up' : 'face-down');
    rightEl.classList.add(orientation.right === 'up' ? 'face-up' : 'face-down');

    // 触发抛掷
    requestAnimationFrame(() => {
      leftEl.classList.add('throwing');
      rightEl.classList.add('throwing');
    });

    // 可选：触觉反馈
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([20, 80, 30]);
    }

    // 动画结束后展示结果横幅
    const revealDelay = 1150;
    setTimeout(() => {
      resultEl.dataset.result = result;
      resultLabelEl.textContent = RESULT_LABEL[result];
      resultMeaningEl.textContent = RESULT_MEANING[result];
      resultEl.classList.add('show');
      resolve(result);
    }, revealDelay);
  });
}

/** 关闭圣杯遮罩 */
export function dismissJiaobei() {
  if (!overlay) return;
  overlay.classList.add('hidden');
  resultEl?.classList.remove('show');
}

export const _debug = { JiaobeiResult };
