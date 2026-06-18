import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { Confetti } from './Confetti.tsx';
import {
  CONFETTI_DURATION_MS,
  CONFETTI_MAX_PARTICLES,
  createParticles,
} from './confetti.ts';

describe('createParticles', () => {
  it('makes a bounded, non-empty set of particles', () => {
    const particles = createParticles(800, 600);
    expect(particles.length).toBeGreaterThan(0);
    expect(particles.length).toBeLessThanOrEqual(CONFETTI_MAX_PARTICLES);
  });
});

describe('Confetti', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an overlay that never intercepts taps', () => {
    const { container } = render(<Confetti onDone={() => {}} />);
    const canvas = container.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas!.style.pointerEvents).toBe('none');
  });

  it('finishes once after the burst duration and cancels its frame', () => {
    const onDone = vi.fn();
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    const { unmount } = render(<Confetti onDone={onDone} />);

    act(() => {
      vi.advanceTimersByTime(CONFETTI_DURATION_MS);
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    // Unmounting (what the parent does on done) tears the loop down cleanly.
    unmount();
    expect(cancel).toHaveBeenCalled();
    cancel.mockRestore();
  });
});
