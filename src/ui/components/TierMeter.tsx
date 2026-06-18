import type { TierStanding } from '@/engine/index.ts';

interface Props {
  tier: TierStanding;
  totalScore: number;
}

export function TierMeter({ tier, totalScore }: Props) {
  const pct = Math.round(tier.fraction * 100);
  // Found the Word keeps the amber crown; Edition Complete is the ink-and-oxblood
  // rung above it (no new colour). Everything else is plain ink.
  const variant =
    tier.id === 'found-the-word'
      ? ' is-crown'
      : tier.id === 'edition-complete'
        ? ' is-edition'
        : '';

  return (
    <section className="tier" aria-label="Completion">
      <div className="tier__head">
        <span className={'tier__label' + variant}>
          {tier.id === 'edition-complete' && (
            <span className="tier__pressmark" aria-hidden="true">
              ❧
            </span>
          )}
          {tier.label}
        </span>
        <span className="tier__score">
          {totalScore} {totalScore === 1 ? 'point' : 'points'}
        </span>
      </div>
      <div
        className="tier__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct} percent of the set, ${tier.label}`}
      >
        <div
          className={'tier__fill' + variant}
          style={{ width: `${Math.max(pct, tier.fraction > 0 ? 3 : 0)}%` }}
        />
      </div>
      <div className="tier__ticks" aria-hidden="true">
        <span>{pct}%</span>
        {tier.next ? (
          <span className="tier__next">
            Next: {tier.next.label} at {Math.round(tier.next.threshold * 100)}%
            {tier.next.id === 'found-the-word' ? ', with the source word' : ''}
          </span>
        ) : (
          <span className="tier__next">Every word in the set.</span>
        )}
      </div>
    </section>
  );
}
