import { describe, expect, it } from 'vitest';
import { render, within } from '@testing-library/react';
import { TierMeter } from './TierMeter.tsx';
import type { TierStanding } from '@/engine/index.ts';

function standing(over: Partial<TierStanding> = {}): TierStanding {
  return {
    index: 2,
    id: 'tier-2',
    score: 30,
    reachable: 100,
    fraction: 0.3,
    setPoints: 18,
    offPagePoints: 12,
    setFound: 4,
    setTotal: 10,
    next: { index: 3, threshold: 0.4 },
    isTop: false,
    ...over,
  };
}

describe('TierMeter', () => {
  it('shows the themed rank name for the active theme', () => {
    const { rerender, container } = render(
      <TierMeter tier={standing()} theme="letterpress" />,
    );
    expect(container.querySelector('.tier__label')?.textContent).toBe(
      'Galley Proof',
    );
    rerender(<TierMeter tier={standing()} theme="cute" />);
    expect(container.querySelector('.tier__label')?.textContent).toBe(
      'Blossom',
    );
  });

  it('preserves the two-color set-versus-off-page composition', () => {
    const { container } = render(
      <TierMeter tier={standing()} theme="letterpress" />,
    );
    const set = container.querySelector<HTMLElement>('.tier__seg--set');
    const off = container.querySelector<HTMLElement>('.tier__seg--offpage');
    expect(set).not.toBeNull();
    expect(off).not.toBeNull();
    // Each segment grows by its own points, so the fill is two-color by source.
    expect(set!.style.flexGrow).toBe('18');
    expect(off!.style.flexGrow).toBe('12');
  });

  it('reports points progress toward reachable on the progressbar', () => {
    const { container } = render(
      <TierMeter tier={standing()} theme="letterpress" />,
    );
    const bar = container.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('30');
  });

  it('prints the explicit set and off-page point numbers beneath the bar', () => {
    const { container } = render(
      <TierMeter tier={standing()} theme="letterpress" />,
    );
    // The breakdown the glossary bar used to carry now lives on the one bar:
    // the bold total above, the named set-versus-off-page split below.
    const meter = container.querySelector('.tier') as HTMLElement;
    expect(within(meter).getByText(/set\s+18/i)).toBeInTheDocument();
    expect(within(meter).getByText(/off-page\s+12/i)).toBeInTheDocument();
  });

  it('holds the themed completion crown once every common word is found', () => {
    const done = standing({ setFound: 10, setTotal: 10, index: 5 });
    const { container, rerender } = render(
      <TierMeter tier={done} theme="letterpress" />,
    );
    // The label becomes the crown, not the top named rank.
    expect(container.querySelector('.tier__label')?.textContent).toBe(
      'The Complete Works',
    );
    rerender(<TierMeter tier={done} theme="cute" />);
    expect(container.querySelector('.tier__label')?.textContent).toBe(
      'Peachy Keen Supreme',
    );
  });
});
