// Ways through the start menu and the library, in one place (the specs only say which level they want).

/** Open a series of the library from the start menu. kind: 'first' | 'stories' | 'code'; id e.g. 'campaign', 'course-1'. */
export async function openSeries(page, kind, id) {
  await page.getByTestId('menu-kind-' + kind).click();
  await page.getByTestId('series-' + id).click();
}

/** Start a level of the open series (the one button of its row). */
export const playLevel = (page, id) => page.getByTestId('level-play-' + id).click();

/** Start the tutorial from the start menu. */
export async function startTutorial(page) {
  await openSeries(page, 'first', 'first-steps');
  await playLevel(page, 'tutorial');
}

/** Open the world editor ("Werkstatt"). */
export const openWorkshop = (page) => page.getByTestId('menu-workshop').click();

/** Open the free play screen. */
export const openFreePlay = (page) => page.getByTestId('menu-free').click();
