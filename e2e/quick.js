// Quick access (castle, idle, all, squads): always visible on desktop, on mobile in the map panel
// that the map button at the bottom right unfolds.

/** Open the map panel if the quick access is hidden (mobile). */
export async function openQuick(page) {
  if (!(await page.getByTestId('quick-hq').isVisible())) await page.getByTestId('minimap-toggle').click();
}

/** Trigger a quick access ('hq' | 'idle' | 'all' | 'army'). */
export async function quick(page, k) {
  await openQuick(page);
  await page.getByTestId('quick-' + k).click();
}
