import { TIERS, type TierStanding } from '@/engine/index.ts';
import type { Theme } from '../useTheme.ts';
import { crownName, tierName } from '../tierNames.ts';

interface Props {
  tier: TierStanding;
  theme: Theme;
}

/**
 * The goal bar, now a points climb toward the rack's reachable score. The fill
 * is two-color by where the points came from (set points in the on-page colour,
 * off-page points in the discovery colour), so the bar Bea loves survives and
 * reads as the climb. The current named rank is the label, theme-skinned.
 */
export function TierMeter({ tier, theme }: Props) {
  // Off-page points can push the score past reachable; the bar fills to full and
  // the named rank caps at the top. The overflow is the climb toward the Stage 2
  // completion peak, which this bar does not measure.
  const pct = Math.min(100, Math.round(tier.fraction * 100));
  // Completion is the word-count peak above the named ladder: every common word
  // found. Once reached, the label quietly holds the themed crown so the
  // achievement stays visible while play continues. It is not a points rank.
  const completed = tier.setTotal > 0 && tier.setFound >= tier.setTotal;
  const label = completed ? crownName(theme) : tierName(theme, tier.index);
  const rest = Math.max(0, tier.reachable - tier.score);

  return (
    <section className="tier" aria-label="Progress">
      <div className="tier__head">
        <span className={'tier__label' + (completed ? ' is-complete' : '')}>
          {label}
        </span>
        <span className="tier__score">
          {tier.score} {tier.score === 1 ? 'point' : 'points'}
        </span>
      </div>
      <div
        className="tier__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={tier.reachable}
        aria-valuenow={Math.min(tier.score, tier.reachable)}
        aria-valuetext={`${pct} percent of reachable points, ${label}`}
      >
        {/* Three flex segments fill the track: on-page set points, off-page
            discovery points, then the transparent remainder. Set plus off-page
            is the score, so the coloured fill is exactly the fraction reached. */}
        <div className="tier__segs">
          <span
            className="tier__seg tier__seg--set"
            style={{ flexGrow: tier.setPoints }}
            aria-hidden="true"
          />
          <span
            className="tier__seg tier__seg--offpage"
            style={{ flexGrow: tier.offPagePoints }}
            aria-hidden="true"
          />
          <span
            className="tier__seg tier__seg--rest"
            style={{ flexGrow: rest }}
            aria-hidden="true"
          />
        </div>
        {/* Threshold markers for the named ranks above the first. */}
        {TIERS.slice(1).map((t) => (
          <span
            key={t.id}
            className="tier__tick"
            style={{ left: `${t.threshold * 100}%` }}
            aria-hidden="true"
          />
        ))}
      </div>
      <div className="tier__ticks" aria-hidden="true">
        <span>{pct}%</span>
        {tier.next ? (
          <span className="tier__next">
            Next: {tierName(theme, tier.next.index)} at{' '}
            {Math.round(tier.next.threshold * 100)}%
          </span>
        ) : (
          <span className="tier__next">
            Top rank. The full set is the peak.
          </span>
        )}
      </div>
      {/* The completion peak, an honest word count over words findable, distinct
          from the points rank above. The one place an "X of Y" belongs. */}
      <p className={'tier__completion' + (completed ? ' is-complete' : '')}>
        {tier.setFound} of {tier.setTotal} words
        {completed ? ', complete' : ''}
      </p>
    </section>
  );
}
