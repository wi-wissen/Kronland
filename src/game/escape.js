// Escape steps back one level at a time (instead of cancelling placement and clearing the selection at once):
// placing → build view → serf action bar → no selection.

/**
 * @param {{ placing: boolean, serfs: boolean, buildView: boolean, selected: boolean }} s
 *   placing: a building is being placed; serfs: the selection is serfs only (panel shows build view or
 *   action bar); buildView: the build view is shown (setting serfBuildView); selected: anything selected
 * @returns {'cancelPlacement'|'actionBar'|'deselect'|null} what Escape does
 */
export function escapeStep({ placing, serfs, buildView, selected }) {
  if (placing) return 'cancelPlacement';
  if (serfs && buildView) return 'actionBar';
  if (selected) return 'deselect';
  return null;
}
