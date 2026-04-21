// ============================================================
// core/jiaobei.js — 圣杯占卜核心逻辑（平台无关）
//
// ⚠️ 本文件禁止引用 DOM / window / document / fetch
//    —— 保持纯函数式，以便微信小程序 / Cocos 小游戏复用
// ============================================================

/** 三种结果枚举 */
export const JiaobeiResult = Object.freeze({
  SHENG: 'sheng', // 圣杯：一阴一阳 → 老爷同意 / YES
  XIAO:  'xiao',  // 笑杯：双阳     → 老爷在笑 / 模糊
  YIN:   'yin',   // 阴杯：双阴     → 老爷不同意 / NO
});

/** 默认权重（可调） */
export const DEFAULT_WEIGHTS = Object.freeze({
  [JiaobeiResult.SHENG]: 40,
  [JiaobeiResult.XIAO]:  35,
  [JiaobeiResult.YIN]:   25,
});

/**
 * 按权重抽签。
 * @param {object} [weights] 权重对象，键为 JiaobeiResult，值为正数
 * @param {() => number} [rng] 随机源，默认 Math.random
 * @returns {string} JiaobeiResult 之一
 */
export function drawResult(weights = DEFAULT_WEIGHTS, rng = Math.random) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [key, w] of entries) {
    roll -= w;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

/**
 * 把结果映射到两个杯子的朝向（供前端动画使用）。
 * "up" 表示平面朝上（阴），"down" 表示平面朝下（阳）。
 * 圣杯随机从两种合法组合里挑一种，让动画更有变化。
 */
export function faces(result, rng = Math.random) {
  switch (result) {
    case JiaobeiResult.SHENG:
      return rng() < 0.5 ? { left: 'up', right: 'down' } : { left: 'down', right: 'up' };
    case JiaobeiResult.XIAO:
      return { left: 'down', right: 'down' };
    case JiaobeiResult.YIN:
      return { left: 'up', right: 'up' };
    default:
      return { left: 'up', right: 'down' };
  }
}

/** 中文名与显示文案 */
export const RESULT_LABEL = Object.freeze({
  [JiaobeiResult.SHENG]: '圣杯',
  [JiaobeiResult.XIAO]:  '笑杯',
  [JiaobeiResult.YIN]:   '阴杯',
});

export const RESULT_MEANING = Object.freeze({
  [JiaobeiResult.SHENG]: '老爷同意',
  [JiaobeiResult.XIAO]:  '老爷在笑',
  [JiaobeiResult.YIN]:   '老爷不同意',
});
