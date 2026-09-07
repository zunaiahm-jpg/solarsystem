// Generic score aggregation shared by every mission. Mission-specific
// comparison logic (e.g. "did the student pick the right planet") lives in
// each mission definition's `scoring.evaluate`; this module only combines
// the resulting component scores the same way for every mission, so a
// student's total is computed consistently across the whole framework.

/**
 * @param {{label: string, earned: number, possible: number}[]} components
 * @returns {{earned: number, possible: number, percentage: number, components: object[]}}
 */
export function combineScores(components) {
  const safeComponents = Array.isArray(components) ? components : [];
  const earned = safeComponents.reduce((sum, c) => sum + Math.max(0, Number(c.earned) || 0), 0);
  const possible = safeComponents.reduce((sum, c) => sum + (Number(c.possible) || 0), 0);
  const percentage = possible > 0 ? Math.round((earned / possible) * 100) : 0;
  return { earned, possible, percentage, components: safeComponents };
}
