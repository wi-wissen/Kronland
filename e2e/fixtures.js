// Shared test fixtures: every spec imports `test` and `expect` from here instead of '@playwright/test'.
import { test as base, expect } from '@playwright/test';

/**
 * `page` with the mouse parked in the middle of the viewport before the test starts. Playwright's mouse starts at
 * (0, 0), inside the game's edge-scroll strip (src/game/edgeScroll.js): any pointermove the browser sends there on
 * its own (Chromium's synthetic moves after layout changes or scrolling) pans the camera towards the top left, even
 * while paused, until the test moves the mouse itself. The position survives navigations. Touch devices (mobile
 * project) are left alone: they have no edge scrolling, and a mouse event would only add a hover there.
 */
export const test = base.extend({
  page: async ({ page, hasTouch }, use) => {
    const v = page.viewportSize();
    if (!hasTouch && v) await page.mouse.move(Math.floor(v.width / 2), Math.floor(v.height / 2));
    await use(page);
  },
});

export { expect };
