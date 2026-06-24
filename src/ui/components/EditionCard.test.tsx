import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EditionCard } from './EditionCard.tsx';

describe('EditionCard', () => {
  it('shows the themed completion crown, re-skinning per theme', () => {
    const { container, rerender } = render(
      <EditionCard theme="letterpress" onClose={() => {}} />,
    );
    expect(container.querySelector('.edition__title')?.textContent).toBe(
      'The Complete Works',
    );
    rerender(<EditionCard theme="cute" onClose={() => {}} />);
    expect(container.querySelector('.edition__title')?.textContent).toBe(
      'Peachy Keen Supreme',
    );
  });
});
