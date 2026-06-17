interface Props {
  onClose: () => void;
}

/**
 * The completion celebration: a sibling to the source-word reveal, but in ink
 * and oxblood rather than amber, and ornamental rather than a definition. It is
 * non-blocking on purpose: no backdrop, no focus trap, so play continues. The
 * screen-reader announcement is carried by the live region in Game.
 */
export function EditionCard({ onClose }: Props) {
  return (
    <div className="edition" role="region" aria-label="Edition complete">
      <p className="edition__ornament" aria-hidden="true">
        ❧
      </p>
      <p className="edition__kicker">The full edition</p>
      <h2 className="edition__title">Edition Complete</h2>
      <p className="edition__line">Every word in the set, set in type.</p>
      <button className="edition__close" onClick={onClose}>
        Keep going
      </button>
    </div>
  );
}
