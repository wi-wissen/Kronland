import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Website: article images can be enlarged (blog, manual …) – click/tap or keyboard opens a dialog with caption,
// arrow keys step through the images of the article, Escape closes. Screenshots go to LIGHTBOX_SHOTS (folder) if set.
test.use({ locale: 'de-DE' });

const SHOTS = process.env.LIGHTBOX_SHOTS;

test.beforeEach(async ({ page }, testInfo) => {
  if (testInfo.project.name === 'desktop') await page.setViewportSize({ width: 1440, height: 900 });
});

test('Blog article: enlarge images, step with arrow keys, close with Escape', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  await page.goto('/blog/rendering/');
  const article = page.getByTestId('blog-article');
  const imgs = article.locator('figure:not(.code) > img');
  await expect(imgs).toHaveCount(5);
  const first = imgs.first();
  await expect(first).toHaveAttribute('role', 'button');
  await expect(first).toHaveAttribute('tabindex', '0');
  await expect(first).toHaveAttribute('aria-label', /^Bild vergrößern: /);
  expect(await first.evaluate((el) => getComputedStyle(el).cursor)).toBe('zoom-in');
  // Hover / focus must not move the image
  const before = await first.boundingBox();
  await first.scrollIntoViewIfNeeded();
  const box0 = await first.boundingBox();
  if (testInfo.project.name === 'desktop') await first.hover();
  expect(await first.boundingBox()).toEqual(box0);
  expect(before.width).toBe(box0.width);

  // Click/tap opens the dialog with the caption of the figure
  const caption = (await article.locator('figure:not(.code)').first().locator('figcaption').textContent()).trim();
  await first.click();
  const box = page.getByTestId('lightbox');
  await expect(box).toBeVisible();
  await expect(page.getByTestId('lightbox-caption')).toHaveText(caption);
  const img = page.getByTestId('lightbox-img');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  // As large as possible: wider than the article image
  expect((await img.boundingBox()).width).toBeGreaterThan(box0.width * (testInfo.project.name === 'desktop' ? 1.2 : 0.95));
  await expect(page.getByTestId('lightbox')).toContainText('1 / 5');
  if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: join(SHOTS, `lightbox-photo-${testInfo.project.name}.png`) }); }

  // Arrow key → next image (an SVG diagram on a light background)
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('lightbox')).toContainText('2 / 5');
  const caption2 = (await article.locator('figure:not(.code)').nth(1).locator('figcaption').textContent()).trim();
  await expect(page.getByTestId('lightbox-caption')).toHaveText(caption2);
  await expect(img).toHaveAttribute('src', /\.svg/);
  expect(await img.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(255, 250, 240)');
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  if (SHOTS) await page.screenshot({ path: join(SHOTS, `lightbox-svg-${testInfo.project.name}.png`) });
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('lightbox')).toContainText('5 / 5');
  // Buttons step too
  await page.getByTestId('lightbox-next').click();
  await expect(page.getByTestId('lightbox')).toContainText('1 / 5');

  // Escape closes, focus back on the page
  await page.keyboard.press('Escape');
  await expect(box).toBeHidden();

  // Keyboard: Enter on a focused image opens; close button closes
  await imgs.nth(2).focus();
  await page.keyboard.press('Enter');
  await expect(box).toBeVisible();
  await expect(page.getByTestId('lightbox')).toContainText('3 / 5');
  await page.getByTestId('lightbox-close').click();
  await expect(box).toBeHidden();

  // Closing and opening again at once: the late close event must not empty the new image
  // (Escape and at once Enter on the next image; input is handled before the queued close event)
  await imgs.nth(1).click();
  await expect(box).toBeVisible();
  const late = await page.evaluate(() => new Promise((res) => {
    const dlg = document.querySelector('[data-testid="lightbox"]');
    const next = document.querySelectorAll('[data-testid="blog-article"] figure:not(.code) > img')[2];
    dlg.addEventListener('close', () => setTimeout(() => res({ open: dlg.open, count: dlg.querySelector('.lb-count')?.textContent }), 0), { once: true });
    dlg.close();
    next.focus();
    next.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }));
  expect(late).toEqual({ open: true, count: '3 / 5' });
  await expect(page.getByTestId('lightbox-img')).toBeVisible();
  await page.getByTestId('lightbox-close').click();
  await expect(box).toBeHidden();

  // Click on the backdrop closes
  await imgs.nth(3).click();
  await expect(box).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(box).toBeHidden();

  // After switching language (v-html re-rendered) the images are still enlargeable, labels in English
  await page.getByTestId('site-lang-en').click();
  await expect(first).toHaveAttribute('aria-label', /^Enlarge image: /);
  await first.click();
  await expect(box).toBeVisible();
  await expect(page.getByTestId('lightbox-close')).toHaveAttribute('aria-label', 'Close');
  await page.keyboard.press('Escape');
  expect(problems).toEqual([]);
});

test('Manual: images open in the same lightbox', async ({ page }) => {
  await page.goto('/manual/');
  const first = page.getByTestId('manual').locator('figure:not(.code) > img').first();
  await first.scrollIntoViewIfNeeded();
  await first.click();
  await expect(page.getByTestId('lightbox')).toBeVisible();
  await expect(page.getByTestId('lightbox-caption')).not.toBeEmpty();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('lightbox')).toBeHidden();
});
