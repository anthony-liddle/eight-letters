import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

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
