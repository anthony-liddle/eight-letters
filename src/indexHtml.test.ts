import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import { DEFAULT_THEME } from './ui/useTheme.ts';

/**
 * The static document head holds its own copies of the name, separate from the
 * display-name constant, so a rename has to touch them by hand. These assertions
 * pin the new name across every name-bearing tag and prove the retired name is
 * gone from the file entirely. Read from the repo root, where vitest runs.
 */
const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

const NEW_NAME = 'Peach of a Word';
const OLD_NAME = '8 Letters in Search of a Word';

describe('index.html', () => {
  test('the retired name appears nowhere', () => {
    expect(html).not.toContain(OLD_NAME);
    expect(html).not.toContain('8 Letters');
  });

  test('the document title is the new name', () => {
    expect(html).toContain(`<title>${NEW_NAME}</title>`);
  });

  test('the Open Graph title, site name, and description carry the new name', () => {
    expect(html).toContain(
      `<meta property="og:title" content="${NEW_NAME}" />`,
    );
    expect(html).toContain(
      `<meta property="og:site_name" content="${NEW_NAME}" />`,
    );
    expect(html).toMatch(/property="og:description"[\s\S]*?Peach of a Word/);
  });

  test('the Twitter title and description carry the new name', () => {
    expect(html).toContain(
      `<meta name="twitter:title" content="${NEW_NAME}" />`,
    );
    expect(html).toMatch(/name="twitter:description"[\s\S]*?Peach of a Word/);
  });

  test('the meta description carries the new name', () => {
    expect(html).toMatch(/name="description"[\s\S]*?Peach of a Word/);
  });

  test('the OG image alt text describes the new wordmark', () => {
    expect(html).toMatch(/property="og:image:alt"[\s\S]*?Peach of a Word/);
  });
});

describe('index.html theme default', () => {
  test('the pre-paint <html> default agrees with the app default theme', () => {
    // The no-preference visitor never has the inline script touch the attribute,
    // so this baked-in value is what paints first. It must equal the runtime
    // default, or a fresh load flashes one theme then corrects to the other.
    expect(html).toMatch(
      new RegExp(`<html[^>]*\\bdata-theme="${DEFAULT_THEME}"`),
    );
  });

  test('is cute, the theme Bea plays', () => {
    expect(html).toContain('data-theme="cute"');
    expect(html).not.toContain('data-theme="letterpress"');
  });

  test('the pre-paint script still lets a saved preference win', () => {
    // Saved preferences must keep overriding the default, so a letterpress
    // player still lands on letterpress. The script reads the stored key and
    // applies a valid saved value over the baked-in attribute.
    expect(html).toContain("localStorage.getItem('e8-theme')");
    expect(html).toMatch(/dataset\.theme = t/);
  });
});

describe('index.html share image', () => {
  test('references the OG and Twitter image at the same path', () => {
    expect(html).toMatch(/property="og:image" content="[^"]*\/og\.png"/);
    expect(html).toMatch(/name="twitter:image" content="[^"]*\/og\.png"/);
  });

  test('the referenced image resolves on disk and is non-trivial', () => {
    const og = resolve(process.cwd(), 'public/og.png');
    expect(existsSync(og)).toBe(true);
    // A real 1200x630 PNG is many kilobytes; a stub or empty file would not be.
    expect(statSync(og).size).toBeGreaterThan(1000);
  });
});
