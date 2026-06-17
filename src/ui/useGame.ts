import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import {
  computeTier,
  createPuzzle,
  dailySourceWord,
  dayIndex,
  normalizeGuess,
  STREAK_TIER_INDEX,
  validateGuess,
  type GuessResult,
  type Puzzle,
  type TierStanding,
} from '@/engine/index.ts';
import type { GameData } from '@/data/gameData.ts';
import type { SourceEntry } from '@/data/types.ts';
import type { AudioEngine } from '@/audio/AudioEngine.ts';
import { GameStorage } from '@/persistence/storage.ts';

export type Mode = 'daily' | 'endless';

export interface Tile {
  readonly id: number;
  readonly letter: string;
}

export interface Message {
  readonly text: string;
  readonly tone: 'info' | 'success' | 'error';
}

interface Announcement {
  readonly text: string;
  /** Bumped each time so screen readers re-announce identical text. */
  readonly seq: number;
}

/**
 * One mode's game. Daily and Endless each hold their own slice, so switching
 * modes is a view change and never disturbs the other.
 */
interface Slice {
  puzzle: Puzzle;
  sourceEntry: SourceEntry | undefined;
  /** Calendar day for the daily; null for endless. */
  dayIndex: number | null;
  tiles: Tile[];
  rackOrder: number[];
  composing: number[];
  found: string[];
  foundSet: Set<string>;
  tier: TierStanding;
  totalScore: number;
  sourceRevealed: boolean;
  revealOpen: boolean;
  /** The one-time Edition Complete card is showing. Transient, never persisted. */
  editionOpen: boolean;
  message: Message | null;
  announcement: Announcement;
}

interface SlicePayload {
  puzzle: Puzzle;
  sourceEntry: SourceEntry | undefined;
  dayIndex: number | null;
  restoreFound: string[];
}

interface Game {
  mode: Mode;
  daily: Slice;
  /** Null until Endless is first entered, then persists until New Puzzle. */
  endless: Slice | null;
}

/** The flattened view the UI reads: the active slice plus the current mode. */
export type GameView = Slice & { mode: Mode };

type Action =
  | { type: 'SET_MODE'; mode: Mode }
  | { type: 'SET_ENDLESS'; slice: Slice }
  | { type: 'ADD_TILE'; id: number }
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'REMOVE_LAST' }
  | { type: 'CLEAR' }
  | { type: 'SHUFFLE' }
  | { type: 'SUBMIT_RESULT'; result: GuessResult }
  | { type: 'OPEN_REVEAL' }
  | { type: 'CLOSE_REVEAL' }
  | { type: 'CLOSE_EDITION' };

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function tilesFor(puzzle: Puzzle): Tile[] {
  return [...puzzle.letters].map((letter, id) => ({ id, letter }));
}

function totalOf(tier: TierStanding): number {
  return tier.commonPoints + tier.bonusPoints;
}

function buildSlice(payload: SlicePayload): Slice {
  const tiles = tilesFor(payload.puzzle);
  const found = payload.restoreFound.filter((w) =>
    payload.puzzle.validationWords.has(w),
  );
  const tier = computeTier(new Set(found), payload.puzzle);
  return {
    puzzle: payload.puzzle,
    sourceEntry: payload.sourceEntry,
    dayIndex: payload.dayIndex,
    tiles,
    rackOrder: shuffled(tiles.map((t) => t.id)),
    composing: [],
    found,
    foundSet: new Set(found),
    tier,
    totalScore: totalOf(tier),
    sourceRevealed: found.includes(payload.puzzle.sourceWord),
    revealOpen: false,
    // Rehydrated games never reopen the card; it fires only on the live moment.
    editionOpen: false,
    message: null,
    announcement: { text: '', seq: 0 },
  };
}

function letterOf(slice: Slice, id: number): string {
  return slice.tiles[id]?.letter ?? '';
}

function bump(prev: Announcement, text: string): Announcement {
  return { text, seq: prev.seq + 1 };
}

function messageForRejection(
  result: Exclude<GuessResult, { kind: 'valid' }>,
): string {
  switch (result.kind) {
    case 'too-short':
      return 'Too short. Words need three letters or more.';
    case 'not-a-word':
      return 'Not in the word list. Try another.';
    case 'already-found':
      return 'Already found. Keep going.';
  }
}

/** Gameplay actions, applied to whichever slice is active. */
function reduceSlice(slice: Slice, action: Action): Slice {
  switch (action.type) {
    case 'ADD_TILE':
      if (slice.composing.includes(action.id)) return slice;
      return { ...slice, composing: [...slice.composing, action.id] };

    case 'ADD_LETTER': {
      const id = slice.rackOrder.find(
        (tileId) =>
          letterOf(slice, tileId) === action.letter &&
          !slice.composing.includes(tileId),
      );
      if (id === undefined) return slice;
      return { ...slice, composing: [...slice.composing, id] };
    }

    case 'REMOVE_LAST':
      return { ...slice, composing: slice.composing.slice(0, -1) };

    case 'CLEAR':
      return { ...slice, composing: [] };

    case 'SHUFFLE':
      return { ...slice, rackOrder: shuffled(slice.rackOrder) };

    case 'SUBMIT_RESULT': {
      const { result } = action;
      if (result.kind !== 'valid') {
        const text = messageForRejection(result);
        return {
          ...slice,
          composing: [],
          message: { text, tone: 'error' },
          announcement: bump(slice.announcement, text),
        };
      }

      const found = [...slice.found, result.word];
      const foundSet = new Set(found);
      const tier = computeTier(foundSet, slice.puzzle);
      const justRevealed = result.isSourceWord && !slice.sourceRevealed;
      // The set just reached 100 percent. Non-terminal: play continues.
      const justComplete = slice.tier.fraction < 1 && tier.fraction >= 1;

      const points = `${result.score} ${result.score === 1 ? 'point' : 'points'}`;
      const kindNote = result.isRare
        ? ', rare find'
        : result.isCommon
          ? ''
          : ', bonus';
      const base = result.isSourceWord
        ? `Source word found: ${result.word}.`
        : `${result.word}, ${points}${kindNote}.`;
      const announceText = justComplete
        ? `${base} Edition complete. Every word in the set found.`
        : base + (tier.index > slice.tier.index ? ` ${tier.label}.` : '');

      const messageText = result.isSourceWord
        ? 'You found the source word.'
        : result.isRare
          ? `${result.word}, a rare find.`
          : `${result.word}, ${result.isCommon ? 'in the set' : 'bonus'}.`;

      return {
        ...slice,
        composing: [],
        found,
        foundSet,
        tier,
        totalScore: totalOf(tier),
        sourceRevealed: slice.sourceRevealed || result.isSourceWord,
        revealOpen: justRevealed ? true : slice.revealOpen,
        editionOpen: justComplete ? true : slice.editionOpen,
        message: { text: messageText, tone: 'success' },
        announcement: bump(slice.announcement, announceText),
      };
    }

    case 'OPEN_REVEAL':
      return { ...slice, revealOpen: true };

    case 'CLOSE_REVEAL':
      return { ...slice, revealOpen: false };

    case 'CLOSE_EDITION':
      return { ...slice, editionOpen: false };

    default:
      return slice;
  }
}

function reduce(game: Game, action: Action): Game {
  switch (action.type) {
    // The toggle is a view change only: it never regenerates either puzzle.
    case 'SET_MODE':
      return game.mode === action.mode ? game : { ...game, mode: action.mode };

    // First entry into Endless, and New Puzzle, both replace only this slice.
    case 'SET_ENDLESS':
      return { ...game, endless: action.slice };

    default: {
      if (game.mode === 'endless') {
        if (!game.endless) return game;
        const next = reduceSlice(game.endless, action);
        return next === game.endless ? game : { ...game, endless: next };
      }
      const next = reduceSlice(game.daily, action);
      return next === game.daily ? game : { ...game, daily: next };
    }
  }
}

export interface GameApi {
  state: GameView;
  composedWord: string;
  addTile: (id: number) => void;
  addLetter: (letter: string) => void;
  removeLast: () => void;
  clear: () => void;
  shuffle: () => void;
  submit: () => void;
  setMode: (mode: Mode) => void;
  newEndless: () => void;
  openReveal: () => void;
  closeReveal: () => void;
  closeEdition: () => void;
  toggleMute: () => void;
  muted: boolean;
  streak: number;
}

export function useGame(
  data: GameData,
  audio: AudioEngine,
  storage: GameStorage = new GameStorage(),
): GameApi {
  const makeDailyPayload = useCallback((): SlicePayload => {
    const today = new Date();
    const idx = dayIndex(today);
    const word = dailySourceWord(data.sourceWords, today);
    return {
      puzzle: createPuzzle(
        word,
        data.dictionary,
        data.commonPool,
        data.rarePool,
      ),
      sourceEntry: data.sourceEntry(word),
      dayIndex: idx,
      restoreFound: storage.loadDayProgress(idx, word),
    };
  }, [data, storage]);

  const endlessPayload = useCallback(
    (word: string, restoreFound: string[]): SlicePayload => ({
      puzzle: createPuzzle(
        word,
        data.dictionary,
        data.commonPool,
        data.rarePool,
      ),
      sourceEntry: data.sourceEntry(word),
      dayIndex: null,
      restoreFound,
    }),
    [data],
  );

  const freshEndlessSlice = useCallback((): Slice => {
    const word =
      data.sourceWords[Math.floor(Math.random() * data.sourceWords.length)]!;
    return buildSlice(endlessPayload(word, []));
  }, [data, endlessPayload]);

  const [game, dispatch] = useReducer(reduce, undefined, (): Game => {
    const stored = storage.loadEndless();
    // Only rehydrate a stored word the data still knows, so the reveal works.
    const endless =
      stored && data.sourceEntry(stored.sourceWord)
        ? buildSlice(endlessPayload(stored.sourceWord, stored.found))
        : null;
    return { mode: 'daily', daily: buildSlice(makeDailyPayload()), endless };
  });

  const active =
    game.mode === 'endless' && game.endless ? game.endless : game.daily;

  const view = useMemo<GameView>(
    () => ({ mode: game.mode, ...active }),
    [game.mode, active],
  );

  const composedWord = useMemo(
    () => active.composing.map((id) => active.tiles[id]?.letter ?? '').join(''),
    [active.composing, active.tiles],
  );

  // Persist daily progress whenever the daily found list changes.
  useEffect(() => {
    const d = game.daily;
    if (d.dayIndex !== null) {
      storage.saveDayProgress(d.dayIndex, d.puzzle.sourceWord, d.found);
    }
  }, [game.daily, storage]);

  // Persist the endless game (identity plus progress) whenever it changes.
  useEffect(() => {
    const e = game.endless;
    if (e) storage.saveEndless(e.puzzle.sourceWord, e.found);
  }, [game.endless, storage]);

  // Record the streak once the daily reaches the streak tier.
  const streakRecorded = useRef(false);
  useEffect(() => {
    const d = game.daily;
    if (
      d.dayIndex !== null &&
      d.tier.index >= STREAK_TIER_INDEX &&
      !streakRecorded.current
    ) {
      streakRecorded.current = true;
      storage.recordDailyCleared(d.dayIndex);
    }
  }, [game.daily, storage]);

  const submit = useCallback(() => {
    const word = normalizeGuess(composedWord);
    const result = validateGuess(word, active.puzzle, active.foundSet);
    dispatch({ type: 'SUBMIT_RESULT', result });
    if (result.kind !== 'valid') {
      audio.playInvalid();
      return;
    }
    // Did this find complete the set? If so, the grander cue takes over.
    const wasComplete = active.tier.commonPoints >= active.puzzle.commonTotal;
    const nowComplete =
      active.tier.commonPoints + (result.isCommon ? result.score : 0) >=
      active.puzzle.commonTotal;
    if (!wasComplete && nowComplete) audio.playEdition();
    else if (result.isSourceWord) audio.playSource();
    else audio.playFound(result.word.length);
  }, [composedWord, active.puzzle, active.tier, active.foundSet, audio]);

  const setMode = useCallback(
    (mode: Mode) => {
      // Generate Endless on first entry only; never regenerate on a switch.
      if (mode === 'endless' && game.endless === null) {
        dispatch({ type: 'SET_ENDLESS', slice: freshEndlessSlice() });
      }
      dispatch({ type: 'SET_MODE', mode });
    },
    [game.endless, freshEndlessSlice],
  );

  const newEndless = useCallback(() => {
    dispatch({ type: 'SET_ENDLESS', slice: freshEndlessSlice() });
  }, [freshEndlessSlice]);

  const [muted, setMuted] = useState(audio.muted);
  const toggleMute = useCallback(() => {
    const next = !audio.muted;
    audio.setMuted(next);
    setMuted(next);
  }, [audio]);

  const addTile = useCallback(
    (id: number) => {
      dispatch({ type: 'ADD_TILE', id });
      audio.tick();
    },
    [audio],
  );

  const addLetter = useCallback(
    (letter: string) => {
      dispatch({ type: 'ADD_LETTER', letter });
      audio.tick();
    },
    [audio],
  );

  return {
    state: view,
    composedWord,
    addTile,
    addLetter,
    removeLast: useCallback(() => dispatch({ type: 'REMOVE_LAST' }), []),
    clear: useCallback(() => dispatch({ type: 'CLEAR' }), []),
    shuffle: useCallback(() => dispatch({ type: 'SHUFFLE' }), []),
    submit,
    setMode,
    newEndless,
    openReveal: useCallback(() => dispatch({ type: 'OPEN_REVEAL' }), []),
    closeReveal: useCallback(() => dispatch({ type: 'CLOSE_REVEAL' }), []),
    closeEdition: useCallback(() => dispatch({ type: 'CLOSE_EDITION' }), []),
    toggleMute,
    muted,
    streak: storage.currentStreak(game.daily.dayIndex ?? 0),
  };
}
