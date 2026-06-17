import type { TierStanding } from '@/engine/index.ts';

interface Props {
  tier: TierStanding;
  totalScore: number;
}

export function TierMeter({ tier, totalScore }: Props) {
  const pct = Math.round(tier.fraction * 100);
  return (
    <section className="tier" aria-label="Completion">
      <div className="tier__head">
        <span className={'tier__label' + (tier.isTop ? ' is-top' : '')}>
          {tier.label}
        </span>
        <span className="tier__score">
          {totalScore} {totalScore === 1 ? 'point' : 'points'}
          {tier.bonusPoints > 0 ? ` (${tier.bonusPoints} bonus)` : ''}
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
          className={'tier__fill' + (tier.isTop ? ' is-top' : '')}
          style={{ width: `${Math.max(pct, tier.fraction > 0 ? 3 : 0)}%` }}
        />
      </div>
      <div className="tier__ticks" aria-hidden="true">
        <span>{pct}%</span>
        {tier.next ? (
          <span className="tier__next">
            Next: {tier.next.label} at {Math.round(tier.next.threshold * 100)}%
            {tier.next.threshold >= 0.85 ? ', with the source word' : ''}
          </span>
        ) : (
          <span className="tier__next">The top. You found the word.</span>
        )}
      </div>
    </section>
  );
}
