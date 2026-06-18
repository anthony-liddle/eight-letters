import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameData } from '@/data/gameData.ts';
import type { AudioEngine } from '@/audio/AudioEngine.ts';
import { GameStorage } from '@/persistence/storage.ts';
import { useGame, type GameApi } from './useGame.ts';
import { useTheme, type Theme } from './useTheme.ts';
import { TierMeter } from './components/TierMeter.tsx';
import { FoundList } from './components/FoundList.tsx';
import { Reveal } from './components/Reveal.tsx';
import { EditionCard } from './components/EditionCard.tsx';
import { Confetti } from './components/Confetti.tsx';
import { Decorations } from './components/Decorations.tsx';

/** Honour the OS reduced-motion setting. Confetti is pure motion, so suppress it. */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface Props {
  data: GameData;
  audio: AudioEngine;
  storage: GameStorage;
}

export function Game({ data, audio, storage }: Props) {
  const game = useGame(data, audio, storage);
  useGlobalKeys(game);

  const { state } = game;
  const [theme] = useTheme();

  // Fire the cute confetti once, on the completion beat. The pulse increments
  // only on the completing submit, so a mode switch or a reload of an already
  // complete puzzle never re-fires. Cute only; suppressed under reduced motion.
  const [confettiOn, setConfettiOn] = useState(false);
  const lastPulse = useRef(game.editionPulse);
  useEffect(() => {
    if (game.editionPulse === lastPulse.current) return;
    lastPulse.current = game.editionPulse;
    if (theme === 'cute' && !prefersReducedMotion()) setConfettiOn(true);
  }, [game.editionPulse, theme]);
  const endConfetti = useCallback(() => setConfettiOn(false), []);

  return (
    <div className="app">
      <Decorations celebrate={state.editionOpen} />
      <Masthead />
      {!storage.persistent && (
        <p className="storage-note">
          This browser is not saving progress. Your words will be lost when you
          leave or reload.
        </p>
      )}
      <Toolbar game={game} />

      <div className="board">
        <div className="play">
          <ComposingStick game={game} />
          <TypeCase game={game} />
          <Controls game={game} />
          <p
            className="message"
            data-tone={state.message?.tone ?? 'info'}
            aria-hidden="true"
          >
            {state.message?.text ?? ' '}
          </p>
          <TierMeter tier={state.tier} totalScore={state.totalScore} />
        </div>

        <FoundList
          puzzle={state.puzzle}
          found={state.found}
          totalScore={state.totalScore}
        />
      </div>

      <Colophon />

      {/* Screen-reader announcements: found words, tier changes, the crown. */}
      <div className="visually-hidden" role="status" aria-live="polite">
        {state.announcement.text}
      </div>

      {state.editionOpen && <EditionCard onClose={game.closeEdition} />}

      {confettiOn && <Confetti onDone={endConfetti} />}

      {state.revealOpen && (
        <Reveal
          word={state.puzzle.sourceWord}
          entry={state.sourceEntry}
          onClose={game.closeReveal}
        />
      )}
    </div>
  );
}

function Masthead() {
  return (
    <header className="masthead">
      <p className="masthead__kicker">A game for finding the long word</p>
      <h1 className="masthead__title">
        8 Letters in Search of a <em>Word</em>
      </h1>
      <p className="masthead__rule">Set the type</p>
    </header>
  );
}

function Toolbar({ game }: { game: GameApi }) {
  const { state } = game;
  const [theme, setTheme] = useTheme();
  return (
    <div className="toolbar">
      <div className="modes" role="group" aria-label="Mode">
        <button
          aria-pressed={state.mode === 'daily'}
          onClick={() => game.setMode('daily')}
        >
          Daily
        </button>
        <button
          aria-pressed={state.mode === 'endless'}
          onClick={() => game.setMode('endless')}
        >
          Endless
        </button>
      </div>

      <div className="toolbar__right">
        {/* Wide screens: the segmented pair. Narrow screens: a single swap
            button (CSS swaps which one shows), so the labels never clip. */}
        <div className="modes theme-seg" role="group" aria-label="Theme">
          <button
            aria-pressed={theme === 'letterpress'}
            onClick={() => setTheme('letterpress')}
          >
            Classic
          </button>
          <button
            aria-pressed={theme === 'cute'}
            onClick={() => setTheme('cute')}
          >
            Cute
          </button>
        </div>
        <ThemeSwap theme={theme} setTheme={setTheme} />
        {state.mode === 'daily' ? (
          <span className="chip" title="Days cleared in a row">
            Streak <strong>{game.streak}</strong>
          </span>
        ) : (
          <button className="btn btn--header" onClick={game.newEndless}>
            New puzzle
          </button>
        )}
        {state.sourceRevealed && (
          <button
            className="iconbtn iconbtn--crown"
            onClick={game.openReveal}
            aria-label="Show the source word reveal"
            title="The source word"
          >
            ✦
          </button>
        )}
        <button
          className="iconbtn iconbtn--accent"
          aria-pressed={game.muted}
          onClick={game.toggleMute}
          aria-label={game.muted ? 'Unmute sound' : 'Mute sound'}
          title={game.muted ? 'Sound off' : 'Sound on'}
        >
          {game.muted ? '◌' : '♪'}
        </button>
      </div>
    </div>
  );
}

/**
 * The compact theme control for narrow screens. It shows the current theme (to
 * match the Daily/Endless pair above it) with a swap glyph that signals it is
 * tap-to-change, and toggles to the other theme. The accessible name states the
 * action since the visible label only shows the current state.
 */
function ThemeSwap({
  theme,
  setTheme,
}: {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}) {
  const isCute = theme === 'cute';
  const currentName = isCute ? 'Cute' : 'Classic';
  const nextName = isCute ? 'Classic' : 'Cute';
  return (
    <button
      type="button"
      className="theme-swap"
      onClick={() => setTheme(isCute ? 'letterpress' : 'cute')}
      aria-label={`Theme: ${currentName}. Activate to switch to ${nextName}.`}
    >
      <span className="theme-swap__glyph" aria-hidden="true">
        ◐
      </span>
      <span className="theme-swap__name">{currentName}</span>
      <span className="theme-swap__cycle" aria-hidden="true">
        ⇄
      </span>
    </button>
  );
}

function ComposingStick({ game }: { game: GameApi }) {
  const { state, composedWord } = game;
  return (
    <div className="stick" data-tone={state.message?.tone ?? 'info'}>
      {composedWord.length === 0 ? (
        <span className="stick__empty">Set letters to make a word</span>
      ) : (
        [...composedWord].map((letter, i) => (
          <span className="stick__slot" key={i}>
            {letter}
          </span>
        ))
      )}
    </div>
  );
}

function TypeCase({ game }: { game: GameApi }) {
  const { state } = game;
  return (
    <div className="case" role="group" aria-label="Letter tiles">
      {state.rackOrder.map((id) => {
        const tile = state.tiles[id]!;
        const used = state.composing.includes(id);
        return (
          <button
            key={id}
            className="sort"
            disabled={used}
            onClick={() => game.addTile(id)}
            aria-label={`Letter ${tile.letter}${used ? ', already set' : ''}`}
          >
            {tile.letter}
          </button>
        );
      })}
    </div>
  );
}

function Controls({ game }: { game: GameApi }) {
  const { composedWord } = game;
  const empty = composedWord.length === 0;
  return (
    <div className="controls">
      <button className="btn" onClick={game.shuffle}>
        Shuffle
      </button>
      <button className="btn" onClick={game.clear} disabled={empty}>
        Clear
      </button>
      <button
        className="btn btn--primary"
        onClick={game.submit}
        disabled={composedWord.length < 3}
      >
        Set word
      </button>
      <button
        className="btn btn--icon"
        onClick={game.removeLast}
        disabled={empty}
        aria-label="Delete last letter"
      >
        ⌫
      </button>
    </div>
  );
}

function Colophon() {
  const [theme] = useTheme();
  const fonts =
    theme === 'cute' ? 'Fredoka and Nunito' : 'Fraunces and Spectral';
  return (
    <footer className="colophon">
      Validation by ENABLE, public domain. Common words from SCOWL. Definitions
      and etymologies from Wiktionary, CC BY-SA 4.0.
      <br />
      Set in {fonts}.
    </footer>
  );
}

/** Full keyboard play: type letters, Enter to set, Backspace to delete. */
function useGlobalKeys(game: GameApi) {
  const ref = useRef(game);
  ref.current = game;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = ref.current;
      if (g.state.revealOpen) return; // the dialog owns the keyboard
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        g.submit();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        g.removeLast();
      } else if (e.key === 'Escape') {
        g.clear();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        g.addLetter(e.key.toLowerCase());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
