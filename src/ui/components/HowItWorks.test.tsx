import { afterEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Game } from '../Game.tsx';
import {
  createListDictionary,
  createListWordSource,
} from '@/data/listSource.ts';
import type { GameData } from '@/data/gameData.ts';
import { NullAudioEngine } from '@/audio/AudioEngine.ts';
import { GameStorage, type KeyValueStore } from '@/persistence/storage.ts';

const ENABLE = ['serenade', 'sea', 'near', 'sane', 'eased'];
const COMMON = ['serenade', 'sea', 'near', 'eased'];

function fakeData(): GameData {
  return {
    dictionary: createListDictionary(ENABLE),
    commonPool: createListWordSource(COMMON),
    beyond70Pool: createListWordSource(['sane']),
    beyond95Pool: createListWordSource([]),
    sourceWords: ['serenade'],
    sourceEntry: () => undefined,
  };
}

function fakeStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

function renderGame() {
  return render(
    <Game
      data={fakeData()}
      audio={new NullAudioEngine()}
      storage={new GameStorage(fakeStore())}
    />,
  );
}

const trigger = () =>
  screen.getByRole('button', { name: /how the words work/i });
const openPopup = () => fireEvent.click(trigger());
const popup = () =>
  screen.queryByRole('dialog', { name: /how the words work/i });

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  localStorage.clear();
});

describe('How the Words Work popup', () => {
  it('renders the trigger in the footer colophon and opens the popup', () => {
    renderGame();
    const footer = screen.getByRole('contentinfo');
    expect(
      within(footer).getByRole('button', { name: /how the words work/i }),
    ).toBeInTheDocument();

    expect(popup()).not.toBeInTheDocument();
    openPopup();
    expect(popup()).toBeInTheDocument();
  });

  it('is a dialog with an accessible name and moves focus to the top of itself on open', () => {
    renderGame();
    openPopup();
    const dialog = popup() as HTMLElement;
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // Focus lands on the dialog container, not an interior control: focusing a
    // button at the foot of a scrollable card would scroll it past the title.
    expect(document.activeElement).toBe(dialog);
  });

  it('closes via the close control and returns focus to the trigger', () => {
    renderGame();
    openPopup();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(popup()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes via the Escape key and returns focus to the trigger', () => {
    renderGame();
    openPopup();
    fireEvent.keyDown(popup() as HTMLElement, { key: 'Escape' });
    expect(popup()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger());
  });

  it('closes via an outside click and returns focus to the trigger', () => {
    renderGame();
    openPopup();
    const backdrop = document.querySelector('.reveal-backdrop') as HTMLElement;
    fireEvent.click(backdrop);
    expect(popup()).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger());
  });

  it('renders the ENABLE source link safely in a new tab', () => {
    renderGame();
    openPopup();
    const link = within(popup() as HTMLElement).getByRole('link', {
      name: 'ENABLE',
    });
    expect(link).toHaveAttribute(
      'href',
      'https://www.bananagrammer.com/2013/12/the-amazing-enable-word-list-project.html',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the SCOWL source link safely in a new tab', () => {
    renderGame();
    openPopup();
    const link = within(popup() as HTMLElement).getByRole('link', {
      name: 'SCOWL',
    });
    expect(link).toHaveAttribute(
      'href',
      'https://wordlist.aspell.net/scowl_v1-readme/',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders the same dialog structure in both themes', () => {
    document.documentElement.dataset.theme = 'letterpress';
    const classic = renderGame();
    openPopup();
    expect(popup()).toBeInTheDocument();
    expect(
      within(popup() as HTMLElement).getByRole('link', { name: 'ENABLE' }),
    ).toBeInTheDocument();
    expect(
      within(popup() as HTMLElement).getByRole('link', { name: 'SCOWL' }),
    ).toBeInTheDocument();
    classic.unmount();

    document.documentElement.dataset.theme = 'cute';
    renderGame();
    openPopup();
    expect(popup()).toBeInTheDocument();
    expect(
      within(popup() as HTMLElement).getByRole('link', { name: 'ENABLE' }),
    ).toBeInTheDocument();
    expect(
      within(popup() as HTMLElement).getByRole('link', { name: 'SCOWL' }),
    ).toBeInTheDocument();
  });

  it('suppresses keyboard play behind the open popup', () => {
    renderGame();
    openPopup();

    // Typing and submitting must not reach the board behind the modal.
    'sea'.split('').forEach((ch) => fireEvent.keyDown(window, { key: ch }));
    fireEvent.keyDown(window, { key: 'Enter' });

    const stick = document.querySelector('.stick') as HTMLElement;
    expect(stick.textContent?.trim()).toBe('Set letters to make a word');
    const glossary = screen.getByRole('region', { name: /words found/i });
    expect(within(glossary).queryByText('sea')).not.toBeInTheDocument();
  });

  it('traps focus within the dialog at both ends', () => {
    renderGame();
    openPopup();
    const dialog = popup() as HTMLElement;
    const focusables = within(dialog).getAllByRole('link') as HTMLElement[];
    const first = focusables[0]!;
    const close = within(dialog).getByRole('button', {
      name: /close/i,
    });

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);

    close.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
  });
});
