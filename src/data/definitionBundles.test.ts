import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The definitions re-bake (Phase 1 follow-on) recomputed the formable union
// under the ENABLE union SCOWL 95 boundary, so words newly valid after the swap
// now carry a gloss in the per-puzzle bundles they belong to. These read the
// committed assets to prove the new glosses actually reached the racks.

function bundle(sourceWord: string): Record<string, string> {
  return JSON.parse(
    readFileSync(`public/data/defs/${sourceWord}.json`, 'utf8'),
  ) as Record<string, string>;
}

describe('re-baked definition bundles', () => {
  it('carries a newly-valid word in the rack that can spell it', () => {
    // podcast is a patch-layer modern word, blank before the re-bake. postcard
    // can spell it, so its bundle now carries podcast with a real gloss.
    const gloss = bundle('postcard').podcast;
    expect(gloss).toBeDefined();
    expect((gloss ?? '').length).toBeGreaterThan(0);
  });

  it('still carries the ordinary words it always did', () => {
    // A spot-check that the re-bake grew the bundle rather than replacing it.
    const postcard = bundle('postcard');
    expect(postcard.card).toBeDefined();
    expect(postcard.coast).toBeDefined();
  });

  it('omits genuinely absent words rather than carrying blank glosses', () => {
    // Words with no usable Wiktionary gloss are left out of the bundle entirely,
    // so the lookup returns null and the UI shows its no-definition state. No
    // entry ever has an empty value that would render as a broken card.
    const ancestor = bundle('ancestor');
    for (const gloss of Object.values(ancestor)) {
      expect(typeof gloss).toBe('string');
      expect(gloss.length).toBeGreaterThan(0);
    }
  });
});
