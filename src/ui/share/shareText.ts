/**
 * The daily share block. A pure function: it takes the day's result and returns
 * the exact text, with no DOM and no share APIs, so the format (and above all
 * its spoiler safety) can be proven by unit tests alone. The share action is a
 * thin wrapper around this.
 */

/** Everything the share block is built from. */
export interface DailyShareResult {
  /**
   * The app display name. Read from the single-source constant by the caller,
   * never hardcoded here, so the pending rename flows through for free.
   */
  readonly title: string;
  /** The puzzle's date, shown short so the group compares the same rack. */
  readonly date: Date;
  /** Set words found (the "X" of "X of Y"). */
  readonly setFound: number;
  /** Total set words (the "Y" of "X of Y"). */
  readonly setTotal: number;
  /** Off-page finds on each rung; a rung at zero is omitted from the block. */
  readonly uncommon: number;
  readonly rare: number;
  readonly mythic: number;
  /** Points from the set, and points from off-page finds. The score's split. */
  readonly setPoints: number;
  readonly offPagePoints: number;
  /** The single summary number. */
  readonly totalPoints: number;
  /**
   * The day's source word and every found word. The builder never reads these.
   * They ride on the input so the spoiler-safety test can prove the output
   * leaks neither, guarding against a careless future edit that interpolates a
   * word into the block.
   */
  readonly sourceWord: string;
  readonly foundWords: readonly string[];
}

const SET_SQUARE = '🟥';
const OFF_PAGE_SQUARE = '🟪';
/** Fixed width, the way Wordle's grid is fixed. The whole row reads at a glance. */
const SCORE_ROW_WIDTH = 10;

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** Short calendar date, "Jun 18", from the date's local components. */
function shortDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/**
 * The score-composition row, the purple bar rendered into squares. Always the
 * fixed width, split by points: red for the set's share, purple for off-page.
 * Round to nearest, but a real haul must never round away to nothing, so a
 * non-zero off-page total guarantees at least one purple square, and likewise a
 * non-zero set total at least one red.
 */
function scoreRow(setPoints: number, offPagePoints: number): string {
  const total = setPoints + offPagePoints;
  let purple =
    total === 0 ? 0 : Math.round((offPagePoints / total) * SCORE_ROW_WIDTH);
  if (offPagePoints > 0 && purple === 0) purple = 1;
  if (setPoints > 0 && purple === SCORE_ROW_WIDTH) purple = SCORE_ROW_WIDTH - 1;
  const red = SCORE_ROW_WIDTH - purple;
  return SET_SQUARE.repeat(red) + OFF_PAGE_SQUARE.repeat(purple);
}

/**
 * The rarity line, naming the off-page rungs with at least one find. Returns
 * null when there are no off-page finds at all, so the caller drops the line.
 */
function rarityLine(
  uncommon: number,
  rare: number,
  mythic: number,
): string | null {
  const parts: string[] = [];
  if (uncommon > 0) parts.push(`${uncommon} Uncommon`);
  if (rare > 0) parts.push(`${rare} Rare`);
  if (mythic > 0) parts.push(`${mythic} Mythic`);
  if (parts.length === 0) return null;
  return `✦ ${parts.join(' · ')}`;
}

/** Build the exact, spoiler-free share block for a day's result. */
export function buildShareText(result: DailyShareResult): string {
  const check = result.setFound === result.setTotal ? ' ✓' : '';
  const lines = [
    `${result.title} · ${shortDate(result.date)}`,
    `Set ${result.setFound}/${result.setTotal}${check}`,
    scoreRow(result.setPoints, result.offPagePoints),
  ];
  const rarity = rarityLine(result.uncommon, result.rare, result.mythic);
  if (rarity !== null) lines.push(rarity);
  lines.push(`${result.totalPoints} pts`);
  return lines.join('\n');
}
