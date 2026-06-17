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

interface State {
  mode: Mode;
  puzzle: Puzzle;
  sourceEntry: SourceEntry | undefined;
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
  message: Message | null;
  announcement: Announcement;
}

interface NewPuzzlePayload {
  mode: Mode;
  puzzle: Puzzle;
  sourceEntry: SourceEntry | undefined;
  dayIndex: number | null;
  restoreFound: string[];
}

type Action =
  | { type: 'NEW_PUZZLE'; payload: NewPuzzlePayload }
  | { type: 'ADD_TILE'; id: number }
  | { type: 'ADD_LETTER'; letter: string }
  | { type: 'REMOVE_LAST' }
  | { type: 'CLEAR' }
  | { type: 'SHUFFLE' }
  | { type: 'SUBMIT_RESULT'; result: GuessResult }
  | { type: 'OPEN_REVEAL' }
  | { type: 'CLOSE_REVEAL' };

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

/** Replay a set of found words to derive tier and score (used when restoring). */
function standingFor(found: readonly string[], puzzle: Puzzle): TierStanding {
  return computeTier(new Set(found), puzzle);
}

function totalOf(tier: TierStanding): number {
  return tier.commonPoints + tier.bonusPoints;
}

function buildState(payload: NewPuzzlePayload, prev?: State): State {
  const tiles = tilesFor(payload.puzzle);
  const found = payload.restoreFound.filter((w) =>
    payload.puzzle.validationWords.has(w),
  );
  const tier = standingFor(found, payload.puzzle);
  const sourceRevealed = found.includes(payload.puzzle.sourceWord);
  return {
    mode: payload.mode,
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
    sourceRevealed,
    revealOpen: false,
    message: prev?.message ?? null,
    announcement: prev?.announcement ?? { text: '', seq: 0 },
  };
}

function letterOf(state: State, id: number): string {
  return state.tiles[id]?.letter ?? '';
}

function reduce(state: State, action: Action): State {
  switch (action.type) {
    case 'NEW_PUZZLE':
      return buildState(action.payload, state);

    case 'ADD_TILE':
      if (state.composing.includes(action.id)) return state;
      return { ...state, composing: [...state.composing, action.id] };

    case 'ADD_LETTER': {
      // Select the first unused rack tile bearing this letter.
      const id = state.rackOrder.find(
        (tileId) =>
          letterOf(state, tileId) === action.letter &&
          !state.composing.includes(tileId),
      );
      if (id === undefined) return state;
      return { ...state, composing: [...state.composing, id] };
    }

    case 'REMOVE_LAST':
      return { ...state, composing: state.composing.slice(0, -1) };

    case 'CLEAR':
      return { ...state, composing: [] };

    case 'SHUFFLE':
      return { ...state, rackOrder: shuffled(state.rackOrder) };

    case 'SUBMIT_RESULT': {
      const { result } = action;
      if (result.kind !== 'valid') {
        const text = messageForRejection(result);
        return {
          ...state,
          composing: [],
          message: { text, tone: 'error' },
          announcement: bump(state.announcement, text),
        };
      }

      const found = [...state.found, result.word];
      const foundSet = new Set(found);
      const tier = computeTier(foundSet, state.puzzle);
      const justRevealed = result.isSourceWord && !state.sourceRevealed;

      const announceText = result.isSourceWord
        ? `Source word found: ${result.word}. ${tier.label}.`
        : `${result.word}, ${result.score} ${result.score === 1 ? 'point' : 'points'}.` +
          (tier.index > state.tier.index ? ` ${tier.label}.` : '');

      return {
        ...state,
        composing: [],
        found,
        foundSet,
        tier,
        totalScore: totalOf(tier),
        sourceRevealed: state.sourceRevealed || result.isSourceWord,
        revealOpen: justRevealed ? true : state.revealOpen,
        message: {
          text: result.isSourceWord
            ? 'You found the source word.'
            : `${result.word}, ${result.isCommon ? 'in the set' : 'bonus'}.`,
          tone: 'success',
        },
        announcement: bump(state.announcement, announceText),
      };
    }

    case 'OPEN_REVEAL':
      return { ...state, revealOpen: true };

    case 'CLOSE_REVEAL':
      return { ...state, revealOpen: false };

    default:
      return state;
  }
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

export interface GameApi {
  state: State;
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
  toggleMute: () => void;
  muted: boolean;
  streak: number;
}

export function useGame(
  data: GameData,
  audio: AudioEngine,
  storage: GameStorage = new GameStorage(),
): GameApi {
  const makeDaily = useCallback((): NewPuzzlePayload => {
    const today = new Date();
    const idx = dayIndex(today);
    const word = dailySourceWord(data.sourceWords, today);
    const puzzle = createPuzzle(word, data.dictionary, data.commonPool);
    return {
      mode: 'daily',
      puzzle,
      sourceEntry: data.sourceEntry(word),
      dayIndex: idx,
      restoreFound: storage.loadDayProgress(idx, word),
    };
  }, [data, storage]);

  const makeEndless = useCallback((): NewPuzzlePayload => {
    const word =
      data.sourceWords[Math.floor(Math.random() * data.sourceWords.length)]!;
    const puzzle = createPuzzle(word, data.dictionary, data.commonPool);
    return {
      mode: 'endless',
      puzzle,
      sourceEntry: data.sourceEntry(word),
      dayIndex: null,
      restoreFound: [],
    };
  }, [data]);

  const [state, dispatch] = useReducer(reduce, undefined, () =>
    buildState(makeDaily()),
  );

  const composedWord = useMemo(
    () => state.composing.map((id) => state.tiles[id]?.letter ?? '').join(''),
    [state.composing, state.tiles],
  );

  // Persist daily progress whenever the found list changes.
  useEffect(() => {
    if (state.mode === 'daily' && state.dayIndex !== null) {
      storage.saveDayProgress(
        state.dayIndex,
        state.puzzle.sourceWord,
        state.found,
      );
    }
  }, [
    state.found,
    state.mode,
    state.dayIndex,
    state.puzzle.sourceWord,
    storage,
  ]);

  // Record the streak once a daily reaches the streak tier.
  const streakRecorded = useRef(false);
  useEffect(() => {
    if (
      state.mode === 'daily' &&
      state.dayIndex !== null &&
      state.tier.index >= STREAK_TIER_INDEX &&
      !streakRecorded.current
    ) {
      streakRecorded.current = true;
      storage.recordDailyCleared(state.dayIndex);
    }
  }, [state.mode, state.dayIndex, state.tier.index, storage]);

  const submit = useCallback(() => {
    const word = normalizeGuess(composedWord);
    const result = validateGuess(word, state.puzzle, state.foundSet);
    dispatch({ type: 'SUBMIT_RESULT', result });
    if (result.kind === 'valid') {
      if (result.isSourceWord) audio.playSource();
      else audio.playFound(result.word.length);
    } else {
      audio.playInvalid();
    }
  }, [composedWord, state.puzzle, state.foundSet, audio]);

  const setMode = useCallback(
    (mode: Mode) => {
      streakRecorded.current = false;
      dispatch({
        type: 'NEW_PUZZLE',
        payload: mode === 'daily' ? makeDaily() : makeEndless(),
      });
    },
    [makeDaily, makeEndless],
  );

  const newEndless = useCallback(() => {
    dispatch({ type: 'NEW_PUZZLE', payload: makeEndless() });
  }, [makeEndless]);

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
    state,
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
    toggleMute,
    muted,
    streak: state.dayIndex !== null ? storage.currentStreak(state.dayIndex) : 0,
  };
}
