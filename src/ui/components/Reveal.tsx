import { useEffect, useRef } from 'react';
import type { SourceEntry } from '@/data/types.ts';

interface Props {
  word: string;
  entry: SourceEntry | undefined;
  onClose: () => void;
}

export function Reveal({ word, entry, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<Element | null>(null);

  useEffect(() => {
    restoreRef.current = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (restoreRef.current instanceof HTMLElement) restoreRef.current.focus();
    };
  }, [onClose]);

  return (
    <div
      className="reveal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="reveal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reveal-word"
      >
        <p className="reveal__kicker">The word the type was cut for</p>
        <h2 className="reveal__word" id="reveal-word">
          {word}
        </h2>
        <div className="reveal__sep" />

        {entry?.definition && (
          <div className="reveal__section">
            <p className="reveal__h">Definition</p>
            <p className="reveal__def">{entry.definition}</p>
          </div>
        )}
        {entry?.etymology && (
          <div className="reveal__section">
            <p className="reveal__h">Etymology</p>
            <p className="reveal__ety">{entry.etymology}</p>
          </div>
        )}

        <button ref={closeRef} className="reveal__close" onClick={onClose}>
          Back to the case
        </button>
        <p className="reveal__attribution">
          Definition and etymology from Wiktionary, CC BY-SA 4.0.
        </p>
      </div>
    </div>
  );
}
