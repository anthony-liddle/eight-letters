import { describe, expect, test } from 'vitest';
import { APP_DISPLAY_NAME } from './displayName.ts';

describe('APP_DISPLAY_NAME', () => {
  test('is the new name, Peach of a Word', () => {
    expect(APP_DISPLAY_NAME).toBe('Peach of a Word');
  });

  test('no longer carries the retired working name', () => {
    expect(APP_DISPLAY_NAME).not.toContain('8 Letters');
  });
});
