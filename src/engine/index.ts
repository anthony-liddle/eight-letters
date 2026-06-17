/** Public surface of the pure engine. Framework-free, fully unit-tested. */
export * from './types.ts';
export * from './config.ts';
export { scoreWord, totalScore } from './scoring.ts';
export { canForm, formableFrom, letterCounts } from './formability.ts';
export { createPuzzle } from './puzzle.ts';
export { validateGuess, normalizeGuess } from './validate.ts';
export { computeTier } from './tiers.ts';
export { dayIndex, dailySourceWord } from './daily.ts';
